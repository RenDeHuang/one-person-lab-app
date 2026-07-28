#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  releaseCalendarParts,
  resolveReleaseVersionIdentity,
  resolveStableReleaseVersion,
} from './release-version.ts';
import {
  assertPromotionTargetIsNewerThanPublishedStable,
  type PublishedRelease,
} from './stable-release-version-order.ts';
import {
  readOwnerWorkflowRuns,
} from './release-dispatch-guard.ts';
import { validateReleaseHomebrewDistribution } from './validate-active-shell/release-homebrew-distribution-validator.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRepository = 'gaofeng21cn/one-person-lab-app';
const shellRepository = 'gaofeng21cn/opl-aion-shell';
const frameworkRepository = 'gaofeng21cn/one-person-lab';
const homebrewRepository = 'gaofeng21cn/homebrew-one-person-lab';
const homebrewCaskPath = 'Casks/one-person-lab.rb';
const webuiRepository = 'ghcr.io/gaofeng21cn/one-person-lab-webui';
const shaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const requiredSecretNames = [
  'BUILD_CERTIFICATE_BASE64',
  'P12_PASSWORD',
  'APPLE_ID',
  'APPLE_ID_PASSWORD',
  'TEAM_ID',
  'IDENTITY',
] as const;
const requiredWorkflowPaths = [
  '.github/workflows/release-stable.yml',
  '.github/workflows/_release-bundle.yml',
  '.github/workflows/_release-standard-publish.yml',
  'scripts/validate-release-source-gate.ts',
  'scripts/stable-release-admission-manifest.ts',
  'scripts/release-dispatch-guard.ts',
  'scripts/stable-operation-control.ts',
  'scripts/verify-apple-release-credentials.ts',
  'contracts/app-release-channel.json',
] as const;
const activeReleaseStatuses = ['queued', 'in_progress', 'waiting', 'pending'] as const;

type JsonRecord = Record<string, any>;
type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

export type StableAdmissionInput = {
  baseVersion: string;
  appRef: string;
  shellRef: string;
  frameworkRef: string;
  admissionRunId: string;
};

export type WorkflowBlob = {
  path: string;
  git_blob_sha: string;
  sha256: string;
};

export type ActiveReleaseRun = {
  id: number;
  path: string;
  status: string;
  head_sha: string;
};

export type StableAdmissionObservation = {
  checkedAt: string;
  currentDate: string;
  workflowBlobs: WorkflowBlob[];
  sourceGate: JsonRecord;
  sourceGateBytes: Buffer;
  credentialReceipt: JsonRecord;
  credentialReceiptBytes: Buffer;
  publishedReleases: PublishedRelease[];
  tagRefs: string[];
  webuiTags: string[];
  homebrewCask: {
    repository: string;
    path: string;
    git_blob_sha: string;
    bytes: Buffer;
  };
  homebrewPolicy: JsonRecord;
  activeReleaseRuns: ActiveReleaseRun[];
};

export type StableAdmissionManifest = {
  schema: 'opl_stable_release_admission_manifest.v1';
  status: 'passed';
  checked_at: string;
  operation: 'standard';
  version: {
    base: string;
    display: string;
    updater: string;
    tag: string;
    current_date: string;
    revision: number;
  };
  cohort: {
    app_sha: string;
    shell_sha: string;
    framework_sha: string;
  };
  workflow_blobs: WorkflowBlob[];
  apple_credentials: {
    producer_run_id: string;
    producer_workflow: '.github/workflows/release-stable.yml';
    protected_environment: 'release-stable';
    executor_sha: string;
    receipt_sha256: string;
    required_secret_names: string[];
    required_secret_count: 6;
    signing_status: 'passed';
    notarization_authentication: 'passed';
    submission_performed: false;
  };
  source_gate: {
    producer_run_id: string;
    producer_workflow: '.github/workflows/release-stable.yml';
    artifact_name: string;
    source_gate_digest: string;
    source_gate_file_sha256: string;
    operation_fingerprint: string;
    frozen_cohort_reachable: true;
    full_source_gate_rerun: false;
    release_authority: false;
    namespace_reservation: false;
    final_signed_byte_authority: false;
  };
  allocator: {
    observed_namespace_versions: string[];
    observed_same_day_versions: string[];
    highest_published_stable: string;
    selected_version: string;
    selected_updater_version: string;
  };
  namespace: {
    github_release_tags: string[];
    github_tag_refs: string[];
    webui_tags: string[];
    homebrew_standard_cask_version: string;
    target_release_absent: true;
    target_tag_absent: true;
    target_webui_tag_absent: true;
    target_homebrew_version_absent: true;
  };
  homebrew_policy: {
    repository: string;
    cask_path: string;
    cask_git_blob_sha: string;
    cask_sha256: string;
    contract_sha256: string;
    standard_cask_install_ref: string;
    mutation_owner: string;
    write_mode: string;
  };
  active_release_runs: [];
  dispatcher_contract: {
    workflow: '.github/workflows/release-stable.yml';
    ref: 'main';
    artifact_name: string;
    accepted_inputs: ['operation', 'authority_id', 'operation_id', 'authority_carrier', 'authority_digest'];
    raw_standard_version_or_ref_inputs_allowed: false;
    unknown_result_policy: 'read_only_reconcile_without_rerun_redispatch_or_cancel';
  };
  manifest_digest: string;
};

