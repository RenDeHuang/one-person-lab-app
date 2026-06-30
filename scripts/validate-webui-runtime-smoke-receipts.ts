#!/usr/bin/env node

import fs from 'node:fs';
import { applyStringOptionArg } from './cli-option-args.ts';
import { asRecord, readJsonFile } from './release-json-helpers.ts';

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
  const args: Args = {
    startupMaintenancePath: '',
    updateStatusPath: '',
    installManifestPath: '',
  };
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 1) {
    const consumed = applyStringOptionArg(argv, index, {
      '--startup-maintenance': (value) => {
        args.startupMaintenancePath = value;
      },
      '--update-status': (value) => {
        args.updateStatusPath = value;
      },
      '--install-manifest': (value) => {
        args.installManifestPath = value;
      },
      '--summary-path': (value) => {
        args.summaryPath = value;
      },
    });
    if (consumed !== null) {
      index = consumed;
      continue;
    }
    throw new Error(`Unknown option: ${argv[index]}`);
  }
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

function requireEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label} must be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
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
  requireEqual(envelope.success, true, `${label} proxy success`);
  const data = asRecord(envelope.data, `${label} proxy data`);
  requireString(data.command, `${label} command`);
  if (typeof data.parsed !== 'undefined' && data.parsed !== null) {
    return asRecord(data.parsed, `${label} parsed payload`);
  }
  const stdout = requireString(data.stdout, `${label} stdout`);
  return asRecord(JSON.parse(stdout), `${label} parsed stdout payload`);
}

function validateReceiptFields(receipt: Record<string, unknown>, label: string) {
  requireEqual(receipt.status, 'completed', `${label} status`);
  requireString(receipt.operation, `${label} operation`);
  requireString(receipt.component_id, `${label} component_id`);
  requireString(receipt.receipt_ref, `${label} receipt_ref`);
  requireString(receipt.receipt_kind, `${label} receipt_kind`);
}

function validateInstallManifest(installManifest: Record<string, unknown>) {
  requireEqual(installManifest.surface_kind, 'opl_seed_install_manifest', 'install manifest surface_kind');
  requireEqual(installManifest.schema_version, 'opl_seed_install_manifest.v1', 'install manifest schema_version');
  requireEqual(installManifest.status, 'applied', 'install manifest status');

  const image = asRecord(installManifest.image, 'install manifest image');
  requireEqual(image.seed_strategy_status, 'accepted', 'install manifest image seed_strategy_status');
  requireEqual(image.seed_strategy, 'payload_manifest', 'install manifest image seed_strategy');
  const imageManifest = asRecord(image.manifest, 'install manifest image.manifest');
  requireEqual(imageManifest.image_profile, 'webui-full', 'install manifest image profile');
  requireEqual(imageManifest.data_dir, '/data', 'install manifest image data_dir');
  requireEqual(imageManifest.projects_dir, '/projects', 'install manifest image projects_dir');

  const seedMetadata = asRecord(installManifest.seed_metadata, 'install manifest seed_metadata');
  requireEqual(seedMetadata.metadata_status, 'found', 'install manifest seed metadata status');
  const seedManifest = asRecord(seedMetadata.manifest, 'install manifest seed metadata manifest');
  requireEqual(seedManifest.strategy, 'payload_preheated', 'install manifest seed metadata strategy');
  requireEqual(seedManifest.data_dir, '/data', 'install manifest seed metadata data_dir');
  requireEqual(seedManifest.projects_dir, '/projects', 'install manifest seed metadata projects_dir');

  const install = asRecord(installManifest.install, 'install manifest install');
  requireEqual(install.data_dir, '/data', 'install manifest install data_dir');
  requireEqual(install.projects_dir, '/projects', 'install manifest install projects_dir');
  requireString(install.manifest_file, 'install manifest install manifest_file');

  const components = requireArray(installManifest.components, 'install manifest components').map((item) =>
    asRecord(item, 'install manifest component')
  );
  const componentIds = new Set(components.map((component) => requireString(component.component_id, 'component id')));
  for (const id of [...requiredSeedComponents, ...requiredMigrationComponents]) {
    if (!componentIds.has(id)) {
      throw new Error(`install manifest components must include ${id}`);
    }
  }

  for (const id of requiredSeedComponents) {
    const component = components.find((item) => item.component_id === id);
    if (!component) throw new Error(`missing seed component ${id}`);
    requireEqual(component.state, 'current', `seed component ${id} state`);
    requireEqual(component.component_kind, 'image_seed', `seed component ${id} kind`);
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
    requireEqual(component.state, 'current', `migration component ${id} state`);
    requireEqual(component.component_kind, 'migration', `migration component ${id} kind`);
    requireString(component.materialized_path, `migration component ${id} materialized_path`);
    requireString(component.receipt_ref, `migration component ${id} receipt_ref`);
    requireString(component.receipt_kind, `migration component ${id} receipt_kind`);
  }

  const receipts = requireArray(installManifest.receipts, 'install manifest receipts').map((item) =>
    asRecord(item, 'install manifest receipt')
  );
  const receiptComponentIds = new Set(receipts.map((receipt) => requireString(receipt.component_id, 'receipt component id')));
  for (const id of [...requiredSeedComponents, ...requiredMigrationComponents]) {
    if (!receiptComponentIds.has(id)) {
      throw new Error(`install manifest receipts must include ${id}`);
    }
  }
  for (const receipt of receipts) {
    validateReceiptFields(receipt, `install manifest receipt ${String(receipt.component_id)}`);
  }

  const reconcile = asRecord(installManifest.reconcile, 'install manifest reconcile');
  requireEqual(reconcile.status, 'applied', 'install manifest reconcile status');
  if (Number(reconcile.image_seed_receipts_count) < requiredSeedComponents.length + 1) {
    throw new Error('install manifest reconcile image_seed_receipts_count is too low.');
  }
  if (Number(reconcile.migration_receipts_count) < requiredMigrationComponents.length) {
    throw new Error('install manifest reconcile migration_receipts_count is too low.');
  }
}

