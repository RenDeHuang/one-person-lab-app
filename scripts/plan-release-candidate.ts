#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import {
  assertReleaseVersionNotFuture,
  resolveReleaseVersionIdentity,
} from './release-version.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseContract = JSON.parse(
  fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
);

type Lane = {
  id: string;
  phase: 'fast_candidate' | 'parallel_build' | 'remote_gate' | 'installation_gate' | 'release_gate' | 'publish' | 'post_release';
  depends_on: string[];
  can_run_with: string[];
  command: string;
  required_for: string[];
};

type AddonGraph = {
  requested: boolean;
  starts_after: 'standard_stable_terminal';
  terminal: 'addon_train_terminal';
  blocking_standard_terminal: false;
  lanes: Lane[];
};

const FULL_PAYLOAD_REF_AUDIT = {
  schema: 'opl_full_payload_ref_audit_plan.v1',
  record_path: 'dist/opl-full-release/full-package-manifest.json#resolved_refs',
  telemetry_path: 'dist/opl-full-release/full-workflow-telemetry.json#payload_refs',
  summary_section: 'Full Payload Resolved Refs',
  resolution: 'actual_full_workflow_checkout_commit',
  release_bound_authority: 'frozen_framework_catalog_and_full_input_manifests',
  modes: {
    stable: {
      records_resolved_refs: true,
      pin_input_required: true,
      default_refs_can_follow_main: false,
    },
    draft_candidate: {
      records_resolved_refs: true,
      pin_input_required: true,
      default_refs_can_follow_main: false,
    },
  },
  payloads: {
    opl_framework: {
      label: 'OPL Framework',
      repository: 'gaofeng21cn/one-person-lab',
      workflow_input: 'framework_ref',
      ref_authority: 'release_cohort.framework_sha',
    },
    mas: {
      label: 'MAS',
      repository: 'gaofeng21cn/med-autoscience',
      ref_authority: 'frozen_framework_catalog.owner_source_commit',
    },
    mag: {
      label: 'MAG',
      repository: 'gaofeng21cn/med-autogrant',
      ref_authority: 'frozen_framework_catalog.owner_source_commit',
    },
    rca: {
      label: 'RCA',
      repository: 'gaofeng21cn/redcube-ai',
      ref_authority: 'frozen_framework_catalog.owner_source_commit',
    },
    opl_meta_agent: {
      label: 'OPL Meta Agent',
      repository: 'gaofeng21cn/opl-meta-agent',
      ref_authority: 'frozen_framework_catalog.owner_source_commit',
    },
    officecli: {
      label: 'OfficeCLI',
      repository: 'iOfficeAI/OfficeCLI',
      ref_authority: 'app_full_third_party_source_manifest.commit',
    },
    mineru: {
      label: 'MinerU',
      repository: 'opendatalab/MinerU-Ecosystem',
      ref_authority: 'app_full_third_party_source_manifest.commit',
    },
    ui_ux_skill: {
      label: 'UI UX skill',
      repository: 'nextlevelbuilder/ui-ux-pro-max-skill',
      ref_authority: 'app_full_third_party_source_manifest.commit',
    },
  },
} as const;

function parseArgs(argv: string[]) {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      'include-full-package': { type: 'boolean' },
      profile: { type: 'string' },
      'no-settings-vm': { type: 'boolean' },
      version: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  const parsed = {
    version: process.env.OPL_RELEASE_VERSION || '',
    profile: 'stable',
    includeFullPackage: false,
    settingsVm: true,
  };
  if (values['include-full-package'] === true) parsed.includeFullPackage = true;
  if (values.profile !== undefined) {
    if (values.profile !== 'stable' && values.profile !== 'nightly' && values.profile !== 'local-install') {
      throw new Error(`Unsupported release profile: ${values.profile}`);
    }
    parsed.profile = values.profile;
  }
  if (values['no-settings-vm'] === true) parsed.settingsVm = false;
  if (values.version !== undefined) parsed.version = values.version;
  if (!parsed.version.trim()) {
    throw new Error('Missing release version. Pass --version <version> or set OPL_RELEASE_VERSION.');
  }
  if (parsed.profile === 'local-install' && parsed.includeFullPackage) {
    throw new Error('The local-install profile does not accept --include-full-package.');
  }
  if (parsed.profile === 'local-install' && !parsed.settingsVm) {
    throw new Error('The local-install profile does not accept --no-settings-vm because VM gates are not part of this profile.');
  }
  return parsed;
}

