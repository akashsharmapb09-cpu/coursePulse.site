'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, Check, CheckCheck, Clock3, Inbox, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';

export type Notification = {
  id: string;
  category: string;
  period_start: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

function notificationLabel(category: string) {
  if (category === 'NEW_FEEDBACK') return 'New feedback';
  if (category === 'PENDING_FEEDBACK') return 'Reminder';
  if (category === 'DEADLINE_ALERT') return 'Deadline';
  if (category === 'PERFORMANCE_REVIEW') return 'Private notice';
  return 'Notification';
}

function notificationIcon(category: string) {
  if (category === 'DEADLINE_ALERT') return <Clock3 size={15}/>;
  if (category === 'PENDING_FEEDBACK') return <Inbox size={15}/>;
  return <Bell size={15}/>;
}

async function readNotifications() {
  const response = await fetch('/api/teacher-notifications', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? 'Notifications could not be loaded.');
  return (payload.notifications ?? []) as Notification[];
}

async function markAllNotificationsRead() {
  const response = await fetch('/api/teacher-notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mark_all: true })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? 'Notifications could not be updated.');
}

export function NotificationBell({ onOpen }: { onOpen: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setNotifications(await readNotifications());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => { void load(); }, 60000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function markAllRead() {
    setBusy(true);
    setError('');
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications(current => current.map(item => ({ ...item, read_at: item.read_at ?? now })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notifications could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  const unread = notifications.filter(item => !item.read_at).length;
  const preview = notifications.slice(0, 5);

  return <div className="notification-bell-wrap">
    <button
      type="button"
      className="notification-bell-button"
      aria-label={`Notifications, ${unread} unread`}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={() => {
        const next = !open;
        setOpen(next);
        if (next) void load();
      }}
    >
      <Bell size={18}/>
      {unread > 0 && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <section className="notification-popover" role="dialog" aria-label="Notification preview">
      <header className="notification-popover-head">
        <div><b>Notifications</b><small>{unread} unread</small></div>
        <button className="text-button" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={13}/></button>
      </header>
      {error && <p className="alert error notification-inline-error" role="alert">{error}</p>}
      {loading && !notifications.length ? <p className="notification-empty">Loading notifications…</p> :
        preview.length ? <div className="notification-preview-list">{preview.map(item=><article key={item.id} className={'notification-preview-item '+(!item.read_at?'unread':'')}>
          <span className="notification-kind-icon">{notificationIcon(item.category)}</span>
          <div className="notification-preview-copy">
            <div className="notification-preview-title"><b>{item.title}</b>{!item.read_at&&<i/>}</div>
            <small>{notificationLabel(item.category)} · {new Date(item.created_at).toLocaleString()}</small>
            <p>{item.body}</p>
          </div>
        </article>)}</div> :
        <p className="notification-empty">You're all caught up. New feedback and deadline reminders will appear here.</p>
      }
      <div className="notification-popover-actions">
        <button className="button subtle compact" type="button" onClick={()=>void markAllRead()} disabled={busy||unread===0}>{busy?'Saving…':'Mark all read'}</button>
        <button className="button primary compact" type="button" onClick={()=>{setOpen(false);onOpen();}}>Open Notification Center</button>
      </div>
    </section>}
  </div>;
}

export function TeacherInbox() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setNotifications(await readNotifications());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markRead(id: string) {
    setBusy(true);
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
      setBusy(false);
    }
  }

  async function markAllRead() {
    setBusy(true);
    setError('');
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications(current => current.map(item => ({ ...item, read_at: item.read_at ?? now })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notifications could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!window.confirm('Clear all notifications from your inbox? They will be hidden until a new alert is generated.')) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/teacher-notifications', { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Notifications could not be cleared.');
      setNotifications([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notifications could not be cleared.');
    } finally {
      setBusy(false);
    }
  }

  const unread = notifications.filter(item => !item.read_at).length;

  return <section className="teacher-notification-center" aria-labelledby="teacher-inbox-title">
    <div className="section-heading">
      <div><h3 id="teacher-inbox-title">Your notifications</h3><p>Feedback activity, pending reminders and important deadlines for your assigned courses.</p></div>
      <span className="role-chip"><Bell size={13}/> {unread} unread</span>
    </div>
    <div className="privacy-banner"><ShieldCheck size={17}/><span><b>Private and anonymous by design</b><small>New-feedback alerts never contain a student name or answer text. Only your own instructor notifications are visible here.</small></span></div>
    {error&&<p className="alert error" role="alert">{error}</p>}
    <div className="notification-center-toolbar">
      <button className="button subtle compact" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button>
      <button className="button subtle compact" type="button" onClick={()=>void markAllRead()} disabled={busy||unread===0}><CheckCheck size={14}/> Mark all read</button>
      <button className="button subtle compact" type="button" onClick={()=>void clearAll()} disabled={busy||notifications.length===0}><Trash2 size={14}/> Clear all</button>
    </div>
    {loading?<p className="fine-print">Loading your notifications…</p>:notifications.length===0?
      <div className="notification-empty-state"><span><Bell size={21}/></span><b>You're all caught up</b><p>New anonymous feedback, pending reminders and deadline alerts will show here.</p></div>:
      <div className="notification-center-list">{notifications.map(item=><article key={item.id} className={'notification-center-item '+(!item.read_at?'unread':'')}>
        <span className="notification-kind-icon">{notificationIcon(item.category)}</span>
        <div className="notification-center-copy">
          <div className="notification-center-title"><div><b>{item.title}</b><span className="notification-type-chip">{notificationLabel(item.category)}</span></div>{!item.read_at&&<span className="notification-unread-label">Unread</span>}</div>
          <p>{item.body}</p>
          <small>{new Date(item.created_at).toLocaleString()}</small>
        </div>
        {!item.read_at&&<button className="button subtle compact notification-mark-read" type="button" onClick={()=>void markRead(item.id)} disabled={busy}><Check size={14}/> Mark read</button>}
      </article>)}</div>
    }
  </section>;
}
