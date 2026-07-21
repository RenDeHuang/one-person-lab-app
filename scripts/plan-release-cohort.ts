#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import {
  assertSharedReleaseReadinessOptions,
  buildSharedReleaseReadinessOptions,
  parseStrictBoolean,
} from './release-readiness-args.ts';
import {
  appRefFromEnvironment,
  buildReleaseCohortLock,
  releaseCohortLockIdentity,
  writeCreateOnceArtifactSet,
  type ArtifactWriteFailureInjection,
  type CommandRunner,
  type ReleaseCohortLock,
} from './release-cohort-lock.ts';
import { assertReleaseVersionNotFuture } from './release-version.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export type ReleaseCohortPlanOptions = {
  version: string;
  releaseMode: string;
  releaseIntent: 'stable_complete' | 'standard_hotfix';
  fullOmissionReason: string;
  gateReusePlanRef: string;
  includeFullPackage: boolean;
  runVmSmoke: boolean;
  publishDockerWebui: boolean;
  appCommit: string;
  shellRef: string;
  frameworkRef: string;
  shellRoot: string;
  frameworkRoot: string;
  output: string;
  markdown: string;
};

type CheapGate = {
  id: string;
  required: boolean;
  command: string;
  purpose: string;
};

type NextAction = {
  action: 'framework_checkpoint_read_only_handoff';
  command: string;
  operation: 'standard';
  mutation_authorized: false;
  manual_handoff_required: true;
  reason: string;
};

export type ReleaseCohortPlan = {
  schema: 'opl_app_release_cohort_plan.v1';
  lifecycle?: 'retired_read_only_handoff';
  generated_at: string;
  version: string;
  tag: string;
  release_mode: string;
  release_intent: 'stable_complete' | 'standard_hotfix';
  full_omission_reason: string | null;
  operator_plan_ref: string;
  gate_reuse_plan_ref: string | null;
  app_commit: string;
  shell_ref: string;
  framework_ref: string;
  cohort_lock: ReleaseCohortLock;
  include_full_package: boolean;
  run_vm_smoke: boolean;
  publish_docker_webui: boolean;
  cheap_gates: CheapGate[];
  next_action: NextAction;
  authority_boundary: {
    cohort_plan_can_start_release?: false;
    cohort_plan_can_publish_release: false;
    cohort_plan_can_write_runtime_truth: false;
    cohort_plan_can_claim_release_ready: false;
  };
};

function usage(): void {
  process.stdout.write(`Usage:
  node --experimental-strip-types scripts/plan-release-cohort.ts --version <version> --release-mode <mode>

Options:
  --version <version>              OPL release version, for example 26.6.20.
  --release-mode <mode>            Release mode, for example new_release or refresh_existing.
  --release-intent <intent>        stable_complete or standard_hotfix. Default: stable_complete.
  --full-omission-reason <reason>  Required when release intent is standard_hotfix.
  --gate-reuse-plan-ref <ref>      Same-cohort reuse plan digest/ref after repeated attempts.
  --include-full-package <bool>    Whether the cohort includes the Full first-install package.
  --run-vm-smoke <bool>            Whether the cohort requests VM smoke gates.
  --app-ref <ref>                  App ref to resolve. Default: current git HEAD.
  --app-commit <sha>               Alias for --app-ref.
  --shell-ref <ref>                Active shell ref. Default: main.
  --framework-ref <ref>            OPL framework ref. Default: main.
  --shell-root <path>              Active shell checkout root. Default: shells/aionui.
  --framework-root <path>          OPL Framework checkout root. Default: ../one-person-lab.
  --output <path>                  Write cohort plan JSON.
  --markdown <path>                Write cohort plan Markdown.
  --help                          Show this message.
`);
}

