'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, RefreshCw, ShieldCheck } from 'lucide-react';

type Notification = {
  id: string;
  category: string;
  period_start: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export function TeacherInbox() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/teacher-notifications', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Notifications could not be loaded.');
      setNotifications(payload.notifications ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function markRead(id: string) {
    setBusyId(id);
    setError('');
    try {
      const response = await fetch('/api/teacher-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Notification could not be updated.');
      setNotifications(current => current.map(item => item.id === id ? { ...item, read_at: payload.notification?.read_at ?? new Date().toISOString() } : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notification could not be updated.');
    } finally {
      setBusyId('');
    }
  }

  const unread = notifications.filter(item => !item.read_at).length;

  return <section className="space-y-5" aria-labelledby="teacher-inbox-title">
    <div className="section-heading"><div><h3 id="teacher-inbox-title">Private notifications</h3><p>Messages sent directly to your instructor account by the College Head.</p></div><span className="role-chip"><Bell size={13}/> {unread} unread</span></div>
    <div className="flex items-start gap-3 rounded-xl border border-[#e5ece6] bg-white p-4 text-sm text-[#607066]"><ShieldCheck size={17} className="mt-0.5 shrink-0"/>Only your own notifications are visible in this inbox. Student identities and individual anonymous feedback answers are never included.</div>
    {error&&<p className="alert error" role="alert">{error}</p>}
    <div className="flex justify-end"><button className="button subtle compact" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
    {loading?<p className="fine-print">Loading private notifications…</p>:notifications.length===0?<p className="rounded-xl border border-dashed border-[#dce7df] p-6 text-center text-sm text-[#748279]">You have no notifications.</p>:<div className="space-y-3">{notifications.map(item=><article key={item.id} className={'rounded-xl border bg-white p-4 '+(item.read_at?'border-[#e5ece6]':'border-[#b9d3c1]')}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><b>{item.title}</b>{!item.read_at&&<span className="rounded-full bg-[#e7f2e9] px-2 py-0.5 text-[10px] font-bold text-[#346447]">New</span>}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#596a60]">{item.body}</p><small className="fine-print mt-2 block">Sent {new Date(item.created_at).toLocaleString()}</small></div>{!item.read_at&&<button className="button subtle compact" onClick={()=>void markRead(item.id)} disabled={busyId===item.id}>{busyId===item.id?'Saving…':<><Check size={14}/> Mark read</>}</button>}</div>
    </article>)}</div>}
  </section>;
}
