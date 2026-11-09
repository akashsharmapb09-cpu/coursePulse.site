import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';
import { parseAcademicWorkbook } from '@/lib/academic-workbook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_BYTES = 4 * 1024 * 1024;
type CourseRecord = {
  id: string;
  course_code: string | null;
  title: string;
  description: string;
  status: string;
  instructor_id: string;
  department_id: string | null;
};

function failure(message: string, status = 400, partial?: Record<string, number>) {
  return NextResponse.json(
    { error: message, ...(partial ? { partial } : {}) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('HOD authentication with MFA is required.', 401);
  if (auth.profile.role !== 'ADMIN') return jsonError('Only the college HOD can import the academic workbook.', 403);

  const protection = await protectMutation(request, supabase, 'admin:user-update', 10, 3600);
  if (protection) return protection;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    return jsonError('Your HOD sign-in session expired. Sign in again before importing this workbook.', 401);
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return jsonError('Choose the CoursePulse .xlsx workbook to upload.');
  if (!file.name.toLowerCase().endsWith('.xlsx')) return jsonError('Upload an Excel .xlsx file. CSV and legacy .xls files are not supported here.');
  if (file.size < 1 || file.size > MAX_FILE_BYTES) return jsonError('Workbook must be smaller than 4 MB to fit the secure upload limit.');

  let workbook;
  try {
    workbook = await parseAcademicWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'The Excel workbook could not be read.');
  }

  const [departmentQuery, courseQuery] = await Promise.all([
    supabase.from('departments').select('id,name,code').order('name').limit(1000),
    supabase.from('courses')
      .select('id,course_code,title,description,status,instructor_id,department_id')
      .order('title').limit(5000),
  ]);
  if (departmentQuery.error || courseQuery.error) {
    return jsonError('Your college academic directory could not be loaded. Refresh and try again.', 503);
  }

  const existingDepartments = departmentQuery.data ?? [];
  const existingCourses = (courseQuery.data ?? []) as CourseRecord[];
  const existingDepartmentByCode = new Map(existingDepartments.map((item) => [item.code.trim().toUpperCase(), item]));
  const existingDepartmentById = new Map(existingDepartments.map((item) => [item.id, item]));
  const importedDepartmentByCode = new Map(workbook.departments.map((item) => [item.code, item]));

  for (const department of workbook.departments) {
    const nameOwner = existingDepartments.find((item) =>
      item.name.trim().toLowerCase() === department.name.toLowerCase() &&
      item.code.trim().toUpperCase() !== department.code
    );
    if (nameOwner) {
      return jsonError('Department "' + department.name + '" already exists with code ' + nameOwner.code + '. Reuse that code in the workbook.');
    }
  }

  const existingCourseByCode = new Map<string, CourseRecord>();
  const plannedCourseDepartmentByCode = new Map<string, string>();
  for (const course of existingCourses) {
    if (!course.course_code) continue;
    const courseCode = course.course_code.trim().toUpperCase();
    existingCourseByCode.set(courseCode, course);
    const department = course.department_id ? existingDepartmentById.get(course.department_id) : null;
    if (department) plannedCourseDepartmentByCode.set(courseCode, department.code.trim().toUpperCase());
  }

  for (const course of workbook.courses) {
    if (!workbook.departments.length && !existingDepartments.length) {
      return jsonError('Add at least one department before importing courses.');
    }
    const departmentExists = importedDepartmentByCode.has(course.departmentCode) || existingDepartmentByCode.has(course.departmentCode);
    if (!departmentExists) {
      return jsonError('Course ' + course.code + ' references unknown department ' + course.departmentCode + '. Add it to Departments or use an existing department code.');
    }
    plannedCourseDepartmentByCode.set(course.code, course.departmentCode);
  }

  for (const teacher of workbook.teachers) {
    const departmentExists = importedDepartmentByCode.has(teacher.departmentCode) || existingDepartmentByCode.has(teacher.departmentCode);
    if (!departmentExists) {
      return jsonError('Teacher ' + teacher.mobile + ' references unknown department ' + teacher.departmentCode + '.');
    }
    for (const courseCode of teacher.courseCodes) {
      if (!plannedCourseDepartmentByCode.has(courseCode)) {
        return jsonError('Teacher ' + teacher.mobile + ' references unknown course ' + courseCode + '. Add it to Courses or use an existing course code.');
      }
      if (plannedCourseDepartmentByCode.get(courseCode) !== teacher.departmentCode) {
        return jsonError('Teacher ' + teacher.mobile + ' and course ' + courseCode + ' must belong to the same department.');
      }
    }
  }

  const departmentIds = new Map(existingDepartments.map((item) => [item.code.trim().toUpperCase(), item.id]));
  let departmentsCreated = 0;
  let departmentsUpdated = 0;
  let departmentsReused = 0;

  for (const department of workbook.departments) {
    const existing = existingDepartmentByCode.get(department.code);
    if (existing) {
      departmentIds.set(department.code, existing.id);
      if (existing.name !== department.name) {
        const { error } = await supabase.from('departments')
          .update({ name: department.name }).eq('id', existing.id);
        if (error) {
          return failure('Department ' + department.code + ' could not be updated. Earlier department changes, if any, remain saved.', 409, {
            departmentsCreated, departmentsUpdated, departmentsReused,
          });
        }
        departmentsUpdated += 1;
      } else {
        departmentsReused += 1;
      }
    } else {
      const { data, error } = await supabase.from('departments')
        .insert({ name: department.name, code: department.code })
        .select('id').single();
      if (error || !data) {
        return failure('Department ' + department.code + ' could not be created. Check duplicate department names/codes and retry.', 409, {
          departmentsCreated, departmentsUpdated, departmentsReused,
        });
      }
      departmentIds.set(department.code, data.id);
      departmentsCreated += 1;
    }
  }

  const courseIds = new Map<string, string>();
  let coursesCreated = 0;
  let coursesUpdated = 0;
  const newCourseIds = new Set<string>();

  for (const course of workbook.courses) {
    const departmentId = departmentIds.get(course.departmentCode) ?? existingDepartmentByCode.get(course.departmentCode)?.id;
    if (!departmentId) {
      return failure('Department ' + course.departmentCode + ' could not be resolved. Some department rows may already be saved.', 409, {
        departmentsCreated, departmentsUpdated, departmentsReused, coursesCreated, coursesUpdated,
      });
    }
    const existing = existingCourseByCode.get(course.code);
    if (existing) {
      const { error } = await supabase.from('courses').update({
        title: course.title,
        description: course.description,
        department_id: departmentId,
        status: course.status,
      }).eq('id', existing.id);
      if (error) {
        return failure('Course ' + course.code + ' could not be updated. Earlier workbook changes, if any, remain saved.', 409, {
          departmentsCreated, departmentsUpdated, departmentsReused, coursesCreated, coursesUpdated,
        });
      }
      courseIds.set(course.code, existing.id);
      coursesUpdated += 1;
    } else {
      const { data, error } = await supabase.from('courses').insert({
        instructor_id: auth.user.id,
        course_code: course.code,
        title: course.title,
        description: course.description,
        department_id: departmentId,
        status: course.status,
      }).select('id').single();
      if (error || !data) {
        return failure('Course ' + course.code + ' could not be created. Check the course details and try again.', 409, {
          departmentsCreated, departmentsUpdated, departmentsReused, coursesCreated, coursesUpdated,
        });
      }
      courseIds.set(course.code, data.id);
      newCourseIds.add(data.id);
      coursesCreated += 1;
    }
  }

  const invitations = workbook.teachers.map((teacher) => ({
    email: teacher.mobile,
    full_name: teacher.fullName,
    role: 'INSTRUCTOR' as const,
    department_id: departmentIds.get(teacher.departmentCode) ?? existingDepartmentByCode.get(teacher.departmentCode)!.id,
    course_ids: teacher.courseCodes.map((courseCode) => courseIds.get(courseCode) ?? existingCourseByCode.get(courseCode)!.id),
  }));

  const { data: inviteData, error: inviteError } = await supabase.functions.invoke('invite-college-users', {
    body: { invitations },
    headers: {
      Authorization: 'Bearer ' + sessionData.session.access_token,
      'x-app-base-url': request.nextUrl.origin,
    },
  });

  const warnings: string[] = [];
  let rawResults: Array<Record<string, unknown>> = [];
  if (inviteError || !inviteData || inviteData.error) {
    const reason = typeof inviteData?.error === 'string' ? inviteData.error : 'The secure invitation service could not be reached.';
    warnings.push(reason);
    rawResults = workbook.teachers.map((teacher) => ({
      mobile: teacher.mobile, role: 'INSTRUCTOR', status: 'FAILED',
      error: 'Academic data was saved, but the activation invitation was not sent. ' + reason,
    }));
  } else {
    rawResults = Array.isArray(inviteData.results) ? inviteData.results as Array<Record<string, unknown>> : [];
    if (!rawResults.length) {
      rawResults = workbook.teachers.map((teacher) => ({
        email: teacher.mobile, role: 'INSTRUCTOR', status: 'FAILED',
        error: 'The invitation service returned no result for this teacher.',
      }));
    }
  }

  const teacherByMobile = new Map(workbook.teachers.map((teacher) => [teacher.mobile, teacher]));
  const primaryInstructorByCourse = new Map<string, string>();
  for (const result of rawResults) {
    const mobile = typeof result.mobile === 'string' ? result.mobile : '';
    const userId = typeof result.user_id === 'string' ? result.user_id : '';
    const status = typeof result.status === 'string' ? result.status : '';
    const teacher = teacherByMobile.get(mobile);
    if (!teacher || !userId || (status !== 'INVITED' && status !== 'LINKED_EXISTING')) continue;
    for (const code of teacher.courseCodes) {
      const courseId = courseIds.get(code) ?? existingCourseByCode.get(code)?.id;
      if (courseId && newCourseIds.has(courseId) && !primaryInstructorByCourse.has(courseId)) {
        primaryInstructorByCourse.set(courseId, userId);
      }
    }
  }

  for (const [courseId, instructorId] of primaryInstructorByCourse) {
    const { error } = await supabase.from('courses').update({ instructor_id: instructorId }).eq('id', courseId);
    if (error) warnings.push('A primary teacher could not be set for one newly created course. Its assigned teacher access remains linked through the roster assignment.');
  }

  const teachersInvited = rawResults.filter((result) => ['INVITED','LINKED_EXISTING','PENDING_SIGNUP','WAITING_FOR_VERIFICATION'].includes(String(result.status))).length;
  const teachersFailed = workbook.teachers.length - teachersInvited;
  const teacherResults = rawResults.map((result) => ({
    mobile: typeof result.mobile === 'string' ? result.mobile : 'Unknown mobile',
    role: 'TEACHER',
    status: typeof result.status === 'string' ? result.status : 'FAILED',
    ...(typeof result.error === 'string' ? { error: result.error } : {}),
  }));

  const { error: auditError } = await supabase.rpc('admin_record_audit', {
    p_action: 'academic.workbook.imported',
    p_target_type: 'academic_workbook',
    p_target_id: null,
    p_details: {
      departments_created: departmentsCreated,
      departments_updated: departmentsUpdated,
      departments_reused: departmentsReused,
      courses_created: coursesCreated,
      courses_updated: coursesUpdated,
      teachers_invited: teachersInvited,
      teachers_failed: teachersFailed,
    },
  });
  if (auditError) warnings.push('The academic import completed, but its audit entry could not be written. Contact the platform administrator.');

  return NextResponse.json({
    success: true,
    departments_created: departmentsCreated,
    departments_updated: departmentsUpdated,
    departments_reused: departmentsReused,
    courses_created: coursesCreated,
    courses_updated: coursesUpdated,
    teachers_invited: teachersInvited,
    teachers_failed: teachersFailed,
    teacher_results: teacherResults,
    warnings,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
