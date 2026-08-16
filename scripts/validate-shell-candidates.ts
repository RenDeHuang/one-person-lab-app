#!/usr/bin/env node

import { parseArgs as parseNodeArgs } from 'node:util';
import {
  candidateValidationPolicyFromRegistry,
  validateCandidate,
} from './validate-shell-candidates/candidate-contract.ts';
import { runCandidateCommands } from './validate-shell-candidates/candidate-evidence.ts';
import {
  validateActiveShellUnaffected,
  validateRegistryShape,
} from './validate-shell-candidates/registry.ts';
import { readJson, registryPath } from './validate-shell-candidates/shared.ts';
import type { ShellCandidateRegistry } from './validate-shell-candidates/types.ts';

export function parseArgs(argv: string[]): {
  candidate?: string;
  runCandidateCommands: boolean;
} {
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
    : [];
  if (args.candidate && candidates.length === 0) {
    throw new Error(`No shell candidate matched ${args.candidate}`);
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
    role_registry: {
      active: registry.active_gui_mainline?.shell,
      foreground: registry.alternative_gui_policy?.only_foreground_alternative,
    },
    default_validation_scope: args.candidate ? 'explicit_candidate' : 'role_registry_only',
    command_execution: args.runCandidateCommands
      ? 'explicit_candidate_commands'
      : args.candidate
        ? 'explicit_source_and_contract_validation_only'
        : 'none_role_registry_only',
    release_participation: 'explicit_candidate_build_only_until_adopted',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
