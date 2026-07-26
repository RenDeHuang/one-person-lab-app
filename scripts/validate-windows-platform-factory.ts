#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platformRoot = path.join(appRoot, 'docs', 'delivery', 'validation', 'windows-platform');
const v6Root = path.join(appRoot, 'docs', 'delivery', 'validation', 'windows-wsl2');
const sourceCustodianTaskId = '019f9bc5-8707-78b2-b221-5453d9d9b855';

type Inputs = {
  postResizeGate?: string;
  v6Request?: string;
  webuiRequest?: string;
  platformLease?: string;
  writerLease?: string;
};

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function compileSchema(filePath: string) {
  const ajv = new Ajv2020({ allErrors: true, strictSchema: true, strictTypes: false });
  addFormats(ajv);
  return ajv.compile(readJson(filePath));
}

function validateFile(schemaPath: string, valuePath: string, label: string) {
  const validate = compileSchema(schemaPath);
  const value = readJson(valuePath);
  assert.equal(validate(value), true, `${label}: ${JSON.stringify(validate.errors)}`);
  return value as Record<string, any>;
}

function collectStrings(value: unknown, result: string[] = []): string[] {
  if (typeof value === 'string') result.push(value);
  if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, result);
  } else if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) collectStrings(entry, result);
  }
  return result;
}

export function assertWindowsPlatformAuthorityBindings(
  value: Record<string, any>,
  label = 'Windows authority contract',
) {
  const platformOwnerTaskId = value.platform_owner_task_id;
  const executorTaskId = value.executor_task_id ?? value.execution_owner_thread;
  assert.notEqual(platformOwnerTaskId, sourceCustodianTaskId, `${label}: source custodian cannot own the Windows platform`);
  assert.notEqual(executorTaskId, sourceCustodianTaskId, `${label}: source custodian cannot execute Windows host work`);
  if (value.vm_name === 'OPL-V6-WSL2-01') {
    assert.notEqual(executorTaskId, platformOwnerTaskId, `${label}: V6 executor must be distinct from the platform owner`);
  } else if (value.vm_name === 'OPL-WEBUI-CLEAN-01') {
    assert.equal(executorTaskId, platformOwnerTaskId, `${label}: WebUI VM remains platform-owned`);
  }
  if (value.lease_transition) {
    assert.equal(value.lease_transition.next_owner_thread, executorTaskId, `${label}: request next owner mismatch`);
  }
  if ('next_owner_thread' in value) {
    assert.equal(value.next_owner_thread, executorTaskId, `${label}: lease next owner mismatch`);
  }
}

