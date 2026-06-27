import {
  path,
  writeFile,
} from './helpers.ts';

export function withFullPackageOptimizationManifest(manifest) {
  return {
    ...manifest,
    package_optimization: {
      schema: 'opl_full_package_optimization.v1',
      offline_first_install_completeness_preserved: true,
      size_review_release_blocking_by_size_alone: false,
      app_bundle_trim: {
        schema: 'opl_full_app_bundle_trim_report.v1',
        mode: 'explicit_non_runtime_prune_only',
        before_bytes: 1024,
        after_bytes: 960,
        bytes_removed: 64,
        removed_count: 1,
        required_payload_boundary: {
          full_runtime_resource_dir: 'Contents/Resources/opl-full-runtime',
          protected_payloads: [
            'Contents/Resources/opl-full-runtime',
            'Contents/Resources/bundled-aioncore',
            'Contents/Resources/app.asar',
            'Contents/Resources/app.asar.unpacked',
            'Contents/Frameworks/Electron Framework.framework',
          ],
          preserved: true,
        },
      },
      package_boundary_audit: {
        schema: 'opl_full_package_boundary_audit.v1',
        standard_package_allowed_to_contain_full_runtime: false,
        contains_opl_full_runtime: true,
        contains_shell_runtime: true,
        dedupe_policy: 'audit_only_without_same_cohort_full_clean_vm_evidence',
        audited_entries: {
          opl_full_runtime: {
            path: 'Contents/Resources/opl-full-runtime',
            owner: 'gaofeng21cn/one-person-lab',
            exists: true,
            size_bytes: 128,
          },
          aionui_bundled_runtime: {
            path: 'Contents/Resources/bundled-aioncore',
            owner: 'active_shell',
            exists: true,
            size_bytes: 256,
          },
          app_asar: {
            path: 'Contents/Resources/app.asar',
            owner: 'active_shell',
            exists: true,
            size_bytes: 64,
          },
          electron_framework: {
            path: 'Contents/Frameworks/Electron Framework.framework',
            owner: 'active_shell/electron',
            exists: true,
            size_bytes: 512,
          },
        },
      },
    },
  };
}

export function writeFullPackageOptimizationArtifacts(fullPackageDir, version = 'test') {
  writeFile(
    path.join(fullPackageDir, 'full-app-bundle-trim-report.json'),
    `${JSON.stringify({
      schema: 'opl_full_app_bundle_trim_report.v1',
      mode: 'explicit_non_runtime_prune_only',
      app_bundle_path: '/tmp/One Person Lab.app',
      required_payload_boundary: {
        full_runtime_resource_dir: 'Contents/Resources/opl-full-runtime',
        protected_payloads: [
          'Contents/Resources/opl-full-runtime',
          'Contents/Resources/bundled-aioncore',
          'Contents/Resources/app.asar',
          'Contents/Resources/app.asar.unpacked',
          'Contents/Frameworks/Electron Framework.framework',
        ],
        preserved: true,
      },
      before_bytes: 1024,
      after_bytes: 960,
      bytes_removed: 64,
      removed_count: 1,
      removed_paths: [
        { path: 'Contents/Resources/app.asar.map', size_bytes: 64, reason: 'staged_app_non_runtime_file' },
      ],
    }, null, 2)}\n`,
  );
  writeFile(
    path.join(fullPackageDir, 'full-package-boundary-audit.json'),
    `${JSON.stringify({
      schema: 'opl_full_package_boundary_audit.v1',
      app_bundle_path: '/tmp/One Person Lab.app',
      package_kind: 'opl_full_first_install_macos_arm64',
      version,
      standard_app_boundary: {
        standard_package_allowed_to_contain_full_runtime: false,
        standard_payload_guard: 'scripts/prepare-standard-release-payload.ts removes packaged-runtimes/opl-full-runtime before standard builds',
      },
      full_package_boundary: {
        contains_opl_full_runtime: true,
        contains_shell_runtime: true,
        dedupe_policy: 'audit_only_without_same_cohort_full_clean_vm_evidence',
        rule: 'Do not dedupe or remove declared offline Full runtime, shell runtime, native trust, or Core readiness payloads for size alone.',
      },
      entries: {
        opl_full_runtime: {
          path: 'Contents/Resources/opl-full-runtime',
          owner: 'gaofeng21cn/one-person-lab',
          exists: true,
          size_bytes: 128,
        },
        aionui_bundled_runtime: {
          path: 'Contents/Resources/bundled-aioncore',
          owner: 'active_shell',
          exists: true,
          size_bytes: 256,
        },
        app_asar: {
          path: 'Contents/Resources/app.asar',
          owner: 'active_shell',
          exists: true,
          size_bytes: 64,
        },
        electron_framework: {
          path: 'Contents/Frameworks/Electron Framework.framework',
          owner: 'active_shell/electron',
          exists: true,
          size_bytes: 512,
        },
      },
    }, null, 2)}\n`,
  );
}
