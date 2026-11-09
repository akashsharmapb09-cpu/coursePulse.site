'use client';

import { useEffect, useState } from 'react';
import { FileSpreadsheet, RefreshCw, Upload, Users } from 'lucide-react';

type RosterStudent = {
  student_id: string; student_number: string; full_name: string; email: string | null;
  mobile: string | null; department_id: string | null; department_name: string | null;
  course_id: string | null; course_code: string | null; course_title: string | null; section: string | null;
};
type TeacherInviteResult = { email: string; role: string; status: string; error?: string };
type WorkbookImportResult = {
  departments_created: number; departments_updated: number; departments_reused: number;
  courses_created: number; courses_updated: number; teachers_invited: number; teachers_failed: number;
  teacher_results: TeacherInviteResult[]; warnings: string[];
};
type Props = { onWorkbookImported?: () => Promise<void> };

export function AdminRosterPanel({ onWorkbookImported }: Props) {
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [workbookFile, setWorkbookFile] = useState<File | null>(null);
  const [workbookBusy, setWorkbookBusy] = useState(false);
  const [workbookResult, setWorkbookResult] = useState<WorkbookImportResult | null>(null);

  async function loadRoster() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/roster', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'The student directory could not be loaded.');
      setStudents(data.students ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The student directory could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadRoster(); }, []);

  async function uploadWorkbook() {
    if (!workbookFile) return;
    setWorkbookBusy(true);
    setError('');
    setNotice('');
    setWorkbookResult(null);
    const body = new FormData();
    body.set('file', workbookFile);
    try {
      const response = await fetch('/api/admin/roster/import', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) {
        const partial = data.partial ? ' Some earlier department/course rows may already have been saved.' : '';
        throw new Error((data.error ?? 'The workbook could not be imported.') + partial);
      }
      setWorkbookResult(data as WorkbookImportResult);
      setWorkbookFile(null);
      setNotice(
        'Excel import complete: ' +
        (data.departments_created + data.departments_updated + data.departments_reused) +
        ' department(s), ' + (data.courses_created + data.courses_updated) +
        ' course(s), ' + data.teachers_invited +
        ' teacher account invitation(s) successful; ' + data.teachers_failed + ' failed.'
      );
      await loadRoster();
      await onWorkbookImported?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The workbook could not be imported.');
    } finally {
      setWorkbookBusy(false);
    }
  }

  return <section className="space-y-5">
    <div className="section-heading">
      <div>
        <h3>College academic setup & directory</h3>
        <p>Use one college workbook to configure departments, courses and teachers. Students are added by teachers through their class-roster Excel upload.</p>
      </div>
      <Users size={24}/>
    </div>
    <div className="rounded-2xl border border-[#d9e8de] bg-[#f8fbf8] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h4 className="font-semibold text-[#214b37]">Complete college setup from one Excel workbook</h4>
          <p className="mt-1 max-w-3xl text-sm text-[#566a5e]">Fill the Departments, Courses and Teachers tabs, then upload once. CoursePulse creates or updates the academic structure, links teachers to their courses and sends account activation emails.</p>
          <p className="mt-2 text-xs text-[#6b7d72]">Up to 200 departments · 500 courses · 100 teachers · 4 MB .xlsx file</p>
        </div>
        <FileSpreadsheet size={25} className="text-[#3b7657}"/>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a className="button subtle compact" href="/api/admin/roster/template"><FileSpreadsheet size={14}/> Download Excel template</a>
        <label className="button subtle compact cursor-pointer">
          <Upload size={14}/> Choose workbook
          <input key={workbookFile?.name ?? 'empty-workbook'} className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => { setWorkbookFile(event.target.files?.[0] ?? null); setWorkbookResult(null); setError(''); setNotice(''); }}/>
        </label>
        <span className="min-w-0 truncate text-xs text-[#62766a]">{workbookFile ? workbookFile.name : 'No workbook selected'}</span>
        <button className="button primary compact" type="button" onClick={() => void uploadWorkbook()} disabled={workbookBusy || !workbookFile}>
          {workbookBusy ? 'Importing workbook…' : 'Import departments, courses & teachers'}
        </button>
        {workbookFile && <button className="button subtle compact" type="button" onClick={() => setWorkbookFile(null)} disabled={workbookBusy}>Remove file</button>}
      </div>
      <p className="mt-3 text-xs text-[#6b7d72]">Teacher passwords are never generated or shown to the HOD. Each teacher receives an email invitation and sets their own password.</p>
      {workbookResult && <div className="mt-4 rounded-xl border border-[#dbe9df] bg-white p-4" role="status">
        <h5 className="text-sm font-semibold text-[#285b40]">Import summary</h5>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div><b className="block text-lg tabular-nums">{workbookResult.departments_created + workbookResult.departments_updated + workbookResult.departments_reused}</b><span className="text-xs text-[#708176]">Departments processed</span></div>
          <div><b className="block text-lg tabular-nums">{workbookResult.courses_created + workbookResult.courses_updated}</b><span className="text-xs text-[#708176]">Courses created / updated</span></div>
          <div><b className="block text-lg tabular-nums">{workbookResult.teachers_invited} / {workbookResult.teachers_invited + workbookResult.teachers_failed}</b><span className="text-xs text-[#708176]">Teacher invitations successful</span></div>
        </div>
        {!!workbookResult.teacher_results.filter(result => result.status === 'FAILED').length && <div className="mt-3 border-t border-[#edf1ed] pt-3">
          <p className="mb-2 text-xs font-semibold text-[#8a3d30]">Teacher rows needing attention</p>
          {workbookResult.teacher_results.filter(result => result.status === 'FAILED').map(result => <p key={result.email} className="text-xs text-[#8a3d30}">{result.email}: {result.error ?? 'Invitation failed.'}</p>)}
        </div>}
        {!!workbookResult.warnings.length && <div className="mt-3 border-t border-[#edf1ed] pt-3">{workbookResult.warnings.map((warning,index) => <p key={index} className="text-xs text-[#8a5a20]">{warning}</p>)}</div>}
      </div>}
    </div>
    {error && <p className="rounded-xl bg-[#fff1ee] p-3 text-sm text-[#9a3f30]" role="alert">{error}</p>}
    {notice && <p className="rounded-xl bg-[#edf7ef] p-3 text-sm text-[#276540]" role="status">{notice}</p>}
    <div className="rounded-2xl border border-[#e1e9e3] bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold">Enrolled student directory</h4>
          <p className="fine-print">Mobile numbers are visible to the Head only; teachers see only their assigned class roster.</p>
        </div>
        <button className="button subtle compact" type="button" onClick={() => void loadRoster()} disabled={loading}><RefreshCw size={14}/> Refresh</button>
      </div>
      {loading ? <p className="text-sm text-[#687b70]">Loading roster…</p> : students.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead><tr className="border-b border-[#e6ede7] text-xs uppercase text-[#728176]"><th className="px-3 py-3">Student</th><th className="px-3 py-3">Roll number</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Course / section</th><th className="px-3 py-3">Mobile</th><th className="px-3 py-3">Account</th></tr></thead>
          <tbody>{students.map((student,index) => <tr key={student.student_id + '-' + (student.course_id ?? index)} className="border-b border-[#edf1ed] last:border-0">
            <td className="px-3 py-3"><b>{student.full_name}</b><small className="block text-[#728176]">{student.email ?? 'No email'}</small></td>
            <td className="px-3 py-3 font-mono">{student.student_number}</td>
            <td className="px-3 py-3">{student.department_name ?? '—'}</td>
            <td className="px-3 py-3">{student.course_title ?? '—'}{student.section ? ' / ' + student.section : ''}</td>
            <td className="px-3 py-3">{student.mobile ?? '—'}</td>
            <td className="px-3 py-3 text-xs text-[#4f7560]">College roster</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="py-4 text-sm text-[#708176]">No student accounts are provisioned yet. Teachers can upload their assigned class rosters from the Class rosters workspace.</p>}
    </div>
  </section>;
}