function defaultOptions(): ReleaseCohortPlanOptions {
  return {
    ...buildSharedReleaseReadinessOptions(parseStrictBoolean),
    releaseIntent: (process.env.OPL_RELEASE_INTENT || 'stable_complete') as ReleaseCohortPlanOptions['releaseIntent'],
    fullOmissionReason: process.env.OPL_FULL_OMISSION_REASON || '',
    gateReusePlanRef: process.env.OPL_RELEASE_GATE_REUSE_PLAN_REF || '',
    appCommit: appRefFromEnvironment() || (() => {
      const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: appRoot, encoding: 'utf8' });
      return result.status === 0 ? result.stdout.trim() : '';
    })(),
    shellRef: process.env.OPL_SHELL_REF || 'main',
    frameworkRef: process.env.OPL_FRAMEWORK_REF || 'main',
    shellRoot: process.env.OPL_SHELL_ROOT || path.join(appRoot, 'shells', 'aionui'),
    frameworkRoot: process.env.OPL_FRAMEWORK_ROOT || path.resolve(appRoot, '..', 'one-person-lab'),
    output: process.env.OPL_RELEASE_COHORT_PLAN || '',
    markdown: process.env.OPL_RELEASE_COHORT_MARKDOWN || '',
  };
}

export function parseReleaseCohortPlanArgs(argv: string[]): ReleaseCohortPlanOptions {
  const parsed = defaultOptions();
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'string' },
      'release-mode': { type: 'string' },
      'release-intent': { type: 'string' },
      'full-omission-reason': { type: 'string' },
      'gate-reuse-plan-ref': { type: 'string' },
      'include-full-package': { type: 'string' },
      'run-vm-smoke': { type: 'string' },
      'publish-docker-webui': { type: 'string' },
      'app-commit': { type: 'string' },
      'app-ref': { type: 'string' },
      'shell-ref': { type: 'string' },
      'framework-ref': { type: 'string' },
      'shell-root': { type: 'string' },
      'framework-root': { type: 'string' },
      output: { type: 'string' },
      markdown: { type: 'string' },
    },
  });
  if (values.help) {
    usage();
    process.exit(0);
  }
  if (typeof values.version === 'string') parsed.version = values.version;
  if (typeof values['release-mode'] === 'string') parsed.releaseMode = values['release-mode'];
  if (typeof values['release-intent'] === 'string') {
    parsed.releaseIntent = values['release-intent'] as ReleaseCohortPlanOptions['releaseIntent'];
  }
  if (typeof values['full-omission-reason'] === 'string') parsed.fullOmissionReason = values['full-omission-reason'];
  if (typeof values['gate-reuse-plan-ref'] === 'string') parsed.gateReusePlanRef = values['gate-reuse-plan-ref'];
  if (typeof values['include-full-package'] === 'string') {
    parsed.includeFullPackage = parseStrictBoolean(values['include-full-package']);
  }
  if (typeof values['run-vm-smoke'] === 'string') parsed.runVmSmoke = parseStrictBoolean(values['run-vm-smoke']);
  if (typeof values['publish-docker-webui'] === 'string') {
    parsed.publishDockerWebui = parseStrictBoolean(values['publish-docker-webui'], true);
  }
  const appCommit = values['app-commit']?.trim();
  const appRef = values['app-ref']?.trim();
  if (appRef && appCommit && appRef !== appCommit) {
    throw new Error(`--app-ref and --app-commit disagree: ${appRef} != ${appCommit}.`);
  }
  if (appRef || appCommit) parsed.appCommit = appRef || appCommit || '';
  if (typeof values['shell-ref'] === 'string') parsed.shellRef = values['shell-ref'];
  if (typeof values['framework-ref'] === 'string') parsed.frameworkRef = values['framework-ref'];
  if (typeof values['shell-root'] === 'string') parsed.shellRoot = values['shell-root'];
  if (typeof values['framework-root'] === 'string') parsed.frameworkRoot = values['framework-root'];
  if (typeof values.output === 'string') parsed.output = values.output;
  if (typeof values.markdown === 'string') parsed.markdown = values.markdown;

  assertSharedReleaseReadinessOptions(parsed);
  assertReleaseVersionNotFuture('stable', parsed.version);
  if (!['stable_complete', 'standard_hotfix'].includes(parsed.releaseIntent)) {
    throw new Error('--release-intent must be stable_complete or standard_hotfix.');
  }
  if (parsed.releaseIntent === 'stable_complete') {
    if (!parsed.runVmSmoke) {
      throw new Error(
        'stable_complete requires --run-vm-smoke true for Standard qualification; --include-full-package only declares a non-blocking same-cohort add-on intent.',
      );
    }
    if (parsed.fullOmissionReason.trim()) {
      throw new Error('stable_complete does not accept --full-omission-reason; Full add-on intent is declared only by --include-full-package.');
    }
  }
  if (parsed.releaseIntent === 'standard_hotfix') {
    if (parsed.includeFullPackage) throw new Error('standard_hotfix requires --include-full-package false.');
    if (!parsed.fullOmissionReason.trim()) {
      throw new Error('standard_hotfix requires --full-omission-reason <reason>.');
    }
  }
  if (!parsed.appCommit.trim()) throw new Error('Pass --app-ref <ref>/--app-commit <sha> or run from a git checkout.');
  if (!parsed.shellRef.trim()) throw new Error('Pass --shell-ref <ref> or set OPL_SHELL_REF.');
  if (!parsed.frameworkRef.trim()) throw new Error('Pass --framework-ref <ref> or set OPL_FRAMEWORK_REF.');

  const output = parsed.output ? path.resolve(parsed.output) : path.resolve(appRoot, 'release-cohort-plan.json');
  const markdown = parsed.markdown ? path.resolve(parsed.markdown) : '';
  if (output && markdown && output === markdown) {
    throw new Error('--output and --markdown must be different paths.');
  }
  return {
    ...parsed,
    shellRoot: path.resolve(parsed.shellRoot),
    frameworkRoot: path.resolve(parsed.frameworkRoot),
    output,
    markdown,
  };
}

