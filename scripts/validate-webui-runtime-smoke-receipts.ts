#!/usr/bin/env node

import fs from 'node:fs';
import { parseArgs as parseNodeArgs } from 'node:util';
import { asRecord, readJsonFile } from './release-json-helpers.ts';
import { assertExpectedFields, assertStringArrayIncludes } from './value-assertions.ts';

type Args = {
  startupMaintenancePath: string;
  updateStatusPath: string;
  installManifestPath: string;
  summaryPath?: string;
};

const requiredSeedComponents = ['opl_framework', 'codex_cli', 'companion_skills', 'domain_modules'];
const requiredMigrationComponents = ['data_dir', 'projects_dir'];
const requiredManagedUpdateComponents = [
  'installation_carrier',
  'runtime_substrate',
  'capability_packages',
  'codex_surface',
  'companion_tools',
];

function parseArgs(): Args {
  const { values } = parseNodeArgs({
    args: process.argv.slice(2),
    options: {
      'startup-maintenance': { type: 'string' },
      'update-status': { type: 'string' },
      'install-manifest': { type: 'string' },
      'summary-path': { type: 'string' },
    } as const,
    allowPositionals: false,
    strict: true,
  });
  const args: Args = {
    startupMaintenancePath: values['startup-maintenance'] ?? '',
    updateStatusPath: values['update-status'] ?? '',
    installManifestPath: values['install-manifest'] ?? '',
    summaryPath: values['summary-path'],
  };
  for (const [field, value] of Object.entries({
    startupMaintenancePath: args.startupMaintenancePath,
    updateStatusPath: args.updateStatusPath,
    installManifestPath: args.installManifestPath,
  })) {
    if (!value) {
      throw new Error(`Missing required option for ${field}`);
    }
  }
  return args;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value;
}

function unwrapProxyEnvelope(value: unknown, label: string): Record<string, unknown> {
  const envelope = asRecord(value, `${label} proxy response`);
  assertExpectedFields([{ actual: envelope.success, expected: true }], `${label} proxy success must be true`);
  const data = asRecord(envelope.data, `${label} proxy data`);
  requireString(data.command, `${label} command`);
  if (typeof data.parsed !== 'undefined' && data.parsed !== null) {
    return asRecord(data.parsed, `${label} parsed payload`);
  }
  const stdout = requireString(data.stdout, `${label} stdout`);
  return asRecord(JSON.parse(stdout), `${label} parsed stdout payload`);
}

function validateReceiptFields(receipt: Record<string, unknown>, label: string) {
  assertExpectedFields([{ actual: receipt.status, expected: 'completed' }], `${label} status must be completed`);
  requireString(receipt.operation, `${label} operation`);
  requireString(receipt.component_id, `${label} component_id`);
  requireString(receipt.receipt_ref, `${label} receipt_ref`);
  requireString(receipt.receipt_kind, `${label} receipt_kind`);
}

