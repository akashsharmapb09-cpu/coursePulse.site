'use client';

import { useEffect, useState } from 'react';
import { IdCard, RefreshCw, ShieldCheck } from 'lucide-react';

type StudentCard = {
  full_name: string;
  email: string | null;
  student_number: string;
  college_name: string;
  sections: string[];
  verification_url: string;
  qr_svg_base64: string;
  valid_until: string;
};

export function StudentDigitalCard({ photoUrl }: { photoUrl: string | null }) {
  const [card, setCard] = useState<StudentCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function issueCard() {
    setRefreshing(true);
    setError('');
    try {
      const response = await fetch('/api/student-id', { method: 'POST', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.card) throw new Error(data.error ?? 'Your college ID could not be issued.');
      setCard(data.card);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your college ID could not be issued.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void issueCard(); }, []);

  if (loading) return <section className="mx-auto max-w-2xl rounded-3xl border border-[#e0e9e2] bg-white p-7"><p className="text-sm text-[#65776d]">Preparing your secure student ID…</p></section>;

  if (!card) return <section className="mx-auto max-w-2xl rounded-3xl border border-[#e0e9e2] bg-white p-7">
    <h3 className="text-lg font-bold">Student ID not ready</h3>
    <p className="mt-2 text-sm text-[#65776d]">{error || 'Your college has not added a roll number and course enrollment yet.'}</p>
    <button type="button" className="button subtle mt-5" onClick={() => void issueCard()} disabled={refreshing}><RefreshCw size={15}/>{refreshing ? 'Retrying…' : 'Try again'}</button>
  </section>;

  return <section className="mx-auto w-full max-w-3xl space-y-5">
    <div className="section-heading"><div><h3>Your digital student ID</h3><p>College-issued roll number and a QR code that can be verified by scanning.</p></div><IdCard size={24}/></div>
    <article className="overflow-hidden rounded-3xl border border-[#dce7df] bg-gradient-to-br from-[#153d32] to-[#2e7057] p-6 text-white shadow-xl">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#cde5d7]">{card.college_name}</p><p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#b8d2c2]">Official CoursePulse student card</p></div><IdCard size={30}/></div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        {photoUrl ? <img src={photoUrl} alt="Student profile" className="h-20 w-20 rounded-2xl border border-white/30 object-cover"/> : <div className="grid h-20 w-20 place-items-center rounded-2xl bg-white/15 text-3xl font-bold">{card.full_name.slice(0,1).toUpperCase()}</div>}
        <div className="min-w-0"><h3 className="truncate text-xl font-bold">{card.full_name}</h3><p className="mt-1 break-all text-xs text-[#d0e3d7]">{card.email ?? 'Email not on file'}</p></div>
      </div>
      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_190px]">
        <div className="space-y-3 rounded-2xl bg-white/10 p-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b8d2c2]">College roll number</p><p className="mt-1 font-mono text-2xl font-bold tracking-[0.08em]">{card.student_number}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b8d2c2]">Section(s)</p><p className="mt-1 text-sm font-semibold">{card.sections.length ? card.sections.join(', ') : 'Not assigned'}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b8d2c2]">Verification valid until</p><p className="mt-1 text-sm">{new Date(card.valid_until).toLocaleDateString()}</p></div>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center text-[#173a30]">
          <img src={'data:image/svg+xml;base64,' + card.qr_svg_base64} alt="Student ID verification QR code" className="mx-auto aspect-square w-full max-w-[190px]"/>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.13em]">Scan to verify</p>
        </div>
      </div>
    </article>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfe9e2] bg-white p-4">
      <span className="flex items-center gap-2 text-sm text-[#52695d]"><ShieldCheck size={17}/> The QR reveals only your name, college roll number and sections. It never reveals contact details or feedback history.</span>
      <button type="button" className="button subtle compact" onClick={() => void issueCard()} disabled={refreshing}><RefreshCw size={14}/>{refreshing ? 'Refreshing…' : 'Refresh QR'}</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
