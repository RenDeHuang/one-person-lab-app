import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertDeepEqualJson, readJson } from './assertions.ts';

const ALLOWED_CLASSIFICATIONS = ['absorbed', 'rejected', 'deferred'];
const REQUIRED_RECORD_FIELDS = [
  'id',
  'upstream_surface',
  'classification',
  'owner_ref',
  'release_gate',
  'dependencies',
  'evidence',
];
const REQUIRED_MANAGED_AGENT_REMEDIATION_REF = '6875ada9fa6e800b64980dadb02180def6b0f6e2';
const REQUIRED_CAPABILITY_RULES = {
  startup_directories: {
    classification: 'absorbed',
    releaseGate: 'shell_startup_focused_tests_plus_app_quick_gate',
    dependencies: [],
  },
  database_recovery: {
    classification: 'absorbed',
    releaseGate: 'database_recovery_dependency_satisfied',
    dependencies: ['aioncore_database_recovery'],
  },
  managed_agent_api: {
    classification: 'absorbed',
    releaseGate: 'managed_agent_api_contract_and_shell_semantic_gate',
    dependencies: [],
    remediationRequired: true,
    remediationRef: REQUIRED_MANAGED_AGENT_REMEDIATION_REF,
  },
  feedback_diagnostics_privacy: {
    classification: 'absorbed',
    releaseGate: 'feedback_privacy_redaction_verified',
    dependencies: [],
    remediationRequired: true,
  },
  cron_history: {
    classification: 'absorbed',
    releaseGate: 'shell_cron_focused_tests_plus_app_quick_gate',
    dependencies: [],
  },
  guid_slash_allowlist: {
    classification: 'absorbed',
    releaseGate: 'guid_slash_allowlist_focused_tests_plus_app_quick_gate',
    dependencies: [],
  },
  settings_i18n: {
    classification: 'absorbed',
    releaseGate: 'settings_i18n_focused_tests_plus_app_quick_gate',
    dependencies: [],
  },
  non_zh_en_locales: {
    classification: 'rejected',
    releaseGate: 'non_zh_en_locale_payload_must_remain_absent',
    dependencies: [],
  },
  aionui_team: {
    classification: 'rejected',
    releaseGate: 'implementation_probes.aionui_team_disabled_surface',
    dependencies: [],
  },
};
const REQUIRED_DEPENDENCY_RULES = {
  aioncore_database_recovery: {
    classification: 'absorbed',
    releaseGate: 'aioncore_database_recovery_verified',
    dependencies: [],
    remediationRequired: true,
  },
};
const REQUIRED_CAPABILITY_IDS = Object.keys(REQUIRED_CAPABILITY_RULES);
const REQUIRED_DEPENDENCY_IDS = Object.keys(REQUIRED_DEPENDENCY_RULES);
const REQUIRED_SOURCE_REF_ROLES = {
  fork_base: 'shared_fork_base',
  evaluated_upstream: 'evaluated_upstream_release',
  selective_absorption_head: 'scoped_absorption_and_intake_record_head',
  latest_reviewed_upstream: 'reviewed_stable_release_not_merged',
};
const REQUIRED_AIONCORE_VERSION = 'v0.1.44';
const REQUIRED_AIONCORE_EVIDENCE = 'packaged_aioncore_boundary_and_recovery_smoke';
const REQUIRED_MANAGED_AGENT_NODE_TESTS = [
  'tests/unit/common-adapter/ipcBridgeAgents.test.ts',
  'tests/unit/common-adapter/apiModelMapper.test.ts',
  'tests/unit/common-adapter/ipcBridgeTeamGate.test.ts',
  'tests/unit/conversation/createConversationParams.test.ts',
  'tests/unit/assistants/migrateAssistants.test.ts',
  'tests/unit/renderer/channelAssistantOptions.test.ts',
  'tests/unit/cron/resolveCronAgentConfig.test.ts',
  'tests/unit/common-adapter/teamMapper.test.ts',
];
const REQUIRED_MANAGED_AGENT_DOM_TESTS = [
  'tests/unit/guid/useGuidSend.oplWhitelist.dom.test.tsx',
  'tests/unit/assistants/useAssistantEditor.dom.test.ts',
];
const REQUIRED_MANAGED_AGENT_FOCUSED_COMMANDS = [
  {
    id: 'managed_agent_behavior_node',
    cwd: 'shells/aionui',
    command: `bunx vitest run ${REQUIRED_MANAGED_AGENT_NODE_TESTS.join(' ')}`,
  },
  {
    id: 'managed_agent_behavior_dom',
    cwd: 'shells/aionui',
    command: `VITEST_INCLUDE_DOM=1 bunx vitest run --project dom ${REQUIRED_MANAGED_AGENT_DOM_TESTS.join(' ')}`,
  },
];
const REQUIRED_MANAGED_AGENT_API_CONTRACT = {
  source: 'aioncore_v0.1.44_live_api_compatibility',
  root_cause_guard: 'prevent_v2.1.31_managed_agent_capability_migration_omission',
  required_aioncore_version: 'v0.1.44',
  assistant_identity_policy: {
    canonical_identity_source: 'Assistant.id',
    allowed_assistant_kinds: ['generated', 'preset'],
    runtime_identity_policy: 'runtime_ids_may_support_display_or_execution_but_never_replace_Assistant.id_on_wire',
  },
  business_assistant_catalog: {
    consumer: 'business_assistant_selection',
    source_policy: 'consume_assistants_catalog_only',
    method: 'GET',
    route: '/api/assistants',
    response: 'Assistant[]',
  },
  managed_agent_catalog: {
    consumers: ['agent_settings', 'agent_diagnostics', 'runtime_metadata'],
    method: 'GET',
    route: '/api/agents/management',
    response: 'ManagedAgent[]',
  },
  managed_agent_health_check: {
    consumer: 'agent_diagnostics',
    method: 'POST',
    route_template: '/api/agents/{id}/health-check',
    success_status: 200,
  },
  migration_policy: {
    import_checkpoint: 'persist_immediately_after_legacy_import',
    deleted_assistant_policy: 'must_not_reimport_after_user_deletion',
  },
  implementation_surfaces: {
    source_root: 'packages/desktop/src',
    bridge: 'packages/desktop/src/common/adapter/ipcBridge.ts',
    conversation_writer: 'packages/desktop/src/common/adapter/apiModelMapper.ts',
    conversation_parameter_builder: 'packages/desktop/src/common/utils/buildAgentConversationParams.ts',
    team_mapper: 'packages/desktop/src/common/adapter/teamMapper.ts',
    team_types: 'packages/desktop/src/common/types/team/teamTypes.ts',
    migration: 'packages/desktop/src/process/utils/migrateAssistants.ts',
    managed_hook: 'packages/desktop/src/renderer/hooks/agent/useManagedAgents.ts',
    managed_types: 'packages/desktop/src/renderer/utils/model/agentTypes.ts',
    assistant_catalog_hook: 'packages/desktop/src/renderer/hooks/assistant/useAssistantList.ts',
    assistant_editor: 'packages/desktop/src/renderer/hooks/assistant/useAssistantEditor.ts',
    guid_business_loader: 'packages/desktop/src/renderer/pages/guid/hooks/useCustomAgentsLoader.ts',
    guid_agent_selection: 'packages/desktop/src/renderer/pages/guid/hooks/useGuidAgentSelection.ts',
    conversation_agents: 'packages/desktop/src/renderer/pages/conversation/hooks/useConversationAgents.ts',
    conversation_parameter_resolver:
      'packages/desktop/src/renderer/pages/conversation/utils/createConversationParams.ts',
    conversation_guid_callers: 'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts',
    channel_assistant_selection:
      'packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/assistantOptions.ts',
    channel_forms: [
      'packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/TelegramConfigForm.tsx',
      'packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/LarkConfigForm.tsx',
      'packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/WecomConfigForm.tsx',
      'packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/DingTalkConfigForm.tsx',
      'packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/WeixinConfigForm.tsx',
    ],
    cron_create_dialog: 'packages/desktop/src/renderer/pages/cron/ScheduledTasksPage/CreateTaskDialog.tsx',
    cron_agent_config_resolver:
      'packages/desktop/src/renderer/pages/cron/ScheduledTasksPage/resolveCronAgentConfig.ts',
    team_agent_options: 'packages/desktop/src/renderer/pages/team/components/agentSelectUtils.tsx',
    team_create_modal: 'packages/desktop/src/renderer/pages/team/components/TeamCreateModal.tsx',
    team_add_agent_caller: 'packages/desktop/src/renderer/pages/team/hooks/useTeamSession.ts',
  },
  focused_tests: {
    node: REQUIRED_MANAGED_AGENT_NODE_TESTS,
    dom: REQUIRED_MANAGED_AGENT_DOM_TESTS,
  },
  retired_facade_paths: [
    'packages/desktop/src/renderer/hooks/agent/useAgents.ts',
    'packages/desktop/src/renderer/hooks/assistant/useDetectedAgents.ts',
  ],
  verification_policy: {
    quick_gate_claim: 'contract_structure_remediation_ancestry_required_paths_and_retired_facade_absence_only',
    quick_gate_runs_focused_tests: false,
    required_path_claim: 'presence_only_not_behavior',
    focused_behavior_command_ids: ['managed_agent_behavior_node', 'managed_agent_behavior_dom'],
    focused_behavior_claim: 'only_successful_command_execution_proves_behavior',
    full_active_shell_policy: 'focused_behavior_commands_execute_before_test_full',
  },
  write_contracts: {
    assistant: {
      route: '/api/assistants',
      runtime_binding_field: 'agent_id',
    },
    conversation: {
      create_method: 'POST',
      create_route: '/api/conversations',
      assistant_identity_path: 'assistant.id',
      assistant_placement: 'top_level',
      caller_ids: ['openclaw_gateway', 'nanobot', 'aionrs', 'acp_remote_custom_and_preset_fallbacks'],
    },
    channel: {
      read_method: 'GET',
      read_route_template: '/api/channel/settings/{platform}',
      write_method: 'PUT',
      write_route_template: '/api/channel/settings/{platform}/assistant',
      selection_hook: 'useChannelAssistantSelection',
      identity_field: 'assistant_id',
      identity_source: 'Assistant.id',
    },
    cron: {
      create_endpoint: 'addJob',
      update_endpoint: 'updateJob',
      identity_path: 'agent_config.assistant_id',
      schedule_field_map: {
        atMs: 'at_ms',
        everyMs: 'every_ms',
      },
      existing_conversation_update_agent_config: 'omit',
      aionrs_provider_identity_path: 'agent_config.model.provider_id',
    },
    team: {
      create_endpoint: 'create',
      add_agent_endpoint: 'addAgent',
      shared_mapper: 'toBackendAgent',
      identity_field: 'assistant_id',
      identity_source: 'Assistant.id',
      response_members_field: 'assistants',
      response_leader_field: 'leader_assistant_id',
      events: {
        'team.agentStatusChanged': 'fromBackendTeamAgentStatusEvent',
        'team.agentSpawned': 'fromBackendTeamAgentSpawnedEvent',
        'team.agentRemoved': 'passthrough',
        'team.agentRenamed': 'fromBackendTeamAgentRenamedEvent',
        'team.listChanged': 'passthrough',
        'team.teammateMessage': 'passthrough',
      },
    },
  },
  release_claim_policy: 'contract_and_gate_pass_do_not_prove_installed_runtime_ready',
};
const REQUIRED_AIONCORE_BOUNDARY = {
  required_boundary_code: 'BOOTSTRAP_DATA_INIT_FAILED',
  accepted_failure_boundaries: [
    {
      stage: 'database.recoverable_corruption',
      required_corruption_markers_any_of: [],
    },
    {
      stage: 'database.open',
      required_corruption_markers_any_of: [
        'sqlite_corrupt',
        'sqlite_notadb',
        'database disk image is malformed',
        'file is not a database',
        'malformed database schema',
      ],
    },
  ],
  recovery_success_boundary: {
    code: 'BOOTSTRAP_RECOVERED_DATABASE_CORRUPTION',
    stage: 'database.recovery',
  },
};
const REQUIRED_TEAM_PROBE_IDS = [
  'team_mode_disabled',
  'team_route_redirect',
  'team_sidebar_gate',
  'team_created_redirect_noop',
  'ordinary_conversation_team_snapshot_scrub',
  'agent_switching_drops_team_mcp',
  'team_deep_link_not_whitelisted',
  'team_bridge_mutation_gate',
];
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertStringArray(value, label, { allowEmpty = false } = {}) {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    !value.every((entry) => typeof entry === 'string' && entry.trim())
  ) {
    throw new Error(`${label} must be ${allowEmpty ? 'a' : 'a non-empty'} string array`);
  }
}

