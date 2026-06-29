#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyStringOptionArg } from './cli-option-args.ts';
import { writeLinesFile } from './release-file-helpers.ts';
import {
  applySharedReleaseReadinessArg,
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
  includeFullPackage: boolean;
  runVmSmoke: boolean;
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
  app_commit: string;
  shell_ref: string;
  framework_ref: string;
  cohort_lock: ReleaseCohortLock;
  include_full_package: boolean;
  run_vm_smoke: boolean;
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
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      usage();
      process.exit(0);
    }
    const sharedIndex = applySharedReleaseReadinessArg(argv, index, parsed, parseStrictBoolean);
    if (sharedIndex !== null) {
      index = sharedIndex;
      continue;
    }
    const optionIndex = applyStringOptionArg(argv, index, {
      '--app-commit': (value) => { parsed.appCommit = value; },
      '--app-ref': (value) => { parsed.appCommit = value; },
      '--shell-ref': (value) => { parsed.shellRef = value; },
      '--framework-ref': (value) => { parsed.frameworkRef = value; },
      '--shell-root': (value) => { parsed.shellRoot = value; },
      '--framework-root': (value) => { parsed.frameworkRoot = value; },
      '--output': (value) => { parsed.output = value; },
      '--markdown': (value) => { parsed.markdown = value; },
    });
    if (optionIndex !== null) {
      index = optionIndex;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  assertSharedReleaseReadinessOptions(parsed);
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

function releaseCommand(options: ReleaseCohortPlanOptions, lock: ReleaseCohortLock): string {
  return [
    'gh workflow run "OPL Desktop Release"',
    `--ref ${lock.app.resolved_sha}`,
    `--field opl_version=${options.version}`,
    `--field release_mode=${options.releaseMode}`,
    `--field include_full_package=${boolText(options.includeFullPackage)}`,
    `--field run_vm_smoke=${boolText(options.runVmSmoke)}`,
    `--field shell_ref=${lock.shell.resolved_sha}`,
    `--field framework_ref=${lock.framework.resolved_sha}`,
  ].join(' ');
}

function buildCheapGates(options: ReleaseCohortPlanOptions, lock: ReleaseCohortLock): CheapGate[] {
  const preflight = [
    'npm run release:preflight --',
    `--version ${options.version}`,
    `--release-mode ${options.releaseMode}`,
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
    app_commit: lock.app.resolved_sha,
    shell_ref: options.shellRef,
    framework_ref: options.frameworkRef,
    cohort_lock: lock,
    include_full_package: options.includeFullPackage,
    run_vm_smoke: options.runVmSmoke,
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
    `- App commit: ${plan.app_commit}`,
    `- Shell ref: ${plan.shell_ref}`,
    `- Shell SHA: ${plan.cohort_lock.shell.resolved_sha}`,
    `- Framework ref: ${plan.framework_ref}`,
    `- Framework SHA: ${plan.cohort_lock.framework.resolved_sha}`,
    `- Include Full package: ${boolText(plan.include_full_package)}`,
    `- Run VM smoke: ${boolText(plan.run_vm_smoke)}`,
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
