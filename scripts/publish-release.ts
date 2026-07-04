#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveActiveShellPaths } from './app-shell-adapter.ts';
import { buildReleaseNotesDocument, buildReleaseNotesEvidence, buildReleaseTitle } from './release-notes.ts';
import { buildAiReleaseNotesDocument } from './release-notes-ai-writer.ts';
import { assertLocalAuthorizationPolicy } from './local-authorization-policy.ts';
import { fileSha256 } from './release-file-helpers.ts';
import { assertFullRuntimeNativeTrustFile } from './full-runtime-native-trust.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultFullPackageDir = path.resolve(repoRoot, 'dist', 'opl-full-release');
const defaultUploadAttempts = 3;
const defaultUploadTimeoutMs = 5 * 60 * 1000;

function resolveShellRootEnv() {
  return process.env.OPL_APP_SHELL_ROOT || process.env.OPL_AION_SHELL_ROOT || resolveActiveShellPaths().shellRoot;
}

function defaultReleaseVersion() {
  const now = process.env.OPL_RELEASE_DATE
    ? new Date(`${process.env.OPL_RELEASE_DATE}T00:00:00Z`)
    : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid OPL_RELEASE_DATE: ${process.env.OPL_RELEASE_DATE}`);
  }
  return `${String(now.getFullYear()).slice(-2)}.${now.getMonth() + 1}.${now.getDate()}`;
}

function parseArgs(argv) {
  const parsed = {
    shellRoot: resolveShellRootEnv(),
    releaseRepo: process.env.OPL_RELEASE_REPO || 'gaofeng21cn/one-person-lab-app',
    version: process.env.OPL_RELEASE_VERSION || '',
    versionExplicit: Boolean(process.env.OPL_RELEASE_VERSION),
    macArch: process.env.OPL_RELEASE_MAC_ARCH || 'arm64',
    standardArtifactsDir: process.env.OPL_STANDARD_ARTIFACTS_DIR || '',
    fullPackageDir: process.env.OPL_FULL_PACKAGE_DIR || '',
    build: true,
    includeFullPackage: false,
    fullPackageOnly: false,
    dryRun: false,
    forceUpload: false,
    draft: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--no-build') {
      parsed.build = false;
      continue;
    }
    if (token === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    if (token === '--force-upload') {
      parsed.forceUpload = true;
      continue;
    }
    if (token === '--draft') {
      parsed.draft = true;
      continue;
    }
    if (token === '--include-full-package') {
      parsed.includeFullPackage = true;
      if (!parsed.fullPackageDir) {
        parsed.fullPackageDir = defaultFullPackageDir;
      }
      continue;
    }
    if (token === '--full-package-only') {
      parsed.fullPackageOnly = true;
      parsed.includeFullPackage = true;
      parsed.build = false;
      if (!parsed.fullPackageDir) {
        parsed.fullPackageDir = defaultFullPackageDir;
      }
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    if (token === '--shell-root') {
      parsed.shellRoot = path.resolve(value);
      index += 1;
      continue;
    }
    if (token === '--repo') {
      parsed.releaseRepo = value;
      index += 1;
      continue;
    }
    if (token === '--version') {
      parsed.version = value;
      parsed.versionExplicit = true;
      index += 1;
      continue;
    }
    if (token === '--mac-arch') {
      parsed.macArch = value;
      index += 1;
      continue;
    }
    if (token === '--standard-artifacts-dir') {
      parsed.standardArtifactsDir = path.resolve(value);
      parsed.build = false;
      index += 1;
      continue;
    }
    if (token === '--full-package-dir') {
      parsed.fullPackageDir = path.resolve(value);
      parsed.includeFullPackage = true;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!['arm64', 'x64', 'universal'].includes(parsed.macArch)) {
    throw new Error(`Unsupported macOS release architecture: ${parsed.macArch}`);
  }
  if (parsed.fullPackageOnly && !parsed.includeFullPackage) {
    throw new Error('--full-package-only requires --include-full-package or --full-package-dir.');
  }
  if (!parsed.version) {
    parsed.version = defaultReleaseVersion();
  }
  return parsed;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: process.env,
    timeout: options.timeoutMs,
  });
  if (result.status !== 0) {
    const detail = options.capture ? `\nstdout=${result.stdout || ''}\nstderr=${result.stderr || ''}` : '';
    const timedOut = result.error?.code === 'ETIMEDOUT' ? '\nreason=timeout' : '';
    throw new Error(`Command failed: ${command} ${args.join(' ')}${timedOut}${detail}`);
  }
  return result;
}

const guiArtifactPrefixes = ['One Person Lab-', 'One.Person.Lab-', 'One-Person-Lab-'];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function artifactMatchesMacArch(name, macArch) {
  return name.includes(`-mac-${macArch}`);
}

function metadataMatchesMacArch(metadata, macArch) {
  return metadata.includes(`-mac-${macArch}.`);
}

function assertStandardArtifactDoesNotContainFullRuntime(shellRoot, version, macArch) {
  const appPath = path.join(resolveActiveShellPaths({ shellRoot }).buildOutputDir, `mac-${macArch}`, 'One Person Lab.app');
  if (!fs.existsSync(appPath)) {
    return;
  }
  const fullRuntimePath = path.join(appPath, 'Contents', 'Resources', 'opl-full-runtime', 'runtime', 'current');
  if (fs.existsSync(fullRuntimePath)) {
    throw new Error(
      `Standard App release ${version} ${macArch} contains Full runtime payload at ${fullRuntimePath}; run release:prepare-standard before building standard assets.`,
    );
  }
}

function assertUpdaterMetadataDoesNotReferenceFullPackage(releaseDir, files) {
  for (const name of files) {
    if (!/^latest.*\.yml$/.test(name)) {
      continue;
    }
    const metadata = fs.readFileSync(path.join(releaseDir, name), 'utf8');
    if (/One[ .-]Person[ .-]Lab[ .-]Full-|One-Person-Lab-Full-/.test(metadata)) {
      throw new Error(`${name} must not reference One Person Lab Full assets; Full packages are first-install downloads only.`);
    }
  }
}

function assertStableLocalAuthorizationPolicy(releaseDir, name, packageKind) {
  const policyPath = path.join(releaseDir, name);
  if (!fs.existsSync(policyPath)) {
    throw new Error(`Missing Stable local-authorization evidence: ${policyPath}`);
  }
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  assertLocalAuthorizationPolicy(policy, packageKind, name);
}

function assertFullRuntimeNativeTrustObject(trust, manifest) {
  if (!trust || typeof trust !== 'object' || Array.isArray(trust)) {
    throw new Error('Full public release manifest is missing evidence.runtime_native_trust.');
  }
  const tempDir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'opl-full-native-trust-'));
  const trustPath = path.join(tempDir, 'full-runtime-native-trust.json');
  try {
    fs.writeFileSync(trustPath, `${JSON.stringify(trust, null, 2)}\n`);
    assertFullRuntimeNativeTrustFile(trustPath, manifest);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isGuiArtifact(name, version, extension, macArch) {
  const baseNames = guiArtifactPrefixes.map((prefix) => `${prefix}${version}-mac-${macArch}`);
  if (extension === '.blockmap') {
    return baseNames.some((baseName) => name === `${baseName}.zip.blockmap`);
  }
  return baseNames.some((baseName) => name === `${baseName}${extension}`);
}

function isLatestMetadataForVersion(releaseDir, name, version, macArch) {
  if (!/^latest.*\.yml$/.test(name)) {
    return false;
  }
  const source = path.join(releaseDir, name);
  const metadata = fs.readFileSync(source, 'utf8');
  return new RegExp(`^version:\\s*['"]?${escapeRegExp(version)}['"]?\\s*$`, 'm').test(metadata)
    && metadataMatchesMacArch(metadata, macArch);
}

function isStandardReleaseAssetName(releaseDir, name, version, macArch) {
  if (isGuiArtifact(name, version, '.dmg', macArch)) {
    return true;
  }
  if (isGuiArtifact(name, version, '.zip', macArch)) {
    return true;
  }
  if (isGuiArtifact(name, version, '.blockmap', macArch)) {
    return true;
  }
  if (name === 'standard-local-authorization-policy.json') {
    return true;
  }
  return name === `latest-${macArch}-mac.yml` && isLatestMetadataForVersion(releaseDir, name, version, macArch);
}

function listStandardReleaseAssetNames(releaseDir, version, macArch) {
  return fs.readdirSync(releaseDir).filter((name) => (
    isStandardReleaseAssetName(releaseDir, name, version, macArch)
  ));
}

function findArtifacts(shellRoot, version, macArch) {
  const shellPaths = resolveActiveShellPaths({ shellRoot });
  const releaseDir = [path.join(shellRoot, 'release'), shellPaths.buildOutputDir]
    .find((candidate) => fs.existsSync(candidate));
  if (!releaseDir) {
    throw new Error(`Missing GUI artifact directory: expected ${path.join(shellRoot, 'release')} or ${shellPaths.buildOutputDir}`);
  }
  const files = listStandardReleaseAssetNames(releaseDir, version, macArch);
  if (!files.some((name) => name.endsWith('.dmg'))) {
    throw new Error(`No One Person Lab ${version} ${macArch} DMG found under ${releaseDir}`);
  }
  assertStandardArtifactDoesNotContainFullRuntime(shellRoot, version, macArch);
  assertUpdaterMetadataDoesNotReferenceFullPackage(releaseDir, files);
  assertStableLocalAuthorizationPolicy(releaseDir, 'standard-local-authorization-policy.json', 'app_standard');
  files.push('standard-local-authorization-policy.json');
  const canonicalMetadataName = `latest-${macArch}-mac.yml`;
  if (!files.includes(canonicalMetadataName)) {
    const legacyMetadataName = 'latest-mac.yml';
    const legacyMetadataPath = path.join(releaseDir, legacyMetadataName);
    if (macArch === 'arm64' && fs.existsSync(legacyMetadataPath) && isLatestMetadataForVersion(releaseDir, legacyMetadataName, version, macArch)) {
      fs.copyFileSync(legacyMetadataPath, path.join(releaseDir, canonicalMetadataName));
      files.push(canonicalMetadataName);
    }
  }
  const artifacts = files.map((name) => {
    const source = path.join(releaseDir, name);
    if (/^latest.*\.yml$/.test(name)) {
      const uploadPath = path.join(releaseDir, name);
      if (name.includes(' ')) {
        fs.copyFileSync(source, uploadPath);
      }
      return uploadPath;
    }
    if (!name.includes(' ')) {
      return source;
    }
    const uploadName = name.replaceAll(' ', '.');
    const uploadPath = path.join(releaseDir, uploadName);
    fs.copyFileSync(source, uploadPath);
    return uploadPath;
  });
  return [...new Set(artifacts)];
}

function findPrebuiltStandardArtifacts(standardArtifactsDir, version, macArch) {
  const releaseDir = path.resolve(standardArtifactsDir);
  if (!fs.existsSync(releaseDir)) {
    throw new Error(`Missing prebuilt standard release asset directory: ${releaseDir}`);
  }
  const files = listStandardReleaseAssetNames(releaseDir, version, macArch);
  const requiredKinds = [
    ['DMG', (name) => name.endsWith('.dmg')],
    ['ZIP', (name) => name.endsWith('.zip')],
    [`latest-${macArch}-mac.yml`, (name) => name === `latest-${macArch}-mac.yml`],
    ['standard-local-authorization-policy.json', (name) => name === 'standard-local-authorization-policy.json'],
  ];
  for (const [label, predicate] of requiredKinds) {
    if (!files.some(predicate)) {
      throw new Error(`Missing prebuilt One Person Lab ${version} ${macArch} standard release asset: ${label}`);
    }
  }
  assertUpdaterMetadataDoesNotReferenceFullPackage(releaseDir, files);
  assertStableLocalAuthorizationPolicy(releaseDir, 'standard-local-authorization-policy.json', 'app_standard');
  return [...new Set(files.map((name) => path.join(releaseDir, name)))];
}

function findFullPackageArtifacts(fullPackageDir, version, macArch) {
  if (macArch !== 'arm64') {
    throw new Error(`Full first-install package is only supported for macOS arm64, not ${macArch}`);
  }
  if (!fullPackageDir || !fs.existsSync(fullPackageDir)) {
    throw new Error(`Missing Full package directory: ${fullPackageDir || '(empty)'}`);
  }

  const fullDmgName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  const required = [fullDmgName, 'opl-release-manifest.json'];

  const files = fs.readdirSync(fullPackageDir);
  for (const name of required) {
    if (!files.includes(name)) {
      throw new Error(`Missing Full package release asset: ${path.join(fullPackageDir, name)}`);
    }
  }

  const fullDmgPath = path.join(fullPackageDir, fullDmgName);
  const releaseManifestPath = path.join(fullPackageDir, 'opl-release-manifest.json');
  const releaseManifest = readJsonFile(releaseManifestPath);
  if (releaseManifest?.schema !== 'opl_public_release_manifest.v1') {
    throw new Error('Full public release manifest must declare schema=opl_public_release_manifest.v1.');
  }
  if (releaseManifest.package_kind !== 'opl_full_first_install_macos_arm64') {
    throw new Error('Full public release manifest must declare package_kind=opl_full_first_install_macos_arm64.');
  }
  if (releaseManifest.version !== version) {
    throw new Error(`Full public release manifest version mismatch: expected ${version}, got ${releaseManifest.version || '(empty)'}.`);
  }
  if (releaseManifest.primary_install_asset !== fullDmgName) {
    throw new Error(`Full public release manifest primary_install_asset must be ${fullDmgName}.`);
  }
  if (!Array.isArray(releaseManifest.assets) || !releaseManifest.assets.some((asset) => (
    asset?.name === fullDmgName
    && asset.role === 'full_first_install_carrier'
    && asset.size_bytes === fs.statSync(fullDmgPath).size
    && asset.sha256 === fileSha256(fullDmgPath)
  ))) {
    throw new Error(`Full public release manifest must record size and sha256 for ${fullDmgName}.`);
  }

  const manifest = releaseManifest.manifest;
  if (manifest?.distribution?.updater_metadata_allowed !== false) {
    throw new Error('Full package manifest must declare distribution.updater_metadata_allowed=false.');
  }
  assertLocalAuthorizationPolicy(
    releaseManifest?.evidence?.local_authorization_policy,
    'app_full_first_install',
    'opl-release-manifest.json#evidence.local_authorization_policy',
  );
  assertFullRuntimeNativeTrustObject(releaseManifest?.evidence?.runtime_native_trust, manifest);
  assertFullPackageManifestHasReleaseNotesMetadata(manifest);

  return required.map((name) => path.join(fullPackageDir, name));
}

function assertFullPackageManifestHasReleaseNotesMetadata(manifest) {
  const missing = [];
  for (const key of ['mas', 'mag', 'rca', 'meta_agent']) {
    const gitCommit = manifest?.components?.[key]?.git_commit;
    if (typeof gitCommit !== 'string' || !gitCommit.trim()) {
      missing.push(`components.${key}.git_commit`);
    }
  }
  const officeCliVersion = manifest?.components?.officecli?.version;
  if (typeof officeCliVersion !== 'string' || !officeCliVersion.trim()) {
    missing.push('components.officecli.version');
  }
  const mineruOpenApiVersion = manifest?.components?.mineru_open_api?.version;
  if (typeof mineruOpenApiVersion !== 'string' || !mineruOpenApiVersion.trim()) {
    missing.push('components.mineru_open_api.version');
  }
  if (missing.length > 0) {
    throw new Error(`Full package manifest is missing release-note metadata: ${missing.join(', ')}`);
  }
}

function readFullPackageManifest(fullPackageDir) {
  const releaseManifestPath = path.join(fullPackageDir || defaultFullPackageDir, 'opl-release-manifest.json');
  if (!fs.existsSync(releaseManifestPath)) {
    return null;
  }
  return readJsonFile(releaseManifestPath).manifest ?? null;
}

function releaseExists(repo, tag) {
  if (process.env.OPL_RELEASE_EXISTS === '1') {
    return true;
  }
  if (process.env.OPL_RELEASE_EXISTS === '0') {
    return false;
  }
  const result = spawnSync('gh', ['release', 'view', tag, '--repo', repo, '--json', 'tagName'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return result.status === 0;
}

function readExistingReleaseAssets(repo, tag) {
  if (process.env.OPL_RELEASE_EXISTING_ASSETS_JSON?.trim()) {
    const parsed = JSON.parse(process.env.OPL_RELEASE_EXISTING_ASSETS_JSON);
    return Array.isArray(parsed) ? parsed : [];
  }
  const result = spawnSync('gh', ['release', 'view', tag, '--repo', repo, '--json', 'assets'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    return [];
  }
  try {
    const payload = JSON.parse(result.stdout);
    return Array.isArray(payload.assets) ? payload.assets : [];
  } catch {
    return [];
  }
}

function assetDigestMatches(asset, filePath) {
  const digest = typeof asset?.digest === 'string' ? asset.digest.trim() : '';
  if (!digest) {
    return false;
  }
  const match = digest.match(/^sha256:(?<hash>[a-f0-9]{64})$/i);
  if (!match?.groups?.hash) {
    return false;
  }
  const local = fileSha256(filePath);
  return local.toLowerCase() === match.groups.hash.toLowerCase();
}

function partitionArtifactsForUpload(artifacts, existingAssets, options) {
  const orderUploadArtifacts = (artifactPaths) => [...artifactPaths].sort((left, right) => {
    const sizeDelta = fs.statSync(right).size - fs.statSync(left).size;
    if (sizeDelta !== 0) {
      return sizeDelta;
    }
    return path.basename(left).localeCompare(path.basename(right));
  });

  if (options.forceUpload) {
    return { uploadArtifacts: orderUploadArtifacts(artifacts), skippedArtifacts: [] };
  }
  const assetsByName = new Map(existingAssets.map((asset) => [asset?.name, asset]));
  const uploadArtifacts = [];
  const skippedArtifacts = [];
  for (const artifactPath of artifacts) {
    const name = path.basename(artifactPath);
    const existing = assetsByName.get(name);
    if (!existing) {
      uploadArtifacts.push(artifactPath);
      continue;
    }
    const localSize = fs.statSync(artifactPath).size;
    const sizeMatches = Number(existing.size) === localSize;
    const digestMatches = assetDigestMatches(existing, artifactPath);
    if (sizeMatches && digestMatches) {
      skippedArtifacts.push({
        path: artifactPath,
        name,
        reason: 'matching_sha256_and_size',
      });
      continue;
    }
    uploadArtifacts.push(artifactPath);
  }
  return { uploadArtifacts: orderUploadArtifacts(uploadArtifacts), skippedArtifacts };
}

function suggestDefaultReleaseVersion(repo, dateVersion) {
  if (!releaseExists(repo, `v${dateVersion}`)) {
    return dateVersion;
  }
  for (let code = 97; code <= 122; code += 1) {
    const suffix = String.fromCharCode(code);
    const candidate = `${dateVersion}-${suffix}`;
    if (!releaseExists(repo, `v${candidate}`)) {
      return candidate;
    }
  }
  throw new Error(`No available same-day suffix for GUI release date version ${dateVersion}.`);
}

function releaseNotesMode(options = {}) {
  const mode = (process.env.OPL_RELEASE_NOTES_MODE || 'ai').trim().toLowerCase();
  if (mode !== 'ai' && mode !== 'template') {
    throw new Error(`Unsupported OPL_RELEASE_NOTES_MODE: ${process.env.OPL_RELEASE_NOTES_MODE}`);
  }
  return mode;
}

function writeReleaseNotesEvidence(evidence) {
  const outputPath = process.env.OPL_RELEASE_NOTES_EVIDENCE_OUTPUT?.trim();
  if (!outputPath) {
    return;
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
}

function buildReleaseNotes(version, includeFullPackage, shellRoot, fullPackageManifest = null, options = {}) {
  const releaseNoteOptions = {
    version,
    channel: version.includes('-nightly') ? 'nightly' : 'stable',
    releaseRepo: options.releaseRepo || process.env.OPL_RELEASE_REPO || 'gaofeng21cn/one-person-lab-app',
    shellRoot,
    includeFullPackage,
    fullPackageManifest,
    currentTag: `v${version}`,
  };
  const evidence = buildReleaseNotesEvidence(releaseNoteOptions);
  writeReleaseNotesEvidence(evidence);
  const mode = releaseNotesMode(options);
  if (mode === 'template') {
    return {
      mode,
      notes: buildReleaseNotesDocument(releaseNoteOptions),
    };
  }
  return {
    mode,
    notes: buildAiReleaseNotesDocument(evidence),
  };
}

function replaceReleaseNotes(repo, tag, notes) {
  run('gh', ['release', 'edit', tag, '--repo', repo, '--notes', notes, '--title', buildReleaseTitle(tag)]);
}

function cleanupNewlyCreatedReleaseAfterUploadFailure(repo, tag) {
  const result = spawnSync('gh', ['release', 'delete', tag, '--repo', repo, '--yes'], {
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
  });
  if (result.status !== 0) {
    const detail = `${result.stdout || ''}${result.stderr || ''}`.trim();
    throw new Error(
      `Upload failed after creating ${tag}, and cleanup failed. Delete the incomplete release manually before retrying.${detail ? `\ncleanup=${detail}` : ''}`,
    );
  }
  console.error(`Cleaned up newly created release ${tag} after upload failure; kept tag for explicit operator recovery.`);
}

function buildUploadArgs(repo, tag, artifactPath) {
  return ['release', 'upload', tag, artifactPath, '--repo', repo, '--clobber'];
}

function releaseUploadAttempts() {
  const value = process.env.OPL_RELEASE_UPLOAD_ATTEMPTS?.trim();
  if (!value) {
    return defaultUploadAttempts;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`OPL_RELEASE_UPLOAD_ATTEMPTS must be a positive integer, got ${value}`);
  }
  return parsed;
}

function releaseUploadTimeoutMs() {
  const value = process.env.OPL_RELEASE_UPLOAD_TIMEOUT_MS?.trim();
  if (!value) {
    return defaultUploadTimeoutMs;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1000) {
    throw new Error(`OPL_RELEASE_UPLOAD_TIMEOUT_MS must be an integer >= 1000, got ${value}`);
  }
  return parsed;
}

function uploadReleaseArtifact(repo, tag, artifactPath, options) {
  let lastError = null;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      run('gh', buildUploadArgs(repo, tag, artifactPath), { timeoutMs: options.timeoutMs });
      return;
    } catch (error) {
      lastError = error;
      const detail = error instanceof Error ? error.message : String(error);
      if (attempt >= options.attempts) {
        break;
      }
      console.error(`Release asset upload attempt ${attempt}/${options.attempts} failed; retrying ${path.basename(artifactPath)}.\n${detail}`);
    }
  }
  throw lastError;
}

function uploadReleaseArtifacts(repo, tag, artifactPaths) {
  const uploaded = [];
  const uploadOptions = {
    attempts: releaseUploadAttempts(),
    timeoutMs: releaseUploadTimeoutMs(),
  };
  for (const artifactPath of artifactPaths) {
    const name = path.basename(artifactPath);
    console.error(`Uploading release asset ${name} (${uploaded.length + 1}/${artifactPaths.length}).`);
    try {
      uploadReleaseArtifact(repo, tag, artifactPath, uploadOptions);
      uploaded.push(name);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const uploadedDetail = uploaded.length > 0
        ? ` Uploaded before failure: ${uploaded.join(', ')}.`
        : '';
      throw new Error(`Failed to upload release asset ${name} to ${tag}.${uploadedDetail}\n${detail}`);
    }
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.versionExplicit) {
    options.version = suggestDefaultReleaseVersion(options.releaseRepo, options.version);
  }
  const tag = `v${options.version}`;

  if (!options.fullPackageOnly && !options.standardArtifactsDir && !fs.existsSync(options.shellRoot)) {
    throw new Error(`Missing One Person Lab App active shell checkout: ${options.shellRoot}`);
  }

  if (options.build && !options.fullPackageOnly && !options.standardArtifactsDir) {
    run('bun', ['run', `build-mac:${options.macArch}`], { cwd: options.shellRoot });
  }

  const artifacts = options.fullPackageOnly
    ? []
    : options.standardArtifactsDir
      ? findPrebuiltStandardArtifacts(options.standardArtifactsDir, options.version, options.macArch)
      : findArtifacts(options.shellRoot, options.version, options.macArch);
  const fullPackageArtifacts = options.includeFullPackage
    ? findFullPackageArtifacts(options.fullPackageDir, options.version, options.macArch)
    : [];
  const fullPackageManifest = options.includeFullPackage ? readFullPackageManifest(options.fullPackageDir) : null;
  const allArtifacts = [...artifacts, ...fullPackageArtifacts];
  const existingRelease = releaseExists(options.releaseRepo, tag);
  const existingAssets = existingRelease ? readExistingReleaseAssets(options.releaseRepo, tag) : [];
  const uploadPlan = partitionArtifactsForUpload(allArtifacts, existingAssets, options);
  const uploadArgs = ['release', 'upload', tag, ...uploadPlan.uploadArtifacts, '--repo', options.releaseRepo, '--clobber'];
  const uploadCommands = uploadPlan.uploadArtifacts.map((artifactPath) => ['gh', ...buildUploadArgs(options.releaseRepo, tag, artifactPath)]);
  const releaseNotesResult = buildReleaseNotes(
    options.version,
    options.includeFullPackage,
    options.shellRoot,
    fullPackageManifest,
    { allowTemplate: options.dryRun, fullPackageOnly: options.fullPackageOnly, releaseRepo: options.releaseRepo },
  );
  const releaseNotes = releaseNotesResult.notes;

  if (options.dryRun) {
    console.log(JSON.stringify({
      release_repo: options.releaseRepo,
      tag,
      shell_root: options.shellRoot,
      mac_arch: options.macArch,
      build: options.build,
      standard_artifacts_dir: options.standardArtifactsDir || null,
      full_package_only: options.fullPackageOnly,
      artifacts: allArtifacts,
      standard_artifacts: artifacts,
      full_package_artifacts: fullPackageArtifacts,
      release_exists: existingRelease,
      create_release: !options.fullPackageOnly && !existingRelease,
      draft: options.draft,
      force_upload: options.forceUpload,
      skipped_existing_artifacts: uploadPlan.skippedArtifacts,
      release_notes_mode: releaseNotesResult.mode,
      release_notes: releaseNotes,
      upload_command: ['gh', ...uploadArgs],
      upload_commands: uploadCommands,
    }, null, 2));
    return;
  }

  if (options.releaseRepo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`One Person Lab App releases must publish to gaofeng21cn/one-person-lab-app, got ${options.releaseRepo}.`);
  }

  if (options.fullPackageOnly && !existingRelease) {
    throw new Error(`Release ${tag} does not exist in ${options.releaseRepo}; publish the standard release before uploading Full first-install assets.`);
  }

  let createdRelease = false;
  if (!existingRelease) {
    run('gh', [
      'release',
      'create',
      tag,
      '--repo',
      options.releaseRepo,
      '--title',
      buildReleaseTitle(options.version),
      '--notes',
      releaseNotes,
      ...(options.draft ? ['--draft'] : []),
    ]);
    createdRelease = true;
  } else if (options.includeFullPackage && options.fullPackageOnly) {
    replaceReleaseNotes(options.releaseRepo, tag, releaseNotes);
  } else if (options.includeFullPackage) {
    replaceReleaseNotes(options.releaseRepo, tag, releaseNotes);
  }
  if (uploadPlan.uploadArtifacts.length > 0) {
    try {
      uploadReleaseArtifacts(options.releaseRepo, tag, uploadPlan.uploadArtifacts);
    } catch (error) {
      if (createdRelease) {
        cleanupNewlyCreatedReleaseAfterUploadFailure(options.releaseRepo, tag);
      }
      throw error;
    }
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
