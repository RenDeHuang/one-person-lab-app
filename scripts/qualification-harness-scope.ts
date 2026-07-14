#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const shaPattern = /^[0-9a-f]{40}$/i;

const allowedAppPaths = new Set([
  '.github/workflows/opl-first-run-vm.yml',
  'contracts/app-release-channel.json',
  'scripts/README.md',
  'scripts/artifact-qualification-receipt.ts',
  'scripts/qualification-harness-scope.ts',
  'scripts/run-stable-release.ts',
  'scripts/validate-artifact-qualification-receipt.ts',
  'scripts/validate-release-addon-readiness.ts',
  'scripts/validate-release-boundary/release-checks.ts',
  'scripts/validate-release-boundary/release-contract-policy.ts',
  'scripts/write-artifact-qualification-receipt.ts',
  'scripts/write-first-run-vm-critical-diagnostics.ts',
  'tests/release/first-run-vm-critical-diagnostics.test.ts',
  'tests/release/qualification-harness-scope.test.ts',
  'tests/release/release-addon-readiness.test.ts',
  'tests/release/stable-release-state-machine.test.ts',
]);

const allowedShellPaths = new Set([
  'scripts/opl-first-run-vm-smoke.mjs',
  'tests/unit/opl-runtime/firstRunVmSmoke.test.ts',
]);

export type QualificationHarnessScopeProof = {
  schema: 'opl_app_qualification_harness_scope.v1';
  classification: 'same_as_artifact_cohort' | 'smoke_or_validator_only';
  app: {
    repo: 'gaofeng21cn/one-person-lab-app';
    base_sha: string;
    head_sha: string;
    changed_paths: string[];
  };
  shell: {
    repo: 'gaofeng21cn/opl-aion-shell';
    base_sha: string;
    head_sha: string;
    changed_paths: string[];
  };
};

export type QualificationHarnessScopeCommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string },
) => { status: number | null; stdout: string; stderr: string };

function defaultRunner(command: string, args: string[], options: { cwd?: string } = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function assertSha(label: string, value: string): string {
  if (!shaPattern.test(value)) throw new Error(`${label} must be an exact 40-character Git commit SHA.`);
  return value.toLowerCase();
}

function runOrThrow(
  runner: QualificationHarnessScopeCommandRunner,
  command: string,
  args: string[],
  cwd: string,
  label: string,
): string {
  const result = runner(command, args, { cwd });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `${command} exited ${String(result.status)}`;
    throw new Error(`${label}: ${detail}`);
  }
  return result.stdout;
}

