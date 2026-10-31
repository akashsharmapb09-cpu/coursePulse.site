import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic='force-dynamic';
const inputSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('department'),name:z.string().trim().min(2).max(120),code:z.string().trim().min(2).max(20)}).strict(),
  z.object({action:z.literal('semester'),name:z.string().trim().min(2).max(100),start_date:z.string().date(),end_date:z.string().date()}).strict(),
  z.object({action:z.literal('enroll'),course_id:z.string().uuid(),student_id:z.string().uuid()}).strict(),
  z.object({action:z.literal('assign'),course_id:z.string().uuid(),instructor_id:z.string().uuid()}).strict(),
  z.object({action:z.literal('course_academic'),course_id:z.string().uuid(),department_id:z.string().uuid().nullable(),semester_id:z.string().uuid().nullable()}).strict(),
  z.object({action:z.literal('user_department'),user_id:z.string().uuid(),department_id:z.string().uuid().nullable()}).strict()
]);

const updateSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('department_update'),department_id:z.string().uuid(),name:z.string().trim().min(2).max(120),code:z.string().trim().min(2).max(20)}).strict(),
  z.object({action:z.literal('semester_update'),semester_id:z.string().uuid(),name:z.string().trim().min(2).max(100),start_date:z.string().date(),end_date:z.string().date(),is_active:z.boolean()}).strict()
]);

async function adminAuth(){
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth) return {supabase,auth:null};
  if(auth.profile.role!=='ADMIN') return {supabase,auth:null};
  return {supabase,auth};
}

