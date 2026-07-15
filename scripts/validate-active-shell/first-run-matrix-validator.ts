import { assertIncludesAll, readJson } from './assertions.ts';
import { isDefaultReleaseAdapter } from './active-shell-contract.ts';
import {
  beginnerFirstRunTestIds,
  firstRunEcosystemModules,
  progressiveFirstRunRecoveryTestIds,
} from './app-contract-constants.ts';
import { assertNonEmptyStringArray, assertSharedFirstRunProgressModelMatches } from './shared-contract-validators.ts';
import { productProfilePath } from './validation-config.ts';
import { expectedHomeComposerStateContract } from '../app-product-profile-shared-validators.ts';

const productProfile = readJson(productProfilePath);
const fullFirstInstallPolicy = productProfile.first_run?.core_ready_policy?.full_first_install_clean_machine;
const expectedFirstRunProgressModel = productProfile.first_run?.progress_model;
const expectedFirstRunCoreItems = assertNonEmptyStringArray(
  productProfile.first_run?.ready_to_launch_gate?.required_core_items,
  'Product profile ready_to_launch required_core_items',
);

const firstRunRequiredHostTools = assertNonEmptyStringArray(
  fullFirstInstallPolicy?.missing_host_tools_allowed,
  'Product profile Full first-install missing_host_tools_allowed',
);
const firstRunDeferredMaintenanceItems = assertNonEmptyStringArray(
  fullFirstInstallPolicy?.must_not_block_core_ready,
  'Product profile Full first-install must_not_block_core_ready',
);

function buildScenarioMap(matrix) {
  if (!Array.isArray(matrix.scenarios) || matrix.scenarios.length === 0) {
    throw new Error('First-run matrix must declare scenarios');
  }
  return new Map(matrix.scenarios.map((scenario) => {
    if (!scenario.id || !scenario.package_type || !Array.isArray(scenario.expects) || scenario.expects.length === 0) {
      throw new Error(`Invalid first-run scenario: ${JSON.stringify(scenario)}`);
    }
    if (Array.isArray(scenario.aliases) && scenario.aliases.length > 0) {
      throw new Error(`First-run scenario ${scenario.id} must not declare compatibility aliases`);
    }
    return [scenario.id, scenario];
  }));
}

function validateFullFirstInstallScenario(fullClean) {
  for (const tool of firstRunRequiredHostTools) {
    if (!fullClean?.clean_machine_missing_tools?.includes(tool)) {
      throw new Error(`Full first-install clean-machine scenario must allow missing ${tool}`);
    }
  }
  if (fullClean?.core_ready_source !== 'bundled_runtime') {
    throw new Error('Full first-install clean-machine scenario must reach Core ready from bundled_runtime');
  }
  if (
    fullClean?.ready_to_launch_gate?.ui_order !== 'before_first_conversation_not_before_guid' ||
    fullClean?.ready_to_launch_gate?.guid_navigation_blocking !== false
  ) {
    throw new Error('Full first-install clean-machine scenario must gate first conversation without blocking /guid navigation');
  }
  if (fullClean?.ready_to_launch_gate?.blocks_on_full_readiness !== false) {
    throw new Error('Full first-install ready_to_launch must not block on full readiness');
  }
  for (const item of expectedFirstRunCoreItems) {
    if (!fullClean?.ready_to_launch_gate?.required_core_items?.includes(item)) {
      throw new Error(`Full first-install ready_to_launch must require Core item ${item}`);
    }
  }
  for (const item of firstRunDeferredMaintenanceItems) {
    if (!fullClean?.background_maintenance?.includes(item)) {
      throw new Error(`Full first-install clean-machine scenario must defer ${item} to background maintenance`);
    }
  }
  if (fullClean?.post_core_ready_background_policy?.mode !== 'best_effort_non_blocking') {
    throw new Error('Full first-install clean-machine scenario must continue background maintenance as best-effort non-blocking work');
  }
  if (fullClean?.post_core_ready_background_policy?.continues_after_core_ready !== true) {
    throw new Error('Full first-install clean-machine scenario must continue maintenance after Core ready');
  }
  for (const item of firstRunDeferredMaintenanceItems) {
    if (!fullClean?.post_core_ready_background_policy?.managed_items?.includes(item)) {
      throw new Error(`Full first-install post-Core maintenance must manage ${item}`);
    }
  }
  if (!fullClean?.expects?.some((entry) => /family runtime provider/.test(entry) && /background maintenance/.test(entry))) {
    throw new Error('Full first-install scenario must keep Temporal family runtime provider in background maintenance after Core ready');
  }
}

