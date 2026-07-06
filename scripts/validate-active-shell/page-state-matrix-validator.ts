import { assertDeepEqualJson, assertIncludesAll, readJson } from './assertions.ts';
import { isDefaultReleaseAdapter } from './active-shell-contract.ts';
import {
  appOwnedQueueStatusPolicy,
  appOwnedProjectGroupExpansionPolicy,
  beginnerFirstRunTestIds,
  firstRunCoreItems,
  fullReadinessItems,
} from './app-contract-constants.ts';
import {
  validateArtifactNativeDrilldownProjectionContract,
  validateBeginnerFirstRunPresentation,
  validateOpenScienceConsoleProjectionContract,
  validateProviderReadinessRepairProjectionContract,
  validateProgressDeltaDisplayContract,
  validateProjectProgressDisplayContract,
  validateRefLevelFollowUpProjectionContract,
  validateStateIndexSidecarProjectionContract,
  validateStructuredResultPanelProjectionContract,
  validateUserTaskStatusProjectionContract,
  assertFirstRunProgressModelMatches,
} from './shared-contract-validators.ts';
import {
  validateAppSettingsPages,
} from './page-state-app-settings-validator.ts';
import { validatePrimaryInteractionPages } from './page-state-primary-interaction-validator.ts';
import { productProfilePath } from './validation-config.ts';

const expectedFirstRunProgressModel = readJson(productProfilePath).first_run?.progress_model;

