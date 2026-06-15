import {
  fileSha256,
  fs,
  os,
  path,
  spawnSync,
  writeExecutable,
  writeFile,
} from './helpers-core.ts';

export function writeReleaseMetadata(outDir, version, assetName) {
  writeFile(path.join(outDir, 'latest-mac.yml'), [
    `version: ${version}`,
    'files:',
    `  - url: ${assetName}`,
    '    sha512: test',
    '    size: 1',
    `path: ${assetName}`,
    'sha512: test',
    '',
  ].join('\n'));
}

export function localAuthorizationPolicy(packageKind) {
  return `${JSON.stringify({
    schema: 'opl_local_authorized_macos_policy.v1',
    package_kind: packageKind,
    stable_release_path: 'local_authorized_unsigned',
    apple_developer_id_required: false,
    gatekeeper_required: false,
    local_authorization_required: true,
    quarantine_removal_required: true,
    install_entrypoint: 'install-stable.sh',
    backing_entrypoint: 'install.sh --stable-macos-install --yes',
    default_package_profile: packageKind === 'app_full_first_install' ? 'full' : 'standard',
    user_prompt_policy: 'one_terminal_command_no_system_settings_override_expected_after_quarantine_clear',
    app_path: '/Applications/One Person Lab.app',
    codesign_status: 'passed',
    spctl_status: 'rejected_allowed_unsigned',
    quarantine_status: 'absent',
    quarantine_attribute_count: 0,
  }, null, 2)}\n`;
}

export function writeStandardLocalAuthorizationPolicy(outDir) {
  writeFile(
    path.join(outDir, 'standard-local-authorization-policy.json'),
    localAuthorizationPolicy('app_standard'),
  );
}

export function writeFullLocalAuthorizationPolicy(outDir) {
  writeFile(
    path.join(outDir, 'full-local-authorization-policy.json'),
    localAuthorizationPolicy('app_full_first_install'),
  );
}

export function writeFullRuntimeNativeTrust(outDir) {
  writeFile(
    path.join(outDir, 'full-runtime-native-trust.json'),
    `${JSON.stringify({
      schema: 'opl_full_runtime_native_trust.v1',
      status: 'passed',
      executable_count: 1,
      executables: [
        {
          relative_path: 'runtime/current/node/bin/node',
          assessment_kind: 'launched_executable',
          codesign_status: 'passed',
          spctl_status: 'passed',
          team_identifier: 'TESTTEAMID',
          signature: 'Developer ID Application: Test',
          quarantine_status: 'absent',
          provenance_status: 'absent',
        },
      ],
    }, null, 2)}\n`,
  );
}

export function buildRemoteReleaseView(assetDir, names, tagName) {
  return {
    tagName,
    isDraft: false,
    isPrerelease: false,
    assets: names.map((name) => {
      const filePath = path.join(assetDir, name);
      return {
        name,
        size: fs.statSync(filePath).size,
        digest: `sha256:${fileSha256(filePath)}`,
      };
    }),
  };
}

