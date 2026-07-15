import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validatePageStateMatrix } from '../../scripts/validate-active-shell/page-state-matrix-validator.ts';
import {
  validateOplAppStateFastAgentPackageDirectoryFixture,
  validateOplGatewayAccountContract,
  validateRuntimeBridgeContract,
} from '../../scripts/validate-active-shell/runtime-bridge-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

test('Fast App state fixture uses the exact public Agent Package directory and action ABI', () => {
  const fixture = readJson('contracts/fixtures/opl-app-state-fast.fixture.json');
  assert.doesNotThrow(() => validateOplAppStateFastAgentPackageDirectoryFixture(fixture));

  const directory = fixture.app_state.agent_packages.directory;
  assert.equal(directory.surface_kind, 'opl_agent_package_directory.v1');
  assert.equal(directory.detail, 'fast');
  assert.equal(directory.entries.length, 3);
  assert.ok(directory.entries.some((entry: any) => !entry.installed && entry.recommended_action === 'install_from_manifest_url'));
  assert.ok(directory.entries.some((entry: any) => entry.installed && !entry.activated && entry.recommended_action === 'agent_package_activate'));
  assert.ok(directory.entries.some((entry: any) =>
    entry.installed
    && entry.activated
    && entry.readiness.status === 'verification_deferred'
    && entry.readiness.verification_deferred === true
    && entry.readiness.operational_ready === false
    && entry.readiness.launch_allowed === false
  ));
  const activationEntry = directory.entries.find((entry: any) => entry.recommended_action === 'agent_package_activate');
  assert.equal(activationEntry.recommended_action_ref.payload.package_id, activationEntry.package_id);
  assert.equal(activationEntry.recommended_action_ref.payload.scope, 'workspace');
  assert.equal(typeof activationEntry.recommended_action_ref.payload.target_workspace, 'string');
  assert.equal(activationEntry.recommended_action_ref.action_ref, 'app_state.actions#agent_package_activate');
  assert.equal('package_version' in activationEntry.recommended_action_ref.payload, false);
  const packageContract = readJson('contracts/app-runtime-bridge.json')
    .canonical_state_display_action_map.rows.find((row: any) => row.semantic_area === 'package');
  assert.ok(packageContract.required_projection_fields['status_index.packages[package_id]']);
  assert.equal(packageContract.optional_enrichment_fields['status_index.packages[package_id]'], undefined);
});

test('Fast Agent Package directory rejects action, source, workspace, and readiness ABI drift', () => {
  const cases = [
    (fixture: any) => {
      delete fixture.app_state.agent_packages.directory.entries[0].available_actions[0].action_ref;
    },
    (fixture: any) => {
      fixture.app_state.agent_packages.directory.entries[0].available_actions[0].unexpected = true;
    },
    (fixture: any) => {
      fixture.app_state.agent_packages.directory.entries[0].available_actions[0].action_ref =
        'app_state.actions#wrong_action';
    },
    (fixture: any) => {
      fixture.app_state.agent_packages.directory.entries[0].available_actions[0].required_payload_fields =
        [''];
    },
    (fixture: any) => {
      fixture.app_state.agent_packages.directory.entries[0].recommended_action_ref.payload.package_id = 'wrong-package';
    },
    (fixture: any) => {
      const entry = fixture.app_state.agent_packages.directory.entries.find(
        (candidate: any) => candidate.recommended_action === 'agent_package_activate',
      );
      const action = entry.available_actions.find((candidate: any) => candidate.action_id === 'agent_package_activate');
      delete action.payload.target_workspace;
      delete entry.recommended_action_ref.payload.target_workspace;
    },
    (fixture: any) => {
      const entry = fixture.app_state.agent_packages.directory.entries.find((candidate: any) => candidate.activated);
      entry.readiness.status = 'ready';
      entry.readiness.verification_deferred = false;
      entry.readiness.reason = null;
    },
    (fixture: any) => {
      delete fixture.app_state.agent_packages.directory.entries[0].source_explanation.version_source_ref;
    },
    (fixture: any) => {
      const entry = fixture.app_state.agent_packages.directory.entries.find((candidate: any) => candidate.installed);
      entry.package_role = 'framework_capability_package';
    },
  ];

  for (const mutate of cases) {
    const fixture = structuredClone(readJson('contracts/fixtures/opl-app-state-fast.fixture.json'));
    mutate(fixture);
    assert.throws(() => validateOplAppStateFastAgentPackageDirectoryFixture(fixture));
  }
});

