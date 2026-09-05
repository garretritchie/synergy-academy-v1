import { useEffect,useState } from 'react';
import { supabase } from '@/lib/supabase';
export function DeliveryReadiness({courseId}:{courseId:string}){
 const [issues,setIssues]=useState<string[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;setLoading(true);void(async()=>{
  const [notes,release,sessions,cohorts,resources]=await Promise.all([supabase.from('lesson_notes').select('id').limit(1),supabase.from('resources').select('id,release_mode').limit(1),supabase.from('assessment_sessions').select('id').limit(1),supabase.from('cohorts').select('id,name,end_date').eq('course_id',courseId),supabase.from('resources').select('id,title,url').eq('course_id',courseId)]);
  const found:string[]=[];
  if(notes.error)found.push('Account notes are unavailable. Apply migration 021 and verify note saving.');
  if(release.error)found.push('Resource release rules are unavailable. Apply migration 022 and verify locked-file access.');
  if(sessions.error)found.push('Secure assessment sessions are unavailable. Apply migration 023 before graded delivery.');
  if(resources.error)found.push('Resources could not be checked.');else if(!resources.data.length)found.push('No course resources have been added.');
  for(const r of resources.data??[])if(r.url?.includes('/object/sign/'))found.push(`${r.title}: replace the stored expiring link with a private storage reference.`);
  if(cohorts.error)found.push('Cohorts could not be checked.');
  for(const c of cohorts.data??[]){const [assignments,meetings,assessments,instructors]=await Promise.all([supabase.from('assignments').select('title,due_date').eq('cohort_id',c.id).eq('is_published',true),supabase.from('live_sessions').select('title,scheduled_start,meeting_url,is_cancelled').eq('cohort_id',c.id),supabase.from('assessments').select('title,assessment_type,max_attempts,assessment_questions(question_text,correct_answer,explanation)').eq('cohort_id',c.id).eq('is_published',true),supabase.from('cohort_instructors').select('id').eq('cohort_id',c.id)]);
   if(assignments.error||meetings.error||assessments.error||instructors.error)found.push(`${c.name}: some delivery checks could not be loaded.`);
   if(!instructors.data?.length)found.push(`${c.name}: assign a teaching contact.`);
   if(assignments.data?.some(a=>a.due_date&&c.end_date&&new Date(a.due_date)>new Date(c.end_date+'T23:59:59')))found.push(`${c.name}: assignment dates extend beyond the cohort end date. Confirm the intended schedule.`);
   if(meetings.data?.some(m=>!m.is_cancelled&&new Date(m.scheduled_start)>new Date()&&!m.meeting_url))found.push(`${c.name}: an upcoming meeting needs its joining link.`);
   for(const a of assessments.data??[]){if(a.assessment_type!=='practice'&&a.max_attempts!==1)found.push(`${a.title}: graded assessments must allow one attempt.`);if(!a.assessment_questions.length||a.assessment_questions.some(q=>!q.correct_answer||!q.explanation||q.question_text.startsWith('Which statement best explains')))found.push(`${a.title}: review question coverage, answers and feedback before release.`);}
  }
  if(alive){setIssues(found);setLoading(false);}
 })();return()=>{alive=false;};},[courseId]);
 return <section className="my-5 rounded-xl border border-amber-200 bg-amber-50/60 p-5"><h2 className="font-semibold text-ink-950">Delivery checks</h2><p className="mt-1 text-sm text-ink-600">Structure alone does not confirm that a course is ready to launch.</p>{loading?<p role="status" className="mt-3 text-sm">Checking connected services and course setup…</p>:issues.length?<ul className="mt-3 space-y-2 text-sm text-amber-950">{issues.map((i,n)=><li key={n}>• {i}</li>)}</ul>:<p className="mt-3 text-sm text-success-800">Automated setup checks passed. Still preview the course as a learner and confirm content, schedule and access before launch.</p>}</section>;
}
