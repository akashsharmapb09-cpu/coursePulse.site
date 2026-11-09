import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Row = { rowNumber:number; values:Record<string,string> };
type Issue = { sheet:string; row:number; message:string };

const departmentSchema=z.object({
  name:z.string().trim().min(2).max(120),
  code:z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9-]+$/)
});
const semesterSchema=z.object({
  name:z.string().trim().min(2).max(100),
  start_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_active:z.boolean()
});
const teacherSchema=z.object({
  email:z.string().trim().email().max(254).transform(value=>value.toLowerCase()),
  full_name:z.string().trim().min(2).max(120),
  department_code:z.string().trim().max(20).optional().default('')
});
const courseSchema=z.object({
  course_code:z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9-]+$/),
  title:z.string().trim().min(2).max(160),
  description:z.string().max(5000).optional().default(''),
  department_code:z.string().trim().max(20).optional().default(''),
  semester_name:z.string().trim().max(100).optional().default(''),
  teacher_email:z.string().trim().email().max(254).transform(value=>value.toLowerCase()),
  status:z.enum(['DRAFT','PUBLISHED','ARCHIVED']).optional().default('DRAFT')
});

function cellText(value:unknown):string {
  if(value===null||value===undefined) return '';
  if(value instanceof Date) return value.toISOString().slice(0,10);
  if(typeof value==='object') {
    const rich=(value as {richText?:{text?:string}[]}).richText;
    if(Array.isArray(rich)) return rich.map(part=>part.text??'').join('').trim();
    const text=(value as {text?:unknown}).text;
    return typeof text==='string'?text.trim():'';
  }
  return String(value).trim();
}
function parseBoolean(value:string):boolean {
  return ['true','yes','1','active','y'].includes(value.trim().toLowerCase());
}
function isRealDate(value:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date=new Date(value+'T00:00:00.000Z');
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function readSheet(workbook:ExcelJS.Workbook,name:string,requiredHeaders:string[],issues:Issue[]):Row[] {
  const sheet=workbook.getWorksheet(name);
  if(!sheet) return [];
  if(sheet.rowCount>2001) {
    issues.push({sheet:name,row:2002,message:'A sheet may contain at most 2,000 data rows.'});
    return [];
  }
  const columns=new Map<string,number>();
  sheet.getRow(1).eachCell({includeEmpty:false},(cell,column)=>{
    const header=cellText(cell.value).toLowerCase();
    if(header) columns.set(header,column);
  });
  const missing=requiredHeaders.filter(header=>!columns.has(header));
  if(missing.length) {
    issues.push({sheet:name,row:1,message:'Missing column(s): '+missing.join(', ')});
    return [];
  }
  const rows:Row[]=[];
  sheet.eachRow({includeEmpty:false},(row,rowNumber)=>{
    if(rowNumber===1) return;
    const values:Record<string,string>={};
    for(const [header,column] of columns) values[header]=cellText(row.getCell(column).value);
    if(Object.values(values).every(value=>!value)) return;
    rows.push({rowNumber,values});
  });
  return rows;
}
function addDuplicates<T>(items:T[],keyOf:(item:T)=>string,sheet:string,issues:Issue[]) {
  const seen=new Set<string>();
  for(const item of items) {
    const key=keyOf(item).toLowerCase();
    if(!key) continue;
    if(seen.has(key)) issues.push({sheet,row:0,message:'Duplicate value in workbook: '+key});
    seen.add(key);
  }
}
function dateError(start:string,end:string):boolean {
  return !isRealDate(start)||!isRealDate(end)||end<start;
}

async function requireAdmin() {
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth||auth.profile.role!=='ADMIN') return {supabase,auth:null};
  return {supabase,auth};
}

function createAuthAdminClient() {
  const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return null;
  return createSupabaseClient(url,key,{
    auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
  });
}

