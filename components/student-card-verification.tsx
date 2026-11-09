'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

type VerifiedCard = {
  student_name:string;student_number:string;college_name:string;
  enrollment_sections:string[];valid_until:string;
};

export function StudentCardVerification() {
  const [card,setCard]=useState<VerifiedCard|null>(null);
  const [loading,setLoading]=useState(true);
  const [valid,setValid]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    const token=window.location.hash.replace(/^#/,'');
    // Remove the one-time bearer token from the visible URL as soon as it is read.
    window.history.replaceState(null,'',window.location.pathname);
    if(!/^[0-9a-f]{64}$/i.test(token)){
      setValid(false);setLoading(false);return;
    }
    void fetch('/api/student-id/verify',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      cache:'no-store',
      body:JSON.stringify({token})
    }).then(async response=>{
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??'Card verification is unavailable.');
      if(active){setCard(data.card??null);setValid(data.valid===true);}
    }).catch(cause=>{
      if(active)setError(cause instanceof Error?cause.message:'Card verification is unavailable.');
    }).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[]);

  return <main className="min-h-screen bg-[#f4f7f4] px-5 py-12 text-[#17392f]">
    <section className="mx-auto max-w-lg rounded-3xl border border-[#dfe9e2] bg-white p-7 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e7f1ea] text-lg font-bold">CP</span>
        <div><p className="font-bold">CoursePulse</p><p className="text-xs text-[#6b8074]">College student identity verification</p></div>
      </div>
      {loading?<p className="py-8 text-sm text-[#65776d]">Checking this student card…</p>:valid&&card?<>
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e8f5ec] px-3 py-1 text-sm font-semibold text-[#21683f]"><ShieldCheck size={15}/> Verified student card</p>
        <h1 className="text-2xl font-bold">{card.student_name}</h1>
        <p className="mt-1 text-sm text-[#64766c]">{card.college_name}</p>
        <div className="mt-7 grid grid-cols-2 gap-4 rounded-2xl bg-[#f6f9f6] p-4">
          <div><p className="text-xs text-[#73847a]">College roll number</p><p className="mt-1 font-semibold">{card.student_number}</p></div>
          <div><p className="text-xs text-[#73847a]">Sections</p><p className="mt-1 font-semibold">{card.enrollment_sections?.length?card.enrollment_sections.join(', '):'Not listed'}</p></div>
        </div>
        <p className="mt-5 text-xs text-[#74847a]">Verification is valid until {new Date(card.valid_until).toLocaleDateString()}.</p>
      </>:<>
        <p className="inline-flex rounded-full bg-[#fff1ee] px-3 py-1 text-sm font-semibold text-[#a13d2d]">Not verified</p>
        <h1 className="mt-4 text-2xl font-bold">This student card is invalid or expired.</h1>
        <p className="mt-2 text-sm text-[#64766c]">{error||'Ask the student to refresh their CoursePulse ID card and scan the latest QR code.'}</p>
      </>}
      <p className="mt-8 border-t border-[#e9efea] pt-4 text-xs text-[#849187]">This page verifies the card token only. Contact details and feedback submissions are never displayed.</p>
    </section>
  </main>;
}
