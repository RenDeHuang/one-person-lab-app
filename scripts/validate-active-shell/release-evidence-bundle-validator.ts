import { validateAppReleaseL5ReadoutContract } from '../app-release-l5-readout.ts';
import { validateAppReleaseOwnerVerdictContract } from '../app-release-owner-verdict.ts';

const requiredReleaseEvidenceArtifacts = {
  app_state_summary: {
    path: 'app-state-summary.json',
    producer: 'opl app state --profile fast --json',
    kind: 'json',
    source_kind: 'opl_app_state_summary',
  },
  app_state_full: {
    path: 'app-state-full.json',
    producer: 'opl app state --profile full --json',
    kind: 'json',
    source_kind: 'opl_app_state_full',
  },
  drilldown_full: {
    path: 'drilldown-full.json',
    producer: 'opl runtime app-operator-drilldown --detail full --json',
    kind: 'json',
    source_kind: 'opl_app_operator_drilldown_full',
  },
  action_dry_run_result: {
    path: 'action-dry-run-result.json',
    producer: 'opl app action execute --action <action_id> --dry-run --json',
    kind: 'json',
    source_kind: 'opl_app_action_dry_run',
  },
  action_execute_result: {
    path: 'action-execute-result.json',
    producer: 'opl app action execute --action <action_id> --json',
    kind: 'json',
    source_kind: 'opl_app_action_execute',
  },
  runtime_screenshot: {
    path: 'screenshots/runtime.png',
    producer: 'Runtime page minimal work-item status screenshot',
    kind: 'image',
    source_kind: 'app_runtime_page_visual_acceptance_screenshot',
  },
  full_screenshot: {
    path: 'screenshots/full.png',
    producer: 'Full first-install release screenshot',
    kind: 'image',
    source_kind: 'full_first_install_release_screenshot',
  },
  action_screenshot: {
    path: 'screenshots/action.png',
    producer: 'Settings Maintenance action confirmation/result screenshot',
    kind: 'image',
    source_kind: 'app_settings_action_screenshot',
  },
  first_run_vm_summary: {
    path: 'tart-smoke-summary.json',
    producer: 'clean first-run VM smoke',
    kind: 'json',
    source_kind: 'clean_first_run_vm_smoke',
  },
  guest_smoke_summary: {
    path: 'artifacts/smoke-summary.json',
    producer: 'packaged GUI first-run guest smoke',
    kind: 'json',
    source_kind: 'packaged_gui_first_run_smoke',
  },
  codex_functional_check_summary: {
    path: 'artifacts/codex-functional-check-summary.json',
    producer: 'packaged GUI Codex post-install functional check',
    kind: 'json',
    source_kind: 'packaged_gui_codex_functional_check',
  },
  remote_release_verification: {
    path: 'remote-release-verification.json',
    producer: 'npm run verify-remote-release -- --version <version> --include-full-package --summary-path remote-release-verification.json',
    kind: 'json',
    source_kind: 'remote_release_verification',
  },
};

const optionalReleaseEvidenceArtifacts = {
  docker_webui_clean_vm_evidence: {
    path: 'docker-webui-clean-vm-evidence-validation.json',
    producer: 'docker-webui-clean-vm-evidence job aggregate validation',
    kind: 'json',
    source_kind: 'docker_webui_clean_vm_evidence_validation',
    required_when: 'publish_docker_webui',
  },
  codex_ai_self_check_summary: {
    path: 'artifacts/codex-ai-self-check-summary.json',
    producer: 'packaged GUI Codex AI-first post-install self-check',
    kind: 'json',
    source_kind: 'packaged_gui_codex_ai_self_check',
  },
};

const fullFirstInstallEvidenceArtifacts = [
  'tart-smoke-summary.json',
  'artifacts/smoke-summary.json',
  'artifacts/settings-smoke-summary.json',
  'artifacts/codex-functional-check-summary.json',
];

const forbiddenReleaseEvidenceAuthorities = [
  'runtime_truth',
  'provider_implementation',
  'domain_truth',
  'domain_quality_verdict',
  'domain_artifact_authority',
];

export function validateReleaseEvidenceBundle(releaseChannel, pageStateMatrix, firstRunMatrix) {
  const bundle = releaseChannel.operator_evidence_bundle;

  validateReleaseEvidenceBundleShape(bundle);
  validateSurfaceOwnership(bundle);
  validateMissingEvidencePolicy(bundle);
  validateImageEvidencePolicy(bundle);
  validateAppReleaseL5ReadoutContract(bundle.l5_evidence_readout);
  validateAppReleaseOwnerVerdictContract(bundle.release_owner_verdict);
  validateRequiredArtifacts(bundle);
  validateOptionalDiagnosticArtifacts(bundle);
  validateRuntimePageVisualEvidence(pageStateMatrix);
  validateFullFirstInstallEvidenceRefs(firstRunMatrix);
  validateForbiddenReleaseEvidenceAuthority(bundle);
}

