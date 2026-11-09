import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';
import { parseTeacherStudentWorkbook } from '@/lib/teacher-student-workbook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Sign in with your teacher account before importing students.', 401);
  if (auth.profile.role !== 'INSTRUCTOR') return jsonError('Assigned teacher access is required.', 403);

  const protection = await protectMutation(request, supabase, 'admin:user-update', 5, 3600);
  if (protection) return protection;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    return jsonError('Your teacher sign-in session expired. Sign in again before importing students.', 401);
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const courseId = form?.get('course_id');
  if (!(file instanceof File)) return jsonError('Choose the CoursePulse student .xlsx workbook.');
  if (!file.name.toLowerCase().endsWith('.xlsx')) return jsonError('Upload an Excel .xlsx file. CSV and legacy .xls files are not supported here.');
  if (file.size < 1 || file.size > MAX_FILE_BYTES) return jsonError('Workbook must be smaller than 4 MB.');
  if (typeof courseId !== 'string' || !UUID.test(courseId)) return jsonError('Choose one of your assigned courses.');

  // This database RPC checks assignment ownership before any student invitation is prepared.
  const { data: existingStudents, error: rosterError } = await supabase.rpc(
    'get_instructor_students',
    { p_course_id: courseId }
  );
  if (rosterError?.code === '42501') return jsonError('You are not assigned to this course.', 403);
  if (rosterError) return jsonError('Your assigned class roster could not be verified.', 500);

  let rows;
  try {
    rows = await parseTeacherStudentWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'The Excel workbook could not be read.');
  }

  const existingRoster = Array.isArray(existingStudents) ? existingStudents as Array<{
    student_number?: string | null;
    section?: string | null;
  }> : [];
  const existingNumbers = new Set(existingRoster
    .filter((student) => (student.section ?? '').trim().toLowerCase() === rows[0].section.toLowerCase())
    .map((student) => (student.student_number ?? '').trim().toLowerCase())
    .filter(Boolean));
  const duplicateExisting = rows.find((student) => existingNumbers.has(student.studentNumber.toLowerCase()));
  if (duplicateExisting) {
    return jsonError(
      'Roll number ' + duplicateExisting.studentNumber + ' is already enrolled in section ' + rows[0].section + ' for this course. Remove the duplicate or correct the roll number.'
    );
  }

  const invitations = rows.map((student) => ({
    mobile: student.mobile,
    full_name: student.fullName,
    role: 'STUDENT' as const,
    course_ids: [courseId],
    student_number: student.studentNumber,
    section: student.section,
  }));

  const { data, error } = await supabase.functions.invoke('invite-college-users', {
    body: { invitations },
    headers: {
      Authorization: 'Bearer ' + sessionData.session.access_token,
      'x-app-base-url': request.nextUrl.origin,
    },
  });
  if (error || !data) {
    return jsonError('The secure student invitation service is unavailable. No import summary was returned; check pending phone invitations before retrying.', 503);
  }
  if (data.error) return jsonError(String(data.error), 403);

  const rawResults = Array.isArray(data.results) ? data.results as Array<{
    mobile?: unknown; status?: unknown; error?: unknown;
  }> : [];
  const resultByMobile = new Map(rawResults.map((result) => [
    typeof result.mobile === 'string' ? result.mobile : '',
    result,
  ]));
  const results = rows.map((student) => {
    const result = resultByMobile.get(student.mobile);
    const status = typeof result?.status === 'string' ? result.status : 'FAILED';
    return {
      full_name: student.fullName,
      mobile: student.mobile,
      student_number: student.studentNumber,
      section: student.section,
      status,
      ...(typeof result?.error === 'string' ? { error: result.error } : {}),
    };
  });
  const invited = results.filter((result) => ['INVITED', 'LINKED_EXISTING', 'PENDING_SIGNUP', 'WAITING_FOR_VERIFICATION'].includes(result.status)).length;
  const failed = results.length - invited;

  return NextResponse.json({
    success: true,
    course_id: courseId,
    section: rows[0].section,
    total: rows.length,
    invited,
    failed,
    results,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
