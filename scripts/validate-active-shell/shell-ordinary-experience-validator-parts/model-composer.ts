import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { productProfilePath } from '../validation-config.ts';
import {
  assertShellTextIncludesAll,
  assertTextDoesNotMatch,
  assertTextExcludesAll,
  assertTextIncludesAll,
  readShellJson,
  readShellText,
} from '../shell-implementation-helpers.ts';

const productProfileDefaultsExpected = [
  '"configured_default": {',
  '"codex_cli_fixed_executor": true',
  '"home_executor_selector_visible": false',
  '"codex_model_selector_visible": true',
  '"codex_model_list_visible": true',
  '"codex_model_policy": "codex_cli_latest_strongest_model_selector_visible"',
  '"codex_model_auto_option_visible": true',
  '"codex_precise_model_display_policy": "friendly_model_with_discoverable_model_and_reasoning_summary_rows"',
  '"button_label_policy": "resolved_model_compact_label_with_selected_reasoning_effort_no_auto_prefix"',
  '"default_active_shortcut": null',
  '"shortcut_selection_policy": "explicit_user_or_navigation_selection_only_no_saved_preset_restore_and_never_disabled_by_launch_readiness"',
  '"selected_starter_visual_policy": "quiet_fill_with_aria_pressed_without_trailing_selection_glyph"',
  '"selected_starter_accessibility_state": "aria_pressed_reflects_active_shortcut"',
  '"policy_source_ref": "contracts/app-product-profile.json#codex.auto_model_policy"',
  '"model_catalog_source": "codex_cli_model_list"',
  '"catalog_response_models_field": "data"',
  '"catalog_default_model_field": "isDefault"',
  '"catalog_supported_reasoning_efforts_field": "supportedReasoningEfforts"',
  '"catalog_supported_reasoning_effort_option_value_field": "reasoningEffort"',
  '"catalog_pagination_request_cursor_field": "cursor"',
  '"catalog_pagination_response_cursor_field": "nextCursor"',
  '"catalog_pagination_completion_policy": "exhaust_pages_until_next_cursor_is_null"',
  '"catalog_hidden_model_policy": "exclude_hidden_models_from_auto_and_fixed_options"',
  '"frontier_model_preference_order_role": "known_model_fallback_and_fixed_option_preference_not_allowlist"',
  '"unknown_default_model_policy": "ignore_catalog_default_for_app_auto"',
  '"unknown_model_reasoning_effort_policy": "highest_supported_reasoning_effort_from_catalog"',
  '"auto": "persist_auto_mode_only_resolve_model_and_reasoning_from_fresh_catalog"',
  '"fixed": "persist_selected_model_and_reasoning_effort"',
  '"reasoning_override_from_auto": "pin_current_resolved_model_and_exit_auto"',
  '"user_can_override_model": true',
  '"user_can_restore_auto": true',
  '"display_policy": "friendly_model_name_with_session_configuration_summary_rows"',
  '"raw_model_id_visible_in_ordinary_ui": false',
  '"reasoning_effort_visible_for_every_option": false',
  '"reasoning_effort_menu_visible": true',
  '"model_menu_policy": "model_summary_row_nested_submenu_with_auto_and_fixed_options"',
  '"additional_root_rows_allowed": false',
  '"performance_tuning_row_allowed": false',
  '"home_and_conversation_share_menu_component": true',
  '"reasoning_effort_options_source": "acp_codex_config_options_enum"',
  '"label_zh": "自动（推荐）"',
  '"description_zh": "跟随 Codex CLI 当前默认模型与 App 推理策略"',
  '"label_zh": "5.6 Sol"',
  '"label_zh": "5.6 Terra"',
  '"label_zh": "5.6 Luna"',
  '"label_zh": "5.5"',
  '"label_zh": "5.4"',
  '"label_zh": "5.4 Mini"',
  '"label_zh": "5.2"',
  '"capability_strategy_consumer"',
  '"strategy_authority": "opl-flow"',
  '"compiler_authority": "opl-framework"',
  '"full_build_lock_kind": "opl_flow_capability_build_lock.v1"',
];

