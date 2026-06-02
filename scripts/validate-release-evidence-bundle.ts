#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseContractPath = path.join(appRoot, 'contracts', 'app-release-channel.json');
const evidenceBoundary = 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority';

type Options = {
  bundleDir: string;
  allowMissingEvidence: boolean;
};

type EvidenceArtifact = {
  id: string;
  path: string;
  kind: 'json' | 'image' | 'log';
  producer: string;
  source_kind: string;
};

type EvidenceContract = {
  manifestPath: string;
  artifacts: EvidenceArtifact[];
  optionalDiagnostics: EvidenceArtifact[];
  imageEvidencePolicy: ImageEvidencePolicy;
  typedBlockerPolicy: TypedBlockerPolicy;
};

type ManifestArtifact = EvidenceArtifact & {
  status: 'present' | 'missing' | 'typed_blocker' | 'not_applicable';
  reason?: string;
  missing_reason?: string;
  typed_blocker_ref?: string;
  not_applicable_reason?: string;
};

function parseArgs(argv: string[]): Options {
  const parsed = {
    bundleDir: process.env.OPL_RELEASE_EVIDENCE_BUNDLE_DIR || '',
    allowMissingEvidence: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--allow-missing-evidence') {
      parsed.allowMissingEvidence = true;
      continue;
    }
    const value = argv[index + 1];
    if (token === '--bundle-dir') {
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --bundle-dir');
      }
      parsed.bundleDir = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!parsed.bundleDir.trim()) {
    throw new Error('Pass --bundle-dir <release-evidence-dir> or set OPL_RELEASE_EVIDENCE_BUNDLE_DIR.');
  }
  return {
    bundleDir: path.resolve(parsed.bundleDir),
    allowMissingEvidence: parsed.allowMissingEvidence,
  };
}

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertFile(filePath: string, label: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`${label} must be a file: ${filePath}`);
  }
}

function assertJsonFile(filePath: string, label: string) {
  assertFile(filePath, label);
  try {
    return readJson(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} must be valid JSON: ${message}`);
  }
}

function isJpegSofMarker(marker: number) {
  return (
    (marker >= 0xc0 && marker <= 0xc3)
    || (marker >= 0xc5 && marker <= 0xc7)
    || (marker >= 0xc9 && marker <= 0xcb)
    || (marker >= 0xcd && marker <= 0xcf)
  );
}

function readUInt24LE(bytes: Buffer, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function webpDimensions(bytes: Buffer) {
  if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
    return null;
  }
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunkType = bytes.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    const nextOffset = dataOffset + chunkSize + (chunkSize % 2);
    if (dataOffset + chunkSize > bytes.length) {
      return null;
    }
    if (chunkType === 'VP8X' && chunkSize >= 10) {
      return {
        width: readUInt24LE(bytes, dataOffset + 4) + 1,
        height: readUInt24LE(bytes, dataOffset + 7) + 1,
      };
    }
    if (chunkType === 'VP8L' && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      return {
        width: 1 + bytes[dataOffset + 1] + ((bytes[dataOffset + 2] & 0x3f) << 8),
        height: 1 + ((bytes[dataOffset + 2] & 0xc0) >> 6) + (bytes[dataOffset + 3] << 2) + ((bytes[dataOffset + 4] & 0x0f) << 10),
      };
    }
    if (
      chunkType === 'VP8 '
      && chunkSize >= 10
      && bytes[dataOffset + 3] === 0x9d
      && bytes[dataOffset + 4] === 0x01
      && bytes[dataOffset + 5] === 0x2a
    ) {
      return {
        width: bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }
    offset = nextOffset;
  }
  return null;
}

function imageDimensions(filePath: string, header: Buffer) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') {
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    const bytes = fs.readFileSync(filePath);
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (isJpegSofMarker(marker)) {
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  if (extension === '.webp') {
    return webpDimensions(fs.readFileSync(filePath));
  }
  return null;
}

function assertImageFile(filePath: string, label: string, policy: ImageEvidencePolicy) {
  assertFile(filePath, label);
  const stat = fs.statSync(filePath);
  if (stat.size < policy.minimum_file_size_bytes) {
    throw new Error(`${label} must be a real screenshot, not a placeholder image: ${filePath}`);
  }
  if (!/\.(png|jpg|jpeg|webp)$/i.test(filePath)) {
    throw new Error(`${label} must be a screenshot image file: ${filePath}`);
  }
  const header = fs.readFileSync(filePath).subarray(0, 24);
  const extension = path.extname(filePath).toLowerCase();
  const isPng = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isWebp = header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
  if ((extension === '.png' && !isPng) || (['.jpg', '.jpeg'].includes(extension) && !isJpeg) || (extension === '.webp' && !isWebp)) {
    throw new Error(`${label} must contain real screenshot image bytes: ${filePath}`);
  }
  const dimensions = imageDimensions(filePath, header);
  if (!dimensions) {
    throw new Error(`${label} dimensions must be readable screenshot evidence: ${filePath}`);
  }
  if (dimensions && (dimensions.width < policy.minimum_width_px || dimensions.height < policy.minimum_height_px)) {
    throw new Error(`${label} must be at least ${policy.minimum_width_px}x${policy.minimum_height_px}px screenshot evidence: ${filePath}`);
  }
}

function assertLogFile(filePath: string, label: string) {
  assertFile(filePath, label);
  if (!fs.readFileSync(filePath, 'utf8').trim()) {
    throw new Error(`${label} must not be empty: ${filePath}`);
  }
}

function resolveBundlePath(bundleDir: string, artifactPath: string) {
  if (path.isAbsolute(artifactPath)) {
    throw new Error(`Evidence artifact path must be relative: ${artifactPath}`);
  }
  const resolved = path.resolve(bundleDir, artifactPath);
  const relative = path.relative(bundleDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Evidence artifact path escapes bundle root: ${artifactPath}`);
  }
  return resolved;
}

