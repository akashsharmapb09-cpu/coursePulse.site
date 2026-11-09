'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { BookOpen, Users } from 'lucide-react';

type Course = { id: string; title: string };
type Student = { student_id: string; student_number: string; full_name: string; course_id: string; course_code: string | null; course_title: string; section: string | null };
type BulkResult = { full_name: string; email: string; student_number: string; section: string; status: string; error?: string };
type BulkSummary = { total: number; invited: number; failed: number; section: string; results: BulkResult[] };

export function TeacherRoster({ courses }: { courses: Course[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice,setNotice]=useState('');
  const [workbookFile,setWorkbookFile]=useState<File|null>(null);
  const [workbookBusy,setWorkbookBusy]=useState(false);
  const [bulkSummary,setBulkSummary]=useState<BulkSummary|null>(null);

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

  function chooseWorkbook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;
    setWorkbookFile(file);
    setBulkSummary(null);
    setError('');
    setNotice('');
  }

  async function uploadStudentWorkbook() {
    if (!workbookFile || !courseId) return;
    setWorkbookBusy(true);
    setError('');
    setNotice('');
    setBulkSummary(null);
    const body = new FormData();
    body.set('file', workbookFile);
    body.set('course_id', courseId);
    try {
      const response = await fetch('/api/teacher/roster/import', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'The student workbook could not be imported.');
      setBulkSummary(data as BulkSummary);
      setWorkbookFile(null);
      setNotice(
        data.invited + ' student account invitation(s) successful; ' +
        data.failed + ' failed. Students activate their accounts from the email.'
      );
      const refreshed = await fetch('/api/teacher/roster?course_id=' + encodeURIComponent(courseId), { cache: 'no-store' });
      const roster = await refreshed.json();
      if (refreshed.ok) setStudents(roster.students ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The student workbook could not be imported.');
    } finally {
      setWorkbookBusy(false);
    }
  }

  return <section className="space-y-5">
    <div className="section-heading"><div><h3>Assigned class rosters</h3><p>Only students enrolled in courses assigned to your teacher account are listed.</p></div><Users size={24}/></div>
    {!courses.length ? <div className="empty-state"><BookOpen/><h4>No assigned courses</h4><p>Your College Head has not assigned a course to your account yet.</p></div> : <>
      <label className="block max-w-xl text-sm font-semibold">Choose a course
        <select className="mt-2 w-full" value={courseId} onChange={event => {
          setCourseId(event.target.value);
          setWorkbookFile(null);
          setBulkSummary(null);
        }}>
          {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </label>
      <div className="rounded-2xl border border-[#d9e8de] bg-[#f8fbf8] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h4 className="font-semibold text-[#214b37]">Bulk add students from Excel</h4>
            <p className="mt-1 max-w-3xl text-sm text-[#566a5e]">Fill one workbook with your section’s student details and upload it once. CoursePulse sends account activation invitations to all valid students and enrols them in the selected class.</p>
            <p className="mt-2 text-xs text-[#6b7d72]">Up to 100 students · 4 MB maximum · one section per workbook</p>
          </div>
          <Users size={24} className="text-[#3b7657}"/>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a className="button subtle compact" href={'/api/teacher/roster/template?course_id=' + encodeURIComponent(courseId)}><BookOpen size={14}/> Download Excel template</a>
          <label className="button subtle compact cursor-pointer">
            <input className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={chooseWorkbook}/>
            Choose student workbook
          </label>
          <span className="min-w-0 truncate text-xs text-[#62766a]">{workbookFile ? workbookFile.name : 'No workbook selected'}</span>
          <button className="button primary compact" type="button" onClick={() => void uploadStudentWorkbook()} disabled={workbookBusy || !workbookFile || !courseId}>
            {workbookBusy ? 'Importing students…' : 'Upload & create student accounts'}
          </button>
        </div>
        <p className="mt-3 text-xs text-[#6b7d72]">Use the selected course above. Every row must belong to the same section. Student activation emails are sent automatically; teachers cannot set or view passwords.</p>
        {bulkSummary && <div className="mt-4 rounded-xl border border-[#dbe9df] bg-white p-4" role="status">
          <h5 className="text-sm font-semibold text-[#285b40]">Section {bulkSummary.section} · Import summary</h5>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div><b className="block text-lg tabular-nums">{bulkSummary.total}</b><span className="text-xs text-[#708176]">Students processed</span></div>
            <div><b className="block text-lg tabular-nums">{bulkSummary.invited}</b><span className="text-xs text-[#708176]">Invitations successful</span></div>
            <div><b className="block text-lg tabular-nums">{bulkSummary.failed}</b><span className="text-xs text-[#708176]">Need attention</span></div>
          </div>
          {!!bulkSummary.failed && <div className="mt-3 border-t border-[#edf1ed] pt-3">
            <p className="mb-2 text-xs font-semibold text-[#8a3d30]">Rows needing attention</p>
            {bulkSummary.results.filter(result => result.status === 'FAILED').map(result => <p key={result.email} className="text-xs text-[#8a3d30]">{result.student_number} · {result.email}: {result.error ?? 'Invitation failed.'}</p>)}
          </div>}
        </div>}
      </div>
      {notice && <p role="status" className="rounded-xl bg-[#edf7ef] p-3 text-sm text-[#286640]">{notice}</p>}
      <div className="rounded-2xl border border-[#e1e9e3] bg-white p-5">
        <div className="mb-4 flex items-center justify-between"><div><h4 className="font-semibold">Students in this class</h4><p className="fine-print">Administrative roster only; no feedback submissions are linked to these names.</p></div><span className="role-chip">{loading ? 'Loading' : students.length + ' students'}</span></div>
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        {loading ? <p className="py-5 text-sm text-[#65776d]">Loading assigned students…</p> : students.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[#e8eee9] text-xs uppercase text-[#708176]"><th className="px-3 py-3">Student</th><th className="px-3 py-3">Roll number</th><th className="px-3 py-3">Section</th></tr></thead><tbody>{students.map(student => <tr key={student.student_id} className="border-b border-[#edf1ed] last:border-0"><td className="px-3 py-3 font-semibold">{student.full_name}</td><td className="px-3 py-3 font-mono">{student.student_number}</td><td className="px-3 py-3">{student.section || 'Not assigned'}</td></tr>)}</tbody></table></div> : <p className="py-5 text-sm text-[#65776d]">No provisioned students are enrolled in this course.</p>}
      </div>
    </>}
  </section>;
}