function object(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as JsonRecord;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is missing.`);
  return value.trim();
}

function fullSha(value: unknown, label: string): string {
  const normalized = requiredString(value, label).toLowerCase();
  if (!shaPattern.test(normalized)) throw new Error(`${label} must be an exact lowercase 40-character Git SHA.`);
  return normalized;
}

function runId(value: unknown, label: string): string {
  const normalized = requiredString(value, label);
  if (!/^[1-9][0-9]*$/.test(normalized)) throw new Error(`${label} must be a positive GitHub Actions run id.`);
  return normalized;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as JsonRecord;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function sha256Bytes(bytes: Buffer | string): string {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

export function stableAdmissionManifestDigest(value: Omit<StableAdmissionManifest, 'manifest_digest'>): string {
  return sha256Bytes(canonicalJson(value));
}

function sameStringSet(actual: unknown, expected: readonly string[]): boolean {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((entry) => typeof entry === 'string')
    && expected.every((entry) => actual.includes(entry));
}

function validateCredentialReceipt(
  receiptValue: unknown,
  input: StableAdmissionInput,
): { executorSha: string } {
  const receipt = object(receiptValue, 'Apple credential preflight receipt');
  const execution = object(receipt.execution, 'Apple credential preflight receipt execution');
  const signing = object(receipt.signing, 'Apple credential preflight receipt signing');
  const notarization = object(receipt.notarization, 'Apple credential preflight receipt notarization');
  const mutation = object(receipt.mutation, 'Apple credential preflight receipt mutation');
  const executorSha = fullSha(execution.head_sha, 'Apple credential preflight receipt executor SHA');
  if (
    receipt.schema !== 'opl_apple_release_credentials_preflight.v1'
    || receipt.status !== 'passed'
    || receipt.platform !== 'darwin'
    || receipt.protected_environment !== 'release-stable'
    || execution.environment !== 'github_actions'
    || execution.admission_eligible !== true
    || execution.repository !== appRepository
    || typeof execution.workflow_ref !== 'string'
    || !execution.workflow_ref.includes('/.github/workflows/release-stable.yml@refs/heads/main')
    || execution.run_id !== input.admissionRunId
    || execution.run_attempt !== 1
    || execution.event_name !== 'workflow_dispatch'
    || execution.ref !== 'refs/heads/main'
  ) {
    throw new Error('Apple credential receipt is not a first-attempt protected preflight for the App main executor.');
  }
  if (
    receipt.required_secret_count !== requiredSecretNames.length
    || !sameStringSet(receipt.required_secret_names, requiredSecretNames)
  ) {
    throw new Error('Apple credential receipt must prove the exact 6/6 protected secret names.');
  }
  if (
    signing.configured_identity_selector_resolved !== true
    || signing.configured_team_id_match !== true
    || signing.developer_id_application !== true
    || signing.hardened_runtime !== true
    || signing.trusted_timestamp !== true
    || signing.probe_codesign_strict !== 'passed'
  ) {
    throw new Error('Apple credential receipt does not prove the exact Developer ID signing runtime.');
  }
  if (
    notarization.authentication !== 'passed'
    || notarization.command !== 'xcrun notarytool history'
    || notarization.submission_performed !== false
    || mutation.release_dispatch_performed !== false
    || mutation.notarization_submission_performed !== false
    || mutation.public_asset_write_performed !== false
  ) {
    throw new Error('Apple credential receipt must prove read-only notarization authentication and zero release mutation.');
  }
  return { executorSha };
}

function normalizeVersionRef(value: string): string {
  return value.trim()
    .replace(/^refs\/tags\//, '')
    .replace(/\^\{\}$/, '')
    .replace(/^v/, '');
}

function baseVersionForDate(currentDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(currentDate);
  if (!match) throw new Error(`Admission current date must use YYYY-MM-DD, got ${currentDate}.`);
  return `${Number(match[1]) - 2000}.${Number(match[2])}.${Number(match[3])}`;
}

function sameDayVersions(baseVersion: string, refs: Iterable<string>): string[] {
  const escaped = baseVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}(?:-r[1-9])?$`);
  return [...new Set([...refs].map(normalizeVersionRef).filter((entry) => pattern.test(entry)))].sort();
}

