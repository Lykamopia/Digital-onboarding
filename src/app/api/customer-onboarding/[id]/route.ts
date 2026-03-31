import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerOnboarding,
  reviewCustomerOnboarding,
  retryForwardToCoreBanking,
} from '@/app/actions/customer-onboarding';
import { getLoggedInUser } from '@/app/actions/memo';

type Params = { params: { id: string } };

// GET /api/customer-onboarding/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await getCustomerOnboarding(params.id);
  if (!result.success) {
    const status = result.error === 'Unauthorized' ? 401
      : result.error === 'Record not found.' ? 404
      : 403;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.record);
}

// PATCH /api/customer-onboarding/[id]
// Body: { action: 'APPROVE' | 'REJECT' | 'RETRY_FORWARD', note?: string }
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, note } = body;

  if (action === 'APPROVE') {
    const result = await reviewCustomerOnboarding({ id: params.id, decision: 'APPROVED', note });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'REJECT') {
    const result = await reviewCustomerOnboarding({ id: params.id, decision: 'REJECTED', note });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'RETRY_FORWARD') {
    const result = await retryForwardToCoreBanking(params.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
