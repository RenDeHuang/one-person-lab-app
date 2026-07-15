import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  appOwnedRuntimeBridgeLocalWorktreeHandoffPolicy,
  forbiddenAuthorityOwners,
} from './app-contract-constants.ts';
import { isDefaultReleaseAdapter } from './active-shell-contract.ts';
import { assertFile, commandMaxBuffer, root } from './validation-config.ts';
import { lookupPath } from './value-helpers.ts';
import {
  validateArtifactNativeDrilldownFixture,
  validateArtifactNativeDrilldownProjectionContract,
  validateArtifactProvenanceBundleProjectionContract,
  validateAgentAvailabilityProjectionContract,
  validateOpenScienceAcceptedItemsFixture,
  validateOpenScienceConsoleProjectionContract,
  validateProviderReadinessRepairProjectionContract,
  validateProgressDeltaDisplayContract,
  validateProjectProgressDisplayContract,
  validateRefLevelFollowUpProjectionContract,
  validateRuntimeScopeProjectionContract,
  validateStageRunCockpitFixture,
  validateStageRunCockpitProjectionContract,
  validateStateIndexSidecarFixture,
  validateStateIndexSidecarProjectionContract,
  validateStructuredResultPanelProjectionContract,
  validateTaskRunProjectionV2Fixture,
  validateWorkflowSkillCandidateProjectionContract,
  validateWorkItemProjectionContract,
  validateUserTaskStatusProjectionContract,
} from './shared-contract-validators.ts';

const gatewayAccountProjectionPath =
  'app_state.settings_control_center.app_settings_read_model.opl_gateway_account';
const gatewayAccountConnectionModes = ['none', 'manual_key', 'account'];
const gatewayAccountStatusValues = [
  'not_connected',
  'setup_required',
  'connected',
  'reauth_required',
  'attention_needed',
  'disconnect_pending',
];
const gatewayAccountTopLevelFields = [
  'surface_kind',
  'connection_mode',
  'status',
  'account_card_visible',
  'account',
  'usage',
  'managed_key',
  'installation',
  'available_groups',
  'freshness',
  'capabilities',
  'actions',
];
const gatewayAccountNestedFields = {
  account: ['display_name', 'email', 'status', 'balance'],
  'account.balance': ['amount', 'currency'],
  usage: ['today_tokens', 'total_tokens', 'today_actual_cost', 'total_actual_cost', 'currency', 'day_timezone'],
  managed_key: ['name', 'status', 'ownership'],
  installation: ['device_label', 'short_id'],
  'available_groups[]': ['group_id', 'label'],
  freshness: ['observed_at', 'stale_after', 'stale', 'last_error_code'],
  capabilities: ['account_login_supported', 'manual_key_supported'],
  actions: ['complete_setup', 'refresh', 'repair', 'use_for_model_access', 'disconnect'],
};
const gatewayAccountForbiddenFields = [
  'password',
  'access_token',
  'refresh_token',
  'api_key',
  'key_material',
  'key_id',
  'remote_key_id',
  'credential_path',
  'raw_response',
  'raw_error',
];
const gatewayAccountErrorCodes = [
  'invalid_credentials',
  'account_disabled',
  'mfa_or_challenge_required',
  'session_not_persistable',
  'group_selection_required',
  'auth_expired',
  'network_unreachable',
  'rate_limited',
  'managed_key_missing',
  'managed_key_conflict',
  'managed_key_identity_drift',
  'disconnect_pending',
  'manual_override_preserved',
];
const gatewayAccountActionIds = [
  'gateway_account_complete_setup',
  'gateway_account_refresh',
  'gateway_account_repair',
  'gateway_account_use_for_model_access',
  'gateway_account_disconnect',
];
const gatewayAccountDisplayPolicy = {
  identity: 'show_full_account_email_because_it_is_not_secret_material',
  account_status: 'localized_user_facing_label_with_active_rendered_as_激活_in_zh_CN',
  token_counts: 'compact_decimal_units_K_M_B_T_with_up_to_two_fraction_digits',
  day_timezone: 'not_user_visible',
  observed_at: 'format_with_local_device_locale_and_timezone',
  refresh_action: 'icon_only_immediately_after_observed_at_with_tooltip_and_accessible_name',
  normal_actions: ['refresh', 'disconnect'],
  exception_actions: ['sign_in_again'],
  forbidden_normal_controls: ['group_selector', 'complete_setup', 'repair', 'use_for_model_access'],
};
const gatewayAccountGroupResolutionPolicy = {
  default_group_match: 'single_case_insensitive_label_containing_Codex_then_single_available_group_fallback',
  ordinary_user_selector: 'not_rendered',
  managed_key_setup_action:
    'auto_execute_complete_setup_once_when_action_exposed_managed_key_missing_and_default_group_resolves_without_rendering_control',
  unresolved_state: 'show_localized_error_without_arbitrary_group_selection',
  retry_policy: 'retry_after_manual_refresh_or_new_authoritative_projection',
};

function collectObjectKeys(value, keys = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjectKeys(item, keys);
    return keys;
  }
  if (!value || typeof value !== 'object') return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.add(key);
    collectObjectKeys(nested, keys);
  }
  return keys;
}

function validateGatewayAccountFixture(fixture) {
  const projection = lookupPath(fixture, gatewayAccountProjectionPath);
  if (!projection || typeof projection !== 'object' || Array.isArray(projection)) {
    throw new Error(`OPL App state golden fixture must include ${gatewayAccountProjectionPath}`);
  }
  assertDeepEqualJson(Object.keys(projection), gatewayAccountTopLevelFields, 'Gateway account fixture top-level fields');
  if (
    projection.surface_kind !== 'opl_gateway_account_read_model.v1'
    || !gatewayAccountConnectionModes.includes(projection.connection_mode)
    || !gatewayAccountStatusValues.includes(projection.status)
  ) {
    throw new Error('Gateway account fixture must use the canonical v1 surface, connection mode, and status');
  }
  if (projection.account_card_visible !== (projection.connection_mode === 'account')) {
    throw new Error('Gateway account fixture account card visibility must follow account connection mode');
  }
  for (const [field, expectedFields] of Object.entries(gatewayAccountNestedFields)) {
    const value = field === 'available_groups[]'
      ? projection.available_groups
      : field === 'account.balance'
        ? projection.account?.balance
        : projection[field];
    if (field === 'available_groups[]') {
      if (!Array.isArray(value)) throw new Error('Gateway account fixture available_groups must be an array');
      for (const group of value) {
        assertDeepEqualJson(Object.keys(group), expectedFields, 'Gateway account fixture available group fields');
      }
      continue;
    }
    assertDeepEqualJson(Object.keys(value ?? {}), expectedFields, `Gateway account fixture ${field} fields`);
  }
  const observedKeys = collectObjectKeys(projection);
  for (const forbidden of gatewayAccountForbiddenFields) {
    if (observedKeys.has(forbidden)) {
      throw new Error(`Gateway account fixture must not expose secret or remote identity field ${forbidden}`);
    }
  }
  const actionValues = Object.values(projection.actions).filter(Boolean);
  if (!actionValues.every((action) => gatewayAccountActionIds.includes(action))) {
    throw new Error('Gateway account fixture actions must use canonical non-secret App action ids');
  }
}

const agentPackageDirectoryFields = [
  'surface_kind',
  'status',
  'source_catalog_kind',
  'detail',
  'entry_count',
  'installed_package_count',
  'installable_package_count',
  'migration_required_count',
  'entries',
  'authority_boundary',
];
const agentPackageDirectoryEntryFields = [
  'package_id',
  'display_name',
  'publisher',
  'description',
  'tags',
  'package_role',
  'role_state',
  'trust_tier',
  'source_explanation',
  'manifest_url',
  'selected_version',
  'stable_version',
  'installed_version',
  'installed',
  'activated',
  'installability',
  'readiness',
  'recommended_action',
  'recommended_action_ref',
  'available_actions',
  'authority_boundary',
];
const agentPackageActionFields = [
  'action_id',
  'action_ref',
  'payload',
  'required_payload_fields',
  'confirmation_required',
];

function assertExactObjectFields(value, expectedFields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  assertDeepEqualJson(
    Object.keys(value).sort(),
    [...expectedFields].sort(),
    `${label} fields`,
  );
}

function validateAgentPackageDirectoryAction(action, label) {
  assertExactObjectFields(action, agentPackageActionFields, label);
  if (
    typeof action.action_id !== 'string'
    || action.action_ref !== `app_state.actions#${action.action_id}`
    || !action.payload
    || typeof action.payload !== 'object'
    || Array.isArray(action.payload)
    || !Array.isArray(action.required_payload_fields)
    || action.required_payload_fields.some((field) => typeof field !== 'string' || !field)
    || typeof action.confirmation_required !== 'boolean'
  ) {
    throw new Error(`${label} must use the canonical five-field Framework action object`);
  }
}

