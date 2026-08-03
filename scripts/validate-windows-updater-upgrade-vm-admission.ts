#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  validateWindowsAuthenticodeReceipt,
  validateWindowsUpdaterAssets,
  type WindowsAuthenticodeReceipt,
  type WindowsUpdaterAssetReceipt,
} from './validate-windows-updater-assets.ts';

type JsonRecord = Record<string, any>;

const SHA256_PATTERN = /^(?:sha256:)?([0-9a-f]{64})$/;
const RELEASE_VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
const UPDATER_VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const EXACT_EXECUTE_CONFIRMATION = 'execute_signed_windows_upgrade_in_leased_vm';
const DEFAULT_RUNNER_LABELS = ['self-hosted', 'Windows', 'X64', 'opl-cert-windows-wsl'];
const COMPATIBILITY_CONTRACT_REF =
  'contracts/app-install-exposure-policy.json#component_interoperability.compatibility_admission';
const COMPATIBILITY_PRODUCER_CONTRACT_REF =
  'contracts/opl-framework/app-component-compatibility-receipt-contract.json';

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be one object.`);
  }
  return value as JsonRecord;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be one non-empty string.`);
  }
  return value.trim();
}

function regularFile(filePath: string, label: string): fs.Stats {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error(`${label} must be one non-empty regular file.`);
  }
  return stat;
}

function fileSha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function normalizeSha256(value: unknown, label: string): string {
  const match = nonEmptyString(value, label).toLowerCase().match(SHA256_PATTERN);
  if (!match) throw new Error(`${label} must be one SHA-256 digest.`);
  return match[1];
}

function exactReceiptDigest(filePath: string, expected: string, label: string): string {
  regularFile(filePath, label);
  const observed = fileSha256(filePath);
  if (observed !== normalizeSha256(expected, `${label} expected digest`)) {
    throw new Error(`${label} digest drifted from the frozen input.`);
  }
  return observed;
}

function readJson(filePath: string, label: string): JsonRecord {
  regularFile(filePath, label);
  return record(JSON.parse(fs.readFileSync(filePath, 'utf8')), label);
}

function validateCandidateRun(input: WindowsUpgradeVmAdmissionInput): JsonRecord {
  const run = record(input.candidateRun, 'Candidate Actions run');
  const runId = String(run.id ?? '');
  if (
    runId !== input.candidateRunId
    || run.repository?.full_name !== input.repository
    || run.head_repository?.full_name !== input.repository
    || run.head_sha !== input.candidateSourceSha
    || run.run_attempt !== 1
    || run.status !== 'completed'
    || run.conclusion !== 'success'
  ) {
    throw new Error('Candidate Actions run is not one exact successful first-attempt source run.');
  }
  return {
    run_id: runId,
    source_sha: input.candidateSourceSha,
    artifact_name: input.candidateArtifactName,
  };
}

