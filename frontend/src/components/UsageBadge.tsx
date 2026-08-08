import { Zap } from 'lucide-react';

import { useUsage } from '../hooks/useUsage';

export default function UsageBadge() {
  const { data: usage, isLoading } = useUsage();

  if (usage?.is_pro) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <Zap size={12} aria-hidden="true" />
        <span>Pro — Unlimited</span>
      </div>
    );
  }

  if (!isLoading && usage && usage.limit > 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <Zap size={12} aria-hidden="true" />
        <span>
          {usage.used} / {usage.limit} analyses
        </span>
      </div>
    );
  }

  return null;
}
