import Link from 'next/link';

export const metadata = {
  title: 'Contact and support',
  description: 'Current CoursePulse support-contact availability.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/contact' }
};

export default function ContactPage() {
  return <main className="min-h-screen bg-[#f7faf7] px-6 py-12 text-[#20352a]">
    <article className="mx-auto max-w-3xl rounded-3xl border border-[#e2ebe3] bg-white p-8 sm:p-12">
      <Link href="/" className="text-sm font-bold text-[#477956]">← CoursePulse</Link>
      <p className="mt-8 text-xs font-extrabold tracking-widest text-[#548363]">CONTACT & SUPPORT</p>
      <h1 className="mt-3 text-3xl font-extrabold">Support information</h1>
      <p className="mt-5 text-sm leading-7 text-[#718178]">A verified public support email, telephone number or postal address has not been supplied for this project. CoursePulse does not display invented contact details.</p>
      <h2 className="mt-8 text-lg font-extrabold">Getting help</h2>
      <p className="mt-3 text-sm leading-6 text-[#718178]">For account or course access, use your institution's established support channel or contact the project owner through the channel where this college project was provided. Do not share passwords, recovery codes or private feedback in an unverified channel.</p>
      <div className="mt-10 border-t border-[#edf1ed] pt-6"><Link href="/privacy" className="text-sm font-semibold text-[#477956]">Privacy overview</Link></div>
    </article>
  </main>;
}
