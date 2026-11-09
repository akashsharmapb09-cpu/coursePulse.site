'use client';

import { useEffect, useState } from 'react';
import { Building2, Save } from 'lucide-react';

type Organization = { id: string; name: string; slug: string; status: string; subscription_status: string };

export function OrganizationSettings() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/organization', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'College settings unavailable.');
      setOrganization(data.organization);
      setName(data.organization.name);
      setSlug(data.organization.slug);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'College settings unavailable.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/organization', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug: slug.toLowerCase() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'College settings could not be saved.');
      setNotice('College workspace updated and audited.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'College settings could not be saved.');
    } finally { setSaving(false); }
  }

  return <section className="rounded-2xl border border-[#e1e9e3] bg-white p-5">
    <div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9f2ec] text-[#315b46]"><Building2 size={19}/></span><div><h3 className="font-semibold">College workspace</h3><p className="fine-print">Edit your college name and workspace URL. Subscription controls are reserved for CoursePulse platform operations.</p></div></div>
    {loading ? <p className="text-sm text-[#65776d]">Loading college settings…</p> : organization ? <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-semibold">College name<input className="mt-2 w-full" minLength={2} maxLength={160} value={name} onChange={event => setName(event.target.value)} required/></label>
      <label className="text-sm font-semibold">Workspace slug<input className="mt-2 w-full" value={slug} onChange={event => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} pattern="[a-z0-9][a-z0-9-]{1,62}" required/><span className="fine-print">Lowercase letters, numbers and hyphens.</span></label>
      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><span className="role-chip">Workspace: {organization.status}</span><span className="role-chip">Plan: {organization.subscription_status}</span></div><button className="button primary" disabled={saving || !name.trim() || !slug.trim()}><Save size={15}/>{saving ? 'Saving…' : 'Save college settings'}</button></div>
    </form> : null}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-[#247044]">{notice}</p>}
  </section>;
}
