import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

test('App owns runtime bridge contract while active shell remains replaceable adapter', () => {
  const adapter = readJson('contracts/app-shell-adapter.json');
  const runtimeBridge = readJson('contracts/app-runtime-bridge.json');
  const pageMatrix = readJson('contracts/app-page-state-matrix.json');
  const runtimePage = pageMatrix.pages.find((page) => page.id === 'runtime');

  assert.equal(runtimeBridge.owner, 'one-person-lab-app');
  assert.equal(runtimeBridge.purpose, 'runtime_bridge_abstraction');
  assert.equal(runtimeBridge.active_adapter, adapter.active_shell);
  assert.equal(runtimeBridge.adapter_role, 'replaceable_gui_shell_adapter');
  assert.equal(runtimeBridge.protocol_owner, 'one-person-lab');
  assert.equal(runtimeBridge.ui_contract_owner, 'one-person-lab-app');
  assert.equal(runtimeBridge.default_adapter_repo, adapter.shell_source.owner_repo);
  assert.equal(runtimeBridge.default_adapter_path, adapter.shell_root);
  assert.equal(runtimeBridge.summary_command, 'opl app state --profile fast --json');
  assert.equal(runtimeBridge.refresh_command, 'opl app state --profile fast --json');
  assert.equal(runtimeBridge.full_state_command, 'opl app state --profile full --json');
  assert.equal(runtimeBridge.full_state_policy, 'diagnostic_or_release_evidence_only');
  assert.equal(runtimeBridge.full_detail_command, 'opl runtime app-operator-drilldown --detail full --json');
  assert.equal(runtimeBridge.action_command, 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json');
  assert.deepEqual(runtimeBridge.live_conformance_gate, {
    owner: 'one-person-lab-app',
    producer_owner: 'one-person-lab',
    mode: 'explicit_env_opt_in',
    default_enforcement: 'disabled',
    enable_env: 'OPL_APP_LIVE_CONFORMANCE',
    opl_root_env: 'OPL_APP_LIVE_OPL_ROOT',
    action_fixture_env: 'OPL_APP_LIVE_ACTION_FIXTURE',
    opl_bin: './bin/opl',
    fast_state_command: './bin/opl app state --profile fast --json',
    full_state_command: './bin/opl app state --profile full --json',
    action_dry_run_command: './bin/opl app action execute --action <fixture> --dry-run --json',
    fast_state_max_bytes: 500000,
    required_state_schema: 'opl_app_state.v1',
    golden_fast_state_fixture: 'contracts/fixtures/opl-app-state-fast.fixture.json',
    state_schema_paths: [
      'app_state.schema_version',
      'app_state.surface_kind',
      'app_state.schema',
      'app_state.surface',
      'schema',
      'surface',
    ],
    app_role: 'protocol_conformance_consumer',
    assertions: [
      'fast App state command returns JSON',
      'full App state command returns JSON',
      'dry-run App action command returns JSON',
      'fast App state output stays below 500KB',
      'fast App state declares opl_app_state.v1 schema or surface',
    ],
    forbidden_authority: [
      'runtime_truth',
      'provider_implementation',
      'domain_truth',
      'domain_quality_verdict',
      'domain_artifact_authority',
    ],
  });
  assert.equal(runtimeBridge.projection_sources.primary, 'app_state.operator.summary');
  assert.equal(runtimeBridge.projection_sources.provider, 'app_state.provider');
  assert.equal(runtimeBridge.projection_sources.actions, 'app_state.actions');
  assert.equal(runtimeBridge.projection_sources.full_detail, 'runtime_tray_snapshot.app_operator_drilldown');
  assert.equal(runtimeBridge.authority_boundary.shell_adapter_can_own_runtime_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_own_runtime_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_write_domain_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_read_artifact_body, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_read_memory_body, false);
  assert.equal(runtimeBridge.replacement_policy.runtime_protocol_stable_across_shell_replacement, true);
  assert.equal(runtimePage.runtime_view_model.bridge_contract, 'contracts/app-runtime-bridge.json');
  assert.equal(adapter.runtime_bridge_contract, 'contracts/app-runtime-bridge.json');
});
