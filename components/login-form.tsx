'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, BookOpen, LoaderCircle, LockKeyhole, Mail,
  Phone, ShieldCheck
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type AuthMode = 'signin' | 'signup';
type LoginMethod = 'email' | 'phone';
type SignupRole = 'STUDENT' | 'ADMIN';
type SignupRole = 'student' | 'admin';

const COUNTRY_CODES = [
  { label: 'India (+91)', value: '+91' },
  { label: 'United States (+1)', value: '+1' },
  { label: 'United Kingdom (+44)', value: '+44' },
  { label: 'United Arab Emirates (+971)', value: '+971' },
  { label: 'Canada (+1)', value: '+1' },
  { label: 'Australia (+61)', value: '+61' },
];

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [method, setMethod] = useState<LoginMethod>('email');
  const [signupRole, setSignupRole] = useState<SignupRole>('student');
  const [adminCode, setAdminCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [signupRole, setSignupRole] = useState<SignupRole>('STUDENT');
  const [adminCode, setAdminCode] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState<'number' | 'verify'>('number');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdminSignup = mode === 'signup' && signupRole === 'admin';

  function clearMessages() { setError(''); setNotice(''); }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setSignupRole('student');
    setAdminCode('');
    setPhoneStep('number');
    setOtp('');
    clearMessages();
  }

  function changeMethod(nextMethod: LoginMethod) {
    setMethod(nextMethod);
    setPhoneStep('number');
    setOtp('');
    clearMessages();
  }

  async function prepareAdminSignup(authMethod: 'email' | 'phone' | 'google', identity?: string) {
    if (!adminCode.trim()) throw new Error('Admin account ke liye special code enter karein.');
    const response = await fetch('/api/admin-signup/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: adminCode, method: authMethod, identity })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Admin code verify nahi ho paya.');
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    clearMessages();
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace('/dashboard');
        router.refresh();
      } else {
        if (isAdminSignup) await prepareAdminSignup('email', email.trim().toLowerCase());
        const emailRedirectTo = new URL(
          isAdminSignup ? '/auth/confirm?next=/auth/complete' : '/auth/confirm?next=/dashboard',
          process.env.NEXT_PUBLIC_APP_URL || window.location.origin
        ).toString();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim(), requested_role: signupRole, ...(signupRole === 'ADMIN' ? { admin_signup_code: adminCode.trim() } : {}) }, emailRedirectTo }
        });
        if (error) throw error;
        if (data.session) {
          router.replace(isAdminSignup ? '/auth/complete?next=/dashboard' : '/dashboard');
          router.refresh();
        } else {
          setNotice(isAdminSignup
            ? 'Email confirm karein. Confirmation ke baad Admin access activate hoga.'
            : 'Check your email to confirm your account, then sign in.');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to authenticate.');
    } finally {
      setBusy(false);
    }
  }

  async function requestPhoneCode(rawPhone: string = phoneNumber) {
    clearMessages();
    const digits = rawPhone.replace(/[^0-9]/g, '');
    setPhoneNumber(digits);
    if (digits.length < 7 || digits.length > 15) {
      setError('Enter a valid mobile number, including the correct country code.');
      return;
    }
    const phone = countryCode + digits;
    setBusy(true);
    try {
      if (isAdminSignup) await prepareAdminSignup('phone', phone);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          shouldCreateUser: mode === 'signup',
          ...(mode === 'signup' ? { data: { full_name: name.trim(), requested_role: signupRole, ...(signupRole === 'ADMIN' ? { admin_signup_code: adminCode.trim() } : {}) } } : {})
        }
      });
      if (error) throw error;
      setPhoneStep('verify');
      setOtp('');
      setNotice('A 6-digit verification code has been sent to ' + phone + '.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send the verification code.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhoneCode(e: FormEvent) {
    e.preventDefault();
    clearMessages();
    if (!/^[0-9]{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit code sent to your phone.');
      return;
    }
    const phone = countryCode + phoneNumber.replace(/[^0-9]/g, '');
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp.trim(), type: 'sms' });
      if (error) throw error;
      router.replace(isAdminSignup ? '/auth/complete?next=/dashboard' : '/dashboard');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The verification code could not be confirmed.');
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    clearMessages();
    setBusy(true);
    try {
      if (isAdminSignup) await prepareAdminSignup('google');
      const supabase = createClient();
      const nextPath = isAdminSignup ? '/auth/complete?next=/dashboard' : '/dashboard';
      const redirectTo = new URL(
        '/auth/confirm?next=' + encodeURIComponent(nextPath),
        window.location.origin
      ).toString();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { prompt: 'select_account' } }
      });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start Google sign-in.');
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
          <button type="button" className={signupRole === 'student' ? 'active' : ''} onClick={() => { setSignupRole('student'); setAdminCode(''); clearMessages(); }}>
            <span className="role-choice-title">Student</span>
            <span className="role-choice-copy">Regular learning access</span>
          </button>
          <button type="button" className={signupRole === 'admin' ? 'active admin' : ''} onClick={() => { setSignupRole('admin'); clearMessages(); }}>
            <span className="role-choice-title">Admin <ShieldCheck size={14}/></span>
            <span className="role-choice-copy">Protected admin access</span>
          </button>
        </div>
      )}

      {isAdminSignup && (
        <label className="admin-code-field">Admin special code
          <span className="input-wrap"><LockKeyhole size={17}/><input type="password" autoComplete="off" value={adminCode} onChange={e => setAdminCode(e.target.value)} maxLength={128} placeholder="Enter admin code"/></span>
          <small>Admin role tabhi milega jab server code verify karega.</small>
        </label>
      )}

      <button type="button" className="google-auth-button" disabled={busy} onClick={() => void signInWithGoogle()}>
        {busy ? <LoaderCircle className="spin" size={17}/> : <span className="google-g" aria-hidden="true">G</span>}
        {mode === 'signup' ? 'Create ' + (signupRole === 'admin' ? 'Admin' : 'Student') + ' account with Google' : 'Continue with Google'}
      </button>

      <div className="auth-divider"><span>or continue with</span></div>
      <div className="auth-method-tabs" role="tablist" aria-label="Sign-in method">
        <button type="button" role="tab" aria-selected={method === 'email'} className={method === 'email' ? 'active' : ''} onClick={() => changeMethod('email')}>
          <Mail size={15}/> Email
        </button>
        <button type="button" role="tab" aria-selected={method === 'phone'} className={method === 'phone' ? 'active' : ''} onClick={() => changeMethod('phone')}>
          <Phone size={15}/> Mobile number
        </button>
      </div>

      {method === 'email' ? (
        <form onSubmit={submitEmail} className="stack-form auth-method-form">
          {mode === 'signup' && <label>Full name<input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} maxLength={120} required placeholder="Your name"/></label>}
          <label>Email address
            <span className="input-wrap"><Mail size={17}/><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} required placeholder="you@school.edu"/></span>
          </label>
          <label>Password
            <span className="input-wrap"><LockKeyhole size={17}/><input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={10} maxLength={72} required placeholder="At least 10 characters"/></span>
          </label>
          {error && <p className="alert error" role="alert">{error}</p>}
          {notice && <p className="alert success" role="status">{notice}</p>}
          <button className="button primary full" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17}/> : <>{mode === 'signin' ? 'Sign in with email' : 'Create ' + (signupRole === 'admin' ? 'Admin' : 'Student') + ' account'} <ArrowRight size={17}/></>}
          </button>
        </form>
      ) : (
        <div className="auth-method-form">
          {phoneStep === 'number' ? (
            <form onSubmit={e=>{ e.preventDefault(); void requestPhoneCode(phoneNumber); }} className="stack-form">
              {mode === 'signup' && <label>Full name<input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} maxLength={120} required placeholder="Your name"/></label>}
              <label htmlFor="coursepulse-phone-number">Mobile number</label>
              <div className="phone-input-wrap">
                <select aria-label="Country calling code" value={countryCode} onChange={e=>setCountryCode(e.target.value)}>
                  {COUNTRY_CODES.map((country,index)=><option key={country.value + '-' + country.label + '-' + index} value={country.value}>{country.label}</option>)}
                </select>
                <input id="coursepulse-phone-number" className="phone-number-input" name="phone" type="tel" inputMode="numeric" autoComplete="tel" autoCapitalize="off" spellCheck={false} maxLength={15} value={phoneNumber} onChange={e => setPhoneNumber(e.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 15))} required placeholder="9876543210" aria-label="Mobile number"/>
              </div>
              <p className="phone-helper"><ShieldCheck size={14}/> We'll send a one-time SMS code. Standard carrier charges may apply.</p>
              {error && <p className="alert error" role="alert">{error}</p>}
              {notice && <p className="alert success" role="status">{notice}</p>}
              <button className="button primary full" disabled={busy || (mode === 'signup' && (!name.trim() || (signupRole === 'ADMIN' && !adminCode.trim())))}>
                {busy ? <LoaderCircle className="spin" size={17}/> : <>Send verification code <ArrowRight size={17}/></>}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyPhoneCode} className="stack-form">
              <div className="otp-heading"><span className="otp-icon"><Phone size={18}/></span><span><b>Verify your number</b><small>Enter the 6-digit code sent to {countryCode}{phoneNumber.replace(/[^0-9]/g, '')}.</small></span></div>
              <label>Verification code<input className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/[^0-9]/g,'').slice(0,6))} required placeholder="000000"/></label>
              {error && <p className="alert error" role="alert">{error}</p>}
              {notice && <p className="alert success" role="status">{notice}</p>}
              <button className="button primary full" disabled={busy || otp.length !== 6}>{busy ? <LoaderCircle className="spin" size={17}/> : <>Verify & sign in <ArrowRight size={17}/></>}</button>
              <div className="otp-actions">
                <button type="button" onClick={()=>{setPhoneStep('number');setOtp('');clearMessages();}}><ArrowLeft size={14}/> Change number</button>
                <button type="button" disabled={busy} onClick={()=>void requestPhoneCode()}>Resend code</button>
              </div>
            </form>
          )}
        </div>
      )}

      <p className="switch-auth">
        {mode === 'signin' ? 'New to CoursePulse?' : 'Already have an account?'}
        <button type="button" onClick={()=>changeMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button>
      </p>
      <p className="fine-print">By continuing, you agree to use CoursePulse responsibly. Your role and data access are enforced by database policies.</p>
    </div>
  );
}
