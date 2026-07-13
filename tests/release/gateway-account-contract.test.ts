import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validatePageStateMatrix } from '../../scripts/validate-active-shell/page-state-matrix-validator.ts';
import {
  validateOplGatewayAccountContract,
  validateRuntimeBridgeContract,
} from '../../scripts/validate-active-shell/runtime-bridge-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

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
    'compact_decimal_units_K_M_B_T_with_up_to_two_fraction_digits'
  );
  assert.equal(
    runtimeBridge.opl_gateway_account_projection.group_resolution_policy.ordinary_user_selector,
    'not_rendered'
  );
  assert.equal(
    runtimeBridge.opl_gateway_account_projection.group_resolution_policy.managed_key_setup_action,
    'auto_execute_complete_setup_once_when_action_exposed_managed_key_missing_and_default_group_resolves_without_rendering_control'
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
  assert.doesNotThrow(() => validateRuntimeBridgeContract(runtimeBridge, readJson('contracts/app-shell-adapter.json')));
  assert.doesNotThrow(() =>
    validatePageStateMatrix(
      readJson('contracts/app-page-state-matrix.json'),
      readJson('contracts/app-shell-adapter.json'),
      readJson('contracts/app-gui-product-contract.json')
    )
  );
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

test('Models & Access rejects Gateway account visibility and state-path drift', () => {
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
    const access = matrix.pages.find((page: any) => page.id === 'access');
    mutate(access.opl_gateway_account);
    assert.throws(() => validatePageStateMatrix(matrix, adapter, guiContract));
  }
});
