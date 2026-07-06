export type BudgetStatusMode = 'warning_at_or_above' | 'fail_above' | 'review_above';

export function percent(part: number, total: number) {
  if (!total) return null;
  return Number(((part / total) * 100).toFixed(1));
}

export function formatBytes(bytes: number | null | undefined) {
  if (!Number.isFinite(bytes) || bytes === null || bytes === undefined) return 'n/a';
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function budgetStatus(value: number | null, limit: number | null, mode: BudgetStatusMode) {
  if (!Number.isFinite(value) || !Number.isFinite(limit)) return 'unavailable';
  if (mode === 'warning_at_or_above') return (value as number) >= (limit as number) ? 'warning' : 'passed';
  if (mode === 'review_above') return (value as number) > (limit as number) ? 'above_review_threshold' : 'within_review_threshold';
  return (value as number) > (limit as number) ? 'failed' : 'passed';
}
