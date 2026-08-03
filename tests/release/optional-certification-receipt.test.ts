import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  projectOptionalCertificationStatus,
  validateOptionalCertificationReceipt,
  type OptionalCertificationExpectation,
  type OptionalCertificationStatus,
} from '../../scripts/validate-optional-certification-receipt.ts';
import { writeOptionalCertificationReceipt } from '../../scripts/write-optional-certification-receipt.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');
const digest = (character: string): string => `sha256:${character.repeat(64)}`;
const expected: OptionalCertificationExpectation = {
  releaseTag: 'v26.7.27-r1',
  artifactName: 'One-Person-Lab-26.7.27-r1-mac-arm64.dmg',
  artifactDigest: digest('a'),
  componentManifestDigest: digest('b'),
  appSha: '1'.repeat(40),
  shellSha: '2'.repeat(40),
  frameworkSha: '3'.repeat(40),
  sourceRunId: '30260000001',
};
const linuxExpected: OptionalCertificationExpectation = {
  ...expected,
  artifactName: 'One-Person-Lab-26.7.27-r1-linux-x64.deb',
  artifactDigest: digest('e'),
  installerName: 'opl-install.sh',
  installerDigest: digest('f'),
};

function seal(receipt: Record<string, any>): Record<string, any> {
  const core = Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receipt_digest'));
  receipt.receipt_digest = `sha256:${crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex')}`;
  return receipt;
}

function receipt(status: OptionalCertificationStatus): Record<string, any> {
  const notRun = status === 'not_run';
  const unavailable = status === 'unavailable';
  return seal({
    schema: 'opl_app_optional_certification_receipt.v1',
    status,
    required_for_publication: false,
    release: {
      tag: expected.releaseTag,
      artifact: { name: expected.artifactName, digest: expected.artifactDigest },
      component_manifest_digest: expected.componentManifestDigest,
      cohort: {
        app_sha: expected.appSha,
        shell_sha: expected.shellSha,
        framework_sha: expected.frameworkSha,
      },
    },
    certification: {
      kind: 'clean_machine_install',
      platform: 'macos',
      capability: 'tart-clean-macos',
    },
    run: {
      source_run_id: expected.sourceRunId,
      source_run_attempt: 1,
      certification_run_id: notRun ? null : '30260000002',
      certification_run_attempt: notRun ? null : 1,
      job_started: !notRun,
    },
    artifact_handling: {
      downloaded_from_published_release: !notRun,
      rebuilt: false,
      component_manifest_mutated: false,
      component_manifest_resigned: false,
    },
    admission: {
      status: notRun ? 'not_started' : unavailable ? 'failed' : 'passed',
      reason_code: notRun
        ? 'operator_deferred'
        : unavailable
          ? 'fleet_lease_admission_failed'
          : null,
      evidence_digest: digest('c'),
    },
    result: {
      terminal: true,
      evidence_digests: status === 'passed' || status === 'failed' ? [digest('d')] : [],
    },
    created_at: '2026-07-27T12:00:00.000Z',
  });
}

function writeJson(root: string, filename: string, value: unknown): string {
  const output = path.join(root, filename);
  fs.writeFileSync(output, `${JSON.stringify(value)}\n`);
  return output;
}

function dispatchAdmission(reason: 'not_requested' | 'not_authorized' | 'operator_deferred' = 'not_requested'): Record<string, unknown> {
  return {
    schema: 'opl_app_optional_certification_dispatch_admission.v1',
    status: 'not_started',
    reason_code: reason,
    source_run_id: expected.sourceRunId,
    release_tag: expected.releaseTag,
    physical_job_dispatched: false,
  };
}

function passedCapabilityAdmission(): Record<string, unknown> {
  return {
    schema: 'opl_app_optional_certification_vm_admission.v1',
    status: 'passed',
    reason_code: null,
    source_vm: 'opl-clean-macos',
  };
}

