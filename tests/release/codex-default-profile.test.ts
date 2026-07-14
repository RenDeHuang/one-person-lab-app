import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateAppGuiProductContract } from '../../scripts/validate-active-shell/gui-product-contract-validator.ts';
import { validatePrimaryInteractionPages } from '../../scripts/validate-active-shell/page-state-primary-interaction-validator.ts';
import { validateProductProfile } from '../../scripts/validate-active-shell/product-profile-validator.ts';
import {
  assertCurrentGuidHomeSelectionSources,
  assertProjectlessGuidFileAccessSources,
  assertRuntimePageSourceBoundary,
} from '../../scripts/validate-active-shell/shell-ordinary-experience-validator.ts';
import {
  assertCodexModelPolicyProjection,
  projectCodexModelPolicyContracts,
} from '../../scripts/app-product-profile/codex-model-policy-projection.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

const readModelPolicyBundle = () => ({
  productProfile: readJson('contracts/app-product-profile.json'),
  guiProductContract: readJson('contracts/app-gui-product-contract.json'),
  pageStateMatrix: readJson('contracts/app-page-state-matrix.json'),
  shellCandidates: readJson('contracts/app-shell-candidates.json'),
});

test('Codex interaction surfaces stay aligned across the App profile and contracts', () => {
  assert.doesNotThrow(() => assertCodexModelPolicyProjection(readModelPolicyBundle()));
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  assert.doesNotThrow(() => validateProductProfile(
    readJson('contracts/app-product-profile.json'),
    installExposure,
  ));
  assert.doesNotThrow(() => validateAppGuiProductContract(
    readJson('contracts/app-gui-product-contract.json'),
    readJson('contracts/app-release-channel.json'),
    installExposure,
  ));
  assert.doesNotThrow(() => validatePrimaryInteractionPages(
    readJson('contracts/app-page-state-matrix.json'),
  ));
});

test('product profile rejects pre-Codex-baseline interaction states', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  for (const mutate of [
    (profile: any) => { profile.gui.home.permission_mode_selector_visible = false; },
    (profile: any) => { profile.gui.home.conversation_permission_mode_selector_visible = false; },
    (profile: any) => { profile.gui.home.home_layout.workspace_session_rail_default_state = 'collapsed'; },
    (profile: any) => { profile.gui.ordinary_conversation.entry_source = 'home_purpose_entry_or_new_conversation'; },
    (profile: any) => { profile.gui.ordinary_conversation.composer_position = 'pinned_bottom'; },
    (profile: any) => { profile.gui.ordinary_conversation.permission_mode_selector_visible = false; },
    (profile: any) => { profile.gui.right_context_inspector.tabs = []; },
  ]) {
    const profile = structuredClone(readJson('contracts/app-product-profile.json'));
    mutate(profile);
    assert.throws(() => validateProductProfile(profile, installExposure));
  }
});

test('product profile rejects the superseded quiet Settings visual policy', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  for (const mutate of [
    (profile: any) => { profile.settings.control_plane.experience_contract.visual_system.style = 'codex_app_quiet_workbench'; },
    (profile: any) => { profile.settings.control_plane.experience_contract.visual_system.card_policy = 'few_cards_only_for_summary_or_repeated_entities'; },
  ]) {
    const profile = structuredClone(readJson('contracts/app-product-profile.json'));
    mutate(profile);
    assert.throws(() => validateProductProfile(profile, installExposure));
  }
});

test('active-shell source gate requires Home starters and Capabilities routing instead of retired selectors', () => {
  const currentSources = {
    guidPage: [
      'HomeStarters',
      'activeCapabilityId={activeShortcut?.package_id}',
      'handleSelectShortcut(assistantId)',
      'onSelect={(assistantId) =>',
      'onClear={() =>',
      'setActiveShortcut(resolveOplActiveShortcut(navState.selectedCapabilityId))',
      'agentSelection.setSelectedAgentKey(agentSelection.defaultAgentKey)',
    ].join('\n'),
    homeStarters: [
      "data-testid='opl-home-starters'",
      'aria-pressed={active}',
      'data-opl-active={String(active)}',
      "? '!border-primary-5 !bg-primary-1 !text-primary-6'",
      '<FontAwesomeIcon icon={faCheck}',
      'faChevronRight',
      'active && onClear ? onClear() : onSelect(assistant.id)',
    ].join('\n'),
    capabilitiesPage: [
      'useCustomAgentsLoader',
      "navigate('/guid', {",
      'state: { selectedCapabilityId: capability.id }',
    ].join('\n'),
  };
  assert.doesNotThrow(() => assertCurrentGuidHomeSelectionSources(currentSources));
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      guidPage: `${currentSources.guidPage}\nAssistantSelectionArea\nMentionSelectorBadge`,
    }),
  );
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      homeStarters: currentSources.homeStarters.replace('faChevronRight', ''),
    }),
  );
});

