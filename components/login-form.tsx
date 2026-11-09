'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, BookOpen, LoaderCircle, Smartphone, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup' | 'verify-signup' | 'forgot' | 'verify-reset' | 'legacy-signin' | 'legacy-forgot';

function normalizeIndianPhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s()-]/g, '');
  if (/^\d{10}$/.test(compact)) return '+91' + compact;
  if (/^91\d{10}$/.test(compact)) return '+' + compact;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return null;
}

function authErrorCode(error: unknown): { code?: string; status?: number } {
  if (!error || typeof error !== 'object') return {};
  const value = error as { code?: unknown; status?: unknown };
  return {
    code: typeof value.code === 'string' ? value.code : undefined,
    status: typeof value.status === 'number' ? value.status : undefined,
  };
}

export function LoginForm({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const phoneNumber = normalizeIndianPhone(phone);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setNotice('');
    setOtp('');
    setPassword('');
    setConfirmPassword('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (mode !== 'legacy-signin' && mode !== 'legacy-forgot' && !phoneNumber) {
      setError('Enter a valid mobile number. Indian 10-digit numbers are accepted; international numbers must include +country code.');
      return;
    }
    if (mode === 'verify-signup' || mode === 'verify-reset') {
      setError('Enter the six-digit code sent to your phone.');
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();

      if (mode === 'legacy-signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        router.replace('/dashboard');
        router.refresh();
        return;
      }

      if (mode === 'legacy-forgot') {
        const redirectTo = new URL('/auth/confirm?next=/auth/reset', process.env.NEXT_PUBLIC_APP_URL || window.location.origin).toString();
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (resetError) throw resetError;
        setNotice('If an existing account matches this email, password reset instructions can be sent. Check your inbox and spam folder.');
        return;
      }

      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          phone: phoneNumber!,
          password,
        });
        if (signInError) throw signInError;
        router.replace('/dashboard');
        router.refresh();
        return;
      }

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          phone: phoneNumber!,
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          router.replace('/dashboard');
          router.refresh();
          return;
        }
        setMode('verify-signup');
        setNotice('A verification code has been requested. Enter the six-digit SMS code to activate your account.');
        return;
      }

      if (mode === 'forgot') {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          phone: phoneNumber!,
          options: { shouldCreateUser: false },
        });
        if (otpError) throw otpError;
        setMode('verify-reset');
        setNotice('A password-reset verification code has been requested. Enter the six-digit SMS code to continue.');
        return;
      }
    } catch (cause) {
      const details = authErrorCode(cause);
      if (mode === 'legacy-forgot') {
        setNotice('If an existing account matches this email, password reset instructions can be sent. Try again later if nothing arrives.');
      } else if (mode === 'legacy-signin' || mode === 'signin') {
        setError('Sign-in failed. Check your credentials and try again.');
      } else if (details.code === 'over_sms_send_rate_limit' || details.status === 429) {
        setError('The SMS verification limit has been reached. Wait before requesting another code.');
      } else if (details.status !== undefined && details.status >= 500) {
        setError('The verification service is temporarily unavailable. Please try again later.');
      } else {
        setError('We could not complete this request. Check the details and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!phoneNumber) {
      setError('Enter the mobile number used for this request.');
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the six-digit verification code.');
      return;
    }
    if (mode === 'verify-reset' && (password.length < 10 || password.length > 72 || password !== confirmPassword)) {
      setError('Enter matching new passwords of at least 10 characters.');
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: phoneNumber,
        token: otp.trim(),
        type: 'sms',
      });
      if (verifyError) throw verifyError;

      if (mode === 'verify-reset') {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        await supabase.auth.signOut({ scope: 'global' });
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
        setOtp('');
        setNotice('Password updated. Sign in with your mobile number and new password.');
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('The verification code is invalid or expired. Request a new code and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    if (!phoneNumber) {
      setError('Enter the mobile number used for this request.');
      return;
    }
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({ type: 'sms', phone: phoneNumber });
      if (resendError) throw resendError;
      setNotice('A new verification code has been requested. Check your SMS messages.');
    } catch (cause) {
      const details = authErrorCode(cause);
      setError(details.status === 429 || details.code === 'over_sms_send_rate_limit'
        ? 'The SMS rate limit has been reached. Wait before requesting another code.'
        : 'A new code could not be requested right now. Please try again later.');
    } finally {
      setBusy(false);
    }
  }

  const verificationMode = mode === 'verify-signup' || mode === 'verify-reset';
  const legacyMode = mode === 'legacy-signin' || mode === 'legacy-forgot';

  return <div className="auth-card">
    <div className="mobile-brand"><span className="brand-mark"><Activity size={19}/></span> CoursePulse</div>
    <div className="auth-icon">{verificationMode ? <ShieldCheck size={21}/> : <Smartphone size={21}/>}</div>
    <span className="eyebrow">WELCOME TO COURSEPULSE</span>
    <h2>{mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : mode === 'legacy-forgot' ? 'Reset existing account password' : verificationMode ? 'Verify your mobile number' : 'Existing account sign-in'}</h2>
    <p className="muted">
      {mode === 'signin' ? 'Sign in securely with your mobile number and password.' :
       mode === 'signup' ? 'Your account starts as a Student. Create it with your mobile number, then verify by SMS. A college HOD can invite Teachers and Students; only CoursePulse Platform Super Admin can assign HOD access.' :
       mode === 'forgot' ? 'We will request a one-time SMS code so you can set a new password.' :
       mode === 'legacy-forgot' ? 'Use email recovery only for an older account that has not linked a mobile number yet.' :
       mode === 'verify-signup' ? 'Enter the six-digit code sent to ' + (phoneNumber ?? phone) + ' to finish creating your account.' :
       mode === 'verify-reset' ? 'Verify your mobile number, then choose a new password.' :
       'Use email sign-in temporarily to migrate an existing account to mobile authentication.'}
    </p>

    <form onSubmit={verificationMode ? verifyOtp : submit} className="stack-form">
      {mode === 'signup' && <label>Full name<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} maxLength={120} required placeholder="Your name"/></label>}
      {legacyMode
        ? <label>Email address<span className="input-wrap"><Mail size={17}/><input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required placeholder="you@school.edu"/></span></label>
        : <label>Mobile number<span className="input-wrap"><Smartphone size={17}/><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} maxLength={20} required placeholder="+91 98765 43210"/></span><small className="fine-print">Indian 10-digit numbers default to +91. Use +country code for other countries.</small></label>}
      {(mode === 'signin' || mode === 'signup' || mode === 'legacy-signin') && <label>Password<span className="input-wrap"><LockKeyhole size={17}/><input type="password" autoComplete={mode === 'signin' || legacyMode ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={mode === 'signup' ? 10 : undefined} maxLength={72} required placeholder={mode === 'signup' ? 'At least 10 characters' : 'Your password'}/></span></label>}
      {mode === 'verify-signup' && <label>SMS verification code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required placeholder="6-digit code"/></label>}
      {mode === 'verify-reset' && <>
        <label>SMS verification code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required placeholder="6-digit code"/></label>
        <label>New password<input type="password" autoComplete="new-password" minLength={10} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} required placeholder="At least 10 characters"/></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" minLength={10} maxLength={72} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required placeholder="Repeat new password"/></label>
      </>}
      {error && <p className="alert error" role="alert">{error}</p>}
      {notice && <p className="alert success" role="status">{notice}</p>}
      <button type="submit" className="button primary full" disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={17}/> : <>{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset code' : mode === 'legacy-forgot' ? 'Send legacy email reset link' : verificationMode ? (mode === 'verify-reset' ? 'Verify & reset password' : 'Verify mobile number') : 'Sign in with email'} <ArrowRight size={17}/></>}
      </button>
    </form>

    {verificationMode && <button type="button" className="button subtle full" onClick={() => void resendOtp()} disabled={busy}>Resend SMS code</button>}
    {mode === 'signin' && <div className="switch-auth"><button onClick={() => switchMode('forgot')}>Forgot password?</button></div>}
    {mode === 'legacy-signin' && <div className="switch-auth"><button onClick={() => switchMode('legacy-forgot')}>Forgot password for this older account?</button></div>}
    {mode === 'signin' && <p className="switch-auth">New to CoursePulse? <button onClick={() => switchMode('signup')}>Create account</button></p>}
    {mode === 'signup' && <p className="switch-auth">Already registered? <button onClick={() => switchMode('signin')}>Sign in</button></p>}
    {mode === 'signin' && <p className="switch-auth">Existing account without a linked phone? <button onClick={() => switchMode('legacy-signin')}>Use email sign-in temporarily</button></p>}
    {mode === 'legacy-signin' && <p className="switch-auth">Already linked your phone? <button onClick={() => switchMode('signin')}>Use mobile sign-in</button></p>}
    {mode === 'forgot' && <p className="switch-auth">Older account without a phone? <button onClick={() => switchMode('legacy-forgot')}>Use email recovery temporarily</button></p>}
    {mode === 'legacy-forgot' && <p className="switch-auth"><button onClick={() => switchMode('forgot')}>Back to mobile recovery</button></p>}
    {(verificationMode || mode === 'forgot' || mode === 'legacy-forgot') && <p className="switch-auth"><button onClick={() => switchMode('signin')}>Back to sign in</button></p>}
    <p className="fine-print">Phone-based registration uses SMS verification. Email sign-in remains temporarily available only for existing accounts during the migration; no new email accounts can be created.</p>
  </div>;
}
