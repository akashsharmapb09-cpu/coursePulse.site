import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change'];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const rawType = url.searchParams.get('type');
  const rawNext = url.searchParams.get('next');
  const nextPath = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
    ? rawNext
    : '/dashboard';

  if (!tokenHash || !rawType || !ALLOWED_TYPES.includes(rawType as EmailOtpType)) {
    return NextResponse.redirect(new URL('/login?error=confirmation', url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: rawType as EmailOtpType
  });

  if (error) {
    return NextResponse.redirect(new URL('/login?error=confirmation', url.origin));
  }

  return NextResponse.redirect(new URL(nextPath, url.origin));
}
