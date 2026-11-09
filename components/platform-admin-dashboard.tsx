'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Building2, MailPlus, RefreshCw, ShieldCheck } from 'lucide-react';

type Organization = {
  id: string; name: string; slug: string; status: 'SETUP_REQUIRED'|'ACTIVE'|'SUSPENDED';
  subscription_status: 'UNCONFIGURED'|'PILOT'|'ACTIVE'|'PAST_DUE'|'CANCELLED';
  created_at: string; active_students: number; active_instructors: number; course_count: number; department_count: number;
};

export function PlatformAdminDashboard() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [creating,setCreating]=useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [collegeName,setCollegeName]=useState('');
  const [slug,setSlug]=useState('');
  const [headName,setHeadName]=useState('');
  const [headEmail,setHeadEmail]=useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/platform/organizations', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Platform workspace unavailable.');
      setOrganizations(data.organizations ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Platform workspace unavailable.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function createCollege(event: FormEvent) {
    event.preventDefault(); setCreating(true); setError(''); setNotice('');
    try {
      const response=await fetch('/api/platform/organizations',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name:collegeName,slug:slug.toLowerCase(),head_name:headName,head_email:headEmail.toLowerCase()})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??'College workspace could not be created.');
      setNotice(data.head_status==='LINKED_EXISTING'
        ? collegeName+' workspace created and linked to the verified first Head account.'
        : collegeName+' workspace created. A first-Head invitation was sent to '+headEmail+'. The college activates after email verification.');
      setCollegeName('');setSlug('');setHeadName('');setHeadEmail('');
      await load();
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'College workspace could not be created.');
    } finally { setCreating(false); }
  }

  async function update(item: Organization, status: Organization['status'], subscription_status: Organization['subscription_status']) {
    setBusyId(item.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/platform/organizations', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: item.id, status, subscription_status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Organization status could not be changed.');
      setNotice(item.name + ' updated and platform-audited.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Organization status could not be changed.');
    } finally { setBusyId(''); }
  }

  return <main className="min-h-screen bg-[#f4f7f4] px-5 py-10 text-[#183a30]">
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e5f0e8]"><ShieldCheck size={23}/></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6d8576]">CoursePulse internal</p><h1 className="text-2xl font-bold">Platform administration</h1><p className="text-sm text-[#6d7c72]">Create college tenants and manage pilot/subscription states.</p></div></div><button className="button subtle" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button></header>
      <div className="rounded-2xl border border-amber-200 bg-white p-4 text-sm text-[#765a20]">Subscription states here are administrative metadata only. A payment provider and automated billing/webhooks are not configured; do not treat these labels as payment verification.</div>
      <form onSubmit={createCollege} className="grid gap-3 rounded-2xl border border-[#dfe8e1] bg-white p-5 md:grid-cols-2">
        <div className="md:col-span-2"><h2 className="font-semibold">Create a college workspace</h2><p className="mt-1 text-xs text-[#718075]">The first Head receives a secure email invitation. The college stays in setup until the email is verified.</p></div>
        <label className="text-sm font-semibold">College name<input className="mt-2 w-full" value={collegeName} onChange={event=>setCollegeName(event.target.value)} minLength={2} maxLength={160} required placeholder="Example College of Engineering"/></label>
        <label className="text-sm font-semibold">Workspace slug<input className="mt-2 w-full" value={slug} onChange={event=>setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-'))} pattern="[a-z0-9][a-z0-9-]{1,62}" required placeholder="example-college"/></label>
        <label className="text-sm font-semibold">First College Head<input className="mt-2 w-full" value={headName} onChange={event=>setHeadName(event.target.value)} minLength={2} maxLength={120} required placeholder="Head full name"/></label>
        <label className="text-sm font-semibold">Head email<input className="mt-2 w-full" type="email" value={headEmail} onChange={event=>setHeadEmail(event.target.value)} maxLength={254} required placeholder="head@example.edu"/></label>
        <div className="md:col-span-2 flex justify-end"><button className="button primary" disabled={creating}><MailPlus size={15}/>{creating?'Creating workspace…':'Create workspace & invite Head'}</button></div>
      </form>
      {error && <p role="alert" className="rounded-xl bg-[#fff1ee] p-3 text-sm text-[#9b3d2e]">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-[#edf7ef] p-3 text-sm text-[#286640]">{notice}</p>}
      {loading ? <p>Loading college tenants…</p> : organizations.length ? <div className="grid gap-4">{organizations.map(item => <article key={item.id} className="rounded-2xl border border-[#e0e9e2] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef5ef]"><Building2 size={18}/></span><div><h2 className="font-semibold">{item.name}</h2><p className="text-xs text-[#77877d]">/{item.slug} · created {new Date(item.created_at).toLocaleDateString()}</p></div></div><span className="role-chip">{item.status}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Students" value={item.active_students}/><Metric label="Teachers" value={item.active_instructors}/><Metric label="Courses" value={item.course_count}/><Metric label="Departments" value={item.department_count}/></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs font-semibold text-[#62766a]">Tenant status<select className="mt-1 w-full" value={item.status} disabled={busyId===item.id} onChange={event => void update(item,event.target.value as Organization['status'],item.subscription_status)}><option value="SETUP_REQUIRED">Setup required</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label>
          <label className="text-xs font-semibold text-[#62766a]">Subscription label<select className="mt-1 w-full" value={item.subscription_status} disabled={busyId===item.id} onChange={event => void update(item,item.status,event.target.value as Organization['subscription_status'])}><option value="UNCONFIGURED">Unconfigured</option><option value="PILOT">Pilot</option><option value="ACTIVE">Active</option><option value="PAST_DUE">Past due</option><option value="CANCELLED">Cancelled</option></select></label>
          <div className="self-end text-xs text-[#77877d]">{busyId===item.id ? 'Saving…' : 'Platform-only changes'}</div>
        </div>
      </article>)}</div> : <p>No college workspaces have been created yet.</p>}
      <p className="text-xs text-[#829086]">CoursePulse platform administrators are provisioned offline by a trusted database operator. College Heads cannot grant this role to themselves.</p>
    </div>
  </main>;
}

function Metric({label,value}:{label:string;value:number}) {
  return <div className="rounded-xl bg-[#f6f9f6] p-3"><p className="text-xs text-[#74847a]">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p></div>;
}
