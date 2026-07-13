import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const validatorPath = path.join(appRoot, 'scripts', 'validate-webui-runtime-smoke-receipts.ts');
const seedComponentIds = ['opl_framework', 'codex_cli', 'companion_skills', 'domain_modules'];
const managedUpdateProviders = {
  opl_app: 'installation_carrier',
  opl_base: 'runtime_substrate',
  opl_packages: 'capability_packages',
};
const managedUpdateIds = Object.keys(managedUpdateProviders);

function component(id: string, kind = 'image_seed') {
  return {
    component_id: id,
    state: 'current',
    component_kind: kind,
    payload_path: kind === 'image_seed' ? `/opt/opl/seed/payload/${id}` : null,
    materialized_path: id === 'projects_dir' ? '/projects' : id === 'data_dir' ? '/data' : `/data/opl/${id}`,
    receipt_ref: `opl://system-seed/${kind}/${id}/local`,
    receipt_kind: `${id}_receipt`,
    sha256: kind === 'image_seed' ? 'a'.repeat(64) : null,
  };
}

function receipt(id: string, operation = 'image_seed') {
  return {
    operation,
    component_id: id,
    status: 'completed',
    receipt_ref: `opl://system-seed/${operation}/${id}/local`,
    receipt_kind: `${id}_receipt`,
  };
}

function proxyEnvelope(surface: string, command: string, parsed: unknown) {
  return { success: true, data: { surface, command, stdout: JSON.stringify(parsed), parsed } };
}

function installManifest(overrides: Record<string, unknown> = {}) {
  const migrations = ['data_dir', 'projects_dir'];
  return {
    surface_kind: 'opl_seed_install_manifest',
    schema_version: 'opl_seed_install_manifest.v1',
    status: 'applied',
    image: { seed_strategy_status: 'accepted', seed_strategy: 'payload_manifest', manifest: {
      image_profile: 'webui-full', data_dir: '/data', projects_dir: '/projects',
    } },
    seed_metadata: {
      metadata_status: 'found',
      manifest: { strategy: 'payload_preheated', data_dir: '/data', projects_dir: '/projects' },
    },
    install: { data_dir: '/data', projects_dir: '/projects', manifest_file: '/data/opl/state/install-manifest.json' },
    components: [...seedComponentIds.map((id) => component(id)), ...migrations.map((id) => component(id, 'migration'))],
    receipts: [...seedComponentIds.map((id) => receipt(id)), ...migrations.map((id) => receipt(id, 'migration'))],
    reconcile: { status: 'applied', image_seed_receipts_count: 5, migration_receipts_count: 2 },
    ...overrides,
  };
}

function startupMaintenance(manualRequired = false) {
  const details: Record<string, unknown> = {
    surface_kind: 'opl_app_startup_maintenance',
    summary: { total_targets_count: 1 },
    seed_boundary: {
      surface_kind: 'opl_seed_install_manifest',
      install: { data_dir: '/data', projects_dir: '/projects', manifest_file: '/data/opl/state/install-manifest.json' },
    },
  };
  if (manualRequired) {
    details.framework_targets = [{ target_type: 'framework', target_id: 'opl-framework', status: 'manual_required', reason: 'framework_update_target_invalid' }];
  }
  return proxyEnvelope('startup_maintenance', 'opl system startup-maintenance --json', {
    version: 'g2',
    system_action: {
      action: 'startup_maintenance',
      status: manualRequired ? 'manual_required' : 'completed',
      workspace_root: { selected_path: '/projects', health_status: 'ready' },
      details,
    },
  });
}

function managedUpdateComponent(id: string) {
  return {
    component_id: id,
    provider_id: managedUpdateProviders[id as keyof typeof managedUpdateProviders],
    state: id === 'opl_packages' ? 'skipped_manual_required' : 'current',
    receipt: {
      schema_version: 'opl_managed_update_component_receipt.v1',
      required: true,
      source_manifest_ref: `${id}-manifest`,
      verify_result: 'not_run_projection_only',
      apply_mode: 'projection_only',
      content_identity_fields: ['sha256'],
      status_detail: {},
      reload_guidance: {},
    },
  };
}

