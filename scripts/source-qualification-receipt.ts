#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const shaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const runIdPattern = /^[1-9][0-9]*$/;
const operationScopes = [
  'stable_operation_source_preflight',
  'standalone_diagnostic',
] as const;
const requiredWorkflowPaths = [
  '.github/workflows/release-source-qualification.yml',
  'contracts/app-source-qualification-receipt.schema.json',
  'scripts/source-qualification-receipt.ts',
  'scripts/validate-source-qualification-receipt.ts',
] as const;

type OperationScope = (typeof operationScopes)[number];
type JsonRecord = Record<string, any>;

export type RepositoryIdentity = {
  sha: string;
  tree: string;
};

export type WorkflowBlob = {
  path: string;
  git_blob_sha: string;
  sha256: string;
};

export type FileEvidence = {
  basename: string;
  size_bytes: number;
  sha256: string;
};

export type SourceQualificationReceipt = {
  schema: 'opl_app_source_qualification_receipt.v1';
  status: 'passed';
  mode: 'development_validation';
  completed_at: string;
  execution: {
    repository: 'gaofeng21cn/one-person-lab-app';
    workflow: '.github/workflows/release-source-qualification.yml';
    event: 'workflow_dispatch';
    operation_scope: OperationScope;
    ref: 'refs/heads/main';
    head_sha: string;
    run_id: string;
    run_attempt: 1;
    runner_labels: ['ubuntu-latest'];
    execution_class: 'github_hosted';
  };
  cohort: {
    app: RepositoryIdentity;
    shell: RepositoryIdentity;
    framework: RepositoryIdentity;
  };
  artifact: {
    kind: 'github_hosted_source_build_preflight';
    basename: string;
    size_bytes: number;
    sha256: string;
    diagnostic_only: true;
    formal_candidate: false;
  };
  evidence: {
    preflight_manifest: FileEvidence;
    cohort_manifest: FileEvidence;
  };
  qualification: {
    source_checks: 'passed';
    contract_checks: 'passed';
    build_checks: 'passed';
    build_invocation_count: 1;
    formal_candidate_build_count: 0;
    self_hosted_invocation_count: 0;
    tart_vm_invocation_count: 0;
  };
  authority: {
    release_authority: false;
    namespace_reservation: false;
    final_signed_byte_authority: false;
    public_mutation_performed: false;
    accepted_consumer: '.github/workflows/release-stable.yml';
  };
  workflow_blobs: WorkflowBlob[];
  receipt_digest: string;
};

export type SourceQualificationBuildInput = {
  completedAt: string;
  operationScope: OperationScope;
  runId: string;
  runAttempt: number;
  repository: string;
  workflow: string;
  event: string;
  ref: string;
  headSha: string;
  runnerLabels: string[];
  cohort: SourceQualificationReceipt['cohort'];
  preflightManifestPath: string;
  cohortManifestPath: string;
  workflowPaths: string[];
  appRoot?: string;
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
  if (!shaPattern.test(normalized)) throw new Error(`${label} must be an exact lowercase Git SHA.`);
  return normalized;
}

function positiveRunId(value: unknown, label: string): string {
  const normalized = requiredString(value, label);
  if (!runIdPattern.test(normalized)) throw new Error(`${label} must be a positive decimal run id.`);
  return normalized;
}

function operationScope(value: unknown): OperationScope {
  const normalized = requiredString(value, 'Source preflight operation scope');
  if (!operationScopes.includes(normalized as OperationScope)) {
    throw new Error('Source preflight operation scope is invalid.');
  }
  return normalized as OperationScope;
}

