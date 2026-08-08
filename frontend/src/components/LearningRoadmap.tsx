import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, FileText, GraduationCap, Loader2, Map, Youtube } from 'lucide-react';

import { useLearningPlan } from '../hooks/useLearningPlan';
import type { LearningResource, SkillPlan } from '../types';

const PRIORITY_STYLES: Record<SkillPlan['priority'], string> = {
  high: 'border-red-500/20 bg-red-500/10 text-red-700',
  medium: 'border-secondary/20 bg-secondary-subtle text-secondary',
  low: 'border-primary/20 bg-primary-subtle text-primary',
};

const RESOURCE_ICONS: Record<LearningResource['type'], typeof BookOpen> = {
  video: Youtube,
  docs: FileText,
  course: GraduationCap,
  article: BookOpen,
};

function SkillPlanCard({ plan, index }: { plan: SkillPlan; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-elevated"
        aria-expanded={expanded}
      >
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-semibold text-primary">
          {index + 1}
        </span>
        <span className="font-mono text-sm font-semibold text-textPrimary">{plan.skill}</span>
        <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLES[plan.priority]}`}>
          {plan.priority.toUpperCase()}
        </span>
        <span className="text-xs text-textMuted">{plan.estimated_weeks}w</span>
        {expanded ? (
          <ChevronUp size={14} className="text-textMuted" aria-hidden="true" />
        ) : (
          <ChevronDown size={14} className="text-textMuted" aria-hidden="true" />
        )}
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-line px-4 pb-4 pt-4">
          {plan.why_needed ? <p className="text-sm italic text-textSecondary">{plan.why_needed}</p> : null}

          {plan.learning_path?.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-textMuted">Learning Path</div>
              <ol className="space-y-1.5">
                {plan.learning_path.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-textSecondary">
                    <span className="min-w-[18px] font-bold text-primary">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {plan.resources?.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-textMuted">Free Resources</div>
              <div className="space-y-2">
                {plan.resources.map((r, i) => {
                  const ResourceIcon = RESOURCE_ICONS[r.type] || BookOpen;
                  return (
                    <a
                      key={`${r.url}-${i}`}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-2.5 rounded-lg border border-transparent bg-elevated p-3 transition hover:border-primary/30"
                    >
                      <ResourceIcon size={14} className="mt-0.5 flex-shrink-0 text-textMuted group-hover:text-primary" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{r.title}</div>
                        <div className="truncate text-xs text-textMuted">{r.snippet}</div>
                      </div>
                      <ExternalLink size={12} className="mt-0.5 flex-shrink-0 text-textMuted" aria-hidden="true" />
                    </a>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function LearningRoadmap({
  missingSkills,
  jobContext,
}: {
  missingSkills: string[];
  jobContext?: string;
}) {
  const { mutate: fetchPlans, data, isPending, error } = useLearningPlan();
  const [fetched, setFetched] = useState(false);

  if (missingSkills.length === 0) return null;

  const handleFetch = () => {
    fetchPlans({ skills: missingSkills, jobContext });
    setFetched(true);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
          <Map size={16} aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold text-textPrimary">Learning Roadmap</h2>
        <span className="ml-auto rounded-full border border-line bg-elevated px-2 py-0.5 text-[10px] text-textMuted">
          {missingSkills.length} skills to learn
        </span>
      </div>

      {!fetched ? (
        <div className="py-6 text-center">
          <p className="mb-4 text-sm text-textSecondary">
            Get a personalized learning plan for your {missingSkills.length} missing skills with curated free resources.
          </p>
          <button
            onClick={handleFetch}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            Generate Learning Roadmap
          </button>
        </div>
      ) : isPending ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-textSecondary">
          <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />
          Finding the best free resources for your gaps...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700" role="alert">
          Could not generate learning plans. Please try again.
        </div>
      ) : data?.plans ? (
        <div className="space-y-2">
          {[...data.plans]
            .sort((a, b) => {
              const order = { high: 0, medium: 1, low: 2 };
              return order[a.priority] - order[b.priority];
            })
            .map((plan, index) => (
              <SkillPlanCard key={plan.skill} plan={plan} index={index} />
            ))}
        </div>
      ) : null}
    </div>
  );
}