function unavailableCapabilityAdmission(
  reasonCode = 'capability_admission_failed',
): Record<string, unknown> {
  return {
    schema: 'opl_app_optional_certification_vm_admission.v1',
    status: 'failed',
    reason_code: reasonCode,
    source_vm: 'opl-clean-macos',
  };
}

function hostedLinuxAdmission(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema: 'opl_app_optional_certification_hosted_admission.v1',
    status: 'passed',
    reason_code: null,
    runner_environment: 'github-hosted-ubuntu',
    platform: 'linux',
    architecture: 'x64',
    source_run_id: linuxExpected.sourceRunId,
    release_tag: linuxExpected.releaseTag,
    artifact: {
      name: linuxExpected.artifactName,
      digest: linuxExpected.artifactDigest,
    },
    installer: {
      name: linuxExpected.installerName,
      digest: linuxExpected.installerDigest,
    },
    component_manifest_digest: linuxExpected.componentManifestDigest,
    cohort: {
      app_sha: linuxExpected.appSha,
      shell_sha: linuxExpected.shellSha,
      framework_sha: linuxExpected.frameworkSha,
    },
    ...overrides,
  };
}

function hostedLinuxExecution(
  status: 'passed' | 'failed',
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const passed = status === 'passed';
  return {
    schema: 'opl_app_linux_same_artifact_install_evidence.v1',
    status,
    failure_stage: passed ? 'complete' : 'download_installer',
    certification_exit_code: passed ? 0 : 21,
    platform: 'linux',
    architecture: 'x64',
    runner_environment: 'github-hosted-ubuntu',
    release_tag: linuxExpected.releaseTag,
    artifact: {
      name: linuxExpected.artifactName,
      digest: linuxExpected.artifactDigest,
      downloaded_from_published_release: true,
    },
    installer: {
      name: linuxExpected.installerName,
      digest: linuxExpected.installerDigest,
      downloaded_from_published_release: passed,
      invoked: passed,
      exit_code: passed ? 0 : null,
    },
    component_manifest_digest: linuxExpected.componentManifestDigest,
    cohort: {
      app_sha: linuxExpected.appSha,
      shell_sha: linuxExpected.shellSha,
      framework_sha: linuxExpected.frameworkSha,
    },
    rebuilt: false,
    preinstall_package_absent: true,
    installed_package: {
      name: 'one-person-lab',
      expected_version: '26.7.27-r1',
      expected_architecture: 'amd64',
      version: passed ? '26.7.27-r1' : null,
      architecture: passed ? 'amd64' : null,
      dpkg_status: passed ? 'ii' : null,
      executable_path: passed ? '/opt/One Person Lab/One Person Lab' : null,
      expected_executable_digest: passed ? digest('9') : null,
      executable_digest: passed ? digest('9') : null,
    },
    ...overrides,
  };
}

function vmAdmissionFailureSummary(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    surface_id: 'opl_tart_gui_first_run_smoke',
    status: 'failed',
    failure_stage: 'wait_for_ssh',
    source_vm: 'opl-clean-macos',
    smoke_profile: 'no-clt-clean-vm',
    runtime_profile: 'standard',
    framework_source_archive: null,
    ...overrides,
  };
}

test('optional certification contract exposes exactly four distinct canonical states', () => {
  const schema = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts/app-optional-certification-receipt.schema.json'), 'utf8'),
  );
  assert.deepEqual(schema.properties.status.enum, ['passed', 'failed', 'not_run', 'unavailable']);
  assert.deepEqual(schema.properties.certification.properties.platform.enum, ['macos', 'linux', 'windows']);
  for (const status of ['passed', 'failed', 'not_run', 'unavailable'] as const) {
    const value = receipt(status);
    assert.deepEqual(validateOptionalCertificationReceipt(value, expected), []);
    assert.equal(projectOptionalCertificationStatus(value, expected), status);
  }
  assert.equal(projectOptionalCertificationStatus(null, expected), 'not_run');
});

