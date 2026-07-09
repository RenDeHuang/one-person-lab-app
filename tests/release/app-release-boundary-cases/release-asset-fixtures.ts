import {
  fileSha256,
  fs,
  os,
  path,
  spawnSync,
  writeExecutable,
  writeFile,
} from './helpers-core.ts';

const FULL_BUNDLED_EVIDENCE_ASSET_NAMES = [
  'full-package-manifest.json',
  'runtime-cache-events.json',
  'full-runtime-currentness-probe.json',
  'full-runtime-native-trust.json',
  'full-app-bundle-trim-report.json',
  'full-package-boundary-audit.json',
];

const FULL_LEGACY_SEPARATE_ASSET_NAMES = [
  ...FULL_BUNDLED_EVIDENCE_ASSET_NAMES,
  'README-Full-First-Install.txt',
  'SHA256SUMS.txt',
  'full-local-authorization-policy.json',
];

export function writeReleaseMetadata(outDir, version, assetName) {
  writeFile(path.join(outDir, 'latest-arm64-mac.yml'), [
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
    install_entrypoint: 'install.sh --stable-macos-install --yes',
    compatibility_entrypoints: ['install-stable.sh'],
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

function defaultReleaseBody(tagName) {
  const version = tagName.startsWith('v') ? tagName.slice(1) : tagName;
  return [
    `One Person Lab v${version}`,
    'This Stable release is for users installing or upgrading One Person Lab App.',
    '## Highlights',
    '- Use one Stable install path for the App plus refreshed research tools.',
    '## Technical details',
    '## OPL agents and runtime payload',
    '- Full first-install package includes the OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills.',
    '- Packaged component refs: MAS @ 1234567.',
    '- Component updates since previous Stable: MAS 0000000 -> 1234567.',
    `**Full Changelog**: https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.0.0...v${version}`,
  ].join('\n\n');
}

export function buildRemoteReleaseView(assetDir, names, tagName, body = defaultReleaseBody(tagName)) {
  return {
    tagName,
    isDraft: false,
    isPrerelease: false,
    body,
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
    `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
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
  writeFile(path.join(outDir, 'latest-arm64-mac.yml'), metadata);
  if (options.legacyMetadata) {
    writeFile(path.join(outDir, 'latest-mac.yml'), metadata);
  }
  return names;
}

export function writeFullRemoteAssets(outDir, version, options = {}) {
  const fullDmgName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  const protectedPayloads = [
    'Contents/Resources/opl-full-runtime',
    'Contents/Resources/bundled-aioncore',
    'Contents/Resources/app.asar',
    'Contents/Frameworks/Electron Framework.framework',
  ];
  const trimReport = {
    schema: 'opl_full_app_bundle_trim_report.v1',
    mode: 'explicit_non_runtime_prune_only',
    before_bytes: 1024,
    after_bytes: 960,
    bytes_removed: 64,
    removed_count: 2,
    required_payload_boundary: {
      full_runtime_resource_dir: protectedPayloads[0],
      protected_payloads: protectedPayloads,
      preserved: true,
      rule: 'never trim the declared Full offline runtime payload from the App bundle staging pass',
    },
  };
  const boundaryAudit = {
    schema: 'opl_full_package_boundary_audit.v1',
    package_kind: 'opl_full_first_install_macos_arm64',
    version,
    standard_app_boundary: { standard_package_allowed_to_contain_full_runtime: false },
    full_package_boundary: {
      contains_opl_full_runtime: true,
      contains_shell_runtime: true,
      dedupe_policy: 'audit_only_without_same_cohort_full_clean_vm_evidence',
    },
    entries: {
      opl_full_runtime: { path: protectedPayloads[0], owner: 'gaofeng21cn/one-person-lab', exists: true, size_bytes: 128 },
      aionui_bundled_runtime: { path: protectedPayloads[1], owner: 'active_shell', exists: true, size_bytes: 256 },
      app_asar: { path: protectedPayloads[2], owner: 'active_shell', exists: true, size_bytes: 64 },
      electron_framework: { path: protectedPayloads[3], owner: 'active_shell/electron', exists: true, size_bytes: 512 },
    },
  };
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
    distribution: { updater_metadata_allowed: false },
    package_optimization: {
      schema: 'opl_full_package_optimization.v1',
      offline_first_install_completeness_preserved: true,
      size_review_release_blocking_by_size_alone: false,
      app_bundle_trim: {
        schema: trimReport.schema,
        mode: trimReport.mode,
        before_bytes: trimReport.before_bytes,
        after_bytes: trimReport.after_bytes,
        bytes_removed: trimReport.bytes_removed,
        removed_count: trimReport.removed_count,
        required_payload_boundary: trimReport.required_payload_boundary,
      },
      package_boundary_audit: {
        schema: boundaryAudit.schema,
        standard_package_allowed_to_contain_full_runtime:
          boundaryAudit.standard_app_boundary.standard_package_allowed_to_contain_full_runtime,
        contains_opl_full_runtime: boundaryAudit.full_package_boundary.contains_opl_full_runtime,
        contains_shell_runtime: boundaryAudit.full_package_boundary.contains_shell_runtime,
        dedupe_policy: boundaryAudit.full_package_boundary.dedupe_policy,
        audited_entries: Object.fromEntries(Object.entries(boundaryAudit.entries).map(([id, entry]) => [
          id,
          { path: entry.path, owner: entry.owner, exists: entry.exists, size_bytes: entry.size_bytes },
        ])),
      },
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
      bun: { source_path: null, version: null, size_bytes: 0, role: 'optional_bun_cli_runtime_payload', required: false, status: 'not_packaged' },
    },
    ...(options.manifest ?? {}),
  };
  writeFile(path.join(outDir, fullDmgName), options.dmgContent ?? 'full-dmg');
  writeFile(path.join(outDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFullLocalAuthorizationPolicy(outDir);
  writeFullRuntimeNativeTrust(outDir);
  writeFile(
    path.join(outDir, 'full-app-bundle-trim-report.json'),
    `${JSON.stringify(trimReport, null, 2)}\n`,
  );
  writeFile(
    path.join(outDir, 'full-package-boundary-audit.json'),
    `${JSON.stringify(boundaryAudit, null, 2)}\n`,
  );
  writeFile(
    path.join(outDir, 'runtime-cache-events.json'),
    `${JSON.stringify({
      mode: 'readwrite',
      dir: '/tmp/opl-full-runtime-cache-test',
      events: [
        {
          layer_id: 'toolchain',
          key: 'full-runtime-v1-toolchain-test',
          status: 'hit',
          read_archive: true,
          write_archive: false,
          build_layer: false,
        },
      ],
    }, null, 2)}\n`,
  );
  writeFile(
    path.join(outDir, 'full-runtime-currentness-probe.json'),
    `${JSON.stringify({
      schema: 'opl_full_runtime_currentness_probe.v1',
      status: options.currentnessProbe?.status ?? 'passed',
      framework_commit: options.currentnessProbe?.framework_commit
        ?? manifest.components?.opl?.git_commit
        ?? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      managed_update_surface_id: options.currentnessProbe?.managed_update_surface_id ?? 'opl_managed_updater_kernel',
      managed_update_components: options.currentnessProbe?.managed_update_components
        ?? ['installation_carrier', 'runtime_substrate', 'capability_packages', 'codex_surface', 'companion_tools'],
      app_state_schema_version: options.currentnessProbe?.app_state_schema_version ?? 'opl_app_state.v1',
      app_state_module_count: options.currentnessProbe?.app_state_module_count ?? 5,
    }, null, 2)}\n`,
  );
  writeFile(path.join(outDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFile(
    path.join(outDir, 'SHA256SUMS.txt'),
    [fullDmgName, ...FULL_LEGACY_SEPARATE_ASSET_NAMES.filter((name) => name !== 'SHA256SUMS.txt')]
      .map((name) => `${fileSha256(path.join(outDir, name))}  ${name}`)
      .join('\n') + '\n',
  );
  if (!options.legacySeparateEvidenceAssets) {
    writeFile(
      path.join(outDir, 'opl-release-manifest.json'),
      `${JSON.stringify({
        schema: 'opl_public_release_manifest.v1',
        package_kind: 'opl_full_first_install_macos_arm64',
        version,
        primary_install_asset: fullDmgName,
        assets: [{ name: fullDmgName, role: 'full_first_install_carrier', size_bytes: fs.statSync(path.join(outDir, fullDmgName)).size, sha256: fileSha256(path.join(outDir, fullDmgName)) }],
        manifest,
        evidence: {
          runtime_cache_events: JSON.parse(fs.readFileSync(path.join(outDir, 'runtime-cache-events.json'), 'utf8')),
          runtime_currentness_probe: JSON.parse(fs.readFileSync(path.join(outDir, 'full-runtime-currentness-probe.json'), 'utf8')),
          runtime_native_trust: JSON.parse(fs.readFileSync(path.join(outDir, 'full-runtime-native-trust.json'), 'utf8')),
          app_bundle_trim_report: trimReport,
          package_boundary_audit: boundaryAudit,
          local_authorization_policy: JSON.parse(fs.readFileSync(path.join(outDir, 'full-local-authorization-policy.json'), 'utf8')),
          readme_text: fs.readFileSync(path.join(outDir, 'README-Full-First-Install.txt'), 'utf8'),
        },
        transition_legacy_assets: FULL_BUNDLED_EVIDENCE_ASSET_NAMES,
      }, null, 2)}\n`,
    );
    for (const name of FULL_LEGACY_SEPARATE_ASSET_NAMES) {
      fs.rmSync(path.join(outDir, name), { force: true });
    }
    return [
      fullDmgName,
      'opl-release-manifest.json',
    ];
  }
  return [
    fullDmgName,
    ...FULL_LEGACY_SEPARATE_ASSET_NAMES,
  ];
}
