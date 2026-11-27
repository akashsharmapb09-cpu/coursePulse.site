import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, MessageSquareText, ShieldCheck } from 'lucide-react';
import { PublicPage } from '@/components/public-site';

export const metadata: Metadata = {
  alternates: { canonical: '/features' },
  title: 'Student and Teacher Features',
  description: 'Student and Teacher accounts, anonymous course feedback and protected course-level analytics in one focused platform.'
};

const features = [
  {
    icon: MessageSquareText,
    title: 'Anonymous feedback',
    text: 'Students can rate teaching clarity, course pace, learning resources, and their overall course experience without attaching account identity to submitted answers.'
  },
  {
    icon: BarChart3,
    title: 'Easy-to-read results',
    text: 'Course-level averages, response counts, rating distributions and trends turn eligible feedback into privacy-protected reports.'
  },
  {
    icon: ShieldCheck,
    title: 'Student and Teacher accounts',
    text: 'Students create an account with a username, password and programme. Teachers create an account with their college email and password. The two roles have separate workspaces.'
  }
];

export default function FeaturesPage() {
  return (
    <PublicPage
      eyebrow="Platform features"
      title="The essentials for course feedback."
      description="CoursePulse keeps the student journey focused on registration, feedback, reminders and results, without extra college-management steps."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {features.map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-2xl border border-[#e2ebe3] bg-white p-6">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf5ef] text-[#477956]">
              <Icon size={21} />
            </span>
            <h2 className="mt-5 text-lg font-extrabold">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#617467]">{text}</p>
          </article>
        ))}
      </div>
      <p><Link href="/signup" className="inline-link">Create a student account</Link> or <Link href="/dashboard" className="inline-link">open the workspace</Link>.</p>
    </PublicPage>
  );
}
