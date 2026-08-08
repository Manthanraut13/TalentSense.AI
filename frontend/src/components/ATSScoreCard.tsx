import { AlertCircle, CheckCircle2, Shield, XCircle } from 'lucide-react';

import type { ATSCheck } from '../types';

function atsScoreColor(score: number) {
  if (score >= 80) return '#0EA5A0';
  if (score >= 60) return '#F97316';
  if (score >= 40) return '#EA580C';
  return '#EF4444';
}

function atsScoreLabel(score: number) {
  if (score >= 80) return 'Will pass ATS';
  if (score >= 60) return 'May pass ATS';
  if (score >= 40) return 'At risk of rejection';
  return 'Likely rejected by ATS';
}

export default function ATSScoreCard({
  atsScore,
  keywordHits,
  keywordMisses,
  checks,
  checksPassed,
  checksTotal,
}: {
  atsScore: number;
  keywordHits: string[];
  keywordMisses: string[];
  checks: ATSCheck[];
  checksPassed: number;
  checksTotal: number;
}) {
  const color = atsScoreColor(atsScore);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
          <Shield size={16} aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold text-textPrimary">ATS &amp; Keyword Analysis</h2>
        <span className="ml-auto rounded-full border border-line bg-elevated px-2 py-0.5 text-[10px] text-textMuted">
          Rules-based
        </span>
      </div>

      <div className="flex items-center gap-4 rounded-xl bg-elevated p-4">
        <div className="text-5xl font-extrabold" style={{ color }}>
          {atsScore}%
        </div>
        <div>
          <div className="font-semibold text-sm text-textPrimary">{atsScoreLabel(atsScore)}</div>
          <div className="mt-0.5 text-xs text-textSecondary">
            {checksPassed}/{checksTotal} requirements met
          </div>
        </div>
      </div>

      {checks.length > 0 ? (
        <div className="mt-4 space-y-2.5">
          {checks.map((check) => (
            <div key={check.check} className="flex items-start gap-2.5 text-sm">
              {check.passed ? (
                <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <XCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" aria-hidden="true" />
              )}
              <div>
                <span className="font-medium text-textPrimary">{check.check}: </span>
                <span className="text-textSecondary">{check.detail}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {keywordHits.length > 0 || keywordMisses.length > 0 ? (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <div>
            <div className="mb-2 flex items-center gap-1 text-xs font-medium text-textSecondary">
              <CheckCircle2 size={12} className="text-primary" aria-hidden="true" />
              Keywords Found ({keywordHits.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywordHits.slice(0, 6).map((k) => (
                <span key={k} className="rounded-[8px] border border-primary/20 bg-primary-subtle px-2 py-0.5 font-mono text-[10px] text-primary">
                  {k}
                </span>
              ))}
              {keywordHits.length === 0 ? <span className="text-xs text-textMuted">None found</span> : null}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1 text-xs font-medium text-textSecondary">
              <XCircle size={12} className="text-red-500" aria-hidden="true" />
              Missing Keywords ({keywordMisses.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywordMisses.slice(0, 6).map((k) => (
                <span key={k} className="rounded-[8px] border border-red-500/20 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] text-red-700">
                  {k}
                </span>
              ))}
              {keywordMisses.length === 0 ? <span className="text-xs text-textMuted">None missing</span> : null}
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-4 flex items-center gap-1 text-xs text-textMuted">
        <AlertCircle size={10} aria-hidden="true" />
        ATS simulation uses keyword matching rules, not AI. Results are approximate.
      </p>
    </div>
  );
}