export function collectRemoteChangedPaths(
  runner: QualificationHarnessScopeCommandRunner,
  repo: string,
  baseSha: string,
  headSha: string,
): string[] {
  const base = assertSha(`${repo} base`, baseSha);
  const head = assertSha(`${repo} head`, headSha);
  if (base === head) return [];

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-qualification-scope-'));
  try {
    runOrThrow(runner, 'git', ['init', '-q'], root, `initialize ${repo} scope checkout`);
    runOrThrow(
      runner,
      'git',
      ['remote', 'add', 'origin', `https://github.com/${repo}.git`],
      root,
      `configure ${repo} scope remote`,
    );
    for (const sha of [base, head]) {
      runOrThrow(
        runner,
        'git',
        ['fetch', '--no-tags', '--depth=1', 'origin', sha],
        root,
        `fetch ${repo}@${sha}`,
      );
      runOrThrow(runner, 'git', ['cat-file', '-e', `${sha}^{commit}`], root, `verify ${repo}@${sha}`);
    }
    const output = runOrThrow(
      runner,
      'git',
      ['diff', '--no-renames', '--name-only', '--diff-filter=ACDMRTUXB', base, head, '--'],
      root,
      `compare ${repo} qualification harness scope`,
    );
    return [...new Set(output.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean))].sort();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function validateChangedPaths(label: string, changedPaths: string[], allowlist: Set<string>): string[] {
  const normalized = [...new Set(changedPaths)].sort();
  if (normalized.length !== changedPaths.length || normalized.some((entry, index) => entry !== changedPaths[index])) {
    throw new Error(`${label} changed_paths must be sorted and unique.`);
  }
  const forbidden = normalized.filter((entry) => !allowlist.has(entry));
  if (forbidden.length > 0) {
    throw new Error(
      `${label} qualification harness changes product/runtime paths outside the allowlist: ${forbidden.join(', ')}`,
    );
  }
  return normalized;
}

export function buildQualificationHarnessScopeProof(input: {
  artifactAppSha: string;
  verificationAppSha: string;
  appChangedPaths: string[];
  artifactShellSha: string;
  verificationShellSha: string;
  shellChangedPaths: string[];
}): QualificationHarnessScopeProof {
  const artifactAppSha = assertSha('artifact App SHA', input.artifactAppSha);
  const verificationAppSha = assertSha('verification App SHA', input.verificationAppSha);
  const artifactShellSha = assertSha('artifact Shell SHA', input.artifactShellSha);
  const verificationShellSha = assertSha('verification Shell SHA', input.verificationShellSha);
  const appChangedPaths = validateChangedPaths('App', input.appChangedPaths, allowedAppPaths);
  const shellChangedPaths = validateChangedPaths('Shell', input.shellChangedPaths, allowedShellPaths);

  if ((artifactAppSha === verificationAppSha) !== (appChangedPaths.length === 0)) {
    throw new Error('App scope proof SHA equality is inconsistent with changed_paths.');
  }
  if ((artifactShellSha === verificationShellSha) !== (shellChangedPaths.length === 0)) {
    throw new Error('Shell scope proof SHA equality is inconsistent with changed_paths.');
  }
  const differs = appChangedPaths.length > 0 || shellChangedPaths.length > 0;
  return {
    schema: 'opl_app_qualification_harness_scope.v1',
    classification: differs ? 'smoke_or_validator_only' : 'same_as_artifact_cohort',
    app: {
      repo: 'gaofeng21cn/one-person-lab-app',
      base_sha: artifactAppSha,
      head_sha: verificationAppSha,
      changed_paths: appChangedPaths,
    },
    shell: {
      repo: 'gaofeng21cn/opl-aion-shell',
      base_sha: artifactShellSha,
      head_sha: verificationShellSha,
      changed_paths: shellChangedPaths,
    },
  };
}

export function validateQualificationHarnessScopeProof(
  proof: QualificationHarnessScopeProof | null | undefined,
  expected: {
    artifactAppSha?: string;
    verificationAppSha?: string;
    artifactShellSha?: string;
    verificationShellSha?: string;
  } = {},
): string[] {
  const errors: string[] = [];
  if (
    !proof ||
    typeof proof !== 'object' ||
    !proof.app ||
    typeof proof.app !== 'object' ||
    !Array.isArray(proof.app.changed_paths) ||
    !proof.shell ||
    typeof proof.shell !== 'object' ||
    !Array.isArray(proof.shell.changed_paths)
  ) {
    return ['qualification harness scope proof is missing or malformed'];
  }
  try {
    const normalized = buildQualificationHarnessScopeProof({
      artifactAppSha: proof.app.base_sha,
      verificationAppSha: proof.app.head_sha,
      appChangedPaths: proof.app.changed_paths,
      artifactShellSha: proof.shell.base_sha,
      verificationShellSha: proof.shell.head_sha,
      shellChangedPaths: proof.shell.changed_paths,
    });
    if (JSON.stringify(proof) !== JSON.stringify(normalized)) {
      errors.push('qualification harness scope proof fields are inconsistent');
    }
    for (const [label, actual, value] of [
      ['artifact App SHA', proof.app.base_sha, expected.artifactAppSha],
      ['verification App SHA', proof.app.head_sha, expected.verificationAppSha],
      ['artifact Shell SHA', proof.shell.base_sha, expected.artifactShellSha],
      ['verification Shell SHA', proof.shell.head_sha, expected.verificationShellSha],
    ] as const) {
      if (value && actual !== value.toLowerCase()) errors.push(`${label} is ${actual}`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return errors;
}

export function inspectQualificationHarnessScope(
  runner: QualificationHarnessScopeCommandRunner,
  input: {
    artifactAppSha: string;
    verificationAppSha: string;
    artifactShellSha: string;
    verificationShellSha: string;
  },
): QualificationHarnessScopeProof {
  return buildQualificationHarnessScopeProof({
    ...input,
    appChangedPaths: collectRemoteChangedPaths(
      runner,
      'gaofeng21cn/one-person-lab-app',
      input.artifactAppSha,
      input.verificationAppSha,
    ),
    shellChangedPaths: collectRemoteChangedPaths(
      runner,
      'gaofeng21cn/opl-aion-shell',
      input.artifactShellSha,
      input.verificationShellSha,
    ),
  });
}

function main(): void {
  const { values } = parseArgs({
    options: {
      'artifact-app-sha': { type: 'string' },
      'verification-app-sha': { type: 'string' },
      'artifact-shell-sha': { type: 'string' },
      'verification-shell-sha': { type: 'string' },
    },
    strict: true,
  });
  for (const key of [
    'artifact-app-sha',
    'verification-app-sha',
    'artifact-shell-sha',
    'verification-shell-sha',
  ] as const) {
    if (!values[key]) throw new Error(`Missing --${key}`);
  }
  const proof = inspectQualificationHarnessScope(defaultRunner, {
    artifactAppSha: values['artifact-app-sha']!,
    verificationAppSha: values['verification-app-sha']!,
    artifactShellSha: values['artifact-shell-sha']!,
    verificationShellSha: values['verification-shell-sha']!,
  });
  process.stdout.write(`${JSON.stringify(proof)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
