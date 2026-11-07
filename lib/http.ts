import { NextResponse } from 'next/server';
export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function getCurrentUser(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile, error: profileError } = await supabase.from('users').select('id,email,full_name,role').eq('id', user.id).single();
  if (profileError || !profile) return null;
  return { user, profile };
}

/** Consume a database-backed per-user rate limit. Fail closed when the limiter cannot be reached. */
export async function consumeRateLimit(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  action: 'courses:create' | 'feedback:create' | 'responses:submit' | 'admin:user-update' | 'account:password-change' | 'account:profile-update' | 'account:deletion-request' | 'search:query' | 'analytics:query' | 'exports:download',
  limit: number,
  windowSeconds = 60
) {
  const { data, error } = await supabase.rpc('consume_api_rate_limit', {
    p_action: action, p_limit: limit, p_window_seconds: windowSeconds
  });
  return !error && data === true;
}
