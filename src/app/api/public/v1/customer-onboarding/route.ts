import { NextRequest, NextResponse } from 'next/server';
import {
  submitCustomerOnboarding,
  listCustomerOnboardings,
} from '@/app/actions/customer-onboarding';
import { CustomerOnboardingSchema } from '@/lib/validations/customer-onboarding';
import { ApprovalStatus, User } from '@prisma/client';
import { getLoggedInUser } from '@/app/actions/memo';
import { errorResponse, successResponse, formatZodError } from '@/lib/api-response';

// Simple in-memory rate limiter per key (resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 50;      // higher limit for system keys
const WINDOW_MS  = 60_000; // per minute

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

// Helper to authenticate either via Session or API Key
async function authenticate(req: NextRequest): Promise<{ user?: any, isSystem?: boolean, error?: string }> {
  // Check for API Key first (System-to-System)
  const apiKey = req.headers.get('X-API-Key');
  const configuredKey = process.env.ONBOARDING_API_KEY;

  if (configuredKey && apiKey === configuredKey) {
    return { isSystem: true };
  }

  // Fallback to Session (Human Admin)
  const user = await getLoggedInUser();
  if (user) return { user };

  return { error: 'Unauthorized access' };
}

import { logSecurityEvent, SecurityEvent } from '@/lib/security-logger';
import { LogSeverity } from '@/lib/types';
import { getRegionLabel } from '@/lib/region-mapping';

// GET /api/public/v1/customer-onboarding?status=PENDING&page=1&pageSize=20&search=...
export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth.error) {
    await logSecurityEvent({
        event: SecurityEvent.PERMISSION_DENIED,
        severity: LogSeverity.WARN,
        actor: null,
        details: `Unauthorized access attempt to GET /api/public/v1/customer-onboarding.`,
    });
    return errorResponse('You are not authorized to perform this action.', 'UNAUTHORIZED', 401);
  }

  const { searchParams } = new URL(req.url);
  const status   = searchParams.get('status') as ApprovalStatus | null;
  const page     = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const search   = searchParams.get('search') || undefined;

  const result = await listCustomerOnboardings({
    status:   status ?? undefined,
    page,
    pageSize: Math.min(pageSize, 100),
    search,
  });

  if (!result.success) {
    await logSecurityEvent({
        event: SecurityEvent.PERMISSION_DENIED,
        severity: LogSeverity.WARN,
        actor: auth.user,
        details: `Failed to list customer onboardings. Error: ${result.error}`,
    });
    return errorResponse('Could not retrieve onboarding records. Please try again later.', 'FORBIDDEN', 403);
  }

  await logSecurityEvent({
    event: SecurityEvent.CUSTOMER_ONBOARDING_SUBMITTED,
    severity: LogSeverity.INFO,
    actor: auth.user,
    details: `Successfully listed customer onboardings.`,
  });

  return successResponse(result);
}

// POST /api/public/v1/customer-onboarding
export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth.error) {
    await logSecurityEvent({
        event: SecurityEvent.PERMISSION_DENIED,
        severity: LogSeverity.WARN,
        actor: null,
        details: `Unauthorized access attempt to POST /api/public/v1/customer-onboarding.`,
    });
    return errorResponse('You are not authorized to perform this action.', 'UNAUTHORIZED', 401);
  }

  // Rate limiting (using user ID or 'system' as key)
  const limitKey = auth.isSystem ? 'system' : (auth.user?.id || 'anonymous');
  if (!checkRateLimit(limitKey)) {
    await logSecurityEvent({
        event: SecurityEvent.PERMISSION_DENIED,
        severity: LogSeverity.WARN,
        actor: auth.user,
        details: `Rate limit exceeded for customer onboarding submission.`,
    });
    return errorResponse('Too many requests. Please wait before submitting again.', 'RATE_LIMIT_EXCEEDED', 429);
  }

  let body: any;
  try {
    const text = await req.text();
    if (!text) {
      return errorResponse('Request body is empty. Please provide valid JSON data.', 'BAD_REQUEST', 400);
    }
    body = JSON.parse(text);
    console.log('New customer onboarding request:', body);
    
    // Presentation Layer Mapping: Ensure psuToken exists as a presentation alias
    if (!body.psuToken) {
      body.psuToken = body.legalIdNumber || body.nationalIDNumber;
    }

    // Region Mapping: Map region ID to label
    if (body.region) {
      body.region = getRegionLabel(body.region);
    }
  } catch (err: any) {
    console.error('JSON Parse Error:', err);
    await logSecurityEvent({
        event: SecurityEvent.CUSTOMER_ONBOARDING_FORWARD_FAILED,
        severity: LogSeverity.CRITICAL,
        actor: auth.user,
        details: `Failed to parse customer onboarding request body. Error: ${err.message}`,
    });
    return errorResponse('The request body is not a valid JSON. Please check your formatting.', 'INVALID_JSON', 400);
  }

  const parsed = CustomerOnboardingSchema.safeParse(body);
  if (!parsed.success) {
    const userFriendlyMessage = formatZodError(parsed.error);
    await logSecurityEvent({
        event: SecurityEvent.CUSTOMER_ONBOARDING_FORWARD_FAILED,
        severity: LogSeverity.CRITICAL,
        actor: auth.user,
        details: `Failed to validate customer onboarding request body. Error: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    });
    return errorResponse(userFriendlyMessage, 'VALIDATION_ERROR', 422);
  }

  // Note: if auth.isSystem is true, submitCustomerOnboarding needs to handle a system "actor"
  // or we need to pass a fallback user ID.
  // For now, let's assume system submissions are mapped as 'System' 
  // or ensure submitCustomerOnboarding can handle null user if needed.
  
  const systemActor = auth.isSystem ? { id: 'system-agent', name: 'System Middleware' } : undefined;
  const result = await submitCustomerOnboarding(parsed.data, systemActor);

  if (!result.success) {
    await logSecurityEvent({
        event: SecurityEvent.CUSTOMER_ONBOARDING_FORWARD_FAILED,
        severity: LogSeverity.CRITICAL,
        actor: auth.user,
        details: `Failed to submit customer onboarding. Error: ${result.error}`,
    });

    if (result.error === 'Unauthorized') {
      return errorResponse('You are not authorized to perform this action.', 'UNAUTHORIZED', 401);
    }

    if (result.error?.startsWith('You do not have')) {
      return errorResponse('You do not have permission to perform this action.', 'FORBIDDEN', 403);
    }

    if (result.fieldErrors) {
      return errorResponse('The provided information is invalid. Please check your data and try again.', 'VALIDATION_ERROR', 422);
    }

    // Default error for conflicts or other issues
    return errorResponse(result.error || 'Submission failed. Please check for duplicate records or try again later.', 'CONFLICT', 409);
  }

  await logSecurityEvent({
    event: SecurityEvent.CUSTOMER_ONBOARDING_SUBMITTED,
    severity: LogSeverity.INFO,
    actor: auth.user,
    details: `Successfully submitted customer onboarding. ID: ${result.id}`,
  });

  return successResponse({ id: result.id }, 'Customer onboarding submission received successfully.', 201);
}