export function validateOplAppStateFastAgentPackageDirectoryFixture(fixture) {
  const directory = lookupPath(fixture, 'app_state.agent_packages.directory');
  assertExactObjectFields(directory, agentPackageDirectoryFields, 'Agent Package directory fixture');
  if (
    directory.surface_kind !== 'opl_agent_package_directory.v1'
    || directory.source_catalog_kind !== 'opl_package_catalog.v1+opl_agent_package_registry_cache'
    || directory.detail !== 'fast'
    || !['available', 'attention_required'].includes(directory.status)
    || !Array.isArray(directory.entries)
    || directory.entries.length < 3
  ) {
    throw new Error('Agent Package directory fixture must be a representative fast opl_agent_package_directory.v1 projection');
  }
  if (
    directory.entry_count !== directory.entries.length
    || directory.installed_package_count !== directory.entries.filter((entry) => entry.installed).length
    || directory.installable_package_count !== directory.entries.filter((entry) => entry.installability?.installable).length
    || directory.migration_required_count !== directory.entries.filter((entry) => entry.installability?.status === 'migration_required').length
  ) {
    throw new Error('Agent Package directory fixture counts must match its entries');
  }

  for (const entry of directory.entries) {
    assertExactObjectFields(entry, agentPackageDirectoryEntryFields, `Agent Package directory entry ${entry?.package_id ?? '<unknown>'}`);
    if (
      typeof entry.package_id !== 'string'
      || typeof entry.display_name !== 'string'
      || typeof entry.publisher !== 'string'
      || typeof entry.description !== 'string'
      || !Array.isArray(entry.tags)
      || typeof entry.package_role !== 'string'
      || typeof entry.trust_tier !== 'string'
      || typeof entry.manifest_url !== 'string'
      || typeof entry.installed !== 'boolean'
      || typeof entry.activated !== 'boolean'
    ) {
      throw new Error(`Agent Package directory entry ${entry?.package_id ?? '<unknown>'} has invalid identity or lifecycle metadata`);
    }
    assertExactObjectFields(
      entry.role_state,
      ['status', 'source', 'discovered_role', 'installed_role', 'diagnostic'],
      `Agent Package directory entry ${entry.package_id} role_state`,
    );
    assertExactObjectFields(
      entry.source_explanation,
      ['kind', 'source', 'summary', 'catalog_ref', 'registry_url', 'registry_source_ref', 'version_source_ref'],
      `Agent Package directory entry ${entry.package_id} source_explanation`,
    );
    assertExactObjectFields(
      entry.installability,
      ['status', 'installable'],
      `Agent Package directory entry ${entry.package_id} installability`,
    );
    assertExactObjectFields(
      entry.readiness,
      ['status', 'operational_ready', 'launch_allowed', 'verification_deferred', 'reason', 'detail_surface', 'status_read_error'],
      `Agent Package directory entry ${entry.package_id} readiness`,
    );
    if (
      typeof entry.source_explanation.kind !== 'string'
      || typeof entry.source_explanation.source !== 'string'
      || typeof entry.source_explanation.summary !== 'string'
      || typeof entry.source_explanation.version_source_ref !== 'string'
      || typeof entry.installability.installable !== 'boolean'
      || typeof entry.readiness.status !== 'string'
      || typeof entry.readiness.operational_ready !== 'boolean'
      || typeof entry.readiness.launch_allowed !== 'boolean'
      || typeof entry.readiness.verification_deferred !== 'boolean'
      || typeof entry.readiness.detail_surface !== 'string'
    ) {
      throw new Error(`Agent Package directory entry ${entry.package_id} has invalid source, installability, or readiness metadata`);
    }
    if (!Array.isArray(entry.available_actions) || entry.available_actions.length === 0) {
      throw new Error(`Agent Package directory entry ${entry.package_id} must expose available_actions`);
    }
    for (const action of entry.available_actions) {
      validateAgentPackageDirectoryAction(action, `Agent Package directory entry ${entry.package_id} action`);
    }
    const recommended = entry.available_actions.find((action) => action.action_id === entry.recommended_action) ?? null;
    if (entry.recommended_action === null) {
      if (entry.recommended_action_ref !== null) {
        throw new Error(`Agent Package directory entry ${entry.package_id} recommended_action_ref must be null`);
      }
    } else if (!recommended || JSON.stringify(entry.recommended_action_ref) !== JSON.stringify(recommended)) {
      throw new Error(`Agent Package directory entry ${entry.package_id} recommended_action_ref must exactly match available_actions`);
    }
  }

  const workspaceRoot = lookupPath(fixture, 'app_state.paths.workspace_root_path');
  const installEntry = directory.entries.find((entry) =>
    entry.installed === false
    && entry.installability?.installable === true
    && entry.recommended_action === 'install_from_manifest_url'
  );
  if (
    !installEntry
    || installEntry.readiness.status !== 'not_installed'
    || installEntry.recommended_action_ref?.payload?.package_id !== installEntry.package_id
  ) {
    throw new Error('Agent Package directory fixture must include an uninstalled package with its canonical install action');
  }
  const activationEntry = directory.entries.find((entry) =>
    entry.installed === true
    && entry.activated === false
    && entry.recommended_action === 'agent_package_activate'
  );
  if (
    !activationEntry
    || activationEntry.recommended_action_ref?.payload?.package_id !== activationEntry.package_id
    || activationEntry.recommended_action_ref?.payload?.scope !== 'workspace'
    || activationEntry.recommended_action_ref?.payload?.target_workspace !== workspaceRoot
    || !activationEntry.recommended_action_ref?.required_payload_fields?.includes('scope')
    || !activationEntry.recommended_action_ref?.required_payload_fields?.includes('target_workspace or target_quest')
  ) {
    throw new Error('Agent Package directory fixture must include a workspace-scoped canonical activation action');
  }
  const activatedEntry = directory.entries.find((entry) => entry.installed === true && entry.activated === true);
  if (
    !activatedEntry
    || activatedEntry.readiness.status !== 'verification_deferred'
    || activatedEntry.readiness.verification_deferred !== true
    || activatedEntry.readiness.reason !== 'live_verification_deferred'
    || activatedEntry.readiness.operational_ready !== false
    || activatedEntry.readiness.launch_allowed !== false
    || activatedEntry.recommended_action !== null
    || activatedEntry.recommended_action_ref !== null
  ) {
    throw new Error('Agent Package fast directory fixture must keep activated readiness verification deferred until full verification');
  }

  const statusIndex = lookupPath(fixture, 'app_state.agent_packages.status_index');
  const representativeStatus = statusIndex?.packages?.[activatedEntry.package_id];
  assertExactObjectFields(
    representativeStatus,
    [
      'surface_kind',
      'package_id',
      'status',
      'package_version',
      'installed_version',
      'version',
      'source_kind',
      'package_lock_ref',
      'lock_ref',
      'action_receipt_ref',
      'rollback_ref',
      'physical_surface',
      'codex_visible',
      'capability_exposure',
      'dependency_readiness',
      'package_dependency_readiness',
      'materialization_readiness',
      'runtime_source_readiness',
      'operational_ready',
      'operational_ready_scope',
      'launch_allowed',
      'launch_blocked_reason',
      'allowed_when_blocked',
      'repair_action',
      'repair_command',
      'activation_action',
      'dependent_guard',
      'currentness_detail_deferred',
      'detail_surface',
    ],
    'Agent Package representative fast status',
  );
  assertExactObjectFields(
    representativeStatus.package_dependency_readiness,
    ['status', 'operational_ready', 'repair_command', 'dependencies'],
    'Agent Package dependency readiness',
  );
  assertExactObjectFields(
    representativeStatus.dependency_readiness,
    ['status', 'required_count', 'ready_count', 'checks', 'closure'],
    'Agent Package canonical dependency readiness',
  );
  for (const check of representativeStatus.dependency_readiness.checks) {
    assertExactObjectFields(
      check,
      [
        'package_id',
        'required',
        'installed',
        'enabled',
        'version_requirement',
        'installed_version',
        'version_satisfied',
        'capability_abi',
        'installed_capability_abi',
        'abi_satisfied',
        'required_export_ids',
        'available_export_ids',
        'exports_satisfied',
        'content_lock_digest',
        'physical_surface_status',
        'ready',
        'failure_reasons',
      ],
      `Agent Package canonical dependency check ${check?.package_id ?? '<unknown>'}`,
    );
  }
  assertExactObjectFields(
    representativeStatus.dependency_readiness.closure,
    [
      'transaction_id',
      'closure_digest',
      'last_known_good_transaction_id',
      'last_known_good_closure_digest',
    ],
    'Agent Package canonical dependency closure',
  );
  assertExactObjectFields(
    representativeStatus.repair_action,
    ['action_id', 'command_ref', 'enabled', 'reason_code'],
    'Agent Package canonical repair action',
  );
  assertExactObjectFields(
    representativeStatus.activation_action,
    ['action_id', 'command_ref', 'enabled', 'preparation_status', 'reason_code'],
    'Agent Package canonical activation action',
  );
  assertExactObjectFields(
    representativeStatus.dependent_guard,
    ['required_by_package_ids', 'disable', 'uninstall'],
    'Agent Package canonical dependent guard',
  );
  assertExactObjectFields(
    representativeStatus.dependent_guard.disable,
    ['allowed', 'reason_code'],
    'Agent Package canonical disable guard',
  );
  assertExactObjectFields(
    representativeStatus.dependent_guard.uninstall,
    ['allowed', 'reason_code'],
    'Agent Package canonical uninstall guard',
  );
  for (const dependency of representativeStatus.package_dependency_readiness.dependencies) {
    assertExactObjectFields(
      dependency,
      [
        'package_id',
        'required',
        'version_requirement',
        'capability_abi',
        'required_export_ids',
        'required_module_ids',
        'installed_version',
        'manifest_sha256',
        'content_digest',
        'status',
        'reasons',
        'missing_required_export_ids',
        'missing_required_module_ids',
      ],
      `Agent Package dependency ${dependency?.package_id ?? '<unknown>'}`,
    );
  }
  assertExactObjectFields(
    representativeStatus.materialization_readiness,
    [
      'status',
      'scope',
      'target_root',
      'required_skill_ids',
      'materialized_skill_ids',
      'expected_digest',
      'actual_digest',
      'repair_command',
      'lifecycle_receipt_ref',
      'core_readiness',
      'specialty_exposure',
    ],
    'Agent Package materialization readiness',
  );
  assertExactObjectFields(
    representativeStatus.runtime_source_readiness,
    [
      'status',
      'operational_ready',
      'module_id',
      'checkout_path',
      'expected_tree_sha256',
      'actual_tree_sha256',
      'reason',
      'verification_mode',
      'live_verification_deferred',
      'live_verification_surface',
    ],
    'Agent Package runtime source readiness',
  );
  assertExactObjectFields(
    representativeStatus.physical_surface,
    [
      'surface_kind',
      'status',
      'package_id',
      'plugin_id',
      'marketplace_id',
      'codex_home',
      'codex_config_path',
      'codex_config_preexisting',
      'plugin_source_path',
      'plugin_manifest_path',
      'codex_plugin_cache_path',
      'marketplace_root',
      'marketplace_path',
      'marketplace_plugin_path',
      'plugin_payload_manifest_url',
      'plugin_payload_manifest_sha256',
      'plugin_payload_cache_path',
      'materialized_required_skill_ids',
      'materialized_required_skill_paths',
      'removed_paths',
      'writes_performed',
      'reload_required',
      'failure_reason',
      'note',
      'profile_config',
      'profile_migration',
      'managed_policy_config',
      'workflow_policy_migration',
      'authority_boundary',
    ],
    'Agent Package canonical physical surface',
  );
  if (
    representativeStatus.status !== 'verification_deferred'
    || representativeStatus.operational_ready !== false
    || representativeStatus.launch_allowed !== false
    || representativeStatus.launch_blocked_reason !== 'live_verification_deferred'
    || representativeStatus.package_dependency_readiness.status !== 'current'
    || representativeStatus.dependency_readiness.status !== 'ready'
    || representativeStatus.activation_action.action_id !== 'agent_package_activate'
    || representativeStatus.dependent_guard.disable.allowed !== true
  ) {
    throw new Error('Agent Package fast status fixture must match the fail-closed producer ABI with canonical status-index fields');
  }
}

