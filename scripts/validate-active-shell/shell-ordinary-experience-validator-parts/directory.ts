import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  assertCanonicalThreadAffinityConvergenceSources,
  assertCanonicalThreadDirectoryGroupingSources,
  assertCanonicalThreadDirectoryTimeoutBoundarySources,
} from './conversation-thread.ts';
import {
  assertShellTextIncludesAll,
  assertTextExcludesAll,
  assertTextIncludesAll,
  readShellText,
} from '../shell-implementation-helpers.ts';

export function validateSessionFirstDirectoryImplementation(shellPaths) {
  const guidPage = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/GuidPage.tsx');
  for (const retiredPath of [
    'packages/desktop/src/renderer/components/layout/Sider/ProjectContextSection.tsx',
    'packages/desktop/src/renderer/utils/workspace/projectContext.ts',
    'packages/desktop/src/renderer/pages/guid/components/GuidWorkspaceFootnote.tsx',
  ]) {
    if (existsSync(path.join(shellPaths.shellRoot, retiredPath))) {
      throw new Error(`Active shell session-first directory must remove retired workspace context surface ${retiredPath}`);
    }
  }

  for (const sourcePath of [
    'packages/desktop/src/common/config/configKeys.ts',
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/index.tsx',
    'packages/desktop/src/renderer/pages/guid/GuidPage.tsx',
    'packages/desktop/src/renderer/pages/guid/components/GuidInputCard.tsx',
    'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx',
    'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts',
  ]) {
    assertTextExcludesAll(
      readShellText(shellPaths, sourcePath),
      ['ProjectContext', 'projectContext', 'project_context_refs', 'workspace.projectContextInputs'],
      `Active shell session-first input surface in ${sourcePath}`,
    );
  }

  const workspaceContextBar = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidWorkspaceContextBar.tsx',
    [
      "data-testid='guid-workspace-context-bar'",
      "data-testid='guid-workspace-select'",
      "data-testid='guid-workspace-clear'",
      "properties: ['openDirectory', 'createDirectory']",
      'ipcBridge.dialog.showWorkspace',
      'addRecentWorkspace(selection.runtime_path)',
      'runtimePath: selection.runtime_path',
      'hostPath: selection.host_path',
      'onClearWorkspace',
    ],
    'Active shell independent new-session working-directory context bar',
  );
  assertTextExcludesAll(
    workspaceContextBar,
    ['ComposerCapabilityPalette', "key='workspace'", 'workspace.projectContextInputs'],
    'Active shell working-directory context bar palette isolation',
  );
  assertTextIncludesAll(
    guidPage,
    [
      "import GuidWorkspaceContextBar from './components/GuidWorkspaceContextBar'",
      '<GuidWorkspaceContextBar',
      'workspaceDir={guidInput.dir}',
      'workspaceDisplayDir={workspaceDisplayDir}',
      'onSelectWorkspace={handleWorkspaceSelect}',
      'onClearWorkspace={handleWorkspaceClear}',
      'guidInput.setDir(runtimePath)',
      'setWorkspaceDisplayDir(hostPath)',
    ],
    'Active shell Home working-directory context bar placement',
  );
  const dialogBridge = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/process/bridge/dialogBridge.ts',
    [
      'ipcBridge.dialog.showOpen.provider',
      'ipcBridge.dialog.showWorkspace.provider',
      'getWindowsWslRuntime()',
      'runtime.projectWorkspacePath(hostPath)',
      'host_path: hostPath',
      'runtime_path: runtimePath',
    ],
    'Active shell workspace host/runtime path projection bridge',
  );
  assertTextExcludesAll(
    dialogBridge.slice(
      dialogBridge.indexOf('ipcBridge.dialog.showOpen.provider'),
      dialogBridge.indexOf('ipcBridge.dialog.showWorkspace.provider'),
    ),
    ['projectWorkspacePath'],
    'Active shell generic local picker path projection isolation',
  );
  const guidActionRow = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx',
  );
  assertTextExcludesAll(
    guidActionRow,
    [
      "key='workspace'",
      "data-testid='guid-workspace-chip'",
      "data-testid='guid-workspace-clear'",
      'openWorkspacePicker',
    ],
    'Active shell Home capability palette working-directory isolation',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts',
    [
      'const seenFileRefs = new Set<string>()',
      'const key = chatFileRefKey(file)',
      'const initialFilePaths = initialFiles.map(chatFileRefPath)',
      'default_files: initialFilePaths',
      'files: initialFiles.length > 0',
    ],
    'Active shell explicit current-session input projection',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/guid/useGuidSend.oplWhitelist.dom.test.tsx',
    ['sends only explicit session attachments and deduplicates them in insertion order'],
    'Active shell explicit current-session input regression',
  );

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/types/opl/uiContributions.ts',
    [
      'export type OplTransportBindingsProjection',
      'readOplTransportBindingsProjection',
      'const projection = asRecord(appState?.transport_bindings)',
      "projection?.surface_kind !== 'opl_app_transport_bindings_projection.v1'",
      "projection.status === 'unavailable'",
      'projection.bindings.length !== 0',
      "binding.project_affinity !== 'projectless'",
      "binding.status !== 'bound'",
      'if (bindings.length !== projection.bindings.length) return unavailableTransportBindingsProjection()',
      'const bindingIdentities = bindings.map(',
      '`${binding.providerId}:${binding.accountId}:${binding.channelSessionId}`',
      'if (new Set(bindingIdentities).size !== bindingIdentities.length) return unavailableTransportBindingsProjection()',
    ],
    'Active shell Framework transport binding projection reader',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync.ts',
    [
      'export const mergeCanonicalThreadDirectory',
      'if (!directory) return localConversations',
      'const returnedThreadIds = new Set(directory.threads.map((thread) => thread.id))',
      'const threadId =',
      'applicableProjectedBinding?.threadId ??',
      '(!isTransport ? canonicalCodexThreadId(conversation) : null)',
      "return conversation.type !== 'acp' || conversation.extra.backend !== 'codex'",
      'const projectedBindingByConversationId = uniqueProjectedTransportBindings(projectedTransportBindings)',
      'const projectedBindingConversationIds = new Set(',
      'projectedTransportBindings.map((binding) => binding.conversationId)',
      'const hasProjectedBinding = projectedBindingConversationIds.has(conversation.id)',
      'projectedBinding?.canonicalThreadHost === directory.host ? projectedBinding : null',
      'const isTransport = hasProjectedBinding || isLegacyWeixinTransportConversation(conversation)',
      'if (isTransport) return true',
      'const temporaryTransportThreadIds = new Set<string>()',
      'const projected = projectCanonicalCodexThread(thread, cachedByThreadId.get(thread.id))',
      'if (!temporaryTransportThreadIds.has(thread.id)) return projected',
      'is_temporary_workspace: true',
      "ipcBridge.oplRuntime.getAppState.invoke({ profile: 'fast' })",
      "transportBindingsProjection.status === 'available'",
    ],
    'Active shell canonical App Server session directory projection without cached transport binding inference',
  );
  assertTextExcludesAll(
    readShellText(
      shellPaths,
      'packages/desktop/src/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync.ts',
    ),
    [
      'const workspaceLeaf =',
      'inferLegacyWeixinCanonicalThreadBindings',
      'Temporary migration fallback until the shared provider callback produces transport bindings end to end.',
      'const legacyBindings =',
      'legacyTransportThreadId',
      'isWeixinCodexTransportConversation',
      'projectedTransportBindingsState.map((binding) => binding.conversationId)',
      'ipcBridge.conversation.update.invoke({',
      'canonical_thread_id: binding.threadId',
    ],
    'Active shell retired workspace inference and canonical thread binding writeback callers',
  );
  const conversationListSyncTests = assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/conversation/runtime/conversationListSyncGuard.test.ts',
    [
      'drops unmatched stale Codex cache rows when the complete App Server overview is available',
      'retains unmatched non-Codex local rows without title or workspace deduplication',
      'deduplicates local canonical rows only when the App Server returns',
      'prefers a valid shared transport projection over legacy canonical_thread_id',
      'ignores a conflicting legacy binding when a current shared binding exists',
      'fails open when projected transport bindings are ambiguous',
      'keeps a legacy transport row visible without inferring a canonical binding',
      'does not infer a transport binding from a cached canonical_thread_id',
      'falls back to shell cache when the canonical directory is unavailable',
    ],
    'Active shell canonical session directory regressions',
  );
  assertTextExcludesAll(
    conversationListSyncTests,
    ['uses workspace inference only as a migration fallback when the shared projection is unavailable'],
    'Active shell retired workspace inference regression',
  );

  const threadAdapter = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/process/services/codexAppServer/adapter.ts',
    [
      'function recordedCwd(value: unknown): string',
      "if (typeof value !== 'string') throw new Error('Invalid Codex app-server thread cwd.')",
      'workspace: recordedCwd(raw.cwd)',
      "result = await this.rpc.request('thread/read', { threadId, includeTurns: true })",
      "await this.rpc.request('thread/resume', { threadId, excludeTurns: false })",
      "await this.rpc.request('thread/settings/update'",
      'async updateThreadSettings(',
      'async assignProjectAffinity(',
    ],
    'Active shell single canonical App Server thread adapter',
  );
  assertTextExcludesAll(
    threadAdapter,
    [
      'gitInfo?.originUrl',
      'runtimeWorkspaceRoots',
      'workspace_handoff',
      'adoptProjectlessThread',
    ],
    'Active shell Project identity and adoption adapter private-layer boundary',
  );
  assertTextExcludesAll(
    [
      readShellText(shellPaths, 'packages/desktop/src/common/types/codex/appServerThreads.ts'),
      readShellText(shellPaths, 'packages/desktop/src/common/adapter/ipcBridge.ts'),
      readShellText(shellPaths, 'packages/desktop/src/process/bridge/codexAppServerBridge.ts'),
    ].join('\n'),
    ['CodexThreadProjectAdoptionRequest', 'codex-threads.adopt-project', 'adoptProject'],
    'Active shell has no private project-adoption RPC or IPC surface',
  );
  assertTextIncludesAll(
    [
      readShellText(shellPaths, 'packages/desktop/src/common/types/codex/appServerThreads.ts'),
      readShellText(shellPaths, 'packages/desktop/src/common/adapter/ipcBridge.ts'),
      readShellText(shellPaths, 'packages/desktop/src/process/bridge/codexAppServerBridge.ts'),
    ].join('\n'),
    [
      'CodexThreadProjectAffinityAssignRequest',
      'codex-threads.assign-project-affinity',
      'codexThreads.assignProjectAffinity',
      'getActiveAdapter().assignProjectAffinity',
    ],
    'Active shell typed project affinity IPC on the existing Codex App Server adapter',
  );
  const projectAffinityLifecycle = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/hooks/canonicalThreadLifecycle.ts',
    [
      'function canonicalProjectId(',
      '!canonicalProjectId(conversation)',
      'const selectedWorkspace = workspace.trim()',
      'ipcBridge.codexThreads.assignProjectAffinity.invoke',
      'ipcBridge.codexThreads.read.invoke',
      'assigned.projectId !== selectedWorkspace',
      'assigned.workspace !== canonicalBefore.thread.workspace',
      'canonicalReadback.thread.projectId !== selectedWorkspace',
      'canonicalReadback.thread.workspace !== canonicalBefore.thread.workspace',
      'ipcBridge.conversation.update.invoke',
      'ipcBridge.conversation.get.invoke',
      'Canonical project affinity readback did not match the selected project',
      'canonical_project_id: selectedWorkspace',
      'custom_workspace: true',
      'return false',
    ],
    'Active shell explicit unbound project adoption lifecycle',
  );
  assertTextExcludesAll(
    projectAffinityLifecycle,
    [
      'conversation?.extra.custom_workspace !== true',
      'conversation.extra.custom_workspace !== true',
      'Boolean(conversation.extra.workspace?.trim())',
      'ipcBridge.codexThreads.updateSettings.invoke',
      'runtimeWorkspaceRoots',
      'workspace_handoff',
      'codexThreads.adoptProject',
    ],
    'Active shell explicit projectless marker and affinity isolation',
  );
  const conversationListSync = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync.ts',
  );
  const groupingHelpers = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/utils/groupingHelpers.ts',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ConversationRow.tsx',
    ["key='move-to-project'", "t('conversation.history.moveToProject')", 'onMoveToProject?.(conversation)'],
    'Active shell keyboard-reachable project adoption menu action',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/index.tsx',
    [
      'draggable={draggable}',
      'handleProjectAdoptionDrop(group.workspace)',
      'isProjectlessCanonicalConversation(conversation)',
      'onMoveToProject:',
    ],
    'Active shell native drag and menu project adoption paths',
  );
  const projectAffinityTests = [
    readShellText(shellPaths, 'tests/unit/codex-app-server/adapter.test.ts'),
    readShellText(shellPaths, 'tests/unit/conversation/runtime/conversationListSyncGuard.test.ts'),
    readShellText(shellPaths, 'tests/unit/conversation/useConversationActions.dom.test.tsx'),
    readShellText(shellPaths, 'tests/unit/conversation/export/GroupedHistoryExportEntry.dom.test.tsx'),
  ].join('\n');
  assertCanonicalThreadAffinityConvergenceSources({
    canonicalThreadLifecycle: projectAffinityLifecycle,
    conversationListSync,
    focusedTests: projectAffinityTests,
    threadAdapter,
  });
  assertCanonicalThreadDirectoryGroupingSources({
    focusedTests: projectAffinityTests,
    groupingHelpers,
  });
  assertCanonicalThreadDirectoryTimeoutBoundarySources({
    focusedTests: projectAffinityTests,
    threadAdapter,
  });
  assertTextIncludesAll(
    projectAffinityTests,
    [
      'projects a canonical task from explicit project affinity rather than recorded cwd',
      'adopts an explicitly projectless canonical conversation without a cached workspace',
      'assigns explicit project affinity once without changing the recorded cwd',
      'rejects project affinity reassignment',
      'keeps the conversation projectless when assignment changes canonical cwd',
      'requires exact projectId readback instead of path-normalized equivalence',
      'blocks reassignment after canonical project affinity is recorded',
      'does not change turn pwd or sandbox writable roots during adoption',
      'keeps an existing explicit affinity stable across shell cache refreshes',
      'moves an eligible projectless row through native drag and drop',
    ],
    'Active shell project affinity focused regressions',
  );

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/chat/normalizeToolCall.ts',
    [
      'export function normalizeSubagentActivities',
      "const ACTIVE_SUBAGENT_STATES = new Set(['pendingInit', 'running'])",
      "const DONE_SUBAGENT_STATES = new Set(['interrupted', 'completed', 'errored', 'shutdown', 'notFound'])",
      'const collaboration = asRecord(codex?.collaboration)',
      'const subagent = asRecord(codex?.subagent)',
      'byThreadId.set(threadId, mergeSubagentActivity(byThreadId.get(threadId), candidate))',
    ],
    'Active shell read-only Codex subagent metadata projection',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/components/MessageToolGroupSummary.tsx',
    [
      'normalizeSubagentActivities(messages)',
      "subagents.filter((item) => item.status === 'active')",
      "subagents.filter((item) => item.status === 'done')",
      'projectCanonicalCodexThread(detail.thread, undefined, { materialized: true })',
      "Message.error(t('messages.subagents.openFailed'))",
    ],
    'Active shell Codex subagent Active/Done detail and canonical task projection',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/renderer/messageToolGroupSummary.dom.test.tsx',
    [
      'groups Codex subagents as Active and Done and materializes a canonical task on open',
      'keeps the current conversation usable when a canonical subagent task cannot be opened',
      'reuses a migrated local projection instead of creating a duplicate canonical task',
    ],
    'Active shell Codex subagent read-only UI regressions',
  );

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidInputCard.tsx',
    ["data-testid='guid-input-card-shell'"],
    'Active shell single Home composer marker',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Sider/SiderFooter.tsx',
    ["data-testid={account ? 'sider-footer-account' : 'sider-footer-settings'}"],
    'Active shell single account or Settings footer marker',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/index.module.css',
    ['.guidContainer {', 'background: var(--bg-base);'],
    'Active shell Home repaint background',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/e2e/features/visual-evidence/gui-baseline.e2e.ts',
    [
      'const GUI_BASELINE_FIXTURE_MARKER',
      'async function removeFixtureConversations',
      'await expect(homeEntry).toHaveCount(1)',
      "page.locator('[data-testid=\"guid-input-card-shell\"]')",
      "page.locator('[data-testid=\"sider-footer-account\"], [data-testid=\"sider-footer-settings\"]')",
      'await waitForStablePaint(page)',
    ],
    'Active shell single-instance Home visual regression',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/process/utils/utils.ts',
    ['AIONUI_E2E_TEST', 'AIONUI_E2E_STORAGE_ROOT', 'path.isAbsolute(root)', "path.join(e2eStorageRoot, 'data')"],
    'Active shell E2E storage isolation',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/opl-runtime/oplStoragePaths.test.ts',
    [
      'keeps E2E data and config inside the explicit test storage root',
      'fails closed when E2E mode has no isolated storage root',
      'fails closed when the E2E storage root is relative',
      'ignores the E2E storage root outside E2E mode',
    ],
    'Active shell E2E storage isolation regressions',
  );
}

