import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  shell_replacement_policy: {
    candidate_root_pattern: string;
    candidate_state: string;
    authority_transfer_allowed: boolean;
    adoption_gate: string[];
  };
  shell_contract: {
    layout_id: string;
    source_topology: string;
    paths: ShellPathContract;
    capabilities: string[];
  };
  gui_product_contract: string;
  gui_product_contract_policy: {
    must_implement: boolean;
    source_of_truth: string;
    upstream_override_allowed: boolean;
    upstream_family_role: string;
    aionui_upstream_must_not_override_app_truth: boolean;
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
const contractPath = path.join(appRoot, 'contracts', 'app-shell-adapter.json');

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertRelativePath(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid active shell ${label}: expected non-empty relative path`);
  }
  if (path.isAbsolute(value) || value.split(/[\\/]+/).includes('..')) {
    throw new Error(`Invalid active shell ${label}: must be a repository-relative path`);
  }
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((entry) => typeof entry === 'string' && entry.trim())) {
    throw new Error(`Invalid active shell ${label}: expected non-empty string array`);
  }
}

export function readAppShellAdapterContract(filePath = contractPath): ShellAdapterContract {
  const contract = readJson(filePath) as ShellAdapterContract;
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
  if (contract.gui_product_contract !== 'contracts/app-gui-product-contract.json') {
    throw new Error(`Unexpected active shell gui_product_contract: ${contract.gui_product_contract}`);
  }
  if (contract.gui_product_contract_policy?.must_implement !== true) {
    throw new Error('active shell must implement the App GUI product contract');
  }
  if (contract.gui_product_contract_policy.source_of_truth !== 'one-person-lab-app') {
    throw new Error('active shell GUI product contract source of truth must stay in one-person-lab-app');
  }
  if (contract.gui_product_contract_policy.upstream_override_allowed !== false) {
    throw new Error('AionUI upstream must not override App GUI product truth');
  }
  if (contract.gui_product_contract_policy.upstream_family_role !== 'implementation_material_only') {
    throw new Error(`Unexpected upstream GUI role: ${contract.gui_product_contract_policy.upstream_family_role}`);
  }
  if (contract.gui_product_contract_policy.aionui_upstream_must_not_override_app_truth !== true) {
    throw new Error('active shell must declare that AionUI upstream cannot override App truth');
  }
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
  if (!Array.isArray(contract.validation_commands) || contract.validation_commands.length === 0) {
    throw new Error('validation_commands must be a non-empty array');
  }
  for (const entry of contract.validation_commands) {
    if (!entry.id || !entry.cwd || !entry.command) {
      throw new Error(`Invalid validation command entry: ${JSON.stringify(entry)}`);
    }
    assertRelativePath(entry.cwd, `validation_commands.${entry.id}.cwd`);
  }
  return contract;
}

function resolveActiveShellRoot(contract = readAppShellAdapterContract()): string {
  const override = process.env.OPL_APP_SHELL_ROOT?.trim();
  return override ? path.resolve(appRoot, override) : path.join(appRoot, contract.shell_root);
}

export function resolveActiveShellPaths(options: { shellRoot?: string; contract?: ShellAdapterContract } = {}): ActiveShellPaths {
  const contract = options.contract ?? readAppShellAdapterContract();
  const shellRoot = options.shellRoot ? path.resolve(options.shellRoot) : resolveActiveShellRoot(contract);
  const paths = contract.shell_contract.paths;
  return {
    contract,
    shellRoot,
    shellRootForDisplay: options.shellRoot ?? process.env.OPL_APP_SHELL_ROOT ?? contract.shell_root,
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
