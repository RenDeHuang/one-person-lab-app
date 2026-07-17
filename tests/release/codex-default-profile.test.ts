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

test('desktop App icon keeps the Codex-aligned macOS safe margin', () => {
  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.theme_and_branding.desktop_app_icon_policy.macos_expected_alpha_bounds = '1024x1024+0+0';

  assert.throws(
    () => validateAppGuiProductContract(
      guiContract,
      readJson('contracts/app-release-channel.json'),
      readJson('contracts/app-install-exposure-policy.json'),
    ),
    /desktop application icon policy/,
  );
});

test('product profile separates the external registry URL from Framework first-party identities', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const registry = readJson('contracts/agent-package-registry.json');
  const profile = structuredClone(readJson('contracts/app-product-profile.json'));
  assert.doesNotThrow(() => validateProductProfile(profile, installExposure, registry));

  profile.gui.agent_package_registry.default_registry_url = 'https://example.invalid/registry.json';
  assert.throws(
    () => validateProductProfile(profile, installExposure, registry),
    /separate the external Agent Package registry/,
  );

  const missingReleaseSetId = structuredClone(readJson('contracts/app-product-profile.json'));
  missingReleaseSetId.gui.agent_package_registry.canonical_first_party_package_ids.pop();
  assert.throws(
    () => validateProductProfile(missingReleaseSetId, installExposure, registry),
    /canonical Framework first-party package ids/,
  );

  const collidingRegistry = structuredClone(registry);
  collidingRegistry.entries.push({
    package_id: 'mas',
    source: 'third_party',
    trust_tier: 'third_party_unverified',
  });
  assert.throws(
    () => validateProductProfile(
      readJson('contracts/app-product-profile.json'),
      installExposure,
      collidingRegistry,
    ),
    /zero canonical first-party identity or trust collisions/,
  );
});

test('Agent catalog presentation rejects raw roles, hardcoded hierarchy, and duplicate rows', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const registry = readJson('contracts/agent-package-registry.json');
  for (const mutate of [
    (profile: any) => {
      profile.gui.agent_package_registry.catalog_presentation_policy.raw_package_role_visible = true;
    },
    (profile: any) => {
      profile.gui.agent_package_registry.catalog_presentation_policy.package_role_labels_i18n.standard_agent['zh-CN'] =
        'standard_agent';
    },
    (profile: any) => {
      profile.gui.agent_package_registry.catalog_presentation_policy.dependency_hierarchy.hardcoded_package_relationships_allowed =
        true;
    },
    (profile: any) => {
      profile.gui.agent_package_registry.catalog_presentation_policy.dependency_hierarchy.duplicate_rows_allowed = true;
    },
    (profile: any) => {
      profile.gui.agent_package_registry.catalog_presentation_policy.developer_controls_disclosure.default_state =
        'expanded';
    },
  ]) {
    const profile = structuredClone(readJson('contracts/app-product-profile.json'));
    mutate(profile);
    assert.throws(
      () => validateProductProfile(profile, installExposure, registry),
      /localized product ordering and projected dependency hierarchy/,
    );
  }
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
    guidInputCard: [
      'const DESKTOP_TEXTAREA_AUTO_SIZE = { minRows: 1, maxRows: 12 };',
      'className={`${styles.guidInputInner} relative z-1 flex flex-col bg-dialog-fill-0`}',
      '!pl-5px',
    ].join('\n'),
    homeStarters: [
      "data-testid='opl-home-starters'",
      'aria-pressed={active}',
      'data-opl-active={String(active)}',
      "const launchReady = launchGate.state !== 'package_unavailable'",
      'data-opl-launch-ready={String(launchReady)}',
      'active && styles.homeStarterActive',
      "data-testid='starter-active-check'",
      "<CheckOne theme='outline'",
      'starterIcon(assistant.id)',
      'active && onClear ? onClear() : onSelect(assistant.id)',
    ].join('\n'),
    guidStyles: [
      '.guidComposerDock',
      'width: min(100%, 736px);',
      '.guidInputInner',
      'min-height: 98px;',
      'border-radius: 22px;',
      '.actionRow',
      'align-items: flex-end;',
      'width: 100%;',
      '.workspaceChip',
      'height: 28px;',
      'background: var(--color-fill-2);',
      '.homeStarterGrid',
      'display: flex;',
      'flex-wrap: wrap;',
      'justify-content: center;',
      'width: auto !important;',
      'height: 34px !important;',
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
      homeStarters: currentSources.homeStarters.replace("data-testid='starter-active-check'", ''),
    }),
  );
  assert.throws(
    () =>
      assertCurrentGuidHomeSelectionSources({
        ...currentSources,
        homeStarters: currentSources.homeStarters.replace(
          'active && styles.homeStarterActive',
          "active ? '!border-primary-5 !bg-primary-1 !text-primary-6' : ''",
        ),
      }),
    /must include active && styles\.homeStarterActive/,
  );
  assert.throws(
    () =>
      assertCurrentGuidHomeSelectionSources({
        ...currentSources,
        homeStarters: currentSources.homeStarters.replace(
          "<CheckOne theme='outline'",
          '<FontAwesomeIcon icon={faCheck}',
        ),
      }),
    /must include <CheckOne theme='outline'/,
  );
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      homeStarters: `${currentSources.homeStarters}\nfaChevronRight`,
    }),
  );
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      guidStyles: `${currentSources.guidStyles}\ngrid-template-columns: repeat(4, minmax(0, 1fr));`,
    }),
  );
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      guidStyles: currentSources.guidStyles.replace('width: min(100%, 736px);', 'width: min(100%, 680px);'),
    }),
  );
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      guidInputCard: 'const DESKTOP_TEXTAREA_AUTO_SIZE = { minRows: 2, maxRows: 20 };',
    }),
  );
});

