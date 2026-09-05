import { useLearningPath } from '@/hooks/useLearningPath';
import { Link } from 'react-router-dom';
export function CourseProgress({cohortId,compact=false}:{cohortId:string;compact?:boolean}){
  const path=useLearningPath(cohortId);
  if(path.error)return <span className="text-xs text-ink-600">Progress unavailable</span>;
  return <div className="min-w-0"><div className="flex items-center justify-between gap-3 text-xs"><span>Course progress</span><span className="font-semibold text-brand-700">{path.loading?'…':`${path.percentage}%`}</span></div><progress value={path.percentage} max={100} className="mt-2 h-2 w-full accent-brand-600" aria-label="Course progress"/>{!compact&&path.next&&<Link className="mt-2 block text-sm font-semibold text-brand-700" to={path.next.href}>Continue where you left off →</Link>}</div>;
}
