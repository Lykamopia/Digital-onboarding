import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getLoggedInUser } from '@/app/actions/memo';

// Simple in-memory rate limiter per IP/Key (resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 50;     
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
  const apiKey = req.headers.get('X-API-Key');
  const configuredKey = process.env.ONBOARDING_API_KEY;

  if (configuredKey && apiKey === configuredKey) {
    return { isSystem: true };
  }

  const user = await getLoggedInUser();
  if (user) return { user };

  return { error: 'Unauthorized' };
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  // Rate limiting (using user ID or 'system' as key)
  const limitKey = auth.isSystem ? 'system' : (auth.user?.id || 'anonymous');
  if (!checkRateLimit(limitKey)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before asking again.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const { searchParams } = new URL(req.url);
  let phoneNumber = searchParams.get('phoneNumber');

  if (!phoneNumber) {
    return NextResponse.json({ error: 'phoneNumber query parameter is required' }, { status: 400 });
  }

  // Remove spaces, pluses, dashes, and parentheses
  const cleanPhone = phoneNumber.replace(/[\s+\-()]/g, '');
  
  // Ethiopian numbers typically end with 9 digits (e.g. 911234567).
  // Using the last 9 digits avoids mismatches between +251..., 09..., or 251...
  // If the number is shorter, use whatever was provided.
  const searchPhone = cleanPhone.length >= 9 ? cleanPhone.slice(-9) : cleanPhone;

  if (!searchPhone) {
    return NextResponse.json({ error: 'Invalid phone number format provided' }, { status: 400 });
  }

  try {
    // Find the most recent record matching the phone number
    const record = await prisma.customerOnboarding.findFirst({
      where: {
        OR: [
          { mobilePhoneNumbers: { contains: searchPhone } },
          { phoneNumbersRes: { contains: searchPhone } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      select: {
        approvalStatus: true,
        reviewNote: true,
        createdAt: true,
      }
    });

    if (!record) {
      return NextResponse.json({ error: 'No onboarding request found for the given phone number' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      status: record.approvalStatus,
      reviewNote: record.reviewNote || null,
      submittedAt: record.createdAt
    });

  } catch (err: any) {
    console.error('Error fetching status by phone:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
