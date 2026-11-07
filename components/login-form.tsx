'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, BookOpen, LoaderCircle, LockKeyhole, Mail, ShieldCheck
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type AuthMode = 'signin' | 'signup';
type SignupRole = 'student' | 'admin';

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [signupRole, setSignupRole] = useState<SignupRole>('student');
  const [adminCode, setAdminCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdminSignup = mode === 'signup' && signupRole === 'admin';

  function clearMessages() {
    setError('');
    setNotice('');
  }

  function clearAdminProof() {
    void fetch('/api/admin-signup/clear', { method: 'POST' });
  }

  function changeMode(nextMode: AuthMode) {
    clearAdminProof();
    setMode(nextMode);
    setSignupRole('student');
    setAdminCode('');
    clearMessages();
  }

  async function prepareAdminSignup(identity: string) {
    if (!adminCode.trim()) {
      throw new Error('Admin account ke liye special code enter karein.');
    }

    const response = await fetch('/api/admin-signup/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: adminCode,
        method: 'email',
        identity
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'Admin code verify nahi ho paya.');
    }
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    clearMessages();
    setBusy(true);

    try {
      const supabase = createClient();

      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;
        router.replace('/dashboard');
        router.refresh();
        return;
      }

      if (isAdminSignup) {
        await prepareAdminSignup(email.trim().toLowerCase());
      }

      const emailRedirectTo = new URL(
        isAdminSignup
          ? '/auth/confirm?next=/auth/complete'
          : '/auth/confirm?next=/dashboard',
        process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      ).toString();

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo
        }
      });
      if (error) throw error;

      if (data.session) {
        router.replace(isAdminSignup ? '/auth/complete?next=/dashboard' : '/dashboard');
        router.refresh();
      } else {
        setNotice(
          isAdminSignup
            ? 'Email confirm karein. Confirmation ke baad Admin access activate hoga.'
            : 'Check your email to confirm your account, then sign in.'
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to authenticate.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="mobile-brand"><span className="brand-mark">◉</span> CoursePulse</div>
      <div className="auth-icon"><BookOpen size={21}/></div>
      <span className="eyebrow">WELCOME TO COURSEPULSE</span>
      <h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
      <p className="muted">
        {mode === 'signin'
          ? 'Sign in securely to view your courses and feedback.'
          : 'Choose Student for regular access, or Admin to create a protected administrator account.'}
      </p>

      {mode === 'signup' && (
        <div className="signup-role-picker" aria-label="Choose account type">
          <button
            type="button"
            className={signupRole === 'student' ? 'active' : ''}
            onClick={() => {
              clearAdminProof();
              setSignupRole('student');
              setAdminCode('');
              clearMessages();
            }}
          >
            <span className="role-choice-title">Student</span>
            <span className="role-choice-copy">Regular learning access</span>
          </button>
          <button
            type="button"
            className={signupRole === 'admin' ? 'active admin' : ''}
            onClick={() => {
              setSignupRole('admin');
              clearMessages();
            }}
          >
            <span className="role-choice-title">Admin <ShieldCheck size={14}/></span>
            <span className="role-choice-copy">Protected admin access</span>
          </button>
        </div>
      )}

      {isAdminSignup && (
        <label className="admin-code-field">
          Admin special code
          <span className="input-wrap">
            <LockKeyhole size={17}/>
            <input
              type="password"
              autoComplete="off"
              value={adminCode}
              onChange={e => setAdminCode(e.target.value)}
              maxLength={128}
              placeholder="Enter admin code"
            />
          </span>
          <small>Admin role tabhi milega jab server code verify karega.</small>
        </label>
      )}

      <form onSubmit={submitEmail} className="stack-form auth-method-form">
        {mode === 'signup' && (
          <label>
            Full name
            <input
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={120}
              required
              placeholder="Your name"
            />
          </label>
        )}

        <label>
          Email address
          <span className="input-wrap">
            <Mail size={17}/>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              maxLength={254}
              required
              placeholder="you@school.edu"
            />
          </span>
        </label>

        <label>
          Password
          <span className="input-wrap">
            <LockKeyhole size={17}/>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={10}
              maxLength={72}
              required
              placeholder="At least 10 characters"
            />
          </span>
        </label>

        {error && <p className="alert error" role="alert">{error}</p>}
        {notice && <p className="alert success" role="status">{notice}</p>}

        <button
          className="button primary full"
          disabled={busy || (mode === 'signup' && (!name.trim() || (isAdminSignup && !adminCode.trim())))}
        >
          {busy ? (
            <LoaderCircle className="spin" size={17}/>
          ) : (
            <>
              {mode === 'signin'
                ? 'Sign in with email'
                : 'Create ' + (signupRole === 'admin' ? 'Admin' : 'Student') + ' account'}
              <ArrowRight size={17}/>
            </>
          )}
        </button>
      </form>

      <p className="switch-auth">
        {mode === 'signin' ? 'New to CoursePulse?' : 'Already have an account?'}
        <button
          type="button"
          onClick={() => changeMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'Create account' : 'Sign in'}
        </button>
      </p>
      <p className="fine-print">
        By continuing, you agree to use CoursePulse responsibly. Your role and data access are enforced by database policies.
      </p>
    </div>
  );
}
