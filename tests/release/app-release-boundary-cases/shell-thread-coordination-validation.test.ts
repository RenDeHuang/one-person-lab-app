import { validateShellThreadCoordination } from '../../../scripts/validate-active-shell/shell-thread-coordination-validator.ts';
import { assert, fs, os, path, test } from './helpers.ts';

const files = {
  'packages/desktop/src/common/types/codex/threadCoordination.ts': `
    CODEX_THREAD_COORDINATION_METHODS 'thread/list' 'thread/read' 'thread/resume' 'thread/fork'
    'thread/archive' 'thread/unarchive' 'thread/name/set' 'thread/delete'
    'turn/start' 'turn/steer' messageSummary advisories 'inherit'
    CodexThreadServerRequest ThreadCoordinationResolveServerRequest
    'server_request_not_pending' 'server_request_handler_unavailable'
  `,
  'packages/desktop/src/process/bridge/threadCoordinationBridge.ts': `
    createProductionCodexThreadCoordinationPort
    port: CodexThreadCoordinationPort = createProductionCodexThreadCoordinationPort()
    disposeThreadCoordinationBridge
    app.on('before-quit', disposeThreadCoordinationBridge)
    listPendingRequests.provider resolveServerRequest.provider
  `,
  'packages/desktop/src/process/services/threadCoordination/jsonRpcClient.ts': `
    ['app-server', '--stdio'] 'initialize' Codex app-server request timed out
    Unsupported server request rejectPending 'currentTime/read'
    INTERACTIVE_SERVER_REQUEST_METHODS pendingServerRequests resolveServerRequest
  `,
  'packages/desktop/src/process/services/threadCoordination/codexAppServerPort.ts': `
    this.rpc.request('thread/list' this.rpc.request('thread/read' this.rpc.request('thread/resume'
    this.rpc.request('thread/fork' this.rpc.request('thread/archive' this.rpc.request('thread/unarchive'
    this.rpc.request('thread/name/set' this.rpc.request('thread/delete'
    this.rpc.request('turn/start'
    this.rpc.request('turn/steer' response.nextCursor DEFAULT_MAX_PAGES sourceThreadIdHint
    listPendingServerRequests resolveServerRequest
  `,
  'packages/desktop/src/process/services/threadCoordination/index.ts': `
    code: 'thread_not_found' code: 'cross_host_delivery' code: 'thread_not_writable'
    boundedMessageSummary advisories idempotencyKey 'cross_project_context' 'workspace_context_changed'
    'write_set_overlap' 'delegation_cycle' listPendingServerRequests resolveServerRequest
    errorCode: 'server_request_not_pending' errorCode: 'server_request_handler_unavailable'
  `,
  'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ThreadCoordination/useThreadCoordination.ts': `
    canonicalCodexThreadId sourceThreadIdHint ipcBridge.threadCoordination.getOverview.invoke
    listPendingRequests resolveServerRequest
  `,
  'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ThreadCoordination/index.tsx': `
    ThreadCoordinationSection MESSAGE_TEXTAREA_AUTO_SIZE autoSize={MESSAGE_TEXTAREA_AUTO_SIZE}
    messageSummary advisories permission: 'inherit' writeSet: []
    PendingServerRequests selectedPendingRequests
  `,
  'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ThreadCoordination/PendingServerRequests.tsx': `
    request.kind === 'command_approval' request.kind === 'file_change_approval'
    request.kind === 'permissions_approval' request.kind === 'user_input'
    request.kind === 'mcp_elicitation' decision: 'decline' onResolve
    request.threadId request.turnId request.itemId data-state=
    'approval_pending' 'user_input_pending' 'mcp_elicitation_pending'
    'server_request_resolving' 'server_request_declined'
    'server_request_handler_unavailable' 'dispatch_failed'
  `,
  'packages/desktop/src/renderer/components/layout/Sider/index.tsx': `
    <ThreadCoordinationSection />
  `,
  'tests/unit/thread-coordination/codexAppServerPort.test.ts':
    'paginates thread/list projects interactive app-server requests and returns protocol-specific decisions',
  'tests/unit/thread-coordination/jsonRpcClient.test.ts':
    'queues interactive server requests until the renderer returns a typed result answers currentTime/read locally and rejects unknown server requests',
  'tests/unit/thread-coordination/threadCoordinationService.test.ts':
    'steers the active turn without adding an OPL permission confirmation reports repeated routes as advisory and replays the first accepted receipt for an identical request key coalesces concurrent retries for one idempotency key into a single dispatch allows the same message to be sent again with a new request key allows cross-project delivery and reports write-set overlap as advisory metadata inherits the running thread permission policy instead of imposing an OPL write scope does not add confirmation for cross-project delivery or a running turn steer archives directly through the Codex App Server lifecycle method restores an archived top-level thread through thread/unarchive renames and deletes canonical tasks through Codex App Server lifecycle methods reports unavailable and expired interactive request handlers with typed errors',
  'tests/unit/conversation/ThreadCoordination.dom.test.tsx':
    'prefers the canonical Codex thread id over the legacy session id and supports explicit sender selection keeps the message TextArea autoSize object stable across React rerenders archives directly without adding an OPL confirmation step shows thread, turn, and item context and forwards a native decline without changing Codex policy keeps a typed handler-unavailable failure visible on the pending request',
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

test('active-shell thread coordination validator rejects approval requests without a pending-state handler', () => {
  const { root, shellPaths } = fixture();
  const rpcPath = path.join(
    root,
    'packages/desktop/src/process/services/threadCoordination/jsonRpcClient.ts',
  );
  fs.writeFileSync(
    rpcPath,
    fs.readFileSync(rpcPath, 'utf8').replace('INTERACTIVE_SERVER_REQUEST_METHODS', ''),
    'utf8',
  );
  assert.throws(
    () => validateShellThreadCoordination(shellPaths),
    /Codex app-server JSON-RPC client/,
  );
});

test('active-shell thread coordination validator rejects pending requests without thread, turn, and item context', () => {
  const { root, shellPaths } = fixture();
  const pendingViewPath = path.join(
    root,
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ThreadCoordination/PendingServerRequests.tsx',
  );
  fs.writeFileSync(
    pendingViewPath,
    fs.readFileSync(pendingViewPath, 'utf8').replace('request.turnId', ''),
    'utf8',
  );
  assert.throws(() => validateShellThreadCoordination(shellPaths), /interactive server-request UI/);
});

test('active-shell thread coordination validator rejects untyped request-handler failures', () => {
  const { root, shellPaths } = fixture();
  const servicePath = path.join(
    root,
    'packages/desktop/src/process/services/threadCoordination/index.ts',
  );
  fs.writeFileSync(
    servicePath,
    fs.readFileSync(servicePath, 'utf8').replace("errorCode: 'server_request_not_pending'", ''),
    'utf8',
  );
  assert.throws(() => validateShellThreadCoordination(shellPaths), /flexible cross-thread routing and audit service/);
});

test('active-shell thread coordination validator rejects pending UI without typed state markers', () => {
  const { root, shellPaths } = fixture();
  const pendingViewPath = path.join(
    root,
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ThreadCoordination/PendingServerRequests.tsx',
  );
  fs.writeFileSync(
    pendingViewPath,
    fs.readFileSync(pendingViewPath, 'utf8').replace("'server_request_handler_unavailable'", ''),
    'utf8',
  );
  assert.throws(() => validateShellThreadCoordination(shellPaths), /interactive server-request UI/);
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
