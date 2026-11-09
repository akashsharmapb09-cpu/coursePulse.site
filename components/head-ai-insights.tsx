'use client';

import { useEffect, useState } from 'react';
import { BrainCircuit, RefreshCw, Sparkles } from 'lucide-react';

type Priority = {
  scope: string; title: string; rationale: string;
  recommended_action: string; urgency: 'low'|'medium'|'high';
};
type Insight = {
  report_month: string; model: string; overall_summary: string;
  priorities: Priority[]; generated_at: string;
};

export function HeadAiInsights({ month }: { month: string }) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/ai-insights?month=' + encodeURIComponent(month), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'AI insights could not be loaded.');
      setInsight(data.insight ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI insights could not be loaded.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [month]);

  async function generate() {
    setGenerating(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/ai-insights', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'AI insights could not be generated.');
      setInsight(data.insight);
      setNotice('AI recommendations generated from aggregate-only college reports.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI insights could not be generated.');
    } finally { setGenerating(false); }
  }

  return <section className="rounded-2xl border border-[#dfe8e1] bg-white p-5 space-y-4" aria-labelledby="ai-insights-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3ff] text-[#395c8b]"><BrainCircuit size={20}/></span><div><h3 id="ai-insights-title" className="font-semibold">AI academic insights</h3><p className="fine-print mt-1">Head-only recommendations generated from monthly aggregate ratings. No student names, comments or raw answers are sent.</p></div></div>
      <button type="button" className="button primary compact" onClick={() => void generate()} disabled={generating || loading}><Sparkles size={14}/>{generating ? 'Generating…' : 'Generate AI insights'}</button>
    </div>
    <div className="rounded-xl bg-[#f6f8fb] p-3 text-xs text-[#5d6f85]">Provider setup: configure <code>OPENAI_API_KEY</code> and <code>OPENAI_MODEL</code> as Supabase Edge Function secrets. The AI service will remain unavailable until these are provided.</div>
    {error && <p className="rounded-lg bg-[#fff1ee] p-3 text-sm text-[#9e3b2e]" role="alert">{error}</p>}
    {notice && <p className="rounded-lg bg-[#edf7ef] p-3 text-sm text-[#286640]" role="status">{notice}</p>}
    {loading ? <p className="fine-print">Loading saved insights…</p> : insight ? <>
      <div className="rounded-xl border border-[#e7eee8] p-4"><div className="mb-2 flex flex-wrap justify-between gap-2"><span className="role-chip">AI generated · {insight.model}</span><small className="fine-print">{new Date(insight.generated_at).toLocaleString()}</small></div><p className="text-sm leading-6 text-[#43584d]">{insight.overall_summary}</p></div>
      <div className="grid gap-3 md:grid-cols-2">{insight.priorities.map((item,index)=><article key={index} className="rounded-xl border border-[#e7eee8] p-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="eyebrow">{item.scope}</span><span className={'role-chip '+(item.urgency==='high'?'text-[#9a3d2d]':item.urgency==='medium'?'text-[#84601c]':'')}>{item.urgency} priority</span></div><h4 className="font-semibold">{item.title}</h4><p className="mt-2 text-sm text-[#64746a]">{item.rationale}</p><p className="mt-3 border-t border-[#edf1ed] pt-3 text-sm text-[#3f624d]"><b>Suggested action:</b> {item.recommended_action}</p></article>)}</div>
    </> : <div className="rounded-xl border border-dashed border-[#dfe8e1] p-5 text-center"><BrainCircuit size={22} className="mx-auto text-[#789083]"/><p className="mt-2 text-sm text-[#64746a]">No AI summary has been generated for {month}.</p><button type="button" onClick={() => void load()} className="button subtle compact mt-3" disabled={loading}><RefreshCw size={13}/> Refresh</button></div>}
  </section>;
}
