import path from 'node:path';
import { resolveActiveShellPaths } from '../app-shell-adapter.ts';
import { assertDeepEqualJson } from './assertions.ts';
import { assertFile, root } from './validation-config.ts';

export function resolveValidationCwd(entry, contract, shellPaths) {
  if (entry.cwd === contract.shell_root) {
    return shellPaths.shellRoot;
  }
  return path.join(root, entry.cwd);
}

export function isDefaultReleaseAdapter(contract) {
  return contract.active_shell === 'aionui' && contract.shell_root === 'shells/aionui';
}

export function validateContractShape(contract) {
  if (contract.app_repo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`Unexpected app_repo: ${contract.app_repo}`);
  }
  if (contract.active_shell === 'aionui' && contract.shell_source?.owner_repo !== 'gaofeng21cn/opl-aion-shell') {
    throw new Error(`Unexpected AionUI shell_source owner: ${contract.shell_source?.owner_repo}`);
  }
  if (contract.shell_source?.history_policy !== 'external_checkout_not_merged_into_app_default_branch') {
    throw new Error(`Unexpected shell history policy: ${contract.shell_source?.history_policy}`);
  }
  if (contract.runtime_bridge_contract !== 'contracts/app-runtime-bridge.json') {
    throw new Error(`Unexpected runtime bridge contract ref: ${contract.runtime_bridge_contract}`);
  }
  if (contract.gui_authority?.source_of_truth !== 'one-person-lab-app') {
    throw new Error('Active shell GUI authority must stay in one-person-lab-app');
  }
  if (contract.gui_authority.implementation_role !== 'active_shell_implementation_carrier') {
    throw new Error('Active shell GUI implementation role must be active_shell_implementation_carrier');
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
  if (isDefaultReleaseAdapter(contract)) {
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
  if (isDefaultReleaseAdapter(contract)) {
    validateUpstreamIntakePolicy(contract);
  }
  if (contract.shell_replacement_policy?.candidate_root_pattern !== 'shells/<candidate>') {
    throw new Error('Shell replacement policy must keep candidates under shells/<candidate>');
  }
  if (contract.shell_replacement_policy.candidate_state !== 'candidate_until_contracts_and_tests_complete') {
    throw new Error(`Unexpected shell candidate state: ${contract.shell_replacement_policy.candidate_state}`);
  }
  if (contract.shell_replacement_policy.authority_transfer_allowed !== false) {
    throw new Error('Shell replacement must not transfer App GUI authority');
  }
  for (const gate of [
    'declare candidate in contracts/app-shell-candidates.json',
    'implement contracts/app-gui-product-contract.json',
    'sync App product profile into the candidate shell target',
    'pass App page-state and first-run matrices',
    'pass App-root active shell validation',
    'pass GUI package compile through App wrapper',
    'preserve external checkout history policy',
  ]) {
    if (!contract.shell_replacement_policy.adoption_gate?.includes(gate)) {
      throw new Error(`Shell replacement policy missing adoption gate ${gate}`);
    }
  }
  if (contract.shell_replacement_policy.adoption_gate.includes('declare candidate in contracts/app-shell-adapter.json')) {
    throw new Error('Shell replacement policy must not declare candidates inside contracts/app-shell-adapter.json');
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
  if (contract.gui_product_contract !== 'contracts/app-gui-product-contract.json') {
    throw new Error(`Unexpected active shell gui_product_contract: ${contract.gui_product_contract}`);
  }
  if (contract.gui_product_contract_policy?.must_implement !== true) {
    throw new Error('Active shell must implement the App GUI product contract');
  }
  if (contract.gui_product_contract_policy.source_of_truth !== 'one-person-lab-app') {
    throw new Error('Active shell GUI product contract source of truth must stay in one-person-lab-app');
  }
  if (contract.gui_product_contract_policy.upstream_override_allowed !== false) {
    throw new Error('AionUI upstream must not override App GUI product truth');
  }
  if (contract.gui_product_contract_policy.upstream_family_role !== 'implementation_material_only') {
    throw new Error(`Unexpected upstream GUI role: ${contract.gui_product_contract_policy.upstream_family_role}`);
  }
  if (
    contract.gui_product_contract_policy.upstream_must_not_override_app_truth !== true
    && contract.gui_product_contract_policy.aionui_upstream_must_not_override_app_truth !== true
  ) {
    throw new Error('Active shell must declare that upstream GUI behavior cannot override App truth');
  }
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

  const shellPaths = resolveActiveShellPaths({ contract });
  assertFile(shellPaths.shellRoot, 'active shell root');
  assertFile(shellPaths.packageManifestPath, 'active shell package.json');
  assertFile(shellPaths.agentsGuidePath, 'active shell AGENTS.md');
  assertFile(shellPaths.vitestConfigPath, 'active shell vitest config');
  assertFile(shellPaths.electronBuilderConfigPath, 'active shell electron-builder config');

  if (!Array.isArray(contract.validation_commands) || contract.validation_commands.length === 0) {
    throw new Error('validation_commands must be a non-empty array');
  }

  for (const entry of contract.validation_commands) {
    if (!entry.id || !entry.cwd || !entry.command) {
      throw new Error(`Invalid validation command entry: ${JSON.stringify(entry)}`);
    }
    assertFile(resolveValidationCwd(entry, contract, shellPaths), `validation cwd for ${entry.id}`);
  }
}

function validateUpstreamIntakePolicy(contract) {
  const upstreamIntake = contract.upstream_intake;
  if (upstreamIntake?.classification_policy !== 'classify_each_upstream_feature_before_app_release') {
    throw new Error('Active shell upstream_intake.classification_policy must classify every upstream feature before release');
  }
  assertDeepEqualJson(
    upstreamIntake.allowed_classifications,
    ['accepted', 'rejected', 'redirected', 'requires_app_contract'],
    'Active shell upstream intake classifications',
  );
  assertDeepEqualJson(
    upstreamIntake.required_feature_record_fields,
    ['id', 'upstream_surface', 'classification', 'app_contract_ref', 'release_gate'],
    'Active shell upstream intake required record fields',
  );
  const teamIntake = (upstreamIntake.feature_classifications ?? []).find((entry) => entry.id === 'aionui_team');
  if (
    teamIntake?.classification !== 'rejected' ||
    teamIntake?.ordinary_surface !== 'forbidden' ||
    teamIntake?.app_contract_ref !== 'contracts/app-gui-product-contract.json#settings_navigation.team_surface_policy' ||
    teamIntake?.release_gate !== 'implementation_probes.aionui_team_disabled_surface'
  ) {
    throw new Error('Active shell upstream intake must classify AionUI Team as rejected for ordinary surfaces');
  }
  const teamPolicy = contract.disabled_feature_policy?.aionui_team;
  for (const [field, expected] of Object.entries({
    state: 'disabled',
    ordinary_surface: 'rejected',
    route_policy: 'redirect_to_app_home',
    mutation_policy: 'team_created_redirect_noop',
    deep_link_policy: 'not_whitelisted',
    capability_snapshot_policy: 'scrub_before_render_or_inherit',
    agent_switching_policy: 'must_not_inherit_team_mcp',
  })) {
    if (teamPolicy?.[field] !== expected) {
      throw new Error(`Active shell disabled_feature_policy.aionui_team.${field} must be ${expected}`);
    }
  }
  const probeGroup = contract.implementation_probes?.aionui_team_disabled_surface;
  if (
    probeGroup?.source !== 'app_shell_upgrade_architecture_hardening' ||
    probeGroup?.policy !== 'fail_closed_required_for_active_shell_upgrade'
  ) {
    throw new Error('Active shell AionUI Team implementation probes must be fail-closed upgrade probes');
  }
  assertDeepEqualJson(
    (probeGroup.probes ?? []).map((probe) => probe.id),
    [
      'team_mode_disabled',
      'team_route_redirect',
      'team_sidebar_gate',
      'team_created_redirect_noop',
      'ordinary_conversation_team_snapshot_scrub',
      'agent_switching_drops_team_mcp',
      'team_deep_link_not_whitelisted',
      'team_bridge_mutation_gate',
    ],
    'Active shell AionUI Team implementation probe ids',
  );
  for (const probe of probeGroup.probes ?? []) {
    if (
      probe.source_ref !== 'contracts/app-gui-product-contract.json#settings_navigation.team_surface_policy' ||
      probe.required !== true ||
      !Array.isArray(probe.required_evidence) ||
      probe.required_evidence.length === 0
    ) {
      throw new Error(`Active shell implementation probe ${probe.id} must bind required evidence to the App GUI Team policy`);
    }
  }
}
