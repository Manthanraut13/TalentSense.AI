import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Lock, TrendingUp } from 'lucide-react';

import { fetchPublicAnalysis } from '../lib/api';

function BlurredList({ count, label }: { count: number; label: string }) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none space-y-1.5 blur-sm">
        {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
          <div key={i} className="h-6 w-full rounded-lg bg-line" />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-1.5 text-xs text-textSecondary">
          <Lock size={11} />
          {count} {label} hidden
        </div>
      </div>
    </div>
  );
}

function scoreColor(score: number) {
  return score >= 80 ? '#0EA5A0' : score >= 60 ? '#F97316' : '#EF4444';
}

export default function ShareView() {
  const { slug } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['share', slug],
    queryFn: () => fetchPublicAnalysis(slug!),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center text-textSecondary">
        Loading shared analysis...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center space-y-3">
          <h2 className="font-semibold text-textPrimary">Analysis not found</h2>
          <p className="text-sm text-textSecondary">
            This link may have expired or been disabled.
          </p>
          <Link to="/sign-up" className="text-sm text-primary">
            &larr; Try Resume Analyzer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base">
      <div className="border-b border-line bg-elevated px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-white">
            <TrendingUp size={16} />
          </span>
          <span className="text-sm font-semibold text-textPrimary">Resume Analyzer</span>
        </div>
        <Link
          to="/sign-up"
          className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
        >
          Get my free analysis &rarr;
        </Link>
      </div>

      <div className="mx-auto max-w-xl space-y-6 px-6 py-10">
        <div>
          <p className="mb-1 text-xs text-textMuted">Resume Analysis for</p>
          <h1 className="text-2xl font-bold text-textPrimary">{data.job_title}</h1>
          <p className="mt-1 text-xs text-textMuted">
            {new Date(data.timestamp).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <div className="mb-2 text-xs uppercase tracking-wider text-textMuted">
            Overall Match Score
          </div>
          <div className="text-7xl font-extrabold" style={{ color: scoreColor(data.scores.overall) }}>
            {data.scores.overall}%
          </div>
          <div className="mt-2 text-sm text-textSecondary">
            {data.scores.overall >= 80
              ? 'Strong match'
              : data.scores.overall >= 60
                ? 'Moderate match'
                : 'Needs improvement'}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-textPrimary">Score Breakdown</h2>
          {[
            { label: 'Skills Match', value: data.scores.skills_match },
            { label: 'Experience', value: data.scores.experience_relevance },
            { label: 'Keywords', value: data.scores.keyword_coverage },
          ].map(({ label, value }) => {
            const color = scoreColor(value);
            return (
              <div key={label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-textSecondary">{label}</span>
                  <span className="font-semibold" style={{ color }}>
                    {value}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>

        {data.strength_preview ? (
          <div className="rounded-xl border border-primary/20 bg-primary-subtle p-4">
            <div className="mb-1 text-xs font-semibold text-primary">
              Top Strength
            </div>
            <p className="text-sm text-textPrimary">{data.strength_preview}</p>
          </div>
        ) : null}

        <div className="rounded-xl border border-line bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-textPrimary">Full Analysis</h2>
            <div className="flex items-center gap-1 text-xs text-textMuted">
              <Lock size={10} /> Signup required
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs text-textMuted">
                {data.missing_skills_count} Missing Skills
              </div>
              <BlurredList count={data.missing_skills_count} label="skills" />
            </div>
            <div>
              <div className="mb-2 text-xs text-textMuted">
                {data.ats_keywords_count} ATS Keywords to Add
              </div>
              <BlurredList count={data.ats_keywords_count} label="keywords" />
            </div>
            <div>
              <div className="mb-2 text-xs text-textMuted">
                {data.improvement_tips_count} Improvement Tips
              </div>
              <BlurredList count={data.improvement_tips_count} label="tips" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-6 text-center space-y-3">
          <h3 className="font-bold text-textPrimary">Get your free resume analysis</h3>
          <p className="text-sm text-textSecondary">
            See exactly which skills you&apos;re missing, get ATS keywords, and get a
            step-by-step improvement plan.
          </p>
          <Link
            to="/sign-up"
            className="inline-block rounded-xl bg-secondary px-8 py-3 font-semibold text-white transition hover:opacity-90"
          >
            Analyze my resume for free &rarr;
          </Link>
          <p className="text-xs text-textMuted">Free &middot; No credit card &middot; 5 analyses/day</p>
        </div>
      </div>
    </div>
  );
}
