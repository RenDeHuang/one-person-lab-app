#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export const stableStageIds = [
  'admission_and_circuit_breaker',
  'source_contract_preflight',
  'native_webui_deterministic_prepare',
  'credential_runner_and_custody_preflight',
  'standard_signed_notarized_build_and_seal',
  'clean_vm_exact_artifact_qualification',
  'updater_exact_artifact_qualification',
  'standard_publication',
  'homebrew_exact_artifact_install',
  'latest_pointer_activation',
  'remote_digest_and_clean_user_installed_readback',
  'terminal_fold_and_idempotent_cleanup',
] as const;

export const stableStageAxes = [
  'qualification_product',
  'evidence',
  'transport',
  'cleanup',
] as const;

export type StableStageId = typeof stableStageIds[number];
export type StableStageAxis = typeof stableStageAxes[number];
export type StableStageAxisStatus = 'passed' | 'failed' | 'not_run';
export type StableFinalInspection = 'present' | 'absent' | 'unknown' | null;

export type StableCohort = {
  app_sha: string;
  shell_sha: string;
  framework_sha: string;
};

export type StableStageAxisInput = {
  status: StableStageAxisStatus;
  reason_code?: string | null;
  command_exit_code?: number | null;
  final_inspection?: StableFinalInspection;
  evidence_ref?: string | null;
};

export type StableStageInput = {
  stage_id: StableStageId;
  stage_index: number;
  cohort: StableCohort;
  artifact_digest_or_input_digest: string;
  environment_receipt_digest: string;
  attempt: number;
  axes: Record<StableStageAxis, StableStageAxisInput>;
};

export type StableCommandAnomaly = {
  exit_code: number;
  reason_code: string;
};

export type StableStageAxisResult = {
  status: StableStageAxisStatus;
  reason_code: string;
  command_exit_code: number | null;
  final_inspection: StableFinalInspection;
  evidence_ref: string | null;
  command_anomaly: StableCommandAnomaly | null;
};

export type StableFailureFingerprint = {
  schema: 'opl_app_stable_failure_fingerprint.v1';
  digest: string;
  cohort: StableCohort;
  stage_id: StableStageId;
  reason_code: string;
  artifact_digest_or_input_digest: string;
  environment_receipt_digest: string;
};

export type StableStageFailure = {
  stage_id: StableStageId;
  stage_index: number;
  axis: StableStageAxis;
  reason_code: string;
  fingerprint: StableFailureFingerprint;
};

export type StableNormalizedStage = Omit<StableStageInput, 'axes'> & {
  axes: Record<StableStageAxis, StableStageAxisResult>;
  stage_status: 'passed' | 'failed' | 'incomplete';
};

export type StableStageResult = {
  schema: 'opl_app_stable_stage_result.v1';
  authority: 'attempt_observation_only_no_framework_state_projection';
  business_stage_count: 12;
  observed_stage_count: number;
  status: 'passed' | 'failed' | 'incomplete';
  cohort: StableCohort;
  attempt: number;
  stages: StableNormalizedStage[];
  primary_failure: StableStageFailure | null;
  secondary_failures: StableStageFailure[];
  failure_fingerprint: StableFailureFingerprint | null;
  cleanup_command_anomalies: Array<{
    stage_id: StableStageId;
    stage_index: number;
    anomaly: StableCommandAnomaly;
  }>;
};

const fullShaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const reasonCodePattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function assertDigest(value: unknown, label: string): string {
  if (typeof value !== 'string' || !digestPattern.test(value)) {
    throw new Error(`${label} must be an exact sha256 digest.`);
  }
  return value;
}

function normalizeCohort(value: StableCohort): StableCohort {
  const entries = Object.entries(value ?? {});
  if (
    entries.length !== 3
    || !fullShaPattern.test(value?.app_sha ?? '')
    || !fullShaPattern.test(value?.shell_sha ?? '')
    || !fullShaPattern.test(value?.framework_sha ?? '')
  ) {
    throw new Error('Stable stage cohort must contain exact lowercase App, Shell, and Framework SHAs.');
  }
  return {
    app_sha: value.app_sha,
    shell_sha: value.shell_sha,
    framework_sha: value.framework_sha,
  };
}

function normalizeReasonCode(
  status: StableStageAxisStatus,
  reasonCode: string | null | undefined,
): string {
  const fallback = status === 'passed' ? 'passed' : status === 'not_run' ? 'not_run' : '';
  const normalized = reasonCode?.trim() || fallback;
  if (!reasonCodePattern.test(normalized)) {
    throw new Error(`Stable stage ${status} axis requires a lowercase reason_code.`);
  }
  return normalized;
}

function normalizeCommandExitCode(value: number | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('Stable stage command_exit_code must be a non-negative integer or null.');
  }
  return value;
}