test('hosted Linux receipt binds exact public DEB, installer, manifest, and cohort for passed or failed execution', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-linux-certification-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const admission = writeJson(root, 'hosted-admission.json', hostedLinuxAdmission());
  for (const status of ['passed', 'failed'] as const) {
    const execution = writeJson(
      root,
      `linux-install-summary-${status}.json`,
      hostedLinuxExecution(status),
    );
    const value = writeOptionalCertificationReceipt({
      expected: linuxExpected,
      status,
      certification: {
        kind: 'clean_machine_install',
        platform: 'linux',
        capability: 'github-hosted-ubuntu-x64',
      },
      admissionEvidencePath: admission,
      reasonCode: null,
      certificationRunId: '30260000002',
      evidencePaths: [execution],
      createdAt: '2026-07-30T01:00:00.000Z',
    });
    assert.deepEqual(validateOptionalCertificationReceipt(value, linuxExpected), []);
    assert.equal(value.status, status);
    assert.equal(value.artifact_handling.downloaded_from_published_release, true);
    assert.equal(value.artifact_handling.rebuilt, false);
    assert.equal(value.artifact_handling.installer.downloaded_from_published_release, status === 'passed');
    assert.equal(value.admission.status, 'passed');
    assert.equal(value.admission.reason_code, null);
    const missingInstallerExpectation = {
      ...linuxExpected,
      installerName: undefined,
      installerDigest: undefined,
    };
    assert.ok(
      validateOptionalCertificationReceipt(value, missingInstallerExpectation)
        .includes('hosted Linux certification requires a passed typed admission and an executed passed or failed install'),
    );
  }
});

test('hosted Linux receipt rejects unavailable and non-exact admission identity', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-linux-certification-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const execution = writeJson(
    root,
    'linux-install-summary.json',
    hostedLinuxExecution('failed'),
  );
  const admission = writeJson(root, 'hosted-admission.json', hostedLinuxAdmission());
  assert.throws(
    () => writeOptionalCertificationReceipt({
      expected: linuxExpected,
      status: 'unavailable',
      certification: {
        kind: 'clean_machine_install',
        platform: 'linux',
        capability: 'github-hosted-ubuntu-x64',
      },
      admissionEvidencePath: admission,
      reasonCode: 'capability_admission_failed',
      certificationRunId: '30260000002',
      evidencePaths: [],
      createdAt: '2026-07-30T01:00:00.000Z',
    }),
    /Hosted Linux certification supports only passed or failed/,
  );

  const invalidAdmission = writeJson(root, 'invalid-hosted-admission.json', hostedLinuxAdmission({
    installer: {
      name: 'opl-install.sh',
      digest: digest('0'),
    },
  }));
  assert.throws(
    () => writeOptionalCertificationReceipt({
      expected: linuxExpected,
      status: 'failed',
      certification: {
        kind: 'clean_machine_install',
        platform: 'linux',
        capability: 'github-hosted-ubuntu-x64',
      },
      admissionEvidencePath: invalidAdmission,
      reasonCode: null,
      certificationRunId: '30260000002',
      evidencePaths: [execution],
      createdAt: '2026-07-30T01:00:00.000Z',
    }),
    /exact typed GitHub-hosted Linux artifact admission/,
  );
});

test('hosted Linux failed receipt preserves truthful pre-download handling', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-linux-certification-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const admission = writeJson(root, 'hosted-admission.json', hostedLinuxAdmission());
  const execution = writeJson(
    root,
    'pre-download-failure.json',
    hostedLinuxExecution('failed', {
      failure_stage: 'download_linux_artifact',
      certification_exit_code: 13,
      artifact: {
        name: linuxExpected.artifactName,
        digest: linuxExpected.artifactDigest,
        downloaded_from_published_release: false,
      },
    }),
  );
  const value = writeOptionalCertificationReceipt({
    expected: linuxExpected,
    status: 'failed',
    certification: {
      kind: 'clean_machine_install',
      platform: 'linux',
      capability: 'github-hosted-ubuntu-x64',
    },
    admissionEvidencePath: admission,
    reasonCode: null,
    certificationRunId: '30260000002',
    evidencePaths: [execution],
    createdAt: '2026-07-30T01:00:00.000Z',
  });
  assert.deepEqual(validateOptionalCertificationReceipt(value, linuxExpected), []);
  assert.equal(value.artifact_handling.downloaded_from_published_release, false);
  assert.equal(value.artifact_handling.installer.downloaded_from_published_release, false);
});

