import Link from 'next/link';
export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-[#f7faf7] px-6 text-center text-[#20352a]"><div><p className="text-sm font-bold tracking-widest text-[#548363]">404 · PAGE NOT FOUND</p><h1 className="mt-4 text-4xl font-extrabold">This page is out of the loop.</h1><p className="mt-4 text-sm text-[#718178]">The page may have moved or the link may be incorrect.</p><Link href="/" className="mt-7 inline-flex rounded-xl bg-[#245b3e] px-5 py-3 text-sm font-bold text-white">Back to CoursePulse</Link></div></main>;
}