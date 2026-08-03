#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  optionalCertificationNotRunReasons,
  optionalCertificationUnavailableReasons,
  type OptionalCertificationExpectation,
  type OptionalCertificationStatus,
  validateOptionalCertificationReceipt,
} from './validate-optional-certification-receipt.ts';

type JsonRecord = Record<string, unknown>;

const digestPattern = /^sha256:[0-9a-f]{64}$/;
const runIdPattern = /^[1-9][0-9]*$/;
const certificationKinds = new Set(['clean_machine_install', 'updater_upgrade', 'homebrew_install']);
const platforms = new Set(['macos', 'linux', 'windows']);
const vmAdmissionSchema = 'opl_app_optional_certification_vm_admission.v1';
const dispatchAdmissionSchema = 'opl_app_optional_certification_dispatch_admission.v1';
const hostedAdmissionSchema = 'opl_app_optional_certification_hosted_admission.v1';
const tartSmokeSurface = 'opl_tart_gui_first_run_smoke';
const vmAdmissionKeys = ['reason_code', 'schema', 'source_vm', 'status'];
const dispatchAdmissionKeys = [
  'physical_job_dispatched',
  'reason_code',
  'release_tag',
  'schema',
  'source_run_id',
  'status',
];
const hostedAdmissionKeys = [
  'architecture',
  'artifact',
  'cohort',
  'component_manifest_digest',
  'installer',
  'platform',
  'reason_code',
  'release_tag',
  'runner_environment',
  'schema',
  'source_run_id',
  'status',
];
const hostedLinuxExecutionKeys = [
  'architecture',
  'artifact',
  'certification_exit_code',
  'cohort',
  'component_manifest_digest',
  'failure_stage',
  'installed_package',
  'installer',
  'platform',
  'preinstall_package_absent',
  'rebuilt',
  'release_tag',
  'runner_environment',
  'schema',
  'status',
];
const hostedLinuxInstalledPackageKeys = [
  'architecture',
  'dpkg_status',
  'executable_digest',
  'executable_path',
  'expected_architecture',
  'expected_executable_digest',
  'expected_version',
  'name',
  'version',
];
const vmAdmissionFailureStages = new Set([
  'clone_vm',
  'configure_display',
  'start_vm',
  'wait_for_ip',
  'wait_for_ssh',
]);
const runtimeProfileByCapability = new Map([
  ['tart-clean-macos', 'standard'],
  ['tart-homebrew-macos', 'standard'],
  ['tart-one-shot-installer', 'standard'],
  ['tart-full-clean-macos', 'full'],
]);

function required(value: string | undefined, flag: string): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) throw new Error(`Missing --${flag}.`);
  return normalized;
}

function readRegularFile(filePath: string, label: string): Buffer {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error(`${label} must be a non-empty regular file: ${resolved}`);
  }
  return fs.readFileSync(resolved);
}

function digestFile(filePath: string, label: string): string {
  return `sha256:${crypto.createHash('sha256').update(readRegularFile(filePath, label)).digest('hex')}`;
}

function readRegularJson(filePath: string, label: string): JsonRecord {
  let value: unknown;
  try {
    value = JSON.parse(readRegularFile(filePath, label).toString('utf8'));
  } catch (error) {
    throw new Error(`${label} must be one valid JSON object: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be one JSON object.`);
  }
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const normalizedExpected = [...expected].sort();
  if (
    actual.length !== normalizedExpected.length
    || actual.some((key, index) => key !== normalizedExpected[index])
  ) {
    throw new Error(`${label} must contain exactly: ${normalizedExpected.join(', ')}.`);
  }
}

