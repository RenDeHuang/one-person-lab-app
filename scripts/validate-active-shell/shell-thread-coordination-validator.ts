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
  sider: 'packages/desktop/src/renderer/components/layout/Sider/index.tsx',
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
      "'turn/start'",
      "'turn/steer'",
      'messageSummary',
      'permissionDecision',
      'writeSetDecision',
      "'confirmation_required'",
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
      "this.rpc.request('turn/start'",
      "this.rpc.request('turn/steer'",
      'response.nextCursor',
      'DEFAULT_MAX_PAGES',
      'sourceThreadIdHint',
    ],
    'Codex app-server thread coordination port',
  );
  const service = assertShellTextIncludesAll(
    shellPaths,
    paths.service,
    [
      "code: 'duplicate_delivery'",
      "code: 'delivery_loop'",
      "code: 'write_set_conflict'",
      "code: 'cross_project_write'",
      "outcome: 'confirmation_required'",
      'boundedMessageSummary',
      'permissionDecision',
      'writeSetDecision',
    ],
    'OPL cross-thread safety and audit service',
  );
  const hook = assertShellTextIncludesAll(
    shellPaths,
    paths.hook,
    ['acp_session_id', 'sourceThreadIdHint', 'ipcBridge.threadCoordination.getOverview.invoke'],
    'Cross-thread source-thread mapping',
  );
  const view = assertShellTextIncludesAll(
    shellPaths,
    paths.view,
    [
      'ThreadCoordinationSection',
      'MESSAGE_TEXTAREA_AUTO_SIZE',
      'WRITE_SET_TEXTAREA_AUTO_SIZE',
      'autoSize={MESSAGE_TEXTAREA_AUTO_SIZE}',
      'autoSize={WRITE_SET_TEXTAREA_AUTO_SIZE}',
      'messageSummary',
      'permissionDecision',
      'writeSetDecision',
      "result.outcome === 'confirmation_required'",
    ],
    'Cross-thread coordination UI',
  );
  assertTextExcludesAll(
    readShellText(shellPaths, paths.sider),
    ['ThreadCoordinationSection', '<ThreadCoordinationSection'],
    'Ordinary navigation must not mount the model-facing cross-thread capability',
  );

  const tests = [
    readShellText(shellPaths, paths.portTest),
    readShellText(shellPaths, paths.serviceTest),
    readShellText(shellPaths, paths.domTest),
  ].join('\n');
  assertTextIncludesAll(
    tests,
    [
      'paginates thread/list',
      'rejects repeated routes and duplicate idempotency keys',
      'blocks cross-project writes and overlap with another running thread',
      'keeps both TextArea autoSize objects stable across React rerenders',
    ],
    'Cross-thread focused regression tests',
  );

  assertTextExcludesAll(
    [types, bridge, rpc, port, service, hook, view].join('\n'),
    ['send_input', '.codex/sessions', 'rollout-'],
    'Cross-thread implementation forbidden alternate transports and stores',
  );
}
