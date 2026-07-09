import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { validateDockerWebuiDiagnostics } from '../../scripts/validate-docker-webui-diagnostics.ts';
import { validateDockerWebuiSmokeGateResult } from '../../scripts/docker-webui-smoke-gate.ts';
import { appRoot } from './release-readiness/helpers.ts';

const smokeGatePath = path.join(appRoot, 'scripts', 'docker-webui-smoke-gate.ts');
const webuiImageRef = 'ghcr.io/gaofeng21cn/one-person-lab-webui:stable';
const imageDigest = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const remoteImageDigest = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function repoDigest(digest = imageDigest) {
  return `ghcr.io/gaofeng21cn/one-person-lab-webui@${digest}`;
}

function imageIdentity(fields: Record<string, unknown> = {}) {
  return {
    repo_digests: [repoDigest()],
    digest: imageDigest,
    remote_ref: null,
    remote_digest: null,
    currentness_status: 'not_checked',
    currentness_evidence_source: null,
    currentness_claim: false,
    ...fields,
  };
}

function ordinaryUserStep(summary: string, evidence_ref: string, next_action: string | null = null) {
  return { status: 'passed', summary, next_action, evidence_ref };
}

function ordinaryUserStatus() {
  const steps: Array<[string, string, string, string?]> = [
    ['one_click_install', 'One-click installer creates compose.yaml, host data/projects directories, and starts the WebUI image.', '/tmp/artifact/home/OnePersonLab/compose.yaml'],
    ['browser_webui', 'Open the browser WebUI at http://localhost:3000/.', '/tmp/artifact/diagnostics/http-probe.txt'],
    ['access_key_settings', 'Access keys are entered in the WebUI first-run Access panel or Settings -> Access.', '/tmp/artifact/api-key-flow-evidence.json'],
    ['runtime_proxy', 'The WebUI runtime proxy calls /api/opl-runtime/configure-codex and forwards the key through stdin transport.', '/tmp/artifact/api-key-flow-evidence.json'],
    ['startup_recovery', 'Startup diagnostics are redacted and show what to retry or repair for Docker, port, image, or data issues.', '/tmp/artifact/diagnostics'],
    ['data_preservation', 'Host OnePersonLab/data and OnePersonLab/projects stay mounted and preserved across image/container replacement.', '/tmp/artifact/diagnostics/data-preservation.txt'],
    ['host_update', 'Host updates rerun the installer or explicit update mode to pull the WebUI image and recreate the compose service.', '/tmp/artifact/home/OnePersonLab/compose.yaml', 'Use install-docker-webui.sh --update or install-docker-webui.ps1 -Update when the host image should be updated.'],
  ];
  return Object.fromEntries(
    steps.map(([key, summary, evidenceRef, nextAction]) => [
      key,
      ordinaryUserStep(summary, evidenceRef, nextAction ?? null),
    ]),
  );
}

function runSmokeGateValidation(resultPath: string) {
  const args = ['--experimental-strip-types', smokeGatePath, '--validate-result', resultPath, '--json'];
  return spawnSync(process.execPath, args, { cwd: appRoot, encoding: 'utf8' });
}

