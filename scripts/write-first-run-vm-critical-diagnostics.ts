#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

type JsonRecord = Record<string, unknown>;

type FailureType =
  | 'none'
  | 'artifact_download_failed'
  | 'release_asset_missing'
  | 'vm_launch_failed'
  | 'opl_configure_codex_failed'
  | 'settings_smoke_failed'
  | 'assistant_route_smoke_failed'
  | 'app_ready_failed'
  | 'vm_smoke_failed'
  | 'vm_harness_preflight_failed';

const outputDir = 'artifacts/opl-first-run-vm-critical-diagnostics';
const vmArtifactDir = 'artifacts/opl-first-run-vm';

function env(name: string): string {
  return process.env[name] || '';
}

function readJson(relativePath: string): JsonRecord | null {
  try {
    const absolutePath = path.resolve(relativePath);
    if (!fs.existsSync(absolutePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as JsonRecord
      : null;
  } catch {
    return null;
  }
}

function stringField(record: JsonRecord | null | undefined, key: string): string {
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
}

function recordField(record: JsonRecord | null | undefined, key: string): JsonRecord | null {
  const value = record?.[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function failed(value: string): boolean {
  return !['', 'success', 'skipped'].includes(value);
}

function includesAny(value: string, needles: string[]): boolean {
  const normalized = value.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function classifyFailure(): {
  type: FailureType;
  boundary: string;
  reason: string;
  tartSummary: JsonRecord | null;
  guestSummary: JsonRecord | null;
} {
  const smokeConclusion = env('VM_SMOKE_CONCLUSION') || 'unknown';
  const dmgConclusion = env('DMG_CONCLUSION') || 'unknown';
  const artifactDownloadOutcome = env('RELEASE_ARTIFACT_DOWNLOAD_OUTCOME') || 'skipped';
  const releaseArtifactRequested = Boolean(env('RELEASE_ARTIFACT_NAME'));
  const installMode = env('INSTALL_MODE') || 'dmg';
  const tartSummary = readJson(`${vmArtifactDir}/tart-smoke-summary.json`);
  const guestSummary =
    recordField(tartSummary, 'guest_summary') ||
    readJson(`${vmArtifactDir}/artifacts/smoke-summary.json`);
  const failureStage = stringField(tartSummary, 'failure_stage') || stringField(tartSummary, 'stage');
  const errorText = [
    stringField(tartSummary, 'error'),
    stringField(recordField(tartSummary, 'error_classification'), 'message'),
    stringField(guestSummary, 'error'),
    stringField(recordField(guestSummary, 'bootstrap_launch_diagnostics'), 'error'),
  ].join('\n');

  if (smokeConclusion === 'success') {
    return { type: 'none', boundary: 'passed', reason: 'VM smoke passed.', tartSummary, guestSummary };
  }
  if (releaseArtifactRequested && failed(artifactDownloadOutcome) && failed(dmgConclusion)) {
    return {
      type: 'artifact_download_failed',
      boundary: 'workflow_artifact_download',
      reason: `release_artifact_name was requested, download-artifact concluded ${artifactDownloadOutcome}, and DMG resolution did not recover.`,
      tartSummary,
      guestSummary,
    };
  }
  if (installMode !== 'homebrew-cask' && failed(dmgConclusion)) {
    return {
      type: 'release_asset_missing',
      boundary: 'resolve_release_dmg',
      reason: 'Resolve release DMG failed before the VM smoke could use an installer.',
      tartSummary,
      guestSummary,
    };
  }
  if (smokeConclusion === 'skipped') {
    return {
      type: 'vm_harness_preflight_failed',
      boundary: 'vm_harness_preflight',
      reason: 'VM smoke was skipped after an earlier harness step failed.',
      tartSummary,
      guestSummary,
    };
  }
  if (!tartSummary) {
    return {
      type: 'vm_launch_failed',
      boundary: 'tart_harness',
      reason: 'VM smoke failed before tart-smoke-summary.json was written.',
      tartSummary,
      guestSummary,
    };
  }
  if (['clone_vm', 'configure_display', 'start_vm', 'wait_for_ip', 'wait_for_ssh'].includes(failureStage)) {
    return {
      type: 'vm_launch_failed',
      boundary: failureStage,
      reason: `Tart VM failed during ${failureStage}.`,
      tartSummary,
      guestSummary,
    };
  }
  if (
    failureStage === 'run_guest_smoke' &&
    includesAny(errorText, ['opl system configure-codex', "'system' 'configure-codex'"])
  ) {
    return {
      type: 'opl_configure_codex_failed',
      boundary: 'guest_opl_configuration',
      reason: 'Guest OPL configure-codex failed before App readiness checks. Inspect the codex-configure diagnostics in the VM artifact.',
      tartSummary,
      guestSummary,
    };
  }
  if (
    failureStage === 'run_guest_smoke' &&
    includesAny(errorText, [
      'could not select opl built-in assistant',
      'selected opl built-in assistant',
      'could not create opl built-in assistant route receipt',
      'created conversation did not expose the opl assistant route receipt',
    ])
  ) {
    return {
      type: 'assistant_route_smoke_failed',
      boundary: 'guest_assistant_route_smoke',
      reason: 'Guest App launched, but a Home assistant shortcut route contract did not pass.',
      tartSummary,
      guestSummary,
    };
  }
  if (
    failureStage === 'run_guest_smoke' &&
    includesAny(errorText, [
      'advanced settings',
      'settings smoke',
      'settings did not expose',
      'settings page did not',
    ])
  ) {
    return {
      type: 'settings_smoke_failed',
      boundary: 'guest_settings_smoke',
      reason: 'Guest App launched, but a Settings page contract did not pass.',
      tartSummary,
      guestSummary,
    };
  }
  if (
    failureStage === 'run_guest_smoke' &&
    includesAny(errorText, ['ready', 'launch', 'bootstrap', 'guid page', 'runtime status page'])
  ) {
    return {
      type: 'app_ready_failed',
      boundary: 'guest_app_ready',
      reason: 'Guest smoke reached the App but readiness/bootstrap evidence did not pass.',
      tartSummary,
      guestSummary,
    };
  }
  return {
    type: 'vm_smoke_failed',
    boundary: failureStage || 'vm_smoke',
    reason: failureStage ? `VM smoke failed during ${failureStage}.` : 'VM smoke failed without a narrower stage.',
    tartSummary,
    guestSummary,
  };
}

function retryEntry(failureType: FailureType) {
  const profile = env('PACKAGE_PROFILE') || 'unknown';
  const diagnosticScope = env('DIAGNOSTIC_SCOPE') || 'release_gate';
  const repo = env('GITHUB_REPOSITORY') || 'gaofeng21cn/one-person-lab-app';
  const releaseArtifactName = env('RELEASE_ARTIFACT_NAME');
  const releaseArtifactRunId =
    env('RELEASE_ARTIFACT_EFFECTIVE_RUN_ID') || env('RELEASE_ARTIFACT_RUN_ID') || env('GITHUB_RUN_ID');
  const releaseTag = env('RELEASE_TAG');
  const args = [
    'gh workflow run "OPL GUI First-Run VM"',
    `--repo ${repo}`,
    `-f package_profile=${profile}`,
    `-f diagnostic_scope=${diagnosticScope}`,
  ];
  if (releaseArtifactName) {
    args.push(`-f release_artifact_name=${releaseArtifactName}`);
    args.push(`-f release_artifact_run_id=${releaseArtifactRunId}`);
  } else if (env('RELEASE_DMG_URL_CONFIGURED') === 'true') {
    args.push('-f release_dmg_url=<same-dmg-url>');
  } else if (releaseTag) {
    args.push(`-f release_tag=${releaseTag}`);
  }
  const action = failureType === 'none'
    ? 'none'
    : failureType === 'release_asset_missing'
      ? 'provide_existing_dmg_or_release_artifact_then_rerun_vm'
      : 'rerun_diagnostic_same_artifact';
  return {
    action,
    scope: 'vm_qualification_only_same_cohort',
    workflow: 'OPL GUI First-Run VM',
    command_hint: action === 'none' ? '' : args.join(' '),
    rebuilds_standard_or_full_artifact: false,
    uses_existing_release_artifact: Boolean(releaseArtifactName || env('RELEASE_DMG_URL_CONFIGURED') === 'true' || releaseTag),
  };
}

function main(): void {
  fs.mkdirSync(outputDir, { recursive: true });
  const summaryJsonPath = `${outputDir}/vm-gate-failure-summary.json`;
  const summaryMdPath = `${outputDir}/vm-gate-failure-summary.md`;
  const classification = classifyFailure();
  const retry = retryEntry(classification.type);
  const releaseArtifactRunId =
    env('RELEASE_ARTIFACT_EFFECTIVE_RUN_ID') ||
    env('RELEASE_ARTIFACT_RUN_ID') ||
    env('GITHUB_RUN_ID');
  const expectedNextAction = retry.action;

  const summary = {
    schema_version: 2,
    owner: 'one-person-lab-app',
    purpose: 'first_run_vm_gate_failure_critical_diagnostics',
    generated_at: new Date().toISOString(),
    workflow: {
      name: 'OPL GUI First-Run VM',
      job: 'clean-vm-first-run',
      run_id: env('GITHUB_RUN_ID'),
      run_attempt: env('GITHUB_RUN_ATTEMPT'),
      repository: env('GITHUB_REPOSITORY'),
      ref: env('GITHUB_REF'),
      sha: env('GITHUB_SHA'),
    },
    release_inputs: {
      package_profile: env('PACKAGE_PROFILE'),
      diagnostic_scope: env('DIAGNOSTIC_SCOPE'),
      release_tag: env('RELEASE_TAG'),
      release_dmg_url_configured: env('RELEASE_DMG_URL_CONFIGURED') === 'true',
      release_artifact_name: env('RELEASE_ARTIFACT_NAME'),
      release_artifact_run_id: releaseArtifactRunId,
      release_artifact_run_id_input: env('RELEASE_ARTIFACT_RUN_ID'),
    },
    step_conclusions: {
      tart_source: env('TART_SOURCE_CONCLUSION') || 'unknown',
      package_profile: env('PACKAGE_PROFILE_CONCLUSION') || 'unknown',
      release_artifact_download: env('RELEASE_ARTIFACT_DOWNLOAD_OUTCOME') || 'skipped',
      resolve_release_dmg: env('DMG_CONCLUSION') || 'unknown',
      codex_package_preflight: env('CODEX_PACKAGE_PREFLIGHT_CONCLUSION') || 'skipped',
      vm_smoke: env('VM_SMOKE_CONCLUSION') || 'unknown',
    },
    failure: {
      type: classification.type,
      boundary: classification.boundary,
      reason: classification.reason,
      tart_failure_stage: stringField(classification.tartSummary, 'failure_stage'),
      tart_status: stringField(classification.tartSummary, 'status'),
      guest_status: stringField(classification.guestSummary, 'status'),
    },
    vm_gate: {
      step_name: 'Run clean VM first launch smoke',
      step_id: 'vm_smoke',
      step_conclusion: env('VM_SMOKE_CONCLUSION') || 'unknown',
      expected_next_action: expectedNextAction,
    },
    retry_entry: retry,
    artifact_upload_failure_boundary: {
      critical_diagnostics_artifact_name: `opl-first-run-vm-critical-diagnostics-${env('PACKAGE_PROFILE') || 'unknown'}-${env('GITHUB_RUN_ID') || 'unknown'}`,
      critical_diagnostics_paths: [
        'vm-gate-failure-summary.json',
        'vm-gate-failure-summary.md',
      ],
      critical_diagnostics_if_no_files_found: 'error',
      critical_diagnostics_retention_days: 7,
      large_vm_artifact_name: `opl-first-run-vm-${env('PACKAGE_PROFILE') || 'unknown'}-${env('GITHUB_RUN_ID') || 'unknown'}`,
      large_vm_artifact_path: vmArtifactDir,
      large_vm_artifact_if_no_files_found: 'warn',
      truth_boundary: 'critical diagnostics are not release-ready evidence and do not replace the VM smoke artifact, release readiness summary, candidate record, or owner receipt',
    },
  };

  fs.writeFileSync(summaryJsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(
    summaryMdPath,
    [
      '# First-run VM critical diagnostics',
      '',
      `- Run id: ${summary.workflow.run_id}`,
      `- Package profile: ${summary.release_inputs.package_profile}`,
      `- Diagnostic scope: ${summary.release_inputs.diagnostic_scope}`,
      `- Release tag: ${summary.release_inputs.release_tag}`,
      `- Release artifact name: ${summary.release_inputs.release_artifact_name}`,
      `- Release artifact run id: ${summary.release_inputs.release_artifact_run_id}`,
      `- Smoke step conclusion: ${summary.vm_gate.step_conclusion}`,
      `- Failure type: ${summary.failure.type}`,
      `- Failure boundary: ${summary.failure.boundary}`,
      `- Expected next action: ${summary.vm_gate.expected_next_action}`,
      `- Retry command: ${summary.retry_entry.command_hint || 'none'}`,
      `- Artifact upload failure boundary: critical diagnostics use if-no-files-found=error; large VM artifacts use if-no-files-found=warn.`,
      `- Truth boundary: ${summary.artifact_upload_failure_boundary.truth_boundary}.`,
      '',
    ].join('\n')
  );
}

main();
