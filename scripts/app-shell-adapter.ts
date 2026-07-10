import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateGuiProductContractPolicyFields,
  validateValidationCommandShape,
} from './app-shell-adapter-contract-validators.ts';
import { assertRepositoryRelativePath } from './value-assertions.ts';

export type ShellPathContract = {
  package_manifest: string;
  agents_guide: string;
  vitest_config: string;
  electron_builder_config: string;
  build_output_dir: string;
  product_profile_target: string;
  packaged_runtime_root: string;
  packaged_runtime_validator: string;
  release_prepare_script: string;
  release_verify_script: string;
};

export type ValidationCommand = {
  id: string;
  cwd: string;
  command: string;
  optional?: boolean;
};

export type HermesAppServerAdapterContract = {
  owner: string;
  gateway_route: string;
  ordinary_chat_route: string;
  required_events: string[];
  forbidden_backends: string[];
};

export type HermesModelAccessPolicy = {
  ordinary_provider: string;
  api_key_env: string;
  provider_base_url: string;
  default_model: string;
  reasoning_effort: string;
  ordinary_ui_surfaces: string[];
  forbidden_ordinary_controls: string[];
};

export type HermesAgentRouteContract = {
  owner: string;
  route_authority: string;
  ordinary_entries: Array<{
    id: string;
    label: string;
    route: string;
    authority: string;
  }>;
  required_surface: string;
  forbidden_claims: string[];
};

export type HermesSettingsInformationArchitecture = {
  ordinary_tabs: string[];
  opl_semantics: string[];
  hidden_or_advanced: string[];
  ordinary_access_policy: string;
};

export type HermesVisualParityContract = {
  comparison_baseline: string;
  minimum_bar: string;
  required_evidence: string[];
  docs_or_contract_only_completion_allowed: boolean;
};

export type HermesTargetStateContract = {
  app_server_adapter_contract?: HermesAppServerAdapterContract;
  model_access_policy?: HermesModelAccessPolicy;
  agent_route_contract?: HermesAgentRouteContract;
  settings_information_architecture?: HermesSettingsInformationArchitecture;
  visual_parity_contract?: HermesVisualParityContract;
};

export type FirstRunContract = {
  owner: string;
  ui_reuse_policy: string;
  forbidden_default_action: string;
  startup_model: string;
  startup_check_sequence: string[];
  one_time_initialization_trigger: string[];
  one_time_initialization_sequence: string[];
  model_access_wizard: {
    trigger: string;
    api_key_provider: string;
    api_key_command: string;
    provider_base_url: string;
    default_model: string;
    api_key_env: string;
    ordinary_ui_policy: string;
  };
  background_refresh_sequence: string[];
  blocking_policy: string;
  skip_to_chat_policy?: {
    trigger: string;
    marker_state: string;
    must_not_claim: string[];
  };
  api_key_missing_behavior: string;
  api_key_present_behavior: string;
  ready_check: string;
  packaged_smoke_must_prove: string[];
};

export type IconContract = {
  source: string;
  macos_safe_margin_required: boolean;
  max_alpha_bounds_px: number;
  current_expected_alpha_bounds_px: string;
  applies_to: string[];
};

export const REQUIRED_GUI_AUTHORITY_PRODUCT_CONTRACTS = [
  'contracts/app-gui-product-contract.json',
  'contracts/app-runtime-bridge.json',
  'contracts/app-product-profile.json',
  'contracts/app-install-exposure-policy.json',
  'contracts/app-page-state-matrix.json',
  'contracts/app-first-run-test-matrix.json',
  'contracts/app-release-channel.json',
] as const;

export const REQUIRED_BASE_SHELL_OWNED_SURFACES = [
  'concrete renderer implementation',
  'process and preload implementation',
  'shell package metadata',
  'shell tests and release hooks',
] as const;

export const DEFAULT_RELEASE_SHELL_OWNED_SURFACE = 'upstream AionUI intake';

export const FORBIDDEN_SHELL_OWNED_SURFACES = [
  'App GUI product truth',
  'App user-facing page-state authority',
  'App model-selection policy',
  'App onboarding policy',
  'App release/user documentation authority',
  'OPL runtime truth',
  'domain truth',
  'provider implementation',
] as const;

