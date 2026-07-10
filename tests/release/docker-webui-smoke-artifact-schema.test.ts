import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { validateDockerWebuiDiagnostics } from '../../scripts/validate-docker-webui-diagnostics.ts';
import { validateDockerWebuiSmokeGateResult } from '../../scripts/docker-webui-smoke-gate.ts';
import { appRoot } from './release-readiness/helpers.ts';
import {
  dockerWebuiImageDigest as imageDigest,
  dockerWebuiRepoDigest as repoDigest,
  writeDockerWebuiDiagnostics,
} from './docker-webui-fixtures.ts';

const smokeGatePath = path.join(appRoot, 'scripts', 'docker-webui-smoke-gate.ts');
const remoteImageDigest = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

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
  const ids = ['one_click_install', 'browser_webui', 'access_key_settings', 'runtime_proxy', 'startup_recovery', 'data_preservation', 'host_update'];
  return Object.fromEntries(ids.map((key) => [key, ordinaryUserStep(key, `/tmp/artifact/${key}`)]));
}

function runSmokeGateValidation(resultPath: string) {
  const args = ['--experimental-strip-types', smokeGatePath, '--validate-result', resultPath, '--json'];
  return spawnSync(process.execPath, args, { cwd: appRoot, encoding: 'utf8' });
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
      compose_volume_mapping: { status: 'passed' },
      preservation_evidence: { status: 'passed' },
      image_identity: { status: 'passed', ...imageIdentity() },
    },
    health: { status: 'passed' },
    compose: { status: 'present' },
    container: {},
    image: { status: 'present', ...imageIdentity() },
    data_preservation: { status: 'passed' },
    api_key_flow: { status: 'passed', stdin_transport: true },
    ordinary_user_status: {
      path_id: 'ordinary_docker_webui_user_path',
      priority: 'ordinary_user_path_before_evidence_bundle_language',
      ...ordinaryUserStatus(),
      image_seed_selection: 'Default stable image must use the WebUI full seed; --tag/--image are explicit advanced overrides.',
      settings_entry: 'Settings -> Access',
      must_not_claim: ['desktop_release_ready', 'real_install_ready', 'clean_windows_vm_pass_without_clean_windows_evidence', 'release_ready'],
    },
    secret_scan: { status: 'passed' },
    commands: [],
    evidence: {},
  };
}

function expectInvalidSmokeGateResult(mutator: (payload: any) => void, invalidFields: string[]) {
  const payload = completeGateResult();
  mutator(payload);

  const result = validateDockerWebuiSmokeGateResult(payload);
  assert.equal(result.status, 'failed');
  for (const field of invalidFields) assert.ok(result.invalid_fields.includes(field));
}

test('Docker/WebUI diagnostics validator fails when manifest, compose, logs, or data preservation evidence is missing', () => {
  for (const requiredFile of [
    'diagnostics-manifest.json',
    'compose.yaml',
    'docker-compose-logs.txt',
    'data-preservation.txt',
  ]) {
    const diagnostics = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-diagnostics-schema-'));
    writeDockerWebuiDiagnostics(diagnostics);
    fs.rmSync(path.join(diagnostics, requiredFile));

    const result = validateDockerWebuiDiagnostics(diagnostics);
    assert.equal(result.status, 'failed', `${requiredFile} should fail diagnostics validation`);
    assert.ok(result.missing_files.includes(requiredFile), `${requiredFile} should be reported missing`);
  }
});

test('Docker/WebUI diagnostics validator rejects secret-like content in required files', () => {
  const diagnostics = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-diagnostics-secret-'));
  writeDockerWebuiDiagnostics(diagnostics);
  fs.writeFileSync(path.join(diagnostics, 'docker-compose-logs.txt'), 'Bearer abcdefghijklmnopqrstuvwxyz123456\n');

  const result = validateDockerWebuiDiagnostics(diagnostics);
  assert.equal(result.status, 'failed');
  assert.ok(result.forbidden_secret_markers.some((marker) => marker.includes('Bearer')));
});

