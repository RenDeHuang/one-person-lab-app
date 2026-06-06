import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

export function writeJson(filePath: string, payload: unknown) {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function runSummary(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/summarize-release-readiness.ts', ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_RUN_ID: 'local', ...env },
    },
  );
}

export function runCandidateRecord(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/write-release-candidate-record.ts', ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_RUN_ID: 'local', ...env },
    },
  );
}

export function runCandidateRecordValidator(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/validate-release-candidate-record.ts', ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    },
  );
}

export function writePassingArtifacts(root: string, version = '26.5.99', runId = 'local', options: {
  fullBudget?: Record<string, unknown>;
  runtimeCacheEvents?: unknown[];
} = {}) {
  const standardDmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const fullDmgName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  writeJson(path.join(root, `remote-release-verification-${version}`, 'remote-release-verification.json'), {
    status: 'passed',
    include_full_package: true,
    verified_asset_count: 10,
    verified_assets: [
      {
        name: standardDmgName,
        size: 512,
        sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      {
        name: fullDmgName,
        size: 1024,
        sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    ],
    full_first_install_budget: {
      status: 'passed',
      full_dmg_size_bytes: 512,
      runtime_uncompressed_bytes: 1024,
      ...options.fullBudget,
    },
  });
  writeJson(path.join(root, `opl-first-run-vm-standard-${runId}`, 'tart-smoke-summary.json'), {
    status: 'passed',
    runtime_profile: 'standard',
    settings_smoke: { status: 'passed', pages: ['overview'] },
  });
  writeJson(path.join(root, `opl-first-run-vm-homebrew-standard-${runId}`, 'tart-smoke-summary.json'), {
    status: 'passed',
    runtime_profile: 'standard',
    settings_smoke: { status: 'passed', pages: ['overview'] },
  });
  writeJson(path.join(root, `homebrew-tap-plan-stable-app_standard-${version}`, 'homebrew-tap-plan.json'), {
    channel: 'stable',
    package_kind: 'app_standard',
    version,
    dry_run: false,
    manifest_url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${version}/latest-arm64-mac.yml`,
    checksum_sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    download_url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${version}/${standardDmgName}`,
    targets: [{ path: 'Casks/one-person-lab.rb', kind: 'cask', previous_exists: true, changed: true }],
    policy: {
      cohort: 'standard_desktop_homebrew_distribution',
      remote_write_mode: 'direct_commit',
      publishes_or_pushes_remote: true,
    },
  });
  writeJson(path.join(root, `homebrew-tap-plan-stable-app_full_first_install-${version}`, 'homebrew-tap-plan.json'), {
    channel: 'stable',
    package_kind: 'app_full_first_install',
    version,
    dry_run: false,
    manifest_url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${version}/full-package-manifest.json`,
    checksum_sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    download_url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${version}/${fullDmgName}`,
    targets: [{ path: 'Casks/one-person-lab-full.rb', kind: 'cask', previous_exists: true, changed: true }],
    policy: {
      cohort: 'full_first_install_homebrew_distribution',
      remote_write_mode: 'direct_commit',
      publishes_or_pushes_remote: true,
      full_first_install_allowed: true,
      standard_updater_visible: false,
    },
  });
  writeJson(path.join(root, `opl-first-run-vm-full-${runId}`, 'tart-smoke-summary.json'), {
    status: 'passed',
    runtime_profile: 'full',
    settings_smoke: { status: 'passed', pages: ['overview'] },
  });
  writeJson(path.join(root, `one-shot-app-installer-smoke-${version}`, 'opl-one-shot-system-initialize.json'), {
    system_initialize: {
      setup_flow: {
        status: 'ready_to_launch',
        phase: 'core_ready',
        core_progress: { completed: 3, total: 3 },
        full_readiness_progress: { completed: 1, total: 4 },
        maintenance_progress: { completed: 0, total: 2 },
        blockers: [],
        next_visible_step: 'Open One Person Lab',
      },
    },
  });
  writeFile(path.join(root, `docker-webui-smoke-${version}`, 'opl-webui-index.html'), '<html></html>');
  writeFile(path.join(root, `docker-webui-smoke-${version}`, 'opl-webui-manifest.webmanifest'), '{"name":"One Person Lab"}\n');
  writeFile(path.join(root, `docker-webui-smoke-${version}`, 'opl-webui-image-size-bytes.txt'), '123456\n');
  writeJson(path.join(root, `webui-ghcr-publish-${version}`, 'opl-webui-ghcr-publish.json'), {
    status: 'draft_not_pushed',
    image: 'ghcr.io/gaofeng21cn/one-person-lab-webui',
    tags: [version, 'stable', 'latest'],
    draft_candidate_push: false,
  });
  writeJson(path.join(root, `opl-full-workflow-telemetry-${version}`, 'full-workflow-telemetry.json'), {
    schema: 'opl_full_workflow_telemetry.v1',
    cache: { full_runtime_layers: 'toolchain:true;domain-runtime:true;opl-runtime:true;skills:true' },
    resolved_refs: {
      opl_framework: { ref: 'main', commit: '1111111111111111111111111111111111111111' },
      mas: { ref: 'main', commit: '2222222222222222222222222222222222222222' },
      mag: { ref: 'main', commit: '3333333333333333333333333333333333333333' },
      rca: { ref: 'main', commit: '4444444444444444444444444444444444444444' },
      opl_meta_agent: { ref: 'main', commit: '5555555555555555555555555555555555555555' },
      officecli: { ref: 'main', commit: '6666666666666666666666666666666666666666' },
      mineru: { ref: 'main', commit: '7777777777777777777777777777777777777777' },
      ui_ux_skill: { ref: 'main', commit: '8888888888888888888888888888888888888888' },
    },
    duration_seconds: {
      full_package_build: 380,
      full_package_build_breakdown: {
        runtime_materialize: 1,
        runtime_cache_materialize: 2,
        payload_sync: 3,
        shell_build: 4,
        dmg_package_compression: 5,
        manifest_checksum: 6,
      },
    },
  });
  writeJson(path.join(root, `opl-full-diagnostics-${version}`, 'full-package-manifest.json'), {
    manifest_version: 2,
    version: '26.5.99',
    package_kind: 'opl_full_first_install_macos_arm64',
    resolved_refs: {
      opl_framework: { ref: 'main', commit: '1111111111111111111111111111111111111111' },
      mas: { ref: 'main', commit: '2222222222222222222222222222222222222222' },
      mag: { ref: 'main', commit: '3333333333333333333333333333333333333333' },
      rca: { ref: 'main', commit: '4444444444444444444444444444444444444444' },
      opl_meta_agent: { ref: 'main', commit: '5555555555555555555555555555555555555555' },
      officecli: { ref: 'main', commit: '6666666666666666666666666666666666666666' },
      mineru: { ref: 'main', commit: '7777777777777777777777777777777777777777' },
      ui_ux_skill: { ref: 'main', commit: '8888888888888888888888888888888888888888' },
    },
    size_breakdown: { total_runtime_uncompressed_bytes: 1024 },
  });
  writeJson(path.join(root, `opl-full-diagnostics-${version}`, 'runtime-cache-events.json'), {
    events: options.runtimeCacheEvents ?? [{ layer_id: 'toolchain', status: 'hit' }],
  });
  writeFile(path.join(root, `opl-full-diagnostics-${version}`, 'SHA256SUMS.txt'), 'checksum evidence\n');
  writeJson(path.join(root, `release-evidence-bundle-${version}`, 'evidence-validation-summary.json'), {
    schema: 'opl_release_evidence_bundle_validation.v1',
    status: 'passed',
    bundle_dir: `release-evidence/${version}`,
    manifest_path: 'evidence-manifest.json',
    verified_artifact_count: 16,
    missing_artifact_count: 0,
    blocked_artifact_count: 0,
    packaged_app_evidence: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    forbidden_authority: [
      'runtime_truth',
      'provider_implementation',
      'domain_truth',
      'domain_quality_verdict',
      'domain_artifact_authority',
    ],
  });
}

export function writePassingJobResults(filePath: string) {
  writeJson(filePath, {
    'full-first-install': 'success',
    'remote-verify-standard': 'skipped',
    'remote-verify-full': 'success',
    'standard-first-run-vm-smoke-after-standard-only': 'skipped',
    'standard-first-run-vm-smoke-after-full': 'success',
    'stable-homebrew-tap-update': 'success',
    'full-homebrew-tap-update': 'success',
    'homebrew-standard-first-run-vm-smoke': 'success',
    'full-first-run-vm-smoke': 'success',
    'one-shot-app-installer-smoke': 'success',
    'docker-webui-smoke': 'success',
    'webui-ghcr-publish': 'success',
    'operator-evidence-bundle-validation': 'success',
  });
}
