import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { HistoryItem as HistoryItemType } from '../types';
import { deleteAnalysis } from '../lib/api';
import { formatDate } from '../lib/format';

interface HistoryItemProps {
  item: HistoryItemType;
  onDelete: (analysisId: string) => void;
  isActive?: boolean;
  analysisId?: string;
}

export function HistoryItem({ item, onDelete, isActive, analysisId }: HistoryItemProps) {
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteAnalysis(item.analysis_id),
    onSuccess: () => {
      onDelete(item.analysis_id);
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
    onError: () => {
      alert('Failed to delete analysis. Please try again.');
    },
    onSettled: () => {
      setDeleting(false);
    },
  });

  async function handleDelete(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (deleting) return;

    if (!confirm('Are you sure you want to delete this analysis?')) {
      return;
    }

    setDeleting(true);
    deleteMutation.mutate();
  }

  const scoreColor = item.scores.overall >= 60 ? 'text-green-400' : 'text-amber-400';

  return (
    <div
      data-analysis-id={analysisId}
      className={`relative group rounded-lg border border-line bg-surface p-4 transition hover:bg-elevated ${
        isActive ? 'border-l-2 border-primary bg-primary-subtle' : ''
      }`}
    >
      <Link to={`/results/${item.analysis_id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-textPrimary">{item.job_title}</h2>
            <p className="mt-1 text-sm text-textSecondary">{formatDate(item.timestamp)}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-textSecondary">
              <span className="flex items-center gap-1">
                <span className={`${item.scores.skills_match >= 60 ? 'text-green-400' : 'text-amber-400'}`}>Skills: {item.scores.skills_match}%</span>
              </span>
              <span className="flex items-center gap-1">
                <span className={`${item.scores.experience_relevance >= 60 ? 'text-green-400' : 'text-amber-400'}`}>Exp: {item.scores.experience_relevance}%</span>
              </span>
              <span className="flex items-center gap-1">
                <span className={`${item.scores.keyword_coverage >= 60 ? 'text-green-400' : 'text-amber-400'}`}>KW: {item.scores.keyword_coverage}%</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-mono text-lg font-semibold ${scoreColor} mr-2`}>{item.scores.overall}%</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex h-8 w-8 items-center justify-center rounded-md text-textSecondary transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
              aria-label={`Delete analysis for ${item.job_title}`}
            >
              {deleting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" aria-hidden="true" />
              ) : (
                <Trash2 size={16} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
}