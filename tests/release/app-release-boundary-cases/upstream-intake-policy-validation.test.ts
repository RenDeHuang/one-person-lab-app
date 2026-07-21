import { validateUpstreamIntakePolicy } from '../../../scripts/validate-active-shell/upstream-intake-policy-validator.ts';
import { readAppProductProfile } from '../../../scripts/app-product-profile/profile-contract.ts';
import { validateProductProfile } from '../../../scripts/validate-active-shell/product-profile-validator.ts';
import { assert, fs, path, test, appRoot } from './helpers.ts';

function readContract() {
  return JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'));
}

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

function capability(contract, id: string) {
  return contract.upstream_intake.capability_classifications.find((entry) => entry.id === id);
}

function dependency(contract, id: string) {
  return contract.upstream_intake.dependency_classifications.find((entry) => entry.id === id);
}

const shellPaths = {
  shellRoot: '/fixture/active-shell',
  packageManifestPath: '/fixture/active-shell/package.json',
};
const MANAGED_AGENT_REMEDIATION_REF = '6875ada9fa6e800b64980dadb02180def6b0f6e2';
const MANAGED_AGENT_NODE_TESTS = [
  'tests/unit/common-adapter/ipcBridgeAgents.test.ts',
  'tests/unit/common-adapter/apiModelMapper.test.ts',
  'tests/unit/common-adapter/ipcBridgeTeamGate.test.ts',
  'tests/unit/conversation/createConversationParams.test.ts',
  'tests/unit/assistants/migrateAssistants.test.ts',
  'tests/unit/renderer/channelAssistantOptions.test.ts',
  'tests/unit/cron/resolveCronAgentConfig.test.ts',
  'tests/unit/common-adapter/teamMapper.test.ts',
];
const MANAGED_AGENT_DOM_TESTS = [
  'tests/unit/guid/useGuidSend.oplWhitelist.dom.test.tsx',
  'tests/unit/assistants/useAssistantEditor.dom.test.ts',
];
const MANAGED_AGENT_NODE_COMMAND = `bunx vitest run ${MANAGED_AGENT_NODE_TESTS.join(' ')}`;
const MANAGED_AGENT_DOM_COMMAND =
  `VITEST_INCLUDE_DOM=1 bunx vitest run --project dom ${MANAGED_AGENT_DOM_TESTS.join(' ')}`;

function managedAgentStructuralFiles(contract) {
  const managedAgentContract = contract.upstream_intake.managed_agent_api_contract;
  const sourcePaths = Object.entries(managedAgentContract.implementation_surfaces).flatMap(([key, value]) => {
    if (key === 'source_root') return [];
    return Array.isArray(value) ? value : [value];
  });
  const testPaths = Object.values(managedAgentContract.focused_tests).flatMap((value) =>
    Array.isArray(value) ? value : [value],
  );
  return [...new Set([...sourcePaths, ...testPaths])].map((relativePath) => ({
    relativePath,
    text: 'export {};',
  }));
}

const failureBoundaries = [
  { stage: 'database.recoverable_corruption', required_corruption_markers_any_of: [] },
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
];
const recoveryBoundary = {
  code: 'BOOTSTRAP_RECOVERED_DATABASE_CORRUPTION',
  stage: 'database.recovery',
};
const missingRemediationRef = 'f'.repeat(40);

function validateContract(contract, options = {}) {
  return validateUpstreamIntakePolicy(contract, shellPaths, {
    readJsonFile: () => ({
      aioncoreVersion: dependency(contract, 'aioncore_database_recovery').version_gate.selective_absorption_version,
    }),
    readShellSourceFiles: () => managedAgentStructuralFiles(contract),
    isGitAncestor: () => true,
    ...options,
  });
}

