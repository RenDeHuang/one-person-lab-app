#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { readAppShellAdapterContract } from './app-shell-adapter.ts';
import { readJson, registryPath, root } from './validate-shell-candidates/shared.ts';
import type { ShellCandidateRegistry } from './validate-shell-candidates/types.ts';

const hermesAdapter = 'contracts/shell-adapters/hermes-codex.json';
const repoLocalCheckout = 'shells/hermes';
const siblingCheckout = '../opl-hermes-shell';
const requiredWrapperFiles = [
  'package.json',
  'AGENTS.md',
  'README.md',
  'UPSTREAM_README.md',
  'electron/main.cjs',
  'electron/opl-defaults.cjs',
  'electron/opl-bootstrap-runner.cjs',
  'electron/opl-codex-gateway.cjs',
  'electron/opl-bootstrap-runner.test.cjs',
  'electron/opl-codex-gateway.test.cjs',
  'scripts/package-opl-candidate-app.cjs',
  'scripts/validate-hermes-codex-candidate.cjs',
];

function pathExists(repoRelativePath: string): boolean {
  return fs.existsSync(path.resolve(root, repoRelativePath));
}

function missingWrapperFiles(checkoutPath: string): string[] {
  return requiredWrapperFiles.filter((relativePath) => !pathExists(path.join(checkoutPath, relativePath)));
}

function resolveHermesCheckout(): { status: 'available'; path: string } | { status: 'blocked'; checkoutPath: string | null; blockers: string[] } {
  if (pathExists(repoLocalCheckout)) {
    const missing = missingWrapperFiles(repoLocalCheckout);
    return missing.length === 0
      ? { status: 'available', path: repoLocalCheckout }
      : {
        status: 'blocked',
        checkoutPath: repoLocalCheckout,
        blockers: missing.map((relativePath) => `missing_wrapper_file:${repoLocalCheckout}/${relativePath}`),
      };
  }
  if (pathExists(siblingCheckout)) {
    const missing = missingWrapperFiles(siblingCheckout);
    return missing.length === 0
      ? { status: 'available', path: siblingCheckout }
      : {
        status: 'blocked',
        checkoutPath: siblingCheckout,
        blockers: missing.map((relativePath) => `missing_wrapper_file:${siblingCheckout}/${relativePath}`),
      };
  }
  return {
    status: 'blocked',
    checkoutPath: null,
    blockers: [
      'missing_shell_checkout:shells/hermes',
      'missing_shell_checkout:../opl-hermes-shell',
    ],
  };
}

function main(): void {
  const registry = readJson<ShellCandidateRegistry>(registryPath);
  const candidate = registry.candidates.find((entry) => entry.id === 'hermes-codex');
  if (!candidate) {
    throw new Error('Hermes candidate is not declared in contracts/app-shell-candidates.json');
  }
  if (candidate.adapter_contract !== hermesAdapter) {
    throw new Error(`Hermes candidate adapter_contract must be ${hermesAdapter}`);
  }
  const adapter = readAppShellAdapterContract(path.join(root, hermesAdapter));
  if (adapter.active_shell !== 'hermes-codex') {
    throw new Error('Hermes adapter active_shell must be hermes-codex');
  }
  if (adapter.shell_source.owner_repo !== 'NousResearch/hermes-agent') {
    throw new Error('Hermes adapter source must be NousResearch/hermes-agent');
  }
  if (adapter.shell_source.upstream_ref !== 'apps/desktop') {
    throw new Error('Hermes adapter upstream_ref must be apps/desktop');
  }
  if (adapter.release_role !== 'experimental_candidate_shell') {
    throw new Error('Hermes adapter must remain an experimental candidate shell');
  }
  if (adapter.candidate_stage !== 'upstream_feature_comparison_minimal_opl_adapter') {
    throw new Error('Hermes adapter must remain at minimal OPL adapter stage until feature comparison is recorded');
  }
  if (!adapter.shell_contract.capabilities.includes('upstream_hermes_desktop_feature_baseline_preserved')) {
    throw new Error('Hermes adapter must declare upstream Hermes Desktop feature baseline preservation');
  }
  for (const capability of [
    'official_hermes_backend_preserved',
    'opl_defaults_seed_for_codex_runtime_and_domain_skills',
    'codex_app_server_backed_hermes_gateway_adapter',
    'opl_app_managed_bootstrap_for_first_run',
    'model_access_api_key_configuration',
    'opl_first_run_initialization_owner',
    'macos_icon_safe_margin',
    'renderer_safe_profile_config_bootstrap_routes',
  ]) {
    if (!adapter.shell_contract.capabilities.includes(capability)) {
      throw new Error(`Hermes adapter must declare ${capability}`);
    }
  }
  validateFirstRunAndIconContracts(candidate, adapter);
  if (!adapter.deferred_until_feature_comparison?.surfaces?.includes('opl_app_state_action_bridge')) {
    throw new Error('Hermes adapter must defer OPL app state/action bridge until Hermes feature comparison is recorded');
  }

  const checkout = resolveHermesCheckout();
  if (checkout.status === 'available') {
    validateHermesImplementation(checkout.path);
  }
  console.log(JSON.stringify({
    status: checkout.status === 'available' ? 'hermes_candidate_contract_valid' : 'hermes_candidate_blocked',
    candidate: candidate.id,
    adapter_contract: hermesAdapter,
    source: 'NousResearch/hermes-agent apps/desktop',
    license: 'MIT',
    active_shell_unchanged: registry.active_shell_unchanged,
    candidate_root: candidate.candidate_root,
    selectable_adapter_build_command: `OPL_APP_SHELL_ADAPTER_CONTRACT=${hermesAdapter} npm run package`,
    sibling_checkout_build_command: `OPL_APP_SHELL_ROOT=${siblingCheckout} OPL_APP_SHELL_ADAPTER_CONTRACT=${hermesAdapter} npm run package`,
    checkout_path: checkout.status === 'available' ? checkout.path : checkout.checkoutPath,
    blockers: checkout.status === 'blocked' ? checkout.blockers : [],
  }, null, 2));
}