function validateVmSummary(artifact: EvidenceArtifact, payload: unknown) {
  const record = asRecord(payload, artifact.id);
  if (record.status !== 'passed') {
    throw new Error(`${artifact.id} must be a passed VM smoke JSON artifact.`);
  }
  if (record.runtime_profile !== 'standard' && record.runtime_profile !== 'full') {
    throw new Error(`${artifact.id} must report runtime_profile standard or full.`);
  }
  const settingsSmoke = asRecord(record.settings_smoke, `${artifact.id}.settings_smoke`);
  if (settingsSmoke.status !== 'passed') {
    throw new Error(`${artifact.id} must include passed Settings smoke evidence.`);
  }
  if (!Array.isArray(settingsSmoke.pages) || settingsSmoke.pages.length === 0) {
    throw new Error(`${artifact.id} must report visited Settings pages.`);
  }
  if (artifact.id === 'guest_smoke_summary') {
    const guiReady = asRecord(record.gui_ready, `${artifact.id}.gui_ready`);
    if (guiReady.hasGuidInput !== true || guiReady.hasGuidSendButton !== true) {
      throw new Error('guest_smoke_summary must prove the packaged GUID entry is usable.');
    }
  }
}

function validateAssistantRouteSmokeSummary(artifact: EvidenceArtifact, payload: unknown) {
  const record = asRecord(payload, artifact.id);
  if (record.surface_id !== 'opl_packaged_gui_assistant_route_smoke') {
    throw new Error(`${artifact.id} must be a packaged GUI assistant route smoke summary.`);
  }
  if (record.status !== 'passed') {
    throw new Error(`${artifact.id} must be passed.`);
  }
  if (!Array.isArray(record.assistants)) {
    throw new Error(`${artifact.id} must include assistant route smoke results.`);
  }
  const resultsById = new Map(
    record.assistants.map((entry) => {
      const assistant = asRecord(entry, `${artifact.id}.assistants[]`);
      return [assistant.id, assistant];
    }),
  );
  for (const [assistantId, badge, shortName] of [
    ['mas', '@MAS', 'MAS'],
    ['mag', '@MAG', 'MAG'],
    ['rca', '@RCA', 'RCA'],
  ]) {
    const assistant = resultsById.get(assistantId);
    if (!assistant) {
      throw new Error(`${artifact.id} must include ${assistantId} route smoke result.`);
    }
    if (assistant.badge !== badge) {
      throw new Error(`${artifact.id}.${assistantId} must show ${badge}.`);
    }
    const ready = asRecord(assistant.ready, `${artifact.id}.${assistantId}.ready`);
    if (ready.selectors_hidden !== true || ready.badge !== badge) {
      throw new Error(`${artifact.id}.${assistantId} must prove ordinary selectors are hidden after selection.`);
    }
    const receipt = asRecord(assistant.receipt, `${artifact.id}.${assistantId}.receipt`);
    if (receipt.status !== 'passed') {
      throw new Error(`${artifact.id}.${assistantId} must include a passed route receipt.`);
    }
    if (receipt.conversation_type !== 'acp' || receipt.backend !== 'codex') {
      throw new Error(`${artifact.id}.${assistantId} must create a Codex ACP conversation.`);
    }
    const route = asRecord(receipt.route, `${artifact.id}.${assistantId}.receipt.route`);
    if (
      route.route_kind !== 'builtin_capability' ||
      route.executor !== 'codex_cli' ||
      route.assistant_id !== assistantId ||
      route.assistant_short_name !== shortName ||
      route.source !== 'opl_app_home'
    ) {
      throw new Error(`${artifact.id}.${assistantId} must include the App-owned Codex builtin assistant route receipt.`);
    }
  }
}