test('AionUI intake contract separates the absorbed v2.1.31 cohort from the reviewed stable v2.1.34 release', () => {
  const contract = readContract();
  const checkedRefs: string[] = [];
  let packagePath = '';
  assert.doesNotThrow(() => validateContract(contract, {
    readJsonFile: (filePath) => {
      packagePath = filePath;
      return { aioncoreVersion: 'v0.1.49' };
    },
    isGitAncestor: (ref) => {
      checkedRefs.push(ref);
      return true;
    },
  }));

  const intake = contract.upstream_intake;
  assert.equal(packagePath, shellPaths.packageManifestPath);
  assert.deepEqual(checkedRefs, [
    contract.shell_source.upstream_ref,
    intake.source_refs.selective_absorption_head.ref,
    MANAGED_AGENT_REMEDIATION_REF,
    capability(contract, 'feedback_diagnostics_privacy').remediation_ref,
    dependency(contract, 'aioncore_database_recovery').remediation_ref,
  ]);
  assert.deepEqual(
    [
      intake.source_refs.fork_base.ref,
      intake.source_refs.evaluated_upstream.ref,
      intake.source_refs.selective_absorption_head.ref,
      intake.source_refs.latest_reviewed_upstream.ref,
    ],
    [
      '70974c59a275e565e8fc2bd7ecaf2dcac74227f0',
      'e49cd94935f4e461f002a1260a47c1b7b2ce81ca',
      'e38b00ba37cafe56d704b498a4882264836463e4',
      '0fea1eb82634f3746b9ccf68507277c347fa08a3',
    ],
  );
  assert.deepEqual(
    {
      published_at: intake.source_refs.latest_reviewed_upstream.published_at,
      draft: intake.source_refs.latest_reviewed_upstream.draft,
      prerelease: intake.source_refs.latest_reviewed_upstream.prerelease,
      gui_delta: intake.source_refs.latest_reviewed_upstream.gui_delta,
      disposition: intake.source_refs.latest_reviewed_upstream.disposition,
    },
    {
      published_at: '2026-07-13T14:57:12Z',
      draft: false,
      prerelease: false,
      gui_delta: 'conversation_queue_and_team_renderer_changes_require_classification',
      disposition: 'reviewed_not_absorbed_bounded_selective_intake_required',
    },
  );
  assert.deepEqual([
    capability(contract, 'database_recovery').classification,
    capability(contract, 'database_recovery').release_gate,
    capability(contract, 'feedback_diagnostics_privacy').classification,
    capability(contract, 'feedback_diagnostics_privacy').release_gate,
    capability(contract, 'non_zh_en_locales').classification,
    capability(contract, 'aionui_team').classification,
  ], ['absorbed', 'database_recovery_dependency_satisfied', 'absorbed', 'feedback_privacy_redaction_verified', 'rejected', 'rejected']);
  assert.equal(capability(contract, 'managed_agent_api').remediation_ref, MANAGED_AGENT_REMEDIATION_REF);
  const aionCore = dependency(contract, 'aioncore_database_recovery');
  assert.deepEqual([
    aionCore.classification,
    aionCore.release_gate,
    aionCore.remediation_ref,
    aionCore.version_gate.minimum_version,
    aionCore.capability_gate.state,
  ], ['absorbed', 'aioncore_database_recovery_verified', '81c8b37fdc067549341b41539d7648b09aa31d37', 'v0.1.44', 'verified']);
});

test('AionUI intake contract accepts typed corruption or strict open-stage corruption and records recovery success', () => {
  const contract = readContract();
  const gate = dependency(contract, 'aioncore_database_recovery').capability_gate;
  assert.equal(gate.required_boundary_stage, undefined);
  assert.deepEqual(gate.accepted_failure_boundaries, failureBoundaries);
  assert.deepEqual(gate.recovery_success_boundary, recoveryBoundary);
  assert.doesNotThrow(() => validateContract(contract));
});

