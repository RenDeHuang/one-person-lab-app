import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readlinkSync } from 'node:fs';

const codexBin = '/opt/opl-validation/codex/vendor/x86_64-unknown-linux-musl/bin/codex';
const codexHome = '/opt/opl-validation/codex-home';
const cwd = '/opt/opl-validation/work';
const timeoutMs = 30_000;
const inheritedEnvNames = ['LANG', 'LC_ALL', 'LOGNAME', 'PATH', 'SHELL', 'TERM', 'TMPDIR', 'TZ', 'USER'];
const inheritedEnv = Object.fromEntries(
  inheritedEnvNames.flatMap((name) => (process.env[name] ? [[name, process.env[name]]] : [])),
);

const child = spawn(codexBin, ['app-server', '--stdio'], {
  cwd,
  detached: true,
  env: {
    ...inheritedEnv,
    CODEX_HOME: codexHome,
    OPL_CODEX_BIN: codexBin,
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stderr = '';
let buffer = '';
const pending = new Map();
let nextId = 1;
let activeMethod = null;

function cleanup() {
  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
  }
}

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

child.stderr.on('data', (chunk) => {
  stderr = `${stderr}${chunk}`.slice(-16_384);
});

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  while (true) {
    const index = buffer.indexOf('\n');
    if (index < 0) break;
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.id === undefined) continue;
    const request = pending.get(message.id);
    if (!request) continue;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  }
});

function write(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function request(method, params) {
  const id = nextId++;
  activeMethod = method;
  write({ id, method, params });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, timeoutMs);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        activeMethod = null;
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
  });
}

try {
  const initialize = await request('initialize', {
    clientInfo: {
      name: 'opl-aion-shell',
      title: 'One Person Lab App',
      version: '1',
    },
    capabilities: {
      experimentalApi: true,
      requestAttestation: false,
    },
  });
  write({ method: 'initialized' });
  const threadList = await request('thread/list', {
    cursor: null,
    limit: 1,
    sortKey: 'updated_at',
    sortDirection: 'desc',
    sourceKinds: ['cli', 'vscode', 'appServer', 'subAgent'],
    archived: false,
  });

  const stat = readFileSync(`/proc/${child.pid}/stat`, 'utf8').trim().split(' ');
  const executable = readlinkSync(`/proc/${child.pid}/exe`);
  const executableBytes = readFileSync(codexBin);
  const response = {
    observed_at: new Date().toISOString(),
    pid: child.pid,
    starttime: stat[21],
    process_group: stat[4],
    executable,
    executable_sha256: createHash('sha256').update(executableBytes).digest('hex'),
    codex_home: codexHome,
    cwd,
    initialize_ok: Boolean(initialize && typeof initialize === 'object'),
    initialize_keys:
      initialize && typeof initialize === 'object' ? Object.keys(initialize).sort() : [],
    thread_list_ok: Boolean(threadList && typeof threadList === 'object'),
    thread_list_keys:
      threadList && typeof threadList === 'object' ? Object.keys(threadList).sort() : [],
    thread_count: Array.isArray(threadList?.data) ? threadList.data.length : null,
    next_cursor_present: Boolean(threadList?.nextCursor),
  };
  process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
} catch (error) {
  const errorKind = error instanceof SyntaxError
    ? 'invalid_json_response'
    : error instanceof Error && error.message.startsWith('Timed out')
      ? 'timeout'
      : 'rpc_or_process_failure';
  process.stdout.write(`${JSON.stringify({
    observed_at: new Date().toISOString(),
    status: 'failed',
    failed_method: activeMethod,
    error_kind: errorKind,
    stderr_present: stderr.trim().length > 0,
  }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  cleanup();
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 5_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