function validateCodexFunctionalCheckSummary(record: Record<string, unknown>) {
  if (record.schema !== 'opl_codex_functional_check_receipt.v1') {
    throw new Error('codex_functional_check_summary must use the Codex functional check receipt schema.');
  }
  if (!['passed', 'diagnostic_skipped'].includes(String(record.status))) {
    throw new Error('codex_functional_check_summary must be passed or diagnostic_skipped for release evidence.');
  }
  const gate = asRecord(record.blocking_release_gate, 'codex_functional_check_summary.blocking_release_gate');
  if (gate.deterministic_fields_passed !== true) {
    throw new Error('codex_functional_check_summary deterministic fields must pass.');
  }
  if (gate.llm_invocation_required !== false) {
    throw new Error('codex_functional_check_summary must not require LLM invocation.');
  }

  if (
    !record.assistant_route_receipts_checked
    || typeof record.assistant_route_receipts_checked !== 'object'
    || Array.isArray(record.assistant_route_receipts_checked)
  ) {
    throw new Error('codex_functional_check_summary must include assistant route receipts evidence.');
  }
  const routeReceipts = record.assistant_route_receipts_checked as Record<string, unknown>;
  if (routeReceipts.status !== 'passed' || routeReceipts.deterministic !== true) {
    throw new Error('codex_functional_check_summary assistant route receipts must be deterministic and passed.');
  }
  const required = Array.isArray(routeReceipts.required) ? routeReceipts.required : [];
  const checked = Array.isArray(routeReceipts.checked) ? routeReceipts.checked : [];
  for (const assistantId of ['mas', 'mag', 'rca']) {
    if (!required.includes(assistantId) || !checked.includes(assistantId)) {
      throw new Error('codex_functional_check_summary must cover MAS/MAG/RCA assistant route receipts.');
    }
  }
}

function validateJsonEvidenceShape(artifact: EvidenceArtifact, payload: unknown) {
  const record = asRecord(payload, artifact.id);
  if (artifact.id === 'app_state_summary' || artifact.id === 'app_state_full') {
    const appState = asRecord(record.app_state, `${artifact.id}.app_state`);
    if (appState.schema !== 'opl_app_state.v1' && appState.schema_version !== 'opl_app_state.v1') {
      throw new Error(`${artifact.id} must be real OPL App state JSON with schema opl_app_state.v1.`);
    }
    const meta = appState.meta === undefined ? {} : asRecord(appState.meta, `${artifact.id}.app_state.meta`);
    const profile = appState.profile ?? meta.profile;
    if (artifact.id === 'app_state_summary' && profile !== 'fast') {
      throw new Error('app_state_summary must use the fast OPL App state profile.');
    }
    if (artifact.id === 'app_state_full' && profile !== 'full') {
      throw new Error('app_state_full must use the full OPL App state profile.');
    }
    if (!appState.operator || typeof appState.operator !== 'object') {
      throw new Error(`${artifact.id} must include operator state from OPL.`);
    }
    if (!appState.provider || typeof appState.provider !== 'object') {
      throw new Error(`${artifact.id} must include provider state from OPL.`);
    }
  }
  if (artifact.id === 'drilldown_full') {
    const drilldown = asRecord(record.app_operator_drilldown, `${artifact.id}.app_operator_drilldown`);
    if (drilldown.surface_kind !== 'opl_app_operator_drilldown_read_model') {
      throw new Error(`${artifact.id} must be an OPL App/operator drilldown read model.`);
    }
    if (drilldown.detail_level !== 'full') {
      throw new Error('drilldown_full must be full-detail App/operator drilldown JSON.');
    }
    if (!drilldown.summary || typeof drilldown.summary !== 'object') {
      throw new Error(`${artifact.id} must include App/operator drilldown summary.`);
    }
  }
  if (artifact.id === 'action_dry_run_result' || artifact.id === 'action_execute_result') {
    const execution = asRecord(record.app_action_execution, `${artifact.id}.app_action_execution`);
    if (execution.surface_kind !== 'opl_app_action_execution.v1') {
      throw new Error(`${artifact.id} must be an OPL App action execution JSON result.`);
    }
    if (typeof execution.action_id !== 'string' || !execution.action_id.trim()) {
      throw new Error(`${artifact.id} must include action_id.`);
    }
    if (artifact.id === 'action_dry_run_result' && execution.dry_run !== true) {
      throw new Error('action_dry_run_result must be a dry-run execution result.');
    }
    if (artifact.id === 'action_execute_result' && execution.dry_run !== false) {
      throw new Error('action_execute_result must be a non-dry-run execution result.');
    }
    if (!execution.result || typeof execution.result !== 'object') {
      throw new Error(`${artifact.id} must include result details.`);
    }
    if (!execution.authority_boundary || typeof execution.authority_boundary !== 'object') {
      throw new Error(`${artifact.id} must include authority_boundary.`);
    }
  }
  if (artifact.id === 'first_run_vm_summary' || artifact.id === 'guest_smoke_summary') {
    validateVmSummary(artifact, record);
  }
  if (artifact.id === 'assistant_route_smoke_summary') {
    validateAssistantRouteSmokeSummary(artifact, record);
  }
  if (artifact.id === 'codex_functional_check_summary') {
    validateCodexFunctionalCheckSummary(record);
  }
  if (artifact.id === 'codex_ai_self_check_summary') {
    if (record.schema !== 'opl_codex_ai_self_check_receipt.v1') {
      throw new Error('codex_ai_self_check_summary must use the Codex AI self-check receipt schema.');
    }
    if (
      ![
        'passed',
        'failed',
        'needs_attention',
        'error',
        'skipped_not_requested',
        'skipped_missing_codex_config',
      ].includes(String(record.status))
    ) {
      throw new Error('codex_ai_self_check_summary must report a known diagnostic status.');
    }
    if (record.blocking_release_gate !== false) {
      throw new Error('codex_ai_self_check_summary must remain non-blocking diagnostic evidence.');
    }
    if (record.mutations_allowed !== false && record.mode !== 'fix') {
      throw new Error('codex_ai_self_check_summary diagnose mode must not allow mutations.');
    }
  }
  if (artifact.id === 'remote_release_verification') {
    if (record.status !== 'passed') {
      throw new Error('remote_release_verification must be a passed remote release verification summary.');
    }
    if (record.include_full_package !== true) {
      throw new Error('remote_release_verification must include the Full first-install package check.');
    }
    if (!Number.isSafeInteger(record.verified_asset_count) || Number(record.verified_asset_count) <= 0) {
      throw new Error('remote_release_verification must report verified release assets.');
    }
    if (!record.full_first_install_budget || typeof record.full_first_install_budget !== 'object') {
      throw new Error('remote_release_verification must report the Full first-install budget check.');
    }
  }
}