function writeCompleteDiagnostics(root: string) {
  const files = {
    'metadata.txt': 'gate=existing_docker\n',
    'diagnostics-manifest.json': JSON.stringify({ schema: 'opl_docker_webui_diagnostics_manifest.v1' }),
    'compose.yaml': [
      'services:',
      '  webui:',
      `    image: ${webuiImageRef}`,
      '    environment:',
      '      AIONUI_DATA_DIR: /data',
      '      OPL_PROJECTS_DIR: /projects',
      '    volumes:',
      '      - "/tmp/data:/data"',
      '      - "/tmp/projects:/projects"',
      '',
    ].join('\n'),
    'docker-version.txt': 'Docker version 27.0.0\n',
    'docker-compose-version.txt': 'Docker Compose version v2.0.0\n',
    'docker-compose-ps.txt': 'webui running\n',
    'docker-compose-logs.txt': 'ready\n',
    'docker-image.txt': JSON.stringify([
      {
        Id: imageDigest,
        RepoDigests: [repoDigest()],
      },
    ]),
    'http-probe.txt': 'url=http://localhost:3000/\nstatus=200\n',
    'directories.txt': 'data_dir=/tmp/data\nprojects_dir=/tmp/projects\n',
    'data-preservation.txt':
      'verdict=preserved_or_reused\n[pre_data_inventory]\nexists=true\n[post_data_inventory]\nexists=true\n[pre_projects_inventory]\nexists=true\n[post_projects_inventory]\nexists=true\n',
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
    diagnostics_validation: {
      status: 'passed',
      compose_volume_mapping: {
        status: 'passed',
        required_mounts: ['host_data_dir -> /data', 'host_projects_dir -> /projects'],
        missing_mounts: [],
      },
      preservation_evidence: {
        status: 'passed',
        required_sections: [
          'pre_data_inventory',
          'post_data_inventory',
          'pre_projects_inventory',
          'post_projects_inventory',
        ],
        missing_sections: [],
      },
      image_identity: {
        status: 'passed',
        image_id: imageDigest,
        ...imageIdentity(),
      },
    },
    health: { url: 'http://localhost:3000/', status: 'passed', http_status: 200 },
    compose: { path: '/tmp/artifact/home/OnePersonLab/compose.yaml', status: 'present' },
    container: { name: 'one-person-lab-webui', status: 'running', id: 'abc123' },
    image: {
      ref: webuiImageRef,
      status: 'present',
      id: imageDigest,
      ...imageIdentity(),
    },
    data_preservation: {
      status: 'passed',
      verdict: 'preserved_or_reused',
      summary: 'pre and post inventories captured',
    },
    api_key_flow: {
      status: 'passed',
      mode: 'webui_proxy_configure_codex',
      endpoint: 'http://127.0.0.1:3000/api/opl-runtime/configure-codex',
      command: 'opl system configure-codex --api-key-stdin --json',
      stdin_transport: true,
      receipt_path: '/tmp/artifact/api-key-flow-evidence.json',
      errors: [],
    },
    ordinary_user_status: {
      path_id: 'ordinary_docker_webui_user_path',
      priority: 'ordinary_user_path_before_evidence_bundle_language',
      ...ordinaryUserStatus(),
      image_seed_selection: 'Default stable image must use the WebUI full seed; --tag/--image are explicit advanced overrides.',
      settings_entry: 'Settings -> Access',
      must_not_claim: [
        'desktop_release_ready',
        'real_install_ready',
        'clean_windows_vm_pass_without_clean_windows_evidence',
        'release_ready',
      ],
    },
    secret_scan: { status: 'passed', forbidden_secret_markers: [] },
    commands: [],
    evidence: {},
  };
}