const codexSessionConfigurationMenuStructureExpected = {
  root_rows: ['model', 'reasoning_effort', 'reset_defaults'],
  additional_root_rows_allowed: false,
  performance_tuning_row_allowed: false,
  summary_row_policy: 'localized_label_left_current_value_and_chevron_right',
  reset_defaults_policy: 'restore_auto_model_and_app_default_reasoning',
  reset_label_zh: '重置为默认设置',
  reset_label_en: 'Reset to defaults',
  summary_row_icon_policy: 'no_leading_icons',
  reset_icon_policy: 'single_trailing_reset_outline_icon',
  home_and_conversation_share_menu_component: true,
};

const codexModelsExpected = [
  'getOplCodexAutoModelPolicy',
  'resolveOplCodexAutoSelection',
  'frontier_model_preference_order',
  'unknown_default_model_policy',
  'known_model_reasoning_effort_overrides',
  'catalog_unavailable_fallback',
  'model.hidden === true',
  'DEFAULT_CODEX_MODELS',
  'handshakeModels == null',
  'normalizeCodexModelInfo(handshakeModels)',
  'normalized?.available_models',
  'DEFAULT_CODEX_MODELS.map',
  'available_models: visibleModels',
];

const acpSendBoxExpected = [
  'isOplCodexCliFixedExecutor',
  'shouldShowOplConversationModelSelector',
  'shouldShowOplConversationPermissionModeSelector',
  "backend === 'codex'",
  'const showConversationModelSelector',
  'const showModeSelector',
  "data-testid='acp-sendbox-decision-controls'",
  '<AcpModelSelector',
  'conversation_id={conversation_id}',
  'backend={backend}',
  'waitForWarmup={!canonicalThreadId}',
  'modelInfoController={canonicalSettings ?? undefined}',
  '(showConversationModelSelector || showModeSelector) ?',
  '<ThoughtDisplay running={isBusy}',
  "placeholder={t('conversation.chat.oplPlaceholder')}",
];

