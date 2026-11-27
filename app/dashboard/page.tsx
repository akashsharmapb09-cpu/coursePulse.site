import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Dashboard } from '@/components/dashboard';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'CoursePulse Workspace',
  description: 'Authenticated Student and Teacher course feedback workspace.',
  robots: { index: false, follow: false }
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login?next=%2Fdashboard');

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id,email,full_name,role,is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect('/login?reason=account-unavailable');
  }
  if (profile.role !== 'STUDENT' && profile.role !== 'INSTRUCTOR') {
    await supabase.auth.signOut();
    redirect('/login?reason=role-unavailable');
  }

  return <Dashboard profile={{
    id: profile.id,
    email: profile.email ?? user.email ?? null,
    full_name: profile.full_name ?? 'CoursePulse User',
    role: profile.role as 'INSTRUCTOR' | 'STUDENT'
  }} />;
}
