'use client';

import { useEffect } from 'react';

export function ScrollMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!targets.length) return;

    root.classList.add('has-scroll-motion');

    const revealAll = () => targets.forEach((target) => target.classList.add('is-visible'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !('IntersectionObserver' in window)) {
      revealAll();
      return () => root.classList.remove('has-scroll-motion');
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const target = entry.target as HTMLElement;
        target.classList.add('is-visible');
        observer.unobserve(target);
      });
    }, {
      threshold: 0.14,
      rootMargin: '0px 0px -48px 0px'
    });

    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      root.classList.remove('has-scroll-motion');
    };
  }, []);

  return null;
}
