'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, AtSign, BookOpen, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const PROGRAMMES = [
  'B.Tech', 'M.Tech', 'B.E.', 'M.E.', 'BBA', 'MBA', 'B.Com', 'M.Com',
  'BCA', 'MCA', 'B.Sc', 'M.Sc', 'BA', 'MA', 'B.Pharm', 'M.Pharm',
  'B.Arch', 'M.Arch', 'Diploma', 'Other'
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

type Mode = 'signup' | 'signin';
type SignupRole = 'student' | 'teacher';

export function StudentAuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [signupRole, setSignupRole] = useState<SignupRole>('student');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [programme, setProgramme] = useState('B.Tech');
  const [customProgramme, setCustomProgramme] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    const normalizedUsername = username.trim().toLowerCase();
    const isTeacherSignup = mode === 'signup' && signupRole === 'teacher';
    const instructorEmailSignIn = mode === 'signin' && EMAIL_PATTERN.test(normalizedUsername);
    const usesEmail = isTeacherSignup || instructorEmailSignIn;

    if (usesEmail ? !EMAIL_PATTERN.test(normalizedUsername) : !USERNAME_PATTERN.test(normalizedUsername)) {
      setError(isTeacherSignup
        ? 'Enter a valid college email address.'
        : mode === 'signup'
          ? 'Username must be 3–24 characters using lowercase letters, numbers or underscores.'
          : 'Enter your Student username or Teacher college email.');
      return;
    }

    if (mode === 'signup') {
      if (fullName.trim().length < 2) {
        setError('Enter your full name (at least 2 characters).');
        return;
      }
      if (signupRole === 'student' && programme === 'Other' && customProgramme.trim().length < 2) {
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

      if (isTeacherSignup) {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: normalizedUsername,
          password,
          options: {
            data: { full_name: fullName.trim(), requested_role: 'INSTRUCTOR' },
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=%2Fdashboard`
          }
        });
        if (signupError) {
          throw new Error('Teacher registration could not be started. Check the college email and try again.');
        }

        if (data.session && data.user) {
          const { data: profile, error: profileError } = await supabase
            .from('users').select('role,is_active').eq('id', data.user.id).maybeSingle();
          if (profileError || profile?.role !== 'INSTRUCTOR' || !profile.is_active) {
            await supabase.auth.signOut();
            throw new Error('Teacher profile setup is not ready. Please try again.');
          }
          router.replace('/dashboard');
          router.refresh();
          return;
        }

        setNotice('If a Teacher account can be created for this email, confirmation instructions will be sent. Confirm the email before signing in.');
        return;
      }

      if (instructorEmailSignIn) {
        const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedUsername, password });
        if (signInError || !signIn.user) throw new Error('Email or password is incorrect.');
        const { data: instructorProfile, error: instructorProfileError } = await supabase
          .from('users').select('role,is_active').eq('id', signIn.user.id).maybeSingle();
        if (instructorProfileError || !instructorProfile?.is_active || instructorProfile.role !== 'INSTRUCTOR') {
          await supabase.auth.signOut();
          throw new Error('This email is not linked to an active Teacher account. Students should sign in with their username.');
        }
        router.replace('/dashboard');
        router.refresh();
        return;
      }

      const chosenProgramme = programme === 'Other' ? customProgramme.trim() : programme;
      const { data: result, error: functionError } = await supabase.functions.invoke('student-username-auth', {
        body: mode === 'signup'
          ? { action: 'register', username: normalizedUsername, full_name: fullName.trim(), program: chosenProgramme, password }
          : { action: 'login', username: normalizedUsername, password }
      });

      if (functionError) {
        const context = (functionError as typeof functionError & { context?: Response }).context;
        if (context && typeof context.clone === 'function') {
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
  const isTeacherSignup = isSignup && signupRole === 'teacher';
  const instructorEmailSignIn = mode === 'signin' && EMAIL_PATTERN.test(username.trim().toLowerCase());

  return <div className="auth-card">
    <Link className="auth-home-link" href="/">← Back to CoursePulse</Link>
    <div className="mobile-brand"><span className="brand-mark"><Activity size={19}/></span> CoursePulse</div>
    <div className="auth-icon"><BookOpen size={21}/></div>
    <span className="eyebrow">{isSignup ? 'STUDENT & TEACHER ACCESS' : 'WELCOME BACK'}</span>
    <h2>{isSignup ? `Create your ${signupRole} account` : 'Welcome back'}</h2>
    <p className="muted">{isSignup
      ? isTeacherSignup
        ? 'Teachers register with their college email. Confirm the email address before signing in.'
        : 'Students choose their programme and create a username and password. No email address is needed.'
      : 'Students sign in with their username. Teachers sign in with their college email and password.'}</p>

    <form onSubmit={submit} className="stack-form">
      {isSignup && <>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Choose account type">
          <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold ${signupRole === 'student' ? 'border-[#2b654b] bg-[#edf5ef] text-[#245b3e]' : 'border-[#dce6de] bg-white text-[#617467]'}`}>
            <input className="sr-only" type="radio" name="signup-role" value="student" checked={signupRole === 'student'} onChange={() => setSignupRole('student')}/>
            Student
          </label>
          <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold ${signupRole === 'teacher' ? 'border-[#2b654b] bg-[#edf5ef] text-[#245b3e]' : 'border-[#dce6de] bg-white text-[#617467]'}`}>
            <input className="sr-only" type="radio" name="signup-role" value="teacher" checked={signupRole === 'teacher'} onChange={() => setSignupRole('teacher')}/>
            Teacher
          </label>
        </div>
        <label>Full name
          <span className="input-wrap"><UserRound size={17}/><input autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} minLength={2} maxLength={120} required placeholder="Enter your full name"/></span>
        </label>
        {!isTeacherSignup && <>
          <label>Programme / Course
            <select value={programme} onChange={event => setProgramme(event.target.value)} required>
              {PROGRAMMES.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {programme === 'Other' && <label>Enter your programme
            <input value={customProgramme} onChange={event => setCustomProgramme(event.target.value)} minLength={2} maxLength={80} required placeholder="For example, B.Des or LLB"/>
          </label>}
        </>}
      </>}
      <label>{isTeacherSignup || instructorEmailSignIn ? 'College email' : 'Username'}
        <span className="input-wrap"><AtSign size={17}/><input type={isTeacherSignup || instructorEmailSignIn ? 'email' : 'text'} name="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete={isTeacherSignup || instructorEmailSignIn ? 'email' : 'username'} value={username} onChange={event => setUsername(event.target.value)} minLength={isTeacherSignup || instructorEmailSignIn ? undefined : 3} maxLength={isTeacherSignup || instructorEmailSignIn ? 254 : 24} pattern={isSignup && !isTeacherSignup ? '[a-zA-Z0-9_]{3,24}' : undefined} required placeholder={isTeacherSignup || instructorEmailSignIn ? 'teacher@college.edu' : isSignup ? 'Choose a username' : 'Student username'}/></span>
      </label>
      {isSignup && !isTeacherSignup && <p className="fine-print">Use 3–24 letters, numbers or underscores. Your username must be unique.</p>}
      <label>Password
        <span className="input-wrap password-input-wrap"><LockKeyhole size={17}/><input type={showPassword ? "text" : "password"} name="password" autoComplete={isSignup ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={isSignup ? 10 : 1} maxLength={72} required placeholder={isSignup ? 'At least 10 characters' : 'Your password'}/><button className="password-visibility-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span>
      </label>
      {isSignup && <div className="grid gap-[7px] text-xs font-bold text-[#40574d]">
        <label htmlFor="confirm-password">Confirm password</label>
        <span className="input-wrap password-input-wrap"><LockKeyhole size={17}/><input id="confirm-password" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={10} maxLength={72} required placeholder="Enter your password again"/><button className="password-visibility-toggle" type="button" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span>
      </div>}
      {error && <p className="alert error" role="alert">{error}</p>}
      {notice && <p className="alert" role="status">{notice}</p>}
      <button type="submit" className="button primary full" disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={17}/> : <>{isSignup ? `Create ${signupRole} account` : 'Sign in'} <ArrowRight size={17}/></>}
      </button>
    </form>

    <p className="switch-auth">
      {isSignup ? 'Already have an account?' : 'New to CoursePulse?'}{' '}
      <Link href={isSignup ? '/login' : '/signup'} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", paddingInline: 8 }}>{isSignup ? 'Sign in' : 'Create account'}</Link>
    </p>
    <p className="fine-print">
      {isSignup
        ? isTeacherSignup
          ? <>Teacher accounts use a college email and password. Email confirmation is required before sign-in.</>
          : <>Student accounts use a username and password; email-based password recovery is not available. Keep your sign-in details somewhere secure.</>
        : <>Students sign in with a username; Teachers sign in with their college email. For account assistance, see <Link className="auth-support-link" href="/contact">Contact &amp; support</Link>. Never share your password or sign-in codes.</>}
    </p>
  </div>;
}