export function validateReadOnlySessionEnvironmentImplementation(shellPaths) {
  const retiredHandoffControl =
    'packages/desktop/src/renderer/pages/conversation/components/ChatLayout/WorkspaceHandoffControl.tsx';
  if (existsSync(path.join(shellPaths.shellRoot, retiredHandoffControl))) {
    throw new Error(`Active shell must remove retired workspace handoff control ${retiredHandoffControl}`);
  }

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/components/ChatLayout/ConversationEnvironmentPopover.tsx',
    ['ipcBridge.gitWorkspace.inspect.invoke({ cwd: summary.workspace })'],
    'Active shell read-only conversation environment Git inspection',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/conversation/context/ConversationEnvironmentPopover.dom.test.tsx',
    ['renders the recorded workspace and live Git context without mutation controls'],
    'Active shell read-only conversation environment regression',
  );

  for (const sourcePath of [
    'packages/desktop/src/renderer/pages/conversation/components/ChatLayout/ConversationEnvironmentPopover.tsx',
    'packages/desktop/src/renderer/pages/guid/GuidPage.tsx',
    'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx',
    'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts',
  ]) {
    assertTextExcludesAll(
      readShellText(shellPaths, sourcePath),
      ['ensureManagedWorktree', 'workspace_handoff', 'thread/settings/update'],
      `Active shell simplified workspace surface in ${sourcePath}`,
    );
  }
}