function validateFirstRunAndIconContracts(candidate: ShellCandidateRegistry['candidates'][number], adapter: ReturnType<typeof readAppShellAdapterContract>): void {
  const expectedStartupSequence = [
    'check-opl-app-initialization-marker',
    'check-one-person-lab-cli',
    'check-codex-cli',
    'check-gflabtoken-model-access',
    'check-codex-adapter-startup',
  ];
  const expectedOneTimeSequence = [
    'opl-cli-check',
    'codex-cli-check',
    'prepare-local-directories-and-config',
    'opl-core-readiness-check',
    'opl-core-install-or-repair-when-needed',
    'write-opl-app-initialization-marker',
  ];
  const expectedBackgroundSequence = [
    'opl system initialize --json',
    'opl system startup-maintenance --json',
    'opl system reconcile-modules --json',
    'mas_mag_rca_status_refresh',
    'contracts_diagnostics_refresh',
  ];
  for (const [label, contract] of [
    ['candidate.first_run_contract', candidate.first_run_contract],
    ['adapter.first_run_contract', adapter.first_run_contract],
  ] as const) {
    if (!contract) throw new Error(`Hermes ${label} must be declared`);
    if (contract.owner !== 'opl_app_cli') throw new Error(`Hermes ${label}.owner must be opl_app_cli`);
    if (contract.ui_reuse_policy !== 'reuse_hermes_onboarding_module_and_progress_ui_only') {
      throw new Error(`Hermes ${label}.ui_reuse_policy must reuse only the Hermes onboarding UI`);
    }
    if (contract.forbidden_default_action !== 'download_or_execute_hermes_agent_installer') {
      throw new Error(`Hermes ${label}.forbidden_default_action must forbid the Hermes Agent installer`);
    }
    if (contract.startup_model !== 'lightweight_startup_check_then_chat_first') {
      throw new Error(`Hermes ${label}.startup_model must be lightweight_startup_check_then_chat_first`);
    }
    for (const step of expectedStartupSequence) {
      if (!contract.startup_check_sequence.includes(step)) {
        throw new Error(`Hermes ${label}.startup_check_sequence must include ${step}`);
      }
    }
    for (const step of [
      'missing-opl-app-initialization-marker',
      'stale-opl-app-initialization-marker',
      'missing-one-person-lab-core-components',
    ]) {
      if (!contract.one_time_initialization_trigger.includes(step)) {
        throw new Error(`Hermes ${label}.one_time_initialization_trigger must include ${step}`);
      }
    }
    for (const step of expectedOneTimeSequence) {
      if (!contract.one_time_initialization_sequence.includes(step)) {
        throw new Error(`Hermes ${label}.one_time_initialization_sequence must include ${step}`);
      }
    }
    for (const step of expectedBackgroundSequence) {
      if (!contract.background_refresh_sequence.includes(step)) {
        throw new Error(`Hermes ${label}.background_refresh_sequence must include ${step}`);
      }
    }
    if (
      contract.model_access_wizard?.trigger !== 'missing_or_invalid_gflabtoken_api_key_or_model_access_unavailable'
      || contract.model_access_wizard.api_key_provider !== 'gflabtoken'
      || contract.model_access_wizard.api_key_command !== 'opl system configure-codex --api-key-stdin --json'
      || contract.model_access_wizard.provider_base_url !== 'https://gflabtoken.cn/v1'
      || contract.model_access_wizard.default_model !== 'gpt-5.5'
      || contract.model_access_wizard.api_key_env !== 'OPENAI_API_KEY'
      || contract.model_access_wizard.ordinary_ui_policy !== 'show_only_model_access_api_key_no_base_url_provider_marketplace_or_oauth_accounts'
    ) {
      throw new Error(`Hermes ${label}.model_access_wizard must define gflabtoken-only Codex model access`);
    }
    if (contract.blocking_policy !== 'full_opl_initialize_and_module_refresh_must_not_block_hot_launch_or_chat_after_light_check_passes') {
      throw new Error(`Hermes ${label}.blocking_policy must keep full initialize out of hot launch`);
    }
    if (contract.api_key_present_behavior !== 'auto_continue_to_opl_codex_adapter_without_waiting_for_setup_runtime_check_or_api_key_form') {
      throw new Error(`Hermes ${label}.api_key_present_behavior must auto-skip onboarding when Codex model access already exists`);
    }
    if (contract.ready_check !== 'lightweight startup check: initialization marker fresh, core components discoverable, Codex CLI available, model access configured, Codex adapter startable') {
      throw new Error(`Hermes ${label}.ready_check must describe the lightweight startup check`);
    }
    for (const evidence of [
      'no install.sh or install.ps1 fetch or execution',
      'hot launch with fresh marker and model access does not run blocking full opl system initialize',
      'missing or stale marker routes to the OPL one-time initialization checklist',
      'one-time initialization writes or refreshes the OPL App initialization marker',
      'missing API key routes to model access wizard without showing the installation checklist',
      'background OPL status refresh starts only after the main chat surface is visible',
      'OPL Codex adapter starts',
      'existing Codex model access configuration auto-skips onboarding',
      'official Hermes OAuth provider route returns an empty renderer-safe provider list',
    ]) {
      if (!contract.packaged_smoke_must_prove.includes(evidence)) {
        throw new Error(`Hermes ${label}.packaged_smoke_must_prove must include ${evidence}`);
      }
    }
  }

  for (const [label, contract] of [
    ['candidate.icon_contract', candidate.icon_contract],
    ['adapter.icon_contract', adapter.icon_contract],
  ] as const) {
    if (!contract) throw new Error(`Hermes ${label} must be declared`);
    if (contract.macos_safe_margin_required !== true) throw new Error(`Hermes ${label}.macos_safe_margin_required must be true`);
    if (contract.max_alpha_bounds_px !== 900) throw new Error(`Hermes ${label}.max_alpha_bounds_px must be 900`);
    if (contract.current_expected_alpha_bounds_px !== '840x840+92+92') {
      throw new Error(`Hermes ${label}.current_expected_alpha_bounds_px must be 840x840+92+92`);
    }
  }
}

