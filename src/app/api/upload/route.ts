import { NextRequest, NextResponse } from 'next/server';
import { POST as internalPOST, DELETE as internalDELETE } from '../internal/upload/route';

/**
 * Legacy/Redirect route to handle any requests hitting /api/upload 
 * (to avoid 404/500 HTML responses while browser cache clears).
 */
export async function POST(req: NextRequest) {
  return internalPOST(req);
}

export async function DELETE(req: NextRequest) {
  return internalDELETE(req);
}
