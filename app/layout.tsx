import type { Metadata } from 'next';
import './globals.css';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coursepulse-production.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: 'CoursePulse | Course feedback, made useful', template: '%s | CoursePulse' },
  description: 'Collect course feedback, review protected aggregate insights and improve learning experiences in one role-aware workspace.',
  applicationName: 'CoursePulse',
  icons: { icon: '/icon.svg', shortcut: '/icon.svg' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'CoursePulse',
    title: 'CoursePulse | Course feedback, made useful',
    description: 'A focused workspace for course feedback and aggregate learning analytics.'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CoursePulse | Course feedback, made useful',
    description: 'Course feedback and aggregate learning analytics in one workspace.'
  },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}