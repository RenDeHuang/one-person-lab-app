export type FullAddonReceiptV1 = {
  schema: 'opl_app_full_addon_receipt.v1';
  status: 'verified';
  version: string;
  stable_session_id: string;
  release_cohort_ref: string;
  cohort: { app_sha: string; shell_sha: string; framework_sha: string };
  release_set: { generation: string; manifest_digest: string };
  source_authority: {
    qualification_input_manifest_sha256: string;
    full_input_manifest_sha256: string;
    framework_bundled_catalog_sha256: string;
    full_toolchain_observation_receipt_sha256: string;
  };
  qualification: { run_id: string; source_artifact_run_id: string; result: 'passed' };
};

export function validateFullAddonReceipt(
  value: unknown,
  expected: {
    version: string; stableSessionId: string; releaseCohortRef: string;
    appSha: string; shellSha: string; frameworkSha: string;
    runId: string; releaseSetGeneration: string; releaseSetManifestDigest: string;
    qualificationInputManifestDigest: string; fullInputManifestDigest: string;
    frameworkBundledCatalogDigest: string; fullToolchainObservationReceiptDigest: string;
  },
): string[] {
  if (!value || typeof value !== 'object') return ['Full add-on receipt is missing'];
  const receipt = value as Partial<FullAddonReceiptV1>;
  const errors: string[] = [];
  if (receipt.schema !== 'opl_app_full_addon_receipt.v1') errors.push(`Full add-on receipt schema is ${String(receipt.schema)}`);
  if (receipt.status !== 'verified') errors.push(`Full add-on receipt status is ${String(receipt.status)}`);
  if (receipt.version !== expected.version) errors.push('Full add-on receipt version does not match');
  if (receipt.stable_session_id !== expected.stableSessionId) errors.push('Full add-on stable session id does not match');
  if (receipt.release_cohort_ref !== expected.releaseCohortRef) errors.push('Full add-on cohort ref does not match');
  if (receipt.cohort?.app_sha !== expected.appSha || receipt.cohort?.shell_sha !== expected.shellSha || receipt.cohort?.framework_sha !== expected.frameworkSha) {
    errors.push('Full add-on source cohort does not match');
  }
  if (receipt.release_set?.generation !== expected.releaseSetGeneration || receipt.release_set?.manifest_digest !== expected.releaseSetManifestDigest) {
    errors.push('Full add-on Release Set identity does not match');
  }
  if (
    receipt.source_authority?.qualification_input_manifest_sha256 !== expected.qualificationInputManifestDigest ||
    receipt.source_authority?.full_input_manifest_sha256 !== expected.fullInputManifestDigest ||
    receipt.source_authority?.framework_bundled_catalog_sha256 !== expected.frameworkBundledCatalogDigest ||
    receipt.source_authority?.full_toolchain_observation_receipt_sha256 !== expected.fullToolchainObservationReceiptDigest
  ) errors.push('Full add-on frozen source authority digests do not match');
  if (
    receipt.qualification?.run_id !== expected.runId ||
    receipt.qualification?.source_artifact_run_id !== expected.runId ||
    receipt.qualification?.result !== 'passed'
  ) {
    errors.push('Full add-on qualification identity is invalid');
  }
  return errors;
}
