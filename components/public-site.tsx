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

export function BrandLogo({ light = false }: { light?: boolean }) {
  return (
    <span className={`brand ${light ? 'brand-light' : ''}`}>
      <span className="brand-mark">
        <Activity size={18} />
      </span>
      <span>CoursePulse</span>
    </span>
  );
}

export function PublicHeader() {
  return <header className="public-header">
    <Link style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} href="/" aria-label="CoursePulse home" className="shrink-0">
      <BrandLogo />
    </Link>
    <nav className="public-nav" aria-label="Main navigation">{links.map(link => <Link style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} className="px-2 whitespace-nowrap" key={link.href} href={link.href}>{link.label}</Link>)}</nav>
    <div className="public-header-actions flex items-center gap-2 sm:gap-3 shrink-0">
      <Link style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} className="text-xs sm:text-sm font-semibold text-[#456052] whitespace-nowrap" href="/login">
        <span className="hidden sm:inline">Student / Teacher sign in</span>
        <span className="sm:hidden">Sign in</span>
      </Link>
      <Link style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} className="button primary text-xs sm:text-sm whitespace-nowrap" href="/signup">
        <span className="hidden sm:inline">Create account</span>
        <span className="sm:hidden">Sign up</span>
      </Link>
    </div>
  </header>;
}

export function PublicFooter() {
  return <footer className="public-footer">
    <div className="public-footer-brand">
      <Link style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} href="/" aria-label="CoursePulse home">
        <BrandLogo />
      </Link>
      <p>Course feedback, made useful.</p>
    </div>
    <div className="public-footer-links">
      <div><b>Explore</b><Link href="/features">Features</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link></div>
      <div><b>Account access</b><Link href="/signup">Create account</Link><Link href="/login">Student / Teacher sign in</Link></div>
      <div><b>Information</b><Link href="/privacy">Privacy Policy</Link><Link href="/cookies">Cookie Policy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link><CookieSettingsLink/></div>
    </div>
    <p className="public-footer-bottom">© {new Date().getFullYear()} CoursePulse. Course feedback and learning insights.</p>
  </footer>;
}

export function PublicPage({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="public-shell"><PublicHeader/><main className="public-document"><div className="public-document-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="public-document-content">{children}</div></main><PublicFooter/></div>;
}