function validateInstallManifest(installManifest: Record<string, unknown>) {
  assertExpectedFields(
    [
      { actual: installManifest.surface_kind, expected: 'opl_seed_install_manifest' },
      { actual: installManifest.schema_version, expected: 'opl_seed_install_manifest.v1' },
      { actual: installManifest.status, expected: 'applied' },
    ],
    'Install manifest identity and status must match the applied seed install contract.',
  );

  const image = asRecord(installManifest.image, 'install manifest image');
  assertExpectedFields(
    [
      { actual: image.seed_strategy_status, expected: 'accepted' },
      { actual: image.seed_strategy, expected: 'payload_manifest' },
    ],
    'Install manifest image seed strategy must be accepted payload_manifest.',
  );
  const imageManifest = asRecord(image.manifest, 'install manifest image.manifest');
  assertExpectedFields(
    [
      { actual: imageManifest.image_profile, expected: 'webui-full' },
      { actual: imageManifest.data_dir, expected: '/data' },
      { actual: imageManifest.projects_dir, expected: '/projects' },
    ],
    'Install manifest image profile and runtime paths must match webui-full.',
  );

  const seedMetadata = asRecord(installManifest.seed_metadata, 'install manifest seed_metadata');
  assertExpectedFields(
    [{ actual: seedMetadata.metadata_status, expected: 'found' }],
    'Install manifest seed metadata status must be found.',
  );
  const seedManifest = asRecord(seedMetadata.manifest, 'install manifest seed metadata manifest');
  assertExpectedFields(
    [
      { actual: seedManifest.strategy, expected: 'payload_preheated' },
      { actual: seedManifest.data_dir, expected: '/data' },
      { actual: seedManifest.projects_dir, expected: '/projects' },
    ],
    'Install manifest seed metadata strategy and runtime paths must match payload_preheated.',
  );

  const install = asRecord(installManifest.install, 'install manifest install');
  assertExpectedFields(
    [
      { actual: install.data_dir, expected: '/data' },
      { actual: install.projects_dir, expected: '/projects' },
    ],
    'Install manifest install paths must match /data and /projects.',
  );
  requireString(install.manifest_file, 'install manifest install manifest_file');

  const components = requireArray(installManifest.components, 'install manifest components').map((item) =>
    asRecord(item, 'install manifest component')
  );
  const componentIds = new Set(components.map((component) => requireString(component.component_id, 'component id')));
  assertStringArrayIncludes(
    [...componentIds],
    [...requiredSeedComponents, ...requiredMigrationComponents],
    'install manifest components',
  );

  for (const id of requiredSeedComponents) {
    const component = components.find((item) => item.component_id === id);
    if (!component) throw new Error(`missing seed component ${id}`);
    assertExpectedFields(
      [
        { actual: component.state, expected: 'current' },
        { actual: component.component_kind, expected: 'image_seed' },
      ],
      `seed component ${id} state and kind must match image_seed current`,
    );
    requireString(component.payload_path, `seed component ${id} payload_path`);
    requireString(component.materialized_path, `seed component ${id} materialized_path`);
    requireString(component.receipt_ref, `seed component ${id} receipt_ref`);
    requireString(component.receipt_kind, `seed component ${id} receipt_kind`);
    if (typeof component.sha256 !== 'string' && typeof component.source_fingerprint !== 'string') {
      throw new Error(`seed component ${id} must carry sha256 or source_fingerprint`);
    }
  }

  for (const id of requiredMigrationComponents) {
    const component = components.find((item) => item.component_id === id);
    if (!component) throw new Error(`missing migration component ${id}`);
    assertExpectedFields(
      [
        { actual: component.state, expected: 'current' },
        { actual: component.component_kind, expected: 'migration' },
      ],
      `migration component ${id} state and kind must match migration current`,
    );
    requireString(component.materialized_path, `migration component ${id} materialized_path`);
    requireString(component.receipt_ref, `migration component ${id} receipt_ref`);
    requireString(component.receipt_kind, `migration component ${id} receipt_kind`);
  }

  const receipts = requireArray(installManifest.receipts, 'install manifest receipts').map((item) =>
    asRecord(item, 'install manifest receipt')
  );
  const receiptComponentIds = new Set(receipts.map((receipt) => requireString(receipt.component_id, 'receipt component id')));
  assertStringArrayIncludes(
    [...receiptComponentIds],
    [...requiredSeedComponents, ...requiredMigrationComponents],
    'install manifest receipts',
  );
  for (const receipt of receipts) {
    validateReceiptFields(receipt, `install manifest receipt ${String(receipt.component_id)}`);
  }

  const reconcile = asRecord(installManifest.reconcile, 'install manifest reconcile');
  assertExpectedFields([{ actual: reconcile.status, expected: 'applied' }], 'install manifest reconcile status must be applied');
  if (Number(reconcile.image_seed_receipts_count) < requiredSeedComponents.length + 1) {
    throw new Error('install manifest reconcile image_seed_receipts_count is too low.');
  }
  if (Number(reconcile.migration_receipts_count) < requiredMigrationComponents.length) {
    throw new Error('install manifest reconcile migration_receipts_count is too low.');
  }
}