function readCheckoutFile(checkoutPath: string, relativePath: string): string {
  const filePath = path.resolve(root, checkoutPath, relativePath);
  return fs.readFileSync(filePath, 'utf8');
}

function validateHermesImplementation(checkoutPath: string): void {
  const mainProcess = readCheckoutFile(checkoutPath, 'electron/main.cjs');
  const bootstrapRunner = readCheckoutFile(checkoutPath, 'electron/opl-bootstrap-runner.cjs');
  const gateway = readCheckoutFile(checkoutPath, 'electron/opl-codex-gateway.cjs');
  const validator = readCheckoutFile(checkoutPath, 'scripts/validate-hermes-codex-candidate.cjs');

  for (const snippet of [
    'runOplBootstrap',
    "backend.kind === 'bootstrap-needed'",
    'OPL App initialization instead of Hermes Agent install',
    'createOplCodexGateway',
  ]) {
    if (!mainProcess.includes(snippet)) {
      throw new Error(`Hermes main process must include ${snippet}`);
    }
  }
  const oplBootstrapCall = mainProcess.indexOf('await runOplBootstrap');
  const upstreamBootstrapCall = mainProcess.indexOf('await runBootstrap');
  if (oplBootstrapCall === -1 || upstreamBootstrapCall === -1 || oplBootstrapCall > upstreamBootstrapCall) {
    throw new Error('Hermes main process must intercept OPL bootstrap before upstream runBootstrap is used');
  }
  for (const snippet of [
    "'system', 'initialize', '--json'",
    "'install', '--skip-gui-open', '--skip-modules', '--skip-native-helper-repair', '--json'",
    "'system', 'startup-maintenance', '--json'",
    "'system', 'reconcile-modules', '--json'",
    'maintenanceDeferred',
    "route: 'model-access'",
    'api_key_present',
  ]) {
    if (!bootstrapRunner.includes(snippet)) {
      throw new Error(`Hermes OPL bootstrap runner must include ${snippet}`);
    }
  }
  for (const snippet of [
    "'system', 'configure-codex', '--api-key-stdin', '--json'",
    'https://gflabtoken.cn/v1',
    'gpt-5.5',
    'OPENAI_API_KEY',
    "'/api/profiles'",
    "'/api/config'",
    'setup.runtime_check',
  ]) {
    if (!gateway.includes(snippet)) {
      throw new Error(`Hermes OPL Codex gateway must include ${snippet}`);
    }
  }
  for (const snippet of [
    "'magick', ['assets/icon.png', '-alpha', 'extract', '-format', '%@', 'info:']",
    'icon content must keep macOS Dock safe margin',
    'maxWidth: 900',
    'maxHeight: 900',
    'electron/opl-bootstrap-runner.cjs',
    'startOplMaintenanceInBackground',
  ]) {
    if (!validator.includes(snippet)) {
      throw new Error(`Hermes candidate validator must include ${snippet}`);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