export function assertProductProfileFrontierModelPreferenceOrder(productProfileJson) {
  const actual = productProfileJson?.codex?.auto_model_policy?.frontier_model_preference_order;
  const appProfile = JSON.parse(readFileSync(productProfilePath, 'utf8'));
  const expected = appProfile.codex.auto_model_policy.frontier_model_preference_order;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Active shell product profile must carry App Codex known frontier_model_preference_order=${JSON.stringify(expected)}`,
    );
  }
  if (productProfileJson?.gui?.home?.codex_home_model_status_label !== appProfile.gui.home.codex_home_model_status_label) {
    throw new Error('Active shell model status label must match the current App product profile');
  }
}

export function validateProductProfileDefaults(shellPaths) {
  const productProfilePath = 'packages/desktop/src/common/config/oplProductProfile/oplProductProfile.generated.json';
  const productProfile = readShellText(shellPaths, productProfilePath);
  const productProfileJson = readShellJson(shellPaths, productProfilePath, 'product profile');
  for (const field of [
    'professional_agent_packages',
    'professional_agent_packages_metadata_policy',
    'default_assistants',
    'non_default_assistants',
  ]) {
    if (Object.prototype.hasOwnProperty.call(productProfileJson?.gui ?? {}, field)) {
      throw new Error(`Active shell product profile must not carry App-owned Agent presentation authority gui.${field}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(productProfileJson?.gui?.home ?? {}, 'home_purpose_entries')) {
    throw new Error(
      'Active shell product profile must not carry App-owned Agent presentation authority gui.home.home_purpose_entries',
    );
  }
  for (const field of [
    'opl_app_session_context',
    'default_visible_skills',
    'skill_priority',
    'session_context_lines',
    'session_context_i18n',
  ]) {
    if (Object.prototype.hasOwnProperty.call(productProfileJson?.codex ?? {}, field)) {
      throw new Error(`Active shell product profile must not carry legacy Codex authority codex.${field}`);
    }
  }
  const additionalInstructions = productProfileJson?.codex?.new_conversation_additional_instructions;
  if (
    additionalInstructions?.content_owner !== 'user' ||
    additionalInstructions?.delivery !== 'new_conversation_additional_instructions_only' ||
    additionalInstructions?.storage_key !== 'codex.oplAppSessionContextAdditional' ||
    additionalInstructions?.storage_key_status !== 'legacy_compatibility_storage_key' ||
    additionalInstructions?.generated_base_context_allowed !== false ||
    additionalInstructions?.agent_route_fallback_allowed !== false ||
    additionalInstructions?.empty_value_policy !== 'inject_nothing' ||
    additionalInstructions?.reset_behavior !== 'clear_additional_instructions' ||
    additionalInstructions?.effect !== 'next_new_conversation'
  ) {
    throw new Error('Active shell product profile must limit new-conversation additions to optional user-authored text');
  }
  const ordinaryPolicy = productProfileJson?.gui?.ordinary_capability_selector_policy;
  if (
    ordinaryPolicy?.authority !== 'owner_or_carrier_skill_projection_and_mcp_negative_filter' ||
    ordinaryPolicy?.agent_reference_admission_policy?.active_agent_package_cardinality !== 'zero_or_one' ||
    ordinaryPolicy?.agent_reference_admission_policy?.selection_authority !==
      'home_starter_new_session_capability_palette_explicit_capability_route_or_explicit_pre_send_at_mention_agent_selection' ||
    ordinaryPolicy?.agent_reference_admission_policy?.at_mention_agent_selection_allowed !== true ||
    ordinaryPolicy?.agent_reference_admission_policy?.at_mention_semantics !==
      'explicit_new_session_agent_selection_before_first_send_plain_text_references_remain_prompt_context' ||
    ordinaryPolicy?.agent_reference_admission_policy?.plain_text_agent_reference_changes_active_package !== false ||
    ordinaryPolicy?.agent_reference_admission_policy?.multiple_agent_reference_policy !==
      'latest_explicit_pre_send_at_mention_selection_sets_the_new_session_agent_plain_text_references_remain_prompt_context' ||
    ordinaryPolicy?.agent_reference_admission_policy?.existing_conversation_rebinding_allowed !== false ||
    ordinaryPolicy?.agent_reference_admission_policy?.existing_conversation_rebinding_contract !== undefined ||
    ordinaryPolicy?.mcp_menu_policy !==
      'preserve_configured_user_and_third_party_servers_except_explicit_forbidden_matchers' ||
    ordinaryPolicy?.visible_mcp_server_ids !== undefined ||
    ordinaryPolicy?.forbidden_skill_examples !== undefined
  ) {
    throw new Error('Active shell product profile must carry new-session-only Agent selection and MCP negative-filter authority');
  }
  const agentPaletteGroup = productProfileJson?.gui?.ordinary_conversation?.unified_context_menu?.groups?.find(
    (group: { id?: unknown }) => group.id === 'agent_packages',
  );
  if (
    agentPaletteGroup?.scope !== 'new_session_configuration_or_existing_turn_invocation' ||
    agentPaletteGroup?.existing_session_rebinding_allowed !== false ||
    agentPaletteGroup?.existing_conversation_invocation_policy !==
      'invoke_selected_standard_agent_for_current_turn_without_rebinding_the_codex_thread' ||
    JSON.stringify(agentPaletteGroup?.surface_actions?.existing_conversation) !==
      JSON.stringify(['invoke_agent_package_for_current_turn'])
  ) {
    throw new Error('Active shell product profile must not expose existing-conversation Agent rebinding');
  }
  assertTextExcludesAll(
    productProfile,
    [
      'aioncore_atomic_conversation_owner_rebind_api',
      'explicit_at_mention_owner_rebind_via_core_atomic_api',
      'existing_conversation_rebinding_contract',
      '"default_packaged_codex_skill_ids"',
      '"additional_package_skill_ids"',
      '"official_codex_runtime_capabilities"',
    ],
    'Active shell product profile retired private Agent and App capability inventories',
  );
  assertProductProfileFrontierModelPreferenceOrder(productProfileJson);
  const menuStructure = productProfileJson?.gui?.home?.codex_model_display_options?.menu_structure;
  if (JSON.stringify(menuStructure) !== JSON.stringify(codexSessionConfigurationMenuStructureExpected)) {
    throw new Error('Active shell product profile must carry the exact App Codex session configuration menu');
  }
  assertTextIncludesAll(productProfile, productProfileDefaultsExpected, 'Active shell product profile App Codex default');
}