function caskVersion(bytes: Buffer): string {
  const version = bytes.toString('utf8').match(/^\s*version\s+"([^"]+)"\s*$/m)?.[1] ?? '';
  if (!version) throw new Error('Homebrew Standard cask does not declare one literal version.');
  return version;
}

function validateWorkflowBlobs(blobs: WorkflowBlob[]): WorkflowBlob[] {
  const sorted = [...blobs].sort((left, right) => left.path.localeCompare(right.path));
  if (
    sorted.length !== requiredWorkflowPaths.length
    || !requiredWorkflowPaths.every((workflowPath) => sorted.some((entry) => entry.path === workflowPath))
  ) {
    throw new Error('Stable admission must bind the exact critical workflow, credential, contract, and verifier files.');
  }
  for (const entry of sorted) {
    fullSha(entry.git_blob_sha, `Git blob ${entry.path}`);
    if (!digestPattern.test(entry.sha256)) throw new Error(`Workflow file ${entry.path} has an invalid SHA-256.`);
  }
  return sorted;
}

function validateFrozenSourceGate(
  value: JsonRecord,
  expected: { appRef: string; shellRef: string; frameworkRef: string },
): {
  operationFingerprint: string;
} {
  const cohort = object(value.admission?.immutable_cohort, 'Frozen source-gate cohort');
  const frozenAppReachable = Array.isArray(value.checks) && value.checks.some(
    (check: unknown) => check !== null
      && typeof check === 'object'
      && !Array.isArray(check)
      && (check as JsonRecord).id === 'app_frozen_commit_reachable'
      && (check as JsonRecord).status === 'passed',
  );
  const operationFingerprint = requiredString(value.operation_fingerprint, 'Frozen source-gate operation fingerprint');
  if (
    value.schema !== 'opl_app_release_source_gate.v1'
    || value.status !== 'passed'
    || value.typed_blocker !== null
    || value.admission?.status !== 'passed'
    || cohort.app_sha !== expected.appRef
    || cohort.shell_sha !== expected.shellRef
    || cohort.framework_sha !== expected.frameworkRef
    || !frozenAppReachable
  ) {
    throw new Error('Frozen source-gate evidence does not prove the exact reachable Stable cohort.');
  }
  return { operationFingerprint };
}

