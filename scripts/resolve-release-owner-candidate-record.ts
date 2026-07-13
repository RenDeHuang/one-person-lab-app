#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import {
  buildAppReleaseOwnerVerdictReadout,
  readAppReleaseOwnerVerdictContract,
} from './app-release-owner-verdict.ts';
import { sha256File } from './build-artifact-cohort.ts';
import type { ReleaseEvidenceCohort } from './release-evidence-cohort.ts';
import { arrayOrEmpty, asRecord, readJsonFile } from './release-json-helpers.ts';
import { validateFullQualificationOverride } from './validate-release-addon-readiness.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const commandMaxBuffer = 16 * 1024 * 1024;

type Options = {
  candidateRecordPath: string;
  preflightPath: string;
  readinessPath: string;
  remoteVerificationPath: string;
  output: string;
  markdown: string;
  releaseOwnerVerdictRef: string;
  releaseOwnerReceiptRef: string;
  fullQualificationReceiptPath: string;
  buildArtifactManifestPath: string;
  stableSessionId: string;
  releaseCohortRef: string;
  sourceArtifactRunId: string;
  sourceArtifactName: string;
};

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    candidateRecordPath: '',
    preflightPath: '',
    readinessPath: '',
    remoteVerificationPath: '',
    output: '',
    markdown: '',
    releaseOwnerVerdictRef: '',
    releaseOwnerReceiptRef: '',
    fullQualificationReceiptPath: '',
    buildArtifactManifestPath: '',
    stableSessionId: '',
    releaseCohortRef: '',
    sourceArtifactRunId: '',
    sourceArtifactName: '',
  };
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      'candidate-record': { type: 'string' },
      preflight: { type: 'string' },
      readiness: { type: 'string' },
      'remote-verification': { type: 'string' },
      output: { type: 'string' },
      markdown: { type: 'string' },
      'release-owner-verdict-ref': { type: 'string' },
      'release-owner-receipt-ref': { type: 'string' },
      'full-qualification-receipt': { type: 'string' },
      'build-artifact-manifest': { type: 'string' },
      'stable-session-id': { type: 'string' },
      'release-cohort-ref': { type: 'string' },
      'source-artifact-run-id': { type: 'string' },
      'source-artifact-name': { type: 'string' },
    },
  });
  parsed.candidateRecordPath = values['candidate-record'] ?? parsed.candidateRecordPath;
  parsed.preflightPath = values.preflight ?? parsed.preflightPath;
  parsed.readinessPath = values.readiness ?? parsed.readinessPath;
  parsed.remoteVerificationPath = values['remote-verification'] ?? parsed.remoteVerificationPath;
  parsed.output = values.output ?? parsed.output;
  parsed.markdown = values.markdown ?? parsed.markdown;
  parsed.releaseOwnerVerdictRef = values['release-owner-verdict-ref'] ?? parsed.releaseOwnerVerdictRef;
  parsed.releaseOwnerReceiptRef = values['release-owner-receipt-ref'] ?? parsed.releaseOwnerReceiptRef;
  parsed.fullQualificationReceiptPath = values['full-qualification-receipt'] ?? '';
  parsed.buildArtifactManifestPath = values['build-artifact-manifest'] ?? '';
  parsed.stableSessionId = values['stable-session-id'] ?? '';
  parsed.releaseCohortRef = values['release-cohort-ref'] ?? '';
  parsed.sourceArtifactRunId = values['source-artifact-run-id'] ?? '';
  parsed.sourceArtifactName = values['source-artifact-name'] ?? '';
  if (!parsed.candidateRecordPath) throw new Error('Pass --candidate-record <path>.');
  if (!parsed.preflightPath) throw new Error('Pass --preflight <path>.');
  if (!parsed.readinessPath) throw new Error('Pass --readiness <path>.');
  if (!parsed.remoteVerificationPath) throw new Error('Pass --remote-verification <path>.');
  if (!parsed.output) throw new Error('Pass --output <path>.');
  if (!parsed.releaseOwnerVerdictRef && !parsed.releaseOwnerReceiptRef) {
    throw new Error('Pass --release-owner-verdict-ref or --release-owner-receipt-ref.');
  }
  return {
    ...parsed,
    candidateRecordPath: path.resolve(parsed.candidateRecordPath),
    preflightPath: path.resolve(parsed.preflightPath),
    readinessPath: path.resolve(parsed.readinessPath),
    remoteVerificationPath: path.resolve(parsed.remoteVerificationPath),
    output: path.resolve(parsed.output),
    markdown: parsed.markdown ? path.resolve(parsed.markdown) : '',
    fullQualificationReceiptPath: parsed.fullQualificationReceiptPath
      ? path.resolve(parsed.fullQualificationReceiptPath)
      : '',
    buildArtifactManifestPath: parsed.buildArtifactManifestPath
      ? path.resolve(parsed.buildArtifactManifestPath)
      : '',
  };
}

