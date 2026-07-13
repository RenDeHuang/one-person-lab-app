import fs from 'node:fs';
import { sha256File } from './build-artifact-cohort.ts';

const shaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const digestRefPattern = /^sha256:[0-9a-f]{64}$/;

type JsonRecord = Record<string, unknown>;

export type StableDistributionReceiptV1 = {
  schema: 'opl_stable_distribution_receipt.v1';
  status: 'verified';
  stable_session_id: string;
  release: {
    repo: string;
    tag: string;
    version: string;
    public: true;
    latest: false;
    source_release_run_id: string;
  };
  cohort: {
    release_cohort_ref: string;
    app_sha: string;
    shell_sha: string;
    framework_sha: string;
  };
  full_vm: {
    run_id: string;
    evidence_ref: string;
    evidence_sha256: string;
    result: 'passed';
  };
  tap: {
    repo: string;
    commit_sha: string;
    annotated_tag: string;
    standard_cask: StableDistributionCask;
    full_cask: StableDistributionCask;
  };
};

export type StableDistributionCask = {
  path: string;
  version: string;
  sha256: string;
  url: string;
};

export type HomebrewVmActivation = {
  package_profile: 'homebrew-standard' | 'homebrew-full';
  run_id: string;
  evidence_ref: string;
  evidence_sha256: string;
  result: 'passed';
};

export type HomebrewActivationReceiptV1 = {
  schema: 'opl_app_homebrew_activation_receipt.v1';
  status: 'verified';
  stable_session_id: string;
  version: string;
  distribution_receipt_sha256: string;
  standard: HomebrewVmActivation;
  full: HomebrewVmActivation;
};

export type LocalActivationReceiptV1 = {
  schema: 'opl_app_local_activation_receipt.v1';
  status: 'verified';
  stable_session_id: string;
  version: string;
  release_tag: string;
  artifact: {
    package_kind: 'standard' | 'full';
    name: string;
    sha256: string;
    size_bytes: number;
  };
  installation: {
    app_path: '/Applications/One Person Lab.app';
    bundle_id: 'cn.onepersonlab.opl';
    app_asar_sha256: string;
    cf_bundle_version: string;
    cf_bundle_short_version: string;
    codesign_status: 'passed' | 'failed_allowed_unsigned';
    spctl_status: 'passed' | 'rejected_allowed_unsigned' | 'failed_allowed_unsigned';
    local_authorization_policy_ref: string;
    local_authorization_policy_sha256: string;
  };
  readback: {
    cdp_run_id: string;
    evidence_ref: string;
    evidence_sha256: string;
    launch_succeeded: true;
    home_nonempty: true;
    settings_nonempty: true;
    capabilities_nonempty: true;
    starters_interactive: true;
    console_error_count: 0;
    page_error_count: 0;
  };
};

export type PromotionSagaReceiptV1 = {
  schema: 'opl_app_promotion_saga_receipt.v1';
  status: 'verified';
  stable_session_id: string;
  version: string;
  release: {
    repo: 'gaofeng21cn/one-person-lab-app';
    tag: string;
    public: true;
    latest: true;
  };
  distribution: {
    receipt_ref: string;
    receipt_sha256: string;
  };
  homebrew_activation: {
    receipt_ref: string;
    receipt_sha256: string;
    standard_vm_run_id: string;
    full_vm_run_id: string;
  };
  stages: Array<{
    id: 'release_public_nonlatest' | 'distribution_synced' | 'homebrew_verified' | 'latest_activated';
    status: 'verified';
  }>;
};

export type ReceiptExpectation = {
  stableSessionId: string;
  version: string;
  releaseCohortRef?: string;
  appSha?: string;
  shellSha?: string;
  frameworkSha?: string;
  sourceReleaseRunId?: string;
  fullVmRunId?: string;
};

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function validateCask(value: unknown, version: string, expectedPath: string, errors: string[]): void {
  const cask = record(value);
  if (!cask) {
    errors.push(`${expectedPath} cask receipt is missing`);
    return;
  }
  if (string(cask.path) !== expectedPath) errors.push(`${expectedPath} cask path is ${string(cask.path) || '<missing>'}`);
  if (string(cask.version) !== version) errors.push(`${expectedPath} cask version is ${string(cask.version) || '<missing>'}`);
  if (!digestPattern.test(string(cask.sha256))) errors.push(`${expectedPath} cask sha256 is invalid`);
  if (!string(cask.url).startsWith('https://github.com/gaofeng21cn/one-person-lab-app/releases/download/')) {
    errors.push(`${expectedPath} cask URL is outside the App release namespace`);
  }
}

