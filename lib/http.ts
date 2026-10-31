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
