import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const loginInput = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-z0-9][a-z0-9._-]{2,29}$/i),
  password: z.string().min(1).max(72)
}).strict();

const RATE_WINDOW_SECONDS = 900;

function hashIdentifier(value: string) {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Server-side Supabase key is not configured.');
  return createHmac('sha256', secret).update(value).digest('hex');
}

function isAllowedOrigin(request: NextRequest) {
  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');
  let origin: string | null = null;

  try {
    if (originHeader) origin = new URL(originHeader).origin;
    else if (refererHeader) origin = new URL(refererHeader).origin;
  } catch {
    return false;
  }

  if (!origin) return false;
  const allowed = new Set([request.nextUrl.origin]);
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try { allowed.add(new URL(configured).origin); }
    catch { return false; }
  }
  return allowed.has(origin);
}

function clientAddress(request: NextRequest) {
  const vercelAddress = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  const directAddress = request.headers.get('x-real-ip')?.trim();
  const forwardedAddress = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  return vercelAddress || directAddress || forwardedAddress || 'unknown';
}

function authFailure() {
  return NextResponse.json(
    { error: 'Sign-in failed. Check your username and password and try again.' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } }); }

  const parsed = loginInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid username and password.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const username = parsed.data.username.toLowerCase();
  try {
    const address = clientAddress(request);
    const usernameHash = hashIdentifier('username\0' + username);
    const usernameAddressHash = hashIdentifier('username-ip\0' + username + '\0' + address);
    const addressHash = hashIdentifier('ip\0' + address);
    const admin = createAdminClient();
    const [usernameLimit, usernameAddressLimit, addressLimit] = await Promise.all([
      admin.rpc('consume_username_login_rate_limit', {
        p_identifier_hash: usernameHash, p_limit: 20, p_window_seconds: RATE_WINDOW_SECONDS
      }),
      admin.rpc('consume_username_login_rate_limit', {
        p_identifier_hash: usernameAddressHash, p_limit: 8, p_window_seconds: RATE_WINDOW_SECONDS
      }),
      admin.rpc('consume_username_login_rate_limit', {
        p_identifier_hash: addressHash, p_limit: 40, p_window_seconds: RATE_WINDOW_SECONDS
      })
    ]);

    if (usernameLimit.error || usernameAddressLimit.error || addressLimit.error) {
      return NextResponse.json({ error: 'Sign-in is temporarily unavailable. Please try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    if (usernameLimit.data !== true || usernameAddressLimit.data !== true || addressLimit.data !== true) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Please wait and try again.' },
        { status: 429, headers: { 'Retry-After': String(RATE_WINDOW_SECONDS), 'Cache-Control': 'no-store' } }
      );
    }

    const { data: profile, error: lookupError } = await admin
      .from('users')
      .select('email,is_active')
      .eq('username', username)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: 'Sign-in is temporarily unavailable. Please try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    const usableProfile = Boolean(profile?.is_active && profile.email);
    const dummyEmail = 'unknown-' + hashIdentifier(username).slice(0, 16) + '@coursepulse.invalid';
    const authEmail = usableProfile ? profile!.email! : dummyEmail;
    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: parsed.data.password
    });

    if (authError || !usableProfile) return authFailure();

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Do not leak service-role configuration, Auth, lookup, or cookie errors to callers.
    return NextResponse.json({ error: 'Sign-in is temporarily unavailable. Please try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
