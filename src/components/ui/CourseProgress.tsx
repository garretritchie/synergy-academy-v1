import { useLearningPath } from '@/hooks/useLearningPath';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
export function CourseContinueButton({ cohortId }: { cohortId: string }) {
  const path = useLearningPath(cohortId);
  return <Link to={path.next?.href ?? `/student/courses/${cohortId}/learn`} className="btn-primary gap-4">
    {path.resume ? `Resume lesson · screen ${path.resumeScreen}` : path.percentage > 0 ? 'Continue learning' : 'Start learning'}<ArrowRight size={16} aria-hidden="true"/>
  </Link>;
}
export function CourseProgress({cohortId,compact=false}:{cohortId:string;compact?:boolean}){
  const path=useLearningPath(cohortId);
  if(path.error)return <span className="text-xs text-ink-600">Progress unavailable</span>;
  return <div className="min-w-0"><div className="flex items-center justify-between gap-3 text-xs"><span>Course progress</span><span className="font-semibold text-brand-700">{path.loading?'…':`${path.percentage}%`}</span></div><progress value={path.percentage} max={100} className="mt-2 h-2 w-full accent-brand-600" aria-label="Course progress"/>{!compact&&path.next&&<Link className="mt-2 block text-sm font-semibold text-brand-700" to={path.next.href}>Continue where you left off →</Link>}</div>;
}
