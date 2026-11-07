import Link from 'next/link';
export default function NotFound() { return <main className="public-error"><span className="eyebrow">404 · PAGE NOT FOUND</span><h1>This page is not here.</h1><p>The page may have moved or the address may be incorrect.</p><div><Link className="button primary" href="/">Return home</Link><Link className="button subtle" href="/login">Sign in</Link></div></main>; }
