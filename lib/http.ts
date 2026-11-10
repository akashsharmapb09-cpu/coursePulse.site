import { NextRequest, NextResponse } from 'next/server';
export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function getCurrentUser(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile, error: profileError } = await supabase.from('users').select('id,email,username,full_name,role,is_active').eq('id', user.id).single();
  if (profileError || !profile || !profile.is_active) return null;
  if (profile.role === 'ADMIN') { const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(); if (assuranceError || assurance?.currentLevel !== 'aal2') return null; }
  return { user, profile };
}

/** Consume a database-backed per-user rate limit. Fail closed when the limiter cannot be reached. */
export async function consumeRateLimit(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  action: 'courses:create' | 'feedback:create' | 'responses:submit' | 'admin:user-update' | 'admin-signup:route' | 'admin-signup:claim' | 'account:password-change' | 'account:profile-update' | 'account:deletion-request' | 'search:query' | 'analytics:query' | 'exports:download',
  limit: number,
  windowSeconds = 60
) {
  const { data, error } = await supabase.rpc('consume_api_rate_limit', {
    p_action: action, p_limit: limit, p_window_seconds: windowSeconds
  });
  return !error && data === true;
}


export async function protectMutation(
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  action: 'courses:create' | 'feedback:create' | 'responses:submit' | 'admin:user-update' | 'admin-signup:route' | 'admin-signup:claim' | 'account:password-change' | 'account:profile-update' | 'account:deletion-request' | 'search:query',
  limit: number,
  windowSeconds: number
): Promise<NextResponse | null> {
  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');
  let requestOrigin: string | null = null;
  try {
    if (originHeader) requestOrigin = new URL(originHeader).origin;
    else if (refererHeader) requestOrigin = new URL(refererHeader).origin;
  } catch {
    return jsonError('Invalid request origin.', 403);
  }
  const allowedOrigins = new Set([request.nextUrl.origin]);
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredOrigin) {
    try {
      allowedOrigins.add(new URL(configuredOrigin).origin);
    } catch {
      // Invalid deployment configuration fails closed.
    }
  }
  if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
    return jsonError('Cross-origin mutation rejected.', 403);
  }
  const { data, error } = await supabase.rpc('consume_api_rate_limit', {
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });
  if (error) return jsonError('Mutation protection is temporarily unavailable. Please retry shortly.', 503);
  if (data !== true) return NextResponse.json(
    { error: 'Too many requests. Please wait before trying again.' },
    { status: 429, headers: { 'Retry-After': String(windowSeconds), 'Cache-Control': 'no-store' } }
  );
  return null;
}

export async function checkReadRateLimit(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>, action:'analytics:query'|'exports:download', limit:number, windowSeconds:number):Promise<NextResponse|null>{
 const {data,error}=await supabase.rpc('consume_api_rate_limit',{p_action:action,p_limit:limit,p_window_seconds:windowSeconds});
 if(error)return jsonError('This report is temporarily unavailable. Please retry shortly.',503);
 if(data!==true)return NextResponse.json({error:'You have reached the report request limit. Please try again later.'},{status:429,headers: { 'Retry-After': String(windowSeconds), 'Cache-Control': 'no-store' }}); return null;
}
