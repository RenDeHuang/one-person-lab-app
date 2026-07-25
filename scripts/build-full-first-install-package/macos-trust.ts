import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { run, runCapture } from './process.ts';

export function canRunMacosSigningChecks() {
  return process.platform === 'darwin';
}

export function strictMacosRuntimeSigningRequired() {
  return process.env.OPL_MAC_STRICT_SIGNING_CHECKS === 'true';
}

function macosSigningIdentity() {
  return process.env.OPL_RUNTIME_CODESIGN_IDENTITY
    || process.env.identity
    || process.env.CSC_NAME
    || process.env.IDENTITY
    || '';
}

export function codesignOutputLines(codesign, prefix = 'codesign') {
  return [
    codesign.stdout?.trim() ? `${prefix} stdout:\n${codesign.stdout.trim()}` : '',
    codesign.stderr?.trim() ? `${prefix} stderr:\n${codesign.stderr.trim()}` : '',
  ];
}

export function ensureAppBundleAdHocCodesign(appPath, label) {
  if (!canRunMacosSigningChecks()) {
    return;
  }
  const strict = strictMacosRuntimeSigningRequired();
  const initial = runCapture('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
  const initialDetails = strict ? runCapture('codesign', ['-dv', '--verbose=4', appPath]) : null;
  const initialSignature = initialDetails
    ? `${initialDetails.stdout || ''}${initialDetails.stderr || ''}`.match(/^Signature=(.+)$/m)?.[1]?.trim()
    : null;
  const initialTeamIdentifier = initialDetails
    ? `${initialDetails.stdout || ''}${initialDetails.stderr || ''}`.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim()
    : null;
  if (initial.status === 0 && (!strict || (initialTeamIdentifier && initialSignature !== 'adhoc'))) {
    return;
  }
  const identity = macosSigningIdentity();
  if (strict && !identity) {
    throw new Error(`${label} requires a Developer ID signing identity.`);
  }
  const signingArgs = strict
    ? [
        '--force',
        '--timestamp',
        '--options',
        'runtime',
        '--preserve-metadata=identifier,entitlements,requirements,flags,runtime',
        '--sign',
        identity,
        appPath,
      ]
    : ['--force', '--deep', '--sign', '-', appPath];
  run('codesign', signingArgs);
  const verified = runCapture('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
  if (verified.status !== 0) {
    throw new Error([
      `${label} signing did not produce a verifiable App bundle: ${appPath}`,
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
  if (strictMacosRuntimeSigningRequired()) {
    const details = runCapture('codesign', ['-dv', '--verbose=4', appPath]);
    const signatureOutput = `${details.stdout || ''}${details.stderr || ''}`;
    const teamIdentifier = signatureOutput.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim() || '';
    const signature = signatureOutput.match(/^Signature=(.+)$/m)?.[1]?.trim() || '';
    if (codesign.status !== 0 || !teamIdentifier || signature === 'adhoc') {
      throw new Error([
        `${label} failed Developer ID signing verification before notarization: ${appPath}`,
        ...codesignOutputLines(codesign),
        `team_identifier=${teamIdentifier || 'missing'}`,
        `signature=${signature || 'missing'}`,
      ].filter(Boolean).join('\n'));
    }
    return;
  }
  if (codesign.status !== 0) {
    throw new Error([
      `${label} failed Stable local authorization codesign verification: ${appPath}`,
      ...codesignOutputLines(codesign),
      `spctl status=${spctl.status}`,
      spctl.stdout?.trim() ? `spctl stdout:\n${spctl.stdout.trim()}` : '',
      spctl.stderr?.trim() ? `spctl stderr:\n${spctl.stderr.trim()}` : '',
    ].filter(Boolean).join('\n'));
  }
  if (spctl.status !== 0) {
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