test('active-shell source gate preserves explicit local file inputs independently of workspace readiness', () => {
  const currentSource = [
    'const workspaceAccessBlocked = coreReadiness.known && !coreReadiness.workspaceRootReady;',
    'workspaceAccessDisabled={workspaceAccessBlocked}',
    'const guidInput = useGuidInput({',
    'locationState: navState',
    'onFilesUploaded={guidInput.handleFilesUploaded}',
    'onPaste={guidInput.onPaste}',
    'dragHandlers={guidInput.dragHandlers}',
    "name: 'open'",
  ].join('\n');

  assert.doesNotThrow(() => assertProjectlessGuidFileAccessSources(currentSource));
  for (const legacyWorkspaceGate of [
    'fileContextEnabled={!fileAccessBlocked && Boolean(guidInput.dir)}',
    'fileAccessDisabled={fileAccessBlocked || !guidInput.dir}',
    'fileAccessEnabled={!fileAccessBlocked && Boolean(guidInput.dir)}',
    'const fileAccessBlocked = coreReadiness.known && !coreReadiness.workspaceRootReady;',
    'fileAccessDisabled={coreReadiness.known && !coreReadiness.workspaceRootReady}',
    'fileAccessEnabled={!coreReadiness.known || coreReadiness.workspaceRootReady}',
    'fileAccessEnabled: !workspaceAccessBlocked',
    'fileAccessDisabled={workspaceAccessBlocked}',
    'fileAccessEnabled={!workspaceAccessBlocked}',
    [
      'const hasWorkspace = Boolean(guidInput.dir);',
      'const canUseFiles = hasWorkspace;',
      'fileAccessEnabled={canUseFiles}',
    ].join('\n'),
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

test('one configured default projects across every active App model-policy contract', () => {
  const bundle = readModelPolicyBundle();
  bundle.productProfile.codex.auto_model_policy.configured_default = {
    model: 'gpt-future',
    reasoning_effort: 'future-deep',
  };

  const projected = projectCodexModelPolicyContracts(bundle);
  const home = projected.productProfile.gui.home;
  const guidHome = projected.pageStateMatrix.pages.find(({ id }) => id === 'guid_home');

  assert.equal(projected.productProfile.codex.default_model, 'gpt-future');
  assert.equal(projected.productProfile.gui.home.codex_model_display_options.visible_models[0].id, 'gpt-future');
  assert.equal(projected.productProfile.codex.auto_model_policy.frontier_model_preference_order[0], 'gpt-future');
  assert.equal(projected.productProfile.default_session_profile.reasoning_effort, 'future-deep');
  assert.equal(home.codex_model_display_options.auto_option.catalog_unavailable_fallback_model, 'gpt-future');
  assert.equal(projected.guiProductContract.executor_policy.default_reasoning_effort, 'future-deep');
  assert.equal(guidHome.home_view_model.codex_default_model, 'gpt-future');
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
      contract.ordinary_conversation.project_context_inputs = { scope: 'canonical_workspace_path' };
    },
    (contract: any) => {
      contract.ordinary_conversation.artifact_preview.project_context_ref_policy = { workspace_scoped: true };
    },
    (contract: any) => {
      contract.ordinary_conversation.session_workspace_model.workspace_owns_context = true;
    },
    (contract: any) => {
      contract.ordinary_conversation.session_workspace_model.bound_project_reassignment = 'exposed';
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

test('session-first contracts reject directory ownership, stale cache authority, and workspace-gated local inputs', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const validateGui = (contract: any) => validateAppGuiProductContract(
    contract,
    readJson('contracts/app-release-channel.json'),
    installExposure,
  );

  for (const mutate of [
    (contract: any) => {
      contract.interaction_baseline.navigation_rail.thread_directory_policy.directory_group_policy.cascade_session_delete_allowed = true;
    },
    (contract: any) => {
      contract.interaction_baseline.navigation_rail.thread_directory_policy.stale_codex_acp_cache_row_policy = 'keep';
    },
    (contract: any) => {
      contract.interaction_baseline.navigation_rail.thread_directory_policy.title_based_deduplication_allowed = true;
    },
    (contract: any) => {
      contract.first_launch_readiness_policy.ordinary_shell_recovery_policy.send_scoped_local_inputs.workspace_root_required = true;
    },
    (contract: any) => {
      contract.first_launch_readiness_policy.ordinary_shell_recovery_policy.workspace_controls.send_scoped_local_inputs_remain_available = false;
    },
    (contract: any) => {
      contract.interaction_baseline.conversation_scope.explicit_session_input_policy.workspace_readiness_boundary.agent_package_workspace_requirement_policy = 'all_agent_packages_require_workspace';
    },
    (contract: any) => {
      contract.interaction_baseline.conversation_scope.explicit_session_input_policy.workspace_readiness_boundary.ordinary_codex_conversation_independent_of_agent_package_readiness = false;
    },
  ]) {
    const contract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
    mutate(contract);
    assert.throws(() => validateGui(contract));
  }

  for (const mutate of [
    (profile: any) => {
      profile.gui.ordinary_conversation.explicit_session_input_policy.workspace_preload_allowed = true;
    },
    (profile: any) => {
      profile.gui.ordinary_conversation.explicit_session_input_policy.workspace_readiness_boundary.send_scoped_local_file_inputs_require_workspace_root = true;
    },
    (profile: any) => {
      profile.gui.home.home_composer_state_contract.semantic_probe.instance_counts['guid-input-card-shell'] = 2;
    },
    (profile: any) => {
      profile.first_run.first_conversation.required_before_send_with_local_inputs.unshift('workspace_root');
    },
    (profile: any) => {
      profile.first_run.ordinary_shell_recovery.send_scoped_local_inputs.workspace_root_required = true;
    },
    (profile: any) => {
      profile.first_run.ordinary_shell_recovery.send_scoped_local_inputs.supported_inputs = [
        'file_dialog_attachment',
      ];
    },
    (profile: any) => {
      profile.gui.ordinary_conversation.explicit_session_input_policy.workspace_readiness_boundary.agent_package_workspace_requirement_policy = 'all_agent_packages_require_workspace';
    },
    (profile: any) => {
      profile.gui.ordinary_conversation.explicit_session_input_policy.workspace_readiness_boundary.ordinary_codex_conversation_independent_of_agent_package_readiness = false;
    },
    (profile: any) => {
      profile.gui.ordinary_conversation.session_workspace_model.project_adoption_transition = 'not_exposed';
    },
  ]) {
    const profile = structuredClone(readJson('contracts/app-product-profile.json'));
    mutate(profile);
    assert.throws(() => validateProductProfile(profile, installExposure));
  }

  for (const mutate of [
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'ordinary_conversation')
        .conversation_view_model.explicit_session_input_policy.implicit_workspace_context_injection_allowed = true;
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'ordinary_conversation')
        .conversation_view_model.artifact_preview.entry_sources.push('workspace_project_context_ref');
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'guid_home')
        .home_view_model.home_composer_state_contract.semantic_probe.instance_counts['opl-guid-entry'] = 2;
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'ordinary_conversation').conversation_view_model.environment_workspace_handoff = {
        contract_ref: 'retired_worktree_handoff',
      };
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'ordinary_conversation')
        .conversation_view_model.session_workspace_model.bound_project_reassignment = 'exposed';
    },
  ]) {
    const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
    mutate(matrix);
    assert.throws(() => validatePrimaryInteractionPages(matrix));
  }
});