const invalid = (name, mutate, error, options?) => ({ name, mutate, error, options });
const invalidCases = [
  invalid('a prerelease latest-reviewed upstream', (c) => {
    c.upstream_intake.source_refs.latest_reviewed_upstream.prerelease = true;
  }, /latest reviewed upstream must record stable v2\.1\.34 as reviewed but not absorbed/),
  invalid('a missing required capability record', (c) => {
    c.upstream_intake.capability_classifications = c.upstream_intake.capability_classifications.filter((entry) => entry.id !== 'cron_history');
  }, /Active shell upstream intake capabilities ids/),
  invalid('a missing required record field', (c) => delete capability(c, 'startup_directories').owner_ref, /startup_directories missing required field owner_ref/),
  invalid('an invalid classification state', (c) => { capability(c, 'database_recovery').classification = 'pending'; }, /database_recovery\.classification must be one of absorbed, rejected, deferred/),
  invalid('an unexpected dependency', (c) => { capability(c, 'database_recovery').dependencies = ['unknown_aioncore_dependency']; }, /database_recovery\.dependencies must be \["aioncore_database_recovery"\]/),
  invalid('missing evidence', (c) => { capability(c, 'settings_i18n').evidence = []; }, /settings_i18n\.evidence must be a non-empty string array/),
  invalid('a weakened AionCore boundary code', (c) => {
    dependency(c, 'aioncore_database_recovery').capability_gate.required_boundary_code = 'BOOTSTRAP_DATA_INIT_WARNING';
  }, /AionCore database recovery boundary contract/),
  invalid('database.open recovery without a strict corruption marker', (c) => {
    const gate = dependency(c, 'aioncore_database_recovery').capability_gate;
    gate.accepted_failure_boundaries = structuredClone(failureBoundaries);
    gate.accepted_failure_boundaries[1].required_corruption_markers_any_of = [];
  }, /AionCore database recovery boundary contract/),
  invalid('a recovery success boundary outside database.recovery', (c) => {
    dependency(c, 'aioncore_database_recovery').capability_gate.recovery_success_boundary = { ...recoveryBoundary, stage: 'database.open' };
  }, /AionCore database recovery boundary contract/),
  invalid('a lowered AionCore minimum version', (c) => { dependency(c, 'aioncore_database_recovery').version_gate.minimum_version = 'v0.1.28'; }, /version_gate\.minimum_version must be v0\.1\.44/),
  invalid('an active shell package version mismatch', () => {}, /active shell package aioncoreVersion v0\.1\.28 must match selective_absorption_version v0\.1\.49/, () => ({ readJsonFile: () => ({ aioncoreVersion: 'v0.1.28' }) })),
  invalid('a selective absorption ref outside active shell history', () => {}, (c) => new RegExp('active shell HEAD must contain selective absorption ref ' + c.upstream_intake.source_refs.selective_absorption_head.ref), (c) => ({
    isGitAncestor: (ref) => ref !== c.upstream_intake.source_refs.selective_absorption_head.ref,
  })),
  invalid('a remediation ref outside active shell history', (c) => {
    const aionCore = dependency(c, 'aioncore_database_recovery');
    aionCore.evidence = aionCore.evidence.map((entry) => entry.startsWith('shell_commit:') ? 'shell_commit:' + missingRemediationRef : entry);
    aionCore.remediation_ref = missingRemediationRef;
  }, new RegExp('active shell HEAD must contain remediation ref ' + missingRemediationRef), () => ({ isGitAncestor: (ref) => ref !== missingRemediationRef })),
  invalid('absorbed feedback privacy without remediation evidence', (c) => delete capability(c, 'feedback_diagnostics_privacy').remediation_ref, /feedback_diagnostics_privacy requires remediation_ref/),
  invalid('remediation evidence bound to a different commit', (c) => { capability(c, 'feedback_diagnostics_privacy').remediation_ref = 'a'.repeat(40); }, /feedback_diagnostics_privacy evidence must bind shell_commit to remediation_ref/),
  invalid('an absorbed AionCore dependency that remains release-blocked', (c) => { dependency(c, 'aioncore_database_recovery').release_gate = 'blocked_until_version_and_capability_gate_verified'; }, /aioncore_database_recovery\.release_gate must be aioncore_database_recovery_verified/),
  invalid('an absorbed AionCore dependency that remains unverified', (c) => {
    const gate = dependency(c, 'aioncore_database_recovery').capability_gate;
    gate.state = 'unverified';
    gate.evidence = [];
  }, /absorbed AionCore database recovery dependency requires capability_gate\.state=verified/),
];

for (const { name, mutate, options, error } of invalidCases) {
  test('AionUI intake validator rejects ' + name, () => {
    const contract = readContract();
    mutate(contract);
    assert.throws(
      () => validateContract(contract, options?.(contract)),
      typeof error === 'function' ? error(contract) : error,
    );
  });
}

test('AionUI intake validator accepts verified AionCore package and ancestor evidence', () => {
  const contract = readContract();
  assert.doesNotThrow(() => validateContract(contract, {
    readJsonFile: () => ({ aioncoreVersion: 'v0.1.49' }),
  }));
});

