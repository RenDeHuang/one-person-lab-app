#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const HOST_SCHEMA = 'opl_windows_wsl2_v6_host_closeout.v1';
const GUEST_SCHEMA = 'opl_windows_wsl2_v6_visible_smoke.v1';
const BUILD_SCHEMA = 'opl_windows_wsl2_v6_build_seal.v1';
const INTAKE_SCHEMA = 'opl_windows_wsl2_v6_intake_manifest.v1';
const LEASE_SCHEMA = 'opl_windows_v6_vm_writer_lease.v1';
const GUEST_STAGE = 'guest_smoke_pending_host_closeout';
const VALIDATION_STATE = 'validation_only_non_binding';
const VM_NAME = 'OPL-V6-WSL2-01';
const EXECUTOR_TASK_ID = '019f97e4-288a-7140-8850-925c657d8c71';
const PLATFORM_OWNER_TASK_ID = '019f972b-f550-7961-90be-9873600cd895';
const HYPERV_IDENTITY_PREFIX = 'hyperv-vmid:';

function parseArgs(argv) {
  const valueOptions = new Set([
    'vm-name',
    'expected-vm-id',
    'writer-lease',
    'expected-writer-lease-sha256',
    'intake-manifest',
    'expected-intake-manifest-sha256',
    'build-receipt',
    'expected-build-receipt-sha256',
    'stopped-guest-receipt',
    'stopped-screenshot',
    'running-guest-receipt',
    'running-screenshot',
    'candidate-zip',
    'expected-artifact-sha256',
    'expected-app-sha',
    'expected-shell-sha',
    'expected-framework-sha',
    'release-receipt-id',
    'output-dir',
    'timeout-seconds',
    'powershell-path',
  ]);
  const result = { requestSoftShutdown: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    assert.match(token, /^--[a-z0-9-]+$/, `unsupported argument: ${token}`);
    const name = token.slice(2);
    if (name === 'request-soft-shutdown') {
      result.requestSoftShutdown = true;
      continue;
    }
    assert.ok(valueOptions.has(name), `unknown option: ${token}`);
    const value = argv[index + 1];
    assert.ok(value && !value.startsWith('--'), `${token} requires a value`);
    result[name.replaceAll(/-([a-z])/g, (_, letter) => letter.toUpperCase())] =
      value;
    index += 1;
  }
  return result;
}

function requireOptions(options) {
  for (const name of [
    'vmName',
    'expectedVmId',
    'writerLease',
    'expectedWriterLeaseSha256',
    'intakeManifest',
    'expectedIntakeManifestSha256',
    'buildReceipt',
    'expectedBuildReceiptSha256',
    'stoppedGuestReceipt',
    'stoppedScreenshot',
    'runningGuestReceipt',
    'runningScreenshot',
    'candidateZip',
    'expectedArtifactSha256',
    'expectedAppSha',
    'expectedShellSha',
    'expectedFrameworkSha',
    'releaseReceiptId',
    'outputDir',
  ]) {
    assert.ok(
      options[name],
      `--${name.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required`,
    );
  }
  assert.equal(options.vmName, VM_NAME, `vm-name must be ${VM_NAME}`);
  assert.match(options.expectedVmId, /^[0-9a-f-]{36}$/i);
  assert.equal(
    options.requestSoftShutdown,
    true,
    '--request-soft-shutdown is required for a terminal closeout',
  );
  for (const [name, value] of [
    ['expectedWriterLeaseSha256', options.expectedWriterLeaseSha256],
    ['expectedIntakeManifestSha256', options.expectedIntakeManifestSha256],
    ['expectedBuildReceiptSha256', options.expectedBuildReceiptSha256],
    ['expectedArtifactSha256', options.expectedArtifactSha256],
  ]) {
    assert.match(value, /^[0-9a-f]{64}$/i, `${name} must be SHA256`);
  }
  for (const [name, value] of [
    ['expectedAppSha', options.expectedAppSha],
    ['expectedShellSha', options.expectedShellSha],
    ['expectedFrameworkSha', options.expectedFrameworkSha],
  ]) {
    assert.match(value, /^[0-9a-f]{40}$/i, `${name} must be a Git SHA`);
  }
  const timeoutSeconds = Number(options.timeoutSeconds ?? 180);
  assert.ok(
    Number.isInteger(timeoutSeconds) &&
      timeoutSeconds >= 30 &&
      timeoutSeconds <= 600,
    'timeout-seconds must be an integer between 30 and 600',
  );
  return {
    ...options,
    expectedVmId: options.expectedVmId.toLowerCase(),
    timeoutSeconds,
  };
}