function parseArgs(argv: string[]): Inputs {
  const inputs: Inputs = {};
  const allowed = new Map<string, keyof Inputs>([
    ['--post-resize-gate', 'postResizeGate'],
    ['--v6-request', 'v6Request'],
    ['--webui-request', 'webuiRequest'],
    ['--platform-lease', 'platformLease'],
    ['--writer-lease', 'writerLease'],
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    assert.ok(key && allowed.has(key), `Unknown argument: ${key ?? '<missing>'}`);
    assert.ok(value && !value.startsWith('--'), `${key} requires a path`);
    inputs[allowed.get(key)!] = path.resolve(value);
  }
  return inputs;
}

export function validateWindowsPlatformFactoryContract(inputs: Inputs = {}) {
  const planPath = path.join(platformRoot, 'windows-platform-factory-plan.json');
  const requestSchemaPath = path.join(platformRoot, 'windows-platform-vm-request.schema.json');
  const platformLeaseSchemaPath = path.join(platformRoot, 'windows-platform-vm-lease.schema.json');
  const cleanAttestationSchemaPath = path.join(
    platformRoot,
    'windows-platform-clean-vm-attestation.schema.json',
  );
  const postResizeSchemaPath = path.join(platformRoot, 'windows-platform-post-resize-gate.schema.json');
  const writerLeaseSchemaPath = path.join(v6Root, 'windows-wsl2-v6-writer-lease.schema.json');
  const requestGeneratorPath = path.join(platformRoot, 'fixtures', 'New-OPLWindowsVMRequest.ps1');

  const plan = readJson(planPath) as Record<string, any>;
  assert.equal(plan.schema, 'opl_windows_platform_factory_plan.v1');
  assert.equal(plan.source_custodian_task_id, sourceCustodianTaskId);
  assert.equal(plan.platform_owner_task_id, null);
  assert.equal(plan.platform_host_activation_required, true);
  assert.equal(plan.factory_root, 'C:\\OPL-VMs');
  assert.equal(plan.recovery_source.root, 'E:\\_Original-E-20260726\\OPL-VMs');
  assert.equal(plan.recovery_source.delete_authorized, false);
  assert.deepEqual(
    plan.targets.map((target: Record<string, unknown>) => target.vm_name).sort(),
    ['OPL-V6-WSL2-01', 'OPL-WEBUI-CLEAN-01'].sort(),
  );
  assert.equal(new Set(plan.targets.map((target: Record<string, unknown>) => target.guest_root)).size, 2);
  assert.equal(new Set(plan.targets.map((target: Record<string, unknown>) => target.receipt_namespace)).size, 2);
  assert.equal(new Set(plan.targets.map((target: any) => target.network.subnet)).size, 2);
  assert.ok(plan.targets.every((target: any) => target.webui_runtime_authority === 0));
  const v6Target = plan.targets.find((target: any) => target.vm_name === 'OPL-V6-WSL2-01');
  const webuiTarget = plan.targets.find((target: any) => target.vm_name === 'OPL-WEBUI-CLEAN-01');
  assert.equal(v6Target.execution_owner_thread, null);
  assert.equal(v6Target.executor_activation_required, true);
  assert.equal(webuiTarget.execution_owner_thread, null);
  assert.equal(webuiTarget.executor_activation_required, false);

  for (const schemaPath of [
    requestSchemaPath,
    platformLeaseSchemaPath,
    cleanAttestationSchemaPath,
    postResizeSchemaPath,
    writerLeaseSchemaPath,
  ]) {
    compileSchema(schemaPath);
  }
  assert.doesNotMatch(fs.readFileSync(requestSchemaPath, 'utf8'), /E:\\\\OPL-VMs/);
  assert.doesNotMatch(fs.readFileSync(platformLeaseSchemaPath, 'utf8'), /E:\\\\OPL-VMs/);
  assert.match(fs.readFileSync(requestGeneratorPath, 'utf8'), /\$canonicalRoot = 'C:\\OPL-VMs'/);
  assert.doesNotMatch(fs.readFileSync(requestGeneratorPath, 'utf8'), /E:\\OPL-VMs/);
  assert.deepEqual(
    [...plan.required_script_receipt_names].sort(),
    [
      'Grant-OPLV6WriterLease.ps1',
      'Grant-OPLVMLease.ps1',
      'New-OPLVMIsolatedNetwork.ps1',
      'New-OPLWindows11VM.ps1',
      'Seal-OPLCleanWindowsBaseline.ps1',
      'Test-OPLHyperVStorageCompatibility.ps1',
    ].sort(),
  );
  for (const scriptName of plan.required_script_receipt_names) {
    const scriptPath = path.join(platformRoot, 'fixtures', scriptName);
    const script = fs.readFileSync(scriptPath, 'utf8');
    assert.ok(script.includes("$canonicalRoot = 'C:\\OPL-VMs'"));
    assert.doesNotMatch(script, /E:\\OPL-VMs/);
    assert.doesNotMatch(script, /Get-Volume -DriveLetter E/);
  }

  const runtime: Record<string, Record<string, any>> = {};
  if (inputs.postResizeGate) {
    runtime.postResizeGate = validateFile(postResizeSchemaPath, inputs.postResizeGate, 'post-resize gate');
  }
  if (inputs.v6Request) {
    runtime.v6Request = validateFile(requestSchemaPath, inputs.v6Request, 'V6 request');
    assert.equal(runtime.v6Request.vm_name, 'OPL-V6-WSL2-01');
    assertWindowsPlatformAuthorityBindings(runtime.v6Request, 'V6 request');
  }
  if (inputs.webuiRequest) {
    runtime.webuiRequest = validateFile(requestSchemaPath, inputs.webuiRequest, 'WebUI request');
    assert.equal(runtime.webuiRequest.vm_name, 'OPL-WEBUI-CLEAN-01');
    assertWindowsPlatformAuthorityBindings(runtime.webuiRequest, 'WebUI request');
  }
  if (runtime.v6Request && runtime.webuiRequest) {
    const v6Strings = new Set(collectStrings(runtime.v6Request.exclusive_paths));
    const webuiStrings = collectStrings(runtime.webuiRequest.exclusive_paths);
    assert.equal(webuiStrings.some((entry) => v6Strings.has(entry)), false, 'VM exclusive paths overlap');
    assert.notEqual(runtime.v6Request.network.subnet, runtime.webuiRequest.network.subnet);
    assert.notEqual(runtime.v6Request.receipt_namespace, runtime.webuiRequest.receipt_namespace);
  }
  if (inputs.platformLease) {
    runtime.platformLease = validateFile(platformLeaseSchemaPath, inputs.platformLease, 'platform lease');
    assertWindowsPlatformAuthorityBindings(runtime.platformLease, 'platform lease');
  }
  if (inputs.writerLease) {
    runtime.writerLease = validateFile(writerLeaseSchemaPath, inputs.writerLease, 'V6 writer lease');
    assertWindowsPlatformAuthorityBindings(runtime.writerLease, 'V6 writer lease');
  }

  return {
    factoryRoot: plan.factory_root,
    recoverySource: plan.recovery_source.root,
    targetCount: plan.targets.length,
    runtimeInputsValidated: Object.keys(runtime),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(validateWindowsPlatformFactoryContract(parseArgs(process.argv.slice(2))))}\n`);
}
