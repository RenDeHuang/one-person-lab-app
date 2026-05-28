#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type ValidationCommand = {
  id: string;
  cwd: string;
  command: string;
};

type ShellCandidate = {
  id: string;
  state: string;
  candidate_root: string;
  adapter_contract: string;
  source_topology: string;
  release_participation: string;
  implementation_basis: string[];
  target_product_shape: {
    codex_cli_fixed_executor: boolean;
    home_executor_selector_visible: boolean;
    home_backend_selector_visible: boolean;
    home_model_selector_visible: boolean;
    permission_mode_selector_visible: boolean;
    purpose_entries: string[];
    runtime_page_policy: string;
    settings_policy: string;
  };
  framework_surfaces: Record<string, string>;
  required_capabilities: string[];
  must_not_own: string[];
  forbidden_home_controls: string[];
  validation_commands: ValidationCommand[];
  non_goals: string[];
};

type ShellCandidateRegistry = {
  schema_version: number;
  owner: string;
  purpose: string;
  state: string;
  active_shell_unchanged: string;
  release_shell_contract: string;
  gui_product_contract: string;
  runtime_bridge_contract: string;
  product_profile_contract: string;
  page_state_matrix: string;
  first_run_matrix: string;
  candidate_policy: {
    candidate_root_pattern: string;
    candidate_state: string;
    release_participation_until_adopted: string;
    authority_transfer_allowed: boolean;
    release_scripts_must_use_active_shell_adapter: boolean;
    candidate_validation_script: string;
    adoption_gate: string[];
  };
  candidates: ShellCandidate[];
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root, 'contracts', 'app-shell-candidates.json');
const activeAdapterPath = path.join(root, 'contracts', 'app-shell-adapter.json');
const guiContractPath = path.join(root, 'contracts', 'app-gui-product-contract.json');
const runtimeBridgePath = path.join(root, 'contracts', 'app-runtime-bridge.json');
const productProfilePath = path.join(root, 'contracts', 'app-product-profile.json');
const pageStateMatrixPath = path.join(root, 'contracts', 'app-page-state-matrix.json');
const firstRunMatrixPath = path.join(root, 'contracts', 'app-first-run-test-matrix.json');
const requiredHomeEntries = ['research', 'grant', 'ppt'];
const requiredCapabilities = [
  'codex_cli_fixed_executor_home',
  'purpose_first_home_entries',
  'agui_event_contract_map',
  'app_product_profile_mapping',
  'opl_app_state_bridge',
  'opl_app_action_bridge',
  'page_state_matrix_mapping',
  'first_run_matrix_mapping',
  'release_isolation',
  'candidate_app_bundle_package',
];
const forbiddenAuthority = [
  'App GUI product truth',
  'App model-selection policy',
  'App release gate policy',
  'OPL runtime truth',
  'provider implementation',
  'domain truth',
  'domain quality verdict',
  'memory body',
  'artifact body',
  'artifact authority',
];
const expectedFrameworkSurfaces: Record<string, string> = {
  state: 'opl app state --profile fast --json',
  refresh: 'opl app state --profile fast --json',
  full_state: 'opl app state --profile full --json',
  full_drilldown: 'opl runtime app-operator-drilldown --detail full --json',
  action: 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function assertFile(filePath: string, label: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${path.relative(root, filePath)}`);
  }
}

function assertDirectory(filePath: string, label: string): void {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isDirectory()) {
    throw new Error(`Missing ${label} directory: ${path.relative(root, filePath)}`);
  }
}

function assertRelativePath(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  if (path.isAbsolute(value) || value.split(/[\\/]+/).includes('..')) {
    throw new Error(`${label} must stay relative to the candidate shell root`);
  }
}

function findMacAppExecutable(macOsDir: string, candidateId: string): string {
  const executable = fs.readdirSync(macOsDir).find((entry) => {
    const filePath = path.join(macOsDir, entry);
    const stat = fs.statSync(filePath);
    return stat.isFile() && (stat.mode & 0o111) !== 0;
  });
  if (!executable) {
    throw new Error(`${candidateId} .app bundle must include an executable under Contents/MacOS`);
  }
  return executable;
}

function assertNoAbsoluteSymlinks(directoryPath: string, candidateId: string): void {
  for (const entry of fs.readdirSync(directoryPath)) {
    const filePath = path.join(directoryPath, entry);
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(filePath);
      if (path.isAbsolute(target)) {
        throw new Error(`${candidateId} .app bundle must not contain absolute symlink ${path.relative(root, filePath)} -> ${target}`);
      }
      continue;
    }
    if (stat.isDirectory()) {
      assertNoAbsoluteSymlinks(filePath, candidateId);
    }
  }
}

function assertStringArrayIncludes(actual: string[], expected: string[], label: string): void {
  if (!Array.isArray(actual)) {
    throw new Error(`${label} must be an array`);
  }
  for (const item of expected) {
    if (!actual.includes(item)) {
      throw new Error(`${label} must include ${item}`);
    }
  }
}

function parseArgs(argv: string[]): { candidate?: string; runCandidateCommands: boolean } {
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

function validateRegistryShape(registry: ShellCandidateRegistry): void {
  if (registry.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected candidate registry owner: ${registry.owner}`);
  }
  if (registry.purpose !== 'app_shell_candidate_registry') {
    throw new Error(`Unexpected candidate registry purpose: ${registry.purpose}`);
  }
  if (registry.state !== 'active_experimental') {
    throw new Error(`Unexpected candidate registry state: ${registry.state}`);
  }
  if (registry.active_shell_unchanged !== 'aionui') {
    throw new Error('candidate registry must not change active shell away from aionui');
  }
  for (const [label, expected] of Object.entries({
    release_shell_contract: 'contracts/app-shell-adapter.json',
    gui_product_contract: 'contracts/app-gui-product-contract.json',
    runtime_bridge_contract: 'contracts/app-runtime-bridge.json',
    product_profile_contract: 'contracts/app-product-profile.json',
    page_state_matrix: 'contracts/app-page-state-matrix.json',
    first_run_matrix: 'contracts/app-first-run-test-matrix.json',
  })) {
    if (registry[label as keyof ShellCandidateRegistry] !== expected) {
      throw new Error(`candidate registry ${label} must be ${expected}`);
    }
    assertFile(path.join(root, expected), label);
  }
  const policy = registry.candidate_policy;
  if (policy.candidate_root_pattern !== 'shells/<candidate>') {
    throw new Error('candidate roots must stay under shells/<candidate>');
  }
  if (policy.candidate_state !== 'candidate_until_contracts_and_tests_complete') {
    throw new Error(`Unexpected candidate policy state: ${policy.candidate_state}`);
  }
  if (policy.release_participation_until_adopted !== 'explicit_candidate_build_only') {
    throw new Error('candidate release participation must stay explicit_candidate_build_only until adopted');
  }
  if (policy.authority_transfer_allowed !== false) {
    throw new Error('candidate policy must not transfer App authority');
  }
  if (policy.release_scripts_must_use_active_shell_adapter !== true) {
    throw new Error('release scripts must continue using the active shell adapter');
  }
  if (policy.candidate_validation_script !== 'scripts/validate-shell-candidates.ts') {
    throw new Error('candidate registry must point at scripts/validate-shell-candidates.ts');
  }
  assertStringArrayIncludes(policy.adoption_gate, [
    'candidate is declared in contracts/app-shell-candidates.json',
    'candidate implements contracts/app-gui-product-contract.json',
    'candidate compiles a launchable .app bundle through the App wrapper when OPL_APP_SHELL_ADAPTER_CONTRACT selects its adapter contract',
    'candidate passes App-root candidate validation',
    'contracts/app-shell-adapter.json is changed only when candidate becomes active release shell',
  ], 'candidate_policy.adoption_gate');
}

