import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { consumeRateLimit, getCurrentUser, jsonError } from '@/lib/http';
import { courseAdminInput } from '@/lib/validation';

export const dynamic = 'force-dynamic';
const uuid = z.string().uuid();
const userRole = z.enum(['INSTRUCTOR', 'STUDENT']);
async function requireAdminMfa(supabase: Awaited<ReturnType<typeof createClient>>) {
  const auth = await getCurrentUser(supabase);
  if (!auth) return { error: jsonError('Unauthorized', 401) };
  if (auth.profile.role !== 'ADMIN') return { error: jsonError('HOD access is required.', 403) };
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || data?.currentLevel !== 'aal2') return { error: jsonError('Complete HOD multi-factor authentication before using this action.', 403) };
  return { auth };
}

export async function GET() {
  const supabase = await createClient();
  const access = await requireAdminMfa(supabase);
  if (access.error) return access.error;
  const [overview, users, departments, semesters, courses, deletionRequests, auditLogs] = await Promise.all([
    supabase.rpc('get_admin_dashboard_overview'),
    supabase.from('users').select('id,email,full_name,role,is_active,department_id,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('departments').select('id,name,code').order('name').limit(100),
    supabase.from('semesters').select('id,name,start_date,end_date,is_active').order('start_date', { ascending: false }).limit(50),
    supabase.from('courses').select('id,title,description,course_code,status,department_id,semester_id,instructor_id').order('created_at', { ascending: false }).limit(100),
    supabase.rpc('admin_list_data_deletion_requests'),
    supabase.from('audit_logs').select('id,actor_id,action,target_type,target_id,details,created_at').order('created_at', { ascending: false }).limit(50)
  ]);
  if (overview.error) return jsonError('Administrator overview requires an active MFA session.', 403);
  if (deletionRequests.error) return jsonError('Unable to load deletion requests for review.', 500);
  if (users.error || departments.error || semesters.error || courses.error || auditLogs.error) return jsonError('Unable to load the administrator workspace.', 500);
  return NextResponse.json({
    overview: Array.isArray(overview.data) ? overview.data[0] ?? null : overview.data,
    users: users.data ?? [], departments: departments.data ?? [], semesters: semesters.data ?? [],
    courses: courses.data ?? [], deletion_requests: deletionRequests.data ?? [], audit_logs: auditLogs.data ?? []
  }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const access = await requireAdminMfa(supabase);
  if (access.error) return access.error;
  if (!await consumeRateLimit(supabase, 'admin:user-update', 10, 60)) return jsonError('User access updates are temporarily rate limited.', 429);
  let body: unknown; try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const action = z.object({ action:z.string().optional() }).passthrough().safeParse(body);
  if (action.success && action.data.action === 'course-update') {
    const parsed = z.object({ action:z.literal('course-update'), course_id:uuid, title:z.string().trim().min(2).max(160), description:z.string().trim().max(5000), course_code:z.string().trim().max(32).nullable(), department_id:uuid.nullable(), semester_id:uuid.nullable(), instructor_id:uuid, status:z.enum(['DRAFT','PUBLISHED','ARCHIVED']) }).strict().safeParse(body);
    if (!parsed.success) return jsonError('Provide valid course details, an instructor, and an academic status.');
    const { course_id,...changes } = parsed.data;
    const { data,error } = await supabase.from('courses').update(changes).eq('id',course_id).select('id,title,description,course_code,status,department_id,semester_id,instructor_id').maybeSingle();
    if (error) return jsonError('The course could not be updated. Check its assignments and publication state.',409);
    if (!data) return jsonError('Course not found.',404);
    await supabase.rpc('admin_record_audit',{p_action:'course.updated',p_target_type:'course',p_target_id:course_id,p_details:{status:data.status,course_code:data.course_code}});
    return NextResponse.json({course:data},{headers:{'Cache-Control':'no-store'}});
  }
  const parsed = z.object({ user_id: uuid, role: userRole, is_active: z.boolean() }).strict().safeParse(body);
  if (!parsed.success) return jsonError('Provide a valid user, role, and active status.');
  const { error } = await supabase.rpc('admin_update_user', { p_user_id: parsed.data.user_id, p_role: parsed.data.role, p_is_active: parsed.data.is_active });
  if (error) return jsonError(error.message.includes('MFA') ? 'HOD MFA is required.' : 'HODs can only activate or remove Student and Teacher accounts. HOD accounts are managed by Platform Super Admin.', 403);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const access = await requireAdminMfa(supabase);
  if (access.error) return access.error;
  let body: unknown; try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const base = z.object({ action: z.string() }).passthrough().safeParse(body);
  if (!base.success) return jsonError('Invalid administrator action.');
  const actorId = access.auth!.user.id;

  if (base.data.action === 'course-create') {
    const { action: _action, ...courseBody } = base.data;
    const parsed = courseAdminInput.safeParse(courseBody);
    if (!parsed.success || !parsed.data.instructor_id) return jsonError('Provide valid course details and an instructor.');
    const { data,error } = await supabase.from('courses').insert({
      instructor_id:parsed.data.instructor_id, title:parsed.data.title, description:parsed.data.description,
      course_code:parsed.data.course_code || null, department_id:parsed.data.department_id ?? null,
      semester_id:parsed.data.semester_id ?? null, status:parsed.data.status
    }).select('id,title,description,course_code,status,department_id,semester_id,instructor_id').single();
    if (error || !data) return jsonError('Course could not be created. Check instructor, department and semester selections.',409);
    await supabase.rpc('admin_record_audit',{p_action:'course.created',p_target_type:'course',p_target_id:data.id,p_details:{title:data.title,status:data.status,course_code:data.course_code}});
    return NextResponse.json({course:data},{status:201,headers:{'Cache-Control':'no-store'}});
  }

  if (base.data.action === 'department') {
    const parsed = z.object({ action: z.literal('department'), name: z.string().trim().min(2).max(100), code: z.string().trim().min(2).max(16).regex(/^[A-Za-z0-9-]+$/) }).strict().safeParse(body);
    if (!parsed.success) return jsonError('Enter a department name and a short alphanumeric code.');
    const { data, error } = await supabase.from('departments').insert({ name: parsed.data.name, code: parsed.data.code.toUpperCase() }).select('id,name,code').single();
    if (error) return jsonError('Department could not be created. The code may already exist.', 409);
    await supabase.rpc('admin_record_audit', { p_action: 'department.created', p_target_type: 'department', p_target_id: data.id, p_details: { name: data.name, code: data.code } });
    return NextResponse.json({ item: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  }
  if (base.data.action === 'semester') {
    const parsed = z.object({ action: z.literal('semester'), name: z.string().trim().min(2).max(80), start_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/), end_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/), is_active: z.boolean().default(false) }).strict().safeParse(body);
    if (!parsed.success || parsed.data.start_date >= parsed.data.end_date) return jsonError('Enter a semester name and a valid start/end date range.');
    const { data, error } = await supabase.from('semesters').insert(parsed.data).select('id,name,start_date,end_date,is_active').single();
    if (error) return jsonError('Semester could not be created. Check the date range and try again.', 409);
    await supabase.rpc('admin_record_audit', { p_action: 'semester.created', p_target_type: 'semester', p_target_id: data.id, p_details: { name: data.name, start_date: data.start_date, end_date: data.end_date } });
    return NextResponse.json({ item: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  }
  if (base.data.action === 'enroll') {
    const parsed = z.object({ action: z.literal('enroll'), course_id: uuid, student_id: uuid }).strict().safeParse(body);
    if (!parsed.success) return jsonError('Select a valid course and student.');
    const { data, error } = await supabase.from('course_enrollments').insert({ course_id: parsed.data.course_id, student_id: parsed.data.student_id, enrolled_by: actorId }).select('id').single();
    if (error) return jsonError('Student could not be enrolled. They may already be enrolled.', 409);
    await supabase.rpc('admin_record_audit', { p_action: 'course.student_enrolled', p_target_type: 'course_enrollment', p_target_id: data.id, p_details: { course_id: parsed.data.course_id, student_id: parsed.data.student_id } });
    return NextResponse.json({ ok: true }, { status: 201 });
  }
  if (base.data.action === 'deletion-review') {
    const parsed = z.object({ action: z.literal('deletion-review'), request_id: uuid, status: z.enum(['IN_REVIEW','APPROVED','REJECTED','COMPLETED']), resolution_note: z.string().trim().min(2).max(500) }).strict().safeParse(body);
    if (!parsed.success) return jsonError('Choose a valid review status and enter a resolution note.');
    const { error } = await supabase.rpc('admin_review_data_deletion_request', {
      p_request_id: parsed.data.request_id, p_status: parsed.data.status, p_resolution_note: parsed.data.resolution_note
    });
    if (error) return jsonError(error.message.includes('MFA') ? 'Administrator MFA is required.' : 'The deletion request could not be updated. Check its current status and resolution note.', 409);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (base.data.action === 'assign-instructor') {
    const parsed = z.object({ action: z.literal('assign-instructor'), course_id: uuid, instructor_id: uuid }).strict().safeParse(body);
    if (!parsed.success) return jsonError('Select a valid course and instructor.');
    const { data, error } = await supabase.from('instructor_course_assignments').insert({ course_id: parsed.data.course_id, instructor_id: parsed.data.instructor_id, assigned_by: actorId }).select('id').single();
    if (error) return jsonError('Instructor could not be assigned. The assignment may already exist.', 409);
    await supabase.rpc('admin_record_audit', { p_action: 'course.instructor_assigned', p_target_type: 'instructor_course_assignment', p_target_id: data.id, p_details: { course_id: parsed.data.course_id, instructor_id: parsed.data.instructor_id } });
    return NextResponse.json({ ok: true }, { status: 201 });
  }
  return jsonError('Unsupported administrator action.', 400);
}
