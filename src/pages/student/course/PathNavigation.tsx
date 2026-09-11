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
    const style=`pathway-step ml-6 flex min-h-10 items-center gap-2 rounded-lg px-2 py-2 text-xs ${!step.available?'pathway-step-locked':selected?'pathway-step-current':step.kind==='do'?'pathway-step-do':step.kind==='assess'?'pathway-step-assess':'pathway-step-learn'}`;
    const body=<><Icon size={14} className="shrink-0"/><span className="min-w-0 flex-1 truncate" title={step.title}>{labels[step.kind]}</span><span className="text-[10px]">{step.done?'Done':selected?'Current':''}</span></>;
    return step.available?<Link key={step.id} to={step.href} onClick={()=>{setOpen(false);onNavigate?.();}} className={style} aria-current={selected?'page':undefined}>{body}</Link>:<div key={step.id} className="mb-1"><div className={style} aria-label={`${labels[step.kind]}: locked`}>{body}</div><p className="pathway-muted ml-8 px-2 pb-2 text-[11px] leading-4">{step.reason}</p></div>;
  };
  const outline = <>
    <div className="pathway-progress p-4"><div className="flex justify-between text-sm font-semibold"><span>Course progress</span><span>{path.percentage}%</span></div><progress className="mt-2 h-2 w-full" value={path.percentage} max={100} aria-label="Course progress"/><p className="pathway-muted mt-1 text-xs">{path.completed} of {path.total} steps complete</p></div>
    <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Learning pathway">
      {path.error && <p role="alert" className="p-2 text-xs text-red-200">Unable to load your pathway. Please reload.</p>}
      {path.modules.map(module => {
        const steps = path.steps.filter(step => step.moduleId === module.id);
        const current = steps.some(step => step.href === location.pathname);
        const locked = !steps.some(step => step.available);
        return <details key={module.id} name={open ? undefined : groupId} open={current || undefined} className={`pathway-module group mb-1 rounded-xl ${locked ? 'pathway-module-locked' : ''}`}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg p-3 focus-visible:ring-2">
            {locked && <LockKeyhole size={14} className="shrink-0" aria-label="Locked"/>}
            <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{module.display_order === 0 ? 'Introduction' : `Module ${module.display_order}`}</span><span className="pathway-muted block truncate text-xs" title={module.title}>{module.title.replace(/^Module \d+: /,'')}</span></span>
            <span className="text-[10px] tabular-nums">{steps.filter(step => step.done).length}/{steps.length}</span><ChevronDown size={13} className="shrink-0 group-open:rotate-180"/>
          </summary>
          {steps.map(renderStep)}
        </details>;
      })}
    </nav>
  </>;
  if(contentOnly)return <div className="pathway-theme flex max-h-[65dvh] flex-col overflow-hidden rounded-xl">{outline}</div>;
  return <><button type="button" onClick={()=>setOpen(true)} className="pathway-toggle btn-secondary m-2 lg:hidden"><ListTree size={16}/> Course outline · {path.percentage}%</button><aside className="pathway-theme pathway-sidebar hidden min-h-0 flex-col lg:flex" aria-label="Course outline">{outline}</aside>{open&&<Modal title="Course outline" onClose={()=>setOpen(false)}><div className="pathway-theme flex max-h-[65dvh] flex-col overflow-hidden rounded-xl">{outline}</div></Modal>}</>;
}
