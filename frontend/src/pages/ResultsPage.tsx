import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ResultView } from '../components/ResultView';
import { fetchAnalysis } from '../lib/api';
import { useSession } from '../context/SessionContext';
import type { AnalysisResult } from '../types';

export function ResultsPage() {
  const { analysisId } = useParams();
  const { sessionId } = useSession();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisId) return;

    const cached = window.sessionStorage.getItem(`analysis:${analysisId}`);
    if (cached) {
      setResult(JSON.parse(cached) as AnalysisResult);
      return;
    }

    fetchAnalysis(sessionId, analysisId)
      .then(setResult)
      .catch(() => setError('Analysis result was not found.'));
  }, [analysisId, sessionId]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <Link className="text-sm text-primary hover:text-primary-hover" to="/">
          Back to new analysis
        </Link>
      </div>
      {result ? <ResultView result={result} /> : null}
      {error ? <div className="rounded-lg border border-line bg-surface p-5 text-textSecondary">{error}</div> : null}
      {!result && !error ? <div className="h-40 animate-pulse rounded-lg bg-surface" /> : null}
    </main>
  );
}
