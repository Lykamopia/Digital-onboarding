import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getLoggedInUser } from '@/app/actions/memo';
import { logSecurityEvent, SecurityEvent } from '@/lib/security-logger';
import { LogSeverity } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Strict Ethiopian mobile number format.
 * Accepts ONLY: +251 followed by exactly 9 digits (0–9).
 * No spaces, dashes, parentheses, alternate prefixes, or country-code-only variants.
 */
const ETHIOPIAN_PHONE_REGEX = /^\+251\d{9}$/;

/**
 * Rate limiting — tighter window for this endpoint since it is public-facing
 * and an attractive target for phone-number enumeration attacks.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;      // max 10 lookups per minute per identity
const WINDOW_MS  = 60_000;  // 1-minute window

// ─── Helpers ──────────────────────────────────────────────────────────────────

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

/**
 * Derive the client IP from standard proxy headers.
 * Falls back to a sentinel value so rate-limiting still works.
 */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  return 'unknown';
}

/**
 * Authenticate the caller:
 *  • System callers: present a matching X-API-Key header.
 *  • Human callers:  have an active session (getLoggedInUser).
 * Returns a stable limit-key for rate-limiting purposes.
 */
async function authenticate(
  req: NextRequest,
): Promise<{ limitKey: string; isSystem: boolean; error?: string }> {
  const apiKey         = req.headers.get('X-API-Key');
  const configuredKey  = process.env.ONBOARDING_API_KEY;

  if (configuredKey && apiKey === configuredKey) {
    // System callers: rate-limit per IP (not just 'system') to catch abuse
    return { limitKey: `system:${getClientIp(req)}`, isSystem: true };
  }

  const user = await getLoggedInUser();
  if (user) {
    return { limitKey: `user:${user.id}`, isSystem: false };
  }

  // Not authenticated — still apply IP-based rate-limiting before we reject,
  // so that unauthenticated probing is throttled.
  return { limitKey: `anon:${getClientIp(req)}`, isSystem: false, error: 'Unauthorized' };
}

// ─── Standard error/success response shapes ───────────────────────────────────

/**
 * All error responses share the same top-level shape:
 * { success: false, error: string, code: string }
 * This prevents callers from detecting application internals via response-shape differences.
 */
function errorResponse(
  message: string,
  code: string,
  httpStatus: number,
  extra?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { success: false, error: message, code, ...extra },
    { status: httpStatus },
  );
}

// ─── GET handler ──────────────────────────────────────────────────────────────

/**
 * GET /api/customer-onboarding/status?phoneNumber=%2B251XXXXXXXXX
 *
 * Query parameter:
 *   phoneNumber  – must be URL-encoded, e.g. %2B251912345678
 *
 * Validation:
 *   1. Parameter must be present.
 *   2. Must match /^\+251\d{9}$/ exactly — no normalisation, no fuzzy matching.
 *
 * Lookup:
 *   Exact-match (case-sensitive, no partial match) against the
 *   mobilePhoneNumbers and phoneNumbersRes columns.
 *
 * Security:
 *   - Per-identity rate limiting (10 req/min) to deter enumeration.
 *   - Every valid-format lookup is logged (hit or miss) to the SecurityLog.
 *   - Invalid-format requests are rejected before any DB access.
 */
