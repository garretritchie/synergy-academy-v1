import { BookOpen, Check, ChevronRight, ClipboardCheck, ListChecks } from "lucide-react";
import { Link, useLocation, useParams } from 'react-router-dom';
import { useLearningPath } from '@/hooks/useLearningPath';

type FlowStep = "learn" | "do" | "assess";

export function LearningFlow({ active, hasActivity, hasAssessment }: { active: FlowStep; hasActivity: boolean; hasAssessment: boolean }) {
  const { cohortId }=useParams();
  const location=useLocation();
  const path=useLearningPath(cohortId);
  const currentStep=path.steps.find(s=>s.href===location.pathname);
  const moduleSteps=path.steps.filter(s=>s.moduleId===currentStep?.moduleId);
  const steps = [
    { id: "learn" as const, label: "Learn", help: "Understand", icon: BookOpen },
    ...(hasActivity ? [{ id: "do" as const, label: "Do", help: "Apply", icon: ListChecks }] : []),
    ...(hasAssessment ? [{ id: "assess" as const, label: "Assess", help: "Check", icon: ClipboardCheck }] : []),
  ];

  return (
    <nav className="flex min-h-12 items-center rounded-xl border border-brand-100 bg-white/90 px-2 py-1.5 shadow-soft backdrop-blur-sm" aria-label="Module workflow">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const destination=moduleSteps.find(s=>s.kind===step.id&&!s.done) ?? moduleSteps.find(s=>s.kind===step.id);
        const complete = moduleSteps.some(s=>s.kind===step.id) && moduleSteps.filter(s=>s.kind===step.id).every(s=>s.done);
        const current = step.id === active;
        return (
          <div key={step.id} className="contents">
            {index > 0 && <ChevronRight size={15} className="mx-0.5 shrink-0 text-ink-300 sm:mx-2" aria-hidden="true" />}
            <Link to={destination?.available ? destination.href : location.pathname} onClick={e=>{if(!destination?.available)e.preventDefault();}} aria-disabled={!destination?.available} title={destination&&!destination.available?destination.reason:undefined} aria-current={current ? "step" : undefined} className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 ${current ? "bg-brand-700 text-white shadow-sm" : complete ? "bg-success-50 text-success-800" : "text-ink-600"}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${current ? "bg-white/15" : complete ? "bg-success-100" : "bg-ink-100"}`}>{complete ? <Check size={13} /> : <Icon size={13} />}</span>
              <span className="min-w-0"><span className="block text-xs font-semibold uppercase tracking-[0.08em]">{step.label}</span><span className={`hidden text-[10px] sm:block ${current ? "text-brand-100" : "text-ink-500"}`}>{step.help}</span></span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
