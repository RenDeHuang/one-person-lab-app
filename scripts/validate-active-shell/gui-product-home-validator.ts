import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  appOwnedCurrentTaskSlice,
  appOwnedGuiContractOrdinaryConversation,
  appOwnedHomeLayout,
  appOwnedRightContextInspectorTabIds,
} from './app-contract-constants.ts';
import { validateGuiProductAuthority } from './gui-product-authority-validator.ts';

const defaultAssistantIds = ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'];
const purposeEntryIds = ['research', 'grant', 'ppt', 'book'];
const managedPackageIds = [...defaultAssistantIds, 'opl-meta-agent'];
const requiredSkillByAssistantId = {
  'med-autoscience': 'mas',
  'med-autogrant': 'mag',
  'redcube-ai': 'rca',
  'opl-bookforge': 'opl-bookforge',
};
const requiredSkillByPackageId = {
  'med-autoscience': ['mas'],
  'med-autogrant': ['mag'],
  'redcube-ai': ['rca'],
  'opl-bookforge': ['opl-bookforge'],
  'opl-meta-agent': ['opl-meta-agent'],
};
const codexEntryByPackageId = {
  'med-autoscience': 'mas',
  'med-autogrant': 'mag',
  'redcube-ai': 'rca',
  'opl-bookforge': 'opl-bookforge',
  'opl-meta-agent': 'opl-meta-agent',
};
const rightInspectorExpected = {
  placement: 'right',
  default_state: 'collapsed',
  opens_on_user_request_only: true,
  chat_canvas_remains_primary: true,
  scope: 'selected_workspace_and_conversation',
};
const rightInspectorForbiddenOwners = [
  'runtime truth',
  'domain truth',
  'artifact body',
  'memory body',
  'backend selection authority',
];

