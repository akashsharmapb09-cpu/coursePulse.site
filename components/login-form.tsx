'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, LoaderCircle, Mail, LockKeyhole } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }) {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      const supabase = createClient();
      if (mode === 'forgot') {
        const redirectTo = new URL('/auth/confirm?next=/auth/reset', process.env.NEXT_PUBLIC_APP_URL || window.location.origin).toString();
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setNotice('If an account exists for this email, password reset instructions have been sent.');
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace('/dashboard'); router.refresh();
      } else {
        const emailRedirectTo = new URL('/auth/confirm', process.env.NEXT_PUBLIC_APP_URL || window.location.origin).toString();
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo } });
        if (error) throw error;
        if (data.session) { router.replace('/dashboard'); router.refresh(); }
        else setNotice('Check your email to confirm your account, then sign in.');
      }
    } catch {
      if (mode === 'signin') {
        setError('Sign-in failed. Check your credentials and try again.');
      } else if (mode === 'signup') {
        setNotice('If an account can be created for this email, confirmation instructions will be sent. If you already have an account, try signing in.');
      } else {
        setNotice('If an account exists for this email, password reset instructions can be sent. Try again later if nothing arrives.');
      }
    }
    finally { setBusy(false); }
  }
  return <div className="auth-card">
    <div className="mobile-brand"><span className="brand-mark">◉</span> CoursePulse</div>
    <div className="auth-icon"><BookOpen size={21}/></div>
    <span className="eyebrow">WELCOME TO COURSEPULSE</span>
    <h2>{mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}</h2>
    <p className="muted">{mode === 'signin' ? 'Sign in to view your courses and feedback.' : mode === 'signup' ? 'Your account starts with the student role. An administrator can assign teaching or admin access.' : 'Enter your account email and we will send a secure reset link if it exists.'}</p>
    <form onSubmit={submit} className="stack-form">
      {mode === 'signup' && <label>Full name<input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} maxLength={120} required placeholder="Your name"/></label>}
      <label>Email address<span className="input-wrap"><Mail size={17}/><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} required placeholder="you@school.edu"/></span></label>
      {mode !== 'forgot' && <label>Password<span className="input-wrap"><LockKeyhole size={17}/><input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={10} maxLength={72} required placeholder="At least 10 characters"/></span></label>}
      {error && <p className="alert error" role="alert">{error}</p>}{notice && <p className="alert success" role="status">{notice}</p>}
      <button className="button primary full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <>{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'} <ArrowRight size={17}/></>}</button>
    </form>
    {mode === 'signin' && <p className="switch-auth"><button onClick={()=>{setMode('forgot');setError('');setNotice('')}}>Forgot password?</button></p>}
    <p className="switch-auth">{mode === 'signin' ? 'New to CoursePulse?' : mode === 'signup' ? 'Already have an account?' : 'Remember your password?'} <button onClick={()=>{setMode(mode === 'signin' ? 'signup' : 'signin');setError('');setNotice('')}}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button></p>
    <p className="fine-print">By continuing, you agree to use CoursePulse responsibly. Your role and data access are enforced by database policies.</p>
  </div>;
}
