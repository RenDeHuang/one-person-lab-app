#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Lane = {
  id: string;
  phase: 'fast_candidate' | 'parallel_build' | 'remote_gate' | 'installation_gate' | 'release_gate' | 'publish' | 'post_release';
  depends_on: string[];
  can_run_with: string[];
  command: string;
  required_for: string[];
};

const FULL_PAYLOAD_REF_AUDIT = {
  schema: 'opl_full_payload_ref_audit_plan.v1',
  record_path: 'dist/opl-full-release/full-package-manifest.json#resolved_refs',
  telemetry_path: 'dist/opl-full-release/full-workflow-telemetry.json#payload_refs',
  summary_section: 'Full Payload Resolved Refs',
  resolution: 'actual_full_workflow_checkout_commit',
  modes: {
    stable: {
      records_resolved_refs: true,
      pin_input_required: false,
      default_refs_can_follow_main: true,
    },
    draft_candidate: {
      records_resolved_refs: true,
      pin_input_required: false,
      default_refs_can_follow_main: true,
    },
  },
  payloads: {
    opl_framework: {
      label: 'OPL Framework',
      repository: 'gaofeng21cn/one-person-lab',
      default_ref: 'main',
      workflow_input: 'framework_ref',
    },
    mas: {
      label: 'MAS',
      repository: 'gaofeng21cn/med-autoscience',
      default_ref: 'main',
    },
    mag: {
      label: 'MAG',
      repository: 'gaofeng21cn/med-autogrant',
      default_ref: 'main',
    },
    rca: {
      label: 'RCA',
      repository: 'gaofeng21cn/redcube-ai',
      default_ref: 'main',
    },
    opl_meta_agent: {
      label: 'OPL Meta Agent',
      repository: 'gaofeng21cn/opl-meta-agent',
      default_ref: 'main',
    },
    officecli: {
      label: 'OfficeCLI',
      repository: 'iOfficeAI/OfficeCLI',
      default_ref: 'main',
    },
    mineru: {
      label: 'MinerU',
      repository: 'opendatalab/MinerU-Ecosystem',
      default_ref: 'main',
    },
    ui_ux_skill: {
      label: 'UI UX skill',
      repository: 'nextlevelbuilder/ui-ux-pro-max-skill',
      default_ref: 'main',
    },
  },
} as const;