function validateStartupMaintenance(payload: Record<string, unknown>) {
  requireEqual(payload.version, 'g2', 'startup maintenance version');
  const action = asRecord(payload.system_action, 'startup maintenance system_action');
  requireEqual(action.action, 'startup_maintenance', 'startup maintenance action');
  requireEqual(action.status, 'completed', 'startup maintenance status');
  const workspaceRoot = asRecord(action.workspace_root, 'startup maintenance workspace_root');
  requireEqual(workspaceRoot.selected_path, '/projects', 'startup maintenance workspace root');
  requireEqual(workspaceRoot.health_status, 'ready', 'startup maintenance workspace health');
  const details = asRecord(action.details, 'startup maintenance details');
  requireEqual(details.surface_kind, 'opl_app_startup_maintenance', 'startup maintenance surface_kind');
  const summary = asRecord(details.summary, 'startup maintenance summary');
  if (Number(summary.total_targets_count) <= 0) {
    throw new Error('startup maintenance summary must include at least one target.');
  }
  const seedBoundary = asRecord(details.seed_boundary, 'startup maintenance seed_boundary');
  requireEqual(seedBoundary.surface_kind, 'opl_seed_install_manifest', 'startup maintenance seed boundary kind');
  const seedInstall = asRecord(seedBoundary.install, 'startup maintenance seed_boundary.install');
  requireEqual(seedInstall.data_dir, '/data', 'startup maintenance seed install data_dir');
  requireEqual(seedInstall.projects_dir, '/projects', 'startup maintenance seed install projects_dir');
  requireString(seedInstall.manifest_file, 'startup maintenance seed install manifest_file');
}

function validateUpdateStatus(payload: Record<string, unknown>) {
  requireEqual(payload.version, 'g2', 'update status version');
  const managedUpdate = asRecord(payload.managed_update, 'managed update');
  requireEqual(managedUpdate.surface_id, 'opl_managed_updater_kernel', 'managed update surface');
  requireEqual(managedUpdate.operation, 'status', 'managed update operation');
  requireEqual(managedUpdate.operation_mode, 'read_only_projection', 'managed update operation mode');
  const workspaceRoot = asRecord(managedUpdate.workspace_root, 'managed update workspace_root');
  requireEqual(workspaceRoot.selected_path, '/projects', 'managed update workspace root');
  requireEqual(workspaceRoot.health_status, 'ready', 'managed update workspace health');
  const lifecycle = requireArray(managedUpdate.lifecycle, 'managed update lifecycle');
  for (const step of ['read_manifest', 'verify', 'activate', 'write_receipt', 'report_status_or_repair']) {
    if (!lifecycle.includes(step)) {
      throw new Error(`managed update lifecycle must include ${step}`);
    }
  }
  const components = requireArray(managedUpdate.components, 'managed update components').map((item) =>
    asRecord(item, 'managed update component')
  );
  const componentIds = new Set(components.map((component) => requireString(component.component_id, 'managed update component id')));
  for (const id of requiredManagedUpdateComponents) {
    if (!componentIds.has(id)) {
      throw new Error(`managed update components must include ${id}`);
    }
  }
  for (const component of components) {
    const id = requireString(component.component_id, 'managed update component id');
    requireString(component.state, `managed update component ${id} state`);
    const receipt = asRecord(component.receipt, `managed update component ${id} receipt`);
    requireEqual(receipt.schema_version, 'opl_managed_update_component_receipt.v1', `managed update component ${id} receipt schema`);
    requireEqual(receipt.required, true, `managed update component ${id} receipt required`);
    requireString(receipt.source_manifest_ref, `managed update component ${id} source_manifest_ref`);
    requireString(receipt.verify_result, `managed update component ${id} verify_result`);
    requireString(receipt.apply_mode, `managed update component ${id} apply_mode`);
    requireArray(receipt.content_identity_fields, `managed update component ${id} content_identity_fields`);
    asRecord(receipt.status_detail, `managed update component ${id} receipt status_detail`);
    asRecord(receipt.reload_guidance, `managed update component ${id} receipt reload_guidance`);
  }
  const receipts = asRecord(managedUpdate.receipts, 'managed update receipts');
  requireEqual(receipts.component_receipt_schema, 'opl_managed_update_component_receipt.v1', 'managed update receipt schema');
  requireString(receipts.component_receipt_ledger_file, 'managed update receipt ledger file');
  const requiredFields = requireArray(receipts.required_fields, 'managed update receipt required_fields');
  for (const field of ['source_manifest_ref', 'verify_result', 'apply_mode', 'status_detail', 'reload_guidance']) {
    if (!requiredFields.includes(field)) {
      throw new Error(`managed update receipt required_fields must include ${field}`);
    }
  }
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
