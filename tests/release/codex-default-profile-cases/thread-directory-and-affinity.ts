import {
  assert,
  fs,
  test,
  validateAppGuiProductContract,
  validatePrimaryInteractionPages,
  validateProductProfile,
  assertCanonicalThreadDirectoryGroupingSources,
  assertCanonicalThreadDirectoryTimeoutBoundarySources,
  assertCanonicalThreadAffinityConvergenceSources,
  assertCurrentGuidHomeSelectionSources,
  assertProjectlessGuidFileAccessSources,
  assertRuntimePageSourceBoundary,
  assertSkillsHubScopeSource,
  validateShellVisualTokenBindings,
  assertCodexModelPolicyProjection,
  projectCodexModelPolicyContracts,
  readJson,
  readModelPolicyBundle,
} from "./fixtures.ts";

test('active-shell source gate keeps canonical cwd transport separate from sidebar affinity', () => {
  const lifecycleProjectionMarkers = [
    'function canonicalProjectId(',
    'canonical_project_id?.trim() ??',
    '!canonicalProjectId(conversation)',
    'const explicitProjectId = thread.projectId.trim() || canonicalProjectId(cached)',
    'workspace: thread.workspace',
    'custom_workspace: Boolean(explicitProjectId)',
  ];
  const directoryProjectionMarkers = [
    "const canonicalProjectId = thread.projectId.trim() || cached.extra.canonical_project_id?.trim() || ''",
    'workspace: thread.workspace',
    'custom_workspace: Boolean(canonicalProjectId)',
    'canonical_project_id: canonicalProjectId || undefined',
  ];
  const focusedTestNames = [
    'keeps a managed Documents Codex task projectless and ungrouped',
    'keeps an OPL channel temporary task projectless and ungrouped',
    'assigns explicit project affinity once without changing the recorded cwd',
    'rejects project affinity reassignment',
    'keeps canonical adoption successful when the rebuildable local projection update fails',
    'keeps canonical adoption successful when a stub projection cannot be materialized',
    'requires exact projectId readback instead of path-normalized equivalence',
    'keeps the conversation projectless when assignment changes canonical cwd',
    'does not change turn pwd or sandbox writable roots during adoption',
    'keeps an existing explicit affinity stable across shell cache refreshes',
    'rejects malformed canonical cwd instead of treating it as projectless',
    'rejects a malformed cwd returned by canonical thread read',
  ];
  const conversationListSync = directoryProjectionMarkers.join('\n');
  const canonicalThreadLifecycle = lifecycleProjectionMarkers.join('\n');
  const focusedTests = focusedTestNames.join('\n');
  const threadAdapter = [
    'function recordedCwd(value: unknown): string',
    "if (value === undefined || value === null) return ''",
    "if (typeof value !== 'string') throw new Error('Invalid Codex app-server thread cwd.')",
    'workspace: recordedCwd(raw.cwd)',
    'private readonly assignedProjectAffinities = new Map<string, string>()',
    'async assignProjectAffinity(threadId: string, projectIdValue: string)',
    'const existingProjectId = this.assignedProjectAffinities.get(threadId) ?? projectId(raw)',
    "if (existingProjectId) throw new Error('Canonical thread already has explicit project affinity.')",
    'this.assignedProjectAffinities.set(threadId, selectedProjectId)',
    'this.assignedProjectAffinities.get(threadId)',
  ].join('\n');

  assert.doesNotThrow(() =>
    assertCanonicalThreadAffinityConvergenceSources({
      canonicalThreadLifecycle,
      conversationListSync,
      focusedTests,
      threadAdapter,
    }),
  );

  for (const requiredMarker of lifecycleProjectionMarkers) {
    assert.throws(() =>
      assertCanonicalThreadAffinityConvergenceSources({
        canonicalThreadLifecycle: canonicalThreadLifecycle.replace(requiredMarker, ''),
        conversationListSync,
        focusedTests,
        threadAdapter,
      }),
    );
  }
  for (const requiredMarker of directoryProjectionMarkers) {
    assert.throws(() =>
      assertCanonicalThreadAffinityConvergenceSources({
        canonicalThreadLifecycle,
        conversationListSync: conversationListSync.replace(requiredMarker, ''),
        focusedTests,
        threadAdapter,
      }),
    );
  }

  for (const cachedOverride of [
    'const hasCanonicalRecordedCwd = Boolean(thread.workspace.trim())',
    'workspace: projectAffinityWorkspace',
    'custom_workspace: customWorkspace',
    'Boolean(thread.workspace.trim())',
  ]) {
    assert.throws(() =>
      assertCanonicalThreadAffinityConvergenceSources({
        canonicalThreadLifecycle,
        conversationListSync: `${conversationListSync}\n${cachedOverride}`,
        focusedTests,
        threadAdapter,
      }),
    );
    assert.throws(() =>
      assertCanonicalThreadAffinityConvergenceSources({
        canonicalThreadLifecycle: `${canonicalThreadLifecycle}\n${cachedOverride}`,
        conversationListSync,
        focusedTests,
        threadAdapter,
      }),
    );
  }

  for (const focusedTestName of focusedTestNames) {
    assert.throws(() =>
      assertCanonicalThreadAffinityConvergenceSources({
        canonicalThreadLifecycle,
        conversationListSync,
        focusedTests: focusedTests.replace(focusedTestName, ''),
        threadAdapter,
      }),
    );
  }

  for (const invalidThreadAdapter of [
    threadAdapter.replace("if (typeof value !== 'string') throw new Error('Invalid Codex app-server thread cwd.')", ''),
    `${threadAdapter}\nworkspace: optionalString(raw.cwd) ?? ''`,
  ]) {
    assert.throws(() =>
      assertCanonicalThreadAffinityConvergenceSources({
        canonicalThreadLifecycle,
        conversationListSync,
        focusedTests,
        threadAdapter: invalidThreadAdapter,
      }),
    );
  }
});

