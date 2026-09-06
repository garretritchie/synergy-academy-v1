import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BrainCircuit, ClipboardList, FolderKanban } from 'lucide-react';
import { CourseLayout } from './CourseLayout';
import { CourseAssessments } from './CourseAssessments';
import { CourseAssignments } from './CourseAssignments';
import { PageHeader } from '@/components/ui/PageHeader';

export function Coursework() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get('section');
  const section = requestedSection === 'projects' ? 'projects' : ['assignments', 'homework'].includes(requestedSection ?? '') ? 'homework' : 'assessments';
  const setSection = (next: string) => { setSearchParams(current => { const updated = new URLSearchParams(current); updated.set('section', next); return updated; }); };
  const [inAssessment, setInAssessment] = useState(false);
  return <CourseLayout>
    {!inAssessment && <>
      <PageHeader title="Coursework" subtitle="Your graded assessments, homework, and capstone work—organized in one place. Practice activities and knowledge checks stay in Learning." />
      <div className="mt-5 grid gap-3 md:grid-cols-3" role="group" aria-label="Coursework sections">
        {([{id:'assessments',title:'Assessments & exams',description:'Graded checkpoints, midterm, and final exam',Icon:BrainCircuit},{id:'homework',title:'Homework',description:'Tasks, uploads, and instructor feedback',Icon:ClipboardList},{id:'projects',title:'Projects',description:'Capstone milestones and presentations',Icon:FolderKanban}] as const).map(({id,title,description,Icon}) => <button key={id} type="button" aria-pressed={section === id} onClick={() => setSection(id)} className={`flex min-w-0 items-center gap-3 rounded-xl border p-4 text-left transition-colors ${section === id ? 'border-brand-600 bg-brand-700 text-white shadow-sm' : id === 'projects' ? 'border-accent-200 bg-accent-50 text-ink-800 hover:bg-accent-100' : 'border-brand-200 bg-brand-50 text-ink-800 hover:bg-brand-100'}`}><Icon size={22} className="shrink-0"/><span><span className="block text-sm font-semibold">{title}</span><span className={`mt-1 block text-xs ${section === id ? 'text-blue-100' : 'text-ink-600'}`}>{description}</span></span></button>)}
      </div>
    </>}
    {section === 'assessments' ? <CourseAssessments embedded onWorkspaceChange={setInAssessment}/> : <section className="mt-6" aria-label={section === 'homework' ? 'Homework' : 'Projects'}><h2 className="text-lg font-semibold">{section === 'homework' ? 'Homework' : 'Projects & presentations'}</h2><p className="mt-1 text-sm text-ink-600">{section === 'homework' ? 'Open a homework task to work, submit evidence, or read feedback.' : 'Keep your project milestones, capstone files, and presentation work together.'}</p><CourseAssignments embedded category={section}/></section>}
  </CourseLayout>;
}
