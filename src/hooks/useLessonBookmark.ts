import {useCallback, useEffect, useRef, useState} from 'react';
import {supabase} from '@/lib/supabase';
import {clampScreen,legacyScreen,mergeBookmarks,readBookmarks,writeBookmark,type LessonBookmark} from '@/lib/lessonBookmarks';

export function useLessonBookmark(studentId: string | undefined, cohortId: string | undefined, lessonId: string | undefined, count: number, enabled: boolean) {
  const key=`${studentId}:${cohortId}:${lessonId}`;
  const [state,setState]=useState({key:'',screen:0,ready:false,status:''});
  const active=useRef<{key:string;row:LessonBookmark}|null>(null);
  const queue=useRef<Promise<boolean>>(Promise.resolve(true));
  const latest=useRef(new Map<string,LessonBookmark>());
  const persist=useCallback((row:LessonBookmark)=>{
    if(!studentId || !cohortId) return Promise.resolve(false);
    const local=writeBookmark(studentId,cohortId,row);
    latest.current.set(key,row);
    const task=async()=>{
      if(latest.current.get(key)!==row)return local;
      let synced=false;
      try {const result=await supabase.from('lesson_bookmarks').upsert({...row,student_id:studentId,cohort_id:cohortId},{onConflict:'student_id,cohort_id,lesson_id'}).abortSignal(AbortSignal.timeout(8000));synced=!result.error;}catch{/* Device bookmark remains available. */}
      if(active.current?.key===key && active.current.row.updated_at===row.updated_at) setState(s=>s.key===key?{...s,status:synced?'Saved to your account':local?'Saved on this device only — account sync unavailable':'Unable to save. Try again before leaving.'}:s);
      return synced || local;
    };
    queue.current=queue.current.then(task,task);
    return queue.current;
  },[studentId,cohortId,key]);
  useEffect(()=>{
    active.current=null;
    if(!enabled || !studentId || !cohortId || !lessonId)return;
    let live=true;
    void (async()=>{
      const local=readBookmarks(studentId,cohortId).filter(b=>b.lesson_id===lessonId);
      let remote:LessonBookmark[]=[];
      try {const r=await supabase.from('lesson_bookmarks').select('lesson_id,screen_index,updated_at').eq('student_id',studentId).eq('cohort_id',cohortId).eq('lesson_id',lessonId).abortSignal(AbortSignal.timeout(8000)).maybeSingle();if(r.data)remote=[r.data];}catch{/* Resume local copy. */}
      if(!live)return;
      const row={lesson_id:lessonId,screen_index:clampScreen(mergeBookmarks(local,remote)[0]?.screen_index ?? legacyScreen(studentId,cohortId,lessonId),count),updated_at:new Date().toISOString()};
      active.current={key,row};
      writeBookmark(studentId,cohortId,row);
      setState({key,screen:row.screen_index,ready:true,status:'Saving your place…'});
      void persist(row);
    })();
    return ()=>{live=false;if(active.current?.key===key)active.current=null;};
  },[key,enabled,studentId,cohortId,lessonId,count,persist]);
  const setScreen=useCallback((next:number|((previous:number)=>number))=>{
    if(active.current?.key!==key || !studentId || !cohortId)return;
    const index=clampScreen(typeof next==='function'?next(active.current.row.screen_index):next,count);
    const row={...active.current.row,screen_index:index,updated_at:new Date().toISOString()};
    active.current={key,row};writeBookmark(studentId,cohortId,row);
    setState({key,screen:index,ready:true,status:'Saving your place…'});
    void persist(row);
  },[key,studentId,cohortId,count,persist]);
  const save=useCallback(()=>active.current?.key===key?persist(active.current.row):Promise.resolve(false),[key,persist]);
  return {screen:state.key===key?state.screen:0,ready:state.key===key&&state.ready,status:state.key===key?state.status:'Loading your saved place…',setScreen,save};
}