function expectInvalidSmokeGateResult(mutator: (payload: any) => void, invalidFields: string[]) {
  const payload = completeGateResult();
  mutator(payload);

  const result = validateDockerWebuiSmokeGateResult(payload);
  assert.equal(result.status, 'failed');
  for (const field of invalidFields) {
    assert.ok(result.invalid_fields.includes(field));
  }
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

test('Docker/WebUI diagnostics validator requires compose mounts, preservation inventories, and image digest identity', () => {
  const diagnostics = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-diagnostics-proof-'));
  writeCompleteDiagnostics(diagnostics);
  assert.equal(validateDockerWebuiDiagnostics(diagnostics).status, 'passed');

  fs.writeFileSync(
    path.join(diagnostics, 'compose.yaml'),
    'services:\n  webui:\n    image: ghcr.io/gaofeng21cn/one-person-lab-webui:stable\n',
  );
  const missingMounts = validateDockerWebuiDiagnostics(diagnostics);
  assert.equal(missingMounts.status, 'failed');
  assert.ok(missingMounts.invalid_evidence.includes('compose.yaml:host_data_dir -> /data'));
  assert.ok(missingMounts.invalid_evidence.includes('compose.yaml:host_projects_dir -> /projects'));

  writeCompleteDiagnostics(diagnostics);
  fs.writeFileSync(
    path.join(diagnostics, 'data-preservation.txt'),
    'verdict=preserved_or_reused\n[pre_data_inventory]\nexists=true\n[post_data_inventory]\nexists=true\n',
  );
  const missingProjectsInventory = validateDockerWebuiDiagnostics(diagnostics);
  assert.equal(missingProjectsInventory.status, 'failed');
  assert.ok(missingProjectsInventory.invalid_evidence.includes('data-preservation.txt:pre_projects_inventory'));
  assert.ok(missingProjectsInventory.invalid_evidence.includes('data-preservation.txt:post_projects_inventory'));

  writeCompleteDiagnostics(diagnostics);
  fs.writeFileSync(path.join(diagnostics, 'docker-image.txt'), JSON.stringify([{ Id: 'sha256:not-a-real-digest' }]));
  const missingDigest = validateDockerWebuiDiagnostics(diagnostics);
  assert.equal(missingDigest.status, 'failed');
  assert.ok(missingDigest.invalid_evidence.includes('docker-image.txt:image_digest'));
  assert.equal(missingDigest.image_identity.currentness_claim, false);
});

test('Docker/WebUI diagnostics validator treats remote image currentness as optional status-only evidence', () => {
  const diagnostics = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-diagnostics-currentness-'));
  writeCompleteDiagnostics(diagnostics);

  const notChecked = validateDockerWebuiDiagnostics(diagnostics);
  assert.equal(notChecked.status, 'passed');
  assert.equal(notChecked.image_identity.digest, imageDigest);
  assert.equal(notChecked.image_identity.remote_digest, null);
  assert.equal(notChecked.image_identity.currentness_status, 'not_checked');
  assert.equal(notChecked.image_identity.currentness_claim, false);

  fs.writeFileSync(
    path.join(diagnostics, 'remote-image-digest.txt'),
    `remote_ref=ghcr.io/gaofeng21cn/one-person-lab-webui:stable\nremote_digest=${remoteImageDigest}\n`,
  );
  const updateAvailable = validateDockerWebuiDiagnostics(diagnostics);
  assert.equal(updateAvailable.status, 'passed');
  assert.equal(updateAvailable.image_identity.remote_digest, remoteImageDigest);
  assert.equal(updateAvailable.image_identity.currentness_status, 'update_available');
  assert.equal(updateAvailable.image_identity.currentness_evidence_source, 'remote-image-digest.txt');
  assert.equal(updateAvailable.image_identity.currentness_claim, false);
});

test('Docker/WebUI diagnostics validator accepts Docker inspect capture output with a command prefix', () => {
  const diagnostics = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-diagnostics-image-capture-'));
  writeCompleteDiagnostics(diagnostics);
  fs.writeFileSync(
    path.join(diagnostics, 'docker-image.txt'),
    [
      '$ docker image inspect ghcr.io/gaofeng21cn/one-person-lab-webui:stable',
      JSON.stringify(
        [
          {
            Id: imageDigest,
            RepoDigests: [repoDigest()],
          },
        ],
        null,
        2,
      ),
      '',
    ].join('\n'),
  );

  const result = validateDockerWebuiDiagnostics(diagnostics);
  assert.equal(result.status, 'passed');
  assert.equal(result.image_identity.image_id, imageDigest);
  assert.deepEqual(result.image_identity.repo_digests, [repoDigest()]);
  assert.equal(result.image_identity.digest, imageDigest);
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
    'api_key_flow',
    'ordinary_user_status',
    'secret_scan',
  ]) {
    const payload = completeGateResult() as Record<string, unknown>;
    delete payload[field];
    const result = validateDockerWebuiSmokeGateResult(payload);
    assert.equal(result.status, 'failed', `${field} should be required`);
    assert.ok(result.missing_fields.includes(field), `${field} should be reported missing`);
  }
});

