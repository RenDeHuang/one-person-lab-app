import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const validatorPath = path.join(appRoot, 'scripts', 'validate-webui-runtime-smoke-receipts.ts');

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

function installManifest(overrides: Record<string, unknown> = {}) {
  const seedComponents = ['opl_framework', 'codex_cli', 'companion_skills', 'domain_modules'];
  return {
    surface_kind: 'opl_seed_install_manifest',
    schema_version: 'opl_seed_install_manifest.v1',
    status: 'applied',
    image: {
      seed_strategy_status: 'accepted',
      seed_strategy: 'payload_manifest',
      manifest: {
        image_profile: 'webui-full',
        data_dir: '/data',
        projects_dir: '/projects',
      },
    },
    seed_metadata: {
      metadata_status: 'found',
      manifest: {
        strategy: 'payload_preheated',
        data_dir: '/data',
        projects_dir: '/projects',
      },
    },
    install: {
      data_dir: '/data',
      projects_dir: '/projects',
      manifest_file: '/data/opl/state/install-manifest.json',
    },
    components: [
      ...seedComponents.map((id) => component(id)),
      component('data_dir', 'migration'),
      component('projects_dir', 'migration'),
    ],
    receipts: [
      ...seedComponents.map((id) => receipt(id)),
      receipt('data_dir', 'migration'),
      receipt('projects_dir', 'migration'),
    ],
    reconcile: {
      status: 'applied',
      image_seed_receipts_count: 5,
      migration_receipts_count: 2,
    },
    ...overrides,
  };
}

function proxyEnvelope(surface: string, command: string, parsed: unknown) {
  return {
    success: true,
    data: {
      surface,
      command,
      stdout: JSON.stringify(parsed),
      parsed,
    },
  };
}

function startupMaintenance() {
  return proxyEnvelope('startup_maintenance', 'opl system startup-maintenance --json', {
    version: 'g2',
    system_action: {
      action: 'startup_maintenance',
      status: 'completed',
      workspace_root: {
        selected_path: '/projects',
        health_status: 'ready',
      },
      details: {
        surface_kind: 'opl_app_startup_maintenance',
        summary: {
          total_targets_count: 1,
        },
        seed_boundary: {
          surface_kind: 'opl_seed_install_manifest',
          install: {
            data_dir: '/data',
            projects_dir: '/projects',
            manifest_file: '/data/opl/state/install-manifest.json',
          },
        },
      },
    },
  });
}

function managedUpdateComponent(id: string) {
  return {
    component_id: id,
    state: id === 'capability_packages' ? 'skipped_manual_required' : 'current',
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

function updateStatus(overrides: Record<string, unknown> = {}) {
  return proxyEnvelope('update_status', 'opl update status --json', {
    version: 'g2',
    managed_update: {
      surface_id: 'opl_managed_updater_kernel',
      operation: 'status',
      operation_mode: 'read_only_projection',
      workspace_root: {
        selected_path: '/projects',
        health_status: 'ready',
      },
      lifecycle: ['read_manifest', 'verify', 'activate', 'write_receipt', 'report_status_or_repair'],
      components: [
        'installation_carrier',
        'runtime_substrate',
        'capability_packages',
        'codex_surface',
        'companion_tools',
      ].map((id) => managedUpdateComponent(id)),
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
  const filePath = path.join(root, file);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function runValidator(root: string) {
  return spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      validatorPath,
      '--startup-maintenance',
      path.join(root, 'startup.json'),
      '--update-status',
      path.join(root, 'update.json'),
      '--install-manifest',
      path.join(root, 'install-manifest.json'),
      '--summary-path',
      path.join(root, 'summary.json'),
    ],
    { cwd: appRoot, encoding: 'utf8' },
  );
}

test('WebUI runtime smoke receipt validator accepts seed, migration, and managed update receipts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-runtime-receipts-'));
  writeJson(root, 'startup.json', startupMaintenance());
  writeJson(root, 'update.json', updateStatus());
  writeJson(root, 'install-manifest.json', installManifest());

  const result = runValidator(root);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(path.join(root, 'summary.json'), 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.deepEqual(summary.migration_components, ['data_dir', 'projects_dir']);
});

test('WebUI runtime smoke receipt validator rejects missing /projects migration receipt', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-runtime-receipts-'));
  const manifest = installManifest();
  manifest.receipts = manifest.receipts.filter((item) => item.component_id !== 'projects_dir');
  writeJson(root, 'startup.json', startupMaintenance());
  writeJson(root, 'update.json', updateStatus());
  writeJson(root, 'install-manifest.json', manifest);

  const result = runValidator(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /install manifest receipts must include projects_dir/);
});

test('WebUI runtime smoke receipt validator rejects managed update components without receipt schema', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-runtime-receipts-'));
  const update = updateStatus({
    components: [
      managedUpdateComponent('installation_carrier'),
      { ...managedUpdateComponent('runtime_substrate'), receipt: { required: true } },
      managedUpdateComponent('capability_packages'),
      managedUpdateComponent('codex_surface'),
      managedUpdateComponent('companion_tools'),
    ],
  });
  writeJson(root, 'startup.json', startupMaintenance());
  writeJson(root, 'update.json', update);
  writeJson(root, 'install-manifest.json', installManifest());

  const result = runValidator(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /managed update component runtime_substrate receipt schema/);
});
