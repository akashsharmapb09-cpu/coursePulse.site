import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { consumeRateLimit, getCurrentUser, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';

function patternFor(value: string) {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!await consumeRateLimit(supabase, 'search:query', 30, 60)) return jsonError('Search is temporarily rate limited.', 429);

  const query = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
  if (query.length < 2) return NextResponse.json({ results: [] }, { headers: { 'Cache-Control': 'no-store' } });
  const pattern = patternFor(query);

  let allowAdminUserSearch = false;
  if (auth.profile.role === 'ADMIN') {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    allowAdminUserSearch = assurance?.currentLevel === 'aal2';
  }
  const [courses, forms, departments, instructors, users] = await Promise.all([
    supabase.from('courses').select('id,title,course_code').ilike('title', pattern).limit(6),
    supabase.from('feedback').select('id,title,course_id').ilike('title', pattern).limit(6),
    supabase.from('departments').select('id,name,code').ilike('name', pattern).limit(4),
    supabase.rpc('get_student_course_instructors'),
    allowAdminUserSearch
      ? supabase.from('users').select('id,full_name,role').ilike('full_name', pattern).limit(6)
      : Promise.resolve({ data: [], error: null })
  ]);

  const results = [
    ...(courses.data ?? []).map(item => ({ id: item.id, title: item.title, detail: item.course_code ?? 'Course', kind: 'course' as const, tab: 'courses' as const })),
    ...(forms.data ?? []).map(item => ({ id: item.id, title: item.title, detail: 'Feedback form', kind: 'form' as const, tab: 'feedback' as const })),
    ...(departments.data ?? []).map(item => ({ id: item.id, title: item.name, detail: item.code, kind: 'department' as const, tab: 'courses' as const })),
    ...(allowAdminUserSearch ? (users.data ?? []).map(item => ({ id: item.id, title: item.full_name, detail: item.role, kind: 'user' as const, tab: 'admin' as const })) : []),
    ...((instructors.data ?? []) as { course_id: string; instructor_name: string }[])
      .filter(item => item.instructor_name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 4).map(item => ({ id: item.course_id, title: item.instructor_name, detail: 'Course instructor', kind: 'instructor' as const, tab: 'analytics' as const }))
  ];
  const unique = results.filter((item, index) => results.findIndex(candidate => candidate.kind === item.kind && candidate.id === item.id) === index).slice(0, 18);
  return NextResponse.json({ results: unique }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
