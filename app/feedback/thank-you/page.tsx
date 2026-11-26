import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
export const metadata:Metadata={title:'Feedback received',robots:{index:false,follow:false}};
export default function FeedbackThankYouPage(){return <main className="grid min-h-screen place-items-center bg-[#f5f8f5] px-5 py-12 text-[#20352a]"><section className="w-full max-w-xl rounded-3xl border border-[#e2ebe3] bg-white p-8 text-center sm:p-12"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#edf5ef] text-[#286640]"><CheckCircle2 size={30}/></span><h1 className="mt-6 text-3xl font-extrabold">Thank you for your feedback.</h1><p className="mt-3 text-sm leading-6 text-[#607267]">Your response has been saved in this browser’s CoursePulse project data.</p><Link href="/dashboard" className="mt-8 inline-flex rounded-xl bg-[#245b3e] px-5 py-3 text-sm font-bold text-white">Return to workspace</Link></section></main>;}