for (const { name, mutate, invalidFields } of [
  {
    name: 'without API key stdin flow evidence',
    mutate(payload: any) {
      payload.api_key_flow = {
        status: 'failed',
        mode: 'webui_proxy_configure_codex',
        endpoint: 'http://127.0.0.1:3000/api/opl-runtime/configure-codex',
        command: 'opl system configure-codex --api-key-stdin --json',
        stdin_transport: false,
        receipt_path: '/tmp/artifact/api-key-flow-evidence.json',
        errors: ['missing stdin transport'],
      };
    },
    invalidFields: ['api_key_flow.status', 'api_key_flow.stdin_transport'],
  },
  {
    name: 'with failed health',
    mutate(payload: any) {
      payload.health = { url: 'http://localhost:3000/', status: 'failed', http_status: null };
    },
    invalidFields: ['health.status'],
  },
]) {
  test(`Docker/WebUI smoke gate result readback rejects passed gates ${name}`, () => {
    expectInvalidSmokeGateResult(mutate, invalidFields);
  });
}

test('Docker/WebUI smoke gate result readback rejects passed gates without image digest identity', () => {
  const payload = completeGateResult();
  payload.image.digest = null;

  const result = validateDockerWebuiSmokeGateResult(payload);
  assert.equal(result.status, 'failed');
  assert.ok(result.invalid_fields.includes('image.digest'));

  payload.image.digest = imageDigest;
  payload.image.currentness_claim = true;
  const falseCurrentness = validateDockerWebuiSmokeGateResult(payload);
  assert.equal(falseCurrentness.status, 'failed');
  assert.ok(falseCurrentness.invalid_fields.includes('image.currentness_claim'));
});

test('Docker/WebUI smoke gate result readback accepts remote currentness comparison only as status readback', () => {
  const payload = completeGateResult();
  payload.image.remote_ref = 'ghcr.io/gaofeng21cn/one-person-lab-webui:stable';
  payload.image.remote_digest = remoteImageDigest;
  payload.image.currentness_status = 'update_available';
  payload.image.currentness_evidence_source = 'remote-image-digest.txt';
  payload.diagnostics_validation.image_identity.remote_ref = payload.image.remote_ref;
  payload.diagnostics_validation.image_identity.remote_digest = remoteImageDigest;
  payload.diagnostics_validation.image_identity.currentness_status = 'update_available';
  payload.diagnostics_validation.image_identity.currentness_evidence_source = 'remote-image-digest.txt';

  const result = validateDockerWebuiSmokeGateResult(payload);
  assert.equal(result.status, 'passed');

  payload.image.currentness_claim = true;
  const claimed = validateDockerWebuiSmokeGateResult(payload);
  assert.equal(claimed.status, 'failed');
  assert.ok(claimed.invalid_fields.includes('image.currentness_claim'));
});

for (const { name, mutate, invalidFields } of [
  {
    name: 'without diagnostics proof fields',
    mutate(payload: any) {
      payload.diagnostics_validation = { status: 'passed' };
    },
    invalidFields: [
      'diagnostics_validation.compose_volume_mapping.status',
      'diagnostics_validation.preservation_evidence.status',
      'diagnostics_validation.image_identity.digest',
    ],
  },
  {
    name: 'without ordinary user path status',
    mutate(payload: any) {
      payload.ordinary_user_status.browser_webui.status = 'not_run';
      payload.ordinary_user_status.must_not_claim = ['release_ready'];
    },
    invalidFields: ['ordinary_user_status.browser_webui.status', 'ordinary_user_status.must_not_claim.desktop_release_ready'],
  },
]) {
  test(`Docker/WebUI smoke gate result readback rejects passed gates ${name}`, () => {
    expectInvalidSmokeGateResult(mutate, invalidFields);
  });
}

test('Docker/WebUI smoke gate CLI validates uploaded gate result artifacts without running Docker', () => {
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-gate-result-'));
  const resultPath = path.join(artifactRoot, 'docker-webui-smoke-gate-result.json');
  fs.writeFileSync(resultPath, `${JSON.stringify(completeGateResult(), null, 2)}\n`);

  const valid = runSmokeGateValidation(resultPath);
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
  assert.equal(JSON.parse(valid.stdout).status, 'passed');

  const invalidPayload = completeGateResult() as Record<string, unknown>;
  delete invalidPayload.secret_scan;
  fs.writeFileSync(resultPath, `${JSON.stringify(invalidPayload, null, 2)}\n`);
  const invalid = runSmokeGateValidation(resultPath);
  assert.notEqual(invalid.status, 0);
  assert.ok(JSON.parse(invalid.stdout).missing_fields.includes('secret_scan'));
});
