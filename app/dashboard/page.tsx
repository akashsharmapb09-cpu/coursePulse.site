import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Dashboard } from '@/components/dashboard';
import { AdminMfaGate } from '@/components/admin-mfa-gate';

export const dynamic = 'force-dynamic';
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile, error } = await supabase.from('users').select('id,email,full_name,role,is_active').eq('id', user.id).single();
  if (error || !profile || !profile.is_active) redirect('/login?error=disabled');
  if (profile.role === 'ADMIN') {
    const [{ data: assurance }, { data: factors }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors()
    ]);
    const hasVerifiedFactor = (factors?.totp ?? []).some(factor => factor.status === 'verified');
    if (!hasVerifiedFactor || assurance?.currentLevel !== 'aal2') return <AdminMfaGate />;
  }
  return <Dashboard profile={profile} />;
}
