#!/usr/bin/env node

import { validateCandidate } from './validate-shell-candidates/candidate-contract.ts';
import { runCandidateCommands } from './validate-shell-candidates/candidate-evidence.ts';
import { validateActiveShellUnaffected, validateRegistryShape } from './validate-shell-candidates/registry.ts';
import { readJson, registryPath } from './validate-shell-candidates/shared.ts';
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
    release_participation: 'explicit_candidate_build_only_until_adopted',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
