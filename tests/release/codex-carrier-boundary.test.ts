import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  type ShellAdapterContract,
  validateCodexExecutableContract,
} from '../../scripts/app-shell-adapter.ts';

const readAdapter = (relativePath: string): ShellAdapterContract =>
  JSON.parse(fs.readFileSync(relativePath, 'utf8')) as ShellAdapterContract;

test('AionUI and Native share a carrier-neutral Codex executable boundary', () => {
  const aionui = readAdapter('contracts/app-shell-adapter.json');
  const native = readAdapter('contracts/shell-adapters/opl-native-workbench.json');

  assert.doesNotThrow(() => validateCodexExecutableContract(aionui));
  assert.doesNotThrow(() => validateCodexExecutableContract(native));
  assert.ok(aionui.codex_executable_contract);
  assert.ok(native.codex_executable_contract);
  assert.equal(aionui.codex_executable_contract.resolver_env, native.codex_executable_contract.resolver_env);
  assert.equal(aionui.codex_executable_contract.protocol, native.codex_executable_contract.protocol);
  assert.equal(
    aionui.codex_executable_contract.thread_store_owner,
    native.codex_executable_contract.thread_store_owner,
  );
});

test('AionUI cannot restore the duplicate Framework Codex payload', () => {
  const aionui = structuredClone(readAdapter('contracts/app-shell-adapter.json'));
  assert.ok(aionui.codex_executable_contract);
  aionui.codex_executable_contract.carrier.framework_managed_payload_in_app_bundle_allowed = true;

  assert.throws(
    () => validateCodexExecutableContract(aionui),
    /must not embed the Framework-managed Codex payload/,
  );
});

test('Full App contract delegates Codex to AionCore and omits the Framework manifest component', async () => {
  const releaseChannel = JSON.parse(
    fs.readFileSync('contracts/app-release-channel.json', 'utf8'),
  );
  const codex = releaseChannel.full_first_install.required_payloads.codex_cli;
  assert.equal(codex.compatibility_mode, 'shell_carrier_exact_manifest_binary');
  assert.equal(codex.resolver_env, 'OPL_CODEX_BIN');
  assert.equal(codex.aioncore_required, true);
  assert.equal(codex.framework_managed_payload_in_full_runtime_allowed, false);
  assert.deepEqual(codex.forbidden_framework_runtime_paths, [
    'bin/codex',
    'bin/rg',
    'vendor/codex',
    '.runtime-cache/codex-cli',
  ]);

  const { buildFullPackageManifest } = await import('../../scripts/full-first-install-package.ts');
  const manifest = buildFullPackageManifest();
  assert.equal(Object.prototype.hasOwnProperty.call(manifest.components, 'codex'), false);
  assert.deepEqual(
    manifest.opl_runtime_bundle_consumer.runtime_fabric_bundle_taxonomy['execution-core.bundle'].components,
    ['temporal_cli', 'opl'],
  );
});

test('Native adoption cannot inherit the AionCore carrier', () => {
  const native = structuredClone(readAdapter('contracts/shell-adapters/opl-native-workbench.json'));
  assert.ok(native.codex_executable_contract);
  native.codex_executable_contract.carrier = {
    kind: 'aioncore_managed_resources_manifest',
    source_ref: 'manual_qualification_contract.runtime_dependencies.aioncore.resource_authority',
    manifest_parser_owner: 'gaofeng21cn/opl-aion-shell',
    aioncore_required: true,
    framework_managed_payload_in_app_bundle_allowed: false,
  };

  assert.throws(
    () => validateCodexExecutableContract(native),
    /must remain independent from AionCore/,
  );
});