test('hosted Linux passed receipt rejects a non-clean prestate or installed executable byte drift', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-linux-certification-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const admission = writeJson(root, 'hosted-admission.json', hostedLinuxAdmission());
  const input = (executionPath: string) => ({
    expected: linuxExpected,
    status: 'passed' as const,
    certification: {
      kind: 'clean_machine_install' as const,
      platform: 'linux' as const,
      capability: 'github-hosted-ubuntu-x64',
    },
    admissionEvidencePath: admission,
    reasonCode: null,
    certificationRunId: '30260000002',
    evidencePaths: [executionPath],
    createdAt: '2026-07-30T01:00:00.000Z',
  });
  const dirtyPrestate = writeJson(
    root,
    'dirty-prestate.json',
    hostedLinuxExecution('passed', { preinstall_package_absent: false }),
  );
  assert.throws(
    () => writeOptionalCertificationReceipt(input(dirtyPrestate)),
    /clean install with exact executable byte parity/,
  );

  const byteDrift = writeJson(
    root,
    'byte-drift.json',
    hostedLinuxExecution('passed', {
      installed_package: {
        ...(hostedLinuxExecution('passed').installed_package as Record<string, unknown>),
        executable_digest: digest('8'),
      },
    }),
  );
  assert.throws(
    () => writeOptionalCertificationReceipt(input(byteDrift)),
    /clean install with exact executable byte parity/,
  );
});

test('not_run remains explicit non-execution and cannot masquerade as unavailable', () => {
  const value = receipt('not_run');
  value.admission.status = 'failed';
  value.admission.reason_code = 'fleet_lease_admission_failed';
  seal(value);
  assert.ok(
    validateOptionalCertificationReceipt(value, expected)
      .includes('not_run requires a typed non-execution reason'),
  );
});

test('non-Linux executed certification still requires downloaded public artifact bytes', () => {
  const value = receipt('failed');
  value.artifact_handling.downloaded_from_published_release = false;
  seal(value);
  assert.ok(
    validateOptionalCertificationReceipt(value, expected)
      .includes('passed certification and non-Linux execution must download the published artifact'),
  );
});

test('unavailable requires a started typed admission failure and rejects offline, queue, auth, or network guesses', () => {
  for (const reason of ['runner_offline', 'queued_workflow', 'github_auth_failure', 'network_failure']) {
    const value = receipt('unavailable');
    value.admission.reason_code = reason;
    seal(value);
    const errors = validateOptionalCertificationReceipt(value, expected);
    assert.ok(errors.includes('unavailable requires a started-job admission failure with an allowed reason'));
    assert.ok(errors.includes('queued, runner inventory, authentication, or network state cannot prove unavailable'));
  }
});

test('certification is bound to the already-published artifact and may never rebuild or rewrite its manifest', () => {
  const value = receipt('passed');
  value.release.artifact.digest = digest('e');
  value.artifact_handling.rebuilt = true;
  value.artifact_handling.component_manifest_mutated = true;
  value.artifact_handling.component_manifest_resigned = true;
  seal(value);
  assert.deepEqual(validateOptionalCertificationReceipt(value, expected), [
    'artifact digest does not match',
    'certification must never rebuild the artifact',
    'certification must not mutate the component manifest',
    'certification must not resign the component manifest',
  ]);
});