function validateReleaseEvidenceBundleShape(bundle) {
  if (bundle?.purpose !== 'app_release_evidence_acceptance') {
    throw new Error('Release channel must declare app_release_evidence_acceptance purpose');
  }
  if (bundle.acceptance_path !== 'App release verification') {
    throw new Error(`Unexpected App release evidence acceptance path: ${bundle.acceptance_path}`);
  }
  if (bundle.release_evidence_contract !== 'contracts/app-release-channel.json#operator_evidence_bundle') {
    throw new Error(`Unexpected App release evidence contract ref: ${bundle.release_evidence_contract}`);
  }
  if (Object.hasOwn(bundle, 'runtime_page_contract')) {
    throw new Error('App release evidence bundle must not use Runtime page as its contract owner');
  }
  if (bundle.refs_only !== true) {
    throw new Error('App release evidence bundle must be refs-only');
  }
  if (bundle.manifest_path !== 'evidence-manifest.json') {
    throw new Error(`Unexpected App release evidence manifest path: ${bundle.manifest_path}`);
  }
}

function validateSurfaceOwnership(bundle) {
  const ownership = bundle.surface_ownership;
  if (ownership?.runtime_visual_evidence !== 'runtime_page_minimal_work_item_status_only') {
    throw new Error('Runtime evidence must be limited to the minimal work-item status screenshot');
  }
  if (ownership?.full_drilldown_and_raw_diagnostics !== 'settings_maintenance_diagnostics_and_release_tooling') {
    throw new Error('Full drilldown and raw diagnostics must belong to Maintenance diagnostics and release tooling');
  }
  if (
    ownership?.maintenance_actions_and_receipts
    !== 'settings_maintenance_and_release_tooling'
  ) {
    throw new Error('Maintenance actions and receipts must belong to Settings Maintenance and release tooling');
  }
  validateArrayIncludes(
    ownership?.runtime_page_excludes,
    ['full_drilldown', 'safe_action_catalog', 'operator_receipts', 'software_update_controls', 'provider_repair_controls'],
    'Runtime page exclusions must cover drilldown, safe actions, receipts, updates, and provider repair',
  );
}

function validateMissingEvidencePolicy(bundle) {
  const policy = bundle.missing_evidence_policy;
  if (policy?.default_validation !== 'fail_closed') {
    throw new Error('Operator evidence bundle missing evidence policy must fail closed by default');
  }
  if (policy?.allow_missing_evidence_flag !== '--allow-missing-evidence') {
    throw new Error('Operator evidence bundle missing evidence policy must declare --allow-missing-evidence');
  }
  if (policy?.missing_status !== 'missing_evidence') {
    throw new Error('Operator evidence bundle missing evidence policy must declare missing_evidence status');
  }
  validateArrayIncludes(
    policy?.allowed_artifact_statuses,
    ['present', 'missing', 'typed_blocker', 'not_applicable'],
    'Operator evidence bundle must declare present, missing, typed_blocker, and not_applicable statuses',
  );
  validateArrayIncludes(
    policy?.typed_blocker_status_requires,
    ['reason', 'typed_blocker_ref'],
    'Operator evidence bundle typed_blocker status must require reason and typed_blocker_ref',
  );
  if (policy?.typed_blocker_path_pattern !== 'typed-blockers/<artifact_id>.json') {
    throw new Error('Operator evidence bundle typed_blocker path pattern must be typed-blockers/<artifact_id>.json');
  }
  validateArrayIncludes(
    policy?.not_applicable_status_requires,
    ['reason', 'not_applicable_reason'],
    'Operator evidence bundle not_applicable status must require reason and not_applicable_reason',
  );
  if (policy?.packaged_app_evidence_requires !== 'all_required_artifacts_present_and_verified') {
    throw new Error('Operator evidence bundle must require all artifacts before claiming packaged App evidence');
  }
}

function validateImageEvidencePolicy(bundle) {
  const policy = bundle.image_evidence_policy;
  if (
    policy?.applies_to_kind !== 'image' ||
    policy?.minimum_width_px !== 640 ||
    policy?.minimum_height_px !== 360 ||
    policy?.minimum_file_size_bytes !== 4096 ||
    policy?.placeholder_screenshot_allowed !== false
  ) {
    throw new Error('Operator evidence bundle image policy must reject placeholder screenshots');
  }
}

function validateRequiredArtifacts(bundle) {
  const artifactById = new Map((bundle.required_artifacts ?? []).map((artifact) => [artifact.id, artifact]));
  for (const [id, expected] of Object.entries(requiredReleaseEvidenceArtifacts)) {
    const artifact = artifactById.get(id);
    if (!artifact) {
      throw new Error(`Operator evidence bundle missing artifact ${id}`);
    }
    validateArtifactFields(artifact, expected, `Operator evidence bundle artifact ${id}`);
  }
}

