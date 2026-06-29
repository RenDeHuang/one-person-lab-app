#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDockerWebuiDiagnostics } from './validate-docker-webui-diagnostics.ts';

type GateId = 'clean_linux_vm' | 'clean_windows_vm' | 'existing_docker' | 'existing_old_onepersonlab_data_dir';

type GateResult = {
  schema: 'opl_docker_webui_smoke_gate_result.v1';
  gate_id: GateId;
  status: 'passed' | 'typed_blocker' | 'failed';
  observed_at: string;
  host_platform: NodeJS.Platform;
  required_environment: string;
  artifact_dir: string;
  diagnostics_dir: string;
  diagnostics_validation?: ReturnType<typeof validateDockerWebuiDiagnostics>;
  blocker?: {
    code: string;
    owner: string;
    message: string;
    required_next_action: string;
  };
  commands: Array<{ command: string; status: number | null; stdout_path: string; stderr_path: string }>;
  evidence: Record<string, string>;
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv: string[]) {
  const options = {
    gate: '' as GateId | '',
    artifacts: '',
    image: 'ghcr.io/gaofeng21cn/one-person-lab-webui:latest',
    port: 3000,
    healthTimeout: 120,
    noOpen: true,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--gate') {
      options.gate = (argv[++index] ?? '') as GateId;
    } else if (arg.startsWith('--gate=')) {
      options.gate = arg.slice('--gate='.length) as GateId;
    } else if (arg === '--artifacts') {
      options.artifacts = argv[++index] ?? '';
    } else if (arg.startsWith('--artifacts=')) {
      options.artifacts = arg.slice('--artifacts='.length);
    } else if (arg === '--image') {
      options.image = argv[++index] ?? '';
    } else if (arg.startsWith('--image=')) {
      options.image = arg.slice('--image='.length);
    } else if (arg === '--port') {
      options.port = Number(argv[++index]);
    } else if (arg.startsWith('--port=')) {
      options.port = Number(arg.slice('--port='.length));
    } else if (arg === '--health-timeout') {
      options.healthTimeout = Number(argv[++index]);
    } else if (arg.startsWith('--health-timeout=')) {
      options.healthTimeout = Number(arg.slice('--health-timeout='.length));
    } else if (arg === '--open') {
      options.noOpen = false;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!['clean_linux_vm', 'clean_windows_vm', 'existing_docker', 'existing_old_onepersonlab_data_dir'].includes(options.gate)) {
    throw new Error('Missing or invalid --gate');
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error('Invalid --port');
  }
  if (!Number.isInteger(options.healthTimeout) || options.healthTimeout < 1) {
    throw new Error('Invalid --health-timeout');
  }
  if (!options.artifacts) {
    options.artifacts = path.join(appRoot, 'tmp', 'docker-webui-smoke-gates', options.gate);
  }
  return options as typeof options & { gate: GateId };
}

function printUsage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/docker-webui-smoke-gate.ts --gate <clean_linux_vm|clean_windows_vm|existing_docker|existing_old_onepersonlab_data_dir> [--artifacts <dir>] [--image <ref>] [--port <port>] [--json]

