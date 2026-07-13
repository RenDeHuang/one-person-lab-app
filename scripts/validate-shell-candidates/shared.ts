import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRepositoryRelativePath, assertStringArrayIncludes } from '../value-assertions.ts';
import type { ActiveProjectLineStateModel } from './types.ts';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const registryPath = path.join(root, 'contracts', 'app-shell-candidates.json');
export const activeAdapterPath = path.join(root, 'contracts', 'app-shell-adapter.json');
export const guiContractPath = path.join(root, 'contracts', 'app-gui-product-contract.json');
export const runtimeBridgePath = path.join(root, 'contracts', 'app-runtime-bridge.json');
export const pageStateMatrixPath = path.join(root, 'contracts', 'app-page-state-matrix.json');
export const firstRunMatrixPath = path.join(root, 'contracts', 'app-first-run-test-matrix.json');
export const requiredHomeEntries = ['research', 'grant', 'ppt'];
export const requiredCapabilities = [
  'codex_cli_fixed_executor_home',
  'codex_app_server_thread_turn_backend',
  'copilotkit_visible_ui_runtime_layer',
  'agui_internal_protocol_not_user_visible',
  'purpose_first_home_entries',
  'agui_event_contract_map',
  'app_server_event_to_agui_stream_mapping',
  'workspace_directory_picker',
  'new_conversation_thread_reset',
  'pixel_visible_ui_smoke',
  'source_renderer_build',
  'source_ui_smoke',
  'packaged_ui_smoke',
  'webui_shared_renderer',
  'web_transport_bridge',
  'webui_smoke',
  'chat_first_codex_app_surface',
  'default_context_collapsed_chat_first_home',
  'lightweight_workspace_session_rail',
  'collapsible_contextual_tabs',
  'app_product_profile_mapping',
  'opl_app_state_bridge',
  'active_project_line_state_model',
  'opl_app_action_bridge',
  'page_state_matrix_mapping',
  'first_run_matrix_mapping',
  'runtime_summary_detail_action_bridge',
  'foundry_agent_series_shared_progress_display',
  'app_owned_settings_information_architecture',
  'secondary_runtime_context_refs',
  'conversation_event_ref_rendering',
  'webui_renderer_parity',
  'release_isolation',
  'candidate_app_bundle_package',
];
export const requiredNativeCapabilities = [
  'codex_cli_fixed_executor_home',
  'codex_app_server_thread_turn_backend',
  'native_react_workbench_renderer',
  'opl_app_event_contract_map',
  'purpose_first_home_entries',
  'workspace_directory_picker',
  'new_conversation_thread_reset',
  'source_renderer_build',
  'source_ui_smoke',
  'packaged_ui_smoke',
  'webui_shared_renderer',
  'web_transport_bridge',
  'webui_smoke',
  'chat_first_codex_app_surface',
  'results_and_delivery_first_presentation',
  'default_context_collapsed_chat_first_home',
  'lightweight_workspace_session_rail',
  'collapsible_contextual_tabs',
  'app_product_profile_mapping',
  'opl_app_state_bridge',
  'active_project_line_state_model',
  'opl_app_action_bridge',
  'page_state_matrix_mapping',
  'first_run_matrix_mapping',
  'runtime_summary_detail_action_bridge',
  'foundry_agent_series_shared_progress_display',
  'app_owned_settings_information_architecture',
  'secondary_runtime_context_refs',
  'conversation_event_ref_rendering',
  'webui_renderer_parity',
  'typed_cross_top_level_thread_host_bridge',
  'client_executed_dynamic_tools_coordination_bridge',
  'local_cross_thread_p0_p1',
  'thread_list_read_resume_fork_archive_unarchive',
  'turn_start_steer_with_host_queue',
  'cross_thread_safety_gates',
  'bilateral_coordination_receipts',
  'desktop_webui_coordination_parity',
  'remote_host_aggregation_p2_deferred',
  'release_isolation',
  'candidate_app_bundle_package',
];
export const requiredSettingsTabs = ['general', 'access', 'capabilities', 'environment', 'storage', 'appearance', 'advanced'];
export const forbiddenLegacySettingsTabs = [
  'overview',
  'runtime',
  'system',
  'model',
  'agent',
  'assistants',
  'skills-hub',
  'tools',
  'display',
  'webui',
  'pet',
];
export const requiredActivityGroups = ['needs_attention', 'active_projects', 'recent_projects'];
export const requiredConversationEventKinds = ['tool', 'process', 'diff', 'file', 'receipt', 'user_input', 'permission'];
export const requiredContextSurfaces = [
  'chat-first main canvas',
  'lightweight workspace/session rail',
  'right-side collapsible inspector tabs',
  'Files context tab',
  'Skills context tab',
  'Routing context tab',
  'Memory context tab',
  'Always-On context tab',
];
export const requiredContextTestIds = [
  'opl-workspace-rail',
  'opl-session-list',
  'opl-context-tabs',
  'opl-files-panel',
  'opl-skills-panel',
  'opl-routing-panel',
  'opl-memory-panel',
  'opl-always-on-panel',
  'opl-web-transport',
];
export const forbiddenAuthority = [
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
export const expectedFrameworkSurfaces: Record<string, string> = {
  state: 'opl app state --profile fast --json',
  refresh: 'opl app state --profile fast --json',
  full_state: 'opl app state --profile full --json',
  full_drilldown: 'opl runtime app-operator-drilldown --detail full --json',
  action: 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
};
export const requiredSeriesProgressFields = [
  'progress_delta_classification',
  'deliverable_progress_delta',
  'platform_repair_delta',
  'next_forced_delta',
];
const requiredActiveProjectLineFields = [
  'status',
  'active_run_id',
  'next_visible_step',
  ...requiredSeriesProgressFields,
];
const forbiddenStateModelClaims = [
  'domain_ready',
  'production_ready',
  'clean_vm_ready',
  'full_release_ready',
  'active_shell_adopted',
];
export const forbiddenSeriesDomainFields = [
  'domain_body',
  'artifact_body',
  'memory_body',
  'quality_verdict',
  'export_verdict',
];

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function assertFile(filePath: string, label: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${path.relative(root, filePath)}`);
  }
}

export function assertDirectory(filePath: string, label: string): void {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isDirectory()) {
    throw new Error(`Missing ${label} directory: ${path.relative(root, filePath)}`);
  }
}

export function assertRelativePath(value: unknown, label: string): asserts value is string {
  assertRepositoryRelativePath(value, {
    empty: `${label} must be a non-empty relative path`,
    unsafe: `${label} must stay relative to the candidate shell root`,
  });
}

export function findMacAppExecutable(macOsDir: string, candidateId: string): string {
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

export function assertNoAbsoluteSymlinks(directoryPath: string, candidateId: string): void {
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

export { assertStringArrayIncludes };


export function validateActiveProjectLineStateModel(stateModel: ActiveProjectLineStateModel | undefined, label: string): void {
  if (!stateModel) {
    throw new Error(`${label} must declare active project line state-model consumption`);
  }
  if (stateModel.authority !== 'opl_framework_active_project_line_projection') {
    throw new Error(`${label}.authority must be opl_framework_active_project_line_projection`);
  }
  if (stateModel.validation_command !== 'npm run validate:state-model') {
    throw new Error(`${label}.validation_command must be npm run validate:state-model`);
  }
  if (stateModel.consumed_projection !== 'opl app state --profile fast --json active_project_lines') {
    throw new Error(`${label}.consumed_projection must be opl app state --profile fast --json active_project_lines`);
  }
  assertStringArrayIncludes(stateModel.required_fields, requiredActiveProjectLineFields, `${label}.required_fields`);
  assertStringArrayIncludes(stateModel.forbidden_claims, forbiddenStateModelClaims, `${label}.forbidden_claims`);
}