export function validateStableDistributionReceipt(
  value: unknown,
  expected: ReceiptExpectation,
): string[] {
  const receipt = record(value);
  if (!receipt) return ['distribution receipt is not an object'];
  const errors: string[] = [];
  if (receipt.schema !== 'opl_stable_distribution_receipt.v1') errors.push(`distribution receipt schema is ${string(receipt.schema) || '<missing>'}`);
  if (receipt.status !== 'verified') errors.push(`distribution receipt status is ${string(receipt.status) || '<missing>'}`);
  if (receipt.stable_session_id !== expected.stableSessionId || !digestRefPattern.test(string(receipt.stable_session_id))) {
    errors.push(`stable_session_id is ${string(receipt.stable_session_id) || '<missing>'}`);
  }
  const release = record(receipt.release);
  if (!release) errors.push('release section is missing');
  else {
    if (release.repo !== 'gaofeng21cn/one-person-lab-app') errors.push(`release repo is ${string(release.repo) || '<missing>'}`);
    if (release.version !== expected.version) errors.push(`release version is ${string(release.version) || '<missing>'}`);
    if (release.tag !== `v${expected.version}`) errors.push(`release tag is ${string(release.tag) || '<missing>'}`);
    if (release.public !== true) errors.push('release is not public');
    if (release.latest !== false) errors.push('release was marked latest before distribution verification');
    if (expected.sourceReleaseRunId && release.source_release_run_id !== expected.sourceReleaseRunId) errors.push(`source release run is ${string(release.source_release_run_id) || '<missing>'}`);
  }
  const cohort = record(receipt.cohort);
  if (!cohort) errors.push('cohort section is missing');
  else {
    for (const [key, expectedValue] of [
      ['release_cohort_ref', expected.releaseCohortRef],
      ['app_sha', expected.appSha],
      ['shell_sha', expected.shellSha],
      ['framework_sha', expected.frameworkSha],
    ] as const) {
      if (expectedValue && cohort[key] !== expectedValue) errors.push(`${key} is ${string(cohort[key]) || '<missing>'}`);
    }
    if (!digestRefPattern.test(string(cohort.release_cohort_ref))) errors.push('release_cohort_ref is invalid');
    for (const key of ['app_sha', 'shell_sha', 'framework_sha'] as const) {
      if (!shaPattern.test(string(cohort[key]))) errors.push(`${key} is not a full Git SHA`);
    }
  }
  const fullVm = record(receipt.full_vm);
  if (!fullVm) errors.push('full_vm section is missing');
  else {
    if (expected.fullVmRunId && fullVm.run_id !== expected.fullVmRunId) errors.push(`full VM run is ${string(fullVm.run_id) || '<missing>'}`);
    if (!/^\d+$/.test(string(fullVm.run_id))) errors.push('full VM run_id is invalid');
    if (!string(fullVm.evidence_ref)) errors.push('full VM evidence_ref is missing');
    if (!digestPattern.test(string(fullVm.evidence_sha256))) errors.push('full VM evidence_sha256 is invalid');
    if (fullVm.result !== 'passed') errors.push(`full VM result is ${string(fullVm.result) || '<missing>'}`);
  }
  const tap = record(receipt.tap);
  if (!tap) errors.push('tap section is missing');
  else {
    if (tap.repo !== 'gaofeng21cn/homebrew-one-person-lab') errors.push(`tap repo is ${string(tap.repo) || '<missing>'}`);
    if (!shaPattern.test(string(tap.commit_sha))) errors.push('tap commit_sha is invalid');
    if (tap.annotated_tag !== `stable-distribution/v${expected.version}`) errors.push(`tap annotated_tag is ${string(tap.annotated_tag) || '<missing>'}`);
    validateCask(tap.standard_cask, expected.version, 'Casks/one-person-lab.rb', errors);
    validateCask(tap.full_cask, expected.version, 'Casks/one-person-lab-full.rb', errors);
  }
  return errors;
}

