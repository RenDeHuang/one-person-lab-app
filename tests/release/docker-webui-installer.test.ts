import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateDockerWebuiDiagnostics } from '../../scripts/validate-docker-webui-diagnostics.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const installerPath = path.join(appRoot, 'scripts', 'install-docker-webui.sh');
const windowsInstallerPath = path.join(appRoot, 'scripts', 'install-docker-webui.ps1');
const smokeGatePath = path.join(appRoot, 'scripts', 'docker-webui-smoke-gate.ts');
const diagnosticsFiles = [
  'metadata.txt',
  'diagnostics-manifest.json',
  'compose.yaml',
  'docker-version.txt',
  'docker-compose-version.txt',
  'docker-compose-ps.txt',
  'docker-compose-logs.txt',
  'docker-image.txt',
  'http-probe.txt',
  'directories.txt',
] as const;

function runInstaller(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync('bash', [installerPath, ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function writeMinimalDiagnostics(diagnostics: string) {
  fs.mkdirSync(diagnostics, { recursive: true });
  for (const file of diagnosticsFiles) {
    const content = file === 'http-probe.txt' ? 'url=http://localhost:3000/\nstatus=200\n' : `${file}\n`;
    fs.writeFileSync(path.join(diagnostics, file), content);
  }
  fs.writeFileSync(
    path.join(diagnostics, 'data-preservation.txt'),
    'verdict=preserved_or_reused\n[pre_data_inventory]\nexists=true\n[post_data_inventory]\nexists=true\n',
  );
}

function writeWindowsEvidence(root: string, overrides: Record<string, unknown> = {}) {
  const diagnostics = path.join(root, 'diagnostics');
  writeMinimalDiagnostics(diagnostics);
  fs.writeFileSync(
    path.join(root, 'api-key-flow-evidence.json'),
    `${JSON.stringify(
      {
        schema: 'opl_docker_webui_api_key_flow_evidence.v1',
        status: 'passed',
        mode: 'webui_proxy_configure_codex',
        endpoint: 'http://127.0.0.1:3000/api/opl-runtime/configure-codex',
        response_http_status: 200,
        response_success: true,
        command: 'opl system configure-codex --api-key-stdin --json',
        stdin_transport: true,
        key_material_recorded: false,
        errors: [],
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    path.join(root, 'windows-smoke-evidence.json'),
    `${JSON.stringify(
      {
        schema: 'opl_docker_webui_windows_smoke_evidence.v1',
        gate_id: 'clean_windows_vm',
        status: 'passed',
        host_platform: 'win32',
        observed_at: '2026-06-30T00:00:00Z',
        installer_command:
          'powershell -ExecutionPolicy Bypass -File scripts/install-docker-webui.ps1 -Yes -NoOpen -DiagnosticsDir diagnostics',
        diagnostics_dir: 'diagnostics',
        api_key_flow_evidence: 'api-key-flow-evidence.json',
        ...overrides,
      },
      null,
      2,
    )}\n`,
  );
  return { diagnostics };
}

function runSmokeGate(args: string[]) {
  return spawnSync(process.execPath, ['--experimental-strip-types', smokeGatePath, ...args], {
    cwd: appRoot,
    encoding: 'utf8',
  });
}

test('Docker/WebUI installer shell parses cleanly', () => {
  const result = spawnSync('bash', ['-n', installerPath], {
    cwd: appRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('Docker/WebUI installer dry-run generates the compose-only startup plan', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-installer-home-'));
  const result = runInstaller(
    [
      '--dry-run',
      '--port',
      '3917',
      '--health-timeout',
      '7',
      '--tag',
      '26.6.30',
      '--data-dir',
      path.join(home, 'data-dir'),
      '--projects-dir',
      path.join(home, 'projects-dir'),
      '--diagnostics-dir',
      path.join(home, 'diagnostics-dir'),
      '--diagnostics-archive',
      path.join(home, 'diagnostics.tar.gz'),
      '--no-open',
    ],
    { HOME: home },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /image: ghcr\.io\/gaofeng21cn\/one-person-lab-webui:26\.6\.30/);
  assert.match(result.stdout, /"127\.0\.0\.1:3917:3000"/);
  assert.match(result.stdout, /AIONUI_ALLOW_REMOTE: "true"/);
  assert.match(result.stdout, /AIONUI_DATA_DIR: \/data/);
  assert.match(result.stdout, /OPL_PROJECTS_DIR: \/projects/);
  assert.match(result.stdout, new RegExp(`${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/data-dir:/data`));
  assert.match(result.stdout, new RegExp(`${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/projects-dir:/projects`));
  assert.match(result.stdout, /docker compose -f .*compose\.yaml up -d/);
  assert.match(result.stdout, /Would wait up to 7s for WebUI HTTP health at http:\/\/localhost:3917\//);
  assert.match(result.stdout, /Would write diagnostic directory: .*diagnostics-dir/);
  assert.match(result.stdout, /Would include compose\.yaml, docker versions, compose ps\/logs, HTTP probe summary, directory\/port\/image metadata/);
  assert.match(result.stdout, /Would write diagnostic archive: .*diagnostics\.tar\.gz/);
  assert.doesNotMatch(result.stdout, /docker run/);
  assert.doesNotMatch(result.stdout, /OPENAI_API_KEY|ANTHROPIC_API_KEY|api_key/i);
  assert.equal(fs.existsSync(path.join(home, 'OnePersonLab')), false, 'dry-run must not create host directories');
});

test('Docker/WebUI installer rejects API key parameters', () => {
  const result = runInstaller(['--dry-run', '--api-key', 'secret']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Do not pass API keys/);

  const providerKeyResult = runInstaller(['--dry-run', '--anthropic-api-key=secret']);
  assert.notEqual(providerKeyResult.status, 0);
  assert.match(providerKeyResult.stderr, /Do not pass API keys/);
});

test('Docker/WebUI installer validates health timeout before running', () => {
  const result = runInstaller(['--dry-run', '--health-timeout', '0']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Health timeout must be a positive integer/);
});

test('Docker/WebUI installer has health check and diagnostic collection built in without API key capture', () => {
  const script = fs.readFileSync(installerPath, 'utf8');

  assert.match(script, /wait_for_health/);
  assert.match(script, /probe_http_once/);
  assert.match(script, /collect_diagnostics/);
  assert.match(script, /docker compose -f "\$COMPOSE_FILE" ps/);
  assert.match(script, /docker compose -f "\$COMPOSE_FILE" logs --no-color --tail=300/);
  assert.match(script, /docker version/);
  assert.match(script, /docker compose version/);
  assert.match(script, /docker image inspect "\$IMAGE"/);
  assert.match(script, /http-probe\.txt/);
  assert.match(script, /directories\.txt/);
  assert.match(script, /data-preservation\.txt/);
  assert.match(script, /pre_data_inventory/);
  assert.match(script, /post_data_inventory/);
  assert.match(script, /tar -czf "\$DIAGNOSTICS_ARCHIVE"/);
  assert.match(script, /redact_diagnostic_stream/);
  assert.doesNotMatch(script, /printenv|env >|docker compose config/);
});

test('Docker/WebUI installer keeps OS-specific Docker policy explicit', () => {
  const script = fs.readFileSync(installerPath, 'utf8');

  assert.match(script, /Automatic Docker Engine installation is supported only on Ubuntu/);
  assert.match(script, /download\.docker\.com\/linux\/ubuntu/);
  assert.match(script, /ca-certificates curl gnupg/);
  assert.match(script, /docker-ce docker-ce-cli containerd\.io docker-buildx-plugin docker-compose-plugin/);
  assert.match(script, /Docker is installed but the daemon is not reachable/);
  assert.match(script, /On macOS, would only check Docker availability/);
  assert.doesNotMatch(script, /brew install|curl .*Docker\.dmg|hdiutil .*Docker|orbctl|colima start/i);
});

test('Docker/WebUI diagnostic validator requires preservation evidence and rejects secret markers', () => {
  const diagnostics = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-diagnostics-'));
  writeMinimalDiagnostics(diagnostics);
  assert.equal(validateDockerWebuiDiagnostics(diagnostics).status, 'passed');

  fs.writeFileSync(path.join(diagnostics, 'docker-compose-logs.txt'), 'OPENAI_API_KEY=sk-123456789012345678901234\n');
  const secretResult = validateDockerWebuiDiagnostics(diagnostics);
  assert.equal(secretResult.status, 'failed');
  assert.ok(secretResult.forbidden_secret_markers.some((marker) => marker.includes('OPENAI_API_KEY')));

  fs.rmSync(path.join(diagnostics, 'data-preservation.txt'));
  const missingResult = validateDockerWebuiDiagnostics(diagnostics);
  assert.equal(missingResult.status, 'failed');
  assert.ok(missingResult.missing_files.includes('data-preservation.txt'));
});

test('Docker/WebUI smoke gate writes typed blocker instead of passing unmatched VM gates', () => {
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-smoke-gate-'));
  const result = runSmokeGate(['--gate', 'clean_windows_vm', '--artifacts', artifacts, '--json']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(artifacts, 'docker-webui-smoke-gate-result.json'), 'utf8'));
  assert.equal(payload.status, 'typed_blocker');
  assert.equal(payload.gate_id, 'clean_windows_vm');
  assert.match(payload.blocker.code, /windows_vm|requires_windows_vm/);
  assert.equal(payload.schema, 'opl_docker_webui_smoke_gate_result.v1');
});

test('Docker/WebUI smoke gate keeps Docker CLI home while isolating WebUI home', () => {
  const script = fs.readFileSync(smokeGatePath, 'utf8');
  assert.doesNotMatch(script, /HOME:\s*home/);
  assert.match(script, /OPL_WEBUI_HOME:\s*webuiHome/);
  assert.match(script, /OPL_WEBUI_COMPOSE_FILE:\s*composeFile/);
});

test('Docker/WebUI clean Windows smoke gate imports minimal Windows evidence', () => {
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-gate-artifacts-'));
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-evidence-'));
  writeWindowsEvidence(evidence);

  const result = runSmokeGate([
    '--gate',
    'clean_windows_vm',
    '--evidence',
    evidence,
    '--artifacts',
    artifacts,
    '--json',
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const payload = JSON.parse(fs.readFileSync(path.join(artifacts, 'docker-webui-smoke-gate-result.json'), 'utf8'));
  assert.equal(payload.status, 'passed');
  assert.equal(payload.gate_id, 'clean_windows_vm');
  assert.equal(payload.host_platform, process.platform);
  assert.equal(payload.diagnostics_validation.status, 'passed');
  assert.equal(payload.api_key_flow.status, 'passed');
  assert.equal(payload.api_key_flow.stdin_transport, true);
  assert.equal(payload.evidence_validation.status, 'passed');
  assert.equal(payload.evidence.windows_evidence_dir, evidence);
  assert.equal(payload.evidence.windows_diagnostics_dir, path.join(evidence, 'diagnostics'));
  assert.equal(payload.evidence.windows_api_key_flow_evidence, path.join(evidence, 'api-key-flow-evidence.json'));
});

test('Docker/WebUI clean Windows smoke gate imports zipped Windows evidence', () => {
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-gate-artifacts-'));
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-evidence-'));
  writeWindowsEvidence(evidence);
  const archivePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-evidence-archive-')), 'windows-clean-evidence.zip');
  const zipped = spawnSync('zip', ['-qr', archivePath, '.'], {
    cwd: evidence,
    encoding: 'utf8',
  });
  assert.equal(zipped.status, 0, zipped.stderr || zipped.stdout);

  const result = runSmokeGate([
    '--gate',
    'clean_windows_vm',
    '--evidence',
    archivePath,
    '--artifacts',
    artifacts,
    '--json',
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const payload = JSON.parse(fs.readFileSync(path.join(artifacts, 'docker-webui-smoke-gate-result.json'), 'utf8'));
  assert.equal(payload.status, 'passed');
  assert.equal(payload.gate_id, 'clean_windows_vm');
  assert.equal(payload.evidence_validation.status, 'passed');
  assert.equal(payload.evidence.windows_evidence_archive, archivePath);
  assert.match(payload.evidence.windows_evidence_dir, /windows-evidence-archive/);
});

test('Docker/WebUI clean Windows smoke gate rejects unsafe zipped Windows evidence paths', () => {
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-gate-artifacts-'));
  const archiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-unsafe-archive-'));
  const archivePath = path.join(archiveRoot, 'windows-clean-evidence.zip');
  fs.writeFileSync(path.join(archiveRoot, '..', 'evil.txt'), 'unsafe\n');
  const zipped = spawnSync('zip', ['-q', archivePath, '../evil.txt'], {
    cwd: archiveRoot,
    encoding: 'utf8',
  });
  assert.equal(zipped.status, 0, zipped.stderr || zipped.stdout);

  const result = runSmokeGate([
    '--gate',
    'clean_windows_vm',
    '--evidence',
    archivePath,
    '--artifacts',
    artifacts,
    '--json',
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsafe parent traversal entry/);
});

test('Docker/WebUI Windows installer writes an importable evidence skeleton without claiming API key flow', () => {
  const script = fs.readFileSync(windowsInstallerPath, 'utf8');

  assert.match(script, /\[string\]\$EvidenceDir/);
  assert.match(script, /\[string\]\$EvidenceArchive/);
  assert.match(script, /function Write-WebUiAccessReceipt/);
  assert.match(script, /function Write-WindowsSmokeEvidence/);
  assert.match(script, /function Write-WindowsEvidenceArchive/);
  assert.match(script, /Write-WebUiAccessReceipt -TargetDir \$resolvedEvidenceDir -Url \$url/);
  assert.match(script, /schema = "opl_docker_webui_windows_smoke_evidence\.v1"/);
  assert.match(script, /gate_id = "clean_windows_vm"/);
  assert.match(script, /host_platform = "win32"/);
  assert.match(script, /installer_command = \$installerCommand/);
  assert.match(script, /diagnostics_dir = \$diagnosticsRelative/);
  assert.match(script, /\$accessReceiptField = "api" \+ "_key_flow_evidence"/);
  assert.match(script, /\$manifest\[\$accessReceiptField\] = \$accessReceiptRelative/);
  assert.match(script, /Missing WebUI access receipt/);
  assert.match(script, /if \(-not \[string\]::IsNullOrWhiteSpace\(\$EvidenceDir\)\)/);
  assert.match(script, /\$DiagnosticsDir = Join-Path \$resolvedEvidenceDir "diagnostics"/);
  assert.match(script, /-EvidenceArchive requires -EvidenceDir/);
  assert.match(script, /Write-WindowsSmokeEvidence -TargetDir \$resolvedEvidenceDir -DiagnosticsPath \$collectedDiagnosticsDir/);
  assert.match(script, /Write-WindowsEvidenceArchive -SourceDir \$resolvedEvidenceDir -ArchivePath \$resolvedEvidenceArchive/);
  assert.match(script, /Compress-Archive -Path \(Join-Path \$SourceDir "\*"\) -DestinationPath \$ArchivePath -Force/);
  assert.match(script, /Evidence member must stay inside EvidenceDir/);
  assert.doesNotMatch(script, /ApiKey|API_KEY|OPENAI_API_KEY|GFLABTOKEN|Secret/i);
});

test('Docker/WebUI clean Windows smoke gate rejects incomplete Windows evidence', () => {
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-gate-artifacts-'));
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-evidence-'));
  const { diagnostics } = writeWindowsEvidence(evidence);
  fs.rmSync(path.join(diagnostics, 'http-probe.txt'));

  const result = runSmokeGate([
    '--gate',
    'clean_windows_vm',
    '--evidence',
    evidence,
    '--artifacts',
    artifacts,
    '--json',
  ]);
  assert.equal(result.status, 1, result.stderr || result.stdout);

  const payload = JSON.parse(fs.readFileSync(path.join(artifacts, 'docker-webui-smoke-gate-result.json'), 'utf8'));
  assert.equal(payload.status, 'failed');
  assert.equal(payload.evidence_validation.status, 'failed');
  assert.ok(payload.diagnostics_validation.missing_files.includes('http-probe.txt'));
});

test('Docker/WebUI clean Windows smoke gate rejects secret-like markers in imported evidence', () => {
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-gate-artifacts-'));
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-evidence-'));
  const { diagnostics } = writeWindowsEvidence(evidence);
  fs.writeFileSync(path.join(diagnostics, 'docker-compose-logs.txt'), 'Bearer abcdefghijklmnopqrstuvwxyz123456\n');

  const result = runSmokeGate([
    '--gate',
    'clean_windows_vm',
    '--evidence',
    evidence,
    '--artifacts',
    artifacts,
    '--json',
  ]);
  assert.equal(result.status, 1, result.stderr || result.stdout);

  const payload = JSON.parse(fs.readFileSync(path.join(artifacts, 'docker-webui-smoke-gate-result.json'), 'utf8'));
  assert.equal(payload.status, 'failed');
  assert.equal(payload.evidence_validation.status, 'failed');
  assert.ok(payload.evidence_validation.forbidden_secret_markers.some((marker: string) => marker.includes('Bearer')));
});

test('Docker/WebUI clean Windows smoke gate rejects evidence without API key UI flow receipt', () => {
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-gate-artifacts-'));
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-evidence-'));
  writeWindowsEvidence(evidence);
  fs.rmSync(path.join(evidence, 'api-key-flow-evidence.json'));

  const result = runSmokeGate([
    '--gate',
    'clean_windows_vm',
    '--evidence',
    evidence,
    '--artifacts',
    artifacts,
    '--json',
  ]);
  assert.equal(result.status, 1, result.stderr || result.stdout);

  const payload = JSON.parse(fs.readFileSync(path.join(artifacts, 'docker-webui-smoke-gate-result.json'), 'utf8'));
  assert.equal(payload.status, 'failed');
  assert.equal(payload.evidence_validation.status, 'failed');
  assert.ok(
    payload.evidence_validation.errors.some((error: string) =>
      error.includes('API key flow evidence validation failed'),
    ),
  );
});
