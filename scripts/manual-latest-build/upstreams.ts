import fs from 'node:fs';
import path from 'node:path';

import {
  commandOutput,
  commandResult,
  compareStableVersions,
  downloadGithubAsset,
  extractVerifiedTarGz,
  fileSha256,
  githubApi,
  type JsonRecord,
  requireFile,
  verifyMacArm64Binary,
} from './common.ts';

export type UpstreamInputs = {
  temporal: {
    tag: string;
    version: string;
    published_at: string;
    archive: string;
    archive_sha256: string;
    binary: string;
    binary_version: string;
  };
  officecli: {
    tag: string;
    version: string;
    published_at: string;
    source_root: string;
    source_commit: string;
    binary: string;
    binary_sha256: string;
    binary_version: string;
  };
  mineru_open_api: {
    tag: string;
    version: string;
    published_at: string;
    archive: string;
    archive_sha256: string;
    binary: string;
    binary_version: string;
  };
};

function releaseTag(release: JsonRecord, label: string) {
  if (typeof release.tag_name !== 'string' || !release.tag_name) {
    throw new Error(`${label} release has no tag_name`);
  }
  return release.tag_name;
}

function releaseAsset(release: JsonRecord, name: string, label: string) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const asset = assets.find((candidate) => candidate?.name === name);
  if (!asset) throw new Error(`${label} release is missing asset ${name}`);
  return asset as JsonRecord;
}

function releasePublishedAt(release: JsonRecord) {
  return typeof release.published_at === 'string' ? release.published_at : '';
}

function versionFromTag(tag: string, prefix: string, label: string) {
  if (!tag.startsWith(prefix) || !/^\d+\.\d+\.\d+$/.test(tag.slice(prefix.length))) {
    throw new Error(`${label} has an unsupported stable tag: ${tag}`);
  }
  return tag.slice(prefix.length);
}

function prepareTemporal(cacheRoot: string) {
  const release = githubApi<JsonRecord>('repos/temporalio/cli/releases/latest');
  const tag = releaseTag(release, 'Temporal');
  const version = versionFromTag(tag, 'v', 'Temporal');
  const archiveName = `temporal_cli_${version}_darwin_arm64.tar.gz`;
  const archiveAsset = releaseAsset(release, archiveName, 'Temporal');
  const checksumsAsset = releaseAsset(release, 'checksums.txt', 'Temporal');
  const releaseRoot = path.join(cacheRoot, 'temporal', tag);
  const archive = downloadGithubAsset(
    archiveAsset,
    path.join(releaseRoot, archiveName),
    `Temporal ${tag} macOS arm64 archive`,
  );
  const checksums = downloadGithubAsset(
    checksumsAsset,
    path.join(releaseRoot, 'checksums.txt'),
    `Temporal ${tag} checksums`,
  );
  const expectedChecksumLine = `${archive.sha256}  ${archiveName}`;
  const checksumLines = fs.readFileSync(checksums.path, 'utf8').split(/\r?\n/);
  if (!checksumLines.includes(expectedChecksumLine)) {
    throw new Error(`Temporal ${tag} official checksums do not bind ${archiveName}`);
  }
  const extracted = path.join(releaseRoot, 'extracted');
  extractVerifiedTarGz(archive.path, extracted);
  const binary = requireFile(path.join(extracted, 'temporal'), 'Temporal CLI');
  const binaryVersion = verifyMacArm64Binary(binary, ['--version'], 'Temporal CLI');
  if (!binaryVersion.includes(`temporal version ${version}`)) {
    throw new Error(`Temporal binary version does not match ${tag}: ${binaryVersion}`);
  }
  return {
    tag,
    version,
    published_at: releasePublishedAt(release),
    archive: archive.path,
    archive_sha256: archive.sha256,
    binary,
    binary_version: binaryVersion,
  };
}