test('Gateway account contracts keep the canonical projection, actions, and typed secret bridge', () => {
  const runtimeBridge = readJson('contracts/app-runtime-bridge.json');
  assert.deepEqual(runtimeBridge.opl_gateway_account_projection.nested_field_allowlist.account, [
    'display_name',
    'email',
    'status',
    'balance',
  ]);
  assert.equal(
    runtimeBridge.opl_gateway_account_projection.display_policy.token_counts,
    'compact_decimal_units_K_M_B_T_with_up_to_two_fraction_digits',
  );
  assert.equal(runtimeBridge.opl_gateway_account_projection.group_resolution_policy.ordinary_user_selector, 'not_rendered');
  assert.equal(
    runtimeBridge.opl_gateway_account_projection.group_resolution_policy.managed_key_setup_action,
    'auto_execute_complete_setup_once_when_action_exposed_managed_key_missing_and_default_group_resolves_without_rendering_control',
  );
  assert.deepEqual(runtimeBridge.opl_gateway_account_projection.display_policy.exception_actions, ['sign_in_again']);
  assert.deepEqual(runtimeBridge.opl_gateway_account_projection.display_policy.forbidden_normal_controls, [
    'group_selector',
    'complete_setup',
    'repair',
    'use_for_model_access',
  ]);
  assert.deepEqual(runtimeBridge.opl_gateway_account_projection.renderer_bootstrap_cache, {
    role: 'derived_last_known_good_projection_not_truth',
    storage_scope: 'dedicated_gateway_projection_cache_independent_of_full_app_state_cache',
    field_policy: 'persist_projection_top_level_and_nested_allowlists_only',
    initial_render: 'show_cached_account_before_background_refresh',
    legacy_cache_without_projection: 'keep_account_state_resolving_until_authoritative_readback',
    refresh_failure: 'retain_cached_account_and_surface_stale_or_error',
    invalidation: 'replace_only_after_authoritative_readback_confirms_new_projection',
  });
  assert.doesNotThrow(() => validateOplGatewayAccountContract(runtimeBridge));
  assert.doesNotThrow(() => validateRuntimeBridgeContract(
    runtimeBridge,
    readJson('contracts/app-shell-adapter.json'),
  ));
  assert.doesNotThrow(() => validatePageStateMatrix(
    readJson('contracts/app-page-state-matrix.json'),
    readJson('contracts/app-shell-adapter.json'),
    readJson('contracts/app-gui-product-contract.json'),
  ));
});

test('Gateway account runtime bridge rejects secret leakage and generic-action login', () => {
  for (const mutate of [
    (bridge: any) => {
      bridge.opl_gateway_account_projection.top_level_field_allowlist.push('api_key');
    },
    (bridge: any) => {
      bridge.opl_gateway_account_projection.generic_action_secret_policy = 'password_allowed_in_action_payload';
    },
    (bridge: any) => {
      bridge.opl_gateway_account_secret_bridge.command =
        'opl app action execute --action gateway_account_login --payload <json> --json';
    },
    (bridge: any) => {
      bridge.opl_gateway_account_secret_bridge.webui_password_login_allowed = true;
    },
    (bridge: any) => {
      bridge.opl_gateway_account_projection.renderer_bootstrap_cache.field_policy = 'persist_entire_raw_payload';
    },
  ]) {
    const bridge = structuredClone(readJson('contracts/app-runtime-bridge.json'));
    mutate(bridge);
    assert.throws(() => validateOplGatewayAccountContract(bridge));
  }
});

test('Account & Gateway rejects account visibility and state-path drift', () => {
  const adapter = readJson('contracts/app-shell-adapter.json');
  const guiContract = readJson('contracts/app-gui-product-contract.json');
  for (const mutate of [
    (gateway: any) => {
      gateway.account_card_visibility = 'always';
    },
    (gateway: any) => {
      gateway.projection_path = 'shell_state.gateway_account';
    },
    (gateway: any) => {
      gateway.cache_ttl_seconds = 0;
    },
  ]) {
    const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
    const gateway = matrix.pages.find((page: any) => page.id === 'gateway');
    mutate(gateway.opl_gateway_account);
    assert.throws(() => validatePageStateMatrix(matrix, adapter, guiContract));
  }
});