function validateContractBoundary(bundle: unknown): EvidenceContract {
  const record = bundle as {
    purpose?: unknown;
    manifest_path?: unknown;
    acceptance_path?: unknown;
    refs_only?: unknown;
    required_artifacts?: unknown;
    optional_diagnostic_artifacts?: unknown;
    forbidden_authority?: unknown;
    missing_evidence_policy?: Record<string, unknown>;
    image_evidence_policy?: ImageEvidencePolicy;
  };
  if (record.purpose !== 'runtime_page_operator_evidence_acceptance') {
    throw new Error(`Unexpected operator evidence bundle purpose: ${String(record.purpose)}`);
  }
  if (record.manifest_path !== 'evidence-manifest.json') {
    throw new Error(`Unexpected operator evidence manifest path: ${String(record.manifest_path)}`);
  }
  if (record.acceptance_path !== 'Runtime page') {
    throw new Error(`Unexpected operator evidence bundle acceptance path: ${String(record.acceptance_path)}`);
  }
  if (record.refs_only !== true) {
    throw new Error('Operator evidence bundle must be refs-only.');
  }
  if (record.missing_evidence_policy?.default_validation !== 'fail_closed') {
    throw new Error('Operator evidence bundle missing evidence policy must fail closed by default.');
  }
  if (record.missing_evidence_policy?.allow_missing_evidence_flag !== '--allow-missing-evidence') {
    throw new Error('Operator evidence bundle missing evidence policy must declare --allow-missing-evidence.');
  }
  if (record.missing_evidence_policy?.missing_status !== 'missing_evidence') {
    throw new Error('Operator evidence bundle missing evidence policy must declare missing_evidence status.');
  }
  const allowedStatuses = record.missing_evidence_policy?.allowed_artifact_statuses;
  if (
    !Array.isArray(allowedStatuses) ||
    !['present', 'missing', 'typed_blocker', 'not_applicable'].every((status) => allowedStatuses.includes(status))
  ) {
    throw new Error('Operator evidence bundle must allow present, missing, typed_blocker, and not_applicable artifact statuses.');
  }
  const typedBlockerRequirements = record.missing_evidence_policy?.typed_blocker_status_requires;
  if (!Array.isArray(typedBlockerRequirements) || !['reason', 'typed_blocker_ref'].every((field) => typedBlockerRequirements.includes(field))) {
    throw new Error('Operator evidence bundle typed_blocker status must require reason and typed_blocker_ref.');
  }
  const notApplicableRequirements = record.missing_evidence_policy?.not_applicable_status_requires;
  if (
    !Array.isArray(notApplicableRequirements) ||
    !['reason', 'not_applicable_reason'].every((field) => notApplicableRequirements.includes(field))
  ) {
    throw new Error('Operator evidence bundle not_applicable status must require reason and not_applicable_reason.');
  }
  if (record.missing_evidence_policy?.packaged_app_evidence_requires !== 'all_required_artifacts_present_and_verified') {
    throw new Error('Operator evidence bundle must require all artifacts before claiming packaged App evidence.');
  }
  if (!Array.isArray(record.required_artifacts) || record.required_artifacts.length === 0) {
    throw new Error('Operator evidence bundle must declare required artifacts.');
  }
  const optionalDiagnostics = record.optional_diagnostic_artifacts;
  if (optionalDiagnostics !== undefined && !Array.isArray(optionalDiagnostics)) {
    throw new Error('Operator evidence bundle optional diagnostic artifacts must be an array.');
  }
  const imageEvidencePolicy = asRecord(record.image_evidence_policy, 'operator evidence image_evidence_policy') as unknown as ImageEvidencePolicy;
  if (imageEvidencePolicy.applies_to_kind !== 'image') {
    throw new Error('Operator evidence bundle image evidence policy must apply to image artifacts.');
  }
  if (
    imageEvidencePolicy.minimum_width_px !== 640 ||
    imageEvidencePolicy.minimum_height_px !== 360 ||
    imageEvidencePolicy.minimum_file_size_bytes !== 4096 ||
    imageEvidencePolicy.placeholder_screenshot_allowed !== false
  ) {
    throw new Error('Operator evidence bundle image evidence policy must reject placeholder screenshots.');
  }
  const forbiddenAuthority = Array.isArray(record.forbidden_authority) ? record.forbidden_authority : [];
  for (const forbidden of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    if (!forbiddenAuthority.includes(forbidden)) {
      throw new Error(`Operator evidence bundle must exclude ${forbidden}`);
    }
  }
  for (const artifact of record.required_artifacts as EvidenceArtifact[]) {
    if (!artifact.id || !artifact.path || !artifact.kind || !artifact.producer || !artifact.source_kind) {
      throw new Error(`Invalid operator evidence artifact contract: ${JSON.stringify(artifact)}`);
    }
  }
  for (const artifact of (optionalDiagnostics ?? []) as EvidenceArtifact[]) {
    if (!artifact.id || !artifact.path || !artifact.kind || !artifact.producer || !artifact.source_kind) {
      throw new Error(`Invalid optional operator evidence diagnostic artifact contract: ${JSON.stringify(artifact)}`);
    }
  }
  return {
    manifestPath: record.manifest_path,
    artifacts: record.required_artifacts as EvidenceArtifact[],
    optionalDiagnostics: (optionalDiagnostics ?? []) as EvidenceArtifact[],
    imageEvidencePolicy,
    typedBlockerPolicy: {
      root: record.missing_evidence_policy.typed_blocker_root as string,
      requiredFields: typedBlockerRequires as string[],
    },
  };
}