test('active-shell source gate requires presentation-only canonical cwd directory auto-loading', () => {
  const groupingMarkers = [
    'const MANAGED_CODEX_SCRATCH_PATTERNS = [',
    '/^\\/Users\\/[^/]+\\/Documents\\/Codex(?:\\/|$)/i',
    '/^\\/Users\\/[^/]+\\/\\.codex\\/worktrees\\/[^/]+(?:\\/|$)/i',
    '/^\\/home\\/[^/]+\\/Documents\\/Codex(?:\\/|$)/i',
    '/^\\/home\\/[^/]+\\/\\.codex\\/worktrees\\/[^/]+(?:\\/|$)/i',
    '/^[a-z]:\\/Users\\/[^/]+\\/Documents\\/Codex(?:\\/|$)/i',
    '/^[a-z]:\\/Users\\/[^/]+\\/\\.codex\\/worktrees\\/[^/]+(?:\\/|$)/i',
    '/^\\/mnt\\/[a-z]\\/Users\\/[^/]+\\/Documents\\/Codex(?:\\/|$)/i',
    '/^\\/mnt\\/[a-z]\\/Users\\/[^/]+\\/\\.codex\\/worktrees\\/[^/]+(?:\\/|$)/i',
    "replaceAll('\\\\', '/')",
    'export const getConversationDirectoryGroup =',
    "const explicitProjectId = conversation.extra.canonical_project_id?.trim() ?? ''",
    'if (explicitProjectId) return explicitProjectId',
    'if (!workspace || isManagedCodexScratchWorkspace(workspace)) return null',
    'return workspace',
    'const projectWorkspace = getConversationDirectoryGroup(conv)',
    '(conversation.extra as { is_temporary_workspace?: boolean }).is_temporary_workspace === true',
  ];
  const focusedTestNames = [
    'projects a canonical task from explicit project affinity rather than recorded cwd',
    'auto-loads an unregistered canonical cwd as a directory group',
    'keeps a managed Documents Codex task projectless and ungrouped',
    'does not create duplicate leaf-name groups for Codex-managed worktrees',
    'keeps explicit project affinity authoritative for a Codex-managed worktree',
    'keeps an OPL channel temporary task projectless and ungrouped',
    'keeps a canonical task without cwd projectless and ungrouped',
    'keeps Linux, Windows, and WSL managed Codex scratch paths ungrouped',
    'groups a canonical recorded cwd without rebuilding project affinity',
  ];
  const groupingHelpers = groupingMarkers.join('\n');
  const focusedTests = focusedTestNames.join('\n');

  assert.doesNotThrow(() => assertCanonicalThreadDirectoryGroupingSources({ focusedTests, groupingHelpers }));
  for (const marker of groupingMarkers) {
    assert.throws(() =>
      assertCanonicalThreadDirectoryGroupingSources({
        focusedTests,
        groupingHelpers: groupingHelpers.replace(marker, ''),
      }),
    );
  }
  for (const testName of focusedTestNames) {
    assert.throws(() =>
      assertCanonicalThreadDirectoryGroupingSources({
        focusedTests: focusedTests.replace(testName, ''),
        groupingHelpers,
      }),
    );
  }
  for (const mutation of ['canonical_project_id: workspace', 'custom_workspace: true', 'assignProjectAffinity']) {
    assert.throws(() =>
      assertCanonicalThreadDirectoryGroupingSources({
        focusedTests,
        groupingHelpers: `${groupingHelpers}\n${mutation}`,
      }),
    );
  }
});