function sha256Bytes(bytes: Buffer | string): string {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function gitBlobSha(bytes: Buffer): string {
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function sourceQualificationReceiptDigest(
  value: Omit<SourceQualificationReceipt, 'receipt_digest'>,
): string {
  return sha256Bytes(canonicalJson(value));
}

function readJson(filePath: string, label: string): JsonRecord {
  return object(JSON.parse(fs.readFileSync(filePath, 'utf8')), label);
}

function regularFileEvidence(filePath: string, label: string): FileEvidence {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size <= 0) {
    throw new Error(`${label} must be one non-empty regular file, not a symlink.`);
  }
  const bytes = fs.readFileSync(resolved);
  return {
    basename: path.basename(resolved),
    size_bytes: stat.size,
    sha256: sha256Bytes(bytes),
  };
}

function workflowBlobs(appRoot: string, workflowPaths: string[]): WorkflowBlob[] {
  const unique = [...new Set(workflowPaths)].sort();
  if (
    unique.length !== requiredWorkflowPaths.length
    || !requiredWorkflowPaths.every((entry) => unique.includes(entry))
  ) {
    throw new Error('Source preflight must bind the exact workflow, schema, receipt, and verifier files.');
  }
  return unique.map((relativePath) => {
    const resolved = path.resolve(appRoot, relativePath);
    if (!resolved.startsWith(`${path.resolve(appRoot)}${path.sep}`)) {
      throw new Error(`Workflow evidence path escapes the App checkout: ${relativePath}`);
    }
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size <= 0) {
      throw new Error(`Workflow evidence ${relativePath} must be a non-empty regular file.`);
    }
    const bytes = fs.readFileSync(resolved);
    return {
      path: relativePath,
      git_blob_sha: gitBlobSha(bytes),
      sha256: sha256Bytes(bytes),
    };
  });
}

function repositoryIdentity(value: RepositoryIdentity, label: string): RepositoryIdentity {
  return {
    sha: fullSha(value.sha, `${label} SHA`),
    tree: fullSha(value.tree, `${label} tree`),
  };
}

export function buildSourceQualificationReceipt(
  input: SourceQualificationBuildInput,
): SourceQualificationReceipt {
  const completedAt = requiredString(input.completedAt, 'Completion time');
  if (!Number.isFinite(Date.parse(completedAt))) throw new Error('Completion time must be ISO-8601.');
  if (input.runAttempt !== 1) throw new Error('Source preflight accepts only run attempt 1.');
  if (input.repository !== 'gaofeng21cn/one-person-lab-app') throw new Error('Source preflight repository is invalid.');
  if (input.workflow !== '.github/workflows/release-source-qualification.yml') throw new Error('Source preflight workflow is invalid.');
  if (input.event !== 'workflow_dispatch' || input.ref !== 'refs/heads/main') {
    throw new Error('Source preflight must be a main-only workflow_dispatch run.');
  }

  const cohort = {
    app: repositoryIdentity(input.cohort.app, 'App'),
    shell: repositoryIdentity(input.cohort.shell, 'Shell'),
    framework: repositoryIdentity(input.cohort.framework, 'Framework'),
  };
  const headSha = fullSha(input.headSha, 'Execution head SHA');
  if (cohort.app.sha !== headSha) throw new Error('Source preflight App cohort does not match the workflow head.');

  const runnerLabels = [...new Set(input.runnerLabels.map((entry) => requiredString(entry, 'Runner label')))].sort();
  if (runnerLabels.length !== 1 || runnerLabels[0] !== 'ubuntu-latest') {
    throw new Error('Source preflight must use exactly the GitHub-hosted ubuntu-latest runner.');
  }

  const preflight = readJson(input.preflightManifestPath, 'Source preflight manifest');
  if (
    preflight.schema !== 'opl_source_contract_build_preflight.v1'
    || preflight.status !== 'passed'
    || preflight.execution !== 'github_hosted'
    || preflight.reusable_workflow !== '.github/workflows/_build-reusable.yml'
    || preflight.checks?.source !== 'passed'
    || preflight.checks?.contract !== 'passed'
    || preflight.checks?.build !== 'passed'
    || preflight.build_invocation_count !== 1
    || preflight.formal_candidate_build_count !== 0
    || preflight.self_hosted_invocation_count !== 0
    || preflight.tart_vm_invocation_count !== 0
  ) {
    throw new Error('Source preflight manifest must prove one GitHub-hosted diagnostic build and zero formal, self-hosted, or Tart invocations.');
  }

  const cohortManifest = readJson(input.cohortManifestPath, 'Source preflight cohort manifest');
  if (cohortManifest.schema !== 'opl_source_preflight_cohort.v1') {
    throw new Error('Source preflight cohort manifest schema is invalid.');
  }
  const manifestCohort = object(cohortManifest.cohort, 'Source preflight cohort');
  for (const name of ['app', 'shell', 'framework'] as const) {
    if (manifestCohort[name]?.sha !== cohort[name].sha || manifestCohort[name]?.tree !== cohort[name].tree) {
      throw new Error(`Source preflight cohort manifest drifted at ${name}.`);
    }
  }

  const preflightEvidence = regularFileEvidence(input.preflightManifestPath, 'Source preflight manifest');
  const core: Omit<SourceQualificationReceipt, 'receipt_digest'> = {
    schema: 'opl_app_source_qualification_receipt.v1',
    status: 'passed',
    mode: 'development_validation',
    completed_at: completedAt,
    execution: {
      repository: 'gaofeng21cn/one-person-lab-app',
      workflow: '.github/workflows/release-source-qualification.yml',
      event: 'workflow_dispatch',
      operation_scope: operationScope(input.operationScope),
      ref: 'refs/heads/main',
      head_sha: headSha,
      run_id: positiveRunId(input.runId, 'Source preflight run id'),
      run_attempt: 1,
      runner_labels: ['ubuntu-latest'],
      execution_class: 'github_hosted',
    },
    cohort,
    artifact: {
      kind: 'github_hosted_source_build_preflight',
      ...preflightEvidence,
      diagnostic_only: true,
      formal_candidate: false,
    },
    evidence: {
      preflight_manifest: preflightEvidence,
      cohort_manifest: regularFileEvidence(input.cohortManifestPath, 'Source preflight cohort manifest'),
    },
    qualification: {
      source_checks: 'passed',
      contract_checks: 'passed',
      build_checks: 'passed',
      build_invocation_count: 1,
      formal_candidate_build_count: 0,
      self_hosted_invocation_count: 0,
      tart_vm_invocation_count: 0,
    },
    authority: {
      release_authority: false,
      namespace_reservation: false,
      final_signed_byte_authority: false,
      public_mutation_performed: false,
      accepted_consumer: '.github/workflows/release-stable.yml',
    },
    workflow_blobs: workflowBlobs(input.appRoot ?? process.cwd(), input.workflowPaths),
  };
  return { ...core, receipt_digest: sourceQualificationReceiptDigest(core) };
}

