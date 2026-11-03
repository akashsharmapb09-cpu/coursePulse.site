import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (auth.profile.role !== 'ADMIN') return jsonError('Administrator access required.', 403);

  const { data, error } = await supabase.rpc('get_admin_dashboard_overview');
  if (error) {
    if (error.code === '42501') return jsonError('Administrator MFA is required.', 403);
    return jsonError('Unable to load institution overview.', 500);
  }
  const overview = Array.isArray(data) ? data[0] : data;
  if (!overview) return jsonError('Institution overview is unavailable.', 500);
  return NextResponse.json({ overview }, { headers: { 'Cache-Control': 'no-store' } });
}