export async function GET(req: NextRequest) {
  // ── 1. Authentication ────────────────────────────────────────────────────
  const auth = await authenticate(req);

  // ── 2. Rate limiting (applied even to unauthenticated callers) ───────────
  if (!checkRateLimit(auth.limitKey)) {
    return errorResponse(
      'Too many requests. Please wait before trying again.',
      'RATE_LIMITED',
      429,
      { 'Retry-After': '60' },
    );
  }

  if (auth.error) {
    return errorResponse(auth.error, 'UNAUTHORIZED', 401);
  }

  // ── 3. Extract & validate the phone number ───────────────────────────────
  //
  // ⚠️  URLSearchParams (and the WHATWG URL spec for query strings) follows the
  // application/x-www-form-urlencoded rules where a bare '+' is decoded as a
  // SPACE character. That means ?phoneNumber=+251999999999 would be read as
  // " 251999999999" and fail the regex even though the caller sent a valid
  // Ethiopian number.
  //
  // Fix: extract the raw parameter segment from req.url and decode it with
  // decodeURIComponent, which preserves a literal '+' while still converting
  // '%2B' → '+'. Both input styles therefore produce '+251...' correctly.
  const rawQuery  = req.url.split('?')[1] ?? '';
  const rawParam  = rawQuery.split('&').find((p) => p.startsWith('phoneNumber='));
  const phoneNumber = rawParam
    ? decodeURIComponent(rawParam.slice('phoneNumber='.length))
    : null;

  if (!phoneNumber) {
    return errorResponse(
      'phoneNumber query parameter is required.',
      'MISSING_PARAMETER',
      400,
    );
  }

  // Strict format validation — no normalisation, no trimming, no stripping.
  // The regex enforces the complete canonical Ethiopian format.
  if (!ETHIOPIAN_PHONE_REGEX.test(phoneNumber)) {
    return errorResponse(
      'Invalid phone number format. Expected format: +251XXXXXXXXX (9 digits after the country code).',
      'INVALID_PHONE_FORMAT',
      400,
    );
  }

  // ── 4. Exact-match database lookup ──────────────────────────────────────
  try {
    /**
     * We perform two separate exact-match queries (equals, not contains) to
     * avoid substring matches and guarantee deterministic results.
     *
     * Prisma `equals` does a strict string equality check. The mode is NOT set
     * to 'insensitive' — phone numbers are case-independent by nature, but
     * keeping the check binary ensures no fuzzy collation issues.
     */
    const record = await prisma.customerOnboarding.findFirst({
      where: {
        OR: [
          { mobilePhoneNumbers: { equals: phoneNumber } },
          { phoneNumbersRes:    { equals: phoneNumber } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        approvalStatus: true,
        reviewNote:     true,
        createdAt:      true,
        updatedAt:      true,
        forwardResponse: true,
      },
    });

    // ── 5. Log the lookup outcome ────────────────────────────────────────
    // We log EVERY valid-format lookup (both hits and misses) so security
    // teams can detect enumeration patterns in the SecurityLog.
    // The phone number itself is intentionally NOT included in the log
    // details to limit PII exposure in audit trails.
    await logSecurityEvent({
      event:    record ? SecurityEvent.PHONE_STATUS_LOOKUP_HIT : SecurityEvent.PHONE_STATUS_LOOKUP_MISS,
      severity: LogSeverity.INFO,
      actor:    null,
      details:  record
        ? `Phone status lookup returned a record. Status: ${record.approvalStatus}. Key: ${auth.limitKey}`
        : `Phone status lookup found no matching record. Key: ${auth.limitKey}`,
    }).catch((err) =>
      // Non-fatal — never let logging failure degrade the API response.
      console.error('[status-lookup] Failed to write security log:', err),
    );

    // ── 6. Return standardised response ─────────────────────────────────
    if (!record) {
      // Uniform 404 — identical wording regardless of whether the number
      // is close to an existing one, preventing information leakage.
      return errorResponse(
        'No onboarding record found for the provided phone number.',
        'NOT_FOUND',
        404,
      );
    }

    // Extract account details if they exist in the T24 response
    const forwardResponse = record.forwardResponse as any;
    const accountNumber = forwardResponse?.accountNumber || null;
    const accountHolderName = forwardResponse?.accountHolderName || null;

    return NextResponse.json({
      success:           true,
      status:            record.approvalStatus,
      reviewNote:        record.reviewNote ?? null,
      submittedAt:       record.createdAt,
      updatedAt:         record.updatedAt,
      accountNumber:     accountNumber,
      accountHolderName: accountHolderName,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[status-lookup] Unexpected error:', message);
    return errorResponse('An internal error occurred. Please try again later.', 'INTERNAL_ERROR', 500);
  }
}
