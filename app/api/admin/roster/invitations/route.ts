import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

const invitationSchema = z.object({
  email: z.string().trim().email().max(254).optional(),
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(['STUDENT', 'INSTRUCTOR']),
  department_id: z.string().uuid().nullable().optional(),
  course_ids: z.array(z.string().uuid()).min(1).max(25),
  student_number: z.string().trim().min(1).max(40).optional(),
  section: z.string().trim().max(30).optional(),
  mobile: z.string().trim().regex(/^\+[1-9]\d{7,14}$/),
}).strict().superRefine((value, ctx) => {
  if (value.role === 'STUDENT' && !value.student_number) {
    ctx.addIssue({ code: 'custom', path: ['student_number'], message: 'Student number is required.' });
  }
  if (value.mobile && !/^\+?[0-9 ()-]{8,24}$/.test(value.mobile)) {
    ctx.addIssue({ code: 'custom', path: ['mobile'], message: 'Enter a valid mobile number.' });
  }
});

const bodySchema = z.object({
  invitations: z.array(invitationSchema).min(1).max(100)
}).strict();

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('HOD authentication with MFA is required.', 401);
  if (auth.profile.role !== 'ADMIN') return jsonError('HOD access is required.', 403);

  const protection = await protectMutation(request, supabase, 'admin:user-update', 10, 3600);
  if (protection) return protection;

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Check the invitation details.');

  const seen = new Set<string>();
  for (const invitation of parsed.data.invitations) {
    const mobile = invitation.mobile;
    if (seen.has(mobile)) return jsonError('Remove duplicate mobile numbers before sending invitations.');
    seen.add(mobile);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    return jsonError('Your sign-in session expired. Sign in again.', 401);
  }

  const { data, error } = await supabase.functions.invoke('invite-college-users', {
    body: { invitations: parsed.data.invitations.map(item => ({
      ...item,
      email: item.email?.toLowerCase(),
      department_id: item.department_id ?? null,
      section: item.section ?? '',
      mobile: item.mobile ?? ''
    })) },
    headers: {
      Authorization: 'Bearer ' + sessionData.session.access_token,
      'x-app-base-url': request.nextUrl.origin
    }
  });

  if (error || !data) return jsonError('The college invitation service is unavailable. Verify the Supabase phone/SMS Auth configuration and retry.', 503);
  if (data.error) return jsonError(String(data.error), 400);
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
