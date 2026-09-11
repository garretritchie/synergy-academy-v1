import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { buildLearningPath, pathProgress, type PathModule, type PathActivity, type PathAssessment, type PathStep } from '@/lib/learningPath';
import {mergeBookmarks,readBookmarks,type LessonBookmark} from '@/lib/lessonBookmarks';
type Snapshot={modules:PathModule[];steps:PathStep[];bookmarks:LessonBookmark[];error:string;loading:boolean};
const empty:Snapshot={modules:[],steps:[],bookmarks:[],error:'',loading:true};
const cache=new Map<string,{at:number;promise:Promise<Snapshot>}>();
const listeners=new Map<string,Set<()=>void>>();
async function fetchPath(cohortId:string,studentId:string):Promise<Snapshot>{
 const enrolment=await supabase.from('enrolments').select('id,cohort:cohorts(course_id,start_date)').eq('cohort_id',cohortId).eq('student_id',studentId).eq('status','active').single();
 if(enrolment.error)return {...empty,loading:false,error:enrolment.error.message};
 const courseId=(enrolment.data.cohort as unknown as {course_id:string}).course_id;
 const [m,a,c,p,r,rules,bookmarks]=await Promise.all([
  supabase.from('modules').select('id,title,display_order,lessons(id,title,display_order,is_published)').eq('course_id',courseId).eq('is_published',true).order('display_order'),
  supabase.from('assignments').select('id,title,module_id,submissions(status)').eq('cohort_id',cohortId).eq('assignment_type','activity').eq('is_published',true).eq('submissions.enrolment_id',enrolment.data.id),
  supabase.from('assessments').select('id,title,module_id,passing_score,assessment_attempts(status,percentage)').eq('cohort_id',cohortId).eq('assessment_type','practice').eq('is_published',true).eq('assessment_attempts.enrolment_id',enrolment.data.id),
  supabase.from('progress_records').select('lesson_id,status').eq('enrolment_id',enrolment.data.id),
  supabase.rpc('get_released_lesson_ids',{cohort_uuid:cohortId}),
  supabase.from('content_release_rules').select('module_id,lesson_id,release_type,release_date,days_offset').eq('cohort_id',cohortId),
  supabase.from('lesson_bookmarks').select('lesson_id,screen_index,updated_at').eq('cohort_id',cohortId).eq('student_id',studentId),
 ]);
 const failure=m.error||a.error||c.error||p.error||r.error;
 if(failure)return {...empty,loading:false,error:failure.message};
 const modules=m.data as unknown as PathModule[];
 const releaseReasons = new Map<string,string>();
 const startDate = (enrolment.data.cohort as unknown as {start_date:string|null}).start_date;
 for (const module of modules) for (const lesson of module.lessons) {
  const rule = rules.data?.find(rule => rule.lesson_id === lesson.id) ?? rules.data?.find(rule => !rule.lesson_id && rule.module_id === module.id);
  if (!rule) continue;
  const date = rule.release_type === 'scheduled' && rule.release_date ? new Date(rule.release_date) : rule.release_type === 'days_from_start' && startDate && rule.days_offset !== null ? new Date(`${startDate}T00:00:00Z`) : null;
  if (date && rule.release_type === 'days_from_start') date.setUTCDate(date.getUTCDate() + rule.days_offset);
  if (date && !Number.isNaN(date.getTime())) releaseReasons.set(lesson.id, `Unlocks ${new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short',timeZoneName:undefined}).format(date)} (your local time).`);
 }
 return {modules,steps:buildLearningPath(cohortId,modules,a.data as unknown as PathActivity[],c.data as unknown as PathAssessment[],new Set(p.data.filter(x=>x.status==='completed').map(x=>x.lesson_id)),new Set(r.data as string[]),releaseReasons),bookmarks:bookmarks.data??[],error:'',loading:false};
}
function request(key:string,cohort:string,student:string){
 let entry=cache.get(key);
 if(!entry||Date.now()-entry.at>30000){entry={at:Date.now(),promise:fetchPath(cohort,student).catch(()=>({...empty,loading:false,error:'Your pathway could not load. Please try again.'}))};cache.set(key,entry);}
 return entry.promise;
}
export function useLearningPath(cohortId?:string){
 const {user}=useAuth(),studentId=user?.id,key=`${studentId??''}:${cohortId??''}`;
 const [state,setState]=useState<{key:string;data:Snapshot}>({key:'',data:empty});
 useEffect(()=>{
  if(!studentId||!cohortId)return;
  let live=true;const update=()=>{void request(key,cohortId,studentId).then(data=>{if(live)setState({key,data});});};
  const group=listeners.get(key)??new Set();group.add(update);listeners.set(key,group);update();
  return()=>{live=false;group.delete(update);if(!group.size)listeners.delete(key);};
 },[key,cohortId,studentId]);
 const refresh=useCallback(async()=>{if(!studentId||!cohortId)return;cache.delete(key);const pending=request(key,cohortId,studentId);listeners.get(key)?.forEach(update=>update());await pending;},[key,cohortId,studentId]);
 const data=state.key===key?state.data:empty;
 const bookmarks=mergeBookmarks(studentId&&cohortId?readBookmarks(studentId,cohortId):[],data.bookmarks);
 const resumeBookmark=bookmarks.find(b=>data.steps.some(s=>s.id===b.lesson_id&&s.available&&!s.done&&s.kind==='learn'));
 const resume=resumeBookmark?data.steps.find(s=>s.id===resumeBookmark.lesson_id):undefined;
 const lastBookmark=bookmarks.find(b=>data.steps.some(s=>s.id===b.lesson_id&&s.available&&s.kind==='learn'));
 const lastLesson=lastBookmark?data.steps.find(s=>s.id===lastBookmark.lesson_id):undefined;
 const progress=pathProgress(data.steps);
 return {...data,...progress,next:resume??progress.next,resume,resumeScreen:resumeBookmark?resumeBookmark.screen_index+1:undefined,lastLesson,lastScreen:lastBookmark?lastBookmark.screen_index+1:undefined,refresh};
}
