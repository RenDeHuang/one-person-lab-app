#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertLocalAuthorizationPolicy } from './local-authorization-policy.ts';

function parseArgs(argv) {
  const parsed = {
    repo: process.env.OPL_RELEASE_REPO || 'gaofeng21cn/one-person-lab-app',
    version: process.env.OPL_RELEASE_VERSION || '',
    tag: process.env.OPL_RELEASE_TAG || '',
    includeFullPackage: false,
    downloadDir: process.env.OPL_REMOTE_RELEASE_DOWNLOAD_DIR || '',
    noDownload: false,
    keepDownload: false,
    summaryPath: process.env.OPL_REMOTE_RELEASE_SUMMARY_PATH || '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--include-full-package') {
      parsed.includeFullPackage = true;
      continue;
    }
    if (token === '--no-download') {
      parsed.noDownload = true;
      continue;
    }
    if (token === '--keep-download') {
      parsed.keepDownload = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    index += 1;
    if (token === '--repo') parsed.repo = value;
    else if (token === '--version') parsed.version = value;
    else if (token === '--tag') parsed.tag = value;
    else if (token === '--download-dir') parsed.downloadDir = path.resolve(value);
    else if (token === '--summary-path') parsed.summaryPath = path.resolve(value);
    else throw new Error(`Unknown argument: ${token}`);
  }

  if (!parsed.tag && parsed.version) {
    parsed.tag = `v${parsed.version}`;
  }
  if (!parsed.version && /^v/.test(parsed.tag)) {
    parsed.version = parsed.tag.slice(1);
  }
  if (!parsed.version || !parsed.tag) {
    throw new Error('Pass --version <version> or --tag <tag>.');
  }
  if (!/^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/.test(parsed.version)) {
    throw new Error(`Invalid OPL release version: ${parsed.version}`);
  }
  return parsed;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    const detail = options.capture ? `\nstdout=${result.stdout || ''}\nstderr=${result.stderr || ''}` : '';
    throw new Error(`Command failed: ${command} ${args.join(' ')}${detail}`);
  }
  return result;
}

function runCapture(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
  });
}

function readReleaseView(repo, tag) {
  if (process.env.OPL_REMOTE_RELEASE_VIEW_JSON?.trim()) {
    return JSON.parse(process.env.OPL_REMOTE_RELEASE_VIEW_JSON);
  }
  const result = run('gh', [
    'release',
    'view',
    tag,
    '--repo',
    repo,
    '--json',
    'tagName,name,isDraft,isPrerelease,publishedAt,assets',
  ], { capture: true });
  return JSON.parse(result.stdout);
}

function requiredAssetNames(version, includeFullPackage) {
  const standard = [
    `One-Person-Lab-${version}-mac-arm64.dmg`,
    `One-Person-Lab-${version}-mac-arm64.zip`,
    `One-Person-Lab-${version}-mac-arm64.dmg.blockmap`,
    `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
    'latest-mac.yml',
    'latest-arm64-mac.yml',
    'standard-local-authorization-policy.json',
  ];
  if (!includeFullPackage) {
    return standard;
  }
  return [
    ...standard,
    `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
    'full-package-manifest.json',
    'runtime-cache-events.json',
    'full-runtime-native-trust.json',
    'README-Full-First-Install.txt',
    'SHA256SUMS.txt',
    'full-local-authorization-policy.json',
  ];
}

function fileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const fd = fs.openSync(filePath, 'r');
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
      }
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function normalizeDigest(digest) {
  if (typeof digest !== 'string') {
    return '';
  }
  const match = digest.trim().match(/^sha256:(?<hash>[a-f0-9]{64})$/i);
  return match?.groups?.hash?.toLowerCase() || '';
}

