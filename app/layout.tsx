import type { Metadata } from 'next';
import { DM_Sans, Manrope } from 'next/font/google';
import './globals.css';
import { CookieConsent } from '@/components/cookie-consent';
import { ThemeToggle } from '@/components/theme-toggle';

export const dynamic = 'force-dynamic';

const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-dm-sans' });
const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-manrope' });
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coursepulse-site.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: 'CoursePulse | College course feedback', template: '%s | CoursePulse' },
  description: 'A simple college project for anonymous course feedback and course-level results. No login or role selection required.',
  applicationName: 'CoursePulse',
  icons: { icon: '/icon.svg', shortcut: '/icon.svg' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'CoursePulse',
    title: 'CoursePulse | College course feedback',
    description: 'Share course feedback and review simple course-level results.',
    images: ['/opengraph-image']
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CoursePulse | College course feedback',
    description: 'Share course feedback and review simple course-level results.',
    images: ['/opengraph-image']
  },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={dmSans.variable + ' ' + manrope.variable}>{children}<CookieConsent /><ThemeToggle /></body></html>;
}
