'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, BookOpen, LoaderCircle, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const PROGRAMMES = [
  'B.Tech', 'M.Tech', 'B.E.', 'M.E.', 'BBA', 'MBA', 'B.Com', 'M.Com',
  'BCA', 'MCA', 'B.Sc', 'M.Sc', 'BA', 'MA', 'B.Pharm', 'M.Pharm',
  'B.Arch', 'M.Arch', 'Diploma', 'Other'
];

type Mode = 'signup' | 'signin';

export function StudentAuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [programme, setProgramme] = useState('B.Tech');
  const [customProgramme, setCustomProgramme] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (mode === 'signup') {
      if (fullName.trim().length < 2) {
        setError('Enter your full name (at least 2 characters).');
        return;
      }
      if (programme === 'Other' && customProgramme.trim().length < 2) {
        setError('Enter your programme name.');
        return;
      }
      if (password.length < 10) {
        setError('Choose a password with at least 10 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('The passwords do not match.');
        return;
      }
    }

    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === 'signup') {
        const chosenProgramme = programme === 'Other' ? customProgramme.trim() : programme;
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: fullName.trim(), program: chosenProgramme },
            // The project origin is the configured Supabase Site URL and works
            // with the default confirmation redirect allow-list entry.
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=%2Fdashboard`
          }
        });

        if (signupError) throw signupError;

        if (data.session && data.user) {
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('role,is_active')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profileError || profile?.role !== 'STUDENT' || !profile.is_active) {
            await supabase.auth.signOut();
            throw new Error('Student profile setup is not ready. Please try again or contact the project team.');
          }

          router.replace('/dashboard');
          router.refresh();
          return;
        }

        setNotice('Your registration has been received. Check your email for the confirmation link, then return here to sign in.');
        setPassword('');
        setConfirmPassword('');
      } else {
        const { data, error: signinError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password
        });

        if (signinError) throw signinError;

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('role,is_active')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileError || profile?.role !== 'STUDENT' || !profile.is_active) {
          await supabase.auth.signOut();
          throw new Error('This sign-in is only available for active student accounts.');
        }

        router.replace('/dashboard');
        router.refresh();
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Something went wrong. Please try again.';
      if (/invalid login credentials/i.test(message)) {
        setError('Email or password is incorrect. Please check your details and try again.');
      } else if (/email not confirmed/i.test(message)) {
        setError('Please confirm your email from the message we sent before signing in.');
      } else if (/email_address_not_authorized|email address not authorized|over_email_send_rate_limit|email rate limit exceeded/i.test(message)) {
        setError('The sign-up email could not be sent. The project owner needs to configure a custom email provider in Supabase Authentication settings before students can receive verification links.');
      } else if (/already registered|user already exists/i.test(message)) {
        setError('An account may already exist for this email. Try signing in instead.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === 'signup';

  return <div className="auth-card">
    <div className="mobile-brand"><span className="brand-mark"><Activity size={19}/></span> CoursePulse</div>
    <div className="auth-icon"><BookOpen size={21}/></div>
    <span className="eyebrow">STUDENT ACCESS</span>
    <h2>{isSignup ? 'Create your student account' : 'Welcome back'}</h2>
    <p className="muted">{isSignup
      ? 'Enter your details and choose the programme you are studying. Every new account is a Student account.'
      : 'Sign in to your CoursePulse student account using your email address and password.'}</p>

    <form onSubmit={submit} className="stack-form">
      {isSignup && <>
        <label>Full name
          <span className="input-wrap"><UserRound size={17}/><input autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} minLength={2} maxLength={120} required placeholder="Enter your full name"/></span>
        </label>
        <label>Programme / Course
          <select value={programme} onChange={event => setProgramme(event.target.value)} required>
            {PROGRAMMES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        {programme === 'Other' && <label>Enter your programme
          <input value={customProgramme} onChange={event => setCustomProgramme(event.target.value)} minLength={2} maxLength={80} required placeholder="For example, B.Des or LLB"/>
        </label>}
      </>}
      <label>Email address
        <span className="input-wrap"><Mail size={17}/><input type="email" name="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required placeholder="you@example.com"/></span>
      </label>
      <label>Password
        <span className="input-wrap"><LockKeyhole size={17}/><input type="password" name="password" autoComplete={isSignup ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={isSignup ? 10 : 1} maxLength={72} required placeholder={isSignup ? 'At least 10 characters' : 'Your password'}/></span>
      </label>
      {isSignup && <label>Confirm password
        <span className="input-wrap"><LockKeyhole size={17}/><input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={10} maxLength={72} required placeholder="Enter your password again"/></span>
      </label>}
      {error && <p className="alert error" role="alert">{error}</p>}
      {notice && <p className="alert success" role="status">{notice}</p>}
      <button type="submit" className="button primary full" disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={17}/> : <>{isSignup ? 'Create student account' : 'Sign in'} <ArrowRight size={17}/></>}
      </button>
    </form>

    <p className="switch-auth">
      {isSignup ? 'Already have an account?' : 'New to CoursePulse?'}{' '}
      <Link href={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create account'}</Link>
    </p>
    <p className="fine-print">
      Student registration only. CoursePulse does not offer Admin or HOD sign-up. Your password is handled by Supabase Authentication; never share it with anyone.
    </p>
  </div>;
}
