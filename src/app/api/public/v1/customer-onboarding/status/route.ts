import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getLoggedInUser } from '@/app/actions/memo';
import { logSecurityEvent, SecurityEvent } from '@/lib/security-logger';
import { LogSeverity } from '@/lib/types';
import { errorResponse, successResponse } from '@/lib/api-response';

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

// ─── GET handler ──────────────────────────────────────────────────────────────

/**
 * GET /api/customer-onboarding/status?phoneNumber=%2B251XXXXXXXXX
 *
 * Checks the current approval status of a customer onboarding request by phone number.
 */
export async function GET(req: NextRequest) {
  // ── 1. Authentication ────────────────────────────────────────────────────
  const auth = await authenticate(req);

  // ── 2. Rate limiting (applied even to unauthenticated callers) ───────────
  if (!checkRateLimit(auth.limitKey)) {
    return errorResponse(
      'Too many requests. Please wait before trying again.',
      'RATE_LIMIT_EXCEEDED',
      429
    );
  }

  if (auth.error) {
    return errorResponse('You are not authorized to access this information.', 'UNAUTHORIZED', 401);
  }

  // ── 3. Extract & validate the phone number ───────────────────────────────
  const rawQuery  = req.url.split('?')[1] ?? '';
  const rawParam  = rawQuery.split('&').find((p) => p.startsWith('phoneNumber='));
  const phoneNumber = rawParam
    ? decodeURIComponent(rawParam.slice('phoneNumber='.length))
    : null;

  if (!phoneNumber) {
    return errorResponse(
      'Please provide a phone number to check the status.',
      'BAD_REQUEST',
      400,
    );
  }

  // Strict format validation
  if (!ETHIOPIAN_PHONE_REGEX.test(phoneNumber)) {
    return errorResponse(
      'The phone number format is incorrect. Please use the format +251XXXXXXXXX.',
      'BAD_REQUEST',
      400,
    );
  }

  // ── 4. Exact-match database lookup ──────────────────────────────────────
  try {
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
        approverReviewNote: true,
        createdAt:      true,
        updatedAt:      true,
        forwardResponse: true,
        givenName: true,
        familyName: true,
      },
    });

    // ── 5. Log the lookup outcome ────────────────────────────────────────
    await logSecurityEvent({
      event:    record ? SecurityEvent.PHONE_STATUS_LOOKUP_HIT : SecurityEvent.PHONE_STATUS_LOOKUP_MISS,
      severity: LogSeverity.INFO,
      actor:    null,
      details:  record
        ? `Phone status lookup returned a record. Status: ${record.approvalStatus}. Key: ${auth.limitKey}`
        : `Phone status lookup found no matching record. Key: ${auth.limitKey}`,
    }).catch((err) =>
      console.error('[status-lookup] Failed to write security log:', err),
    );

    // ── 6. Return standardised response ─────────────────────────────────
    if (!record) {
      return errorResponse(
        'No onboarding record found for the provided phone number.',
        'NOT_FOUND',
        404,
      );
    }

    // Extract account details if they exist in the T24 response
    const forwardResponse = record.forwardResponse as any;
    const accountNumber = forwardResponse?.accountNumber || forwardResponse?.CustomerNo || null;
    const accountHolderName = forwardResponse?.accountHolderName || `${record.givenName} ${record.familyName}`.trim() || null;

    return successResponse({
      status:            record.approvalStatus,
      reviewNote:        record.approverReviewNote ?? null,
      submittedAt:       record.createdAt,
      updatedAt:         record.updatedAt,
      accountNumber:     accountNumber,
      accountHolderName: accountHolderName,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[status-lookup] Unexpected error:', message);
    return errorResponse('An internal error occurred. Please try again later.', 'INTERNAL_SERVER_ERROR', 500);
  }
}

