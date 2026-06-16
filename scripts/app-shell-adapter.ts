import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateGuiProductContractPolicyFields,
  validateValidationCommandShape,
} from './app-shell-adapter-contract-validators.ts';
import { assertRepositoryRelativePath } from './repository-relative-path.ts';

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

export type ShellAdapterContract = {
  schema_version: number;
  owner: string;
  purpose: string;
  state: string;
  app_repo: string;
  active_shell: string;
  shell_root: string;
  runtime_bridge_contract: string;
  upstream_family: string;
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
    classification_policy: string;
    allowed_classifications: string[];
    required_feature_record_fields: string[];
    feature_classifications: Array<{
      id: string;
      upstream_surface: string;
      classification: string;
      ordinary_surface?: string;
      app_contract_ref: string;
      release_gate: string;
    }>;
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
  validation_commands: Array<{
    id: string;
    cwd: string;
    command: string;
  }>;
};

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

export function readAppShellAdapterContract(filePath = resolveAdapterContractPath()): ShellAdapterContract {
  const contract = readJson(filePath) as ShellAdapterContract;
  assertAdapterContractIdentity(contract);
  assertAdapterGuiAuthority(contract);
  assertActiveShellSpecificPolicy(contract);
  assertShellReplacementPolicy(contract);
  assertShellContractPathsAndCapabilities(contract);
  validateGuiProductContractPolicyFields(contract);
  assertStateSurfaceContract(contract);
  assertValidationCommandPaths(contract);
  return contract;
}

function assertAdapterContractIdentity(contract: ShellAdapterContract): void {
  if (contract.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected active shell owner: ${contract.owner}`);
  }
  if (contract.purpose !== 'active_shell_adapter') {
    throw new Error(`Unexpected active shell purpose: ${contract.purpose}`);
  }
  if (contract.state !== 'active') {
    throw new Error(`Unexpected active shell state: ${contract.state}`);
  }
  if (contract.app_repo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`Unexpected active shell app_repo: ${contract.app_repo}`);
  }
  if (contract.shell_source?.history_policy !== 'external_checkout_not_merged_into_app_default_branch') {
    throw new Error(`Unexpected shell history policy: ${contract.shell_source?.history_policy}`);
  }
}

function assertAdapterGuiAuthority(contract: ShellAdapterContract): void {
  if (contract.gui_authority?.source_of_truth !== 'one-person-lab-app') {
    throw new Error('active shell GUI authority must stay in one-person-lab-app');
  }
  if (contract.gui_authority.implementation_role !== 'active_shell_implementation_carrier') {
    throw new Error('active shell GUI implementation role must be active_shell_implementation_carrier');
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
    if (contract.upstream_intake?.classification_policy !== 'classify_each_upstream_feature_before_app_release') {
      throw new Error('active shell upstream intake must classify upstream features before release');
    }
    if (!contract.upstream_intake.feature_classifications?.some((entry) => (
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
  if (contract.shell_replacement_policy.candidate_state !== 'candidate_until_contracts_and_tests_complete') {
    throw new Error(`Unexpected shell candidate state: ${contract.shell_replacement_policy.candidate_state}`);
  }
  if (contract.shell_replacement_policy.authority_transfer_allowed !== false) {
    throw new Error('active shell replacement must not transfer App GUI authority');
  }
  assertStringArray(contract.shell_replacement_policy.adoption_gate, 'shell_replacement_policy.adoption_gate');
  if (!contract.shell_replacement_policy.adoption_gate.includes('declare candidate in contracts/app-shell-candidates.json')) {
    throw new Error('active shell replacement policy must delegate candidate declarations to contracts/app-shell-candidates.json');
  }
  if (contract.shell_replacement_policy.adoption_gate.includes('declare candidate in contracts/app-shell-adapter.json')) {
    throw new Error('active shell replacement policy must not declare candidates inside contracts/app-shell-adapter.json');
  }
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
  if (contract.release_role === 'experimental_candidate_shell') {
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
  if (stateSurface?.primary_read_command !== 'opl app state --profile fast --json') {
    throw new Error(`Unexpected active shell primary state read command: ${stateSurface?.primary_read_command}`);
  }
  if (stateSurface.refresh_read_command !== 'opl app state --profile fast --json') {
    throw new Error(`Unexpected active shell refresh state read command: ${stateSurface.refresh_read_command}`);
  }
  if (stateSurface.full_state_read_command !== 'opl app state --profile full --json') {
    throw new Error(`Unexpected active shell full state read command: ${stateSurface.full_state_read_command}`);
  }
  if (stateSurface.full_state_policy !== 'diagnostic_or_release_evidence_only') {
    throw new Error(`Unexpected active shell full state policy: ${stateSurface.full_state_policy}`);
  }
  if (stateSurface.action_command !== 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json') {
    throw new Error(`Unexpected active shell action command: ${stateSurface.action_command}`);
  }
  if (stateSurface.full_drilldown_exception !== 'opl runtime app-operator-drilldown --detail full --json') {
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