function validateStartupMaintenance(payload: Record<string, unknown>) {
  assertExpectedFields([{ actual: payload.version, expected: 'g2' }], 'startup maintenance version must be g2');
  const action = asRecord(payload.system_action, 'startup maintenance system_action');
  assertExpectedFields([{ actual: action.action, expected: 'startup_maintenance' }], 'startup maintenance action must be startup_maintenance');
  const actionStatus = requireString(action.status, 'startup maintenance status');
  if (actionStatus !== 'completed' && actionStatus !== 'manual_required') {
    throw new Error(`startup maintenance status must be "completed" or "manual_required", got ${JSON.stringify(actionStatus)}`);
  }
  const workspaceRoot = asRecord(action.workspace_root, 'startup maintenance workspace_root');
  assertExpectedFields(
    [
      { actual: workspaceRoot.selected_path, expected: '/projects' },
      { actual: workspaceRoot.health_status, expected: 'ready' },
    ],
    'startup maintenance workspace root must be ready at /projects',
  );
  const details = asRecord(action.details, 'startup maintenance details');
  assertExpectedFields(
    [{ actual: details.surface_kind, expected: 'opl_app_startup_maintenance' }],
    'startup maintenance surface_kind must be opl_app_startup_maintenance',
  );
  const summary = asRecord(details.summary, 'startup maintenance summary');
  if (Number(summary.total_targets_count) <= 0) {
    throw new Error('startup maintenance summary must include at least one target.');
  }
  const seedBoundary = asRecord(details.seed_boundary, 'startup maintenance seed_boundary');
  assertExpectedFields(
    [{ actual: seedBoundary.surface_kind, expected: 'opl_seed_install_manifest' }],
    'startup maintenance seed boundary kind must be opl_seed_install_manifest',
  );
  const seedInstall = asRecord(seedBoundary.install, 'startup maintenance seed_boundary.install');
  assertExpectedFields(
    [
      { actual: seedInstall.data_dir, expected: '/data' },
      { actual: seedInstall.projects_dir, expected: '/projects' },
    ],
    'startup maintenance seed install paths must match /data and /projects',
  );
  requireString(seedInstall.manifest_file, 'startup maintenance seed install manifest_file');

  if (actionStatus === 'manual_required') {
    const frameworkTargets = requireArray(details.framework_targets, 'startup maintenance framework_targets').map((item) =>
      asRecord(item, 'startup maintenance framework target')
    );
    const manualFrameworkTarget = frameworkTargets.find((target) => target.status === 'manual_required');
    if (!manualFrameworkTarget) {
      throw new Error('startup maintenance manual_required must include a manual_required framework target.');
    }
    assertExpectedFields(
      [{ actual: manualFrameworkTarget.reason, expected: 'framework_update_target_invalid' }],
      'startup maintenance manual framework target reason must be framework_update_target_invalid',
    );
  }
}

function validateRuntimeSubstrateFrameworkUpdate(component: Record<string, unknown>) {
  if (component.component_id !== 'runtime_substrate') return;
  if (typeof component.current === 'undefined' || component.current === null) return;
  const current = asRecord(component.current, 'runtime_substrate current');
  if (typeof current.opl_framework_runtime === 'undefined' || current.opl_framework_runtime === null) return;
  const frameworkRuntime = asRecord(current.opl_framework_runtime, 'runtime_substrate opl_framework_runtime');
  if (frameworkRuntime.update_available !== true) return;
  requireString(frameworkRuntime.channel_artifact, 'runtime_substrate framework channel_artifact');
  requireString(frameworkRuntime.channel_version, 'runtime_substrate framework channel_version');
  requireString(frameworkRuntime.channel_source_archive_sha256, 'runtime_substrate framework channel_source_archive_sha256');
  assertExpectedFields(
    [
      { actual: frameworkRuntime.command_ref, expected: 'opl update apply --json' },
      { actual: frameworkRuntime.rollback_command_ref, expected: 'opl update rollback --json' },
    ],
    'runtime_substrate framework update and rollback command refs must match managed updater commands',
  );
}

