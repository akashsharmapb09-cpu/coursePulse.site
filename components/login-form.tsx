'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, BookOpen, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react';

export function LoginForm({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }) {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const endpoint = mode === 'signin' ? '/api/auth/username-login' : '/api/auth/username-signup';
      const body = mode === 'signin'
        ? { username: username.trim().toLowerCase(), password }
        : { full_name: name.trim(), username: username.trim().toLowerCase(), password };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (mode === 'signin' ? 'Sign-in failed.' : 'Account could not be created.'));

      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="auth-card">
    <div className="mobile-brand"><span className="brand-mark"><Activity size={19}/></span> CoursePulse</div>
    <div className="auth-icon"><BookOpen size={21}/></div>
    <span className="eyebrow">WELCOME TO COURSEPULSE</span>
    <h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
    <p className="muted">{mode === 'signin'
      ? 'Sign in with your username and password. No Gmail, email address or phone number needed.'
      : 'Create your Student account with your name, username and password. No Gmail, email address or phone number needed. Keep your password safe; a forgotten password must be reset by your college administrator.'}</p>

    <form onSubmit={submit} className="stack-form">
      {mode === 'signup' && <label>Full name<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={120} required placeholder="Your name"/></label>}

      <label>{mode === 'signin' ? 'Username' : 'Choose username'}<span className="input-wrap"><UserRound size={17}/><input type="text" name="username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} minLength={3} maxLength={30} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}" required placeholder="your.username"/></span></label>

      <label>Password<span className="input-wrap"><LockKeyhole size={17}/><input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={mode === 'signup' ? 10 : 1} maxLength={72} required placeholder={mode === 'signup' ? 'At least 10 characters' : 'Your password'}/></span></label>

      {error && <p className="alert error" role="alert">{error}</p>}
      <button type="submit" className="button primary full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <>{mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={17}/></>}</button>
    </form>

    <p className="switch-auth">{mode === 'signin' ? 'New to CoursePulse?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button></p>
    <p className="fine-print">{mode === 'signup'
      ? 'New accounts start as Students. Only a verified CoursePulse Platform Super Admin can assign HOD access. If you forget your password, contact your college administrator for a reset.'
      : 'By continuing, you agree to use CoursePulse responsibly. Your role and data access are enforced by database policies.'}</p>
  </div>;
}
