'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { LoaderCircle, Smartphone, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function normalizePhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s()-]/g, '');
  if (/^\d{10}$/.test(compact)) return '+91' + compact;
  if (/^91\d{10}$/.test(compact)) return '+' + compact;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return null;
}

export function PhoneAccountLink() {
  const [phone, setPhone] = useState('');
  const [currentPhone, setCurrentPhone] = useState('');
  const [verified, setVerified] = useState(false);
  const [otp, setOtp] = useState('');
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void createClient().auth.getUser().then(({ data, error: authError }) => {
      if (!active || authError) return;
      const user = data.user;
      setCurrentPhone(user?.phone ?? '');
      setVerified(Boolean(user?.phone_confirmed_at));
      if (user?.phone) setPhone(user.phone);
    });
    return () => { active = false; };
  }, []);

  async function requestVerification(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError('Enter a valid mobile number. Indian 10-digit numbers default to +91; international numbers need +country code.');
      return;
    }
    if (normalized === currentPhone && verified) {
      setNotice('This mobile number is already linked and verified.');
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await createClient().auth.updateUser({ phone: normalized });
      if (updateError) throw updateError;
      setPhone(normalized);
      setPending(true);
      setOtp('');
      setNotice('A verification code has been requested for the new number. Your account remains on its existing sign-in method until verification succeeds.');
    } catch {
      setError('We could not request phone verification. Check the number and try again later.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhone(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    const normalized = normalizePhone(phone);
    if (!normalized || !/^\d{6}$/.test(otp.trim())) {
      setError('Enter the valid mobile number and six-digit code.');
      return;
    }
    setBusy(true);
    try {
      const { data, error: verifyError } = await createClient().auth.verifyOtp({
        phone: normalized,
        token: otp.trim(),
        type: 'phone_change',
      });
      if (verifyError || !data.user) throw verifyError ?? new Error('Phone verification failed.');
      setCurrentPhone(data.user.phone ?? normalized);
      setVerified(Boolean(data.user.phone_confirmed_at));
      setPending(false);
      setOtp('');
      setNotice('Mobile number verified and linked. You can now use it with your password to sign in.');
    } catch {
      setError('The code is invalid or expired. Request a new code and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: resendError } = await createClient().auth.resend({
        type: 'phone_change',
        phone: normalized,
      });
      if (resendError) throw resendError;
      setNotice('A new phone verification code has been requested.');
    } catch {
      setError('A new code could not be sent. Wait a little and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="stack-form rounded-2xl border border-[#e5ece6] bg-white p-6">
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9f2ec] text-[#315b46]"><Smartphone size={19}/></span>
      <div>
        <h3 className="font-semibold">Mobile sign-in</h3>
        <p className="fine-print">Link and verify your mobile number before the email sign-in transition ends.</p>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="role-chip">{verified ? 'Phone verified' : 'Phone not verified'}</span>
      {currentPhone && <span className="text-[#65776d]">{currentPhone}</span>}
    </div>
    {pending ? <form className="stack-form" onSubmit={verifyPhone}>
      <label>Six-digit SMS code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required placeholder="123456"/></label>
      <div className="flex flex-wrap gap-2">
        <button className="button primary" disabled={busy || otp.length !== 6}>{busy ? <LoaderCircle className="spin" size={16}/> : <ShieldCheck size={16}/>} Verify mobile</button>
        <button className="button subtle" type="button" disabled={busy} onClick={() => void resend()}>Resend code</button>
      </div>
    </form> : <form className="stack-form" onSubmit={requestVerification}>
      <label>Mobile number<input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} maxLength={20} required placeholder="+91 98765 43210"/></label>
      <button className="button primary self-start" disabled={busy || !phone.trim()}>{busy ? <LoaderCircle className="spin" size={16}/> : <Smartphone size={16}/>} {verified ? 'Change mobile number' : 'Verify mobile number'}</button>
    </form>}
    {error && <p className="alert error" role="alert">{error}</p>}
    {notice && <p className="alert success" role="status">{notice}</p>}
  </section>;
}
