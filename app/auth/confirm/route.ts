import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/safe-redirect';

const ALLOWED_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change'];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const rawType = url.searchParams.get('type');
  const nextPath = safeRedirectPath(url.searchParams.get('next'), url.origin);

  const hasTokenHash = Boolean(tokenHash && rawType && ALLOWED_TYPES.includes(rawType as EmailOtpType));
  if (!code && !hasTokenHash) {
    return NextResponse.redirect(new URL('/login?error=confirmation', url.origin));
  }

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: rawType as EmailOtpType
      });

  if (error) {
    return NextResponse.redirect(new URL('/login?error=confirmation', url.origin));
  }

  return NextResponse.redirect(new URL(nextPath, url.origin));
}
