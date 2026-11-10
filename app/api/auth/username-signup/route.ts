import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { usernameToAuthEmail } from '@/lib/auth/username-identity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const signupInput = z.object({
  full_name: z.string().trim().min(2).max(120),
  username: z.string().trim().toLowerCase().min(3).max(30).regex(/^[a-z0-9][a-z0-9._-]{2,29}$/),
  password: z.string().min(10).max(72)
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

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } }); }

  const parsed = signupInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your name, a valid username and a password of at least 10 characters.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const { full_name: fullName, username, password } = parsed.data;
  let createdUserId: string | null = null;
  try {
    const address = clientAddress(request);
    const usernameHash = hashIdentifier('signup-username\\0' + username);
    const usernameAddressHash = hashIdentifier('signup-username-ip\\0' + username + '\\0' + address);
    const addressHash = hashIdentifier('signup-ip\\0' + address);
    const admin = createAdminClient();

    const [usernameLimit, usernameAddressLimit, addressLimit] = await Promise.all([
      admin.rpc('consume_username_login_rate_limit', {
        p_identifier_hash: usernameHash, p_limit: 5, p_window_seconds: RATE_WINDOW_SECONDS
      }),
      admin.rpc('consume_username_login_rate_limit', {
        p_identifier_hash: usernameAddressHash, p_limit: 5, p_window_seconds: RATE_WINDOW_SECONDS
      }),
      admin.rpc('consume_username_login_rate_limit', {
        p_identifier_hash: addressHash, p_limit: 20, p_window_seconds: RATE_WINDOW_SECONDS
      })
    ]);

    if (usernameLimit.error || usernameAddressLimit.error || addressLimit.error) {
      return NextResponse.json({ error: 'Account creation is temporarily unavailable. Please try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    if (usernameLimit.data !== true || usernameAddressLimit.data !== true || addressLimit.data !== true) {
      return NextResponse.json(
        { error: 'Too many account creation attempts. Please wait and try again.' },
        { status: 429, headers: { 'Retry-After': String(RATE_WINDOW_SECONDS), 'Cache-Control': 'no-store' } }
      );
    }

    const { data: existing, error: lookupError } = await admin
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (lookupError) {
      return NextResponse.json({ error: 'Account creation is temporarily unavailable. Please try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    if (existing) {
      return NextResponse.json({ error: 'That username is unavailable. Choose another one.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }

    const authEmail = usernameToAuthEmail(username);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, username }
    });

    if (createError || !created.user) {
      return NextResponse.json({ error: 'Account could not be created. Try another username or retry shortly.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }
    createdUserId = created.user.id;

    // Ensure the database profile trigger created the expected Student profile before issuing a session.
    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('id,username,role,is_active')
      .eq('id', createdUserId)
      .maybeSingle();
    if (profileError || !profile || profile.username !== username || profile.role !== 'STUDENT' || !profile.is_active) {
      await admin.auth.admin.deleteUser(createdUserId);
      return NextResponse.json({ error: 'Account setup is temporarily unavailable. Please retry shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    // Sign in on the server so the Supabase session is written to secure HttpOnly cookies.
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: authEmail, password });
    if (signInError) {
      await admin.auth.admin.deleteUser(createdUserId);
      return NextResponse.json({ error: 'Account created, but sign-in could not be completed. Please try signing in.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    if (createdUserId) {
      try { await createAdminClient().auth.admin.deleteUser(createdUserId); }
      catch { /* Keep the public error generic if cleanup is unavailable. */ }
    }
    return NextResponse.json({ error: 'Account creation is temporarily unavailable. Please try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
