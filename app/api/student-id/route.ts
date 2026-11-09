import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Sign in to create your student ID.', 401);
  if (auth.profile.role !== 'STUDENT') return jsonError('Student access is required.', 403);

  const protection = await protectMutation(request, supabase, 'account:profile-update', 5, 3600);
  if (protection) return protection;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) return jsonError('Your session expired. Sign in again.', 401);

  const { data, error } = await supabase.functions.invoke('issue-student-card', {
    body: {},
    headers: {
      Authorization: 'Bearer ' + sessionData.session.access_token,
      'x-app-base-url': request.nextUrl.origin
    }
  });
  if (error || !data) return jsonError('The secure student ID service is unavailable.', 503);
  if (data.error) return jsonError(String(data.error), 403);
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
