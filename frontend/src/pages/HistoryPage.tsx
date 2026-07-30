import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

import { HistoryItem } from '../components/HistoryItem';
import { fetchHistory } from '../lib/api';
import type { HistoryListResponse, HistoryItem as HistoryItemType } from '../types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function HistoryPage() {
  const { userId, isLoaded } = useAuth();
  const queryClient = useQueryClient();

  const { data: history, isLoading, error } = useQuery({
    queryKey: ['history', userId],
    queryFn: () => {
      console.debug('[HistoryPage] Fetching history');
      return fetchHistory();
    },
    enabled: isLoaded && !!userId,
  });

  if (error) {
    console.error('[HistoryPage] Failed to load history', error);
  }

  function handleDelete() {
    console.debug('[HistoryPage] History invalidated after delete');
    queryClient.invalidateQueries({ queryKey: ['history', userId] });
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

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-lg border border-line bg-surface p-4 h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {history?.analyses.map((item: HistoryItemType) => (
            <HistoryItem
              key={item.analysis_id}
              item={item}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </main>
  );
}