function validateActiveShellUnaffected(): void {
  const activeAdapter = readJson<{
    active_shell: string;
    shell_root: string;
    shell_source: { owner_repo: string };
    release_role: string;
  }>(activeAdapterPath);
  const runtimeBridge = readJson<{
    active_adapter: string;
    default_adapter_repo: string;
    default_adapter_path: string;
  }>(runtimeBridgePath);
  const guiContract = readJson<{ active_shell: string; implementation_carrier: string }>(guiContractPath);

  if (activeAdapter.active_shell !== 'aionui' || activeAdapter.shell_root !== 'shells/aionui') {
    throw new Error('active shell adapter must remain aionui at shells/aionui');
  }
  if (activeAdapter.shell_source.owner_repo !== 'gaofeng21cn/opl-aion-shell') {
    throw new Error('active release shell source must remain gaofeng21cn/opl-aion-shell');
  }
  if (activeAdapter.release_role !== 'stable_app_shell') {
    throw new Error('active shell release role must remain stable_app_shell');
  }
  if (
    runtimeBridge.active_adapter !== activeAdapter.active_shell ||
    runtimeBridge.default_adapter_repo !== activeAdapter.shell_source.owner_repo ||
    runtimeBridge.default_adapter_path !== activeAdapter.shell_root
  ) {
    throw new Error('runtime bridge default adapter must continue matching the active shell adapter');
  }
  if (guiContract.active_shell !== activeAdapter.active_shell || guiContract.implementation_carrier !== 'opl-aion-shell') {
    throw new Error('GUI product contract must still point at the active AionUI implementation carrier');
  }
}

