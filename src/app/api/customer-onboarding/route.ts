import { NextRequest, NextResponse } from 'next/server';
import {
  submitCustomerOnboarding,
  listCustomerOnboardings,
} from '@/app/actions/customer-onboarding';
import { CustomerOnboardingSchema } from '@/lib/validations/customer-onboarding';
import { ApprovalStatus, User } from '@prisma/client';
import { getLoggedInUser } from '@/app/actions/memo';

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

  return { error: 'Unauthorized' };
}

// GET /api/customer-onboarding?status=PENDING&page=1&pageSize=20&search=...
export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
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
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json(result);
}

// POST /api/customer-onboarding
export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  // Rate limiting (using user ID or 'system' as key)
  const limitKey = auth.isSystem ? 'system' : (auth.user?.id || 'anonymous');
  if (!checkRateLimit(limitKey)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before submitting again.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  let body: any;
  try {
    const text = await req.text();
    if (!text) {
      return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
    }
    body = JSON.parse(text);
  } catch (err: any) {
    console.error('JSON Parse Error:', err);
    return NextResponse.json({ 
      error: 'Invalid JSON body', 
      details: err.message 
    }, { status: 400 });
  }

  const parsed = CustomerOnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  // Note: if auth.isSystem is true, submitCustomerOnboarding needs to handle a system "actor"
  // or we need to pass a fallback user ID.
  // For now, let's assume system submissions are mapped as 'System' 
  // or ensure submitCustomerOnboarding can handle null user if needed.
  
  const systemActor = auth.isSystem ? { id: 'system-agent', name: 'System Middleware' } : undefined;
  const result = await submitCustomerOnboarding(parsed.data, systemActor);

  if (!result.success) {
    const statusCode = result.error === 'Unauthorized' ? 401
      : result.error?.startsWith('You do not have') ? 403
      : result.fieldErrors ? 422
      : 409;
    return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors }, { status: statusCode });
  }

  return NextResponse.json({ success: true, id: result.id }, { status: 201 });
}
