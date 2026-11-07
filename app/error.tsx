'use client';
import { useEffect } from 'react';
import Link from 'next/link';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { useEffect(() => {}, []); return <main className="public-error"><span className="eyebrow">SOMETHING WENT WRONG</span><h1>We could not load this page.</h1><p>Your work has not been confirmed as saved. Try again or return to the main site.</p><div><button className="button primary" onClick={() => reset()}>Try again</button><Link className="button subtle" href="/">Return home</Link></div></main>; }