export function buildStableReleaseAdmissionManifest(
  inputValue: StableAdmissionInput,
  observation: StableAdmissionObservation,
): StableAdmissionManifest {
  const input = {
    baseVersion: requiredString(inputValue.baseVersion, 'Stable base version'),
    appRef: fullSha(inputValue.appRef, 'App ref'),
    shellRef: fullSha(inputValue.shellRef, 'Shell ref'),
    frameworkRef: fullSha(inputValue.frameworkRef, 'Framework ref'),
    admissionRunId: runId(inputValue.admissionRunId, 'Admission run id'),
  };
  if (input.baseVersion !== baseVersionForDate(observation.currentDate)) {
    throw new Error(
      `Stable admission base version ${input.baseVersion} must match Asia/Shanghai date ${observation.currentDate}.`,
    );
  }
  const workflowBlobs = validateWorkflowBlobs(observation.workflowBlobs);
  const sourceGate = validateFrozenSourceGate(observation.sourceGate, input);
  const credentialReceipt = validateCredentialReceipt(observation.credentialReceipt, input);
  if (observation.activeReleaseRuns.length > 0) {
    throw new Error(
      `Stable admission requires zero other active release runs; found ${observation.activeReleaseRuns
        .map((entry) => `${entry.id}:${entry.status}:${entry.path}`)
        .join(', ')}.`,
    );
  }

  validateReleaseHomebrewDistribution(observation.homebrewPolicy);
  if (
    observation.homebrewCask.repository !== homebrewRepository
    || observation.homebrewCask.path !== homebrewCaskPath
  ) {
    throw new Error('Homebrew Standard cask observation is outside the contracted repository or path.');
  }
  const homebrewVersion = caskVersion(observation.homebrewCask.bytes);
  const publishedTags = observation.publishedReleases
    .map((release) => release.tagName ?? release.tag_name ?? '')
    .filter(Boolean);
  const namespaceRefs = [
    ...publishedTags,
    ...observation.tagRefs,
    ...observation.webuiTags,
    homebrewVersion,
  ];
  const resolution = resolveStableReleaseVersion(input.baseVersion, namespaceRefs);
  const highest = assertPromotionTargetIsNewerThanPublishedStable(
    resolution.version,
    observation.publishedReleases,
  );
  const identity = resolveReleaseVersionIdentity('stable', resolution.version);
  const selectedVersion = resolution.version;
  const normalizedPublishedTags = publishedTags.map(normalizeVersionRef);
  const normalizedTagRefs = observation.tagRefs.map(normalizeVersionRef);
  const normalizedWebuiTags = observation.webuiTags.map(normalizeVersionRef);
  if (
    normalizedPublishedTags.includes(selectedVersion)
    || normalizedTagRefs.includes(selectedVersion)
    || normalizedWebuiTags.includes(selectedVersion)
    || normalizeVersionRef(homebrewVersion) === selectedVersion
  ) {
    throw new Error(`Allocated Stable version ${selectedVersion} is already occupied in a release namespace.`);
  }
  const homebrewPolicy = object(
    observation.homebrewPolicy.homebrew_tap_distribution,
    'App Homebrew release policy',
  );
  const caskPolicy = object(homebrewPolicy.cask_install_policy, 'Homebrew cask install policy');
  const tapPolicy = object(homebrewPolicy.tap_update_policy, 'Homebrew tap update policy');
  const sameDay = sameDayVersions(input.baseVersion, namespaceRefs);
  const observedNamespaceVersions = [...new Set(namespaceRefs.map(normalizeVersionRef))].sort();
  const core: Omit<StableAdmissionManifest, 'manifest_digest'> = {
    schema: 'opl_stable_release_admission_manifest.v1',
    status: 'passed',
    checked_at: observation.checkedAt,
    operation: 'standard',
    version: {
      base: input.baseVersion,
      display: selectedVersion,
      updater: identity.updaterVersion,
      tag: identity.tag,
      current_date: observation.currentDate,
      revision: resolution.revision,
    },
    cohort: {
      app_sha: input.appRef,
      shell_sha: input.shellRef,
      framework_sha: input.frameworkRef,
    },
    workflow_blobs: workflowBlobs,
    apple_credentials: {
      producer_run_id: input.admissionRunId,
      producer_workflow: '.github/workflows/release-stable.yml',
      protected_environment: 'release-stable',
      executor_sha: credentialReceipt.executorSha,
      receipt_sha256: sha256Bytes(observation.credentialReceiptBytes),
      required_secret_names: [...requiredSecretNames],
      required_secret_count: 6,
      signing_status: 'passed',
      notarization_authentication: 'passed',
      submission_performed: false,
    },
    source_gate: {
      producer_run_id: input.admissionRunId,
      producer_workflow: '.github/workflows/release-stable.yml',
      artifact_name: `opl-stable-operation-control-${input.admissionRunId}`,
      source_gate_digest: sha256Bytes(observation.sourceGateBytes),
      source_gate_file_sha256: sha256Bytes(observation.sourceGateBytes),
      operation_fingerprint: sourceGate.operationFingerprint,
      frozen_cohort_reachable: true,
      full_source_gate_rerun: false,
      release_authority: false,
      namespace_reservation: false,
      final_signed_byte_authority: false,
    },
    allocator: {
      observed_namespace_versions: observedNamespaceVersions,
      observed_same_day_versions: sameDay,
      highest_published_stable: requiredString(
        highest.tagName,
        'Highest published Stable release',
      ),
      selected_version: selectedVersion,
      selected_updater_version: identity.updaterVersion,
    },
    namespace: {
      github_release_tags: sameDayVersions(input.baseVersion, publishedTags),
      github_tag_refs: sameDayVersions(input.baseVersion, observation.tagRefs),
      webui_tags: sameDayVersions(input.baseVersion, observation.webuiTags),
      homebrew_standard_cask_version: homebrewVersion,
      target_release_absent: true,
      target_tag_absent: true,
      target_webui_tag_absent: true,
      target_homebrew_version_absent: true,
    },
    homebrew_policy: {
      repository: observation.homebrewCask.repository,
      cask_path: observation.homebrewCask.path,
      cask_git_blob_sha: fullSha(
        observation.homebrewCask.git_blob_sha,
        'Homebrew cask Git blob',
      ),
      cask_sha256: sha256Bytes(observation.homebrewCask.bytes),
      contract_sha256: sha256Bytes(canonicalJson(homebrewPolicy)),
      standard_cask_install_ref: requiredString(
        caskPolicy.standard_cask_install_ref,
        'Homebrew standard cask install ref',
      ),
      mutation_owner: requiredString(
        tapPolicy.default_workflow_repo,
        'Homebrew mutation owner',
      ),
      write_mode: requiredString(
        tapPolicy.app_release_workflow_write_mode,
        'Homebrew write mode',
      ),
    },
    active_release_runs: [],
    dispatcher_contract: {
      workflow: '.github/workflows/release-stable.yml',
      ref: 'main',
      artifact_name: `opl-stable-admission-${input.admissionRunId}`,
      accepted_inputs: ['operation', 'authority_id', 'operation_id', 'authority_carrier', 'authority_digest'],
      raw_standard_version_or_ref_inputs_allowed: false,
      unknown_result_policy: 'read_only_reconcile_without_rerun_redispatch_or_cancel',
    },
  };
  return {
    ...core,
    manifest_digest: stableAdmissionManifestDigest(core),
  };
}

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    encoding: 'utf8',
    env: process.env,
    timeout: 45_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`);
  }
  return result.stdout;
}

export function parseGitHubJsonLookup(endpoint: string, result: CommandResult): unknown {
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n').trim();
    throw new Error(`GitHub lookup ${endpoint} failed${detail ? `:\n${detail}` : ''}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`GitHub lookup ${endpoint} did not return JSON.`);
  }
}