function validateGuiProductIdentity(guiContract) {
  if (guiContract.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected App GUI product contract owner: ${guiContract.owner}`);
  }
  if (guiContract.purpose !== 'app_owned_gui_product_contract') {
    throw new Error(`Unexpected App GUI product contract purpose: ${guiContract.purpose}`);
  }
  if (guiContract.state !== 'active') {
    throw new Error(`Unexpected App GUI product contract state: ${guiContract.state}`);
  }
  if (guiContract.product_authority?.source_of_truth !== 'one-person-lab-app') {
    throw new Error('App GUI product contract source of truth must be one-person-lab-app');
  }
  if (guiContract.product_authority.active_shell_role !== 'implementation_carrier') {
    throw new Error('App GUI product contract must treat the active shell as implementation carrier');
  }
  if (guiContract.product_authority.upstream_gui_role !== 'implementation_material_only') {
    throw new Error('App GUI product contract must keep upstream GUI behavior as implementation material only');
  }
  if (guiContract.product_authority.upstream_behavior_acceptance_policy !== 'must_match_app_owned_gui_product_contract_before_release') {
    throw new Error('App GUI product contract must gate upstream behavior against App-owned GUI requirements');
  }
  validateGuiProductAuthority(guiContract.product_authority);
}

function validateExecutorPolicy(guiContract) {
  if (guiContract.executor_policy?.default_executor !== 'codex_cli') {
    throw new Error('App GUI default executor must be Codex CLI');
  }
  if (guiContract.executor_policy.codex_only_default !== true) {
    throw new Error('App GUI default executor policy must be Codex-only');
  }
  if (guiContract.executor_policy.executor_tab_visible_when_single_executor !== false) {
    throw new Error('App GUI must hide executor tab when Codex CLI is the only executor');
  }
}

function validateHomeLayout(guiContract) {
  assertDeepEqualJson(guiContract.home_layout, appOwnedHomeLayout, 'App GUI home layout');
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(guiContract.ordinary_conversation ?? {}).filter(
        ([key]) => !['current_task_slice', 'agent_package_invocation_receipt_required'].includes(key),
      ),
    ),
    appOwnedGuiContractOrdinaryConversation,
    'App GUI ordinary conversation contract',
  );
  if (guiContract.ordinary_conversation?.agent_package_invocation_receipt_required !== true) {
    throw new Error('App GUI ordinary conversation must require agent package invocation receipts');
  }
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(guiContract.ordinary_conversation?.current_task_slice ?? {}).filter(([key]) => key !== 'fields'),
    ),
    Object.fromEntries(Object.entries(appOwnedCurrentTaskSlice).filter(([key]) => key !== 'fields')),
    'App GUI ordinary conversation current task slice shell policy',
  );
  assertIncludesAll(
    guiContract.ordinary_conversation?.current_task_slice?.fields,
    [
      ...appOwnedCurrentTaskSlice.fields,
      'resource_plan_ref',
      'resource_approval_ref',
      'resource_usage_ref',
      'console_policy_ref',
      'environment_template_ref',
      'environment_version_ref',
    ],
    'App GUI ordinary conversation current task slice fields',
  );
}

function validateAiFirstInteractionModel(guiContract) {
  const model = guiContract.ai_first_interaction_model;
  if (
    !model ||
    model.default_visual_basis !== 'codex_app_composer_first' ||
    model.primary_policy !== 'maximize_direct_ai_interaction_on_the_chat_canvas' ||
    model.right_context_policy !== 'collapsed_user_requested_secondary_layer' ||
    model.mas_autonomy_policy !== 'MAS_runs_as_autonomous_research_execution_not_co_scientist_pair_work' ||
    model.open_science_learning_policy !== 'adopt_artifact_provenance_review_and_plain_language_data_flow_patterns_as_secondary_context_only'
  ) {
    throw new Error('App GUI AI-first interaction model must keep Codex App composer-first defaults and collapsed secondary context');
  }
  assertIncludesAll(
    model.allowed_adoptions,
    [
      'artifact_provenance_review_refs_in_collapsible_inspector',
      'plain_language_data_flow_and_safety_copy',
      'workflow_starters_as_purpose_entries_or_app_actions',
      'scientific_preview_affordances_on_demand',
    ],
    'App GUI AI-first allowed external learning adoptions',
  );
  assertIncludesAll(
    model.must_not_default_to,
    [
      'three-column scientific workbench',
      'open artifact inspector',
      'side-by-side co-scientist monitoring',
      'Home activity cockpit',
      'foreign runtime or domain authority',
    ],
    'App GUI AI-first forbidden defaults',
  );
}

function validateRightContextInspector(guiContract) {
  assertDeepEqualJson(
    (guiContract.right_context_inspector?.tabs ?? []).map((tab) => tab.id),
    appOwnedRightContextInspectorTabIds,
    'App GUI right context inspector tabs',
  );
  for (const [field, expected] of Object.entries(rightInspectorExpected)) {
    if (guiContract.right_context_inspector?.[field] !== expected) {
      throw new Error(`App GUI right context inspector ${field} must be ${expected}`);
    }
  }
  for (const forbiddenOwner of rightInspectorForbiddenOwners) {
    if (!guiContract.right_context_inspector?.must_not_own?.includes(forbiddenOwner)) {
      throw new Error(`App GUI right context inspector must not own ${forbiddenOwner}`);
    }
  }
}

function validateDefaultAssistants(guiContract) {
  const assistants = new Map((guiContract.default_assistants ?? []).map((assistant) => [assistant.id, assistant]));
  for (const assistantId of defaultAssistantIds) {
    const assistant = assistants.get(assistantId);
    if (!assistant) {
      throw new Error(`App GUI contract missing default assistant ${assistantId}`);
    }
    if (assistant.home_entry_policy !== 'purpose_entry_target' || assistant.home_entry_display_policy !== 'purpose_first') {
      throw new Error(`Default assistant ${assistantId} must be a purpose-first entry target`);
    }
  }
  if (assistants.has('opl-meta-agent')) {
    throw new Error('OMA must not be a default App GUI assistant');
  }
  if (assistants.has('mds')) {
    throw new Error('MDS must not be a default App GUI assistant');
  }
}

function validateProfessionalAgentPackages(guiContract) {
  const packages = guiContract.professional_agent_packages ?? [];
  assertDeepEqualJson(
    packages.map((entry) => entry.package_id),
    managedPackageIds,
    'App GUI contract professional agent packages',
  );
  for (const entry of packages) {
    if (
      entry.installed_manageable !== true ||
      entry.codex_visible_entry !== codexEntryByPackageId[entry.package_id] ||
      JSON.stringify(entry.required_skill_ids) !== JSON.stringify(requiredSkillByPackageId[entry.package_id]) ||
      entry.required_skill_policy !== 'checked_locked' ||
      entry.optional_skill_policy !== 'unchecked_user_selectable' ||
      entry.skill_menu_policy !== 'assistant_scoped_required_checked_optional_visible'
    ) {
      throw new Error(`App GUI professional agent package ${entry.package_id} has invalid shortcut or skill policy`);
    }
    if (defaultAssistantIds.includes(entry.package_id)) {
      if (entry.package_kind !== 'starter_professional_agent_package' || entry.default_home_visible !== true || entry.home_shortcut_ids.length !== 1) {
        throw new Error(`App GUI starter package ${entry.package_id} must be default home visible through one shortcut`);
      }
    }
    if (entry.package_id === 'opl-meta-agent' && (
      entry.package_kind !== 'managed_professional_agent_package' ||
      entry.default_home_visible !== false ||
      entry.home_shortcut_ids.length !== 0
    )) {
      throw new Error('App GUI contract must keep OMA installed/manageable but out of default home shortcuts');
    }
  }
}

function validateAssistantSkillProfiles(guiContract) {
  const skillProfiles = guiContract.assistant_skill_profiles ?? [];
  assertDeepEqualJson(
    skillProfiles.map((profile) => profile.assistant_id),
    defaultAssistantIds,
    'App GUI contract assistant skill profiles',
  );
  for (const profile of skillProfiles) {
    const requiredSkill = requiredSkillByAssistantId[profile.assistant_id];
    if (!requiredSkill || JSON.stringify(profile.required_skills) !== JSON.stringify([requiredSkill])) {
      throw new Error(`App GUI assistant ${profile.assistant_id} must require its App-declared matching skill`);
    }
    if (
      profile.required_skill_policy !== 'checked_locked' ||
      profile.optional_skill_policy !== 'unchecked_user_selectable' ||
      profile.skill_menu_policy !== 'assistant_scoped_required_checked_optional_visible'
    ) {
      throw new Error(`App GUI assistant ${profile.assistant_id} has invalid home skill policy`);
    }
    if ('hidden_home_skill_names' in profile) {
      throw new Error(`App GUI assistant ${profile.assistant_id} must not carry UI hiding policy`);
    }
  }
}

function validatePurposeEntries(guiContract) {
  const purposeEntries = guiContract.home_purpose_entries ?? [];
  assertDeepEqualJson(
    purposeEntries.map((entry) => entry.id),
    purposeEntryIds,
    'App GUI contract purpose entries',
  );
  assertDeepEqualJson(
    purposeEntries.map((entry) => entry.target_assistant_id),
    defaultAssistantIds,
    'App GUI contract purpose entry targets',
  );
  for (const entry of purposeEntries) {
    if (entry.display_policy !== 'purpose_first' || entry.home_entry_policy !== 'visible_click_to_start') {
      throw new Error(`App GUI purpose entry ${entry.id} must be purpose-first and click-to-start`);
    }
  }
  const shortcuts = guiContract.home_agent_shortcuts ?? [];
  assertDeepEqualJson(
    shortcuts.map((entry) => entry.shortcut_id),
    purposeEntryIds,
    'App GUI contract home agent shortcuts',
  );
  assertDeepEqualJson(
    shortcuts.map((entry) => entry.package_id),
    defaultAssistantIds,
    'App GUI contract home agent shortcut package targets',
  );
  for (const entry of shortcuts) {
    if (
      entry.executor !== 'codex_cli' ||
      entry.source !== 'opl_app_home' ||
      entry.display_policy !== 'purpose_first' ||
      entry.home_entry_policy !== 'visible_click_to_start' ||
      entry.default_visible !== true ||
      entry.user_configurable !== true ||
      JSON.stringify(entry.required_skill_ids) !== JSON.stringify(requiredSkillByPackageId[entry.package_id])
    ) {
      throw new Error(`App GUI home agent shortcut ${entry.shortcut_id} must be a configurable Codex package launch shortcut`);
    }
  }
}

function validateNonDefaultAndRetiredAssistants(guiContract) {
  const oma = (guiContract.non_default_assistants ?? []).find((assistant) => assistant.id === 'opl-meta-agent');
  if (!oma || oma.home_default_visible !== false || oma.home_entry_policy !== 'explicit_or_settings_only') {
    throw new Error('App GUI contract must keep OMA available but out of default home entries');
  }
  const retiredMds = (guiContract.retired_domain_agents ?? []).find((agent) => agent.id === 'mds');
  if (retiredMds?.default_display_allowed !== false) {
    throw new Error('App GUI contract must mark MDS as not default-displayed');
  }
}

export function validateGuiProductHomeContract(guiContract) {
  validateGuiProductIdentity(guiContract);
  validateExecutorPolicy(guiContract);
  validateHomeLayout(guiContract);
  validateAiFirstInteractionModel(guiContract);
  validateRightContextInspector(guiContract);
  validateProfessionalAgentPackages(guiContract);
  validateDefaultAssistants(guiContract);
  validateAssistantSkillProfiles(guiContract);
  validatePurposeEntries(guiContract);
  validateNonDefaultAndRetiredAssistants(guiContract);
}
