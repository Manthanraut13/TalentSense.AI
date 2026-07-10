import { CheckCircle2, Circle } from 'lucide-react';

const steps = [
  'Parsing your resume',
  'Analyzing job requirements',
  'Calculating match score',
  'Generating recommendations',
  'Almost done',
];

export function StepProgress({ activeStep }: { activeStep: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-xl font-semibold">Analyzing your match</h2>
      <div className="mt-5 space-y-3">
        {steps.map((step, index) => {
          const complete = index < activeStep;
          const active = index === activeStep;
          return (
            <div
              key={step}
              className={`flex items-center gap-3 text-sm ${
                active || complete ? 'text-textPrimary' : 'text-textMuted'
              }`}
            >
              {complete ? (
                <CheckCircle2 className="text-primary" size={18} />
              ) : (
                <Circle className={active ? 'animate-pulse text-secondary' : ''} size={18} />
              )}
              {step}
            </div>
          );
        })}
      </div>
    </div>
  );
}