test('recorded cwd compatibility auto-loads a directory group without creating project affinity', () => {
  const contract = readJson('contracts/app-gui-product-contract.json');
  const threadDirectory = contract.interaction_baseline.navigation_rail.thread_directory_policy;
  assert.equal(
    threadDirectory.directory_group_policy.recorded_cwd_compatibility_policy,
    'non_managed_scratch_recorded_cwd_supplies_derived_directory_group_without_creating_or_blocking_project_affinity',
  );
  assert.equal(threadDirectory.directory_group_policy.derived_group_registered_workspace_mutation_allowed, false);
  assert.equal(threadDirectory.directory_group_policy.managed_scratch_recorded_cwd_grouping_allowed, false);
  const runtimeBridge = readJson('contracts/app-runtime-bridge.json');
  assert.equal(
    runtimeBridge.canonical_conversation_continuity_policy.directory_group_policy.recorded_cwd_compatibility_policy,
    threadDirectory.directory_group_policy.recorded_cwd_compatibility_policy,
  );
  assert.equal(
    contract.interaction_baseline.conversation_scope.session_workspace_model.project_affinity_source,
    'opl_studio_versioned_ui_metadata_keyed_by_canonical_thread_id',
  );

  const pageStateMatrix = readJson('contracts/app-page-state-matrix.json');
  assert.match(
    JSON.stringify(pageStateMatrix),
    /non-managed-scratch canonical recorded cwd auto-loads a directory group/,
  );
  assert.match(JSON.stringify(pageStateMatrix), /recorded cwd alone treated as explicit Project affinity/);
});

test('OPL Link projects a projectless canonical conversation binding without Shell inference', () => {
  const contract = readJson('contracts/app-gui-product-contract.json');
  const remoteCompanionAccess = contract.pages.settings_resources.remote_companion_access;
  const runtimeBridge = readJson('contracts/app-runtime-bridge.json');
  const projection = runtimeBridge.canonical_conversation_continuity_policy.transport_binding_projection;
  const pageStateMatrix = readJson('contracts/app-page-state-matrix.json');
  const pageRemoteCompanionAccess = pageStateMatrix.pages.find((page: any) => page.id === 'settings_resources')
    .remote_companion_access;

  assert.equal(remoteCompanionAccess.source, 'framework_projected_remote_companion_connector_route');
  assert.deepEqual(remoteCompanionAccess.source_by_renderer, {
    aionui: 'app_state.ui_contributions.slots.settings.section',
    opl_studio: 'app_state.ui_contributions.slots.settings.section',
  });
  assert.equal(remoteCompanionAccess.standard_view_type, 'remote_companion_access');
  assert.equal(remoteCompanionAccess.framework_remote_companion_host_activation_in_aionui_allowed, true);
  assert.equal(remoteCompanionAccess.single_active_provider_path_per_renderer_required, true);
  assert.equal(
    remoteCompanionAccess.provider_absent_policy,
    'project_unavailable_without_fabricated_pair_or_device_state_and_keep_the_desktop_workbench_usable',
  );
  assert.equal(projection.source, 'app_state.transport_bindings');
  assert.equal(projection.surface_kind, 'opl_app_transport_bindings_projection.v1');
  assert.equal(projection.migration_state, 'framework_transport_binding_projection_and_dual_shell_source_e2e_completed');
  assert.equal(projection.projection_runtime_status, 'current_framework_projection_proven');
  assert.equal(projection.binding_field_contract.project_affinity, 'projectless');
  assert.equal(projection.binding_field_contract.status, 'bound');
  assert.equal(projection.canonical_row_policy, 'one_visible_row_per_canonical_thread_identity_even_when_a_transport_binding_exists');
  assert.match(
    projection.provider_absent_policy,
    /producer_absent_without_shell_inference_or_writeback/,
  );
  assert.equal(projection.target_workspace_leaf_or_title_inference_allowed, false);
  assert.equal(projection.target_shell_writeback_allowed, false);
  assert.equal('temporary_legacy_fallback' in projection, false);
  assert.equal('legacy_shell_read_compatibility' in projection, false);
  assert.equal('existing_exact_canonical_thread_id_read_compatibility' in projection, false);
  assert.equal(projection.cached_canonical_thread_id_binding_inference_allowed, false);
  assert.match(projection.binding_unavailable_policy, /preserve_the_transport_row_fail_open_without_fabricated_binding/);
  assert.match(pageRemoteCompanionAccess.provider_absent_policy, /project_unavailable_without_fabricated_pair_or_device_state/);
  assert.deepEqual(pageRemoteCompanionAccess.status_values, [
    'unavailable',
    'unpaired',
    'reserving',
    'qr_ready',
    'awaiting_confirmation',
    'active',
    'revoking',
    'attention',
  ]);
});

