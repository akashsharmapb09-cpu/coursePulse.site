import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlatformAdminDashboard } from '@/components/platform-admin-dashboard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'CoursePulse Platform Administration', robots: { index: false, follow: false } };

export default async function SuperAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data, error } = await supabase.rpc('platform_is_admin');
  if (error || data !== true) redirect('/dashboard');
  return <PlatformAdminDashboard />;
}
