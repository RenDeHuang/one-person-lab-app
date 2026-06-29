#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyStringOptionArg, requiredOptionValue } from './cli-option-args.ts';
import { writeLinesFile } from './release-file-helpers.ts';
import {
  buildReleaseCohortPlan,
  parseReleaseCohortPlanArgs,
  type ReleaseCohortPlan,
  type ReleaseCohortPlanOptions,
} from './plan-release-cohort.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type DiagnosticTarget = 'opl_first_run_vm' | 'desktop_release_diagnostics';

type DiagnosticCommand = {
  id: DiagnosticTarget;
  publishes_release: false;
  dispatches_workflow: false;
  command: string;
};

type OperatorNextAction = {
  action: 'follow_cohort_plan' | 'rerun_diagnostic_same_artifact';
  command: string;
  reason: string;
};

type OperatorState = {
  schema: 'opl_app_release_operator_state.v1';
  generated_at: string;
  command: 'plan' | 'diagnose-vm';
  status: 'planned' | 'diagnostic_command_ready';
  cohort_plan?: ReleaseCohortPlan;
  diagnostic_commands?: DiagnosticCommand[];
  next_action: OperatorNextAction;
  authority_boundary: {
    operator_can_publish_release: false;
    operator_can_write_runtime_truth: false;
    operator_can_dispatch_workflow_without_explicit_user_action: false;
  };
};

type OperatorOutputOptions = {
  output: string;
  markdown: string;
};

type DiagnoseVmOptions = OperatorOutputOptions & {
  version: string;
  releaseMode: string;
  releaseArtifactRunId: string;
  releaseArtifactName: string;
  diagnosticScope: string;
  buildStandardArtifact: boolean;
  runVmDiagnostic: boolean;
};

function usage(): void {
  process.stdout.write(`Usage:
  npm run release:operator -- plan --version <version> --release-mode <mode>
  npm run release:operator -- diagnose-vm --version <version> --release-artifact-run-id <run-id>

Subcommands:
  plan          Generate release-operator-state.json/md with an embedded cohort plan.
  diagnose-vm  Generate suggested VM diagnostic workflow commands only; does not dispatch.

Common options:
  --output <path>      Write release-operator-state.json.
  --markdown <path>    Write release-operator-state.md.
`);
}

function parseBoolean(value: string): boolean {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new Error(`Boolean value must be true or false, got ${value}`);
}

function defaultOutputOptions(): OperatorOutputOptions {
  return {
    output: process.env.OPL_RELEASE_OPERATOR_STATE || '',
    markdown: process.env.OPL_RELEASE_OPERATOR_MARKDOWN || '',
  };
}

function resolveOutputOptions(options: OperatorOutputOptions): OperatorOutputOptions {
  return {
    output: options.output ? path.resolve(options.output) : path.resolve(appRoot, 'release-operator-state.json'),
    markdown: options.markdown ? path.resolve(options.markdown) : '',
  };
}

function parsePlanArgs(argv: string[]): { cohort: ReleaseCohortPlanOptions; operator: OperatorOutputOptions } {
  const output = defaultOutputOptions();
  const cohortArgs: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const optionIndex = applyStringOptionArg(argv, index, {
      '--output': (value) => { output.output = value; },
      '--markdown': (value) => { output.markdown = value; },
    });
    if (optionIndex !== null) {
      index = optionIndex;
      continue;
    }
    cohortArgs.push(token);
  }
  return {
    cohort: parseReleaseCohortPlanArgs(cohortArgs),
    operator: resolveOutputOptions(output),
  };
}

function parseDiagnoseVmArgs(argv: string[]): DiagnoseVmOptions {
  const parsed: DiagnoseVmOptions = {
    ...defaultOutputOptions(),
    version: process.env.OPL_RELEASE_VERSION || '',
    releaseMode: process.env.OPL_RELEASE_MODE || 'refresh_existing',
    releaseArtifactRunId: process.env.OPL_RELEASE_ARTIFACT_RUN_ID || '',
    releaseArtifactName: process.env.OPL_RELEASE_ARTIFACT_NAME || 'macos-build-arm64-dmg',
    diagnosticScope: process.env.OPL_RELEASE_DIAGNOSTIC_SCOPE || 'existing_artifact',
    buildStandardArtifact: false,
    runVmDiagnostic: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      usage();
      process.exit(0);
    }
    if (token === '--build-standard-artifact' || token === '--run-vm-diagnostic') {
      const value = requiredOptionValue(argv, index, token);
      if (token === '--build-standard-artifact') parsed.buildStandardArtifact = parseBoolean(value);
      else parsed.runVmDiagnostic = parseBoolean(value);
      index += 1;
      continue;
    }
    const optionIndex = applyStringOptionArg(argv, index, {
      '--version': (value) => { parsed.version = value; },
      '--release-mode': (value) => { parsed.releaseMode = value; },
      '--release-artifact-run-id': (value) => { parsed.releaseArtifactRunId = value; },
      '--release-artifact-name': (value) => { parsed.releaseArtifactName = value; },
      '--diagnostic-scope': (value) => { parsed.diagnosticScope = value; },
      '--output': (value) => { parsed.output = value; },
      '--markdown': (value) => { parsed.markdown = value; },
    });
    if (optionIndex !== null) {
      index = optionIndex;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!parsed.version.trim()) throw new Error('Pass --version <version> or set OPL_RELEASE_VERSION.');
  if (!parsed.releaseArtifactRunId.trim()) {
    throw new Error('Pass --release-artifact-run-id <run-id> or set OPL_RELEASE_ARTIFACT_RUN_ID.');
  }
  return {
    ...parsed,
    ...resolveOutputOptions(parsed),
  };
}