export function validateStaticAuthorityConsumerRemoval(shellPaths) {
  const profileLoader = readShellText(
    shellPaths,
    'packages/desktop/src/common/config/oplProductProfile/index.ts',
  );
  assertTextIncludesAll(
    profileLoader,
    [
      "authority: 'owner_or_carrier_skill_projection_and_mcp_negative_filter'",
      "conversation_loaded_skill_display_policy: 'preserve_owner_or_carrier_projected_loaded_skills'",
      'getOplNewConversationAdditionalInstructionsPolicy',
      "value.content_owner !== 'user'",
      "value.empty_value_policy !== 'inject_nothing'",
      'return names.flatMap((name) =>',
      'return skills.flatMap((skill) =>',
    ],
    'Active shell Product Profile dynamic Skill and user-instruction consumers',
  );
  assertTextExcludesAll(
    profileLoader,
    [
      'readProfessionalAgentPackages',
      'readDefaultHomeAssistants',
      'readNonDefaultAssistants',
      'readHomePurposeEntries',
      'getOplProfessionalAgentPackage',
      'getOplProfessionalAgentPackages',
      'getOplDefaultHomeAssistants',
      'getOplDefaultCodexSkills',
      'getOplSkillPriority',
      'getOplAppSessionContextPolicy',
      'getOplCodexSessionContextForLocale',
      'getOplDefaultPackagedCodexSkills',
      'getOplPackagedCodexSkills',
      "const forbidden = new Set(OPL_PRODUCT_PROFILE.gui.ordinary_capability_selector_policy.forbidden_skill_examples)",
    ],
    'Active shell retired static Product Profile consumers',
  );

  const conversationParams = readShellText(
    shellPaths,
    'packages/desktop/src/common/utils/buildAgentConversationParams.ts',
  );
  assertTextIncludesAll(
    conversationParams,
    [
      'mergeNewConversationInstructions',
      "configService.get('codex.oplAppSessionContextAdditional')?.trim()",
      'if (presetContext) extra.preset_context = presetContext',
      'if (additionalInstructions)',
    ],
    'Active shell optional user-authored new-conversation instructions',
  );
  assertTextExcludesAll(
    conversationParams,
    [
      'getOplAppSessionContextPolicy',
      'getOplCodexSessionContextForLocale',
      'resolveEffectiveOplAppSessionContext',
      'opl_app_session_context',
      'appState',
      '## Additional User Instructions',
      '## 用户附加说明',
    ],
    'Active shell generated session-context fallback and diagnostics',
  );

  const ipcBridge = readShellText(shellPaths, 'packages/desktop/src/common/adapter/ipcBridge.ts');
  assertTextExcludesAll(
    ipcBridge,
    ['opl_app_session_context'],
    'Active shell retired session-context diagnostics IPC type',
  );

  const personalization = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/contents/SystemModalContent/OplPersonalizationSettings.tsx',
  );
  assertTextIncludesAll(
    personalization,
    [
      "id='additional-instructions'",
      "data-testid='settings-additional-instructions-editor'",
      "configService.set('codex.oplAppSessionContextAdditional', additionalContextDraft)",
      "configService.set('codex.oplAppSessionContextAdditional', '')",
    ],
    'Active shell user-authored additional-instructions settings surface',
  );
  assertTextExcludesAll(
    personalization,
    [
      'resolveEffectiveOplAppSessionContext',
      'generatedContext',
      'settings-generated-context-action',
      'settings-generated-context-preview',
      'agent_packages',
    ],
    'Active shell generated Agent guidance preview and route fallback',
  );
}

export function validateExistingConversationAgentRebindRemoval(shellPaths) {
  for (const retiredPath of [
    'packages/desktop/src/renderer/pages/conversation/components/ConversationAgentRebindControl.tsx',
    'tests/unit/conversation/ConversationAgentRebindControl.dom.test.tsx',
  ]) {
    if (existsSync(path.join(shellPaths.shellRoot, retiredPath))) {
      throw new Error(`Active shell must remove private existing-conversation Agent rebind surface ${retiredPath}`);
    }
  }

  for (const [sourcePath, forbidden] of [
    [
      'packages/desktop/src/common/adapter/ipcBridge.ts',
      ['rebindAssistant', '/assistant/rebind', 'IRebindConversationAssistantParams'],
    ],
    [
      'packages/desktop/src/common/config/storage.ts',
      ['TConversationAssistantIdentity', 'assistant?: TConversationAssistantIdentity'],
    ],
    [
      'packages/desktop/src/common/config/oplProductProfile/index.ts',
      ['existing_conversation_rebinding_contract', 'aioncore_atomic_conversation_owner_rebind_api', 'REQUIRED_AGENT_REBIND'],
    ],
    ['packages/desktop/src/renderer/hooks/agent/usePresetAssistantInfo.ts', ['conversation.assistant']],
    [
      'packages/desktop/src/renderer/pages/conversation/components/ChatConversation.tsx',
      ['ConversationAgentRebindControl'],
    ],
    ['tests/unit/common-adapter/ipcBridgeAgents.test.ts', ['rebindAssistant', '/assistant/rebind']],
  ] as const) {
    assertTextExcludesAll(
      readShellText(shellPaths, sourcePath),
      forbidden,
      `Active shell private existing-conversation Agent rebind removal in ${sourcePath}`,
    );
  }
}

