'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, Menu, X } from 'lucide-react';

export function LandingNav() {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <header className="cp-nav-wrap">
      <div className="cp-nav">
        <Link href="/" className="cp-brand" onClick={close} aria-label="CoursePulse home">
          <span className="cp-brand-mark"><Activity size={18} strokeWidth={2.2} /></span>
          <span>CoursePulse</span>
        </Link>

        <nav className={open ? 'cp-nav-links is-open' : 'cp-nav-links'} aria-label="Main navigation">
          <a href="#product" onClick={close}>Product</a>
          <a href="#features" onClick={close}>Features</a>
          <a href="#workflow" onClick={close}>How it works</a>
          <a href="#security" onClick={close}>Security</a>
          <div className="cp-mobile-actions">
            <Link href="/login" className="cp-nav-signin" onClick={close}>Sign in</Link>
            <Link href="/signup" className="cp-button cp-button-dark" onClick={close}>Get started <ArrowRight size={16} /></Link>
          </div>
        </nav>

        <div className="cp-nav-actions">
          <Link href="/login" className="cp-nav-signin">Sign in</Link>
          <Link href="/signup" className="cp-button cp-button-dark">Get started <ArrowRight size={16} /></Link>
        </div>

        <button
          className="cp-menu-toggle"
          type="button"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls="coursepulse-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}