export async function GET() {
  const {auth}=await requireAdmin();
  if(!auth) return jsonError('Administrator authentication with MFA is required.',401);
  const workbook=new ExcelJS.Workbook();
  workbook.creator='CoursePulse';
  workbook.subject='College academic data import template';
  workbook.created=new Date();
  const sheets=[
    {name:'Departments',headers:['name','code'],widths:[34,18]},
    {name:'Semesters',headers:['name','start_date','end_date','is_active'],widths:[24,16,16,14]},
    {name:'Teachers',headers:['email','full_name','department_code'],widths:[34,28,20]},
    {name:'Courses',headers:['course_code','title','description','department_code','semester_name','teacher_email','status'],widths:[18,32,48,20,24,34,16]}
  ];
  for(const spec of sheets) {
    const sheet=workbook.addWorksheet(spec.name);
    sheet.addRow(spec.headers);
    sheet.views=[{state:'frozen',ySplit:1}];
    sheet.autoFilter={from:'A1',to:String.fromCharCode(64+spec.headers.length)+'1'};
    spec.widths.forEach((width,index)=>{sheet.getColumn(index+1).width=width;});
    sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
    sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF185B49'}};
  }
  const guide=workbook.addWorksheet('Read me');
  guide.addRows([
    ['CoursePulse college master import'],
    ['Fill the four sheets and upload this .xlsx file from the HOD console.'],
    ['Departments: one row per department. Code must be unique.'],
    ['Semesters: dates must use YYYY-MM-DD. is_active accepts TRUE or FALSE.'],
    ['Teachers: use each teacher email once. New email addresses receive a secure invitation email.'],
    ['Courses: course_code must be unique. teacher_email must match a teacher in this workbook or an existing active Teacher account.'],
    ['Course status accepts DRAFT, PUBLISHED or ARCHIVED; blank defaults to DRAFT.'],
    ['Rows with an unknown department, semester or teacher are rejected. Existing matching departments, semesters and courses are updated.'],
    ['Do not include student passwords or existing account passwords in this workbook.']
  ]);
  guide.getColumn(1).width=120;
  guide.getColumn(1).alignment={wrapText:true,vertical:'top'};
  guide.getRow(1).font={bold:true,size:16};
  const bytes=await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(bytes),{
    headers:{
      'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':'attachment; filename="coursepulse-college-template.xlsx"',
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'
    }
  });
}