export function validateOplGatewayAccountContract(runtimeBridge) {
  const projection = runtimeBridge.opl_gateway_account_projection;
  if (
    projection?.surface_kind !== 'opl_gateway_account_read_model.v1'
    || projection.source_path !== 'app_state.settings_control_center.app_settings_read_model.opl_gateway_account'
    || projection.producer_owner !== 'one-person-lab'
    || projection.consumer_owner !== 'one-person-lab-app'
    || projection.shell_role !== 'display_and_declared_action_consumer_only'
  ) {
    throw new Error('Runtime bridge must declare the canonical OPL Gateway account projection ownership and path');
  }
  assertDeepEqualJson(projection.connection_modes, gatewayAccountConnectionModes, 'Gateway account connection modes');
  assertDeepEqualJson(projection.status_values, gatewayAccountStatusValues, 'Gateway account status values');
  assertDeepEqualJson(projection.top_level_field_allowlist, gatewayAccountTopLevelFields, 'Gateway account top-level fields');
  assertDeepEqualJson(projection.nested_field_allowlist, gatewayAccountNestedFields, 'Gateway account nested fields');
  assertDeepEqualJson(projection.forbidden_fields, gatewayAccountForbiddenFields, 'Gateway account forbidden fields');
  assertDeepEqualJson(projection.error_codes, gatewayAccountErrorCodes, 'Gateway account error codes');
  assertDeepEqualJson(projection.app_action_ids, gatewayAccountActionIds, 'Gateway account App action ids');
  assertDeepEqualJson(projection.display_policy, gatewayAccountDisplayPolicy, 'Gateway account display policy');
  assertDeepEqualJson(
    projection.group_resolution_policy,
    gatewayAccountGroupResolutionPolicy,
    'Gateway account group resolution policy',
  );
  if (
    projection.account_card_visibility !== 'account_card_visible_true_only'
    || projection.refresh_policy?.ttl_seconds !== 900
    || projection.refresh_policy?.page_entry !== 'show_cached_then_refresh_once_when_stale'
    || projection.refresh_policy?.manual_refresh !== 'bypass_ttl'
    || projection.refresh_policy?.network_failure !== 'preserve_cached_values_and_mark_stale'
    || projection.renderer_bootstrap_cache?.role !== 'derived_last_known_good_projection_not_truth'
    || projection.renderer_bootstrap_cache?.storage_scope !==
      'dedicated_gateway_projection_cache_independent_of_full_app_state_cache'
    || projection.renderer_bootstrap_cache?.field_policy !== 'persist_projection_top_level_and_nested_allowlists_only'
    || projection.renderer_bootstrap_cache?.initial_render !== 'show_cached_account_before_background_refresh'
    || projection.renderer_bootstrap_cache?.legacy_cache_without_projection !==
      'keep_account_state_resolving_until_authoritative_readback'
    || projection.renderer_bootstrap_cache?.refresh_failure !== 'retain_cached_account_and_surface_stale_or_error'
    || projection.renderer_bootstrap_cache?.invalidation !==
      'replace_only_after_authoritative_readback_confirms_new_projection'
    || projection.generic_action_secret_policy !==
      'password_tokens_and_api_key_material_forbidden_in_action_payload_log_state_error_and_receipt'
  ) {
    throw new Error('Gateway account projection must preserve visibility, 15-minute freshness, stale, and secret boundaries');
  }

  const secretBridge = runtimeBridge.opl_gateway_account_secret_bridge;
  if (
    secretBridge?.bridge_id !== 'loginGatewayAccount'
    || secretBridge.desktop_only !== true
    || secretBridge.webui_password_login_allowed !== false
    || secretBridge.command !== 'opl connect gateway login --credentials-stdin --json'
    || secretBridge.transport !== 'typed_ipc_to_dedicated_stdin_no_generic_app_action_payload'
    || secretBridge.secret_persistence !== false
    || secretBridge.secret_diagnostics !== false
    || secretBridge.secret_receipt_fields !== false
  ) {
    throw new Error('Gateway account login must use the dedicated desktop typed IPC and stdin-only secret bridge');
  }
  assertDeepEqualJson(secretBridge.request_fields, ['email', 'password', 'deviceLabel'], 'Gateway login request fields');
  assertDeepEqualJson(secretBridge.optional_request_fields, ['deviceLabel'], 'Gateway login optional request fields');
  assertDeepEqualJson(secretBridge.response_fields, ['ok', 'errorCode', 'stateRefreshRequired'], 'Gateway login response fields');
  assertDeepEqualJson(secretBridge.secret_fields, ['password'], 'Gateway login secret fields');
}

function resolveLiveGateEnabled(gate) {
  const envName = gate?.enable_env;
  return typeof envName === 'string' && process.env[envName]?.trim() === '1';
}

function runLiveJsonCommand(oplRoot, args, label, maxStdoutBytes = commandMaxBuffer) {
  const result = spawnSync('./bin/opl', args, {
    cwd: oplRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: Math.max(commandMaxBuffer, maxStdoutBytes),
  });
  if (result.error) {
    throw new Error(`Live OPL ${label} failed to launch: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error([
      `Live OPL ${label} failed: ./bin/opl ${args.join(' ')}`,
      result.stderr.trim(),
      result.stdout.trim(),
    ].filter(Boolean).join('\n'));
  }
  const stdoutBytes = Buffer.byteLength(result.stdout, 'utf8');
  if (stdoutBytes > maxStdoutBytes) {
    throw new Error(`Live OPL ${label} exceeded ${maxStdoutBytes} bytes: ${stdoutBytes}`);
  }
  try {
    return {
      payload: JSON.parse(result.stdout),
      stdoutBytes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Live OPL ${label} returned invalid JSON: ${message}`);
  }
}

