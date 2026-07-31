import { CheckCircle2, Key, Lightbulb, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import type { AnalysisResult } from '../types';
import { formatDate, scoreColorClass, scoreLabel } from '../lib/format';
import ATSScoreCard from './ATSScoreCard';
import LearningRoadmap from './LearningRoadmap';

function CircularScore({ score }: { score: number }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = score >= 60 ? '#10B981' : '#F59E0B';

  return (
    <svg width="144" height="144" viewBox="0 0 144 144" role="img" aria-label={`${score} percent match`}>
      <circle
        cx="72"
        cy="72"
        r={radius}
        fill="none"
        stroke="#2E2E2E"
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
        fill="#F5F5F5"
        fontSize="24"
        fontWeight="bold"
        fontFamily="monospace"
      >
        {score}%
      </text>
    </svg>
  );
}

export function ResultView({ result }: { result: AnalysisResult }) {
  const score = result.scores.overall;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-textSecondary">{formatDate(result.timestamp)}</p>
        <h1 className="mt-1 text-3xl font-bold">{result.job_title}</h1>
      </div>

      <section aria-labelledby="score-heading" className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 id="score-heading" className="sr-only">Overall Match Score</h2>
          <div className="mx-auto h-36 w-36">
            <CircularScore score={score} />
          </div>
          <p className={`mt-4 text-center font-semibold ${scoreColorClass(score)}`}>
            {scoreLabel(score)}
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-xl font-semibold">Score Breakdown</h2>
          <ScoreBar label="Skills Match" value={result.scores.skills_match} />
          <ScoreBar label="Experience Relevance" value={result.scores.experience_relevance} />
          <ScoreBar label="Keyword Coverage" value={result.scores.keyword_coverage} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ListCard icon={<XCircle size={18} aria-hidden="true" />} title="Missing Skills" tone="red" items={result.missing_skills} />
        <ListCard icon={<Key size={18} aria-hidden="true" />} title="ATS Keywords" tone="amber" items={result.ats_keywords} />
        <ListCard icon={<CheckCircle2 size={18} aria-hidden="true" />} title="Resume Strengths" tone="green" items={result.strengths} />
        <ListCard icon={<Lightbulb size={18} aria-hidden="true" />} title="Improvement Tips" tone="amber" items={result.improvement_tips} />
      </section>

      {result.ats_score !== undefined && result.ats_score !== null ? (
        <section aria-label="ATS simulation">
          <ATSScoreCard
            atsScore={result.ats_score}
            keywordHits={result.ats_keyword_hits || []}
            keywordMisses={result.ats_keyword_misses || []}
            checks={result.ats_checks || []}
            checksPassed={result.ats_checks_passed || 0}
            checksTotal={result.ats_checks_total || 0}
          />
        </section>
      ) : null}

      <section aria-label="Learning roadmap">
        <LearningRoadmap missingSkills={result.missing_skills} jobContext={result.job_title} />
      </section>

      {result.context_note ? (
        <div className="rounded-lg border border-primary/20 bg-primary-subtle p-4 text-sm text-primary" role="status" aria-live="polite">
          {result.context_note}
        </div>
      ) : null}
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
      ? 'border-red-500/20 bg-red-500/10 text-red-300'
      : tone === 'amber'
        ? 'border-secondary/20 bg-secondary-subtle text-secondary'
        : 'border-primary/20 bg-primary-subtle text-primary';

  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <span className={tone === 'green' ? 'text-primary' : tone === 'amber' ? 'text-secondary' : 'text-red-400'}>
          {icon}
        </span>
        {title}
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span key={item} className={`rounded-md border px-2.5 py-1 font-mono text-xs ${toneClass}`}>
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
