'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function AdminMfaGate() {
  const router=useRouter();
  const [factorId,setFactorId]=useState('');
  const [qr,setQr]=useState('');
  const [secret,setSecret]=useState('');
  const [code,setCode]=useState('');
  const [mode,setMode]=useState<'loading'|'start'|'pending'|'enroll'|'verify'|'error'>('loading');
  const [pendingFactorIds,setPendingFactorIds]=useState<string[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    let active=true;
    async function prepare(){
      try{
        const supabase=createClient();
        const {data,error:listError}=await supabase.auth.mfa.listFactors();
        if(listError) throw listError;
        const factors=data?.totp??[];
        const verified=factors.find(factor=>factor.status==='verified');
        if(verified){
          if(active){setFactorId(verified.id);setMode('verify');}
          return;
        }
        const pending=factors.filter(factor=>factor.status!=='verified').map(factor=>factor.id);
        if(active){
          setPendingFactorIds(pending);
          setMode(pending.length?'pending':'start');
        }
      }catch(e){
        if(active){setError(e instanceof Error?e.message:'Could not prepare administrator MFA.');setMode('error');}
      }
    }
    void prepare();
    return ()=>{active=false;};
  },[]);

  async function startEnrollment(){
    setBusy(true);
    setError('');
    try{
      const supabase=createClient();
      for(const pendingId of pendingFactorIds){
        const {error:removeError}=await supabase.auth.mfa.unenroll({factorId:pendingId});
        if(removeError) throw removeError;
        setPendingFactorIds(current=>current.filter(id=>id!==pendingId));
      }
      const {data:enrolled,error:enrollError}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'CoursePulse administrator'});
      if(enrollError) throw enrollError;
      if(!enrolled) throw new Error('Could not create a new authenticator factor.');
      setFactorId(enrolled.id);
      setQr(enrolled.totp.qr_code);
      setSecret(enrolled.totp.secret);
      setPendingFactorIds([]);
      setMode('enroll');
    }catch(e){
      setError(e instanceof Error?e.message:'Could not start administrator MFA setup.');
    }finally{
      setBusy(false);
    }
  }

  async function verify(event:FormEvent){
    event.preventDefault();setBusy(true);setError('');
    try{
      const supabase=createClient();
      const {data:challenge,error:challengeError}=await supabase.auth.mfa.challenge({factorId});
      if(challengeError) throw challengeError;
      const {error:verifyError}=await supabase.auth.mfa.verify({factorId,challengeId:challenge.id,code:code.replace(/\s/g,'')});
      if(verifyError) throw verifyError;
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'The authenticator code could not be verified.');}
    finally{setBusy(false);}
  }

  return <main className="grid min-h-screen place-items-center bg-[#f7faf7] px-6 py-12 text-[#20352a]"><section className="w-full max-w-lg rounded-3xl border border-[#e2ebe3] bg-white p-8 shadow-sm sm:p-10"><p className="text-xs font-extrabold tracking-[.18em] text-[#548363]">ADMINISTRATOR SECURITY</p><h1 className="mt-3 text-2xl font-extrabold">Set up two-factor authentication</h1><p className="mt-3 text-sm leading-6 text-[#718178]">CoursePulse requires a verified authenticator factor and an AAL2 session before administrator data or privileged actions are available.</p>
    {mode==='loading'&&<p className="mt-8 text-sm text-[#718178]" role="status">Checking your authenticator setup…</p>}
    {mode==='start'&&<div className="mt-7 space-y-4"><p className="text-sm text-[#718178]">No authenticator is registered yet. Start setup when you are ready to scan a new QR code.</p><button type="button" onClick={()=>void startEnrollment()} disabled={busy} className="w-full rounded-xl bg-[#245b3e] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{busy?'Preparing…':'Set up authenticator'}</button></div>}
    {mode==='pending'&&<div className="mt-7 space-y-4"><p className="text-sm text-[#718178]">An unfinished authenticator setup was found. It is not verified and cannot be used to access administrator data. Restarting will remove only these unfinished factor(s) and create a new setup key.</p><button type="button" onClick={()=>void startEnrollment()} disabled={busy} className="w-full rounded-xl bg-[#245b3e] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{busy?'Restarting…':'Restart authenticator setup'}</button></div>}
    {mode==='enroll'&&<div className="mt-7 space-y-4"><p className="text-sm font-semibold">1. Scan this QR code with an authenticator app.</p>{qr&&<img src={qr} alt="Authenticator setup QR code" className="mx-auto h-48 w-48 rounded-xl border border-[#e5ece6] p-2"/>}<p className="text-xs text-[#718178]">Or enter this setup key manually:</p><code className="block break-all rounded-xl bg-[#f5f8f5] p-3 text-sm">{secret}</code><p className="text-sm font-semibold">2. Enter the six-digit code from your authenticator.</p></div>}
    {mode==='verify'&&<p className="mt-7 text-sm text-[#718178]">Enter the current six-digit code from your already-registered authenticator app.</p>}
    {mode==='error'&&<p role="alert" className="mt-7 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {(mode==='enroll'||mode==='verify')&&<form onSubmit={verify} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,8}" maxLength={8} required value={code} onChange={e=>setCode(e.target.value)} className="mt-2 w-full rounded-xl border border-[#dce6de] px-4 py-3 text-center text-xl tracking-[.3em]"/></label>{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={busy||!factorId} className="w-full rounded-xl bg-[#245b3e] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{busy?'Verifying…':'Verify and continue'}</button></form>}
  </section></main>;
}