function normalizeAxis(
  axis: StableStageAxis,
  input: StableStageAxisInput,
): StableStageAxisResult {
  if (!input || !stableStageAxes.includes(axis) || !['passed', 'failed', 'not_run'].includes(input.status)) {
    throw new Error(`Stable stage axis ${axis} is invalid.`);
  }
  const commandExitCode = normalizeCommandExitCode(input.command_exit_code);
  const finalInspection = input.final_inspection ?? null;
  if (![null, 'present', 'absent', 'unknown'].includes(finalInspection)) {
    throw new Error(`Stable stage axis ${axis} final inspection is invalid.`);
  }
  const reasonCode = normalizeReasonCode(input.status, input.reason_code);
  if (
    axis === 'cleanup'
    && input.status === 'failed'
    && commandExitCode !== null
    && commandExitCode !== 0
    && finalInspection === 'absent'
  ) {
    return {
      status: 'passed',
      reason_code: 'cleanup_idempotent_success',
      command_exit_code: commandExitCode,
      final_inspection: finalInspection,
      evidence_ref: input.evidence_ref?.trim() || null,
      command_anomaly: {
        exit_code: commandExitCode,
        reason_code: reasonCode,
      },
    };
  }
  return {
    status: input.status,
    reason_code: reasonCode,
    command_exit_code: commandExitCode,
    final_inspection: finalInspection,
    evidence_ref: input.evidence_ref?.trim() || null,
    command_anomaly: null,
  };
}

function stageIdentity(stageId: StableStageId, stageIndex: number): void {
  if (!Number.isInteger(stageIndex) || stableStageIds[stageIndex] !== stageId) {
    throw new Error(`Stable stage ${stageId} does not match stage_index ${stageIndex}.`);
  }
}

export function createStableFailureFingerprint(input: {
  cohort: StableCohort;
  stage_id: StableStageId;
  reason_code: string;
  artifact_digest_or_input_digest: string;
  environment_receipt_digest: string;
}): StableFailureFingerprint {
  const core = {
    cohort: normalizeCohort(input.cohort),
    stage_id: input.stage_id,
    reason_code: normalizeReasonCode('failed', input.reason_code),
    artifact_digest_or_input_digest: assertDigest(
      input.artifact_digest_or_input_digest,
      'artifact_digest_or_input_digest',
    ),
    environment_receipt_digest: assertDigest(
      input.environment_receipt_digest,
      'environment_receipt_digest',
    ),
  };
  if (!stableStageIds.includes(core.stage_id)) {
    throw new Error(`Unknown Stable stage_id ${String(core.stage_id)}.`);
  }
  return {
    schema: 'opl_app_stable_failure_fingerprint.v1',
    digest: `sha256:${crypto.createHash('sha256').update(canonicalJson(core)).digest('hex')}`,
    ...core,
  };
}

export function normalizeStableFailureFingerprint(value: unknown): StableFailureFingerprint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Stable failure fingerprint must be an object.');
  }
  const candidate = value as Record<string, unknown>;
  if (
    Object.keys(candidate).sort().join(',') !== [
      'artifact_digest_or_input_digest',
      'cohort',
      'digest',
      'environment_receipt_digest',
      'reason_code',
      'schema',
      'stage_id',
    ].sort().join(',')
    || candidate.schema !== 'opl_app_stable_failure_fingerprint.v1'
  ) {
    throw new Error('Stable failure fingerprint fields are invalid.');
  }
  const expected = createStableFailureFingerprint({
    cohort: candidate.cohort as StableCohort,
    stage_id: candidate.stage_id as StableStageId,
    reason_code: String(candidate.reason_code ?? ''),
    artifact_digest_or_input_digest: String(candidate.artifact_digest_or_input_digest ?? ''),
    environment_receipt_digest: String(candidate.environment_receipt_digest ?? ''),
  });
  if (candidate.digest !== expected.digest) {
    throw new Error('Stable failure fingerprint digest does not match its exact identity.');
  }
  return expected;
}

export function stableFailureFingerprintsEqual(left: unknown, right: unknown): boolean {
  return normalizeStableFailureFingerprint(left).digest
    === normalizeStableFailureFingerprint(right).digest;
}

