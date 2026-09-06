import { useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, CheckCircle2, ChevronDown, ClipboardCheck, ListChecks, ListTree, LockKeyhole } from 'lucide-react';
import { useLearningPath } from '@/hooks/useLearningPath';
import { Modal } from '@/components/ui/Modal';
import type { PathStep } from '@/lib/learningPath';

export function PathNavigation({ cohortId,contentOnly=false,onNavigate }: { cohortId:string;contentOnly?:boolean;onNavigate?:()=>void }) {
  const path=useLearningPath(cohortId);
  const groupId=useId();
  const location=useLocation();
  const [open,setOpen]=useState(false);
  const labels={learn:'Learn it',do:'Do it',assess:'Assess it'};
  const renderStep=(step:PathStep)=>{
    const Icon=step.done?CheckCircle2:!step.available?LockKeyhole:step.kind==='learn'?BookOpen:step.kind==='do'?ListChecks:ClipboardCheck;
    const selected=location.pathname===step.href;
    const style=`ml-6 flex min-h-10 items-center gap-2 rounded-lg px-2 py-2 text-xs focus-visible:ring-2 focus-visible:ring-brand-500 ${!step.available?'bg-ink-100 text-ink-500':selected?'bg-brand-100 text-brand-900':step.kind==='do'?'text-violet-800':step.kind==='assess'?'text-amber-900':'text-brand-800'}`;
    const body=<><Icon size={14} className="shrink-0"/><span className="min-w-0 flex-1 truncate" title={step.title}>{labels[step.kind]}</span><span className="text-[10px]">{step.done?'Done':selected?'Current':''}</span></>;
    return step.available?<Link key={step.id} to={step.href} onClick={()=>{setOpen(false);onNavigate?.();}} className={style} aria-current={selected?'page':undefined}>{body}</Link>:<div key={step.id} className="mb-1"><div className={style} aria-label={`${labels[step.kind]}: locked`}>{body}</div><p className="ml-8 px-2 pb-2 text-[11px] leading-4 text-ink-500">{step.reason}</p></div>;
  };
  const outline = <>
    <div className="border-b border-brand-200 bg-brand-100/60 p-4"><div className="flex justify-between text-sm font-semibold"><span>Course progress</span><span>{path.percentage}%</span></div><progress className="mt-2 h-2 w-full accent-brand-600" value={path.percentage} max={100} aria-label="Course progress"/><p className="mt-1 text-xs text-ink-500">{path.completed} of {path.total} steps complete</p></div>
    <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Learning pathway">
      {path.error && <p role="alert" className="p-2 text-xs text-danger-700">Unable to load your pathway. Please reload.</p>}
      {path.modules.map(module => {
        const steps = path.steps.filter(step => step.moduleId === module.id);
        const current = steps.some(step => step.href === location.pathname);
        const locked = !steps.some(step => step.available);
        return <details key={module.id} name={groupId} open={current || undefined} className={`group mb-1 rounded-xl ${locked ? 'bg-ink-100 text-ink-500' : 'open:bg-white'}`}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg p-3 focus-visible:ring-2">
            {locked && <LockKeyhole size={14} className="shrink-0" aria-label="Locked"/>}
            <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{module.display_order === 0 ? 'Introduction' : `Module ${module.display_order}`}</span><span className="block truncate text-xs text-ink-600" title={module.title}>{module.title.replace(/^Module \d+: /,'')}</span></span>
            <span className="text-[10px] tabular-nums">{steps.filter(step => step.done).length}/{steps.length}</span><ChevronDown size={13} className="shrink-0 group-open:rotate-180"/>
          </summary>
          {steps.map(renderStep)}
        </details>;
      })}
    </nav>
  </>;
  if(contentOnly)return <div className="flex max-h-[65dvh] flex-col">{outline}</div>;
  return <><button type="button" onClick={()=>setOpen(true)} className="btn-secondary m-2 lg:hidden"><ListTree size={16}/> Course outline · {path.percentage}%</button>{!open&&<aside className="hidden min-h-0 flex-col border-r border-ink-200 bg-ink-50 lg:flex" aria-label="Course outline">{outline}</aside>}{open&&<Modal title="Course outline" onClose={()=>setOpen(false)}><div className="flex max-h-[65dvh] flex-col">{outline}</div></Modal>}</>;
}
