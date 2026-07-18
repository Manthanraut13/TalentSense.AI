import { useEffect, useRef } from 'react';
import { History } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

import { HistoryItem } from './HistoryItem';
import { useQuery } from '@tanstack/react-query';
import { fetchHistory } from '../lib/api';
import type { HistoryListResponse } from '../types';

interface HistorySidebarProps {
  activeAnalysisId?: string;
}

export function HistorySidebar({ activeAnalysisId }: HistorySidebarProps) {
  const { userId, isLoaded } = useAuth();
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { data: history, isLoading, error } = useQuery({
    queryKey: ['history', userId],
    queryFn: () => fetchHistory(),
    enabled: isLoaded && !!userId,
  });

  // Sync scroll position with active item
  useEffect(() => {
    if (activeAnalysisId && sidebarRef.current) {
      const activeElement = sidebarRef.current.querySelector(`[data-analysis-id="${activeAnalysisId}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeAnalysisId]);

  if (!isLoaded || !userId) {
    return (
      <aside className="hidden lg:block w-72 flex-shrink-0 border-r border-line bg-surface flex flex-col">
        <div className="p-4 border-b border-line">
          <h2 className="flex items-center gap-2 font-semibold">
            <History size={20} className="text-primary" />
            Past Analyses
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-center text-textSecondary text-sm">Loading...</div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:block w-72 flex-shrink-0 border-r border-line bg-surface flex flex-col">
      <div className="p-4 border-b border-line">
        <h2 className="flex items-center gap-2 font-semibold">
          <History size={20} className="text-primary" />
          Past Analyses
          {history && history.total > 0 && (
            <span className="ml-auto px-2 py-0.5 text-xs font-medium rounded-full bg-primary/20 text-primary">
              {history.total}
            </span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4" ref={sidebarRef}>
        {history && history.analyses.length === 0 && !isLoading ? (
          <div className="text-center py-8 text-textSecondary">
            <History className="mx-auto mb-3 text-textMuted" size={32} />
            <p className="text-sm">No analyses yet</p>
            <p className="text-xs text-textMuted mt-1">Run your first match analysis</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-line bg-surface p-4 h-24" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-textSecondary text-sm">Could not load history</div>
        ) : (
          <div className="space-y-2">
            {history?.analyses.map((item) => (
              <HistoryItem
                key={item.analysis_id}
                item={item}
                onDelete={() => {}}
                isActive={location.pathname === `/results/${item.analysis_id}`}
                analysisId={item.analysis_id}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
