import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';
const updateSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['ADMIN','INSTRUCTOR','STUDENT']),
  is_active: z.boolean()
}).strict();

export async function GET() {
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth) return jsonError('Administrator authentication with MFA is required.',401);
  if(auth.profile.role!=='ADMIN') return jsonError('Administrator access required.',403);
  const {data,error}=await supabase.from('users').select('id,email,full_name,role,is_active,created_at,department_id').order('created_at',{ascending:false});
  if(error) return jsonError('Unable to load user directory.',500);
  return NextResponse.json({users:data??[]},{headers:{'Cache-Control':'no-store'}});
}

export async function PATCH(request:NextRequest) {
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth) return jsonError('Administrator authentication with MFA is required.',401);
  if(auth.profile.role!=='ADMIN') return jsonError('Administrator access required.',403);
  const protection=await protectMutation(request,supabase,'admin:user-update',20,3600);
  if(protection) return protection;
  let body:unknown;
  try{body=await request.json();}catch{return jsonError('Invalid JSON body.');}
  const parsed=updateSchema.safeParse(body);
  if(!parsed.success) return jsonError(parsed.error.issues[0]?.message??'Invalid user update.');
  const {error}=await supabase.rpc('admin_update_user',{
    p_user_id:parsed.data.user_id,
    p_role:parsed.data.role,
    p_is_active:parsed.data.is_active
  });
  if(error?.code==='P0002') return jsonError('User not found.',404);
  if(error?.code==='23514') return jsonError('The last active administrator cannot be demoted or suspended.',409);
  if(error?.code==='42501') return jsonError('This administrator action is not permitted. Verify MFA and target account.',403);
  if(error) return jsonError('User access could not be updated.',500);
  return NextResponse.json({success:true},{headers:{'Cache-Control':'no-store'}});
}