function releaseTag(version: string): string {
  return version.startsWith('v') ? version : `v${version}`;
}

function boolText(value: boolean): string {
  return value ? 'true' : 'false';
}

type ReleaseOperatorPlanIdentity = {
  version: string;
  releaseMode: string;
  releaseIntent: string;
  fullOmissionReason: string;
  includeFullPackage: boolean;
  runVmSmoke: boolean;
  publishDockerWebui: boolean;
  appSha: string;
  shellSha: string;
  frameworkSha: string;
};

export function buildReleaseOperatorPlanRef(identity: ReleaseOperatorPlanIdentity): string {
  const canonical = JSON.stringify({
    version: identity.version,
    release_mode: identity.releaseMode,
    release_intent: identity.releaseIntent,
    full_omission_reason: identity.fullOmissionReason.trim(),
    include_full_package: identity.includeFullPackage,
    run_vm_smoke: identity.runVmSmoke,
    publish_docker_webui: identity.publishDockerWebui,
    app_sha: identity.appSha.toLowerCase(),
    shell_sha: identity.shellSha.toLowerCase(),
    framework_sha: identity.frameworkSha.toLowerCase(),
  });
  return `sha256:${crypto.createHash('sha256').update(canonical).digest('hex')}`;
}

function operatorPlanRef(options: ReleaseCohortPlanOptions, lock: ReleaseCohortLock): string {
  return buildReleaseOperatorPlanRef({
    version: options.version,
    releaseMode: options.releaseMode,
    releaseIntent: options.releaseIntent,
    fullOmissionReason: options.fullOmissionReason,
    includeFullPackage: options.includeFullPackage,
    runVmSmoke: options.runVmSmoke,
    publishDockerWebui: options.publishDockerWebui,
    appSha: lock.app.resolved_sha,
    shellSha: lock.shell.resolved_sha,
    frameworkSha: lock.framework.resolved_sha,
  });
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function buildCheapGates(options: ReleaseCohortPlanOptions, lock: ReleaseCohortLock): CheapGate[] {
  const preflight = [
    'npm run release:preflight --',
    `--version ${options.version}`,
    `--release-mode ${options.releaseMode}`,
    `--release-intent ${options.releaseIntent}`,
    `--full-omission-reason ${shellQuote(options.fullOmissionReason.trim())}`,
    `--release-operator-plan-ref ${operatorPlanRef(options, lock)}`,
    `--gate-reuse-plan-ref ${shellQuote(options.gateReusePlanRef.trim())}`,
    `--include-full-package ${boolText(options.includeFullPackage)}`,
    `--run-vm-smoke ${boolText(options.runVmSmoke)}`,
    `--publish-docker-webui ${boolText(options.publishDockerWebui)}`,
    `--shell-ref ${lock.shell.resolved_sha}`,
    `--framework-ref ${lock.framework.resolved_sha}`,
  ].join(' ');
  const gates: CheapGate[] = [
    {
      id: 'release_source_gate',
      required: true,
      command: [
        'npm run release:source-gate --',
        `--version ${options.version}`,
        `--app-ref ${lock.app.resolved_sha}`,
        `--shell-ref ${lock.shell.resolved_sha}`,
        `--framework-ref ${lock.framework.resolved_sha}`,
        '--require-shell-format true',
        '--run-shell-tests true',
        `--shell-root ${shellQuote(options.shellRoot)}`,
        `--framework-root ${shellQuote(options.frameworkRoot)}`,
      ].join(' '),
      purpose: 'Validate the locked App, shell, and framework refs before expensive release work.',
    },
    {
      id: 'release_preflight',
      required: true,
      command: preflight,
      purpose: 'Validate the requested release cohort before expensive build, publish, Homebrew, or VM gates.',
    },
  ];
  if (options.runVmSmoke) {
    gates.push({
      id: 'vm_smoke_dependency_preflight',
      required: true,
      command: preflight,
      purpose: 'Keep shell, framework, and Codex package availability failures in the cheap preflight layer.',
    });
  }
  return gates;
}

function buildNextAction(
  options: ReleaseCohortPlanOptions,
): NextAction {
  return {
    action: 'framework_checkpoint_read_only_handoff',
    command: 'opl release status --bundle <sha256:digest> --store <directory>',
    operation: 'standard',
    mutation_authorized: false,
    manual_handoff_required: true,
    reason: options.includeFullPackage
      ? 'This legacy cohort plan is read-only. Hand the pinned refs to Framework opl release for Standard; Full may later use append_full on the same portable checkpoint.'
      : 'This legacy cohort plan is read-only. Hand the pinned refs to Framework opl release for Standard and inspect the resulting portable checkpoint.',
  };
}

export function buildReleaseCohortPlan(
  options: ReleaseCohortPlanOptions,
  runner?: CommandRunner,
  generatedAt = new Date().toISOString(),
): ReleaseCohortPlan {
  assertReleaseVersionNotFuture('stable', options.version);
  const lock = buildReleaseCohortLock({
    appRef: options.appCommit,
    shellRef: options.shellRef,
    frameworkRef: options.frameworkRef,
    repoRoot: appRoot,
    shellRoot: options.shellRoot,
    frameworkRoot: options.frameworkRoot,
    output: '',
    markdown: '',
  }, runner, generatedAt);
  return {
    schema: 'opl_app_release_cohort_plan.v1',
    lifecycle: 'retired_read_only_handoff',
    generated_at: generatedAt,
    version: options.version,
    tag: releaseTag(options.version),
    release_mode: options.releaseMode,
    release_intent: options.releaseIntent,
    full_omission_reason: options.fullOmissionReason.trim() || null,
    operator_plan_ref: operatorPlanRef(options, lock),
    gate_reuse_plan_ref: options.gateReusePlanRef.trim() || null,
    app_commit: lock.app.resolved_sha,
    shell_ref: options.shellRef,
    framework_ref: options.frameworkRef,
    cohort_lock: lock,
    include_full_package: options.includeFullPackage,
    run_vm_smoke: options.runVmSmoke,
    publish_docker_webui: options.publishDockerWebui,
    cheap_gates: buildCheapGates(options, lock),
    next_action: buildNextAction(options),
    authority_boundary: {
      cohort_plan_can_start_release: false,
      cohort_plan_can_publish_release: false,
      cohort_plan_can_write_runtime_truth: false,
      cohort_plan_can_claim_release_ready: false,
    },
  };
}

export function renderReleaseCohortPlanMarkdown(plan: ReleaseCohortPlan): string {
  const lines = [
    '# Release Cohort Plan',
    '',
    `- Schema: ${plan.schema}`,
    `- Version: ${plan.version}`,
    `- Tag: ${plan.tag}`,
    `- Release mode: ${plan.release_mode}`,
    `- Release intent: ${plan.release_intent}`,
    `- Full omission reason: ${plan.full_omission_reason ?? 'not applicable'}`,
    `- Operator plan ref: ${plan.operator_plan_ref}`,
    `- Gate reuse plan ref: ${plan.gate_reuse_plan_ref ?? 'not provided'}`,
    `- App commit: ${plan.app_commit}`,
    `- Shell ref: ${plan.shell_ref}`,
    `- Shell SHA: ${plan.cohort_lock.shell.resolved_sha}`,
    `- Framework ref: ${plan.framework_ref}`,
    `- Framework SHA: ${plan.cohort_lock.framework.resolved_sha}`,
    `- Cohort identity: ${releaseCohortLockIdentity(plan.cohort_lock)}`,
    `- Lifecycle: ${plan.lifecycle ?? 'historical_snapshot'}`,
    `- Include Full package: ${boolText(plan.include_full_package)}`,
    `- Run VM smoke: ${boolText(plan.run_vm_smoke)}`,
    `- Publish Docker WebUI: ${boolText(plan.publish_docker_webui)}`,
    `- Next action: ${plan.next_action.action}`,
    '',
    '| Cheap gate | Required | Command |',
    '| --- | --- | --- |',
    ...plan.cheap_gates.map((gate) => (
      `| ${gate.id} | ${boolText(gate.required)} | \`${gate.command.replaceAll('|', '\\|')}\` |`
    )),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function releaseCohortPlanIdentity(plan: ReleaseCohortPlan): string {
  const canonical = JSON.stringify({
    schema: plan.schema,
    version: plan.version,
    release_mode: plan.release_mode,
    release_intent: plan.release_intent,
    operator_plan_ref: plan.operator_plan_ref,
    gate_reuse_plan_ref: plan.gate_reuse_plan_ref,
    cohort_identity: releaseCohortLockIdentity(plan.cohort_lock),
    lifecycle: plan.lifecycle ?? null,
  });
  return `sha256:${crypto.createHash('sha256').update(canonical).digest('hex')}`;
}

export function writeReleaseCohortPlanMarkdown(filePath: string, plan: ReleaseCohortPlan): void {
  if (!filePath) return;
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(temporaryPath, renderReleaseCohortPlanMarkdown(plan), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  try {
    fs.renameSync(temporaryPath, filePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

export function writeReleaseCohortPlan(
  options: ReleaseCohortPlanOptions,
  plan: ReleaseCohortPlan,
  failureInjection: ArtifactWriteFailureInjection = {},
): ReleaseCohortPlan {
  return writeCreateOnceArtifactSet({
    output: options.output,
    markdown: options.markdown,
    value: plan,
    identity: releaseCohortPlanIdentity,
    label: 'Release cohort plan',
    renderMarkdown: renderReleaseCohortPlanMarkdown,
  }, failureInjection);
}

function isMainModule(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
}

if (isMainModule()) {
  process.stdout.write(`${JSON.stringify({
    schema: 'opl_app_retired_release_cohort_plan.v1',
    status: 'retired_fail_closed',
    lifecycle: 'historical_projection_only',
    authoritative_for_new_release: false,
    mutation_authorized: false,
    next_action: 'inspect_framework_checkpoint_and_receipts',
  }, null, 2)}\n`);
  process.exitCode = 2;
}