function assertGitSha(value, label) {
  if (typeof value !== 'string' || !GIT_SHA_PATTERN.test(value)) {
    throw new Error(`${label} must be a full lowercase Git SHA`);
  }
}

function isBlockedReleaseGate(value) {
  return value.startsWith('blocked_');
}

function validateRecordShape(record, label) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`${label} must be an object`);
  }
  for (const field of REQUIRED_RECORD_FIELDS) {
    if (!(field in record)) {
      throw new Error(`${label} missing required field ${field}`);
    }
  }
  for (const field of ['id', 'upstream_surface', 'classification', 'owner_ref', 'release_gate']) {
    assertNonEmptyString(record[field], `${label}.${field}`);
  }
  if (record.remediation_ref !== undefined) {
    assertGitSha(record.remediation_ref, `${label}.remediation_ref`);
  }
  assertStringArray(record.dependencies, `${label}.dependencies`, { allowEmpty: true });
  assertStringArray(record.evidence, `${label}.evidence`);
  if (!ALLOWED_CLASSIFICATIONS.includes(record.classification)) {
    throw new Error(`${label}.classification must be one of ${ALLOWED_CLASSIFICATIONS.join(', ')}`);
  }
  if (record.classification === 'deferred' && !isBlockedReleaseGate(record.release_gate)) {
    throw new Error(`${label} deferred classification must use a blocked release gate`);
  }
  if (record.classification === 'rejected' && record.dependencies.length > 0) {
    throw new Error(`${label} rejected classification must not declare dependencies`);
  }
}

