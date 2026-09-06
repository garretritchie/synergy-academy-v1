import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Layers, Library, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type EnrolledCourse = { cohort_id: string; cohort: { name: string; course: { title: string } } };
export function CourseSwitcher({ cohortId }: { cohortId: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="btn-secondary ml-auto shrink-0 !px-3" aria-label="Switch course or browse courses"><Layers size={17}/><span className="hidden sm:inline">My courses</span></button>
    {open && <Modal title="Your courses" onClose={() => setOpen(false)}><CourseChoices cohortId={cohortId} close={() => setOpen(false)}/></Modal>}
  </>;
}
function CourseChoices({ cohortId, close }: { cohortId: string; close: () => void }) {
  const { user } = useAuth();
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    if (!user) return;
    void supabase.from('enrolments').select('cohort_id,cohort:cohorts(name,course:courses(title))').eq('student_id', user.id).eq('status', 'active').then(({data,error}) => {
      if (!current) return;
      setCourses((data ?? []) as unknown as EnrolledCourse[]);
      setError(error ? 'Your courses could not be loaded. Please try again.' : '');
      setLoading(false);
    });
    return () => { current = false; };
  }, [user]);
  const matches = courses.filter(row => row.cohort && `${row.cohort.course?.title} ${row.cohort.name}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-4">
    <label className="relative block"><Search size={16} className="absolute left-3 top-3.5 text-ink-500"/><span className="sr-only">Find an enrolled course</span><input className="input pl-10" placeholder="Find an enrolled course" value={query} onChange={event => setQuery(event.target.value)}/></label>
    {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
    {loading ? <p role="status">Loading your courses…</p> : <div className="max-h-[45dvh] space-y-2 overflow-y-auto">{matches.map(row => <Link key={row.cohort_id} to={`/student/courses/${row.cohort_id}/home`} onClick={close} aria-current={cohortId === row.cohort_id ? 'page' : undefined} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${cohortId === row.cohort_id ? 'border-brand-300 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'}`}><span className="min-w-0"><span className="block text-sm font-semibold">{row.cohort.course?.title}</span><span className="block text-xs text-ink-500">{row.cohort.name}</span></span>{cohortId === row.cohort_id && <Check size={17} className="shrink-0 text-brand-700"/>}</Link>)}{!matches.length && !error && <p className="text-sm text-ink-600">No active enrollments match this search.</p>}</div>}
    <div className="grid gap-2 border-t border-ink-200 pt-4 sm:grid-cols-2"><Link to="/student/courses" className="btn-secondary" onClick={close}>All my enrollments</Link><Link to="/student/courses?tab=catalog" className="btn-primary" onClick={close}><Library size={16}/>Browse courses</Link></div>
    <p className="text-xs text-ink-500">Browsing a course does not enroll you or unlock its lessons.</p>
  </div>;
}
