import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Dashboard } from '@/components/dashboard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Workspace | CoursePulse', robots: { index: false, follow: false } };
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile, error } = await supabase.from('users').select('id,email,full_name,role').eq('id', user.id).single();
  if (error || !profile) redirect('/login');

  const candidatePath = user.user_metadata?.avatar_path;
  const avatarPattern = new RegExp('^' + user.id + '/avatar-[0-9a-f-]{36}\\.(jpg|png|webp)$', 'i');
  const avatarPath = typeof candidatePath === 'string' && avatarPattern.test(candidatePath) ? candidatePath : null;
  let avatarUrl: string | null = null;
  if (avatarPath) {
    const { data, error: avatarError } = await supabase.storage.from('avatars').createSignedUrl(avatarPath, 3600);
    if (!avatarError) avatarUrl = data.signedUrl;
  }

  return <Dashboard profile={{ ...profile, avatar_path: avatarPath, avatar_url: avatarUrl }} />;
}