test('Docker/WebUI diagnostics validator requires compose mounts, preservation inventories, and image digest identity', () => {
  const baseline = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-diagnostics-proof-'));
  writeDockerWebuiDiagnostics(baseline);
  assert.equal(validateDockerWebuiDiagnostics(baseline).status, 'passed');

  for (const { file, content, invalidEvidence } of [
    {
      file: 'compose.yaml',
      content: 'services:\n  webui:\n    image: ghcr.io/gaofeng21cn/one-person-lab-webui:stable\n',
      invalidEvidence: ['compose.yaml:host_data_dir -> /data', 'compose.yaml:host_projects_dir -> /projects'],
    },
    {
      file: 'data-preservation.txt',
      content: 'verdict=preserved_or_reused\n[pre_data_inventory]\nexists=true\n[post_data_inventory]\nexists=true\n',
      invalidEvidence: [
        'data-preservation.txt:pre_projects_inventory',
        'data-preservation.txt:post_projects_inventory',
      ],
    },
    {
      file: 'docker-image.txt',
      content: JSON.stringify([{ Id: 'sha256:not-a-real-digest' }]),
      invalidEvidence: ['docker-image.txt:image_digest'],
    },
  ]) {
    const diagnostics = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-diagnostics-proof-'));
    writeDockerWebuiDiagnostics(diagnostics);
    fs.writeFileSync(path.join(diagnostics, file), content);
    const result = validateDockerWebuiDiagnostics(diagnostics);
    assert.equal(result.status, 'failed');
    for (const evidence of invalidEvidence) assert.ok(result.invalid_evidence.includes(evidence));
    if (file === 'docker-image.txt') assert.equal(result.image_identity.currentness_claim, false);
  }
});

test('Docker/WebUI diagnostics validator treats remote image currentness as optional status-only evidence', () => {
  const diagnostics = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-diagnostics-currentness-'));
  writeDockerWebuiDiagnostics(diagnostics);

  const notChecked = validateDockerWebuiDiagnostics(diagnostics);
  assert.deepEqual({
    status: notChecked.status,
    digest: notChecked.image_identity.digest,
    remote_digest: notChecked.image_identity.remote_digest,
    currentness_status: notChecked.image_identity.currentness_status,
    currentness_claim: notChecked.image_identity.currentness_claim,
  }, { status: 'passed', digest: imageDigest, remote_digest: null, currentness_status: 'not_checked', currentness_claim: false });

  fs.writeFileSync(
    path.join(diagnostics, 'remote-image-digest.txt'),
    `remote_ref=ghcr.io/gaofeng21cn/one-person-lab-webui:stable\nremote_digest=${remoteImageDigest}\n`,
  );
  const updateAvailable = validateDockerWebuiDiagnostics(diagnostics);
  assert.deepEqual({
    status: updateAvailable.status,
    remote_digest: updateAvailable.image_identity.remote_digest,
    currentness_status: updateAvailable.image_identity.currentness_status,
    source: updateAvailable.image_identity.currentness_evidence_source,
    currentness_claim: updateAvailable.image_identity.currentness_claim,
  }, { status: 'passed', remote_digest: remoteImageDigest, currentness_status: 'update_available', source: 'remote-image-digest.txt', currentness_claim: false });
});

