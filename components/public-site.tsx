import { CookieSettingsLink } from '@/components/cookie-consent';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';

const links = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/contact', label: 'Contact' }
];

function BrandMark() {
  return <span className="brand-mark"><Activity size={18} strokeWidth={2.2} aria-hidden="true" /></span>;
}

export function PublicHeader() {
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="public-header">
      <Link style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} className="brand" href="/" aria-label="CoursePulse home">
        <BrandMark /><span>CoursePulse</span>
      </Link>
      <nav className="public-nav" aria-label="Main navigation">
        {links.map(link => <Link style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} key={link.href} href={link.href}>{link.label}</Link>)}
      </nav>
      <div className="public-header-actions">
        <Link style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} className="public-login" href="/login">Student sign in</Link>
        <Link style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} className="button primary" href="/signup">Create account</Link>
        <Link style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} className="button subtle" href="/dashboard">Open workspace</Link>
      </div>
    </header>
  </>;
}

export function PublicFooter() {
  return <footer className="public-footer">
    <div className="public-footer-brand">
      <Link style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} className="brand" href="/"><BrandMark /><span>CoursePulse</span></Link>
      <p>Course feedback, made useful.</p>
    </div>
    <div className="public-footer-links">
      <div><b>Explore</b><Link href="/features">Features</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link></div>
      <div><b>Student accounts</b><Link href="/signup">Create account</Link><Link href="/login">Student sign in</Link></div>
      <div><b>Information</b><Link href="/privacy">Privacy Policy</Link><Link href="/cookies">Cookie Policy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link><CookieSettingsLink /></div>
    </div>
    <p className="public-footer-bottom">© {new Date().getFullYear()} CoursePulse. College course feedback project.</p>
  </footer>;
}

export function PublicPage({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="public-shell">
    <PublicHeader />
    <main id="main-content" className="public-document">
      <div className="public-document-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      <div className="public-document-content">{children}</div>
    </main>
    <PublicFooter />
  </div>;
}
