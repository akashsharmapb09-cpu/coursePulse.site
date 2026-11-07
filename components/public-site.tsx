import { CookieSettingsLink } from '@/components/cookie-consent';
import Link from 'next/link';
import type { ReactNode } from 'react';

const links = [
  { href: '/features', label: 'Features' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' }
];

export function PublicHeader({ authenticated = false }: { authenticated?: boolean }) {
  return <header className="public-header">
    <Link className="brand" href="/" aria-label="CoursePulse home"><span className="brand-mark">◉</span><span>CoursePulse</span></Link>
    <nav className="public-nav" aria-label="Main navigation">{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
    <div className="public-header-actions"><Link className="public-login" href="/login">Sign in</Link><Link className="button primary" href={authenticated ? '/dashboard' : '/login'}>{authenticated ? 'Open workspace' : 'Get started'}</Link></div>
  </header>;
}

export function PublicFooter() {
  return <footer className="public-footer">
    <div className="public-footer-brand"><Link className="brand" href="/"><span className="brand-mark">◉</span><span>CoursePulse</span></Link><p>Course feedback, made useful.</p></div>
    <div className="public-footer-links"><div><b>Explore</b><Link href="/features">Features</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link></div><div><b>Information</b><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms</Link><Link href="/refund-policy">Refund policy</Link><Link href="/support">Support</Link><CookieSettingsLink/></div></div>
    <p className="public-footer-bottom">© {new Date().getFullYear()} CoursePulse. Designed for thoughtful learning improvement.</p>
  </footer>;
}

export function PublicPage({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="public-shell"><PublicHeader/><main className="public-document"><div className="public-document-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="public-document-content">{children}</div></main><PublicFooter/></div>;
}
