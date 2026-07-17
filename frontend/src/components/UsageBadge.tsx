import { useUsage } from '../hooks/useUsage';
import { Zap } from 'lucide-react';

export default function UsageBadge() {
  const { data: usage } = useUsage();

  if (!usage) return null;
  if (usage.is_pro) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <Zap size={12} />
        <span>Pro — Unlimited</span>
      </div>
    );
  }

  const isNearLimit = usage.remaining <= 1;
  const isAtLimit = usage.remaining === 0;

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${
      isAtLimit ? 'text-red-400' :
      isNearLimit ? 'text-amber-400' :
      'text-textSecondary'
    }`}>
      <Zap size={12} />
      <span>
        {isAtLimit
          ? 'Daily limit reached'
          : `${usage.remaining} of ${usage.limit} analyses left today`}
      </span>
    </div>
  );
}