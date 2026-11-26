'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, AtSign, BookOpen, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react';
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
  const [username, setUsername] = useState('');
  const [programme, setProgramme] = useState('B.Tech');
  const [customProgramme, setCustomProgramme] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      setError('Username must be 3–24 characters using lowercase letters, numbers or underscores.');
      return;
    }

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
      const chosenProgramme = programme === 'Other' ? customProgramme.trim() : programme;
      const { data: result, error: functionError } = await supabase.functions.invoke('student-username-auth', {
        body: mode === 'signup'
          ? { action: 'register', username: normalizedUsername, full_name: fullName.trim(), program: chosenProgramme, password }
          : { action: 'login', username: normalizedUsername, password }
      });

      if (functionError) {
        const context = (functionError as typeof functionError & { context?: Response }).context;
        if (context) {
          try {
            const payload = await context.clone().json() as { error?: string };
            throw new Error(payload.error || functionError.message);
          } catch (cause) {
            if (cause instanceof Error && cause.message !== functionError.message) throw cause;
          }
        }
        throw functionError;
      }

      if (!result?.session?.access_token || !result?.session?.refresh_token || result?.user?.role !== 'STUDENT') {
        throw new Error(result?.error || 'Student account could not be started. Please try again.');
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token
      });
      if (sessionError) throw sessionError;

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role,is_active')
        .eq('id', result.user.id)
        .maybeSingle();

      if (profileError || profile?.role !== 'STUDENT' || !profile.is_active) {
        await supabase.auth.signOut();
        throw new Error('Student profile setup is not ready. Please try again.');
      }

      router.replace('/dashboard');
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Something went wrong. Please try again.';
      if (/already taken|username.*(exists|used|duplicate)|duplicate key/i.test(message)) {
        setError('That username is already taken. Choose another one.');
      } else if (/invalid login credentials|username or password is incorrect/i.test(message)) {
        setError('Username or password is incorrect.');
      } else if (/too many/i.test(message)) {
        setError(message);
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
      ? 'Enter your name, choose your programme and create a username and password. No email address is needed.'
      : 'Sign in with the username and password you created. No email or verification code is needed.'}</p>

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
      <label>Username
        <span className="input-wrap"><AtSign size={17}/><input name="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]{3,24}" required placeholder="Choose a username"/></span>
      </label>
      {isSignup && <p className="fine-print">Use 3–24 letters, numbers or underscores. Your username must be unique.</p>}
      <label>Password
        <span className="input-wrap"><LockKeyhole size={17}/><input type="password" name="password" autoComplete={isSignup ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={isSignup ? 10 : 1} maxLength={72} required placeholder={isSignup ? 'At least 10 characters' : 'Your password'}/></span>
      </label>
      {isSignup && <label>Confirm password
        <span className="input-wrap"><LockKeyhole size={17}/><input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={10} maxLength={72} required placeholder="Enter your password again"/></span>
      </label>}
      {error && <p className="alert error" role="alert">{error}</p>}
      <button type="submit" className="button primary full" disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={17}/> : <>{isSignup ? 'Create student account' : 'Sign in'} <ArrowRight size={17}/></>}
      </button>
    </form>

    <p className="switch-auth">
      {isSignup ? 'Already have an account?' : 'New to CoursePulse?'}{' '}
      <Link href={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create account'}</Link>
    </p>
    <p className="fine-print">
      Student accounts only. No email address, verification email, or email recovery is used. Keep your username and password safe; account recovery requires help from the project team.
    </p>
  </div>;
}
