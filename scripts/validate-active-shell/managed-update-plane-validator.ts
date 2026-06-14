import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';

const managedUpdateMustShow = [
  'App binary standard updater status',
  'runtime/toolchain managed updater status',
  'agent package channel managed updater status',
  'capability exposure sync status',
  'conditions and repair actions from App state or opl update status',
];

const managedUpdateMustNotShow = [
  'Full first-install asset as a standard updater target',
  'Developer Profile checkout as a silent update target',
  'dirty checkout overwrite as a repair action',
  'domain truth write controls',
  'owner receipt mutation controls',
  'quality/export verdict controls',
  'Homebrew/global tool silent upgrade controls',
  'artifact bodies',
];

export const managedUpdateIpcSurfaces = [
  'opl-runtime.get-managed-update-status',
  'opl-runtime.get-managed-update-check',
  'opl-runtime.get-managed-update-plan',
  'opl-runtime.run-managed-update-apply',
  'opl-runtime.run-managed-update-repair',
  'opl-runtime.run-managed-update-rollback',
];

const managedUpdateBackgroundFields = [
  'last_run_at',
  'next_run_at',
  'last_failure',
  'idempotency_lock.status',
  'execution.status',
  'recent_actions',
  'skipped_reasons',
  'reload_guidance',
];

const managedUpdateScheduler = {
  triggers: ['app_startup_after_core_ready', 'daily_background_maintenance', 'manual_check_updates'],
  lock_source: 'managed_update.idempotency_lock.status',
  backoff_policy: 'bounded_retry_with_last_failure_projection',
  user_blocking: false,
  must_project_last_run_and_next_run: true,
  auto_apply_policy: 'auto_apply_clean_managed_agent_package_and_capability_exposure_only',
  auto_apply_components: ['agent_package_channel', 'capability_exposure'],
  never_auto_apply_components: ['app_binary', 'runtime_toolchain'],
  must_project_recent_actions_and_skip_reasons: true,
};

const managedUpdateUiActions = {
  refresh: 'opl update status --json',
  check: 'opl update check --json',
  plan: 'opl update plan --json',
  apply_component: 'opl update apply --component <component_id> --json',
  repair_receipt: 'opl update repair --receipt <receipt_id> --json',
  rollback_component: 'opl update rollback --component <component_id> --json',
};

const managedUpdateSections = ['app_binary', 'runtime_toolchain', 'agent_packages', 'capability_exposure'];
const managedUpdateDisplayPlanes = ['app_binary', 'runtime_toolchain', 'agent_package_channel', 'capability_exposure'];
const managedUpdateStateSources = ['opl app state --profile fast --json#managed_update_plane', 'opl update status --json'];
const managedUpdateStatusConsumptionPolicy =
  'show status, conditions, progress refs, and repair action refs without reading artifact bodies or writing runtime/domain truth';

export function validateManagedUpdatePageBasics(page, label, options = {}) {
  if (options.requirePageContract && page?.page_contract !== 'updates_and_maintenance') {
    throw new Error(`${label} page_contract must be updates_and_maintenance`);
  }
  if (page?.status_source !== 'opl update status --json') {
    throw new Error(`${label} must expose opl update status --json as the explicit status source`);
  }
  if (page?.action_source !== 'opl update apply/repair/rollback --json through shell IPC') {
    throw new Error(options.actionSourceError ?? `${label} must expose managed update actions through shell IPC`);
  }
  assertDeepEqualJson(
    page?.background_maintenance_status_fields,
    managedUpdateBackgroundFields,
    `${label} background maintenance status fields`,
  );
  assertDeepEqualJson(page?.sections, managedUpdateSections, `${label} sections`);
  assertIncludesAll(page?.must_show, managedUpdateMustShow, `${label} must_show`);
  assertIncludesAll(page?.must_not_show, managedUpdateMustNotShow, `${label} must_not_show`);
}

export function validateManagedUpdatePlaneBinding(plane, label, options = {}) {
  if (
    (options.requirePageId && plane?.page_id !== 'updates_and_maintenance') ||
    plane?.source_ref !== 'contracts/app-release-channel.json#managed_update_plane' ||
    plane?.app_role !== 'status_conditions_repair_actions_consumer_only' ||
    plane?.framework_role !== 'managed_update_kernel_owner' ||
    (options.requireStatusConsumptionPolicy && plane?.status_consumption_policy !== managedUpdateStatusConsumptionPolicy)
  ) {
    throw new Error(options.bindingError ?? `${label} must bind to the App managed update plane`);
  }
  if (options.requireStateSources) {
    assertDeepEqualJson(plane?.state_sources, managedUpdateStateSources, `${label} state sources`);
  }
  assertDeepEqualJson(plane?.display_planes, managedUpdateDisplayPlanes, `${label} display planes`);
  assertDeepEqualJson(plane?.background_scheduler, managedUpdateScheduler, `${label} background scheduler`);
  assertDeepEqualJson(plane?.ui_actions, managedUpdateUiActions, `${label} UI actions`);
  assertDeepEqualJson(plane?.ipc_bridge_required, managedUpdateIpcSurfaces, `${label} IPC bridge`);
}
