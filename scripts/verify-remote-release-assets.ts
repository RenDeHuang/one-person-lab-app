#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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
  ];
  if (!includeFullPackage) {
    return standard;
  }
  return [
    ...standard,
    `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
    'full-package-manifest.json',
    'README-Full-First-Install.txt',
    'SHA256SUMS.txt',
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

  const maxFullDmgBytes = assertSafePositiveInteger(sizeBudget.max_full_dmg_bytes, 'Full manifest size_budget.max_full_dmg_bytes');
  const maxRuntimeUncompressedBytes = assertSafePositiveInteger(
    sizeBudget.max_runtime_uncompressed_bytes,
    'Full manifest size_budget.max_runtime_uncompressed_bytes',
  );
  const runtimeUncompressedBytes = readFullRuntimeUncompressedBytes(manifest);

  if (fullDmgAssetSize > maxFullDmgBytes) {
    throw new Error(`Full DMG size budget exceeded: ${fullDmgAssetSize} > ${maxFullDmgBytes}`);
  }
  if (runtimeUncompressedBytes > maxRuntimeUncompressedBytes) {
    throw new Error(`Full runtime uncompressed size budget exceeded: ${runtimeUncompressedBytes} > ${maxRuntimeUncompressedBytes}`);
  }

  return {
    status: 'passed',
    platform_scope: sizeBudget.platform_scope,
    full_dmg_bytes_policy: measurementPolicy.full_dmg_bytes,
    runtime_uncompressed_bytes_policy: measurementPolicy.runtime_uncompressed_bytes,
    max_full_dmg_bytes: maxFullDmgBytes,
    max_runtime_uncompressed_bytes: maxRuntimeUncompressedBytes,
    full_dmg_size_bytes: fullDmgAssetSize,
    runtime_uncompressed_bytes: runtimeUncompressedBytes,
  };
}

function assertFullAssets(downloadDir, version, verifiedAssets) {
  const fullDmgName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  const checksumEntries = parseSha256Sums(readText(path.join(downloadDir, 'SHA256SUMS.txt')));
  for (const name of [fullDmgName, 'full-package-manifest.json', 'README-Full-First-Install.txt']) {
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
  let fullFirstInstallBudget = null;
  if (options.includeFullPackage) {
    fullFirstInstallBudget = assertFullAssets(downloadDir, options.version, verified);
  }
  return {
    verified,
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