function quoteField(value: string): string {
  return JSON.stringify(value);
}

function buildDiagnosticCommands(options: DiagnoseVmOptions): DiagnosticCommand[] {
  const firstRunVm = [
    'gh workflow run "OPL GUI First-Run VM"',
    `--field release_artifact_name=${quoteField(options.releaseArtifactName)}`,
    `--field release_artifact_run_id=${quoteField(options.releaseArtifactRunId)}`,
  ].join(' ');
  const diagnostics = [
    'gh workflow run desktop-release-diagnostics.yml',
    `--field opl_version=${quoteField(options.version)}`,
    `--field release_mode=${quoteField(options.releaseMode)}`,
    `--field diagnostic_scope=${quoteField(options.diagnosticScope)}`,
    `--field release_artifact_run_id=${quoteField(options.releaseArtifactRunId)}`,
    `--field release_artifact_name=${quoteField(options.releaseArtifactName)}`,
    `--field build_standard_artifact=${String(options.buildStandardArtifact)}`,
    `--field run_vm_diagnostic=${String(options.runVmDiagnostic)}`,
  ].join(' ');
  return [
    {
      id: 'opl_first_run_vm',
      publishes_release: false,
      dispatches_workflow: false,
      command: firstRunVm,
    },
    {
      id: 'desktop_release_diagnostics',
      publishes_release: false,
      dispatches_workflow: false,
      command: diagnostics,
    },
  ];
}

function buildPlanState(plan: ReleaseCohortPlan): OperatorState {
  return {
    schema: 'opl_app_release_operator_state.v1',
    generated_at: new Date().toISOString(),
    command: 'plan',
    status: 'planned',
    cohort_plan: plan,
    next_action: {
      action: 'follow_cohort_plan',
      command: plan.next_action.command,
      reason: 'Release operator plan is a controller surface over the pinned cohort plan.',
    },
    authority_boundary: {
      operator_can_publish_release: false,
      operator_can_write_runtime_truth: false,
      operator_can_dispatch_workflow_without_explicit_user_action: false,
    },
  };
}

function buildDiagnoseVmState(options: DiagnoseVmOptions): OperatorState {
  const diagnosticCommands = buildDiagnosticCommands(options);
  return {
    schema: 'opl_app_release_operator_state.v1',
    generated_at: new Date().toISOString(),
    command: 'diagnose-vm',
    status: 'diagnostic_command_ready',
    diagnostic_commands: diagnosticCommands,
    next_action: {
      action: 'rerun_diagnostic_same_artifact',
      command: diagnosticCommands[1].command,
      reason: 'Diagnose the same release artifact without publishing or writing runtime truth.',
    },
    authority_boundary: {
      operator_can_publish_release: false,
      operator_can_write_runtime_truth: false,
      operator_can_dispatch_workflow_without_explicit_user_action: false,
    },
  };
}

function writeOperatorMarkdown(filePath: string, state: OperatorState): void {
  if (!filePath) return;
  const lines = [
    '# Release Operator State',
    '',
    `- Schema: ${state.schema}`,
    `- Command: ${state.command}`,
    `- Status: ${state.status}`,
    `- Next action: ${state.next_action.action}`,
    `- Next command: \`${state.next_action.command.replaceAll('|', '\\|')}\``,
    '',
  ];
  if (state.cohort_plan) {
    lines.push(
      '## Cohort',
      '',
      `- Version: ${state.cohort_plan.version}`,
      `- Tag: ${state.cohort_plan.tag}`,
      `- App commit: ${state.cohort_plan.app_commit}`,
      `- Shell ref: ${state.cohort_plan.shell_ref}`,
      `- Framework ref: ${state.cohort_plan.framework_ref}`,
      '',
    );
  }
  if (state.diagnostic_commands) {
    lines.push('| Diagnostic | Dispatches workflow | Publishes release | Command |');
    lines.push('| --- | --- | --- | --- |');
    for (const command of state.diagnostic_commands) {
      lines.push(`| ${command.id} | ${String(command.dispatches_workflow)} | ${String(command.publishes_release)} | \`${command.command.replaceAll('|', '\\|')}\` |`);
    }
    lines.push('');
  }
  writeLinesFile(filePath, lines);
}

function writeOperatorState(options: OperatorOutputOptions, state: OperatorState): void {
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  writeOperatorMarkdown(options.markdown, state);
}

function main(): void {
  const [subcommand, ...args] = process.argv.slice(2);
  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    usage();
    process.exit(subcommand ? 0 : 1);
  }
  if (subcommand === 'plan') {
    const { cohort, operator } = parsePlanArgs(args);
    const plan = buildReleaseCohortPlan(cohort);
    const state = buildPlanState(plan);
    writeOperatorState(operator, state);
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    return;
  }
  if (subcommand === 'diagnose-vm') {
    const options = parseDiagnoseVmArgs(args);
    const state = buildDiagnoseVmState(options);
    writeOperatorState(options, state);
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    return;
  }
  throw new Error(`Unknown subcommand: ${subcommand}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
