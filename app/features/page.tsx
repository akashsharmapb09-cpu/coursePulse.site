import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, BellRing, BookOpen, FileBarChart, MessageSquareText, ShieldCheck } from 'lucide-react';
import { PublicPage } from '@/components/public-site';

export const metadata: Metadata = {
  alternates: { canonical: '/features' },
  title: 'Features',
  description: 'Student feedback, assigned-course management, privacy-protected analytics, course comparison and reporting.'
};

const features = [
  {
    icon: MessageSquareText,
    title: 'Eligible student feedback',
    text: 'Students see published courses and open feedback forms for courses in which they are enrolled. Forms support structured questions, categories and submission validation.'
  },
  {
    icon: BookOpen,
    title: 'Teacher course workspace',
    text: 'Invited Teachers manage their assigned courses, create and update feedback forms, organise question categories, set deadlines and review form versions.'
  },
  {
    icon: BarChart3,
    title: 'Privacy-protected analytics',
    text: 'Review filtered course aggregates, average ratings, rating distributions and response trends. Question groups and rating bins below five responses are suppressed.'
  },
  {
    icon: FileBarChart,
    title: 'Compare and export reports',
    text: 'Compare two selected courses and export the same aggregate reporting data as CSV, Excel-compatible XLS, XLSX or PDF. Raw answers and free-text comments are not included in ordinary reports.'
  },
  {
    icon: ShieldCheck,
    title: 'Student-only accounts and role boundaries',
    text: 'Student and Teacher access is checked on the server. Students register with their name, username, password and programme; Teacher access is invitation-provisioned. The server checks role and course permissions for protected requests.'
  },
  {
    icon: BellRing,
    title: 'Feedback reminders',
    text: 'Students can see their pending and completed feedback forms. Reminder options help them keep track of due feedback without changing their course eligibility.'
  }
];

export default function FeaturesPage() {
  return (
    <PublicPage
      eyebrow="Platform features"
      title="A connected course-feedback workflow."
      description="CoursePulse links student submissions to Teacher course management and aggregate reporting, while keeping feedback answers separate from account identity."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
