import {
  assertShellTextIncludesAll,
  assertTextExcludesAll,
  assertTextIncludesAll,
  readShellText,
} from './shell-implementation-helpers.ts';

const paths = {
  types: 'packages/desktop/src/common/types/codex/threadCoordination.ts',
  bridge: 'packages/desktop/src/process/bridge/threadCoordinationBridge.ts',
  rpc: 'packages/desktop/src/process/services/threadCoordination/jsonRpcClient.ts',
  port: 'packages/desktop/src/process/services/threadCoordination/codexAppServerPort.ts',
  service: 'packages/desktop/src/process/services/threadCoordination/index.ts',
  hook: 'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ThreadCoordination/useThreadCoordination.ts',
  view: 'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ThreadCoordination/index.tsx',
  pendingView:
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ThreadCoordination/PendingServerRequests.tsx',
  sider: 'packages/desktop/src/renderer/components/layout/Sider/index.tsx',
  rpcTest: 'tests/unit/thread-coordination/jsonRpcClient.test.ts',
  portTest: 'tests/unit/thread-coordination/codexAppServerPort.test.ts',
  serviceTest: 'tests/unit/thread-coordination/threadCoordinationService.test.ts',
  domTest: 'tests/unit/conversation/ThreadCoordination.dom.test.tsx',
};

