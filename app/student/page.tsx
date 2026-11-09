import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

// Keep older student bookmarks working while centralizing authentication
// and role-specific access in the existing dashboard entry point.
export const metadata: Metadata = {
  title: 'Student workspace | CoursePulse',
  robots: { index: false, follow: false }
};

export const dynamic = 'force-dynamic';

export default function StudentEntryPage() {
  redirect('/dashboard');
}
