import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CoursePulse | Course feedback, made useful',
  description: 'Private, actionable course feedback and aggregate learning analytics.',
  applicationName: 'CoursePulse'
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
