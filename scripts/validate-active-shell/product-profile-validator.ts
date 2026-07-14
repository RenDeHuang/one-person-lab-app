import path from 'node:path';
import { assertDeepEqualJson, assertForbiddenCapabilityPolicy, assertIncludesAll, readJson } from './assertions.ts';
import {
  forbiddenAuthorityOwners,
  focusedFirstRunPresentationPolicy,
} from './app-contract-constants.ts';
import {
  defaultActiveShellContractPath,
  firstRunMatrixPath,
  installExposurePolicyPath,
  pageStateMatrixPath,
  root,
  settingsControlPlanePath,
  assertFile,
} from './validation-config.ts';
import {
  assertNonEmptyStringArray,
  assertFirstRunProgressModelShape,
  validateBeginnerFirstRunPresentation,
  validateOplFlowContext,
} from './shared-contract-validators.ts';
import { validateSettingsControlPlaneBehavior } from './settings-control-plane-validator.ts';
import { assertDefaultCodexSessionProfile } from '../app-product-profile-default-session.ts';
import { assertAppProductProfileIdentity } from '../app-product-profile-identity.ts';
import {
  assertAppProductProfileCodexModelDisplayOptions,
  assertAppProductProfileGuiAuthority,
  assertAppProductProfileGuiInteractionBaseline,
  assertAppProductProfileHomeCodexPolicy,
  assertAppProductProfileRouteReceiptPolicy,
  assertAppProductProfileSettingsVisualSystem,
  assertHomeComposerStateContract,
  assertProfessionalAgentPackagePolicy,
  managedShortcutIds,
  managedShortcutPackageIds,
  requiredSkillByPackageId,
} from '../app-product-profile-shared-validators.ts';
import { expectedDomainExposureEntryMap } from './domain-exposure-validator.ts';

const ordinaryForbiddenCapabilityPolicy = {
  forbidden_mcp_matchers: {
    exact: ['aionui-team'],
    prefixes: ['team_', 'mcp__aionui-team'],
    contains: ['aionui-team'],
  },
  scrub_extra_keys: [
    'team_mcp_stdio_config',
    'team_id',
    'teamId',
    'team_lead_team_id',
    'team_lead_team_slot_id',
    'team_lead_conversation_id',
    'tl',
  ],
};
const requiredHostTools = [
  'command_line_tools',
  'homebrew',
  'node',
  'git',
];
const fullReadinessItems = [
  'domain_modules',
  'family_runtime_provider',
  'recommended_skills',
  'native_helpers',
  'repo_sync',
  'command_line_tools_install',
  'ecosystem_module_updates',
];
const deferredMaintenanceItems = [
  'repo_sync',
  'module_reconcile',
  'command_line_tools_install',
  'native_helpers',
  'companion_skills_install',
  'ecosystem_module_updates',
];
const ecosystemModuleIds = ['officecli', 'mineru', 'opl-meta-agent'];
const agentPackageRegistryPath = path.join(root, 'contracts', 'agent-package-registry.json');

function validateProductProfileIdentity(profile) {
  assertAppProductProfileIdentity(profile, 'product profile');
}

