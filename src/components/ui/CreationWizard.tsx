import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { ReactNode } from "react";

interface CreationWizardProps {
  steps: string[];
  currentStep: number;
  children: ReactNode;
  canContinue?: boolean;
  saving?: boolean;
  finalAction: string;
  onBack: () => void;
  onNext: () => void;
}

export function CreationWizard({
  steps,
  currentStep,
  children,
  canContinue = true,
  saving = false,
  finalAction,
  onBack,
  onNext,
}: CreationWizardProps) {
  const finalStep = currentStep === steps.length - 1;
  return (
    <div>
      <ol className="grid gap-2 border-b border-ink-100 pb-4 sm:grid-cols-3">
        {steps.map((step, index) => {
          const complete = index < currentStep;
          const active = index === currentStep;
          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold ${
                active
                  ? "bg-brand-50 text-brand-800"
                  : complete
                    ? "text-success-700"
                    : "text-ink-400"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  active
                    ? "bg-brand-600 text-white"
                    : complete
                      ? "bg-success-100 text-success-700"
                      : "bg-ink-100 text-ink-500"
                }`}
              >
                {complete ? <Check size={12} /> : index + 1}
              </span>
              {step}
            </li>
          );
        })}
      </ol>
      <div className="py-5">{children}</div>
      <div className="flex items-center justify-between border-t border-ink-100 pt-4">
        <button
          type="button"
          className="btn-secondary"
          disabled={currentStep === 0 || saving}
          onClick={onBack}
        >
          <ArrowLeft size={15} /> Back
        </button>
        {finalStep ? (
          <button type="submit" className="btn-primary" disabled={!canContinue || saving}>
            {saving ? "Saving..." : finalAction}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            disabled={!canContinue || saving}
            onClick={onNext}
          >
            Continue <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
