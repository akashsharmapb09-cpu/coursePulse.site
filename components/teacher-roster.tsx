'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Users } from 'lucide-react';

type Course = { id: string; title: string };
type Student = { student_id: string; student_number: string; full_name: string; course_id: string; course_code: string | null; course_title: string; section: string | null };

export function TeacherRoster({ courses }: { courses: Course[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!courseId) { setStudents([]); return; }
    let active = true;
    setLoading(true);
    setError('');
    fetch('/api/teacher/roster?course_id=' + encodeURIComponent(courseId), { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'The roster could not be loaded.');
        if (active) setStudents(data.students ?? []);
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'The roster could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId]);

  return <section className="space-y-5">
    <div className="section-heading"><div><h3>Assigned class rosters</h3><p>Only students enrolled in courses assigned to your teacher account are listed.</p></div><Users size={24}/></div>
    {!courses.length ? <div className="empty-state"><BookOpen/><h4>No assigned courses</h4><p>Your College Head has not assigned a course to your account yet.</p></div> : <>
      <label className="block max-w-xl text-sm font-semibold">Choose a course
        <select className="mt-2 w-full" value={courseId} onChange={event => setCourseId(event.target.value)}>
          {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </label>
      <div className="rounded-2xl border border-[#e1e9e3] bg-white p-5">
        <div className="mb-4 flex items-center justify-between"><div><h4 className="font-semibold">Students in this class</h4><p className="fine-print">Administrative roster only; no feedback submissions are linked to these names.</p></div><span className="role-chip">{loading ? 'Loading' : students.length + ' students'}</span></div>
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        {loading ? <p className="py-5 text-sm text-[#65776d]">Loading assigned students…</p> : students.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[#e8eee9] text-xs uppercase text-[#708176]"><th className="px-3 py-3">Student</th><th className="px-3 py-3">Roll number</th><th className="px-3 py-3">Section</th></tr></thead><tbody>{students.map(student => <tr key={student.student_id} className="border-b border-[#edf1ed] last:border-0"><td className="px-3 py-3 font-semibold">{student.full_name}</td><td className="px-3 py-3 font-mono">{student.student_number}</td><td className="px-3 py-3">{student.section || 'Not assigned'}</td></tr>)}</tbody></table></div> : <p className="py-5 text-sm text-[#65776d]">No provisioned students are enrolled in this course.</p>}
      </div>
    </>}
  </section>;
}