function validateCompatibilityReceipt(input: WindowsUpgradeVmAdmissionInput, installer: {
  name: string;
  size_bytes: number;
  sha256: string;
}): JsonRecord {
  const receiptPath = path.join(input.artifactDir, 'opl-component-compatibility-receipt.json');
  const receiptSha256 = exactReceiptDigest(
    receiptPath,
    input.expectedCompatibilityReceiptSha256,
    'Framework compatibility receipt',
  );
  const receipt = readJson(receiptPath, 'Framework compatibility receipt');
  if (
    receipt.schema !== 'opl_component_compatibility_receipt.v1'
    || receipt.owner !== 'one-person-lab'
    || receipt.producer_role !== 'opl_framework'
    || receipt.contract_ref !== COMPATIBILITY_CONTRACT_REF
    || receipt.producer_contract_ref !== COMPATIBILITY_PRODUCER_CONTRACT_REF
    || receipt.status !== 'compatible'
  ) {
    throw new Error('Framework compatibility receipt authority or compatible status is invalid.');
  }
  const issuedAt = Date.parse(nonEmptyString(receipt.issued_at, 'Compatibility issued_at'));
  const generatedAt = Date.parse(nonEmptyString(receipt.generated_at, 'Compatibility generated_at'));
  const expiresAt = Date.parse(nonEmptyString(receipt.expires_at, 'Compatibility expires_at'));
  const now = input.now.getTime();
  if (
    !Number.isFinite(issuedAt)
    || !Number.isFinite(generatedAt)
    || !Number.isFinite(expiresAt)
    || generatedAt !== issuedAt
    || issuedAt > now
    || now >= expiresAt
    || expiresAt - issuedAt > 300_000
  ) {
    throw new Error('Framework compatibility receipt is expired, future-dated, or exceeds five minutes.');
  }
  const freshness = record(receipt.freshness, 'Framework compatibility freshness');
  if (
    freshness.status !== 'fresh'
    || freshness.generated_at !== receipt.generated_at
    || freshness.max_age_seconds !== Math.round((expiresAt - issuedAt) / 1000)
  ) {
    throw new Error('Framework compatibility freshness metadata is inconsistent.');
  }
  const selectedArtifact = record(
    record(receipt.subject, 'Framework compatibility subject').selected_app_artifact,
    'Framework compatibility selected App artifact',
  );
  if (
    selectedArtifact.owner_authority !== input.repository
    || selectedArtifact.immutable_release_tag !== input.candidateIdentity
    || selectedArtifact.asset_url !== input.candidateAssetUrl
    || selectedArtifact.asset_name !== installer.name
    || selectedArtifact.byte_size !== installer.size_bytes
    || normalizeSha256(selectedArtifact.sha256, 'Compatibility artifact SHA-256') !==
      normalizeSha256(installer.sha256, 'Installer SHA-256')
  ) {
    throw new Error('Framework compatibility receipt does not bind the exact selected installer identity.');
  }
  if (
    !Array.isArray(receipt.requirements)
    || receipt.requirements.length === 0
    || !Array.isArray(receipt.observed_components)
    || receipt.observed_components.length === 0
    || !Array.isArray(receipt.coverage)
    || receipt.coverage.length !== receipt.requirements.length
    || !Array.isArray(receipt.failures)
    || receipt.failures.length !== 0
  ) {
    throw new Error('Framework compatibility receipt coverage is missing or incomplete.');
  }
  const requirements = new Map<string, JsonRecord>();
  for (const rawRequirement of receipt.requirements) {
    const requirement = record(rawRequirement, 'Framework compatibility requirement');
    const requirementId = nonEmptyString(requirement.requirement_id, 'Compatibility requirement_id');
    const componentId = nonEmptyString(requirement.component_id, 'Compatibility component_id');
    if (requirements.has(requirementId)) {
      throw new Error(`Framework compatibility requirement is duplicated: ${requirementId}.`);
    }
    if (!['capability_id_with_versioned_schema', 'minimum_version', 'semver_range'].includes(requirement.kind)) {
      throw new Error(`Framework compatibility requirement kind is invalid: ${String(requirement.kind)}.`);
    }
    if (requirement.kind === 'capability_id_with_versioned_schema') {
      nonEmptyString(requirement.capability_id, `Compatibility ${requirementId} capability_id`);
      nonEmptyString(requirement.schema_range, `Compatibility ${requirementId} schema_range`);
    } else {
      nonEmptyString(requirement.version_requirement, `Compatibility ${requirementId} version_requirement`);
    }
    requirements.set(requirementId, { ...requirement, component_id: componentId });
  }
  const observations = new Map<string, JsonRecord>();
  for (const rawObservation of receipt.observed_components) {
    const observation = record(rawObservation, 'Framework compatibility observation');
    const componentId = nonEmptyString(observation.component_id, 'Compatibility observation component_id');
    if (
      observations.has(componentId)
      || observation.owner_authority !== 'one-person-lab'
      || !Array.isArray(observation.capabilities)
    ) {
      throw new Error(`Framework compatibility observation is invalid: ${componentId}.`);
    }
    observations.set(componentId, observation);
  }
  const covered = new Set<string>();
  for (const rawCoverage of receipt.coverage) {
    const coverage = record(rawCoverage, 'Framework compatibility coverage');
    const requirementId = nonEmptyString(coverage.requirement_id, 'Compatibility coverage requirement_id');
    const requirement = requirements.get(requirementId);
    const observation = requirement ? observations.get(requirement.component_id) : undefined;
    if (
      !requirement
      || !observation
      || covered.has(requirementId)
      || coverage.component_id !== requirement.component_id
      || coverage.kind !== requirement.kind
      || coverage.status !== 'satisfied'
      || coverage.failure_code !== null
      || coverage.observation_ref !== observation.observation_ref
    ) {
      throw new Error(`Framework compatibility coverage is invalid: ${requirementId}.`);
    }
    covered.add(requirementId);
  }
  const authority = record(receipt.authority_boundary, 'Framework compatibility authority boundary');
  if (
    authority.compatibility_only !== true
    || authority.selected_artifact_binding_is_subject_evidence_only !== true
    || authority.may_require_exact_cross_component_version_or_sha !== false
    || authority.may_require_same_cohort !== false
    || authority.may_define_package_currentness !== false
    || authority.may_claim_release_ready !== false
    || authority.may_claim_install_ready !== false
  ) {
    throw new Error('Framework compatibility receipt exceeds its compatibility-only authority.');
  }
  return {
    receipt_sha256: `sha256:${receiptSha256}`,
    status: receipt.status,
    issued_at: receipt.issued_at,
    expires_at: receipt.expires_at,
    requirement_count: requirements.size,
    observed_component_count: observations.size,
    identity_policy: 'capability_minimum_or_semver_range_without_cross_component_lockstep',
  };
}

