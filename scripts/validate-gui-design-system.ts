#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type JsonRecord = Record<string, unknown>;
type ActiveSurfaceState = 'collapsed' | 'visible' | 'visible_wide_drawer_narrow';
type ContractConformanceStatus = 'aligned_contract' | 'current_contract_deviation';

const conformanceStatusVocabulary = {
  contract_status: ['aligned_contract', 'current_contract_deviation', 'candidate_target', 'not_claimed'],
  source_status: ['source_implemented', 'source_partial', 'source_missing', 'source_not_assessed'],
  pixel_status: ['pixel_verified', 'pixel_unverified', 'pixel_blocked', 'not_applicable'],
} as const;

export type GuiDesignSystemValidation = {
  schema: 'opl_app_gui_design_system_validation.v1';
  status: 'consistent';
  root: string;
  definition_stack: string[];
  shell_roles: {
    active: 'aionui';
    foreground: 'opl-native-workbench';
    retained: 'hermes-codex';
    archived: 'agui-codex';
  };
  codex_reference: string;
  superseded_codex_reference: string;
  reference_boundary: {
    app_contract_status: 'aligned_contract';
    page_state_status: 'aligned_contract';
    native_candidate_reference: string;
    native_candidate_status: ContractConformanceStatus;
  };
  model_defaults: {
    model: string;
    reasoning_effort: string;
  };
  state_boundary: {
    ideal_native_rail_visible: true;
    ideal_native_inspector_visible: false;
    active_aionui_rail_state: ActiveSurfaceState;
    active_aionui_inspector_state: ActiveSurfaceState;
    active_aionui_conformance: {
      rail_matches_ideal: boolean;
      inspector_matches_ideal: boolean;
      rail_status: ContractConformanceStatus;
      inspector_status: ContractConformanceStatus;
      permission_access_mode_status: ContractConformanceStatus;
      side_panel_information_architecture_status: ContractConformanceStatus;
    };
  };
  evidence_scope: 'design_system_governance_consistency_only';
  conformance_matrix: {
    rows_validated: number;
    status_axes: ['contract_status', 'source_status', 'pixel_status'];
    pixel_verified_implies_visual_parity: false;
  };
  visual_evidence: {
    manifest: 'docs/product/gui/evidence/aionui-41301/manifest.json';
    shell_head: string;
    entries_verified: 8;
    packaged_command: true;
  };
  release_ready: false;
};

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roleMarker = 'gui_shell_roles: active=aionui; foreground=opl-native-workbench; retained=hermes-codex; archived=agui-codex';
const stackMarker = 'gui_definition_stack: product_definition > visual_system > shell_implementation_conformance';
const shellAuthorityMarker = 'gui_shell_authority: implementation_only';
const codexReference = 'ChatGPT Codex macOS 26.707.41301 (2026-07-11)';
const supersededCodexReference = 'ChatGPT Codex macOS 26.707.31428 (2026-07-10)';
const earlierSupersededCodexReference = 'ChatGPT Codex macOS 26.707.31123 (2026-07-10)';
const supersededCodexReferences = [supersededCodexReference, earlierSupersededCodexReference];

const foundationDocs = {
  readme: 'docs/product/gui/README.md',
  visual_system: 'docs/product/gui/visual-system.md',
  shell_implementation_guide: 'docs/product/gui/shell-implementation-guide.md',
  shell_conformance_matrix: 'docs/product/gui/shell-conformance-matrix.md',
} as const;

const convergencePlanPath = 'docs/active/aionui-mainline-gui-convergence-plan.md';

const expectedStack = [
  {
    id: 'product_definition',
    priority: 1,
    entry_docs: [foundationDocs.readme, 'docs/product/gui/feature-inventory.md'],
    contract_refs: [
      'contracts/app-gui-product-contract.json',
      'contracts/app-product-profile.json',
      'contracts/app-page-state-matrix.json',
    ],
  },
  {
    id: 'visual_system',
    priority: 2,
    entry_docs: [
      'docs/product/gui/ideal-interaction-spec.md',
      foundationDocs.visual_system,
      'docs/product/gui/codex-to-opl-app-delta.md',
      'docs/product/gui/element-audit.md',
    ],
    contract_refs: [
      'contracts/app-gui-product-contract.json',
      'contracts/app-product-profile.json',
      'contracts/app-page-state-matrix.json',
    ],
  },
  {
    id: 'shell_implementation_conformance',
    priority: 3,
    entry_docs: [foundationDocs.shell_implementation_guide, foundationDocs.shell_conformance_matrix],
    contract_refs: [
      'contracts/app-gui-product-contract.json',
      'contracts/app-product-profile.json',
      'contracts/app-page-state-matrix.json',
      'contracts/app-shell-candidates.json',
      'contracts/app-shell-adapter.json',
    ],
  },
] as const;

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
}

function sameStrings(actual: unknown, expected: readonly string[]): boolean {
  return JSON.stringify(stringArray(actual)) === JSON.stringify(expected);
}

function conformanceStatus(matches: boolean): ContractConformanceStatus {
  return matches ? 'aligned_contract' : 'current_contract_deviation';
}