test('active-shell source gate preserves projectless local file inputs', () => {
  const currentSource = [
    'fileAccessEnabled: !fileAccessBlocked',
    'fileAccessDisabled={fileAccessBlocked}',
    'fileAccessEnabled={!fileAccessBlocked}',
    "name: 'open'",
  ].join('\n');

  assert.doesNotThrow(() => assertProjectlessGuidFileAccessSources(currentSource));
  for (const legacyWorkspaceGate of [
    'fileContextEnabled={!fileAccessBlocked && Boolean(guidInput.dir)}',
    'fileAccessDisabled={fileAccessBlocked || !guidInput.dir}',
    'fileAccessEnabled={!fileAccessBlocked && Boolean(guidInput.dir)}',
  ]) {
    assert.throws(() => assertProjectlessGuidFileAccessSources(`${currentSource}\n${legacyWorkspaceGate}`));
  }
});

test('active-shell Runtime source gate allows canonical action refs but rejects legacy fallback reconstruction', () => {
  const canonicalActionRefs = [
    "actionId: 'work_item_visibility_set'",
    'payload.expected_generation = selectedItem.visibility.generation',
    'const refreshedItem = findReadbackWorkItem(refreshedPayload, selectedItem)',
    'const workflow_id = canonicalWorkItem.workflowId',
  ].join('\n');

  assert.doesNotThrow(() => assertRuntimePageSourceBoundary(canonicalActionRefs));
  for (const legacyFallback of [
    'normalizeRuntimeProjection(appState)',
    'dedupeTaskItems(items)',
    'runtimeTaskItem(task, controlStates)',
    'appStateToRuntimeProjection(appState)',
    'compactCurrentControlState(state)',
    'controlStateFallbackForTask(task, controlStates)',
    'record(controlState?.provider_run)',
  ]) {
    assert.throws(() => assertRuntimePageSourceBoundary(`${canonicalActionRefs}\n${legacyFallback}`));
  }
});