function runtimeSubstrateWithFrameworkUpdate() {
  return {
    ...managedUpdateComponent('opl_base'),
    state: 'update_available',
    current: { opl_framework_runtime: {
      update_available: true,
      channel_artifact: 'ghcr.io/gaofeng21cn/one-person-lab-framework:26.7.1',
      channel_version: '26.7.1',
      channel_source_archive_sha256: 'a'.repeat(64),
      command_ref: 'opl update apply --json',
      rollback_command_ref: 'opl update rollback --json',
    },
    },
  };
}

function managedUpdateComponents(runtimeSubstrate = managedUpdateComponent('opl_base')) {
  return managedUpdateIds.map((id) => id === 'opl_base' ? runtimeSubstrate : managedUpdateComponent(id));
}

function updateStatus(overrides: Record<string, unknown> = {}) {
  return proxyEnvelope('update_status', 'opl update status --json', {
    version: 'g2',
    managed_update: {
      surface_id: 'opl_managed_updater_kernel',
      operation: 'status',
      operation_mode: 'read_only_projection',
      workspace_root: { selected_path: '/projects', health_status: 'ready' },
      lifecycle: ['read_manifest', 'verify', 'activate', 'write_receipt', 'report_status_or_repair'],
      components: managedUpdateComponents(),
      receipts: {
        component_receipt_schema: 'opl_managed_update_component_receipt.v1',
        component_receipt_ledger_file: '/data/opl/state/managed-update-component-receipts.json',
        required_fields: ['source_manifest_ref', 'verify_result', 'apply_mode', 'status_detail', 'reload_guidance'],
      },
      ...overrides,
    },
  });
}

function writeJson(root: string, file: string, value: unknown) {
  fs.writeFileSync(path.join(root, file), JSON.stringify(value));
}

function validateFixture({
  startup = startupMaintenance(),
  update = updateStatus(),
  manifest = installManifest(),
}: Record<string, any> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-runtime-receipts-'));
  for (const [file, value] of [['startup.json', startup], ['update.json', update], ['install-manifest.json', manifest]]) {
    writeJson(root, file, value);
  }
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    validatorPath,
    '--startup-maintenance', path.join(root, 'startup.json'),
    '--update-status', path.join(root, 'update.json'),
    '--install-manifest', path.join(root, 'install-manifest.json'),
    '--summary-path', path.join(root, 'summary.json'),
  ], { cwd: appRoot, encoding: 'utf8' });
  return { result, summary: () => JSON.parse(fs.readFileSync(path.join(root, 'summary.json'), 'utf8')) };
}

test('WebUI runtime smoke receipt validator accepts seed, migration, and managed update receipts', () => {
  const { result, summary } = validateFixture();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(summary().status, 'passed');
  assert.deepEqual(summary().migration_components, ['data_dir', 'projects_dir']);
});

test('WebUI runtime smoke receipt validator accepts framework self-update pending runtime_substrate apply', () => {
  const { result, summary } = validateFixture({
    startup: startupMaintenance(true),
    update: updateStatus({ components: managedUpdateComponents(runtimeSubstrateWithFrameworkUpdate()) }),
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(summary().status, 'passed');
});

test('WebUI runtime smoke receipt validator rejects missing /projects migration receipt', () => {
  const manifest: any = installManifest();
  manifest.receipts = manifest.receipts.filter((item) => item.component_id !== 'projects_dir');
  const { result } = validateFixture({ manifest });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /install manifest receipts must include projects_dir/);
});

test('WebUI runtime smoke receipt validator rejects managed update components without receipt schema', () => {
  const runtimeSubstrate = { ...managedUpdateComponent('opl_base'), receipt: { required: true } };
  const { result } = validateFixture({
    update: updateStatus({ components: managedUpdateComponents(runtimeSubstrate) }),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /managed update component opl_base receipt schema/);
});

test('WebUI runtime smoke receipt validator rejects lifecycle component provider drift', () => {
  const components = managedUpdateComponents();
  components[0] = { ...components[0], provider_id: 'runtime_substrate' };
  const { result } = validateFixture({ update: updateStatus({ components }) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /component opl_app provider must match/);
});
