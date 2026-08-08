import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Briefcase, Check, Copy, Share2 } from 'lucide-react';

import { ResultView } from '../components/ResultView';
import { fetchAnalysis } from '../lib/api';
import type { AnalysisResult } from '../types';
import { useSharing } from '../hooks/useSharing';

export function ResultsPage() {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const { userId, isLoaded } = useAuth();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { shareUrl, enableSharing, disableSharing, isEnabling } = useSharing();

  const handleTrack = () => {
    if (!result?.job_title) return;
    const params = new URLSearchParams({
      role: result.job_title,
      score: String(result.scores.overall),
      analysis_id: result.analysis_id,
    });
    navigate(`/applications?${params.toString()}`);
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!isLoaded || !analysisId) return;

    const cached = window.sessionStorage.getItem(`analysis:${analysisId}`);
    if (cached) {
      setResult(JSON.parse(cached) as AnalysisResult);
      return;
    }

    fetchAnalysis(analysisId)
      .then(setResult)
      .catch(() => setError('Analysis result was not found.'));
  }, [analysisId, isLoaded]);

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-8">
      <div className="mb-6">
        <Link className="text-sm text-primary hover:text-primary-hover" to="/">
          Back to new analysis
        </Link>
      </div>
      {result ? (
        <ResultView
          result={result}
          actions={
            <>
              <button
                onClick={handleTrack}
                className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm text-textSecondary transition hover:border-primary hover:text-primary"
              >
                <Briefcase size={14} aria-hidden="true" />
                Track this job
              </button>
              {!shareUrl ? (
                <button
                  onClick={() => result.analysis_id && enableSharing(result.analysis_id)}
                  disabled={isEnabling}
                  className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm text-textSecondary transition hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  <Share2 size={14} aria-hidden="true" />
                  {isEnabling ? 'Generating link...' : 'Share Results'}
                </button>
              ) : (
                <>
                  <div className="flex min-w-0 items-center gap-2 rounded-lg border border-primary/30 bg-primary-subtle px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-textSecondary">{shareUrl}</span>
                    <button onClick={handleCopy} className="flex-shrink-0 text-primary">
                      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    </button>
                  </div>
                  <button
                    onClick={() => result.analysis_id && disableSharing(result.analysis_id)}
                    className="flex-shrink-0 text-xs text-textMuted transition hover:text-red-600"
                  >
                    Stop sharing
                  </button>
                </>
              )}
            </>
          }
        />
      ) : null}
      {error ? <div className="rounded-lg border border-line bg-surface p-5 text-textSecondary">{error}</div> : null}
      {!result && !error ? <div className="h-40 animate-pulse rounded-lg bg-surface" /> : null}
    </main>
  );
}