function validateVmActivation(value: unknown, profile: HomebrewVmActivation['package_profile'], errors: string[]): void {
  const activation = record(value);
  if (!activation) {
    errors.push(`${profile} activation is missing`);
    return;
  }
  if (activation.package_profile !== profile) errors.push(`${profile} package_profile is ${string(activation.package_profile) || '<missing>'}`);
  if (!/^\d+$/.test(string(activation.run_id))) errors.push(`${profile} run_id is invalid`);
  if (!string(activation.evidence_ref)) errors.push(`${profile} evidence_ref is missing`);
  if (!digestPattern.test(string(activation.evidence_sha256))) errors.push(`${profile} evidence_sha256 is invalid`);
  if (activation.result !== 'passed') errors.push(`${profile} result is ${string(activation.result) || '<missing>'}`);
}

export function validateHomebrewActivationReceipt(value: unknown, expected: ReceiptExpectation & { distributionReceiptSha256: string }): string[] {
  const receipt = record(value);
  if (!receipt) return ['Homebrew activation receipt is not an object'];
  const errors: string[] = [];
  if (receipt.schema !== 'opl_app_homebrew_activation_receipt.v1') errors.push(`Homebrew activation schema is ${string(receipt.schema) || '<missing>'}`);
  if (receipt.status !== 'verified') errors.push(`Homebrew activation status is ${string(receipt.status) || '<missing>'}`);
  if (receipt.stable_session_id !== expected.stableSessionId) errors.push(`stable_session_id is ${string(receipt.stable_session_id) || '<missing>'}`);
  if (receipt.version !== expected.version) errors.push(`version is ${string(receipt.version) || '<missing>'}`);
  if (receipt.distribution_receipt_sha256 !== expected.distributionReceiptSha256) errors.push(`distribution receipt sha256 is ${string(receipt.distribution_receipt_sha256) || '<missing>'}`);
  validateVmActivation(receipt.standard, 'homebrew-standard', errors);
  validateVmActivation(receipt.full, 'homebrew-full', errors);
  return errors;
}

