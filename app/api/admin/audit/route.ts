import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError } from '@/lib/http';

export const dynamic='force-dynamic';
export async function GET(){
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth) return jsonError('Administrator authentication with MFA is required.',401);
  if(auth.profile.role!=='ADMIN') return jsonError('Administrator access required.',403);
  const {data,error}=await supabase.from('audit_logs').select('id,actor_id,action,target_type,target_id,details,created_at').order('created_at',{ascending:false}).limit(50);
  if(error) return jsonError('Unable to load audit history.',500);
  return NextResponse.json({events:data??[]},{headers:{'Cache-Control':'no-store'}});
}
