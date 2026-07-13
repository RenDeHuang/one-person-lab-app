import { validateShellThreadCoordination } from '../../../scripts/validate-active-shell/shell-thread-coordination-validator.ts';
import { assert, fs, os, path, test } from './helpers.ts';

const files = {
  'packages/desktop/src/common/types/codex/threadCoordination.ts': `
    CODEX_THREAD_COORDINATION_METHODS 'thread/list' 'thread/read' 'thread/resume' 'thread/fork'
    'thread/archive' 'turn/start' 'turn/steer' messageSummary permissionDecision writeSetDecision
    'confirmation_required'
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
    this.rpc.request('thread/fork' this.rpc.request('thread/archive' this.rpc.request('turn/start'
    this.rpc.request('turn/steer' response.nextCursor DEFAULT_MAX_PAGES sourceThreadIdHint
  `,
  'packages/desktop/src/process/services/threadCoordination/index.ts': `
    code: 'duplicate_delivery' code: 'delivery_loop' code: 'write_set_conflict'
    code: 'cross_project_write' outcome: 'confirmation_required' boundedMessageSummary
    permissionDecision writeSetDecision
  `,
  'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ThreadCoordination/useThreadCoordination.ts': `
    acp_session_id sourceThreadIdHint ipcBridge.threadCoordination.getOverview.invoke
  `,
  'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ThreadCoordination/index.tsx': `
    ThreadCoordinationSection MESSAGE_TEXTAREA_AUTO_SIZE WRITE_SET_TEXTAREA_AUTO_SIZE
    autoSize={MESSAGE_TEXTAREA_AUTO_SIZE} autoSize={WRITE_SET_TEXTAREA_AUTO_SIZE}
    messageSummary permissionDecision writeSetDecision result.outcome === 'confirmation_required'
  `,
  'packages/desktop/src/renderer/components/layout/Sider/index.tsx': `
    ThreadCoordinationSection <ThreadCoordinationSection
  `,
  'tests/unit/thread-coordination/codexAppServerPort.test.ts': 'paginates thread/list',
  'tests/unit/thread-coordination/threadCoordinationService.test.ts':
    'rejects repeated routes and duplicate idempotency keys blocks cross-project writes and overlap with another running thread',
  'tests/unit/conversation/ThreadCoordination.dom.test.tsx':
    'keeps both TextArea autoSize objects stable across React rerenders',
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