test('receipt writer emits a self-validating not_run record without inventing a physical job', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-optional-certification-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const admission = path.join(root, 'admission.json');
  fs.writeFileSync(admission, `${JSON.stringify(dispatchAdmission())}\n`);
  const value = writeOptionalCertificationReceipt({
    expected,
    status: 'not_run',
    certification: {
      kind: 'clean_machine_install',
      platform: 'macos',
      capability: 'tart-clean-macos',
    },
    admissionEvidencePath: admission,
    reasonCode: 'not_requested',
    certificationRunId: null,
    evidencePaths: [],
    createdAt: '2026-07-28T01:00:00.000Z',
  });
  assert.deepEqual(validateOptionalCertificationReceipt(value, expected), []);
  assert.equal(value.run.certification_run_id, null);
  assert.equal(value.run.job_started, false);
  assert.equal(value.artifact_handling.downloaded_from_published_release, false);
  assert.equal(value.admission.reason_code, 'not_requested');
  assert.deepEqual(value.result.evidence_digests, []);
});

test('receipt writer refuses to classify queue, runner, auth, or network state as unavailable', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-optional-certification-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const admission = path.join(root, 'admission.json');
  fs.writeFileSync(admission, `${JSON.stringify(unavailableCapabilityAdmission())}\n`);
  assert.throws(
    () => writeOptionalCertificationReceipt({
      expected,
      status: 'unavailable',
      certification: {
        kind: 'clean_machine_install',
        platform: 'macos',
        capability: 'tart-clean-macos',
      },
      admissionEvidencePath: admission,
      reasonCode: 'runner_offline',
      certificationRunId: '30260000002',
      evidencePaths: [],
      createdAt: '2026-07-28T01:00:00.000Z',
    }),
    /typed admission failure/,
  );
});

test('receipt writer binds every terminal state to an exact typed admission document', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-optional-certification-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const execution = writeJson(root, 'execution.json', { surface_id: 'real-execution' });

  for (const [index, invalidAdmission] of [
    null,
    [],
    { ...passedCapabilityAdmission(), extra: true },
    { ...passedCapabilityAdmission(), source_vm: '' },
    { ...passedCapabilityAdmission(), status: 'failed' },
  ].entries()) {
    const admission = writeJson(root, `invalid-${index}.json`, invalidAdmission);
    assert.throws(
      () => writeOptionalCertificationReceipt({
        expected,
        status: 'passed',
        certification: { kind: 'clean_machine_install', platform: 'macos', capability: 'tart-clean-macos' },
        admissionEvidencePath: admission,
        reasonCode: null,
        certificationRunId: '30260000002',
        evidencePaths: [execution],
        createdAt: '2026-07-28T01:00:00.000Z',
      }),
      /Admission evidence/,
    );
  }

  const invalidJson = path.join(root, 'invalid-json.json');
  fs.writeFileSync(invalidJson, '{not valid json}\n');
  assert.throws(
    () => writeOptionalCertificationReceipt({
      expected,
      status: 'passed',
      certification: { kind: 'clean_machine_install', platform: 'macos', capability: 'tart-clean-macos' },
      admissionEvidencePath: invalidJson,
      reasonCode: null,
      certificationRunId: '30260000002',
      evidencePaths: [execution],
      createdAt: '2026-07-28T01:00:00.000Z',
    }),
    /Admission evidence must be one valid JSON object/,
  );

  const target = writeJson(root, 'symlink-target.json', passedCapabilityAdmission());
  const symlink = path.join(root, 'admission-symlink.json');
  fs.symlinkSync(target, symlink);
  assert.throws(
    () => writeOptionalCertificationReceipt({
      expected,
      status: 'passed',
      certification: { kind: 'clean_machine_install', platform: 'macos', capability: 'tart-clean-macos' },
      admissionEvidencePath: symlink,
      reasonCode: null,
      certificationRunId: '30260000002',
      evidencePaths: [execution],
      createdAt: '2026-07-28T01:00:00.000Z',
    }),
    /Admission evidence must be a non-empty regular file/,
  );

  const unavailable = writeJson(root, 'unavailable.json', unavailableCapabilityAdmission());
  const value = writeOptionalCertificationReceipt({
    expected,
    status: 'unavailable',
    certification: { kind: 'clean_machine_install', platform: 'macos', capability: 'tart-clean-macos' },
    admissionEvidencePath: unavailable,
    reasonCode: 'capability_admission_failed',
    certificationRunId: '30260000002',
    evidencePaths: [],
    createdAt: '2026-07-28T01:00:00.000Z',
  });
  assert.deepEqual(validateOptionalCertificationReceipt(value, expected), []);
});

