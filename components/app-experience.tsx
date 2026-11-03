'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const INTERACTIVE = [
  '.app-shell .metric-card',
  '.app-shell .course-card',
  '.app-shell .analytics-card',
  '.app-shell .rating-chart-card',
  '.app-shell .trend-chart-card',
  '.app-shell .comparison-card',
  '.app-shell .search-result',
  '.app-shell .button.primary',
  '.auth-card .button.primary',
  '.cp-button'
].join(',');

export function AppExperience({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

    function resetMotion(element: HTMLElement) {
      element.classList.remove('cp-tilt-card', 'cp-magnetic-button');
      element.style.removeProperty('--cp-tilt-x');
      element.style.removeProperty('--cp-tilt-y');
      element.style.removeProperty('--cp-magnet-x');
      element.style.removeProperty('--cp-magnet-y');
    }

    function handlePointerMove(event: PointerEvent) {
      if (reducedMotion.matches || !finePointer.matches || event.pointerType === 'touch') return;
      if (!(event.target instanceof Element)) return;
      const element = event.target.closest<HTMLElement>(INTERACTIVE);
      if (!element) return;

      const bounds = element.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
      const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;

      if (element.matches('button, a, .cp-button')) {
        element.classList.add('cp-magnetic-button');
        element.style.setProperty('--cp-magnet-x', ((horizontal * 5).toFixed(2)) + 'px');
        element.style.setProperty('--cp-magnet-y', ((vertical * 4).toFixed(2)) + 'px');
      } else {
        element.classList.add('cp-tilt-card');
        element.style.setProperty('--cp-tilt-x', ((-vertical * 4.5).toFixed(2)) + 'deg');
        element.style.setProperty('--cp-tilt-y', ((horizontal * 5.5).toFixed(2)) + 'deg');
      }
    }

    function handlePointerOut(event: PointerEvent) {
      if (!(event.target instanceof Element)) return;
      const element = event.target.closest<HTMLElement>(INTERACTIVE);
      if (!element) return;
      if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
      resetMotion(element);
    }

    function handleTabClick(event: MouseEvent) {
      if (!(event.target instanceof Element) || !event.target.closest('.side-nav button')) return;
      const panel = document.querySelector<HTMLElement>('.content-area');
      if (!panel || reducedMotion.matches) return;
      panel.classList.remove('cp-tab-transition');
      void panel.offsetWidth;
      panel.classList.add('cp-tab-transition');
      panel.addEventListener('animationend', (animationEvent) => {
        if (animationEvent.target === panel) panel.classList.remove('cp-tab-transition');
      }, { once: true });
    }

    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerout', handlePointerOut, { passive: true });
    document.addEventListener('click', handleTabClick);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerout', handlePointerOut);
      document.removeEventListener('click', handleTabClick);
      document.querySelectorAll<HTMLElement>('.cp-tilt-card,.cp-magnetic-button').forEach(resetMotion);
    };
  }, []);

  return <div className="app-route-stage" data-route={pathname ?? '/'}>{children}</div>;
}
