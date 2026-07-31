#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  createGitAncestryResolver,
  inspectCanonicalGitHubReleaseReadback,
  inspectCanonicalGitHubWorkflowRun,
  validateCodexRuntimeArtifactEligibility,
} from './codex-runtime-artifact-eligibility.ts';
import {
  CODEX_RUNTIME_IDENTITY_FIELDS,
  REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS,
  validateCodexRuntimeIdentityEvidence,
} from './codex-runtime-identity-evidence.ts';

type JsonRecord = Record<string, unknown>;

export const ISSUE_122_RUNTIME_EXECUTION_STEPS = [
  'eligibility_validated',
  'task_vm_target_absent',
  'task_vm_cloned',
  'task_vm_booted',
  'guest_clean_state_verified',
  'full_clean_installed',
  'full_finder_launched',
  'full_direct_app_server_captured',
  'full_aioncore_acp_captured',
  'full_typed_errors_probed',
  'full_graceful_quit_verified',
  'standard_in_place_updated',
  'standard_finder_restarted',
  'standard_direct_app_server_captured',
  'standard_aioncore_acp_captured',
  'standard_typed_errors_probed',
  'standard_graceful_quit_verified',
  'guest_launch_environment_restored',
  'strict_evidence_validated',
] as const;

type RuntimeExecutionStep = (typeof ISSUE_122_RUNTIME_EXECUTION_STEPS)[number];

export type CodexRuntimeIdentityCollectionPlanInput = {
  eligibilityDigest: string;
  evidenceRoot: string;
  sourceVm: string;
  taskVm: string;
  appBundlePath: string;
  isolatedCodexHome: string;
  createdAt: string;
};

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const TASK_VM_PATTERN = /^opl-issue-122-[a-z0-9][a-z0-9-]*$/;
const MINIMAL_PATH = '/usr/bin:/bin';
const EXACT_APP_BUNDLE_PATH = '/Applications/One Person Lab.app';
const EXACT_APP_EXECUTABLE_PATH =
  '/Applications/One Person Lab.app/Contents/MacOS/One Person Lab';
const APP_BUNDLE_ID = 'cn.onepersonlab.opl';
const STRUCTURED_RECEIPT_MAX_BYTES = 4 * 1024 * 1024;

type PortableFile = {
  absolute: string;
  relative: string;
};

type BoundJsonFile = PortableFile & {
  sha256: string;
  value: JsonRecord;
};

type ExecutionRecord = {
  sequence: number;
  id: RuntimeExecutionStep;
  status: 'passed';
  started_at: string;
  completed_at: string;
  guest_machine_uuid: string;
};

type StructuredRunBinding = {
  runId: 'full_clean_install_finder' | 'standard_update_after_full_finder';
  appPid: number;
  directPid: number;
  aioncorePid: number;
};

type OutputTarget = {
  absolute: string;
  relative: string;
};

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, expected: string[], label: string): void {
  const actual = Object.keys(value).toSorted();
  const canonical = [...expected].toSorted();
  if (JSON.stringify(actual) !== JSON.stringify(canonical)) {
    throw new Error(`${label} fields must be exactly ${canonical.join(', ')}`);
  }
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw new Error(`${label} must be a normalized non-empty string`);
  }
  return value;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return Number(value);
}

function exact(value: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    throw new Error(`${label} must be ${JSON.stringify(expected)}`);
  }
}

