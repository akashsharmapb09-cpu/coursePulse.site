'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_KEY = 'coursepulse-theme';

export function ThemeToggle() {
  const [dark,setDark] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(THEME_KEY); } catch { /* Continue with the system preference. */ }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const enabled = stored === 'dark' || (stored !== 'light' && prefersDark);
    document.documentElement.dataset.theme = enabled ? 'dark' : 'light';
    document.documentElement.style.colorScheme = enabled ? 'dark' : 'light';
    setDark(enabled);
  },[]);

  function toggle() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    document.documentElement.style.colorScheme = next ? 'dark' : 'light';
    try { window.localStorage.setItem(THEME_KEY,next ? 'dark' : 'light'); } catch { /* The selection still applies for this page session. */ }
    setDark(next);
  }

  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={dark} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>;
}