function nonEmptyText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function requireRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be one JSON object.`);
  }
  return value as JsonRecord;
}

function assertVmAdmission(
  evidence: JsonRecord,
  expected: { status: 'passed' | 'failed'; reasonCode: string | null },
): string {
  exactKeys(evidence, vmAdmissionKeys, 'Admission evidence');
  if (evidence.schema !== vmAdmissionSchema) {
    throw new Error(`Admission evidence schema must be ${vmAdmissionSchema}.`);
  }
  if (evidence.status !== expected.status || evidence.reason_code !== expected.reasonCode) {
    throw new Error('Admission evidence status or reason code does not match the certification result.');
  }
  return nonEmptyText(evidence.source_vm, 'Admission evidence source_vm');
}

function assertNotRunDispatchAdmission(
  evidence: JsonRecord,
  input: WriteOptionalCertificationReceiptInput,
): void {
  exactKeys(evidence, dispatchAdmissionKeys, 'Admission evidence');
  if (
    evidence.schema !== dispatchAdmissionSchema
    || evidence.status !== 'not_started'
    || evidence.reason_code !== input.reasonCode
    || evidence.source_run_id !== input.expected.sourceRunId
    || evidence.release_tag !== input.expected.releaseTag
    || evidence.physical_job_dispatched !== false
  ) {
    throw new Error('Admission evidence must be the exact typed non-execution dispatch admission.');
  }
}

function assertHostedAdmission(
  evidence: JsonRecord,
  input: WriteOptionalCertificationReceiptInput,
): void {
  exactKeys(evidence, hostedAdmissionKeys, 'Admission evidence');
  const artifact = evidence.artifact as JsonRecord | undefined;
  const installer = evidence.installer as JsonRecord | undefined;
  const cohort = evidence.cohort as JsonRecord | undefined;
  if (artifact) exactKeys(artifact, ['digest', 'name'], 'Admission evidence artifact');
  if (installer) exactKeys(installer, ['digest', 'name'], 'Admission evidence installer');
  if (cohort) exactKeys(cohort, ['app_sha', 'framework_sha', 'shell_sha'], 'Admission evidence cohort');
  if (
    evidence.schema !== hostedAdmissionSchema
    || evidence.status !== 'passed'
    || evidence.reason_code !== null
    || evidence.runner_environment !== 'github-hosted-ubuntu'
    || evidence.platform !== 'linux'
    || evidence.architecture !== 'x64'
    || evidence.source_run_id !== input.expected.sourceRunId
    || evidence.release_tag !== input.expected.releaseTag
    || evidence.component_manifest_digest !== input.expected.componentManifestDigest
    || artifact?.name !== input.expected.artifactName
    || artifact?.digest !== input.expected.artifactDigest
    || installer?.name !== input.expected.installerName
    || installer?.digest !== input.expected.installerDigest
    || cohort?.app_sha !== input.expected.appSha
    || cohort?.shell_sha !== input.expected.shellSha
    || cohort?.framework_sha !== input.expected.frameworkSha
  ) {
    throw new Error('Admission evidence must be the exact typed GitHub-hosted Linux artifact admission.');
  }
}

function assertHostedLinuxExecutionEvidence(
  input: WriteOptionalCertificationReceiptInput,
): { artifactDownloaded: boolean; installerDownloaded: boolean } {
  if (input.evidencePaths.length !== 1) {
    throw new Error('Hosted Linux certification requires exactly one typed execution evidence file.');
  }
  const evidence = readRegularJson(input.evidencePaths[0], 'Hosted Linux execution evidence');
  exactKeys(evidence, hostedLinuxExecutionKeys, 'Hosted Linux execution evidence');
  const artifact = requireRecord(evidence.artifact, 'Hosted Linux execution artifact');
  const installer = requireRecord(evidence.installer, 'Hosted Linux execution installer');
  const cohort = requireRecord(evidence.cohort, 'Hosted Linux execution cohort');
  const installedPackage = requireRecord(
    evidence.installed_package,
    'Hosted Linux installed package',
  );
  exactKeys(
    artifact,
    ['digest', 'downloaded_from_published_release', 'name'],
    'Hosted Linux execution artifact',
  );
  exactKeys(
    installer,
    ['digest', 'downloaded_from_published_release', 'exit_code', 'invoked', 'name'],
    'Hosted Linux execution installer',
  );
  exactKeys(
    cohort,
    ['app_sha', 'framework_sha', 'shell_sha'],
    'Hosted Linux execution cohort',
  );
  exactKeys(
    installedPackage,
    hostedLinuxInstalledPackageKeys,
    'Hosted Linux installed package',
  );
  const exitCode = evidence.certification_exit_code;
  const installerInvoked = installer.invoked;
  const installerExitCode = installer.exit_code;
  const artifactDownloaded = artifact.downloaded_from_published_release;
  const installerDownloaded = installer.downloaded_from_published_release;
  if (
    evidence.schema !== 'opl_app_linux_same_artifact_install_evidence.v1'
    || evidence.status !== input.status
    || evidence.runner_environment !== 'github-hosted-ubuntu'
    || evidence.platform !== 'linux'
    || evidence.architecture !== 'x64'
    || evidence.release_tag !== input.expected.releaseTag
    || evidence.component_manifest_digest !== input.expected.componentManifestDigest
    || evidence.rebuilt !== false
    || artifact.name !== input.expected.artifactName
    || artifact.digest !== input.expected.artifactDigest
    || installer.name !== input.expected.installerName
    || installer.digest !== input.expected.installerDigest
    || typeof artifactDownloaded !== 'boolean'
    || typeof installerDownloaded !== 'boolean'
    || cohort.app_sha !== input.expected.appSha
    || cohort.shell_sha !== input.expected.shellSha
    || cohort.framework_sha !== input.expected.frameworkSha
    || typeof installerInvoked !== 'boolean'
    || (
      installerInvoked
        ? !Number.isInteger(installerExitCode) || Number(installerExitCode) < 0
        : installerExitCode !== null
    )
    || !Number.isInteger(exitCode)
    || Number(exitCode) < 0
    || typeof evidence.preinstall_package_absent !== 'boolean'
  ) {
    throw new Error('Hosted Linux execution evidence does not bind the exact published cohort and install attempt.');
  }
  if (input.status === 'passed') {
    const expectedExecutableDigest = nonEmptyText(
      installedPackage.expected_executable_digest,
      'Hosted Linux expected executable digest',
    );
    const executableDigest = nonEmptyText(
      installedPackage.executable_digest,
      'Hosted Linux installed executable digest',
    );
    if (
      evidence.failure_stage !== 'complete'
      || exitCode !== 0
      || evidence.preinstall_package_absent !== true
      || artifactDownloaded !== true
      || installerDownloaded !== true
      || installerInvoked !== true
      || installerExitCode !== 0
      || !nonEmptyText(installedPackage.name, 'Hosted Linux package name')
      || !nonEmptyText(installedPackage.version, 'Hosted Linux package version')
      || installedPackage.version !== installedPackage.expected_version
      || installedPackage.architecture !== 'amd64'
      || installedPackage.expected_architecture !== 'amd64'
      || installedPackage.dpkg_status !== 'ii'
      || !nonEmptyText(installedPackage.executable_path, 'Hosted Linux executable path').startsWith('/')
      || !digestPattern.test(expectedExecutableDigest)
      || executableDigest !== expectedExecutableDigest
    ) {
      throw new Error('Passed hosted Linux evidence must prove a clean install with exact executable byte parity.');
    }
    return { artifactDownloaded, installerDownloaded };
  }
  if (
    input.status !== 'failed'
    || evidence.failure_stage === 'complete'
    || !nonEmptyText(evidence.failure_stage, 'Hosted Linux failure stage')
    || Number(exitCode) < 1
  ) {
    throw new Error('Failed hosted Linux evidence must preserve one nonzero terminal failure stage.');
  }
  return { artifactDownloaded, installerDownloaded };
}

function assertVmAdmissionFailureEvidence(
  evidence: JsonRecord,
  input: WriteOptionalCertificationReceiptInput,
): void {
  if (!input.capabilityAdmissionEvidencePath) {
    throw new Error('VM-admission failure requires the exact capability admission evidence.');
  }
  const capabilityAdmission = readRegularJson(
    input.capabilityAdmissionEvidencePath,
    'Capability admission evidence',
  );
  const sourceVm = assertVmAdmission(capabilityAdmission, { status: 'passed', reasonCode: null });
  const expectedRuntimeProfile = runtimeProfileByCapability.get(input.certification.capability);
  if (!expectedRuntimeProfile) {
    throw new Error('VM-admission failure capability does not identify one supported runtime profile.');
  }
  if (
    evidence.surface_id !== tartSmokeSurface
    || evidence.status !== 'failed'
    || !vmAdmissionFailureStages.has(String(evidence.failure_stage ?? ''))
    || evidence.source_vm !== sourceVm
    || evidence.smoke_profile !== 'no-clt-clean-vm'
    || evidence.runtime_profile !== expectedRuntimeProfile
    || evidence.framework_source_archive !== null
  ) {
    throw new Error('Admission evidence must be an exact typed VM-admission failure summary.');
  }
}

function assertTypedAdmissionEvidence(input: WriteOptionalCertificationReceiptInput): void {
  const evidence = readRegularJson(input.admissionEvidencePath, 'Admission evidence');
  if (input.certification.platform === 'linux') {
    if (
      !['passed', 'failed'].includes(input.status)
      || input.certification.kind !== 'clean_machine_install'
      || input.certification.capability !== 'github-hosted-ubuntu-x64'
      || input.reasonCode !== null
    ) {
      throw new Error('Hosted Linux certification supports only passed or failed clean-machine execution.');
    }
    assertHostedAdmission(evidence, input);
    return;
  }
  if (input.status === 'not_run') {
    assertNotRunDispatchAdmission(evidence, input);
    return;
  }
  if (input.status === 'passed' || input.status === 'failed') {
    assertVmAdmission(evidence, { status: 'passed', reasonCode: null });
    return;
  }
  if (input.status !== 'unavailable') {
    throw new Error('Certification status is unsupported.');
  }
  if (input.reasonCode === 'vm_admission_failed') {
    assertVmAdmissionFailureEvidence(evidence, input);
    return;
  }
  if (input.reasonCode && optionalCertificationUnavailableReasons.has(input.reasonCode)) {
    assertVmAdmission(evidence, { status: 'failed', reasonCode: input.reasonCode });
    return;
  }
  throw new Error('unavailable requires exact typed capability or VM-admission evidence.');
}

function sealReceipt(receipt: JsonRecord): JsonRecord {
  const core = Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receipt_digest'));
  return {
    ...core,
    receipt_digest: `sha256:${crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex')}`,
  };
}