export function validateCodexSessionConfigurationMenuImplementation(
  shellPaths,
  dshVisualSourceImplemented,
) {
  const sessionMenu = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/agent/OplCodexSessionMenu.tsx',
    [
      "type SessionMenuGroup = 'model' | 'reasoning'",
      "data-testid='opl-codex-session-menu'",
      "data-testid='opl-codex-session-menu-reset'",
      "renderSummaryItem('model'",
      "'reasoning'",
      "role='separator'",
      'onReset();',
      dshVisualSourceImplemented
        ? "<OplIcon name='refresh'"
        : '<Refresh {...OPL_CHROME_ICON_PROPS} size={16}',
      "event.key === 'ArrowLeft'",
      "event.key === 'Escape'",
      "['ArrowDown', 'ArrowUp', 'Home', 'End']",
    ],
    'Active shell shared Codex session configuration menu',
  );
  const guidModelSelector = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidModelSelector.tsx',
    ['OplCodexSessionMenu', '<OplCodexSessionMenu', 'onReset={restoreCodexAutoSelection}'],
    'Active shell Home Codex session configuration menu',
  );
  const acpModelSelector = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/agent/AcpModelSelector.tsx',
    ['OplCodexSessionMenu', '<OplCodexSessionMenu', 'onReset={handleAutoSelect}'],
    'Active shell conversation Codex session configuration menu',
  );
  const guidActionRow = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx',
    ["key: 'reset-session-defaults'", "t('agent.sessionConfiguration.resetDefaults')", 'onChange(null, null)'],
    'Active shell mobile Home Codex reset action',
  );
  const acpSendBox = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx',
    ["key: 'reset-session-defaults'", "t('agent.sessionConfiguration.resetDefaults')", 'handleSheetAutoSelect'],
    'Active shell mobile conversation Codex reset action',
  );
  const i18nKeys = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/services/i18n/i18n-keys.d.ts',
    [
      'agent.sessionConfiguration.menuLabel',
      'agent.sessionConfiguration.model',
      'agent.sessionConfiguration.reasoning',
      'agent.sessionConfiguration.resetDefaults',
    ],
    'Active shell Codex session configuration i18n keys',
  );
  const modelMenuSources = [
    sessionMenu,
    guidModelSelector,
    acpModelSelector,
    guidActionRow,
    acpSendBox,
    i18nKeys,
  ].join('\n');
  assertTextDoesNotMatch(
    modelMenuSources,
    /sessionConfiguration\.speed|\bspeed(?:Fast|Standard|SwitchSuccess)?\b|速度/i,
    'Active shell Codex session configuration must not retain speed controls or copy',
  );
  const expectedLocales = {
    'zh-CN': {
      menuLabel: '模型与推理设置',
      model: '模型',
      reasoning: '推理强度',
      resetDefaults: '重置为默认设置',
    },
    'en-US': {
      menuLabel: 'Model and reasoning settings',
      model: 'Model',
      reasoning: 'Reasoning',
      resetDefaults: 'Reset to defaults',
    },
  };
  for (const [locale, expected] of Object.entries(expectedLocales)) {
    const agentLocale = readShellJson(
      shellPaths,
      `packages/desktop/src/renderer/services/i18n/locales/${locale}/agent.json`,
      `${locale} agent locale`,
    );
    if (JSON.stringify(agentLocale?.sessionConfiguration) !== JSON.stringify(expected)) {
      throw new Error(`Active shell ${locale} Codex session configuration copy must match App authority exactly`);
    }
  }
}

