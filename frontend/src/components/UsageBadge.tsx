import { Zap } from 'lucide-react';

export default function UsageBadge() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
      <Zap size={12} />
      <span>Pro — Unlimited</span>
    </div>
  );
}