function validateManifestArtifact(manifestArtifact: unknown, expected: EvidenceArtifact): ManifestArtifact {
  const artifact = asRecord(manifestArtifact, `manifest artifact ${expected.id}`);
  for (const key of ['id', 'path', 'kind', 'producer', 'source_kind'] as const) {
    if (artifact[key] !== expected[key]) {
      throw new Error(`Manifest artifact ${expected.id}.${key} must match release contract.`);
    }
  }
  if (
    artifact.status !== 'present' &&
    artifact.status !== 'missing' &&
    artifact.status !== 'typed_blocker' &&
    artifact.status !== 'not_applicable'
  ) {
    throw new Error(`Manifest artifact ${expected.id}.status must be present, missing, typed_blocker, or not_applicable.`);
  }
  if (artifact.status === 'missing' && typeof artifact.missing_reason !== 'string') {
    throw new Error(`Manifest artifact ${expected.id} must explain missing_reason.`);
  }
  if (artifact.status === 'typed_blocker') {
    if (typeof artifact.reason !== 'string' || !artifact.reason.trim()) {
      throw new Error(`Manifest artifact ${expected.id} typed_blocker must include reason.`);
    }
    if (typeof artifact.typed_blocker_ref !== 'string' || !artifact.typed_blocker_ref.trim()) {
      throw new Error(`Manifest artifact ${expected.id} typed_blocker must include typed_blocker_ref.`);
    }
  }
  if (artifact.status === 'not_applicable') {
    if (typeof artifact.reason !== 'string' || !artifact.reason.trim()) {
      throw new Error(`Manifest artifact ${expected.id} not_applicable must include reason.`);
    }
    if (typeof artifact.not_applicable_reason !== 'string' || !artifact.not_applicable_reason.trim()) {
      throw new Error(`Manifest artifact ${expected.id} not_applicable must include not_applicable_reason.`);
    }
  }
  return artifact as ManifestArtifact;
}

