import { assertIncludesAll } from './assertions.ts';
import { isDefaultReleaseAdapter } from './active-shell-contract.ts';
import {
  beginnerFirstRunTestIds,
  firstRunChecklistFields,
  firstRunCoreItems,
  firstRunDeferredMaintenanceItems,
  firstRunEcosystemModules,
  firstRunProgressConsumerPackageTypes,
  firstRunProgressFields,
  firstRunProgressSourceCommand,
  firstRunProgressSourcePath,
  firstRunRequiredHostTools,
  firstRunSetupFlowFields,
} from './app-contract-constants.ts';

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
  if (fullClean?.ready_to_launch_gate?.ui_order !== 'before_guid') {
    throw new Error('Full first-install clean-machine scenario must gate ready_to_launch before /guid');
  }
  if (fullClean?.ready_to_launch_gate?.blocks_on_full_readiness !== false) {
    throw new Error('Full first-install ready_to_launch must not block on full readiness');
  }
  for (const item of firstRunCoreItems) {
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

function validateSharedProgressModel(progressModel) {
  if (progressModel?.producer !== 'one-person-lab') {
    throw new Error('First-run shared progress model producer must be one-person-lab');
  }
  if (progressModel?.source_command !== firstRunProgressSourceCommand) {
    throw new Error('First-run shared progress model must use opl system initialize --json');
  }
  if (progressModel?.source_path !== firstRunProgressSourcePath) {
    throw new Error('First-run shared progress model must read system_initialize.setup_flow');
  }
  if (progressModel?.truth_policy !== 'all_installers_and_renderers_derive_progress_from_the_shared_initialize_model') {
    throw new Error('First-run shared progress model must forbid parallel installer progress truth');
  }
  assertIncludesAll(
    progressModel?.required_setup_flow_fields,
    firstRunSetupFlowFields,
    'First-run shared progress model setup_flow fields',
  );
  assertIncludesAll(
    progressModel?.required_progress_fields,
    firstRunProgressFields,
    'First-run shared progress model progress fields',
  );
  assertIncludesAll(
    progressModel?.required_checklist_fields,
    firstRunChecklistFields,
    'First-run shared progress model checklist fields',
  );
  const packageTypes = (progressModel?.consumers ?? []).map((consumer) => consumer.package_type);
  assertIncludesAll(packageTypes, firstRunProgressConsumerPackageTypes, 'First-run shared progress model consumers');
}

export function validateFirstRunMatrix(matrix, contract) {
  if (isDefaultReleaseAdapter(contract) && (matrix.active_shell !== contract.active_shell || matrix.shell_root !== contract.shell_root)) {
    throw new Error('First-run matrix must target the active shell contract');
  }
  validateSharedProgressModel(matrix.shared_progress_model);
  const scenarioById = buildScenarioMap(matrix);
  validateFullFirstInstallScenario(scenarioById.get('full_first_install_clean_machine'));
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
    'access key entry uses beginner-facing 访问密钥 copy while keeping the narrow Codex configuration bridge underneath',
  ]) {
    if (!beginnerScenario.expects?.includes(expected)) {
      throw new Error(`Beginner first-run scenario must require localized beginner setup UX: ${expected}`);
    }
  }
  validateStandardBootstrapScenario(scenarioById.get('standard_app_managed_bootstrap'));
  validateCommandLineToolsScenario(scenarioById.get('macos_clt_system_installer'));
  validateEcosystemModuleScenario(scenarioById.get('ecosystem_modules_app_cli_managed'));
  validateUpdaterScenario(scenarioById.get('updater_standard_channel'));
}