function validateOptionalDiagnosticArtifacts(bundle) {
  const conditionalArtifactById = new Map((bundle.conditional_artifacts ?? []).map((artifact) => [artifact.id, artifact]));
  const dockerCleanVmEvidence = conditionalArtifactById.get('docker_webui_clean_vm_evidence');
  if (!dockerCleanVmEvidence) {
    throw new Error('Operator evidence bundle missing conditional artifact docker_webui_clean_vm_evidence');
  }
  validateArtifactFields(
    dockerCleanVmEvidence,
    optionalReleaseEvidenceArtifacts.docker_webui_clean_vm_evidence,
    'Operator evidence bundle conditional docker_webui_clean_vm_evidence',
  );

  const optionalArtifactById = new Map((bundle.optional_diagnostic_artifacts ?? []).map((artifact) => [artifact.id, artifact]));
  const codexAiSelfCheck = optionalArtifactById.get('codex_ai_self_check_summary');
  if (!codexAiSelfCheck) {
    throw new Error('Operator evidence bundle missing optional diagnostic artifact codex_ai_self_check_summary');
  }
  validateArtifactFields(
    codexAiSelfCheck,
    optionalReleaseEvidenceArtifacts.codex_ai_self_check_summary,
    'Operator evidence bundle optional diagnostic codex_ai_self_check_summary',
  );
}

function validateRuntimePageVisualEvidence(pageStateMatrix) {
  const runtimePage = (pageStateMatrix.pages ?? []).find((page) => page.id === 'runtime');
  const acceptancePath = runtimePage?.runtime_acceptance_path;

  for (const legacyField of ['operator_evidence_acceptance_path', 'operator_evidence_path']) {
    if (runtimePage && Object.hasOwn(runtimePage, legacyField)) {
      throw new Error(`Runtime page must not retain legacy ${legacyField}`);
    }
  }

  if (acceptancePath?.summary_state_command !== requiredReleaseEvidenceArtifacts.app_state_summary.producer) {
    throw new Error('Runtime page visual acceptance must use the fast App state summary');
  }
  if (acceptancePath?.refresh_state_command !== requiredReleaseEvidenceArtifacts.app_state_summary.producer) {
    throw new Error('Runtime page visual acceptance refresh must use the fast App state summary');
  }
  if (acceptancePath?.full_drilldown_command !== null) {
    throw new Error('Runtime page visual acceptance must not expose full drilldown');
  }
  if (acceptancePath && Object.hasOwn(acceptancePath, 'action_dry_run_command')) {
    throw new Error('Runtime page visual acceptance must not expose the platform action catalog');
  }
  if (
    acceptancePath?.action_execute_command
    !== 'opl app action execute --action work_item_visibility_set --payload <json> --json'
  ) {
    throw new Error('Runtime page must expose only selected work-item archive/restore execution');
  }
  validateArrayIncludes(
    runtimePage?.runtime_acceptance_evidence,
    [
      'task title, lifecycle status, execution state, current Stage, next Stage, next action, owner, elapsed time, and Token usage',
      'Stage popover with complete Stage order and current Attempt',
      'operator summaries, safe actions, software updates, platform repair, module health, and provider diagnostics excluded from Runtime and routed to Settings',
    ],
    'Runtime visual acceptance must cover task status, Stage/Attempt, Token usage, and Settings exclusions',
  );
}

function validateFullFirstInstallEvidenceRefs(firstRunMatrix) {
  const fullFirstInstall = (firstRunMatrix.scenarios ?? []).find((scenario) => scenario.id === 'full_first_install_clean_machine');
  for (const artifactPath of fullFirstInstallEvidenceArtifacts) {
    if (!fullFirstInstall?.release_evidence_artifacts?.includes(artifactPath)) {
      throw new Error(`Full first-install first-run scenario must list release evidence artifact ${artifactPath}`);
    }
  }
}

function validateForbiddenReleaseEvidenceAuthority(bundle) {
  for (const forbidden of forbiddenReleaseEvidenceAuthorities) {
    if (!bundle.forbidden_authority?.includes(forbidden)) {
      throw new Error(`App release evidence bundle must exclude ${forbidden}`);
    }
  }
}

function validateArrayIncludes(actual, expected, message) {
  if (!Array.isArray(actual) || !expected.every((entry) => actual.includes(entry))) {
    throw new Error(message);
  }
}

function validateArtifactFields(artifact, expected, label) {
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (artifact[field] !== expectedValue) {
      throw new Error(`${label}.${field} must be ${expectedValue}`);
    }
  }
}
