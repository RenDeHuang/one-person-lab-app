#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const shaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const runIdPattern = /^[1-9][0-9]*$/;
const requiredSettingsPages = [
  'general',
  'environment',
  'capabilities',
  'access',
  'appearance',
  'diagnostics',
  'about',
  'runtime-settings-alias',
  'runtime-status',
] as const;
const requiredAssistantRoutes = ['mas', 'mag', 'rca'] as const;
const requiredRuntimeRoutes = ['#/settings/runtime', '#/runtime'] as const;
const requiredWorkflowPaths = [
  '.github/workflows/release-source-qualification.yml',
  'contracts/app-source-qualification-receipt.schema.json',
  'scripts/source-qualification-receipt.ts',
  'scripts/validate-source-qualification-receipt.ts',
] as const;

type JsonRecord = Record<string, any>;

export type RepositoryIdentity = {
  sha: string;
  tree: string;
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
    ref: 'refs/heads/main';
    head_sha: string;
    run_id: string;
    run_attempt: 1;
    runner_labels: string[];
  };
  cohort: {
    app: RepositoryIdentity;
    shell: RepositoryIdentity;
    framework: RepositoryIdentity;
  };
  artifact: {
    kind: 'local_unsigned_standard_dmg';
    basename: string;
    size_bytes: number;
    sha256: string;
    diagnostic_only: true;
  };
  evidence: Record<'command_manifest' | 'cohort_manifest' | 'build_cohort' | 'smoke_summary' | 'vm_closeout', FileEvidence>;
  qualification: {
    runtime_profile: 'standard';
    settings_pages: string[];
    assistant_routes: string[];
    runtime_routes: string[];
    build_invocation_count: 1;
    tart_vm_invocation_count: 1;
    target_vm_final_state: 'absent';
    source_vm_final_state: 'stopped';
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

export type SourceQualificationBuildInput = {
  completedAt: string;
  runId: string;
  runAttempt: number;
  repository: string;
  workflow: string;
  event: string;
  ref: string;
  headSha: string;
  runnerLabels: string[];
  cohort: SourceQualificationReceipt['cohort'];
  dmgPath: string;
  commandManifestPath: string;
  cohortManifestPath: string;
  buildCohortPath: string;
  smokeSummaryPath: string;
  vmCloseoutPath: string;
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
    throw new Error('Source qualification must bind the exact workflow, schema, receipt, and verifier files.');
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

function sameStrings(actual: unknown, expected: readonly string[], label: string): string[] {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    throw new Error(`${label} must contain the exact contracted entries.`);
  }
  const normalized = actual.map((entry) => requiredString(entry, label));
  if (normalized.some((entry, index) => entry !== expected[index])) {
    throw new Error(`${label} must preserve the exact contracted order.`);
  }
  return normalized;
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
  if (input.runAttempt !== 1) throw new Error('Source qualification accepts only run attempt 1.');
  if (input.repository !== 'gaofeng21cn/one-person-lab-app') throw new Error('Source qualification repository is invalid.');
  if (input.workflow !== '.github/workflows/release-source-qualification.yml') throw new Error('Source qualification workflow is invalid.');
  if (input.event !== 'workflow_dispatch' || input.ref !== 'refs/heads/main') {
    throw new Error('Source qualification must be a main-only workflow_dispatch run.');
  }
  const cohort = {
    app: repositoryIdentity(input.cohort.app, 'App'),
    shell: repositoryIdentity(input.cohort.shell, 'Shell'),
    framework: repositoryIdentity(input.cohort.framework, 'Framework'),
  };
  const headSha = fullSha(input.headSha, 'Execution head SHA');
  if (cohort.app.sha !== headSha) throw new Error('Source qualification App cohort does not match the workflow head.');
  const runnerLabels = [...new Set(input.runnerLabels.map((entry) => requiredString(entry, 'Runner label')))].sort();
  for (const required of ['self-hosted', 'macOS', 'opl-gui-vm']) {
    if (!runnerLabels.includes(required)) throw new Error(`Source qualification runner is missing label ${required}.`);
  }

  const dmg = regularFileEvidence(input.dmgPath, 'Source qualification DMG');
  if (!/^One-Person-Lab-[0-9]+\.[0-9]+\.[0-9]+(?:-r[1-9][0-9]*)?-mac-arm64\.dmg$/.test(dmg.basename)) {
    throw new Error('Source qualification DMG basename is invalid.');
  }
  const commandManifest = readJson(input.commandManifestPath, 'Source qualification command manifest');
  const cohortManifest = readJson(input.cohortManifestPath, 'Source qualification cohort manifest');
  const buildCohort = readJson(input.buildCohortPath, 'Build cohort manifest');
  const smokeSummary = readJson(input.smokeSummaryPath, 'Tart smoke summary');
  const vmCloseout = readJson(input.vmCloseoutPath, 'VM closeout readback');

  if (
    commandManifest.schema !== 'opl_source_qualification_command_manifest.v1'
    || commandManifest.build_invocation_count !== 1
    || commandManifest.tart_vm_invocation_count !== 1
  ) {
    throw new Error('Source qualification command manifest must bind exactly one build and one Tart VM invocation.');
  }
  const manifestCohort = object(cohortManifest.cohort, 'Source qualification cohort manifest cohort');
  for (const name of ['app', 'shell', 'framework'] as const) {
    if (manifestCohort[name]?.sha !== cohort[name].sha || manifestCohort[name]?.tree !== cohort[name].tree) {
      throw new Error(`Source qualification cohort manifest drifted at ${name}.`);
    }
  }
  if (
    cohortManifest.dmg?.sha256 !== dmg.sha256.replace('sha256:', '')
    && cohortManifest.dmg?.sha256 !== dmg.sha256
  ) {
    throw new Error('Source qualification cohort manifest DMG digest drifted.');
  }
  if (
    buildCohort.schema !== 'opl_app_build_artifact_cohort.v2'
    || buildCohort.cohort?.app_sha !== cohort.app.sha
    || buildCohort.cohort?.shell_sha !== cohort.shell.sha
    || buildCohort.cohort?.framework_sha !== cohort.framework.sha
  ) {
    throw new Error('Build cohort manifest does not bind the source qualification cohort.');
  }
  if (smokeSummary.status !== 'passed' || smokeSummary.runtime_profile !== 'standard') {
    throw new Error('Tart smoke summary must pass the Standard runtime profile.');
  }
  const settingsPages = sameStrings(smokeSummary.settings_smoke?.pages, requiredSettingsPages, 'Settings pages');
  if (smokeSummary.settings_smoke?.status !== 'passed') throw new Error('Settings smoke did not pass.');
  const assistantRoutes = sameStrings(
    smokeSummary.assistant_route_smoke?.assistants,
    requiredAssistantRoutes,
    'Assistant routes',
  );
  if (smokeSummary.assistant_route_smoke?.status !== 'passed') throw new Error('Assistant route smoke did not pass.');
  if (
    smokeSummary.vm_cleanup?.status !== 'passed'
    || smokeSummary.vm_cleanup?.inspection?.state !== 'absent'
    || vmCloseout.target_vm_state !== 'absent'
    || vmCloseout.source_vm_state !== 'stopped'
  ) {
    throw new Error('Source qualification VM closeout is incomplete.');
  }

  const core: Omit<SourceQualificationReceipt, 'receipt_digest'> = {
    schema: 'opl_app_source_qualification_receipt.v1',
    status: 'passed',
    mode: 'development_validation',
    completed_at: completedAt,
    execution: {
      repository: 'gaofeng21cn/one-person-lab-app',
      workflow: '.github/workflows/release-source-qualification.yml',
      event: 'workflow_dispatch',
      ref: 'refs/heads/main',
      head_sha: headSha,
      run_id: positiveRunId(input.runId, 'Source qualification run id'),
      run_attempt: 1,
      runner_labels: runnerLabels,
    },
    cohort,
    artifact: {
      kind: 'local_unsigned_standard_dmg',
      basename: dmg.basename,
      size_bytes: dmg.size_bytes,
      sha256: dmg.sha256,
      diagnostic_only: true,
    },
    evidence: {
      command_manifest: regularFileEvidence(input.commandManifestPath, 'Command manifest'),
      cohort_manifest: regularFileEvidence(input.cohortManifestPath, 'Cohort manifest'),
      build_cohort: regularFileEvidence(input.buildCohortPath, 'Build cohort'),
      smoke_summary: regularFileEvidence(input.smokeSummaryPath, 'Smoke summary'),
      vm_closeout: regularFileEvidence(input.vmCloseoutPath, 'VM closeout'),
    },
    qualification: {
      runtime_profile: 'standard',
      settings_pages: settingsPages,
      assistant_routes: assistantRoutes,
      runtime_routes: [...requiredRuntimeRoutes],
      build_invocation_count: 1,
      tart_vm_invocation_count: 1,
      target_vm_final_state: 'absent',
      source_vm_final_state: 'stopped',
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
  const receipt = object(value, 'Source qualification receipt') as SourceQualificationReceipt;
  if (
    receipt.schema !== 'opl_app_source_qualification_receipt.v1'
    || receipt.status !== 'passed'
    || receipt.mode !== 'development_validation'
  ) {
    throw new Error('Source qualification receipt schema, status, or mode is invalid.');
  }
  const { receipt_digest: declaredDigest, ...core } = receipt;
  const computedDigest = sourceQualificationReceiptDigest(
    core as Omit<SourceQualificationReceipt, 'receipt_digest'>,
  );
  if (declaredDigest !== computedDigest) throw new Error('Source qualification receipt digest is invalid.');
  if (expected.digest && expected.digest !== computedDigest) throw new Error('Source qualification receipt digest does not match the expected digest.');
  if (expected.digest && !digestPattern.test(expected.digest)) throw new Error('Expected source qualification digest is invalid.');
  if (expected.runId && receipt.execution.run_id !== positiveRunId(expected.runId, 'Expected run id')) {
    throw new Error('Source qualification run id does not match the expected run.');
  }
  if (expected.headSha && receipt.execution.head_sha !== fullSha(expected.headSha, 'Expected head SHA')) {
    throw new Error('Source qualification head SHA does not match the expected head.');
  }
  if (
    receipt.execution.run_attempt !== 1
    || receipt.execution.event !== 'workflow_dispatch'
    || receipt.execution.ref !== 'refs/heads/main'
    || receipt.execution.workflow !== '.github/workflows/release-source-qualification.yml'
    || receipt.cohort.app.sha !== receipt.execution.head_sha
  ) {
    throw new Error('Source qualification execution identity is invalid.');
  }
  if (
    receipt.authority.release_authority !== false
    || receipt.authority.namespace_reservation !== false
    || receipt.authority.final_signed_byte_authority !== false
    || receipt.authority.public_mutation_performed !== false
  ) {
    throw new Error('Source qualification receipt must remain non-authoritative for release mutation.');
  }
  sameStrings(receipt.qualification.settings_pages, requiredSettingsPages, 'Settings pages');
  sameStrings(receipt.qualification.assistant_routes, requiredAssistantRoutes, 'Assistant routes');
  sameStrings(receipt.qualification.runtime_routes, requiredRuntimeRoutes, 'Runtime routes');
  if (
    receipt.qualification.build_invocation_count !== 1
    || receipt.qualification.tart_vm_invocation_count !== 1
    || receipt.qualification.target_vm_final_state !== 'absent'
    || receipt.qualification.source_vm_final_state !== 'stopped'
  ) {
    throw new Error('Source qualification operation counts or closeout state are invalid.');
  }
  if (
    !Array.isArray(receipt.workflow_blobs)
    || receipt.workflow_blobs.length !== requiredWorkflowPaths.length
    || !requiredWorkflowPaths.every((entry) => receipt.workflow_blobs.some((blob) => blob.path === entry))
  ) {
    throw new Error('Source qualification workflow byte binding is incomplete.');
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
      repository: { type: 'string' }, workflow: { type: 'string' }, event: { type: 'string' }, ref: { type: 'string' },
      'head-sha': { type: 'string' }, 'runner-label': { type: 'string', multiple: true, default: [] },
      'app-sha': { type: 'string' }, 'app-tree': { type: 'string' },
      'shell-sha': { type: 'string' }, 'shell-tree': { type: 'string' },
      'framework-sha': { type: 'string' }, 'framework-tree': { type: 'string' },
      dmg: { type: 'string' }, 'command-manifest': { type: 'string' }, 'cohort-manifest': { type: 'string' },
      'build-cohort': { type: 'string' }, 'smoke-summary': { type: 'string' }, 'vm-closeout': { type: 'string' },
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
        completedAt: required('completed-at'), runId: required('run-id'), runAttempt: Number(required('run-attempt')),
        repository: required('repository'), workflow: required('workflow'), event: required('event'), ref: required('ref'),
        headSha: required('head-sha'), runnerLabels: values['runner-label'] ?? [],
        cohort: {
          app: { sha: required('app-sha'), tree: required('app-tree') },
          shell: { sha: required('shell-sha'), tree: required('shell-tree') },
          framework: { sha: required('framework-sha'), tree: required('framework-tree') },
        },
        dmgPath: required('dmg'), commandManifestPath: required('command-manifest'),
        cohortManifestPath: required('cohort-manifest'), buildCohortPath: required('build-cohort'),
        smokeSummaryPath: required('smoke-summary'), vmCloseoutPath: required('vm-closeout'),
        workflowPaths: values['workflow-path'] ?? [], appRoot: required('app-root'),
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
