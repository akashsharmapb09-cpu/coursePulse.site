'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, MailPlus, RefreshCw, Upload, Users } from 'lucide-react';

type Course = { id: string; title: string; course_code?: string | null; status?: string };
type Department = { id: string; name: string; code: string };
type RosterStudent = {
  student_id: string; student_number: string; full_name: string; email: string | null;
  mobile: string | null; department_id: string | null; department_name: string | null;
  course_id: string | null; course_code: string | null; course_title: string | null; section: string | null;
};
type InviteDraft = {
  email: string; full_name: string; role: 'STUDENT' | 'INSTRUCTOR';
  department_id: string | null; course_ids: string[]; student_number?: string;
  section?: string; mobile?: string;
};
type InviteResult = { email: string; role: string; status: string; error?: string };
type Props = { courses: Course[]; departments: Department[] };

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"' && quoted && source[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell.trim()); cell = '';
      if (row.some(value => value.length)) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(value => value.length)) rows.push(row);
  return rows;
}

export function AdminRosterPanel({ courses, departments }: Props) {
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<'STUDENT' | 'INSTRUCTOR'>('STUDENT');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [section, setSection] = useState('');
  const [mobile, setMobile] = useState('');
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [queue, setQueue] = useState<InviteDraft[]>([]);
  const [results, setResults] = useState<InviteResult[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const activeCourses = useMemo(() => courses.filter(course => course.status !== 'ARCHIVED'), [courses]);

  async function loadRoster() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/roster', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'The student roster could not be loaded.');
      setStudents(data.students ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The student roster could not be loaded.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void loadRoster(); }, []);

  function resetDraft() {
    setName(''); setEmail(''); setStudentNumber(''); setSection('');
    setMobile(''); setCourseIds([]);
  }

  function addDraft() {
    setError(''); setNotice('');
    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter the person’s full name and a valid email address.'); return;
    }
    if (!courseIds.length) { setError('Assign at least one course to this account.'); return; }
    if (role === 'STUDENT' && !studentNumber.trim()) { setError('College roll number is required for students.'); return; }
    if (queue.some(item => item.email.toLowerCase() === email.trim().toLowerCase())) {
      setError('This email is already in the invitation queue.'); return;
    }
    setQueue(current => [...current, {
      email: email.trim().toLowerCase(), full_name: name.trim(), role,
      department_id: departmentId || null, course_ids: courseIds,
      student_number: role === 'STUDENT' ? studentNumber.trim() : undefined,
      section: section.trim() || undefined, mobile: role === 'STUDENT' ? mobile.trim() || undefined : undefined
    }]);
    resetDraft();
    setNotice('Added to the invitation queue. Send the queue when it is ready.');
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setNotice('');
    if (file.size > 1024 * 1024) { setError('CSV must be smaller than 1 MB.'); return; }
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error('CSV must include a header row and at least one person.');
      const headers = rows[0].map(value => value.toLowerCase().replaceAll(' ', '_'));
      const get = (values: string[], key: string) => values[headers.indexOf(key)]?.trim() ?? '';
      const prepared: InviteDraft[] = [];
      const problems: string[] = [];
      rows.slice(1).forEach((values, index) => {
        const rowRole = get(values, 'role').toUpperCase();
        const normalizedRole = rowRole === 'TEACHER' ? 'INSTRUCTOR' : rowRole;
        if (normalizedRole !== 'STUDENT' && normalizedRole !== 'INSTRUCTOR') {
          problems.push('Row ' + (index + 2) + ': role must be STUDENT or INSTRUCTOR.'); return;
        }
        const rawCodes = get(values, 'course_codes') || get(values, 'courses');
        const idsFromCodes = rawCodes.split(';').map(code => code.trim()).filter(Boolean).map(code =>
          activeCourses.find(course => (course.course_code ?? '').toLowerCase() === code.toLowerCase())?.id
        );
        const idsFromIds = get(values, 'course_ids').split(';').map(id => id.trim()).filter(Boolean);
        const selectedIds = [...new Set(idsFromCodes.length ? idsFromCodes : idsFromIds)];
        if (selectedIds.some(id => !id) || !selectedIds.length) {
          problems.push('Row ' + (index + 2) + ': use valid course_codes separated by semicolons.'); return;
        }
        const departmentCode = get(values, 'department_code');
        const foundDepartment = departmentCode
          ? departments.find(department => department.code.toLowerCase() === departmentCode.toLowerCase()) : undefined;
        if (departmentCode && !foundDepartment) {
          problems.push('Row ' + (index + 2) + ': department_code was not found.'); return;
        }
        const item: InviteDraft = {
          email: get(values, 'email').toLowerCase(),
          full_name: get(values, 'full_name'),
          role: normalizedRole,
          department_id: foundDepartment?.id ?? null,
          course_ids: selectedIds as string[],
          student_number: get(values, 'student_number') || undefined,
          section: get(values, 'section') || undefined,
          mobile: get(values, 'mobile') || undefined
        };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email) || item.full_name.length < 2 ||
          (item.role === 'STUDENT' && !item.student_number)) {
          problems.push('Row ' + (index + 2) + ': check email, full_name and student_number.'); return;
        }
        if (queue.some(existing => existing.email === item.email) || prepared.some(existing => existing.email === item.email)) {
          problems.push('Row ' + (index + 2) + ': duplicate email.'); return;
        }
        prepared.push(item);
      });
      if (problems.length) setError(problems.slice(0, 5).join(' ') + (problems.length > 5 ? ' More rows also need attention.' : ''));
      if (prepared.length) {
        setQueue(current => [...current, ...prepared].slice(0, 100));
        setNotice('Imported ' + prepared.length + ' invitation(s) from CSV.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The CSV could not be imported.');
    }
  }

  async function sendInvitations() {
    if (!queue.length) return;
    setSaving(true); setError(''); setNotice(''); setResults([]);
    try {
      const response = await fetch('/api/admin/roster/invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitations: queue })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Invitations could not be sent.');
      setResults(data.results ?? []);
      setQueue([]);
      setNotice(data.invited + ' invitation(s) sent; ' + data.failed + ' failed.');
      await loadRoster();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invitations could not be sent.');
    } finally { setSaving(false); }
  }

  function downloadTemplate() {
    const csv = 'email,full_name,role,student_number,department_code,course_codes,section,mobile\nstudent@example.edu,Student Name,STUDENT,ROLL-001,CSE,CSE101;CSE102,A,+919876543210\nteacher@example.edu,Teacher Name,INSTRUCTOR,,CSE,CSE101,,';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'coursepulse-roster-template.csv'; anchor.click();
    URL.revokeObjectURL(url);
  }

  return <section className="space-y-5">
    <div className="section-heading"><div><h3>College directory & account invitations</h3><p>Add students and teachers to your college. They receive a secure email invitation to activate their own account.</p></div><Users size={24}/></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]">
      <div className="rounded-2xl border border-[#e1e9e3] bg-white p-5">
        <h4 className="mb-4 font-semibold">Create invitation</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Role<select className="mt-1 w-full" value={role} onChange={event => setRole(event.target.value as 'STUDENT'|'INSTRUCTOR')}><option value="STUDENT">Student</option><option value="INSTRUCTOR">Teacher</option></select></label>
          <label className="text-sm font-medium">Department<select className="mt-1 w-full" value={departmentId} onChange={event => setDepartmentId(event.target.value)}><option value="">No department assigned</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name} ({department.code})</option>)}</select></label>
          <label className="text-sm font-medium">Full name<input className="mt-1 w-full" value={name} onChange={event => setName(event.target.value)} maxLength={120} placeholder="Full name"/></label>
          <label className="text-sm font-medium">Email<input className="mt-1 w-full" type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} placeholder="name@college.edu"/></label>
          {role === 'STUDENT' && <>
            <label className="text-sm font-medium">College roll number<input className="mt-1 w-full" value={studentNumber} onChange={event => setStudentNumber(event.target.value)} maxLength={40} placeholder="CSE-2026-001"/></label>
            <label className="text-sm font-medium">Mobile number (private)<input className="mt-1 w-full" value={mobile} onChange={event => setMobile(event.target.value)} maxLength={24} placeholder="+91…"/></label>
            <label className="text-sm font-medium sm:col-span-2">Section<input className="mt-1 w-full" value={section} onChange={event => setSection(event.target.value)} maxLength={30} placeholder="A"/></label>
          </>}
        </div>
        <div className="mt-4"><p className="mb-2 text-sm font-semibold">Assign course(s)</p><div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-[#e7eee8] p-3 sm:grid-cols-2">{activeCourses.map(course => <label key={course.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={courseIds.includes(course.id)} onChange={event => setCourseIds(current => event.target.checked ? [...current, course.id] : current.filter(id => id !== course.id))}/><span>{course.course_code ? course.course_code + ' · ' : ''}{course.title}</span></label>)}{!activeCourses.length && <p className="text-sm text-[#6b7d72]">Create courses before inviting students or teachers.</p>}</div></div>
        <div className="mt-4 flex flex-wrap justify-between gap-2"><span className="fine-print">{courseIds.length} course(s) selected</span><button type="button" className="button primary" onClick={addDraft} disabled={!activeCourses.length}><MailPlus size={15}/> Add to invitation queue</button></div>
      </div>
      <div className="rounded-2xl border border-[#e1e9e3] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">Bulk roster import</h4><p className="fine-print mt-1">Upload up to 100 rows in CSV format.</p></div><FileSpreadsheet size={23}/></div>
        <p className="mt-4 text-sm text-[#566a5e]">Required columns: <code>email, full_name, role, course_codes</code>. Student rows also need <code>student_number</code>. Course codes and department codes must match your academic workspace. Separate multiple course codes with semicolons.</p>
        <div className="mt-4 flex flex-wrap gap-2"><button className="button subtle compact" type="button" onClick={downloadTemplate}><FileSpreadsheet size={14}/> Download CSV template</button><label className="button subtle compact cursor-pointer"><Upload size={14}/> Upload CSV<input className="sr-only" type="file" accept=".csv,text/csv" onChange={event => void importCsv(event)}/></label></div>
        <p className="mt-4 rounded-xl bg-[#f6f9f6] p-3 text-xs text-[#6b7d72]">No passwords are generated or displayed here. Accounts are activated through the college email invitation.</p>
      </div>
    </div>
    {error && <p className="rounded-xl bg-[#fff1ee] p-3 text-sm text-[#9a3f30]" role="alert">{error}</p>}
    {notice && <p className="rounded-xl bg-[#edf7ef] p-3 text-sm text-[#276540]" role="status">{notice}</p>}
    <div className="rounded-2xl border border-[#e1e9e3] bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold">Invitation queue <span className="role-chip ml-2">{queue.length}/100</span></h4><p className="fine-print">The Head must review the list before sending account activation emails.</p></div><button className="button primary compact" type="button" onClick={() => void sendInvitations()} disabled={saving || !queue.length}>{saving ? 'Sending…' : 'Send invitations'}</button></div>
      {queue.length ? <div className="space-y-2">{queue.map((item,index) => <div key={item.email} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7faf7] p-3 text-sm"><span><b>{item.full_name}</b><small className="ml-2 text-[#718077]">{item.email}</small><small className="block text-xs text-[#718077]">{item.role} · {item.course_ids.length} course(s)</small></span><button className="text-button" type="button" onClick={() => setQueue(current => current.filter((_,i) => i !== index))}>Remove</button></div>)}</div> : <p className="py-4 text-sm text-[#708176]">No invitations queued.</p>}
      {!!results.length && <div className="mt-4 space-y-2 border-t border-[#e6ede7] pt-4"><h5 className="text-sm font-semibold">Last send results</h5>{results.map(result => <div key={result.email} className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{result.email}</span><span className={result.status === 'INVITED' ? 'text-[#267343]' : 'text-[#a23c2d'}>{result.status}{result.error ? ' · ' + result.error : ''}</span></div>)}</div>}
    </div>
    <div className="rounded-2xl border border-[#e1e9e3] bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3"><div><h4 className="font-semibold">Enrolled student directory</h4><p className="fine-print">Mobile numbers are visible to the Head only; teachers see only their assigned class roster.</p></div><button className="button subtle compact" type="button" onClick={() => void loadRoster()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
      {loading ? <p className="text-sm text-[#687b70]">Loading roster…</p> : students.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-[#e6ede7] text-xs uppercase text-[#728176]"><th className="px-3 py-3">Student</th><th className="px-3 py-3">Roll number</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Course / section</th><th className="px-3 py-3">Mobile</th><th className="px-3 py-3">Account</th></tr></thead><tbody>{students.map((student,index) => <tr key={student.student_id + '-' + (student.course_id ?? index)} className="border-b border-[#edf1ed] last:border-0"><td className="px-3 py-3"><b>{student.full_name}</b><small className="block text-[#728176]">{student.email ?? 'No email'}</small></td><td className="px-3 py-3 font-mono">{student.student_number}</td><td className="px-3 py-3">{student.department_name ?? '—'}</td><td className="px-3 py-3">{student.course_title ?? '—'}{student.section ? ' / ' + student.section : ''}</td><td className="px-3 py-3">{student.mobile ?? '—'}</td><td className="px-3 py-3 text-xs text-[#4f7560]">College roster</td></tr>)}</tbody></table></div> : <p className="py-4 text-sm text-[#708176]">No student accounts are provisioned yet. Add a student above or import your roster.</p>}
    </div>
  </section>;
}