const ARCHIVED_REPLAY_ADOPTION_GATES = [
  'declare archived replay surface in contracts/app-shell-candidates.json',
  'consume contracts/app-gui-product-contract.json as replay acceptance input only',
  'sync App product profile into the archived replay shell target',
  'preserve archived page-state and first-run replay boundaries without default release claims',
  'pass App-root explicit adapter validation only when AGUI replay is requested',
  'pass explicit AGUI replay package compile through App wrapper',
  'preserve external checkout history policy and release isolation',
] as const;

const CANDIDATE_ADOPTION_GATES = [
  'declare candidate in contracts/app-shell-candidates.json',
  'implement contracts/app-gui-product-contract.json',
  'sync App product profile into the candidate shell target',
  'pass App page-state and first-run matrices',
  'pass App-root active shell validation',
  'pass GUI package compile through App wrapper',
  'preserve external checkout history policy',
] as const;

export function assertShellReplacementAdoptionGates(
  releaseRole: string,
  adoptionGate: readonly string[] | undefined,
  missingGateMessage: (gate: string) => string,
  forbiddenAdapterCandidateMessage = 'Shell replacement policy must not declare candidates inside contracts/app-shell-adapter.json',
): void {
  const requiredGates = releaseRole === 'archived_technical_verification_shell'
    ? ARCHIVED_REPLAY_ADOPTION_GATES
    : CANDIDATE_ADOPTION_GATES;
  for (const gate of requiredGates) {
    if (!adoptionGate?.includes(gate)) {
      throw new Error(missingGateMessage(gate));
    }
  }
  if (adoptionGate?.includes('declare candidate in contracts/app-shell-adapter.json')) {
    throw new Error(forbiddenAdapterCandidateMessage);
  }
}

export const STATE_SURFACE_CONTRACT_EXPECTATIONS = {
  primary_read_command: 'opl app state --profile fast --json',
  refresh_read_command: 'opl app state --profile fast --json',
  full_state_read_command: 'opl app state --profile full --json',
  full_state_policy: 'diagnostic_or_release_evidence_only',
  action_command: 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
  full_drilldown_exception: 'opl runtime app-operator-drilldown --detail full --json',
} as const;

export const FORBIDDEN_GUI_TRUTH_SOURCES = [
  'direct opl connect modules --json page aggregation',
  'direct opl system developer-supervisor page aggregation',
  'direct opl family-runtime worker status page aggregation',
  'application.systemInfo as OPL path truth',
  'application.appVersions as OPL release truth',
  'direct reads of OPL internal state files',
] as const;

type UpstreamIntakeRecord = {
  id: string;
  upstream_surface: string;
  classification: string;
  ordinary_surface?: string;
  owner_ref: string;
  release_gate: string;
  remediation_ref?: string;
  dependencies: string[];
  evidence: string[];
};

type UpstreamIntakeDependencyRecord = UpstreamIntakeRecord & {
  version_gate?: {
    field_ref: string;
    minimum_version: string;
    evaluated_upstream_version: string;
    selective_absorption_version: string;
    state: string;
  };
  capability_gate?: {
    required_boundary_code: string;
    required_boundary_stage: string;
    state: string;
    required_evidence: string;
    evidence: string[];
  };
};