function validateCandidate(candidate: ShellCandidate): void {
  if (!candidate.id || !candidate.candidate_root) {
    throw new Error(`Invalid candidate entry: ${JSON.stringify(candidate)}`);
  }
  if (candidate.state !== 'technical_verification') {
    throw new Error(`${candidate.id} must stay in technical_verification until adopted`);
  }
  if (!candidate.candidate_root.startsWith('shells/') || candidate.candidate_root.split(/[\\/]+/).includes('..')) {
    throw new Error(`${candidate.id} candidate_root must be under shells/<candidate>`);
  }
  if (candidate.release_participation !== 'selectable_for_explicit_candidate_build') {
    throw new Error(`${candidate.id} must only participate in explicit candidate builds`);
  }
  if (candidate.source_topology !== 'external_checkout_linked_shell_repo') {
    throw new Error(`${candidate.id} must declare external_checkout_linked_shell_repo topology`);
  }
  assertFile(path.join(root, candidate.adapter_contract), `${candidate.id} adapter contract`);
  const adapterContract = readJson<{
    active_shell: string;
    shell_root: string;
    shell_source: { owner_repo: string; history_policy: string; checkout_path: string };
    release_role: string;
    shell_contract: { source_topology: string; capabilities: string[] };
    validation_commands: ValidationCommand[];
  }>(path.join(root, candidate.adapter_contract));
  if (adapterContract.active_shell !== candidate.id || adapterContract.shell_root !== candidate.candidate_root) {
    throw new Error(`${candidate.id} adapter contract must point at ${candidate.candidate_root}`);
  }
  if (adapterContract.shell_source.checkout_path !== candidate.candidate_root) {
    throw new Error(`${candidate.id} adapter checkout_path must match candidate_root`);
  }
  if (adapterContract.shell_source.history_policy !== 'external_checkout_not_merged_into_app_default_branch') {
    throw new Error(`${candidate.id} adapter must keep external checkout history policy`);
  }
  if (adapterContract.release_role !== 'experimental_candidate_shell') {
    throw new Error(`${candidate.id} adapter release_role must be experimental_candidate_shell`);
  }
  if (adapterContract.shell_contract.source_topology !== candidate.source_topology) {
    throw new Error(`${candidate.id} adapter source_topology must match candidate registry`);
  }
  if (!adapterContract.shell_contract.capabilities.includes('candidate_app_bundle_package')) {
    throw new Error(`${candidate.id} adapter must declare candidate_app_bundle_package capability`);
  }
  if (!adapterContract.validation_commands.some((entry) => entry.id === 'candidate_app_bundle_build')) {
    throw new Error(`${candidate.id} adapter validation_commands must include candidate_app_bundle_build`);
  }
  assertStringArrayIncludes(candidate.implementation_basis, [
    'AG-UI event model',
    'OPL App-owned product profile',
    'OPL Framework app state/action CLI protocol',
  ], `${candidate.id}.implementation_basis`);
  if (
    candidate.target_product_shape.codex_cli_fixed_executor !== true ||
    candidate.target_product_shape.home_executor_selector_visible !== false ||
    candidate.target_product_shape.home_backend_selector_visible !== false ||
    candidate.target_product_shape.home_model_selector_visible !== false ||
    candidate.target_product_shape.permission_mode_selector_visible !== false
  ) {
    throw new Error(`${candidate.id} must preserve Codex fixed-executor home without selectors`);
  }
  assertStringArrayIncludes(candidate.target_product_shape.purpose_entries, requiredHomeEntries, `${candidate.id}.target_product_shape.purpose_entries`);
  for (const [surface, expected] of Object.entries(expectedFrameworkSurfaces)) {
    if (candidate.framework_surfaces[surface] !== expected) {
      throw new Error(`${candidate.id}.framework_surfaces.${surface} must be ${expected}`);
    }
  }
  assertStringArrayIncludes(candidate.required_capabilities, requiredCapabilities, `${candidate.id}.required_capabilities`);
  assertStringArrayIncludes(candidate.must_not_own, forbiddenAuthority, `${candidate.id}.must_not_own`);
  assertStringArrayIncludes(candidate.forbidden_home_controls, [
    'Aion CLI backend choice',
    'Claude Code backend choice',
    'generic backend selector',
    'Codex model override selector',
    'permission mode selector',
  ], `${candidate.id}.forbidden_home_controls`);
  assertStringArrayIncludes(candidate.non_goals, [
    'do not switch active_shell away from aionui',
    'do not enter default stable or nightly release packaging',
    'do not introduce runtime or domain truth into the App repo',
  ], `${candidate.id}.non_goals`);
  for (const entry of candidate.validation_commands) {
    if (!entry.id || !entry.cwd || !entry.command) {
      throw new Error(`${candidate.id} has invalid validation command ${JSON.stringify(entry)}`);
    }
    assertFile(path.join(root, entry.cwd), `${candidate.id} validation cwd ${entry.id}`);
  }
  const bundleCommand = candidate.validation_commands.find((entry) => entry.id === 'candidate_app_bundle_build');
  if (!bundleCommand) {
    throw new Error(`${candidate.id} validation_commands must include candidate_app_bundle_build`);
  }
  if (
    bundleCommand.cwd !== '.'
    || !bundleCommand.command.includes(`OPL_APP_SHELL_ADAPTER_CONTRACT=${candidate.adapter_contract} npm run package`)
  ) {
    throw new Error(`${candidate.id} candidate_app_bundle_build must run App-root npm package with the candidate adapter contract`);
  }
  assertFile(path.join(root, candidate.candidate_root, 'scripts', 'validate-agui-codex-candidate.ts'), `${candidate.id} self-check`);
}