test('conversation contracts reject clearing send-scoped inputs on creation or send failure', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');

  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.ordinary_conversation.send_failure_input_policy.must_preserve_send_scoped_local_inputs = false;
  assert.throws(
    () =>
      validateAppGuiProductContract(
        guiContract,
        readJson('contracts/app-release-channel.json'),
        installExposure,
      ),
    /ordinary conversation contract/,
  );

  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  productProfile.gui.ordinary_conversation.send_failure_input_policy.failure_scopes = [
    'conversation_creation',
    'in_conversation_send',
  ];
  assert.throws(
    () => validateProductProfile(productProfile, installExposure),
    /must preserve prompt and attachments/,
  );

  const pageMatrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
  pageMatrix.pages.find(
    (page: any) => page.id === 'ordinary_conversation',
  ).conversation_view_model.send_failure_input_policy.concurrent_edit_merge_policy =
    'replace_current_composer';
  assert.throws(
    () => validatePrimaryInteractionPages(pageMatrix),
    /Ordinary conversation view model shell policy/,
  );
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

test('41301 GUI authority rejects false Review focus and inline-comment completion', () => {
  for (const mutate of [
    (contract: any) => {
      contract.right_context_inspector.review_surface.source_capability_status.review_focus_context =
        'source_implemented_same_review_turn_steer_expected_turn_id';
    },
    (contract: any) => {
      contract.interaction_baseline.context_surfaces.review_pane.review_focus_delivery_policy =
        'non_custom_target_plain_text_turn_steer_same_review_thread_expected_turn_id_custom_instructions_not_duplicated';
    },
    (contract: any) => {
      contract.right_context_inspector.review_surface.source_capability_status.inline_comments =
        'source_implemented_shell_annotation_store';
    },
  ]) {
    const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
    mutate(guiContract);
    assert.throws(() =>
      validateAppGuiProductContract(
        guiContract,
        readJson('contracts/app-release-channel.json'),
        readJson('contracts/app-install-exposure-policy.json'),
      ),
    );
  }

  for (const mutate of [
    (reviewSurface: any) => {
      reviewSurface.source_capability_status.review_focus_context =
        'source_implemented_same_review_turn_steer_expected_turn_id';
    },
    (reviewSurface: any) => {
      reviewSurface.review_focus_delivery_policy =
        'non_custom_target_plain_text_turn_steer_same_review_thread_expected_turn_id_custom_instructions_not_duplicated';
    },
    (reviewSurface: any) => {
      reviewSurface.source_capability_status.inline_comments = 'source_implemented_shell_annotation_store';
    },
  ]) {
    const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
    const inspector = matrix.pages.find(({ id }: { id: string }) => id === 'right_context_inspector');
    mutate(inspector.inspector_view_model.review_surface);
    assert.throws(() => validatePrimaryInteractionPages(matrix));
  }
});

test('page-state matrix rejects Codex Auto policy source drift', () => {
  const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
  const guidHome = matrix.pages.find(({ id }) => id === 'guid_home');
  guidHome.home_view_model.codex_auto_model_policy_ref = 'shell-local-policy';

  assert.throws(() => validatePrimaryInteractionPages(matrix));
});

test('GUI contract rejects restoring global fail-closed Agent launch behavior', () => {
  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.agent_package_activation_policy.failure_policy.default_interaction_policy =
    'fail_closed';

  assert.throws(
    () => validateAppGuiProductContract(
      guiContract,
      readJson('contracts/app-release-channel.json'),
      readJson('contracts/app-install-exposure-policy.json'),
    ),
    /keeping ready, degraded, and plain Codex usable/,
  );
});

test('GUI contract rejects making Workspace a universal Agent launch prerequisite', () => {
  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.agent_package_activation_policy.workspace_policy
    .workspace_is_not_a_universal_agent_launch_precondition = false;

  assert.throws(
    () => validateAppGuiProductContract(
      guiContract,
      readJson('contracts/app-release-channel.json'),
      readJson('contracts/app-install-exposure-policy.json'),
    ),
    /keeping ready, degraded, and plain Codex usable/,
  );
});

test('GUI contract rejects blocking sends for degraded Agent launch state', () => {
  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.agent_package_activation_policy.launch_state_machine.degraded
    .selected_package_send_allowed = false;

  assert.throws(
    () => validateAppGuiProductContract(
      guiContract,
      readJson('contracts/app-release-channel.json'),
      readJson('contracts/app-install-exposure-policy.json'),
    ),
    /keeping ready, degraded, and plain Codex usable/,
  );
});
