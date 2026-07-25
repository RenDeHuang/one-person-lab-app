#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP_REPOSITORY = 'https://github.com/gaofeng21cn/one-person-lab-app.git';
const SHELL_REPOSITORY = 'https://github.com/gaofeng21cn/opl-aion-shell.git';
const SHELL_SHA = '868d6e818583547a5ec982b10b34464a3fa47c10';
const SHELL_TREE_SHA = '1dc9960a357d9f64eaaac7eadf44b9c1a1d00ca7';
const SHELL_VALIDATION_TREE_SHA = '6f8519a26c3075f8b252c79a81e42f328c6efbb8';
const SHELL_BUN_LOCK_SHA256 =
  '8975e67539a778ef9058419d990646b21ce35757d4cdaf45e0b101e4ce3cff7b';
const SHELL_BUILD_SCRIPT_SHA256 =
  '5d1511a89038ca583bceb27881c8f025ce1575b0f0059535145382894c0cd381';
const SHELL_HARNESS_PACKAGE_SHA256 =
  '0a12c4887a746e465978ced9439cdef6f9a7a994c94e43bd0c5f1208f64737c5';
const FRAMEWORK_FIXTURE_SHA = 'fe1fafa26f2c59922596718b305761bbc7558c9c';
const VALIDATION_ROOT =
  'C:\\Users\\Public\\Documents\\OnePersonLabValidation\\windows-wsl2-v6-v1';
const VM_NAME = 'OPL-V6-WSL2-01';

const packetFiles = [
  {
    source: 'fixtures/v6-build-seal.ps1',
    role: 'windows_source_build_and_create_once_seal',
  },
  {
    source: 'fixtures/v6-electron-visible-smoke.ps1',
    role: 'windows_guest_stopped_and_running_visible_smoke',
  },
  {
    source: 'fixtures/v6-host-closeout.mjs',
    role: 'windows_hyperv_terminal_closeout',
  },
  {
    source: 'windows-wsl2-v6-intake-manifest.schema.json',
    role: 'intake_manifest_schema',
  },
  {
    source: 'windows-wsl2-v6-build-seal.schema.json',
    role: 'build_seal_receipt_schema',
  },
  {
    source: 'windows-wsl2-v6-receipt.schema.json',
    role: 'guest_visible_smoke_receipt_schema',
  },
  {
    source: 'windows-wsl2-v6-host-closeout.schema.json',
    role: 'terminal_host_closeout_receipt_schema',
  },
  {
    source: 'windows-wsl2-v6-writer-lease.schema.json',
    role: 'windows_platform_owner_writer_lease_schema',
  },
];

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function runGit(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(
    result.status,
    0,
    `git ${args.join(' ')} failed: ${String(result.stderr || result.error?.message).trim()}`,
  );
  return result.stdout.trim();
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    const value = argv[index + 1];
    assert.match(token ?? '', /^--(?:app-sha|output-dir)$/);
    assert.ok(value && !value.startsWith('--'), `${token} requires a value`);
    result[token.slice(2).replaceAll(/-([a-z])/g, (_, letter) =>
      letter.toUpperCase(),
    )] = value;
  }
  assert.match(result.appSha ?? '', /^[0-9a-f]{40}$/);
  assert.ok(result.outputDir, '--output-dir is required');
  return result;
}