function validateMissingEvidenceList(manifest: Record<string, unknown>, missingArtifacts: ManifestArtifact[]) {
  const missingEvidence = manifest.missing_evidence;
  if (!Array.isArray(missingEvidence)) {
    throw new Error('Evidence manifest must declare missing_evidence array.');
  }
  const missingIds = new Set(missingArtifacts.map((artifact) => artifact.id));
  const declaredIds = new Set();
  for (const entry of missingEvidence) {
    const record = asRecord(entry, 'missing evidence entry');
    if (
      typeof record.id !== 'string' ||
      typeof record.path !== 'string' ||
      typeof record.status !== 'string' ||
      typeof record.reason !== 'string'
    ) {
      throw new Error('Missing evidence entries must include id, path, status, and reason.');
    }
    if (!missingIds.has(record.id)) {
      throw new Error(`Evidence manifest missing_evidence includes unexpected artifact ${record.id}.`);
    }
    const artifact = missingArtifacts.find((candidate) => candidate.id === record.id);
    if (!artifact) {
      throw new Error(`Evidence manifest missing_evidence includes unexpected artifact ${record.id}.`);
    }
    if (artifact?.status !== record.status) {
      throw new Error(`Evidence manifest missing_evidence ${record.id}.status must match artifact status.`);
    }
    if (record.status === 'typed_blocker' && record.typed_blocker_ref !== artifact.typed_blocker_ref) {
      throw new Error(`Evidence manifest missing_evidence ${record.id} must carry typed_blocker_ref.`);
    }
    if (record.status === 'not_applicable' && record.not_applicable_reason !== artifact.not_applicable_reason) {
      throw new Error(`Evidence manifest missing_evidence ${record.id} must carry not_applicable_reason.`);
    }
    declaredIds.add(record.id);
  }
  if (declaredIds.size !== missingIds.size || [...missingIds].some((id) => !declaredIds.has(id))) {
    throw new Error('Evidence manifest missing_evidence must match missing artifact statuses.');
  }
}

function validateTypedBlockerFile(filePath: string, artifact: ManifestArtifact, policy: TypedBlockerPolicy) {
  const blocker = asRecord(assertJsonFile(filePath, `${artifact.id} typed blocker`), `${artifact.id} typed blocker`);
  for (const field of policy.requiredFields) {
    if (!(field in blocker)) {
      throw new Error(`${artifact.id} typed blocker must include ${field}.`);
    }
  }
  if (blocker.artifact_id !== artifact.id) {
    throw new Error(`${artifact.id} typed blocker must match artifact_id.`);
  }
  if (typeof blocker.typed_blocker_ref !== 'string' || !blocker.typed_blocker_ref.trim()) {
    throw new Error(`${artifact.id} typed blocker must include a non-empty typed_blocker_ref.`);
  }
  if (typeof blocker.owner !== 'string' || !blocker.owner.trim()) {
    throw new Error(`${artifact.id} typed blocker must include owner.`);
  }
  if (typeof blocker.blocker_kind !== 'string' || !blocker.blocker_kind.trim()) {
    throw new Error(`${artifact.id} typed blocker must include blocker_kind.`);
  }
  if (typeof blocker.reason !== 'string' || !blocker.reason.trim()) {
    throw new Error(`${artifact.id} typed blocker must include reason.`);
  }
  if (!Array.isArray(blocker.evidence_refs) || blocker.evidence_refs.length === 0) {
    throw new Error(`${artifact.id} typed blocker must include evidence_refs.`);
  }
  if (!blocker.evidence_refs.every((entry) => typeof entry === 'string' && entry.trim())) {
    throw new Error(`${artifact.id} typed blocker evidence_refs must be non-empty strings.`);
  }
  if (typeof blocker.next_action !== 'string' || !blocker.next_action.trim()) {
    throw new Error(`${artifact.id} typed blocker must include next_action.`);
  }
  return {
    typed_blocker_ref: blocker.typed_blocker_ref,
    owner: blocker.owner,
    blocker_kind: blocker.blocker_kind,
    reason: blocker.reason,
    evidence_refs: blocker.evidence_refs,
    next_action: blocker.next_action,
  };
}