function ghJson(endpoint: string, fields: Record<string, string> = {}): unknown {
  const args = ['api', '-X', 'GET', endpoint];
  for (const [key, value] of Object.entries(fields)) args.push('-f', `${key}=${value}`);
  const result = spawnSync('gh', args, {
    cwd: appRoot,
    encoding: 'utf8',
    env: process.env,
    timeout: 45_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return parseGitHubJsonLookup(endpoint, {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error,
  });
}

function localWorkflowBlobs(appRef: string): WorkflowBlob[] {
  const head = fullSha(run('git', ['rev-parse', 'HEAD']).trim(), 'Local App HEAD');
  if (head !== appRef) throw new Error(`Local App HEAD ${head} does not match admission App ref ${appRef}.`);
  return requiredWorkflowPaths.map((workflowPath) => {
    const bytes = Buffer.from(run('git', ['show', `${appRef}:${workflowPath}`]));
    const gitBlobSha = fullSha(
      run('git', ['rev-parse', `${appRef}:${workflowPath}`]).trim(),
      `Git blob ${workflowPath}`,
    );
    return {
      path: workflowPath,
      git_blob_sha: gitBlobSha,
      sha256: sha256Bytes(bytes),
    };
  });
}

function publishedReleases(): PublishedRelease[] {
  const payload = ghJson(`repos/${appRepository}/releases`, { per_page: '100' });
  if (!Array.isArray(payload)) throw new Error('GitHub releases lookup did not return an array.');
  return payload.map((entry, index) => {
    const release = object(entry, `GitHub release ${index}`);
    return {
      tag_name: requiredString(release.tag_name, `GitHub release ${index} tag`),
      draft: release.draft === true,
      prerelease: release.prerelease === true,
    };
  });
}

function matchingTagRefs(baseVersion: string): string[] {
  const payload = ghJson(`repos/${appRepository}/git/matching-refs/tags/v${baseVersion}`);
  if (!Array.isArray(payload)) throw new Error('GitHub matching tag lookup did not return an array.');
  return payload.map((entry, index) => requiredString(
    object(entry, `GitHub tag ref ${index}`).ref,
    `GitHub tag ref ${index}`,
  ));
}

async function anonymousWebuiTags(): Promise<string[]> {
  const tokenResponse = await fetch(
    'https://ghcr.io/token?scope=repository:gaofeng21cn/one-person-lab-webui:pull',
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!tokenResponse.ok) throw new Error(`Anonymous GHCR token lookup failed with HTTP ${tokenResponse.status}.`);
  const token = requiredString(
    object(await tokenResponse.json(), 'Anonymous GHCR token response').token,
    'Anonymous GHCR token',
  );
  const tags = new Set<string>();
  const visited = new Set<string>();
  let nextUrl: string | null =
    'https://ghcr.io/v2/gaofeng21cn/one-person-lab-webui/tags/list?n=1000';
  for (let page = 0; nextUrl; page += 1) {
    if (page >= 20 || visited.has(nextUrl)) {
      throw new Error('Anonymous GHCR tag pagination exceeded its bounded unique-page limit.');
    }
    visited.add(nextUrl);
    const tagsResponse = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!tagsResponse.ok) throw new Error(`Anonymous GHCR tag lookup failed with HTTP ${tagsResponse.status}.`);
    const pageTags = object(await tagsResponse.json(), 'Anonymous GHCR tag response').tags;
    if (!Array.isArray(pageTags) || !pageTags.every((entry) => typeof entry === 'string')) {
      throw new Error('Anonymous GHCR tag lookup did not return string tags.');
    }
    for (const tag of pageTags) tags.add(tag);
    const nextLink = tagsResponse.headers.get('link')
      ?.split(',')
      .map((entry) => entry.trim())
      .find((entry) => /;\s*rel="next"$/.test(entry))
      ?.match(/^<([^>]+)>/)?.[1] ?? null;
    if (!nextLink) {
      nextUrl = null;
      continue;
    }
    const resolved = new URL(nextLink, nextUrl);
    if (
      resolved.protocol !== 'https:'
      || resolved.host !== 'ghcr.io'
      || resolved.pathname !== '/v2/gaofeng21cn/one-person-lab-webui/tags/list'
    ) {
      throw new Error('Anonymous GHCR tag pagination escaped the exact public WebUI namespace.');
    }
    nextUrl = resolved.href;
  }
  return [...tags].sort();
}

function homebrewCaskObservation(): StableAdmissionObservation['homebrewCask'] {
  const payload = object(
    ghJson(`repos/${homebrewRepository}/contents/${homebrewCaskPath}`, { ref: 'main' }),
    'Homebrew Standard cask lookup',
  );
  if (payload.encoding !== 'base64') throw new Error('Homebrew Standard cask lookup is not base64 encoded.');
  return {
    repository: homebrewRepository,
    path: homebrewCaskPath,
    git_blob_sha: fullSha(payload.sha, 'Homebrew Standard cask Git blob'),
    bytes: Buffer.from(requiredString(payload.content, 'Homebrew Standard cask content').replace(/\s+/g, ''), 'base64'),
  };
}

function isReleaseWorkflowPath(value: string): boolean {
  const workflowPath = value.split('@')[0] ?? '';
  return /^\.github\/workflows\/release-[^/]+\.ya?ml$/.test(workflowPath);
}

function activeReleaseRuns(excludedRunId: string): ActiveReleaseRun[] {
  const runs = new Map<number, ActiveReleaseRun>();
  const lookup = readOwnerWorkflowRuns({ maxAttempts: 3, cwd: appRoot });
  if (lookup.status === 'failed') {
    throw new Error(
      `Owner Actions lookup failed as ${lookup.failure_kind}/${lookup.failure_code}: ${lookup.detail}`,
    );
  }
  for (const entry of lookup.runs) {
    const candidate = object(entry, 'GitHub Actions run');
    const id = Number(candidate.id);
    const runPath = requiredString(candidate.path, 'GitHub Actions run path');
    const status = requiredString(candidate.status, 'GitHub Actions run status');
    if (
      !Number.isSafeInteger(id)
      || id <= 0
      || String(id) === excludedRunId
      || !isReleaseWorkflowPath(runPath)
      || !activeReleaseStatuses.includes(status as (typeof activeReleaseStatuses)[number])
    ) {
      continue;
    }
    runs.set(id, {
      id,
      path: runPath.split('@')[0]!,
      status,
      head_sha: fullSha(candidate.head_sha, 'GitHub Actions run head'),
    });
  }
  return [...runs.values()].sort((left, right) => left.id - right.id);
}

function shanghaiDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function collectObservation(
  input: StableAdmissionInput,
  sourceGatePath: string,
  credentialReceiptPath: string,
  excludedRunId: string,
  checkedAt = new Date().toISOString(),
): Promise<StableAdmissionObservation> {
  const sourceGateBytes = fs.readFileSync(sourceGatePath);
  const credentialReceiptBytes = fs.readFileSync(credentialReceiptPath);
  const releaseContractBytes = fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'));
  const releaseContract = object(JSON.parse(releaseContractBytes.toString('utf8')), 'App release contract');
  return {
    checkedAt,
    currentDate: shanghaiDate(),
    workflowBlobs: localWorkflowBlobs(input.appRef),
    sourceGate: object(
      JSON.parse(sourceGateBytes.toString('utf8')),
      'Frozen source-gate evidence',
    ),
    sourceGateBytes,
    credentialReceipt: object(
      JSON.parse(credentialReceiptBytes.toString('utf8')),
      'Apple credential receipt',
    ),
    credentialReceiptBytes,
    publishedReleases: publishedReleases(),
    tagRefs: matchingTagRefs(input.baseVersion),
    webuiTags: await anonymousWebuiTags(),
    homebrewCask: homebrewCaskObservation(),
    homebrewPolicy: releaseContract,
    activeReleaseRuns: activeReleaseRuns(excludedRunId),
  };
}

export function firstDifference(actual: unknown, expected: unknown, pointer = '$'): string | null {
  if (Object.is(actual, expected)) return null;
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return `${pointer}.length`;
    for (let index = 0; index < actual.length; index += 1) {
      const difference = firstDifference(actual[index], expected[index], `${pointer}[${index}]`);
      if (difference) return difference;
    }
    return null;
  }
  if (
    actual && expected
    && typeof actual === 'object' && typeof expected === 'object'
    && !Array.isArray(actual) && !Array.isArray(expected)
  ) {
    const keys = [...new Set([
      ...Object.keys(actual as JsonRecord),
      ...Object.keys(expected as JsonRecord),
    ])].sort();
    for (const key of keys) {
      const difference = firstDifference(
        (actual as JsonRecord)[key],
        (expected as JsonRecord)[key],
        `${pointer}.${key}`,
      );
      if (difference) return difference;
    }
    return null;
  }
  return pointer;
}