function downloadAssets(options, names, downloadDir) {
  fs.mkdirSync(downloadDir, { recursive: true });
  if (options.noDownload) {
    return;
  }
  for (const name of names) {
    run('gh', [
      'release',
      'download',
      options.tag,
      '--repo',
      options.repo,
      '--pattern',
      name,
      '--dir',
      downloadDir,
      '--clobber',
    ]);
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertStandardMetadata(downloadDir, version) {
  const expectedAssets = [
    `One-Person-Lab-${version}-mac-arm64.dmg`,
    `One-Person-Lab-${version}-mac-arm64.zip`,
  ];
  for (const name of ['latest-mac.yml', 'latest-arm64-mac.yml']) {
    const metadataPath = path.join(downloadDir, name);
    const text = readText(metadataPath);
    if (/One[ .-]Person[ .-]Lab[ .-]Full-|One-Person-Lab-Full-|Full-/i.test(text)) {
      throw new Error(`${name} references Full first-install assets.`);
    }
    if (!new RegExp(`^version:\\s*['"]?${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\\s*$`, 'm').test(text)) {
      throw new Error(`${name} does not declare version ${version}.`);
    }
    for (const expectedAsset of expectedAssets) {
      if (!text.includes(expectedAsset)) {
        throw new Error(`${name} does not reference ${expectedAsset}.`);
      }
    }
  }
}

function assertStableLocalAuthorizationPolicy(downloadDir, name, packageKind) {
  const policy = JSON.parse(readText(path.join(downloadDir, name)));
  assertLocalAuthorizationPolicy(policy, packageKind, name);
  return policy;
}

function readCodeSignature(filePath) {
  const result = runCapture('codesign', ['-dv', '--verbose=4', filePath]);
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  return {
    signature: output.match(/^Signature=(.+)$/m)?.[1]?.trim() || null,
    team_identifier: output.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim() || null,
  };
}

function findStandardAppBundle(rootDir) {
  const matches = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory()) {
      continue;
    }
    if (path.basename(current) === 'One Person Lab.app') {
      matches.push(current);
      continue;
    }
    for (const entry of fs.readdirSync(current).sort().reverse()) {
      stack.push(path.join(current, entry));
    }
  }
  if (matches.length !== 1) {
    throw new Error(`standard updater ZIP must contain exactly one One Person Lab.app bundle; found ${matches.length}.`);
  }
  return matches[0];
}

function decodeXmlText(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function readPlistStringValue(plistPath, key) {
  const plistBuddy = '/usr/libexec/PlistBuddy';
  if (fs.existsSync(plistBuddy)) {
    const result = runCapture(plistBuddy, ['-c', `Print :${key}`, plistPath]);
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
  }
  const text = readText(plistPath);
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`<key>\\s*${escapedKey}\\s*</key>\\s*<string>([^<]*)</string>`));
  return match?.[1] ? decodeXmlText(match[1].trim()) : '';
}