function validateHomeComposerProbe(scenario, label) {
  const probe = scenario?.diagnostics_contract?.home_composer_probe;
  if (
    probe?.contract_ref !==
      'contracts/app-gui-product-contract.json#interaction_baseline.home.home_composer_state_contract' ||
    JSON.stringify(probe.shortcut_package_ids) !==
      JSON.stringify(expectedHomeComposerStateContract.shortcut_package_ids) ||
    JSON.stringify(probe.viewports) !== JSON.stringify(expectedHomeComposerStateContract.viewports) ||
    JSON.stringify(probe.availability_states) !==
      JSON.stringify(expectedHomeComposerStateContract.availability_states) ||
    JSON.stringify(probe.required_summary_fields) !==
      JSON.stringify(['missing_controls', 'composer_state', 'instance_counts']) ||
    probe.fail_fast_seconds !== 60
  ) {
    throw new Error(`${label} must consume the App-owned Home composer state contract and fail within 60 seconds`);
  }
}

function validateStandardBootstrapScenario(standardBootstrap) {
  if (standardBootstrap?.bootstrap_owner !== 'app_managed') {
    throw new Error('Standard bootstrap scenario must declare App-managed bootstrap ownership');
  }
  if (standardBootstrap?.maintenance_resolution_policy !== 'app_or_cli_managed_best_effort_until_ready') {
    throw new Error('Standard bootstrap scenario must keep App/CLI-managed maintenance responsible until host tools are ready');
  }
  if (!standardBootstrap?.expects?.some((entry) => /App-managed bootstrap/.test(entry))) {
    throw new Error('First-run matrix must declare standard App-managed bootstrap');
  }
  if (!standardBootstrap?.expects?.some((entry) => /does not end.*Homebrew, Node, or Git/i.test(entry))) {
    throw new Error('Standard bootstrap must not make Homebrew/Node/Git installation the first-screen end state');
  }
}

function validateCommandLineToolsScenario(cltInstaller) {
  if (cltInstaller?.command !== 'xcode-select --install') {
    throw new Error('CLT first-run scenario must use xcode-select --install');
  }
  if (!cltInstaller?.expects?.some((entry) => /user confirmation/.test(entry))) {
    throw new Error('CLT first-run scenario must wait for user confirmation in the system installer');
  }
}

function validateEcosystemModuleScenario(ecosystem) {
  for (const moduleId of firstRunEcosystemModules) {
    if (!ecosystem?.modules?.includes(moduleId)) {
      throw new Error(`First-run matrix must mark ${moduleId} as App/CLI managed ecosystem module`);
    }
  }
}

function validateUpdaterScenario(updater) {
  if (
    updater?.update_policy?.download !== 'background'
    || updater?.update_policy?.apply !== 'restart_when_ready'
    || updater?.update_policy?.ready_prompt !== 'prompt_restart_after_download_ready'
    || updater?.update_policy?.full_first_install_metadata_allowed !== false
    || updater?.update_policy?.scope !== 'desktop_app_assets_only'
    || updater?.update_policy?.module_package_update_allowed !== false
    || updater?.update_policy?.developer_checkout_selection_allowed !== false
    || updater?.update_policy?.opl_flow_install_allowed !== false
  ) {
    throw new Error('Standard updater scenario must update desktop App assets only and exclude Full metadata, module packages, Developer checkouts, and opl-flow install');
  }
  for (const expected of [
    'standard updater does not update domain module packages',
    'standard updater does not select Developer Profile source_channel checkouts',
    'standard updater does not install opl-flow',
  ]) {
    if (!updater.expects?.includes(expected)) {
      throw new Error(`Standard updater scenario must require: ${expected}`);
    }
  }
}

function expandPackageTypes(packageType) {
  if (typeof packageType !== 'string' || !packageType.trim()) {
    return [];
  }
  return packageType.split('_or_').filter(Boolean);
}

function validateSharedProgressModel(progressModel, scenarios) {
  if (progressModel?.producer !== 'one-person-lab') {
    throw new Error('First-run shared progress model producer must be one-person-lab');
  }
  assertSharedFirstRunProgressModelMatches(progressModel, expectedFirstRunProgressModel, 'First-run matrix');
  if (progressModel?.truth_policy !== 'all_installers_and_renderers_derive_progress_from_the_shared_initialize_model') {
    throw new Error('First-run shared progress model must forbid parallel installer progress truth');
  }
  const packageTypes = (progressModel?.consumers ?? []).map((consumer) => consumer.package_type);
  const scenarioPackageTypes = [...new Set((scenarios ?? []).flatMap((scenario) => expandPackageTypes(scenario.package_type)))];
  assertIncludesAll(packageTypes, scenarioPackageTypes, 'First-run shared progress model consumers');
}