export async function verifyStableReleaseAdmissionManifest(options: {
  manifest: StableAdmissionManifest;
  sourceGatePath: string;
  credentialReceiptPath: string;
  expectedDigest: string;
  currentRunId: string;
}): Promise<StableAdmissionManifest> {
  if (!digestPattern.test(options.expectedDigest)) {
    throw new Error('Expected admission manifest digest must use sha256:<64 lowercase hex>.');
  }
  const manifest = object(options.manifest, 'Stable admission manifest') as StableAdmissionManifest;
  if (manifest.schema !== 'opl_stable_release_admission_manifest.v1' || manifest.status !== 'passed') {
    throw new Error('Stable admission manifest schema or status is invalid.');
  }
  const { manifest_digest: declaredDigest, ...core } = manifest;
  const computedDigest = stableAdmissionManifestDigest(
    core as Omit<StableAdmissionManifest, 'manifest_digest'>,
  );
  if (declaredDigest !== computedDigest || options.expectedDigest !== computedDigest) {
    throw new Error(
      `Stable admission manifest digest mismatch: declared=${declaredDigest} expected=${options.expectedDigest} computed=${computedDigest}.`,
    );
  }
  const input: StableAdmissionInput = {
    baseVersion: manifest.version.base,
    appRef: manifest.cohort.app_sha,
    shellRef: manifest.cohort.shell_sha,
    frameworkRef: manifest.cohort.framework_sha,
    admissionRunId: manifest.apple_credentials.producer_run_id,
  };
  const observation = await collectObservation(
    input,
    options.sourceGatePath,
    options.credentialReceiptPath,
    runId(options.currentRunId, 'Current Standard run id'),
    manifest.checked_at,
  );
  const rebuilt = buildStableReleaseAdmissionManifest(input, observation);
  const difference = firstDifference(manifest, rebuilt);
  if (difference) {
    throw new Error(`Stable admission manifest drifted from fresh production truth at ${difference}.`);
  }
  return rebuilt;
}