function assertStandardUpdaterAppBundleTrust(downloadDir, version, localAuthorizationPolicy) {
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const zipPath = path.join(downloadDir, zipName);
  const unzipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-standard-updater-app-'));
  try {
    run('unzip', ['-q', zipPath, '-d', unzipDir], { capture: true });
    const appPath = findStandardAppBundle(unzipDir);
    const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
    if (!fs.existsSync(infoPlistPath)) {
      throw new Error('standard updater ZIP App bundle is missing Contents/Info.plist.');
    }
    const shortVersion = readPlistStringValue(infoPlistPath, 'CFBundleShortVersionString');
    const bundleVersion = readPlistStringValue(infoPlistPath, 'CFBundleVersion');
    if (shortVersion !== version && bundleVersion !== version) {
      throw new Error(`standard updater ZIP App bundle version mismatch: expected ${version}, got CFBundleShortVersionString=${shortVersion || '(empty)'} CFBundleVersion=${bundleVersion || '(empty)'}.`);
    }

    const codesignResult = runCapture('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
    const signature = readCodeSignature(appPath);
    const spctlResult = runCapture('spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath]);
    const codesignPassed = codesignResult.status === 0;
    const spctlPassed = spctlResult.status === 0;
    const hasDeveloperIdSignature = Boolean(
      signature.team_identifier
      && signature.team_identifier !== 'not set'
      && signature.signature
      && signature.signature !== 'adhoc'
    );
    return {
      status: hasDeveloperIdSignature && codesignPassed && spctlPassed ? 'passed' : 'local_authorized_unsigned',
      asset: zipName,
      version,
      bundle_version: bundleVersion || null,
      short_version: shortVersion || null,
      signature: signature.signature,
      team_identifier: signature.team_identifier,
      codesign_status: codesignPassed ? 'passed' : 'failed_allowed_unsigned',
      spctl_status: spctlPassed ? 'passed' : codesignPassed ? 'rejected_allowed_unsigned' : 'failed_allowed_unsigned',
      apple_developer_id_required: localAuthorizationPolicy.apple_developer_id_required,
      gatekeeper_required: localAuthorizationPolicy.gatekeeper_required,
      local_authorization_policy: 'standard-local-authorization-policy.json',
    };
  } finally {
    fs.rmSync(unzipDir, { recursive: true, force: true });
  }
}

function requiredFullRuntimeNativeTrustPaths(manifest) {
  const temporalBinaryPath = manifest?.components?.temporal_cli?.binary_path;
  return [
    'runtime/current/node/bin/node',
    ...(typeof temporalBinaryPath === 'string' && temporalBinaryPath
      ? [temporalBinaryPath]
      : []),
  ];
}

function assertFullRuntimeNativeTrust(downloadDir, manifest) {
  const trust = JSON.parse(readText(path.join(downloadDir, 'full-runtime-native-trust.json')));
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

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function assertSafePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function parseSha256Sums(text) {
  const entries = new Map();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const match = trimmed.match(/^(?<hash>[a-f0-9]{64})\s+\*?(?<name>.+)$/i);
    if (!match?.groups) {
      throw new Error(`Invalid SHA256SUMS.txt line: ${line}`);
    }
    entries.set(match.groups.name.trim(), match.groups.hash.toLowerCase());
  }
  return entries;
}

function readFullRuntimeUncompressedBytes(manifest) {
  const sizeBreakdown = assertPlainObject(manifest?.size_breakdown, 'Full manifest size_breakdown');
  return assertSafePositiveInteger(
    sizeBreakdown.total_runtime_uncompressed_bytes,
    'Full manifest size_breakdown.total_runtime_uncompressed_bytes',
  );
}

function assertFullComponent(manifest, componentId) {
  const components = assertPlainObject(manifest.components, 'Full manifest components');
  return assertPlainObject(components[componentId], `Full manifest components.${componentId}`);
}

function assertFullOptionalComponent(manifest, componentId) {
  const optionalComponents = assertPlainObject(manifest.optional_components, 'Full manifest optional_components');
  return assertPlainObject(optionalComponents[componentId], `Full manifest optional_components.${componentId}`);
}

function assertFullSizeBudget(manifest, fullDmgAssetSize) {
  if (manifest?.manifest_version !== 2) {
    throw new Error(`Full manifest must declare manifest_version=2; got ${manifest?.manifest_version}`);
  }

  const sizeBudget = assertPlainObject(manifest.size_budget, 'Full manifest size_budget');
  const measurementPolicy = assertPlainObject(manifest.measurement_policy, 'Full manifest measurement_policy');
  if (sizeBudget.platform_scope !== 'macos-arm64') {
    throw new Error(`Full size budget platform_scope must be macos-arm64; got ${sizeBudget.platform_scope}`);
  }
  if (measurementPolicy.full_dmg_bytes !== 'github_release_asset_size_bytes') {
    throw new Error(`Full measurement policy full_dmg_bytes must be github_release_asset_size_bytes; got ${measurementPolicy.full_dmg_bytes}`);
  }
  if (measurementPolicy.runtime_uncompressed_bytes !== 'manifest_size_breakdown_total_runtime_uncompressed_bytes') {
    throw new Error(`Full measurement policy runtime_uncompressed_bytes must be manifest_size_breakdown_total_runtime_uncompressed_bytes; got ${measurementPolicy.runtime_uncompressed_bytes}`);
  }

  const warningFullDmgBytes = assertSafePositiveInteger(sizeBudget.warning_full_dmg_bytes, 'Full manifest size_budget.warning_full_dmg_bytes');
  const maxFullDmgBytes = assertSafePositiveInteger(sizeBudget.max_full_dmg_bytes, 'Full manifest size_budget.max_full_dmg_bytes');
  const maxRuntimeUncompressedBytes = assertSafePositiveInteger(
    sizeBudget.max_runtime_uncompressed_bytes,
    'Full manifest size_budget.max_runtime_uncompressed_bytes',
  );
  const runtimeUncompressedBytes = readFullRuntimeUncompressedBytes(manifest);
  const runtimeAssertions = assertPlainObject(manifest.runtime_assertions, 'Full manifest runtime_assertions');
  if (!Array.isArray(runtimeAssertions.temporal_core_bridge_releases)) {
    throw new Error('Full manifest runtime_assertions.temporal_core_bridge_releases must be an array.');
  }
  if (
    runtimeAssertions.temporal_core_bridge_releases.length !== 1
    || runtimeAssertions.temporal_core_bridge_releases[0] !== 'aarch64-apple-darwin'
  ) {
    throw new Error(
      `Full runtime Temporal core-bridge releases must be only aarch64-apple-darwin; got ${runtimeAssertions.temporal_core_bridge_releases.join(', ')}`,
    );
  }
  if (runtimeAssertions.excluded_module_venv_count !== 0) {
    throw new Error(
      `Full runtime must not package modules/*/.venv directories; count=${runtimeAssertions.excluded_module_venv_count}`,
    );
  }
  const codex = assertFullComponent(manifest, 'codex');
  if (codex.required !== true || codex.role !== 'default_agent_cli_offline_archive_wrapper') {
    throw new Error('Full manifest components.codex must be a required default_agent_cli_offline_archive_wrapper component.');
  }
  if (!String(codex.version || '').startsWith('codex-cli ')) {
    throw new Error(`Full manifest components.codex.version must record codex --version; got ${codex.version}`);
  }
  if (codex.binary_path !== null) {
    throw new Error(`Full manifest components.codex.binary_path must be null for archive-only packaging; got ${codex.binary_path}`);
  }
  if (codex.archive_path !== 'runtime/current/vendor/codex/codex_cli_darwin_arm64.tar.gz') {
    throw new Error(`Full manifest components.codex.archive_path is unexpected: ${codex.archive_path}`);
  }
  assertSafePositiveInteger(codex.archive_size_bytes, 'Full manifest components.codex.archive_size_bytes');

  const temporalCli = assertFullComponent(manifest, 'temporal_cli');
  if (temporalCli.required !== true || temporalCli.role !== 'temporal_cli_offline_archive_wrapper') {
    throw new Error('Full manifest components.temporal_cli must be a required temporal_cli_offline_archive_wrapper component.');
  }
  if (!String(temporalCli.version || '').startsWith('temporal version ')) {
    throw new Error(`Full manifest components.temporal_cli.version must record temporal --version; got ${temporalCli.version}`);
  }
  if (temporalCli.binary_path !== null) {
    throw new Error(`Full manifest components.temporal_cli.binary_path must be null for archive-only packaging; got ${temporalCli.binary_path}`);
  }
  if (temporalCli.archive_path !== 'runtime/current/vendor/temporal/temporal_cli_darwin_arm64.tar.gz') {
    throw new Error(`Full manifest components.temporal_cli.archive_path is unexpected: ${temporalCli.archive_path}`);
  }
  assertSafePositiveInteger(temporalCli.archive_size_bytes, 'Full manifest components.temporal_cli.archive_size_bytes');

  const bun = assertFullOptionalComponent(manifest, 'bun');
  if (bun.required !== false || bun.role !== 'optional_bun_cli_runtime_payload') {
    throw new Error('Full manifest optional_components.bun must be optional_bun_cli_runtime_payload and not required.');
  }
  if (!['packaged', 'not_packaged'].includes(bun.status)) {
    throw new Error(`Full manifest optional_components.bun.status must be packaged or not_packaged; got ${bun.status}`);
  }
  if (bun.status === 'packaged' && !bun.version) {
    throw new Error('Full manifest optional_components.bun.version is required when Bun is packaged.');
  }

  if (runtimeUncompressedBytes > maxRuntimeUncompressedBytes) {
    throw new Error(`Full runtime uncompressed size budget exceeded: ${runtimeUncompressedBytes} > ${maxRuntimeUncompressedBytes}`);
  }

  const warnings = [];
  const fullDmgSizeStatus = fullDmgAssetSize >= warningFullDmgBytes ? 'warning' : 'passed';
  if (fullDmgAssetSize > maxFullDmgBytes) {
    warnings.push({
      code: 'full_dmg_size_above_review_threshold',
      message: `Full DMG size ${fullDmgAssetSize} is above review threshold ${maxFullDmgBytes}.`,
      full_dmg_size_bytes: fullDmgAssetSize,
      threshold_bytes: maxFullDmgBytes,
    });
  } else if (fullDmgAssetSize >= warningFullDmgBytes) {
    warnings.push({
      code: 'full_dmg_size_warning',
      message: `Full DMG size ${fullDmgAssetSize} is above warning threshold ${warningFullDmgBytes}.`,
      full_dmg_size_bytes: fullDmgAssetSize,
      threshold_bytes: warningFullDmgBytes,
    });
  }

  return {
    status: 'passed',
    platform_scope: sizeBudget.platform_scope,
    full_dmg_bytes_policy: measurementPolicy.full_dmg_bytes,
    runtime_uncompressed_bytes_policy: measurementPolicy.runtime_uncompressed_bytes,
    warning_full_dmg_bytes: warningFullDmgBytes,
    max_full_dmg_bytes: maxFullDmgBytes,
    max_runtime_uncompressed_bytes: maxRuntimeUncompressedBytes,
    full_dmg_size_bytes: fullDmgAssetSize,
    full_dmg_size_status: fullDmgSizeStatus,
    runtime_uncompressed_bytes: runtimeUncompressedBytes,
    warnings,
    temporal_core_bridge_releases: runtimeAssertions.temporal_core_bridge_releases,
    excluded_module_venv_count: runtimeAssertions.excluded_module_venv_count,
    required_components: {
      temporal_cli: {
        version: temporalCli.version,
        size_bytes: temporalCli.size_bytes,
        archive_path: temporalCli.archive_path,
        archive_size_bytes: temporalCli.archive_size_bytes,
      },
    },
    optional_components: {
      bun: {
        status: bun.status,
        version: bun.version ?? null,
        size_bytes: bun.size_bytes ?? 0,
      },
    },
  };
}

function assertFullAssets(downloadDir, version, verifiedAssets) {
  const fullDmgName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  const checksumEntries = parseSha256Sums(readText(path.join(downloadDir, 'SHA256SUMS.txt')));
  for (const name of [
    fullDmgName,
    'full-package-manifest.json',
    'runtime-cache-events.json',
    'full-runtime-native-trust.json',
    'README-Full-First-Install.txt',
    'full-local-authorization-policy.json',
  ]) {
    const expected = checksumEntries.get(name);
    if (!expected) {
      throw new Error(`SHA256SUMS.txt is missing ${name}.`);
    }
    const actual = fileSha256(path.join(downloadDir, name));
    if (actual !== expected) {
      throw new Error(`SHA256SUMS.txt mismatch for ${name}: expected ${expected}, got ${actual}.`);
    }
  }
  const manifest = JSON.parse(readText(path.join(downloadDir, 'full-package-manifest.json')));
  if (manifest.version !== version) {
    throw new Error(`Full manifest version mismatch: expected ${version}, got ${manifest.version}`);
  }
  if (manifest?.distribution?.updater_metadata_allowed !== false) {
    throw new Error('Full manifest must declare distribution.updater_metadata_allowed=false.');
  }
  if (manifest?.package_kind !== 'opl_full_first_install_macos_arm64') {
    throw new Error(`Unexpected Full manifest package_kind: ${manifest?.package_kind}`);
  }
  assertStableLocalAuthorizationPolicy(downloadDir, 'full-local-authorization-policy.json', 'app_full_first_install');
  assertFullRuntimeNativeTrust(downloadDir, manifest);

  const runtimeCacheEvents = JSON.parse(readText(path.join(downloadDir, 'runtime-cache-events.json')));
  if (!Array.isArray(runtimeCacheEvents?.events) || runtimeCacheEvents.events.length === 0) {
    throw new Error('runtime-cache-events.json must include non-empty runtime cache events.');
  }

  const readme = readText(path.join(downloadDir, 'README-Full-First-Install.txt'));
  if (/[\u3400-\u9fff]/.test(readme)) {
    throw new Error('README-Full-First-Install.txt must remain English-only.');
  }

  const fullDmgAsset = verifiedAssets.find((asset) => asset.name === fullDmgName);
  if (!fullDmgAsset) {
    throw new Error(`Verified assets are missing ${fullDmgName}.`);
  }
  return assertFullSizeBudget(manifest, fullDmgAsset.size);
}

function verifyDownloadedAssets(releaseView, options, names, downloadDir) {
  const assets = Array.isArray(releaseView.assets) ? releaseView.assets : [];
  const assetsByName = new Map(assets.map((asset) => [asset?.name, asset]));
  const verified = [];

  for (const name of names) {
    const asset = assetsByName.get(name);
    if (!asset) {
      throw new Error(`Remote release ${options.tag} is missing asset ${name}.`);
    }
    const filePath = path.join(downloadDir, name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Downloaded release asset not found: ${filePath}`);
    }
    const stat = fs.statSync(filePath);
    if (Number(asset.size) !== stat.size) {
      throw new Error(`Remote asset size mismatch for ${name}: expected ${asset.size}, got ${stat.size}.`);
    }
    const expectedDigest = normalizeDigest(asset.digest);
    const actualDigest = fileSha256(filePath);
    if (!expectedDigest) {
      throw new Error(`Remote asset ${name} does not expose a sha256 digest.`);
    }
    if (actualDigest !== expectedDigest) {
      throw new Error(`Remote asset sha256 mismatch for ${name}: expected ${expectedDigest}, got ${actualDigest}.`);
    }
    verified.push({
      name,
      size: stat.size,
      sha256: actualDigest,
    });
  }

  assertStandardMetadata(downloadDir, options.version);
  const standardLocalAuthorizationPolicy = assertStableLocalAuthorizationPolicy(downloadDir, 'standard-local-authorization-policy.json', 'app_standard');
  const standardUpdaterAppBundleTrust = assertStandardUpdaterAppBundleTrust(downloadDir, options.version, standardLocalAuthorizationPolicy);
  let fullFirstInstallBudget = null;
  if (options.includeFullPackage) {
    fullFirstInstallBudget = assertFullAssets(downloadDir, options.version, verified);
  }
  return {
    verified,
    standardUpdaterAppBundleTrust,
    fullFirstInstallBudget,
  };
}

function writeSummary(summaryPath, summary) {
  if (!summaryPath) {
    return;
  }
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const downloadDir = options.downloadDir || fs.mkdtempSync(path.join(os.tmpdir(), 'opl-remote-release-'));
  const releaseView = readReleaseView(options.repo, options.tag);
  const names = requiredAssetNames(options.version, options.includeFullPackage);

  if (releaseView.tagName && releaseView.tagName !== options.tag) {
    throw new Error(`Release tag mismatch: expected ${options.tag}, got ${releaseView.tagName}`);
  }

  downloadAssets(options, names, downloadDir);
  const verification = verifyDownloadedAssets(releaseView, options, names, downloadDir);
  const summary = {
    status: 'passed',
    repo: options.repo,
    tag: options.tag,
    version: options.version,
    include_full_package: options.includeFullPackage,
    download_dir: options.keepDownload || options.noDownload ? downloadDir : null,
    verified_asset_count: verification.verified.length,
    verified_assets: verification.verified,
    standard_updater_app_bundle_trust: verification.standardUpdaterAppBundleTrust,
    ...(verification.fullFirstInstallBudget
      ? { full_first_install_budget: verification.fullFirstInstallBudget }
      : {}),
  };
  writeSummary(options.summaryPath, summary);
  console.log(JSON.stringify(summary, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