test('Manual qualification contract isolates Codex and keeps MAS Scholar workspace-scoped', () => {
  const adapter = readContract().manual_qualification_contract;
  const profile = readAppProductProfile();
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const firstRunMatrix = readJson('contracts/app-first-run-test-matrix.json');

  assert.equal(adapter.classification, 'non_stable_manual_qualification_candidate');
  assert.equal(adapter.stable_bundle_claim, 'forbidden');
  const managedCodexAcp = adapter.runtime_dependencies.managed_codex_acp;
  assert.deepEqual(
    [adapter.runtime_dependencies.aioncore.version, adapter.runtime_dependencies.codex_cli.version],
    ['v0.1.49', '0.144.6'],
  );
  assert.equal(Object.hasOwn(managedCodexAcp, 'version'), false);
  assert.deepEqual(managedCodexAcp.version_binding, {
    authority:
      'bundled-aioncore/<platform>-<arch>/managed-resources/manifest.json#acpTools[slug=codex-acp].version',
    mode: 'exact',
    required_consistency: [
      'manifest_root',
      'package_json',
      'package_lock',
      'installed_package',
      'runtime_initialize',
    ],
  });
  assert.equal(managedCodexAcp.forbidden_package, '@zed-industries/codex-acp');
  assert.deepEqual(profile.codex.app_runtime_home, {
    default_path: '~/Library/Application Support/OPL/codex',
    override_env: 'CODEX_HOME',
    override_policy: 'explicit_developer_or_operator_override_only',
    user_home_path: '~/.codex',
    user_config_mutation: 'forbidden',
  });
  assert.deepEqual(profile.first_run.full_runtime_package_qualification.workspace_scoped_package_ids, [
    'mas-scholar-skills',
  ]);
  assert.equal(profile.first_run.full_runtime_package_qualification.global_workspace_scoped_exposure, 'forbidden');
  assert.equal(profile.first_run.first_conversation.runtime_readiness_route, '/api/conversations/<id>/runtime/ensure');
  const fullDmgScenario = firstRunMatrix.scenarios.find((scenario) => scenario.id === 'full_dmg_clean_vm_smoke');
  assert.ok(fullDmgScenario.expects.some((entry: string) => entry.includes('installed_package_count 7')));
  assert.doesNotThrow(() => validateProductProfile(profile, installExposure));
});

test('Manual qualification product validator rejects isolation, runtime route, and Scholar scope drift', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const mutations = [
    {
      error: /isolate the App runtime/,
      mutate: (profile) => { profile.codex.app_runtime_home.default_path = '~/.codex'; },
    },
    {
      error: /first conversation must apply granular prerequisites/,
      mutate: (profile) => { profile.first_run.first_conversation.runtime_readiness_route = '/api/conversations/<id>/warmup'; },
    },
    {
      error: /Full runtime package qualification boundary/,
      mutate: (profile) => { profile.first_run.full_runtime_package_qualification.global_workspace_scoped_exposure = 'allowed'; },
    },
  ];
  for (const { error, mutate } of mutations) {
    const profile = readJson('contracts/app-product-profile.json');
    mutate(profile);
    assert.throws(() => validateProductProfile(profile, installExposure), error);
  }
});

test('AionUI intake contract records managed-agent wire and focused verification policy', () => {
  const contract = readContract();
  const managed = contract.upstream_intake.managed_agent_api_contract;

  assert.deepEqual(managed.assistant_identity_policy.allowed_assistant_kinds, ['generated', 'preset']);
  assert.deepEqual(
    [
      managed.write_contracts.conversation.assistant_identity_path,
      managed.write_contracts.conversation.assistant_placement,
      managed.write_contracts.channel.selection_hook,
      managed.write_contracts.channel.read_method,
      managed.write_contracts.channel.write_method,
      managed.write_contracts.cron.identity_path,
      managed.write_contracts.team.shared_mapper,
      managed.write_contracts.team.identity_field,
      managed.write_contracts.team.response_members_field,
      managed.write_contracts.team.response_leader_field,
    ],
    [
      'assistant.id',
      'top_level',
      'useChannelAssistantSelection',
      'GET',
      'PUT',
      'agent_config.assistant_id',
      'toBackendAgent',
      'assistant_id',
      'assistants',
      'leader_assistant_id',
    ],
  );
  assert.equal(managed.write_contracts.conversation.caller_ids.length, 4);
  assert.deepEqual(managed.write_contracts.cron.schedule_field_map, { atMs: 'at_ms', everyMs: 'every_ms' });
  assert.deepEqual(managed.write_contracts.team.events, {
    'team.agentStatusChanged': 'fromBackendTeamAgentStatusEvent',
    'team.agentSpawned': 'fromBackendTeamAgentSpawnedEvent',
    'team.agentRemoved': 'passthrough',
    'team.agentRenamed': 'fromBackendTeamAgentRenamedEvent',
    'team.listChanged': 'passthrough',
    'team.teammateMessage': 'passthrough',
  });
  assert.deepEqual(managed.focused_tests, {
    node: MANAGED_AGENT_NODE_TESTS,
    dom: MANAGED_AGENT_DOM_TESTS,
  });
  assert.deepEqual(managed.verification_policy.focused_behavior_command_ids, [
    'managed_agent_behavior_node',
    'managed_agent_behavior_dom',
  ]);
  assert.equal(
    contract.validation_commands.find((entry) => entry.id === 'managed_agent_behavior_node')?.command,
    MANAGED_AGENT_NODE_COMMAND,
  );
  assert.equal(
    contract.validation_commands.find((entry) => entry.id === 'managed_agent_behavior_dom')?.command,
    MANAGED_AGENT_DOM_COMMAND,
  );
  assert.doesNotThrow(() => validateContract(contract));
});

