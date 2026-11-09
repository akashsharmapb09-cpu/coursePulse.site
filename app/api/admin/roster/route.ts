import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('HOD authentication with MFA is required.', 401);
  if (auth.profile.role !== 'ADMIN') return jsonError('HOD access is required.', 403);

  const { data, error } = await supabase.rpc('get_head_student_roster');
  if (error?.code === '42501') return jsonError('HOD MFA is required to view student contact details.', 403);
  if (error) return jsonError('The college roster could not be loaded.', 500);
  return NextResponse.json({ students: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