test('receipt writer accepts every canonical non-VM unavailable reason with exact typed admission', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-optional-certification-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const reasonCode of [
    'authority_or_capability_not_provable',
    'fleet_lease_admission_failed',
    'capability_admission_failed',
  ]) {
    const admission = writeJson(
      root,
      `${reasonCode}.json`,
      unavailableCapabilityAdmission(reasonCode),
    );
    const value = writeOptionalCertificationReceipt({
      expected,
      status: 'unavailable',
      certification: { kind: 'clean_machine_install', platform: 'macos', capability: 'tart-clean-macos' },
      admissionEvidencePath: admission,
      reasonCode,
      certificationRunId: '30260000002',
      evidencePaths: [],
      createdAt: '2026-07-28T01:00:00.000Z',
    });
    assert.deepEqual(validateOptionalCertificationReceipt(value, expected), []);
  }
});

test('VM-admission failure binds complete summary identity to the exact capability admission', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-optional-certification-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const capabilityAdmission = writeJson(
    root,
    'capability-admission.json',
    passedCapabilityAdmission(),
  );
  const validSummary = writeJson(root, 'valid-summary.json', vmAdmissionFailureSummary());
  const value = writeOptionalCertificationReceipt({
    expected,
    status: 'unavailable',
    certification: { kind: 'clean_machine_install', platform: 'macos', capability: 'tart-clean-macos' },
    admissionEvidencePath: validSummary,
    capabilityAdmissionEvidencePath: capabilityAdmission,
    reasonCode: 'vm_admission_failed',
    certificationRunId: '30260000002',
    evidencePaths: [],
    createdAt: '2026-07-28T01:00:00.000Z',
  });
  assert.deepEqual(validateOptionalCertificationReceipt(value, expected), []);

  for (const [name, override] of Object.entries({
    source: { source_vm: 'unrelated-vm' },
    smoke: { smoke_profile: 'default' },
    runtime: { runtime_profile: 'full' },
    framework: { framework_source_archive: 'framework.tar.gz' },
    stage: { failure_stage: 'run_guest_smoke' },
  })) {
    const invalidSummary = writeJson(
      root,
      `invalid-${name}.json`,
      vmAdmissionFailureSummary(override),
    );
    assert.throws(
      () => writeOptionalCertificationReceipt({
        expected,
        status: 'unavailable',
        certification: { kind: 'clean_machine_install', platform: 'macos', capability: 'tart-clean-macos' },
        admissionEvidencePath: invalidSummary,
        capabilityAdmissionEvidencePath: capabilityAdmission,
        reasonCode: 'vm_admission_failed',
        certificationRunId: '30260000002',
        evidencePaths: [],
        createdAt: '2026-07-28T01:00:00.000Z',
      }),
      /exact typed VM-admission failure summary/,
    );
  }

  assert.throws(
    () => writeOptionalCertificationReceipt({
      expected,
      status: 'unavailable',
      certification: { kind: 'clean_machine_install', platform: 'macos', capability: 'tart-clean-macos' },
      admissionEvidencePath: validSummary,
      reasonCode: 'vm_admission_failed',
      certificationRunId: '30260000002',
      evidencePaths: [],
      createdAt: '2026-07-28T01:00:00.000Z',
    }),
    /requires the exact capability admission evidence/,
  );
});
