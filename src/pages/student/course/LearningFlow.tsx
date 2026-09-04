import { BookOpen, Check, ChevronRight, ClipboardCheck, ListChecks } from "lucide-react";

type FlowStep = "learn" | "do" | "assess";

export function LearningFlow({ active, hasActivity, hasAssessment }: { active: FlowStep; hasActivity: boolean; hasAssessment: boolean }) {
  const steps = [
    { id: "learn" as const, label: "Learn", help: "Understand", icon: BookOpen },
    ...(hasActivity ? [{ id: "do" as const, label: "Do", help: "Apply", icon: ListChecks }] : []),
    ...(hasAssessment ? [{ id: "assess" as const, label: "Assess", help: "Check", icon: ClipboardCheck }] : []),
  ];
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === active));

  return (
    <nav className="flex min-h-12 items-center rounded-xl border border-brand-100 bg-white/90 px-2 py-1.5 shadow-soft backdrop-blur-sm" aria-label="Module workflow">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const complete = index < activeIndex;
        const current = step.id === active;
        return (
          <div key={step.id} className="contents">
            {index > 0 && <ChevronRight size={15} className="mx-0.5 shrink-0 text-ink-300 sm:mx-2" aria-hidden="true" />}
            <div aria-current={current ? "step" : undefined} className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 transition-colors ${current ? "bg-brand-700 text-white shadow-sm" : complete ? "bg-success-50 text-success-800" : "text-ink-500"}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${current ? "bg-white/15" : complete ? "bg-success-100" : "bg-ink-100"}`}>{complete ? <Check size={13} /> : <Icon size={13} />}</span>
              <span className="min-w-0"><span className="block text-xs font-semibold uppercase tracking-[0.08em]">{step.label}</span><span className={`hidden text-[10px] sm:block ${current ? "text-brand-100" : "text-ink-500"}`}>{step.help}</span></span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
