import type { Metadata } from 'next';
import './globals.css';
import { CookieConsent } from '@/components/cookie-consent';

export const metadata: Metadata = {
  title: 'CoursePulse | Course feedback, made useful',
  description: 'Private, actionable course feedback and aggregate learning analytics.',
  applicationName: 'CoursePulse',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://coursepulse-site.vercel.app'),
  icons: { icon: '/favicon.svg' },
  openGraph: { title: 'CoursePulse | Course feedback, made useful', description: 'A thoughtful workspace to collect course feedback and understand learning experiences.', type: 'website', url: '/' },
  robots: { index: true, follow: true }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning>
    <head>
      <script dangerouslySetInnerHTML={{ __html: "try { if (localStorage.getItem('coursepulse:reduce-motion') === 'true') document.documentElement.dataset.reduceMotion = 'true'; } catch {}" }} />
    </head>
    <body>{children}<CookieConsent/></body>
  </html>;
}
