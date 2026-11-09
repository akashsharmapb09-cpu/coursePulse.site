import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json({
    error: 'HOD accounts are assigned only by a verified CoursePulse Platform Super Admin. New public signups always start as Students.'
  }, {
    status: 403,
    headers: { 'Cache-Control': 'no-store' }
  });
}
