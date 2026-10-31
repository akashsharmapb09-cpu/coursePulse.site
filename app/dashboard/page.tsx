import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Dashboard } from '@/components/dashboard';

export const dynamic = 'force-dynamic';
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile, error } = await supabase.from('users').select('id,email,full_name,role').eq('id', user.id).single();
  if (error || !profile) redirect('/login');
  return <Dashboard profile={profile} />;
}