function validateUpdateStatus(payload: Record<string, unknown>) {
  assertExpectedFields([{ actual: payload.version, expected: 'g2' }], 'update status version must be g2');
  const managedUpdate = asRecord(payload.managed_update, 'managed update');
  assertExpectedFields(
    [
      { actual: managedUpdate.surface_id, expected: 'opl_managed_updater_kernel' },
      { actual: managedUpdate.operation, expected: 'status' },
      { actual: managedUpdate.operation_mode, expected: 'read_only_projection' },
    ],
    'managed update status projection identity must match the updater kernel contract',
  );
  const workspaceRoot = asRecord(managedUpdate.workspace_root, 'managed update workspace_root');
  assertExpectedFields(
    [
      { actual: workspaceRoot.selected_path, expected: '/projects' },
      { actual: workspaceRoot.health_status, expected: 'ready' },
    ],
    'managed update workspace root must be ready at /projects',
  );
  assertStringArrayIncludes(
    managedUpdate.lifecycle,
    ['read_manifest', 'verify', 'activate', 'write_receipt', 'report_status_or_repair'],
    'managed update lifecycle',
  );
  const components = requireArray(managedUpdate.components, 'managed update components').map((item) =>
    asRecord(item, 'managed update component')
  );
  const componentIds = new Set(components.map((component) => requireString(component.component_id, 'managed update component id')));
  assertStringArrayIncludes([...componentIds], requiredManagedUpdateComponents, 'managed update components');
  for (const component of components) {
    const id = requireString(component.component_id, 'managed update component id');
    requireString(component.state, `managed update component ${id} state`);
    const receipt = asRecord(component.receipt, `managed update component ${id} receipt`);
    assertExpectedFields(
      [{ actual: receipt.schema_version, expected: 'opl_managed_update_component_receipt.v1' }],
      `managed update component ${id} receipt schema must be opl_managed_update_component_receipt.v1`,
    );
    assertExpectedFields(
      [{ actual: receipt.required, expected: true }],
      `managed update component ${id} receipt required must be true`,
    );
    requireString(receipt.source_manifest_ref, `managed update component ${id} source_manifest_ref`);
    requireString(receipt.verify_result, `managed update component ${id} verify_result`);
    requireString(receipt.apply_mode, `managed update component ${id} apply_mode`);
    requireArray(receipt.content_identity_fields, `managed update component ${id} content_identity_fields`);
    asRecord(receipt.status_detail, `managed update component ${id} receipt status_detail`);
    asRecord(receipt.reload_guidance, `managed update component ${id} receipt reload_guidance`);
    validateRuntimeSubstrateFrameworkUpdate(component);
  }
  const receipts = asRecord(managedUpdate.receipts, 'managed update receipts');
  assertExpectedFields(
    [{ actual: receipts.component_receipt_schema, expected: 'opl_managed_update_component_receipt.v1' }],
    'managed update receipt schema must be opl_managed_update_component_receipt.v1',
  );
  requireString(receipts.component_receipt_ledger_file, 'managed update receipt ledger file');
  assertStringArrayIncludes(
    receipts.required_fields,
    ['source_manifest_ref', 'verify_result', 'apply_mode', 'status_detail', 'reload_guidance'],
    'managed update receipt required_fields',
  );
}

const args = parseArgs();
const startupMaintenance = unwrapProxyEnvelope(readJsonFile(args.startupMaintenancePath), 'startup maintenance');
const updateStatus = unwrapProxyEnvelope(readJsonFile(args.updateStatusPath), 'update status');
const installManifest = asRecord(readJsonFile(args.installManifestPath), 'install manifest');

validateInstallManifest(installManifest);
validateStartupMaintenance(startupMaintenance);
validateUpdateStatus(updateStatus);

const summary = {
  status: 'passed',
  install_manifest_schema: installManifest.schema_version,
  seed_components: requiredSeedComponents,
  migration_components: requiredMigrationComponents,
  managed_update_components: requiredManagedUpdateComponents,
  startup_maintenance_surface: asRecord(
    asRecord(startupMaintenance.system_action, 'startup maintenance system_action').details,
    'startup maintenance details',
  ).surface_kind,
  managed_update_surface: asRecord(updateStatus.managed_update, 'managed update').surface_id,
};

if (args.summaryPath) {
  fs.writeFileSync(args.summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
}
console.log(JSON.stringify(summary));