export function validateSourceQualificationReceipt(
  value: unknown,
  expected: { digest?: string; runId?: string; headSha?: string } = {},
): SourceQualificationReceipt {
  const receipt = object(value, 'Source preflight receipt') as SourceQualificationReceipt;
  if (
    receipt.schema !== 'opl_app_source_qualification_receipt.v1'
    || receipt.status !== 'passed'
    || receipt.mode !== 'development_validation'
  ) {
    throw new Error('Source preflight receipt schema, status, or mode is invalid.');
  }
  const { receipt_digest: declaredDigest, ...core } = receipt;
  const computedDigest = sourceQualificationReceiptDigest(core);
  if (declaredDigest !== computedDigest) throw new Error('Source preflight receipt digest is invalid.');
  if (expected.digest && expected.digest !== computedDigest) throw new Error('Source preflight receipt digest does not match the expected digest.');
  if (expected.digest && !digestPattern.test(expected.digest)) throw new Error('Expected source preflight digest is invalid.');
  if (expected.runId && receipt.execution.run_id !== positiveRunId(expected.runId, 'Expected run id')) {
    throw new Error('Source preflight run id does not match the expected run.');
  }
  if (expected.headSha && receipt.execution.head_sha !== fullSha(expected.headSha, 'Expected head SHA')) {
    throw new Error('Source preflight head SHA does not match the expected head.');
  }
  if (
    receipt.execution.run_attempt !== 1
    || receipt.execution.event !== 'workflow_dispatch'
    || !operationScopes.includes(receipt.execution.operation_scope)
    || receipt.execution.ref !== 'refs/heads/main'
    || receipt.execution.workflow !== '.github/workflows/release-source-qualification.yml'
    || receipt.execution.execution_class !== 'github_hosted'
    || receipt.execution.runner_labels.length !== 1
    || receipt.execution.runner_labels[0] !== 'ubuntu-latest'
    || receipt.cohort.app.sha !== receipt.execution.head_sha
  ) {
    throw new Error('Source preflight execution identity is invalid.');
  }
  if (
    receipt.artifact.kind !== 'github_hosted_source_build_preflight'
    || receipt.artifact.diagnostic_only !== true
    || receipt.artifact.formal_candidate !== false
    || receipt.qualification.source_checks !== 'passed'
    || receipt.qualification.contract_checks !== 'passed'
    || receipt.qualification.build_checks !== 'passed'
    || receipt.qualification.build_invocation_count !== 1
    || receipt.qualification.formal_candidate_build_count !== 0
    || receipt.qualification.self_hosted_invocation_count !== 0
    || receipt.qualification.tart_vm_invocation_count !== 0
  ) {
    throw new Error('Source preflight qualification counts or execution class are invalid.');
  }
  if (
    receipt.authority.release_authority !== false
    || receipt.authority.namespace_reservation !== false
    || receipt.authority.final_signed_byte_authority !== false
    || receipt.authority.public_mutation_performed !== false
  ) {
    throw new Error('Source preflight receipt must remain non-authoritative for release mutation.');
  }
  if (
    !Array.isArray(receipt.workflow_blobs)
    || receipt.workflow_blobs.length !== requiredWorkflowPaths.length
    || !requiredWorkflowPaths.every((entry) => receipt.workflow_blobs.some((blob) => blob.path === entry))
  ) {
    throw new Error('Source preflight workflow byte binding is incomplete.');
  }
  return receipt;
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
      output: { type: 'string' }, receipt: { type: 'string' },
      'completed-at': { type: 'string' }, 'run-id': { type: 'string' }, 'run-attempt': { type: 'string' },
      'operation-scope': { type: 'string' },
      repository: { type: 'string' }, workflow: { type: 'string' }, event: { type: 'string' }, ref: { type: 'string' },
      'head-sha': { type: 'string' }, 'runner-label': { type: 'string', multiple: true, default: [] },
      'app-sha': { type: 'string' }, 'app-tree': { type: 'string' },
      'shell-sha': { type: 'string' }, 'shell-tree': { type: 'string' },
      'framework-sha': { type: 'string' }, 'framework-tree': { type: 'string' },
      'preflight-manifest': { type: 'string' }, 'cohort-manifest': { type: 'string' },
      'workflow-path': { type: 'string', multiple: true, default: [] }, 'app-root': { type: 'string' },
      'expected-digest': { type: 'string' }, 'expected-run-id': { type: 'string' }, 'expected-head-sha': { type: 'string' },
    },
  });
  const command = positionals[0] ?? '';
  if (command === 'create') {
    const required = (key: keyof typeof values) => requiredString(values[key], `--${String(key)}`);
    return {
      command,
      output: required('output'),
      input: {
        completedAt: required('completed-at'), operationScope: operationScope(required('operation-scope')),
        runId: required('run-id'), runAttempt: Number(required('run-attempt')),
        repository: required('repository'), workflow: required('workflow'), event: required('event'), ref: required('ref'),
        headSha: required('head-sha'), runnerLabels: values['runner-label'] ?? [],
        cohort: {
          app: { sha: required('app-sha'), tree: required('app-tree') },
          shell: { sha: required('shell-sha'), tree: required('shell-tree') },
          framework: { sha: required('framework-sha'), tree: required('framework-tree') },
        },
        preflightManifestPath: required('preflight-manifest'),
        cohortManifestPath: required('cohort-manifest'),
        workflowPaths: values['workflow-path'] ?? [],
        appRoot: required('app-root'),
      } satisfies SourceQualificationBuildInput,
    } as const;
  }
  if (command === 'verify') {
    return {
      command,
      output: requiredString(values.output, '--output'),
      receipt: requiredString(values.receipt, '--receipt'),
      expected: {
        digest: values['expected-digest'], runId: values['expected-run-id'], headSha: values['expected-head-sha'],
      },
    } as const;
  }
  throw new Error('Usage: source-qualification-receipt.ts <create|verify> [options].');
}

async function main(): Promise<void> {
  const options = cliOptions();
  if (options.command === 'create') {
    const receipt = buildSourceQualificationReceipt(options.input);
    writeJson(options.output, receipt);
    process.stdout.write(`${JSON.stringify({ status: 'created', receipt_digest: receipt.receipt_digest, output: path.resolve(options.output) })}\n`);
    return;
  }
  const receipt = validateSourceQualificationReceipt(
    JSON.parse(fs.readFileSync(options.receipt, 'utf8')),
    options.expected,
  );
  const output = {
    schema: 'opl_app_source_qualification_verification.v1',
    status: 'passed',
    receipt_digest: receipt.receipt_digest,
    run_id: receipt.execution.run_id,
    cohort: receipt.cohort,
  };
  writeJson(options.output, output);
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

const isMain = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