function writeJson(filePath: string, value: unknown): void {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function cliOptions() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    strict: true,
    options: {
      'base-version': { type: 'string' },
      'app-ref': { type: 'string' },
      'shell-ref': { type: 'string' },
      'framework-ref': { type: 'string' },
      'admission-run-id': { type: 'string' },
      'source-gate': { type: 'string' },
      'credential-receipt': { type: 'string' },
      manifest: { type: 'string' },
      'expected-digest': { type: 'string' },
      'current-run-id': { type: 'string' },
      output: { type: 'string' },
    },
  });
  const command = positionals[0] ?? '';
  const output = requiredString(values.output, '--output');
  const sourceGatePath = path.resolve(requiredString(
    values['source-gate'],
    '--source-gate',
  ));
  const credentialReceiptPath = path.resolve(requiredString(
    values['credential-receipt'],
    '--credential-receipt',
  ));
  if (command === 'create') {
    return {
      command,
      output,
      sourceGatePath,
      credentialReceiptPath,
      input: {
        baseVersion: requiredString(values['base-version'], '--base-version'),
        appRef: fullSha(values['app-ref'], '--app-ref'),
        shellRef: fullSha(values['shell-ref'], '--shell-ref'),
        frameworkRef: fullSha(values['framework-ref'], '--framework-ref'),
        admissionRunId: runId(values['admission-run-id'], '--admission-run-id'),
      },
    } as const;
  }
  if (command === 'verify') {
    return {
      command,
      output,
      sourceGatePath,
      credentialReceiptPath,
      manifestPath: path.resolve(requiredString(values.manifest, '--manifest')),
      expectedDigest: requiredString(values['expected-digest'], '--expected-digest'),
      currentRunId: runId(values['current-run-id'], '--current-run-id'),
    } as const;
  }
  throw new Error('Usage: stable-release-admission-manifest.ts <create|verify> [options].');
}

