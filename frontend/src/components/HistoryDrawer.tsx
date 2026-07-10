import { useEffect, useRef } from 'react';
import { X, History } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { HistoryItem } from './HistoryItem';
import { useSession } from '../context/SessionContext';
import { useQuery } from '@tanstack/react-query';
import { fetchHistory } from '../lib/api';
import { formatDate } from '../lib/format';
import type { HistoryListResponse } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HistoryDrawer({ isOpen, onClose }: HistoryDrawerProps) {
  const { sessionId } = useSession();
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['history', sessionId],
    queryFn: () => fetchHistory(sessionId),
  });

  // Close drawer when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="History drawer"
    >
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        className="fixed inset-y-0 right-0 w-full max-w-sm bg-surface border-l border-line shadow-xl flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h2 className="flex items-center gap-2 font-semibold">
            <History size={20} className="text-primary" />
            Past Analyses
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-textSecondary hover:bg-elevated transition"
            aria-label="Close history drawer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
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
                  sessionId={sessionId}
                  isActive={location.pathname === `/results/${item.analysis_id}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}