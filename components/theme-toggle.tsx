'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_KEY = 'coursepulse-theme';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const workspace = document.querySelector<HTMLElement>('.app-shell');
    if (!workspace) return;

    let stored: string | null = null;
    try { stored = window.localStorage.getItem(THEME_KEY); } catch { /* Keep the dashboard in light mode. */ }
    const enabled = stored === 'dark';
    workspace.dataset.theme = enabled ? 'dark' : 'light';
    workspace.style.colorScheme = enabled ? 'dark' : 'light';
    setDark(enabled);
  }, []);

  function toggle() {
    const workspace = document.querySelector<HTMLElement>('.app-shell');
    if (!workspace) return;

    const next = !dark;
    workspace.dataset.theme = next ? 'dark' : 'light';
    workspace.style.colorScheme = next ? 'dark' : 'light';
    try { window.localStorage.setItem(THEME_KEY, next ? 'dark' : 'light'); } catch { /* The selection still applies for this session. */ }
    setDark(next);
  }

  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={dark ? 'Switch dashboard to light mode' : 'Switch dashboard to dark mode'} aria-pressed={dark} title={dark ? 'Switch dashboard to light mode' : 'Switch dashboard to dark mode'}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button>;
}
