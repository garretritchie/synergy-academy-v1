import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {QuestionReplies} from './QuestionReplies';
import type {Discussion} from '@/types';

export function CourseQuestionsPanel(){
 const [rows,setRows]=useState<Array<Discussion&{cohort:{name:string}}>>([]),[error,setError]=useState('');
 useEffect(()=>{let live=true;void supabase.from('discussions').select('*,author:profiles(*),cohort:cohorts(name)').eq('is_question',true).is('parent_id',null).order('created_at',{ascending:false}).limit(50).then(({data,error})=>{if(!live)return;if(error)setError(error.message);else setRows((data??[]) as unknown as Array<Discussion&{cohort:{name:string}}>);});return()=>{live=false;};},[]);
 return <section className="rounded-xl border border-brand-100 bg-white p-5"><h2 className="font-semibold">Course Q&A</h2><p className="mt-1 text-xs text-ink-600">Recent questions from cohorts you can access.</p>{error&&<p role="alert">{error}</p>}{!rows.length&&!error&&<p className="mt-4 text-sm text-ink-600">No course questions yet.</p>}<div className="mt-4 space-y-4">{rows.map(row=><article key={row.id} className="rounded-xl bg-ink-50 p-4"><p className="text-xs text-brand-700">{row.cohort?.name}</p><h3 className="mt-1 text-sm font-semibold">{row.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm">{row.body}</p><QuestionReplies questionId={row.id} cohortId={row.cohort_id}/></article>)}</div></section>;
}
