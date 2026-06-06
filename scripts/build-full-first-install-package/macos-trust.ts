import fs from 'node:fs';
import path from 'node:path';

import {
  MACOS_NATIVE_CODE_EXTENSIONS,
  MACOS_TRUSTED_EXECUTABLE_PATTERNS,
} from './paths.ts';
import { run, runCapture } from './process.ts';

export function canRunMacosSigningChecks() {
  return process.platform === 'darwin';
}

function strictMacosRuntimeSigningRequired() {
  return process.env.OPL_MAC_STRICT_SIGNING_CHECKS === 'true';
}

function macosSigningIdentity() {
  return process.env.OPL_RUNTIME_CODESIGN_IDENTITY?.trim()
    || process.env.identity?.trim()
    || process.env.CSC_NAME?.trim()
    || process.env.IDENTITY?.trim()
    || '';
}

function relativeRuntimePath(runtimeRoot, filePath) {
  return `runtime/current/${path.relative(runtimeRoot, filePath).split(path.sep).join('/')}`;
}

function isNativeRuntimeExecutable(relativePath, stat) {
  if (!stat.isFile()) {
    return false;
  }
  if (MACOS_NATIVE_CODE_EXTENSIONS.has(path.extname(relativePath))) {
    return true;
  }
  if ((stat.mode & 0o111) === 0) {
    return false;
  }
  return MACOS_TRUSTED_EXECUTABLE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function requiresGatekeeperExecutableAssessment(relativePath, stat) {
  return stat.isFile()
    && (stat.mode & 0o111) !== 0
    && MACOS_TRUSTED_EXECUTABLE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function listFullRuntimeNativeExecutables(runtimeRoot) {
  if (!fs.existsSync(runtimeRoot)) {
    return [];
  }
  const results = [];
  const stack = [runtimeRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.lstatSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current).sort().reverse()) {
        stack.push(path.join(current, entry));
      }
      continue;
    }
    if (stat.isSymbolicLink()) {
      continue;
    }
    const relativePath = relativeRuntimePath(runtimeRoot, current);
    if (isNativeRuntimeExecutable(relativePath, stat)) {
      results.push({
        path: current,
        relative_path: relativePath,
        requires_spctl: requiresGatekeeperExecutableAssessment(relativePath, stat),
      });
    }
  }
  return results.sort((left, right) => left.relative_path.localeCompare(right.relative_path));
}

function hasExtendedAttribute(filePath, attributeName) {
  const result = runCapture('xattr', ['-p', attributeName, filePath]);
  return result.status === 0;
}

function readCodeSignature(filePath) {
  const result = runCapture('codesign', ['-dv', '--verbose=4', filePath]);
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  return {
    status: result.status === 0 ? 'passed' : 'failed',
    team_identifier: output.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim() || null,
    signature: output.match(/^Signature=(.+)$/m)?.[1]?.trim() || null,
    raw: output.trim(),
  };
}

function signMacosRuntimeExecutable(filePath, identity) {
  if (!identity) {
    return;
  }
  run('codesign', [
    '--force',
    '--options',
    'runtime',
    '--timestamp',
    '--sign',
    identity,
    filePath,
  ]);
}

function verifyMacosRuntimeExecutable(filePath, options) {
  const codesignResult = runCapture('codesign', ['--verify', '--strict', '--verbose=2', filePath]);
  const shouldAssessSpctl = options.requiresSpctl && options.assessSpctl === true;
  const spctlResult = shouldAssessSpctl
    ? runCapture('spctl', ['--assess', '--type', 'execute', '--verbose=4', filePath])
    : { status: 0, stdout: '', stderr: '' };
  const signature = readCodeSignature(filePath);
  const quarantinePresent = hasExtendedAttribute(filePath, 'com.apple.quarantine');
  const provenancePresent = hasExtendedAttribute(filePath, 'com.apple.provenance');
  const codesignPassed = codesignResult.status === 0;
  const spctlPassed = spctlResult.status === 0;
  const result = {
    codesign_status: codesignPassed ? 'passed' : options.strict ? 'failed' : 'failed_allowed_unsigned',
    spctl_status: shouldAssessSpctl
      ? (spctlPassed ? 'passed' : options.strict ? 'failed' : 'failed_allowed_unsigned')
      : options.requiresSpctl ? 'deferred_until_notarized_app' : 'not_required',
    team_identifier: signature.team_identifier,
    signature: signature.signature,
    quarantine_status: quarantinePresent ? 'present' : 'absent',
    provenance_status: provenancePresent ? 'present' : 'absent',
    assessment_kind: options.requiresSpctl ? 'launched_executable' : 'loadable_native_code',
  };

  const failed = result.codesign_status !== 'passed'
    || (shouldAssessSpctl && result.spctl_status !== 'passed')
    || result.quarantine_status !== 'absent'
    || !result.team_identifier
    || result.signature === 'adhoc';
  if (options.strict && failed) {
    const detail = [
      `Full runtime native executable is not trusted by Gatekeeper: ${filePath}`,
      `codesign_status=${result.codesign_status}`,
      `spctl_status=${result.spctl_status}`,
      `team_identifier=${result.team_identifier ?? 'missing'}`,
      `signature=${result.signature ?? 'missing'}`,
      `quarantine_status=${result.quarantine_status}`,
      `provenance_status=${result.provenance_status}`,
      codesignResult.stderr?.trim() ? `codesign stderr:\n${codesignResult.stderr.trim()}` : '',
      spctlResult.stderr?.trim() ? `spctl stderr:\n${spctlResult.stderr.trim()}` : '',
    ].filter(Boolean).join('\n');
    throw new Error(detail);
  }
  return result;
}

