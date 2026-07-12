#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import { writeLinesFile } from './release-file-helpers.ts';
import {
  assertSharedReleaseReadinessOptions,
  buildSharedReleaseReadinessOptions,
  parseStrictBoolean,
} from './release-readiness-args.ts';
import {
  buildReleaseCohortLock,
  type CommandRunner,
  type ReleaseCohortLock,
} from './release-cohort-lock.ts';

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
  action: 'run_release_preflight' | 'run_release_train_without_vm_smoke' | 'run_release_train_with_vm_smoke';
  command: string;
  reason: string;
};

export type ReleaseCohortPlan = {
  schema: 'opl_app_release_cohort_plan.v1';
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
    cohort_plan_can_publish_release: false;
    cohort_plan_can_write_runtime_truth: false;
    cohort_plan_can_claim_release_ready: false;
  };
};

function usage(): void {
  process.stdout.write(`Usage:
  npm run release:cohort-plan -- --version <version> --release-mode <mode>

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

function gitHead(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: appRoot,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

function defaultOptions(): ReleaseCohortPlanOptions {
  return {
    ...buildSharedReleaseReadinessOptions(parseStrictBoolean),
    releaseIntent: (process.env.OPL_RELEASE_INTENT || 'stable_complete') as ReleaseCohortPlanOptions['releaseIntent'],
    fullOmissionReason: process.env.OPL_FULL_OMISSION_REASON || '',
    gateReusePlanRef: process.env.OPL_RELEASE_GATE_REUSE_PLAN_REF || '',
    appCommit: process.env.OPL_APP_REF || process.env.OPL_APP_COMMIT || process.env.GITHUB_SHA || gitHead(),
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
  if (typeof values['app-commit'] === 'string') parsed.appCommit = values['app-commit'];
  if (typeof values['app-ref'] === 'string') parsed.appCommit = values['app-ref'];
  if (typeof values['shell-ref'] === 'string') parsed.shellRef = values['shell-ref'];
  if (typeof values['framework-ref'] === 'string') parsed.frameworkRef = values['framework-ref'];
  if (typeof values['shell-root'] === 'string') parsed.shellRoot = values['shell-root'];
  if (typeof values['framework-root'] === 'string') parsed.frameworkRoot = values['framework-root'];
  if (typeof values.output === 'string') parsed.output = values.output;
  if (typeof values.markdown === 'string') parsed.markdown = values.markdown;

  assertSharedReleaseReadinessOptions(parsed);
  if (!['stable_complete', 'standard_hotfix'].includes(parsed.releaseIntent)) {
    throw new Error('--release-intent must be stable_complete or standard_hotfix.');
  }
  if (parsed.releaseIntent === 'stable_complete' && !parsed.includeFullPackage) {
    throw new Error('stable_complete requires --include-full-package true.');
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

  return {
    ...parsed,
    shellRoot: path.resolve(parsed.shellRoot),
    frameworkRoot: path.resolve(parsed.frameworkRoot),
    output: parsed.output ? path.resolve(parsed.output) : path.resolve(appRoot, 'release-cohort-plan.json'),
    markdown: parsed.markdown ? path.resolve(parsed.markdown) : '',
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

function workflowDispatchRef(lock: ReleaseCohortLock): string {
  const ref = lock.app.requested_ref.trim();
  if (/^[0-9a-f]{7,40}$/i.test(ref)) {
    throw new Error(
      'App release dispatch requires a branch or tag ref; pass --app-ref <branch-or-tag> that resolves to the locked App SHA.',
    );
  }
  return ref;
}

function releaseCommand(options: ReleaseCohortPlanOptions, lock: ReleaseCohortLock): string {
  return [
    'gh workflow run "OPL Desktop Release"',
    `--ref ${workflowDispatchRef(lock)}`,
    `--field opl_version=${options.version}`,
    `--field release_mode=${options.releaseMode}`,
    `--field release_intent=${options.releaseIntent}`,
    `--field full_omission_reason=${shellQuote(options.fullOmissionReason.trim())}`,
    `--field release_operator_plan_ref=${operatorPlanRef(options, lock)}`,
    `--field gate_reuse_plan_ref=${shellQuote(options.gateReusePlanRef.trim())}`,
    `--field include_full_package=${boolText(options.includeFullPackage)}`,
    `--field run_vm_smoke=${boolText(options.runVmSmoke)}`,
    `--field publish_docker_webui=${boolText(options.publishDockerWebui)}`,
    `--field shell_ref=${lock.shell.resolved_sha}`,
    `--field framework_ref=${lock.framework.resolved_sha}`,
  ].join(' ');
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
    `--shell-ref ${lock.shell.resolved_sha}`,
    `--framework-ref ${lock.framework.resolved_sha}`,
  ].join(' ');
  const gates: CheapGate[] = [
    {
      id: 'release_cohort_lock',
      required: true,
      command: [
        'npm run release:cohort-lock --',
        `--app-ref ${lock.app.resolved_sha}`,
        `--shell-ref ${lock.shell.resolved_sha}`,
        `--framework-ref ${lock.framework.resolved_sha}`,
      ].join(' '),
      purpose: 'Record the immutable App, shell, and framework SHAs before release dispatch.',
    },
    {
      id: 'release_source_gate',
      required: true,
      command: [
        'npm run release:source-gate --',
        `--version ${options.version}`,
        `--app-ref ${lock.app.resolved_sha}`,
        `--shell-ref ${lock.shell.resolved_sha}`,
        `--framework-ref ${lock.framework.resolved_sha}`,
      ].join(' '),
      purpose: 'Validate the locked App, shell, and framework refs before expensive release work.',
    },
    {
      id: 'release_preflight',
      required: true,
      command: preflight,
      purpose: 'Validate the requested release cohort before expensive build, publish, Homebrew, or VM gates.',
    },
    {
      id: 'release_plan',
      required: true,
      command: [
        'npm run release:plan --',
        `--version ${options.version}`,
        options.includeFullPackage ? '--include-full-package' : '',
        options.runVmSmoke ? '' : '--no-settings-vm',
      ].filter(Boolean).join(' '),
      purpose: 'Materialize the deterministic release lane graph for this pinned cohort.',
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
  if (options.includeFullPackage) {
    gates.push({
      id: 'full_package_prune_audit',
      required: true,
      command: 'npm run release:full:prune-audit -- --markdown',
      purpose: 'Read back Full runtime prune policy before building the Full first-install cohort.',
    });
  }
  return gates;
}

function buildNextAction(options: ReleaseCohortPlanOptions, lock: ReleaseCohortLock): NextAction {
  const cheapGates = buildCheapGates(options, lock);
  const preflightCommand = cheapGates.find((gate) => gate.id === 'release_preflight')?.command;
  if (!preflightCommand) throw new Error('release_preflight gate is missing from cohort plan.');
  if (options.runVmSmoke) {
    return {
      action: 'run_release_train_with_vm_smoke',
      command: releaseCommand(options, lock),
      reason: 'VM smoke was requested, so the release train must preserve same-cohort VM proof gates.',
    };
  }
  return {
    action: options.includeFullPackage ? 'run_release_train_without_vm_smoke' : 'run_release_preflight',
    command: options.includeFullPackage ? releaseCommand(options, lock) : preflightCommand,
    reason: options.includeFullPackage
      ? 'Full package was requested without VM smoke; run the release train after cheap gates pass.'
      : 'Standard-only cohort can start with the cheap release preflight before expensive release work.',
  };
}

export function buildReleaseCohortPlan(
  options: ReleaseCohortPlanOptions,
  runner?: CommandRunner,
  generatedAt = new Date().toISOString(),
): ReleaseCohortPlan {
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
    next_action: buildNextAction(options, lock),
    authority_boundary: {
      cohort_plan_can_publish_release: false,
      cohort_plan_can_write_runtime_truth: false,
      cohort_plan_can_claim_release_ready: false,
    },
  };
}

export function writeReleaseCohortPlanMarkdown(filePath: string, plan: ReleaseCohortPlan): void {
  if (!filePath) return;
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
  writeLinesFile(filePath, lines);
}

export function writeReleaseCohortPlan(options: ReleaseCohortPlanOptions, plan: ReleaseCohortPlan): void {
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  writeReleaseCohortPlanMarkdown(options.markdown, plan);
}

function isMainModule(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
}

if (isMainModule()) {
  try {
    const options = parseReleaseCohortPlanArgs(process.argv.slice(2));
    const plan = buildReleaseCohortPlan(options);
    writeReleaseCohortPlan(options, plan);
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
