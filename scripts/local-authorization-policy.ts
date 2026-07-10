#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';

const LOCAL_AUTHORIZATION_POLICY_SCHEMA = 'opl_local_authorized_macos_policy.v1';
const ALL_DESCENDANTS = ['**/*', '**/.*', '**/.*/**/*'];

export function assertLocalAuthorizationPolicy(policy, packageKind, name = 'local authorization policy') {
  if (
    policy?.schema !== LOCAL_AUTHORIZATION_POLICY_SCHEMA
    || policy?.package_kind !== packageKind
    || policy?.stable_release_path !== 'local_authorized_unsigned'
    || policy?.apple_developer_id_required !== false
    || policy?.gatekeeper_required !== false
    || policy?.local_authorization_required !== true
    || policy?.quarantine_removal_required !== true
    || policy?.install_entrypoint !== 'install.sh --stable-macos-install --yes'
    || !Array.isArray(policy?.compatibility_entrypoints)
    || !policy.compatibility_entrypoints.includes('install-stable.sh')
  ) {
    throw new Error(`${name} must declare the Stable local-authorized macOS install policy for ${packageKind}.`);
  }
  if (!['passed', 'failed_allowed_unsigned'].includes(policy.codesign_status)) {
    throw new Error(`${name} must record a passed or allowed unsigned codesign diagnostic for ${packageKind}.`);
  }
  if (!['passed', 'rejected_allowed_unsigned', 'failed_allowed_unsigned'].includes(policy.spctl_status)) {
    throw new Error(`${name} must record a passed or allowed unsigned spctl diagnostic for ${packageKind}.`);
  }
  if (!['absent', 'removed_by_installer'].includes(policy.quarantine_status)) {
    throw new Error(`${name} must prove quarantine is absent or removed by the Stable installer for ${packageKind}.`);
  }
}

function parseArgs(argv) {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      'package-kind': { type: 'string' },
      'app-path': { type: 'string' },
      output: { type: 'string' },
      'runtime-native-trust': { type: 'string' },
    } as const,
    allowPositionals: false,
    strict: true,
  });
  const parsed = {
    packageKind: values['package-kind'] ?? '',
    appPath: values['app-path'] ? path.resolve(values['app-path']) : '',
    output: values.output ? path.resolve(values.output) : '',
    runtimeNativeTrustPath: values['runtime-native-trust'] ? path.resolve(values['runtime-native-trust']) : '',
  };
  if (!['app_standard', 'app_full_first_install'].includes(parsed.packageKind)) {
    throw new Error(`Unsupported package kind: ${parsed.packageKind || '(empty)'}`);
  }
  if (!parsed.appPath) {
    throw new Error('Pass --app-path <path>.');
  }
  if (!parsed.output) {
    throw new Error('Pass --output <path>.');
  }
  return parsed;
}

function runCapture(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function commandStatus(command, args) {
  if (!commandExists(command)) {
    return 'skipped_missing_command';
  }
  return runCapture(command, args).status === 0 ? 'passed' : 'failed';
}

function commandExists(command) {
  return runCapture('bash', ['-lc', `command -v ${JSON.stringify(command)} >/dev/null 2>&1`]).status === 0;
}

function quarantineCount(target) {
  if (!commandExists('xattr') || !fs.existsSync(target)) {
    return null;
  }
  const symlinks = new Set();
  const descendants = fs.lstatSync(target).isDirectory()
    ? fs.globSync(ALL_DESCENDANTS, {
      cwd: target,
      withFileTypes: true,
      exclude(entry) {
        if (entry.isSymbolicLink()) {
          symlinks.add(path.join(entry.parentPath, entry.name));
          return true;
        }
        return false;
      },
    }).map((entry) => path.join(entry.parentPath, entry.name))
    : [];
  let count = 0;
  for (const current of [target, ...descendants, ...symlinks]) {
    if (runCapture('xattr', ['-p', 'com.apple.quarantine', current]).status === 0) count += 1;
  }
  return count;
}

function loadRuntimeNativeTrust(filePath) {
  if (!filePath) {
    return null;
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Runtime native trust file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildPolicy(options) {
  const quarantineAttrCount = quarantineCount(options.appPath);
  const codesignRawStatus = commandStatus('codesign', ['--verify', '--deep', '--strict', '--verbose=2', options.appPath]);
  const spctlRawStatus = commandStatus('spctl', ['--assess', '--type', 'execute', '--verbose=4', options.appPath]);
  const runtimeNativeTrust = loadRuntimeNativeTrust(options.runtimeNativeTrustPath);
  return {
    schema: LOCAL_AUTHORIZATION_POLICY_SCHEMA,
    package_kind: options.packageKind,
    stable_release_path: 'local_authorized_unsigned',
    apple_developer_id_required: false,
    gatekeeper_required: false,
    local_authorization_required: true,
    quarantine_removal_required: true,
    install_entrypoint: 'install.sh --stable-macos-install --yes',
    compatibility_entrypoints: ['install-stable.sh'],
    default_package_profile: options.packageKind === 'app_full_first_install' ? 'full' : 'standard',
    user_prompt_policy: 'one_terminal_command_no_system_settings_override_expected_after_quarantine_clear',
    app_path: options.appPath,
    codesign_status: codesignRawStatus === 'passed' ? 'passed' : 'failed_allowed_unsigned',
    spctl_status: spctlRawStatus === 'passed'
      ? 'passed'
      : codesignRawStatus === 'passed' ? 'rejected_allowed_unsigned' : 'failed_allowed_unsigned',
    quarantine_status: quarantineAttrCount === 0 ? 'absent' : 'present',
    quarantine_attribute_count: quarantineAttrCount,
    runtime_native_trust_status: runtimeNativeTrust?.status ?? null,
    runtime_native_executable_count: runtimeNativeTrust?.executable_count ?? null,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const policy = buildPolicy(options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(policy, null, 2)}\n`, 'utf8');
  assertLocalAuthorizationPolicy(policy, options.packageKind, path.basename(options.output));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
