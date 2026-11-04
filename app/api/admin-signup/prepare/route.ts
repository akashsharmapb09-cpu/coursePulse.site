import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SIGNUP_COOKIE, createAdminSignupProof, isValidAdminSignupCode,
  type AdminSignupMethod
} from '@/lib/admin-signup';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as
    | { code?: unknown; method?: unknown; identity?: unknown } | null;

  if (!body || typeof body.code !== 'string' || !isValidAdminSignupCode(body.code)) {
    return NextResponse.json({ error: 'Incorrect admin special code.' }, { status: 403 });
  }

  const method = body.method;
  if (method !== 'email' && method !== 'phone' && method !== 'google') {
    return NextResponse.json({ error: 'Unsupported admin signup method.' }, { status: 400 });
  }

  let identity: string | undefined;
  if (method === 'email') {
    if (typeof body.identity !== 'string') {
      return NextResponse.json({ error: 'Enter the email address for this admin account.' }, { status: 400 });
    }
    identity = body.identity.trim().toLowerCase();
    if (identity.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
  }
  if (method === 'phone') {
    if (typeof body.identity !== 'string') {
      return NextResponse.json({ error: 'Enter the mobile number for this admin account.' }, { status: 400 });
    }
    identity = body.identity.trim();
    if (!/^\+[1-9]\d{7,14}$/.test(identity)) {
      return NextResponse.json({ error: 'Enter a valid mobile number with country code.' }, { status: 400 });
    }
  }

  try {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_SIGNUP_COOKIE, createAdminSignupProof(method as AdminSignupMethod, identity), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', path: '/', maxAge: 2 * 60 * 60
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'Admin signup server configuration is incomplete.' }, { status: 503 });
  }
}
