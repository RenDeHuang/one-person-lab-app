import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateDockerWebuiDiagnostics } from '../../scripts/validate-docker-webui-diagnostics.ts';
import { validateDockerWebuiSmokeGateResult } from '../../scripts/docker-webui-smoke-gate.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const smokeGatePath = path.join(appRoot, 'scripts', 'docker-webui-smoke-gate.ts');

function writeCompleteDiagnostics(root: string) {
  const files = {
    'metadata.txt': 'gate=existing_docker\n',
    'diagnostics-manifest.json': JSON.stringify({ schema: 'opl_docker_webui_diagnostics_manifest.v1' }),
    'compose.yaml': 'services:\n  webui:\n    image: ghcr.io/gaofeng21cn/one-person-lab-webui:latest\n',
    'docker-version.txt': 'Docker version 27.0.0\n',
    'docker-compose-version.txt': 'Docker Compose version v2.0.0\n',
    'docker-compose-ps.txt': 'webui running\n',
    'docker-compose-logs.txt': 'ready\n',
    'docker-image.txt': 'image id sha256:abc\n',
    'http-probe.txt': 'url=http://localhost:3000/\nstatus=200\n',
    'directories.txt': 'data_dir=/tmp/data\nprojects_dir=/tmp/projects\n',
    'data-preservation.txt':
      'verdict=preserved_or_reused\n[pre_data_inventory]\nexists=true\n[post_data_inventory]\nexists=true\n',
  };
  fs.mkdirSync(root, { recursive: true });
  for (const [file, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, file), `${contents}`);
  }
}

function completeGateResult() {
  return {
    schema: 'opl_docker_webui_smoke_gate_result.v1',
    gate: 'existing_docker',
    gate_id: 'existing_docker',
    status: 'passed',
    typed_blocker: null,
    observed_at: '2026-06-30T00:00:00.000Z',
    host_platform: 'linux',
    required_environment: 'host with existing Docker engine reused by the one-click installer',
    artifact_dir: '/tmp/artifact',
    diagnostics_dir: '/tmp/artifact/diagnostics',
    diagnostics_validation: { status: 'passed' },
    health: { url: 'http://localhost:3000/', status: 'passed', http_status: 200 },
    compose: { path: '/tmp/artifact/home/OnePersonLab/compose.yaml', status: 'present' },
    container: { name: 'one-person-lab-webui', status: 'running', id: 'abc123' },
    image: { ref: 'ghcr.io/gaofeng21cn/one-person-lab-webui:latest', status: 'present', id: 'sha256:abc' },
    data_preservation: {
      status: 'passed',
      verdict: 'preserved_or_reused',
      summary: 'pre and post inventories captured',
    },
    secret_scan: { status: 'passed', forbidden_secret_markers: [] },
    commands: [],
    evidence: {},
  };
}

test('Docker/WebUI diagnostics validator fails when manifest, compose, logs, or data preservation evidence is missing', () => {
  for (const requiredFile of [
    'diagnostics-manifest.json',
    'compose.yaml',
    'docker-compose-logs.txt',
    'data-preservation.txt',
  ]) {
    const diagnostics = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-diagnostics-schema-'));
    writeCompleteDiagnostics(diagnostics);
    fs.rmSync(path.join(diagnostics, requiredFile));

    const result = validateDockerWebuiDiagnostics(diagnostics);
    assert.equal(result.status, 'failed', `${requiredFile} should fail diagnostics validation`);
    assert.ok(result.missing_files.includes(requiredFile), `${requiredFile} should be reported missing`);
  }
});

test('Docker/WebUI diagnostics validator rejects secret-like content in required files', () => {
  const diagnostics = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-diagnostics-secret-'));
  writeCompleteDiagnostics(diagnostics);
  fs.writeFileSync(path.join(diagnostics, 'docker-compose-logs.txt'), 'Bearer abcdefghijklmnopqrstuvwxyz123456\n');

  const result = validateDockerWebuiDiagnostics(diagnostics);
  assert.equal(result.status, 'failed');
  assert.ok(result.forbidden_secret_markers.some((marker) => marker.includes('Bearer')));
});

test('Docker/WebUI smoke gate result readback fails when required artifact schema fields are missing', () => {
  const valid = validateDockerWebuiSmokeGateResult(completeGateResult());
  assert.equal(valid.status, 'passed');

  for (const field of [
    'gate',
    'status',
    'typed_blocker',
    'diagnostics_validation',
    'health',
    'compose',
    'container',
    'image',
    'data_preservation',
    'secret_scan',
  ]) {
    const payload = completeGateResult() as Record<string, unknown>;
    delete payload[field];
    const result = validateDockerWebuiSmokeGateResult(payload);
    assert.equal(result.status, 'failed', `${field} should be required`);
    assert.ok(result.missing_fields.includes(field), `${field} should be reported missing`);
  }
});

test('Docker/WebUI smoke gate result readback rejects passed gates with failed health', () => {
  const payload = completeGateResult();
  payload.health = { url: 'http://localhost:3000/', status: 'failed', http_status: null };

  const result = validateDockerWebuiSmokeGateResult(payload);
  assert.equal(result.status, 'failed');
  assert.ok(result.invalid_fields.includes('health.status'));
});

test('Docker/WebUI smoke gate CLI validates uploaded gate result artifacts without running Docker', () => {
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-gate-result-'));
  const resultPath = path.join(artifactRoot, 'docker-webui-smoke-gate-result.json');
  fs.writeFileSync(resultPath, `${JSON.stringify(completeGateResult(), null, 2)}\n`);

  const valid = spawnSync(
    process.execPath,
    ['--experimental-strip-types', smokeGatePath, '--validate-result', resultPath, '--json'],
    { cwd: appRoot, encoding: 'utf8' },
  );
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
  assert.equal(JSON.parse(valid.stdout).status, 'passed');

  const invalidPayload = completeGateResult() as Record<string, unknown>;
  delete invalidPayload.secret_scan;
  fs.writeFileSync(resultPath, `${JSON.stringify(invalidPayload, null, 2)}\n`);
  const invalid = spawnSync(
    process.execPath,
    ['--experimental-strip-types', smokeGatePath, '--validate-result', resultPath, '--json'],
    { cwd: appRoot, encoding: 'utf8' },
  );
  assert.notEqual(invalid.status, 0);
  assert.ok(JSON.parse(invalid.stdout).missing_fields.includes('secret_scan'));
});