test('active-shell source gate keeps canonical thread directory queries state-db-only', () => {
  const threadAdapter = [
    "await this.rpc.request('thread/list', {",
    'cursor,',
    'archived,',
    'useStateDbOnly: true,',
    '...(workspace ? { cwd: workspace } : {}),',
    '});',
  ].join('\n');
  const focusedTests = [
    'lists active and archived threads through bounded app-server pagination',
    'useStateDbOnly: true',
    "expect(request.mock.calls[0]?.[1]).not.toHaveProperty('sourceKinds')",
  ].join('\n');

  assert.doesNotThrow(() =>
    assertCanonicalThreadDirectoryTimeoutBoundarySources({
      focusedTests,
      threadAdapter,
    }),
  );
  assert.doesNotThrow(() =>
    assertCanonicalThreadDirectoryTimeoutBoundarySources({
      focusedTests,
      threadAdapter: [
        'const threadListParams = {',
        'cursor,',
        'archived,',
        'useStateDbOnly: true,',
        '...(workspace ? { cwd: workspace } : {}),',
        '};',
        "await this.rpc.request('thread/list', threadListParams);",
      ].join('\n'),
    }),
  );
  for (const unresolvedOptions of [
    "await this.rpc.request('thread/list', threadListParams);",
    "let threadListParams = { archived, useStateDbOnly: true }; await this.rpc.request('thread/list', threadListParams);",
    "const threadListParams = { archived, useStateDbOnly: true }; const threadListParams = { archived, useStateDbOnly: true }; await this.rpc.request('thread/list', threadListParams);",
  ]) {
    assert.throws(() =>
      assertCanonicalThreadDirectoryTimeoutBoundarySources({
        focusedTests,
        threadAdapter: unresolvedOptions,
      }),
    );
  }

  for (const requiredMarker of [
    "await this.rpc.request('thread/list'",
    'archived',
    'useStateDbOnly: true',
  ]) {
    assert.throws(() =>
      assertCanonicalThreadDirectoryTimeoutBoundarySources({
        focusedTests,
        threadAdapter: threadAdapter.replace(requiredMarker, ''),
      }),
    );
  }

  for (const forbiddenMarker of [
    'sourceKinds: renamedKinds,',
    'sourceKinds,',
    '"sourceKinds": [\'cli\'],',
    '...legacyOptions,',
    "...{ sourceKinds: ['cli'] },",
    "...(workspace ? { cwd: workspace } : { sourceKinds: ['cli'] }),",
    '...{ archived: false },',
    '...{ useStateDbOnly: false },',
    "...{ ['source' + 'Kinds']: ['cli'] },",
    "...{ ['arch' + 'ived']: false },",
    "...{ ['useStateDb' + 'Only']: false },",
  ]) {
    assert.throws(() =>
      assertCanonicalThreadDirectoryTimeoutBoundarySources({
        focusedTests,
        threadAdapter: threadAdapter.replace('});', `${forbiddenMarker}\n});`),
      }),
    );
  }

  assert.throws(() =>
    assertCanonicalThreadDirectoryTimeoutBoundarySources({
      focusedTests,
      threadAdapter: `${threadAdapter.replace('useStateDbOnly: true,', '')}\nconst unrelated = { useStateDbOnly: true };`,
    }),
  );
  assert.throws(() =>
    assertCanonicalThreadDirectoryTimeoutBoundarySources({
      focusedTests,
      threadAdapter: threadAdapter.replace('useStateDbOnly: true', 'useStateDbOnly: false'),
    }),
  );
  for (const constantArchivedSelector of ['archived: false', 'archived: true']) {
    assert.throws(() =>
      assertCanonicalThreadDirectoryTimeoutBoundarySources({
        focusedTests,
        threadAdapter: threadAdapter.replace('archived,', `${constantArchivedSelector},`),
      }),
    );
  }
  for (const duplicatedGuardedOption of ['archived: false', 'useStateDbOnly: false']) {
    assert.throws(() =>
      assertCanonicalThreadDirectoryTimeoutBoundarySources({
        focusedTests,
        threadAdapter: threadAdapter.replace('});', `${duplicatedGuardedOption},\n});`),
      }),
    );
  }
  assert.doesNotThrow(() =>
    assertCanonicalThreadDirectoryTimeoutBoundarySources({
      focusedTests,
      threadAdapter: threadAdapter.replace('archived,', 'archived: archived,'),
    }),
  );

  for (const requiredTestMarker of [
    'lists active and archived threads through bounded app-server pagination',
    'useStateDbOnly: true',
    "not.toHaveProperty('sourceKinds')",
  ]) {
    assert.throws(() =>
      assertCanonicalThreadDirectoryTimeoutBoundarySources({
        focusedTests: focusedTests.replace(requiredTestMarker, ''),
        threadAdapter,
      }),
    );
  }
});