function parseArgs(argv: string[]) {
  const parsed = {
    version: process.env.OPL_RELEASE_VERSION || '',
    profile: 'stable',
    includeFullPackage: false,
    settingsVm: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--include-full-package') {
      parsed.includeFullPackage = true;
      continue;
    }
    if (token === '--profile') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${token}`);
      }
      if (value !== 'stable' && value !== 'nightly') {
        throw new Error(`Unsupported release profile: ${value}`);
      }
      parsed.profile = value;
      index += 1;
      continue;
    }
    if (token === '--no-settings-vm') {
      parsed.settingsVm = false;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    if (token === '--version') {
      parsed.version = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!parsed.version.trim()) {
    throw new Error('Missing release version. Pass --version <version> or set OPL_RELEASE_VERSION.');
  }
  return parsed;
}

function buildPlan(options: ReturnType<typeof parseArgs>) {
  if (options.profile === 'nightly') {
    return {
      schema_version: 1,
      version: options.version,
      profile: 'nightly_standard',
      release_repo: 'gaofeng21cn/one-person-lab-app',
      strategy: {
        same_tag_replacement: 'allowed_for_prerelease_refresh',
        resume_uploads: 'skip_existing_assets_when_size_and_sha256_digest_match',
        full_runtime_cache: 'not_used',
        vm_policy: 'not_required_for_nightly_standard',
      },
      lanes: [
        {
          id: 'release_preflight',
          phase: 'fast_candidate',
          depends_on: [],
          can_run_with: [],
          command: `npm run release:preflight -- --version ${options.version} --release-mode refresh_existing --include-full-package false --run-vm-smoke false`,
          required_for: ['nightly_standard_release'],
        },
        {
          id: 'release_boundary',
          phase: 'fast_candidate',
          depends_on: ['release_preflight'],
          can_run_with: ['standard_build'],
          command: 'npm run test:release-boundary',
          required_for: ['nightly_standard_release'],
        },
        {
          id: 'standard_build',
          phase: 'parallel_build',
          depends_on: ['release_preflight'],
          can_run_with: ['release_boundary'],
          command: `npm run build-mac:arm64 && node --experimental-strip-types scripts/validate-release.ts release-assets`,
          required_for: ['nightly_standard_release'],
        },
        {
          id: 'publish_nightly_prerelease',
          phase: 'publish',
          depends_on: ['standard_build', 'release_boundary'],
          can_run_with: [],
          command: `.github/workflows/nightly-standard-release.yml publishes v${options.version} as --prerelease --latest=false`,
          required_for: ['nightly_standard_release'],
        },
        {
          id: 'remote_verify_standard',
          phase: 'remote_gate',
          depends_on: ['publish_nightly_prerelease'],
          can_run_with: ['webui_ghcr_publish'],
          command: `npm run verify-remote-release -- --version ${options.version}`,
          required_for: ['nightly_standard_release'],
        },
        {
          id: 'webui_ghcr_publish',
          phase: 'publish',
          depends_on: ['publish_nightly_prerelease'],
          can_run_with: ['remote_verify_standard'],
          command: [
            `.github/workflows/nightly-standard-release.yml builds and verifies one-person-lab-webui:${options.version}`,
            `docker push ghcr.io/<owner>/one-person-lab-webui:${options.version}`,
            'docker push ghcr.io/<owner>/one-person-lab-webui:nightly',
          ].join(' && '),
          required_for: ['nightly_standard_release'],
        },
      ] satisfies Lane[],
    };
  }

  const lanes: Lane[] = [
    {
      id: 'release_preflight',
      phase: 'fast_candidate',
      depends_on: [],
      can_run_with: [],
      command: [
        'npm run release:preflight --',
        `--version ${options.version}`,
        '--release-mode new_release',
        `--include-full-package ${options.includeFullPackage ? 'true' : 'false'}`,
        `--run-vm-smoke ${options.settingsVm ? 'true' : 'false'}`,
      ].join(' '),
      required_for: ['standard_release', ...(options.includeFullPackage ? ['full_first_install'] : [])],
    },
    {
      id: 'release_boundary',
      phase: 'fast_candidate',
      depends_on: ['release_preflight'],
      can_run_with: ['standard_build', 'full_runtime_keys', 'active_shell_quick_validation'],
      command: 'npm run test:release-boundary',
      required_for: ['standard_release', 'full_first_install'],
    },
    {
      id: 'standard_build',
      phase: 'parallel_build',
      depends_on: ['release_preflight'],
      can_run_with: options.includeFullPackage ? ['full_build'] : [],
      command: `npm run build-mac:arm64 && npm run release:publish -- --dry-run --version ${options.version}`,
      required_for: ['standard_release'],
    },
    {
      id: 'full_runtime_keys',
      phase: 'fast_candidate',
      depends_on: ['release_preflight', 'release_boundary'],
      can_run_with: ['active_shell_quick_validation', 'standard_build'],
      command: `npm run release:full -- --version ${options.version} --print-runtime-cache-keys`,
      required_for: ['full_first_install'],
    },
    {
      id: 'active_shell_quick_validation',
      phase: 'fast_candidate',
      depends_on: ['release_preflight'],
      can_run_with: ['release_boundary', 'full_runtime_keys'],
      command: 'npm run validate:active-shell -- --quick',
      required_for: ['standard_release', 'full_first_install'],
    },
  ];

  if (options.includeFullPackage) {
    lanes.push({
      id: 'full_build',
      phase: 'parallel_build',
      depends_on: ['release_preflight', 'full_runtime_keys'],
      can_run_with: ['standard_build', 'release_boundary', 'active_shell_quick_validation'],
      command: [
        'OPL_FULL_RUNTIME_CACHE_MODE=readwrite',
        'npm run release:full --',
        `--version ${options.version}`,
      ].join(' '),
      required_for: ['full_first_install'],
    });
  }

  lanes.push({
    id: 'publish_standard',
    phase: 'publish',
    depends_on: ['standard_build', 'release_boundary', 'active_shell_quick_validation'],
    can_run_with: options.includeFullPackage ? ['full_build'] : [],
    command: `.github/workflows/desktop-release.yml release_mode=new_release publishes standard assets to draft v${options.version}`,
    required_for: ['standard_release'],
  });

  if (options.includeFullPackage) {
    lanes.push({
      id: 'publish_full_assets',
      phase: 'publish',
      depends_on: ['publish_standard', 'full_build'],
      can_run_with: [
        'standard_dmg_clean_vm_smoke',
        'one_shot_app_installer_smoke',
        'docker_webui_smoke',
      ],
      command: [
        'npm run release:publish --',
        '--no-build',
        `--version ${options.version}`,
        '--full-package-only',
        '--include-full-package',
        '--full-package-dir <downloaded-full-package-artifact>',
      ].join(' '),
      required_for: ['full_first_install'],
    });
  }

  if (options.settingsVm) {
    lanes.push({
      id: 'standard_dmg_clean_vm_smoke',
      phase: 'installation_gate',
      depends_on: ['publish_standard'],
      can_run_with: options.includeFullPackage
        ? ['full_build', 'publish_full_assets', 'one_shot_app_installer_smoke', 'docker_webui_smoke']
        : ['one_shot_app_installer_smoke', 'docker_webui_smoke'],
      command: [
        'npm run test:opl-first-run-vm:tart --',
        '--source-vm opl-first-run-no-clt-clean-base',
        `--dmg dist/standard-release/One-Person-Lab-${options.version}-mac-arm64.dmg`,
        '--smoke-profile no-clt-clean-vm',
        '--display 1920x1080px',
        '--settings-smoke',
        '--assistant-route-smoke',
        '--runtime-profile standard',
      ].join(' '),
      required_for: ['standard_release'],
    });
    lanes.push({
      id: 'homebrew_standard_cask_clean_vm_smoke',
      phase: 'installation_gate',
      depends_on: ['publish_standard'],
      can_run_with: options.includeFullPackage
        ? ['full_build', 'publish_full_assets', 'one_shot_app_installer_smoke', 'docker_webui_smoke']
        : ['one_shot_app_installer_smoke', 'docker_webui_smoke'],
      command: [
        'npm run test:opl-first-run-vm:tart --',
        '--source-vm opl-first-run-homebrew-ready-base',
        '--install-mode homebrew-cask',
        '--homebrew-cask one-person-lab',
        '--smoke-profile homebrew-standard-cask',
        '--display 1920x1080px',
        '--settings-smoke',
        '--assistant-route-smoke',
        '--runtime-profile standard',
      ].join(' '),
      required_for: ['standard_release'],
    });
    lanes.push({
      id: 'full_dmg_clean_vm_smoke',
      phase: 'release_gate',
      depends_on: ['remote_verify_standard_and_full'],
      can_run_with: [],
      command: [
        'npm run test:opl-first-run-vm:tart --',
        '--source-vm opl-first-run-no-clt-clean-base',
        `--dmg dist/opl-full-release/One-Person-Lab-Full-${options.version}-mac-arm64.dmg`,
        '--smoke-profile no-clt-clean-vm',
        '--display 1920x1080px',
        '--settings-smoke',
        '--assistant-route-smoke',
        '--runtime-profile full',
      ].join(' '),
      required_for: ['full_first_install'],
    });
  }

  lanes.push({
    id: 'remote_verify_standard_and_full',
    phase: 'remote_gate',
    depends_on: options.includeFullPackage ? ['publish_full_assets'] : ['publish_standard'],
    can_run_with: options.includeFullPackage
      ? ['standard_dmg_clean_vm_smoke', 'one_shot_app_installer_smoke', 'docker_webui_smoke']
      : ['standard_dmg_clean_vm_smoke', 'one_shot_app_installer_smoke', 'docker_webui_smoke'],
    command: [
      'npm run verify-remote-release --',
      `--version ${options.version}`,
      options.includeFullPackage ? '--include-full-package' : '',
    ].filter(Boolean).join(' '),
    required_for: ['standard_release', ...(options.includeFullPackage ? ['full_first_install'] : [])],
  });

  lanes.push({
    id: 'one_shot_app_installer_smoke',
    phase: 'installation_gate',
    depends_on: ['publish_standard'],
    can_run_with: options.includeFullPackage
      ? ['standard_dmg_clean_vm_smoke', 'full_build', 'publish_full_assets', 'docker_webui_smoke']
      : ['standard_dmg_clean_vm_smoke', 'docker_webui_smoke'],
    command: 'OPL_INSTALL_SCRIPT_URL=file://<framework-checkout>/install.sh ./install.sh --complete --skip-modules',
    required_for: ['stable_release'],
  });

  lanes.push({
    id: 'docker_webui_smoke',
    phase: 'installation_gate',
    depends_on: ['publish_standard'],
    can_run_with: options.includeFullPackage
      ? ['standard_dmg_clean_vm_smoke', 'full_build', 'publish_full_assets', 'one_shot_app_installer_smoke']
      : ['standard_dmg_clean_vm_smoke', 'one_shot_app_installer_smoke'],
    command: [
      `docker build -t one-person-lab-webui:${options.version} shells/aionui`,
      `docker run --rm -d -p 127.0.0.1::3000 one-person-lab-webui:${options.version}`,
      'curl -fsS http://127.0.0.1:<port>/',
      'curl -fsS http://127.0.0.1:<port>/manifest.webmanifest',
    ].join(' && '),
    required_for: ['stable_release'],
  });

  lanes.push({
    id: 'webui_ghcr_publish',
    phase: 'publish',
    depends_on: ['docker_webui_smoke'],
    can_run_with: options.includeFullPackage
      ? ['standard_dmg_clean_vm_smoke', 'full_build', 'publish_full_assets', 'one_shot_app_installer_smoke']
      : ['standard_dmg_clean_vm_smoke', 'one_shot_app_installer_smoke'],
    command: [
      `docker tag one-person-lab-webui:${options.version} ghcr.io/<owner>/one-person-lab-webui:${options.version}`,
      `docker tag one-person-lab-webui:${options.version} ghcr.io/<owner>/one-person-lab-webui:stable`,
      `docker tag one-person-lab-webui:${options.version} ghcr.io/<owner>/one-person-lab-webui:latest`,
      'docker push ghcr.io/<owner>/one-person-lab-webui:<app_or_opl_version>',
      'docker push ghcr.io/<owner>/one-person-lab-webui:stable',
      'docker push ghcr.io/<owner>/one-person-lab-webui:latest',
    ].join(' && '),
    required_for: ['stable_release'],
  });

  lanes.push({
    id: 'release_evidence_bundle',
    phase: 'release_gate',
    depends_on: [
      'remote_verify_standard_and_full',
      ...(options.settingsVm ? ['standard_dmg_clean_vm_smoke'] : []),
      ...(options.settingsVm ? ['homebrew_standard_cask_clean_vm_smoke'] : []),
      ...(options.includeFullPackage && options.settingsVm ? ['full_dmg_clean_vm_smoke'] : []),
      'one_shot_app_installer_smoke',
      'docker_webui_smoke',
      'webui_ghcr_publish',
    ],
    can_run_with: [],
    command: `npm run release:evidence:validate -- --bundle-dir release-evidence/${options.version}`,
    required_for: ['stable_release'],
  });

  lanes.push({
    id: 'release_readiness_summary',
    phase: 'release_gate',
    depends_on: [
      'publish_standard',
      ...(options.includeFullPackage ? ['publish_full_assets'] : []),
      'remote_verify_standard_and_full',
      ...(options.settingsVm ? ['standard_dmg_clean_vm_smoke'] : []),
      ...(options.settingsVm ? ['homebrew_standard_cask_clean_vm_smoke'] : []),
      ...(options.includeFullPackage && options.settingsVm ? ['full_dmg_clean_vm_smoke'] : []),
      'one_shot_app_installer_smoke',
      'docker_webui_smoke',
      'webui_ghcr_publish',
      'release_evidence_bundle',
    ],
    can_run_with: [],
    command: '.github/workflows/desktop-release.yml release-readiness-summary writes release-readiness-summary.json from small diagnostic artifacts and fails closed on any required gate',
    required_for: ['stable_release'],
  });

  lanes.push({
    id: 'release_candidate_record',
    phase: 'release_gate',
    depends_on: ['release_preflight', 'release_readiness_summary', 'remote_verify_standard_and_full'],
    can_run_with: [],
    command: 'npm run release:candidate-record -- --version <version> --preflight release-preflight-summary.json --readiness release-readiness-summary.json --remote-verification remote-release-verification.json',
    required_for: ['stable_release_promotion'],
  });

  lanes.push({
    id: 'promote_stable_release',
    phase: 'publish',
    depends_on: [
      'release_candidate_record',
    ],
    can_run_with: [],
    command: [
      '.github/workflows/desktop-release-promote.yml',
      `--version ${options.version}`,
      'reads only release-candidate-record.json',
      'requires status=ready_to_promote',
      'runs gh release edit --draft=false --latest',
    ].join(' '),
    required_for: ['standard_release', ...(options.includeFullPackage ? ['full_first_install'] : [])],
  });

  lanes.push({
    id: 'release_promotion_record',
    phase: 'release_gate',
    depends_on: [
      'promote_stable_release',
      'release_candidate_record',
    ],
    can_run_with: [],
    command: 'release promotion records preserve the candidate record plus final publish result for post-release audit',
    required_for: ['stable_release'],
  });

  lanes.push({
    id: 'post_release_user_guide_screenshots',
    phase: 'post_release',
    depends_on: ['release_promotion_record'],
    can_run_with: [],
    command: 'npm run docs:macos-guide after promotion, using published stable release screenshots/provenance; never a pre-promotion gate',
    required_for: ['post_release_docs_refresh'],
  });

  return {
    schema_version: 1,
    version: options.version,
    profile: 'stable',
    release_repo: 'gaofeng21cn/one-person-lab-app',
    full_payload_ref_audit: FULL_PAYLOAD_REF_AUDIT,
    strategy: {
      normal_stable_path: 'new_release_draft_gates_candidate_record_promote',
      candidate_record_promotion_source: 'only_source_for_stable_promotion',
      refresh_existing: 'emergency_repair_or_replace_existing_release_only',
      post_release_user_guide_screenshots: 'after_promotion_not_pre_promotion_gate',
      same_tag_replacement: 'avoid_for_new_versions',
      resume_uploads: 'skip_existing_assets_when_size_and_sha256_digest_match',
      full_runtime_cache: 'content_addressed_layer_cache',
      vm_policy: 'clone_clean_no_clt_base_for_release_gate',
    },
    lanes,
  };
}

const options = parseArgs(process.argv.slice(2));
const plan = buildPlan(options);
if (!fs.existsSync(path.join(appRoot, 'contracts', 'app-release-channel.json'))) {
  throw new Error('Release channel contract is missing.');
}
console.log(`${JSON.stringify(plan, null, 2)}\n`);