export function validatePageStateMatrix(matrix, contract) {
  if (isDefaultReleaseAdapter(contract) && (matrix.active_shell !== contract.active_shell || matrix.shell_root !== contract.shell_root)) {
    throw new Error('Page-state matrix must target the active shell contract');
  }

  const requiredPages = new Set([
    'guid_home',
    'runtime',
    'settings_general',
    'access',
    'capabilities',
    'environment',
    'advanced',
    'about',
    'update',
    'settings_theme',
    'first_launch_readiness',
  ]);
  for (const page of matrix.pages ?? []) {
    requiredPages.delete(page.id);
    if (!page.expected_source || !Array.isArray(page.must_show) || page.must_show.length === 0) {
      throw new Error(`Invalid page-state entry: ${JSON.stringify(page)}`);
    }
  }
  if (requiredPages.size > 0) {
    throw new Error(`Page-state matrix is missing required page(s): ${[...requiredPages].join(', ')}`);
  }
  if ((matrix.pages ?? []).some((page) => page.id === 'docker_webui')) {
    throw new Error('Page-state matrix must not include withdrawn Docker/WebUI username, title, logo, or branding requirements');
  }

  validatePrimaryInteractionPages(matrix);
  validateAppSettingsPages(matrix);

  const firstLaunchPage = (matrix.pages ?? []).find((page) => page.id === 'first_launch_readiness');
  if (!firstLaunchPage) {
    throw new Error('Page-state matrix is missing first_launch_readiness page');
  }
  if (firstLaunchPage.launch_gate?.id !== 'ready_to_launch' || firstLaunchPage.launch_gate?.ui_order !== 'before_guid') {
    throw new Error('First-launch readiness page must gate ready_to_launch before /guid');
  }
  if (firstLaunchPage.launch_gate?.full_readiness_blocks_ready_to_launch !== false) {
    throw new Error('First-launch readiness page must keep full readiness non-blocking for ready_to_launch');
  }
  validateBeginnerFirstRunPresentation(
    firstLaunchPage.beginner_view_model,
    'First-launch readiness beginner view model',
  );
  assertIncludesAll(
    firstLaunchPage.beginner_view_model?.required_shell_testids,
    beginnerFirstRunTestIds,
    'First-launch readiness beginner shell test ids',
  );
  for (const item of firstRunCoreItems) {
    if (!firstLaunchPage.launch_gate?.required_core_items?.includes(item)) {
      throw new Error(`First-launch readiness page must require Core item ${item}`);
    }
  }
  for (const item of fullReadinessItems) {
    if (!firstLaunchPage.launch_gate?.full_readiness_items?.includes(item)) {
      throw new Error(`First-launch readiness page must list ${item} as full readiness`);
    }
  }
  for (const signal of [
    'workspace root readiness',
    'Codex CLI readiness',
    'Codex model access readiness',
    'ready_to_launch before /guid',
    'full readiness and background maintenance state',
    'current initialization phase',
    'Core completed and total count',
    'Full readiness completed and total count',
    'background maintenance completed and total count',
    'next visible step',
    'beginner-facing readiness summary',
    'primary start action',
    'background maintenance collapsed technical disclosure',
    'technical details toggle',
  ]) {
    if (!firstLaunchPage.must_show?.includes(signal)) {
      throw new Error(`First-launch readiness page must show ${signal}`);
    }
  }
  for (const hiddenSignal of [
    'Homebrew, Node, Git, CLT, module, provider, or runtime maintenance as primary first-screen terminal goals',
    'Full readiness progress as the dominant first-screen message',
    'raw command output in the beginner primary area',
    'English runtime checklist labels in the Chinese beginner primary area',
    'Codex API Configuration, Unknown, or Needs setup in the Chinese beginner primary area',
    'background maintenance counters or labels in the beginner primary area',
  ]) {
    if (!firstLaunchPage.must_not_show?.includes(hiddenSignal)) {
      throw new Error(`First-launch readiness page must not show ${hiddenSignal}`);
    }
  }
  const localizationPolicy = firstLaunchPage.beginner_view_model?.localization_policy;
  assertIncludesAll(
    localizationPolicy?.chinese_primary_labels,
    ['工作目录', '本机助手', '模型访问'],
    'First-launch readiness beginner localization labels',
  );
  assertIncludesAll(
    localizationPolicy?.forbidden_primary_area_text,
    ['Codex API Configuration', 'Unknown', 'Needs setup', 'setup_flow', 'opl system'],
    'First-launch readiness beginner forbidden primary text',
  );
  if (
    localizationPolicy?.technical_label_policy !==
    'map_initialize_item_ids_to_app_owned_beginner_labels_before_rendering_primary_area'
  ) {
    throw new Error('First-launch readiness beginner localization must map initialize item ids before rendering');
  }
  assertFirstRunProgressModelMatches(
    firstLaunchPage.progress_model,
    expectedFirstRunProgressModel,
    'First-launch readiness page',
  );

  const runtimePage = (matrix.pages ?? []).find((page) => page.id === 'runtime');
  if (!runtimePage) {
    throw new Error('Page-state matrix is missing runtime page');
  }
  if (runtimePage.machine_source !== 'opl app state --profile fast --json') {
    throw new Error(`Runtime page machine_source must be fast App state, got: ${runtimePage.machine_source}`);
  }
  if (runtimePage.default_state_source !== 'opl app state --profile fast --json') {
    throw new Error(`Runtime page default_state_source must be fast App state, got: ${runtimePage.default_state_source}`);
  }
  if (runtimePage.diagnostic_source !== 'opl runtime app-operator-drilldown --json') {
    throw new Error(`Runtime page diagnostic_source must be operator summary drilldown, got: ${runtimePage.diagnostic_source}`);
  }
  if (runtimePage.primary_projection !== 'app_state.operator user task status projection') {
    throw new Error(`Runtime page primary_projection must be user task status, got: ${runtimePage.primary_projection}`);
  }
  if (runtimePage.framework_command !== 'opl app state --profile fast --json') {
    throw new Error(`Runtime page must use the OPL App state command, got: ${runtimePage.framework_command}`);
  }
  if (runtimePage.framework_full_detail_command !== 'opl runtime app-operator-drilldown --detail full --json') {
    throw new Error(`Runtime page must lazy-load full App/operator drilldown only on demand, got: ${runtimePage.framework_full_detail_command}`);
  }
  if (runtimePage.framework_action_command !== 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json') {
    throw new Error(`Runtime page must expose only the whitelisted OPL App action command, got: ${runtimePage.framework_action_command}`);
  }
  const acceptancePath = runtimePage.operator_evidence_acceptance_path;
  if (acceptancePath?.role !== 'runtime_page_operator_evidence_acceptance') {
    throw new Error('Runtime page must declare operator evidence acceptance path');
  }
  if (acceptancePath.accepts_refs_only_json !== true) {
    throw new Error('Runtime page operator evidence acceptance must be refs-only JSON');
  }
  for (const [field, expected] of Object.entries({
    summary_state_command: 'opl app state --profile fast --json',
    refresh_state_command: 'opl app state --profile fast --json',
    full_drilldown_command: 'opl runtime app-operator-drilldown --detail full --json',
    action_dry_run_command: 'opl app action execute --action <action_id> --dry-run --json',
    action_execute_command: 'opl app action execute --action <action_id> --json',
    action_route_source: 'app_state.actions',
    action_execution_policy: 'operator_selected_safe_app_action_route_only',
  })) {
    if (acceptancePath[field] !== expected) {
      throw new Error(`Runtime page operator evidence acceptance ${field} must be ${expected}`);
    }
  }
  const runtimeViewModel = runtimePage.runtime_view_model;
  if (runtimeViewModel?.role !== 'opl_runtime_user_task_status') {
    throw new Error('Runtime page must declare OPL runtime user task status view model');
  }
  if (runtimeViewModel.bridge_contract !== 'contracts/app-runtime-bridge.json') {
    throw new Error(`Runtime page view model must reference app-runtime-bridge.json, got: ${runtimeViewModel.bridge_contract}`);
  }
  if (runtimeViewModel.default_mode !== 'user_task_status_first') {
    throw new Error('Runtime page view model must default to user_task_status_first');
  }
  if (runtimeViewModel.full_detail_policy !== 'on_demand_only') {
    throw new Error('Runtime page full detail must be on-demand only');
  }
  if (
    runtimeViewModel.polling_fallback?.interval_seconds_min !== 5
    || runtimeViewModel.polling_fallback?.interval_seconds_max !== 10
    || runtimeViewModel.polling_fallback?.policy !== 'lightweight_polling_until_push_projection_available'
  ) {
    throw new Error('Runtime page polling fallback must be lightweight 5-10 second polling');
  }
  for (const [field, expected] of Object.entries({
    'action_queue.source': 'app_state.actions',
    'action_queue.fallback_source': 'app_state.operator.actions',
    'action_queue.authority': 'framework_refs_only',
    'progress_delta.source': 'app_state.operator.workbench.task_drilldowns.progress_delta_classification',
    'progress_delta.authority': 'opl_framework_shared_progress_projection',
    'progress_delta.display_policy': 'classification_only_no_domain_artifact_body',
    'progress_delta.deliverable_progress_source': 'deliverable_progress_delta',
    'progress_delta.platform_repair_source': 'platform_repair_delta',
    'progress_delta.classification_source': 'progress_delta_classification',
    'progress_delta.platform_repair_display_treatment': 'separate_infrastructure_repair_not_deliverable_progress',
    primary_state_source: 'opl app state --profile fast --json',
    refresh_state_source: 'opl app state --profile fast --json',
    summary_source: 'opl runtime app-operator-drilldown --json',
    full_detail_source: 'opl runtime app-operator-drilldown --detail full --json',
    'provider_status.source': 'app_state.provider',
    'provider_status.authority': 'opl_framework',
    'authority_boundary.action_execution_owner': 'opl_framework',
    'authority_boundary.domain_verdict_owner': 'domain_agent',
  })) {
    const actual = field.split('.').reduce((value, key) => value?.[key], runtimeViewModel);
    if (actual !== expected) {
      throw new Error(`Runtime page view model ${field} must be ${expected}`);
    }
  }
  validateUserTaskStatusProjectionContract(
    runtimeViewModel.user_task_status_projection,
    'Runtime page user task status projection',
  );
  validateProjectProgressDisplayContract(runtimeViewModel.project_progress, 'Runtime page project progress display contract');
  validateStateIndexSidecarProjectionContract(
    runtimeViewModel.state_index_sidecar,
    'Runtime page State Index sidecar projection',
  );
  validateArtifactNativeDrilldownProjectionContract(
    runtimeViewModel.artifact_native_drilldown,
    'Runtime page Stage Artifact drilldown projection',
  );
  validateOpenScienceConsoleProjectionContract(
    runtimeViewModel.openscience_console_projection,
    'Runtime page OpenScience Console projection',
  );
  validateStructuredResultPanelProjectionContract(
    runtimeViewModel.structured_result_panel,
    'Runtime page structured result panel projection',
  );
  validateRefLevelFollowUpProjectionContract(
    runtimeViewModel.ref_level_follow_up,
    'Runtime page ref-level follow-up projection',
  );
  validateProviderReadinessRepairProjectionContract(
    runtimeViewModel.provider_readiness_repair,
    'Runtime page provider readiness repair projection',
  );
  const pageDefaultAttention = runtimeViewModel.default_attention;
  if (pageDefaultAttention?.mode !== 'user_task_status_first') {
    throw new Error('Runtime page default attention must be user_task_status_first');
  }
  assertDeepEqualJson(
    pageDefaultAttention?.primary_fields,
    ['running_task_count', 'active_project_count', 'queued_project_count', 'attention_count'],
    'Runtime page default attention primary fields',
  );
  assertIncludesAll(
    pageDefaultAttention?.active_project_line_fields,
    [
      'app_state.operator.workbench.summary_cards[active_projects]',
      'app_state.operator.workbench.activity_center.active_projects',
      'app_state.operator.visual_ref_groups.active_project_refs',
    ],
    'Runtime page default attention active_project_line_fields',
  );
  if (
    pageDefaultAttention?.active_project_line_policy
    !== 'queued_or_escalated_owner_handled_project_lines_count_as_user_visible_active_projects_without_claiming_active_worker_run'
  ) {
    throw new Error('Runtime page default attention must keep active project lines separate from active worker runs');
  }
  if (pageDefaultAttention?.queue_status_policy !== appOwnedQueueStatusPolicy) {
    throw new Error(`Runtime page default attention queue_status_policy must be ${appOwnedQueueStatusPolicy}`);
  }
  assertDeepEqualJson(
    pageDefaultAttention?.project_group_expansion_policy,
    appOwnedProjectGroupExpansionPolicy,
    'Runtime page default attention project_group_expansion_policy',
  );
  assertIncludesAll(
    pageDefaultAttention?.secondary_fields,
    [
      'stage elapsed or telemetry missing',
      'last heartbeat / running proof or telemetry missing',
      'current stage usage / task total usage or telemetry missing',
      'typed blocker summary / owner / resolution route',
      'agent/module status panel',
    ],
    'Runtime page default attention secondary_fields',
  );
  if (runtimeViewModel.diagnostics?.default_visibility !== 'secondary_disclosure') {
    throw new Error('Runtime page diagnostics must be secondary disclosure, not a primary daily surface');
  }
  assertIncludesAll(
    runtimeViewModel.diagnostics?.sections,
    ['operator summary', 'safe actions', 'evidence refs', 'full detail digest'],
    'Runtime page diagnostics sections',
  );
  if (runtimeViewModel.authority_boundary?.refs_only !== true) {
    throw new Error('Runtime page view model must be refs-only');
  }
  if (runtimeViewModel.authority_boundary?.non_authority_display_only !== true) {
    throw new Error('Runtime page view model must be display-only for non-authority domain refs');
  }
  validateProgressDeltaDisplayContract(runtimeViewModel.progress_delta, 'Runtime page progress delta display contract');
  const runningTaskProjection = runtimeViewModel.running_task_projection;
  if (
    runningTaskProjection?.source !== 'app_operator_drilldown.current_control_state.summary + current_control_state.states' ||
    runningTaskProjection.authority !== 'opl_framework_provider_attempt_projection' ||
    runningTaskProjection.display_policy !== 'diagnostic_only_no_provider_attempt_count_as_user_running_task_count' ||
    runningTaskProjection.active_execution_filter !==
      'states where running_provider_attempt is true and provider_run.provider_status or current_attempt_state is running' ||
    runningTaskProjection.diagnostic_provider_ref_policy !==
      'running_provider_attempt_count may include checkpointed provider refs and must not be displayed as the user-visible running task count'
  ) {
    throw new Error('Runtime page must keep provider running activity as diagnostic projection');
  }
  assertIncludesAll(
    runningTaskProjection.required_user_fields,
    [
      'current_control_state.states[].running_provider_attempt',
      'current_control_state.states[].provider_run.provider_status',
      'current_control_state.states[].current_attempt_state',
      'running_provider_attempt_count',
      'running_provider_attempt_domain_ids',
      'running_provider_attempt_task_kinds',
      'latest_running_provider_heartbeat_at',
      'running_provider_attempt_summary_policy',
    ],
    'Runtime page running task required user fields',
  );
  assertIncludesAll(
    runningTaskProjection.forbidden_sources,
    [
      'domain_lane_map active_task_count',
      'app_state.operator.workbench.task_drilldowns where active_stage_id is module_runtime',
      'app_state.modules',
      'module_runtime dirty state',
      'repo/worktree diagnostics',
      'assistant cards',
    ],
    'Runtime page running task forbidden sources',
  );
  const requiredEvidencePath = [
    'user task status first OPL runtime status',
    'running task count from framework user task projection',
    'active project count from framework project-line projection',
    'queued project count from framework project-line projection',
    'attention count from framework blocker and owner-attention projection',
    'task title/status/stage/progress label/next step/next owner/owner/accepted answer shape/artifact or blocker/last progress',
    'four-layer mental model from agent/capability to execution run',
    'stage_run_cockpit or equivalent stage_run_current_owner_delta for current stage/elapsed/heartbeat/usage when projected',
    'telemetry missing fallback when elapsed, heartbeat, or usage are absent',
    'typed blocker summary/owner/resolution route from stage_run_cockpit or artifact/blocker refs',
    'agent/module status panel from connector_readiness_refs, diagnostic_substrate_refs, and gateway_status_ref',
    'provider/current_control_state details as diagnostics only',
    'summary OPL operator drilldown read model',
    'fast App state refresh',
    'app_state.operator.workbench.task_drilldowns project progress refs',
    'app_state.operator.workbench.task_drilldowns State Index sidecar refs',
    'app_state.operator.workbench.task_drilldowns artifact-native refs',
    'app_state.operator.workbench.activity_center.active_projects active project lines',
    'app_state.operator.visual_ref_groups.active_project_refs',
    'non-running waiting or stopped projects collapsed by default',
    'blocked stays blocked; queued or waiting require explicit projected status and are not inferred from non-running',
    'full detail lazy load',
    'app_state.operator.summary refs',
    'app_state.provider readiness refs',
    'provider readiness repair path for worker_not_ready and missing Temporal Search Attributes',
    'current_owner_delta remains the default owner action while provider repair stays infrastructure-only',
    'app_state.actions safe action refs',
    'refs-only non-authority boundary',
    'safe app action dry-run',
    'safe app action execute',
    'receipt/count refresh after execute',
    'authority boundary fields',
  ];
  for (const signal of requiredEvidencePath) {
    if (!runtimePage.operator_evidence_path?.includes(signal)) {
      throw new Error(`Runtime page operator evidence path must include ${signal}`);
    }
  }
  const requiredRuntimeSignals = [
    'user task status first OPL runtime status',
    'running task count',
    'active project count',
    'queued project count',
    'attention count',
    'task title/status/stage/progress label/next step/next owner/owner/accepted answer shape/artifact or blocker/last progress',
    'four-layer mental model: agent/capability, project, task/work item, execution run',
    'current stage and stage elapsed or telemetry missing',
    'last heartbeat or running proof or telemetry missing',
    'current stage usage and task total usage or telemetry missing',
    'typed blocker summary, owner, and resolution route',
    'agent/module status as a separate panel',
    'project progress from app_state.operator.workbench.task_drilldowns',
    'active project line count from app_state.operator.workbench.activity_center.active_projects',
    'project title/domain/current state/current stage',
    'next visible step when projected',
    'blocker count and user attention status',
    'progress delta rendered as user-facing labels',
    'State Index Kernel / SQLite sidecar read-model refs',
    'artifact-native current/canonical/export/lineage/retention/conformance refs',
    'runtime diagnostics as secondary disclosure',
    'provider readiness from app_state.provider',
    'repair command for provider worker not ready',
    'repair command for missing Temporal Search Attributes',
    'provider readiness repair does not override current_owner_delta',
    'operator summary from app_state.operator',
    'safe action refs from app_state.actions',
    'non-running waiting or stopped projects collapsed by default',
    'blocked stays blocked; queued or waiting require explicit projected status and are not inferred from non-running',
    'summary OPL operator drilldown read model',
    'full detail lazy load',
    'safe app action dry-run/execute controls',
    'deliverable progress delta classification',
    'platform repair delta as separate infrastructure repair',
    'Stage Artifact Kernel refs-only drilldown',
    'State Index sidecar refs-only drilldown to Stage Folder',
    'receipt/count refresh after execute',
    'refs-only non-authority boundary',
  ];
  for (const signal of requiredRuntimeSignals) {
    if (!runtimePage.must_show.includes(signal)) {
      throw new Error(`Runtime page must show ${signal}`);
    }
  }
  assertDeepEqualJson(
    runtimePage.must_not_default_show,
    ['Temporal', 'provider', 'projection', 'ref', 'stage attempt', 'ledger', 'current_control_state'],
    'Runtime page forbidden default display terms',
  );
  const forbiddenRuntimeOwners = [
    'runtime truth',
    'provider implementation',
    'domain truth',
    'memory body',
    'artifact body',
    'domain artifact body',
    'artifact authority',
    'SQLite sidecar write authority',
    'State Index Kernel mutation authority',
    'quality/readiness/export verdict',
    'deliverable progress truth',
    'platform repair truth',
    'action route authority',
    'domain action approval override',
    'owner receipt authority',
    'family production readiness',
  ];
  for (const owner of forbiddenRuntimeOwners) {
    if (!runtimePage.must_not_own?.includes(owner)) {
      throw new Error(`Runtime page must not own ${owner}`);
    }
  }
  if (matrix.canonical_state_surface?.default_command !== 'opl app state --profile fast --json') {
    throw new Error('Page-state matrix canonical default state command must be fast App state');
  }
  if (matrix.canonical_state_surface.refresh_command !== 'opl app state --profile fast --json') {
    throw new Error('Page-state matrix canonical refresh state command must be fast App state');
  }
  if (matrix.canonical_action_surface?.command !== 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json') {
    throw new Error('Page-state matrix canonical action command must be the OPL App action execute boundary');
  }
  if (matrix.full_detail_exception?.command !== 'opl runtime app-operator-drilldown --detail full --json') {
    throw new Error('Page-state matrix full detail exception must be OPL runtime app-operator-drilldown');
  }
}
