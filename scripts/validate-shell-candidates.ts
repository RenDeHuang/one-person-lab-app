#!/usr/bin/env node

import { parseArgs as parseNodeArgs } from 'node:util';
import {
  candidateValidationPolicyFromRegistry,
  validateCandidate,
} from './validate-shell-candidates/candidate-contract.ts';
import { runCandidateCommands } from './validate-shell-candidates/candidate-evidence.ts';
import {
  assertReferenceCandidateCommandExecutionAllowed,
  validateActiveShellUnaffected,
  validateRegistryShape,
} from './validate-shell-candidates/registry.ts';
import { readJson, registryPath } from './validate-shell-candidates/shared.ts';
import type { ShellCandidateRegistry } from './validate-shell-candidates/types.ts';

export function parseArgs(argv: string[]): {
  candidate?: string;
  runCandidateCommands: boolean;
  manualReferenceReplay: boolean;
} {
  const { values } = parseNodeArgs({
    args: argv.slice(2),
    options: {
      candidate: { type: 'string' },
      'run-candidate-commands': { type: 'boolean' },
      'manual-reference-replay': { type: 'boolean' },
    } as const,
    allowPositionals: false,
    strict: true,
  });
  return {
    candidate: values.candidate,
    runCandidateCommands: values['run-candidate-commands'] === true,
    manualReferenceReplay: values['manual-reference-replay'] === true,
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
  if (args.runCandidateCommands) {
    assertReferenceCandidateCommandExecutionAllowed(
      registry,
      candidates.map((candidate) => candidate.id),
      args.manualReferenceReplay,
    );
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
    command_execution: args.runCandidateCommands ? 'explicit_candidate_commands' : 'source_and_contract_validation_only',
    manual_reference_replay: args.manualReferenceReplay,
    release_participation: 'explicit_candidate_build_only_until_adopted',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
