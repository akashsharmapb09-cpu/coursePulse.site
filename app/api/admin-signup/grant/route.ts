import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ADMIN_SIGNUP_COOKIE, isValidAdminSignupCode, verifyAdminSignupProof
} from '@/lib/admin-signup';

export const runtime = 'nodejs';

function clearProofCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SIGNUP_COOKIE, '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/', maxAge: 0
  });
  return response;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || user.is_anonymous) {
    return NextResponse.json({ error: 'Please sign in before activating an admin account.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { code?: unknown };
  const rawProof = request.cookies.get(ADMIN_SIGNUP_COOKIE)?.value;
  const proof = rawProof ? verifyAdminSignupProof(rawProof) : null;
  const hasDirectCode = typeof body.code === 'string' && isValidAdminSignupCode(body.code);

  if (rawProof && !proof) {
    return NextResponse.json({ error: 'Admin verification expired. Enter the admin code again.' }, { status: 403 });
  }
  if (!proof && !hasDirectCode) return NextResponse.json({ needsCode: true });

  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers as string[] : [];
  const provider = typeof user.app_metadata?.provider === 'string'
    ? user.app_metadata.provider : '';

  if (proof?.method === 'email') {
    if (!user.email || user.email.trim().toLowerCase() !== proof.identity ||
      !(user.email_confirmed_at || user.confirmed_at)) {
      return NextResponse.json({ error: 'Email verification does not match this admin signup.' }, { status: 403 });
    }
  } else if (proof?.method === 'phone') {
    if (!user.phone || user.phone !== proof.identity ||
      !(user.phone_confirmed_at || user.confirmed_at)) {
      return NextResponse.json({ error: 'Phone verification does not match this admin signup.' }, { status: 403 });
    }
  } else if (proof?.method === 'google') {
    if (provider !== 'google' && !providers.includes('google')) {
      return NextResponse.json({ error: 'Complete Google sign-in to activate this admin account.' }, { status: 403 });
    }
  } else if (hasDirectCode) {
    if (!(user.email_confirmed_at || user.phone_confirmed_at || user.confirmed_at)) {
      return NextResponse.json({ error: 'Verify your email or mobile number before activating Admin.' }, { status: 403 });
    }
  }

  try {
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('users').select('role').eq('id', user.id).maybeSingle();
    if (profileError) return NextResponse.json({ error: 'Could not verify your CoursePulse profile.' }, { status: 500 });
    if (!profile) return NextResponse.json({ error: 'Your profile is not ready yet. Try again in a moment.' }, { status: 409 });
    if (profile.role === 'ADMIN') return clearProofCookie(NextResponse.json({ ok: true, role: 'ADMIN' }));
    if (profile.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Only student accounts can be upgraded with the admin code.' }, { status: 403 });
    }

    const { data: updated, error: updateError } = await admin
      .from('users').update({ role: 'ADMIN' })
      .eq('id', user.id).eq('role', 'STUDENT').select('id, role').maybeSingle();
    if (updateError) return NextResponse.json({ error: 'Admin role could not be activated.' }, { status: 500 });
    if (!updated) {
      const { data: latest } = await admin.from('users').select('role').eq('id', user.id).maybeSingle();
      if (latest?.role !== 'ADMIN') return NextResponse.json({ error: 'Admin role could not be activated. Please retry.' }, { status: 409 });
    }
    return clearProofCookie(NextResponse.json({ ok: true, role: 'ADMIN' }));
  } catch {
    return NextResponse.json({ error: 'Admin activation server configuration is incomplete. Add SUPABASE_SERVICE_ROLE_KEY in Vercel.' }, { status: 503 });
  }
}
