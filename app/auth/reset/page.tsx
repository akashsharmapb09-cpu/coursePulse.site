'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function PasswordResetPage() {
  const router = useRouter();
  const [password,setPassword] = useState('');
  const [confirm,setConfirm] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  async function submit(event:FormEvent) {
    event.preventDefault(); setError('');
    if(password.length<10 || password.length>72) { setError('Password must be between 10 and 72 characters.'); return; }
    if(password!==confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const supabase=createClient();
      const {data:{user}}=await supabase.auth.getUser();
      if(!user) throw new Error('This reset link is invalid or has expired. Request a new link.');
      const {error:updateError}=await supabase.auth.updateUser({password});
      if(updateError) throw updateError;
      router.replace('/dashboard'); router.refresh();
    } catch(e) { setError(e instanceof Error?e.message:'Password could not be updated.'); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f7faf7] px-6 py-12 text-[#20352a]"><section className="w-full max-w-md rounded-3xl border border-[#e2ebe3] bg-white p-8 shadow-sm"><Link href="/login" className="text-sm font-bold text-[#477956]">← Back to sign in</Link><h1 className="mt-8 text-2xl font-extrabold">Choose a new password</h1><p className="mt-2 text-sm leading-6 text-[#718178]">Use a unique password between 10 and 72 characters.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm font-semibold">New password<input className="mt-2 w-full rounded-xl border border-[#dce6de] px-4 py-3" type="password" autoComplete="new-password" minLength={10} maxLength={72} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="block text-sm font-semibold">Confirm new password<input className="mt-2 w-full rounded-xl border border-[#dce6de] px-4 py-3" type="password" autoComplete="new-password" minLength={10} maxLength={72} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-[#245b3e] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{busy?'Updating…':'Update password'}</button></form></section></main>;
}