export function standardRemoteAssetNames(version) {
  return [
    `One-Person-Lab-${version}-mac-arm64.dmg`,
    `One-Person-Lab-${version}-mac-arm64.zip`,
    `One-Person-Lab-${version}-mac-arm64.dmg.blockmap`,
    `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
    'latest-mac.yml',
    'latest-arm64-mac.yml',
    'standard-local-authorization-policy.json',
  ];
}

function writeMinimalMacosAppBundle(appRoot, version) {
  const contentsDir = path.join(appRoot, 'Contents');
  const macosDir = path.join(contentsDir, 'MacOS');
  writeFile(path.join(contentsDir, 'Info.plist'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>CFBundleExecutable</key>',
    '  <string>One Person Lab</string>',
    '  <key>CFBundleIdentifier</key>',
    '  <string>com.onepersonlab.app</string>',
    '  <key>CFBundleShortVersionString</key>',
    `  <string>${version}</string>`,
    '  <key>CFBundleVersion</key>',
    `  <string>${version}</string>`,
    '</dict>',
    '</plist>',
    '',
  ].join('\n'));
  writeExecutable(path.join(macosDir, 'One Person Lab'), '#!/usr/bin/env bash\nexit 0\n');
}

function writeStandardUpdaterZip(zipPath, version) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-standard-updater-zip-'));
  try {
    writeMinimalMacosAppBundle(path.join(tempRoot, 'One Person Lab.app'), version);
    const result = spawnSync('zip', ['-qry', zipPath, 'One Person Lab.app'], {
      cwd: tempRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    if (result.status !== 0) {
      throw new Error(`zip failed: ${result.stderr || result.stdout}`);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function writeStandardRemoteAssets(outDir, version, options = {}) {
  const names = standardRemoteAssetNames(version);
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  writeFile(path.join(outDir, dmgName), 'standard-dmg');
  writeStandardUpdaterZip(path.join(outDir, zipName), version);
  writeFile(path.join(outDir, `${dmgName}.blockmap`), 'standard-dmg-blockmap');
  writeFile(path.join(outDir, `${zipName}.blockmap`), 'standard-zip-blockmap');
  writeStandardLocalAuthorizationPolicy(outDir);
  const metadata = [
    `version: ${version}`,
    'files:',
    `  - url: ${dmgName}`,
    '    sha512: test-dmg',
    '    size: 12',
    `  - url: ${zipName}`,
    '    sha512: test-zip',
    '    size: 12',
    `path: ${dmgName}`,
    'sha512: test-dmg',
    ...(options.fullLeak ? [`notes: One-Person-Lab-Full-${version}-mac-arm64.dmg`] : []),
    '',
  ].join('\n');
  writeFile(path.join(outDir, 'latest-mac.yml'), metadata);
  writeFile(path.join(outDir, 'latest-arm64-mac.yml'), metadata);
  return names;
}

export function writeFullRemoteAssets(outDir, version, options = {}) {
  const fullDmgName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  const manifest = {
    manifest_version: 2,
    version,
    package_kind: 'opl_full_first_install_macos_arm64',
    size_budget: {
      platform_scope: 'macos-arm64',
      warning_full_dmg_bytes: 700000000,
      max_full_dmg_bytes: 750000000,
      max_runtime_uncompressed_bytes: 1000000000,
    },
    measurement_policy: {
      full_dmg_bytes: 'github_release_asset_size_bytes',
      runtime_uncompressed_bytes: 'manifest_size_breakdown_total_runtime_uncompressed_bytes',
    },
    runtime_assertions: {
      temporal_core_bridge_releases: ['aarch64-apple-darwin'],
      excluded_module_venv_count: 0,
    },
    size_breakdown: {
      total_runtime_uncompressed_bytes: 128,
      layers: {
        toolchain: { size_bytes: 64 },
        'domain-runtime': { size_bytes: 32 },
        'opl-runtime': { size_bytes: 24 },
        skills: { size_bytes: 8 },
      },
    },
    distribution: {
      updater_metadata_allowed: false,
    },
    components: {
      codex: {
        source_path: '/tmp/codex',
        version: 'codex-cli 0.137.0',
        size_bytes: 801,
        role: 'default_agent_cli_offline_archive_wrapper',
        required: true,
        binary_path: null,
        archive_path: 'runtime/current/vendor/codex/codex_cli_darwin_arm64.tar.gz',
        archive_size_bytes: 83978603,
      },
      temporal_cli: {
        source_path: '/tmp/temporal',
        version: 'temporal version 1.7.0',
        size_bytes: 801,
        role: 'temporal_cli_offline_archive_wrapper',
        required: true,
        binary_path: null,
        archive_path: 'runtime/current/vendor/temporal/temporal_cli_darwin_arm64.tar.gz',
        archive_size_bytes: 114835528,
      },
    },
    optional_components: {
      bun: {
        source_path: null,
        version: null,
        size_bytes: 0,
        role: 'optional_bun_cli_runtime_payload',
        required: false,
        status: 'not_packaged',
      },
    },
    ...(options.manifest ?? {}),
  };
  writeFile(path.join(outDir, fullDmgName), options.dmgContent ?? 'full-dmg');
  writeFile(path.join(outDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFullLocalAuthorizationPolicy(outDir);
  writeFullRuntimeNativeTrust(outDir);
  writeFile(
    path.join(outDir, 'runtime-cache-events.json'),
    `${JSON.stringify({
      mode: 'readwrite',
      dir: '/tmp/opl-full-runtime-cache-test',
      keys: {
        toolchain: 'full-runtime-v1-toolchain-test',
        'domain-runtime': 'full-runtime-v1-domain-runtime-test',
        'opl-runtime': 'full-runtime-v1-opl-runtime-test',
        skills: 'full-runtime-v1-skills-test',
      },
      events: [
        {
          layer_id: 'toolchain',
          key: 'full-runtime-v1-toolchain-test',
          status: 'hit',
          archive_path: '/tmp/opl-full-runtime-cache-test/toolchain/full-runtime-v1-toolchain-test.tar.zst',
          read_archive: true,
          write_archive: false,
          build_layer: false,
        },
      ],
    }, null, 2)}\n`,
  );
  writeFile(path.join(outDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  const checksumNames = [
    fullDmgName,
    'full-package-manifest.json',
    'runtime-cache-events.json',
    'full-runtime-native-trust.json',
    'README-Full-First-Install.txt',
    'full-local-authorization-policy.json',
  ];
  writeFile(
    path.join(outDir, 'SHA256SUMS.txt'),
    checksumNames.map((name) => `${fileSha256(path.join(outDir, name))}  ${name}`).join('\n') + '\n',
  );
  return [
    fullDmgName,
    'full-package-manifest.json',
    'runtime-cache-events.json',
    'full-runtime-native-trust.json',
    'README-Full-First-Install.txt',
    'SHA256SUMS.txt',
    'full-local-authorization-policy.json',
  ];
}
