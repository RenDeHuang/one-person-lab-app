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
  upstream_family: string;
  shell_source: {
    owner_repo: string;
    default_ref: string;
    checkout_path: string;
    history_policy: string;
    upstream_ref?: string;
  };
  shell_contract: {
    layout_id: string;
    source_topology: string;
    paths: ShellPathContract;
    capabilities: string[];
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
  assertRelativePath(contract.shell_root, 'shell_root');
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
