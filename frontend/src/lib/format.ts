export function scoreLabel(score: number) {
  if (score >= 80) return 'Strong match';
  if (score >= 60) return 'Moderate match';
  if (score >= 40) return 'Weak match';
  return 'Poor match';
}

export function scoreColorClass(score: number) {
  if (score >= 80) return 'text-primary';
  if (score >= 60) return 'text-secondary';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
