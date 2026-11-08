import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { protectMutation } from '@/lib/http';
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

  // HTTP attempts and direct RPC attempts have separate database-backed buckets.
  const protection = await protectMutation(request, supabase, 'admin-signup:route', 5, 900);
  if (protection) return protection;

  const body = await request.json().catch(() => ({})) as { code?: unknown };
  const rawProof = request.cookies.get(ADMIN_SIGNUP_COOKIE)?.value;
  const proof = rawProof ? verifyAdminSignupProof(rawProof) : null;
  const hasDirectCode = typeof body.code === 'string' && isValidAdminSignupCode(body.code);

  if (rawProof && !proof) {
    return NextResponse.json({ error: 'Admin verification expired. Enter the admin code again.' }, { status: 403 });
  }

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
  } else {
    return NextResponse.json({ needsCode: true });
  }

  if (!hasDirectCode) return NextResponse.json({ needsCode: true });

  const { error: claimError } = await supabase.rpc('claim_admin_signup', { p_code: body.code });
  if (claimError) {
    return NextResponse.json({ error: 'Admin role could not be activated. Please try again.' }, { status: 403 });
  }

  // The RPC returns normally for denied attempts so PostgreSQL can commit the
  // rate-limit increment. Confirm the resulting database role before reporting success.
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'ADMIN') {
    return NextResponse.json({
      error: 'Admin role could not be activated. Check the code and account eligibility, then try again.'
    }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  return clearProofCookie(NextResponse.json({ ok: true, role: 'ADMIN' }));
}
