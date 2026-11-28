import Link from 'next/link';
import { PublicFooter, PublicHeader } from '@/components/public-site';
import { ArrowRight, BarChart3, BookOpen, CheckCircle2, MessageSquareText } from 'lucide-react';

export const metadata = {
  title: 'CoursePulse | College course feedback',
  description: 'CoursePulse is a single-college course feedback workspace. Students register with a username; invited Teachers manage assigned courses and review privacy-protected aggregate analytics.',
  alternates: { canonical: '/' }
};

export default function Home() {
  return <main className="min-h-screen overflow-hidden bg-[#f6f3eb] text-[#20352a]">
    <PublicHeader />
    <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-28 lg:pt-16">
      <div>
        <h1 className="mt-7 max-w-2xl text-5xl font-extrabold leading-[1.08] tracking-[-.055em] sm:text-6xl">Better courses begin with <span className="text-[#43805a]">honest feedback.</span></h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[#526158]">Students create accounts with a username and programme, then submit feedback for courses in which they are enrolled. Invited Teachers manage assigned courses and review filtered, aggregate feedback analytics. New feedback answers are stored separately from student sign-in details; reports suppress groups with fewer than five responses.</p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-[#245b3e] px-6 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#1a442e] transition-colors">
            Create student account <ArrowRight size={17}/>
          </Link>
          <Link href="/login" className="rounded-xl border border-[#d8e4da] bg-white px-6 py-3.5 text-sm font-semibold text-[#456052] hover:bg-[#f3f7f4] transition-colors">
            Student / Teacher sign in
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-xs font-semibold text-[#526158]"><span className="inline-flex items-center gap-2"><CheckCircle2 size={15}/>Student accounts</span><span className="inline-flex items-center gap-2"><MessageSquareText size={15}/>Separate feedback answers</span><span className="inline-flex items-center gap-2"><BarChart3 size={15}/>Privacy-protected analytics</span></div>
      </div>
      <div className="relative mx-auto w-full max-w-xl"><div className="absolute -inset-8 rounded-[3rem] bg-[#e4f0e6] blur-2xl"/><div className="relative rounded-[2rem] border border-[#e0e9e1] bg-white p-6 shadow-[0_30px_90px_-35px_rgba(31,76,49,.25)] sm:p-8">
        <div className="flex items-center justify-between border-b border-[#edf1ed] pb-5"><div><p className="text-xs font-bold uppercase tracking-widest text-[#526158]">Student workspace</p><h2 className="mt-1 text-xl font-extrabold">Your course profile</h2></div><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf5ef] text-[#477956]"><BookOpen size={21}/></span></div>
        <div className="mt-6 space-y-4"><div className="rounded-2xl bg-[#f7faf7] p-4"><p className="text-xs font-bold text-[#477956]">EXAMPLE PROGRAMMES</p><div aria-label="Example programmes shown in this static preview" className="pointer-events-none mt-3 grid grid-cols-2 select-none gap-2 text-sm font-bold"><span className="rounded-xl bg-white px-3 py-2">B.Tech</span><span className="rounded-xl bg-white px-3 py-2">M.Tech</span><span className="rounded-xl bg-white px-3 py-2">BBA</span><span className="rounded-xl bg-white px-3 py-2">B.Com</span></div><p className="mt-3 text-xs text-[#526158]">Other programmes are available in the registration form.</p></div>
          <div aria-label="Example workspace features" className="pointer-events-none grid grid-cols-2 select-none gap-3"><div className="rounded-2xl border border-[#edf1ed] p-4"><MessageSquareText size={19} className="text-[#477956]"/><p className="mt-3 text-sm font-extrabold">Share feedback</p><p className="mt-1 text-xs leading-5 text-[#526158]">Submit feedback for eligible courses.</p></div><div className="rounded-2xl border border-[#edf1ed] p-4"><BarChart3 size={19} className="text-[#477956]"/><p className="mt-3 text-sm font-extrabold">View results</p><p className="mt-1 text-xs leading-5 text-[#526158]">Review reportable course summaries.</p></div></div></div>
        <p className="mt-5 text-center text-xs text-[#526158]">Your programme is saved with your student account.</p>
      </div></div>
    </section>
    <section id="how-it-works" className="border-y border-[#e6eee7] bg-white py-20"><div className="mx-auto max-w-7xl px-6 lg:px-10"><div className="max-w-2xl"><span className="text-xs font-extrabold tracking-[.18em] text-[#3f6b4b]">HOW IT WORKS</span><h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">A simple student journey.</h2><p className="mt-4 leading-7 text-[#526158]">Choose the programme you study, create your account, and share feedback on eligible courses.</p></div>
      <div className="mt-12 grid gap-8 md:grid-cols-3"><article className="border-t-2 border-[#75a982] pt-5"><span className="text-xs font-extrabold text-[#477956]">01</span><h3 className="mt-4 text-lg font-extrabold">Create your account</h3><p className="mt-2 text-sm leading-6 text-[#64756a]">Enter your name, choose a username and select B.Tech, M.Tech, BBA, B.Com or another programme.</p></article><article className="border-t-2 border-[#75a982] pt-5"><span className="text-xs font-extrabold text-[#477956]">02</span><h3 className="mt-4 text-lg font-extrabold">Share feedback</h3><p className="mt-2 text-sm leading-6 text-[#64756a]">Sign in and submit answers for an open feedback form linked to an enrolled, published course.</p></article><article className="border-t-2 border-[#75a982] pt-5"><span className="text-xs font-extrabold text-[#477956]">03</span><h3 className="mt-4 text-lg font-extrabold">Review results</h3><p className="mt-2 text-sm leading-6 text-[#64756a]">Teachers review aggregate reports and exports. Groups below five responses are suppressed to protect small cohorts.</p></article></div>
    </div></section>
    <PublicFooter />
  </main>;
}
