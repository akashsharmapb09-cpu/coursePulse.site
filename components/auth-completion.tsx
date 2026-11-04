'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';

export function AuthCompletion() {
  const router = useRouter();
  const started = useRef(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  function destination() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || '/dashboard';
    return next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  }

  async function finish(adminCode?: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin-signup/grant', {
        method: 'POST',
        headers: adminCode ? { 'Content-Type': 'application/json' } : undefined,
        body: adminCode ? JSON.stringify({ code: adminCode }) : undefined
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Admin activation failed.');
      if (result.needsCode) {
        setNeedsCode(true);
        setBusy(false);
        return;
      }
      router.replace(destination());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to finish account setup.');
      setBusy(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="auth-complete-shell">
      <section className="auth-complete-card">
        <span className="auth-complete-icon"><ShieldCheck size={24}/></span>
        <p className="eyebrow">COURSEPULSE ACCOUNT SECURITY</p>
        <h1>{needsCode ? 'Confirm Admin activation' : 'Finishing your account setup'}</h1>
        {needsCode ? (
          <>
            <p>Your sign-in is complete, but the Re-enter the administrator special code to confirm and activate Admin access.</p>
            <form className="stack-form" onSubmit={event => { event.preventDefault(); void finish(code); }}>
              <label>Admin special code
                <span className="input-wrap"><LockKeyhole size={17}/><input type="password" autoComplete="off" value={code} onChange={event => setCode(event.target.value)} required placeholder="Enter admin code"/></span>
              </label>
              {error && <p className="alert error" role="alert">{error}</p>}
              <button className="button primary full" disabled={busy || !code.trim()}>
                {busy ? <LoaderCircle className="spin" size={17}/> : 'Verify code & activate Admin'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p>Please keep this page open while CoursePulse securely completes your sign-in.</p>
            {error && <p className="alert error" role="alert">{error}</p>}
            <span className="auth-complete-loading"><LoaderCircle className="spin" size={18}/> Verifying account…</span>
          </>
        )}
      </section>
    </main>
  );
}
