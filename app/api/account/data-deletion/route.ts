import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic='force-dynamic';
const requestSchema=z.object({}).strict();

export async function GET() {
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth) return jsonError('Unauthorized',401);
  const {data,error}=await supabase.rpc('get_my_data_deletion_requests');
  if(error) return jsonError('Could not load your deletion requests.',500);
  return NextResponse.json({requests:data??[]},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:NextRequest) {
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth) return jsonError('Unauthorized',401);
  const protection=await protectMutation(request,supabase,'account:deletion-request',2,86400);
  if(protection) return protection;
  let body:unknown;
  try{body=await request.json();}catch{return jsonError('Invalid JSON body.');}
  const parsed=requestSchema.safeParse(body);
  if(!parsed.success) return jsonError('Invalid deletion request.');
  const {data,error}=await supabase.rpc('create_my_data_deletion_request');
  if(error?.code==='23505') return jsonError('An active deletion request already exists.',409);
  if(error?.code==='42501') return jsonError('An active account is required.',403);
  if(error) return jsonError('Could not submit your deletion request.',500);
  return NextResponse.json({request:Array.isArray(data)?data[0]:data},{status:201,headers:{'Cache-Control':'no-store'}});
}