function validateProductProfileContractRefs(profile) {
  for (const [label, expected] of Object.entries({
    active_shell: defaultActiveShellContractPath,
    page_state: pageStateMatrixPath,
    first_run: firstRunMatrixPath,
    install_exposure: installExposurePolicyPath,
    settings_control_plane: settingsControlPlanePath,
  })) {
    const value = profile.contract_refs?.[label];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Product profile missing contract_refs.${label}`);
    }
    assertFile(path.join(root, value), `product profile ${label} contract ref`);
    if (path.resolve(root, value) !== path.resolve(expected)) {
      throw new Error(`Unexpected product profile contract_refs.${label}: ${value}`);
    }
  }
}

function validateProductProfileCodexDefaults(profile) {
  validateOplFlowContext(profile.codex?.opl_flow_context, 'Product profile OPL Flow Context');
  const sessionContextI18n = profile.codex?.session_context_i18n;
  if (
    !Array.isArray(sessionContextI18n?.['zh-CN']) ||
    !sessionContextI18n['zh-CN'].some((line) => typeof line === 'string' && line.includes('你正在 One Person Lab App')) ||
    !Array.isArray(sessionContextI18n?.['en-US']) ||
    !sessionContextI18n['en-US'].some((line) => typeof line === 'string' && line.includes('You are in a Codex session'))
  ) {
    throw new Error('Product profile must declare localized OPL App session context');
  }
  assertDefaultCodexSessionProfile(profile, { label: 'product profile', requireLiteralDefaults: true });
  assertAppProductProfileGuiAuthority(profile, 'Product profile');
  assertAppProductProfileGuiInteractionBaseline(profile, 'Product profile');
  assertAppProductProfileSettingsVisualSystem(profile, 'Product profile');
  assertAppProductProfileHomeCodexPolicy(profile, 'Product profile');
  assertAppProductProfileCodexModelDisplayOptions(profile, 'Product profile');
  assertAppProductProfileRouteReceiptPolicy(profile, 'Product profile');
  assertHomeComposerStateContract(profile.gui?.home?.home_composer_state_contract, 'Product profile Home composer state contract');
  validateUiLocalePolicy(profile);
  validateHomeAssistantDefaults(profile);
  validateProfessionalAgentPackages(profile);
  validateProductProfileSettings(profile);
  validateAssistantSkillProfiles(profile);
  validateProductProfileCodexSkills(profile);
  validateInstallUpdateTaxonomy(profile);
  validateOrdinaryCapabilitySelectorPolicy(profile);
}

function validateUiLocalePolicy(profile) {
  const policy = profile.gui?.ui_locale_policy;
  if (
    policy?.explicit_user_preference !== 'preserve_across_launches' ||
    policy?.first_launch_without_preference !== 'detect_system_locale_before_first_render' ||
    policy?.supported_normalization !== 'zh_to_zh-CN_else_en-US' ||
    policy?.startup_must_not_overwrite_explicit_preference !== true
  ) {
    throw new Error('Product profile locale policy must detect the system language before first render while preserving explicit preferences');
  }
}

function validateHomeAssistantDefaults(profile) {
  const homeLayout = profile.gui.home.home_layout;
  if (
    homeLayout?.default_active_shortcut !== null ||
    homeLayout?.shortcut_selection_policy !== 'explicit_user_or_navigation_selection_only_no_saved_preset_restore' ||
    homeLayout?.selected_starter_visual_policy !== 'accent_border_fill_and_check_indicator_not_color_alone'
  ) {
    throw new Error('Product profile Home must default to the base executor and require explicit professional-agent selection');
  }
  const iconPolicy = profile.gui.home.utility_icon_policy;
  if (
    iconPolicy?.library !== 'font_awesome_free_for_opl_owned_utility_icons' ||
    iconPolicy?.opl_owned_settings_navigation_and_overview !== 'font_awesome_free' ||
    iconPolicy?.upstream_fork_body_bulk_icon_rewrite !== 'forbidden' ||
    iconPolicy?.refresh_actions !== 'icon_only_with_tooltip_and_accessible_name' ||
    iconPolicy?.model_reasoning_control !== 'text_and_disclosure_without_brain_icon' ||
    JSON.stringify(iconPolicy?.account_identity_avatar) !==
      JSON.stringify({
        shape: 'circle',
        background: 'semantic_success_green',
        foreground: 'inverse',
        han_name_initials: 'first_han_character_only',
        non_han_name_initials: 'first_letters_of_first_two_words_uppercase_else_first_two_codepoints',
        email_fallback_initials: 'first_two_local_part_codepoints_uppercase',
        empty_fallback: 'OP',
      }) ||
    iconPolicy?.global_feedback_action?.placement !== 'titlebar_trailing_utility' ||
    iconPolicy?.global_feedback_action?.icon !== 'circle_question' ||
    iconPolicy?.global_feedback_action?.icon_style !== 'regular_outline' ||
    iconPolicy?.global_feedback_action?.target_url !==
      'https://github.com/gaofeng21cn/one-person-lab-app/issues/new' ||
    iconPolicy?.global_feedback_action?.open_mode !== 'external_browser_user_review_and_submit' ||
    JSON.stringify(iconPolicy?.global_feedback_action?.prefill_fields) !==
      JSON.stringify(['localized_title', 'localized_body', 'current_route', 'app_release_version']) ||
    iconPolicy?.global_feedback_action?.shell_local_delivery_forbidden !== true
  ) {
    throw new Error('Product profile OPL utility icons must include the App-owned GitHub feedback action');
  }
  const homePurposeEntries = profile.gui.home.home_purpose_entries ?? [];
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.id)) !== JSON.stringify(['research', 'grant', 'ppt', 'book'])) {
    throw new Error('Product profile GUI home must expose research, grant, ppt, and book purpose entries');
  }
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.target_assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca', 'obf'])) {
    throw new Error('Product profile GUI home purpose entries must target MAS, MAG, RCA, and BookForge');
  }
  const homeAgentShortcuts = profile.gui.home.home_agent_shortcuts ?? [];
  if (JSON.stringify(homeAgentShortcuts.map((entry) => entry.shortcut_id)) !== JSON.stringify(managedShortcutIds)) {
    throw new Error('Product profile GUI home must expose configurable MAS, MAG, RCA, OBF, and OMA package shortcuts');
  }
  if (JSON.stringify(homeAgentShortcuts.map((entry) => entry.package_id)) !== JSON.stringify(managedShortcutPackageIds)) {
    throw new Error('Product profile GUI home shortcuts must target MAS, MAG, RCA, OBF, and OMA packages');
  }
  for (const shortcut of homeAgentShortcuts) {
    if (
      shortcut.executor !== 'codex_cli' ||
      shortcut.source !== 'opl_app_home' ||
      shortcut.display_policy !== 'purpose_first' ||
      shortcut.home_entry_policy !== 'visible_click_to_start' ||
      shortcut.user_configurable !== true ||
      JSON.stringify(shortcut.required_skill_ids) !== JSON.stringify(requiredSkillByPackageId[shortcut.package_id])
    ) {
      throw new Error(`Product profile GUI home shortcut ${shortcut.shortcut_id} must be a configurable Codex package launch shortcut`);
    }
    if (shortcut.package_id === 'oma' && shortcut.shortcut_id !== 'oma') {
      throw new Error('Product profile OMA shortcut id must remain oma');
    }
    if (shortcut.default_visible !== true) {
      throw new Error(`Product profile shortcut ${shortcut.shortcut_id} must be visible by default`);
    }
  }
  if (JSON.stringify((profile.gui.default_assistants ?? []).map((assistant) => assistant.id)) !== JSON.stringify(['mas', 'mag', 'rca', 'obf'])) {
    throw new Error('Product profile default assistants must be MAS, MAG, RCA, and BookForge');
  }
  for (const assistant of profile.gui.default_assistants ?? []) {
    if (assistant.home_entry_policy !== 'purpose_entry_target' || assistant.home_entry_display_policy !== 'purpose_first') {
      throw new Error(`Product profile default assistant ${assistant.id} must be a purpose-first entry target`);
    }
  }
  const oma = (profile.gui.non_default_assistants ?? []).find((assistant) => assistant.id === 'oma');
  if (!oma || oma.home_default_visible !== true || oma.home_entry_policy !== 'settings_managed_home_shortcut') {
    throw new Error('Product profile must expose OMA through its default settings-managed Home shortcut');
  }
  for (const retiredModel of [
    'gpt-5.3-codex-spark',
    'gpt-5.3-codex',
    'gpt-5.2-codex',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini',
  ]) {
    if (!profile.gui.home?.retired_codex_models_must_not_be_exposed?.includes(retiredModel)) {
      throw new Error(`Product profile GUI home must ban retired Codex model ${retiredModel}`);
    }
  }
}

function validateProfessionalAgentPackages(profile) {
  assertProfessionalAgentPackagePolicy(profile.gui.professional_agent_packages, 'Product profile');
}

function validateAgentPackageRegistryProjection(profile, agentPackageRegistry) {
  const projection = profile.gui?.agent_package_registry;
  const expectedFirstPartyPackageIds = [
    'mas',
    'mag',
    'rca',
    'oma',
    'obf',
    'mas-scholar-skills',
    'opl-flow',
  ];
  if (
    typeof agentPackageRegistry?.registry_url !== 'string' ||
    !agentPackageRegistry.registry_url.trim() ||
    projection?.default_registry_url !== agentPackageRegistry.registry_url ||
    projection?.source_ref !== 'contracts/agent-package-registry.json#registry_url' ||
    projection?.registry_scope !== 'external_discovery_only' ||
    projection?.empty_default_registry_allowed !== true ||
    projection?.first_party_runtime_authority !== 'one-person-lab-framework#built_in_release_set' ||
    projection?.external_first_party_identity_claims_allowed !== false ||
    projection?.external_first_party_trust_claims_allowed !== false ||
    projection?.collision_failure_code !== 'agent_package_registry_first_party_identity_collision' ||
    projection?.first_party_manifest_fixture_dir !== 'contracts/fixtures/agent-package-manifests' ||
    projection?.shell_consumption_policy !== 'generated_product_profile_only_no_renderer_literal'
  ) {
    throw new Error('Product profile must separate the external Agent Package registry from the Framework first-party Release Set');
  }
  assertDeepEqualJson(
    projection.canonical_first_party_package_ids,
    expectedFirstPartyPackageIds,
    'Product profile canonical Framework first-party package ids',
  );
  const metadata = projection.first_party_release_set_metadata ?? [];
  assertDeepEqualJson(
    metadata.map((entry) => entry.package_id),
    expectedFirstPartyPackageIds,
    'Product profile first-party release metadata ids',
  );
  for (const entry of metadata) {
    if (
      !entry.package_kind ||
      !entry.display_name ||
      entry.publisher !== 'one-person-lab' ||
      entry.source !== 'first_party' ||
      entry.trust_tier !== 'first_party' ||
      !entry.description?.trim() ||
      !Array.isArray(entry.tags) ||
      entry.tags.length === 0 ||
      entry.manifest_fixture_ref !== `contracts/fixtures/agent-package-manifests/${entry.package_id}.json`
    ) {
      throw new Error(`Product profile first-party metadata is incomplete for ${entry.package_id}`);
    }
  }
  const reservedIds = new Set(expectedFirstPartyPackageIds);
  const collision = (agentPackageRegistry.entries ?? []).find((entry) =>
    reservedIds.has(entry.package_id) || entry.source === 'first_party' || entry.trust_tier === 'first_party');
  if (collision) {
    throw new Error('Default external Agent Package registry must have zero canonical first-party identity or trust collisions');
  }
}

function validateProductProfileSettings(profile) {
  validateSettingsControlPlaneBehavior({ productProfile: profile });
  const queryFreeControlPlaneRedirects = Object.fromEntries(
    Object.entries(profile.settings.control_plane.legacy_route_redirects ?? {})
      .filter(([id]) => id !== 'about')
      .map(([id, target]) => [id, String(target).split('?')[0]]),
  );
  assertDeepEqualJson(
    profile.settings?.visible_tabs,
    profile.settings.control_plane.ordinary_visible_tabs,
    'Product profile ordinary settings visible tabs',
  );
  assertDeepEqualJson(
    profile.settings?.legacy_route_redirects,
    queryFreeControlPlaneRedirects,
    'Product profile legacy settings route redirects',
  );
  if (
    profile.settings?.control_plane?.source_contract_ref !==
    'contracts/app-gui-product-contract.json#settings_navigation'
  ) {
    throw new Error('Product profile settings.control_plane must project the App Settings control plane');
  }
  assertDeepEqualJson(
    profile.settings.control_plane.ordinary_visible_tabs,
    profile.settings?.visible_tabs,
    'Product profile settings.control_plane ordinary tabs',
  );
  assertDeepEqualJson(
    profile.settings.control_plane.ordinary_routes?.map((route) => route.id),
    profile.settings.control_plane.ordinary_visible_tabs,
    'Product profile settings.control_plane ordinary route ids',
  );
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(profile.settings.control_plane.legacy_route_redirects ?? {})
        .filter(([id]) => id !== 'about')
        .map(([id, target]) => [id, String(target).split('?')[0]]),
    ),
    profile.settings?.legacy_route_redirects,
    'Product profile settings.control_plane legacy redirects',
  );
}

function validateAssistantSkillProfiles(profile) {
  const productSkillProfiles = profile.gui.assistant_skill_profiles ?? [];
  if (JSON.stringify(productSkillProfiles.map((entry) => entry.assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca', 'obf'])) {
    throw new Error('Product profile assistant skill profiles must target MAS, MAG, RCA, and BookForge');
  }
  const availableSkillIds = new Set([
    ...(profile.companion_payloads?.default_packaged_codex_skill_ids ?? []),
    ...(profile.companion_payloads?.additional_package_skill_ids ?? []),
    ...(profile.companion_payloads?.official_codex_runtime_capabilities?.preferred_capability_ids ?? []),
  ]);
  const requiredSkillByAssistantId = {
    mas: 'med-autoscience',
    mag: 'med-autogrant',
    rca: 'redcube-ai',
    obf: 'opl-bookforge',
  };
  for (const entry of productSkillProfiles) {
    const requiredSkill = requiredSkillByAssistantId[entry.assistant_id];
    if (!requiredSkill || JSON.stringify(entry.required_skills) !== JSON.stringify([requiredSkill])) {
      throw new Error(`Product profile assistant ${entry.assistant_id} must require its App-declared matching skill`);
    }
    if (entry.skill_menu_policy !== 'assistant_scoped_required_checked_optional_visible') {
      throw new Error(`Product profile assistant ${entry.assistant_id} has invalid home skill menu policy`);
    }
    if (entry.optional_skills?.includes('morph-ppt')) {
      throw new Error(`Product profile assistant ${entry.assistant_id} must not expose retired morph-ppt skill wiring`);
    }
    if ('hidden_home_skill_names' in entry) {
      throw new Error(`Product profile assistant ${entry.assistant_id} must not carry UI hiding policy`);
    }
    const unpackagedProfileSkills = [...(entry.required_skills ?? [])]
      .filter((skill) => !availableSkillIds.has(skill));
    if (unpackagedProfileSkills.length > 0) {
      throw new Error(
        `Product profile assistant ${entry.assistant_id} references skills outside the App packaged set: ${unpackagedProfileSkills.join(', ')}`,
      );
    }
  }
}

function validateProductProfileCodexSkills(profile) {
  if (!Array.isArray(profile.codex?.default_visible_skills)) {
    throw new Error('Product profile must declare default visible skills');
  }
  if (
    !Array.isArray(profile.companion_payloads?.additional_package_skill_ids) ||
    !profile.companion_payloads.additional_package_skill_ids.includes('opl-meta-agent')
  ) {
    throw new Error('Product profile must mark OPL Meta Agent as packaged but not default visible');
  }
  if (
    profile.codex.skill_priority.includes('morph-ppt') ||
    profile.companion_payloads.default_packaged_codex_skill_ids.includes('morph-ppt') ||
    profile.companion_payloads.additional_package_skill_ids.includes('morph-ppt')
  ) {
    throw new Error('Product profile must not include retired morph-ppt skill wiring');
  }
}

function validateInstallUpdateTaxonomy(profile) {
  assertDeepEqualJson(
    profile.install_update_taxonomy?.public_software_objects,
    ['opl_base', 'opl_app', 'opl_packages'],
    'Product profile public software objects',
  );
  assertDeepEqualJson(
    profile.install_update_taxonomy?.managed_update_component_keys,
    ['opl_base', 'opl_app', 'opl_packages'],
    'Product profile managed update component keys',
  );
  assertDeepEqualJson(
    profile.install_update_taxonomy?.transaction_internal_state_ids,
    ['runtime_substrate', 'capability_packages', 'companion_tools', 'codex_surface', 'workflow_profile'],
    'Product profile transaction internal state ids',
  );
  assertDeepEqualJson(
    profile.install_update_taxonomy?.ordinary_ui_must_not_expose_as_peer_objects,
    [
      'app_binary',
      'runtime_toolchain',
      'agent_package_channel',
      'capability_exposure',
      'codex_cli_fallback',
      'runtime_substrate',
      'capability_packages',
      'companion_tools',
      'codex_surface',
      'workflow_profile',
    ],
    'Product profile forbidden peer software objects',
  );
  assertDeepEqualJson(
    profile.install_update_taxonomy?.internal_detail_fields,
    {
      opl_base: ['dependency_status', 'integration_status'],
      opl_app: ['host_update_route', 'host_executor_required'],
      opl_packages: ['projection_status', 'profile_migration_status'],
    },
    'Product profile managed update internal detail fields',
  );
  if (profile.install_update_taxonomy?.ordinary_component_picker_allowed !== false) {
    throw new Error('Product profile ordinary component picker must be disabled');
  }
  assertDeepEqualJson(
    profile.companion_payloads?.tools,
    ['officecli', 'mineru_open_api'],
    'Product profile companion tools',
  );
  if (
    profile.companion_payloads?.class !== 'opl_base_integrations' ||
    profile.companion_payloads?.opl_packages_projection_ref !== 'contracts/app-install-exposure-policy.json#exposure_classes.codex_surface' ||
    profile.companion_payloads?.opl_packages_lifecycle_ref !==
      'contracts/app-install-exposure-policy.json#agent_installation_contract.managed_package_distribution'
  ) {
    throw new Error('Product profile payloads must map Base integrations and Packages projection/lifecycle without peer updater classes');
  }
}

function validateOrdinaryCapabilitySelectorPolicy(profile) {
  const policy = profile.gui?.ordinary_capability_selector_policy;
  if (
    policy?.scope !== 'home_composer_and_ordinary_conversation' ||
    policy?.authority !== 'app_owned_opl_allowlist' ||
    policy?.skill_source_ref !== 'gui.professional_agent_packages.required_skill_ids + optional_skill_ids' ||
    policy?.mcp_server_source_ref !== 'gui.ordinary_capability_selector_policy.visible_mcp_server_ids' ||
    policy?.mcp_menu_policy !== 'empty_until_app_explicitly_whitelists_opl_mcp_servers' ||
    policy?.conversation_loaded_mcp_display_policy !== 'filter_to_visible_mcp_server_ids'
  ) {
    throw new Error('Product profile ordinary capability selector must be an App-owned OPL allowlist');
  }
  assertDeepEqualJson(policy.visible_mcp_server_ids, [], 'Product profile ordinary MCP allowlist');
  assertForbiddenCapabilityPolicy(
    policy,
    ordinaryForbiddenCapabilityPolicy,
    'Product profile ordinary forbidden MCP policy',
  );
  assertDeepEqualJson(
    policy.required_scrub_targets,
    [
      'mcp_servers entries matching forbidden_mcp_matchers',
      'mcp_statuses entries matching forbidden_mcp_matchers',
      'session_mcp_servers entries matching forbidden_mcp_matchers',
      'scrub_extra_keys',
    ],
    'Product profile ordinary Team scrub targets',
  );
  if (policy.conversation_snapshot_policy !== 'scrub_disabled_team_mcp_and_team_metadata_before_rendering_or_inheriting_ordinary_conversations') {
    throw new Error('Product profile ordinary selector must scrub disabled Team MCP snapshots');
  }
}

function validateFullFirstInstallCoreReadyPolicy(profile) {
  if (JSON.stringify(profile.first_run?.readiness_layers) !== JSON.stringify(['core'])) {
    throw new Error('Product profile ready_to_launch readiness_layers must contain only core');
  }
  const firstRunCoreItems = assertNonEmptyStringArray(
    profile.first_run?.ready_to_launch_gate?.required_core_items,
    'Product profile ready_to_launch required_core_items',
  );
  validateBeginnerFirstRunPresentation(
    profile.first_run?.beginner_presentation,
    'Product profile first-run beginner presentation',
    firstRunCoreItems,
  );
  for (const [field, expected] of Object.entries(focusedFirstRunPresentationPolicy)) {
    if (profile.first_run?.beginner_presentation?.[field] !== expected) {
      throw new Error(
        `Product profile first-run beginner presentation ${field} must be ${expected}`,
      );
    }
  }
  validateReadyToLaunchGate(profile, firstRunCoreItems);
  validateFirstConversationPolicy(profile);
  validateFullFirstInstallBackgroundPolicy(profile);
  validateFirstRunProgressModel(profile);
}

function validateReadyToLaunchGate(profile, firstRunCoreItems) {
  const launchGate = profile.first_run?.ready_to_launch_gate;
  if (
    launchGate?.id !== 'ready_to_launch' ||
    launchGate?.ui_order !== 'before_first_conversation_not_before_guid' ||
    launchGate?.guid_navigation_blocking !== false
  ) {
    throw new Error('Product profile ready_to_launch must gate first conversation without blocking /guid navigation');
  }
  for (const item of firstRunCoreItems) {
    if (!launchGate?.required_core_items?.includes(item)) {
      throw new Error(`Product profile ready_to_launch gate must require Core item ${item}`);
    }
  }
  for (const item of fullReadinessItems) {
    if (!launchGate?.must_not_require?.includes(item)) {
      throw new Error(`Product profile ready_to_launch gate must not require ${item}`);
    }
    if (!profile.first_run?.full_readiness_layers?.includes(item)) {
      throw new Error(`Product profile full readiness layers must include ${item}`);
    }
  }
  if (
    profile.first_run?.runtime_provider?.full_readiness_provider !== 'temporal'
    || profile.first_run.runtime_provider.ready_to_launch_blocking !== false
  ) {
    throw new Error('Product profile full runtime provider must stay Temporal and non-blocking for ready_to_launch');
  }
}

function validateFirstConversationPolicy(profile) {
  const firstConversation = profile.first_run?.first_conversation;
  const progressModel = profile.first_run?.progress_model;
  const firstConversationMustWaitFor = assertNonEmptyStringArray(
    firstConversation?.must_wait_for,
    'Product profile first conversation must_wait_for',
  );
  const requiredBeforePlainSend = assertNonEmptyStringArray(
    firstConversation?.required_before_plain_send,
    'Product profile first conversation required_before_plain_send',
  );
  const requiredBeforeFileOrProjectSend = assertNonEmptyStringArray(
    firstConversation?.required_before_file_or_project_send,
    'Product profile first conversation required_before_file_or_project_send',
  );
  if (typeof firstConversation?.failure_policy !== 'string' || !firstConversation.failure_policy.trim()) {
    throw new Error('Product profile first conversation must define a failure_policy');
  }
  assertFirstRunProgressModelShape(progressModel, 'Product profile first-run progress model');
  if (
    firstConversation?.gate !== 'capability_prerequisites_then_acp_warmup_before_initial_send' ||
    firstConversation?.source_command !== progressModel.source_command ||
    firstConversation?.ready_to_launch_must_be_true !== false ||
    firstConversation?.unknown_readiness_policy !== 'allow_attempt_without_mutating_readiness' ||
    firstConversation?.blocked_feedback !== 'localized_inline_non_modal_setup_notice_preserves_prompt'
  ) {
    throw new Error('Product profile first conversation must apply granular prerequisites before ACP warmup');
  }
  assertDeepEqualJson(requiredBeforePlainSend, ['codex_cli', 'codex_config'], 'Product profile plain send prerequisites');
  assertDeepEqualJson(
    requiredBeforeFileOrProjectSend,
    ['workspace_root', 'codex_cli', 'codex_config'],
    'Product profile file/project send prerequisites',
  );
  const ordinaryRecovery = profile.first_run?.ordinary_shell_recovery;
  if (
    ordinaryRecovery?.persistent_setup_entry?.target_route !== '/first-run' ||
    ordinaryRecovery?.persistent_setup_entry?.surface !== 'ordinary_sidebar_non_modal_entry' ||
    ordinaryRecovery?.plain_conversation?.workspace_root_required !== false ||
    ordinaryRecovery?.plain_conversation?.must_preserve_prompt !== true ||
    ordinaryRecovery?.file_and_project_context?.plain_conversation_remains_available !== true ||
    ordinaryRecovery?.unknown_readiness_policy !== 'do_not_synthesize_failure_or_mutate_readiness'
  ) {
    throw new Error('Product profile ordinary shell recovery policy is invalid');
  }
  assertDeepEqualJson(
    ordinaryRecovery.plain_conversation.required_items,
    ['codex_cli', 'codex_config'],
    'Product profile ordinary plain conversation prerequisites',
  );
  assertDeepEqualJson(
    ordinaryRecovery.file_and_project_context.required_items,
    ['workspace_root'],
    'Product profile ordinary file/project prerequisites',
  );
  assertIncludesAll(
    firstConversation.must_wait_for,
    firstConversationMustWaitFor,
    'Product profile first conversation wait-for items',
  );
  assertIncludesAll(
    firstConversation.must_not_wait_for,
    fullReadinessItems,
    'Product profile first conversation non-blocking readiness items',
  );
}

function validateFullFirstInstallBackgroundPolicy(profile) {
  const fullFirstInstall = profile.first_run?.core_ready_policy?.full_first_install_clean_machine;
  for (const tool of requiredHostTools) {
    if (!fullFirstInstall?.missing_host_tools_allowed?.includes(tool)) {
      throw new Error(`Product profile Full first-install policy must allow missing ${tool}`);
    }
  }
  if (fullFirstInstall?.initial_runtime_source !== 'bundled_runtime' || fullFirstInstall?.core_ready_without_host_tools !== true) {
    throw new Error('Product profile Full first-install must reach Core ready through bundled_runtime without host tools');
  }
  for (const blocker of deferredMaintenanceItems) {
    if (!fullFirstInstall?.must_not_block_core_ready?.includes(blocker)) {
      throw new Error(`Product profile Full first-install must not block Core ready on ${blocker}`);
    }
    if (!profile.first_run?.background_maintenance?.items?.includes(blocker)) {
      throw new Error(`Product profile background maintenance must include ${blocker}`);
    }
  }
  if (profile.first_run?.background_maintenance?.blocks_core_ready !== false) {
    throw new Error('Product profile background maintenance must not block Core ready');
  }
  if (
    profile.first_run?.background_maintenance?.mode !== 'best_effort_after_core_ready'
    || profile.first_run?.background_maintenance?.continues_after_core_ready !== true
  ) {
    throw new Error('Product profile background maintenance must continue best-effort after Core ready');
  }
  if (
    fullFirstInstall?.post_core_ready_background_policy?.mode !== 'best_effort_non_blocking'
    || fullFirstInstall?.post_core_ready_background_policy?.continues_after_core_ready !== true
  ) {
    throw new Error('Product profile Full first-install must continue best-effort maintenance after Core ready');
  }
  for (const blocker of deferredMaintenanceItems) {
    if (!fullFirstInstall?.post_core_ready_background_policy?.managed_items?.includes(blocker)) {
      throw new Error(`Product profile Full first-install post-Core maintenance must manage ${blocker}`);
    }
  }
}

function validateFirstRunProgressModel(profile) {
  assertFirstRunProgressModelShape(profile.first_run?.progress_model, 'Product profile first-run progress model');
}

function validateStandardPackagePolicy(profile) {
  const standardPackage = profile.first_run?.core_ready_policy?.standard_package;
  if (
    standardPackage?.bootstrap_owner !== 'app_managed'
    || standardPackage?.maintenance_owner !== 'app_managed'
    || standardPackage?.user_first_screen_terminal_instruction_allowed !== false
    || standardPackage?.manual_host_tool_install_terminal_state_allowed !== false
    || standardPackage?.maintenance_resolution_policy !== 'app_or_cli_managed_best_effort_until_ready'
  ) {
    throw new Error('Product profile standard package must use App-managed bootstrap/maintenance without terminal-install end states');
  }
  for (const forbidden of ['install_homebrew_first', 'install_node_first', 'install_git_first']) {
    if (!standardPackage?.forbidden_terminal_instruction_end_states?.includes(forbidden)) {
      throw new Error(`Product profile standard bootstrap must forbid ${forbidden}`);
    }
  }
}

function validateCommandLineToolsPolicy(profile) {
  if (profile.first_run?.command_line_tools?.installer_command !== 'xcode-select --install') {
    throw new Error('Product profile CLT installer command must be xcode-select --install');
  }
  if (profile.first_run?.command_line_tools?.system_installer_only !== true) {
    throw new Error('Product profile CLT installer must use the macOS system installer path');
  }
  if (profile.first_run?.command_line_tools?.waits_for_user_confirmation !== true) {
    throw new Error('Product profile CLT installer must wait for user confirmation');
  }
}

function validateStandardUpdatePolicy(profile) {
  if (
    profile.first_run?.updates?.standard_channel?.implementation_reference !== 'electron_autoUpdater_background_download_update_downloaded_restart_prompt'
    || profile.first_run?.updates?.standard_channel?.ready_prompt !== 'prompt_restart_after_download_ready'
    || profile.first_run?.updates?.standard_channel?.full_first_install_metadata_allowed !== false
    || profile.first_run?.updates?.standard_channel?.download_policy !== 'background_download'
    || profile.first_run?.updates?.standard_channel?.apply_policy !== 'restart_when_ready'
    || profile.first_run?.updates?.standard_channel?.blocks_core_ready !== false
  ) {
    throw new Error('Product profile standard updates must download in background, prompt restart after ready, exclude Full metadata, and not block Core ready');
  }
}

function validateCompanionPayloadAuthority(profile, installExposurePolicy) {
  if (profile.companion_payloads?.install_exposure_policy_ref !== 'contracts/app-install-exposure-policy.json') {
    throw new Error('Product profile companion payloads must reference app-install-exposure-policy.json');
  }
  if (profile.companion_payloads?.exposure_classes_ref !== 'contracts/app-install-exposure-policy.json#exposure_classes') {
    throw new Error('Product profile companion payloads must reference install exposure classes');
  }
  if (profile.companion_payloads?.public_abi?.primary_semantic_entry !== installExposurePolicy.public_abi?.primary_semantic_entry) {
    throw new Error('Product profile companion payload public ABI must match install exposure primary semantic entry');
  }
  if (profile.companion_payloads.public_abi.preferred_app_distribution !== 'plugin_packaged_skill') {
    throw new Error('Product profile companion payloads must prefer plugin-packaged skills for the App path');
  }
  if (profile.companion_payloads.public_abi.plugin_must_not_create_second_semantics !== true) {
    throw new Error('Product profile companion payloads must forbid second semantics from plugin packaging');
  }
  if (profile.companion_payloads.public_abi.cli_and_app_share_skill_semantics !== true) {
    throw new Error('Product profile companion payloads must keep CLI and App on shared skill semantics');
  }
  for (const moduleId of ecosystemModuleIds) {
    if (!profile.companion_payloads?.ecosystem_modules?.includes(moduleId)) {
      throw new Error(`Product profile must list ${moduleId} as ecosystem module`);
    }
    if (profile.companion_payloads?.management_authority?.[moduleId] !== 'app_or_cli_managed') {
      throw new Error(`Product profile must mark ${moduleId} as App/CLI managed`);
    }
  }
  assertIncludesAll(
    profile.companion_payloads?.domain_plugin_skill_ids,
    ['med-autoscience', 'med-autogrant', 'redcube-ai'],
    'Product profile domain plugin skill ids',
  );
  if (
    profile.companion_payloads?.opl_flow_dependency_policy_ref !==
      'gaofeng21cn/opl-flow:contracts/workflow-policy.json#requires+recommends' ||
    profile.companion_payloads?.full_dependency_closure_policy !==
      'bundle_requires_and_recommends_with_offline_bundle_full'
  ) {
    throw new Error('Product profile must delegate companion dependencies to OPL Flow');
  }
  if (profile.companion_payloads.domain_plugin_skills_must_not_be_companion_mirrors !== true) {
    throw new Error('Product profile domain plugin skills must not be companion skill mirrors');
  }
  for (const { expected, entry } of expectedDomainExposureEntryMap(
    profile.companion_payloads?.domain_exposure,
    installExposurePolicy.domain_exposure,
    (domainId) => `Product profile companion payloads missing domain exposure ${domainId}`,
  )) {
    if (entry.codex_visible_entry !== expected.codex_visible_entry) {
      throw new Error(`Product profile domain exposure ${expected.domain_id}.codex_visible_entry must be ${expected.codex_visible_entry}`);
    }
    if (entry.preferred_app_distribution !== expected.preferred_app_distribution) {
      throw new Error(`Product profile domain exposure ${expected.domain_id}.preferred_app_distribution must be ${expected.preferred_app_distribution}`);
    }
    if (entry.direct_skill_semantics_required !== true) {
      throw new Error(`Product profile domain exposure ${expected.domain_id} must require direct skill semantics`);
    }
  }
}

function validateProductProfileBoundary(profile) {
  for (const forbidden of forbiddenAuthorityOwners) {
    if (!profile.boundary?.app_does_not_own?.includes(forbidden)) {
      throw new Error(`Product profile boundary must exclude ${forbidden}`);
    }
  }
}

export function validateProductProfile(
  profile,
  installExposurePolicy,
  agentPackageRegistry = readJson(agentPackageRegistryPath),
) {
  validateProductProfileIdentity(profile);
  validateProductProfileContractRefs(profile);
  validateProductProfileCodexDefaults(profile);
  validateAgentPackageRegistryProjection(profile, agentPackageRegistry);
  validateFullFirstInstallCoreReadyPolicy(profile);
  validateStandardPackagePolicy(profile);
  validateCommandLineToolsPolicy(profile);
  validateStandardUpdatePolicy(profile);
  validateCompanionPayloadAuthority(profile, installExposurePolicy);
  validateProductProfileBoundary(profile);
}
