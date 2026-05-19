#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultShellRoot = path.resolve(repoRoot, 'shells', 'aionui');
const defaultFullPackageDir = path.resolve(repoRoot, 'dist', 'opl-full-release');

function resolveShellRootEnv() {
  return process.env.OPL_APP_SHELL_ROOT || process.env.OPL_AION_SHELL_ROOT || defaultShellRoot;
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
  });
  if (result.status !== 0) {
    const detail = options.capture ? `\nstdout=${result.stdout || ''}\nstderr=${result.stderr || ''}` : '';
    throw new Error(`Command failed: ${command} ${args.join(' ')}${detail}`);
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
  const appPath = path.join(shellRoot, 'out', `mac-${macArch}`, 'One Person Lab.app');
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

function isGuiArtifact(name, version, extension, macArch) {
  const baseNames = guiArtifactPrefixes.map((prefix) => `${prefix}${version}-mac-${macArch}`);
  if (extension === '.blockmap') {
    return baseNames.some((baseName) => (
      name === `${baseName}.dmg.blockmap`
      || name === `${baseName}.zip.blockmap`
    ));
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

function findArtifacts(shellRoot, version, macArch) {
  const releaseDir = ['release', 'out']
    .map((entry) => path.join(shellRoot, entry))
    .find((candidate) => fs.existsSync(candidate));
  if (!releaseDir) {
    throw new Error(`Missing GUI artifact directory: expected ${path.join(shellRoot, 'release')} or ${path.join(shellRoot, 'out')}`);
  }
  const files = fs.readdirSync(releaseDir).filter((name) => {
    if (isGuiArtifact(name, version, '.dmg', macArch)) {
      return true;
    }
    if (isGuiArtifact(name, version, '.zip', macArch)) {
      return true;
    }
    if (isGuiArtifact(name, version, '.blockmap', macArch)) {
      return true;
    }
    return isLatestMetadataForVersion(releaseDir, name, version, macArch);
  });
  if (!files.some((name) => name.endsWith('.dmg'))) {
    throw new Error(`No One Person Lab ${version} ${macArch} DMG found under ${releaseDir}`);
  }
  assertStandardArtifactDoesNotContainFullRuntime(shellRoot, version, macArch);
  assertUpdaterMetadataDoesNotReferenceFullPackage(releaseDir, files);
  if (macArch === 'arm64' && files.some((name) => name.includes('-mac-arm64.')) && files.includes('latest-mac.yml')) {
    const arm64MetadataName = 'latest-arm64-mac.yml';
    fs.copyFileSync(path.join(releaseDir, 'latest-mac.yml'), path.join(releaseDir, arm64MetadataName));
    files.push(arm64MetadataName);
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
  const files = fs.readdirSync(releaseDir).filter((name) => {
    if (isGuiArtifact(name, version, '.dmg', macArch)) {
      return true;
    }
    if (isGuiArtifact(name, version, '.zip', macArch)) {
      return true;
    }
    if (isGuiArtifact(name, version, '.blockmap', macArch)) {
      return true;
    }
    return isLatestMetadataForVersion(releaseDir, name, version, macArch);
  });
  const requiredKinds = [
    ['DMG', (name) => name.endsWith('.dmg')],
    ['ZIP', (name) => name.endsWith('.zip')],
    ['latest-mac.yml', (name) => name === 'latest-mac.yml'],
    ['latest-arm64-mac.yml', (name) => name === 'latest-arm64-mac.yml'],
  ];
  for (const [label, predicate] of requiredKinds) {
    if (!files.some(predicate)) {
      throw new Error(`Missing prebuilt One Person Lab ${version} ${macArch} standard release asset: ${label}`);
    }
  }
  assertUpdaterMetadataDoesNotReferenceFullPackage(releaseDir, files);
  return [...new Set(files.map((name) => path.join(releaseDir, name)))];
}

function findFullPackageArtifacts(fullPackageDir, version, macArch) {
  if (macArch !== 'arm64') {
    throw new Error(`Full first-install package is only supported for macOS arm64, not ${macArch}`);
  }
  if (!fullPackageDir || !fs.existsSync(fullPackageDir)) {
    throw new Error(`Missing Full package directory: ${fullPackageDir || '(empty)'}`);
  }

  const required = [
    `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
    'full-package-manifest.json',
    'SHA256SUMS.txt',
    'README-Full-First-Install.txt',
  ];

  const files = fs.readdirSync(fullPackageDir);
  for (const name of required) {
    if (!files.includes(name)) {
      throw new Error(`Missing Full package release asset: ${path.join(fullPackageDir, name)}`);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(fullPackageDir, 'full-package-manifest.json'), 'utf8'));
  if (manifest?.distribution?.updater_metadata_allowed !== false) {
    throw new Error('Full package manifest must declare distribution.updater_metadata_allowed=false.');
  }
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
  const manifestPath = path.join(fullPackageDir || defaultFullPackageDir, 'full-package-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
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
  const local = hash.digest('hex');
  return local.toLowerCase() === match.groups.hash.toLowerCase();
}

function partitionArtifactsForUpload(artifacts, existingAssets, options) {
  if (options.forceUpload) {
    return { uploadArtifacts: artifacts, skippedArtifacts: [] };
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
  return { uploadArtifacts, skippedArtifacts };
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

function commandOutput(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
  });
  if (result.status !== 0) {
    return '';
  }
  return result.stdout.trim();
}

function humanizeCommitSubject(subject) {
  const match = subject.match(/^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?!?:\s*(?<body>.+)$/i);
  if (!match?.groups) {
    return subject.replace(/^[a-z]/, (value) => value.toUpperCase());
  }
  const scope = match.groups.scope
    ? match.groups.scope
        .split(/[-_/]+/)
        .filter(Boolean)
        .map((part) => part.replace(/^[a-z]/, (value) => value.toUpperCase()))
        .join(' ')
    : match.groups.type.replace(/^[a-z]/, (value) => value.toUpperCase());
  const body = match.groups.body.replace(/^[a-z]/, (value) => value.toUpperCase());
  return `${scope}: ${body}`;
}

function buildChangeList(shellRoot, maxItems = 12) {
  if (!fs.existsSync(path.join(shellRoot, '.git'))) {
    return ['GUI package refresh from the current OPL shell main branch.'];
  }

  const lastTag = commandOutput('git', ['describe', '--tags', '--abbrev=0', 'HEAD'], { cwd: shellRoot });
  const rangeArgs = lastTag ? [`${lastTag}..HEAD`] : ['HEAD'];
  const rawSubjects = commandOutput(
    'git',
    ['log', '--no-merges', '--pretty=%s', ...rangeArgs, `--max-count=${maxItems}`],
    { cwd: shellRoot },
  );
  const subjects = rawSubjects
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(humanizeCommitSubject);
  return subjects.length > 0 ? subjects : ['GUI package refresh from the current OPL shell main branch.'];
}

function buildUpdateGuidanceNotes(version) {
  return [
    'Update channel guidance',
    `- Existing users should use in-app update, or install the standard One-Person-Lab-${version}-mac-arm64.dmg package for a manual reinstall.`,
    '- Standard DMG/ZIP assets and latest*.yml metadata remain the only source for the auto-updater.',
    '- Full first-install assets are GitHub Release downloads for new or clean macOS arm64 setups. They are not a separate update channel and are never referenced by updater metadata.',
  ];
}

function formatFriendlyTimestamp(value) {
  if (!value) {
    return 'this release build';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} Beijing time`;
}

function shortSha(value) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 7) : null;
}

function buildBundledModuleNotes(manifest) {
  if (!manifest?.components || typeof manifest.components !== 'object') {
    return [];
  }
  const generatedAt = formatFriendlyTimestamp(manifest.generated_at);
  const modules = [
    ['MAS', manifest.components.mas],
    ['MAG', manifest.components.mag],
    ['RCA', manifest.components.rca],
    ['OPL Meta Agent', manifest.components.meta_agent],
  ]
    .filter(([, component]) => component && typeof component === 'object')
    .map(([label, component]) => {
      const sha = shortSha(component?.git_commit);
      return sha ? `- ${label}: ${generatedAt} build, main @ ${sha}` : `- ${label}: ${generatedAt} build`;
    });
  const officeCliVersion = manifest.components.officecli?.version;
  if (officeCliVersion) {
    modules.push(`- OfficeCLI: ${String(officeCliVersion).split(/\r?\n/)[0]}`);
  }
  const mineruOpenApiVersion = manifest.components.mineru_open_api?.version;
  if (mineruOpenApiVersion) {
    modules.push(`- MinerU OpenAPI CLI: ${String(mineruOpenApiVersion).split(/\r?\n/)[0]}`);
  }
  return modules;
}

function buildFullPackageReleaseNotesSection(version, manifest = null) {
  const bundledModuleNotes = buildBundledModuleNotes(manifest);
  return [
    'Full first-install package',
    `- New macOS arm64 users can download One-Person-Lab-Full-${version}-mac-arm64.dmg for a first setup that includes the App plus preloaded MAS, MAG, RCA, OPL Meta Agent, family runtime support payloads, OfficeCLI, MinerU document extraction, and recommended companion skills.`,
    '- After installation, users still configure their Codex/OpenAI API key and pass first-run readiness checks in the App.',
    '- The bundled Codex default profile is gpt-5.5 / xhigh and is applied through the active session path after API-key setup.',
    '- Command Line Tools installation is requested through deferred maintenance when needed; Full first launch continues on the bundled runtime while CLT installation is handled separately.',
    '- OPL Meta Agent is bundled and managed as a default ecosystem module so users can install and maintain the Foundry Agent used to create new OPL-compatible agents.',
    '- The App repository builds and publishes the Full package. OPL Framework code and contracts are bundled as runtime payload inputs, not as owners of the App release flow.',
    '- Full runtime readiness is Temporal-backed. Temporal is the required production durable stage-attempt provider; Hermes/Gateway runtime payloads are retired and are not bundled or exposed as compatibility surfaces.',
    '- MDS remains retired and is not bundled as a default module or MAS runtime dependency.',
    '- Full is a first-install download, not a separate update channel. App auto-update still follows standard latest*.yml metadata and the standard One Person Lab package.',
    ...(bundledModuleNotes.length > 0 ? ['', 'Bundled module versions', ...bundledModuleNotes] : []),
  ];
}

function buildReleaseFocusNotes(version, includeFullPackage) {
  const fullReadinessNote = includeFullPackage
    ? 'Full runtime readiness is represented as first-run Core, Domain modules, and family runtime provider readiness, with Temporal as the production durable provider contract.'
    : 'Full runtime readiness remains separated from the standard updater channel and is validated through the Full first-install lane.';
  return [
    'Release focus',
    '- Settings page: stabilizes the App settings and OPL initialization flows used to configure the Codex/OpenAI API key, refresh readiness, and inspect developer-mode availability.',
    '- First-run resilience: keeps CLT/deferred maintenance and repository refreshes outside the core launch gate so clean installs can enter the App on the bundled runtime.',
    '- Codex defaults: applies the gpt-5.5 / xhigh profile through the active ACP session path, including packaged Full first-install sessions.',
    '- VM validation: clean no-CLT macOS arm64 first-install smoke passed at 1920x1080 with the Codex config wizard and all settings pages covered.',
    `- Runtime packaging: ${fullReadinessNote}`,
    `- Scope: ${version} is a desktop App release. Domain truth, provider implementation, quality verdicts, and artifact authority remain owned by OPL Framework and the domain agents.`,
  ];
}

function buildReleaseNotes(version, includeFullPackage, changeList, fullPackageManifest = null) {
  const notes = [
    `One Person Lab desktop GUI release ${version}`,
    '',
    ...buildReleaseFocusNotes(version, includeFullPackage),
    '',
    'Change log',
    ...changeList.map((change) => `- ${change}`),
    '',
    ...buildUpdateGuidanceNotes(version),
  ];
  if (includeFullPackage) {
    notes.push(
      '',
      ...buildFullPackageReleaseNotesSection(version, fullPackageManifest),
    );
  }
  return notes.join('\n');
}

function ensureFullPackageReleaseNotes(repo, tag, version, fullPackageManifest = null) {
  const current = spawnSync('gh', ['release', 'view', tag, '--repo', repo, '--json', 'body', '--jq', '.body'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (current.status !== 0) {
    throw new Error(`Command failed: gh release view ${tag} --repo ${repo}\nstderr=${current.stderr || ''}`);
  }

  const currentNotes = current.stdout.trimEnd();
  const fullSection = buildFullPackageReleaseNotesSection(version, fullPackageManifest).join('\n');
  const releaseFocusSection = buildReleaseFocusNotes(version, true).join('\n');
  const missingReleaseFocus = !current.stdout.includes('Release focus');
  const missingUpdateGuidance = !current.stdout.includes('Update channel guidance') && !current.stdout.includes('Update guidance:');
  const fullSectionPattern = /^Full first-install package:?[\s\S]*$/m;
  let baseNotes = currentNotes.replace(fullSectionPattern, '').trimEnd();
  const appendSection = (notes, lines) => [
    ...(notes ? [notes, ''] : []),
    ...lines,
  ].join('\n');

  if (missingReleaseFocus) {
    baseNotes = appendSection(baseNotes, [releaseFocusSection]);
  }
  if (missingUpdateGuidance) {
    baseNotes = appendSection(baseNotes, buildUpdateGuidanceNotes(version));
  }
  const nextNotes = [
    ...(baseNotes ? [baseNotes, ''] : []),
    fullSection,
  ].join('\n');
  run('gh', ['release', 'edit', tag, '--repo', repo, '--notes', nextNotes]);
}

function replaceReleaseNotes(repo, tag, notes) {
  run('gh', ['release', 'edit', tag, '--repo', repo, '--notes', notes]);
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
  const releaseNotes = buildReleaseNotes(
    options.version,
    options.includeFullPackage,
    options.fullPackageOnly ? ['Full first-install package assets for the existing standard release.'] : buildChangeList(options.shellRoot),
    fullPackageManifest,
  );

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
      release_notes: releaseNotes,
      upload_command: ['gh', ...uploadArgs],
    }, null, 2));
    return;
  }

  if (options.releaseRepo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`One Person Lab App releases must publish to gaofeng21cn/one-person-lab-app, got ${options.releaseRepo}.`);
  }

  if (options.fullPackageOnly && !existingRelease) {
    throw new Error(`Release ${tag} does not exist in ${options.releaseRepo}; publish the standard release before uploading Full first-install assets.`);
  }

  if (!existingRelease) {
    run('gh', [
      'release',
      'create',
      tag,
      '--repo',
      options.releaseRepo,
      '--title',
      `One Person Lab ${options.version}`,
      '--notes',
      releaseNotes,
      ...(options.draft ? ['--draft'] : []),
    ]);
  } else if (options.includeFullPackage && options.fullPackageOnly) {
    ensureFullPackageReleaseNotes(options.releaseRepo, tag, options.version, fullPackageManifest);
  } else if (options.includeFullPackage) {
    replaceReleaseNotes(options.releaseRepo, tag, releaseNotes);
  }
  if (uploadPlan.uploadArtifacts.length > 0) {
    run('gh', uploadArgs);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
