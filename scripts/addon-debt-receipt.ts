export type AddonDebtReceiptV1 = {
  schema: 'opl_app_addon_debt_receipt.v1';
  status: 'blocked_with_debt';
  stable_session_id: string;
  release_cohort_ref: string;
  addon: 'full' | 'webui';
  source_status: 'failed' | 'omitted' | 'unavailable';
  source_attempt_id: string | null;
  source_run_id: string | null;
  failure_taxonomy: 'product' | 'fixture' | 'environment' | 'operator' | 'infrastructure' | 'cancelled' | 'unknown' | 'not_implemented';
  disposition_reason: string;
  recorded_at: string;
};

export function validateAddonDebtReceipt(value: unknown, expected: {
  stableSessionId: string;
  releaseCohortRef: string;
  addon: 'full' | 'webui';
  trackStatus: string;
  runId: string | null;
}): string[] {
  if (!value || typeof value !== 'object') return ['add-on debt receipt is missing'];
  const receipt = value as Partial<AddonDebtReceiptV1>;
  const errors: string[] = [];
  if (receipt.schema !== 'opl_app_addon_debt_receipt.v1') errors.push('add-on debt receipt schema is invalid');
  if (receipt.status !== 'blocked_with_debt') errors.push('add-on debt receipt status is invalid');
  if (receipt.stable_session_id !== expected.stableSessionId) errors.push('add-on debt receipt stable session id does not match');
  if (receipt.release_cohort_ref !== expected.releaseCohortRef) errors.push('add-on debt receipt release cohort ref does not match');
  if (receipt.addon !== expected.addon) errors.push('add-on debt receipt target does not match');
  if (!['failed', 'omitted', 'unavailable'].includes(String(receipt.source_status))) errors.push('add-on debt receipt source status is invalid');
  if (expected.trackStatus === 'failed' && receipt.source_status !== 'failed') errors.push('failed add-on track requires a failed typed debt source status');
  if (expected.runId && receipt.source_run_id !== expected.runId) errors.push('add-on debt receipt source run id does not match');
  if (receipt.source_attempt_id !== null && (typeof receipt.source_attempt_id !== 'string' || !receipt.source_attempt_id.trim())) errors.push('add-on debt receipt source attempt id is invalid');
  if (receipt.source_run_id !== null && (typeof receipt.source_run_id !== 'string' || !/^\d+$/.test(receipt.source_run_id))) errors.push('add-on debt receipt source run id is invalid');
  if (!['product', 'fixture', 'environment', 'operator', 'infrastructure', 'cancelled', 'unknown', 'not_implemented'].includes(String(receipt.failure_taxonomy))) errors.push('add-on debt receipt failure taxonomy is invalid');
  if (typeof receipt.disposition_reason !== 'string' || !receipt.disposition_reason.trim()) errors.push('add-on debt receipt disposition reason is missing');
  if (typeof receipt.recorded_at !== 'string' || !Number.isFinite(Date.parse(receipt.recorded_at))) errors.push('add-on debt receipt timestamp is invalid');
  return errors;
}