export function validateCodexModelControls(shellPaths, dshVisualSourceImplemented) {
  validateCodexSessionConfigurationMenuImplementation(shellPaths, dshVisualSourceImplemented);
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/utils/composerSurface.ts', ['getOplHomeComposerStateContract', 'resolveOplHomeComposerSurface', 'contract.executor', 'contract.invariants.model_reasoning_visible', 'contract.invariants.permission_access_visible', 'contract.invariants.executor_selector_visible'], 'Active shell Home composer App-contract decision surface');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/components/agent/AcpModelSelector.tsx', ['useAcpModelInfo', 'canSwitch', 'if (!canSwitch)', 'selectAutoModel()', 'onSelect: handleAutoSelect'], 'Active shell ACP model selector fixed Codex model guard');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/hooks/agent/useAcpModelInfo.ts', ['isOplCodexCliFixedExecutor', 'shouldShowOplCodexModelList', "backend === 'codex'", 'shouldShowOplCodexModelList()', "backend === 'codex' ? normalizeCodexModelInfo(nextModelInfo) : nextModelInfo", 'reportedCodexCurrentModelIdRef', 'reportedCodexCurrentModelIdRef.current ?? model_info.current_model_id', 'updateModelInfo(info)', 'updateModelInfo(incoming)', 'updateModelInfo(confirmedModelInfo)', 'selectAutoModel', 'selectReasoningEffort', 'savePreferredCodexSelection(backend, null, null)', 'savePreferredCodexSelection(backend, currentModelId, value)', 'canSwitch'], 'Active shell ACP model hook App-owned Codex model controls');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/utils/model/oplCodexModelDisplay.ts', ['resolveOplCodexAutoSelection'], 'Active shell Codex Auto option resolved target display');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx', ['useAcpModelInfo', 'selectAutoModel', 'handleSheetAutoSelect', 'onClick: handleSheetAutoSelect'], 'Active shell mobile ACP model selector shared Auto resolver');
  const modelControls = [
    readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/components/GuidModelSelector.tsx'),
    readShellText(shellPaths, 'packages/desktop/src/renderer/components/agent/AcpModelSelector.tsx'),
  ].join('\n');
  assertTextDoesNotMatch(modelControls, /\bBrain\b/, 'Active shell ordinary model/reasoning controls must not render brain icons');
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/opl/OplRefreshIconButton.tsx',
    ["OplIcon } from './OplVisualProvider'", "name='refreshSmall'", 'aria-label={label}', '<Tooltip content={label}>'],
    'Active shell OPL refresh icon button',
  );
  for (const settingsSurface of [
    'packages/desktop/src/renderer/pages/settings/sections/LocalServicesSettings.tsx',
    'packages/desktop/src/renderer/pages/settings/StorageSettings/index.tsx',
    'packages/desktop/src/renderer/pages/settings/CapabilitiesSettings.tsx',
    'packages/desktop/src/renderer/pages/settings/sections/AccessSettings.tsx',
    'packages/desktop/src/renderer/pages/settings/sections/RuntimeSettings.tsx',
  ]) {
    assertShellTextIncludesAll(shellPaths, settingsSurface, ['OplRefreshIconButton'], 'Active shell OPL icon-only refresh surface');
  }
}

export function validateCodexConversationSurfaces(shellPaths) {
  const chatConversation = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/components/ChatConversation.tsx',
  );
  assertTextExcludesAll(
    chatConversation,
    ['shouldShowOplConversationModelSelector', 'AcpModelSelector'],
    'Active shell ordinary Codex conversation duplicate header model selector',
  );
  const acpSendBox = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx',
    acpSendBoxExpected,
    'Active shell ordinary Codex conversation composer model and permission selectors',
  );
  assertTextExcludesAll(
    acpSendBox,
    [
      'getOplModelStatusDisplayText',
      "data-testid='opl-conversation-model-status'",
      "t('acp.sendbox.placeholder'",
    ],
    'Active shell ordinary Codex conversation duplicate model status or backend-owned placeholder',
  );
  const aionrsSendBox = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/aionrs/AionrsSendBox.tsx',
    ["placeholder={t('conversation.chat.oplPlaceholder')}"],
    'Active shell ordinary AionRS conversation OPL-owned placeholder',
  );
  assertTextExcludesAll(
    aionrsSendBox,
    ["t('acp.sendbox.placeholder'"],
    'Active shell ordinary AionRS conversation backend-owned placeholder',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/services/i18n/locales/zh-CN/conversation.json',
    ['"oplPlaceholder": "向 One Person Lab 提问或安排任务..."'],
    'Active shell zh-CN OPL conversation placeholder',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/services/i18n/locales/en-US/conversation.json',
    ['"oplPlaceholder": "Ask One Person Lab anything..."'],
    'Active shell en-US OPL conversation placeholder',
  );
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/conversation/platforms/acp/useAcpInitialMessage.ts', ["import { warmupConversation } from '../../utils/warmupConversation'", 'await warmupConversation(conversation_id)', 'ipcBridge.acpConversation.sendMessage.invoke'], 'Active shell ACP initial-message flow warm up before first send');
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/hooks/context/ConversationContext.tsx',
    ['canonicalThreadId?: string;'],
    'Active shell canonical conversation runtime-owner context',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpChat.tsx',
    ['canonicalThreadId,', '<ConversationProvider'],
    'Active shell canonical conversation runtime-owner provider',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/chat/SendBox/index.tsx',
    ['!conversationContext?.canonicalThreadId', 'conversationContext?.canonicalThreadId,'],
    'Active shell canonical conversation bypasses AionCore focus warmup',
  );
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/components/chat/ThoughtDisplay.tsx', ['formatElapsedTime', "t('conversation.chat.processing')", 'elapsedTime'], 'Active shell ThoughtDisplay elapsed processing feedback');
}