function runCandidateCommands(candidate: ShellCandidate): void {
  for (const entry of candidate.validation_commands) {
    const result = spawnSync(entry.command, {
      cwd: path.join(root, entry.cwd),
      shell: true,
      stdio: 'inherit',
      env: process.env,
    });
    if (result.status !== 0) {
      throw new Error(`${candidate.id} validation command failed: ${entry.id}`);
    }
    if (entry.id === 'candidate_app_bundle_build') {
      validateCandidatePackageManifest(candidate);
    }
  }
}

function validateCandidatePackageManifest(candidate: ShellCandidate): void {
  const manifestPath = path.join(root, candidate.candidate_root, 'out', 'agui-codex-candidate-manifest.json');
  assertFile(manifestPath, `${candidate.id} package manifest`);
  const manifest = readJson<{
    status: string;
    package_kind: string;
    app_bundle_path: string;
    product_profile_owner: string;
    home_purpose_entries: string[];
  }>(manifestPath);
  if (manifest.status !== 'candidate_app_bundle_ready') {
    throw new Error(`${candidate.id} package manifest must declare candidate_app_bundle_ready`);
  }
  if (manifest.package_kind !== 'explicit_candidate_app_bundle') {
    throw new Error(`${candidate.id} package manifest must declare explicit_candidate_app_bundle`);
  }
  if (!manifest.app_bundle_path || !manifest.app_bundle_path.endsWith('.app')) {
    throw new Error(`${candidate.id} package manifest must point at a .app bundle`);
  }
  assertRelativePath(manifest.app_bundle_path, `${candidate.id} package manifest app_bundle_path`);
  const appBundleRoot = path.join(root, candidate.candidate_root, manifest.app_bundle_path);
  assertDirectory(appBundleRoot, `${candidate.id} .app bundle`);
  assertFile(path.join(appBundleRoot, 'Contents', 'Info.plist'), `${candidate.id} .app Info.plist`);
  const macOsDir = path.join(appBundleRoot, 'Contents', 'MacOS');
  assertDirectory(macOsDir, `${candidate.id} .app Contents/MacOS`);
  findMacAppExecutable(macOsDir, candidate.id);
  assertNoAbsoluteSymlinks(appBundleRoot, candidate.id);
  if (manifest.product_profile_owner !== 'one-person-lab-app') {
    throw new Error(`${candidate.id} package manifest must prove App-owned product profile input`);
  }
  assertStringArrayIncludes(manifest.home_purpose_entries, requiredHomeEntries, `${candidate.id} package manifest purpose entries`);
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
