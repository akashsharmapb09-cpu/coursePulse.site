import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { courseInput } from '@/lib/validation';
import { getCurrentUser, jsonError, consumeRateLimit } from '@/lib/http';

export const dynamic = 'force-dynamic';
export async function GET() {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  const query = supabase.from('courses').select('id,title,description,course_code,status,created_at,instructor_id,department_id,semester_id').order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) return jsonError('Unable to load courses.', 500);
  const courses = data ?? [];
  let instructorNames = new Map<string,string>();
  if (auth.profile.role === 'STUDENT') {
    const { data: assigned } = await supabase.rpc('get_student_course_instructors');
    instructorNames = new Map((assigned ?? []).map((row:{course_id:string;instructor_name:string})=>[row.course_id,row.instructor_name]));
  } else if (auth.profile.role === 'INSTRUCTOR') {
    instructorNames = new Map(courses.filter(course=>course.instructor_id===auth.user.id).map(course=>[course.id,auth.profile.full_name]));
  } else {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel === 'aal2') {
      const instructorIds = Array.from(new Set(courses.map(course=>course.instructor_id).filter(Boolean)));
      if (instructorIds.length) {
        const { data: instructors } = await supabase.from('users').select('id,full_name').in('id',instructorIds);
        instructorNames = new Map((instructors ?? []).map(user=>[user.id,user.full_name]));
      }
    }
  }
  return NextResponse.json({ courses: courses.map(course=>({ ...course, instructor_name: instructorNames.get(course.id) ?? null })) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!['ADMIN', 'INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Only instructors and admins can create courses.', 403);
  if (auth.profile.role === 'ADMIN') { const { data: assurance, error: mfaError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(); if (mfaError || assurance?.currentLevel !== 'aal2') return jsonError('Administrator MFA is required for course creation.',403); }
  if (!await consumeRateLimit(supabase, 'courses:create', 10, 60)) return jsonError('Course creation is temporarily rate limited. Please try again shortly.', 429);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const parsed = courseInput.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid course details.');
  const { data, error } = await supabase.from('courses').insert({
    instructor_id: auth.user.id,
    title: parsed.data.title,
    description: parsed.data.description,
    status: 'PUBLISHED'
  }).select('id,title,description,status,created_at,instructor_id').single();
  if (error) return jsonError('Course could not be created. Check your role and try again.', 403);
  return NextResponse.json({ course: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
