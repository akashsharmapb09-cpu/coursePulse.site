import type { Metadata } from 'next';
import { StudentCardVerification } from '@/components/student-card-verification';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Student ID verification · CoursePulse',
  robots: { index: false, follow: false },
};

export default function VerifyStudentCardPage() {
  return <StudentCardVerification />;
}
