'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, BookOpen, LoaderCircle, Mail, LockKeyhole } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type AuthErrorDetails = {
  code?: string;
  status?: number;
  message?: string;
};

function emailDeliveryErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const details = error as AuthErrorDetails;
  const code = details.code ?? '';
  const message = details.message ?? '';

  if (
    code === 'over_email_send_rate_limit' ||
    details.status === 429 ||
    /email rate limit exceeded/i.test(message)
  ) {
    return 'CoursePulse has temporarily reached its email sending limit. Please wait before trying again. The administrator needs to configure custom SMTP for reliable confirmation emails.';
  }

  if (code === 'email_address_not_authorized') {
    return 'The current Supabase test email service only sends to approved team addresses. The administrator must configure custom SMTP before public users can receive confirmation emails.';
  }

  return null;
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
  const [confirmationPending, setConfirmationPending] = useState(false);

  async function resendConfirmation() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Enter your email address first.');
      return;
    }

    setError('');
    setNotice('');
    setResending(true);
    try {
      const supabase = createClient();
      const emailRedirectTo = new URL('/auth/confirm', process.env.NEXT_PUBLIC_APP_URL || window.location.origin).toString();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: { emailRedirectTo }
      });

      if (error) {
        setError(
          emailDeliveryErrorMessage(error) ??
          'We could not resend the confirmation email. Please wait a little and try again.'
        );
      } else {
        setNotice('If this account still needs confirmation, a new email has been requested. Check your inbox and spam folder.');
      }
    } catch {
      setError('We could not resend the confirmation email. Please try again later.');
    } finally {
      setResending(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
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
        router.replace('/dashboard');
        router.refresh();
      } else {
        const emailRedirectTo = new URL('/auth/confirm', process.env.NEXT_PUBLIC_APP_URL || window.location.origin).toString();
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
          setConfirmationPending(true);
          setNotice('Your signup request was received. Check your inbox and spam folder for the confirmation email. You can request another email below.');
        }
      }
    } catch (caught) {
      if (mode === 'signin') {
        setError('Sign-in failed. Check your credentials and try again.');
      } else if (mode === 'signup') {
        const deliveryMessage = emailDeliveryErrorMessage(caught);
        if (deliveryMessage) {
          setConfirmationPending(true);
          setError(deliveryMessage);
        } else {
          const details = caught && typeof caught === 'object' ? caught as AuthErrorDetails : {};
          setConfirmationPending(false);
          setError(
            details.code === 'weak_password'
              ? 'Choose a stronger password and try again.'
              : 'We could not complete signup. Check your email address and password, then try again.'
          );
        }
      } else {
        setNotice('If an account exists for this email, password reset instructions can be sent. Try again later if nothing arrives.');
      }
    } finally {
      setBusy(false);
    }
  }

  function switchMode(nextMode: 'signin' | 'signup') {
    setMode(nextMode);
    setError('');
    setNotice('');
    setConfirmationPending(false);
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
      <button type="submit" className="button primary full" disabled={busy || resending}>{busy ? <LoaderCircle className="spin" size={17}/> : <>{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'} <ArrowRight size={17}/></>}</button>
      {mode === 'signup' && confirmationPending && <button type="button" className="button subtle full" onClick={resendConfirmation} disabled={busy || resending}>{resending ? <LoaderCircle className="spin" size={17}/> : 'Resend confirmation email'}</button>}
    </form>
    {mode === 'signin' && <p className="switch-auth"><button onClick={()=>{setMode('forgot');setError('');setNotice('');setConfirmationPending(false)}}>Forgot password?</button></p>}
    <p className="switch-auth">{mode === 'signin' ? 'New to CoursePulse?' : mode === 'signup' ? 'Already have an account?' : 'Remember your password?'} <button onClick={()=>switchMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button></p>
    <p className="fine-print">By continuing, you agree to use CoursePulse responsibly. Your role and data access are enforced by database policies.</p>
  </div>;
}
