import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import {
  buildSourceQualificationReceipt,
  sourceQualificationReceiptDigest,
  validateSourceQualificationReceipt,
  type SourceQualificationBuildInput,
} from '../../scripts/source-qualification-receipt.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');
const appSha = '1'.repeat(40);
const shellSha = '2'.repeat(40);
const frameworkSha = '3'.repeat(40);
const settingsPages = [
  'general',
  'environment',
  'capabilities',
  'access',
  'appearance',
  'diagnostics',
  'about',
  'runtime-settings-alias',
  'runtime-status',
];

function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-source-qualification-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = {
    dmg: path.join(root, 'One-Person-Lab-26.7.26-mac-arm64.dmg'),
    command: path.join(root, 'command-manifest.json'),
    cohort: path.join(root, 'source-qualification-cohort.json'),
    build: path.join(root, 'opl-build-cohort.json'),
    smoke: path.join(root, 'tart-smoke-summary.json'),
    closeout: path.join(root, 'vm-closeout.json'),
  };
  fs.writeFileSync(files.dmg, 'local diagnostic dmg');
  writeJson(files.command, {
    schema: 'opl_source_qualification_command_manifest.v1',
    build_invocation_count: 1,
    tart_vm_invocation_count: 1,
  });
  writeJson(files.cohort, {
    schema: 'opl_source_qualification_cohort.v1',
    cohort: {
      app: { sha: appSha, tree: '4'.repeat(40) },
      shell: { sha: shellSha, tree: '5'.repeat(40) },
      framework: { sha: frameworkSha, tree: '6'.repeat(40) },
    },
    dmg: {
      sha256: 'sha256:3508613289080788680fe5a24f68028a3a593ff94769fd5c0c155937b8864251',
    },
  });
  writeJson(files.build, {
    schema: 'opl_app_build_artifact_cohort.v2',
    cohort: { app_sha: appSha, shell_sha: shellSha, framework_sha: frameworkSha },
  });
  writeJson(files.smoke, {
    status: 'passed',
    runtime_profile: 'standard',
    settings_smoke: {
      status: 'passed',
      pages: settingsPages,
    },
    assistant_route_smoke: { status: 'passed', assistants: ['mas', 'mag', 'rca'] },
    vm_cleanup: { status: 'passed', inspection: { state: 'absent' } },
  });
  writeJson(files.closeout, { target_vm_state: 'absent', source_vm_state: 'stopped' });
  const dmgDigest = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(files.dmg)).digest('hex')}`;
  const cohort = JSON.parse(fs.readFileSync(files.cohort, 'utf8'));
  cohort.dmg.sha256 = dmgDigest;
  writeJson(files.cohort, cohort);
  return { root, files };
}

function input(files: ReturnType<typeof fixture>['files']): SourceQualificationBuildInput {
  return {
    completedAt: '2026-07-26T01:00:00.000Z',
    runId: '30180000001',
    runAttempt: 1,
    repository: 'gaofeng21cn/one-person-lab-app',
    workflow: '.github/workflows/release-source-qualification.yml',
    event: 'workflow_dispatch',
    ref: 'refs/heads/main',
    headSha: appSha,
    runnerLabels: ['opl-gui-vm', 'macOS', 'self-hosted', 'ARM64'],
    cohort: {
      app: { sha: appSha, tree: '4'.repeat(40) },
      shell: { sha: shellSha, tree: '5'.repeat(40) },
      framework: { sha: frameworkSha, tree: '6'.repeat(40) },
    },
    dmgPath: files.dmg,
    commandManifestPath: files.command,
    cohortManifestPath: files.cohort,
    buildCohortPath: files.build,
    smokeSummaryPath: files.smoke,
    vmCloseoutPath: files.closeout,
    workflowPaths: [
      '.github/workflows/release-source-qualification.yml',
      'contracts/app-source-qualification-receipt.schema.json',
      'scripts/source-qualification-receipt.ts',
      'scripts/validate-source-qualification-receipt.ts',
    ],
    appRoot,
  };
}

test('source qualification receipt binds one build, one Tart VM, exact cohort, and non-authority', (t) => {
  const { files } = fixture(t);
  const receipt = buildSourceQualificationReceipt(input(files));
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.execution.head_sha, appSha);
  assert.equal(receipt.qualification.build_invocation_count, 1);
  assert.equal(receipt.qualification.tart_vm_invocation_count, 1);
  assert.deepEqual(receipt.qualification.settings_pages, settingsPages);
  assert.equal(receipt.authority.release_authority, false);
  assert.equal(receipt.authority.namespace_reservation, false);
  assert.equal(receipt.authority.final_signed_byte_authority, false);
  const { receipt_digest: digest, ...core } = receipt;
  assert.equal(digest, sourceQualificationReceiptDigest(core));
  assert.equal(validateSourceQualificationReceipt(receipt, { digest, runId: '30180000001', headSha: appSha }), receipt);
});

test('source qualification requires the exact nine-page settings order', (t) => {
  const { files } = fixture(t);
  const receipt = buildSourceQualificationReceipt(input(files));
  assert.deepEqual(receipt.qualification.settings_pages, settingsPages);

  const smoke = JSON.parse(fs.readFileSync(files.smoke, 'utf8'));
  smoke.settings_smoke.pages = settingsPages.filter((page) => page !== 'runtime-settings-alias');
  writeJson(files.smoke, smoke);
  assert.throws(() => buildSourceQualificationReceipt(input(files)), /exact contracted entries/);

  smoke.settings_smoke.pages = [...settingsPages];
  [smoke.settings_smoke.pages[7], smoke.settings_smoke.pages[8]] = [
    smoke.settings_smoke.pages[8],
    smoke.settings_smoke.pages[7],
  ];
  writeJson(files.smoke, smoke);
  assert.throws(() => buildSourceQualificationReceipt(input(files)), /exact contracted order/);

  const wrongOrderReceipt = structuredClone(receipt);
  [wrongOrderReceipt.qualification.settings_pages[7], wrongOrderReceipt.qualification.settings_pages[8]] = [
    wrongOrderReceipt.qualification.settings_pages[8],
    wrongOrderReceipt.qualification.settings_pages[7],
  ];
  const { receipt_digest: _ignored, ...core } = wrongOrderReceipt;
  wrongOrderReceipt.receipt_digest = sourceQualificationReceiptDigest(core);
  assert.throws(() => validateSourceQualificationReceipt(wrongOrderReceipt), /exact contracted order/);
});

test('source qualification rejects reruns, cross-cohort manifests, duplicate operation counts, and incomplete VM cleanup', (t) => {
  const { files } = fixture(t);
  assert.throws(() => buildSourceQualificationReceipt({ ...input(files), runAttempt: 2 }), /attempt 1/);

  const command = JSON.parse(fs.readFileSync(files.command, 'utf8'));
  command.build_invocation_count = 2;
  writeJson(files.command, command);
  assert.throws(() => buildSourceQualificationReceipt(input(files)), /exactly one build/);
  command.build_invocation_count = 1;
  writeJson(files.command, command);

  const cohort = JSON.parse(fs.readFileSync(files.cohort, 'utf8'));
  cohort.cohort.shell.sha = 'f'.repeat(40);
  writeJson(files.cohort, cohort);
  assert.throws(() => buildSourceQualificationReceipt(input(files)), /drifted at shell/);
  cohort.cohort.shell.sha = shellSha;
  writeJson(files.cohort, cohort);

  writeJson(files.closeout, { target_vm_state: 'present', source_vm_state: 'stopped' });
  assert.throws(() => buildSourceQualificationReceipt(input(files)), /VM closeout is incomplete/);
});

test('source qualification validation rejects digest drift and any release authority escalation', (t) => {
  const { files } = fixture(t);
  const receipt = buildSourceQualificationReceipt(input(files));
  const digestDrift = structuredClone(receipt);
  digestDrift.artifact.size_bytes += 1;
  assert.throws(() => validateSourceQualificationReceipt(digestDrift), /digest is invalid/);

  const authorityDrift = structuredClone(receipt) as any;
  authorityDrift.authority.release_authority = true;
  const { receipt_digest: _ignored, ...core } = authorityDrift;
  authorityDrift.receipt_digest = sourceQualificationReceiptDigest(core);
  assert.throws(() => validateSourceQualificationReceipt(authorityDrift), /non-authoritative/);
});