async function main(): Promise<void> {
  const options = cliOptions();
  if (options.command === 'create') {
    const observation = await collectObservation(
      options.input,
      options.sourceGatePath,
      options.credentialReceiptPath,
      options.input.admissionRunId,
    );
    const manifest = buildStableReleaseAdmissionManifest(options.input, observation);
    writeJson(options.output, manifest);
    process.stdout.write(`${JSON.stringify({
      status: 'created',
      version: manifest.version.display,
      updater_version: manifest.version.updater,
      manifest_digest: manifest.manifest_digest,
      output: path.resolve(options.output),
    })}\n`);
    return;
  }
  const manifest = object(
    JSON.parse(fs.readFileSync(options.manifestPath, 'utf8')),
    'Stable admission manifest',
  ) as StableAdmissionManifest;
  const verified = await verifyStableReleaseAdmissionManifest({
    manifest,
    sourceGatePath: options.sourceGatePath,
    credentialReceiptPath: options.credentialReceiptPath,
    expectedDigest: options.expectedDigest,
    currentRunId: options.currentRunId,
  });
  const output = {
    schema: 'opl_stable_release_admission_verification.v1',
    status: 'passed',
    manifest_digest: verified.manifest_digest,
    version: verified.version,
    cohort: verified.cohort,
    source_gate: verified.source_gate,
    admission_run_id: verified.apple_credentials.producer_run_id,
  };
  writeJson(options.output, output);
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