test('GUI contract rejects Auto model policy source drift from the App product profile', () => {
  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.executor_policy.auto_model_policy_source_ref = 'shell-local-policy';

  assert.throws(() => validateAppGuiProductContract(
    guiContract,
    readJson('contracts/app-release-channel.json'),
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('product profile rejects static allowlist semantics for future Codex defaults', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  productProfile.codex.auto_model_policy.unknown_default_model_policy = 'reject_unknown_models';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('product profile rejects reasoning policies that do not use the highest CLI-advertised effort', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  productProfile.codex.auto_model_policy.unknown_model_reasoning_effort_policy = 'use_app_default';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('product profile rejects Codex CLI catalog field drift', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  productProfile.codex.auto_model_policy.catalog_default_model_field = 'default';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));

  productProfile.codex.auto_model_policy.catalog_default_model_field = 'isDefault';
  productProfile.codex.auto_model_policy.catalog_supported_reasoning_efforts_field = 'reasoningEfforts';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('product profile freezes the real paginated Codex model/list response shape', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  const policy = productProfile.codex.auto_model_policy;

  assert.equal(policy.catalog_response_models_field, 'data');
  assert.equal(policy.catalog_pagination_request_cursor_field, 'cursor');
  assert.equal(policy.catalog_pagination_response_cursor_field, 'nextCursor');
  assert.equal(policy.catalog_pagination_completion_policy, 'exhaust_pages_until_next_cursor_is_null');
  assert.equal(policy.catalog_supported_reasoning_effort_option_value_field, 'reasoningEffort');
  assert.equal(policy.catalog_hidden_model_field, 'hidden');
  assert.equal(policy.catalog_hidden_model_policy, 'exclude_hidden_models_from_auto_and_fixed_options');
});

test('Auto display contract keeps runtime resolution out of the static App profile', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  const auto = productProfile.gui.home.codex_model_display_options.auto_option;
  const configuredDefault = productProfile.codex.auto_model_policy.configured_default;

  assert.equal('resolved_model' in auto, false);
  assert.equal('resolved_reasoning_effort' in auto, false);
  assert.equal(auto.catalog_unavailable_fallback_model, configuredDefault.model);
  assert.equal(auto.catalog_unavailable_fallback_reasoning_effort, configuredDefault.reasoning_effort);
});

test('Auto persistence contract defines reasoning override and stale fixed selection behavior', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  const persistence = productProfile.codex.auto_model_policy.persistence_policy;

  assert.equal(persistence.state_encoding, 'auto_has_no_model_snapshot_fixed_has_model_and_reasoning');
  assert.equal(persistence.reasoning_override_from_auto, 'pin_current_resolved_model_and_exit_auto');
  assert.equal(
    persistence.stale_fixed_model,
    'preserve_fixed_selection_as_unavailable_until_user_restores_auto_or_selects_available_model',
  );
});

test('product profile rejects configured-default reasoning override drift', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  const configuredDefault = productProfile.codex.auto_model_policy.configured_default;
  productProfile.codex.auto_model_policy.known_model_reasoning_effort_overrides[configuredDefault.model] = 'drift';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('product profile rejects persisting Auto as a resolved model snapshot', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  productProfile.codex.auto_model_policy.persistence_policy.auto = 'persist_resolved_model';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('product profile rejects catalog fallback drift from the configured default', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  productProfile.codex.auto_model_policy.catalog_unavailable_fallback.reasoning_effort = 'high';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('one configured default projects across every App model-policy contract', () => {
  const bundle = readModelPolicyBundle();
  bundle.productProfile.codex.auto_model_policy.configured_default = {
    model: 'gpt-future',
    reasoning_effort: 'future-deep',
  };

  const projected = projectCodexModelPolicyContracts(bundle);
  const home = projected.productProfile.gui.home;
  const guidHome = projected.pageStateMatrix.pages.find(({ id }) => id === 'guid_home');
  const native = projected.shellCandidates.candidates.find(({ id }) => id === 'opl-native-workbench');
  const hermes = projected.shellCandidates.candidates.find(({ id }) => id === 'hermes-codex');

  assert.equal(projected.productProfile.codex.default_model, 'gpt-future');
  assert.equal(projected.productProfile.gui.home.codex_model_display_options.visible_models[0].id, 'gpt-future');
  assert.equal(projected.productProfile.codex.auto_model_policy.frontier_model_preference_order[0], 'gpt-future');
  assert.equal(projected.productProfile.default_session_profile.reasoning_effort, 'future-deep');
  assert.equal(home.codex_model_display_options.auto_option.catalog_unavailable_fallback_model, 'gpt-future');
  assert.equal(projected.guiProductContract.executor_policy.default_reasoning_effort, 'future-deep');
  assert.equal(guidHome.home_view_model.codex_default_model, 'gpt-future');
  assert.equal(native.visual_parity_contract.default_reasoning_effort, 'future-deep');
  assert.equal(hermes.model_access_policy.default_model, 'gpt-future');
  assert.equal(
    projected.productProfile.codex.auto_model_policy.known_model_reasoning_effort_overrides['gpt-future'],
    'future-deep',
  );
});

test('GUI contract rejects Codex selector button policies that allow an Auto prefix', () => {
  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.executor_policy.model_display_options_policy.button_label_policy =
    'auto_or_fixed_model_compact_label_with_selected_reasoning_effort';

  assert.throws(() => validateAppGuiProductContract(
    guiContract,
    readJson('contracts/app-release-channel.json'),
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('Home authority rejects the retired four-starter limit and copy', () => {
  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.home_layout.starter_limit = 4;
  guiContract.pages.guid_home.must_show = guiContract.pages.guid_home.must_show.map((entry: string) =>
    entry === 'all user-visible configured OPL starters in stable order without silent truncation'
      ? 'at most four lightweight OPL starters for Research/Grant/Presentation/Book'
      : entry,
  );
  assert.throws(() =>
    validateAppGuiProductContract(
      guiContract,
      readJson('contracts/app-release-channel.json'),
      readJson('contracts/app-install-exposure-policy.json'),
    ),
  );

  const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
  const guidHome = matrix.pages.find(({ id }: { id: string }) => id === 'guid_home');
  guidHome.home_view_model.home_layout.starter_limit = 4;
  guidHome.must_show = guidHome.must_show.map((entry: string) =>
    entry === 'all user-visible configured OPL starters in stable order without silent truncation'
      ? 'at most four lightweight OPL starters outside the composer'
      : entry,
  );
  assert.throws(() => validatePrimaryInteractionPages(matrix));
});

test('41301 machine authority rejects v1 contract schemas', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');

  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.schema_version = 1;
  assert.throws(
    () => validateAppGuiProductContract(
      guiContract,
      readJson('contracts/app-release-channel.json'),
      installExposure,
    ),
    /schema_version must be 2/,
  );

  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  productProfile.schema_version = 1;
  assert.throws(
    () => validateProductProfile(productProfile, installExposure),
    /schema_version must be 2/,
  );

  const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
  matrix.schema_version = 1;
  assert.throws(
    () => validatePrimaryInteractionPages(matrix),
    /schema_version must be 2/,
  );
});

test('41301 GUI contract rejects persistent project context and legacy inspector taxonomy', () => {
  const validate = (contract: any) => validateAppGuiProductContract(
    contract,
    readJson('contracts/app-release-channel.json'),
    readJson('contracts/app-install-exposure-policy.json'),
  );

  for (const mutate of [
    (contract: any) => {
      contract.ordinary_conversation.composer_context_strip = ['project_context_refs', 'active_capability'];
    },
    (contract: any) => {
      contract.right_context_inspector.primary_tools = [
        { id: 'review' },
        { id: 'terminal' },
        { id: 'browser' },
        { id: 'files' },
      ];
    },
    (contract: any) => {
      contract.right_context_inspector.runtime_duplicate_allowed = true;
    },
    (contract: any) => {
      contract.ordinary_conversation.current_task_slice.default_visibility =
        'pinnable_summary_bar_when_task_active';
    },
    (contract: any) => {
      contract.ordinary_conversation.transcript_export.workspace_bundle_authorized = true;
    },
  ]) {
    const contract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
    mutate(contract);
    assert.throws(() => validate(contract));
  }
});

test('41301 profile and page state reject the legacy eight-surface inspector', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const profile = structuredClone(readJson('contracts/app-product-profile.json'));
  profile.gui.right_context_inspector.primary_tools = [
    { id: 'review' },
    { id: 'terminal' },
    { id: 'browser' },
    { id: 'files' },
  ];
  profile.gui.right_context_inspector.secondary_sections = [
    { id: 'artifacts' },
    { id: 'runtime' },
    { id: 'actions' },
    { id: 'memory' },
  ];
  assert.throws(() => validateProductProfile(profile, installExposure));

  const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
  const inspector = matrix.pages.find(({ id }: { id: string }) => id === 'right_context_inspector');
  inspector.inspector_view_model.primary_tools = profile.gui.right_context_inspector.primary_tools;
  inspector.inspector_view_model.secondary_sections = profile.gui.right_context_inspector.secondary_sections;
  assert.throws(() => validatePrimaryInteractionPages(matrix));
});

test('41301 GUI contract and page state reject false Review source completion', () => {
  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.right_context_inspector.review_surface.source_capability_status.inline_comments =
    'source_implemented_shell_annotation_store';
  assert.throws(() =>
    validateAppGuiProductContract(
      guiContract,
      readJson('contracts/app-release-channel.json'),
      readJson('contracts/app-install-exposure-policy.json'),
    ),
  );

  const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
  const inspector = matrix.pages.find(({ id }: { id: string }) => id === 'right_context_inspector');
  inspector.inspector_view_model.review_surface.source_capability_status.inline_comments =
    'source_implemented_shell_annotation_store';
  assert.throws(() => validatePrimaryInteractionPages(matrix));
});

test('page-state matrix rejects Codex Auto policy source drift', () => {
  const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
  const guidHome = matrix.pages.find(({ id }) => id === 'guid_home');
  guidHome.home_view_model.codex_auto_model_policy_ref = 'shell-local-policy';

  assert.throws(() => validatePrimaryInteractionPages(matrix));
});