Runs a Docker/WebUI smoke gate when the current host matches the gate. If the current host cannot prove the gate, writes a typed blocker instead of passing.`);
}

function makeResult(gate: GateId, artifactDir: string): GateResult {
  const diagnosticsDir = path.join(artifactDir, 'diagnostics');
  return {
    schema: 'opl_docker_webui_smoke_gate_result.v1',
    gate_id: gate,
    status: 'failed',
    observed_at: new Date().toISOString(),
    host_platform: process.platform,
    required_environment: requiredEnvironment(gate),
    artifact_dir: artifactDir,
    diagnostics_dir: diagnosticsDir,
    commands: [],
    evidence: {},
  };
}

function requiredEnvironment(gate: GateId): string {
  switch (gate) {
    case 'clean_linux_vm':
      return 'clean Linux VM running the Bash one-click installer';
    case 'clean_windows_vm':
      return 'clean Windows VM running the PowerShell one-click installer';
    case 'existing_docker':
      return 'host with existing Docker engine reused by the one-click installer';
    case 'existing_old_onepersonlab_data_dir':
      return 'host with pre-existing OnePersonLab/data preserved by the one-click installer';
  }
}

function blocker(result: GateResult, code: string, message: string, nextAction: string): GateResult {
  return {
    ...result,
    status: 'typed_blocker',
    blocker: {
      code,
      owner: 'release_or_install_validation_operator',
      message,
      required_next_action: nextAction,
    },
  };
}

function runCommand(result: GateResult, command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const index = result.commands.length + 1;
  const stdoutPath = path.join(result.artifact_dir, `command-${index}-stdout.txt`);
  const stderrPath = path.join(result.artifact_dir, `command-${index}-stderr.txt`);
  const executed = spawnSync(command, args, { cwd, env, encoding: 'utf8' });
  fs.writeFileSync(stdoutPath, executed.stdout ?? '');
  fs.writeFileSync(stderrPath, executed.stderr ?? '');
  result.commands.push({
    command: [command, ...args].join(' '),
    status: executed.status,
    stdout_path: stdoutPath,
    stderr_path: stderrPath,
  });
  return executed.status === 0;
}

function dockerAvailable(): boolean {
  const result = spawnSync('docker', ['info'], { encoding: 'utf8' });
  return result.status === 0;
}

function writeJson(filePath: string, payload: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function runInstallGate(result: GateResult, options: ReturnType<typeof parseArgs>): GateResult {
  fs.mkdirSync(result.artifact_dir, { recursive: true });
  const home = path.join(result.artifact_dir, 'home');
  const dataDir = path.join(home, 'OnePersonLab', 'data');
  const projectsDir = path.join(home, 'OnePersonLab', 'projects');
  fs.mkdirSync(projectsDir, { recursive: true });

  if (options.gate === 'existing_old_onepersonlab_data_dir') {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'preexisting-sentinel.txt'), 'preserve me\n');
  }

  const env = {
    ...process.env,
    HOME: home,
    OPL_WEBUI_IMAGE: options.image,
    OPL_WEBUI_DATA_DIR: dataDir,
    OPL_WEBUI_PROJECTS_DIR: projectsDir,
  };
  const diagnosticsArchive = path.join(result.artifact_dir, 'diagnostics.tar.gz');
  const args = [
    path.join(appRoot, 'scripts', 'install-docker-webui.sh'),
    '--yes',
    '--port',
    String(options.port),
    '--health-timeout',
    String(options.healthTimeout),
    '--data-dir',
    dataDir,
    '--projects-dir',
    projectsDir,
    '--diagnostics-dir',
    result.diagnostics_dir,
    '--diagnostics-archive',
    diagnosticsArchive,
  ];
  if (options.noOpen) args.push('--no-open');

  const ok = runCommand(result, 'bash', args, appRoot, env);
  result.evidence.compose_yaml = path.join(home, 'OnePersonLab', 'compose.yaml');
  result.evidence.diagnostics_archive = diagnosticsArchive;
  result.evidence.data_dir = dataDir;
  result.evidence.projects_dir = projectsDir;
  if (!ok) {
    return blocker(
      result,
      'installer_smoke_command_failed',
      'The Docker/WebUI one-click installer did not complete on this host.',
      'Inspect command stdout/stderr and diagnostics, fix the installer/runtime issue, then rerun this same gate.',
    );
  }

  const validation = validateDockerWebuiDiagnostics(result.diagnostics_dir);
  result.diagnostics_validation = validation;
  if (validation.status !== 'passed') {
    result.status = 'failed';
    return result;
  }
  if (options.gate === 'existing_old_onepersonlab_data_dir' && !fs.existsSync(path.join(dataDir, 'preexisting-sentinel.txt'))) {
    return blocker(
      result,
      'old_data_sentinel_missing',
      'The old data directory sentinel was not preserved after installer startup.',
      'Treat as a data preservation regression; do not claim the old-data gate passed until fixed and rerun.',
    );
  }
  result.status = 'passed';
  return result;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const artifactDir = path.resolve(options.artifacts);
  fs.mkdirSync(artifactDir, { recursive: true });
  let result = makeResult(options.gate, artifactDir);

  if (options.gate === 'clean_windows_vm') {
    result = blocker(
      result,
      process.platform === 'win32' ? 'windows_vm_runner_not_implemented' : 'requires_windows_vm',
      'This gate must be run inside a clean Windows VM with Docker Desktop/WSL2 readiness evidence.',
      'Run scripts/install-docker-webui.ps1 -Yes in a clean Windows VM and attach the required gate artifact set.',
    );
  } else if (options.gate === 'clean_linux_vm' && process.platform !== 'linux') {
    result = blocker(
      result,
      'requires_clean_linux_vm',
      'This gate must be run inside a clean Linux VM; the current host cannot prove it.',
      'Run this script on a clean Linux VM or CI VM where Docker Engine installation/reuse can be observed.',
    );
  } else if (options.gate === 'existing_docker' && !dockerAvailable()) {
    result = blocker(
      result,
      'requires_existing_docker_engine',
      'This gate requires an already-working Docker engine before installer execution.',
      'Start Docker or run on a host with Docker already installed, then rerun the gate.',
    );
  } else if (options.gate === 'existing_old_onepersonlab_data_dir' && !dockerAvailable()) {
    result = blocker(
      result,
      'requires_docker_for_old_data_gate',
      'The old-data preservation gate requires Docker to start the WebUI container and verify preservation evidence.',
      'Run on a Docker-capable host with the old OnePersonLab/data fixture, then rerun the gate.',
    );
  } else {
    result = runInstallGate(result, options);
  }

  const resultPath = path.join(artifactDir, 'docker-webui-smoke-gate-result.json');
  writeJson(resultPath, result);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(`Docker/WebUI ${options.gate} gate: ${result.status}`);
    console.log(`Result: ${resultPath}`);
    if (result.blocker) {
      console.log(`Typed blocker: ${result.blocker.code}`);
    }
  }
  if (result.status === 'failed') {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
