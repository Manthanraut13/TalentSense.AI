import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

import { HistoryItem } from '../components/HistoryItem';
import { fetchHistory } from '../lib/api';
import { formatDate, scoreColorClass } from '../lib/format';
import type { HistoryListResponse, HistoryItem as HistoryItemType } from '../types';

export function HistoryPage() {
  const { userId, isLoaded } = useAuth();
  const [history, setHistory] = useState<HistoryListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !userId) return;

    fetchHistory()
      .then(setHistory)
      .catch(() => setError('Could not load history.'));
  }, [userId, isLoaded]);

  const handleDelete = (analysisId: string) => {
    if (history) {
      setHistory({
        ...history,
        analyses: history.analyses.filter((item: HistoryItemType) => item.analysis_id !== analysisId),
        total: history.total - 1,
      });
    }
  };

  if (!isLoaded) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="text-textSecondary">Loading...</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Analysis History</h1>
          <p className="mt-1 text-sm text-textSecondary">{history?.total ?? 0} analyses</p>
        </div>
        <Link to="/" className="rounded-md border border-line px-3 py-2 text-sm text-textSecondary hover:bg-elevated">
          Back to Home
        </Link>
      </div>

      {error ? <div className="rounded-lg border border-line bg-surface p-5 text-textSecondary">{error}</div> : null}

      {history && history.analyses.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center text-textSecondary">
          No analyses yet. Run your first match analysis from the home page.
        </div>
      ) : null}

      <div className="space-y-3">
        {history?.analyses.map((item: HistoryItemType) => (
          <HistoryItem
            key={item.analysis_id}
            item={item}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </main>
  );
}
