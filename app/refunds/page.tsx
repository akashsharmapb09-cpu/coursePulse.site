import Link from 'next/link';

export const metadata = {
  title: 'Refund information',
  description: 'Payment and refund availability for CoursePulse.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/refunds' }
};

export default function RefundsPage() {
  return <main className="min-h-screen bg-[#f7faf7] px-6 py-12 text-[#20352a]">
    <article className="mx-auto max-w-3xl rounded-3xl border border-[#e2ebe3] bg-white p-8 sm:p-12">
      <Link href="/" className="text-sm font-bold text-[#477956]">← CoursePulse</Link>
      <p className="mt-8 text-xs font-extrabold tracking-widest text-[#548363]">PAYMENTS</p>
      <h1 className="mt-3 text-3xl font-extrabold">Refund information</h1>
      <p className="mt-5 text-sm leading-7 text-[#718178]">This college-project version of CoursePulse does not sell subscriptions, accept payments or offer paid services. No refundable transaction can currently be made through this application.</p>
      <p className="mt-4 text-sm leading-7 text-[#718178]">If paid services are introduced in a future version, an institution-approved refund policy and verified support details must be published before payments are enabled.</p>
      <div className="mt-10 border-t border-[#edf1ed] pt-6"><Link href="/terms" className="text-sm font-semibold text-[#477956]">Terms of use</Link></div>
    </article>
  </main>;
}