export function validateSendFailureDraftPreservation(shellPaths) {
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/hooks/chat/useSendBoxDraft.ts',
    [
      'export const mergeFailedSendContent',
      'export const mergeFailedSendDraft',
      'currentContent.startsWith(`${failedContent}\\n\\n`)',
      'const restored = splitChatFileRefs(failedFiles)',
      'mergeFileSelectionItems(restored.atPath, currentDraft.atPath)',
      'new Set([...restored.uploadFiles.filter(Boolean), ...currentDraft.uploadFile.filter(Boolean)])',
      'atPath,',
    ],
    'Active shell failed-send draft merge helper',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts',
    [
      'handleSend: () => Promise<boolean>',
      '.then((accepted) =>',
      'if (!accepted) return',
      "setInput((currentInput) => (currentInput === sentInput ? '' : currentInput))",
      'setFiles((currentFiles) => currentFiles.filter((file) => !sentFiles.has(file)))',
    ],
    'Active shell Home conversation-creation draft preservation',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx',
    [
      'mergeFailedSendDraft',
      'restoreFailedSend(message, allFiles)',
      'restoreFailedSend,',
    ],
    'Active shell ACP failed-send draft restoration',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/acp/useAcpInitialMessage.ts',
    [
      'restoreFailedSend: (input: string, files: ChatFileRef[]) => void',
      'restoreFailedSend(input, files)',
    ],
    'Active shell ACP initial-message draft restoration',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/aionrs/AionrsSendBox.tsx',
    [
      'mergeFailedSendDraft',
      'restoreFailedSend(input, initialFiles)',
      'restoreFailedSend(message, filesToSend)',
    ],
    'Active shell AionRS initial and in-conversation draft restoration',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/guid/useGuidSend.oplWhitelist.dom.test.tsx',
    [
      'preserves the Home draft when conversation creation returns no conversation',
      'preserves the Home draft when conversation creation rejects',
      'consumes only the accepted Home snapshot and keeps post-submit input',
    ],
    'Active shell Home failed-create regressions',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/renderer/useAcpInitialMessage.dom.test.ts',
    [
      'restores the GUID initial prompt and attachments when the first send fails',
      'merges a failed snapshot ahead of new input and deduplicates attachments by path',
    ],
    'Active shell initial-message and shared draft-merge regressions',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/renderer/AcpSendBox.dom.test.tsx',
    ['restores the failed prompt and attachments without overwriting input typed while waiting'],
    'Active shell ACP in-conversation failed-send regression',
  );
}

export function validateCodexConversationImplementation(shellPaths, dshVisualSourceImplemented) {
  validateCodexModelControls(shellPaths, dshVisualSourceImplemented);
  validateCodexConversationSurfaces(shellPaths);
  validateSendFailureDraftPreservation(shellPaths);
}