function validateBlockedEvidenceList(
  bundleDir: string,
  manifest: Record<string, unknown>,
  blockedArtifacts: ManifestArtifact[],
  policy: TypedBlockerPolicy,
) {
  const blockedEvidence = manifest.blocked_evidence;
  if (!Array.isArray(blockedEvidence)) {
    throw new Error('Evidence manifest must declare blocked_evidence array.');
  }
  const blockedIds = new Set(blockedArtifacts.map((artifact) => artifact.id));
  const declaredIds = new Set();
  for (const entry of blockedEvidence) {
    const record = asRecord(entry, 'blocked evidence entry');
    if (typeof record.id !== 'string' || typeof record.path !== 'string' || typeof record.typed_blocker_path !== 'string') {
      throw new Error('Blocked evidence entries must include id, path, and typed_blocker_path.');
    }
    declaredIds.add(record.id);
  }
  if (declaredIds.size !== blockedIds.size || [...blockedIds].some((id) => !declaredIds.has(id))) {
    throw new Error('Evidence manifest blocked_evidence must match blocked artifact statuses.');
  }
  return blockedArtifacts.map((artifact) => {
    if (typeof artifact.typed_blocker_path !== 'string') {
      throw new Error(`Blocked artifact ${artifact.id} must include typed_blocker_path.`);
    }
    if (!artifact.typed_blocker_path.startsWith(policy.root)) {
      throw new Error(`Blocked artifact ${artifact.id} typed_blocker_path must stay under ${policy.root}.`);
    }
    const blockerRef = validateTypedBlockerFile(resolveBundlePath(bundleDir, artifact.typed_blocker_path), artifact, policy);
    return {
      id: artifact.id,
      path: artifact.path,
      kind: artifact.kind,
      producer: artifact.producer,
      source_kind: artifact.source_kind,
      status: artifact.status,
      typed_blocker_path: artifact.typed_blocker_path,
      ...blockerRef,
    };
  });
}

