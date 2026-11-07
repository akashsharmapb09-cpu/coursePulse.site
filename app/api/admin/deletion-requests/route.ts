import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser,jsonError,protectMutation } from '@/lib/http';

export const dynamic='force-dynamic';

export async function GET() {
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth) return jsonError('Administrator authentication with MFA is required.',401);
  if(auth.profile.role!=='ADMIN') return jsonError('Administrator access required.',403);
  const {data,error}=await supabase.rpc('admin_list_data_deletion_requests');
  if(error?.code==='42501') return jsonError('Administrator authentication with MFA is required.',403);
  if(error) return jsonError('Could not load deletion requests.',500);
  return NextResponse.json({requests:data??[]},{headers:{'Cache-Control':'no-store'}});
}

const reviewSchema=z.object({
  request_id:z.string().uuid(),
  status:z.enum(['IN_REVIEW','APPROVED','REJECTED','COMPLETED']),
  resolution_note:z.string().trim().max(500)
}).strict();

export async function PATCH(request:NextRequest) {
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth) return jsonError('Administrator authentication with MFA is required.',401);
  if(auth.profile.role!=='ADMIN') return jsonError('Administrator access required.',403);
  const protection=await protectMutation(request,supabase,'admin:user-update',20,3600);
  if(protection) return protection;
  let body:unknown;
  try{body=await request.json();}catch{return jsonError('Invalid JSON body.');}
  const parsed=reviewSchema.safeParse(body);
  if(!parsed.success) return jsonError(parsed.error.issues[0]?.message??'Invalid deletion request review.');
  const {error}=await supabase.rpc('admin_review_data_deletion_request',{
    p_request_id:parsed.data.request_id,
    p_status:parsed.data.status,
    p_resolution_note:parsed.data.resolution_note
  });
  if(error?.code==='P0002') return jsonError('Deletion request not found.',404);
  if(error?.code==='22023') return jsonError(error.message??'Invalid deletion request status transition.',409);
  if(error?.code==='42501') return jsonError('Administrator authentication with MFA is required.',403);
  if(error) return jsonError('Could not update deletion request.',500);
  return NextResponse.json({success:true},{headers:{'Cache-Control':'no-store'}});
}
