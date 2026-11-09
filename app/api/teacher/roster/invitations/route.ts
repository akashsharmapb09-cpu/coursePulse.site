import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

const inputSchema = z.object({
  course_id: z.string().uuid(),
  email: z.string().trim().email().max(254),
  full_name: z.string().trim().min(2).max(120),
  student_number: z.string().trim().min(1).max(40),
  section: z.string().trim().min(1).max(30),
  mobile: z.string().trim().max(24).optional()
}).strict().superRefine((value, ctx) => {
  if (value.mobile && !/^\+?[0-9 ()-]{8,24}$/.test(value.mobile)) {
    ctx.addIssue({ code: 'custom', path: ['mobile'], message: 'Enter a valid mobile number.' });
  }
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Sign in to add students to your assigned class.', 401);
  if (auth.profile.role !== 'INSTRUCTOR') return jsonError('Assigned teacher access is required.', 403);

  const protection = await protectMutation(request, supabase, 'admin:user-update', 20, 3600);
  if (protection) return protection;

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Check the student details.');

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) return jsonError('Your sign-in session expired. Sign in again.', 401);

  const { data, error } = await supabase.functions.invoke('invite-college-users', {
    body: {
      invitations: [{
        email: parsed.data.email.toLowerCase(),
        full_name: parsed.data.full_name,
        role: 'STUDENT',
        course_ids: [parsed.data.course_id],
        student_number: parsed.data.student_number,
        section: parsed.data.section,
        mobile: parsed.data.mobile ?? ''
      }]
    },
    headers: { Authorization: 'Bearer ' + sessionData.session.access_token }
  });
  if (error || !data) return jsonError('The secure student invitation service is unavailable.', 503);
  if (data.error) return jsonError(String(data.error), 403);
  const result = Array.isArray(data.results) ? data.results[0] : null;
  if (!result || result.status === 'FAILED') {
    return NextResponse.json({
      error: result?.error ?? 'The student invitation could not be created.'
    }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({
    success: true,
    status: result.status,
    email: result.email
  }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
