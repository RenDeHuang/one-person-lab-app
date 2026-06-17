#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const appRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const defaultSourceVm = process.env.OPL_HERMES_TART_SOURCE
  || process.env.OPL_FIRST_RUN_TART_SOURCE
  || 'opl-first-run-no-clt-clean-base-26-5-18';
const defaultGuestUser = process.env.OPL_HERMES_GUEST_USER
  || process.env.OPL_FIRST_RUN_GUEST_USER
  || 'admin';
const defaultSshKey = process.env.OPL_HERMES_GUEST_SSH_KEY
  || process.env.OPL_FIRST_RUN_GUEST_SSH_KEY
  || path.join(os.homedir(), '.ssh', 'opl_first_run_tart_ed25519');
const siblingShellRoot = path.resolve(appRoot, '..', 'opl-hermes-shell');
const linkedShellRoot = path.join(appRoot, 'shells', 'hermes');
const defaultShellRoot = process.env.OPL_APP_SHELL_ROOT
  ? resolveHostPath(process.env.OPL_APP_SHELL_ROOT)
  : fs.existsSync(siblingShellRoot)
    ? siblingShellRoot
    : linkedShellRoot;

type Options = {
  sourceVm: string;
  vmName: string;
  shellRoot: string;
  appPath: string;
  artifacts: string;
  guestUser: string;
  sshKey: string;
  guestWorkdir: string;
  guestNodeCommand: string;
  timeoutMs: number;
  display: string;
  noGraphics: boolean;
  keepVm: boolean;
  dryRun: boolean;
};

function usage(): void {
  process.stdout.write(`Usage:
  node --experimental-strip-types scripts/smoke-hermes-candidate-tart.ts [options]

Options:
  --source-vm <name>       Tart source VM. Default: ${defaultSourceVm}
  --vm-name <name>         Temporary VM name. Default: opl-hermes-candidate-<timestamp>
  --shell-root <path>      Hermes shell checkout. Default: OPL_APP_SHELL_ROOT, then ../opl-hermes-shell, then shells/hermes
  --app <path>             Packaged Hermes .app. Default: <shell-root>/release/mac-arm64/One Person Lab Hermes Candidate.app
  --artifacts <path>       Host artifact directory. Default: artifacts/hermes-candidate-tart-<timestamp>
  --guest-user <name>      SSH user in the guest. Default: ${defaultGuestUser}
  --ssh-key <path>         SSH private key. Default: ${defaultSshKey}
  --guest-workdir <path>   Guest workdir. Default: /tmp/opl-hermes-candidate-smoke
  --guest-node-command <cmd>
                           Existing Node.js command in the guest. Auto-detected when omitted.
  --timeout-ms <n>         Boot/SSH/smoke timeout. Default: 600000
  --display <resolution>   Tart display resolution. Default: 1920x1080
  --no-graphics            Run Tart without a visible window. Use only with a logged-in GUI guest.
  --keep-vm                Keep the temporary VM after success/failure.
  --dry-run                Write plan only; do not clone or start Tart.
  --help                   Show this message.
`);
}

function resolveHostPath(value: string): string {
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(appRoot, value);
}

