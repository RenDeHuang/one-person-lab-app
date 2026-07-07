#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs as parseNodeArgs } from 'node:util';
import {
  candidateValidationPolicyFromRegistry,
  validateCandidate,
} from './validate-shell-candidates/candidate-contract.ts';
import { runCandidateCommands } from './validate-shell-candidates/candidate-evidence.ts';
import { validateActiveShellUnaffected, validateRegistryShape } from './validate-shell-candidates/registry.ts';
import { readJson, registryPath, root } from './validate-shell-candidates/shared.ts';
import type { ShellCandidateRegistry } from './validate-shell-candidates/types.ts';

export function parseArgs(argv: string[]): { candidate?: string; runCandidateCommands: boolean } {
  const { values } = parseNodeArgs({
    args: argv.slice(2),
    options: {
      candidate: { type: 'string' },
      'run-candidate-commands': { type: 'boolean' },
    } as const,
    allowPositionals: false,
    strict: true,
  });
  return {
    candidate: values.candidate,
    runCandidateCommands: values['run-candidate-commands'] === true,
  };
}

function main(): void {
  const args = parseArgs(process.argv);
  const registry = readJson<ShellCandidateRegistry>(registryPath);
  validateRegistryShape(registry);
  validateActiveShellUnaffected();
  const validationPolicy = candidateValidationPolicyFromRegistry(registry);

  const candidates = args.candidate
    ? registry.candidates.filter((candidate) => candidate.id === args.candidate)
    : registry.candidates.filter((candidate) => registry.alternative_gui_policy?.default_candidate_validation_scope.includes(candidate.id));
  if (candidates.length === 0) {
    throw new Error(`No shell candidate matched ${args.candidate ?? 'default foreground alternative scope'}`);
  }
  for (const candidate of candidates) {
    validateCandidate(candidate, validationPolicy);
    if (args.runCandidateCommands) {
      runCandidateCommands(candidate);
    }
  }
  console.log(JSON.stringify({
    status: 'shell_candidates_valid',
    active_shell_unchanged: registry.active_shell_unchanged,
    candidate_count: candidates.length,
    candidates: candidates.map((candidate) => candidate.id),
    candidate_roles: candidates.map((candidate) => ({
      id: candidate.id,
      state: candidate.state,
      role: candidate.foreground_alternative_role ?? candidate.state,
      release_participation: candidate.release_participation,
    })),
    default_validation_scope: args.candidate ? 'explicit_candidate' : 'foreground_alternative_only',
    candidate_blockers: candidates.flatMap(candidateBlockers),
    release_participation: 'explicit_candidate_build_only_until_adopted',
  }, null, 2));
}

function candidateBlockers(candidate: { id: string }): Array<{ candidate: string; blockers: string[] }> {
  if (candidate.id === 'opl-native-workbench') {
    const checkoutPath = ['shells/opl-native-workbench', '../opl-native-workbench'].find((entry) => fs.existsSync(path.resolve(root, entry)));
    if (!checkoutPath) {
      return [{
        candidate: candidate.id,
        blockers: [
          'missing_shell_checkout:shells/opl-native-workbench',
          'missing_shell_checkout:../opl-native-workbench',
        ],
      }];
    }
    const missing = [
      'AGENTS.md',
      'README.md',
      'package.json',
      'src/bridge/oplBridge.ts',
      'src/workbench/App.tsx',
      'src/workbench/workbenchModel.ts',
      'src/candidateContractEvidence.json',
      'scripts/validate-native-workbench-candidate.mjs',
      'scripts/validate-state-model.mjs',
      'scripts/smoke-webui.mjs',
      'scripts/package-native-workbench.mjs',
    ].filter((relativePath) => !fs.existsSync(path.resolve(root, checkoutPath, relativePath)));
    return missing.length === 0
      ? []
      : [{
        candidate: candidate.id,
        blockers: missing.map((relativePath) => `missing_wrapper_file:${checkoutPath}/${relativePath}`),
      }];
  }
  if (candidate.id !== 'hermes-codex') {
    return [];
  }
  const checkoutPath = ['shells/hermes', '../opl-hermes-shell'].find((entry) => fs.existsSync(path.resolve(root, entry)));
  if (!checkoutPath) {
    return [{
      candidate: candidate.id,
      blockers: [
        'missing_shell_checkout:shells/hermes',
        'missing_shell_checkout:../opl-hermes-shell',
      ],
    }];
  }
  const missing = [
    'AGENTS.md',
    'README.md',
    'UPSTREAM_README.md',
    'electron/main.cjs',
    'electron/opl-bootstrap-runner.cjs',
    'electron/opl-codex-gateway.cjs',
    'electron/opl-bootstrap-runner.test.cjs',
    'electron/opl-codex-gateway.test.cjs',
    'scripts/package-opl-candidate-app.cjs',
    'scripts/validate-hermes-codex-candidate.cjs',
  ].filter((relativePath) => !fs.existsSync(path.resolve(root, checkoutPath, relativePath)));
  return missing.length === 0
    ? []
    : [{
      candidate: candidate.id,
      blockers: missing.map((relativePath) => `missing_wrapper_file:${checkoutPath}/${relativePath}`),
    }];
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