export type ShellAdapterContract = {
  schema_version: number;
  owner: string;
  purpose: string;
  state: string;
  app_repo: string;
  active_shell?: string;
  adapter_id?: string;
  candidate_shell?: string;
  adapter_role?: string;
  shell_root: string;
  runtime_bridge_contract: string;
  upstream_family: string;
  release_role: string;
  candidate_stage?: string;
  shell_source: {
    owner_repo: string;
    default_ref: string;
    checkout_path: string;
    history_policy: string;
    upstream_ref?: string;
  };
  gui_authority: {
    source_of_truth: string;
    implementation_role: string;
    product_contracts: string[];
    shell_may_own: string[];
    shell_must_not_own: string[];
    upstream_intake_policy: string;
  };
  upstream_intake?: {
    schema_version: number;
    classification_policy: string;
    source_refs: {
      fork_base: { ref: string; role: string };
      evaluated_upstream: { release: string; ref: string; role: string };
      selective_absorption_head: { ref: string; role: string };
    };
    allowed_classifications: string[];
    required_capability_ids: string[];
    required_dependency_ids: string[];
    required_record_fields: string[];
    capability_classifications: UpstreamIntakeRecord[];
    dependency_classifications: UpstreamIntakeDependencyRecord[];
  };
  implementation_probes?: Record<string, {
    source: string;
    policy: string;
    probes: Array<{
      id: string;
      source_ref: string;
      required: boolean;
      required_evidence: string[];
    }>;
  }>;
  disabled_feature_policy?: Record<string, Record<string, string>>;
  shell_replacement_policy: {
    candidate_root_pattern: string;
    candidate_state: string;
    authority_transfer_allowed: boolean;
    adoption_gate: string[];
  };
  shell_contract: {
    layout_id: string;
    source_topology: string;
    implementation_validation?: string;
    paths: ShellPathContract;
    capabilities: string[];
  };
  first_run_contract?: FirstRunContract;
  icon_contract?: IconContract;
  gui_product_contract: string;
  gui_product_contract_policy: {
    must_implement: boolean;
    source_of_truth: string;
    upstream_override_allowed: boolean;
    upstream_family_role: string;
    upstream_must_not_override_app_truth?: boolean;
    aionui_upstream_must_not_override_app_truth?: boolean;
  };
  state_surface_contract: {
    primary_read_command: string;
    refresh_read_command: string;
    full_state_read_command: string;
    full_state_policy: string;
    action_command: string;
    full_drilldown_exception: string;
    forbidden_gui_truth_sources: string[];
  };
  deferred_until_feature_comparison?: {
    policy: string;
    surfaces: string[];
  };
  validation_commands: ValidationCommand[];
  manual_verification_commands?: Array<ValidationCommand & { policy?: string }>;
} & HermesTargetStateContract;

export type ActiveShellPaths = {
  contract: ShellAdapterContract;
  shellRoot: string;
  shellRootForDisplay: string;
  packageManifestPath: string;
  agentsGuidePath: string;
  vitestConfigPath: string;
  electronBuilderConfigPath: string;
  buildOutputDir: string;
  productProfileTargetPath: string;
  packagedRuntimeRoot: string;
  packagedRuntimeValidatorPath: string;
  releasePrepareScriptPath: string;
  releaseVerifyScriptPath: string;
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultContractRef = 'contracts/app-shell-adapter.json';
const contractPath = path.join(appRoot, defaultContractRef);

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertRelativePath(value: unknown, label: string): asserts value is string {
  assertRepositoryRelativePath(value, {
    empty: `Invalid active shell ${label}: expected non-empty relative path`,
    unsafe: `Invalid active shell ${label}: must be a repository-relative path`,
  });
}

function resolveRepoRelativePath(value: string, label: string): string {
  assertRelativePath(value, label);
  return path.join(appRoot, value);
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((entry) => typeof entry === 'string' && entry.trim())) {
    throw new Error(`Invalid active shell ${label}: expected non-empty string array`);
  }
}

function resolveAdapterContractPath(): string {
  const override = process.env.OPL_APP_SHELL_ADAPTER_CONTRACT?.trim();
  if (!override) {
    return contractPath;
  }
  if (!override.startsWith('contracts/') || !override.endsWith('.json')) {
    throw new Error('OPL_APP_SHELL_ADAPTER_CONTRACT must point at a repository-relative contracts/*.json file');
  }
  return resolveRepoRelativePath(override, 'OPL_APP_SHELL_ADAPTER_CONTRACT');
}

function isExplicitAdapterOverride(filePath: string): boolean {
  return path.resolve(filePath) !== path.resolve(contractPath);
}

