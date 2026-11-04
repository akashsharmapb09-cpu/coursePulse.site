import { NextResponse } from 'next/server';
import { ADMIN_SIGNUP_COOKIE } from '@/lib/admin-signup';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SIGNUP_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
