import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { createAppComponentManifest } from '../../scripts/write-opl-app-component-manifest.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');
const installerPath = path.join(appRoot, 'install.sh');

function sha256(bytes: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function writeExecutable(filePath: string, source: string): void {
  fs.writeFileSync(filePath, source);
  fs.chmodSync(filePath, 0o755);
}

function route(osName: string, architecture: string, args: string[] = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-install-route-'));
  try {
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    const uname = path.join(bin, 'uname');
    fs.writeFileSync(uname, `#!/usr/bin/env sh\ncase "\${1:-}" in\n  -s) printf '%s\\n' '${osName}' ;;\n  -m) printf '%s\\n' '${architecture}' ;;\nesac\n`);
    fs.chmodSync(uname, 0o755);
    return spawnSync('/bin/bash', [installerPath, '--print-install-route', ...args], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function directStableMacInstall(osName: string, architecture: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-direct-macos-install-'));
  try {
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    writeExecutable(
      path.join(bin, 'uname'),
      `#!/usr/bin/env sh\ncase "\${1:-}" in\n  -s) printf '%s\\n' '${osName}' ;;\n  -m) printf '%s\\n' '${architecture}' ;;\nesac\n`,
    );
    return spawnSync('/bin/bash', [installerPath, '--stable-macos-install', '--yes', '--no-open'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('personal hosts install one platform Desktop payload by default', () => {
  assert.equal(route('Darwin', 'arm64').stdout.trim(), 'desktop');
  assert.equal(route('Linux', 'x86_64').stdout.trim(), 'linux-desktop');
});

test('explicit Desktop density reaches the platform carrier and unsupported Linux Full fails closed', () => {
  assert.equal(route('Darwin', 'arm64', ['--standard']).stdout.trim(), 'desktop-standard');
  assert.equal(route('Darwin', 'arm64', ['--full']).stdout.trim(), 'desktop-full');
  assert.equal(route('Linux', 'x86_64', ['--standard']).stdout.trim(), 'linux-desktop-standard');

  const linuxFull = route('Linux', 'x86_64', ['--full']);
  assert.notEqual(linuxFull.status, 0);
  assert.equal(linuxFull.stdout, '');
  assert.match(
    linuxFull.stderr,
    /Full Desktop density is not published for Linux x86_64; use --standard/,
  );
});

test('WebUI mode reuses packaged Desktop bytes and native-webui is only its deprecated alias', () => {
  const webui = route('Linux', 'x86_64', ['--webui']);
  const alias = route('Linux', 'x86_64', ['--native-webui']);
  assert.equal(webui.status, 0, webui.stderr);
  assert.equal(webui.stdout.trim(), 'linux-desktop-webui');
  assert.equal(alias.status, 0, alias.stderr);
  assert.equal(alias.stdout.trim(), 'linux-desktop-webui');
  assert.match(alias.stderr, /deprecated; using the packaged Desktop WebUI mode/);
});

test('server, isolated, headless, and Windows routes stay distinct from the Desktop carrier', () => {
  assert.equal(route('Linux', 'x86_64', ['--server']).stdout.trim(), 'container-webui');
  assert.equal(route('Linux', 'x86_64', ['--isolated']).stdout.trim(), 'container-webui');
  assert.equal(route('Linux', 'x86_64', ['--headless']).stdout.trim(), 'headless');
  assert.equal(route('MINGW64_NT-10.0', 'x86_64').stdout.trim(), 'container-webui');
});

test('unsupported Desktop architecture fails closed before any release asset lookup', () => {
  const result = route('Linux', 'aarch64');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /supported only on macOS arm64 and Linux x86_64/);

  const intelMac = route('Darwin', 'x86_64');
  assert.notEqual(intelMac.status, 0);
  assert.match(intelMac.stderr, /supported only on macOS arm64 and Linux x86_64/);
});

test('direct Stable macOS helper rejects Intel before release asset lookup', () => {
  const result = directStableMacInstall('Darwin', 'x86_64');
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /supported only on macOS arm64/);
  assert.doesNotMatch(result.stderr, /curl|download|release/i);
});

test('Linux Desktop uses a Stable adjunct while preserving same-release Preview installation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-linux-adjunct-install-'));
  try {
    const bin = path.join(root, 'bin');
    const fixtures = path.join(root, 'fixtures');
    const tmp = path.join(root, 'tmp');
    fs.mkdirSync(bin);
    fs.mkdirSync(fixtures);
    fs.mkdirSync(tmp);

    const version = '26.7.27';
    const updaterVersion = '26.7.2700';
    const baseTag = `v${version}`;
    const repository = 'gaofeng21cn/one-person-lab-app';
    const appSha = 'a'.repeat(40);
    const shellSha = 'b'.repeat(40);
    const frameworkSha = 'c'.repeat(40);
    const baseDownload = `https://github.com/${repository}/releases/download/${baseTag}`;
    const baseAssetNames = [
      'latest-arm64-mac.yml',
      `One-Person-Lab-${version}-mac-arm64.dmg`,
      `One-Person-Lab-${version}-mac-arm64.zip`,
      `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
      'standard-gatekeeper-launch-policy.json',
      'standard-apple-notarization-receipt.json',
    ];
    const baseAssets = baseAssetNames.map((name, index) => {
      const bytes = `base asset ${index}: ${name}\n`;
      return {
        name,
        url: `${baseDownload}/${name}`,
        digest: sha256(bytes),
        size: Buffer.byteLength(bytes),
        contentType: 'application/octet-stream',
      };
    });
    const componentManifest = createAppComponentManifest({
      version,
      updaterVersion,
      sourceCommit: appSha,
      shellCommit: shellSha,
      frameworkCommit: frameworkSha,
      tag: baseTag,
      releaseUrl: `https://github.com/${repository}/releases/tag/${baseTag}`,
      assets: baseAssets,
      repo: repository,
    });
    const componentBytes = `${JSON.stringify(componentManifest, null, 2)}\n`;
    const componentPath = path.join(fixtures, 'component-manifest.json');
    fs.writeFileSync(componentPath, componentBytes);
    const componentAsset = {
      name: 'opl-app-component-manifest.json',
      digest: sha256(componentBytes),
      size: Buffer.byteLength(componentBytes),
      browser_download_url: `${baseDownload}/opl-app-component-manifest.json`,
    };
    const baseRelease = {
      tag_name: baseTag,
      target_commitish: appSha,
      draft: false,
      prerelease: false,
      immutable: true,
      assets: [
        ...baseAssets.map((asset) => ({
          name: asset.name,
          digest: asset.digest,
          size: asset.size,
          browser_download_url: asset.url,
        })),
        componentAsset,
      ],
    };
    const baseReleasePath = path.join(fixtures, 'base-release.json');
    fs.writeFileSync(baseReleasePath, `${JSON.stringify(baseRelease)}\n`);

    const debName = `One-Person-Lab-${version}-linux-x64.deb`;
    const debBytes = Buffer.from('exact adjunct linux package bytes\n');
    const debPath = path.join(fixtures, debName);
    fs.writeFileSync(debPath, debBytes);
    const adjunctManifest = {
      schema: 'opl_app_immutable_platform_adjunct_manifest.v1',
      kind: 'stable_optional_adjunct',
      source: {
        run_id: '123456789',
        bundle_digest: `sha256:${'d'.repeat(64)}`,
      },
      base_release_tag: baseTag,
      release_identity: {
        display_version: version,
        updater_version: updaterVersion,
      },
      cohort: {
        app_sha: appSha,
        shell_sha: shellSha,
        framework_sha: frameworkSha,
      },
      platforms: ['linux-x64'],
      assets: [{
        name: debName,
        digest: sha256(debBytes),
        size_bytes: debBytes.byteLength,
      }],
      publication_control: {
        immutable_release_capability_evidence_digest: null,
        dispatch_actor: null,
      },
    };
    const adjunctManifestBytes = `${JSON.stringify(adjunctManifest, null, 2)}\n`;
    const adjunctManifestDigest = sha256(adjunctManifestBytes);
    const adjunctTag = `${baseTag}-optional-${adjunctManifestDigest.slice('sha256:'.length, 'sha256:'.length + 12)}`;
    const adjunctDownload = `https://github.com/${repository}/releases/download/${adjunctTag}`;
    const adjunctManifestPath = path.join(fixtures, 'optional-manifest.json');
    fs.writeFileSync(adjunctManifestPath, adjunctManifestBytes);
    const adjunctRelease = {
      tag_name: adjunctTag,
      target_commitish: appSha,
      draft: false,
      prerelease: false,
      immutable: true,
      assets: [
        {
          name: debName,
          digest: sha256(debBytes),
          size: debBytes.byteLength,
          browser_download_url: `${adjunctDownload}/${debName}`,
        },
        {
          name: 'opl-optional-platforms-manifest.json',
          digest: adjunctManifestDigest,
          size: Buffer.byteLength(adjunctManifestBytes),
          browser_download_url: `${adjunctDownload}/opl-optional-platforms-manifest.json`,
        },
      ],
    };
    const adjunctReleasePath = path.join(fixtures, 'adjunct-release.json');
    const releasesPagePath = path.join(fixtures, 'releases-page.json');
    fs.writeFileSync(adjunctReleasePath, `${JSON.stringify(adjunctRelease)}\n`);
    fs.writeFileSync(releasesPagePath, `${JSON.stringify([adjunctRelease])}\n`);

    const previewVersion = '26.7.27-preview.r1';
    const previewUpdaterVersion = '26.7.2701';
    const previewTag = `v${previewVersion}`;
    const previewDownload = `https://github.com/${repository}/releases/download/${previewTag}`;
    const previewDebName = `One-Person-Lab-${previewVersion}-linux-x64.deb`;
    const previewDebBytes = Buffer.from('exact same-release preview linux package bytes\n');
    const previewDebPath = path.join(fixtures, previewDebName);
    fs.writeFileSync(previewDebPath, previewDebBytes);
    const previewAssetNames = [
      'latest-arm64-mac.yml',
      `One-Person-Lab-${previewVersion}-mac-arm64.dmg`,
      `One-Person-Lab-${previewVersion}-mac-arm64.zip`,
      `One-Person-Lab-${previewVersion}-mac-arm64.zip.blockmap`,
      previewDebName,
      'standard-gatekeeper-launch-policy.json',
      'standard-apple-notarization-receipt.json',
    ];
    const previewAssets = previewAssetNames.map((name, index) => {
      const bytes = name === previewDebName ? previewDebBytes : Buffer.from(`preview asset ${index}: ${name}\n`);
      return {
        name,
        url: `${previewDownload}/${name}`,
        digest: sha256(bytes),
        size: bytes.byteLength,
        contentType: 'application/octet-stream',
      };
    });
    const previewComponentManifest = createAppComponentManifest({
      version: previewVersion,
      updaterVersion: previewUpdaterVersion,
      sourceCommit: appSha,
      shellCommit: shellSha,
      frameworkCommit: frameworkSha,
      tag: previewTag,
      releaseUrl: `https://github.com/${repository}/releases/tag/${previewTag}`,
      assets: previewAssets,
      repo: repository,
    });
    const previewComponentBytes = `${JSON.stringify(previewComponentManifest, null, 2)}\n`;
    const previewComponentPath = path.join(fixtures, 'preview-component-manifest.json');
    fs.writeFileSync(previewComponentPath, previewComponentBytes);
    const previewRelease = {
      tag_name: previewTag,
      target_commitish: appSha,
      draft: false,
      prerelease: false,
      immutable: true,
      assets: [
        ...previewAssets.map((asset) => ({
          name: asset.name,
          digest: asset.digest,
          size: asset.size,
          browser_download_url: asset.url,
        })),
        {
          name: 'opl-app-component-manifest.json',
          digest: sha256(previewComponentBytes),
          size: Buffer.byteLength(previewComponentBytes),
          browser_download_url: `${previewDownload}/opl-app-component-manifest.json`,
        },
      ],
    };
    const previewReleasePath = path.join(fixtures, 'preview-release.json');
    fs.writeFileSync(previewReleasePath, `${JSON.stringify(previewRelease)}\n`);

    const curlLog = path.join(root, 'curl.log');
    const aptLog = path.join(root, 'apt.log');
    const installedExecutable = path.join(root, 'installed', 'one-person-lab');
    fs.mkdirSync(path.dirname(installedExecutable));
    writeExecutable(installedExecutable, '#!/usr/bin/env sh\nexit 0\n');
    writeExecutable(path.join(bin, 'uname'), `#!/usr/bin/env sh
case "\${1:-}" in
  -s) printf '%s\\n' Linux ;;
  -m) printf '%s\\n' x86_64 ;;
esac
`);
    writeExecutable(path.join(bin, 'curl'), `#!/usr/bin/env bash
set -euo pipefail
output=''
url=''
write_http=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o)
      output="$2"
      shift 2
      ;;
    -H|--connect-timeout|--max-time|--retry|--retry-delay)
      shift 2
      ;;
    -w)
      write_http=true
      shift 2
      ;;
    http*)
      url="$1"
      shift
      ;;
    *)
      shift
      ;;
  esac
done
printf '%s\\n' "$url" >> "$CURL_LOG"
case "$url" in
  "https://api.github.com/repos/$REPOSITORY/releases/tags/$BASE_TAG") source="$BASE_RELEASE_PATH" ;;
  "https://api.github.com/repos/$REPOSITORY/releases?per_page=100&page=1") source="$RELEASES_PAGE_PATH" ;;
  "https://api.github.com/repos/$REPOSITORY/releases/tags/$ADJUNCT_TAG") source="$ADJUNCT_RELEASE_PATH" ;;
  "https://api.github.com/repos/$REPOSITORY/releases/tags/$PREVIEW_TAG") source="$PREVIEW_RELEASE_PATH" ;;
  "$BASE_DOWNLOAD/opl-app-component-manifest.json") source="$COMPONENT_PATH" ;;
  "$ADJUNCT_DOWNLOAD/$DEB_NAME") source="$DEB_PATH" ;;
  "$ADJUNCT_DOWNLOAD/opl-optional-platforms-manifest.json") source="$ADJUNCT_MANIFEST_PATH" ;;
  "$PREVIEW_DOWNLOAD/opl-app-component-manifest.json") source="$PREVIEW_COMPONENT_PATH" ;;
  "$PREVIEW_DOWNLOAD/$PREVIEW_DEB_NAME") source="$PREVIEW_DEB_PATH" ;;
  *) printf 'unexpected URL: %s\\n' "$url" >&2; exit 90 ;;
esac
cp "$source" "$output"
if [ "$write_http" = true ]; then printf 200; fi
`);
    writeExecutable(path.join(bin, 'dpkg-deb'), `#!/usr/bin/env sh
case "\${3:-}" in
  Package) printf '%s\\n' one-person-lab ;;
  Version) printf '%s\\n' '${updaterVersion}' ;;
  Architecture) printf '%s\\n' amd64 ;;
  *) exit 1 ;;
esac
`);
    writeExecutable(path.join(bin, 'dpkg'), `#!/usr/bin/env sh
test "\${1:-}" = -L
printf '%s\\n' "$FAKE_EXECUTABLE"
`);
    writeExecutable(path.join(bin, 'apt-get'), `#!/usr/bin/env sh
printf '%s\\n' "$*" > "$APT_LOG"
`);

    const testEnv = {
      ...process.env,
      PATH: `${bin}:/usr/bin:/bin`,
      TMPDIR: tmp,
      CURL_LOG: curlLog,
      APT_LOG: aptLog,
      FAKE_EXECUTABLE: installedExecutable,
      REPOSITORY: repository,
      BASE_TAG: baseTag,
      ADJUNCT_TAG: adjunctTag,
      PREVIEW_TAG: previewTag,
      BASE_RELEASE_PATH: baseReleasePath,
      RELEASES_PAGE_PATH: releasesPagePath,
      ADJUNCT_RELEASE_PATH: adjunctReleasePath,
      PREVIEW_RELEASE_PATH: previewReleasePath,
      COMPONENT_PATH: componentPath,
      ADJUNCT_MANIFEST_PATH: adjunctManifestPath,
      PREVIEW_COMPONENT_PATH: previewComponentPath,
      DEB_PATH: debPath,
      DEB_NAME: debName,
      PREVIEW_DEB_PATH: previewDebPath,
      PREVIEW_DEB_NAME: previewDebName,
      BASE_DOWNLOAD: baseDownload,
      ADJUNCT_DOWNLOAD: adjunctDownload,
      PREVIEW_DOWNLOAD: previewDownload,
    };
    const result = spawnSync('/bin/bash', [
      installerPath,
      '--desktop',
      '--release-tag',
      baseTag,
      '--no-open',
    ], {
      cwd: appRoot,
      encoding: 'utf8',
      env: testEnv,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Release quality: Stable/);
    assert.match(result.stdout, new RegExp(`Installed Linux Desktop payload: ${installedExecutable}`));
    assert.match(fs.readFileSync(aptLog, 'utf8'), new RegExp(`install -y .*${debName}`));
    const downloads = fs.readFileSync(curlLog, 'utf8');
    assert.match(downloads, new RegExp(`${baseTag}/opl-app-component-manifest\\.json`));
    assert.match(downloads, new RegExp(`${adjunctTag}/${debName}`));
    assert.match(downloads, new RegExp(`${adjunctTag}/opl-optional-platforms-manifest\\.json`));

    const previewResult = spawnSync('/bin/bash', [
      installerPath,
      '--desktop',
      '--release-tag',
      previewTag,
      '--no-open',
    ], {
      cwd: appRoot,
      encoding: 'utf8',
      env: testEnv,
    });
    assert.equal(previewResult.status, 0, previewResult.stderr || previewResult.stdout);
    assert.match(previewResult.stdout, /Release quality: Preview \(Dev\)/);
    const previewDownloads = fs.readFileSync(curlLog, 'utf8').slice(downloads.length);
    assert.match(previewDownloads, new RegExp(`${previewTag}/opl-app-component-manifest\\.json`));
    assert.match(previewDownloads, new RegExp(`${previewTag}/${previewDebName}`));
    assert.doesNotMatch(previewDownloads, /releases\?per_page=/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the universal installer has no Native tarball discovery or verifier fallback', () => {
  const source = fs.readFileSync(installerPath, 'utf8');
  assert.match(source, /One-Person-Lab-\$\{version\}-linux-x64\.deb/);
  assert.match(source, /resolve_linux_adjunct_release_record/);
  assert.match(source, /linux_adjunct_release_record_binds_tagged_assets/);
  assert.match(source, /opl-optional-platforms-manifest\.json/);
  assert.match(source, /Linux adjunct manifest cohort does not match the base component manifest/);
  assert.match(source, /Linux adjunct manifest does not bind one exact Linux x64 package/);
  assert.match(source, /v\*-optional-\*/);
  assert.match(source, /desktop_release_asset_selection_requested/);
  assert.match(source, /validate_install_density_for_route "\$SELECTED_INSTALL_ROUTE"/);
  assert.match(source, /if desktop_release_asset_selection_requested; then\s+stable_macos_install/);
  assert.doesNotMatch(source, /OPL_NATIVE_WEBUI_|install-web\.sh|native-webui-qualified/);
});

test('macOS Full resolves from the exact Standard tag and binds its unified attestation', () => {
  const source = fs.readFileSync(installerPath, 'utf8');
  assert.match(source, /asset_name=\$\(release_asset_name "\$tag" full\)/);
  assert.match(source, /releases\/download\/\$tag\/\$asset_name/);
  assert.match(source, /carrier_context\.standard_attestation\.sha256/);
  assert.match(source, /Full public manifest does not bind the exact Full DMG digest and size/);
  assert.match(source, /Full DMG identity changed while validating its same-tag public manifest/);
  assert.match(source, /No same-tag Full module is published/);
  assert.match(source, /continuing with the Standard DMG/);
  assert.doesNotMatch(source, /resolve_full_adjunct_release_record/);
  assert.match(source, /resolve_linux_adjunct_release_record/);
});
