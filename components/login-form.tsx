'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, BookOpen, LoaderCircle, Mail, LockKeyhole } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function getAuthErrorDetails(error: unknown): { code?: string; status?: number } {
  if (!error || typeof error !== 'object') return {};
  const value = error as { code?: unknown; status?: unknown };
  return {
    code: typeof value.code === 'string' ? value.code : undefined,
    status: typeof value.status === 'number' ? value.status : undefined
  };
}

function getAuthRedirect(path: string): string {
  return new URL(path, process.env.NEXT_PUBLIC_APP_URL || window.location.origin).toString();
}

export function LoginForm({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }) {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);

  async function resendConfirmation() {
    if (!email.trim()) {
      setError('Enter your email address before requesting another confirmation message.');
      return;
    }

    setError('');
    setNotice('');
    setResending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: getAuthRedirect('/auth/confirm') }
      });
      if (error) throw error;
      setNotice('If this account still needs confirmation, a new email has been requested. Check your inbox and spam folder.');
    } catch (cause) {
      const details = getAuthErrorDetails(cause);
      if (details.code === 'over_email_send_rate_limit' || details.status === 429) {
        setError('CoursePulse has reached its confirmation-email limit. Please wait before requesting another message.');
      } else {
        setError('We could not request a confirmation email right now. Please try again later or contact your college administrator.');
      }
    } finally {
      setResending(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setCanResendConfirmation(false);
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === 'forgot') {
        const redirectTo = getAuthRedirect('/auth/confirm?next=/auth/reset');
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setNotice('If an account exists for this email, password reset instructions have been sent.');
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace('/dashboard');
        router.refresh();
      } else {
        const emailRedirectTo = getAuthRedirect('/auth/confirm');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo }
        });
        if (error) throw error;
        if (data.session) {
          router.replace('/dashboard');
          router.refresh();
        } else {
          setCanResendConfirmation(true);
          setNotice('If this account needs email confirmation, instructions have been requested. Check your inbox and spam folder. You can request another message below.');
        }
      }
    } catch (cause) {
      const details = getAuthErrorDetails(cause);
      if (mode === 'signin') {
        setError('Sign-in failed. Check your credentials and try again.');
      } else if (mode === 'signup' && (details.code === 'over_email_send_rate_limit' || details.status === 429)) {
        setCanResendConfirmation(true);
        setError('The confirmation-email limit has been reached. Your signup may already be registered; wait before requesting another confirmation message.');
      } else if (mode === 'signup' && (details.status !== undefined && details.status >= 500)) {
        setCanResendConfirmation(true);
        setError('CoursePulse could not send the confirmation email right now. Please try again later or contact your college administrator.');
      } else if (mode === 'signup') {
        setNotice('If an account can be created for this email, confirmation instructions will be sent. If you already have an account, try signing in or request another confirmation message below.');
        setCanResendConfirmation(true);
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
    <p className="muted">{mode === 'signin' ? 'Sign in to view your courses and feedback.' : mode === 'signup' ? 'Your account starts as a Student. A college HOD can invite Teachers and Students; only CoursePulse Platform Super Admin can assign HOD access.' : 'Enter your account email and we will send a secure reset link if it exists.'}</p>
    <form onSubmit={submit} className="stack-form">
      {mode === 'signup' && <label>Full name<input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} maxLength={120} required placeholder="Your name"/></label>}
      <label>Email address<span className="input-wrap"><Mail size={17}/><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} required placeholder="you@school.edu"/></span></label>
      {mode !== 'forgot' && <label>Password<span className="input-wrap"><LockKeyhole size={17}/><input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={mode === 'signup' ? 10 : undefined} maxLength={72} required placeholder={mode === 'signup' ? 'At least 10 characters' : 'Your password'}/></span></label>}
      {error && <p className="alert error" role="alert">{error}</p>}
      {notice && <p className="alert success" role="status">{notice}</p>}
      <button type="submit" className="button primary full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <>{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'} <ArrowRight size={17}/></>}</button>
    </form>
    {mode === 'signup' && canResendConfirmation && <button type="button" className="button subtle full mt-3" onClick={resendConfirmation} disabled={busy || resending}>{resending ? <LoaderCircle className="spin" size={17}/> : 'Resend confirmation email'}</button>}
    {mode === 'signin' && <p className="switch-auth"><button onClick={()=>{setMode('forgot');setError('');setNotice('');setCanResendConfirmation(false)}}>Forgot password?</button></p>}
    <p className="switch-auth">{mode === 'signin' ? 'New to CoursePulse?' : mode === 'signup' ? 'Already have an account?' : 'Remember your password?'} <button onClick={()=>{setMode(mode === 'signin' ? 'signup' : 'signin');setError('');setNotice('');setCanResendConfirmation(false)}}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button></p>
    <p className="fine-print">By continuing, you agree to use CoursePulse responsibly. Your role and data access are enforced by database policies.</p>
  </div>;
}