export function ensureFullRuntimeNativeTrust(runtimeRoot) {
  const executables = listFullRuntimeNativeExecutables(runtimeRoot);
  const strict = strictMacosRuntimeSigningRequired();
  const identity = macosSigningIdentity();
  if (strict && !canRunMacosSigningChecks()) {
    throw new Error('Full runtime native executable signing verification requires a macOS runner.');
  }
  if (strict && !identity) {
    throw new Error('Full runtime native executable signing requires OPL_RUNTIME_CODESIGN_IDENTITY, identity, CSC_NAME, or IDENTITY.');
  }

  if (!canRunMacosSigningChecks()) {
    return {
      schema: 'opl_full_runtime_native_trust.v1',
      platform: process.platform,
      status: strict ? 'failed' : 'skipped_non_macos',
      strict,
      signed: false,
      executable_count: executables.length,
      executables: executables.map((entry) => ({
        relative_path: entry.relative_path,
        codesign_status: 'not_checked',
        spctl_status: 'not_checked',
        quarantine_status: 'not_checked',
        provenance_status: 'not_checked',
      })),
    };
  }

  for (const executable of executables) {
    if (identity) {
      signMacosRuntimeExecutable(executable.path, identity);
    }
  }

  const verified = executables.map((entry) => ({
    relative_path: entry.relative_path,
    ...verifyMacosRuntimeExecutable(entry.path, {
      strict,
      requiresSpctl: entry.requires_spctl,
      assessSpctl: false,
    }),
  }));
  const signed = verified.every((entry) => (
    entry.codesign_status === 'passed'
    && entry.quarantine_status === 'absent'
    && entry.team_identifier
    && entry.signature !== 'adhoc'
  ));
  const localAuthorizedUnsigned = !strict && verified.every((entry) => entry.quarantine_status === 'absent');
  return {
    schema: 'opl_full_runtime_native_trust.v1',
    platform: process.platform,
    status: signed ? 'signed_pending_gatekeeper_assessment' : localAuthorizedUnsigned ? 'local_authorized_unsigned' : 'not_distributable',
    strict,
    signed: Boolean(identity),
    executable_count: verified.length,
    executables: verified,
  };
}

export function ensureAppBundleAdHocCodesign(appPath, label) {
  if (!canRunMacosSigningChecks()) {
    return;
  }
  const initial = runCapture('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
  if (initial.status === 0) {
    return;
  }
  run('codesign', ['--force', '--deep', '--sign', '-', appPath]);
  const verified = runCapture('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
  if (verified.status !== 0) {
    throw new Error([
      `${label} ad-hoc codesign did not produce a verifiable App bundle: ${appPath}`,
      initial.stderr?.trim() ? `initial codesign stderr:\n${initial.stderr.trim()}` : '',
      verified.stdout?.trim() ? `verified codesign stdout:\n${verified.stdout.trim()}` : '',
      verified.stderr?.trim() ? `verified codesign stderr:\n${verified.stderr.trim()}` : '',
    ].filter(Boolean).join('\n'));
  }
}

export function assertAppBundleLocalAuthorization(appPath, label) {
  if (!canRunMacosSigningChecks()) {
    return;
  }
  const codesign = runCapture('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
  const spctl = runCapture('spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath]);
  if (strictMacosRuntimeSigningRequired() && (codesign.status !== 0 || spctl.status !== 0)) {
    throw new Error([
      `${label} failed Stable local authorization codesign verification: ${appPath}`,
      codesign.stdout?.trim() ? `codesign stdout:\n${codesign.stdout.trim()}` : '',
      codesign.stderr?.trim() ? `codesign stderr:\n${codesign.stderr.trim()}` : '',
      `spctl status=${spctl.status}`,
      spctl.stdout?.trim() ? `spctl stdout:\n${spctl.stdout.trim()}` : '',
      spctl.stderr?.trim() ? `spctl stderr:\n${spctl.stderr.trim()}` : '',
    ].filter(Boolean).join('\n'));
  }
  if (codesign.status !== 0 || spctl.status !== 0) {
    if (codesign.status !== 0) {
      throw new Error([
        `${label} codesign verification must pass even when Stable Full uses local authorization: ${appPath}`,
        codesign.stdout?.trim() ? `codesign stdout:\n${codesign.stdout.trim()}` : '',
        codesign.stderr?.trim() ? `codesign stderr:\n${codesign.stderr.trim()}` : '',
      ].filter(Boolean).join('\n'));
    }
    console.warn([
      `${label} uses Stable unsigned local authorization diagnostics: ${appPath}`,
      'codesign_status=passed',
      `spctl_status=${spctl.status === 0 ? 'passed' : 'rejected_allowed_unsigned'}`,
    ].join('\n'));
  }
}

export function verifyDmgAppBundleLocalAuthorization(dmgPath, label) {
  if (!canRunMacosSigningChecks()) {
    return;
  }
  const mountPoint = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-verify-'));
  try {
    run('hdiutil', ['attach', dmgPath, '-nobrowse', '-readonly', '-mountpoint', mountPoint]);
    const appPath = fs.readdirSync(mountPoint)
      .filter((entry) => entry.endsWith('.app'))
      .sort()
      .map((entry) => path.join(mountPoint, entry))
      .find((candidate) => fs.existsSync(candidate));
    if (!appPath) {
      throw new Error(`${label} does not contain a .app bundle: ${dmgPath}`);
    }
    assertAppBundleLocalAuthorization(appPath, label);
  } finally {
    runCapture('hdiutil', ['detach', mountPoint]);
    fs.rmSync(mountPoint, { recursive: true, force: true });
  }
}