test('Docker/WebUI diagnostics validator accepts Docker inspect capture output with a command prefix', () => {
  const diagnostics = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-diagnostics-image-capture-'));
  writeDockerWebuiDiagnostics(diagnostics);
  const inspect = [{
    Id: imageDigest,
    RepoTags: ['ghcr.io/gaofeng21cn/one-person-lab-webui:stable'],
    RepoDigests: [repoDigest()],
    Architecture: 'arm64',
    Os: 'linux',
  }];
  fs.writeFileSync(
    path.join(diagnostics, 'docker-image.txt'),
    [
      '$ docker image inspect ghcr.io/gaofeng21cn/one-person-lab-webui:stable',
      JSON.stringify(inspect, null, 2),
      '',
    ].join('\n'),
  );

  const result = validateDockerWebuiDiagnostics(diagnostics);
  assert.deepEqual({
    status: result.status,
    image_id: result.image_identity.image_id,
    repo_digests: result.image_identity.repo_digests,
    digest: result.image_identity.digest,
    currentness_claim: result.image_identity.currentness_claim,
  }, {
    status: 'passed',
    image_id: imageDigest,
    repo_digests: [repoDigest()],
    digest: imageDigest,
    currentness_claim: false,
  });
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

const invalidGateCases = [
  {
    name: 'without API key stdin flow evidence',
    mutate(payload: any) {
      payload.api_key_flow = { status: 'failed', stdin_transport: false };
    },
    invalidFields: ['api_key_flow.status', 'api_key_flow.stdin_transport'],
  },
  {
    name: 'with failed health',
    mutate(payload: any) { payload.health = { status: 'failed' }; },
    invalidFields: ['health.status'],
  },
  {
    name: 'without image digest identity',
    mutate(payload: any) { payload.image.digest = null; },
    invalidFields: ['image.digest'],
  },
  {
    name: 'with an unsupported currentness claim',
    mutate(payload: any) { payload.image.currentness_claim = true; },
    invalidFields: ['image.currentness_claim'],
  },
  {
    name: 'without diagnostics proof fields',
    mutate(payload: any) { payload.diagnostics_validation = { status: 'passed' }; },
    invalidFields: [
      'diagnostics_validation.compose_volume_mapping.status',
      'diagnostics_validation.preservation_evidence.status',
      'diagnostics_validation.image_identity.digest',
    ],
  },
  {
    name: 'without stable image seed selection',
    mutate(payload: any) { delete payload.ordinary_user_status.image_seed_selection; },
    invalidFields: ['ordinary_user_status.image_seed_selection'],
  },
  {
    name: 'without ordinary user path status',
    mutate(payload: any) {
      payload.ordinary_user_status.browser_webui.status = 'not_run';
      payload.ordinary_user_status.must_not_claim = ['release_ready'];
    },
    invalidFields: [
      'ordinary_user_status.browser_webui.status',
      'ordinary_user_status.must_not_claim.desktop_release_ready',
    ],
  },
];

for (const { name, mutate, invalidFields } of invalidGateCases) {
  test(`Docker/WebUI smoke gate result readback rejects passed gates ${name}`, () => {
    expectInvalidSmokeGateResult(mutate, invalidFields);
  });
}

test('Docker/WebUI smoke gate result readback accepts remote currentness comparison only as status readback', () => {
  const payload = completeGateResult();
  const currentness = {
    remote_ref: 'ghcr.io/gaofeng21cn/one-person-lab-webui:stable',
    remote_digest: remoteImageDigest,
    currentness_status: 'update_available',
    currentness_evidence_source: 'remote-image-digest.txt',
  };
  Object.assign(payload.image, currentness);
  Object.assign(payload.diagnostics_validation.image_identity, currentness);

  const result = validateDockerWebuiSmokeGateResult(payload);
  assert.equal(result.status, 'passed');

  payload.image.currentness_claim = true;
  const claimed = validateDockerWebuiSmokeGateResult(payload);
  assert.equal(claimed.status, 'failed');
  assert.ok(claimed.invalid_fields.includes('image.currentness_claim'));
});

test('Docker/WebUI smoke gate CLI validates uploaded gate result artifacts without running Docker', () => {
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-gate-result-'));
  const resultPath = path.join(artifactRoot, 'docker-webui-smoke-gate-result.json');
  fs.writeFileSync(resultPath, JSON.stringify(completeGateResult()));

  const valid = runSmokeGateValidation(resultPath);
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
  assert.equal(JSON.parse(valid.stdout).status, 'passed');

  const invalidPayload = completeGateResult() as Record<string, unknown>;
  delete invalidPayload.secret_scan;
  fs.writeFileSync(resultPath, JSON.stringify(invalidPayload));
  const invalid = runSmokeGateValidation(resultPath);
  assert.notEqual(invalid.status, 0);
  assert.ok(JSON.parse(invalid.stdout).missing_fields.includes('secret_scan'));
});