function deriveQualifiedReadiness(options: Options): {
  path: string;
  audit: Record<string, unknown> | null;
} {
  if (!options.fullQualificationReceiptPath && !options.buildArtifactManifestPath) {
    return { path: options.readinessPath, audit: null };
  }
  const validation = validateFullQualificationOverride({
    version: stringValue(asRecord(readJsonFile(options.candidateRecordPath), 'candidate_record'), 'version'),
    fullQualificationReceiptPath: options.fullQualificationReceiptPath,
    buildArtifactManifestPath: options.buildArtifactManifestPath,
    stableSessionId: options.stableSessionId,
    releaseCohortRef: options.releaseCohortRef,
    sourceArtifactRunId: options.sourceArtifactRunId,
    sourceArtifactName: options.sourceArtifactName,
  });
  if (!validation.applied) {
    throw new Error(`Full qualification override is invalid: ${validation.errors.join('; ')}`);
  }
  const original = asRecord(readJsonFile(options.readinessPath), 'release_readiness_summary');
  const gates = asRecord(original.gates, 'release_readiness_summary.gates');
  const fullGate = asRecord(gates.full_dmg_clean_vm, 'release_readiness_summary.gates.full_dmg_clean_vm');
  const failedRequiredGates = arrayOrEmpty(original.failed_required_gates)
    .filter((gate) => asRecord(gate, 'failed_required_gate').id !== 'full_dmg_clean_vm');
  const releaseCohort = asRecord(original.release_cohort, 'release_readiness_summary.release_cohort') as ReleaseEvidenceCohort;
  const summaryStatus = failedRequiredGates.length === 0 ? 'passed' : 'failed';
  const receipt = asRecord(readJsonFile(options.fullQualificationReceiptPath), 'artifact_qualification_receipt');
  const qualification = asRecord(receipt.qualification, 'artifact_qualification_receipt.qualification');
  const originalJobResults = asRecord(original.job_results ?? {}, 'release_readiness_summary.job_results');
  const audit = {
    schema: 'opl_app_readiness_qualification_override.v1',
    gate: 'full_dmg_clean_vm',
    source_job: 'full-first-run-vm-smoke',
    original_readiness_ref: path.basename(options.readinessPath),
    original_readiness_sha256: sha256File(options.readinessPath),
    original_job_result: originalJobResults['full-first-run-vm-smoke'] ?? null,
    qualification_receipt_ref: path.basename(options.fullQualificationReceiptPath),
    qualification_receipt_sha256: sha256File(options.fullQualificationReceiptPath),
    build_artifact_manifest_ref: path.basename(options.buildArtifactManifestPath),
    build_artifact_manifest_sha256: sha256File(options.buildArtifactManifestPath),
    stable_session_id: options.stableSessionId,
    release_cohort_ref: options.releaseCohortRef,
    source_artifact_run_id: options.sourceArtifactRunId,
    source_artifact_name: options.sourceArtifactName,
    qualification_run_id: qualification.run_id,
    artifact_sha256: validation.artifactSha256,
  };
  const derived = {
    ...original,
    status: summaryStatus,
    job_results: { ...originalJobResults, 'full-first-run-vm-smoke': 'success' },
    gates: {
      ...gates,
      full_dmg_clean_vm: {
        ...fullGate,
        status: 'passed',
        reason: 'Exact same-artifact qualification retry passed.',
        qualification_override: audit,
      },
    },
    failed_required_gates: failedRequiredGates,
    release_owner_verdict: buildAppReleaseOwnerVerdictReadout({
      contract: readAppReleaseOwnerVerdictContract(appRoot),
      releaseCohort,
      summaryStatus,
      failedRequiredGates: failedRequiredGates.map((gate) => {
        const record = asRecord(gate, 'failed_required_gate');
        return { id: String(record.id), status: String(record.status), reason: String(record.reason ?? '') };
      }),
    }),
    qualification_override: audit,
  };
  const derivedPath = path.join(path.dirname(options.output), 'release-readiness-summary-qualified.json');
  fs.mkdirSync(path.dirname(derivedPath), { recursive: true });
  fs.writeFileSync(derivedPath, `${JSON.stringify(derived, null, 2)}\n`, 'utf8');
  return { path: derivedPath, audit };
}