export function validateFirstRunMatrix(matrix, contract) {
  if (isDefaultReleaseAdapter(contract) && (matrix.active_shell !== contract.active_shell || matrix.shell_root !== contract.shell_root)) {
    throw new Error('First-run matrix must target the active shell contract');
  }
  validateSharedProgressModel(matrix.shared_progress_model, matrix.scenarios);
  const scenarioById = buildScenarioMap(matrix);
  validateFullFirstInstallScenario(scenarioById.get('full_first_install_clean_machine'));
  validateHomeComposerProbe(scenarioById.get('full_first_install_clean_machine'), 'Full first-install clean-machine scenario');
  validateHomeComposerProbe(scenarioById.get('full_dmg_clean_vm_smoke'), 'Full DMG clean-VM scenario');
  const beginnerScenario = scenarioById.get('beginner_simplified_first_run_clean_machine');
  if (!beginnerScenario) {
    throw new Error('First-run matrix is missing beginner_simplified_first_run_clean_machine');
  }
  if (beginnerScenario.audience !== 'beginner_non_technical_users') {
    throw new Error('Beginner first-run scenario must target beginner_non_technical_users');
  }
  if (beginnerScenario.view_model !== 'simplified_first_run') {
    throw new Error('Beginner first-run scenario must use simplified_first_run');
  }
  assertIncludesAll(
    beginnerScenario.required_shell_testids,
    beginnerFirstRunTestIds,
    'Beginner first-run scenario shell test ids',
  );
  for (const expected of [
    'Chinese locale first-run primary area uses beginner labels such as 工作目录, 本机助手, and 模型访问 even when initialize checklist labels are English',
    'Chinese locale first-run primary area does not expose Codex API Configuration, Unknown, Needs setup, raw setup_flow fields, or opl system commands',
    'OPL Gateway access key entry uses beginner-facing 访问密钥 copy while existing usable Codex model access can skip first-launch Gateway setup',
    'first-run uses a focused full-window setup workspace and hides ordinary product navigation until the user enters /guid',
    'first-run renders as an authenticated standalone route outside the ordinary product layout',
    'startup preflight skip enters /guid while readiness is unknown without mutating readiness',
    'the three Core items render as a stable step rail while only the current task occupies the main panel',
    'the active rail step and task panel select the first unready Core item in fixed step order before completion',
    'Core progress uses completed step count without percentage progress',
    'model access offers functional OPL Gateway and existing Codex configuration paths without competing primary actions',
    'model access method switching and alternate actions remain disabled until the current request settles',
    'ready state replaces the current task in place and keeps one primary entry action',
    'FirstRun never navigates automatically after initialize and explicit user entry can open /guid before or after readiness',
    'technical details stay inside FirstRun and do not expose ordinary Settings navigation',
    'all initialize, model access, and maintenance actions share one in-flight interaction lock',
    'initialize pending does not claim ready or no blockers before a payload returns',
    'required Core checklist items never treat disabled status as ready',
    'the 400x600 minimum App window keeps the current primary action visible',
    'background App shell is inert and aria-hidden until the user enters /guid',
    'macOS preserves traffic-light safe area while Windows and Linux retain desktop window controls',
    'interactive controls use localized accessible names rather than testid strings',
    'beginner errors are localized inline while raw diagnostics remain in technical details',
    'submitted access keys are redacted before any renderer diagnostic is stored or rendered',
  ]) {
    if (!beginnerScenario.expects?.includes(expected)) {
      throw new Error(`Beginner first-run scenario must require localized beginner setup UX: ${expected}`);
    }
  }
  const progressiveRecovery = scenarioById.get('ordinary_shell_progressive_first_run_recovery');
  if (!progressiveRecovery) {
    throw new Error('First-run matrix is missing ordinary_shell_progressive_first_run_recovery');
  }
  assertIncludesAll(
    progressiveRecovery.required_shell_testids,
    progressiveFirstRunRecoveryTestIds,
    'Progressive first-run recovery shell test ids',
  );
  for (const expected of [
    'incomplete Core readiness never blocks authenticated navigation to /guid',
    'ordinary sidebar keeps a non-modal localized entry back to /first-run until Core prerequisites are complete',
    'plain conversation and send-scoped local file or directory inputs require Codex CLI and model access but do not require workspace_root',
    'blocked send keeps the draft prompt and shows an inline localized recovery action',
    'missing workspace_root disables project selection, Worktree creation, and OPL workspace controls only',
    'unknown readiness does not synthesize failure or mutate ready_to_launch',
  ]) {
    if (!progressiveRecovery.expects?.includes(expected)) {
      throw new Error(`Progressive first-run recovery scenario must require: ${expected}`);
    }
  }
  validateStandardBootstrapScenario(scenarioById.get('standard_app_managed_bootstrap'));
  validateCommandLineToolsScenario(scenarioById.get('macos_clt_system_installer'));
  validateEcosystemModuleScenario(scenarioById.get('ecosystem_modules_app_cli_managed'));
  validateUpdaterScenario(scenarioById.get('updater_standard_channel'));
}
