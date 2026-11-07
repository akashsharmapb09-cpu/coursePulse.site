import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic='force-dynamic';

const passwordChangeSchema=z.object({
  current_password:z.string().min(1).max(72),
  new_password:z.string().min(10).max(72)
}).strict().superRefine((input,ctx)=>{
  if(input.current_password===input.new_password){
    ctx.addIssue({code:'custom',message:'Choose a password different from your current password.',path:['new_password']});
  }
});

export async function POST(request:NextRequest){
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth) return jsonError('Sign in again before changing your password.',401);

  const protection=await protectMutation(request,supabase,'account:password-change',5,3600);
  if(protection) return protection;

  let body:unknown;
  try{body=await request.json();}catch{return jsonError('Invalid JSON body.');}
  const parsed=passwordChangeSchema.safeParse(body);
  if(!parsed.success) return jsonError(parsed.error.issues[0]?.message??'Invalid password change request.');
  if(!auth.user.email) return jsonError('Password changes require an email-based account.',400);

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key) return jsonError('Account security is temporarily unavailable.',503);

  // Verify the current password in an isolated, non-persistent Auth client.
  // This avoids replacing the user's existing AAL2 session while rechecking credentials.
  const verifier=createSupabaseClient(url,key,{
    auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
  });
  const {data:verified,error:verificationError}=await verifier.auth.signInWithPassword({
    email:auth.user.email,
    password:parsed.data.current_password
  });
  const sameAccount=verified.user?.id===auth.user.id;
  await verifier.auth.signOut({scope:'local'});
  if(verificationError||!sameAccount){
    return jsonError('Current password is incorrect.',403);
  }

  const {error:updateError}=await supabase.auth.updateUser({password:parsed.data.new_password});
  if(updateError) return jsonError('Password could not be updated. Check the password policy and try again.',400);

  const {error:revokeError}=await supabase.auth.signOut({scope:'global'});
  if(revokeError){
    await supabase.auth.signOut({scope:'local'});
    return NextResponse.json({
      success:true,
      sessionsRevoked:false,
      warning:'Password changed. This device was signed out, but other active sessions could not be revoked. Sign out other devices manually.'
    },{headers:{'Cache-Control':'no-store'}});
  }

  return NextResponse.json({success:true,sessionsRevoked:true},{headers:{'Cache-Control':'no-store'}});
}