function sha256File(filePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function createValidator(schemaPath) {
  const ajv = new Ajv2020({
    allErrors: true,
    strictSchema: true,
    strictTypes: false,
  });
  addFormats(ajv);
  return ajv.compile(readJson(schemaPath));
}

function assertSchema(validate, payload, label) {
  assert.equal(
    validate(payload),
    true,
    `${label} schema failed: ${JSON.stringify(validate.errors)}`,
  );
}

function runPowerShell(script, options) {
  const powershellPath = options.powershellPath ?? 'powershell.exe';
  const result = spawnSync(
    powershellPath,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
    {
      encoding: 'utf8',
      timeout: 30_000,
      windowsHide: true,
    },
  );
  assert.equal(
    result.status,
    0,
    `${powershellPath} failed: ${String(
      result.stderr || result.stdout || result.error?.message,
    ).trim()}`,
  );
  return result.stdout.trim();
}

function quotePowerShellLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function queryVm(options) {
  const name = quotePowerShellLiteral(options.vmName);
  const output = runPowerShell(
    [
      "$ErrorActionPreference='Stop'",
      `$vm=Get-VM -Name ${name} -ErrorAction Stop`,
      "[pscustomobject]@{Name=$vm.Name;Id=$vm.Id.Guid.ToString();State=$vm.State.ToString()}|ConvertTo-Json -Compress",
    ].join(';'),
    options,
  );
  const vm = JSON.parse(output);
  return {
    name: vm.Name,
    id: String(vm.Id).toLowerCase(),
    state: vm.State,
  };
}

function stopVmSoft(options) {
  const name = quotePowerShellLiteral(options.vmName);
  runPowerShell(
    [
      "$ErrorActionPreference='Stop'",
      `$vm=Get-VM -Name ${name} -ErrorAction Stop`,
      "Stop-VM -VM $vm -Shutdown -ErrorAction Stop",
    ].join(';'),
    options,
  );
}

function validateLease({ lease, expected, now }) {
  assert.equal(lease.schema, LEASE_SCHEMA);
  assert.equal(lease.status, 'active');
  assert.equal(lease.host_platform, 'windows_hyperv');
  assert.equal(lease.vm_name, VM_NAME);
  assert.equal(lease.vm_identity, expected.vmIdentity);
  assert.equal(lease.executor_task_id, EXECUTOR_TASK_ID);
  assert.equal(lease.platform_owner_task_id, PLATFORM_OWNER_TASK_ID);
  assert.ok(new Date(lease.issued_at) <= now, 'writer lease is not active yet');
  assert.ok(new Date(lease.expires_at) > now, 'writer lease has expired');
  const expectedOperations = [
    'v6_build_seal',
    'v6_fixture_phase_transition',
    'v6_guest_visible_smoke',
    'v6_soft_shutdown',
  ];
  assert.deepEqual(
    [...lease.allowed_operations].sort(),
    [...expectedOperations].sort(),
    'writer lease operations are not exact',
  );
  for (const operation of expectedOperations) {
    assert.ok(
      lease.allowed_operations.includes(operation),
      `writer lease does not allow ${operation}`,
    );
  }
  assert.equal(lease.clean_vm_attestation.status, 'attested');
  assert.equal(lease.clean_vm_attestation.vm_id, expected.vmId);
  assert.ok(
    new Date(lease.clean_vm_attestation.attested_at) <= now,
    'clean VM attestation is in the future',
  );
}

function validateGuestReceipt({
  receipt,
  receiptPath,
  screenshotPath,
  expectedPhase,
  expected,
  validateSchema,
}) {
  assertSchema(validateSchema, receipt, `${expectedPhase} guest receipt`);
  assert.equal(receipt.schema, GUEST_SCHEMA);
  assert.equal(receipt.validation_state, VALIDATION_STATE);
  assert.equal(receipt.receipt_stage, GUEST_STAGE);
  assert.equal(receipt.terminal_v6_verdict, false);
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.expected_phase, expectedPhase);
  assert.equal(receipt.app_sha, expected.appSha);
  assert.equal(receipt.shell_sha, expected.shellSha);
  assert.equal(receipt.framework_sha, expected.frameworkSha);
  assert.equal(receipt.artifact.sha256, expected.artifactSha256);
  assert.equal(
    receipt.artifact.intake_manifest_sha256,
    expected.intakeManifestSha256,
  );
  assert.equal(
    receipt.artifact.build_receipt_sha256,
    expected.buildReceiptSha256,
  );
  assert.equal(receipt.artifact.tree_origin, 'verified_zip_expansion');
  assert.match(receipt.artifact.tree_sha256, /^[0-9a-f]{64}$/);
  assert.ok(receipt.artifact.tree_file_count > 0);
  assert.equal(receipt.artifact.tree_write_locks_held, true);
  assert.equal(receipt.artifact.tree_unchanged_after_process_exit, true);
  assert.equal(receipt.vm.identity, expected.vmIdentity);
  assert.equal(receipt.vm.host_platform, 'windows_hyperv');
  assert.equal(receipt.vm.vm_name, VM_NAME);
  assert.equal(
    receipt.vm.writer_lease.receipt_sha256,
    expected.writerLeaseSha256,
  );
  assert.equal(
    receipt.vm.writer_release.status,
    'pending_host_soft_shutdown',
  );
  assert.equal(receipt.process_cleanup.status, 'passed');
  assert.equal(receipt.process_cleanup.survivor_count, 0);
  assert.equal(receipt.process_cleanup.wsl_survivor_count, 0);
  assert.equal(receipt.post_readback.status, 'passed');
  assert.equal(receipt.screenshot.sha256, sha256File(screenshotPath));
  assert.equal(
    receipt.status_groups.guest_identity.visible_state,
    expectedPhase === 'stopped' ? 'unavailable' : 'observed',
  );
  for (const capability of [
    'aioncore_health',
    'direct_codex_app_server',
    'framework_state',
  ]) {
    assert.equal(
      receipt.status_groups[capability].capability_verification,
      'unverified_or_unavailable',
    );
  }
  return {
    receipt_sha256: sha256File(receiptPath),
    screenshot_sha256: receipt.screenshot.sha256,
    run_id: receipt.run_id,
    tree_sha256: receipt.artifact.tree_sha256,
    tree_file_count: receipt.artifact.tree_file_count,
    build_receipt_sha256: receipt.artifact.build_receipt_sha256,
  };
}