function validateLiveConformanceContract(gate) {
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)) {
    throw new Error('Runtime bridge must declare live_conformance_gate');
  }
  if (gate.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected live conformance owner: ${gate.owner}`);
  }
  if (gate.producer_owner !== 'one-person-lab') {
    throw new Error(`Unexpected live conformance producer owner: ${gate.producer_owner}`);
  }
  if (gate.mode !== 'explicit_env_opt_in') {
    throw new Error(`Unexpected live conformance mode: ${gate.mode}`);
  }
  if (gate.default_enforcement !== 'disabled') {
    throw new Error(`Unexpected live conformance default enforcement: ${gate.default_enforcement}`);
  }
  for (const [field, expected] of Object.entries({
    enable_env: 'OPL_APP_LIVE_CONFORMANCE',
    opl_root_env: 'OPL_APP_LIVE_OPL_ROOT',
    action_fixture_env: 'OPL_APP_LIVE_ACTION_FIXTURE',
    opl_bin: './bin/opl',
    fast_state_command: './bin/opl app state --profile fast --json',
    full_state_command: './bin/opl app state --profile full --json',
    action_dry_run_command: './bin/opl app action execute --action <fixture> --dry-run --json',
    required_state_schema: 'opl_app_state.v1',
    golden_fast_state_fixture: 'contracts/fixtures/opl-app-state-fast.fixture.json',
    app_role: 'protocol_conformance_consumer',
  })) {
    if (gate[field] !== expected) {
      throw new Error(`Runtime bridge live_conformance_gate.${field} must be ${expected}`);
    }
  }
  if (gate.fast_state_max_bytes !== 500000) {
    throw new Error('Runtime bridge live_conformance_gate.fast_state_max_bytes must be 500000');
  }
  for (const schemaPath of ['app_state.schema_version', 'app_state.surface_kind', 'app_state.schema', 'app_state.surface', 'schema', 'surface']) {
    if (!gate.state_schema_paths?.includes(schemaPath)) {
      throw new Error(`Runtime bridge live conformance schema paths must include ${schemaPath}`);
    }
  }
  for (const assertion of [
    'fast App state command returns JSON',
    'full App state command returns JSON',
    'dry-run App action command returns JSON',
    'fast App state output stays below 500KB',
    'fast App state declares opl_app_state.v1 schema or surface',
  ]) {
    if (!gate.assertions?.includes(assertion)) {
      throw new Error(`Runtime bridge live conformance assertions must include ${assertion}`);
    }
  }
  for (const forbidden of forbiddenAuthorityOwners) {
    if (!gate.forbidden_authority?.includes(forbidden)) {
      throw new Error(`Runtime bridge live conformance must exclude ${forbidden}`);
    }
  }
  validateGoldenAppStateFixture(gate);
}

function validateGoldenAppStateFixture(gate) {
  const fixturePath = path.join(root, gate.golden_fast_state_fixture);
  assertFile(fixturePath, 'OPL App state golden fixture');
  const fixtureText = readFileSync(fixturePath, 'utf8');
  const fixture = JSON.parse(fixtureText);
  validateGoldenAppStateFixtureBasics(fixtureText, fixture, gate);
  validateCurrentOwnerDeltaCockpitFixture(fixture);
  validateGoldenAppStateTaskDrilldowns(fixture);
  validateGoldenAppStateActiveProjects(fixture);
  validateGoldenAppStateRequiredCollections(fixture);
  validateGatewayAccountFixture(fixture);
  validateOplAppStateFastAgentPackageDirectoryFixture(fixture);
}

function validateGoldenAppStateFixtureBasics(fixtureText, fixture, gate) {
  if (Buffer.byteLength(fixtureText, 'utf8') >= gate.fast_state_max_bytes) {
    throw new Error(`OPL App state golden fixture must stay below ${gate.fast_state_max_bytes} bytes.`);
  }
  if (lookupPath(fixture, 'app_state.schema_version') !== gate.required_state_schema) {
    throw new Error('OPL App state golden fixture must declare app_state.schema_version.');
  }
  if (lookupPath(fixture, 'app_state.surface_kind') !== gate.required_state_schema) {
    throw new Error('OPL App state golden fixture must declare app_state.surface_kind.');
  }
  if (lookupPath(fixture, 'app_state.meta.profile') !== 'fast') {
    throw new Error('OPL App state golden fixture must use the fast profile.');
  }
  if (lookupPath(fixture, 'app_state.operator.workbench.view_model_schema') !== 'opl_app_operator_workbench.v1') {
    throw new Error('OPL App state golden fixture must include typed operator workbench.');
  }
  if (lookupPath(fixture, 'app_state.operator.workbench.performance_policy.fast_json_max_bytes') !== gate.fast_state_max_bytes) {
    throw new Error('OPL App state golden fixture must carry the App fast JSON max budget.');
  }
  if (lookupPath(fixture, 'app_state.operator.workbench.performance_policy.shell_must_not_derive_layout_from_raw_runtime_projection') !== true) {
    throw new Error('OPL App state golden fixture must forbid shell-side layout derivation from raw runtime projection.');
  }
}

function validateGoldenAppStateTaskDrilldowns(fixture) {
  const taskDrilldowns = lookupPath(fixture, 'app_state.operator.workbench.task_drilldowns') ?? [];
  const platformRepairExample = taskDrilldowns.find(
    (task) => task?.progress_delta_classification === 'platform_repair',
  );
  if (!platformRepairExample) {
    throw new Error('OPL App state golden fixture must include a platform_repair task example.');
  }
  if (
    platformRepairExample.deliverable_progress_delta?.count !== 0
    || !(platformRepairExample.platform_repair_delta?.count > 0)
    || platformRepairExample.user_facing_progress_claim_allowed !== false
    || platformRepairExample.progress_display_bucket !== 'platform_repair'
  ) {
    throw new Error('OPL App state platform repair example must not claim deliverable progress.');
  }
  if (/deliverable|paper|manuscript|submission/i.test(platformRepairExample.progress_display_label ?? '')) {
    throw new Error('OPL App state platform repair label must not present repair as deliverable progress.');
  }
  const taskRunProjection = lookupPath(fixture, 'app_state.operator.workbench.task_run_projection_v2');
  if (
    taskRunProjection?.surface_kind !== 'task_run_projection_v2'
    || taskRunProjection?.schema_version !== 'task-run-projection.v2'
    || taskRunProjection?.refs_only !== true
    || !Array.isArray(taskRunProjection?.tasks)
    || taskRunProjection.tasks.length === 0
  ) {
    throw new Error('OPL App state golden fixture must include workbench.task_run_projection_v2.');
  }
  validateTaskRunProjectionV2Fixture(
    taskRunProjection.tasks[0],
    'OPL App state golden fixture TaskRunProjection v2 task',
  );
  validateOpenScienceAcceptedItemsFixture(
    taskRunProjection.tasks[0],
    'OPL App state golden fixture OpenScience accepted item task',
  );
  validateOpenScienceAcceptedItemsFixture(
    taskDrilldowns[0],
    'OPL App state golden fixture OpenScience accepted item drilldown',
  );
  const stateIndexSidecarExample = taskDrilldowns.find((task) => task?.state_index_sidecar_projection);
  if (!stateIndexSidecarExample) {
    throw new Error('OPL App state golden fixture must include a State Index sidecar read-model projection example.');
  }
  validateStateIndexSidecarFixture(
    stateIndexSidecarExample.state_index_sidecar_projection,
    'OPL App state golden fixture State Index sidecar projection',
  );
  const artifactNativeDrilldownExample = taskDrilldowns.find((task) => task?.artifact_native_drilldown);
  if (!artifactNativeDrilldownExample) {
    throw new Error('OPL App state golden fixture must include a Stage Artifact refs-only drilldown example.');
  }
  validateArtifactNativeDrilldownFixture(
    artifactNativeDrilldownExample.artifact_native_drilldown,
    'OPL App state golden fixture Stage Artifact drilldown',
  );
  const stageRunCockpitExample = taskDrilldowns.find(
    (task) => task?.stage_run_cockpit || task?.stage_run_current_owner_delta,
  );
  if (!stageRunCockpitExample) {
    throw new Error('OPL App state golden fixture must include a refs-only StageRun cockpit projection example.');
  }
  validateStageRunCockpitFixture(
    stageRunCockpitExample,
    'OPL App state golden fixture StageRun cockpit projection',
  );
}

function validateGoldenAppStateActiveProjects(fixture) {
  const activeProjectSummaryCard = (lookupPath(fixture, 'app_state.operator.workbench.summary_cards') ?? []).find(
    (card) => card?.card_id === 'active_projects',
  );
  if (!activeProjectSummaryCard) {
    throw new Error('OPL App state golden fixture must include an active_projects summary card.');
  }
  const activeProjects = lookupPath(fixture, 'app_state.operator.workbench.activity_center.active_projects');
  if (!Array.isArray(activeProjects) || activeProjects.length === 0) {
    throw new Error('OPL App state golden fixture must include activity_center.active_projects.');
  }
  const visualActiveProjectRefs = lookupPath(fixture, 'app_state.operator.visual_ref_groups.active_project_refs');
  if (!Array.isArray(visualActiveProjectRefs) || visualActiveProjectRefs.length === 0) {
    throw new Error('OPL App state golden fixture must include visual_ref_groups.active_project_refs.');
  }
  const queuedOrEscalatedProject = activeProjects.find((project) => ['queued', 'escalated'].includes(project?.status));
  if (!queuedOrEscalatedProject) {
    throw new Error('OPL App state golden fixture must include a queued or escalated active project line.');
  }
  for (const field of ['task_id', 'title', 'state', 'status', 'study_id', 'active_run_id', 'next_visible_step']) {
    if (!(field in queuedOrEscalatedProject)) {
      throw new Error(`OPL App state active project line must preserve ${field}.`);
    }
  }
  if (queuedOrEscalatedProject.active_worker_run === true || queuedOrEscalatedProject.provider_execution_running === true) {
    throw new Error('OPL App state active project line must not claim an active worker run.');
  }
}

function validateGoldenAppStateRequiredCollections(fixture) {
  for (const [pathName, label] of Object.entries({
    'app_state.operator.workbench.summary_cards': 'summary cards',
    'app_state.operator.workbench.sections': 'sections',
    'app_state.operator.workbench.activity_center.active_projects': 'active project lines',
    'app_state.operator.workbench.action_queue.items': 'action queue items',
    'app_state.operator.workbench.domain_lane_map.lanes': 'domain lanes',
    'app_state.operator.workbench.task_drilldowns': 'task drilldowns',
    'app_state.operator.workbench.safe_action_routes': 'safe action routes',
    'app_state.operator.workbench.lazy_refs': 'lazy refs',
    'app_state.operator.visual_ref_groups.active_project_refs': 'visual active project refs',
  })) {
    const value = lookupPath(fixture, pathName);
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`OPL App state golden fixture must include ${label}.`);
    }
  }
}

function validateCurrentOwnerDeltaCockpitFixture(fixture) {
  const label = 'OPL App state golden fixture current_owner_delta cockpit';
  const defaultReadSurfacePolicy = lookupPath(fixture, 'app_state.operator.default_read_surface_policy');
  const currentOwnerDelta = lookupPath(fixture, 'app_state.operator.current_owner_delta');
  const currentOwnerDeltaNextAction = lookupPath(fixture, 'app_state.operator.current_owner_delta_next_action');
  const ordinaryCockpit = lookupPath(fixture, 'app_state.operator.ordinary_cockpit');

  if (!defaultReadSurfacePolicy || typeof defaultReadSurfacePolicy !== 'object') {
    throw new Error(`${label} must include app_state.operator.default_read_surface_policy`);
  }
  if (!currentOwnerDelta || typeof currentOwnerDelta !== 'object') {
    throw new Error(`${label} must include app_state.operator.current_owner_delta`);
  }
  if (!currentOwnerDeltaNextAction || typeof currentOwnerDeltaNextAction !== 'object') {
    throw new Error(`${label} must include app_state.operator.current_owner_delta_next_action`);
  }
  if (!ordinaryCockpit || typeof ordinaryCockpit !== 'object') {
    throw new Error(`${label} must include app_state.operator.ordinary_cockpit`);
  }

  for (const [pathName, expected] of Object.entries({
    'app_state.operator.operator_next_action_source': 'current_owner_delta',
    'app_state.operator.default_read_surface_policy.default_operator_payload': 'ordinary_cockpit',
    'app_state.operator.default_read_surface_policy.default_planning_root': 'current_owner_delta',
    'app_state.operator.default_read_surface_policy.authority_boundary.raw_worklist_can_generate_default_next_action': false,
    'app_state.operator.default_read_surface_policy.authority_boundary.raw_evidence_can_generate_default_next_action': false,
    'app_state.operator.default_read_surface_policy.authority_boundary.can_claim_app_release_ready': false,
    'app_state.operator.default_read_surface_policy.authority_boundary.can_claim_production_ready': false,
    'app_state.operator.current_owner_delta.default_planning_root': 'current_owner_delta',
    'app_state.operator.current_owner_delta.ordinary_progress_spine.default_next_action_derives_from': 'current_owner_delta',
    'app_state.operator.current_owner_delta.ordinary_progress_spine.raw_worklist_can_generate_default_next_action': false,
    'app_state.operator.current_owner_delta.authority_boundary.raw_worklist_can_drive_default_planning': false,
    'app_state.operator.current_owner_delta.authority_boundary.can_claim_production_ready': false,
    'app_state.operator.current_owner_delta_next_action.derivation_source': 'current_owner_delta',
    'app_state.operator.current_owner_delta_next_action.default_planning_root': 'current_owner_delta',
    'app_state.operator.current_owner_delta_next_action.raw_worklist_can_drive_default_planning': false,
    'app_state.operator.current_owner_delta_next_action.can_claim_domain_ready': false,
    'app_state.operator.current_owner_delta_next_action.can_claim_production_ready': false,
    'app_state.operator.current_owner_delta_next_action.worklist_item_is_completion_claim': false,
    'app_state.operator.ordinary_cockpit.surface_kind': 'opl_app_ordinary_cockpit',
    'app_state.operator.ordinary_cockpit.display_payload_policy': 'purpose_task_current_owner_next_action_artifact_or_blocker_only',
    'app_state.operator.ordinary_cockpit.ordinary_progress_spine.default_next_action_derives_from': 'current_owner_delta',
    'app_state.operator.ordinary_cockpit.ordinary_progress_spine.raw_worklist_can_generate_default_next_action': false,
    'app_state.operator.ordinary_cockpit.display_payload.next_action.source_ref': 'app_state.operator.current_owner_delta',
    'app_state.operator.ordinary_cockpit.display_payload.artifact_or_blocker.content_policy': 'refs_only_no_artifact_or_receipt_body',
    'app_state.operator.ordinary_cockpit.authority_boundary.default_planning_root': 'current_owner_delta',
    'app_state.operator.ordinary_cockpit.authority_boundary.default_next_action_derives_from': 'derive_default_next_action_only_from_current_owner_delta',
    'app_state.operator.ordinary_cockpit.authority_boundary.can_claim_app_release_ready': false,
    'app_state.operator.ordinary_cockpit.authority_boundary.can_claim_production_ready': false,
  })) {
    const actual = lookupPath(fixture, pathName);
    if (actual !== expected) {
      throw new Error(`${label} ${pathName} must be ${expected}`);
    }
  }

  assertIncludesAll(
    currentOwnerDelta.ordinary_progress_spine?.default_next_action_must_not_derive_from,
    ['raw_worklist', 'raw_evidence', 'provider_trace', 'replay_packet', 'typed_blocker_group', 'private_residue_inventory', 'audit_sidecar'],
    `${label} current owner delta forbidden next-action sources`,
  );
  assertIncludesAll(
    ordinaryCockpit.display_payload_fields,
    ['purpose', 'task', 'current_owner', 'next_action', 'artifact_or_blocker'],
    `${label} ordinary cockpit display payload fields`,
  );
  assertIncludesAll(
    ordinaryCockpit.developer_full_drilldown_only,
    ['provider', 'ledger', 'worklist', 'mcp_tool_catalog', 'raw_receipts', 'release_evidence'],
    `${label} ordinary cockpit drilldown-only fields`,
  );
  for (const forbidden of [
    'raw_worklist',
    'raw_evidence',
    'provider_trace',
    'release_evidence',
    'app_release_ready',
    'production_ready',
    'domain_ready',
  ]) {
    if (Object.hasOwn(ordinaryCockpit.display_payload ?? {}, forbidden)) {
      throw new Error(`${label} ordinary cockpit display_payload must not include ${forbidden}`);
    }
  }
}

export function validateLiveOplConformance(runtimeBridge) {
  const gate = runtimeBridge.live_conformance_gate;
  validateLiveConformanceContract(gate);
  if (!resolveLiveGateEnabled(gate)) {
    return;
  }

  const oplRoot = process.env[gate.opl_root_env]?.trim();
  if (!oplRoot) {
    throw new Error(`Set ${gate.opl_root_env} to the local OPL Framework root when ${gate.enable_env}=1.`);
  }
  const resolvedOplRoot = path.resolve(oplRoot);
  assertFile(path.join(resolvedOplRoot, 'bin', 'opl'), 'live OPL ./bin/opl');

  const actionFixture = process.env[gate.action_fixture_env]?.trim();
  if (!actionFixture) {
    throw new Error(`Set ${gate.action_fixture_env} to a safe OPL App action id when ${gate.enable_env}=1.`);
  }

  const fast = runLiveJsonCommand(
    resolvedOplRoot,
    ['app', 'state', '--profile', 'fast', '--json'],
    'fast App state',
    gate.fast_state_max_bytes,
  );
  const full = runLiveJsonCommand(resolvedOplRoot, ['app', 'state', '--profile', 'full', '--json'], 'full App state');
  const action = runLiveJsonCommand(
    resolvedOplRoot,
    ['app', 'action', 'execute', '--action', actionFixture, '--dry-run', '--json'],
    'App action dry-run',
  );

  if (fast.stdoutBytes >= gate.fast_state_max_bytes) {
    throw new Error(`Live OPL fast App state must stay below ${gate.fast_state_max_bytes} bytes.`);
  }
  const declaredSchema = gate.state_schema_paths
    .map((schemaPath) => lookupPath(fast.payload, schemaPath))
    .find((value) => typeof value === 'string' && value.trim());
  if (declaredSchema !== gate.required_state_schema) {
    throw new Error(`Live OPL fast App state must declare ${gate.required_state_schema} schema/surface.`);
  }
  if (lookupPath(fast.payload, 'app_state.meta.profile') !== 'fast') {
    throw new Error('Live OPL fast App state must declare app_state.meta.profile=fast.');
  }
  if (lookupPath(full.payload, 'app_state.meta.profile') !== 'full') {
    throw new Error('Live OPL full App state must declare app_state.meta.profile=full.');
  }
  if (lookupPath(action.payload, 'app_action_execution.surface_kind') !== 'opl_app_action_execution.v1') {
    throw new Error('Live OPL App action dry-run must declare opl_app_action_execution.v1.');
  }
  if (lookupPath(action.payload, 'app_action_execution.dry_run') !== true) {
    throw new Error('Live OPL App action dry-run must return dry_run=true.');
  }

  console.log('Live OPL App state/action conformance passed.');
}

function validateRuntimeBridgeIdentity(runtimeBridge, contract) {
  if (runtimeBridge.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected runtime bridge owner: ${runtimeBridge.owner}`);
  }
  if (runtimeBridge.purpose !== 'runtime_bridge_abstraction') {
    throw new Error(`Unexpected runtime bridge purpose: ${runtimeBridge.purpose}`);
  }
  if (runtimeBridge.state !== 'active') {
    throw new Error(`Unexpected runtime bridge state: ${runtimeBridge.state}`);
  }
  if (isDefaultReleaseAdapter(contract) && runtimeBridge.active_adapter !== contract.active_shell) {
    throw new Error(`Runtime bridge active adapter must match active shell: ${runtimeBridge.active_adapter}`);
  }
  if (runtimeBridge.adapter_role !== 'replaceable_gui_shell_adapter') {
    throw new Error(`Unexpected runtime bridge adapter role: ${runtimeBridge.adapter_role}`);
  }
  if (runtimeBridge.protocol_owner !== 'one-person-lab') {
    throw new Error(`Unexpected runtime bridge protocol owner: ${runtimeBridge.protocol_owner}`);
  }
  if (runtimeBridge.ui_contract_owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected runtime bridge UI contract owner: ${runtimeBridge.ui_contract_owner}`);
  }
  if (isDefaultReleaseAdapter(contract) && runtimeBridge.default_adapter_repo !== contract.shell_source?.owner_repo) {
    throw new Error(`Runtime bridge adapter repo must match active shell source: ${runtimeBridge.default_adapter_repo}`);
  }
  if (isDefaultReleaseAdapter(contract) && runtimeBridge.default_adapter_path !== contract.shell_root) {
    throw new Error(`Runtime bridge adapter path must match active shell root: ${runtimeBridge.default_adapter_path}`);
  }
}

function validateRuntimeBridgeDeclaredSurfaces(runtimeBridge) {
  for (const [field, expected] of Object.entries({
    summary_command: 'opl app state --profile fast --json',
    refresh_command: 'opl app state --profile fast --json',
    default_operator_payload: 'current_owner_delta',
    full_state_command: 'opl app state --profile full --json',
    full_state_policy: 'diagnostic_or_release_evidence_only',
    full_detail_command: 'opl runtime app-operator-drilldown --detail full --json',
    runtime_page_full_detail_allowed: false,
    action_command: 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
    'projection_sources.primary': 'app_state.operator.workbench.work_item_projection_v2',
    'projection_sources.provider': 'runtime_tray_snapshot.app_operator_drilldown.current_control_state.states.provider_run',
    'projection_sources.actions': 'app_state.actions',
    'projection_sources.full_detail': 'runtime_tray_snapshot.app_operator_drilldown',
    'projection_sources.policy': 'work_item_projection_v2_primary_provider_projection_diagnostic_only',
  })) {
    const actual = field.split('.').reduce((value, key) => value?.[key], runtimeBridge);
    if (actual !== expected) {
      throw new Error(`Runtime bridge ${field} must be ${expected}`);
    }
  }
  if ('compatibility_operator_payload' in runtimeBridge) {
    throw new Error('Runtime bridge must not declare compatibility_operator_payload');
  }
  assertDeepEqualJson(
    runtimeBridge.full_detail_consumer_surfaces,
    ['/settings/advanced', 'release_evidence_tooling'],
    'Runtime bridge full detail consumer surfaces',
  );
}

function validateRuntimeBridgeDefaultReadSurfacePolicy(runtimeBridge) {
  const defaultReadSurfacePolicy = runtimeBridge.default_read_surface_policy;
  for (const [field, expected] of Object.entries({
    default_projection: 'opl_current_owner_delta',
    source_path: 'app_state.operator.default_read_surface_policy',
    foundry_agent_os_cockpit_policy: 'first_screen_current_owner_delta_only_raw_worklist_evidence_provider_trace_drilldown_only',
    default_next_action_source: 'current_owner_delta',
    raw_worklist_generates_default_next_action: false,
    release_evidence_counts_as_release_ready: false,
    stage_run_cockpit_projection_ref: 'contracts/app-runtime-bridge.json#stage_run_cockpit_projection',
    full_detail_policy: 'explicit_full_detail_or_lazy_diagnostic_only',
    raw_refs_policy: 'raw_refs_require_explicit_full_detail',
    full_detail_auto_poll: false,
    shell_must_not_use_full_drilldown_as_normal_state: true,
    shell_must_not_derive_layout_from_raw_runtime_projection: true,
  })) {
    if (defaultReadSurfacePolicy?.[field] !== expected) {
      throw new Error(`Runtime bridge default_read_surface_policy.${field} must be ${expected}`);
    }
  }
  if (defaultReadSurfacePolicy && 'compatibility_projection' in defaultReadSurfacePolicy) {
    throw new Error('Runtime bridge default_read_surface_policy must not declare compatibility_projection');
  }
  for (const field of [
    'next_safe_action_or_none',
    'current_owner',
    'required_delta',
    'accepted_return_shapes',
    'readiness_false_flags',
    'count_summary',
  ]) {
    if (!defaultReadSurfacePolicy?.first_screen_answers?.includes(field)) {
      throw new Error(`Runtime bridge default_read_surface_policy.first_screen_answers must include ${field}`);
    }
  }
  for (const field of [
    'runtime_tray_snapshot',
    'raw_evidence_envelope',
    'stage_replay_packet_body',
    'private_residue_inventory_body',
    'provider_internal_ledger_body',
  ]) {
    if (!defaultReadSurfacePolicy?.forbidden_default_state_fields?.includes(field)) {
      throw new Error(`Runtime bridge default_read_surface_policy.forbidden_default_state_fields must include ${field}`);
    }
  }
}

function validateRuntimeBridgeUserTaskStatus(runtimeBridge) {
  validateUserTaskStatusProjectionContract(
    runtimeBridge.user_task_status_projection,
    'Runtime bridge user task status projection',
    runtimeBridge.stage_run_cockpit_projection,
  );
  if (runtimeBridge.user_task_status_projection?.app_role !== 'display_only_user_task_status_consumer') {
    throw new Error('Runtime bridge user task status projection must be a display-only consumer');
  }
}

export function validateRuntimeProgressPageDisplayPolicy(runtimeBridge) {
  const policy = runtimeBridge.runtime_progress_page_display_policy;
  if (policy?.owner !== 'one-person-lab-app') {
    throw new Error('Runtime progress page display policy must be App-owned');
  }
  if (policy?.default_surface !== 'work_item_projection_v2_list') {
    throw new Error('Runtime progress page default surface must be WorkItemProjection v2 list');
  }
  if (policy?.advanced_surface !== 'selected_work_item_stage_popover_or_detail_drawer') {
    throw new Error('Runtime progress page advanced surface must be selected work-item detail only');
  }
  if (policy?.page_role !== 'minimal_project_work_status_not_platform_operations') {
    throw new Error('Runtime progress page must be project work status, not platform operations');
  }
  if (policy?.work_item_projection_ref !== 'contracts/app-runtime-bridge.json#work_item_projection') {
    throw new Error('Runtime progress page must point at the canonical WorkItemProjection contract');
  }
  if (policy?.detail_layer_ref !== 'contracts/app-runtime-bridge.json#work_item_projection.detail_layer_contract') {
    throw new Error('Runtime progress page must point at the WorkItemProjection detail layer contract');
  }
  assertDeepEqualJson(policy?.default_task_row_spine, [
    'project_and_work_item',
    'status',
    'progress_and_next_step',
    'elapsed_and_tokens',
  ], 'Runtime progress page default task row spine');
  assertDeepEqualJson(policy?.default_page_sections, [
    'top_scope_and_refresh',
    'compact_status_filter',
    'archived_tasks_entry',
    'work_item_list',
  ], 'Runtime progress page default sections');
  assertDeepEqualJson(policy?.layout_regions, {
    top: ['top_scope_and_refresh', 'compact_status_filter', 'archived_tasks_entry'],
    main: ['work_item_list'],
  }, 'Runtime progress page layout regions');
  assertIncludesAll(policy?.default_field_allowlist ?? [], [
    'identity.project_display_name',
    'identity.work_item_display_name',
    'identity.agent_display_name',
    'lifecycle.primary_state',
    'visibility.state',
    'execution.state',
    'execution.current_stage_display_name',
    'execution.next_stage_display_name',
    'telemetry.elapsed',
    'telemetry.current_stage_tokens',
    'telemetry.task_total_tokens',
    'action.title_key',
    'action.message_args',
    'action.owner',
    'action.owner_kind',
  ], 'Runtime progress page default field allowlist');
  assertIncludesAll(policy?.default_visible_field_groups?.work_item_list ?? [], [
    'identity.project_display_name',
    'identity.work_item_display_name',
    'identity.agent_display_name',
    'lifecycle.primary_state',
    'visibility.state',
    'execution.state',
    'execution.current_stage_display_name',
    'execution.next_stage_display_name',
    'telemetry.elapsed',
    'telemetry.current_stage_tokens',
    'telemetry.task_total_tokens',
    'action.title_key',
    'action.message_args',
    'action.owner',
    'action.owner_kind',
  ], 'Runtime progress page work item list fields');
  for (const forbiddenField of [
    'action.title_args',
    'action.summary_args',
    'action.copy_locale',
    'visibility.token',
    'identity.generation',
  ]) {
    if (
      policy?.default_field_allowlist?.includes(forbiddenField)
      || Object.values(policy?.default_visible_field_groups ?? {}).some(
        (fields) => Array.isArray(fields) && fields.includes(forbiddenField),
      )
    ) {
      throw new Error(`Runtime progress page must not consume nonexistent field ${forbiddenField}`);
    }
  }
  const defaultFieldAllowlist = new Set(policy?.default_field_allowlist ?? []);
  for (const [groupName, fields] of Object.entries(policy?.default_visible_field_groups ?? {})) {
    if (!Array.isArray(fields)) {
      throw new Error(`Runtime progress page default visible field group ${groupName} must be an array`);
    }
    for (const field of fields) {
      if (!defaultFieldAllowlist.has(field)) {
        throw new Error(`Runtime progress page default field ${groupName}.${field} must be included in default_field_allowlist`);
      }
    }
  }
  if (
    policy?.default_label_policy?.primary_state_label_render_owner !== 'shell_current_app_locale' ||
    policy?.default_label_policy?.action_label_render_owner !== 'shell_current_app_locale' ||
    policy?.default_label_policy?.framework_hardcoded_locale_copy_default_allowed !== false
  ) {
    throw new Error('Runtime progress page labels must render from semantic state/action fields in the current App locale');
  }
  if (
    policy?.task_deduplication_policy?.canonical_row_key !== 'item_id' ||
    policy?.task_deduplication_policy?.detail_selection_key !== 'item_id' ||
    policy?.task_deduplication_policy?.identity_work_item_id_scope !== 'project_local' ||
    policy?.task_deduplication_policy?.duplicate_local_work_item_id_across_projects_allowed !== true ||
    policy?.task_deduplication_policy?.dedupe_owner !== 'opl_framework' ||
    policy?.task_deduplication_policy?.one_row_per_work_item !== true ||
    policy?.task_deduplication_policy?.shell_heuristic_deduplication_allowed !== false ||
    policy?.task_deduplication_policy?.module_runtime_rows_policy !==
    'module_runtime_and_module_health_never_enter_runtime_page_route_to_settings'
  ) {
    throw new Error('Runtime progress page must project one canonical row per work item and keep module runtime separate');
  }
  if (policy?.task_deduplication_policy?.raw_duplicate_refs_default_visible !== false) {
    throw new Error('Runtime progress page raw duplicate refs must stay hidden by default');
  }
  const visibilityPolicy = policy?.work_item_visibility_policy;
  assertDeepEqualJson(
    visibilityPolicy?.axis_values,
    ['visible', 'archived'],
    'Runtime progress page visibility axis values',
  );
  for (const [field, expected] of Object.entries({
    axis: 'work_item_projection.visibility.state',
    default_list_visibility: 'visible',
    archived_library_visibility: 'archived',
    archived_library_is_saved_status_view: false,
    archived_library_scope: 'same_agent_then_project_scope',
    status_filters_include_agent_project_or_visibility: false,
    restore_returns_item_to_default_list: true,
    local_storage_truth_allowed: false,
    mutation_contract_ref:
      'contracts/app-runtime-bridge.json#work_item_projection.visibility_mutation_contract',
  })) {
    if (visibilityPolicy?.[field] !== expected) {
      throw new Error(`Runtime progress page visibility ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    policy?.next_step_copy_policy?.source_priority,
    ['action.title_key + action.message_args', 'action.summary_key + action.message_args'],
    'Runtime progress page next-step semantic source priority',
  );
  assertDeepEqualJson(
    policy?.next_step_copy_policy?.compatibility_fallback_fields,
    ['action.title', 'action.summary'],
    'Runtime progress page next-step compatibility fallback fields',
  );
  if (
    policy?.next_step_copy_policy?.render_owner !== 'shell_current_app_locale' ||
    policy?.next_step_copy_policy?.long_text_policy !==
      'framework_projects_locale_independent_action_semantics_shell_renders_current_app_locale' ||
    policy?.next_step_copy_policy?.compatibility_fallback_only !== true ||
    policy?.next_step_copy_policy?.cross_locale_raw_fallback_allowed !== false ||
    policy?.next_step_copy_policy?.missing_semantics_policy !==
      'localized_generic_action_copy_from_action_kind'
  ) {
    throw new Error('Runtime progress page must render Framework action semantics in the current App locale');
  }
  if (policy?.next_step_copy_policy?.raw_route_or_command_default_visible !== false) {
    throw new Error('Runtime progress page raw route/command next steps must stay hidden by default');
  }
  assertDeepEqualJson(
    policy?.responsive_acceptance?.viewport_widths_px,
    [375, 768, 1024, 1440],
    'Runtime progress page responsive viewport matrix',
  );
  if (
    policy?.responsive_acceptance?.desktop_layout !== 'four_columns' ||
    policy?.responsive_acceptance?.narrow_layout !== 'semantic_row_reflow' ||
    policy?.responsive_acceptance?.horizontal_page_overflow_allowed !== false ||
    policy?.responsive_acceptance?.text_overlap_allowed !== false
  ) {
    throw new Error('Runtime progress page must reflow without horizontal page overflow or text overlap');
  }
  assertDeepEqualJson(policy?.advanced_only_fields, [
    'raw_proof_ref',
    'receipt_refs',
    'stage_attempt_ids',
    'run_id',
    'active_run_id',
    'workflow_id',
    'workflow_refs',
    'raw_blocker_route',
    'typed_blocker_resolution_ref',
    'raw_readback',
    'readback_ref',
    'readback_text',
    'runtime_readback_ref',
    'runtime_closeout_ref',
    'mas_owner_consumption_ref',
    'mas_owner_consumed_stage_attempt_id',
    'mas_currentness_drift_text',
    'provider',
    'projection',
    'ledger',
    'current_control_state',
    'full_drilldown',
  ], 'Runtime progress page advanced-only fields');
  assertDeepEqualJson(policy?.surface_exclusions?.runtime_page_forbidden, [
    'operator_summary',
    'safe_action_catalog',
    'software_install_or_update_actions',
    'platform_repair_actions',
    'module_health_panel',
    'provider_diagnostics',
    'raw_runtime_readback',
  ], 'Runtime progress page forbidden surfaces');
  assertDeepEqualJson(policy?.surface_exclusions?.settings_owner_routes, {
    software_updates: '/settings/environment?section=updates',
    platform_repair: '/settings/environment?section=services',
    module_management: '/settings/capabilities',
    diagnostics: '/settings/advanced',
  }, 'Runtime progress page Settings routes');
  const stagePopover = runtimeBridge.work_item_projection?.stage_popover_contract;
  assertDeepEqualJson(stagePopover?.required_fields, [
    'stage_map',
    'stage_map[].display_names',
    'execution.current_stage_display_name',
    'execution.next_stage_display_name',
    'execution.attempt_id',
  ], 'Runtime Stage popover required fields');
  assertDeepEqualJson(stagePopover?.viewport_widths_px, [375, 768, 1024, 1440], 'Runtime Stage popover viewports');
  for (const [field, expected] of Object.entries({
    trigger_field: 'execution.current_stage_display_name',
    trigger_does_not_open_task_drawer: true,
    label_source: 'stage_map[].display_names[current_app_locale]',
    label_fallback: 'stage_map[].display_name',
    locale_owner: 'shell_current_app_locale',
    current_attempt_visible_here: true,
    current_attempt_default_row_visible: false,
    historical_attempt_ids_visible: false,
    horizontal_overflow_allowed: false,
  })) {
    if (stagePopover?.[field] !== expected) {
      throw new Error(`Runtime Stage popover ${field} must be ${expected}`);
    }
  }
  for (const claim of [
    'second_runtime_truth_source',
    'live_runtime_readiness',
    'release_currentness',
    'owner_receipt_authority',
    'shell_runtime_truth',
  ]) {
    if (!policy?.forbidden_claims?.includes(claim)) {
      throw new Error(`Runtime progress page display policy must forbid ${claim}`);
    }
  }
}

