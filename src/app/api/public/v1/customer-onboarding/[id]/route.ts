import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerOnboarding,
  reviewCustomerOnboarding,
  retryForwardToCoreBanking,
} from '@/app/actions/customer-onboarding';
import { getLoggedInUser } from '@/app/actions/memo';
import { errorResponse, successResponse } from '@/lib/api-response';

type Params = { params: { id: string } };

// GET /api/customer-onboarding/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getLoggedInUser();
  if (!user) {
    return errorResponse('You are not authorized to view this record.', 'UNAUTHORIZED', 401);
  }

  const result = await getCustomerOnboarding(params.id);
  if (!result.success) {
    if (result.error === 'Unauthorized') {
      return errorResponse('You are not authorized to view this record.', 'UNAUTHORIZED', 401);
    }
    if (result.error === 'Record not found.') {
      return errorResponse('The requested onboarding record could not be found.', 'NOT_FOUND', 404);
    }
    return errorResponse('Could not retrieve the onboarding record. Please try again later.', 'FORBIDDEN', 403);
  }

  return successResponse(result.record);
}

// PATCH /api/customer-onboarding/[id]
// Body: { action: 'APPROVE' | 'REJECT' | 'RETRY_FORWARD', note?: string }
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getLoggedInUser();
  if (!user) {
    return errorResponse('You are not authorized to perform this action.', 'UNAUTHORIZED', 401);
  }

  let body: { action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse('The request body is not a valid JSON. Please check your formatting.', 'INVALID_JSON', 400);
  }

  const { action, note } = body;

  if (action === 'APPROVE') {
    const result = await reviewCustomerOnboarding({ id: params.id, decision: 'APPROVED', note });
    if (!result.success) {
      return errorResponse(result.error || 'Could not approve the record. Please try again.', 'BAD_REQUEST', 400);
    }
    return successResponse({}, 'Record approved successfully.');
  }

  if (action === 'REJECT') {
    const result = await reviewCustomerOnboarding({ id: params.id, decision: 'REJECTED', note });
    if (!result.success) {
      return errorResponse(result.error || 'Could not reject the record. Please try again.', 'BAD_REQUEST', 400);
    }
    return successResponse({}, 'Record rejected successfully.');
  }

  if (action === 'RETRY_FORWARD') {
    const result = await retryForwardToCoreBanking(params.id);
    if (!result.success) {
      return errorResponse(result.error || 'Could not retry the core banking sync. Please try again.', 'BAD_REQUEST', 400);
    }
    return successResponse({}, 'Core banking sync retried successfully.');
  }

  return errorResponse(`Unknown action: ${action}`, 'BAD_REQUEST', 400);
}