function indexRequiredRecords(records, rules, label) {
  if (!Array.isArray(records)) {
    throw new Error(`${label} must be an array`);
  }
  const requiredIds = Object.keys(rules);
  const ids = records.map((record) => record?.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} must not contain duplicate ids`);
  }
  assertDeepEqualJson(ids, requiredIds, `${label} ids`);
  const byId = new Map();
  for (const record of records) {
    validateRecordShape(record, `${label}.${record.id}`);
    const rule = rules[record.id];
    if (record.classification !== rule.classification) {
      throw new Error(`${label}.${record.id}.classification must be ${rule.classification}`);
    }
    if (record.release_gate !== rule.releaseGate) {
      throw new Error(`${label}.${record.id}.release_gate must be ${rule.releaseGate}`);
    }
    assertDeepEqualJson(record.dependencies, rule.dependencies, `${label}.${record.id}.dependencies`);
    if (rule.remediationRequired) {
      if (!record.remediation_ref) {
        throw new Error(`${label}.${record.id} requires remediation_ref`);
      }
      if (rule.remediationRef && record.remediation_ref !== rule.remediationRef) {
        throw new Error(`${label}.${record.id}.remediation_ref must be ${rule.remediationRef}`);
      }
      if (!record.evidence.includes(`shell_commit:${record.remediation_ref}`)) {
        throw new Error(`${label}.${record.id} evidence must bind shell_commit to remediation_ref`);
      }
    }
    byId.set(record.id, record);
  }
  return byId;
}

function validateDependencyTopology(capabilityById, dependencyById) {
  for (const [id, record] of capabilityById) {
    for (const dependencyId of record.dependencies) {
      if (!dependencyById.has(dependencyId)) {
        throw new Error(`Active shell upstream intake capabilities.${id} references unknown dependency ${dependencyId}`);
      }
    }
    if (record.classification !== 'absorbed') continue;

    const unresolvedDependencies = record.dependencies.filter(
      (dependencyId) => dependencyById.get(dependencyId).classification !== 'absorbed',
    );
    if (unresolvedDependencies.length > 0 && !isBlockedReleaseGate(record.release_gate)) {
      throw new Error(`Active shell upstream intake capabilities.${id} must stay release-blocked while a dependency is not absorbed`);
    }
    if (unresolvedDependencies.length === 0 && isBlockedReleaseGate(record.release_gate)) {
      throw new Error(`Active shell upstream intake capabilities.${id} has a blocked release gate without an unresolved dependency`);
    }
  }
}

function validateSourceRefs(upstreamIntake) {
  const sourceRefs = upstreamIntake.source_refs;
  if (!sourceRefs || typeof sourceRefs !== 'object' || Array.isArray(sourceRefs)) {
    throw new Error('Active shell upstream intake source_refs must be an object');
  }
  assertDeepEqualJson(
    Object.keys(sourceRefs).toSorted(),
    Object.keys(REQUIRED_SOURCE_REF_ROLES).toSorted(),
    'Active shell upstream intake source ref ids',
  );
  for (const [id, role] of Object.entries(REQUIRED_SOURCE_REF_ROLES)) {
    const sourceRef = sourceRefs[id];
    if (!sourceRef || typeof sourceRef !== 'object' || Array.isArray(sourceRef)) {
      throw new Error(`Active shell upstream intake source_refs.${id} must be an object`);
    }
    assertGitSha(sourceRef.ref, `Active shell upstream intake source_refs.${id}.ref`);
    if (sourceRef.role !== role) {
      throw new Error(`Active shell upstream intake source_refs.${id}.role must be ${role}`);
    }
  }
  if (sourceRefs.evaluated_upstream.release !== 'v2.1.31') {
    throw new Error('Active shell upstream intake evaluated release must be v2.1.31');
  }
  if (
    sourceRefs.latest_reviewed_upstream.release !== 'v2.1.34' ||
    sourceRefs.latest_reviewed_upstream.published_at !== '2026-07-13T14:57:12Z' ||
    sourceRefs.latest_reviewed_upstream.draft !== false ||
    sourceRefs.latest_reviewed_upstream.prerelease !== false ||
    sourceRefs.latest_reviewed_upstream.gui_delta !==
      'conversation_queue_and_team_renderer_changes_require_classification' ||
    sourceRefs.latest_reviewed_upstream.disposition !==
      'reviewed_not_absorbed_bounded_selective_intake_required'
  ) {
    throw new Error('Active shell latest reviewed upstream must record stable v2.1.34 as reviewed but not absorbed');
  }
  const refs = Object.values(sourceRefs).map((sourceRef) => sourceRef.ref);
  if (new Set(refs).size !== refs.length) {
    throw new Error('Active shell upstream intake source refs must identify distinct commits');
  }
}

function parseVersion(value, label) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) {
    throw new Error(`${label} must use vMAJOR.MINOR.PATCH`);
  }
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function defaultReadShellSourceFiles(shellRoot, _sourceRoot, requiredEvidencePaths = [], retiredFacadePaths = []) {
  const files = [];
  for (const relativePath of new Set([...requiredEvidencePaths, ...retiredFacadePaths])) {
    try {
      files.push({
        relativePath,
        text: readFileSync(path.join(shellRoot, relativePath), 'utf8'),
      });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return files.toSorted((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function indexShellSourceFiles(sourceFiles) {
  if (!Array.isArray(sourceFiles)) {
    throw new Error('Active shell managed-agent API source reader must return an array');
  }
  const byPath = new Map();
  for (const sourceFile of sourceFiles) {
    if (
      !sourceFile ||
      typeof sourceFile !== 'object' ||
      typeof sourceFile.relativePath !== 'string' ||
      typeof sourceFile.text !== 'string'
    ) {
      throw new Error('Active shell managed-agent API source entries must contain relativePath and text');
    }
    if (byPath.has(sourceFile.relativePath)) {
      throw new Error(`Active shell managed-agent API source reader returned duplicate ${sourceFile.relativePath}`);
    }
    byPath.set(sourceFile.relativePath, sourceFile.text);
  }
  return byPath;
}

function validateManagedAgentFocusedCommands(rootContract, managedAgentContract) {
  const validationCommands = rootContract.validation_commands;
  if (!Array.isArray(validationCommands)) {
    throw new Error('managed-agent focused behavior commands require validation_commands');
  }
  const fullTestIndex = validationCommands.findIndex((entry) => entry.id === 'test');
  if (fullTestIndex === -1) {
    throw new Error('managed-agent focused behavior commands require the full test validation command');
  }
  assertDeepEqualJson(
    managedAgentContract.verification_policy.focused_behavior_command_ids,
    REQUIRED_MANAGED_AGENT_FOCUSED_COMMANDS.map((entry) => entry.id),
    'managed-agent focused behavior command ids',
  );
  for (const expected of REQUIRED_MANAGED_AGENT_FOCUSED_COMMANDS) {
    const matches = validationCommands.filter((entry) => entry.id === expected.id);
    if (matches.length !== 1) {
      throw new Error(`managed-agent focused behavior command ${expected.id} must appear exactly once`);
    }
    assertDeepEqualJson(matches[0], expected, `managed-agent focused behavior command ${expected.id}`);
    if (validationCommands.indexOf(matches[0]) > fullTestIndex) {
      throw new Error(`managed-agent focused behavior command ${expected.id} must run before test`);
    }
  }
}

function validateManagedAgentApiCompatibility(rootContract, shellPaths, options) {
  const upstreamIntake = rootContract.upstream_intake;
  const contract = upstreamIntake.managed_agent_api_contract;
  assertDeepEqualJson(
    contract,
    REQUIRED_MANAGED_AGENT_API_CONTRACT,
    'Active shell managed-agent API compatibility contract',
  );

  const surfaces = contract.implementation_surfaces;
  const requiredSourcePaths = Object.entries(surfaces).flatMap(([key, value]) => {
    if (key === 'source_root') return [];
    return Array.isArray(value) ? value : [value];
  });
  const requiredTestPaths = Object.values(contract.focused_tests).flatMap((value) =>
    Array.isArray(value) ? value : [value],
  );
  const requiredEvidencePaths = [...new Set([...requiredSourcePaths, ...requiredTestPaths])];
  const readShellSourceFiles = options.readShellSourceFiles ?? defaultReadShellSourceFiles;
  let sourceFiles;
  try {
    sourceFiles = readShellSourceFiles(
      shellPaths.shellRoot,
      surfaces.source_root,
      requiredEvidencePaths,
      contract.retired_facade_paths,
    );
  } catch (error) {
    throw new Error(`Unable to read active shell managed-agent API source: ${error.message}`);
  }
  const sourceByPath = indexShellSourceFiles(sourceFiles);
  const errors = [];
  for (const relativePath of requiredEvidencePaths) {
    if (!sourceByPath.has(relativePath)) errors.push(`required managed-agent evidence missing ${relativePath}`);
  }
  for (const retiredPath of contract.retired_facade_paths) {
    if (sourceByPath.has(retiredPath)) errors.push(`retired managed-agent facade path found: ${retiredPath}`);
  }

  if (errors.length > 0) {
    throw new Error(`Active shell managed-agent API compatibility gate failed:\n- ${errors.join('\n- ')}`);
  }
  validateManagedAgentFocusedCommands(rootContract, contract);
}

function validateAionCoreRecoveryGate(dependency, shellPackage) {
  if (!dependency.version_gate || typeof dependency.version_gate !== 'object') {
    throw new Error('Active shell AionCore database recovery version_gate must be an object');
  }
  const versionGate = dependency.version_gate;
  for (const field of [
    'field_ref',
    'minimum_version',
    'evaluated_upstream_version',
    'selective_absorption_version',
    'state',
  ]) {
    assertNonEmptyString(versionGate[field], `Active shell AionCore database recovery version_gate.${field}`);
  }
  if (versionGate.field_ref !== 'package.json#aioncoreVersion') {
    throw new Error('Active shell AionCore database recovery version_gate.field_ref must be package.json#aioncoreVersion');
  }
  if (versionGate.minimum_version !== REQUIRED_AIONCORE_VERSION) {
    throw new Error(`Active shell AionCore database recovery version_gate.minimum_version must be ${REQUIRED_AIONCORE_VERSION}`);
  }
  if (versionGate.evaluated_upstream_version !== REQUIRED_AIONCORE_VERSION) {
    throw new Error(
      `Active shell AionCore database recovery version_gate.evaluated_upstream_version must be ${REQUIRED_AIONCORE_VERSION}`,
    );
  }

  assertNonEmptyString(shellPackage?.aioncoreVersion, 'Active shell package aioncoreVersion');
  if (shellPackage.aioncoreVersion !== versionGate.selective_absorption_version) {
    throw new Error(
      `active shell package aioncoreVersion ${shellPackage.aioncoreVersion} must match selective_absorption_version ${versionGate.selective_absorption_version}`,
    );
  }

  const selectedVersion = parseVersion(
    versionGate.selective_absorption_version,
    'Active shell AionCore selective absorption version',
  );
  const minimumVersion = parseVersion(versionGate.minimum_version, 'Active shell AionCore minimum recovery version');
  const evaluatedVersion = parseVersion(
    versionGate.evaluated_upstream_version,
    'Active shell evaluated upstream AionCore version',
  );
  if (compareVersions(evaluatedVersion, minimumVersion) < 0) {
    throw new Error('Evaluated upstream AionCore version must satisfy the minimum recovery version');
  }
  const meetsMinimum = compareVersions(selectedVersion, minimumVersion) >= 0;
  const expectedVersionState = meetsMinimum ? 'meets_minimum' : 'below_minimum';
  if (versionGate.state !== expectedVersionState) {
    throw new Error(`Active shell AionCore database recovery version_gate.state must be ${expectedVersionState}`);
  }

  const capabilityGate = dependency.capability_gate;
  if (!capabilityGate || typeof capabilityGate !== 'object' || Array.isArray(capabilityGate)) {
    throw new Error('Active shell AionCore database recovery capability gate must be an object');
  }
  if ('required_boundary_stage' in capabilityGate) {
    throw new Error('Active shell AionCore database recovery must not require one fixed required_boundary_stage');
  }
  assertDeepEqualJson(
    {
      required_boundary_code: capabilityGate.required_boundary_code,
      accepted_failure_boundaries: capabilityGate.accepted_failure_boundaries,
      recovery_success_boundary: capabilityGate.recovery_success_boundary,
    },
    REQUIRED_AIONCORE_BOUNDARY,
    'Active shell AionCore database recovery boundary contract',
  );
  if (!['unverified', 'verified'].includes(capabilityGate.state)) {
    throw new Error('Active shell AionCore database recovery capability_gate.state must be unverified or verified');
  }
  assertNonEmptyString(
    capabilityGate.required_evidence,
    'Active shell AionCore database recovery capability_gate.required_evidence',
  );
  if (capabilityGate.required_evidence !== REQUIRED_AIONCORE_EVIDENCE) {
    throw new Error(
      `Active shell AionCore database recovery capability_gate.required_evidence must be ${REQUIRED_AIONCORE_EVIDENCE}`,
    );
  }
  assertStringArray(capabilityGate.evidence, 'Active shell AionCore database recovery capability_gate.evidence', {
    allowEmpty: capabilityGate.state !== 'verified',
  });
  if (
    capabilityGate.state === 'verified' &&
    !capabilityGate.evidence.some((entry) => entry.startsWith(`${REQUIRED_AIONCORE_EVIDENCE}:`))
  ) {
    throw new Error('verified AionCore database recovery capability gate must bind its required evidence');
  }

  if (!['deferred', 'absorbed'].includes(dependency.classification)) {
    throw new Error('AionCore database recovery dependency classification must be deferred or absorbed');
  }
  if (dependency.classification === 'absorbed') {
    if (isBlockedReleaseGate(dependency.release_gate)) {
      throw new Error('absorbed AionCore database recovery dependency must not remain release-blocked');
    }
    if (!meetsMinimum) {
      throw new Error('absorbed AionCore database recovery dependency must satisfy its minimum version');
    }
    if (capabilityGate.state !== 'verified') {
      throw new Error('absorbed AionCore database recovery dependency requires capability_gate.state=verified');
    }
    if (!dependency.remediation_ref) {
      throw new Error('absorbed AionCore database recovery dependency requires remediation_ref');
    }
  }
}

function defaultIsGitAncestor(ref, shellRoot) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ref, 'HEAD'], {
    cwd: shellRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.error) throw result.error;
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  const detail = (result.stderr || result.stdout || '').trim();
  throw new Error(`Unable to verify active shell ancestor ${ref}: ${detail || `git exited ${result.status}`}`);
}

function validateActiveShellAncestry(upstreamIntake, records, shellRoot, isGitAncestor) {
  const refs = [{
    label: 'selective absorption',
    ref: upstreamIntake.source_refs.selective_absorption_head.ref,
  }];
  for (const record of records) {
    if (record.remediation_ref) refs.push({ label: 'remediation', ref: record.remediation_ref });
  }

  const checked = new Set();
  for (const entry of refs) {
    if (checked.has(entry.ref)) continue;
    checked.add(entry.ref);
    if (!isGitAncestor(entry.ref, shellRoot)) {
      throw new Error(`active shell HEAD must contain ${entry.label} ref ${entry.ref}`);
    }
  }
}

function validateRejectedBoundaries(contract, capabilityById) {
  const nonZhEnLocales = capabilityById.get('non_zh_en_locales');
  if (
    nonZhEnLocales.classification !== 'rejected' ||
    nonZhEnLocales.release_gate !== 'non_zh_en_locale_payload_must_remain_absent'
  ) {
    throw new Error('Active shell upstream intake must keep non-Chinese/English locale payloads rejected');
  }

  const teamIntake = capabilityById.get('aionui_team');
  if (
    teamIntake.classification !== 'rejected' ||
    teamIntake.ordinary_surface !== 'forbidden' ||
    teamIntake.owner_ref !== 'contracts/app-gui-product-contract.json#settings_navigation.team_surface_policy' ||
    teamIntake.release_gate !== 'implementation_probes.aionui_team_disabled_surface'
  ) {
    throw new Error('Active shell upstream intake must classify AionUI Team as rejected for ordinary surfaces');
  }
  const teamPolicy = contract.disabled_feature_policy?.aionui_team;
  for (const [field, expected] of Object.entries({
    state: 'disabled',
    ordinary_surface: 'rejected',
    route_policy: 'redirect_to_app_home',
    mutation_policy: 'team_created_redirect_noop',
    deep_link_policy: 'not_whitelisted',
    capability_snapshot_policy: 'scrub_before_render_or_inherit',
    agent_switching_policy: 'must_not_inherit_team_mcp',
  })) {
    if (teamPolicy?.[field] !== expected) {
      throw new Error(`Active shell disabled_feature_policy.aionui_team.${field} must be ${expected}`);
    }
  }
  const probeGroup = contract.implementation_probes?.aionui_team_disabled_surface;
  if (
    probeGroup?.source !== 'app_shell_upgrade_architecture_hardening' ||
    probeGroup?.policy !== 'fail_closed_required_for_active_shell_upgrade'
  ) {
    throw new Error('Active shell AionUI Team implementation probes must be fail-closed upgrade probes');
  }
  assertDeepEqualJson(
    (probeGroup.probes ?? []).map((probe) => probe.id),
    REQUIRED_TEAM_PROBE_IDS,
    'Active shell AionUI Team implementation probe ids',
  );
  for (const probe of probeGroup.probes ?? []) {
    if (
      probe.source_ref !== 'contracts/app-gui-product-contract.json#settings_navigation.team_surface_policy' ||
      probe.required !== true ||
      !Array.isArray(probe.required_evidence) ||
      probe.required_evidence.length === 0
    ) {
      throw new Error(`Active shell implementation probe ${probe.id} must bind required evidence to the App GUI Team policy`);
    }
  }
}

export function validateUpstreamIntakePolicy(contract, shellPaths, options = {}) {
  const upstreamIntake = contract.upstream_intake;
  if (
    upstreamIntake?.classification_policy !==
    'classify_every_required_capability_and_dependency_before_app_release'
  ) {
    throw new Error(
      'Active shell upstream_intake.classification_policy must classify every required capability and dependency before release',
    );
  }
  if (upstreamIntake.schema_version !== 1) {
    throw new Error('Active shell upstream_intake.schema_version must be 1');
  }
  if (!shellPaths?.shellRoot || !shellPaths?.packageManifestPath) {
    throw new Error('Active shell upstream intake validation requires resolved shell paths');
  }
  validateSourceRefs(upstreamIntake);
  assertDeepEqualJson(
    upstreamIntake.allowed_classifications,
    ALLOWED_CLASSIFICATIONS,
    'Active shell upstream intake classifications',
  );
  assertDeepEqualJson(
    upstreamIntake.required_record_fields,
    REQUIRED_RECORD_FIELDS,
    'Active shell upstream intake required record fields',
  );
  assertDeepEqualJson(
    upstreamIntake.required_capability_ids,
    REQUIRED_CAPABILITY_IDS,
    'Active shell upstream intake required capability ids',
  );
  assertDeepEqualJson(
    upstreamIntake.required_dependency_ids,
    REQUIRED_DEPENDENCY_IDS,
    'Active shell upstream intake required dependency ids',
  );

  const dependencyById = indexRequiredRecords(
    upstreamIntake.dependency_classifications,
    REQUIRED_DEPENDENCY_RULES,
    'Active shell upstream intake dependencies',
  );
  const capabilityById = indexRequiredRecords(
    upstreamIntake.capability_classifications,
    REQUIRED_CAPABILITY_RULES,
    'Active shell upstream intake capabilities',
  );
  validateDependencyTopology(capabilityById, dependencyById);
  validateRejectedBoundaries(contract, capabilityById);

  const readJsonFile = options.readJsonFile ?? readJson;
  const shellPackage = readJsonFile(shellPaths.packageManifestPath);
  const aionCoreDependency = dependencyById.get('aioncore_database_recovery');
  validateAionCoreRecoveryGate(aionCoreDependency, shellPackage);
  validateManagedAgentApiCompatibility(contract, shellPaths, options);

  const isGitAncestor = options.isGitAncestor ?? defaultIsGitAncestor;
  const guiConformanceRef = contract.shell_source?.upstream_ref;
  if (!guiConformanceRef || !isGitAncestor(guiConformanceRef, shellPaths.shellRoot)) {
    throw new Error(`active shell HEAD must contain verified GUI conformance ref ${String(guiConformanceRef)}`);
  }
  validateActiveShellAncestry(
    upstreamIntake,
    [...capabilityById.values(), ...dependencyById.values()],
    shellPaths.shellRoot,
    isGitAncestor,
  );
}