function buildPlan(options: ReturnType<typeof parseArgs>) {
  assertReleaseVersionNotFuture(options.profile === 'nightly' ? 'nightly' : 'stable', options.version);
  if (options.profile === 'local-install') {
    const profile = releaseContract.release_profiles?.local_install;
    if (!profile || !Array.isArray(profile.required_lanes) || !Array.isArray(profile.forbidden_lanes)) {
      throw new Error('Release channel contract is missing release_profiles.local_install.');
    }
    const versionIdentity = resolveReleaseVersionIdentity('stable', options.version);
    const lanes: Lane[] = [
      {
        id: 'release_source_gate',
        phase: 'fast_candidate',
        depends_on: [],
        can_run_with: [],
        command: `npm run release:source-gate -- --version ${options.version} --app-ref "$APP_SHA" --shell-ref "$SHELL_REF" --framework-ref "$FRAMEWORK_REF" --framework-root "$FRAMEWORK_ROOT" --require-shell-format true --run-shell-tests true --output local-install-source-gate.json --json`,
        required_for: ['local_installed_app'],
      },
      {
        id: 'release_boundary',
        phase: 'fast_candidate',
        depends_on: ['release_source_gate'],
        can_run_with: ['standard_build'],
        command: 'npm run test:release-boundary',
        required_for: ['local_installed_app'],
      },
      {
        id: 'standard_build',
        phase: 'parallel_build',
        depends_on: ['release_source_gate'],
        can_run_with: ['release_boundary'],
        command: `env OPL_RELEASE_VERSION=${versionIdentity.displayVersion} OPL_UPDATER_VERSION=${versionIdentity.updaterVersion} ${profile.build_command}`,
        required_for: ['local_installed_app'],
      },
      {
        id: 'local_install_handoff',
        phase: 'installation_gate',
        depends_on: ['release_boundary', 'standard_build'],
        can_run_with: [],
        command: profile.install_handoff,
        required_for: ['local_installed_app'],
      },
      {
        id: 'installed_app_readback',
        phase: 'installation_gate',
        depends_on: ['local_install_handoff'],
        can_run_with: [],
        command: `verify ${profile.installed_app_path} bundle version, codesign diagnostic, build/installed app.asar SHA-256 equality, relaunch, and startup/runtime bridge logs`,
        required_for: ['local_installed_app'],
      },
    ];
    const laneIds = lanes.map((lane) => lane.id);
    if (JSON.stringify(laneIds) !== JSON.stringify(profile.required_lanes)) {
      throw new Error('Local-install plan lanes drift from the release channel contract.');
    }
    if (profile.forbidden_lanes.some((laneId: string) => laneIds.includes(laneId))) {
      throw new Error('Local-install plan contains a public-distribution lane.');
    }
    return {
      schema_version: 1,
      version: options.version,
      profile: profile.plan_profile,
      release_repo: 'gaofeng21cn/one-person-lab-app',
      strategy: {
        distribution_scope: profile.distribution_scope,
        exact_cohort_required: true,
        build_app_path: profile.build_app_path,
        installed_app_path: profile.installed_app_path,
        second_qa_authorization_required: profile.second_qa_authorization_required,
        public_distribution_requirements: 'not_applicable',
      },
      lanes,
      authority_boundary: profile.authority_boundary,
    };
  }
  if (options.profile === 'nightly') {
    return {
      schema_version: 1,
      version: options.version,
      profile: 'nightly_standard',
      release_repo: 'gaofeng21cn/one-person-lab-app',
      status: 'blocked',
      blocker: {
        code: 'retired_pending_brokered_replacement',
        retry_disposition: 'terminal_blocked',
        reason: 'The direct Nightly writer is retired. A separately brokered, immutable-input Nightly workflow must be provisioned before Nightly publication can resume.',
      },
      strategy: {
        mutation_authority: 'external_release_mutation_broker',
        direct_github_write: 'forbidden',
        recovery: 'new_brokered_attempt_or_read_only_reconcile',
      },
      lanes: [
        {
          id: 'nightly_release_blocked',
          phase: 'release_gate',
          depends_on: [],
          can_run_with: [],
          command: 'No release mutation command is available while the brokered Nightly replacement is unprovisioned.',
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
      required_for: ['standard_release'],
    },
    {
      id: 'release_boundary',
      phase: 'fast_candidate',
      depends_on: ['release_preflight'],
      can_run_with: ['standard_build', 'active_shell_quick_validation'],
      command: 'npm run test:release-boundary',
      required_for: ['standard_release'],
    },
    {
      id: 'standard_build',
      phase: 'parallel_build',
      depends_on: ['release_preflight'],
      can_run_with: [],
      command: `npm run build-mac:arm64 && npm run release:publish -- --dry-run --version ${options.version}`,
      required_for: ['standard_release'],
    },
    {
      id: 'active_shell_quick_validation',
      phase: 'fast_candidate',
      depends_on: ['release_preflight'],
      can_run_with: ['release_boundary'],
      command: 'npm run validate:active-shell -- --quick',
      required_for: ['standard_release'],
    },
  ];

  lanes.push({
    id: 'publish_standard',
    phase: 'publish',
    depends_on: ['standard_build', 'release_boundary', 'active_shell_quick_validation'],
    can_run_with: [],
    command: `.github/workflows/desktop-release.yml release_mode=new_release publishes standard assets to draft v${options.version}`,
    required_for: ['standard_release'],
  });

  if (options.settingsVm) {
    lanes.push({
      id: 'standard_dmg_clean_vm_smoke',
      phase: 'installation_gate',
      depends_on: ['publish_standard'],
      can_run_with: ['one_shot_app_installer_smoke'],
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
  }

  lanes.push({
    id: 'remote_verify_standard',
    phase: 'remote_gate',
    depends_on: ['publish_standard'],
    can_run_with: ['standard_dmg_clean_vm_smoke', 'one_shot_app_installer_smoke'],
    command: `npm run verify-remote-release -- --version ${options.version}`,
    required_for: ['standard_release'],
  });

  lanes.push({
    id: 'one_shot_app_installer_smoke',
    phase: 'installation_gate',
    depends_on: ['publish_standard', ...(options.settingsVm ? ['standard_dmg_clean_vm_smoke'] : [])],
    can_run_with: ['standard_dmg_clean_vm_smoke', 'remote_verify_standard'],
    command: 'OPL_INSTALL_SCRIPT_URL=file://<framework-checkout>/install.sh ./install.sh --with-app --skip-packages',
    required_for: ['stable_release'],
  });

  lanes.push({
    id: 'release_evidence_bundle',
    phase: 'release_gate',
    depends_on: [
      'remote_verify_standard',
      ...(options.settingsVm ? ['standard_dmg_clean_vm_smoke'] : []),
      'one_shot_app_installer_smoke',
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
      'remote_verify_standard',
      ...(options.settingsVm ? ['standard_dmg_clean_vm_smoke'] : []),
      'one_shot_app_installer_smoke',
      'release_evidence_bundle',
    ],
    can_run_with: [],
    command: '.github/workflows/desktop-release.yml release-readiness-summary writes release-readiness-summary.json, release-candidate-record.json, and default release-closeout.json from small diagnostic artifacts; fails closed on any required gate',
    required_for: ['stable_release'],
  });

  lanes.push({
    id: 'release_candidate_record',
    phase: 'release_gate',
    depends_on: ['release_preflight', 'release_readiness_summary', 'remote_verify_standard'],
    can_run_with: [],
    command: 'npm run release:candidate-record -- --version <version> --preflight release-preflight-summary.json --readiness release-readiness-summary.json --remote-verification remote-release-verification.json --release-owner-receipt-ref <release_owner_receipt_ref>',
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
      'publishes nonlatest then completes the receipt-backed promotion saga',
    ].join(' '),
    required_for: ['standard_release'],
  });

  lanes.push({
    id: 'stable_homebrew_tap_update',
    phase: 'publish',
    depends_on: ['promote_stable_release'],
    can_run_with: [],
      command: [
        '.github/workflows/desktop-release-promote.yml',
        'validates the stable-distribution receipt already created by the isolated mutation broker',
        'passes the exact Release Set generation and Framework carrier digest',
        'never dispatches or writes the tap from the App workflow',
    ].join(' '),
    required_for: ['stable_release'],
  });

  if (options.settingsVm) {
    lanes.push({
      id: 'homebrew_standard_cask_clean_vm_smoke',
      phase: 'installation_gate',
      depends_on: [
        'stable_homebrew_tap_update',
      ],
      can_run_with: [],
      command: [
        'npm run test:opl-first-run-vm:tart --',
        '--source-vm opl-first-run-homebrew-ready-base',
        '--install-mode homebrew-cask',
        '--homebrew-cask gaofeng21cn/one-person-lab/one-person-lab',
        '--smoke-profile homebrew-standard-cask',
        '--display 1920x1080px',
        '--settings-smoke',
        '--assistant-route-smoke',
        '--runtime-profile standard',
      ].join(' '),
      required_for: ['stable_release'],
    });
  }

  lanes.push({
    id: 'release_promotion_record',
    phase: 'release_gate',
    depends_on: [
      'promote_stable_release',
      'stable_homebrew_tap_update',
      ...(options.settingsVm ? ['homebrew_standard_cask_clean_vm_smoke'] : []),
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

  const fullAddonLanes: Lane[] = options.includeFullPackage ? [
    {
      id: 'full_addon_preflight',
      phase: 'fast_candidate',
      depends_on: [],
      can_run_with: [],
      command: 'npm run validate:release-boundary -- --scope full-addon && npm run release:full:prune-audit -- --markdown',
      required_for: ['full_first_install'],
    },
    {
      id: 'full_runtime_keys',
      phase: 'fast_candidate',
      depends_on: ['full_addon_preflight'],
      can_run_with: [],
      command: `npm run release:full -- --version ${options.version} --print-runtime-cache-keys`,
      required_for: ['full_first_install'],
    },
    {
      id: 'full_build',
      phase: 'parallel_build',
      depends_on: ['full_runtime_keys'],
      can_run_with: [],
      command: `OPL_FULL_RUNTIME_CACHE_MODE=readwrite npm run release:full -- --version ${options.version}`,
      required_for: ['full_first_install'],
    },
    ...(options.settingsVm ? [{
      id: 'full_dmg_clean_vm_smoke',
      phase: 'installation_gate' as const,
      depends_on: ['full_build'],
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
    }] : []),
    {
      id: 'publish_full_assets',
      phase: 'publish',
      depends_on: [options.settingsVm ? 'full_dmg_clean_vm_smoke' : 'full_build'],
      can_run_with: [],
      command: 'npm run release:stable -- dispatch-full-addon --state <release-session.json>',
      required_for: ['full_first_install'],
    },
    {
      id: 'remote_verify_full_addon',
      phase: 'remote_gate',
      depends_on: ['publish_full_assets'],
      can_run_with: [],
      command: `npm run verify-remote-release -- --version ${options.version} --include-full-package`,
      required_for: ['full_first_install'],
    },
    {
      id: 'full_addon_receipt',
      phase: 'release_gate',
      depends_on: ['remote_verify_full_addon'],
      can_run_with: [],
      command: 'validate opl_app_full_addon_receipt.v1 for the exact Standard cohort and Full artifact digest',
      required_for: ['full_first_install'],
    },
  ] : [];

  const webuiAddonLanes: Lane[] = [
    {
      id: 'webui_addon_preflight',
      phase: 'fast_candidate',
      depends_on: [],
      can_run_with: [],
      command: 'npm run validate:release-boundary -- --scope webui-addon',
      required_for: ['webui_addon'],
    },
    {
      id: 'docker_webui_smoke',
      phase: 'installation_gate',
      depends_on: ['webui_addon_preflight'],
      can_run_with: [],
      command: `docker build -t one-person-lab-webui:${options.version} shells/aionui && docker run --rm one-person-lab-webui:${options.version}`,
      required_for: ['webui_addon'],
    },
    {
      id: 'webui_ghcr_publish',
      phase: 'publish',
      depends_on: ['docker_webui_smoke'],
      can_run_with: [],
      command: 'publish exact WebUI image digest through the independent brokered WebUI lane',
      required_for: ['webui_addon'],
    },
    {
      id: 'webui_addon_receipt',
      phase: 'release_gate',
      depends_on: ['webui_ghcr_publish'],
      can_run_with: [],
      command: 'validate the same-cohort WebUI add-on receipt',
      required_for: ['webui_addon'],
    },
  ];

  const addonGraphs: Record<'full' | 'webui', AddonGraph> = {
    full: {
      requested: options.includeFullPackage,
      starts_after: 'standard_stable_terminal',
      terminal: 'addon_train_terminal',
      blocking_standard_terminal: false,
      lanes: fullAddonLanes,
    },
    webui: {
      requested: false,
      starts_after: 'standard_stable_terminal',
      terminal: 'addon_train_terminal',
      blocking_standard_terminal: false,
      lanes: webuiAddonLanes,
    },
  };

  return {
    schema_version: 1,
    version: options.version,
    profile: 'stable',
    release_repo: 'gaofeng21cn/one-person-lab-app',
    full_payload_ref_audit: FULL_PAYLOAD_REF_AUDIT,
    strategy: {
      normal_stable_path: 'new_release_draft_gates_candidate_record_promote',
      candidate_record_promotion_source: 'only_source_for_stable_promotion',
      refresh_existing: 'unpublished_draft_repair_only',
      post_release_user_guide_screenshots: 'after_promotion_not_pre_promotion_gate',
      same_tag_replacement: 'published_release_forbidden',
      resume_uploads: 'skip_existing_assets_when_size_and_sha256_digest_match',
      full_runtime_cache: 'content_addressed_layer_cache',
      vm_policy: 'clone_clean_no_clt_base_for_release_gate',
      standard_terminal: 'independent_from_full_and_webui_addons',
    },
    lanes,
    addon_graphs: addonGraphs,
  };
}

const options = parseArgs(process.argv.slice(2));
const plan = buildPlan(options);
if (!fs.existsSync(path.join(appRoot, 'contracts', 'app-release-channel.json'))) {
  throw new Error('Release channel contract is missing.');
}
console.log(`${JSON.stringify(plan, null, 2)}\n`);