export type WriteOptionalCertificationReceiptInput = {
  expected: OptionalCertificationExpectation;
  status: OptionalCertificationStatus;
  certification: {
    kind: 'clean_machine_install' | 'updater_upgrade' | 'homebrew_install';
    platform: 'macos' | 'linux' | 'windows';
    capability: string;
  };
  admissionEvidencePath: string;
  capabilityAdmissionEvidencePath?: string | null;
  reasonCode: string | null;
  certificationRunId: string | null;
  evidencePaths: string[];
  createdAt: string;
};

export function writeOptionalCertificationReceipt(input: WriteOptionalCertificationReceiptInput): JsonRecord {
  const { expected, status, certification } = input;
  if (!certificationKinds.has(certification.kind) || !platforms.has(certification.platform)) {
    throw new Error('Certification kind or platform is unsupported.');
  }
  if (!certification.capability.trim()) throw new Error('Certification capability is required.');
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error('created_at is invalid.');
  if (
    certification.platform === 'linux'
    && (
      input.expected.installerName !== 'opl-install.sh'
      || !input.expected.installerDigest
      || !digestPattern.test(input.expected.installerDigest)
    )
  ) {
    throw new Error('Hosted Linux certification requires the exact public installer identity.');
  }

  const isNotRun = status === 'not_run';
  const isUnavailable = status === 'unavailable';
  const isTerminalExecution = status === 'passed' || status === 'failed';
  if (isNotRun) {
    if (!input.reasonCode || !optionalCertificationNotRunReasons.has(input.reasonCode)) {
      throw new Error('not_run requires a typed non-execution reason.');
    }
    if (input.certificationRunId !== null || input.evidencePaths.length !== 0) {
      throw new Error('not_run cannot carry a certification run or execution evidence.');
    }
  } else {
    if (!input.certificationRunId || !runIdPattern.test(input.certificationRunId)) {
      throw new Error('Started certification requires an exact certification run id.');
    }
    if (isUnavailable) {
      if (
        !input.reasonCode
        || !optionalCertificationUnavailableReasons.has(input.reasonCode)
        || input.evidencePaths.length !== 0
      ) {
        throw new Error('unavailable requires a typed admission failure and no execution evidence.');
      }
    } else if (isTerminalExecution) {
      if (input.reasonCode !== null || input.evidencePaths.length === 0) {
        throw new Error('passed or failed requires execution evidence and no admission reason.');
      }
    } else {
      throw new Error('Certification status is unsupported.');
    }
  }
  assertTypedAdmissionEvidence(input);
  const hostedLinuxHandling = certification.platform === 'linux'
    ? assertHostedLinuxExecutionEvidence(input)
    : null;

  const receipt = sealReceipt({
    schema: 'opl_app_optional_certification_receipt.v1',
    status,
    required_for_publication: false,
    release: {
      tag: expected.releaseTag,
      artifact: {
        name: expected.artifactName,
        digest: expected.artifactDigest,
      },
      component_manifest_digest: expected.componentManifestDigest,
      cohort: {
        app_sha: expected.appSha,
        shell_sha: expected.shellSha,
        framework_sha: expected.frameworkSha,
      },
    },
    certification,
    run: {
      source_run_id: expected.sourceRunId,
      source_run_attempt: 1,
      certification_run_id: isNotRun ? null : input.certificationRunId,
      certification_run_attempt: isNotRun ? null : 1,
      job_started: !isNotRun,
    },
    artifact_handling: {
      downloaded_from_published_release: hostedLinuxHandling
        ? hostedLinuxHandling.artifactDownloaded
        : !isNotRun,
      rebuilt: false,
      component_manifest_mutated: false,
      component_manifest_resigned: false,
      ...(certification.platform === 'linux'
        ? {
            installer: {
              name: input.expected.installerName,
              digest: input.expected.installerDigest,
              downloaded_from_published_release: hostedLinuxHandling?.installerDownloaded,
            },
          }
        : {}),
    },
    admission: {
      status: isNotRun ? 'not_started' : isUnavailable ? 'failed' : 'passed',
      reason_code: isNotRun || isUnavailable ? input.reasonCode : null,
      evidence_digest: digestFile(input.admissionEvidencePath, 'Admission evidence'),
    },
    result: {
      terminal: true,
      evidence_digests: isTerminalExecution
        ? input.evidencePaths.map((filePath) => digestFile(filePath, 'Certification evidence'))
        : [],
    },
    created_at: input.createdAt,
  });
  const errors = validateOptionalCertificationReceipt(receipt, expected);
  if (errors.length > 0) throw new Error(errors.join('; '));
  return receipt;
}

