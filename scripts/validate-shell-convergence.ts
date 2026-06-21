#!/usr/bin/env node

import { candidateValidationPolicyFromRegistry, validateCandidate } from './validate-shell-candidates/candidate-contract.ts';
import { validateActiveShellUnaffected, validateRegistryShape } from './validate-shell-candidates/registry.ts';
import { activeAdapterPath, readJson, registryPath } from './validate-shell-candidates/shared.ts';
import type { ShellCandidateRegistry, ValidationCommand } from './validate-shell-candidates/types.ts';

type ActiveShellAdapter = {
  active_shell: string;
  shell_root: string;
  shell_source: {
    owner_repo: string;
    checkout_path: string;
    history_policy: string;
  };
  release_role: string;
};

type FalseReadyBoundary = {
  active_shell_switch_allowed_by_this_readback: false;
  can_claim_active_shell_adopted: false;
  can_claim_app_release_ready: false;
  can_claim_production_ready: false;
  can_claim_live_user_path: false;
  can_claim_live_evidence: false;
  can_claim_packaged_gui_acceptance: false;
};

type ShellConvergenceReadback = {
  surface_kind: 'opl_app_shell_convergence_readback';
  schema_version: 1;
  status: 'closed_structure_gate_not_live_evidence';
  app_truth_owner: string;
  active_shell: string;
  active_shell_root: string;
  active_shell_source_repo: string;
  active_shell_release_role: string;
  mainline_shell: string;
  mainline_shell_root: string;
  mainline_source_repo: string;
  foreground_alternative: string;
  foreground_alternative_basis: string;
  archived_technical_proofs: string[];
  default_candidate_validation_scope: string[];
  agui_default_update_allowed: false;
  no_resurrection_policy_id: string;
  false_ready_boundary: FalseReadyBoundary;
  required_validation_commands: ValidationCommand[];
  manual_evidence_tail_commands: ValidationCommand[];
  source_refs: string[];
};

const status = 'closed_structure_gate_not_live_evidence' as const;

function main(): void {
  const registry = readJson<ShellCandidateRegistry>(registryPath);
  const adapter = readJson<ActiveShellAdapter>(activeAdapterPath);

  validateRegistryShape(registry);
  validateActiveShellUnaffected();

  const validationPolicy = candidateValidationPolicyFromRegistry(registry);
  const foregroundCandidate = registry.candidates.find((candidate) => (
    candidate.id === registry.alternative_gui_policy?.only_foreground_alternative
  ));
  if (!foregroundCandidate) {
    throw new Error('candidate registry must declare the foreground alternative candidate');
  }
  validateCandidate(foregroundCandidate, validationPolicy);

  const mainline = registry.active_gui_mainline;
  const alternative = registry.alternative_gui_policy;
  const noResurrection = registry.candidate_policy.no_resurrection_policy;
  if (!mainline || !alternative || !noResurrection) {
    throw new Error('candidate registry must declare mainline, alternative, and no-resurrection policies');
  }
  if (adapter.active_shell !== mainline.shell || adapter.shell_root !== mainline.shell_root) {
    throw new Error('active adapter must match active_gui_mainline');
  }
  if (adapter.shell_source.owner_repo !== mainline.source_repo) {
    throw new Error('active adapter source repo must match active_gui_mainline.source_repo');
  }
  if (alternative.default_candidate_validation_scope.some((candidateId) => (
    alternative.archived_technical_proofs.includes(candidateId)
  ))) {
    throw new Error('default candidate validation scope must exclude archived technical proofs');
  }
  if (registry.candidate_policy.adoption_gate.join('\n').includes('agui-codex')) {
    throw new Error('foreground adoption gate must not resurrect AGUI by name');
  }

  const candidateRootCommands = foregroundCandidate.technical_verification?.app_root_commands ?? [];
  const manualTailCommands = foregroundCandidate.technical_verification?.manual_verification_commands ?? [];
  const readback: ShellConvergenceReadback = {
    surface_kind: 'opl_app_shell_convergence_readback',
    schema_version: 1,
    status,
    app_truth_owner: registry.owner,
    active_shell: adapter.active_shell,
    active_shell_root: adapter.shell_root,
    active_shell_source_repo: adapter.shell_source.owner_repo,
    active_shell_release_role: adapter.release_role,
    mainline_shell: mainline.shell,
    mainline_shell_root: mainline.shell_root,
    mainline_source_repo: mainline.source_repo,
    foreground_alternative: alternative.only_foreground_alternative,
    foreground_alternative_basis: alternative.basis,
    archived_technical_proofs: [...alternative.archived_technical_proofs],
    default_candidate_validation_scope: [...alternative.default_candidate_validation_scope],
    agui_default_update_allowed: false,
    no_resurrection_policy_id: noResurrection.policy_id,
    false_ready_boundary: {
      active_shell_switch_allowed_by_this_readback: false,
      can_claim_active_shell_adopted: false,
      can_claim_app_release_ready: false,
      can_claim_production_ready: false,
      can_claim_live_user_path: false,
      can_claim_live_evidence: false,
      can_claim_packaged_gui_acceptance: false,
    },
    required_validation_commands: [
      {
        id: 'active_shell_quick_guard',
        cwd: '.',
        command: 'npm test',
      },
      {
        id: 'foreground_candidate_registry_scope',
        cwd: '.',
        command: 'npm run validate:shell-candidates',
      },
      {
        id: 'foreground_candidate_contract_or_blocker',
        cwd: '.',
        command: 'node --experimental-strip-types scripts/validate-hermes-candidate.ts',
      },
      ...candidateRootCommands.filter((entry) => [
        'candidate_registry',
        'candidate_contract_or_blocker',
      ].includes(entry.id)),
    ],
    manual_evidence_tail_commands: manualTailCommands,
    source_refs: [
      'contracts/app-shell-adapter.json',
      'contracts/app-shell-candidates.json',
      foregroundCandidate.adapter_contract,
      'scripts/validate-active-shell.ts',
      'scripts/validate-shell-candidates.ts',
      'scripts/validate-hermes-candidate.ts',
    ],
  };

  console.log(JSON.stringify(readback, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