function validateBundle(bundleDir: string, options: Options) {
  const releaseContract = readJson(releaseContractPath);
  const contract = validateContractBoundary(releaseContract.operator_evidence_bundle);
  const manifestPath = resolveBundlePath(bundleDir, contract.manifestPath);
  const manifest = asRecord(assertJsonFile(manifestPath, 'evidence-manifest'), 'evidence-manifest');

  if (manifest.schema_version !== 1) {
    throw new Error(`Evidence manifest schema_version must be 1; got ${String(manifest.schema_version)}`);
  }
  if (manifest.purpose !== 'app_release_evidence_bundle') {
    throw new Error(`Unexpected evidence manifest purpose: ${String(manifest.purpose)}`);
  }
  if (manifest.acceptance_path !== 'Runtime page') {
    throw new Error(`Unexpected evidence manifest acceptance_path: ${String(manifest.acceptance_path)}`);
  }
  if (manifest.runtime_page_contract !== 'contracts/app-page-state-matrix.json#runtime') {
    throw new Error(`Unexpected evidence manifest runtime_page_contract: ${String(manifest.runtime_page_contract)}`);
  }
  if (manifest.refs_only !== true) {
    throw new Error('Evidence manifest must be refs-only.');
  }
  if (manifest.authority_boundary !== evidenceBoundary) {
    throw new Error(`Evidence manifest authority_boundary must be ${evidenceBoundary}.`);
  }
  if (!Array.isArray(manifest.artifacts)) {
    throw new Error('Evidence manifest must declare artifacts array.');
  }
  if (manifest.diagnostics !== undefined && !Array.isArray(manifest.diagnostics)) {
    throw new Error('Evidence manifest diagnostics must be an array when present.');
  }

  const manifestArtifacts = new Map(
    manifest.artifacts.map((entry) => {
      const record = asRecord(entry, 'evidence manifest artifact');
      return [record.id, entry];
    }),
  );
  const unexpectedIds = [...manifestArtifacts.keys()].filter((id) => !contract.artifacts.some((artifact) => artifact.id === id));
  if (unexpectedIds.length > 0) {
    throw new Error(`Evidence manifest declares unknown artifact(s): ${unexpectedIds.join(', ')}`);
  }
  const diagnostics = Array.isArray(manifest.diagnostics) ? manifest.diagnostics : [];
  const diagnosticArtifacts = new Map(
    diagnostics.map((entry) => {
      const record = asRecord(entry, 'evidence manifest diagnostic artifact');
      return [record.id, entry];
    }),
  );
  const unexpectedDiagnosticIds = [...diagnosticArtifacts.keys()].filter(
    (id) => !contract.optionalDiagnostics.some((artifact) => artifact.id === id),
  );
  if (unexpectedDiagnosticIds.length > 0) {
    throw new Error(`Evidence manifest declares unknown diagnostic artifact(s): ${unexpectedDiagnosticIds.join(', ')}`);
  }

  const verified: ManifestArtifact[] = [];
  const verifiedDiagnostics: ManifestArtifact[] = [];
  const missing: ManifestArtifact[] = [];
  const blocked: ManifestArtifact[] = [];

  for (const expected of contract.artifacts) {
    const entry = manifestArtifacts.get(expected.id);
    if (!entry) {
      throw new Error(`Evidence manifest is missing artifact ${expected.id}`);
    }
    const artifact = validateManifestArtifact(entry, expected);
    if (artifact.status !== 'present') {
      missing.push(artifact);
      continue;
    }
    if (artifact.status === 'blocked') {
      blocked.push(artifact);
      continue;
    }

    const filePath = resolveBundlePath(bundleDir, artifact.path);
    if (artifact.kind === 'json') {
      validateJsonEvidenceShape(artifact, assertJsonFile(filePath, artifact.id));
    } else if (artifact.kind === 'image') {
      assertImageFile(filePath, artifact.id, contract.imageEvidencePolicy);
    } else if (artifact.kind === 'log') {
      assertLogFile(filePath, artifact.id);
    } else {
      throw new Error(`Unsupported operator evidence artifact kind: ${artifact.kind}`);
    }
    verified.push(artifact);
  }

  for (const expected of contract.optionalDiagnostics) {
    const entry = diagnosticArtifacts.get(expected.id);
    if (!entry) {
      continue;
    }
    const artifact = validateDiagnosticArtifact(entry, expected);
    const filePath = resolveBundlePath(bundleDir, artifact.path);
    if (artifact.kind === 'json') {
      validateJsonEvidenceShape(artifact, assertJsonFile(filePath, artifact.id));
    } else if (artifact.kind === 'image') {
      assertImageFile(filePath, artifact.id, contract.imageEvidencePolicy);
    } else if (artifact.kind === 'log') {
      assertLogFile(filePath, artifact.id);
    } else {
      throw new Error(`Unsupported operator evidence diagnostic artifact kind: ${artifact.kind}`);
    }
    verifiedDiagnostics.push(artifact);
  }

  const blockedEvidence = validateBlockedEvidenceList(bundleDir, manifest, blocked, contract.typedBlockerPolicy);

  if (missing.length > 0 || blocked.length > 0) {
    const expectedStatus = blocked.length > 0 ? 'blocked_evidence' : 'missing_evidence';
    if (manifest.status !== expectedStatus) {
      throw new Error(`Evidence manifest status must be ${expectedStatus} when required artifacts are ${blocked.length > 0 ? 'blocked' : 'missing'}.`);
    }
    if (manifest.packaged_app_evidence !== false) {
      throw new Error('Evidence manifest must set packaged_app_evidence=false while evidence is missing or blocked.');
    }
    validateMissingEvidenceList(manifest, missing);
    if (!options.allowMissingEvidence) {
      throw new Error(
        `Release evidence bundle is missing or blocked and cannot be used as packaged App evidence: ${[
          ...missing.map((artifact) => artifact.id),
          ...blocked.map((artifact) => artifact.id),
        ].join(', ')}`,
      );
    }
  } else {
    if (manifest.status !== 'passed') {
      throw new Error('Evidence manifest status must be passed when all required artifacts are present.');
    }
    if (manifest.packaged_app_evidence !== true) {
      throw new Error('Evidence manifest must set packaged_app_evidence=true only when all artifacts are present and verified.');
    }
    validateMissingEvidenceList(manifest, []);
    validateBlockedEvidenceList(bundleDir, manifest, [], contract.typedBlockerPolicy);
  }

  return {
    status: blocked.length > 0 ? 'blocked_evidence' : missing.length > 0 ? 'missing_evidence' : 'passed',
    bundle_dir: bundleDir,
    manifest_path: contract.manifestPath,
    packaged_app_evidence: missing.length === 0 && blocked.length === 0,
    evidence_boundary: evidenceBoundary,
    verified_artifact_count: verified.length,
    verified_artifacts: verified.map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      kind: artifact.kind,
      producer: artifact.producer,
      source_kind: artifact.source_kind,
      status: artifact.status,
    })),
    verified_diagnostic_count: verifiedDiagnostics.length,
    verified_diagnostics: verifiedDiagnostics.map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      kind: artifact.kind,
      producer: artifact.producer,
      source_kind: artifact.source_kind,
      status: artifact.status,
    })),
    missing_artifact_count: missing.length,
    missing_artifacts: missing.map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      kind: artifact.kind,
      producer: artifact.producer,
      source_kind: artifact.source_kind,
      status: artifact.status,
      reason: artifact.reason ?? artifact.missing_reason,
      ...(artifact.missing_reason
        ? { missing_reason: artifact.missing_reason }
        : {}),
      ...(artifact.typed_blocker_ref
        ? { typed_blocker_ref: artifact.typed_blocker_ref }
        : {}),
      ...(artifact.not_applicable_reason
        ? { not_applicable_reason: artifact.not_applicable_reason }
        : {}),
    })),
    blocked_artifact_count: blocked.length,
    blocked_artifacts: blockedEvidence,
  };
}

try {
  const options = parseArgs(process.argv.slice(2));
  console.log(`${JSON.stringify(validateBundle(options.bundleDir, options), null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