function validateRunner(input: WindowsUpgradeVmAdmissionInput): JsonRecord {
  const inventory = record(input.runnerInventory, 'GitHub runner inventory');
  if (inventory.inventory_status && inventory.inventory_status !== 'readable') {
    throw new Error(`Runner inventory is unavailable: ${String(inventory.inventory_status)}.`);
  }
  if (!Array.isArray(inventory.runners)) {
    throw new Error('GitHub runner inventory must contain runners.');
  }
  const expected = new Set(input.requiredRunnerLabels);
  const matching = inventory.runners.filter((rawRunner: unknown) => {
    const runner = record(rawRunner, 'GitHub runner');
    const labels = Array.isArray(runner.labels)
      ? runner.labels.map((entry: unknown) => typeof entry === 'string' ? entry : record(entry, 'Runner label').name)
      : [];
    return [...expected].every((label) => labels.includes(label));
  });
  if (matching.length !== 1) {
    throw new Error(`Runner inventory must contain exactly one Windows qualification runner; found ${matching.length}.`);
  }
  const runner = record(matching[0], 'Windows qualification runner');
  if (runner.status !== 'online') throw new Error('Windows qualification runner is offline.');
  if (runner.busy !== false) throw new Error('Windows qualification runner is busy.');
  return {
    id: runner.id,
    name: nonEmptyString(runner.name, 'Windows qualification runner name'),
    status: runner.status,
    busy: runner.busy,
    required_labels: input.requiredRunnerLabels,
  };
}

export type WindowsUpgradeVmAdmissionInput = {
  artifactDir: string;
  repository: string;
  releaseVersion: string;
  updaterVersion: string;
  candidateRunId: string;
  candidateSourceSha: string;
  candidateArtifactName: string;
  candidateIdentity: string;
  candidateAssetUrl: string;
  expectedUpdaterAssetsReceiptSha256: string;
  expectedAuthenticodeReceiptSha256: string;
  expectedCompatibilityReceiptSha256: string;
  candidateRun: unknown;
  runnerInventory: unknown;
  requiredRunnerLabels?: string[];
  mode?: 'preflight' | 'execute';
  confirmation?: string;
  now?: Date;
  outputPath?: string;
};