export function validateShellThreadCoordination(shellPaths): void {
  if (shellPaths.contract?.shell_contract?.implementation_validation === 'contract_paths_only') {
    return;
  }

  const types = assertShellTextIncludesAll(
    shellPaths,
    paths.types,
    [
      'CODEX_THREAD_COORDINATION_METHODS',
      "'thread/list'",
      "'thread/read'",
      "'thread/resume'",
      "'thread/fork'",
      "'thread/archive'",
      "'thread/unarchive'",
      "'thread/name/set'",
      "'thread/delete'",
      "'turn/start'",
      "'turn/steer'",
      'messageSummary',
      'advisories',
      "'inherit'",
      'CodexThreadServerRequest',
      'ThreadCoordinationResolveServerRequest',
      "'server_request_not_pending'",
      "'server_request_handler_unavailable'",
    ],
    'Codex cross-thread coordination contract',
  );
  const bridge = assertShellTextIncludesAll(
    shellPaths,
    paths.bridge,
    [
      'createProductionCodexThreadCoordinationPort',
      'port: CodexThreadCoordinationPort = createProductionCodexThreadCoordinationPort()',
      'disposeThreadCoordinationBridge',
      "app.on('before-quit', disposeThreadCoordinationBridge)",
      'listPendingRequests.provider',
      'resolveServerRequest.provider',
    ],
    'Codex cross-thread production bridge',
  );
  const rpc = assertShellTextIncludesAll(
    shellPaths,
    paths.rpc,
    [
      "['app-server', '--stdio']",
      "'initialize'",
      'Codex app-server request timed out',
      'Unsupported server request',
      'rejectPending',
      "'currentTime/read'",
      'INTERACTIVE_SERVER_REQUEST_METHODS',
      'pendingServerRequests',
      'resolveServerRequest',
    ],
    'Codex app-server JSON-RPC client',
  );
  const port = assertShellTextIncludesAll(
    shellPaths,
    paths.port,
    [
      "this.rpc.request('thread/list'",
      "this.rpc.request('thread/read'",
      "this.rpc.request('thread/resume'",
      "this.rpc.request('thread/fork'",
      "this.rpc.request('thread/archive'",
      "this.rpc.request('thread/unarchive'",
      "this.rpc.request('thread/name/set'",
      "this.rpc.request('thread/delete'",
      "this.rpc.request('turn/start'",
      "this.rpc.request('turn/steer'",
      'response.nextCursor',
      'DEFAULT_MAX_PAGES',
      'sourceThreadIdHint',
      'listPendingServerRequests',
      'resolveServerRequest',
    ],
    'Codex app-server thread coordination port',
  );
  const service = assertShellTextIncludesAll(
    shellPaths,
    paths.service,
    [
      "code: 'thread_not_found'",
      "code: 'cross_host_delivery'",
      "code: 'thread_not_writable'",
      'boundedMessageSummary',
      'advisories',
      'idempotencyKey',
      "'cross_project_context'",
      "'workspace_context_changed'",
      "'write_set_overlap'",
      "'delegation_cycle'",
      'listPendingServerRequests',
      'resolveServerRequest',
      "errorCode: 'server_request_not_pending'",
      "errorCode: 'server_request_handler_unavailable'",
    ],
    'OPL flexible cross-thread routing and audit service',
  );
  const hook = assertShellTextIncludesAll(
    shellPaths,
    paths.hook,
    [
      'canonicalCodexThreadId',
      'sourceThreadIdHint',
      'ipcBridge.threadCoordination.getOverview.invoke',
      'listPendingRequests',
      'resolveServerRequest',
    ],
    'Cross-thread source-thread mapping',
  );
  const view = assertShellTextIncludesAll(
    shellPaths,
    paths.view,
    [
      'ThreadCoordinationSection',
      'MESSAGE_TEXTAREA_AUTO_SIZE',
      'autoSize={MESSAGE_TEXTAREA_AUTO_SIZE}',
      'messageSummary',
      'advisories',
      "permission: 'inherit'",
      'writeSet: []',
      'PendingServerRequests',
      'selectedPendingRequests',
    ],
    'Cross-thread coordination UI',
  );
  const pendingView = assertShellTextIncludesAll(
    shellPaths,
    paths.pendingView,
    [
      "request.kind === 'command_approval'",
      "request.kind === 'file_change_approval'",
      "request.kind === 'permissions_approval'",
      "request.kind === 'user_input'",
      "request.kind === 'mcp_elicitation'",
      "decision: 'decline'",
      'onResolve',
      'request.threadId',
      'request.turnId',
      'request.itemId',
      'data-state=',
      "'approval_pending'",
      "'user_input_pending'",
      "'mcp_elicitation_pending'",
      "'server_request_resolving'",
      "'server_request_declined'",
      "'server_request_handler_unavailable'",
      "'dispatch_failed'",
    ],
    'Codex interactive server-request UI',
  );
  const sider = readShellText(shellPaths, paths.sider);
  assertTextExcludesAll(
    sider,
    ['ThreadCoordinationSection', '<ThreadCoordinationSection'],
    'Cross-thread coordination stays available to the host/model without an ordinary rail page',
  );

  const tests = [
    readShellText(shellPaths, paths.portTest),
    readShellText(shellPaths, paths.serviceTest),
    readShellText(shellPaths, paths.domTest),
    readShellText(shellPaths, paths.rpcTest),
  ].join('\n');
  assertTextIncludesAll(
    tests,
    [
      'paginates thread/list',
      'steers the active turn without adding an OPL permission confirmation',
      'reports repeated routes as advisory and replays the first accepted receipt for an identical request key',
      'coalesces concurrent retries for one idempotency key into a single dispatch',
      'allows the same message to be sent again with a new request key',
      'allows cross-project delivery and reports write-set overlap as advisory metadata',
      'inherits the running thread permission policy instead of imposing an OPL write scope',
      'does not add confirmation for cross-project delivery or a running turn steer',
      'archives directly through the Codex App Server lifecycle method',
      'restores an archived top-level thread through thread/unarchive',
      'renames and deletes canonical tasks through Codex App Server lifecycle methods',
      'reports unavailable and expired interactive request handlers with typed errors',
      'prefers the canonical Codex thread id over the legacy session id and supports explicit sender selection',
      'keeps the message TextArea autoSize object stable across React rerenders',
      'archives directly without adding an OPL confirmation step',
      'queues interactive server requests until the renderer returns a typed result',
      'answers currentTime/read locally and rejects unknown server requests',
      'projects interactive app-server requests and returns protocol-specific decisions',
      'shows thread, turn, and item context and forwards a native decline without changing Codex policy',
      'keeps a typed handler-unavailable failure visible on the pending request',
    ],
    'Cross-thread focused regression tests',
  );

  assertTextExcludesAll(
    [types, bridge, rpc, port, service, hook, view, pendingView].join('\n'),
    ['send_input', '.codex/sessions', 'rollout-'],
    'Cross-thread implementation forbidden alternate transports and stores',
  );
  assertTextExcludesAll(
    service,
    [
      "code: 'delivery_loop'",
      "code: 'write_set_conflict'",
      "code: 'cross_project_write'",
      "code: 'permission_expansion_denied'",
      "code: 'duplicate_delivery'",
    ],
    'Cross-thread implementation must not hard-gate advisory project, workspace, route, dedupe-content, or write-set signals',
  );
  assertTextExcludesAll(
    [types, service, view].join('\n'),
    ['confirmation_required'],
    'Cross-thread implementation must not add an OPL confirmation layer, including for reversible archive',
  );
  assertTextExcludesAll(
    port,
    ['permissionParams(', 'runtimeWorkspaceRoots:', 'approvalPolicy:', 'sandboxPolicy:'],
    'Cross-thread turn/start must inherit the target thread sticky settings without OPL overrides',
  );
  assertTextExcludesAll(
    view,
    ['WRITE_SET_TEXTAREA', 'permission radio', 'confirmation modal'],
    'Cross-thread UI must not expose OPL permission, write-set, or confirmation controls',
  );
}