function digest(value: unknown, label: string): string {
  const normalized = string(value, label);
  if (!DIGEST_PATTERN.test(normalized)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return normalized;
}

function isoDate(value: unknown, label: string): string {
  const normalized = string(value, label);
  if (!Number.isFinite(Date.parse(normalized))) {
    throw new Error(`${label} must be an ISO date-time`);
  }
  return normalized;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (value && typeof value === 'object') {
    const source = value as JsonRecord;
    return Object.fromEntries(
      Object.keys(source).toSorted().map((key) => [key, canonicalize(source[key])]),
    );
  }
  return value;
}

function sha256Bytes(value: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function fileSha256(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const descriptor = fs.openSync(filePath, 'r');
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return `sha256:${hash.digest('hex')}`;
}

function isInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (
    relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

function validateVmBoundary(
  sourceVmValue: unknown,
  taskVmValue: unknown,
): { sourceVm: string; taskVm: string } {
  const sourceVm = string(sourceVmValue, 'source_vm');
  const taskVm = string(taskVmValue, 'task_vm');
  if (sourceVm === taskVm) throw new Error('task_vm must differ from source_vm');
  if (!TASK_VM_PATTERN.test(taskVm)) {
    throw new Error('task_vm must use the opl-issue-122 task namespace');
  }
  return { sourceVm, taskVm };
}

function validateCollectionPaths(input: {
  evidenceRoot: unknown;
  appBundlePath: unknown;
  isolatedCodexHome: unknown;
}): {
  evidenceRoot: string;
  appBundlePath: string;
  isolatedCodexHome: string;
} {
  const evidenceRoot = path.resolve(string(input.evidenceRoot, 'evidence_root'));
  const appBundlePath = string(input.appBundlePath, 'app_bundle_path');
  const isolatedCodexHome = string(input.isolatedCodexHome, 'isolated_codex_home');
  if (appBundlePath !== EXACT_APP_BUNDLE_PATH) {
    throw new Error(`app_bundle_path must be ${EXACT_APP_BUNDLE_PATH}`);
  }
  if (!path.isAbsolute(isolatedCodexHome)) {
    throw new Error('isolated_codex_home must be an absolute guest path');
  }
  const normalizedHome = path.normalize(isolatedCodexHome);
  if (
    normalizedHome !== isolatedCodexHome
    || !normalizedHome.includes(`${path.sep}OPL-Evidence${path.sep}issue-122${path.sep}`)
    || path.basename(normalizedHome) !== 'codex-home'
  ) {
    throw new Error('isolated_codex_home must be task-owned under OPL-Evidence/issue-122');
  }
  return { evidenceRoot, appBundlePath, isolatedCodexHome };
}

function finderAppleScript(appBundlePath: string): string {
  const escaped = appBundlePath.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return `tell application "Finder" to open POSIX file "${escaped}"`;
}

export function buildCodexRuntimeIdentityCollectionPlan(
  input: CodexRuntimeIdentityCollectionPlanInput,
): {
  schema: 'opl_codex_runtime_identity_collection_plan.v1';
  status: 'plan_only';
  eligibility_digest: string;
  vm: {
    source_vm: string;
    task_vm: string;
    task_vm_is_distinct: true;
    task_vm_custody_required_before_cleanup: true;
    source_vm_mutation_allowed: false;
  };
  environment: {
    app_bundle_path: string;
    path: '/usr/bin:/bin';
    isolated_codex_home: string;
    shell_profile_loading_allowed: false;
    global_codex_visibility_allowed: false;
    launchctl_snapshot_and_restore_required: true;
  };
  finder_launch: {
    executable: '/usr/bin/osascript';
    arguments: ['-e', string];
    exact_posix_path: string;
    app_name_or_bundle_id_resolution_allowed: false;
    direct_executable_launch_allowed: false;
  };
  helper_policy: {
    mode: 'explicit_plan_or_dry_run_only';
    clone_allowed_in_plan_mode: false;
    boot_allowed_in_plan_mode: false;
    install_allowed_in_plan_mode: false;
    guest_mutation_allowed_in_plan_mode: false;
  };
  process_policy: {
    graceful_bundle_id_quit_required: true;
    pkill_allowed: false;
    killall_allowed: false;
    force_kill_allowed: false;
  };
  execution: {
    same_task_vm_required: true;
    concurrency: 'strict_serial';
    ordered_steps: readonly RuntimeExecutionStep[];
  };
  collector: {
    execute_mode_available: false;
    structured_capture_only: true;
    shell_text_parsing_allowed: false;
    canonical_strict_validator_required: true;
  };
  evidence_root: string;
  created_at: string;
} {
  const eligibilityDigest = digest(input.eligibilityDigest, 'eligibility_digest');
  const vm = validateVmBoundary(input.sourceVm, input.taskVm);
  const paths = validateCollectionPaths({
    evidenceRoot: input.evidenceRoot,
    appBundlePath: input.appBundlePath,
    isolatedCodexHome: input.isolatedCodexHome,
  });
  const createdAt = isoDate(input.createdAt, 'created_at');
  return {
    schema: 'opl_codex_runtime_identity_collection_plan.v1',
    status: 'plan_only',
    eligibility_digest: eligibilityDigest,
    vm: {
      source_vm: vm.sourceVm,
      task_vm: vm.taskVm,
      task_vm_is_distinct: true,
      task_vm_custody_required_before_cleanup: true,
      source_vm_mutation_allowed: false,
    },
    environment: {
      app_bundle_path: paths.appBundlePath,
      path: MINIMAL_PATH,
      isolated_codex_home: paths.isolatedCodexHome,
      shell_profile_loading_allowed: false,
      global_codex_visibility_allowed: false,
      launchctl_snapshot_and_restore_required: true,
    },
    finder_launch: {
      executable: '/usr/bin/osascript',
      arguments: ['-e', finderAppleScript(paths.appBundlePath)],
      exact_posix_path: paths.appBundlePath,
      app_name_or_bundle_id_resolution_allowed: false,
      direct_executable_launch_allowed: false,
    },
    helper_policy: {
      mode: 'explicit_plan_or_dry_run_only',
      clone_allowed_in_plan_mode: false,
      boot_allowed_in_plan_mode: false,
      install_allowed_in_plan_mode: false,
      guest_mutation_allowed_in_plan_mode: false,
    },
    process_policy: {
      graceful_bundle_id_quit_required: true,
      pkill_allowed: false,
      killall_allowed: false,
      force_kill_allowed: false,
    },
    execution: {
      same_task_vm_required: true,
      concurrency: 'strict_serial',
      ordered_steps: ISSUE_122_RUNTIME_EXECUTION_STEPS,
    },
    collector: {
      execute_mode_available: false,
      structured_capture_only: true,
      shell_text_parsing_allowed: false,
      canonical_strict_validator_required: true,
    },
    evidence_root: paths.evidenceRoot,
    created_at: createdAt,
  };
}

function canonicalEvidenceRoot(evidenceRoot: string): string {
  const absolute = path.resolve(evidenceRoot);
  const stats = fs.lstatSync(absolute);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error('evidence root must be a real directory, not a symbolic link');
  }
  return fs.realpathSync(absolute);
}

function portableRelativePath(rawPath: unknown, label: string): string {
  const relativePath = string(rawPath, label);
  if (path.isAbsolute(relativePath) || relativePath.includes('\\')) {
    throw new Error(`${label} must be a portable relative path`);
  }
  const normalized = path.posix.normalize(relativePath);
  if (
    normalized !== relativePath
    || normalized === '.'
    || normalized === '..'
    || normalized.startsWith('../')
  ) {
    throw new Error(`${label} must not escape the evidence root`);
  }
  return relativePath;
}

function resolveExistingPortableFile(
  rawPath: unknown,
  label: string,
  evidenceRoot: string,
): PortableFile {
  const relative = portableRelativePath(rawPath, label);
  const root = canonicalEvidenceRoot(evidenceRoot);
  const segments = relative.split('/');
  let cursor = root;
  for (const [index, segment] of segments.entries()) {
    cursor = path.join(cursor, segment);
    const stats = fs.lstatSync(cursor);
    if (stats.isSymbolicLink()) {
      throw new Error(`${label} must not traverse a symbolic link`);
    }
    if (index < segments.length - 1 && !stats.isDirectory()) {
      throw new Error(`${label} has a non-directory ancestor`);
    }
    if (index === segments.length - 1 && !stats.isFile()) {
      throw new Error(`${label} must reference a regular file`);
    }
  }
  const absolute = fs.realpathSync(cursor);
  if (!isInside(absolute, root)) {
    throw new Error(`${label} resolves outside the evidence root`);
  }
  return { absolute, relative };
}

function resolveExistingInputFile(
  rawPath: unknown,
  label: string,
  evidenceRoot: string,
): PortableFile {
  const root = canonicalEvidenceRoot(evidenceRoot);
  const absolute = path.resolve(string(rawPath, label));
  if (!isInside(absolute, root) || absolute === root) {
    throw new Error(`${label} must stay inside the evidence root`);
  }
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  return resolveExistingPortableFile(relative, label, root);
}

function readBoundJsonReference(
  rawReference: unknown,
  label: string,
  evidenceRoot: string,
  expectedKind?: string,
): BoundJsonFile {
  const reference = record(rawReference, label);
  const expectedKeys = expectedKind ? ['kind', 'path', 'sha256'] : ['path', 'sha256'];
  exactKeys(reference, expectedKeys, label);
  if (expectedKind) exact(reference.kind, expectedKind, `${label}.kind`);
  const file = resolveExistingPortableFile(reference.path, `${label}.path`, evidenceRoot);
  const expectedDigest = digest(reference.sha256, `${label}.sha256`);
  const stats = fs.statSync(file.absolute);
  if (stats.size > STRUCTURED_RECEIPT_MAX_BYTES) {
    throw new Error(`${label}.path is too large to be a structured receipt`);
  }
  const actualDigest = fileSha256(file.absolute);
  if (actualDigest !== expectedDigest) {
    throw new Error(`${label}.sha256 does not match ${file.relative}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file.absolute, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(
      `${label}.path must contain structured JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  return {
    ...file,
    sha256: expectedDigest,
    value: record(parsed, `${label} JSON`),
  };
}

function validatePortableEvidencePath(
  rawPath: unknown,
  label: string,
  evidenceRoot: string,
): PortableFile {
  return resolveExistingPortableFile(rawPath, label, evidenceRoot);
}

function validateEvidenceReferencePaths(
  evidence: JsonRecord,
  evidenceRoot: string,
): Set<string> {
  const protectedPaths = new Set<string>();
  if (!Array.isArray(evidence.runs)) throw new Error('capture.evidence.runs must be an array');
  for (const [runIndex, candidate] of evidence.runs.entries()) {
    const run = record(candidate, `capture.evidence.runs[${runIndex}]`);
    const artifact = record(run.artifact, `capture.evidence.runs[${runIndex}].artifact`);
    protectedPaths.add(validatePortableEvidencePath(
      artifact.path,
      `capture.evidence.runs[${runIndex}].artifact.path`,
      evidenceRoot,
    ).absolute);
    const refGroups: Array<[unknown, string]> = [
      [artifact.evidence_refs, `capture.evidence.runs[${runIndex}].artifact.evidence_refs`],
      [
        record(
          run.direct_app_server,
          `capture.evidence.runs[${runIndex}].direct_app_server`,
        ).evidence_refs,
        `capture.evidence.runs[${runIndex}].direct_app_server.evidence_refs`,
      ],
      [
        record(run.aioncore_acp, `capture.evidence.runs[${runIndex}].aioncore_acp`)
          .evidence_refs,
        `capture.evidence.runs[${runIndex}].aioncore_acp.evidence_refs`,
      ],
    ];
    const probes = run.typed_error_probes;
    if (!Array.isArray(probes)) {
      throw new Error(`capture.evidence.runs[${runIndex}].typed_error_probes must be an array`);
    }
    for (const [probeIndex, probeCandidate] of probes.entries()) {
      const probe = record(
        probeCandidate,
        `capture.evidence.runs[${runIndex}].typed_error_probes[${probeIndex}]`,
      );
      refGroups.push([
        probe.evidence_refs,
        `capture.evidence.runs[${runIndex}].typed_error_probes[${probeIndex}].evidence_refs`,
      ]);
    }
    for (const [groupValue, groupLabel] of refGroups) {
      if (!Array.isArray(groupValue)) throw new Error(`${groupLabel} must be an array`);
      for (const [refIndex, refCandidate] of groupValue.entries()) {
        const reference = record(refCandidate, `${groupLabel}[${refIndex}]`);
        protectedPaths.add(validatePortableEvidencePath(
          reference.path,
          `${groupLabel}[${refIndex}].path`,
          evidenceRoot,
        ).absolute);
      }
    }
  }
  return protectedPaths;
}

function oneEvidenceReference(
  rawReferences: unknown,
  expectedKind: string,
  label: string,
): JsonRecord {
  const references = array(rawReferences, label).map((candidate, index) =>
    record(candidate, `${label}[${index}]`));
  const matches = references.filter((reference) => reference.kind === expectedKind);
  if (matches.length !== 1) {
    throw new Error(`${label} must contain exactly one ${expectedKind} reference`);
  }
  return matches[0];
}

function validateExecution(
  value: unknown,
  guestMachineUuid: string,
): ExecutionRecord[] {
  if (!Array.isArray(value) || value.length !== ISSUE_122_RUNTIME_EXECUTION_STEPS.length) {
    throw new Error(
      `capture.execution must contain exactly ${ISSUE_122_RUNTIME_EXECUTION_STEPS.length} steps`,
    );
  }
  let priorCompleted = Number.NEGATIVE_INFINITY;
  return value.map((candidate, index) => {
    const label = `capture.execution[${index}]`;
    const step = record(candidate, label);
    exactKeys(
      step,
      ['sequence', 'id', 'status', 'started_at', 'completed_at', 'guest_machine_uuid'],
      label,
    );
    exact(step.sequence, index + 1, `${label}.sequence`);
    exact(step.id, ISSUE_122_RUNTIME_EXECUTION_STEPS[index], `${label}.id`);
    exact(step.status, 'passed', `${label}.status`);
    exact(step.guest_machine_uuid, guestMachineUuid, `${label}.guest_machine_uuid`);
    const startedAt = isoDate(step.started_at, `${label}.started_at`);
    const completedAt = isoDate(step.completed_at, `${label}.completed_at`);
    const startedMillis = Date.parse(startedAt);
    const completedMillis = Date.parse(completedAt);
    if (startedMillis < priorCompleted || completedMillis < startedMillis) {
      throw new Error('capture.execution must be monotonic and strictly serial');
    }
    priorCompleted = completedMillis;
    return {
      sequence: index + 1,
      id: ISSUE_122_RUNTIME_EXECUTION_STEPS[index],
      status: 'passed',
      started_at: startedAt,
      completed_at: completedAt,
      guest_machine_uuid: guestMachineUuid,
    };
  });
}

function assertCapturedDuringStep(
  value: unknown,
  execution: ExecutionRecord[],
  stepId: RuntimeExecutionStep,
  label: string,
): string {
  const capturedAt = isoDate(value, label);
  const step = execution.find((candidate) => candidate.id === stepId);
  if (!step) throw new Error(`${label} has no matching execution step`);
  const timestamp = Date.parse(capturedAt);
  if (timestamp < Date.parse(step.started_at) || timestamp > Date.parse(step.completed_at)) {
    throw new Error(`${label} must fall within execution step ${stepId}`);
  }
  return capturedAt;
}

function runStep(
  runId: StructuredRunBinding['runId'],
  suffix:
    | 'finder_restarted'
    | 'aioncore_acp_captured'
    | 'direct_app_server_captured'
    | 'typed_errors_probed'
    | 'graceful_quit_verified',
): RuntimeExecutionStep {
  if (runId === 'full_clean_install_finder') {
    const fullSteps = {
      finder_restarted: 'full_finder_launched',
      aioncore_acp_captured: 'full_aioncore_acp_captured',
      direct_app_server_captured: 'full_direct_app_server_captured',
      typed_errors_probed: 'full_typed_errors_probed',
      graceful_quit_verified: 'full_graceful_quit_verified',
    } as const;
    return fullSteps[suffix];
  }
  const standardSteps = {
    finder_restarted: 'standard_finder_restarted',
    aioncore_acp_captured: 'standard_aioncore_acp_captured',
    direct_app_server_captured: 'standard_direct_app_server_captured',
    typed_errors_probed: 'standard_typed_errors_probed',
    graceful_quit_verified: 'standard_graceful_quit_verified',
  } as const;
  return standardSteps[suffix];
}

function validateCustodyReceipt(
  vm: JsonRecord,
  sourceVm: string,
  taskVm: string,
  guestMachineUuid: string,
  evidenceRoot: string,
  execution: ExecutionRecord[],
): BoundJsonFile {
  const custody = readBoundJsonReference(
    vm.custody_receipt,
    'capture.vm.custody_receipt',
    evidenceRoot,
  );
  exact(
    digest(vm.task_vm_ownership_token, 'capture.vm.task_vm_ownership_token'),
    custody.sha256,
    'capture.vm.task_vm_ownership_token',
  );
  const value = custody.value;
  exactKeys(
    value,
    [
      'schema',
      'status',
      'source_vm',
      'task_vm',
      'guest_machine_uuid',
      'source_vm_mutated',
      'target_absent_before_clone',
      'clone_completed',
      'clone_operation_id',
      'captured_at',
    ],
    'capture.vm.custody_receipt JSON',
  );
  exact(value.schema, 'opl_issue_122_task_vm_custody_capture.v1', 'custody schema');
  exact(value.status, 'captured', 'custody status');
  exact(value.source_vm, sourceVm, 'custody source_vm');
  exact(value.task_vm, taskVm, 'custody task_vm');
  exact(value.guest_machine_uuid, guestMachineUuid, 'custody guest_machine_uuid');
  exact(value.source_vm_mutated, false, 'custody source_vm_mutated');
  exact(value.target_absent_before_clone, true, 'custody target_absent_before_clone');
  exact(value.clone_completed, true, 'custody clone_completed');
  string(value.clone_operation_id, 'custody clone_operation_id');
  assertCapturedDuringStep(
    value.captured_at,
    execution,
    'task_vm_cloned',
    'custody captured_at',
  );
  return custody;
}

function exactCanonical(value: unknown, expected: unknown, label: string): void {
  exact(canonicalize(value), canonicalize(expected), label);
}

function registerStructuredReceipt(
  receipt: BoundJsonFile,
  observedPaths: Set<string>,
  label: string,
): void {
  if (observedPaths.has(receipt.absolute)) {
    throw new Error(`${label} must not reuse another structured receipt file`);
  }
  observedPaths.add(receipt.absolute);
}

function validateFinderProcessReceipt(
  run: JsonRecord,
  runId: StructuredRunBinding['runId'],
  guestMachineUuid: string,
  isolatedCodexHome: string,
  evidenceRoot: string,
  execution: ExecutionRecord[],
  observedPaths: Set<string>,
): { appPid: number; aioncorePid: number } {
  const acp = record(run.aioncore_acp, `${runId}.aioncore_acp`);
  const references = array(acp.evidence_refs, `${runId}.aioncore_acp.evidence_refs`);
  if (references.length !== 2) {
    throw new Error(`${runId}.aioncore_acp.evidence_refs must contain exactly two references`);
  }
  const receipt = readBoundJsonReference(
    oneEvidenceReference(
      references,
      'environment_capture',
      `${runId}.aioncore_acp.evidence_refs`,
    ),
    `${runId}.finder_process_capture`,
    evidenceRoot,
    'environment_capture',
  );
  registerStructuredReceipt(receipt, observedPaths, `${runId}.finder_process_capture`);
  const value = receipt.value;
  exactKeys(
    value,
    [
      'schema',
      'status',
      'run_id',
      'guest_machine_uuid',
      'launch',
      'environment',
      'processes',
      'managed_candidate_count',
      'managed_candidate',
      'captured_at',
    ],
    `${runId}.finder_process_capture JSON`,
  );
  exact(value.schema, 'opl_issue_122_finder_process_capture.v1', 'Finder capture schema');
  exact(value.status, 'captured', 'Finder capture status');
  exact(value.run_id, runId, 'Finder capture run_id');
  exact(value.guest_machine_uuid, guestMachineUuid, 'Finder capture guest_machine_uuid');

  const launch = record(value.launch, 'Finder capture launch');
  exactKeys(
    launch,
    ['entrypoint', 'executable', 'arguments', 'app_bundle_path'],
    'Finder capture launch',
  );
  exact(launch.entrypoint, 'finder', 'Finder capture launch.entrypoint');
  exact(launch.executable, '/usr/bin/osascript', 'Finder capture launch.executable');
  exact(
    launch.arguments,
    ['-e', finderAppleScript(EXACT_APP_BUNDLE_PATH)],
    'Finder capture launch.arguments',
  );
  exact(launch.app_bundle_path, EXACT_APP_BUNDLE_PATH, 'Finder capture app_bundle_path');

  const environment = record(value.environment, 'Finder capture environment');
  exactKeys(
    environment,
    ['path', 'codex_home', 'opl_codex_bin', 'shell_profile_loaded', 'global_codex_present'],
    'Finder capture environment',
  );
  exact(environment.path, MINIMAL_PATH, 'Finder capture environment.path');
  exact(environment.codex_home, isolatedCodexHome, 'Finder capture environment.codex_home');
  const acpIdentity = record(acp.identity, `${runId}.aioncore_acp.identity`);
  exact(environment.opl_codex_bin, acpIdentity.path, 'Finder capture environment.opl_codex_bin');
  exact(environment.shell_profile_loaded, false, 'Finder capture environment.shell_profile_loaded');
  exact(environment.global_codex_present, false, 'Finder capture environment.global_codex_present');

  const processes = record(value.processes, 'Finder capture processes');
  exactKeys(processes, ['app', 'aioncore'], 'Finder capture processes');
  const app = record(processes.app, 'Finder capture processes.app');
  exactKeys(app, ['pid', 'executable_path', 'bundle_id'], 'Finder capture processes.app');
  const appPid = positiveInteger(app.pid, 'Finder capture app pid');
  exact(app.executable_path, EXACT_APP_EXECUTABLE_PATH, 'Finder capture app executable_path');
  exact(app.bundle_id, APP_BUNDLE_ID, 'Finder capture app bundle_id');
  const aioncore = record(processes.aioncore, 'Finder capture processes.aioncore');
  exactKeys(
    aioncore,
    ['pid', 'parent_pid', 'executable_path'],
    'Finder capture processes.aioncore',
  );
  const aioncorePid = positiveInteger(aioncore.pid, 'Finder capture AionCore pid');
  exact(aioncore.parent_pid, appPid, 'Finder capture AionCore parent_pid');
  const aioncoreExecutable = path.normalize(
    string(aioncore.executable_path, 'Finder capture AionCore executable_path'),
  );
  if (
    !path.isAbsolute(aioncoreExecutable)
    || !isInside(aioncoreExecutable, EXACT_APP_BUNDLE_PATH)
  ) {
    throw new Error('Finder capture AionCore executable_path must stay inside the exact App bundle');
  }
  if (aioncorePid === appPid) {
    throw new Error('Finder capture App and AionCore pids must be distinct');
  }
  exact(value.managed_candidate_count, 1, 'Finder capture managed_candidate_count');
  exactCanonical(value.managed_candidate, acpIdentity, 'Finder capture managed_candidate');
  assertCapturedDuringStep(
    value.captured_at,
    execution,
    runStep(runId, 'aioncore_acp_captured'),
    'Finder capture captured_at',
  );
  return { appPid, aioncorePid };
}

function validateDirectProcessReceipt(
  run: JsonRecord,
  runId: StructuredRunBinding['runId'],
  guestMachineUuid: string,
  isolatedCodexHome: string,
  appPid: number,
  evidenceRoot: string,
  execution: ExecutionRecord[],
  observedPaths: Set<string>,
): number {
  const direct = record(run.direct_app_server, `${runId}.direct_app_server`);
  const references = array(direct.evidence_refs, `${runId}.direct_app_server.evidence_refs`);
  if (references.length !== 2) {
    throw new Error(`${runId}.direct_app_server.evidence_refs must contain exactly two references`);
  }
  const receipt = readBoundJsonReference(
    oneEvidenceReference(
      references,
      'process_inspection',
      `${runId}.direct_app_server.evidence_refs`,
    ),
    `${runId}.direct_process_capture`,
    evidenceRoot,
    'process_inspection',
  );
  registerStructuredReceipt(receipt, observedPaths, `${runId}.direct_process_capture`);
  const value = receipt.value;
  exactKeys(
    value,
    [
      'schema',
      'status',
      'run_id',
      'guest_machine_uuid',
      'observation_mode',
      'process',
      'identity_input',
      'captured_at',
    ],
    `${runId}.direct_process_capture JSON`,
  );
  exact(
    value.schema,
    'opl_issue_122_direct_app_server_process_capture.v1',
    'direct process capture schema',
  );
  exact(value.status, 'captured', 'direct process capture status');
  exact(value.run_id, runId, 'direct process capture run_id');
  exact(value.guest_machine_uuid, guestMachineUuid, 'direct process capture guest_machine_uuid');
  exact(
    value.observation_mode,
    'resolver_verified_spawn_input',
    'direct process capture observation_mode',
  );
  const process = record(value.process, 'direct process capture process');
  exactKeys(
    process,
    ['pid', 'parent_pid', 'executable_path', 'realpath', 'arguments', 'environment'],
    'direct process capture process',
  );
  const processPid = positiveInteger(process.pid, 'direct process capture pid');
  exact(process.parent_pid, appPid, 'direct process capture parent_pid');
  const directIdentity = record(direct.identity, `${runId}.direct_app_server.identity`);
  exact(process.executable_path, directIdentity.path, 'direct process capture executable_path');
  exact(process.realpath, directIdentity.realpath, 'direct process capture realpath');
  exact(process.arguments, ['app-server', '--stdio'], 'direct process capture arguments');
  const environment = record(process.environment, 'direct process capture environment');
  exactKeys(environment, ['path', 'codex_home', 'opl_codex_bin'], 'direct process capture environment');
  exact(environment.path, MINIMAL_PATH, 'direct process capture environment.path');
  exact(environment.codex_home, isolatedCodexHome, 'direct process capture environment.codex_home');
  exact(environment.opl_codex_bin, directIdentity.path, 'direct process capture environment.opl_codex_bin');
  exactCanonical(value.identity_input, directIdentity, 'direct process capture identity_input');
  assertCapturedDuringStep(
    value.captured_at,
    execution,
    runStep(runId, 'direct_app_server_captured'),
    'direct process capture captured_at',
  );
  return processPid;
}

function validateHandshakeReceipt(
  boundary: 'direct_app_server' | 'aioncore_acp',
  rawReferences: unknown,
  identity: JsonRecord,
  handshake: unknown,
  processPid: number,
  runId: StructuredRunBinding['runId'],
  guestMachineUuid: string,
  evidenceRoot: string,
  execution: ExecutionRecord[],
  observedPaths: Set<string>,
): void {
  const receipt = readBoundJsonReference(
    oneEvidenceReference(rawReferences, 'handshake_log', `${runId}.${boundary}.evidence_refs`),
    `${runId}.${boundary}.handshake_capture`,
    evidenceRoot,
    'handshake_log',
  );
  registerStructuredReceipt(receipt, observedPaths, `${runId}.${boundary}.handshake_capture`);
  const value = receipt.value;
  exactKeys(
    value,
    [
      'schema',
      'status',
      'run_id',
      'guest_machine_uuid',
      'boundary',
      'process_pid',
      'handshake',
      'identity_binding_mode',
      'native_runtime_identity_readback',
      'identity_input',
      'request_sha256',
      'response_sha256',
      'captured_at',
    ],
    `${runId}.${boundary}.handshake_capture JSON`,
  );
  exact(value.schema, 'opl_issue_122_runtime_handshake_capture.v1', 'handshake capture schema');
  exact(value.status, 'captured', 'handshake capture status');
  exact(value.run_id, runId, 'handshake capture run_id');
  exact(value.guest_machine_uuid, guestMachineUuid, 'handshake capture guest_machine_uuid');
  exact(value.boundary, boundary, 'handshake capture boundary');
  exact(value.process_pid, processPid, 'handshake capture process_pid');
  exact(value.handshake, handshake, 'handshake capture handshake');
  exact(
    value.identity_binding_mode,
    boundary === 'direct_app_server'
      ? 'resolver_spawn_input'
      : 'unique_managed_candidate_controlled_input',
    'handshake capture identity_binding_mode',
  );
  exact(
    value.native_runtime_identity_readback,
    false,
    'handshake capture native_runtime_identity_readback',
  );
  exactCanonical(value.identity_input, identity, 'handshake capture identity_input');
  digest(value.request_sha256, 'handshake capture request_sha256');
  digest(value.response_sha256, 'handshake capture response_sha256');
  assertCapturedDuringStep(
    value.captured_at,
    execution,
    runStep(
      runId,
      boundary === 'direct_app_server'
        ? 'direct_app_server_captured'
        : 'aioncore_acp_captured',
    ),
    'handshake capture captured_at',
  );
}

function validateTypedErrorReceipts(
  rawProbes: unknown,
  runId: StructuredRunBinding['runId'],
  guestMachineUuid: string,
  evidenceRoot: string,
  execution: ExecutionRecord[],
  observedPaths: Set<string>,
): void {
  for (const [index, candidate] of array(rawProbes, `${runId}.typed_error_probes`).entries()) {
    const probe = record(candidate, `${runId}.typed_error_probes[${index}]`);
    const references = array(probe.evidence_refs, `${runId}.typed_error_probes[${index}].evidence_refs`);
    if (references.length !== 1) {
      throw new Error(`${runId}.typed_error_probes[${index}] must bind exactly one receipt`);
    }
    const receipt = readBoundJsonReference(
      references[0],
      `${runId}.typed_error_probes[${index}].capture`,
      evidenceRoot,
      'typed_error_probe',
    );
    registerStructuredReceipt(receipt, observedPaths, `${runId}.typed_error_probes[${index}]`);
    const value = receipt.value;
    exactKeys(
      value,
      [
        'schema',
        'status',
        'run_id',
        'guest_machine_uuid',
        'boundary',
        'code',
        'request_sha256',
        'response_sha256',
        'response',
        'captured_at',
      ],
      `${runId}.typed_error_probes[${index}] capture JSON`,
    );
    exact(value.schema, 'opl_issue_122_typed_error_probe_capture.v1', 'typed probe schema');
    exact(value.status, 'captured', 'typed probe status');
    exact(value.run_id, runId, 'typed probe run_id');
    exact(value.guest_machine_uuid, guestMachineUuid, 'typed probe guest_machine_uuid');
    exact(value.boundary, 'opl_shell_adapter', 'typed probe boundary');
    exact(value.code, probe.code, 'typed probe code');
    digest(value.request_sha256, 'typed probe request_sha256');
    digest(value.response_sha256, 'typed probe response_sha256');
    const response = record(value.response, 'typed probe response');
    exactKeys(
      response,
      ['ok', 'code', 'kind', 'actionable', 'unknown_upstream_error'],
      'typed probe response',
    );
    exact(response.ok, false, 'typed probe response.ok');
    exact(response.code, probe.code, 'typed probe response.code');
    exact(response.kind, 'local_runtime', 'typed probe response.kind');
    exact(response.actionable, true, 'typed probe response.actionable');
    exact(response.unknown_upstream_error, false, 'typed probe response.unknown_upstream_error');
    assertCapturedDuringStep(
      value.captured_at,
      execution,
      runStep(runId, 'typed_errors_probed'),
      'typed probe captured_at',
    );
  }
}

function validateStructuredRunReceipts(
  run: JsonRecord,
  runIndex: number,
  guestMachineUuid: string,
  isolatedCodexHome: string,
  evidenceRoot: string,
  execution: ExecutionRecord[],
  observedPaths: Set<string>,
): StructuredRunBinding {
  const runId = string(run.id, `capture.evidence.runs[${runIndex}].id`);
  if (
    runId !== 'full_clean_install_finder'
    && runId !== 'standard_update_after_full_finder'
  ) {
    throw new Error(`capture.evidence.runs[${runIndex}].id is unsupported`);
  }
  const finder = validateFinderProcessReceipt(
    run,
    runId,
    guestMachineUuid,
    isolatedCodexHome,
    evidenceRoot,
    execution,
    observedPaths,
  );
  const directPid = validateDirectProcessReceipt(
    run,
    runId,
    guestMachineUuid,
    isolatedCodexHome,
    finder.appPid,
    evidenceRoot,
    execution,
    observedPaths,
  );
  const direct = record(run.direct_app_server, `${runId}.direct_app_server`);
  validateHandshakeReceipt(
    'direct_app_server',
    direct.evidence_refs,
    record(direct.identity, `${runId}.direct_app_server.identity`),
    direct.handshake,
    directPid,
    runId,
    guestMachineUuid,
    evidenceRoot,
    execution,
    observedPaths,
  );
  const acp = record(run.aioncore_acp, `${runId}.aioncore_acp`);
  validateHandshakeReceipt(
    'aioncore_acp',
    acp.evidence_refs,
    record(acp.identity, `${runId}.aioncore_acp.identity`),
    acp.handshake,
    finder.aioncorePid,
    runId,
    guestMachineUuid,
    evidenceRoot,
    execution,
    observedPaths,
  );
  validateTypedErrorReceipts(
    run.typed_error_probes,
    runId,
    guestMachineUuid,
    evidenceRoot,
    execution,
    observedPaths,
  );
  return {
    runId,
    appPid: finder.appPid,
    directPid,
    aioncorePid: finder.aioncorePid,
  };
}

function validateQuitReceipt(
  rawReference: unknown,
  label: string,
  binding: StructuredRunBinding,
  guestMachineUuid: string,
  evidenceRoot: string,
  execution: ExecutionRecord[],
  observedPaths: Set<string>,
): BoundJsonFile {
  const receipt = readBoundJsonReference(rawReference, label, evidenceRoot);
  registerStructuredReceipt(receipt, observedPaths, label);
  const value = receipt.value;
  exactKeys(
    value,
    [
      'schema',
      'status',
      'run_id',
      'guest_machine_uuid',
      'bundle_id',
      'method',
      'app_pid',
      'owned_pids_before',
      'owned_pids_after',
      'completed_at',
    ],
    `${label} JSON`,
  );
  exact(value.schema, 'opl_issue_122_graceful_quit_capture.v1', `${label} schema`);
  exact(value.status, 'captured', `${label} status`);
  exact(value.run_id, binding.runId, `${label} run_id`);
  exact(value.guest_machine_uuid, guestMachineUuid, `${label} guest_machine_uuid`);
  exact(value.bundle_id, APP_BUNDLE_ID, `${label} bundle_id`);
  exact(value.method, 'graceful_bundle_id_quit', `${label} method`);
  exact(value.app_pid, binding.appPid, `${label} app_pid`);
  const expectedPids = [binding.appPid, binding.directPid, binding.aioncorePid].toSorted();
  const observedPids = array(value.owned_pids_before, `${label} owned_pids_before`)
    .map((candidate, index) => positiveInteger(candidate, `${label} owned_pids_before[${index}]`))
    .toSorted();
  exact(observedPids, expectedPids, `${label} owned_pids_before`);
  exact(value.owned_pids_after, [], `${label} owned_pids_after`);
  assertCapturedDuringStep(
    value.completed_at,
    execution,
    runStep(binding.runId, 'graceful_quit_verified'),
    `${label} completed_at`,
  );
  return receipt;
}

function validateTransition(
  value: unknown,
  guestMachineUuid: string,
  evidenceRoot: string,
  execution: ExecutionRecord[],
  runBindings: StructuredRunBinding[],
  observedPaths: Set<string>,
): BoundJsonFile[] {
  const transition = record(value, 'capture.transition');
  exactKeys(
    transition,
    [
      'full_install',
      'standard_update',
      'full_graceful_quit',
      'full_owned_pids_after_quit',
      'standard_graceful_quit',
      'standard_owned_pids_after_quit',
      'launch_environment_restored',
      'full_quit_receipt',
      'standard_quit_receipt',
      'environment_restore_receipt',
    ],
    'capture.transition',
  );
  exact(transition.full_install, 'clean_install', 'capture.transition.full_install');
  exact(
    transition.standard_update,
    'in_place_update_after_full',
    'capture.transition.standard_update',
  );
  exact(transition.full_graceful_quit, true, 'capture.transition.full_graceful_quit');
  exact(transition.full_owned_pids_after_quit, [], 'capture.transition.full_owned_pids_after_quit');
  exact(transition.standard_graceful_quit, true, 'capture.transition.standard_graceful_quit');
  exact(
    transition.standard_owned_pids_after_quit,
    [],
    'capture.transition.standard_owned_pids_after_quit',
  );
  exact(transition.launch_environment_restored, true, 'capture.transition.launch_environment_restored');
  const fullBinding = runBindings.find((binding) => binding.runId === 'full_clean_install_finder');
  const standardBinding = runBindings.find(
    (binding) => binding.runId === 'standard_update_after_full_finder',
  );
  if (!fullBinding || !standardBinding) {
    throw new Error('capture transition requires Full and Standard run bindings');
  }
  const fullQuit = validateQuitReceipt(
    transition.full_quit_receipt,
    'capture.transition.full_quit_receipt',
    fullBinding,
    guestMachineUuid,
    evidenceRoot,
    execution,
    observedPaths,
  );
  const standardQuit = validateQuitReceipt(
    transition.standard_quit_receipt,
    'capture.transition.standard_quit_receipt',
    standardBinding,
    guestMachineUuid,
    evidenceRoot,
    execution,
    observedPaths,
  );
  const restore = readBoundJsonReference(
    transition.environment_restore_receipt,
    'capture.transition.environment_restore_receipt',
    evidenceRoot,
  );
  registerStructuredReceipt(
    restore,
    observedPaths,
    'capture.transition.environment_restore_receipt',
  );
  const restoreValue = restore.value;
  exactKeys(
    restoreValue,
    [
      'schema',
      'status',
      'guest_machine_uuid',
      'path_restored',
      'codex_home_restored',
      'captured_at',
    ],
    'capture.transition.environment_restore_receipt JSON',
  );
  exact(
    restoreValue.schema,
    'opl_issue_122_launch_environment_restore_capture.v1',
    'environment restore schema',
  );
  exact(restoreValue.status, 'captured', 'environment restore status');
  exact(
    restoreValue.guest_machine_uuid,
    guestMachineUuid,
    'environment restore guest_machine_uuid',
  );
  exact(restoreValue.path_restored, true, 'environment restore path_restored');
  exact(restoreValue.codex_home_restored, true, 'environment restore codex_home_restored');
  assertCapturedDuringStep(
    restoreValue.captured_at,
    execution,
    'guest_launch_environment_restored',
    'environment restore captured_at',
  );
  return [fullQuit, standardQuit, restore];
}

function validateCrossRunIdentity(
  evidence: JsonRecord,
  isolatedCodexHome: string,
  eligibility: ReturnType<typeof validateCodexRuntimeArtifactEligibility>,
): void {
  const runs = evidence.runs as unknown[];
  const full = record(runs[0], 'capture.evidence.runs[0]');
  const standard = record(runs[1], 'capture.evidence.runs[1]');
  const fullArtifact = record(full.artifact, 'capture.evidence.runs[0].artifact');
  const standardArtifact = record(standard.artifact, 'capture.evidence.runs[1].artifact');
  exact(fullArtifact.profile, 'full', 'Full artifact profile');
  exact(standardArtifact.profile, 'standard', 'Standard artifact profile');
  exact(fullArtifact.app_version, eligibility.version, 'Full artifact app_version');
  exact(standardArtifact.app_version, eligibility.version, 'Standard artifact app_version');
  exact(fullArtifact.path, eligibility.artifacts.full.file_path, 'Full artifact path');
  exact(fullArtifact.sha256, eligibility.artifacts.full.sha256, 'Full artifact sha256');
  exact(
    standardArtifact.path,
    eligibility.artifacts.standard.file_path,
    'Standard artifact path',
  );
  exact(
    standardArtifact.sha256,
    eligibility.artifacts.standard.sha256,
    'Standard artifact sha256',
  );
  const fullIdentity = record(full.managed_candidate, 'capture.evidence.runs[0].managed_candidate');
  const standardIdentity = record(
    standard.managed_candidate,
    'capture.evidence.runs[1].managed_candidate',
  );
  for (const field of CODEX_RUNTIME_IDENTITY_FIELDS) {
    exact(
      standardIdentity[field],
      fullIdentity[field],
      `Standard managed_candidate.${field}`,
    );
  }
  exact(standardIdentity.runtime_key, fullIdentity.runtime_key, 'Standard managed_candidate.runtime_key');
  exact(standardIdentity.carrier, fullIdentity.carrier, 'Standard managed_candidate.carrier');
  exact(fullIdentity.codex_home, isolatedCodexHome, 'Full managed_candidate.codex_home');
}

function evidenceOutputBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function assembleCodexRuntimeIdentityEvidence(
  captureValue: unknown,
  input: {
    evidenceRoot: string;
    eligibility: ReturnType<typeof validateCodexRuntimeArtifactEligibility>;
    evidenceOutputRelativePath: string;
    capture: {
      path: string;
      sha256: string;
    };
  },
): {
  evidence: JsonRecord;
  evidence_bytes: Buffer;
  protected_input_paths: string[];
  receipt: {
    schema: 'opl_codex_runtime_identity_evidence_collection_receipt.v2';
    status: 'structured_consistency_passed';
    eligibility_digest: string;
    capture: {
      path: string;
      sha256: string;
    };
    vm: {
      source_vm: string;
      task_vm: string;
      task_vm_ownership_token: string;
      custody_receipt_sha256: string;
      guest_machine_uuid: string;
      same_task_vm_claim_consistent: true;
      source_vm_mutation_claim: false;
      runtime_vm_identity_verified: false;
    };
    execution: {
      mode: 'external_structured_capture_input';
      ordered_steps: readonly RuntimeExecutionStep[];
      declared_strict_serial_consistent: true;
      structured_receipt_count: number;
      runtime_execution_verified: false;
    };
    evidence: {
      path: string;
      sha256: string;
    };
    strict_validation: ReturnType<typeof validateCodexRuntimeIdentityEvidence>;
    authority: {
      collector_execute_mode_available: false;
      structured_capture_only: true;
      shell_text_parsing_used: false;
      may_gate_install_or_runtime: false;
      structured_receipts_parsed: true;
      runtime_execution_verified: false;
    };
  };
} {
  const evidenceRoot = canonicalEvidenceRoot(input.evidenceRoot);
  const captureFile = readBoundJsonReference(
    input.capture,
    'capture input',
    evidenceRoot,
  );
  exactCanonical(captureFile.value, captureValue, 'capture input bytes');
  const capture = record(captureValue, 'capture');
  exactKeys(
    capture,
    [
      'schema',
      'eligibility_digest',
      'vm',
      'environment',
      'execution',
      'transition',
      'evidence',
    ],
    'capture',
  );
  exact(
    capture.schema,
    'opl_codex_runtime_identity_structured_capture.v1',
    'capture.schema',
  );
  exact(
    digest(capture.eligibility_digest, 'capture.eligibility_digest'),
    input.eligibility.eligibility_digest,
    'capture.eligibility_digest',
  );

  const vm = record(capture.vm, 'capture.vm');
  exactKeys(
    vm,
    [
      'source_vm',
      'task_vm',
      'task_vm_ownership_token',
      'guest_machine_uuid',
      'source_vm_mutated',
      'custody_receipt',
    ],
    'capture.vm',
  );
  const vmNames = validateVmBoundary(vm.source_vm, vm.task_vm);
  const ownershipToken = digest(
    vm.task_vm_ownership_token,
    'capture.vm.task_vm_ownership_token',
  );
  const guestMachineUuid = string(
    vm.guest_machine_uuid,
    'capture.vm.guest_machine_uuid',
  );
  exact(vm.source_vm_mutated, false, 'capture.vm.source_vm_mutated');

  const environment = record(capture.environment, 'capture.environment');
  exactKeys(
    environment,
    [
      'app_bundle_path',
      'path',
      'isolated_codex_home',
      'shell_profile_loaded',
      'global_codex_present',
    ],
    'capture.environment',
  );
  const paths = validateCollectionPaths({
    evidenceRoot: input.evidenceRoot,
    appBundlePath: environment.app_bundle_path,
    isolatedCodexHome: environment.isolated_codex_home,
  });
  exact(environment.path, MINIMAL_PATH, 'capture.environment.path');
  exact(environment.shell_profile_loaded, false, 'capture.environment.shell_profile_loaded');
  exact(environment.global_codex_present, false, 'capture.environment.global_codex_present');

  const execution = validateExecution(capture.execution, guestMachineUuid);
  const structuredReceiptPaths = new Set<string>();
  const custody = validateCustodyReceipt(
    vm,
    vmNames.sourceVm,
    vmNames.taskVm,
    guestMachineUuid,
    paths.evidenceRoot,
    execution,
  );
  registerStructuredReceipt(custody, structuredReceiptPaths, 'capture.vm.custody_receipt');
  const evidence = record(capture.evidence, 'capture.evidence');
  const protectedInputPaths = validateEvidenceReferencePaths(evidence, paths.evidenceRoot);
  const strictValidation = validateCodexRuntimeIdentityEvidence(evidence, {
    evidenceRoot: paths.evidenceRoot,
    verifyReferencedFiles: true,
  });
  exact(
    strictValidation.artifact_evidence_complete,
    true,
    'strict validation artifact_evidence_complete',
  );
  exact(
    strictValidation.run_ids,
    REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS,
    'strict validation run_ids',
  );
  validateCrossRunIdentity(evidence, paths.isolatedCodexHome, input.eligibility);
  const runBindings = array(evidence.runs, 'capture.evidence.runs').map((candidate, index) =>
    validateStructuredRunReceipts(
      record(candidate, `capture.evidence.runs[${index}]`),
      index,
      guestMachineUuid,
      paths.isolatedCodexHome,
      paths.evidenceRoot,
      execution,
      structuredReceiptPaths,
    ));
  const transitionReceipts = validateTransition(
    capture.transition,
    guestMachineUuid,
    paths.evidenceRoot,
    execution,
    runBindings,
    structuredReceiptPaths,
  );
  protectedInputPaths.add(captureFile.absolute);
  protectedInputPaths.add(custody.absolute);
  for (const receipt of transitionReceipts) protectedInputPaths.add(receipt.absolute);
  for (const receiptPath of structuredReceiptPaths) protectedInputPaths.add(receiptPath);

  const evidenceRelativePath = portableRelativePath(
    input.evidenceOutputRelativePath,
    'evidence output relative path',
  );
  const bytes = evidenceOutputBytes(evidence);
  return {
    evidence,
    evidence_bytes: bytes,
    protected_input_paths: [...protectedInputPaths].toSorted(),
    receipt: {
      schema: 'opl_codex_runtime_identity_evidence_collection_receipt.v2',
      status: 'structured_consistency_passed',
      eligibility_digest: input.eligibility.eligibility_digest,
      capture: {
        path: captureFile.relative,
        sha256: captureFile.sha256,
      },
      vm: {
        source_vm: vmNames.sourceVm,
        task_vm: vmNames.taskVm,
        task_vm_ownership_token: ownershipToken,
        custody_receipt_sha256: custody.sha256,
        guest_machine_uuid: guestMachineUuid,
        same_task_vm_claim_consistent: true,
        source_vm_mutation_claim: false,
        runtime_vm_identity_verified: false,
      },
      execution: {
        mode: 'external_structured_capture_input',
        ordered_steps: ISSUE_122_RUNTIME_EXECUTION_STEPS,
        declared_strict_serial_consistent: true,
        structured_receipt_count: structuredReceiptPaths.size,
        runtime_execution_verified: false,
      },
      evidence: {
        path: evidenceRelativePath,
        sha256: sha256Bytes(bytes),
      },
      strict_validation: strictValidation,
      authority: {
        collector_execute_mode_available: false,
        structured_capture_only: true,
        shell_text_parsing_used: false,
        may_gate_install_or_runtime: false,
        structured_receipts_parsed: true,
        runtime_execution_verified: false,
      },
    },
  };
}

function parseJsonBytes(bytes: Buffer, label: string): unknown {
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown;
  } catch (error) {
    throw new Error(
      `${label} must contain JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

function outputTargetInsideRoot(
  evidenceRoot: string,
  outputPath: string,
  label: string,
): OutputTarget {
  const root = canonicalEvidenceRoot(evidenceRoot);
  const requested = path.resolve(outputPath);
  let existingAncestor = requested;
  const missingSegments: string[] = [];
  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) break;
    missingSegments.unshift(path.basename(existingAncestor));
    existingAncestor = parent;
  }
  if (fs.lstatSync(existingAncestor).isSymbolicLink()) {
    throw new Error(`${label} must not traverse a symbolic link`);
  }
  const resolvedAncestor = fs.realpathSync(existingAncestor);
  const absolute = path.join(resolvedAncestor, ...missingSegments);
  if (!isInside(absolute, root) || absolute === root) {
    throw new Error(`${label} must stay inside the evidence root`);
  }
  const relativeNative = path.relative(root, absolute);
  const segments = relativeNative.split(path.sep);
  let cursor = root;
  for (const [index, segment] of segments.entries()) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) break;
    const stats = fs.lstatSync(cursor);
    if (stats.isSymbolicLink()) {
      throw new Error(`${label} must not traverse a symbolic link`);
    }
    if (index < segments.length - 1 && !stats.isDirectory()) {
      throw new Error(`${label} has a non-directory ancestor`);
    }
    if (index === segments.length - 1) {
      throw new Error(`${label} must be create-once and does not overwrite existing paths`);
    }
  }
  return {
    absolute,
    relative: relativeNative.split(path.sep).join('/'),
  };
}

function assertNoProtectedCollision(
  targets: OutputTarget[],
  protectedInputPaths: Iterable<string>,
): void {
  const protectedPaths = new Set([...protectedInputPaths].map((candidate) => path.resolve(candidate)));
  for (const target of targets) {
    if (protectedPaths.has(target.absolute)) {
      throw new Error(`output path collides with a validated input: ${target.relative}`);
    }
  }
}

function ensureSafeDirectoryChain(
  evidenceRoot: string,
  parentPath: string,
  createdDirectories: string[],
): void {
  const root = canonicalEvidenceRoot(evidenceRoot);
  if (!isInside(parentPath, root)) {
    throw new Error('output parent must stay inside the evidence root');
  }
  const relative = path.relative(root, parentPath);
  if (!relative) return;
  let cursor = root;
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    try {
      fs.mkdirSync(cursor, { mode: 0o700 });
      createdDirectories.push(cursor);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const stats = fs.lstatSync(cursor);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error('output parent must not traverse a symbolic link or non-directory');
    }
    const realpath = fs.realpathSync(cursor);
    if (!isInside(realpath, root)) {
      throw new Error('output parent resolves outside the evidence root');
    }
  }
}

function temporaryOutputPath(target: OutputTarget): string {
  return path.join(
    path.dirname(target.absolute),
    `.${path.basename(target.absolute)}.${process.pid}.${crypto.randomBytes(12).toString('hex')}.tmp`,
  );
}

function writeTemporaryFile(filePath: string, bytes: Buffer): void {
  const flags =
    fs.constants.O_CREAT
    | fs.constants.O_EXCL
    | fs.constants.O_WRONLY
    | (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(filePath, flags, 0o600);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function syncDirectory(directory: string): void {
  const descriptor = fs.openSync(directory, fs.constants.O_RDONLY);
  try {
    try {
      fs.fsyncSync(descriptor);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EINVAL' && code !== 'ENOTSUP') throw error;
    }
  } finally {
    fs.closeSync(descriptor);
  }
}

function removeIfPresent(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function removeCreatedDirectories(createdDirectories: string[]): void {
  for (const directory of [...new Set(createdDirectories)].reverse()) {
    try {
      fs.rmdirSync(directory);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTEMPTY') throw error;
    }
  }
}

export type EvidenceOutputCommitTestHooks = {
  beforeReceiptCommit?: (receiptPath: string) => void;
};

export function commitCodexRuntimeIdentityEvidenceOutputs(
  input: {
    evidenceRoot: string;
    outputPath: string;
    receiptPath: string;
    evidenceBytes: Buffer;
    receipt: unknown;
    protectedInputPaths: Iterable<string>;
  },
  testHooks: EvidenceOutputCommitTestHooks = {},
): { output: OutputTarget; receipt: OutputTarget } {
  const root = canonicalEvidenceRoot(input.evidenceRoot);
  const output = outputTargetInsideRoot(root, input.outputPath, 'evidence output');
  const receipt = outputTargetInsideRoot(root, input.receiptPath, 'receipt output');
  if (output.absolute === receipt.absolute) {
    throw new Error('Evidence and receipt outputs must be distinct');
  }
  assertNoProtectedCollision([output, receipt], input.protectedInputPaths);

  const createdDirectories: string[] = [];
  let outputTemporary = '';
  let receiptTemporary = '';
  let outputCommitted = false;
  let receiptCommitted = false;
  try {
    ensureSafeDirectoryChain(root, path.dirname(output.absolute), createdDirectories);
    ensureSafeDirectoryChain(root, path.dirname(receipt.absolute), createdDirectories);
    outputTargetInsideRoot(root, output.absolute, 'evidence output');
    outputTargetInsideRoot(root, receipt.absolute, 'receipt output');
    outputTemporary = temporaryOutputPath(output);
    receiptTemporary = temporaryOutputPath(receipt);
    writeTemporaryFile(outputTemporary, input.evidenceBytes);
    writeTemporaryFile(receiptTemporary, evidenceOutputBytes(input.receipt));
    fs.linkSync(outputTemporary, output.absolute);
    outputCommitted = true;
    testHooks.beforeReceiptCommit?.(receipt.absolute);
    fs.linkSync(receiptTemporary, receipt.absolute);
    receiptCommitted = true;
    removeIfPresent(outputTemporary);
    outputTemporary = '';
    removeIfPresent(receiptTemporary);
    receiptTemporary = '';
    syncDirectory(path.dirname(output.absolute));
    if (path.dirname(receipt.absolute) !== path.dirname(output.absolute)) {
      syncDirectory(path.dirname(receipt.absolute));
    }
    return { output, receipt };
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const [committed, filePath] of [
      [receiptCommitted, receipt.absolute],
      [outputCommitted, output.absolute],
    ] as const) {
      if (!committed) continue;
      try {
        removeIfPresent(filePath);
      } catch (rollbackError) {
        rollbackErrors.push(
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        );
      }
    }
    for (const temporary of [receiptTemporary, outputTemporary]) {
      if (!temporary) continue;
      try {
        removeIfPresent(temporary);
      } catch (rollbackError) {
        rollbackErrors.push(
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        );
      }
    }
    try {
      removeCreatedDirectories(createdDirectories);
    } catch (rollbackError) {
      rollbackErrors.push(
        rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      rollbackErrors.length > 0
        ? `${message}; output rollback failed: ${rollbackErrors.join('; ')}`
        : message,
    );
  }
}

function writeSingleCreateOnce(
  evidenceRoot: string,
  outputPath: string,
  bytes: Buffer,
  protectedInputPaths: Iterable<string>,
): OutputTarget {
  const root = canonicalEvidenceRoot(evidenceRoot);
  const target = outputTargetInsideRoot(root, outputPath, 'plan output');
  assertNoProtectedCollision([target], protectedInputPaths);
  const createdDirectories: string[] = [];
  let temporary = '';
  try {
    ensureSafeDirectoryChain(root, path.dirname(target.absolute), createdDirectories);
    outputTargetInsideRoot(root, target.absolute, 'plan output');
    temporary = temporaryOutputPath(target);
    writeTemporaryFile(temporary, bytes);
    fs.linkSync(temporary, target.absolute);
    removeIfPresent(temporary);
    temporary = '';
    syncDirectory(path.dirname(target.absolute));
    return target;
  } catch (error) {
    if (temporary) removeIfPresent(temporary);
    removeCreatedDirectories(createdDirectories);
    throw error;
  }
}

export function collectEligibilityProtectedPaths(
  packet: JsonRecord,
  evidenceRoot: string,
): Set<string> {
  const protectedPaths = new Set<string>();
  const evidence = record(packet.evidence, 'eligibility.evidence');
  for (const [name, candidate] of Object.entries(evidence)) {
    const reference = record(candidate, `eligibility.evidence.${name}`);
    protectedPaths.add(
      resolveExistingPortableFile(
        reference.path,
        `eligibility.evidence.${name}.path`,
        evidenceRoot,
      ).absolute,
    );
  }
  for (const trackName of ['standard', 'full'] as const) {
    const track = record(packet[trackName], `eligibility.${trackName}`);
    const files = record(track.files, `eligibility.${trackName}.files`);
    for (const [name, candidate] of Object.entries(files)) {
      const reference = record(candidate, `eligibility.${trackName}.files.${name}`);
      protectedPaths.add(
        resolveExistingPortableFile(
          reference.path,
          `eligibility.${trackName}.files.${name}.path`,
          evidenceRoot,
        ).absolute,
      );
    }
  }
  return protectedPaths;
}

function parseCommonEligibility(values: {
  eligibility?: string;
  'app-repo'?: string;
  'shell-repo'?: string;
}): {
  eligibilityPath: string;
  evidenceRoot: string;
  validation: ReturnType<typeof validateCodexRuntimeArtifactEligibility>;
  protectedInputPaths: Set<string>;
} {
  if (!values.eligibility || !values['app-repo'] || !values['shell-repo']) {
    throw new Error(
      'Pass --eligibility <packet.json> --app-repo <repo> --shell-repo <repo>.',
    );
  }
  const requestedPath = path.resolve(values.eligibility);
  const evidenceRoot = canonicalEvidenceRoot(path.dirname(requestedPath));
  const eligibilityFile = resolveExistingInputFile(
    requestedPath,
    'eligibility input',
    evidenceRoot,
  );
  const packet = record(
    parseJsonBytes(fs.readFileSync(eligibilityFile.absolute), 'eligibility input'),
    'eligibility packet',
  );
  const validation = validateCodexRuntimeArtifactEligibility(packet, {
    evidenceRoot,
    isAncestor: createGitAncestryResolver({
      appRepo: values['app-repo'],
      shellRepo: values['shell-repo'],
    }),
    inspectRelease: inspectCanonicalGitHubReleaseReadback,
    inspectWorkflowRun: inspectCanonicalGitHubWorkflowRun,
  });
  const protectedInputPaths = collectEligibilityProtectedPaths(packet, evidenceRoot);
  protectedInputPaths.add(eligibilityFile.absolute);
  return {
    eligibilityPath: eligibilityFile.absolute,
    evidenceRoot,
    validation,
    protectedInputPaths,
  };
}

function main(argv: string[]): void {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: {
      eligibility: { type: 'string' },
      'app-repo': { type: 'string' },
      'shell-repo': { type: 'string' },
      'source-vm': { type: 'string' },
      'task-vm': { type: 'string' },
      'app-bundle': { type: 'string' },
      'codex-home': { type: 'string' },
      'created-at': { type: 'string' },
      capture: { type: 'string' },
      output: { type: 'string' },
      receipt: { type: 'string' },
    },
  });
  if (positionals.length !== 1 || !['plan', 'assemble'].includes(positionals[0])) {
    throw new Error(
      'Usage: codex-runtime-identity-evidence-collector.ts <plan|assemble> [options]; execute mode is unavailable.',
    );
  }
  const common = parseCommonEligibility(values);
  if (positionals[0] === 'plan') {
    if (values.capture || values.receipt) {
      throw new Error('Plan does not accept --capture or --receipt.');
    }
    if (
      !values['source-vm']
      || !values['task-vm']
      || !values['app-bundle']
      || !values['codex-home']
      || !values['created-at']
    ) {
      throw new Error(
        'Plan requires --source-vm, --task-vm, --app-bundle, --codex-home, and --created-at.',
      );
    }
    const plan = buildCodexRuntimeIdentityCollectionPlan({
      eligibilityDigest: common.validation.eligibility_digest,
      evidenceRoot: common.evidenceRoot,
      sourceVm: values['source-vm'],
      taskVm: values['task-vm'],
      appBundlePath: values['app-bundle'],
      isolatedCodexHome: values['codex-home'],
      createdAt: values['created-at'],
    });
    if (values.output) {
      writeSingleCreateOnce(
        common.evidenceRoot,
        values.output,
        evidenceOutputBytes(plan),
        common.protectedInputPaths,
      );
    }
    process.stdout.write(`${JSON.stringify(plan)}\n`);
    return;
  }

  if (!values.capture || !values.output || !values.receipt) {
    throw new Error('Assemble requires --capture, --output, and --receipt.');
  }
  if (
    values['source-vm']
    || values['task-vm']
    || values['app-bundle']
    || values['codex-home']
    || values['created-at']
  ) {
    throw new Error('Assemble does not accept plan-only VM or environment options.');
  }
  const output = outputTargetInsideRoot(
    common.evidenceRoot,
    values.output,
    'evidence output',
  );
  const receiptOutput = outputTargetInsideRoot(
    common.evidenceRoot,
    values.receipt,
    'receipt output',
  );
  if (output.absolute === receiptOutput.absolute) {
    throw new Error('Evidence and receipt outputs must be distinct');
  }
  const captureFile = resolveExistingInputFile(
    values.capture,
    'capture input',
    common.evidenceRoot,
  );
  const captureBytes = fs.readFileSync(captureFile.absolute);
  const captureValue = parseJsonBytes(captureBytes, 'capture input');
  const captureDigest = fileSha256(captureFile.absolute);
  const assembled = assembleCodexRuntimeIdentityEvidence(captureValue, {
    evidenceRoot: common.evidenceRoot,
    eligibility: common.validation,
    evidenceOutputRelativePath: output.relative,
    capture: {
      path: captureFile.relative,
      sha256: captureDigest,
    },
  });
  const protectedInputPaths = new Set([
    ...common.protectedInputPaths,
    ...assembled.protected_input_paths,
    captureFile.absolute,
  ]);
  const committed = commitCodexRuntimeIdentityEvidenceOutputs({
    evidenceRoot: common.evidenceRoot,
    outputPath: output.absolute,
    receiptPath: receiptOutput.absolute,
    evidenceBytes: assembled.evidence_bytes,
    receipt: assembled.receipt,
    protectedInputPaths,
  });
  process.stdout.write(`${JSON.stringify({
    schema: 'opl_codex_runtime_identity_evidence_collection.v2',
    status: 'structured_consistency_passed',
    evidence: committed.output.absolute,
    receipt: committed.receipt.absolute,
    eligibility_digest: common.validation.eligibility_digest,
    evidence_sha256: assembled.receipt.evidence.sha256,
    runtime_execution_verified: false,
  })}\n`);
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;
if (isMain) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
