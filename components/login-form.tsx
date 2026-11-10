'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, BookOpen, LoaderCircle, Mail, LockKeyhole, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }) {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);

    try {
      if (mode === 'signin') {
        const response = await fetch('/api/auth/username-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim().toLowerCase(), password })
        });
        if (!response.ok) throw new Error('Sign-in failed.');
        router.replace('/dashboard');
        router.refresh();
        return;
      }

      const supabase = createClient();
      if (mode === 'forgot') {
        const redirectTo = new URL('/auth/confirm?next=/auth/reset', process.env.NEXT_PUBLIC_APP_URL || window.location.origin).toString();
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setNotice('If an account exists for this email, password reset instructions have been sent.');
      } else {
        const emailRedirectTo = new URL('/auth/confirm', process.env.NEXT_PUBLIC_APP_URL || window.location.origin).toString();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim(), username: username.trim().toLowerCase() },
            emailRedirectTo
          }
        });
        if (error) throw error;
        if (data.session) {
          router.replace('/dashboard');
          router.refresh();
        } else {
          setNotice('Check your email to verify your account. You will sign in with your username and password.');
        }
      }
    } catch {
      if (mode === 'signin') {
        setError('Sign-in failed. Check your username and password and try again.');
      } else if (mode === 'signup') {
        setNotice('If an account can be created, verification instructions will be sent. Choose a different username if it is already in use.');
      } else {
        setNotice('If an account exists for this email, password reset instructions can be sent. Try again later if nothing arrives.');
      }
    } finally {
      setBusy(false);
    }
  }

  return <div className="auth-card">
    <div className="mobile-brand"><span className="brand-mark"><Activity size={19}/></span> CoursePulse</div>
    <div className="auth-icon"><BookOpen size={21}/></div>
    <span className="eyebrow">WELCOME TO COURSEPULSE</span>
    <h2>{mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}</h2>
    <p className="muted">{mode === 'signin'
      ? 'Sign in with your username and password. Existing usernames are based on the part before @ in your registered email; duplicates receive a short suffix. You can change yours in Account security.'
      : mode === 'signup'
        ? 'Choose a username for sign-in. Your email stays on your account for verification, recovery and existing account workflows.'
        : 'Enter the email associated with your account to receive a secure reset link if it exists.'}</p>

    <form onSubmit={submit} className="stack-form">
      {mode === 'signup' && <label>Full name<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={120} required placeholder="Your name"/></label>}

      {mode === 'signin' && <label>Username<span className="input-wrap"><UserRound size={17}/><input type="text" name="username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} minLength={3} maxLength={30} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}" required placeholder="your.username"/></span></label>}

      {mode === 'signup' && <label>Choose username<span className="input-wrap"><UserRound size={17}/><input type="text" name="username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} minLength={3} maxLength={30} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}" required placeholder="your.username"/></span></label>}

      {(mode === 'signup' || mode === 'forgot') && <label>{mode === 'signup' ? 'Email for verification and recovery' : 'Account email'}<span className="input-wrap"><Mail size={17}/><input type="email" name="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required placeholder="you@school.edu"/></span></label>}

      {mode !== 'forgot' && <label>Password<span className="input-wrap"><LockKeyhole size={17}/><input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={mode === 'signup' ? 10 : undefined} maxLength={72} required placeholder={mode === 'signup' ? 'At least 10 characters' : 'Your password'}/></span></label>}

      {error && <p className="alert error" role="alert">{error}</p>}
      {notice && <p className="alert success" role="status">{notice}</p>}
      <button type="submit" className="button primary full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <>{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'} <ArrowRight size={17}/></>}</button>
    </form>

    {mode === 'signin' && <p className="switch-auth"><button onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}>Forgot password?</button></p>}
    <p className="switch-auth">{mode === 'signin' ? 'New to CoursePulse?' : mode === 'signup' ? 'Already have an account?' : 'Remember your password?'} <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice(''); }}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button></p>
    <p className="fine-print">By continuing, you agree to use CoursePulse responsibly. Your role and data access are enforced by database policies.</p>
  </div>;
}