export async function POST(request:NextRequest) {
  const {supabase,auth}=await requireAdmin();
  if(!auth) return jsonError('Administrator authentication with MFA is required.',401);
  const protection=await protectMutation(request,supabase,'admin:user-update',5,3600);
  if(protection) return protection;

  const form=await request.formData().catch(()=>null);
  const file=form?.get('file');
  if(!(file instanceof File)) return jsonError('Choose an Excel workbook to upload.');
  if(!file.name.toLowerCase().endsWith('.xlsx')) return jsonError('Only .xlsx Excel workbooks are supported.');
  if(file.size<1||file.size>5*1024*1024) return jsonError('The workbook must be between 1 byte and 5 MB.');
  const buffer=Buffer.from(await file.arrayBuffer());
  const workbook=new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Buffer);
  } catch {
    return jsonError('The uploaded file is not a valid .xlsx workbook.');
  }

  const issues:Issue[]=[];
  const departmentRows=readSheet(workbook,'Departments',['name','code'],issues);
  const semesterRows=readSheet(workbook,'Semesters',['name','start_date','end_date','is_active'],issues);
  const teacherRows=readSheet(workbook,'Teachers',['email','full_name','department_code'],issues);
  const courseRows=readSheet(workbook,'Courses',['course_code','title','description','department_code','semester_name','teacher_email','status'],issues);
  const totalRows=departmentRows.length+semesterRows.length+teacherRows.length+courseRows.length;
  if(totalRows===0) issues.push({sheet:'Workbook',row:0,message:'Add at least one data row to a supported sheet.'});
  if(totalRows>2000) issues.push({sheet:'Workbook',row:0,message:'A workbook may contain at most 2,000 data rows in total.'});

  const departments: {rowNumber:number;name:string;code:string}[]=[];
  for(const row of departmentRows) {
    const parsed=departmentSchema.safeParse(row.values);
    if(!parsed.success) issues.push({sheet:'Departments',row:row.rowNumber,message:parsed.error.issues[0]?.message??'Invalid department row.'});
    else departments.push({...parsed.data,rowNumber:row.rowNumber});
  }
  const semesters: {rowNumber:number;name:string;start_date:string;end_date:string;is_active:boolean}[]=[];
  for(const row of semesterRows) {
    const activeValue=(row.values.is_active??'').trim().toLowerCase();
    if(!['','true','false','yes','no','1','0','active','inactive','y','n'].includes(activeValue)) {
      issues.push({sheet:'Semesters',row:row.rowNumber,message:'is_active must be TRUE or FALSE.'});
      continue;
    }
    const values={...row.values,is_active:parseBoolean(activeValue)};
    const parsed=semesterSchema.safeParse(values);
    if(!parsed.success) issues.push({sheet:'Semesters',row:row.rowNumber,message:parsed.error.issues[0]?.message??'Invalid semester row.'});
    else if(dateError(parsed.data.start_date,parsed.data.end_date)) issues.push({sheet:'Semesters',row:row.rowNumber,message:'Use real YYYY-MM-DD dates and an end date on or after the start date.'});
    else semesters.push({...parsed.data,rowNumber:row.rowNumber});
  }
  const teachers: {rowNumber:number;email:string;full_name:string;department_code:string}[]=[];
  for(const row of teacherRows) {
    const parsed=teacherSchema.safeParse(row.values);
    if(!parsed.success) issues.push({sheet:'Teachers',row:row.rowNumber,message:parsed.error.issues[0]?.message??'Invalid teacher row.'});
    else teachers.push({...parsed.data,rowNumber:row.rowNumber});
  }
  const courses: {rowNumber:number;course_code:string;title:string;description:string;department_code:string;semester_name:string;teacher_email:string;status:'DRAFT'|'PUBLISHED'|'ARCHIVED'}[]=[];
  for(const row of courseRows) {
    const parsed=courseSchema.safeParse({...row.values,status:row.values.status||'DRAFT'});
    if(!parsed.success) issues.push({sheet:'Courses',row:row.rowNumber,message:parsed.error.issues[0]?.message??'Invalid course row.'});
    else courses.push({...parsed.data,rowNumber:row.rowNumber});
  }
  addDuplicates(departments,item=>item.code,'Departments',issues);
  addDuplicates(departments,item=>item.name,'Departments',issues);
  addDuplicates(semesters,item=>item.name,'Semesters',issues);
  addDuplicates(teachers,item=>item.email,'Teachers',issues);
  addDuplicates(courses,item=>item.course_code,'Courses',issues);
  if(issues.length) return NextResponse.json({error:'Please correct the workbook before importing.',issues},{status:422,headers:{'Cache-Control':'no-store'}});

  const [departmentLookup,semesterLookup,userLookup,courseLookup]=await Promise.all([
    supabase.from('departments').select('id,name,code'),
    supabase.from('semesters').select('id,name,start_date,end_date,is_active'),
    supabase.from('users').select('id,email,full_name,role,is_active,department_id'),
    supabase.from('courses').select('id,course_code,title,description,status,department_id,semester_id,instructor_id')
  ]);
  if(departmentLookup.error||semesterLookup.error||userLookup.error||courseLookup.error) return jsonError('Unable to validate the workbook against current college data.',500);

  const existingDepartments=new Map((departmentLookup.data??[]).map(item=>[item.code.toLowerCase(),item]));
  const existingSemesters=new Map((semesterLookup.data??[]).map(item=>[item.name.toLowerCase(),item]));
  const existingUsers=new Map((userLookup.data??[]).filter(item=>item.email).map(item=>[(item.email as string).toLowerCase(),item]));
  const existingCourses=new Map((courseLookup.data??[]).filter(item=>item.course_code).map(item=>[(item.course_code as string).toLowerCase(),item]));
  const departmentCodes=new Set([...existingDepartments.keys(),...departments.map(item=>item.code.toLowerCase())]);
  const semesterNames=new Set([...existingSemesters.keys(),...semesters.map(item=>item.name.toLowerCase())]);
  const importedTeachers=new Set(teachers.map(item=>item.email));
  const newTeacherRows=teachers.filter(item=>!existingUsers.has(item.email));
  for(const teacher of teachers) {
    const existing=existingUsers.get(teacher.email);
    if(existing&&existing.role!=='INSTRUCTOR') issues.push({sheet:'Teachers',row:teacher.rowNumber,message:'This email already belongs to a non-Teacher account. It was not changed.'});
    else if(existing&&!existing.is_active) issues.push({sheet:'Teachers',row:teacher.rowNumber,message:'This Teacher account is suspended. Restore it before importing.'});
    if(teacher.department_code&&!departmentCodes.has(teacher.department_code.toLowerCase())) issues.push({sheet:'Teachers',row:teacher.rowNumber,message:'Unknown department_code: '+teacher.department_code});
  }
  for(const course of courses) {
    if(course.department_code&&!departmentCodes.has(course.department_code.toLowerCase())) issues.push({sheet:'Courses',row:course.rowNumber,message:'Unknown department_code: '+course.department_code});
    if(course.semester_name&&!semesterNames.has(course.semester_name.toLowerCase())) issues.push({sheet:'Courses',row:course.rowNumber,message:'Unknown semester_name: '+course.semester_name});
    const user=existingUsers.get(course.teacher_email);
    if(!importedTeachers.has(course.teacher_email)&&(!user||user.role!=='INSTRUCTOR'||!user.is_active)) issues.push({sheet:'Courses',row:course.rowNumber,message:'teacher_email must match a row in Teachers or an existing active Teacher account.'});
    if(importedTeachers.has(course.teacher_email)&&user&&user.role!=='INSTRUCTOR') issues.push({sheet:'Courses',row:course.rowNumber,message:'The selected teacher email belongs to a non-Teacher account.'});
  }
  if(issues.length) return NextResponse.json({error:'Please correct the workbook references before importing.',issues},{status:422,headers:{'Cache-Control':'no-store'}});
  if(newTeacherRows.length&&!createAuthAdminClient()) return jsonError('New Teacher invitations need the server-only SUPABASE_SECRET_KEY environment variable. No workbook rows were imported.',503);

  const counts={departments:0,semesters:0,teachers:0,courses:0};
  let invitedTeachers=0;
  const teacherIds=new Map<string,string>();
  const departmentIds=new Map<string,string>();
  const semesterIds=new Map<string,string>();
  const authAdmin=createAuthAdminClient();

  for(const item of departments) {
    const existing=existingDepartments.get(item.code.toLowerCase());
    const saved=existing
      ? await supabase.from('departments').update({name:item.name,code:item.code.toUpperCase()}).eq('id',existing.id).select('id').single()
      : await supabase.from('departments').insert({name:item.name,code:item.code.toUpperCase()}).select('id').single();
    if(saved.error||!saved.data) {issues.push({sheet:'Departments',row:item.rowNumber,message:'Department could not be saved. Check for a duplicate name or code.'});continue;}
    departmentIds.set(item.code.toLowerCase(),saved.data.id);
    existingDepartments.set(item.code.toLowerCase(),{id:saved.data.id,name:item.name,code:item.code.toUpperCase()});
    const audit=await supabase.rpc('admin_record_audit',{p_action:'department.imported',p_target_type:'department',p_target_id:saved.data.id,p_details:{code:item.code.toUpperCase(),imported_by:auth.user.id}});
    if(audit.error) issues.push({sheet:'Departments',row:item.rowNumber,message:'Department saved, but its audit event failed.'});
    counts.departments++;
  }
  const freshDepartments=await supabase.from('departments').select('id,name,code');
  for(const item of freshDepartments.data??[]) departmentIds.set(item.code.toLowerCase(),item.id);

  for(const item of semesters) {
    const existing=existingSemesters.get(item.name.toLowerCase());
    const saved=existing
      ? await supabase.from('semesters').update({name:item.name,start_date:item.start_date,end_date:item.end_date,is_active:item.is_active}).eq('id',existing.id).select('id').single()
      : await supabase.from('semesters').insert({name:item.name,start_date:item.start_date,end_date:item.end_date,is_active:item.is_active}).select('id').single();
    if(saved.error||!saved.data) {issues.push({sheet:'Semesters',row:item.rowNumber,message:'Semester could not be saved. Check its name and date range.'});continue;}
    semesterIds.set(item.name.toLowerCase(),saved.data.id);
    existingSemesters.set(item.name.toLowerCase(),{id:saved.data.id,name:item.name,start_date:item.start_date,end_date:item.end_date,is_active:item.is_active});
    const audit=await supabase.rpc('admin_record_audit',{p_action:'semester.imported',p_target_type:'semester',p_target_id:saved.data.id,p_details:{name:item.name,imported_by:auth.user.id}});
    if(audit.error) issues.push({sheet:'Semesters',row:item.rowNumber,message:'Semester saved, but its audit event failed.'});
    counts.semesters++;
  }
  const freshSemesters=await supabase.from('semesters').select('id,name');
  for(const item of freshSemesters.data??[]) semesterIds.set(item.name.toLowerCase(),item.id);

  for(const item of teachers) {
    let user=existingUsers.get(item.email);
    if(!user) {
      const invited=await authAdmin!.auth.admin.inviteUserByEmail(item.email,{data:{full_name:item.full_name}});
      if(invited.error||!invited.data.user) {
        issues.push({sheet:'Teachers',row:item.rowNumber,message:'Invitation could not be sent to this teacher email.'});
        continue;
      }
      invitedTeachers++;
      const profile=await supabase.from('users').select('id,role,is_active,department_id').eq('id',invited.data.user.id).maybeSingle();
      if(profile.error||!profile.data) {
        issues.push({sheet:'Teachers',row:item.rowNumber,message:'Invitation was sent, but the teacher profile is not ready yet. Retry after the profile is created.'});
        continue;
      }
      const promote=await supabase.rpc('admin_update_user',{p_user_id:profile.data.id,p_role:'INSTRUCTOR',p_is_active:true});
      if(promote.error) {
        issues.push({sheet:'Teachers',row:item.rowNumber,message:'Invitation was sent, but the Teacher role could not be assigned. Contact the administrator before retrying.'});
        continue;
      }
      user={id:profile.data.id,email:item.email,full_name:item.full_name,role:'INSTRUCTOR',is_active:true,department_id:profile.data.department_id};
      existingUsers.set(item.email,user);
    }
    if(item.department_code) {
      const departmentId=departmentIds.get(item.department_code.toLowerCase());
      if(!departmentId) {issues.push({sheet:'Teachers',row:item.rowNumber,message:'Teacher department could not be resolved.'});continue;}
      const assigned=await supabase.rpc('admin_assign_user_department',{p_user_id:user.id,p_department_id:departmentId});
      if(assigned.error) {issues.push({sheet:'Teachers',row:item.rowNumber,message:'Teacher department could not be assigned.'});continue;}
    }
    teacherIds.set(item.email,user.id);
    counts.teachers++;
  }

  for(const item of courses) {
    const teacherId=teacherIds.get(item.teacher_email)??existingUsers.get(item.teacher_email)?.id;
    const departmentId=item.department_code?departmentIds.get(item.department_code.toLowerCase())??null:null;
    const semesterId=item.semester_name?semesterIds.get(item.semester_name.toLowerCase())??null:null;
    if(!teacherId) {issues.push({sheet:'Courses',row:item.rowNumber,message:'Teacher account was not available; course was not imported.'});continue;}
    if(item.department_code&&!departmentId) {issues.push({sheet:'Courses',row:item.rowNumber,message:'Department could not be resolved; course was not imported.'});continue;}
    if(item.semester_name&&!semesterId) {issues.push({sheet:'Courses',row:item.rowNumber,message:'Semester could not be resolved; course was not imported.'});continue;}
    const existing=existingCourses.get(item.course_code.toLowerCase());
    const values={instructor_id:teacherId,title:item.title,description:item.description,course_code:item.course_code.toUpperCase(),department_id:departmentId,semester_id:semesterId,status:item.status};
    const saved=existing
      ? await supabase.from('courses').update(values).eq('id',existing.id).select('id').single()
      : await supabase.from('courses').insert(values).select('id').single();
    if(saved.error||!saved.data) {issues.push({sheet:'Courses',row:item.rowNumber,message:'Course could not be saved. Check the course code and instructor assignment.'});continue;}
    const audit=await supabase.rpc('admin_record_audit',{p_action:existing?'course.import_updated':'course.imported',p_target_type:'course',p_target_id:saved.data.id,p_details:{course_code:item.course_code.toUpperCase(),imported_by:auth.user.id}});
    if(audit.error) issues.push({sheet:'Courses',row:item.rowNumber,message:'Course saved, but its audit event failed.'});
    counts.courses++;
  }

  return NextResponse.json({
    complete:issues.length===0,
    counts,
    invited_teachers:invitedTeachers,
    issues
  },{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
