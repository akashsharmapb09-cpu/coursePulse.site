'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, LoaderCircle, Mail, LockKeyhole } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
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
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace('/dashboard'); router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } });
        if (error) throw error;
        if (data.session) { router.replace('/dashboard'); router.refresh(); }
        else setNotice('Check your email to confirm your account, then sign in.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to authenticate.'); }
    finally { setBusy(false); }
  }
  return <div className="auth-card">
    <div className="mobile-brand"><span className="brand-mark">◉</span> CoursePulse</div>
    <div className="auth-icon"><BookOpen size={21}/></div>
    <span className="eyebrow">WELCOME TO COURSEPULSE</span>
    <h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
    <p className="muted">{mode === 'signin' ? 'Sign in to view your courses and feedback.' : 'Your account starts with the student role. An administrator can assign teaching or admin access.'}</p>
    <form onSubmit={submit} className="stack-form">
      {mode === 'signup' && <label>Full name<input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} maxLength={120} required placeholder="Your name"/></label>}
      <label>Email address<span className="input-wrap"><Mail size={17}/><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} required placeholder="you@school.edu"/></span></label>
      <label>Password<span className="input-wrap"><LockKeyhole size={17}/><input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={10} maxLength={72} required placeholder="At least 10 characters"/></span></label>
      {error && <p className="alert error" role="alert">{error}</p>}{notice && <p className="alert success" role="status">{notice}</p>}
      <button className="button primary full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <>{mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={17}/></>}</button>
    </form>
    <p className="switch-auth">{mode === 'signin' ? 'New to CoursePulse?' : 'Already have an account?'} <button onClick={()=>{setMode(mode === 'signin' ? 'signup' : 'signin');setError('');setNotice('')}}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button></p>
    <p className="fine-print">By continuing, you agree to use CoursePulse responsibly. Your role and data access are enforced by database policies.</p>
  </div>;
}