function writeJsonExclusive(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

async function waitForPowerOff(options, dependencies) {
  const deadline = dependencies.now().getTime() + options.timeoutSeconds * 1000;
  while (dependencies.now().getTime() < deadline) {
    const vm = dependencies.queryVm(options);
    assert.equal(vm.name, VM_NAME);
    assert.equal(vm.id, options.expectedVmId);
    if (vm.state === 'Off') {
      return vm;
    }
    await dependencies.sleep(2_000);
  }
  throw new Error('Hyper-V soft shutdown did not reach State=Off');
}

export async function runHostCloseout(rawOptions, injected = {}) {
  const options = requireOptions(rawOptions);
  const dependencies = {
    queryVm,
    stopVmSoft,
    now: () => new Date(),
    sleep: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    ...injected,
  };
  const schemaRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  );
  const validateGuestSchema = createValidator(
    path.join(schemaRoot, 'windows-wsl2-v6-receipt.schema.json'),
  );
  const validateIntakeSchema = createValidator(
    path.join(schemaRoot, 'windows-wsl2-v6-intake-manifest.schema.json'),
  );
  const validateBuildSchema = createValidator(
    path.join(schemaRoot, 'windows-wsl2-v6-build-seal.schema.json'),
  );
  const validateLeaseSchema = createValidator(
    path.join(schemaRoot, 'windows-wsl2-v6-writer-lease.schema.json'),
  );

  const vmBefore = dependencies.queryVm(options);
  assert.equal(vmBefore.name, VM_NAME);
  assert.equal(vmBefore.id, options.expectedVmId, 'Hyper-V VM ID changed');
  assert.notEqual(vmBefore.state, 'Off', 'authorized VM is already powered off');
  const vmIdentity = `${HYPERV_IDENTITY_PREFIX}${vmBefore.id}`;
  const expected = {
    vmId: vmBefore.id,
    vmIdentity,
    appSha: options.expectedAppSha.toLowerCase(),
    shellSha: options.expectedShellSha.toLowerCase(),
    frameworkSha: options.expectedFrameworkSha.toLowerCase(),
    artifactSha256: options.expectedArtifactSha256.toLowerCase(),
    writerLeaseSha256: options.expectedWriterLeaseSha256.toLowerCase(),
    intakeManifestSha256: options.expectedIntakeManifestSha256.toLowerCase(),
    buildReceiptSha256: options.expectedBuildReceiptSha256.toLowerCase(),
  };

  const intakeManifestSha256 = sha256File(options.intakeManifest);
  assert.equal(
    intakeManifestSha256,
    expected.intakeManifestSha256,
    'intake manifest SHA256 changed',
  );
  const intakeManifest = readJson(options.intakeManifest);
  assertSchema(validateIntakeSchema, intakeManifest, 'intake manifest');
  assert.equal(
    intakeManifest.source_refs.app_acceptance_sha,
    expected.appSha,
  );
  assert.equal(intakeManifest.source_refs.shell.git_sha, expected.shellSha);
  assert.equal(
    intakeManifest.source_refs.framework_fixture_sha,
    expected.frameworkSha,
  );

  const buildReceiptSha256 = sha256File(options.buildReceipt);
  assert.equal(
    buildReceiptSha256,
    expected.buildReceiptSha256,
    'build receipt SHA256 changed',
  );
  const buildReceipt = readJson(options.buildReceipt);
  assertSchema(validateBuildSchema, buildReceipt, 'build receipt');
  assert.equal(buildReceipt.schema, BUILD_SCHEMA);
  assert.equal(buildReceipt.packet.intake_manifest_sha256, intakeManifestSha256);
  assert.equal(
    buildReceipt.packet.writer_lease_sha256,
    expected.writerLeaseSha256,
  );
  assert.equal(buildReceipt.packet.vm_identity, expected.vmIdentity);
  assert.equal(buildReceipt.source_refs.app_acceptance_sha, expected.appSha);
  assert.equal(buildReceipt.source_refs.shell_sha, expected.shellSha);
  assert.equal(
    buildReceipt.source_refs.framework_fixture_sha,
    expected.frameworkSha,
  );
  assert.equal(buildReceipt.artifact.sha256, expected.artifactSha256);
  assert.equal(sha256File(options.candidateZip), expected.artifactSha256);

  const writerLeaseSha256 = sha256File(options.writerLease);
  assert.equal(
    writerLeaseSha256,
    expected.writerLeaseSha256,
    'writer lease SHA256 changed',
  );
  const writerLease = readJson(options.writerLease);
  assertSchema(validateLeaseSchema, writerLease, 'writer lease');
  validateLease({
    lease: writerLease,
    expected,
    now: dependencies.now(),
  });

  const stoppedEvidence = validateGuestReceipt({
    receipt: readJson(options.stoppedGuestReceipt),
    receiptPath: options.stoppedGuestReceipt,
    screenshotPath: options.stoppedScreenshot,
    expectedPhase: 'stopped',
    expected,
    validateSchema: validateGuestSchema,
  });
  const runningEvidence = validateGuestReceipt({
    receipt: readJson(options.runningGuestReceipt),
    receiptPath: options.runningGuestReceipt,
    screenshotPath: options.runningScreenshot,
    expectedPhase: 'running',
    expected,
    validateSchema: validateGuestSchema,
  });
  assert.notEqual(
    stoppedEvidence.run_id,
    runningEvidence.run_id,
    'stopped and running evidence must use distinct RunId values',
  );
  assert.equal(
    stoppedEvidence.build_receipt_sha256,
    runningEvidence.build_receipt_sha256,
    'stopped and running evidence must bind the same build receipt',
  );
  assert.equal(
    stoppedEvidence.tree_sha256,
    runningEvidence.tree_sha256,
    'stopped and running evidence must bind the same extracted candidate tree',
  );
  assert.equal(
    stoppedEvidence.tree_file_count,
    runningEvidence.tree_file_count,
    'stopped and running evidence must bind the same candidate file count',
  );

  dependencies.stopVmSoft(options);
  const vmAfter = await waitForPowerOff(options, dependencies);
  const releasedAt = dependencies.now().toISOString();
  fs.mkdirSync(options.outputDir, { recursive: true });
  const releasePath = path.join(options.outputDir, 'writer-release.json');
  const finalReceiptPath = path.join(
    options.outputDir,
    'v6-host-closeout-receipt.json',
  );
  const writerRelease = {
    schema: 'opl_windows_v6_vm_writer_release.v1',
    status: 'released',
    host_platform: 'windows_hyperv',
    vm_name: VM_NAME,
    vm_identity: vmIdentity,
    vm_state: vmAfter.state,
    previous_executor_task_id: EXECUTOR_TASK_ID,
    platform_owner_task_id: writerLease.platform_owner_task_id,
    lease_id: writerLease.lease_id,
    lease_sha256: writerLeaseSha256,
    receipt_id: options.releaseReceiptId,
    released_at: releasedAt,
    soft_shutdown_requested: true,
    powered_off_readback: true,
  };
  writeJsonExclusive(releasePath, writerRelease);
  const writerReleaseSha256 = sha256File(releasePath);

  const finalReceipt = {
    schema: HOST_SCHEMA,
    validation_state: VALIDATION_STATE,
    assessment_scope: 'status_projection_only',
    terminal_v6_verdict: true,
    status: 'passed',
    observed_at: releasedAt,
    source_refs: {
      app_sha: expected.appSha,
      shell_sha: expected.shellSha,
      framework_sha: expected.frameworkSha,
    },
    packet: {
      intake_manifest_sha256: intakeManifestSha256,
      build_receipt_sha256: buildReceiptSha256,
    },
    artifact: {
      sha256: expected.artifactSha256,
      file_name: path.basename(options.candidateZip),
      executable_sha256: buildReceipt.artifact.executable_sha256,
      tree_sha256: stoppedEvidence.tree_sha256,
      tree_file_count: stoppedEvidence.tree_file_count,
    },
    vm: {
      identity: vmIdentity,
      host_platform: 'windows_hyperv',
      vm_name: VM_NAME,
      vm_id: vmAfter.id,
      powered_off_readback: true,
      final_state: vmAfter.state,
    },
    writer_lease: {
      receipt_sha256: writerLeaseSha256,
      platform_owner_task_id: writerLease.platform_owner_task_id,
      executor_task_id: writerLease.executor_task_id,
      lease_id: writerLease.lease_id,
      issued_at: writerLease.issued_at,
      expires_at: writerLease.expires_at,
    },
    phase_evidence: {
      stopped: stoppedEvidence,
      running: runningEvidence,
    },
    writer_release: {
      status: 'released',
      receipt_id: options.releaseReceiptId,
      released_at: releasedAt,
      receipt_sha256: writerReleaseSha256,
    },
    capability_outcome:
      'visible_status_projection_passed_capabilities_remain_unverified',
    error: null,
  };
  writeJsonExclusive(finalReceiptPath, finalReceipt);
  return {
    finalReceipt,
    finalReceiptPath,
    writerRelease,
    writerReleasePath: releasePath,
  };
}

function writeFailureReceipt(options, error) {
  if (!options.outputDir) {
    return;
  }
  fs.mkdirSync(options.outputDir, { recursive: true });
  const failurePath = path.join(
    options.outputDir,
    'v6-host-closeout-failure.json',
  );
  if (fs.existsSync(failurePath)) {
    return;
  }
  writeJsonExclusive(failurePath, {
    schema: HOST_SCHEMA,
    validation_state: VALIDATION_STATE,
    terminal_v6_verdict: false,
    status: 'failed',
    observed_at: new Date().toISOString(),
    error: String(error?.message ?? error)
      .replaceAll(/[\r\n]+/g, ' ')
      .slice(0, 500),
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  try {
    const result = await runHostCloseout(options);
    process.stdout.write(`${result.finalReceiptPath}\n`);
  } catch (error) {
    writeFailureReceipt(options, error);
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main();
}