function parseArgs(argv: string[]): Options {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const options: Options = {
    sourceVm: defaultSourceVm,
    vmName: `opl-hermes-candidate-${stamp}`,
    shellRoot: defaultShellRoot,
    appPath: '',
    artifacts: path.join(appRoot, 'artifacts', `hermes-candidate-tart-${stamp}`),
    guestUser: defaultGuestUser,
    sshKey: defaultSshKey,
    guestWorkdir: '/tmp/opl-hermes-candidate-smoke',
    guestNodeCommand: '',
    timeoutMs: 600_000,
    display: '1920x1080',
    noGraphics: false,
    keepVm: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      usage();
      process.exit(0);
    }
    if (arg === '--no-graphics') {
      options.noGraphics = true;
      continue;
    }
    if (arg === '--keep-vm') {
      options.keepVm = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }
    index += 1;
    if (arg === '--source-vm') options.sourceVm = value;
    else if (arg === '--vm-name') options.vmName = value;
    else if (arg === '--shell-root') options.shellRoot = resolveHostPath(value);
    else if (arg === '--app') options.appPath = resolveHostPath(value);
    else if (arg === '--artifacts') options.artifacts = resolveHostPath(value);
    else if (arg === '--guest-user') options.guestUser = value;
    else if (arg === '--ssh-key') options.sshKey = path.resolve(value);
    else if (arg === '--guest-workdir') options.guestWorkdir = value;
    else if (arg === '--guest-node-command') options.guestNodeCommand = value;
    else if (arg === '--timeout-ms') options.timeoutMs = Number(value);
    else if (arg === '--display') options.display = value;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.appPath) {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    options.appPath = path.join(options.shellRoot, 'release', `mac-${arch}`, 'One Person Lab Hermes Candidate.app');
  }
  return options;
}

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function run(command: string, args: string[], opts: { cwd?: string; timeoutMs?: number; outputPath?: string } = {}): string {
  const result = spawnSync(command, args, {
    cwd: opts.cwd,
    encoding: 'utf8',
    timeout: opts.timeoutMs,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (opts.outputPath) fs.writeFileSync(opts.outputPath, output, 'utf8');
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with ${result.status ?? result.signal}\n${output}`);
  }
  return output;
}

function tryRun(command: string, args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): string | null {
  const result = spawnSync(command, args, {
    cwd: opts.cwd,
    encoding: 'utf8',
    timeout: opts.timeoutMs,
  });
  if (result.status !== 0) return null;
  return (result.stdout || '').trim() || null;
}

function readGitHead(directory: string): string | null {
  return tryRun('git', ['rev-parse', 'HEAD'], { cwd: directory, timeoutMs: 10_000 });
}

function readRealpath(directory: string): string {
  try {
    return fs.realpathSync(directory);
  } catch {
    return directory;
  }
}

function sshArgs(options: Options, ip: string): string[] {
  const args = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'LogLevel=ERROR',
    '-o', 'ConnectTimeout=10',
  ];
  if (options.sshKey) args.push('-o', 'IdentitiesOnly=yes', '-i', options.sshKey);
  args.push(`${options.guestUser}@${ip}`);
  return args;
}

function ssh(options: Options, ip: string, command: string, outputPath?: string): string {
  return run('ssh', [...sshArgs(options, ip), command], {
    timeoutMs: options.timeoutMs,
    outputPath,
  });
}

function scpFromGuest(options: Options, ip: string, source: string, target: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const args = ['-r', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-o', 'LogLevel=ERROR'];
  if (options.sshKey) args.push('-o', 'IdentitiesOnly=yes', '-i', options.sshKey);
  args.push(`${options.guestUser}@${ip}:${source}`, target);
  run('scp', args, { timeoutMs: options.timeoutMs });
}

function scpToGuest(options: Options, ip: string, source: string, targetDir: string): void {
  const args = ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-o', 'LogLevel=ERROR'];
  if (options.sshKey) args.push('-o', 'IdentitiesOnly=yes', '-i', options.sshKey);
  args.push(source, `${options.guestUser}@${ip}:${targetDir}/`);
  run('scp', args, { timeoutMs: options.timeoutMs });
}

function tarToGuest(options: Options, ip: string, sourceDir: string, sourceName: string, targetDir: string): void {
  const tarPath = path.join(options.artifacts, `${sourceName.replace(/[^a-zA-Z0-9._-]/g, '_')}.tar`);
  run('tar', ['-C', sourceDir, '-cf', tarPath, sourceName], { timeoutMs: options.timeoutMs });
  const guestTar = `${options.guestWorkdir}/${path.basename(tarPath)}`;
  scpToGuest(options, ip, tarPath, options.guestWorkdir);
  ssh(options, ip, `mkdir -p ${shellQuote(targetDir)} && tar -C ${shellQuote(targetDir)} -xf ${shellQuote(guestTar)}`);
}

function waitForIp(vmName: string, timeoutMs: number): string {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = spawnSync('tart', ['ip', vmName], { encoding: 'utf8' });
    if (result.status === 0) {
      const ip = result.stdout.trim().split(/\s+/).find(Boolean);
      if (ip) return ip;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2_000);
  }
  throw new Error(`Timed out waiting for Tart IP for ${vmName}`);
}

function waitForSsh(options: Options, ip: string): void {
  const deadline = Date.now() + options.timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    const result = spawnSync('ssh', [...sshArgs(options, ip), 'true'], {
      encoding: 'utf8',
      timeout: 15_000,
    });
    last = `${result.stdout || ''}${result.stderr || ''}`.trim();
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2_000);
  }
  throw new Error(`Timed out waiting for SSH to ${options.guestUser}@${ip}\n${last}`);
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertPreflight(options: Options): void {
  if (process.platform !== 'darwin') throw new Error('Hermes candidate Tart smoke is macOS-only.');
  if (!fs.existsSync(options.shellRoot)) throw new Error(`Hermes shell root does not exist: ${options.shellRoot}`);
  if (!fs.existsSync(options.appPath) || !fs.statSync(options.appPath).isDirectory()) {
    throw new Error(`Packaged Hermes .app does not exist: ${options.appPath}`);
  }
  const smokeScript = path.join(options.shellRoot, 'scripts', 'smoke-opl-first-run.cjs');
  if (!fs.existsSync(smokeScript)) throw new Error(`Hermes smoke script does not exist: ${smokeScript}`);
  if (!fs.existsSync(options.sshKey)) throw new Error(`SSH key does not exist: ${options.sshKey}`);
}

function writePlan(options: Options): void {
  fs.mkdirSync(options.artifacts, { recursive: true });
  fs.writeFileSync(path.join(options.artifacts, 'host-plan.json'), JSON.stringify({
    surface_id: 'opl_hermes_candidate_tart_smoke_plan.v1',
    source_vm: options.sourceVm,
    vm_name: options.vmName,
    shell_root: options.shellRoot,
    app_path: options.appPath,
    artifacts: options.artifacts,
    guest_user: options.guestUser,
    ssh_key_present: Boolean(options.sshKey && fs.existsSync(options.sshKey)),
    app_root: appRoot,
    app_repo_head: readGitHead(appRoot),
    shell_root_realpath: readRealpath(options.shellRoot),
    shell_repo_head: readGitHead(options.shellRoot),
    guest_workdir: options.guestWorkdir,
    guest_node_command: options.guestNodeCommand || null,
    display: options.display,
    no_graphics: options.noGraphics,
    timeout_ms: options.timeoutMs,
  }, null, 2));
}

function resolveGuestNodeCommand(options: Options, ip: string): string {
  if (options.guestNodeCommand) return options.guestNodeCommand;
  const probe = [
    'for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node node; do',
    '  if command -v "$candidate" >/dev/null 2>&1; then',
    '    "$candidate" -e "console.log(process.execPath)" 2>/dev/null && exit 0;',
    '  fi;',
    'done;',
    'exit 127',
  ].join(' ');
  const resolved = ssh(options, ip, probe, path.join(options.artifacts, 'guest-node-probe.log'))
    .trim()
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.endsWith('/node') || line.includes('/node '));
  if (!resolved) throw new Error('Could not resolve Node.js in guest.');
  return resolved;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  assertPreflight(options);
  writePlan(options);
  if (options.dryRun) {
    console.log(JSON.stringify({ status: 'dry_run', artifacts: options.artifacts }, null, 2));
    return;
  }

  let tartProcess: ReturnType<typeof spawn> | null = null;
  let ip = '';
  const cleanup = () => {
    if (options.keepVm) return;
    if (tartProcess && !tartProcess.killed) tartProcess.kill('SIGTERM');
    spawnSync('tart', ['stop', options.vmName], { encoding: 'utf8' });
    spawnSync('tart', ['delete', options.vmName], { encoding: 'utf8' });
  };

  try {
    run('tart', ['clone', options.sourceVm, options.vmName], {
      outputPath: path.join(options.artifacts, 'tart-clone.log'),
      timeoutMs: options.timeoutMs,
    });
    run('tart', ['set', options.vmName, '--display', options.display], {
      outputPath: path.join(options.artifacts, 'tart-set.log'),
      timeoutMs: options.timeoutMs,
    });
    const runArgs = ['run'];
    if (options.noGraphics) runArgs.push('--no-graphics');
    runArgs.push(options.vmName);
    const runLog = fs.openSync(path.join(options.artifacts, 'tart-run.log'), 'a');
    tartProcess = spawn('tart', runArgs, { stdio: ['ignore', runLog, runLog] });
    fs.writeFileSync(path.join(options.artifacts, 'tart-run.pid'), `${tartProcess.pid}\n`);
    ip = waitForIp(options.vmName, options.timeoutMs);
    fs.writeFileSync(path.join(options.artifacts, 'guest-ip.txt'), `${ip}\n`);
    waitForSsh(options, ip);
    options.guestNodeCommand = resolveGuestNodeCommand(options, ip);

    const guestRoot = `${options.guestWorkdir}/opl-hermes-shell`;
    const guestArtifacts = `${options.guestWorkdir}/artifacts`;
    ssh(options, ip, `rm -rf ${shellQuote(options.guestWorkdir)} && mkdir -p ${shellQuote(guestRoot)} ${shellQuote(guestArtifacts)}`);
    ssh(options, ip, `mkdir -p ${shellQuote(`${guestRoot}/scripts`)} ${shellQuote(`${guestRoot}/release/mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}`)}`);
    tarToGuest(
      options,
      ip,
      path.dirname(options.appPath),
      path.basename(options.appPath),
      `${guestRoot}/release/mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}`,
    );
    tarToGuest(options, ip, path.join(options.shellRoot, 'scripts'), 'smoke-opl-first-run.cjs', `${guestRoot}/scripts`);
    const guestApp = `${guestRoot}/release/mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}/${path.basename(options.appPath)}`;
    const guestNodeBinDir = path.posix.dirname(options.guestNodeCommand);
    const guestCommand = [
      `cd ${shellQuote(guestRoot)}`,
      `xattr -dr com.apple.quarantine ${shellQuote(guestApp)} || true`,
      `PATH=${shellQuote(`${guestNodeBinDir}:$PATH`)} OPL_HERMES_SMOKE_ARTIFACTS=${shellQuote(guestArtifacts)} ${shellQuote(options.guestNodeCommand)} scripts/smoke-opl-first-run.cjs`,
    ].join(' && ');
    ssh(options, ip, guestCommand, path.join(options.artifacts, 'guest-smoke.log'));
    scpFromGuest(options, ip, `${guestArtifacts}/`, path.join(options.artifacts, 'guest-artifacts'));

    const summaryPath = path.join(options.artifacts, 'guest-artifacts', 'summary.json');
    const guestSummary = fs.existsSync(summaryPath) ? readJson(summaryPath) : null;
    const summary = {
      surface_id: 'opl_hermes_candidate_tart_smoke.v1',
      status: 'passed',
      source_vm: options.sourceVm,
      vm_name: options.vmName,
      guest_ip: ip,
      guest_user: options.guestUser,
      app_path: options.appPath,
      app_root: appRoot,
      app_repo_head: readGitHead(appRoot),
      shell_root: options.shellRoot,
      shell_root_realpath: readRealpath(options.shellRoot),
      shell_repo_head: readGitHead(options.shellRoot),
      guest_summary: guestSummary,
      artifacts: options.artifacts,
    };
    fs.writeFileSync(path.join(options.artifacts, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    const summary = {
      surface_id: 'opl_hermes_candidate_tart_smoke.v1',
      status: 'failed',
      source_vm: options.sourceVm,
      vm_name: options.vmName,
      guest_ip: ip || null,
      guest_user: options.guestUser,
      app_path: options.appPath,
      error: error instanceof Error ? error.message : String(error),
      artifacts: options.artifacts,
    };
    fs.writeFileSync(path.join(options.artifacts, 'summary.json'), JSON.stringify(summary, null, 2));
    throw error;
  } finally {
    cleanup();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
