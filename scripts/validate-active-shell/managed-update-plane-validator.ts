import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  managedUpdateActionSource,
  managedUpdateBackgroundFields,
  managedUpdateDisplayPlanes,
  managedUpdateIpcSurfaces,
  managedUpdateMustNotShow,
  managedUpdateMustShow,
  managedUpdateScheduler,
  managedUpdateSections,
  managedUpdateStateSources,
  managedUpdateStatusConsumptionPolicy,
} from './managed-update-plane-policy.ts';

export { managedUpdateIpcSurfaces } from './managed-update-plane-policy.ts';

const softwareLifecycleRef = 'contracts/app-release-channel.json#managed_update_plane.software_lifecycle';
const managedUpdateStatusSources = [
  'opl app state --profile fast --json#managed_update',
  'opl update status --json#managed_update',
];
const oplPackagesProjectionStatusSource = 'managed_update.components[opl_packages].projection_status';
const manualActionMapping = {
  refresh: 'opl update status --json',
  check: 'opl update check --json',
  plan: 'opl update plan --json',
  bootstrap_missing_opl_base: 'opl-install.sh --headless --skip-modules',
  update_opl_app: 'standard_updater_or_carrier_host_update_route',
  install_opl_package: 'opl packages install ... --json',
  update_opl_package: 'opl packages update ... --json',
  optimize_opl_flow: 'opl packages optimize opl-flow --json',
  repair_opl_package: 'opl packages repair --package-id <package_id> --json',
  uninstall_opl_package: 'opl packages uninstall --package-id <package_id> --json',
};

export function validateManagedUpdatePageBasics(page, label, options = {}) {
  if (options.requirePageContract && page?.page_contract !== 'updates_and_maintenance') {
    throw new Error(`${label} page_contract must be updates_and_maintenance`);
  }
  if (page?.status_source !== 'opl update status --json') {
    throw new Error(`${label} must expose opl update status --json as the explicit status source`);
  }
  if (page?.action_source !== managedUpdateActionSource) {
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

export function validateEnvironmentModuleMaintenanceEntry(entry, label) {
  if (
    entry?.placement !== 'Local Environment' ||
    entry?.app_role !== 'managed_update_status_action_consumer_only' ||
    entry?.kernel_implementation_allowed !== false ||
    entry?.domain_truth_write_allowed !== false ||
    entry?.owner_receipt_write_allowed !== false ||
    entry?.developer_checkout_silent_update_allowed !== false ||
    entry?.dirty_checkout_silent_update_allowed !== false
  ) {
    throw new Error(`${label} module maintenance entry must stay under Local Environment as a consumer-only lifecycle surface`);
  }
  assertDeepEqualJson(entry?.status_sources, managedUpdateStatusSources, `${label} lifecycle status sources`);
  assertIncludesAll(
    entry?.state_inputs,
    [oplPackagesProjectionStatusSource],
    `${label} OPL Packages projection status source`,
  );
  assertIncludesAll(
    entry?.required_modules,
    ['MAS', 'MAG', 'RCA', 'OMA', 'OBF', 'MAS Scholar Skills'],
    `${label} module maintenance modules`,
  );
  assertIncludesAll(
    entry?.required_status,
    [
      'OPL Packages state and Codex Surface substatus',
      'recommended action',
      'post-update sync status',
      'repair and rollback refs',
    ],
    `${label} module maintenance status`,
  );
  assertDeepEqualJson(entry?.manual_action_mapping, manualActionMapping, `${label} module maintenance action mapping`);
}

export function validateManagedUpdatePlaneBinding(plane, label, options = {}) {
  if (
    (options.requirePageId && plane?.page_id !== 'updates_and_maintenance') ||
    plane?.source_ref !== softwareLifecycleRef ||
    plane?.app_role !== 'opl_app_self_update_owner_and_base_packages_status_action_consumer' ||
    plane?.framework_role !== 'opl_base_and_opl_packages_lifecycle_owner' ||
    (options.requireStatusConsumptionPolicy && plane?.status_consumption_policy !== managedUpdateStatusConsumptionPolicy)
  ) {
    throw new Error(options.bindingError ?? `${label} must bind to the three-object App software lifecycle`);
  }
  if (options.requireStateSources) {
    assertDeepEqualJson(plane?.state_sources, managedUpdateStateSources, `${label} state sources`);
  }
  assertDeepEqualJson(plane?.display_planes, managedUpdateDisplayPlanes, `${label} software objects`);
  assertDeepEqualJson(plane?.background_scheduler, managedUpdateScheduler, `${label} background scheduler`);
  assertDeepEqualJson(plane?.ui_actions, manualActionMapping, `${label} UI actions`);
  assertDeepEqualJson(plane?.ipc_bridge_required, managedUpdateIpcSurfaces, `${label} IPC bridge`);
}
