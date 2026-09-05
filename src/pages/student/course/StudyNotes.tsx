import { useEffect, useRef, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export function StudyNotes({cohortId,lessonId,screen=0}:{cohortId:string;lessonId:string;screen?:number}) {
  const {user}=useAuth();
  const [open,setOpen]=useState(false);
  return <><button type="button" className="btn-secondary" onClick={()=>setOpen(true)} disabled={!lessonId}><NotebookPen size={16}/> Notes</button>{open&&user&&<NotesEditor key={`${lessonId}:${screen}`} studentId={user.id} cohortId={cohortId} lessonId={lessonId} screen={screen} onClose={()=>setOpen(false)}/>}</>;
}
function NotesEditor({studentId,cohortId,lessonId,screen,onClose}:{studentId:string;cohortId:string;lessonId:string;screen:number;onClose:()=>void}) {
  const key=`academy-note-v2:${studentId}:${cohortId}:${lessonId}:${screen}`;
  const [body,setBody]=useState('');
  const [ready,setReady]=useState(false);
  const [status,setStatus]=useState('Loading your note…');
  const pending=useRef(false);
  const bodyRef=useRef('');
  const inputRef=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{if(ready)inputRef.current?.focus();},[ready]);
  const save=async()=>{
    if(!pending.current)return;
    const value=bodyRef.current;
    setStatus('Saving…');
    const result=await supabase.from('lesson_notes').upsert({student_id:studentId,cohort_id:cohortId,lesson_id:lessonId,screen_index:screen,body:value},{onConflict:'student_id,cohort_id,lesson_id,screen_index'});
    if(result.error){setStatus('Saved on this device only. Account sync is unavailable; keep this browser data until sync returns.');return;}
    if(bodyRef.current===value){pending.current=false;localStorage.removeItem(key);setStatus('Saved to your account');}
  };
  useEffect(()=>{
    let live=true;
    void supabase.from('lesson_notes').select('body').eq('student_id',studentId).eq('cohort_id',cohortId).eq('lesson_id',lessonId).eq('screen_index',screen).maybeSingle().then(({data,error})=>{
      if(!live)return;
      const draft=localStorage.getItem(key) ?? localStorage.getItem(`synergy-lesson-note:${studentId}:${cohortId}:${lessonId}:${screen}`);
      const value=draft ?? data?.body ?? '';
      bodyRef.current=value;pending.current=draft!==null;setBody(value);setReady(true);
      setStatus(error?'Account sync unavailable. New edits will be saved on this device.':draft!==null?'Recovered device draft. Select Save to sync.':'Saved to your account');
    });return ()=>{live=false;};
  },[cohortId,key,lessonId,screen,studentId]);
  return <Modal title="Study notes" onClose={()=>{void save();onClose();}}><label className="block text-sm font-semibold" htmlFor="study-note">Your private study notes</label><textarea id="study-note" ref={inputRef} autoFocus disabled={!ready} maxLength={20000} className="input mt-3 min-h-60" value={body} onChange={e=>{const value=e.target.value;setBody(value);bodyRef.current=value;pending.current=true;try{localStorage.setItem(key,value);setStatus('Draft saved on this device. Save to sync to your account.');}catch{setStatus('Device storage is full. Save to your account before leaving.');}}}/><p role="status" className="mt-3 text-xs text-ink-600">{status}</p><div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={()=>void save()}>Save</button><button type="button" className="btn-primary" onClick={async()=>{await save();onClose();}}>Save and close</button></div></Modal>;
}