export function validateLocalActivationReceipt(value: unknown, expected: ReceiptExpectation & { artifactSha256?: string; localAuthorizationPolicyPath?: string }): string[] {
  const receipt = record(value);
  if (!receipt) return ['local activation receipt is not an object'];
  const errors: string[] = [];
  if (receipt.schema !== 'opl_app_local_activation_receipt.v1') errors.push(`local activation schema is ${string(receipt.schema) || '<missing>'}`);
  if (receipt.status !== 'verified') errors.push(`local activation status is ${string(receipt.status) || '<missing>'}`);
  if (receipt.stable_session_id !== expected.stableSessionId) errors.push(`stable_session_id is ${string(receipt.stable_session_id) || '<missing>'}`);
  if (receipt.version !== expected.version || receipt.release_tag !== `v${expected.version}`) errors.push('local activation version/tag mismatch');
  const artifact = record(receipt.artifact);
  if (!artifact || (artifact.package_kind !== 'standard' && artifact.package_kind !== 'full')) errors.push('local activation artifact kind is invalid');
  if (!artifact || !string(artifact.name) || !digestPattern.test(string(artifact.sha256)) || !Number.isSafeInteger(artifact.size_bytes) || Number(artifact.size_bytes) <= 0) errors.push('local activation artifact identity is invalid');
  if (expected.artifactSha256 && artifact?.sha256 !== expected.artifactSha256) errors.push(`local artifact sha256 is ${string(artifact?.sha256) || '<missing>'}`);
  const installation = record(receipt.installation);
  if (!installation || installation.app_path !== '/Applications/One Person Lab.app' || installation.bundle_id !== 'cn.onepersonlab.opl') errors.push('installed App identity is invalid');
  if (!installation || !digestPattern.test(string(installation.app_asar_sha256))) errors.push('installed app.asar sha256 is invalid');
  if (!installation || installation.cf_bundle_version !== expected.version) errors.push(`installed CFBundleVersion is ${string(installation?.cf_bundle_version) || '<missing>'}`);
  if (!installation || installation.cf_bundle_short_version !== expected.version) errors.push(`installed CFBundleShortVersionString is ${string(installation?.cf_bundle_short_version) || '<missing>'}`);
  if (!installation || !['passed', 'failed_allowed_unsigned'].includes(string(installation.codesign_status))) errors.push('installed App codesign status is outside local authorization policy');
  if (!installation || !['passed', 'rejected_allowed_unsigned', 'failed_allowed_unsigned'].includes(string(installation.spctl_status))) errors.push('installed App spctl status is outside local authorization policy');
  const expectedPolicyRef = artifact?.package_kind === 'full'
    ? 'full-local-authorization-policy.json'
    : 'standard-local-authorization-policy.json';
  if (!installation || installation.local_authorization_policy_ref !== expectedPolicyRef || !digestPattern.test(string(installation.local_authorization_policy_sha256))) errors.push('local authorization policy ref/digest is invalid');
  if (expected.localAuthorizationPolicyPath) {
    if (!fs.existsSync(expected.localAuthorizationPolicyPath)) errors.push('local authorization policy file is missing');
    else if (installation?.local_authorization_policy_sha256 !== sha256File(expected.localAuthorizationPolicyPath)) errors.push('local authorization policy digest does not match downloaded policy bytes');
  }
  const readback = record(receipt.readback);
  if (!readback || !string(readback.cdp_run_id) || !string(readback.evidence_ref) || !digestPattern.test(string(readback.evidence_sha256))) errors.push('local CDP readback evidence identity is invalid');
  for (const key of ['launch_succeeded', 'home_nonempty', 'settings_nonempty', 'capabilities_nonempty', 'starters_interactive'] as const) {
    if (!readback || readback[key] !== true) errors.push(`local readback ${key} did not pass`);
  }
  if (!readback || readback.console_error_count !== 0 || readback.page_error_count !== 0) errors.push('local readback contains console or page errors');
  return errors;
}

export function validatePromotionSagaReceipt(value: unknown, expected: ReceiptExpectation): string[] {
  const receipt = record(value);
  if (!receipt) return ['promotion saga receipt is not an object'];
  const errors: string[] = [];
  if (receipt.schema !== 'opl_app_promotion_saga_receipt.v1') errors.push(`promotion saga schema is ${string(receipt.schema) || '<missing>'}`);
  if (receipt.status !== 'verified') errors.push(`promotion saga status is ${string(receipt.status) || '<missing>'}`);
  if (receipt.stable_session_id !== expected.stableSessionId) errors.push(`stable_session_id is ${string(receipt.stable_session_id) || '<missing>'}`);
  if (receipt.version !== expected.version) errors.push(`version is ${string(receipt.version) || '<missing>'}`);
  const release = record(receipt.release);
  if (!release || release.repo !== 'gaofeng21cn/one-person-lab-app' || release.tag !== `v${expected.version}` || release.public !== true || release.latest !== true) errors.push('final release readback is not public/latest for the expected tag');
  const distribution = record(receipt.distribution);
  if (!distribution || !string(distribution.receipt_ref) || !digestPattern.test(string(distribution.receipt_sha256))) errors.push('distribution receipt identity is invalid');
  const activation = record(receipt.homebrew_activation);
  if (!activation || !string(activation.receipt_ref) || !digestPattern.test(string(activation.receipt_sha256)) || !/^\d+$/.test(string(activation.standard_vm_run_id)) || !/^\d+$/.test(string(activation.full_vm_run_id))) errors.push('Homebrew activation receipt identity is invalid');
  const stages = Array.isArray(receipt.stages) ? receipt.stages.map(record) : [];
  const expectedStages = ['release_public_nonlatest', 'distribution_synced', 'homebrew_verified', 'latest_activated'];
  if (stages.length !== expectedStages.length || expectedStages.some((id, index) => stages[index]?.id !== id || stages[index]?.status !== 'verified')) errors.push('promotion saga stages are incomplete or out of order');
  return errors;
}

export function receiptFileSha256(filePath: string): string {
  return sha256File(filePath);
}

export function readReceipt(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}