export async function GET(){
  const {supabase,auth}=await adminAuth();
  if(!auth) return jsonError('Administrator authentication with MFA is required.',401);
  const [departments,semesters,courses,users,enrollments,assignments]=await Promise.all([
    supabase.from('departments').select('id,name,code').order('name').limit(500),
    supabase.from('semesters').select('id,name,start_date,end_date,is_active').order('start_date',{ascending:false}).limit(100),
    supabase.from('courses').select('id,title,department_id,semester_id,status').order('title').limit(500),
    supabase.from('users').select('id,email,full_name,role,is_active,department_id').order('full_name').limit(1000),
    supabase.from('course_enrollments').select('id,course_id,student_id,enrolled_at').order('enrolled_at',{ascending:false}).limit(1000),
    supabase.from('instructor_course_assignments').select('id,course_id,instructor_id,created_at').order('created_at',{ascending:false}).limit(1000)
  ]);
  const errors=[departments.error,semesters.error,courses.error,users.error,enrollments.error,assignments.error].filter(Boolean);
  if(errors.length) return jsonError('Unable to load academic administration data.',500);
  return NextResponse.json({
    departments:departments.data??[],semesters:semesters.data??[],courses:courses.data??[],
    accounts:users.data??[],
    students:(users.data??[]).filter(user=>user.role==='STUDENT'&&user.is_active),
    instructors:(users.data??[]).filter(user=>user.role==='INSTRUCTOR'&&user.is_active),
    enrollments:enrollments.data??[],assignments:assignments.data??[]
  },{headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:NextRequest){
  const {supabase,auth}=await adminAuth();
  if(!auth) return jsonError('Administrator authentication with MFA is required.',401);
  const protection=await protectMutation(request,supabase,'admin:user-update',20,3600);
  if(protection) return protection;
  let body:unknown;
  try{body=await request.json();}catch{return jsonError('Invalid JSON body.');}
  const parsed=inputSchema.safeParse(body);
  if(!parsed.success) return jsonError(parsed.error.issues[0]?.message??'Invalid academic update.');
  const input=parsed.data;
  let targetId:string|null=null;
  let auditAction='';
  let auditHandled=false;
  if(input.action==='department'){
    const {data,error}=await supabase.from('departments').insert({name:input.name,code:input.code}).select('id').single();
    if(error) return jsonError(error.code==='23505'?'Department name or code already exists.':'Department could not be created.',error.code==='23505'?409:400);
    targetId=data.id; auditAction='department.created';
  }else if(input.action==='semester'){
    if(input.end_date<input.start_date) return jsonError('Semester end date must be on or after the start date.');
    const {data,error}=await supabase.from('semesters').insert({name:input.name,start_date:input.start_date,end_date:input.end_date,is_active:false}).select('id').single();
    if(error) return jsonError(error.code==='23505'?'Semester already exists.':'Semester could not be created.',error.code==='23505'?409:400);
    targetId=data.id; auditAction='semester.created';
  }else if(input.action==='enroll'){
    const {data:student}=await supabase.from('users').select('id,role,is_active').eq('id',input.student_id).maybeSingle();
    if(!student||student.role!=='STUDENT'||!student.is_active) return jsonError('Choose an active student account.',400);
    const {data,error}=await supabase.from('course_enrollments').insert({course_id:input.course_id,student_id:input.student_id,enrolled_by:auth.user.id}).select('id').single();
    if(error) return jsonError(error.code==='23505'?'Student is already enrolled in this course.':'Enrollment could not be created.',error.code==='23505'?409:400);
    targetId=data.id; auditAction='course.student.enrolled';
  }else if(input.action==='assign'){
    const {data:instructor}=await supabase.from('users').select('id,role,is_active').eq('id',input.instructor_id).maybeSingle();
    if(!instructor||instructor.role!=='INSTRUCTOR'||!instructor.is_active) return jsonError('Choose an active instructor account.',400);
    const {data,error}=await supabase.from('instructor_course_assignments').insert({course_id:input.course_id,instructor_id:input.instructor_id,assigned_by:auth.user.id}).select('id').single();
    if(error) return jsonError(error.code==='23505'?'Instructor is already assigned to this course.':'Instructor assignment could not be created.',error.code==='23505'?409:400);
    targetId=data.id; auditAction='course.instructor.assigned';
  }else if(input.action==='user_department'){
    const {error}=await supabase.rpc('admin_assign_user_department',{
      p_user_id:input.user_id,
      p_department_id:input.department_id
    });
    if(error?.code==='P0002') return jsonError('User or department not found.',404);
    if(error?.code==='42501') return jsonError('Administrator authentication with MFA is required.',403);
    if(error?.code==='23503') return jsonError('Selected department was not found.',404);
    if(error) return jsonError('User department could not be updated.',500);
    targetId=input.user_id;
    auditAction='user.department.updated';
    auditHandled=true;
  }else{
    const {data,error}=await supabase.from('courses').update({department_id:input.department_id,semester_id:input.semester_id}).eq('id',input.course_id).select('id').single();
    if(error||!data) return jsonError('Course academic details could not be updated.',400);
    targetId=data.id; auditAction='course.academic.updated';
  }
  if(!auditHandled){
    const {error:auditError}=await supabase.rpc('admin_record_audit',{p_action:auditAction,p_target_type:input.action,p_target_id:targetId,p_details:{performed_by:auth.user.id}});
    if(auditError) return jsonError('The change was saved, but its audit record could not be written. Contact the system administrator.',500);
  }
  return NextResponse.json({success:true,id:targetId},{status:201,headers:{'Cache-Control':'no-store'}});
}


export async function PATCH(request:NextRequest){
  const {supabase,auth}=await adminAuth();
  if(!auth) return jsonError('Administrator authentication with MFA is required.',401);
  const protection=await protectMutation(request,supabase,'admin:user-update',20,3600);
  if(protection) return protection;
  let body:unknown;
  try{body=await request.json();}catch{return jsonError('Invalid JSON body.');}
  const parsed=updateSchema.safeParse(body);
  if(!parsed.success) return jsonError(parsed.error.issues[0]?.message??'Invalid academic update.');
  const input=parsed.data;
  let targetId:string|null=null;
  let auditAction='';
  let targetType='';
  let auditDetails:Record<string,unknown>={performed_by:auth.user.id};

  if(input.action==='department_update'){
    const {data,error}=await supabase.from('departments').update({name:input.name,code:input.code}).eq('id',input.department_id).select('id').maybeSingle();
    if(error) return jsonError(error.code==='23505'?'Department name or code already exists.':'Department could not be updated.',error.code==='23505'?409:400);
    if(!data) return jsonError('Department not found.',404);
    targetId=data.id;
    auditAction='department.updated';
    targetType='department';
    auditDetails={...auditDetails,name:input.name,code:input.code};
  }else{
    if(input.end_date<input.start_date) return jsonError('Semester end date must be on or after the start date.');
    const {data,error}=await supabase.from('semesters').update({name:input.name,start_date:input.start_date,end_date:input.end_date,is_active:input.is_active}).eq('id',input.semester_id).select('id').maybeSingle();
    if(error) return jsonError(error.code==='23505'?'Semester name already exists.':'Semester could not be updated.',error.code==='23505'?409:400);
    if(!data) return jsonError('Semester not found.',404);
    targetId=data.id;
    auditAction='semester.updated';
    targetType='semester';
    auditDetails={...auditDetails,name:input.name,start_date:input.start_date,end_date:input.end_date,is_active:input.is_active};
  }

  const {error:auditError}=await supabase.rpc('admin_record_audit',{p_action:auditAction,p_target_type:targetType,p_target_id:targetId,p_details:auditDetails});
  if(auditError) return jsonError('The academic change was saved, but its audit record could not be written. Contact the system administrator.',500);
  return NextResponse.json({success:true,id:targetId},{headers:{'Cache-Control':'no-store'}});
}