function main(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      'release-tag': { type: 'string' },
      'artifact-name': { type: 'string' },
      'artifact-digest': { type: 'string' },
      'component-manifest-digest': { type: 'string' },
      'app-sha': { type: 'string' },
      'shell-sha': { type: 'string' },
      'framework-sha': { type: 'string' },
      'source-run-id': { type: 'string' },
      'installer-name': { type: 'string' },
      'installer-digest': { type: 'string' },
      status: { type: 'string' },
      'certification-kind': { type: 'string' },
      platform: { type: 'string' },
      capability: { type: 'string' },
      'admission-evidence-file': { type: 'string' },
      'capability-admission-evidence-file': { type: 'string' },
      'reason-code': { type: 'string' },
      'certification-run-id': { type: 'string' },
      'evidence-file': { type: 'string', multiple: true },
      'created-at': { type: 'string' },
      output: { type: 'string' },
    },
  });
  const expected = {
    releaseTag: required(values['release-tag'], 'release-tag'),
    artifactName: required(values['artifact-name'], 'artifact-name'),
    artifactDigest: required(values['artifact-digest'], 'artifact-digest'),
    componentManifestDigest: required(values['component-manifest-digest'], 'component-manifest-digest'),
    appSha: required(values['app-sha'], 'app-sha'),
    shellSha: required(values['shell-sha'], 'shell-sha'),
    frameworkSha: required(values['framework-sha'], 'framework-sha'),
    sourceRunId: required(values['source-run-id'], 'source-run-id'),
    installerName: values['installer-name']?.trim() || undefined,
    installerDigest: values['installer-digest']?.trim() || undefined,
  };
  for (const digest of [expected.artifactDigest, expected.componentManifestDigest]) {
    if (!digestPattern.test(digest)) throw new Error('Release digests must be sha256 identities.');
  }
  const receipt = writeOptionalCertificationReceipt({
    expected,
    status: required(values.status, 'status') as OptionalCertificationStatus,
    certification: {
      kind: required(values['certification-kind'], 'certification-kind') as WriteOptionalCertificationReceiptInput['certification']['kind'],
      platform: required(values.platform, 'platform') as WriteOptionalCertificationReceiptInput['certification']['platform'],
      capability: required(values.capability, 'capability'),
    },
    admissionEvidencePath: required(values['admission-evidence-file'], 'admission-evidence-file'),
    capabilityAdmissionEvidencePath: values['capability-admission-evidence-file']?.trim() || null,
    reasonCode: values['reason-code']?.trim() || null,
    certificationRunId: values['certification-run-id']?.trim() || null,
    evidencePaths: values['evidence-file'] ?? [],
    createdAt: values['created-at']?.trim() || new Date().toISOString(),
  });
  const output = path.resolve(required(values.output, 'output'));
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
