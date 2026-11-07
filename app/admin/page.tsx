import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminConsole } from '@/components/admin-console';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin console | CoursePulse', robots: { index: false, follow: false } };
export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('users').select('id,role,full_name').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'ADMIN') redirect('/dashboard');
  return <AdminConsole fullName={profile.full_name ?? 'Administrator'} userId={user.id} />;
}
