'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Building2, MailPlus, RefreshCw, ShieldCheck, UserRoundCog, UserX } from 'lucide-react';

type Organization = {
  id: string; name: string; slug: string; status: 'SETUP_REQUIRED'|'ACTIVE'|'SUSPENDED';
  subscription_status: 'UNCONFIGURED'|'PILOT'|'ACTIVE'|'PAST_DUE'|'CANCELLED';
  created_at: string; active_students: number; active_instructors: number; course_count: number; department_count: number;
};
type PlatformSummary = {
  total_colleges: number; active_colleges: number; setup_required_colleges: number;
  suspended_colleges: number; active_students: number; active_teachers: number; active_hods: number;
};
type OrganizationHead = {
  organization_id: string; organization_name: string; head_name: string;
  head_email: string | null; is_active: boolean;
};
type HeadDraft = { name: string; email: string };

export function PlatformAdminDashboard() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [heads, setHeads] = useState<OrganizationHead[]>([]);
  const [headDrafts, setHeadDrafts] = useState<Record<string, HeadDraft>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [slug, setSlug] = useState('');
  const [headName, setHeadName] = useState('');
  const [headEmail, setHeadEmail] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/platform/organizations', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Platform overview unavailable.');
      setOrganizations(data.organizations ?? []);
      setSummary(data.summary ?? null);
      setHeads(data.heads ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Platform overview unavailable.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function createCollege(event: FormEvent) {
    event.preventDefault(); setCreating(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/platform/organizations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: collegeName,
          slug: slug.toLowerCase(),
          head_name: headName,
          head_email: headEmail.toLowerCase()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'College workspace could not be created.');
      setNotice(data.head_status === 'LINKED_EXISTING'
        ? collegeName + ' added and linked to the verified HOD account.'
        : collegeName + ' added. An HOD invitation was sent to ' + headEmail + '. The college activates after email verification.');
      setCollegeName(''); setSlug(''); setHeadName(''); setHeadEmail('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'College workspace could not be created.');
    } finally { setCreating(false); }
  }

  async function assignHead(event: FormEvent, item: Organization) {
    event.preventDefault();
    const draft = headDrafts[item.id];
    if (!draft?.name.trim() || !draft.email.trim()) {
      setError('Enter the new HOD name and email.');
      return;
    }
    setBusyId(item.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/platform/organizations/head', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: item.id,
          head_name: draft.name.trim(),
          head_email: draft.email.trim().toLowerCase()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'HOD invitation could not be sent.');
      setNotice(data.head_status === 'LINKED_EXISTING'
        ? 'The verified account has been assigned as HOD of ' + item.name + '.'
        : 'HOD invitation sent for ' + item.name + '. The workspace activates after email verification.');
      setHeadDrafts(current => ({ ...current, [item.id]: { name: '', email: '' } }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'HOD invitation could not be sent.');
    } finally { setBusyId(''); }
  }

  async function removeHead(item: Organization) {
    if (!window.confirm('Remove the HOD account from ' + item.name + '? Sign-in access will be disabled and the college will return to setup. Historical records will be kept.')) return;
    setBusyId(item.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/platform/organizations/head', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: item.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'HOD access could not be removed.');
      setNotice(item.name + ' HOD access removed. Assign a replacement HOD to activate the workspace again.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'HOD access could not be removed.');
    } finally { setBusyId(''); }
  }

  async function removeCollege(item: Organization) {
    if (!window.confirm('Remove ' + item.name + ' from active CoursePulse access? The college will be suspended; its academic, feedback and audit records will be preserved.')) return;
    setBusyId(item.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/platform/organizations', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: item.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'College could not be removed.');
      setNotice(item.name + ' removed from active platform access. Historical records have been preserved.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'College could not be removed.');
    } finally { setBusyId(''); }
  }

  async function update(item: Organization, status: Organization['status'], subscription_status: Organization['subscription_status']) {
    setBusyId(item.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/platform/organizations', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: item.id, status, subscription_status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'College status could not be changed.');
      setNotice(item.name + ' updated and platform-audited.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'College status could not be changed.');
    } finally { setBusyId(''); }
  }

  return <main className="min-h-screen bg-[#f4f7f4] px-5 py-10 text-[#183a30]">
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e5f0e8]"><ShieldCheck size={23}/></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6d8576]">CoursePulse internal</p>
            <h1 className="text-2xl font-bold">Platform Super Admin</h1>
            <p className="text-sm text-[#6d7c72]">Manage colleges, HOD accounts and platform-wide totals.</p>
          </div>
        </div>
        <button className="button subtle" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Colleges on platform" value={summary?.total_colleges ?? 0}/>
        <Metric label="Active colleges" value={summary?.active_colleges ?? 0}/>
        <Metric label="Total active students" value={summary?.active_students ?? 0}/>
        <Metric label="Total active teachers" value={summary?.active_teachers ?? 0}/>
        <Metric label="Active HOD accounts" value={summary?.active_hods ?? 0}/>
        <Metric label="Setup required" value={summary?.setup_required_colleges ?? 0}/>
        <Metric label="Suspended colleges" value={summary?.suspended_colleges ?? 0}/>
      </section>
      <p className="text-xs text-[#718075]">Student and teacher totals include active accounts in active colleges only. College records are counted separately, including suspended and setup workspaces.</p>

      <div className="rounded-2xl border border-amber-200 bg-white p-4 text-sm text-[#765a20]">
        Subscription labels are administrative metadata only. A payment provider and automated billing/webhooks are not configured; these labels are not payment verification.
      </div>

      <form onSubmit={createCollege} className="grid gap-3 rounded-2xl border border-[#dfe8e1] bg-white p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <h2 className="font-semibold">Add a college / university</h2>
          <p className="mt-1 text-xs text-[#718075]">A new HOD receives a secure email invitation. The college activates after the HOD verifies the email.</p>
        </div>
        <label className="text-sm font-semibold">College / university name
          <input className="mt-2 w-full" value={collegeName} onChange={event => setCollegeName(event.target.value)} minLength={2} maxLength={160} required placeholder="Example University"/>
        </label>
        <label className="text-sm font-semibold">Workspace slug
          <input className="mt-2 w-full" value={slug} onChange={event => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} pattern="[a-z0-9][a-z0-9-]{1,62}" required placeholder="example-university"/>
        </label>
        <label className="text-sm font-semibold">First HOD full name
          <input className="mt-2 w-full" value={headName} onChange={event => setHeadName(event.target.value)} minLength={2} maxLength={120} required placeholder="HOD full name"/>
        </label>
        <label className="text-sm font-semibold">HOD email
          <input className="mt-2 w-full" type="email" value={headEmail} onChange={event => setHeadEmail(event.target.value)} maxLength={254} required placeholder="hod@example.edu"/>
          <span className="mt-1 block text-xs font-normal text-[#718075]">Use an email not already assigned to another college. Existing college memberships are never moved automatically.</span>
        </label>
        <div className="md:col-span-2 flex justify-end">
          <button className="button primary" disabled={creating}><MailPlus size={15}/>{creating ? 'Adding college…' : 'Add college & invite HOD'}</button>
        </div>
      </form>

      {error && <p role="alert" className="rounded-xl bg-[#fff1ee] p-3 text-sm text-[#9b3d2e]">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-[#edf7ef] p-3 text-sm text-[#286640]">{notice}</p>}

      {loading ? <p>Loading college tenants…</p> : organizations.length ? <div className="grid gap-4">
        {organizations.map(item => {
          const head = heads.find(value => value.organization_id === item.id);
          const headDraft = headDrafts[item.id] ?? { name: '', email: '' };
          return <article key={item.id} className="rounded-2xl border border-[#e0e9e2] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef5ef]"><Building2 size={18}/></span>
                <div>
                  <h2 className="font-semibold">{item.name}</h2>
                  <p className="text-xs text-[#77877d]">/{item.slug} · created {new Date(item.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <span className="role-chip">{item.status}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Students" value={item.active_students}/>
              <Metric label="Teachers" value={item.active_instructors}/>
              <Metric label="Courses" value={item.course_count}/>
              <Metric label="Departments" value={item.department_count}/>
            </div>
            <div className="mt-4 rounded-xl border border-[#edf1ed] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserRoundCog size={18}/>
                  <div>
                    <p className="text-sm font-semibold">HOD account</p>
                    {head ? <p className="text-xs text-[#718075]">{head.head_name} · {head.head_email ?? 'No email available'} · {head.is_active ? 'Active' : 'Access removed'}</p>
                      : <p className="text-xs text-[#718075]">No HOD is currently assigned.</p>}
                  </div>
                </div>
                {head && <button type="button" className="button subtle compact" disabled={busyId === item.id} onClick={() => void removeHead(item)}><UserX size={14}/> Remove HOD</button>}
              </div>
              {!head && <form onSubmit={event => void assignHead(event, item)} className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input aria-label={'New HOD name for ' + item.name} className="w-full" value={headDraft.name} onChange={event => setHeadDrafts(current => ({ ...current, [item.id]: { ...headDraft, name: event.target.value } }))} minLength={2} maxLength={120} required placeholder="Replacement HOD name"/>
                <input aria-label={'New HOD email for ' + item.name} className="w-full" type="email" value={headDraft.email} onChange={event => setHeadDrafts(current => ({ ...current, [item.id]: { ...headDraft, email: event.target.value } }))} maxLength={254} required placeholder="hod@example.edu"/>
                <button className="button primary compact" disabled={busyId === item.id || item.status !== 'SETUP_REQUIRED'}><MailPlus size={14}/> Invite HOD</button>
                {item.status !== 'SETUP_REQUIRED' && <p className="text-xs text-[#8a6a2a] md:col-span-3">Set this college to “Setup required” before assigning a replacement HOD.</p>}
              </form>}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="text-xs font-semibold text-[#62766a]">College status
                <select className="mt-1 w-full" value={item.status} disabled={busyId === item.id} onChange={event => void update(item, event.target.value as Organization['status'], item.subscription_status)}>
                  <option value="SETUP_REQUIRED">Setup required</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[#62766a]">Subscription label
                <select className="mt-1 w-full" value={item.subscription_status} disabled={busyId === item.id} onChange={event => void update(item, item.status, event.target.value as Organization['subscription_status'])}>
                  <option value="UNCONFIGURED">Unconfigured</option><option value="PILOT">Pilot</option><option value="ACTIVE">Active</option><option value="PAST_DUE">Past due</option><option value="CANCELLED">Cancelled</option>
                </select>
              </label>
              <button type="button" className="button subtle compact self-end" disabled={busyId === item.id || item.status === 'SUSPENDED'} onClick={() => void removeCollege(item)}>
                <UserX size={14}/> Remove college
              </button>
            </div>
            <p className="mt-2 text-xs text-[#829086]">Removing a college suspends access but keeps its academic data, feedback history and audit records.</p>
          </article>;
        })}
      </div> : <p>No college workspaces have been created yet.</p>}

      <p className="text-xs text-[#829086]">Super Admin controls college lifecycle and HOD accounts. HODs manage only Student and Teacher access in their own college. Teachers can invite students only to their assigned courses.</p>
    </div>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-[#f6f9f6] p-3"><p className="text-xs text-[#74847a]">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p></div>;
}