test('AionUI quick gate requires managed-agent source and focused-test paths', () => {
  const contract = readContract();
  const managed = contract.upstream_intake.managed_agent_api_contract;
  const requiredPaths = [
    managed.implementation_surfaces.conversation_writer,
    managed.implementation_surfaces.conversation_guid_callers,
    managed.implementation_surfaces.team_mapper,
    managed.implementation_surfaces.team_types,
    'tests/unit/common-adapter/apiModelMapper.test.ts',
    'tests/unit/guid/useGuidSend.oplWhitelist.dom.test.tsx',
    'tests/unit/common-adapter/ipcBridgeAgents.test.ts',
    'tests/unit/common-adapter/teamMapper.test.ts',
  ];

  for (const missingPath of requiredPaths) {
    const evidence = managedAgentStructuralFiles(contract).filter(
      (sourceFile) => sourceFile.relativePath !== missingPath,
    );
    assert.throws(
      () => validateContract(contract, { readShellSourceFiles: () => evidence }),
      new RegExp(`required managed-agent evidence missing ${missingPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
  }
});

test('AionUI intake validator rejects managed-agent contract, ancestry, command, and wire drift', () => {
  const missingContract = readContract();
  delete missingContract.upstream_intake.managed_agent_api_contract;
  assert.throws(() => validateContract(missingContract), /managed-agent API compatibility contract/);

  const missingRemediation = readContract();
  delete capability(missingRemediation, 'managed_agent_api').remediation_ref;
  assert.throws(() => validateContract(missingRemediation), /managed_agent_api requires remediation_ref/);

  const wrongRemediation = readContract();
  const managedCapability = capability(wrongRemediation, 'managed_agent_api');
  const wrongRef = 'e'.repeat(40);
  managedCapability.remediation_ref = wrongRef;
  managedCapability.evidence = managedCapability.evidence.map((entry) =>
    entry.startsWith('shell_commit:') ? `shell_commit:${wrongRef}` : entry,
  );
  assert.throws(
    () => validateContract(wrongRemediation),
    new RegExp(`managed_agent_api\\.remediation_ref must be ${MANAGED_AGENT_REMEDIATION_REF}`),
  );

  const commandDrift = readContract();
  commandDrift.validation_commands = commandDrift.validation_commands.map((entry) =>
    entry.id === 'managed_agent_behavior_node'
      ? { ...entry, command: 'bunx vitest run tests/unit/common-adapter/apiModelMapper.test.ts' }
      : entry,
  );
  assert.throws(
    () => validateContract(commandDrift),
    /managed-agent focused behavior command managed_agent_behavior_node/,
  );

  for (const mutate of [
    (contract) => {
      contract.upstream_intake.managed_agent_api_contract.write_contracts.conversation.assistant_identity_path =
        'extra.assistant.id';
    },
    (contract) => {
      contract.upstream_intake.managed_agent_api_contract.write_contracts.channel.selection_hook =
        'direct_form_config_write';
    },
    (contract) => {
      contract.upstream_intake.managed_agent_api_contract.write_contracts.cron.identity_path = 'assistant_id';
    },
    (contract) => {
      contract.upstream_intake.managed_agent_api_contract.write_contracts.team.identity_field = 'runtime_agent_id';
    },
  ]) {
    const contract = readContract();
    mutate(contract);
    assert.throws(() => validateContract(contract), /managed-agent API compatibility contract/);
  }
});

test('AionUI quick gate rejects retired managed-agent facade paths', () => {
  const contract = readContract();

  for (const retiredPath of contract.upstream_intake.managed_agent_api_contract.retired_facade_paths) {
    assert.throws(
      () => validateContract(contract, {
        readShellSourceFiles: () => [
          ...managedAgentStructuralFiles(contract),
          { relativePath: retiredPath, text: 'export {};' },
        ],
      }),
      new RegExp(`retired managed-agent facade path.*${path.basename(retiredPath)}`),
    );
  }
});
