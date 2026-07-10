import { withFullPackageOptimization } from '../../../scripts/build-full-first-install-package/package-optimization.ts';
import { path, writeFile } from './helpers.ts';

const protectedPayloads = [
  'Contents/Resources/opl-full-runtime',
  'Contents/Resources/bundled-aioncore',
  'Contents/Resources/app.asar',
  'Contents/Resources/app.asar.unpacked',
  'Contents/Frameworks/Electron Framework.framework',
];

function optimizationEvidence(version = 'test') {
  const entries = Object.fromEntries([
    ['opl_full_runtime', protectedPayloads[0], 'gaofeng21cn/one-person-lab', 128],
    ['aionui_bundled_runtime', protectedPayloads[1], 'active_shell', 256],
    ['app_asar', protectedPayloads[2], 'active_shell', 64],
    ['electron_framework', protectedPayloads[4], 'active_shell/electron', 512],
  ].map(([id, entryPath, owner, sizeBytes]) => [id, {
    path: entryPath,
    owner,
    exists: true,
    size_bytes: sizeBytes,
  }]));
  const trimReport = {
    schema: 'opl_full_app_bundle_trim_report.v1',
    mode: 'explicit_non_runtime_prune_only',
    app_bundle_path: '/tmp/One Person Lab.app',
    required_payload_boundary: {
      full_runtime_resource_dir: protectedPayloads[0],
      protected_payloads: protectedPayloads,
      preserved: true,
    },
    before_bytes: 1024,
    after_bytes: 960,
    bytes_removed: 64,
    removed_count: 1,
    removed_paths: [
      { path: 'Contents/Resources/app.asar.map', size_bytes: 64, reason: 'staged_app_non_runtime_file' },
    ],
  };
  const boundaryAudit = {
    schema: 'opl_full_package_boundary_audit.v1',
    app_bundle_path: '/tmp/One Person Lab.app',
    package_kind: 'opl_full_first_install_macos_arm64',
    version,
    standard_app_boundary: { standard_package_allowed_to_contain_full_runtime: false },
    full_package_boundary: {
      contains_opl_full_runtime: true,
      contains_shell_runtime: true,
      dedupe_policy: 'audit_only_without_same_cohort_full_clean_vm_evidence',
    },
    entries,
  };
  return { trimReport, boundaryAudit };
}

export function withFullPackageOptimizationManifest(manifest) {
  return withFullPackageOptimization(manifest, optimizationEvidence(manifest.version));
}

export function writeFullPackageOptimizationArtifacts(fullPackageDir, version = 'test') {
  const { trimReport, boundaryAudit } = optimizationEvidence(version);
  for (const [name, payload] of [
    ['full-app-bundle-trim-report.json', trimReport],
    ['full-package-boundary-audit.json', boundaryAudit],
  ] as const) {
    writeFile(path.join(fullPackageDir, name), `${JSON.stringify(payload, null, 2)}\n`);
  }
}
