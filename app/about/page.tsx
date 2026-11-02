import Link from 'next/link';

export const metadata = {
  title: 'About CoursePulse',
  description: 'Learn about the CoursePulse college project and its course-feedback workspace.',
  alternates: { canonical: '/about' }
};

export default function AboutPage() {
  return <main className="min-h-screen bg-[#f7faf7] px-6 py-12 text-[#20352a]">
    <article className="mx-auto max-w-3xl rounded-3xl border border-[#e2ebe3] bg-white p-8 sm:p-12">
      <Link href="/" className="text-sm font-bold text-[#477956]">← CoursePulse</Link>
      <p className="mt-8 text-xs font-extrabold tracking-widest text-[#548363]">ABOUT THE PROJECT</p>
      <h1 className="mt-3 text-3xl font-extrabold">A clearer feedback loop for learning.</h1>
      <p className="mt-5 text-sm leading-7 text-[#718178]">CoursePulse is a college project for collecting course feedback and helping students, instructors and administrators understand academic patterns through role-scoped dashboards.</p>
      <h2 className="mt-8 text-lg font-extrabold">How it works</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#718178]">
        <li>Students see eligible courses and submit feedback forms once per eligible form.</li>
        <li>Instructors review course-level aggregate insights for courses they own or are assigned to.</li>
        <li>Administrators manage academic structure and user access through protected workflows.</li>
      </ul>
      <h2 className="mt-8 text-lg font-extrabold">Privacy boundary</h2>
      <p className="mt-3 text-sm leading-6 text-[#718178]">New feedback answers are stored separately from the student eligibility ledger. Reports suppress groups below five responses and exclude free-text answers from standard analytics and exports. This reduces exposure but does not guarantee protection against every statistical inference.</p>
      <p className="mt-4 text-sm leading-6 text-[#718178]">CoursePulse complements institutional processes; it does not replace approved academic, privacy or student-support policies.</p>
      <div className="mt-10 border-t border-[#edf1ed] pt-6"><Link href="/privacy" className="text-sm font-semibold text-[#477956]">Privacy overview</Link><span className="mx-3 text-[#c4cec6]">·</span><Link href="/terms" className="text-sm font-semibold text-[#477956]">Terms of use</Link></div>
    </article>
  </main>;
}
