export type ReleaseNotesPreparationReceiptV1 = {
  schema: 'opl_app_release_notes_prepare_receipt.v1';
  written_at: string;
  status: 'passed' | 'failed';
  identity: {
    version: string | null;
    channel: string | null;
    tag: string | null;
    workflow_run_id: string | null;
  };
  provider: {
    kind: string;
    model: string | null;
    max_transport_attempts_per_request: number;
  };
  evidence_sha256: string | null;
  notes_sha256: string | null;
  failure: null | {
    taxonomy: 'transport' | 'quality' | 'configuration' | 'unknown';
    type: string;
    transport_attempts: number | null;
    transport_retry_exhausted: boolean;
    message: string;
  };
};

export function validateReleaseNotesPreparationReceipt(
  receipt: ReleaseNotesPreparationReceiptV1,
  expected: { version: string; runId: string; status?: 'passed' | 'failed' },
): string[] {
  const errors: string[] = [];
  if (receipt?.schema !== 'opl_app_release_notes_prepare_receipt.v1') errors.push('notes preparation receipt schema is invalid');
  if (receipt?.identity?.version !== expected.version) errors.push('notes preparation receipt version is invalid');
  if (receipt?.identity?.tag !== `v${expected.version}`) errors.push('notes preparation receipt tag is invalid');
  if (receipt?.identity?.workflow_run_id !== expected.runId) errors.push('notes preparation receipt run id is invalid');
  if (expected.status && receipt?.status !== expected.status) errors.push('notes preparation receipt status is invalid');
  if (!Number.isInteger(receipt?.provider?.max_transport_attempts_per_request) ||
      receipt.provider.max_transport_attempts_per_request < 1 ||
      receipt.provider.max_transport_attempts_per_request > 3) {
    errors.push('notes preparation receipt transport attempt bound is invalid');
  }
  if (receipt?.status === 'passed') {
    if (!/^[0-9a-f]{64}$/.test(receipt.notes_sha256 ?? '')) errors.push('passed notes preparation receipt lacks notes digest');
    if (receipt.failure !== null) errors.push('passed notes preparation receipt has failure details');
  } else if (receipt?.status === 'failed') {
    if (!receipt.failure) errors.push('failed notes preparation receipt lacks failure details');
    if (receipt.notes_sha256 !== null) errors.push('failed notes preparation receipt must not bind notes bytes');
  }
  return errors;
}