function prepareOfficeCli(cacheRoot: string) {
  const release = githubApi<JsonRecord>('repos/iOfficeAI/OfficeCLI/releases/latest');
  const tag = releaseTag(release, 'OfficeCLI');
  const version = versionFromTag(tag, 'v', 'OfficeCLI');
  const binaryAsset = releaseAsset(release, 'officecli-mac-arm64', 'OfficeCLI');
  const releaseRoot = path.join(cacheRoot, 'officecli', tag);
  const binary = downloadGithubAsset(
    binaryAsset,
    path.join(releaseRoot, 'officecli-mac-arm64'),
    `OfficeCLI ${tag} macOS arm64 binary`,
  );
  fs.chmodSync(binary.path, fs.statSync(binary.path).mode | 0o755);
  const binaryVersion = verifyMacArm64Binary(binary.path, ['--version'], 'OfficeCLI');
  if (!new RegExp(`\\b${version.replaceAll('.', '\\.')}\\b`).test(binaryVersion)) {
    throw new Error(`OfficeCLI binary version does not match ${tag}: ${binaryVersion}`);
  }

  const sourceRoot = path.join(releaseRoot, 'source');
  if (!fs.existsSync(path.join(sourceRoot, '.git'))) {
    if (fs.existsSync(sourceRoot)) {
      throw new Error(`OfficeCLI cache path exists but is not a Git checkout: ${sourceRoot}`);
    }
    fs.mkdirSync(path.dirname(sourceRoot), { recursive: true });
    commandResult('git', [
      'clone', '--depth=1', '--branch', tag, '--single-branch',
      'https://github.com/iOfficeAI/OfficeCLI.git', sourceRoot,
    ], { timeoutMs: 180_000 });
  }
  const origin = commandOutput('git', ['remote', 'get-url', 'origin'], { cwd: sourceRoot });
  if (origin !== 'https://github.com/iOfficeAI/OfficeCLI.git') {
    throw new Error(`OfficeCLI cache origin drifted: ${origin}`);
  }
  const sourceCommit = commandOutput('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot });
  const tagCommit = commandOutput('git', ['rev-parse', `${tag}^{commit}`], { cwd: sourceRoot });
  if (sourceCommit !== tagCommit) {
    throw new Error(`OfficeCLI source cache is not at ${tag}: ${sourceCommit}`);
  }
  if (commandOutput('git', ['status', '--porcelain'], { cwd: sourceRoot })) {
    throw new Error(`OfficeCLI source cache is dirty: ${sourceRoot}`);
  }
  return {
    tag,
    version,
    published_at: releasePublishedAt(release),
    source_root: sourceRoot,
    source_commit: sourceCommit,
    binary: binary.path,
    binary_sha256: binary.sha256,
    binary_version: binaryVersion,
  };
}

export function selectLatestMineruCliRelease(releases: JsonRecord[]) {
  const candidates = releases.filter((release) => (
    typeof release.tag_name === 'string'
    && /^cli\/v\d+\.\d+\.\d+$/.test(release.tag_name)
    && release.draft !== true
    && release.prerelease !== true
  ));
  candidates.sort((left, right) => compareStableVersions(
    String(right.tag_name).slice('cli/v'.length),
    String(left.tag_name).slice('cli/v'.length),
  ));
  const latest = candidates[0];
  if (!latest) throw new Error('MinerU-Ecosystem has no stable CLI release');
  return latest;
}

function prepareMineruOpenApi(cacheRoot: string) {
  const releases = githubApi<JsonRecord[]>('repos/opendatalab/MinerU-Ecosystem/releases?per_page=100');
  const release = selectLatestMineruCliRelease(releases);
  const tag = releaseTag(release, 'MinerU OpenAPI');
  const version = versionFromTag(tag, 'cli/v', 'MinerU OpenAPI');
  const archiveName = 'mineru-open-api_darwin_arm64.tar.gz';
  const archiveAsset = releaseAsset(release, archiveName, 'MinerU OpenAPI');
  const releaseRoot = path.join(cacheRoot, 'mineru-open-api', tag.replaceAll('/', '-'));
  const archive = downloadGithubAsset(
    archiveAsset,
    path.join(releaseRoot, archiveName),
    `MinerU OpenAPI ${tag} macOS arm64 archive`,
  );
  const extracted = path.join(releaseRoot, 'extracted');
  extractVerifiedTarGz(archive.path, extracted);
  const binary = requireFile(path.join(extracted, 'mineru-open-api'), 'MinerU OpenAPI');
  const binaryVersion = verifyMacArm64Binary(binary, ['--version'], 'MinerU OpenAPI');
  if (!binaryVersion.includes(`version v${version}`)) {
    throw new Error(`MinerU OpenAPI binary version does not match ${tag}: ${binaryVersion}`);
  }
  return {
    tag,
    version,
    published_at: releasePublishedAt(release),
    archive: archive.path,
    archive_sha256: archive.sha256,
    binary,
    binary_version: binaryVersion,
  };
}

export function prepareLatestUpstreams(cacheRoot: string): UpstreamInputs {
  fs.mkdirSync(cacheRoot, { recursive: true });
  return {
    temporal: prepareTemporal(cacheRoot),
    officecli: prepareOfficeCli(cacheRoot),
    mineru_open_api: prepareMineruOpenApi(cacheRoot),
  };
}
