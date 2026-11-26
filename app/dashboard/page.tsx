import type { Metadata } from 'next';
import { PublicWorkspace } from '@/components/public-workspace';

export const metadata: Metadata = {
  title: 'Workspace',
  description: 'Submit anonymous course feedback and review project results.',
  robots: { index: false, follow: false }
};

export default function DashboardPage() {
  return <PublicWorkspace />;
}