export function validateComposerCapabilityPaletteImplementation(shellPaths) {
  const palette = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/chat/composer/ComposerCapabilityPalette/ComposerCapabilityPalette.tsx',
    [
      'export type ComposerCapabilityPaletteItem',
      'export type ComposerCapabilityPaletteGroup',
      'verticalOffset: Math.max(8, triggerRect.top - composerRect.top + 8)',
      'item.description',
      'item.keywords',
      "role='dialog'",
      "data-capability-palette-scroll-region='true'",
      "event.key === 'ArrowDown'",
      "event.key === 'ArrowUp'",
      "event.key === 'Home'",
      "event.key === 'End'",
      "event.key === 'Escape'",
      'searchRef.current?.focus()',
      'focusTrigger()',
      'data-capability-palette-vertical-offset',
      'geometry?.verticalOffset ?? 8',
    ],
    'Active shell shared composer capability palette behavior',
  );
  assertTextExcludesAll(
    palette,
    ['openFileSelector', 'openDirectorySelector', 'workspaceDir'],
    'Active shell shared composer capability palette product-action isolation',
  );

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/chat/composer/ComposerCapabilityPalette/ComposerCapabilityPalette.module.css',
    [
      'width: min(736px, calc(100vw - 32px))',
      'box-sizing: border-box',
      'overflow: hidden',
      'overflow-y: auto',
      'scrollbar-gutter: stable',
      'grid-template-columns: 20px minmax(0, 1fr) auto',
    ],
    'Active shell composer-width palette geometry and internal scrolling',
  );

  const guidPalette = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx',
    [
      'ComposerCapabilityPalette',
      "id: 'local_inputs'",
      "id: 'agent_packages'",
      "id: 'skills'",
      "id: 'session_modes'",
      "id: 'apps_and_connections'",
      'filterNonPermissionAccessModes',
      'assistants: OplHomeAssistant[]',
      'resolveOplPackageLaunchGate(appState, assistant.opl_package_id)',
      'activeCapabilityId === assistant.opl_shortcut_id',
      'onSelectCapability?.(assistant.opl_shortcut_id)',
      'allSkills.forEach((skill) =>',
      'isGuidSkillChecked',
      'disabled: skill.locked',
      'horizontalOffset={-8}',
    ],
    'Active shell Home capability palette machine groups',
  );
  assertTextExcludesAll(
    guidPalette,
    [
      "key='workspace'",
      "id: 'working_directory'",
      '<Dropdown trigger=',
      'openWorkspacePicker',
      'getOplHomePurposeAssistantIds',
      'resolveOplProfessionalAgentAssistants',
      'getOplProfessionalAgentPackages',
      '.flatMap((assistant) => assistant.enabled_skills ?? [])',
    ],
    'Active shell Home capability palette forbidden working-directory and legacy dropdown entries',
  );

  const conversationPalette = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/media/FileAttachButton.tsx',
    [
      'ComposerCapabilityPalette',
      "id: 'local_inputs'",
      "id: 'agent_packages'",
      "id: 'skills'",
      "id: 'session_modes'",
      "id: 'apps_and_connections'",
      'loadedSkills',
      'loadedMcpStatuses',
      'filterOplOrdinarySkillNames',
      'filterOplOrdinaryMcpStatuses',
      'horizontalOffset={-16}',
    ],
    'Active shell existing-conversation capability palette machine groups',
  );
  assertTextExcludesAll(
    conversationPalette,
    [
      'if (isDesktop && !hasSkills && !hasMcpServers)',
      'onClick={openFileSelector}',
      "id: 'add'",
      "id: 'capabilities'",
      "id: 'controls'",
      'controlItems',
      "id: 'working_directory'",
    ],
    'Active shell existing-conversation palette fallback and legacy grouping',
  );

  const paletteTests = [
    readShellText(shellPaths, 'tests/unit/chat/ComposerCapabilityPalette.dom.test.tsx'),
    readShellText(shellPaths, 'tests/unit/media/FileAttachButton.oplWhitelist.dom.test.tsx'),
  ].join('\n');
  assertTextIncludesAll(
    paletteTests,
    [
      'one internal scroll region',
      'keeps the palette above the composer instead of the trigger button',
      'native Enter activation, Escape, and focus return',
      'explicit empty capability state instead of invoking the file picker',
      'openFileSelector).not.toHaveBeenCalled()',
      "id: 'local_inputs'",
      "id: 'agent_packages'",
      "id: 'skills'",
      "id: 'session_modes'",
      "id: 'apps_and_connections'",
    ],
    'Active shell capability palette regressions',
  );
}
