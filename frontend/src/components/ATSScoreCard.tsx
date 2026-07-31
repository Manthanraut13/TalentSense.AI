import { AlertCircle, CheckCircle2, Shield, XCircle } from 'lucide-react';

import type { ATSCheck } from '../types';

function atsScoreColor(score: number) {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#F97316';
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
    <div className="rounded-lg border border-line bg-surface p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-textSecondary" aria-hidden="true" />
        <h2 className="text-xl font-semibold">ATS Simulator</h2>
        <span className="ml-auto text-xs text-textMuted">Rules-based, not AI</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-5xl font-extrabold" style={{ color }}>
          {atsScore}%
        </div>
        <div>
          <div className="font-semibold text-sm">{atsScoreLabel(atsScore)}</div>
          <div className="mt-0.5 text-xs text-textSecondary">
            {checksPassed}/{checksTotal} requirements met
          </div>
        </div>
      </div>

      {checks.length > 0 ? (
        <div className="space-y-2">
          {checks.map((check) => (
            <div key={check.check} className="flex items-start gap-2.5 text-sm">
              {check.passed ? (
                <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <XCircle size={14} className="mt-0.5 flex-shrink-0 text-red-400" aria-hidden="true" />
              )}
              <div>
                <span className="font-medium">{check.check}: </span>
                <span className="text-textSecondary">{check.detail}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {keywordHits.length > 0 || keywordMisses.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 border-t border-line pt-3">
          <div>
            <div className="mb-2 flex items-center gap-1 text-xs text-textMuted">
              <CheckCircle2 size={10} className="text-primary" aria-hidden="true" /> Keywords Found ({keywordHits.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {keywordHits.slice(0, 6).map((k) => (
                <span key={k} className="rounded border border-primary/20 bg-primary-subtle px-1.5 py-0.5 font-mono text-[10px] text-primary">
                  {k}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1 text-xs text-textMuted">
              <XCircle size={10} className="text-red-400" aria-hidden="true" /> Missing Keywords ({keywordMisses.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {keywordMisses.slice(0, 6).map((k) => (
                <span key={k} className="rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <p className="flex items-center gap-1 text-xs text-textMuted">
        <AlertCircle size={10} aria-hidden="true" />
        ATS simulation uses keyword matching rules, not AI. Results are approximate.
      </p>
    </div>
  );
}
