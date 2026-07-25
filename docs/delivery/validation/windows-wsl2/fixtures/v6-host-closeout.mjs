#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const HOST_SCHEMA = 'opl_windows_wsl2_v6_host_closeout.v1';
const GUEST_SCHEMA = 'opl_windows_wsl2_v6_visible_smoke.v1';
const GUEST_STAGE = 'guest_smoke_pending_host_closeout';
const VALIDATION_STATE = 'validation_only_non_binding';
const VM_IDENTITY_PREFIX = 'vmware-bios:';
const DEFAULT_VM_RUN =
  '/Applications/VMware Fusion.app/Contents/Library/vmrun';
const DEFAULT_DISKUTIL = '/usr/sbin/diskutil';
const DEFAULT_PLUTIL = '/usr/bin/plutil';

function parseArgs(argv) {
  const valueOptions = new Set([
    'vmx-path',
    'expected-vmx-sha256',
    'expected-vm-bios-uuid',
    'expected-volume-uuid',
    'expected-device-identifier',
    'host-writer-handoff',
    'expected-writer-handoff-sha256',
    'stopped-guest-receipt',
    'stopped-screenshot',
    'running-guest-receipt',
    'running-screenshot',
    'candidate-zip',
    'expected-artifact-sha256',
    'expected-app-sha',
    'expected-shell-sha',
    'expected-framework-sha',
    'current-owner-id',
    'release-receipt-id',
    'output-dir',
    'timeout-seconds',
    'vmrun-path',
    'diskutil-path',
    'plutil-path',
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
    'vmxPath',
    'expectedVmxSha256',
    'expectedVmBiosUuid',
    'expectedVolumeUuid',
    'expectedDeviceIdentifier',
    'hostWriterHandoff',
    'expectedWriterHandoffSha256',
    'stoppedGuestReceipt',
    'stoppedScreenshot',
    'runningGuestReceipt',
    'runningScreenshot',
    'candidateZip',
    'expectedArtifactSha256',
    'expectedAppSha',
    'expectedShellSha',
    'expectedFrameworkSha',
    'currentOwnerId',
    'releaseReceiptId',
    'outputDir',
  ]) {
    assert.ok(options[name], `--${name.replaceAll(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} is required`);
  }
  assert.equal(
    options.requestSoftShutdown,
    true,
    '--request-soft-shutdown is required for a terminal closeout',
  );
  for (const [name, value] of [
    ['expectedVmxSha256', options.expectedVmxSha256],
    ['expectedWriterHandoffSha256', options.expectedWriterHandoffSha256],
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
  return { ...options, timeoutSeconds };
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeUuid(value) {
  return value.toLowerCase().replaceAll(/[^0-9a-f]/g, '');
}

function parseVmxValue(vmxText, key) {
  const escapedKey = key.replaceAll('.', '\\.');
  const match = vmxText.match(
    new RegExp(`^${escapedKey}\\s*=\\s*"([^"]+)"\\s*$`, 'm'),
  );
  assert.ok(match, `VMX does not contain ${key}`);
  return match[1];
}

function externalVolumeRoot(canonicalVmxPath) {
  const parts = canonicalVmxPath.split(path.sep);
  assert.equal(parts[1], 'Volumes', 'VMX must resolve below /Volumes');
  assert.ok(parts[2], 'VMX external volume name is missing');
  return path.join(path.sep, 'Volumes', parts[2]);
}

function runCommand(file, args, options = {}) {
  const result = spawnSync(file, args, {
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 30_000,
    input: options.input,
  });
  assert.equal(
    result.status,
    0,
    `${file} failed: ${String(result.stderr || result.stdout || result.error?.message).trim()}`,
  );
  return result.stdout;
}

function readPlistValue(plist, key, plutilPath) {
  return runCommand(
    plutilPath,
    ['-extract', key, 'raw', '-o', '-', '-'],
    { input: plist },
  ).trim();
}

function readDiskIdentity(volumeRoot, options) {
  const plist = runCommand(
    options.diskutilPath ?? DEFAULT_DISKUTIL,
    ['info', '-plist', volumeRoot],
  );
  const plutilPath = options.plutilPath ?? DEFAULT_PLUTIL;
  return {
    internal: readPlistValue(plist, 'Internal', plutilPath) === 'true',
    solidState: readPlistValue(plist, 'SolidState', plutilPath) === 'true',
    busProtocol: readPlistValue(plist, 'BusProtocol', plutilPath),
    volumeUuid: readPlistValue(plist, 'VolumeUUID', plutilPath),
    deviceIdentifier: readPlistValue(plist, 'DeviceIdentifier', plutilPath),
  };
}

function listRunningVms(options) {
  const output = runCommand(
    options.vmrunPath ?? DEFAULT_VM_RUN,
    ['-T', 'fusion', 'list'],
  );
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean);
}

function listVmxProcesses() {
  const output = runCommand('/bin/ps', ['-axo', 'command=']);
  return output
    .split(/\r?\n/)
    .filter((line) => line.includes('vmware-vmx'));
}

function stopVmSoft(canonicalVmxPath, options) {
  runCommand(
    options.vmrunPath ?? DEFAULT_VM_RUN,
    ['-T', 'fusion', 'stop', canonicalVmxPath, 'soft'],
    { timeoutMs: 60_000 },
  );
}

function createGuestValidator(schemaPath) {
  const schema = readJson(schemaPath);
  const ajv = new Ajv2020({
    allErrors: true,
    strictSchema: true,
    strictTypes: false,
  });
  addFormats(ajv);
  return ajv.compile(schema);
}

function validateGuestReceipt({
  receipt,
  receiptPath,
  screenshotPath,
  expectedPhase,
  expected,
  validateSchema,
}) {
  const schemaValid = validateSchema(receipt);
  assert.equal(
    schemaValid,
    true,
    `${expectedPhase} guest receipt schema failed: ${JSON.stringify(validateSchema.errors)}`,
  );
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
  assert.equal(receipt.artifact.tree_origin, 'verified_zip_expansion');
  assert.equal(receipt.vm.identity, expected.vmIdentity);
  assert.equal(receipt.vm.storage_class, 'external_ssd');
  assert.equal(receipt.vm.external_ssd, true);
  assert.equal(
    receipt.vm.writer_handoff.receipt_sha256,
    expected.writerHandoffSha256,
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
  };
}

function writeJsonExclusive(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

async function waitForPowerOff(canonicalVmxPath, options, dependencies) {
  const deadline = Date.now() + options.timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const runningVms = dependencies.listRunningVms(options);
    const vmxProcesses = dependencies.listVmxProcesses();
    const listed = runningVms.some(
      (candidate) =>
        path.resolve(candidate) === path.resolve(canonicalVmxPath),
    );
    const processPresent = vmxProcesses.some((line) =>
      line.includes(canonicalVmxPath),
    );
    if (!listed && !processPresent) {
      return;
    }
    await dependencies.sleep(2_000);
  }
  throw new Error('soft shutdown did not reach a powered-off VM state');
}

export async function runHostCloseout(rawOptions, injected = {}) {
  const options = requireOptions(rawOptions);
  const dependencies = {
    readDiskIdentity,
    listRunningVms,
    listVmxProcesses,
    stopVmSoft,
    sleep: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now: () => new Date(),
    canonicalizeVmxPath: (vmxPath) => fs.realpathSync(vmxPath),
    volumeRootFromVmxPath: externalVolumeRoot,
    ...injected,
  };

  const canonicalVmxPath = dependencies.canonicalizeVmxPath(options.vmxPath);
  const volumeRoot = dependencies.volumeRootFromVmxPath(canonicalVmxPath);
  const diskIdentity = dependencies.readDiskIdentity(volumeRoot, options);
  assert.equal(diskIdentity.internal, false, 'VMX volume must be external');
  assert.equal(diskIdentity.solidState, true, 'VMX volume must be solid state');
  assert.equal(
    diskIdentity.volumeUuid.toUpperCase(),
    options.expectedVolumeUuid.toUpperCase(),
    'external volume UUID changed',
  );
  assert.equal(
    diskIdentity.deviceIdentifier,
    options.expectedDeviceIdentifier,
    'external device identifier changed',
  );

  const vmxSha256 = sha256File(options.vmxPath);
  assert.equal(
    vmxSha256,
    options.expectedVmxSha256.toLowerCase(),
    'VMX SHA256 changed',
  );
  const vmxText = fs.readFileSync(options.vmxPath, 'utf8');
  const vmBiosUuid = normalizeUuid(parseVmxValue(vmxText, 'uuid.bios'));
  assert.equal(
    vmBiosUuid,
    normalizeUuid(options.expectedVmBiosUuid),
    'VM BIOS UUID changed',
  );
  const vmIdentity = `${VM_IDENTITY_PREFIX}${vmBiosUuid}`;

  const writerHandoffSha256 = sha256File(options.hostWriterHandoff);
  assert.equal(
    writerHandoffSha256,
    options.expectedWriterHandoffSha256.toLowerCase(),
    'host writer handoff SHA256 changed',
  );
  const writerHandoff = readJson(options.hostWriterHandoff);
  assert.equal(writerHandoff.schema, 'opl_vm_writer_release.v1');
  assert.equal(writerHandoff.vmx_storage_class, 'external_ssd');
  assert.equal(writerHandoff.vm_identity, vmIdentity);
  assert.equal(writerHandoff.vmx_path, canonicalVmxPath);
  assert.equal(writerHandoff.vmx_sha256, vmxSha256);
  assert.equal(
    writerHandoff.external_volume_uuid.toUpperCase(),
    diskIdentity.volumeUuid.toUpperCase(),
  );
  assert.equal(writerHandoff.next_owner_id, options.currentOwnerId);

  const artifactSha256 = sha256File(options.candidateZip);
  assert.equal(
    artifactSha256,
    options.expectedArtifactSha256.toLowerCase(),
    'candidate ZIP SHA256 changed',
  );

  const schemaPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'windows-wsl2-v6-receipt.schema.json',
  );
  const validateSchema = createGuestValidator(schemaPath);
  const expected = {
    appSha: options.expectedAppSha.toLowerCase(),
    shellSha: options.expectedShellSha.toLowerCase(),
    frameworkSha: options.expectedFrameworkSha.toLowerCase(),
    artifactSha256,
    writerHandoffSha256,
    vmIdentity,
  };
  const stoppedEvidence = validateGuestReceipt({
    receipt: readJson(options.stoppedGuestReceipt),
    receiptPath: options.stoppedGuestReceipt,
    screenshotPath: options.stoppedScreenshot,
    expectedPhase: 'stopped',
    expected,
    validateSchema,
  });
  const runningEvidence = validateGuestReceipt({
    receipt: readJson(options.runningGuestReceipt),
    receiptPath: options.runningGuestReceipt,
    screenshotPath: options.runningScreenshot,
    expectedPhase: 'running',
    expected,
    validateSchema,
  });
  assert.notEqual(
    stoppedEvidence.run_id,
    runningEvidence.run_id,
    'stopped and running evidence must use distinct RunId values',
  );

  const runningBeforeShutdown = dependencies.listRunningVms(options);
  assert.ok(
    runningBeforeShutdown.some(
      (candidate) =>
        path.resolve(candidate) === path.resolve(canonicalVmxPath),
    ),
    'authorized VM is not powered on before the requested soft shutdown',
  );
  dependencies.stopVmSoft(canonicalVmxPath, options);
  await waitForPowerOff(canonicalVmxPath, options, dependencies);

  const releasedAt = dependencies.now().toISOString();
  fs.mkdirSync(options.outputDir, { recursive: true });
  const releasePath = path.join(options.outputDir, 'writer-release.json');
  const finalReceiptPath = path.join(
    options.outputDir,
    'v6-host-closeout-receipt.json',
  );
  const writerRelease = {
    schema: 'opl_vm_writer_release.v1',
    vmx_storage_class: 'external_ssd',
    vm_identity: vmIdentity,
    previous_owner_task_id: options.currentOwnerId,
    receipt_id: options.releaseReceiptId,
    released_at: releasedAt,
    vmx_path: canonicalVmxPath,
    vmx_sha256: vmxSha256,
    external_volume_uuid: diskIdentity.volumeUuid,
    external_device_identifier: diskIdentity.deviceIdentifier,
    soft_shutdown_requested: true,
    powered_off_readback: true,
    next_owner_id: null,
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
    artifact: {
      sha256: artifactSha256,
      file_name: path.basename(options.candidateZip),
    },
    vm: {
      identity: vmIdentity,
      vmx_path: canonicalVmxPath,
      vmx_sha256: vmxSha256,
      bios_uuid: vmBiosUuid,
      storage_class: 'external_ssd',
      external_volume_uuid: diskIdentity.volumeUuid,
      external_device_identifier: diskIdentity.deviceIdentifier,
      bus_protocol: diskIdentity.busProtocol,
      solid_state: diskIdentity.solidState,
      powered_off_readback: true,
    },
    writer_handoff: {
      receipt_sha256: writerHandoffSha256,
      previous_owner_task_id: writerHandoff.previous_owner_task_id,
      receipt_id: writerHandoff.receipt_id,
      released_at: writerHandoff.released_at,
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
    error: String(error?.message ?? error).replaceAll(/[\r\n]+/g, ' ').slice(0, 500),
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