export function resolveShellAdapterIdentity(contract: ShellAdapterContract): string {
  const identity = contract.active_shell ?? contract.candidate_shell ?? contract.adapter_id;
  if (typeof identity !== 'string' || !identity.trim()) {
    throw new Error('active shell adapter contract must declare active_shell or candidate_shell identity');
  }
  return identity;
}

export function readAppShellAdapterContract(filePath = resolveAdapterContractPath()): ShellAdapterContract {
  const contract = readJson(filePath) as ShellAdapterContract;
  assertAdapterContractIdentity(contract, { explicitOverride: isExplicitAdapterOverride(filePath) });
  assertAdapterGuiAuthority(contract);
  assertActiveShellSpecificPolicy(contract);
  assertShellReplacementPolicy(contract);
  assertShellContractPathsAndCapabilities(contract);
  validateGuiProductContractPolicyFields(contract);
  assertStateSurfaceContract(contract);
  assertValidationCommandPaths(contract);
  return contract;
}

function assertAdapterContractIdentity(contract: ShellAdapterContract, options: { explicitOverride: boolean }): void {
  if (contract.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected active shell owner: ${contract.owner}`);
  }
  if (contract.purpose !== 'active_shell_adapter') {
    throw new Error(`Unexpected active shell purpose: ${contract.purpose}`);
  }
  const allowedStates = options.explicitOverride ? ['active', 'archived_technical_proof'] : ['active'];
  if (!allowedStates.includes(contract.state)) {
    throw new Error(`Unexpected active shell state: ${contract.state}`);
  }
  if (contract.app_repo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`Unexpected active shell app_repo: ${contract.app_repo}`);
  }
  const adapterIdentity = resolveShellAdapterIdentity(contract);
  if (!options.explicitOverride) {
    if (contract.active_shell !== 'aionui' || adapterIdentity !== 'aionui') {
      throw new Error(`Default active shell adapter must remain aionui: ${adapterIdentity}`);
    }
    if (contract.candidate_shell || contract.adapter_id || contract.adapter_role) {
      throw new Error('Default active shell adapter must not declare foreground candidate identity');
    }
  } else if (contract.candidate_shell) {
    if (contract.active_shell !== undefined) {
      throw new Error(`${contract.candidate_shell} foreground candidate adapter must not declare active_shell`);
    }
    if (contract.adapter_id !== contract.candidate_shell || contract.adapter_role !== 'foreground_alternative_candidate_adapter') {
      throw new Error(`${contract.candidate_shell} foreground candidate adapter identity is inconsistent`);
    }
  }
  if (contract.shell_source?.history_policy !== 'external_checkout_not_merged_into_app_default_branch') {
    throw new Error(`Unexpected shell history policy: ${contract.shell_source?.history_policy}`);
  }
}

function assertAdapterGuiAuthority(contract: ShellAdapterContract): void {
  if (contract.gui_authority?.source_of_truth !== 'one-person-lab-app') {
    throw new Error('active shell GUI authority must stay in one-person-lab-app');
  }
  const expectedImplementationRole = contract.release_role === 'archived_technical_verification_shell'
    ? 'archived_technical_proof_replay_carrier'
    : 'active_shell_implementation_carrier';
  if (contract.gui_authority.implementation_role !== expectedImplementationRole) {
    throw new Error(`active shell GUI implementation role must be ${expectedImplementationRole}`);
  }
  assertStringArray(contract.gui_authority.product_contracts, 'gui_authority.product_contracts');
  assertStringArray(contract.gui_authority.shell_may_own, 'gui_authority.shell_may_own');
  assertStringArray(contract.gui_authority.shell_must_not_own, 'gui_authority.shell_must_not_own');
  if (contract.gui_authority.upstream_intake_policy !== 'check_against_app_owned_gui_contracts_before_acceptance') {
    throw new Error(`Unexpected GUI upstream intake policy: ${contract.gui_authority.upstream_intake_policy}`);
  }
}

function assertActiveShellSpecificPolicy(contract: ShellAdapterContract): void {
  if (contract.active_shell === 'aionui') {
    if (
      contract.upstream_intake?.classification_policy !==
      'classify_every_required_capability_and_dependency_before_app_release'
    ) {
      throw new Error('active shell upstream intake must classify required capabilities and dependencies before release');
    }
    if (!contract.upstream_intake.capability_classifications?.some((entry) => (
      entry.id === 'aionui_team' &&
      entry.classification === 'rejected' &&
      entry.ordinary_surface === 'forbidden'
    ))) {
      throw new Error('active shell upstream intake must reject AionUI Team for ordinary surfaces');
    }
    if (contract.implementation_probes?.aionui_team_disabled_surface?.policy !== 'fail_closed_required_for_active_shell_upgrade') {
      throw new Error('active shell must declare fail-closed AionUI Team implementation probes');
    }
    if (contract.disabled_feature_policy?.aionui_team?.agent_switching_policy !== 'must_not_inherit_team_mcp') {
      throw new Error('active shell disabled Team policy must prevent Team MCP inheritance during agent switching');
    }
  }
}

function assertShellReplacementPolicy(contract: ShellAdapterContract): void {
  if (contract.shell_replacement_policy?.candidate_root_pattern !== 'shells/<candidate>') {
    throw new Error('active shell replacement policy must keep candidates under shells/<candidate>');
  }
  const allowedCandidateStates = contract.release_role === 'archived_technical_verification_shell'
    ? ['archived_technical_proof_replay_only']
    : ['candidate_until_contracts_and_tests_complete', 'foreground_alternative_or_archived_technical_proof'];
  if (!allowedCandidateStates.includes(contract.shell_replacement_policy.candidate_state)) {
    throw new Error(`Unexpected shell candidate state: ${contract.shell_replacement_policy.candidate_state}`);
  }
  if (contract.shell_replacement_policy.authority_transfer_allowed !== false) {
    throw new Error('active shell replacement must not transfer App GUI authority');
  }
  assertStringArray(contract.shell_replacement_policy.adoption_gate, 'shell_replacement_policy.adoption_gate');
  assertShellReplacementAdoptionGates(
    contract.release_role,
    contract.shell_replacement_policy.adoption_gate,
    (gate) => `active shell replacement policy missing gate ${gate}`,
    'active shell replacement policy must not declare candidates inside contracts/app-shell-adapter.json',
  );
}

function assertShellContractPathsAndCapabilities(contract: ShellAdapterContract): void {
  assertRelativePath(contract.shell_root, 'shell_root');
  assertRelativePath(contract.runtime_bridge_contract, 'runtime_bridge_contract');
  assertRelativePath(contract.shell_source?.checkout_path, 'shell_source.checkout_path');
  if (contract.shell_source.checkout_path !== contract.shell_root) {
    throw new Error('shell_source.checkout_path must match shell_root');
  }

  const paths = contract.shell_contract?.paths;
  if (!paths) {
    throw new Error('active shell contract must declare shell_contract.paths');
  }
  for (const [label, value] of Object.entries(paths)) {
    assertRelativePath(value, `shell_contract.paths.${label}`);
  }
  assertStringArray(contract.shell_contract.capabilities, 'shell_contract.capabilities');
  if (['experimental_candidate_shell', 'archived_technical_verification_shell'].includes(contract.release_role)) {
    if (!contract.shell_contract.capabilities.includes('candidate_app_bundle_package')) {
      throw new Error('candidate shell capabilities must include candidate_app_bundle_package');
    }
    if (!contract.shell_contract.capabilities.includes('app_owned_gui_product_contract')) {
      throw new Error('candidate shell capabilities must keep app_owned_gui_product_contract boundary');
    }
    if (!contract.shell_contract.capabilities.includes('app_owned_runtime_bridge_contract')) {
      throw new Error('candidate shell capabilities must keep app_owned_runtime_bridge_contract boundary');
    }
    return;
  }
  if (!contract.shell_contract.capabilities.includes('app_product_profile_generated_config')) {
    throw new Error('active shell capabilities must include app_product_profile_generated_config');
  }
  if (!contract.shell_contract.capabilities.includes('opl_packaged_runtime_extra_resource')) {
    throw new Error('active shell capabilities must include opl_packaged_runtime_extra_resource');
  }
  for (const capability of [
    'app_owned_gui_product_contract',
    'app_owned_runtime_bridge_contract',
    'opl_app_state_bridge',
    'opl_app_action_bridge',
    'app_gui_release_channel_gating',
  ]) {
    if (!contract.shell_contract.capabilities.includes(capability)) {
      throw new Error(`active shell capabilities must include ${capability}`);
    }
  }
}

function assertStateSurfaceContract(contract: ShellAdapterContract): void {
  const stateSurface = contract.state_surface_contract;
  if (stateSurface?.primary_read_command !== STATE_SURFACE_CONTRACT_EXPECTATIONS.primary_read_command) {
    throw new Error(`Unexpected active shell primary state read command: ${stateSurface?.primary_read_command}`);
  }
  if (stateSurface.refresh_read_command !== STATE_SURFACE_CONTRACT_EXPECTATIONS.refresh_read_command) {
    throw new Error(`Unexpected active shell refresh state read command: ${stateSurface.refresh_read_command}`);
  }
  if (stateSurface.full_state_read_command !== STATE_SURFACE_CONTRACT_EXPECTATIONS.full_state_read_command) {
    throw new Error(`Unexpected active shell full state read command: ${stateSurface.full_state_read_command}`);
  }
  if (stateSurface.full_state_policy !== STATE_SURFACE_CONTRACT_EXPECTATIONS.full_state_policy) {
    throw new Error(`Unexpected active shell full state policy: ${stateSurface.full_state_policy}`);
  }
  if (stateSurface.action_command !== STATE_SURFACE_CONTRACT_EXPECTATIONS.action_command) {
    throw new Error(`Unexpected active shell action command: ${stateSurface.action_command}`);
  }
  if (stateSurface.full_drilldown_exception !== STATE_SURFACE_CONTRACT_EXPECTATIONS.full_drilldown_exception) {
    throw new Error(`Unexpected active shell full drilldown exception: ${stateSurface.full_drilldown_exception}`);
  }
  assertStringArray(stateSurface.forbidden_gui_truth_sources, 'state_surface_contract.forbidden_gui_truth_sources');
}

function assertValidationCommandPaths(contract: ShellAdapterContract): void {
  for (const entry of validateValidationCommandShape(contract)) {
    assertRelativePath(entry.cwd, `validation_commands.${entry.id}.cwd`);
  }
}

function resolveActiveShellRoot(contract = readAppShellAdapterContract()): string {
  const override = process.env.OPL_APP_SHELL_ROOT?.trim();
  return override ? path.resolve(appRoot, override) : path.join(appRoot, contract.shell_root);
}

export function resolveActiveShellPaths(options: { shellRoot?: string; contract?: ShellAdapterContract } = {}): ActiveShellPaths {
  const contract = options.contract ?? readAppShellAdapterContract();
  const shellRoot = options.shellRoot ? path.resolve(options.shellRoot) : resolveActiveShellRoot(contract);
  const paths = contract.shell_contract.paths;
  const shellRootEnv = process.env.OPL_APP_SHELL_ROOT?.trim();
  return {
    contract,
    shellRoot,
    shellRootForDisplay: options.shellRoot ?? (shellRootEnv || contract.shell_root),
    packageManifestPath: path.join(shellRoot, paths.package_manifest),
    agentsGuidePath: path.join(shellRoot, paths.agents_guide),
    vitestConfigPath: path.join(shellRoot, paths.vitest_config),
    electronBuilderConfigPath: path.join(shellRoot, paths.electron_builder_config),
    buildOutputDir: path.join(shellRoot, paths.build_output_dir),
    productProfileTargetPath: path.join(shellRoot, paths.product_profile_target),
    packagedRuntimeRoot: path.join(shellRoot, paths.packaged_runtime_root),
    packagedRuntimeValidatorPath: path.join(shellRoot, paths.packaged_runtime_validator),
    releasePrepareScriptPath: path.join(shellRoot, paths.release_prepare_script),
    releaseVerifyScriptPath: path.join(shellRoot, paths.release_verify_script),
  };
}