export type WindowsUpgradeVmAdmissionReceipt = {
  schema: 'opl_windows_updater_upgrade_vm_admission.v1';
  status: 'ready' | 'not_ready';
  reason_code: string;
  mutation_attempt_count: 0;
  publication_mutation_allowed: false;
  install_mutation_allowed: false;
  release_blocking: false;
  mode: 'preflight' | 'execute';
  candidate: JsonRecord | null;
  framework_compatibility: JsonRecord | null;
  runner: JsonRecord | null;
  required_artifact_triggers: string[];
  next_action: string;
};

function writeReceipt(receipt: WindowsUpgradeVmAdmissionReceipt, outputPath?: string): void {
  if (!outputPath) return;
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const temporary = `${resolved}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
  try {
    fs.linkSync(temporary, resolved);
  } finally {
    fs.unlinkSync(temporary);
  }
}

export function validateWindowsUpgradeVmAdmission(
  rawInput: WindowsUpgradeVmAdmissionInput,
): WindowsUpgradeVmAdmissionReceipt {
  const input: WindowsUpgradeVmAdmissionInput & {
    requiredRunnerLabels: string[];
    mode: 'preflight' | 'execute';
    confirmation: string;
    now: Date;
  } = {
    ...rawInput,
    artifactDir: path.resolve(rawInput.artifactDir),
    requiredRunnerLabels: rawInput.requiredRunnerLabels ?? DEFAULT_RUNNER_LABELS,
    mode: rawInput.mode ?? 'preflight',
    confirmation: rawInput.confirmation ?? '',
    now: rawInput.now ?? new Date(),
  };
  let candidate: JsonRecord | null = null;
  let compatibility: JsonRecord | null = null;
  let runner: JsonRecord | null = null;
  let reasonCode = 'admitted';
  try {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input.repository)) {
      throw new Error('Candidate repository identity is invalid.');
    }
    if (!RELEASE_VERSION_PATTERN.test(input.releaseVersion) || !UPDATER_VERSION_PATTERN.test(input.updaterVersion)) {
      throw new Error('Candidate display or updater version is invalid.');
    }
    if (!/^[0-9a-f]{40}$/.test(input.candidateSourceSha) || !/^\d+$/.test(input.candidateRunId)) {
      throw new Error('Candidate source SHA or run ID is invalid.');
    }
    const run = validateCandidateRun(input);
    const assetsPath = path.join(input.artifactDir, 'opl-windows-updater-assets.json');
    const authenticodePath = path.join(input.artifactDir, 'opl-windows-authenticode-receipt.json');
    const assetsSha256 = exactReceiptDigest(
      assetsPath,
      input.expectedUpdaterAssetsReceiptSha256,
      'Windows updater assets receipt',
    );
    const authenticodeSha256 = exactReceiptDigest(
      authenticodePath,
      input.expectedAuthenticodeReceiptSha256,
      'Windows Authenticode receipt',
    );
    const generatedAssets = validateWindowsUpdaterAssets({
      artifactDir: input.artifactDir,
      releaseVersion: input.releaseVersion,
      updaterVersion: input.updaterVersion,
      authenticodeReceiptPath: authenticodePath,
    });
    const frozenAssets = readJson(assetsPath, 'Windows updater assets receipt') as WindowsUpdaterAssetReceipt;
    if (JSON.stringify(frozenAssets) !== JSON.stringify(generatedAssets)) {
      if (JSON.stringify(frozenAssets.code_signing) !== JSON.stringify(generatedAssets.code_signing)) {
        throw new Error('Windows Authenticode signing status does not bind the exact optional signed certification.');
      }
      throw new Error('Windows updater assets receipt does not match the exact candidate bytes.');
    }
    const installerPath = path.join(input.artifactDir, generatedAssets.assets.installer.name);
    const authenticode = validateWindowsAuthenticodeReceipt({
      receiptPath: authenticodePath,
      installerPath,
    }) as WindowsAuthenticodeReceipt;
    compatibility = validateCompatibilityReceipt(input, generatedAssets.assets.installer);
    candidate = {
      ...run,
      identity: input.candidateIdentity,
      asset_url: input.candidateAssetUrl,
      release_version: input.releaseVersion,
      updater_version: input.updaterVersion,
      installer: generatedAssets.assets.installer,
      blockmap: generatedAssets.assets.blockmap,
      metadata: generatedAssets.assets.metadata,
      updater_assets_receipt_sha256: `sha256:${assetsSha256}`,
      authenticode_receipt_sha256: `sha256:${authenticodeSha256}`,
      signer_subject: authenticode.signature.signer_subject,
      signer_thumbprint: authenticode.signature.signer_thumbprint,
      timestamp_verified: true,
      timestamper_subject: authenticode.signature.timestamper_subject,
      timestamper_thumbprint: authenticode.signature.timestamper_thumbprint,
    };
  } catch (error) {
    reasonCode = error instanceof Error && /Authenticode|signature|timestamp/i.test(error.message)
      ? 'signed_candidate_unavailable'
      : error instanceof Error && /compatibility/i.test(error.message)
        ? 'framework_compatibility_invalid'
        : 'candidate_identity_invalid';
    const receipt: WindowsUpgradeVmAdmissionReceipt = {
      schema: 'opl_windows_updater_upgrade_vm_admission.v1',
      status: 'not_ready',
      reason_code: reasonCode,
      mutation_attempt_count: 0,
      publication_mutation_allowed: false,
      install_mutation_allowed: false,
      release_blocking: false,
      mode: input.mode,
      candidate,
      framework_compatibility: compatibility,
      runner: null,
      required_artifact_triggers: ['timestamped_authenticode_candidate', 'fresh_framework_compatibility_receipt'],
      next_action: error instanceof Error ? error.message : String(error),
    };
    writeReceipt(receipt, input.outputPath);
    return receipt;
  }
  try {
    runner = validateRunner(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reasonCode = /offline/i.test(message)
      ? 'runner_offline'
      : /busy/i.test(message)
        ? 'runner_busy'
        : 'runner_inventory_unavailable';
    const receipt: WindowsUpgradeVmAdmissionReceipt = {
      schema: 'opl_windows_updater_upgrade_vm_admission.v1',
      status: 'not_ready',
      reason_code: reasonCode,
      mutation_attempt_count: 0,
      publication_mutation_allowed: false,
      install_mutation_allowed: false,
      release_blocking: false,
      mode: input.mode,
      candidate,
      framework_compatibility: compatibility,
      runner: null,
      required_artifact_triggers: ['online_idle_windows_qualification_runner'],
      next_action: message,
    };
    writeReceipt(receipt, input.outputPath);
    return receipt;
  }
  if (input.mode === 'execute' && input.confirmation !== EXACT_EXECUTE_CONFIRMATION) {
    const receipt: WindowsUpgradeVmAdmissionReceipt = {
      schema: 'opl_windows_updater_upgrade_vm_admission.v1',
      status: 'not_ready',
      reason_code: 'execute_confirmation_missing',
      mutation_attempt_count: 0,
      publication_mutation_allowed: false,
      install_mutation_allowed: false,
      release_blocking: false,
      mode: input.mode,
      candidate,
      framework_compatibility: compatibility,
      runner,
      required_artifact_triggers: ['explicit_execute_authority'],
      next_action: `Provide the exact protected confirmation ${EXACT_EXECUTE_CONFIRMATION}.`,
    };
    writeReceipt(receipt, input.outputPath);
    return receipt;
  }
  const receipt: WindowsUpgradeVmAdmissionReceipt = {
    schema: 'opl_windows_updater_upgrade_vm_admission.v1',
    status: 'ready',
    reason_code: 'admitted',
    mutation_attempt_count: 0,
    publication_mutation_allowed: false,
    install_mutation_allowed: false,
    release_blocking: false,
    mode: input.mode,
    candidate,
    framework_compatibility: compatibility,
    runner,
    required_artifact_triggers: input.mode === 'preflight'
      ? ['separate_protected_upgrade_vm_execute_operation']
      : ['active_factory_lease_and_clean_attestation_readback'],
    next_action: input.mode === 'preflight'
      ? 'Run the host dry-run harness, then request one separate protected execute operation.'
      : 'Revalidate the active factory lease and clean VM attestation before any guest mutation.',
  };
  writeReceipt(receipt, input.outputPath);
  return receipt;
}

function main(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      'artifact-dir': { type: 'string' },
      repository: { type: 'string' },
      'release-version': { type: 'string' },
      'updater-version': { type: 'string' },
      'candidate-run-id': { type: 'string' },
      'candidate-source-sha': { type: 'string' },
      'candidate-artifact-name': { type: 'string' },
      'candidate-identity': { type: 'string' },
      'candidate-asset-url': { type: 'string' },
      'updater-assets-receipt-sha256': { type: 'string' },
      'authenticode-receipt-sha256': { type: 'string' },
      'compatibility-receipt-sha256': { type: 'string' },
      'candidate-run-json': { type: 'string' },
      'runner-inventory-json': { type: 'string' },
      'runner-labels-json': { type: 'string' },
      mode: { type: 'string', default: 'preflight' },
      confirmation: { type: 'string', default: '' },
      now: { type: 'string' },
      output: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  const required = [
    'artifact-dir', 'repository', 'release-version', 'updater-version', 'candidate-run-id',
    'candidate-source-sha', 'candidate-artifact-name', 'candidate-identity', 'candidate-asset-url',
    'updater-assets-receipt-sha256', 'authenticode-receipt-sha256',
    'compatibility-receipt-sha256', 'candidate-run-json', 'runner-inventory-json', 'output',
  ] as const;
  for (const name of required) {
    if (!values[name]) throw new Error(`--${name} is required.`);
  }
  if (!['preflight', 'execute'].includes(values.mode ?? '')) {
    throw new Error('--mode must be preflight or execute.');
  }
  const now = values.now ? new Date(values.now) : new Date();
  if (!Number.isFinite(now.getTime())) throw new Error('--now must be one ISO timestamp.');
  const runnerLabels = values['runner-labels-json']
    ? JSON.parse(values['runner-labels-json'])
    : DEFAULT_RUNNER_LABELS;
  if (!Array.isArray(runnerLabels) || runnerLabels.some((entry) => typeof entry !== 'string')) {
    throw new Error('--runner-labels-json must be one JSON string array.');
  }
  const receipt = validateWindowsUpgradeVmAdmission({
    artifactDir: values['artifact-dir']!,
    repository: values.repository!,
    releaseVersion: values['release-version']!,
    updaterVersion: values['updater-version']!,
    candidateRunId: values['candidate-run-id']!,
    candidateSourceSha: values['candidate-source-sha']!,
    candidateArtifactName: values['candidate-artifact-name']!,
    candidateIdentity: values['candidate-identity']!,
    candidateAssetUrl: values['candidate-asset-url']!,
    expectedUpdaterAssetsReceiptSha256: values['updater-assets-receipt-sha256']!,
    expectedAuthenticodeReceiptSha256: values['authenticode-receipt-sha256']!,
    expectedCompatibilityReceiptSha256: values['compatibility-receipt-sha256']!,
    candidateRun: JSON.parse(fs.readFileSync(values['candidate-run-json']!, 'utf8')),
    runnerInventory: JSON.parse(fs.readFileSync(values['runner-inventory-json']!, 'utf8')),
    requiredRunnerLabels: runnerLabels,
    mode: values.mode as 'preflight' | 'execute',
    confirmation: values.confirmation,
    now,
    outputPath: values.output,
  });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
