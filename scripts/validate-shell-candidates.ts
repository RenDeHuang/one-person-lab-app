#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { validateCandidate } from './validate-shell-candidates/candidate-contract.ts';
import { runCandidateCommands } from './validate-shell-candidates/candidate-evidence.ts';
import { validateActiveShellUnaffected, validateRegistryShape } from './validate-shell-candidates/registry.ts';
import { readJson, registryPath, root } from './validate-shell-candidates/shared.ts';
import type { ShellCandidateRegistry } from './validate-shell-candidates/types.ts';

export function parseArgs(argv: string[]): { candidate?: string; runCandidateCommands: boolean } {
  const parsed = { candidate: undefined as string | undefined, runCandidateCommands: false };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--candidate') {
      const value = argv[++index];
      if (!value) throw new Error('Missing value for --candidate');
      parsed.candidate = value;
      continue;
    }
    if (token === '--run-candidate-commands') {
      parsed.runCandidateCommands = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return parsed;
}

function main(): void {
  const args = parseArgs(process.argv);
  const registry = readJson<ShellCandidateRegistry>(registryPath);
  validateRegistryShape(registry);
  validateActiveShellUnaffected();

  const candidates = args.candidate
    ? registry.candidates.filter((candidate) => candidate.id === args.candidate)
    : registry.candidates;
  if (candidates.length === 0) {
    throw new Error(`No shell candidate matched ${args.candidate}`);
  }
  for (const candidate of candidates) {
    validateCandidate(candidate);
    if (args.runCandidateCommands) {
      runCandidateCommands(candidate);
    }
  }
  console.log(JSON.stringify({
    status: 'shell_candidates_valid',
    active_shell_unchanged: registry.active_shell_unchanged,
    candidate_count: candidates.length,
    candidates: candidates.map((candidate) => candidate.id),
    candidate_blockers: candidates.flatMap(candidateBlockers),
    release_participation: 'explicit_candidate_build_only_until_adopted',
  }, null, 2));
}

function candidateBlockers(candidate: { id: string }): Array<{ candidate: string; blockers: string[] }> {
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