function stringValue(record: Record<string, unknown>, key: string, fallback = '') {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function booleanValue(record: Record<string, unknown>, key: string, fallback: boolean) {
  const value = record[key];
  return typeof value === 'boolean' ? value : fallback;
}

function writePreservedJobResults(candidate: Record<string, unknown>, outputPath: string) {
  const jobResults = asRecord(candidate.job_results ?? {}, 'candidate_record.job_results');
  const target = path.join(path.dirname(outputPath), 'release-owner-resolution-job-results.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(jobResults, null, 2)}\n`, 'utf8');
  return target;
}

function runCandidateRecordWriter(args: string[]) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/write-release-candidate-record.ts', ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    maxBuffer: commandMaxBuffer,
  });
  if (result.status !== 0) {
    throw new Error(
      [
        'scripts/write-release-candidate-record.ts failed.',
        result.stdout ? `stdout:\n${result.stdout}` : '',
        result.stderr ? `stderr:\n${result.stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const candidate = asRecord(readJsonFile(options.candidateRecordPath), 'candidate_record');
  const inputs = asRecord(candidate.inputs, 'candidate_record.inputs');
  const provenance = asRecord(candidate.provenance, 'candidate_record.provenance');
  const jobResultsPath = writePreservedJobResults(candidate, options.output);
  const qualifiedReadiness = deriveQualifiedReadiness(options);
  const args = [
    '--version',
    stringValue(candidate, 'version'),
    '--release-mode',
    stringValue(candidate, 'release_mode'),
    '--include-full-package',
    String(booleanValue(inputs, 'include_full_package', true)),
    '--run-vm-smoke',
    String(booleanValue(inputs, 'run_vm_smoke', true)),
    '--shell-ref',
    stringValue(inputs, 'shell_ref', 'main'),
    '--framework-ref',
    stringValue(inputs, 'framework_ref', 'main'),
    '--app-commit',
    stringValue(provenance, 'app_commit'),
    '--workflow-run-id',
    stringValue(provenance, 'workflow_run_id', 'local'),
    '--preflight',
    options.preflightPath,
    '--readiness',
    qualifiedReadiness.path,
    '--remote-verification',
    options.remoteVerificationPath,
    '--job-results',
    jobResultsPath,
    '--output',
    options.output,
  ];
  if (options.markdown) args.push('--markdown', options.markdown);
  if (options.releaseOwnerVerdictRef) args.push('--release-owner-verdict-ref', options.releaseOwnerVerdictRef);
  if (options.releaseOwnerReceiptRef) args.push('--release-owner-receipt-ref', options.releaseOwnerReceiptRef);

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  const rebuilt = runCandidateRecordWriter(args);
  if (qualifiedReadiness.audit) {
    const outputRecord = asRecord(readJsonFile(options.output), 'resolved_candidate_record');
    const outputProvenance = asRecord(outputRecord.provenance, 'resolved_candidate_record.provenance');
    const outputJobResults = asRecord(outputRecord.job_results ?? {}, 'resolved_candidate_record.job_results');
    const auditedRecord = {
      ...outputRecord,
      provenance: {
        ...outputProvenance,
        original_readiness_summary: path.basename(options.readinessPath),
        qualification_override_receipt: path.basename(options.fullQualificationReceiptPath),
      },
      job_results: { ...outputJobResults, 'full-first-run-vm-smoke': 'success' },
      qualification_override: qualifiedReadiness.audit,
    };
    fs.writeFileSync(options.output, `${JSON.stringify(auditedRecord, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify({
    schema: 'opl_release_owner_resolution_candidate_record.v1',
    status: rebuilt.status === 'ready_to_promote' ? 'ready_to_promote' : 'blocked',
    version: rebuilt.version ?? stringValue(candidate, 'version'),
    source_candidate_record: options.candidateRecordPath,
    output_candidate_record: options.output,
    release_owner_verdict_ref: options.releaseOwnerVerdictRef || null,
    release_owner_receipt_ref: options.releaseOwnerReceiptRef || null,
    blocked_reasons: rebuilt.blocked_reasons ?? [],
  }, null, 2)}\n`);
  if (rebuilt.status !== 'ready_to_promote') process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