function readJson(root: string, relativePath: string, issues: Set<string>): JsonRecord {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    issues.add(`missing ${relativePath}`);
    return {};
  }
  try {
    return record(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch (error) {
    issues.add(`${relativePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

function readText(root: string, relativePath: string, issues: Set<string>): string {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    issues.add(`missing ${relativePath}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function sha256(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function isExactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function hasExactRecord(actual: JsonRecord, expected: JsonRecord): boolean {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return JSON.stringify(actualKeys) === JSON.stringify(expectedKeys) && expectedKeys.every((key) => actual[key] === expected[key]);
}

function validateVisualEvidence(root: string, historicalPixelShellSha: string, issues: Set<string>): number {
  const manifestPath = 'docs/product/gui/evidence/aionui-41301/manifest.json';
  const manifest = readJson(root, manifestPath, issues);
  const sourceManifestPath = 'docs/product/gui/evidence/aionui-41301/source-manifest.json';
  const sourceManifest = readJson(root, sourceManifestPath, issues);
  const entries = Array.isArray(manifest.entries) ? manifest.entries.map(record) : [];
  const sourceEntries = Array.isArray(sourceManifest.entries) ? sourceManifest.entries.map(record) : [];
  const claims = record(manifest.claims);
  const sourceClaims = record(sourceManifest.claims);
  const expectedClaims = {
    route_state_non_empty: true,
    layout_bounds_checked: true,
    parity_1_to_1: false,
    release_ready: false,
  };

  if (
    manifest.schema !== 'opl_app_gui_visual_evidence.v1' ||
    manifest.owner !== 'one-person-lab-app' ||
    manifest.shell_head !== historicalPixelShellSha ||
    manifest.source_manifest !== sourceManifestPath ||
    manifest.entry_count !== 8 ||
    entries.length !== 8 ||
    typeof manifest.command !== 'string' ||
    !manifest.command.includes('E2E_PACKAGED=1') ||
    !hasExactRecord(claims, expectedClaims)
  ) {
    issues.add('AionUI 41301 visual evidence manifest must bind eight packaged route/layout entries without parity or release claims');
  }

  const sourcePath = path.join(root, sourceManifestPath);
  if (
    !fs.existsSync(sourcePath) ||
    manifest.source_manifest_sha256 !== sha256(sourcePath) ||
    sourceManifest.schema !== 'opl_aionui_gui_route_visual_evidence.v1' ||
    sourceManifest.shell_head !== historicalPixelShellSha ||
    sourceManifest.command !== manifest.command ||
    sourceEntries.length !== 8
  ) {
    issues.add('AionUI 41301 promoted evidence must preserve the exact source manifest and final Shell binding');
  }

  if (
    !isExactIsoTimestamp(manifest.generated_at) ||
    !isExactIsoTimestamp(sourceManifest.generated_at) ||
    manifest.generated_at !== sourceManifest.generated_at
  ) {
    issues.add('AionUI 41301 promoted and source evidence must share one exact ISO generated_at timestamp');
  }
  if (
    manifest.evidence_scope !== 'route_state_non_empty_and_layout_only' ||
    sourceManifest.evidence_scope !== manifest.evidence_scope
  ) {
    issues.add('AionUI 41301 promoted and source evidence must share the route-state and layout-only evidence_scope');
  }
  if (!hasExactRecord(sourceClaims, expectedClaims) || !hasExactRecord(sourceClaims, claims)) {
    issues.add('AionUI 41301 promoted and source evidence claims must be identical and limited to the governed claim set');
  }

  const ids = new Set<string>();
  for (const entry of entries) {
    const id = typeof entry.id === 'string' ? entry.id : '';
    const screenshotPath = typeof entry.screenshot_path === 'string' ? entry.screenshot_path : '';
    const filePath = path.join(root, screenshotPath);
    if (
      !id ||
      ids.has(id) ||
      !screenshotPath.startsWith('docs/product/gui/evidence/aionui-41301/screenshots/') ||
      !fs.existsSync(filePath) ||
      entry.bytes !== fs.statSync(filePath).size ||
      entry.sha256 !== sha256(filePath)
    ) {
      issues.add(
        `AionUI 41301 visual evidence entry ${id || '<missing>'} must bind a unique promoted screenshot with exact bytes and SHA-256`,
      );
    }
    ids.add(id);
  }

  const promotedEntryIds = entries.map((entry) => entry.id);
  const sourceEntryIds = sourceEntries.map((entry) => entry.id);
  if (JSON.stringify(promotedEntryIds) !== JSON.stringify(sourceEntryIds)) {
    issues.add('AionUI 41301 promoted and source evidence must preserve the same ordered entry ID set');
  }

  for (const entry of sourceEntries) {
    const anchors = Array.isArray(entry.anchors) ? entry.anchors.map(record) : [];
    const layoutChecks = Array.isArray(entry.layout_checks) ? entry.layout_checks.map(record) : [];
    const coverageGaps = Array.isArray(entry.coverage_gaps) ? entry.coverage_gaps : [];
    if (
      entry.shell_head !== historicalPixelShellSha ||
      anchors.length === 0 ||
      anchors.some((anchor) => anchor.matched !== true) ||
      layoutChecks.length === 0 ||
      layoutChecks.some((check) => check.passed !== true) ||
      coverageGaps.length !== 0
    ) {
      issues.add(`AionUI 41301 source evidence entry ${String(entry.id)} must pass every anchor/layout check with no declared gap`);
    }
  }

  return entries.length;
}

function requireMarker(text: string, marker: string, label: string, issues: Set<string>): void {
  if (!text.includes(marker)) issues.add(`${label} must include ${marker}`);
}

function requireExactMarkerLine(text: string, marker: string, label: string, issues: Set<string>): void {
  const present = text.split(/\r?\n/).some((line) => line.trim().replace(/^-\s+/, '').replace(/^`|`$/g, '') === marker);
  if (!present) issues.add(`${label} must include exact marker ${marker}`);
}

function markdownCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function requireCellStatus(
  cell: string,
  allowed: readonly string[],
  axis: string,
  shell: string,
  requirement: string,
  issues: Set<string>,
): void {
  const normalized = cell.replace(/^`|`$/g, '');
  if (!allowed.includes(normalized)) {
    issues.add(`conformance row "${requirement}" must declare exactly one ${shell} ${axis}`);
  }
}

function validateConformanceMatrix(text: string, issues: Set<string>): number {
  const lines = text.split(/\r?\n/);
  const expectedHeader = [
    '功能或交互要求',
    'AionUI contract',
    'AionUI source',
    'AionUI pixel',
    'Native contract',
    'Native source',
    'Native pixel',
  ];
  const headerIndex = lines.findIndex((line) => {
    const cells = markdownCells(line);
    return expectedHeader.every((header, index) => cells[index] === header);
  });
  if (headerIndex < 0) {
    issues.add('shell conformance matrix must provide separate contract/source/pixel columns for AionUI and Native');
    return 0;
  }

  if (/\baligned-contract\b/.test(text)) {
    issues.add('shell conformance matrix must not use legacy aligned-contract without independent source and pixel status');
  }

  let rowsValidated = 0;
  for (let index = headerIndex + 2; index < lines.length && lines[index].trim().startsWith('|'); index += 1) {
    const cells = markdownCells(lines[index]);
    if (cells.length < expectedHeader.length || /^[-: ]+$/.test(cells[0])) continue;
    const requirement = cells[0] || `row ${index + 1}`;
    requireCellStatus(cells[1], conformanceStatusVocabulary.contract_status, 'contract_status', 'AionUI', requirement, issues);
    requireCellStatus(cells[2], conformanceStatusVocabulary.source_status, 'source_status', 'AionUI', requirement, issues);
    requireCellStatus(cells[3], conformanceStatusVocabulary.pixel_status, 'pixel_status', 'AionUI', requirement, issues);
    requireCellStatus(cells[4], conformanceStatusVocabulary.contract_status, 'contract_status', 'Native', requirement, issues);
    requireCellStatus(cells[5], conformanceStatusVocabulary.source_status, 'source_status', 'Native', requirement, issues);
    requireCellStatus(cells[6], conformanceStatusVocabulary.pixel_status, 'pixel_status', 'Native', requirement, issues);
    rowsValidated += 1;
  }
  if (rowsValidated === 0) issues.add('shell conformance matrix must contain implementation requirement rows');
  return rowsValidated;
}

function matrixRow(text: string, requirement: string): string[] | null {
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = markdownCells(line);
    if (cells[0] === requirement) return cells;
  }
  return null;
}

function requireAionuiContractStatus(text: string, requirement: string, expected: ContractConformanceStatus, issues: Set<string>): void {
  const row = matrixRow(text, requirement);
  if (!row) {
    issues.add(`shell conformance matrix must include current AionUI contract row "${requirement}"`);
    return;
  }
  if (row[1]?.replace(/^`|`$/g, '') !== expected) {
    issues.add(`shell conformance row "${requirement}" must report AionUI contract_status ${expected}`);
  }
}

function validateAionuiSnapshot(root: string, text: string, issues: Set<string>): void {
  const match = text.match(/AionUI GUI conformance ancestor：`opl-aion-shell@([0-9a-f]{40})`/);
  if (!match) {
    issues.add('shell conformance matrix must bind an exact 40-character AionUI GUI conformance ancestor');
    return;
  }
  if (text.includes('pages/guid/components/AssistantSelectionArea.tsx')) {
    issues.add('shell conformance matrix must not retain the retired AssistantSelectionArea source anchor');
  }
  const shellRoot = path.join(root, 'shells', 'aionui');
  if (!fs.existsSync(shellRoot)) return;
  try {
    const currentHead = execFileSync('git', ['-C', shellRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    if (match[1] !== currentHead) {
      issues.add(`shell conformance matrix AionUI snapshot must match current shell HEAD ${currentHead}`);
    }
  } catch (error) {
    issues.add(`unable to read active AionUI GUI conformance ancestor: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function validateGuiDesignSystem(root = defaultRoot): GuiDesignSystemValidation {
  const issues = new Set<string>();
  const registry = readJson(root, 'contracts/app-shell-candidates.json', issues);
  const profile = readJson(root, 'contracts/app-product-profile.json', issues);
  const guiContract = readJson(root, 'contracts/app-gui-product-contract.json', issues);
  const pageStateMatrix = readJson(root, 'contracts/app-page-state-matrix.json', issues);
  const shellAdapter = readJson(root, 'contracts/app-shell-adapter.json', issues);
  const packageJson = readJson(root, 'package.json', issues);
  const governance = record(registry.design_system_governance);

  if (governance.schema !== 'opl_app_gui_design_system_governance.v1') {
    issues.add('design_system_governance.schema must be opl_app_gui_design_system_governance.v1');
  }
  if (governance.entry_doc !== foundationDocs.readme) {
    issues.add(`design_system_governance.entry_doc must be ${foundationDocs.readme}`);
  }

  const declaredFoundationDocs = record(governance.foundation_docs);
  for (const [id, relativePath] of Object.entries(foundationDocs)) {
    if (declaredFoundationDocs[id] !== relativePath) {
      issues.add(`design_system_governance.foundation_docs.${id} must be ${relativePath}`);
    }
  }

  const stack = Array.isArray(governance.definition_stack) ? governance.definition_stack : [];
  if (stack.length !== expectedStack.length) {
    issues.add('design_system_governance.definition_stack must contain exactly three layers');
  }
  expectedStack.forEach((expected, index) => {
    const actual = record(stack[index]);
    if (actual.id !== expected.id || actual.priority !== expected.priority) {
      issues.add(`definition stack layer ${index + 1} must be ${expected.id} at priority ${expected.priority}`);
    }
    if (!sameStrings(actual.entry_docs, expected.entry_docs)) {
      issues.add(`${expected.id}.entry_docs must match the governed document entry points`);
    }
    if (!sameStrings(actual.contract_refs, expected.contract_refs)) {
      issues.add(`${expected.id}.contract_refs must match the governed App contracts`);
    }
    for (const relativePath of [...expected.entry_docs, ...expected.contract_refs]) {
      if (!fs.existsSync(path.join(root, relativePath))) issues.add(`missing ${relativePath}`);
    }
  });
  if (
    !sameStrings(
      governance.priority_order,
      expectedStack.map((layer) => layer.id),
    )
  ) {
    issues.add('design_system_governance.priority_order must follow product, visual, then shell conformance');
  }
  if (governance.shell_authority !== 'implementation_only_cannot_redefine_product') {
    issues.add('design_system_governance.shell_authority must keep shells implementation-only');
  }
  const declaredStatusVocabulary = record(governance.conformance_status_vocabulary);
  for (const [axis, statuses] of Object.entries(conformanceStatusVocabulary)) {
    if (!sameStrings(declaredStatusVocabulary[axis], statuses)) {
      issues.add(`design_system_governance.conformance_status_vocabulary.${axis} must match the governed status vocabulary`);
    }
  }
  if (
    declaredStatusVocabulary.axis_policy !== 'contract_source_pixel_independent' ||
    declaredStatusVocabulary.matrix_row_policy !== 'every_implementation_requirement_has_both_shells_all_three_axes' ||
    declaredStatusVocabulary.pixel_verified_claim !== 'fresh_pixels_exist_not_visual_parity_or_release_readiness'
  ) {
    issues.add('conformance status axes must remain independent and pixel_verified must stay evidence-only');
  }

  const mainline = record(registry.active_gui_mainline);
  const alternatives = record(registry.alternative_gui_policy);
  const candidates = Array.isArray(registry.candidates) ? registry.candidates.map(record) : [];
  const nativeCandidate = candidates.find((candidate) => candidate.id === 'opl-native-workbench') ?? {};
  const hermesCandidate = candidates.find((candidate) => candidate.id === 'hermes-codex') ?? {};
  const aguiCandidate = candidates.find((candidate) => candidate.id === 'agui-codex') ?? {};
  if (mainline.shell !== 'aionui' || registry.active_shell_unchanged !== 'aionui') {
    issues.add('candidate registry must keep AionUI active');
  }
  if (alternatives.only_foreground_alternative !== 'opl-native-workbench') {
    issues.add('candidate registry must keep opl-native-workbench foreground');
  }
  if (!stringArray(alternatives.reference_only_candidates).includes('hermes-codex') || hermesCandidate.state !== 'technical_reference') {
    issues.add('candidate registry must keep hermes-codex as a retained reference candidate');
  }
  if (!stringArray(alternatives.archived_technical_proofs).includes('agui-codex') || aguiCandidate.state !== 'archived_technical_proof') {
    issues.add('candidate registry must keep agui-codex as archived technical proof');
  }
  if (nativeCandidate.foreground_alternative_role !== 'only_foreground_alternative') {
    issues.add('opl-native-workbench must carry only_foreground_alternative role');
  }

  const agents = readText(root, 'AGENTS.md', issues);
  const decisions = readText(root, 'docs/decisions.md', issues);
  const invariants = readText(root, 'docs/invariants.md', issues);
  const candidateDoc = readText(root, 'docs/product/gui/gui-shell-candidates.md', issues);
  requireMarker(agents, roleMarker, 'AGENTS.md', issues);
  requireMarker(candidateDoc, roleMarker, 'gui-shell-candidates.md', issues);
  for (const [label, text] of [
    ['AGENTS.md', agents],
    ['docs/decisions.md', decisions],
    ['docs/invariants.md', invariants],
    ['docs/product/gui/gui-shell-candidates.md', candidateDoc],
  ] as const) {
    requireMarker(text, stackMarker, label, issues);
    requireMarker(text, shellAuthorityMarker, label, issues);
  }
  requireMarker(agents, foundationDocs.readme, 'AGENTS.md', issues);

  const governedDocPaths = [...new Set(expectedStack.flatMap((layer) => layer.entry_docs))];
  const governedDocsPresent = governedDocPaths.every((relativePath) => fs.existsSync(path.join(root, relativePath)));
  const governedText = governedDocPaths.map((relativePath) => readText(root, relativePath, issues)).join('\n');
  const foundationReadme = readText(root, foundationDocs.readme, issues);
  const conformanceMatrix = readText(root, foundationDocs.shell_conformance_matrix, issues);
  const convergencePlan = readText(root, convergencePlanPath, issues);
  const conformanceRowsValidated = validateConformanceMatrix(conformanceMatrix, issues);
  validateAionuiSnapshot(root, conformanceMatrix, issues);
  if (governedDocsPresent) {
    for (const layer of expectedStack) {
      requireExactMarkerLine(foundationReadme, `${layer.id}=${layer.entry_docs.join(',')}`, foundationDocs.readme, issues);
    }
    requireExactMarkerLine(foundationReadme, `entry_docs=${governedDocPaths.join(',')}`, foundationDocs.readme, issues);
    const contractRefs = [...new Set(expectedStack.flatMap((layer) => layer.contract_refs))];
    requireExactMarkerLine(foundationReadme, `contract_refs=${contractRefs.join(',')}`, foundationDocs.readme, issues);
    requireMarker(foundationReadme, shellAuthorityMarker, foundationDocs.readme, issues);
    for (const marker of [
      `current_interaction_reference=${codexReference}`,
      `superseded_interaction_observations=${supersededCodexReferences.join(',')}`,
      'human_target.owner=one-person-lab-app',
      'active_aionui.role=current_implementation_conformance_only',
      'docs_or_contract_imply_source_complete=false',
      'docs_or_contract_imply_pixel_complete=false',
      'ideal_target.workspace_session_rail_default_visible=true',
      'ideal_target.inspector_default_visible=false',
      'ideal_target.permission_access_mode_visible=true',
      'ideal_target.default_third_column_visible=false',
      'ideal_target.advanced_workspace_surfaces=files_changes,preview,terminal,browser',
      'active_aionui.state_source=contracts/app-product-profile.json#gui.home.home_layout',
    ]) {
      requireExactMarkerLine(foundationReadme, marker, foundationDocs.readme, issues);
    }
  }

  const interactionBaseline = record(guiContract.interaction_baseline);
  const currentReference = record(interactionBaseline.current_reference);
  if (
    guiContract.schema_version !== 2 ||
    profile.schema_version !== 2 ||
    pageStateMatrix.schema_version !== 2 ||
    interactionBaseline.schema !== 'opl_app_codex_interaction_baseline.v2' ||
    currentReference.product !== 'ChatGPT Codex macOS' ||
    currentReference.build !== '26.707.41301' ||
    currentReference.observed_on !== '2026-07-11' ||
    currentReference.observation_ref !== 'docs/product/gui/codex-to-opl-app-delta.md#literal-observation-boundary' ||
    currentReference.usage !== 'visual_and_interaction_reference_only_no_code_brand_account_or_authority_copy'
  ) {
    issues.add(`interaction baseline and App authority contracts must use schema v2 with current reference ${codexReference}`);
  }
  const supersededObservations = Array.isArray(interactionBaseline.superseded_observations)
    ? interactionBaseline.superseded_observations.map(record)
    : [];
  for (const build of ['26.707.31428', '26.707.31123']) {
    if (
      !supersededObservations.some(
        (observation) =>
          observation.product === 'ChatGPT Codex macOS' &&
          observation.build === build &&
          observation.observed_on === '2026-07-10' &&
          observation.status === 'superseded_observation_only',
      )
    ) {
      issues.add(`interaction_baseline must retain ${build} only as a superseded observation`);
    }
  }

  const acceptanceBoundary = record(interactionBaseline.acceptance_boundary);
  const historicalPixelShellSha =
    typeof acceptanceBoundary.historical_pixel_shell_sha === 'string'
      ? acceptanceBoundary.historical_pixel_shell_sha
      : '';
  const shellSource = record(shellAdapter.shell_source);
  const guiConformanceRef = String(shellSource.upstream_ref ?? '');
  if (
    acceptanceBoundary.human_target_owner !== 'one-person-lab-app' ||
    acceptanceBoundary.active_shell !== 'aionui' ||
    acceptanceBoundary.active_shell_role !== 'current_implementation_conformance_only' ||
    acceptanceBoundary.docs_or_contract_imply_source_complete !== false ||
    acceptanceBoundary.docs_or_contract_imply_pixel_complete !== false ||
    acceptanceBoundary.docs_or_contract_imply_release_ready !== false ||
    acceptanceBoundary.authority_status !== 'active_mainline_authority' ||
    acceptanceBoundary.shell_implementation_status !== 'current_source_and_historical_pixels_separately_bound' ||
    acceptanceBoundary.source_evidence_status !== 'current_source_gates_passed_ref_in_convergence_plan' ||
    acceptanceBoundary.pixel_evidence_status !==
      'historical_packaged_route_visual_matrix_verified_current_pixels_unverified' ||
    acceptanceBoundary.release_evidence_status !==
      'historical_local_packaged_visual_evidence_complete_release_not_claimed' ||
    acceptanceBoundary.current_source_head_source !== 'active_shell_checkout_git_head' ||
    acceptanceBoundary.current_source_head_must_contain_verified_gui_ancestor !== true ||
    acceptanceBoundary.current_source_evidence_ref !==
      'docs/active/aionui-mainline-gui-convergence-plan.md#当前事实快照' ||
    !/^[0-9a-f]{40}$/.test(historicalPixelShellSha) ||
    acceptanceBoundary.historical_pixel_shell_sha_binding_status !== 'bound_to_exact_historical_evidence' ||
    acceptanceBoundary.pixel_evidence_ref !== 'docs/product/gui/evidence/aionui-41301/manifest.json' ||
    acceptanceBoundary.pixel_evidence_entry_count !== 8 ||
    acceptanceBoundary.historical_pixel_shell_sha_must_not_be_inferred_as_current_source_head !== true
  ) {
    issues.add('interaction baseline must keep the human target separate from source, pixel, and release completion');
  }
  if (
    !/^[0-9a-f]{40}$/.test(guiConformanceRef) ||
    shellSource.upstream_ref_role !== 'minimum_verified_gui_conformance_ancestor' ||
    shellSource.current_head_source !== 'active_shell_checkout_git_head' ||
    shellSource.current_head_must_contain_upstream_ref !== true ||
    shellSource.current_head_must_not_be_copied_into_human_docs !== true
  ) {
    issues.add('active shell adapter must bind a verified GUI ancestor separately from the current shell Git head');
  }
  if (!/^State: `(active_currentness_refresh|release_closeout_in_progress|complete)`$/m.test(convergencePlan)) {
    issues.add('AionUI mainline convergence plan must be in active_currentness_refresh, release_closeout_in_progress, or complete state');
  }
  if (!convergencePlan.includes(guiConformanceRef) || !convergencePlan.includes(historicalPixelShellSha)) {
    issues.add('AionUI mainline convergence plan must bind both the verified GUI ancestor and historical evidence SHA');
  }
  for (const staleMarker of [
    '5204a68d41d799287a4567e61897df3c25345dc4',
    'Machine interaction target | 仍有 `26.707.31428` legacy markers',
    'P0 authority sync 未完成',
    '最多四个 starter',
  ]) {
    if (convergencePlan.includes(staleMarker)) {
      issues.add(`AionUI mainline convergence plan must not retain stale marker: ${staleMarker}`);
    }
  }
  requireExactMarkerLine(
    foundationReadme,
    `active_aionui.gui_conformance_ref=${guiConformanceRef}`,
    foundationDocs.readme,
    issues,
  );
  requireExactMarkerLine(
    foundationReadme,
    'active_aionui.current_shell_head_source=active_shell_checkout_git_head',
    foundationDocs.readme,
    issues,
  );
  requireExactMarkerLine(
    foundationReadme,
    `active_aionui.historical_41301_evidence_sha=${historicalPixelShellSha}`,
    foundationDocs.readme,
    issues,
  );
  const matrixSnapshot = conformanceMatrix.match(/AionUI GUI conformance ancestor：`opl-aion-shell@([0-9a-f]{40})`/);
  if (matrixSnapshot?.[1] !== guiConformanceRef) {
    issues.add('shell conformance matrix GUI conformance ancestor must match the active shell adapter');
  }
  const visualEvidenceEntries = validateVisualEvidence(root, historicalPixelShellSha, issues);

  const literalObservation = record(interactionBaseline.literal_observation);
  const featurePreservation = record(interactionBaseline.feature_preservation_policy);
  const relocationGate = record(featurePreservation.relocation_gate);
  const runtimeSurfaceRoles = record(featurePreservation.runtime_surface_roles);
  const oplTargetTranslation = [
    'navigation_rail',
    'conversation_scope',
    'thread_coordination',
    'home',
    'capability_selection',
    'composer',
    'permission_access_mode',
    'current_task_summary_bar',
    'artifact_preview',
    'context_surfaces',
    'settings_shell',
    'visual_target',
  ];
  if (
    literalObservation.boundary !== 'only_directly_observed_codex_composition_and_interaction_patterns' ||
    !sameStrings(literalObservation.observed_patterns, [
      'conversation_navigation_rail',
      'single_chat_canvas',
      'conversation_header_controls',
      'bottom_composer',
      'on_demand_secondary_surfaces',
      'quiet_dense_visual_hierarchy',
    ]) ||
    !sameStrings(literalObservation.must_not_claim_as_codex_observation, [
      'opl_capability_entries',
      'opl_archived_capabilities_settings_rail_placement',
      'opl_side_panel_tool_taxonomy',
      'opl_runtime_action_receipt_authority',
      'opl_runtime_cross_project_navigation',
      'opl_settings_information_architecture',
    ]) ||
    !sameStrings(interactionBaseline.opl_target_translation, oplTargetTranslation)
  ) {
    issues.add('interaction baseline must separate literal Codex observations from OPL-owned target translation');
  }

  if (
    featurePreservation.authority !== 'opl_product_capability_over_external_reference_parity' ||
    featurePreservation.external_reference_role !== 'placement_and_interaction_reference_only' ||
    !sameStrings(featurePreservation.protected_surfaces, [
      'runtime_cross_project_overview',
      'agent_capabilities',
      'first_run',
      'opl_settings',
      'domain_package_entries',
      'bilingual_ui',
      'cross_top_level_thread_coordination',
    ]) ||
    relocationGate.replacement_reachable_in_same_change !== true ||
    relocationGate.contract_source_tests_updated_together !== true ||
    relocationGate.removal_before_replacement_forbidden !== true ||
    runtimeSurfaceRoles.navigation_runtime !== 'cross_project_work_status_cockpit' ||
    runtimeSurfaceRoles.context_runtime !== 'selected_conversation_or_task_details' ||
    runtimeSurfaceRoles.context_runtime_can_replace_navigation_runtime !== false
  ) {
    issues.add('Codex reference alignment must preserve OPL-owned capabilities and same-change reachability');
  }

  const navigationRail = record(interactionBaseline.navigation_rail);
  const railWidth = record(navigationRail.resizable_width_px);
  const desktopAffordancePolicy = record(navigationRail.desktop_affordance_policy);
  if (
    navigationRail.wide_desktop_default !== 'expanded' ||
    navigationRail.narrow_window_mode !== 'drawer' ||
    railWidth.min !== 280 ||
    railWidth.max !== 340 ||
    !sameStrings(navigationRail.top_entries, ['new_task', 'runtime', 'archived']) ||
    navigationRail.runtime_entry_role !== 'cross_project_work_status_cockpit' ||
    navigationRail.capabilities_mapping !==
      'capability_selection_lives_in_new_task_home_and_capability_management_lives_in_settings_without_a_duplicate_primary_navigation_page' ||
    navigationRail.legacy_capabilities_route !==
      '/capabilities redirects to /guid without deleting capability data or Settings management' ||
    !sameStrings(navigationRail.forbidden_entries_without_opl_product_capability, ['sites', 'chat']) ||
    !sameStrings(navigationRail.bottom_entries, ['account', 'help', 'settings']) ||
    !sameStrings(navigationRail.desktop_affordances, ['back', 'forward', 'previous_task', 'next_task', 'new_window']) ||
    !sameStrings(desktopAffordancePolicy.surfaces, ['application_menu', 'conversation_header']) ||
    desktopAffordancePolicy.keyboard_access_required !== true ||
    desktopAffordancePolicy.unavailable_command_state !== 'disabled' ||
    desktopAffordancePolicy.previous_next_scope !== 'visible_ordinary_conversations' ||
    desktopAffordancePolicy.new_window_scope !== 'desktop_only' ||
    desktopAffordancePolicy.webui_information_architecture_expansion_allowed !== false
  ) {
    issues.add('interaction baseline navigation rail must preserve the governed desktop and narrow-window skeleton');
  }

  const conversationScope = record(interactionBaseline.conversation_scope);
  const threadCoordination = record(interactionBaseline.thread_coordination);
  const sameAgentTreeTransport = record(threadCoordination.same_agent_tree_transport);
  const threadDispatchPolicy = record(threadCoordination.dispatch_policy);
  const homeTarget = record(interactionBaseline.home);
  const capabilitySelection = record(interactionBaseline.capability_selection);
  const composerTarget = record(interactionBaseline.composer);
  const projectContextInputs = record(conversationScope.project_context_inputs);
  const permissionTarget = record(interactionBaseline.permission_access_mode);
  const taskSummaryTarget = record(interactionBaseline.current_task_summary_bar);
  const mobileActionSheet = record(composerTarget.mobile_action_sheet);
  if (
    conversationScope.project_task_supported !== true ||
    conversationScope.projectless_conversation_supported !== true ||
    conversationScope.text_chat_without_workspace !== 'available' ||
    conversationScope.file_and_project_features_without_workspace !== 'restricted_with_explanation' ||
    !sameStrings(conversationScope.conversation_management, ['search', 'pin', 'rename', 'archive', 'reset']) ||
    conversationScope.archived_surface !== 'independent' ||
    projectContextInputs.scope !== 'canonical_workspace_path' ||
    projectContextInputs.optional !== true ||
    projectContextInputs.item_kind !== 'workspace_file_or_directory_ref' ||
    !sameStrings(projectContextInputs.mutations, ['add', 'remove']) ||
    projectContextInputs.persistence !== 'shell_client_configuration_keyed_by_workspace' ||
    projectContextInputs.management_surface !== 'navigation_rail_project' ||
    projectContextInputs.composer_consumption !== 'send_scoped_removable_refs' ||
    projectContextInputs.composer_persistence_after_send !== 'none' ||
    projectContextInputs.fabricated_defaults_allowed !== false ||
    projectContextInputs.artifact_body_copy_allowed !== false ||
    homeTarget.title_policy !== 'dynamic_question_title' ||
    homeTarget.starter_limit !== null ||
    homeTarget.starter_visibility_policy !== 'all_user_visible_configured_shortcuts' ||
    homeTarget.starter_order_policy !== 'stable_configured_order' ||
    homeTarget.starter_layout_policy !== 'responsive_wrap' ||
    homeTarget.starter_truncation_allowed !== false ||
    record(homeTarget.workspace_selector_policy).primary_scope !== 'active_workspace_only' ||
    record(homeTarget.workspace_selector_policy).inactive_recent_directories_visible !== false ||
    record(homeTarget.workspace_selector_policy).management_entry !== 'registered_directories_modal' ||
    record(homeTarget.workspace_selector_policy).management_scope !== 'registered_workspaces' ||
    record(homeTarget.workspace_selector_policy).unregister_effect !== 'remove_registration_only' ||
    record(homeTarget.workspace_selector_policy).filesystem_delete_allowed !== false ||
    record(homeTarget.workspace_selector_policy).active_conversation_change_on_unregister !== false ||
    record(homeTarget.home_shortcut_mutation_policy).pending_scope !== 'single_shortcut' ||
    record(homeTarget.home_shortcut_mutation_policy).pending_key !== 'shortcut_id' ||
    record(homeTarget.home_shortcut_mutation_policy).other_shortcuts_remain_interactive !== true ||
    record(homeTarget.home_shortcut_mutation_policy).readback_mode !== 'background_no_page_loading' ||
    !sameStrings(capabilitySelection.selection_surfaces, ['home_starter']) ||
    capabilitySelection.management_surface !== 'settings_capabilities' ||
    capabilitySelection.legacy_route_policy !== '/capabilities_redirects_to_home_without_mounting_a_selection_page' ||
    capabilitySelection.composer_persistent_variable_selector !== false ||
    capabilitySelection.composer_context_surface !== 'active_capability_chip' ||
    composerTarget.placement !== 'floating_bottom_with_safe_inset' ||
    !sameStrings(composerTarget.persistent_context, ['active_capability']) ||
    !sameStrings(composerTarget.send_scoped_inputs, ['attachments', 'project_refs']) ||
    composerTarget.send_scoped_consumption_policy !== 'consumed_by_current_send_not_persisted_in_context_strip' ||
    !sameStrings(composerTarget.forbidden_persistent_context, [
      'project',
      'workspace',
      'locality',
      'branch',
      'attachments',
      'project_refs',
    ]) ||
    !sameStrings(composerTarget.desktop_action_row, ['attach', 'permission_access_mode', 'model_reasoning', 'send_stop']) ||
    !sameStrings(mobileActionSheet.allowed_actions, [
      'attach',
      'project_refs',
      'permission_access_mode',
      'model_reasoning',
      'active_capability',
    ]) ||
    !sameStrings(mobileActionSheet.forbidden_actions, ['backend', 'provider', 'team', 'raw_mcp', 'arbitrary_skills']) ||
    mobileActionSheet.send_stop_location !== 'composer_primary_action_outside_sheet' ||
    composerTarget.model_reasoning_control !== 'single_compact_menu' ||
    !sameStrings(permissionTarget.visible_on, ['home_composer', 'conversation_composer']) ||
    permissionTarget.provider_or_backend_terms_visible !== false ||
    taskSummaryTarget.placement !== 'message_timeline' ||
    taskSummaryTarget.single_instance !== true ||
    taskSummaryTarget.default_mode !== 'inline_unpinned' ||
    !sameStrings(taskSummaryTarget.sticky_when, ['user_pinned', 'long_running_true']) ||
    taskSummaryTarget.ordinary_task_sticky !== false ||
    taskSummaryTarget.long_running_signal_field !== 'long_running' ||
    taskSummaryTarget.duplicate_surface_allowed !== false ||
    !sameStrings(taskSummaryTarget.fields, ['status', 'elapsed', 'progress', 'next_action', 'stop'])
  ) {
    issues.add('interaction baseline Home, conversation, composer, access, and task summary markers must match the App target');
  }

  const pageStates = Array.isArray(pageStateMatrix.pages) ? pageStateMatrix.pages.map(record) : [];
  const threadCoordinationPage = pageStates.find((page) => page.id === 'thread_coordination') ?? {};
  const coordinationViewModel = record(record(threadCoordinationPage).coordination_view_model);
  const requiredThreadFields = [
    'thread_id',
    'status',
    'summary',
    'project',
    'workspace',
    'host',
    'owner',
    'goal',
    'parent_thread_id',
    'ancestor_thread_ids',
    'active_turn_id',
    'write_set',
  ];
  const coordinationSafetyGates = [
    'permission_check',
    'idempotency_key_and_duplicate_message_check',
    'delegation_cycle_check',
    'project_and_workspace_scope_check',
    'concurrent_write_set_conflict_check',
  ];
  const coordinationAuditFields = [
    'delivery_id',
    'source_thread_id',
    'target_thread_id',
    'sender',
    'reason',
    'message_summary',
    'protocol_method',
    'permission_decision',
    'write_set_decision',
    'status',
    'result_summary',
    'created_at',
    'completed_at',
  ];
  const coordinationStates = [
    'loading',
    'ready',
    'empty',
    'offline',
    'permission_denied',
    'duplicate_rejected',
    'loop_rejected',
    'scope_mismatch',
    'write_set_conflict',
    'stale_status',
    'dispatch_running',
    'dispatch_completed',
    'dispatch_failed',
  ];
  if (
    threadCoordination.product_role !== 'opl_host_cross_top_level_codex_thread_coordination' ||
    threadCoordination.entry_surface !== 'model_and_host_tool_only_no_ordinary_navigation' ||
    threadCoordination.ordinary_navigation_visible !== false ||
    threadCoordination.model_tool_access !== true ||
    threadCoordination.default_state !== 'not_mounted_for_ordinary_users' ||
    threadCoordination.model_role !== 'decide_when_and_why_to_coordinate' ||
    threadCoordination.protocol_owner !== 'codex_core_app_server' ||
    threadCoordination.app_host_owner !== 'opl_app_host' ||
    threadCoordination.thread_store_owner !== 'codex_core_app_server' ||
    sameAgentTreeTransport.scope !== 'same_agent_tree_only' ||
    !sameStrings(sameAgentTreeTransport.methods, ['spawn_agent', 'send_input', 'wait_agent']) ||
    sameAgentTreeTransport.cross_top_level_use_forbidden !== true ||
    !sameStrings(threadCoordination.cross_top_level_protocol, [
      'thread/list',
      'thread/read',
      'thread/resume',
      'thread/fork',
      'thread/archive',
      'turn/start',
      'turn/steer',
    ]) ||
    !sameStrings(threadCoordination.required_thread_fields, requiredThreadFields) ||
    !sameStrings(threadCoordination.thread_actions, ['read', 'resume', 'fork', 'archive']) ||
    threadDispatchPolicy.idle_thread !== 'turn/start' ||
    threadDispatchPolicy.running_thread !== 'turn/steer' ||
    threadDispatchPolicy.unknown_or_stale_status !== 'refresh_then_fail_closed' ||
    threadDispatchPolicy.explicit_user_confirmation_when_scope_or_permission_changes !== true ||
    !sameStrings(threadCoordination.safety_gates, coordinationSafetyGates) ||
    !sameStrings(threadCoordination.required_states, coordinationStates) ||
    !sameStrings(threadCoordination.audit_fields, coordinationAuditFields) ||
    threadCoordination.user_visibility_policy !==
      'sender_target_reason_message_result_and_safety_decisions_visible_and_auditable' ||
    !sameStrings(threadCoordination.forbidden_implementations, [
      'send_input_as_cross_top_level_message_bus',
      'shell_owned_duplicate_thread_store',
      'model_generated_thread_id',
      'silent_cross_project_dispatch',
      'dispatch_without_write_set_check',
      'unbounded_delegation_loop',
    ]) ||
    coordinationViewModel.product_role !== threadCoordination.product_role ||
    coordinationViewModel.entry_surface !== threadCoordination.entry_surface ||
    coordinationViewModel.ordinary_navigation_visible !== false ||
    coordinationViewModel.model_tool_access !== true ||
    coordinationViewModel.default_state !== 'not_mounted_for_ordinary_users' ||
    coordinationViewModel.thread_list_protocol !== 'thread/list' ||
    coordinationViewModel.thread_read_protocol !== 'thread/read' ||
    !sameStrings(coordinationViewModel.thread_actions, ['thread/resume', 'thread/fork', 'thread/archive']) ||
    coordinationViewModel.idle_dispatch_protocol !== 'turn/start' ||
    coordinationViewModel.running_dispatch_protocol !== 'turn/steer' ||
    !sameStrings(coordinationViewModel.required_thread_fields, requiredThreadFields) ||
    !sameStrings(coordinationViewModel.safety_gates, coordinationSafetyGates) ||
    !sameStrings(coordinationViewModel.required_states, coordinationStates) ||
    !sameStrings(coordinationViewModel.user_visible_audit_fields, [
      'sender',
      'source_thread_id',
      'target_thread_id',
      'reason',
      'message_summary',
      'protocol_method',
      'permission_decision',
      'write_set_decision',
      'status',
      'result_summary',
    ]) ||
    coordinationViewModel.unknown_or_stale_status_policy !== 'refresh_then_fail_closed' ||
    coordinationViewModel.same_agent_tree_api_boundary !== 'spawn_agent_send_input_wait_agent_same_tree_only'
  ) {
    issues.add('cross-top-level thread coordination must use Codex App Server thread/turn protocols with OPL host safety and audit gates');
  }

  const contextSurfaces = record(interactionBaseline.context_surfaces);
  const artifactPreview = record(interactionBaseline.artifact_preview);
  const ordinaryConversationPage = pageStates.find((page) => page.id === 'ordinary_conversation') ?? {};
  const ordinaryConversationViewModel = record(record(ordinaryConversationPage).conversation_view_model);
  const pageArtifactPreview = record(ordinaryConversationViewModel.artifact_preview);
  const conversationArtifactPreview = record(record(guiContract.ordinary_conversation).artifact_preview);
  const environmentPopover = record(contextSurfaces.environment_popover);
  const sidePanel = record(contextSurfaces.side_panel);
  const settingsShell = record(interactionBaseline.settings_shell);
  const visualTarget = record(interactionBaseline.visual_target);
  const targetDefinitionRole = 'opl_target_translation_not_literal_codex_observation';
  if (oplTargetTranslation.some((key) => record(interactionBaseline[key]).definition_role !== targetDefinitionRole)) {
    issues.add('each OPL target translation section must declare that it is not a literal Codex observation');
  }
  if (
    artifactPreview.surface !== 'existing_aionui_preview_context_and_panel' ||
    !sameStrings(artifactPreview.entry_sources, [
      'current_task_latest_artifact_ref',
      'current_task_evidence_ref',
      'environment_artifact_ref',
      'conversation_file_or_result_ref',
    ]) ||
    !sameStrings(artifactPreview.supported_content_types, ['markdown', 'pdf', 'code', 'image', 'html', 'diff']) ||
    !sameStrings(artifactPreview.markdown_embedded_renderers, ['mermaid', 'katex', 'code']) ||
    artifactPreview.ref_resolution_policy !==
      'canonical_workspace_file_ref_to_existing_preview_target_without_copying_artifact_body' ||
    artifactPreview.artifact_body_authority !== 'external_owner_ref_only' ||
    artifactPreview.keyboard_reachable_open_action !== true ||
    artifactPreview.failure_policy !== 'keep_ref_visible_and_fail_closed_with_reason' ||
    artifactPreview.unsafe_or_unsupported_ref_policy !== 'do_not_open_or_guess_content' ||
    JSON.stringify(pageArtifactPreview) !== JSON.stringify({
      surface: artifactPreview.surface,
      entry_sources: artifactPreview.entry_sources,
      supported_content_types: artifactPreview.supported_content_types,
      markdown_embedded_renderers: artifactPreview.markdown_embedded_renderers,
      ref_resolution_policy: artifactPreview.ref_resolution_policy,
      artifact_body_authority: artifactPreview.artifact_body_authority,
      keyboard_reachable_open_action: artifactPreview.keyboard_reachable_open_action,
      failure_policy: artifactPreview.failure_policy,
      unsafe_or_unsupported_ref_policy: artifactPreview.unsafe_or_unsupported_ref_policy,
    }) ||
    JSON.stringify(conversationArtifactPreview) !== JSON.stringify(pageArtifactPreview)
  ) {
    issues.add('artifact preview must reuse the existing Preview surface through a ref-only fail-closed adapter');
  }
  if (
    !sameStrings(environmentPopover.primary_fields, ['workspace', 'locality', 'branch', 'changes', 'subtasks', 'sources']) ||
    !sameStrings(environmentPopover.secondary_ref_fields, ['artifact_refs', 'evidence_refs', 'receipt_refs']) ||
    environmentPopover.render_policy !== 'real_non_empty_values_only' ||
    sidePanel.default_state !== 'closed' ||
    sidePanel.default_third_column_visible !== false ||
    sidePanel.workspace_surface !== 'files_changes' ||
    sidePanel.preview_surface !== 'independent' ||
    sidePanel.terminal_browser_entry_policy !== 'environment_or_task_need_only' ||
    sidePanel.equal_weight_tool_taxonomy_allowed !== false ||
    sidePanel.runtime_duplicate_allowed !== false ||
    'primary_tools' in sidePanel ||
    'secondary_sections' in sidePanel ||
    !sameStrings(sidePanel.legacy_taxonomy_ids_forbidden, [
      'review',
      'terminal',
      'browser',
      'files',
      'artifacts',
      'runtime',
      'actions',
      'memory',
    ]) ||
    !sameStrings(contextSurfaces.advanced_work_surfaces, ['files_changes', 'preview', 'terminal', 'browser']) ||
    contextSurfaces.advanced_work_surfaces_default !== 'closed' ||
    settingsShell.frame !== 'codex_full_window_return_search_grouped_rows' ||
    settingsShell.information_architecture !== 'existing_opl_settings_ia_unchanged' ||
    settingsShell.role !== 'maintenance_only' ||
    settingsShell.home_or_conversation_structure_authority !== false ||
    settingsShell.settings_objects_or_model_policy_changed_by_41301 !== false ||
    settingsShell.installer_or_runtime_truth_authority !== false ||
    visualTarget.main_canvas !== 'white' ||
    visualTarget.rail_and_subtle_surfaces !== 'neutral_gray' ||
    visualTarget.opl_teal_and_brand_retained !== true
  ) {
    issues.add('interaction baseline must reject the legacy equal-weight inspector taxonomy and keep Settings in maintenance');
  }

  const pageStateBoundary = record(pageStateMatrix.acceptance_boundary);
  if (
    pageStateMatrix.interaction_baseline_ref !== 'contracts/app-gui-product-contract.json#interaction_baseline' ||
    pageStateBoundary.human_target_owner !== 'one-person-lab-app' ||
    pageStateBoundary.active_aionui_role !== 'current_implementation_conformance_only' ||
    pageStateBoundary.contract_target_implies_source_complete !== false ||
    pageStateBoundary.contract_target_implies_pixel_complete !== false ||
    pageStateBoundary.contract_target_implies_release_complete !== false ||
    pageStateBoundary.authority_status !== 'active_mainline_authority' ||
    pageStateBoundary.shell_implementation_status !== 'current_source_and_historical_pixels_separately_bound' ||
    pageStateBoundary.current_source_head_source !== 'active_shell_checkout_git_head' ||
    pageStateBoundary.current_source_head_must_contain_verified_gui_ancestor !== true ||
    pageStateBoundary.current_source_evidence_ref !==
      'docs/active/aionui-mainline-gui-convergence-plan.md#当前事实快照' ||
    pageStateBoundary.historical_pixel_shell_sha !== historicalPixelShellSha ||
    pageStateBoundary.historical_pixel_shell_sha_binding_status !== 'bound_to_exact_historical_evidence' ||
    pageStateBoundary.pixel_evidence_ref !== 'docs/product/gui/evidence/aionui-41301/manifest.json'
  ) {
    issues.add('page-state acceptance boundary must keep human target separate from source and pixel completion');
  }

  const nativeShape = record(nativeCandidate.target_product_shape);
  const nativeVisualContract = record(nativeCandidate.visual_parity_contract);
  const stateBoundary = record(governance.state_boundary);
  const idealTarget = record(stateBoundary.ideal_target);
  if (nativeShape.workspace_session_rail_default_visible !== true || idealTarget.workspace_session_rail_default_visible !== true) {
    issues.add('native candidate and ideal target must keep the desktop workspace/session rail visible');
  }
  if (nativeShape.inspector_default_visible !== false || idealTarget.inspector_default_visible !== false) {
    issues.add('native candidate and ideal target must keep the inspector closed by default');
  }
  if (
    idealTarget.owner !== 'one-person-lab-app' ||
    idealTarget.authority !== 'app_product_and_visual_system' ||
    idealTarget.conformance_direction !== 'ideal_target_to_shells' ||
    'source_candidate' in idealTarget
  ) {
    issues.add('ideal target must be App-owned and flow one-way to shells without a source candidate');
  }

  const profileGui = record(profile.gui);
  const profileHome = record(profileGui.home);
  const homeLayout = record(profileHome.home_layout);
  const activeConversation = record(profileGui.ordinary_conversation);
  const activeInspector = record(profileGui.right_context_inspector);
  const activeAionui = record(stateBoundary.active_aionui);
  const activeRailState = homeLayout.workspace_session_rail_default_state;
  const activeInspectorState = homeLayout.right_context_inspector_default_state;
  const allowedActiveRailStates = ['collapsed', 'visible_wide_drawer_narrow'];
  const allowedActiveInspectorStates = ['collapsed', 'visible'];
  if (!allowedActiveRailStates.includes(String(activeRailState))) {
    issues.add('active AionUI rail state must be collapsed or visible_wide_drawer_narrow in app-product-profile');
  }
  if (!allowedActiveInspectorStates.includes(String(activeInspectorState))) {
    issues.add('active AionUI inspector state must be collapsed or visible in app-product-profile');
  }
  if (activeAionui.source !== 'contracts/app-product-profile.json#gui.home.home_layout') {
    issues.add('active AionUI state must source app-product-profile gui.home.home_layout');
  }
  if (activeAionui.conformance_policy !== 'read_current_profile_state_and_compare_to_ideal_without_freezing_values') {
    issues.add('active AionUI conformance policy must compare current profile state to ideal without freezing values');
  }
  if (JSON.stringify(Object.keys(activeAionui).sort()) !== JSON.stringify(['conformance_policy', 'source'])) {
    issues.add('active AionUI governance must store only source and conformance_policy');
  }
  const railMatchesIdeal =
    activeRailState === (idealTarget.workspace_session_rail_default_visible ? 'visible_wide_drawer_narrow' : 'collapsed');
  const inspectorMatchesIdeal = activeInspectorState === (idealTarget.inspector_default_visible ? 'visible' : 'collapsed');
  const permissionAccessModeMatchesIdeal =
    profileHome.permission_mode_selector_visible === true &&
    profileHome.conversation_permission_mode_selector_visible === true &&
    activeConversation.permission_mode_selector_visible === true;
  const sidePanelInformationArchitectureMatchesIdeal =
    activeInspector.surface_kind === 'on_demand_workspace_surface' &&
    activeInspector.default_third_column_visible === false &&
    record(activeInspector.workspace_surface).id === 'files_changes' &&
    record(activeInspector.preview_surface).id === 'preview' &&
    record(activeInspector.preview_surface).independent === true &&
    sameStrings(record(record(activeInspector.on_demand_task_tools).terminal).entry_points, ['environment', 'task_need']) &&
    sameStrings(record(record(activeInspector.on_demand_task_tools).browser).entry_points, ['environment', 'task_need']) &&
    activeInspector.equal_weight_tool_taxonomy_allowed === false &&
    activeInspector.runtime_duplicate_allowed === false &&
    !('primary_tools' in activeInspector) &&
    !('secondary_sections' in activeInspector) &&
    !('tabs' in activeInspector);
  requireAionuiContractStatus(conformanceMatrix, '宽桌面 rail 默认展开且 `280-340px` 可调', conformanceStatus(railMatchesIdeal), issues);
  requireAionuiContractStatus(
    conformanceMatrix,
    'Permission/access mode 在 composer 可见且不用 backend/provider 术语',
    conformanceStatus(permissionAccessModeMatchesIdeal),
    issues,
  );
  const codex = record(profile.codex);
  const defaultModel = typeof codex.default_model === 'string' ? codex.default_model : '';
  const defaultReasoningEffort = typeof codex.default_reasoning_effort === 'string' ? codex.default_reasoning_effort : '';
  if (!defaultModel || !defaultReasoningEffort) {
    issues.add('app-product-profile Codex defaults must be non-empty strings');
  }
  if (nativeVisualContract.default_model !== defaultModel || nativeVisualContract.default_reasoning_effort !== defaultReasoningEffort) {
    issues.add('native candidate model defaults must derive from app-product-profile');
  }
  const mentionedModels = new Set((governedText.match(/\bgpt-[a-z0-9.-]+\b/gi) ?? []).map((value) => value.toLowerCase()));
  for (const model of mentionedModels) {
    if (model !== defaultModel) {
      issues.add(`governed GUI docs must not copy model catalogs or name non-default model ${model}`);
    }
  }
  const readinessText = [governedText, agents, decisions, invariants, candidateDoc].join('\n');
  const positiveReadinessClaims = [
    /\b(?:release|production)[_ -]ready\s*[:=]\s*(?:true|yes)\b/i,
    /\b(?:candidate|shell|app)\s+(?:is|are)\s+(?!not\b)(?:release|production)[ -]ready\b/i,
  ];
  if (positiveReadinessClaims.some((pattern) => pattern.test(readinessText))) {
    issues.add('governed GUI docs must not make a positive release or production readiness claim');
  }

  const codexGovernance = record(governance.codex_reference);
  const nativeCandidateReference =
    typeof nativeVisualContract.comparison_baseline === 'string' ? nativeVisualContract.comparison_baseline : '';
  if (![codexReference, ...supersededCodexReferences].includes(String(codexGovernance.comparison_baseline))) {
    issues.add(`candidate registry Codex comparison baseline must be current or a declared superseded observation`);
  }
  if (![codexReference, ...supersededCodexReferences].includes(nativeCandidateReference)) {
    issues.add(`native candidate Codex comparison baseline must be ${codexReference} or a declared superseded observation`);
  }
  if (
    supersededCodexReferences.includes(nativeCandidateReference) &&
    nativeVisualContract.current_reference_status !== 'superseded_reference_candidate_deviation'
  ) {
    issues.add('native candidate must explicitly declare its superseded Codex reference as a candidate deviation');
  }
  if (
    codexGovernance.source_usage !== 'visual_and_interaction_reference_only_no_code_or_brand_copy' ||
    nativeVisualContract.source_usage !== codexGovernance.source_usage
  ) {
    issues.add('Codex comparison baseline must remain a visual/interaction reference only');
  }

  const evidenceBoundary = record(governance.evidence_boundary);
  if (
    evidenceBoundary.validation_scope !== 'design_system_governance_consistency_only' ||
    evidenceBoundary.docs_or_visual_qa_can_claim_release_ready !== false ||
    evidenceBoundary.pixel_verified_implies_visual_parity !== false ||
    evidenceBoundary.pixel_verified_implies_release_ready !== false ||
    nativeVisualContract.docs_or_contract_only_completion_allowed !== false
  ) {
    issues.add('design-system validation and visual/docs evidence must not claim release readiness');
  }

  const scripts = record(packageJson.scripts);
  if (scripts['validate:gui-design-system'] !== 'node --experimental-strip-types scripts/validate-gui-design-system.ts') {
    issues.add('package.json must expose validate:gui-design-system');
  }
  if (
    typeof scripts['validate:shell-convergence'] !== 'string' ||
    !scripts['validate:shell-convergence'].includes('npm run validate:gui-design-system')
  ) {
    issues.add('validate:shell-convergence must include validate:gui-design-system');
  }

  if (issues.size > 0) {
    throw new Error(`GUI design system validation failed:\n- ${[...issues].join('\n- ')}`);
  }

  return {
    schema: 'opl_app_gui_design_system_validation.v1',
    status: 'consistent',
    root,
    definition_stack: expectedStack.map((layer) => layer.id),
    shell_roles: {
      active: 'aionui',
      foreground: 'opl-native-workbench',
      retained: 'hermes-codex',
      archived: 'agui-codex',
    },
    codex_reference: codexReference,
    superseded_codex_reference: supersededCodexReference,
    reference_boundary: {
      app_contract_status: 'aligned_contract',
      page_state_status: 'aligned_contract',
      native_candidate_reference: nativeCandidateReference,
      native_candidate_status: conformanceStatus(nativeCandidateReference === codexReference),
    },
    model_defaults: {
      model: defaultModel,
      reasoning_effort: defaultReasoningEffort,
    },
    state_boundary: {
      ideal_native_rail_visible: true,
      ideal_native_inspector_visible: false,
      active_aionui_rail_state: activeRailState as ActiveSurfaceState,
      active_aionui_inspector_state: activeInspectorState as ActiveSurfaceState,
      active_aionui_conformance: {
        rail_matches_ideal: railMatchesIdeal,
        inspector_matches_ideal: inspectorMatchesIdeal,
        rail_status: conformanceStatus(railMatchesIdeal),
        inspector_status: conformanceStatus(inspectorMatchesIdeal),
        permission_access_mode_status: conformanceStatus(permissionAccessModeMatchesIdeal),
        side_panel_information_architecture_status: conformanceStatus(sidePanelInformationArchitectureMatchesIdeal),
      },
    },
    evidence_scope: 'design_system_governance_consistency_only',
    conformance_matrix: {
      rows_validated: conformanceRowsValidated,
      status_axes: ['contract_status', 'source_status', 'pixel_status'],
      pixel_verified_implies_visual_parity: false,
    },
    visual_evidence: {
      manifest: 'docs/product/gui/evidence/aionui-41301/manifest.json',
      shell_head: historicalPixelShellSha,
      entries_verified: visualEvidenceEntries as 8,
      packaged_command: true,
    },
    release_ready: false,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(validateGuiDesignSystem(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