function normalizeStage(input: StableStageInput): StableNormalizedStage {
  stageIdentity(input.stage_id, input.stage_index);
  if (!Number.isInteger(input.attempt) || input.attempt < 1) {
    throw new Error('Stable stage attempt must be a positive integer.');
  }
  if (
    !input.axes
    || Object.keys(input.axes).sort().join(',') !== [...stableStageAxes].sort().join(',')
  ) {
    throw new Error(`Stable stage ${input.stage_id} must include exactly four result axes.`);
  }
  const axes = Object.fromEntries(
    stableStageAxes.map((axis) => [axis, normalizeAxis(axis, input.axes[axis])]),
  ) as Record<StableStageAxis, StableStageAxisResult>;
  const statuses = Object.values(axes).map((axis) => axis.status);
  return {
    stage_id: input.stage_id,
    stage_index: input.stage_index,
    cohort: normalizeCohort(input.cohort),
    artifact_digest_or_input_digest: assertDigest(
      input.artifact_digest_or_input_digest,
      'artifact_digest_or_input_digest',
    ),
    environment_receipt_digest: assertDigest(
      input.environment_receipt_digest,
      'environment_receipt_digest',
    ),
    attempt: input.attempt,
    axes,
    stage_status: statuses.includes('failed')
      ? 'failed'
      : statuses.includes('not_run')
        ? 'incomplete'
        : 'passed',
  };
}

function failureFor(stage: StableNormalizedStage, axis: StableStageAxis): StableStageFailure {
  const result = stage.axes[axis];
  return {
    stage_id: stage.stage_id,
    stage_index: stage.stage_index,
    axis,
    reason_code: result.reason_code,
    fingerprint: createStableFailureFingerprint({
      cohort: stage.cohort,
      stage_id: stage.stage_id,
      reason_code: result.reason_code,
      artifact_digest_or_input_digest: stage.artifact_digest_or_input_digest,
      environment_receipt_digest: stage.environment_receipt_digest,
    }),
  };
}

export function foldStableStageResults(inputs: StableStageInput[]): StableStageResult {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error('Stable stage fold requires at least one stage observation.');
  }
  const stages = inputs.map(normalizeStage).sort((left, right) => left.stage_index - right.stage_index);
  if (new Set(stages.map((stage) => stage.stage_index)).size !== stages.length) {
    throw new Error('Stable stage fold cannot contain duplicate stage indexes.');
  }
  const cohort = stages[0]!.cohort;
  const attempt = stages[0]!.attempt;
  for (const stage of stages.slice(1)) {
    if (canonicalJson(stage.cohort) !== canonicalJson(cohort) || stage.attempt !== attempt) {
      throw new Error('Stable stage fold requires one exact cohort and attempt.');
    }
  }

  const productFailures = stages
    .filter((stage) => stage.axes.qualification_product.status === 'failed')
    .map((stage) => failureFor(stage, 'qualification_product'));
  const primaryFailure = productFailures[0] ?? null;
  const secondaryFailures = [
    ...productFailures.slice(1),
    ...stages.flatMap((stage) => stableStageAxes
      .filter((axis) => axis !== 'qualification_product' && stage.axes[axis].status === 'failed')
      .map((axis) => failureFor(stage, axis))),
  ].sort((left, right) => (
    left.stage_index - right.stage_index
    || stableStageAxes.indexOf(left.axis) - stableStageAxes.indexOf(right.axis)
  ));
  const cleanupCommandAnomalies = stages.flatMap((stage) => {
    const anomaly = stage.axes.cleanup.command_anomaly;
    return anomaly ? [{ stage_id: stage.stage_id, stage_index: stage.stage_index, anomaly }] : [];
  });
  const hasFailure = primaryFailure !== null || secondaryFailures.length > 0;
  const complete = stages.length === stableStageIds.length
    && stages.every((stage) => stage.stage_status === 'passed');

  return {
    schema: 'opl_app_stable_stage_result.v1',
    authority: 'attempt_observation_only_no_framework_state_projection',
    business_stage_count: 12,
    observed_stage_count: stages.length,
    status: hasFailure ? 'failed' : complete ? 'passed' : 'incomplete',
    cohort,
    attempt,
    stages,
    primary_failure: primaryFailure,
    secondary_failures: secondaryFailures,
    failure_fingerprint: (primaryFailure ?? secondaryFailures[0])?.fingerprint ?? null,
    cleanup_command_anomalies: cleanupCommandAnomalies,
  };
}

function requiredOption(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing required option --${name}.`);
  return value.trim();
}

function writeResult(outputPath: string, value: unknown): void {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized, 'utf8');
  process.stdout.write(serialized);
}

function isMainModule(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
}

if (isMainModule()) {
  try {
    const command = process.argv[2];
    const { values } = parseArgs({
      args: process.argv.slice(3),
      options: {
        input: { type: 'string' },
        output: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    });
    if (command !== 'fold') {
      throw new Error('Usage: stable-stage-result.ts fold --input <stages.json> --output <result.json>.');
    }
    const inputPath = path.resolve(requiredOption(values.input, 'input'));
    const parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as unknown;
    const stages = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).stages)
        ? (parsed as Record<string, unknown>).stages
        : null;
    if (!stages) throw new Error('Stable stage input must be an array or an object with stages[].');
    writeResult(
      path.resolve(requiredOption(values.output, 'output')),
      foldStableStageResults(stages as StableStageInput[]),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
