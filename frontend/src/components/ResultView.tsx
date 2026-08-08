import { CheckCircle2, Key, Lightbulb, TrendingUp, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import type { AnalysisResult } from '../types';
import { formatDate, scoreColorClass, scoreLabel } from '../lib/format';
import ATSScoreCard from './ATSScoreCard';
import LearningRoadmap from './LearningRoadmap';

function CircularScore({ score }: { score: number }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = score >= 60 ? '#0EA5A0' : '#F97316';

  return (
    <svg width="144" height="144" viewBox="0 0 144 144" role="img" aria-label={`${score} percent match`}>
      <circle
        cx="72"
        cy="72"
        r={radius}
        fill="none"
        stroke="#E9EFEE"
        strokeWidth="12"
      />
      <circle
        cx="72"
        cy="72"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 72 72)"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text
        x="72"
        y="76"
        textAnchor="middle"
        fill="#171D1C"
        fontSize="24"
        fontWeight="bold"
        fontFamily="monospace"
      >
        {score}%
      </text>
    </svg>
  );
}

export function ResultView({
  result,
  actions,
}: {
  result: AnalysisResult;
  actions?: ReactNode;
}) {
  const score = result.scores.overall;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-textMuted">
            Resume Analysis for
          </p>
          <h1 className="mt-1 text-3xl font-bold text-textPrimary">{result.job_title}</h1>
          <p className="mt-1 text-sm text-textSecondary">{formatDate(result.timestamp)}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <section aria-labelledby="score-heading" className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" aria-hidden="true" />
              <h2 id="score-heading" className="text-sm font-semibold uppercase tracking-[0.08em] text-textSecondary">
                Match Analysis
              </h2>
            </div>
            <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[220px_1fr]">
              <div className="mx-auto">
                <div className="h-36 w-36">
                  <CircularScore score={score} />
                </div>
                <p className={`mt-3 text-center text-sm font-semibold ${scoreColorClass(score)}`}>
                  {scoreLabel(score)}
                </p>
              </div>
              <div className="rounded-xl bg-elevated p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-textMuted">
                  Score Breakdown
                </div>
                <ScoreBar label="Skills Match" value={result.scores.skills_match} />
                <ScoreBar label="Experience Relevance" value={result.scores.experience_relevance} />
                <ScoreBar label="Keyword Coverage" value={result.scores.keyword_coverage} />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ListCard icon={<XCircle size={18} aria-hidden="true" />} title="Missing Skills" tone="red" items={result.missing_skills} />
            <ListCard icon={<Key size={18} aria-hidden="true" />} title="ATS Keywords" tone="amber" items={result.ats_keywords} />
            <ListCard icon={<CheckCircle2 size={18} aria-hidden="true" />} title="Resume Strengths" tone="green" items={result.strengths} />
            <ListCard icon={<Lightbulb size={18} aria-hidden="true" />} title="Improvement Tips" tone="amber" items={result.improvement_tips} />
          </section>

          {result.context_note ? (
            <div className="rounded-2xl border border-primary/30 bg-primary-subtle p-4 text-sm text-textPrimary" role="status" aria-live="polite">
              <span className="mr-1 font-semibold text-primary">Note:</span>
              {result.context_note}
            </div>
          ) : null}

          <section aria-label="Learning roadmap">
            <LearningRoadmap missingSkills={result.missing_skills} jobContext={result.job_title} />
          </section>
        </div>

        {result.ats_score !== undefined && result.ats_score !== null ? (
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-[76px]">
              <ATSScoreCard
                atsScore={result.ats_score}
                keywordHits={result.ats_keyword_hits || []}
                keywordMisses={result.ats_keyword_misses || []}
                checks={result.ats_checks || []}
                checksPassed={result.ats_checks_passed || 0}
                checksTotal={result.ats_checks_total || 0}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-textSecondary">{label}</span>
        <span className="font-mono">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-line">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ListCard({
  icon,
  title,
  tone,
  items,
}: {
  icon: ReactNode;
  title: string;
  tone: 'red' | 'amber' | 'green';
  items: string[];
}) {
  const toneClass =
    tone === 'red'
      ? 'border-red-500/20 bg-red-500/10 text-red-700'
      : tone === 'amber'
        ? 'border-secondary/20 bg-secondary-subtle text-secondary'
        : 'border-primary/20 bg-primary-subtle text-primary';

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-textSecondary">
        <span className={tone === 'green' ? 'text-primary' : tone === 'amber' ? 'text-secondary' : 'text-red-600'}>
          {icon}
        </span>
        {title}
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span key={item} className={`rounded-[10px] border px-2.5 py-1 font-mono text-xs ${toneClass}`}>
              {item}
            </span>
          ))
        ) : (
          <p className="text-sm text-textMuted">No items returned yet.</p>
        )}
      </div>
    </div>
  );
}
