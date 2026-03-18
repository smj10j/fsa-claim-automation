import type { WorkflowStep } from "@/types";

const STEPS: { id: WorkflowStep; label: string }[] = [
  { id: "scanning_amazon", label: "Scan" },
  { id: "reviewing_orders", label: "Review" },
  { id: "capturing_invoices", label: "Invoices" },
  { id: "submitting_claims", label: "Submit" },
  { id: "complete", label: "Done" },
];

const STEP_ORDER: WorkflowStep[] = [
  "idle",
  "navigate_amazon",
  "scanning_amazon",
  "reviewing_orders",
  "capturing_invoices",
  "navigate_navia",
  "submitting_claims",
  "complete",
];

function getStepIndex(step: WorkflowStep): number {
  return STEP_ORDER.indexOf(step);
}

interface Props {
  currentStep: WorkflowStep;
}

export function StepIndicator({ currentStep }: Props) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
      {STEPS.map((step, i) => {
        const stepIndex = getStepIndex(step.id);
        const isDone = currentIndex > stepIndex;
        const isActive = currentIndex === stepIndex ||
          (step.id === "scanning_amazon" && currentStep === "navigate_amazon");

        return (
          <div key={step.id} className="flex flex-col items-center gap-1">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                isDone
                  ? "bg-green-600 text-white"
                  : isActive
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {isDone ? "✓" : i + 1}
            </div>
            <span
              className={`text-[10px] ${
                isActive ? "text-blue-600 font-semibold" : "text-gray-400"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