export function buildIntakeManifest({
  appSha,
  appTreeSha,
  files,
}) {
  return {
    schema: 'opl_windows_wsl2_v6_intake_manifest.v1',
    validation_state: 'validation_only_non_binding',
    authority: 'one_person_lab_app_acceptance_contract',
    terminal_v6_verdict: false,
    target: {
      host_platform: 'windows_hyperv',
      vm_name: VM_NAME,
      validation_root: VALIDATION_ROOT,
      clean_vm_required: true,
      platform_owner_writer_lease_required: true,
    },
    source_refs: {
      app_acceptance_sha: appSha,
      app_acceptance_tree_sha: appTreeSha,
      app_repository: APP_REPOSITORY,
      shell: {
        repository: SHELL_REPOSITORY,
        git_sha: SHELL_SHA,
        root_tree_sha: SHELL_TREE_SHA,
        validation_tree_sha: SHELL_VALIDATION_TREE_SHA,
        bun_lock_sha256: SHELL_BUN_LOCK_SHA256,
        build_script_sha256: SHELL_BUILD_SCRIPT_SHA256,
        harness_package_sha256: SHELL_HARNESS_PACKAGE_SHA256,
      },
      framework_fixture_sha: FRAMEWORK_FIXTURE_SHA,
    },
    toolchain_contract: {
      node_range: '>=22 <25',
      electron_version: '37.10.3',
      electron_builder_manifest_range: '^26.6.0',
      electron_builder_lock_version: '26.8.1',
      package_manager: 'bun',
      package_install_argv: [
        'install',
        '--frozen-lockfile',
        '--ignore-scripts',
      ],
      focused_test_script: 'test:windows:wsl2:validation',
      build_script: 'build:windows:wsl2:validation',
      builder_override_policy: 'all_overrides_must_be_absent',
      output_policy: 'fresh_unique_checkout_and_output_absent',
    },
    artifact_contract: {
      source_zip_relative_path:
        'out/windows-wsl2-validation/OPL Windows WSL2 Validation-0.0.0-validation.0-win.zip',
      source_executable_relative_path:
        'out/windows-wsl2-validation/win-unpacked/OPL Windows WSL2 Validation.exe',
      sealed_zip_file_name: 'OPL-Windows-WSL2-Validation-v6.zip',
      root_executable_file_name: 'OPL Windows WSL2 Validation.exe',
      identity_authority: 'create_once_build_seal_receipt',
      historical_zip_sha256_authoritative: false,
    },
    execution_contract: {
      phases: ['stopped', 'running'],
      distinct_run_ids_required: true,
      same_build_receipt_required: true,
      same_zip_and_tree_identity_required: true,
      target_window_screenshot_required: true,
      candidate_process_survivor_count: 0,
      wsl_process_survivor_count: 0,
      host_soft_shutdown_required: true,
      powered_off_readback_required: true,
    },
    prohibited_operations: [
      'legacy_imac_vm_execution',
      'docker_prune',
      'global_wsl_shutdown',
      'wsl_unregister',
      'hard_vm_poweroff_as_pass',
      'public_release_or_promotion',
    ],
    packet_files: files,
  };
}

export function materializePacket({ appSha, outputDir, appRoot }) {
  assert.equal(runGit(['rev-parse', 'HEAD'], appRoot), appSha);
  assert.equal(
    runGit(['status', '--porcelain', '--untracked-files=all'], appRoot),
    '',
    'App packet checkout must be clean',
  );
  const appTreeSha = runGit(['rev-parse', `${appSha}^{tree}`], appRoot);
  assert.match(appTreeSha, /^[0-9a-f]{40}$/);
  assert.equal(
    fs.existsSync(outputDir),
    false,
    `packet output already exists: ${outputDir}`,
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const validationRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  );
  const files = [];
  for (const entry of packetFiles) {
    const sourcePath = path.join(validationRoot, entry.source);
    const destinationName = path.basename(entry.source);
    const destinationPath = path.join(outputDir, destinationName);
    const bytes = fs.readFileSync(sourcePath);
    fs.writeFileSync(destinationPath, bytes, { flag: 'wx' });
    files.push({
      file_name: destinationName,
      role: entry.role,
      size_bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }
  files.sort((left, right) => left.file_name.localeCompare(right.file_name));

  const manifest = buildIntakeManifest({ appSha, appTreeSha, files });
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const manifestPath = path.join(
    outputDir,
    'windows-wsl2-v6-intake-manifest.json',
  );
  fs.writeFileSync(manifestPath, manifestBytes, { flag: 'wx' });
  return {
    manifestPath,
    manifestSha256: sha256(manifestBytes),
    appSha,
    appTreeSha,
    packetFileCount: files.length + 1,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const appRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    '..',
  );
  const result = materializePacket({
    appSha: options.appSha,
    outputDir: path.resolve(options.outputDir),
    appRoot,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main();
}
