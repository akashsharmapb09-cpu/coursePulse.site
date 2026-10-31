import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
const idSchema=z.string().uuid();
const restoreSchema=z.object({version:z.number().int().min(1).max(1000000)}).strict();

async function authorize(){
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth)return {supabase,auth:null};
  if(!['ADMIN','INSTRUCTOR'].includes(auth.profile.role))return {supabase,auth:null};
  return {supabase,auth};
}

export async function GET(_request:NextRequest,context:Context){
  const {supabase,auth}=await authorize();
  if(!auth)return jsonError('Instructor or administrator authentication is required.',401);
  const params=await context.params;
  const parsedId=idSchema.safeParse(params.id);
  if(!parsedId.success)return jsonError('Invalid feedback form ID.',400);
  const {data,error}=await supabase.rpc('get_feedback_versions',{p_feedback_id:parsedId.data});
  if(error?.code==='P0002')return jsonError('Feedback form not found.',404);
  if(error?.code==='42501')return jsonError('You do not own this feedback form.',403);
  if(error)return jsonError('Could not load feedback version history.',500);
  return NextResponse.json({versions:data??[]},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:NextRequest,context:Context){
  const {supabase,auth}=await authorize();
  if(!auth)return jsonError('Instructor or administrator authentication is required.',401);
  const protection=await protectMutation(request,supabase,'feedback:create',10,3600);
  if(protection)return protection;
  const params=await context.params;
  const parsedId=idSchema.safeParse(params.id);
  if(!parsedId.success)return jsonError('Invalid feedback form ID.',400);
  let body:unknown;
  try{body=await request.json();}catch{return jsonError('Invalid JSON body.');}
  const parsedBody=restoreSchema.safeParse(body);
  if(!parsedBody.success)return jsonError(parsedBody.error.issues[0]?.message??'Invalid version.');
  const {data,error}=await supabase.rpc('restore_feedback_version',{
    p_feedback_id:parsedId.data,
    p_version:parsedBody.data.version
  });
  if(error?.code==='P0002')return jsonError('Feedback form or version not found.',404);
  if(error?.code==='42501')return jsonError('You do not own this feedback form.',403);
  if(error)return jsonError('Could not restore the selected feedback version.',500);
  return NextResponse.json({success:true,version:data},{headers:{'Cache-Control':'no-store'}});
}
