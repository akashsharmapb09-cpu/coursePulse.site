import { CookieSettingsLink } from '@/components/cookie-consent';
import { StudentAccountControl } from '@/components/student-account-control';
import Link from 'next/link';
import type { ReactNode } from 'react';

const links = [
  { href: '/features', label: 'Features' },
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/contact', label: 'Contact' }
];

export function PublicHeader() {
  return <header className="public-header">
    <Link className="brand !min-h-11 inline-flex items-center" href="/" aria-label="CoursePulse home"><span className="brand-mark">◉</span><span>CoursePulse</span></Link>
    <nav className="public-nav" aria-label="Main navigation">{links.map(link => <Link className="!min-h-11 inline-flex items-center px-2" key={link.href} href={link.href}>{link.label}</Link>)}</nav>
    <div className="public-header-actions flex flex-wrap items-center gap-2"><StudentAccountControl/><Link className="button primary" href="/dashboard">Open workspace</Link></div>
  </header>;
}

export function PublicFooter() {
  return <footer className="public-footer">
    <div className="public-footer-brand"><Link className="brand" href="/"><span className="brand-mark">◉</span><span>CoursePulse</span></Link><p>Course feedback, made useful.</p></div>
    <div className="public-footer-links">
      <div><b>Explore</b><Link href="/features">Features</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link></div>
      <div><b>Student accounts</b><Link href="/signup">Create account</Link><Link href="/login">Student sign in</Link></div>
      <div><b>Information</b><Link href="/privacy">Privacy Policy</Link><Link href="/cookies">Cookie Policy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link><CookieSettingsLink/></div>
    </div>
    <p className="public-footer-bottom">© {new Date().getFullYear()} CoursePulse. College course feedback project.</p>
  </footer>;
}

export function PublicPage({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="public-shell"><PublicHeader/><main className="public-document"><div className="public-document-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="public-document-content">{children}</div></main><PublicFooter/></div>;
}
