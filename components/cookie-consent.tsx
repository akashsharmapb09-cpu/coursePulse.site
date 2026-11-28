'use client';

import { useEffect, useState } from 'react';
import { Cookie, Settings2, ShieldCheck, X } from 'lucide-react';
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

type ConsentRecord = { version:1; essential:true; analytics:boolean; updatedAt:string };
const STORAGE_KEY = 'coursepulse:cookie-consent:v1';
const PUBLIC_ANALYTICS_PATHS = new Set(['/', '/features', '/about', '/privacy', '/cookies', '/terms', '/contact', '/support', '/refund-policy']);

function isPublicTelemetryAllowed(url:string) {
  if (!readConsent()?.analytics) return false;
  try { return PUBLIC_ANALYTICS_PATHS.has(new URL(url,window.location.origin).pathname); } catch { return false; }
}
function filterPublicTelemetry(event:BeforeSendEvent) { return isPublicTelemetryAllowed(event.url) ? event : null; }
function filterPublicPerformance(event:{type:'vital';url:string;route?:string}) { return isPublicTelemetryAllowed(event.url) ? event : null; }

function readConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (parsed.version !== 1 || parsed.essential !== true || typeof parsed.analytics !== 'boolean' || typeof parsed.updatedAt !== 'string') return null;
    return parsed as ConsentRecord;
  } catch { return null; }
}

export function CookieConsent() {
  const [consent,setConsent] = useState<ConsentRecord|null>(null);
  const [visible,setVisible] = useState(false);
  const [preferencesOpen,setPreferencesOpen] = useState(false);
  const [analyticsChoice,setAnalyticsChoice] = useState(false);

  useEffect(() => {
    const openSettings = () => { setAnalyticsChoice(readConsent()?.analytics ?? false); setPreferencesOpen(true); };
    window.addEventListener('coursepulse:open-cookie-settings',openSettings);
    return () => window.removeEventListener('coursepulse:open-cookie-settings',openSettings);
  },[]);

  useEffect(() => {
    document.body.classList.toggle('cookie-consent-visible', visible);
    return () => document.body.classList.remove('cookie-consent-visible');
  }, [visible]);

  useEffect(() => {
    const saved = readConsent();
    setConsent(saved);
    setAnalyticsChoice(saved?.analytics ?? false);
    setVisible(!saved);
  },[]);

  function save(analytics:boolean) {
    const record:ConsentRecord = {version:1,essential:true,analytics,updatedAt:new Date().toISOString()};
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(record)); } catch { /* The choice remains in this component for this session. */ }
    setConsent(record);
    setVisible(false);
    setPreferencesOpen(false);
    window.dispatchEvent(new CustomEvent('coursepulse:consent-updated'));
  }

  return <>
    {consent?.analytics && <><Analytics beforeSend={filterPublicTelemetry}/><SpeedInsights beforeSend={filterPublicPerformance}/></>}
    {visible && <section className="cookie-banner" aria-label="Cookie preferences" aria-live="polite">
      <div className="cookie-banner-copy"><span className="cookie-banner-icon"><Cookie size={18}/></span><div><b>Privacy comes first</b><p>CoursePulse stores your optional-analytics preference in this browser and uses essential first-party cookies to maintain sign-in sessions. Current course and feedback records are processed by the application and stored server-side in the connected Supabase database. Optional page-view analytics and performance measurements use Vercel services only after you opt in and only for configured public pages.</p></div></div>
      <div className="cookie-banner-actions"><button className="button subtle compact" onClick={()=>save(false)}>Reject optional</button><button className="button subtle compact" onClick={()=>{setPreferencesOpen(true);setAnalyticsChoice(consent?.analytics??false);}}>Preferences</button><button className="button primary compact" onClick={()=>save(true)}>Allow optional</button></div>
    </section>}
    {!visible && <button className="cookie-settings-trigger" type="button" onClick={()=>{setAnalyticsChoice(consent?.analytics??false);setPreferencesOpen(true);}}><Settings2 size={15}/> Cookie settings</button>}
    {preferencesOpen && <div className="cookie-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setPreferencesOpen(false);}}>
      <section className="cookie-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-dialog-title">
        <div className="cookie-dialog-heading"><span className="cookie-banner-icon"><ShieldCheck size={19}/></span><button className="icon-button" type="button" onClick={()=>setPreferencesOpen(false)} aria-label="Close cookie preferences"><X size={17}/></button></div>
        <h2 id="cookie-dialog-title">Cookie preferences</h2>
        <p>Essential session cookies maintain your Student or Teacher sign-in. Browser storage remembers only your optional-analytics choice. Course and feedback data in the authenticated workspace are stored server-side. Optional public-page views and Core Web Vitals use Vercel services only after you opt in.</p>
        <div className="cookie-preference-row"><span><b>Essential session cookies</b><small>Maintain your authenticated Student or Teacher session.</small></span><label className="cookie-toggle"><input type="checkbox" checked disabled/><span/></label><em>Always on</em></div>
        <div className="cookie-preference-row"><span><b>Optional analytics and performance</b><small>Public-page views and Core Web Vitals use Vercel analytics services. The feedback workspace and authentication routes are excluded.</small></span><label className="cookie-toggle"><input type="checkbox" checked={analyticsChoice} onChange={event=>setAnalyticsChoice(event.target.checked)}/><span/></label></div>
        <div className="cookie-dialog-actions"><button className="button subtle" onClick={()=>save(false)}>Reject optional</button><button className="button primary" onClick={()=>save(analyticsChoice)}>Save preferences</button></div>
      </section>
    </div>}
  </>;
}

export function CookieSettingsLink() {
  return <button className="cookie-footer-link" type="button" onClick={() => window.dispatchEvent(new CustomEvent('coursepulse:open-cookie-settings'))}>Cookie settings</button>;
}
