import path from 'node:path';
import {
  validateGuiProductContractPolicyFields,
  validateValidationCommandShape,
} from '../app-shell-adapter-contract-validators.ts';
import { assertFile, root } from './validation-config.ts';

export function validateGuiAuthority(contract, isDefaultReleaseAdapter) {
  if (contract.gui_authority?.source_of_truth !== 'one-person-lab-app') {
    throw new Error('Active shell GUI authority must stay in one-person-lab-app');
  }
  const expectedImplementationRole = contract.release_role === 'archived_technical_verification_shell'
    ? 'archived_technical_proof_replay_carrier'
    : 'active_shell_implementation_carrier';
  if (contract.gui_authority.implementation_role !== expectedImplementationRole) {
    throw new Error(`Active shell GUI implementation role must be ${expectedImplementationRole}`);
  }
  const requiredProductContracts = [
    'contracts/app-gui-product-contract.json',
    'contracts/app-runtime-bridge.json',
    'contracts/app-product-profile.json',
    'contracts/app-install-exposure-policy.json',
    'contracts/app-page-state-matrix.json',
    'contracts/app-first-run-test-matrix.json',
    'contracts/app-release-channel.json',
  ];
  for (const contractRef of requiredProductContracts) {
    if (!contract.gui_authority.product_contracts?.includes(contractRef)) {
      throw new Error(`Active shell GUI authority must include product contract ${contractRef}`);
    }
    assertFile(path.join(root, contractRef), `GUI authority contract ${contractRef}`);
  }
  const requiredShellOwnedSurface = [
    'concrete renderer implementation',
    'process and preload implementation',
    'shell package metadata',
    'shell tests and release hooks',
  ];
  if (isDefaultReleaseAdapter) {
    requiredShellOwnedSurface.push('upstream AionUI intake');
  }
  for (const allowed of requiredShellOwnedSurface) {
    if (!contract.gui_authority.shell_may_own?.includes(allowed)) {
      throw new Error(`Active shell GUI authority must declare shell-owned surface ${allowed}`);
    }
  }
  for (const forbidden of [
    'App GUI product truth',
    'App user-facing page-state authority',
    'App model-selection policy',
    'App onboarding policy',
    'App release/user documentation authority',
    'OPL runtime truth',
    'domain truth',
    'provider implementation',
  ]) {
    if (!contract.gui_authority.shell_must_not_own?.includes(forbidden)) {
      throw new Error(`Active shell GUI authority must exclude shell ownership of ${forbidden}`);
    }
  }
  if (contract.gui_authority.upstream_intake_policy !== 'check_against_app_owned_gui_contracts_before_acceptance') {
    throw new Error(`Unexpected GUI upstream intake policy: ${contract.gui_authority.upstream_intake_policy}`);
  }
}

export function validateShellReplacementPolicy(contract) {
  if (contract.shell_replacement_policy?.candidate_root_pattern !== 'shells/<candidate>') {
    throw new Error('Shell replacement policy must keep candidates under shells/<candidate>');
  }
  const expectedCandidateState = contract.release_role === 'archived_technical_verification_shell'
    ? 'archived_technical_proof_replay_only'
    : 'candidate_until_contracts_and_tests_complete';
  if (contract.shell_replacement_policy.candidate_state !== expectedCandidateState) {
    throw new Error(`Unexpected shell candidate state: ${contract.shell_replacement_policy.candidate_state}`);
  }
  if (contract.shell_replacement_policy.authority_transfer_allowed !== false) {
    throw new Error('Shell replacement must not transfer App GUI authority');
  }
  const requiredGates = contract.release_role === 'archived_technical_verification_shell'
    ? [
      'declare archived replay surface in contracts/app-shell-candidates.json',
      'consume contracts/app-gui-product-contract.json as replay acceptance input only',
      'sync App product profile into the archived replay shell target',
      'preserve archived page-state and first-run replay boundaries without default release claims',
      'pass App-root explicit adapter validation only when AGUI replay is requested',
      'pass explicit AGUI replay package compile through App wrapper',
      'preserve external checkout history policy and release isolation',
    ]
    : [
      'declare candidate in contracts/app-shell-candidates.json',
      'implement contracts/app-gui-product-contract.json',
      'sync App product profile into the candidate shell target',
      'pass App page-state and first-run matrices',
      'pass App-root active shell validation',
      'pass GUI package compile through App wrapper',
      'preserve external checkout history policy',
    ];
  for (const gate of requiredGates) {
    if (!contract.shell_replacement_policy.adoption_gate?.includes(gate)) {
      throw new Error(`Shell replacement policy missing gate ${gate}`);
    }
  }
  if (contract.shell_replacement_policy.adoption_gate.includes('declare candidate in contracts/app-shell-adapter.json')) {
    throw new Error('Shell replacement policy must not declare candidates inside contracts/app-shell-adapter.json');
  }
}

export function validateShellContractCapabilities(contract) {
  if (['experimental_candidate_shell', 'archived_technical_verification_shell'].includes(contract.release_role)) {
    for (const capability of [
      'candidate_app_bundle_package',
      'app_owned_gui_product_contract',
      'app_owned_runtime_bridge_contract',
      'app_gui_release_channel_gating',
    ]) {
      if (!contract.shell_contract.capabilities?.includes(capability)) {
        throw new Error(`Candidate shell capability missing ${capability}`);
      }
    }
    return;
  }
  for (const capability of [
    'app_owned_gui_product_contract',
    'app_owned_runtime_bridge_contract',
    'opl_app_state_bridge',
    'opl_app_action_bridge',
    'app_gui_release_channel_gating',
  ]) {
    if (!contract.shell_contract.capabilities?.includes(capability)) {
      throw new Error(`Active shell capability missing ${capability}`);
    }
  }
}

export function validateGuiProductContractPolicy(contract) {
  validateGuiProductContractPolicyFields(contract, { subject: 'Active shell' });
}

export function validateStateSurfaceContract(contract) {
  const stateSurface = contract.state_surface_contract;
  for (const [field, expected] of Object.entries({
    primary_read_command: 'opl app state --profile fast --json',
    refresh_read_command: 'opl app state --profile fast --json',
    full_state_read_command: 'opl app state --profile full --json',
    full_state_policy: 'diagnostic_or_release_evidence_only',
    action_command: 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
    full_drilldown_exception: 'opl runtime app-operator-drilldown --detail full --json',
  })) {
    if (stateSurface?.[field] !== expected) {
      throw new Error(`Active shell state_surface_contract.${field} must be ${expected}`);
    }
  }
  for (const forbiddenSource of [
    'direct opl connect modules --json page aggregation',
    'direct opl system developer-supervisor page aggregation',
    'direct opl family-runtime worker status page aggregation',
    'application.systemInfo as OPL path truth',
    'application.appVersions as OPL release truth',
    'direct reads of OPL internal state files',
  ]) {
    if (!stateSurface?.forbidden_gui_truth_sources?.includes(forbiddenSource)) {
      throw new Error(`Active shell state surface must forbid ${forbiddenSource}`);
    }
  }
}

export function validateValidationCommands(contract, shellPaths, resolveValidationCwd) {
  for (const entry of validateValidationCommandShape(contract)) {
    assertFile(resolveValidationCwd(entry, contract, shellPaths), `validation cwd for ${entry.id}`);
  }
}
