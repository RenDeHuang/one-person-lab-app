import fs from 'node:fs';

function requiredFullRuntimeNativeTrustPaths(manifest: any): string[] {
  const temporalBinaryPath = manifest?.components?.temporal_cli?.binary_path;
  return [
    'runtime/current/node/bin/node',
    ...(typeof temporalBinaryPath === 'string' && temporalBinaryPath
      ? [temporalBinaryPath]
      : []),
  ];
}

export function assertFullRuntimeNativeTrustObject(
  trust: any,
  manifest: any,
  options: { missingMessage?: string } = {},
): void {
  if (!trust || typeof trust !== 'object' || Array.isArray(trust)) {
    throw new Error(options.missingMessage ?? 'full-runtime-native-trust.json must record Full runtime native executable diagnostics.');
  }
  if (trust?.schema !== 'opl_full_runtime_native_trust.v1' || !['passed', 'local_authorized_unsigned', 'not_distributable', 'failed'].includes(trust?.status)) {
    throw new Error('full-runtime-native-trust.json must record Full runtime native executable diagnostics.');
  }
  const executables = Array.isArray(trust.executables) ? trust.executables : [];
  if (executables.length === 0 || trust.executable_count !== executables.length) {
    throw new Error('full-runtime-native-trust.json must list the checked native executables.');
  }
  for (const required of requiredFullRuntimeNativeTrustPaths(manifest)) {
    if (!executables.some((entry) => entry?.relative_path === required)) {
      throw new Error(`full-runtime-native-trust.json is missing ${required}.`);
    }
  }
  for (const entry of executables) {
    if (
      !['passed', 'failed_allowed_unsigned'].includes(entry?.codesign_status) ||
      !['passed', 'not_required', 'deferred_until_notarized_app', 'failed_allowed_unsigned'].includes(entry?.spctl_status) ||
      entry?.quarantine_status !== 'absent'
    ) {
      throw new Error(`Full runtime native executable is not locally authorized: ${entry?.relative_path || '(unknown)'}.`);
    }
  }
}

export function assertFullRuntimeNativeTrustFile(
  trustPath: string,
  manifest: any,
  options: { missingMessage?: string } = {},
): void {
  if (options.missingMessage && !fs.existsSync(trustPath)) {
    throw new Error(options.missingMessage);
  }
  const trust = JSON.parse(fs.readFileSync(trustPath, 'utf8'));
  assertFullRuntimeNativeTrustObject(trust, manifest);
}
