import { validateShellThreadCoordination } from '../../../scripts/validate-active-shell/shell-thread-coordination-validator.ts';
import { assert, fs, os, path, test } from './helpers.ts';

const files = {
  'packages/desktop/src/common/types/codex/threadCoordination.ts': `
    CODEX_THREAD_COORDINATION_METHODS 'thread/list' 'thread/read' 'thread/resume' 'thread/fork'
    'thread/archive' 'thread/unarchive' 'thread/name/set' 'thread/delete'
    'turn/start' 'turn/steer' messageSummary advisories 'inherit'
  `,
  'packages/desktop/src/process/bridge/threadCoordinationBridge.ts': `
    createProductionCodexThreadCoordinationPort
    port: CodexThreadCoordinationPort = createProductionCodexThreadCoordinationPort()
    disposeThreadCoordinationBridge
    app.on('before-quit', disposeThreadCoordinationBridge)
  `,
  'packages/desktop/src/process/services/threadCoordination/jsonRpcClient.ts': `
    ['app-server', '--stdio'] 'initialize' Codex app-server request timed out
    Unsupported server request rejectPending
  `,
  'packages/desktop/src/process/services/threadCoordination/codexAppServerPort.ts': `
    this.rpc.request('thread/list' this.rpc.request('thread/read' this.rpc.request('thread/resume'
    this.rpc.request('thread/fork' this.rpc.request('thread/archive' this.rpc.request('thread/unarchive'
    this.rpc.request('thread/name/set' this.rpc.request('thread/delete'
    this.rpc.request('turn/start'
    this.rpc.request('turn/steer' response.nextCursor DEFAULT_MAX_PAGES sourceThreadIdHint
  `,
  'packages/desktop/src/process/services/threadCoordination/index.ts': `
    code: 'thread_not_found' code: 'cross_host_delivery' code: 'thread_not_writable'
    boundedMessageSummary advisories idempotencyKey 'cross_project_context' 'workspace_context_changed'
    'write_set_overlap' 'delegation_cycle'
  `,
  'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ThreadCoordination/useThreadCoordination.ts': `
    acp_session_id sourceThreadIdHint ipcBridge.threadCoordination.getOverview.invoke
  `,
  'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ThreadCoordination/index.tsx': `
    ThreadCoordinationSection MESSAGE_TEXTAREA_AUTO_SIZE autoSize={MESSAGE_TEXTAREA_AUTO_SIZE}
    messageSummary advisories permission: 'inherit' writeSet: []
  `,
  'packages/desktop/src/renderer/components/layout/Sider/index.tsx': `
    <ThreadCoordinationSection />
  `,
  'tests/unit/thread-coordination/codexAppServerPort.test.ts': 'paginates thread/list',
  'tests/unit/thread-coordination/threadCoordinationService.test.ts':
    'steers the active turn without adding an OPL permission confirmation reports repeated routes as advisory and deduplicates only an identical request key returns the first successful receipt and result for an identical request key without dispatching again allows the same message to be sent again with a new request key allows cross-project delivery and reports write-set overlap as advisory metadata inherits the running thread permission policy instead of imposing an OPL write scope does not add confirmation for cross-project delivery or a running turn steer archives directly through the Codex App Server lifecycle method restores an archived thread through the Codex App Server lifecycle method maps rename and delete to App Server thread lifecycle methods while pin remains UI metadata',
  'tests/unit/conversation/ThreadCoordination.dom.test.tsx':
    'keeps the message TextArea autoSize object stable across React rerenders archives directly without adding an OPL confirmation step',
};

function fixture(): { root: string; shellPaths: { shellRoot: string } } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-thread-coordination-shell-'));
  for (const [relativePath, contents] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
  }
  return { root, shellPaths: { shellRoot: root } };
}

test('active-shell thread coordination validator accepts a wired App Server adapter', () => {
  const { shellPaths } = fixture();
  assert.doesNotThrow(() => validateShellThreadCoordination(shellPaths));
});

test('candidate adapter skips AionUI implementation probes when validation is contract-paths-only', () => {
  const shellPaths = {
    shellRoot: '/candidate-without-aionui-fork-body',
    contract: { shell_contract: { implementation_validation: 'contract_paths_only' } },
  };
  assert.doesNotThrow(() => validateShellThreadCoordination(shellPaths));
});

test('active-shell thread coordination validator rejects an unwired production port', () => {
  const { root, shellPaths } = fixture();
  const bridgePath = path.join(root, 'packages/desktop/src/process/bridge/threadCoordinationBridge.ts');
  fs.writeFileSync(bridgePath, fs.readFileSync(bridgePath, 'utf8').replace(' = createProductionCodexThreadCoordinationPort()', ''), 'utf8');
  assert.throws(() => validateShellThreadCoordination(shellPaths), /production bridge/);
});

test('active-shell thread coordination validator rejects send_input as a cross-thread bus', () => {
  const { root, shellPaths } = fixture();
  fs.appendFileSync(
    path.join(root, 'packages/desktop/src/process/services/threadCoordination/index.ts'),
    '\nsend_input(targetThread)\n',
    'utf8',
  );
  assert.throws(() => validateShellThreadCoordination(shellPaths), /must not include send_input/);
});

test('active-shell thread coordination validator rejects a hidden ordinary rail entry', () => {
  const { root, shellPaths } = fixture();
  const siderPath = path.join(root, 'packages/desktop/src/renderer/components/layout/Sider/index.tsx');
  fs.writeFileSync(siderPath, 'ordinary navigation without coordination', 'utf8');
  assert.throws(() => validateShellThreadCoordination(shellPaths), /keyboard-reachable cross-thread coordination entry/);
});

test('active-shell thread coordination validator rejects legacy project and write-set hard gates', () => {
  const { root, shellPaths } = fixture();
  fs.appendFileSync(
    path.join(root, 'packages/desktop/src/process/services/threadCoordination/index.ts'),
    "\ncode: 'cross_project_write'\ncode: 'write_set_conflict'\ncode: 'duplicate_delivery'\n",
    'utf8',
  );
  assert.throws(() => validateShellThreadCoordination(shellPaths), /must not hard-gate advisory/);
});

test('active-shell thread coordination validator rejects an OPL confirmation layer', () => {
  const { root, shellPaths } = fixture();
  fs.appendFileSync(
    path.join(root, 'packages/desktop/src/process/services/threadCoordination/index.ts'),
    "\noutcome: 'confirmation_required'\n",
    'utf8',
  );
  assert.throws(() => validateShellThreadCoordination(shellPaths), /must not add an OPL confirmation layer/);
});
