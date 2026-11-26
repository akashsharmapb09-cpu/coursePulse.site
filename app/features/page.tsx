import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, MessageSquareText, ShieldCheck } from 'lucide-react';
export const metadata:Metadata={alternates:{canonical:'/features'},title:'Features',description:'Anonymous course feedback and simple course-level results for a college project.'};
export default function FeaturesPage(){
 const features=[
  {icon:MessageSquareText,title:'Anonymous feedback',text:'Students can rate teaching clarity, course pace, learning resources, and their overall course experience.'},
  {icon:BarChart3,title:'Easy-to-read results',text:'Course-level averages and response counts turn feedback into a simple summary.'},
  {icon:ShieldCheck,title:'No account setup',text:'The project has no login page, Admin role, or HOD role. Open the workspace and start exploring.'}
 ];
 return <main className="min-h-screen bg-[#f7faf7] px-6 py-12 text-[#20352a]"><section className="mx-auto max-w-4xl"><Link href="/" className="text-sm font-bold text-[#477956]">← CoursePulse</Link><p className="mt-10 text-xs font-extrabold tracking-widest text-[#3f6b4b]">PROJECT FEATURES</p><h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">The essentials for course feedback.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[#526158]">CoursePulse keeps the workflow focused on collecting feedback and reviewing results, without SaaS account management or a hierarchy of user roles.</p><div className="mt-10 grid gap-4 md:grid-cols-3">{features.map(({icon:Icon,title,text})=><article key={title} className="rounded-2xl border border-[#e2ebe3] bg-white p-6"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf5ef] text-[#477956]"><Icon size={21}/></span><h2 className="mt-5 text-lg font-extrabold">{title}</h2><p className="mt-3 text-sm leading-6 text-[#617467]">{text}</p></article>)}</div><Link href="/dashboard" className="mt-9 inline-flex items-center rounded-xl bg-[#245b3e] px-5 py-3 text-sm font-bold text-white">Open workspace</Link></section></main>;
}