function validateRuntimeBridgeCommandResolutionPolicy(runtimeBridge) {
  const commandResolutionPolicy = runtimeBridge.command_resolution_policy;
  if (commandResolutionPolicy?.owner !== 'one-person-lab-app') {
    throw new Error('Runtime bridge command resolution policy must be App-owned');
  }
  if (commandResolutionPolicy?.adapter_responsibility !== 'resolve_healthy_opl_cli_before_running_declared_surfaces') {
    throw new Error('Runtime bridge command resolution policy must require healthy OPL CLI resolution');
  }
  if (commandResolutionPolicy?.managed_opl_priority !== 'prefer_only_when_shim_targets_existing_cli_payload') {
    throw new Error('Runtime bridge must prefer managed OPL only when its shim targets an existing CLI payload');
  }
  if (commandResolutionPolicy?.broken_managed_shim_policy !== 'skip_and_fall_through_to_system_opl') {
    throw new Error('Runtime bridge must skip broken managed OPL shims and fall through to system OPL');
  }
  for (const fallbackPath of ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']) {
    if (!commandResolutionPolicy?.system_opl_fallback_paths?.includes(fallbackPath)) {
      throw new Error(`Runtime bridge command resolution policy must include fallback path ${fallbackPath}`);
    }
  }
  for (const forbidden of [
    'let stale managed Node opl shims shadow a healthy system opl',
    'rewrite App runtime truth from shell-private state',
    'treat missing managed bootstrap artifacts as first-run UI truth',
  ]) {
    if (!commandResolutionPolicy?.must_not?.includes(forbidden)) {
      throw new Error(`Runtime bridge command resolution policy must forbid: ${forbidden}`);
    }
  }
  const sharedGuiTarget = commandResolutionPolicy?.shared_gui_target;
  for (const [field, expected] of Object.entries({
    implementation_status: 'candidate_launcher_runtime_identity_implemented_active_shell_parity_not_proven',
    identity_readback_schema: 'app_runtime_executable_identity.v1',
    producer: 'app_host_runtime_resolver',
    producer_status: 'implemented_for_local_gui_launcher',
  })) {
    if (sharedGuiTarget?.[field] !== expected) {
      throw new Error(`Runtime bridge shared GUI command resolver target ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(sharedGuiTarget?.required_executables, ['opl', 'codex'], 'Shared GUI runtime executables');
  assertIncludesAll(
    sharedGuiTarget?.required_readback_fields,
    ['opl_path', 'opl_version', 'codex_path', 'codex_version', 'runtime_cohort_ref'],
    'Shared GUI runtime identity readback',
  );
}

function validateSharedGuiRuntimeResolutionPolicy(runtimeBridge) {
  const policy = runtimeBridge.shared_gui_runtime_resolution_policy;
  for (const [field, expected] of Object.entries({
    state: 'target_with_native_candidate_deviation',
    policy_owner: 'one-person-lab-app',
    runtime_identity_owner: 'one-person-lab',
    resolver_source: 'contracts/app-runtime-bridge.json#command_resolution_policy.shared_gui_target',
    logical_control_plane_shared: true,
    same_cohort_runtime_identity_required_for_parity: true,
    host_path_only_resolution_can_prove_parity: false,
    active_aionui_status: 'managed_or_packaged_runtime_resolution',
    opl_native_workbench_status: 'launcher_explicit_runtime_resolution_implemented_direct_launch_host_path_fallback_remains',
    same_physical_runtime_currently_claimed: false,
    implementation_status: 'candidate_launcher_only_active_shell_parity_not_proven',
  })) {
    if (policy?.[field] !== expected) {
      throw new Error(`Runtime bridge shared GUI runtime resolution policy ${field} must be ${expected}`);
    }
  }
}

function validateCanonicalConversationContinuityPolicy(runtimeBridge) {
  const policy = runtimeBridge.canonical_conversation_continuity_policy;
  for (const [field, expected] of Object.entries({
    state: 'target_with_current_shell_deviations',
    thread_truth_owner: 'codex_core_app_server',
    canonical_identity: 'host_identity_plus_opaque_app_server_thread_id',
    ordinary_rail_authority: 'codex_app_server_thread_list_read_resume',
    shell_local_storage_role: 'ui_preferences_drafts_and_rebuildable_cache_only',
    shell_can_own_thread_history: false,
    codex_session_directory_authority: 'canonical_app_server_thread_overview_when_available',
    canonical_overview_unavailable_policy: 'fallback_to_shell_cache_without_reclassifying_cache_as_authority',
    stale_codex_acp_cache_row_policy:
      'exclude_from_ordinary_projection_when_absent_from_available_canonical_overview',
    non_codex_local_row_policy: 'preserve',
    direct_cross_shell_private_store_access_allowed: false,
    duplicate_thread_store_allowed: false,
    simultaneous_same_thread_write_safety_claimed: false,
    active_aionui_status: 'shell_local_conversation_repository_requires_canonical_projection',
    opl_native_workbench_status: 'resume_capable_full_local_transcript_cache_requires_canonical_thread_directory',
    pin_role: 'shell_ui_metadata_only',
    local_reset_role: 'retain_existing_aionui_conversation_semantics_not_app_server_history_reset',
    same_idempotency_key_retry_policy: 'return_first_receipt_and_result_with_ok_true_without_second_dispatch',
    workspace_directory_role: 'new_session_initial_cwd_mutable_cwd_grouping_and_visible_metadata_only_not_authorization_domain',
    row_identity: 'canonical_thread_id',
    duplicate_row_per_canonical_thread_allowed: false,
    title_based_deduplication_allowed: false,
    e2e_fixture_storage_policy: 'isolated_storage_root_never_production_user_data',
    acceptance: 'both_shells_project_the_same_app_server_thread_directory_and_resume_by_canonical_identity',
    implementation_status: 'target_not_proven_across_both_shells',
  })) {
    if (policy?.[field] !== expected) {
      throw new Error(`Runtime bridge canonical conversation continuity policy ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    policy?.required_operations,
    [
      'thread/list',
      'thread/read',
      'thread/resume',
      'thread/name/set',
      'thread/archive',
      'thread/unarchive',
      'thread/delete',
    ],
    'Canonical conversation continuity operations',
  );
  assertIncludesAll(
    policy?.archive_restore_operations,
    ['thread/archive', 'thread/unarchive'],
    'Canonical conversation archive and restore operations',
  );
  assertDeepEqualJson(
    policy?.task_action_protocols,
    {
      rename: 'thread/name/set',
      archive: 'thread/archive',
      restore: 'thread/unarchive',
      delete: 'thread/delete',
    },
    'Canonical conversation task action protocols',
  );
  assertDeepEqualJson(
    policy?.directory_group_policy,
    {
      source: 'canonical_session_cwd_projection',
      role: 'presentation_and_new_session_cwd_shortcut_only',
      owns_sessions: false,
      owns_context: false,
      owns_artifacts: false,
      group_delete_action_allowed: false,
      cascade_session_delete_allowed: false,
      new_session_action_language: 'use_this_working_directory_not_create_project_child',
    },
    'Canonical conversation directory group policy',
  );
}

function validateCodexParityAdapterPolicies(runtimeBridge) {
  assertDeepEqualJson(
    runtimeBridge.codex_local_worktree_handoff_policy,
    appOwnedRuntimeBridgeLocalWorktreeHandoffPolicy,
    'Codex Local and Worktree handoff policy',
  );
  assertDeepEqualJson(
    runtimeBridge.codex_review_surface_policy,
    {
      state: 'source_partial_last_turn_and_focus_context_implemented_inline_comments_protocol_blocked',
      host_surface: 'existing_files_changes_diff_surface',
      review_targets: ['uncommitted', 'base_branch', 'commit', 'custom'],
      delivery_modes: ['inline', 'detached'],
      default_section: 'unstaged',
      sections: ['unstaged', 'staged', 'commit', 'branch', 'last_turn'],
      capabilities: ['pull_request_context', 'inline_comments', 'stage', 'commit', 'push'],
      source_capability_status: {
        last_turn: 'source_implemented_existing_message_store',
        review_focus_context: 'source_implemented_same_review_turn_steer_expected_turn_id',
        inline_comments: 'source_blocked_missing_typed_codex_protocol',
      },
      last_turn_source_policy: 'latest_visible_user_message_then_completed_workspace_edit_tool_calls',
      review_focus_delivery_policy:
        'non_custom_target_plain_text_turn_steer_same_review_thread_expected_turn_id_custom_instructions_not_duplicated',
      review_focus_failure_policy: 'typed_failure_without_success_on_steer_failure_stale_or_ended_turn',
      inline_comment_protocol_requirement:
        'typed_codex_app_server_file_line_comment_request_location_and_failure_semantics',
      inline_comment_forbidden_fallbacks: ['shell_local_annotation_store', 'fake_success'],
      pull_request_context_dependency: 'gh',
      pull_request_context_unavailable_policy: 'show_explicit_unavailable_state',
      git_authority: 'existing_codex_git_integration',
      shell_role: 'thin_adapter_only',
      duplicate_git_store_allowed: false,
    },
    'Codex Review surface policy',
  );
}

function validateRuntimeBridgeProjectionContracts(runtimeBridge) {
  validateWorkItemProjectionContract(
    runtimeBridge.work_item_projection,
    'Runtime bridge WorkItemProjection',
  );
  validateAgentAvailabilityProjectionContract(
    runtimeBridge.agent_availability_projection,
    'Runtime bridge agent availability projection',
  );
  validateProjectProgressDisplayContract(runtimeBridge.project_progress_projection, 'Runtime bridge project progress projection');
  validateProgressDeltaDisplayContract(
    runtimeBridge.progress_delta_projection,
    'Runtime bridge progress delta projection',
  );
  validateProviderReadinessRepairProjectionContract(
    runtimeBridge.provider_readiness_repair_projection,
    'Runtime bridge provider readiness repair projection',
  );
  validateStateIndexSidecarProjectionContract(
    runtimeBridge.state_index_sidecar_projection,
    'Runtime bridge State Index sidecar projection',
  );
  validateArtifactNativeDrilldownProjectionContract(
    runtimeBridge.artifact_native_drilldown_projection,
    'Runtime bridge Stage Artifact drilldown projection',
    { requireProvenanceBundle: true },
  );
  validateArtifactProvenanceBundleProjectionContract(
    runtimeBridge.artifact_provenance_bundle_projection,
    'Runtime bridge Artifact Provenance Bundle projection',
  );
  validateStructuredResultPanelProjectionContract(
    runtimeBridge.structured_result_panel_projection,
    'Runtime bridge structured result panel projection',
  );
  validateRefLevelFollowUpProjectionContract(
    runtimeBridge.ref_level_follow_up_projection,
    'Runtime bridge ref-level follow-up projection',
  );
  validateWorkflowSkillCandidateProjectionContract(
    runtimeBridge.workflow_skill_candidate_projection,
    'Runtime bridge workflow/skill candidate projection',
  );
  validateRuntimeScopeProjectionContract(
    runtimeBridge.runtime_scope_projection,
    'Runtime bridge runtime scope projection',
  );
  validateOpenScienceConsoleProjectionContract(
    runtimeBridge.openscience_console_projection,
    'Runtime bridge OpenScience Console projection',
  );
  validateStageRunCockpitProjectionContract(
    runtimeBridge.stage_run_cockpit_projection,
    'Runtime bridge StageRun cockpit projection',
  );
  const advancedOperator = runtimeBridge.advanced_operator_drilldown;
  if (
    advancedOperator?.command !== 'opl runtime app-operator-drilldown --json'
    || advancedOperator.runtime_page_allowed !== false
  ) {
    throw new Error('Runtime bridge operator drilldown must stay outside Runtime');
  }
  assertDeepEqualJson(
    advancedOperator.consumer_surfaces,
    ['/settings/advanced', 'release_evidence_tooling'],
    'Runtime bridge operator drilldown consumer surfaces',
  );
  if (
    runtimeBridge.running_task_projection?.consumer_surface !== '/settings/advanced'
    || runtimeBridge.running_task_projection.runtime_page_visible !== false
  ) {
    throw new Error('Runtime bridge provider-attempt projection must be Settings Advanced only');
  }
}

function validatePackageReadinessProjection(runtimeBridge) {
  const rows = runtimeBridge.canonical_state_display_action_map?.rows;
  const runtimeRow = Array.isArray(rows) ? rows.find((row) => row?.semantic_area === 'runtime') : null;
  const packageRow = Array.isArray(rows) ? rows.find((row) => row?.semantic_area === 'package') : null;
  if (
    runtimeRow?.canonical_source !==
      'opl app state --profile fast --json#app_state.operator.workbench.work_item_projection_v2'
    || runtimeRow.aion_display_role !==
      'minimal WorkItem status, Stage, Attempt, Token, next action, and archive/restore'
    || runtimeRow.workbench_display_role !== 'same minimal WorkItem status contract'
  ) {
    throw new Error('Runtime bridge canonical Runtime row must use the minimal WorkItemProjection v2 contract');
  }
  assertDeepEqualJson(
    runtimeRow.allowed_action_refs,
    ['work_item_visibility_set'],
    'Runtime bridge canonical Runtime actions',
  );
  if (
    runtimeRow.fallback_policy?.allowed_fallback_source !== 'selected item from work_item_projection_v2'
    || runtimeRow.fallback_policy.allowed_when !== 'selected work item core detail only'
    || runtimeRow.fallback_policy.operator_drilldown_allowed !== false
  ) {
    throw new Error('Runtime bridge canonical Runtime fallback must remain selected-item-only');
  }
  const advancedDetail = runtimeBridge.canonical_state_display_action_map?.advanced_detail_surface;
  if (
    advancedDetail?.command !== 'opl runtime app-operator-drilldown --detail full --json'
    || advancedDetail.runtime_page_allowed !== false
  ) {
    throw new Error('Runtime bridge advanced detail must stay outside Runtime');
  }
  assertDeepEqualJson(
    advancedDetail.consumer_surfaces,
    ['/settings/advanced', 'release_evidence_tooling'],
    'Runtime bridge advanced detail consumer surfaces',
  );
  if (
    packageRow?.canonical_source !==
    'opl app state --profile fast --json#app_state.agent_packages.directory.entries + app_state.agent_packages.status_index + app_state.runtime_source_carriers.items[]'
  ) {
    throw new Error('Runtime bridge package rows must use directory.entries as collection truth plus diagnostic enrichments');
  }
  assertDeepEqualJson(
    packageRow?.required_projection_fields?.['directory.entries[]'],
    agentPackageDirectoryEntryFields,
    'Runtime bridge package directory entry fields',
  );
  assertIncludesAll(
    packageRow?.allowed_action_refs,
    ['agent_package_repair', 'agent_package_activate'],
    'Runtime bridge package repair and activation actions',
  );
  if (packageRow?.allowed_action_refs?.includes('repair_dependency_closure')) {
    throw new Error('Runtime bridge package actions must not expose legacy repair_dependency_closure');
  }
  assertDeepEqualJson(
    packageRow?.required_projection_fields?.['status_index.packages[package_id]'],
    ['surface_kind', 'package_id', 'status', 'package_version', 'installed_version', 'version', 'source_kind', 'package_lock_ref', 'lock_ref', 'action_receipt_ref', 'rollback_ref', 'physical_surface', 'codex_visible', 'capability_exposure', 'dependency_readiness', 'package_dependency_readiness', 'materialization_readiness', 'runtime_source_readiness', 'operational_ready', 'operational_ready_scope', 'launch_allowed', 'launch_blocked_reason', 'allowed_when_blocked', 'repair_action', 'repair_command', 'activation_action', 'dependent_guard', 'currentness_detail_deferred', 'detail_surface', 'status_read_error'],
    'Runtime bridge canonical package status diagnostic fields',
  );
  assertDeepEqualJson(
    packageRow?.optional_enrichment_fields?.['runtime_source_carriers.items[package_id]'],
    ['source_origin', 'source_path', 'source_policy', 'git'],
    'Runtime bridge optional active source diagnostic fields',
  );
  assertDeepEqualJson(
    packageRow?.use_boundary_activation_contract,
    {
      action_id: 'agent_package_activate',
      action_route: 'opl app action execute --action agent_package_activate --payload <json> --json',
      trigger: 'before_every_installed_package_workspace_or_quest_launch',
      payload_fields: ['package_id', 'scope', 'target_workspace', 'target_quest', 'use_boundary_id'],
      scope_values: ['workspace', 'quest'],
      scope_target_policy: {
        workspace: 'target_workspace_required_target_quest_forbidden',
        quest: 'target_quest_required_target_workspace_forbidden',
      },
      result_fields: ['launch_allowed', 'use_receipt_ref', 'use_binding'],
      launch_policy: 'launch_only_when_launch_allowed_true_and_use_receipt_ref_and_use_binding_are_present',
      currentness_policy: 'framework_reconciles_latest_stable_compatible_package_closure_once_at_use_boundary_and_pins_use_binding_for_the_session',
      package_identity_policy: 'generic_package_id_no_hardcoded_agent_or_capability_package_ids',
      app_role: 'prepare_then_launch_using_framework_readback_without_owning_package_currentness_or_materialization',
    },
    'Runtime bridge package use-boundary activation contract',
  );
  if (
    !packageRow?.projection_authority_policy?.includes('directory.entries owns catalog membership')
    || !packageRow.projection_authority_policy.includes('cannot override directory lifecycle, readiness, or exact actions')
    || !packageRow.projection_authority_policy.includes('canonical dependency_readiness')
    || packageRow?.fallback_policy?.manageable_collection_fallback !== null
    || packageRow?.fallback_policy?.can_define_collection_membership !== false
    || packageRow?.fallback_policy?.can_define_actions !== false
    || packageRow?.fallback_policy?.canonical_directory_absent_policy !==
      'show loading, empty, last-good stale, or failed without synthesizing rows or actions'
  ) {
    throw new Error('Runtime bridge package projection must keep directory entries and actions authoritative without a fallback collection');
  }
  if (
    Object.hasOwn(packageRow?.required_projection_fields ?? {}, 'directory.installed_packages[]')
    || Object.hasOwn(packageRow?.optional_enrichment_fields ?? {}, 'status_index.packages[package_id]')
  ) {
    throw new Error('Runtime bridge package projection must not retain installed_packages or demote canonical status-index diagnostics to optional legacy enrichment');
  }
}

function validateRuntimeSurfaceOwnerMatrix(runtimeBridge) {
  const matrix = runtimeBridge.runtime_surface_owner_matrix;
  for (const [field, expected] of Object.entries({
    purpose: 'keep_runtime_resource_task_data_lifecycle_refs_single_sourced',
    app_policy_owner: 'one-person-lab-app',
    family_projection_owner: 'one-person-lab',
    active_shell_role: 'thin_renderer_consumer',
    distribution_mirror_role: 'release_transport_only',
  })) {
    if (matrix?.[field] !== expected) {
      throw new Error(`Runtime surface owner matrix ${field} must be ${expected}`);
    }
  }
  const rows = matrix?.surface_rows;
  if (!Array.isArray(rows) || rows.length !== 5) {
    throw new Error('Runtime surface owner matrix must declare five surface rows');
  }
  const rowBySurface = new Map(rows.map((row) => [row?.surface, row]));
  for (const [surface, owner] of Object.entries({
    'OPL Runtime Fabric': 'one-person-lab-app',
    'Environment Materializer': 'one-person-lab',
    'TaskRunProjection v2': 'one-person-lab',
    'OPL Fabric resource refs': 'one-person-lab',
    'Local data lifecycle': 'one-person-lab-app',
  })) {
    const row = rowBySurface.get(surface);
    if (row?.source_owner !== owner) {
      throw new Error(`Runtime surface owner matrix ${surface} source_owner must be ${owner}`);
    }
    if (typeof row?.producer_owner !== 'string' || !row.producer_owner) {
      throw new Error(`Runtime surface owner matrix ${surface} must declare producer_owner`);
    }
    if (!Array.isArray(row?.forbidden_second_truth) || row.forbidden_second_truth.length === 0) {
      throw new Error(`Runtime surface owner matrix ${surface} must declare forbidden_second_truth`);
    }
  }
  if (!matrix?.homebrew_policy?.includes('must not decide runtime, task, resource, data lifecycle')) {
    throw new Error('Runtime surface owner matrix must keep Homebrew as release transport only');
  }
  for (const forbidden of [
    'second_resource_state_machine',
    'shell_owned_task_queue',
    'app_owned_domain_receipts',
    'homebrew_currentness_gate',
    'health_platform_runtime_authority',
  ]) {
    if (!matrix?.must_not_add_layers?.includes(forbidden)) {
      throw new Error(`Runtime surface owner matrix must forbid ${forbidden}`);
    }
  }
}

function validateRuntimeBridgeAuthorityBoundary(runtimeBridge) {
  for (const [field, expected] of Object.entries({
    shell_adapter_can_own_runtime_truth: false,
    app_can_own_runtime_truth: false,
    app_can_write_domain_truth: false,
    app_can_read_artifact_body: false,
    app_can_read_memory_body: false,
    app_can_authorize_quality_verdict: false,
    app_can_authorize_export_verdict: false,
    app_can_write_sqlite_sidecar: false,
    app_can_mutate_state_index_kernel: false,
    app_can_write_owner_receipt: false,
    app_can_authorize_readiness: false,
    app_can_authorize_artifact_authority: false,
    provider_completion_is_domain_ready: false,
  })) {
    if (runtimeBridge.authority_boundary?.[field] !== expected) {
      throw new Error(`Runtime bridge authority_boundary.${field} must be ${expected}`);
    }
  }
}

function validateRuntimeBridgeReplacementPolicy(runtimeBridge) {
  for (const [field, expected] of Object.entries({
    runtime_protocol_stable_across_shell_replacement: true,
    shell_adapter_must_call_declared_opl_cli_surfaces: true,
    new_shell_adapter_must_pass_active_shell_validation: true,
    direct_domain_repo_reads_are_forbidden: true,
    direct_runtime_state_file_reads_are_forbidden: true,
    direct_sqlite_sidecar_reads_are_forbidden: true,
    direct_state_index_kernel_writes_are_forbidden: true,
  })) {
    if (runtimeBridge.replacement_policy?.[field] !== expected) {
      throw new Error(`Runtime bridge replacement_policy.${field} must be ${expected}`);
    }
  }
}

function validateRuntimeBridgeForbiddenTruthSources(runtimeBridge) {
  for (const forbidden of [
    'direct_domain_repo_reads',
    'direct_runtime_state_file_reads',
    'direct_opl_internal_state_file_reads',
    'direct_opl_sqlite_sidecar_reads',
    'direct_state_index_kernel_file_reads',
    'direct_state_index_kernel_writes',
    'domain_artifact_body_reads',
    'domain_memory_body_reads',
    'shell_private_runtime_status',
    'shell_local_storage_work_item_visibility',
  ]) {
    if (!runtimeBridge.forbidden_truth_sources?.includes(forbidden)) {
      throw new Error(`Runtime bridge must forbid ${forbidden}`);
    }
  }
}

export function validateRuntimeBridgeContract(runtimeBridge, contract) {
  validateRuntimeBridgeIdentity(runtimeBridge, contract);
  validateRuntimeBridgeDeclaredSurfaces(runtimeBridge);
  validateOplGatewayAccountContract(runtimeBridge);
  validateRuntimeBridgeDefaultReadSurfacePolicy(runtimeBridge);
  validateRuntimeProgressPageDisplayPolicy(runtimeBridge);
  validateRuntimeBridgeCommandResolutionPolicy(runtimeBridge);
  validateSharedGuiRuntimeResolutionPolicy(runtimeBridge);
  validateCanonicalConversationContinuityPolicy(runtimeBridge);
  validateCodexParityAdapterPolicies(runtimeBridge);
  validateRuntimeBridgeProjectionContracts(runtimeBridge);
  validatePackageReadinessProjection(runtimeBridge);
  validateRuntimeBridgeUserTaskStatus(runtimeBridge);
  validateRuntimeSurfaceOwnerMatrix(runtimeBridge);
  validateRuntimeBridgeAuthorityBoundary(runtimeBridge);
  validateRuntimeBridgeReplacementPolicy(runtimeBridge);
  validateRuntimeBridgeForbiddenTruthSources(runtimeBridge);
  validateLiveConformanceContract(runtimeBridge.live_conformance_gate);
}
