export type BudgetStatusMode = 'warning_at_or_above' | 'fail_above' | 'review_above';

export function percent(part: number, total: number) {
  if (!total) return null;
  return Number(((part / total) * 100).toFixed(1));
}

export function budgetStatus(value: number | null, limit: number | null, mode: BudgetStatusMode) {
  if (!Number.isFinite(value) || !Number.isFinite(limit)) return 'unavailable';
  if (mode === 'warning_at_or_above') return (value as number) >= (limit as number) ? 'warning' : 'passed';
  if (mode === 'review_above') return (value as number) > (limit as number) ? 'above_review_threshold' : 'within_review_threshold';
  return (value as number) > (limit as number) ? 'failed' : 'passed';
}
