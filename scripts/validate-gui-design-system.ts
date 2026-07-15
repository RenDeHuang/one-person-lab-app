#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  appOwnedDirectoryGroupPolicy,
  appOwnedExplicitSessionInputPolicy,
  appOwnedGuiContractEnvironmentWorkspaceHandoff,
  appOwnedLocalWorktreeLifecycle,
  appOwnedNewTaskLocality,
  appOwnedPageStateEnvironmentWorkspaceHandoff,
  appOwnedSessionWorkspaceModel,
} from './validate-active-shell/app-contract-constants.ts';

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
  const ancestorMatch = text.match(/AionUI GUI conformance ancestor：`opl-aion-shell@([0-9a-f]{40})`/);
  if (!ancestorMatch) {
    issues.add('shell conformance matrix must bind an exact 40-character AionUI GUI conformance ancestor');
    return;
  }
  const currentSourceMatch = text.match(/Current Shell source cohort：symbolic `([a-z0-9_]+)`/);
  if (!currentSourceMatch || currentSourceMatch[1] !== 'session_first_directory_current_source_cohort') {
    issues.add('shell conformance matrix must use the symbolic current Shell source cohort without pinning a transient HEAD');
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
    if (!/^[0-9a-f]{40}$/.test(currentHead)) {
      issues.add('active AionUI current source checkout must resolve a 40-character Git HEAD');
    }
  } catch (error) {
    issues.add(`unable to read active AionUI current source checkout: ${error instanceof Error ? error.message : String(error)}`);
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

  const maintenancePolicy = record(guiContract.gui_maintenance_policy);
  const maintenanceGoal = record(maintenancePolicy.goal);
  const referencePromotion = record(maintenancePolicy.codex_reference_promotion);
  const upstreamFollowing = record(maintenancePolicy.aionui_upstream_following);
  const classificationMeanings = record(upstreamFollowing.classification_meanings);
  const maintenanceBudgets = record(maintenancePolicy.maintenance_budgets);
  const auditBaseline = record(maintenanceBudgets.audit_baseline);
  const codexOverlayBudget = record(maintenanceBudgets.codex_overlay);
  const visualComparison = record(maintenancePolicy.visual_comparison_protocol);
  const maintenancePolicyRef = 'docs/product/gui/gui-maintenance-policy.md';
  if (
    maintenancePolicy.schema !== 'opl_app_gui_maintenance_policy.v1' ||
    maintenancePolicy.owner !== 'one-person-lab-app' ||
    maintenancePolicy.human_policy_ref !== maintenancePolicyRef ||
    !fs.existsSync(path.join(root, maintenancePolicyRef)) ||
    maintenanceGoal.upstream_following !== 'aionui_stable_tags_through_bounded_selective_intake' ||
    maintenanceGoal.visual_alignment !== 'versioned_chatgpt_codex_reference_cohorts_with_explicit_opl_deltas' ||
    maintenanceGoal.one_to_one_claim_policy !== 'scene_bound_comparison_only_never_unqualified_product_wide_claim' ||
    referencePromotion.active_reference_ref !==
      'contracts/app-gui-product-contract.json#interaction_baseline.current_reference' ||
    !sameStrings(referencePromotion.required_evidence, [
      'exact_reference_product_build_and_observation_date',
      'literal_observation_notes_and_reference_screenshots',
      'contract_delta_classification',
      'protected_opl_surface_non_regression_review',
      'desktop_and_narrow_light_dark_zh_en_comparison_manifest',
    ]) ||
    referencePromotion.promotion_gate !== 'all_required_evidence_present_and_app_gui_validator_passes' ||
    referencePromotion.supersession_policy !==
      'previous_active_reference_moves_to_interaction_baseline.superseded_observations' ||
    referencePromotion.release_independence !== true
  ) {
    issues.add('GUI maintenance policy must version Codex reference promotion without implying release completion');
  }
  if (
    upstreamFollowing.channel !== 'stable_tags_only' ||
    !sameStrings(upstreamFollowing.required_release_metadata, [
      'tag',
      'commit',
      'published_at',
      'draft',
      'prerelease',
    ]) ||
    upstreamFollowing.draft_or_prerelease_policy !== 'reject_as_intake_target' ||
    !sameStrings(upstreamFollowing.classifications, ['accept', 'adapt', 'redirect', 'reject']) ||
    classificationMeanings.accept !== 'reuse_without_changing_app_product_authority' ||
    classificationMeanings.adapt !== 'reuse_through_app_contract_profile_bridge_or_overlay' ||
    classificationMeanings.redirect !== 'preserve_compatibility_but_route_to_app_owned_surface' ||
    classificationMeanings.reject !== 'do_not_expose_or_absorb_into_ordinary_app_behavior' ||
    upstreamFollowing.intake_gate !==
      'read_release_metadata_then_measure_divergence_and_overlap_then_classify_then_run_focused_and_active_shell_gates' ||
    upstreamFollowing.broad_history_merge_as_default !== false ||
    upstreamFollowing.reviewed_does_not_mean_absorbed !== true
  ) {
    issues.add('GUI maintenance policy must follow stable AionUI tags through classified selective intake');
  }
  if (
    auditBaseline.shell_ref !== '772dd1ef7226fd028bd2c9768a2e66c5e83d3f89' ||
    auditBaseline.upstream_tag !== 'v2.1.34' ||
    auditBaseline.upstream_ref !== '0fea1eb82634f3746b9ccf68507277c347fa08a3' ||
    auditBaseline.merge_base !== '70974c59a275e565e8fc2bd7ecaf2dcac74227f0' ||
    auditBaseline.upstream_only_commits !== 184 ||
    auditBaseline.shell_only_commits !== 5516 ||
    auditBaseline.shell_changed_files !== 802 ||
    auditBaseline.overlap_files !== 342 ||
    auditBaseline.renderer_overlap_files !== 223 ||
    maintenanceBudgets.overlap_growth_policy !== 'fail_until_intentionally_reviewed_and_rebaselined' ||
    maintenanceBudgets.maximum_overlap_file_growth !== 0 ||
    maintenanceBudgets.maximum_renderer_overlap_file_growth !== 0 ||
    codexOverlayBudget.important_declarations !== 105 ||
    codexOverlayBudget.selector_blocks !== 52 ||
    codexOverlayBudget.growth_policy !== 'no_growth_without_app_authorized_exception'
  ) {
    issues.add('GUI maintenance policy must bind measured upstream overlap and non-growing Codex overlay budgets');
  }
  if (
    visualComparison.schema !== 'opl_app_gui_visual_comparison.v1' ||
    !sameStrings(visualComparison.required_binding_fields, [
      'reference_product_build',
      'reference_observed_at',
      'app_contract_ref',
      'shell_commit',
      'package_or_dev_build_identity',
      'os_version',
      'architecture',
      'display_scale',
      'viewport',
      'theme',
      'locale',
      'route',
      'state',
      'reference_screenshot_sha256',
      'candidate_screenshot_sha256',
    ]) ||
    !sameStrings(visualComparison.comparison_modes, [
      'side_by_side_human_review',
      'pixel_diff_with_declared_masks_and_thresholds',
    ]) ||
    !sameStrings(visualComparison.required_claims, ['scene_compared', 'layout_checked', 'visual_delta_reviewed']) ||
    !sameStrings(visualComparison.forbidden_inferences, [
      'product_wide_one_to_one',
      'release_ready',
      'installed_current',
      'upstream_absorbed',
    ])
  ) {
    issues.add('GUI maintenance visual comparison must bind exact cohorts and keep parity claims scene-scoped');
  }

  const settingsNavigation = record(guiContract.settings_navigation);
  const returnToApp = record(settingsNavigation.return_to_app);
  const footerUpdateEntry = record(settingsNavigation.footer_update_entry);
  const themeAndBranding = record(guiContract.theme_and_branding);
  const appearanceMode = record(themeAndBranding.appearance_mode);
  const settingsShellNavigation = record(pageStateMatrix.settings_shell_navigation);
  const settingsShellRequiredDom = record(settingsShellNavigation.required_dom);
  const settingsFooterUpdate = record(settingsShellNavigation.footer_update_entry);
  const settingsAppearanceMode = record(settingsShellNavigation.appearance_mode);
  if (
    returnToApp.label_zh !== '返回应用' ||
    returnToApp.label_en !== 'Back to app' ||
    returnToApp.placement !== 'top_titlebar_history_back_desktop_and_titlebar_back_narrow' ||
    returnToApp.destination_source !== 'desktop_navigation_history_or_last_valid_non_settings_location' ||
    returnToApp.session_storage_key !== 'aion:last-non-settings-path' ||
    returnToApp.preserve_search_and_hash !== true ||
    returnToApp.settings_destination_forbidden !== true ||
    returnToApp.fallback_path !== '/guid' ||
    returnToApp.keyboard_reachable !== true ||
    returnToApp.desktop_behavior !== 'existing_top_titlebar_history_back' ||
    returnToApp.narrow_window_behavior !==
      'existing_titlebar_return_action_uses_last_valid_non_settings_destination_resolver' ||
    returnToApp.settings_sider_entry !== 'forbidden' ||
    settingsShellNavigation.product_contract_ref !==
      'contracts/app-gui-product-contract.json#settings_navigation.return_to_app' ||
    !sameStrings(settingsShellRequiredDom.expanded, ['settings-titlebar-history-back', 'settings-search-input']) ||
    !sameStrings(settingsShellRequiredDom.collapsed, ['settings-titlebar-history-back']) ||
    !sameStrings(settingsShellRequiredDom.narrow, ['settings-titlebar-back-to-app']) ||
    !sameStrings(settingsShellNavigation.forbidden_dom, ['settings-back-to-app']) ||
    settingsShellNavigation.destination_behavior !==
      'desktop_titlebar_history_back_or_narrow_last_valid_non_settings_location_preserving_search_and_hash_else_guid' ||
    settingsShellNavigation.keyboard_reachable !== true ||
    settingsShellNavigation.settings_sider_return_forbidden !== true
  ) {
    issues.add('Settings shell must keep Back to app in the top titlebar and forbid a duplicate Settings-sider entry');
  }
  if (
    themeAndBranding.default_theme_id !== 'default-theme' ||
    !sameStrings(themeAndBranding.allowed_theme_ids, ['default-theme']) ||
    appearanceMode.config_key !== 'theme.appearanceMode' ||
    !sameStrings(appearanceMode.allowed_values, ['system', 'light', 'dark']) ||
    appearanceMode.default_value !== 'system' ||
    appearanceMode.settings_placement !== 'preferences_display' ||
    appearanceMode.presentation !== 'three_visual_preview_cards' ||
    appearanceMode.selection_indicator !== 'high_contrast_outline_and_accessible_checked_state' ||
    appearanceMode.system_follows_os !== true ||
    appearanceMode.theme_preset_surface !== 'not_exposed' ||
    appearanceMode.legacy_theme_data_policy !==
      'preserve_user_data_but_migrate_active_preset_to_default_theme' ||
    appearanceMode.legacy_codex_preset_policy !== 'not_selectable_not_applied' ||
    appearanceMode.default_visual_baseline !== 'always_on_opl_codex_aligned_overlay_supporting_light_and_dark' ||
    appearanceMode.navigation_rail_quick_toggle !== 'forbidden' ||
    footerUpdateEntry.placement !== 'account_footer_row_trailing_action' ||
    footerUpdateEntry.replaces !== 'navigation_rail_theme_quick_toggle' ||
    footerUpdateEntry.availability_source !== 'opl_app_state_fast_managed_update_plane_opl_app_component' ||
    footerUpdateEntry.visibility !== 'only_when_newer_version_confirmed_available' ||
    !sameStrings(footerUpdateEntry.hidden_states, [
      'unknown',
      'checking',
      'current',
      'up_to_date',
      'error_without_confirmed_update',
    ]) ||
    footerUpdateEntry.trigger !== 'existing_carrier_updater_update_intent' ||
    footerUpdateEntry.settings_route_fallback !== '/settings/environment?section=updates' ||
    footerUpdateEntry.new_updater_implementation_forbidden !== true ||
    footerUpdateEntry.expanded_behavior !== 'subtle_trailing_icon_only_with_tooltip_and_accessible_name' ||
    footerUpdateEntry.collapsed_behavior !== 'subtle_icon_only_with_tooltip_and_accessible_name' ||
    footerUpdateEntry.keyboard_reachable !== true ||
    footerUpdateEntry.test_id !== 'sider-footer-update' ||
    !sameStrings(settingsFooterUpdate.required_dom_when_update_available, ['sider-footer-update']) ||
    !sameStrings(settingsFooterUpdate.forbidden_dom_when_update_unavailable, ['sider-footer-update']) ||
    !sameStrings(settingsFooterUpdate.forbidden_dom, [
      'sider-footer-theme',
      'sider-footer-update-row',
      'sider-footer-check-updates',
    ]) ||
    settingsFooterUpdate.placement !== 'account_footer_row_trailing_action' ||
    settingsFooterUpdate.availability_source !== 'managed_update_plane.components[component_id=opl_app]' ||
    settingsFooterUpdate.visibility_policy !== 'confirmed_newer_version_only' ||
    settingsFooterUpdate.trigger_policy !== 'reuse_existing_carrier_updater_with_update_intent' ||
    settingsFooterUpdate.new_updater_forbidden !== true ||
    !sameStrings(settingsAppearanceMode.required_dom, [
      'appearance-mode-system',
      'appearance-mode-light',
      'appearance-mode-dark',
    ]) ||
    !sameStrings(settingsAppearanceMode.allowed_values, ['system', 'light', 'dark']) ||
    settingsAppearanceMode.presentation !== 'three_visual_preview_cards' ||
    settingsAppearanceMode.theme_preset_surface !== 'not_exposed' ||
    settingsAppearanceMode.legacy_active_preset_migration !== 'default-theme'
  ) {
    issues.add(
      'Settings appearance must use a single governed baseline with three-state appearance while the account row conditionally reuses the existing App updater',
    );
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
  if (!/^State: `(active_parity_convergence|active_currentness_refresh|release_closeout_in_progress|complete)`$/m.test(convergencePlan)) {
    issues.add('AionUI mainline convergence plan must be in active_parity_convergence, active_currentness_refresh, release_closeout_in_progress, or complete state');
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
  requireExactMarkerLine(
    foundationReadme,
    'runtime_cockpit.role=user_agent_collaboration_control_console',
    foundationDocs.readme,
    issues,
  );
  requireExactMarkerLine(
    foundationReadme,
    'runtime_cockpit.upstream_alignment_may_remove_or_weaken=false',
    foundationDocs.readme,
    issues,
  );
  requireExactMarkerLine(
    foundationReadme,
    'runtime_cockpit.acceptance_ref=contracts/app-page-state-matrix.json#pages[id=runtime].runtime_view_model.runtime_cockpit_acceptance',
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
  const runtimePreservationGate = record(featurePreservation.runtime_preservation_gate);
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
    runtimeSurfaceRoles.context_runtime_can_replace_navigation_runtime !== false ||
    runtimePreservationGate.product_contract_ref !==
      'contracts/app-gui-product-contract.json#pages.runtime_status.runtime_cockpit_product_contract' ||
    runtimePreservationGate.page_state_ref !==
      'contracts/app-page-state-matrix.json#pages[id=runtime].runtime_view_model.runtime_cockpit_acceptance' ||
    runtimePreservationGate.upstream_alignment_may_remove_or_weaken !== false ||
    runtimePreservationGate.replacement_must_preserve_required_answers !== true ||
    !sameStrings(runtimePreservationGate.same_change_requirements, [
      'product_contract',
      'page_state_acceptance',
      'validators',
      'tests',
    ])
  ) {
    issues.add('Codex reference alignment must preserve OPL-owned capabilities and same-change reachability');
  }

  const navigationRail = record(interactionBaseline.navigation_rail);
  const railWidth = record(navigationRail.resizable_width_px);
  const desktopAffordancePolicy = record(navigationRail.desktop_affordance_policy);
  const threadDirectoryPolicy = record(navigationRail.thread_directory_policy);
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
    desktopAffordancePolicy.webui_information_architecture_expansion_allowed !== false ||
    threadDirectoryPolicy.canonical_authority !== 'codex_app_server_thread_list_read_resume' ||
    !sameStrings(threadDirectoryPolicy.protocols, [
      'thread/list',
      'thread/read',
      'thread/resume',
      'thread/name/set',
      'thread/archive',
      'thread/unarchive',
      'thread/delete',
    ]) ||
    JSON.stringify(threadDirectoryPolicy.task_action_protocols) !==
      JSON.stringify({
        rename: 'thread/name/set',
        archive: 'thread/archive',
        restore: 'thread/unarchive',
        delete: 'thread/delete',
      }) ||
    threadDirectoryPolicy.pin_role !== 'shell_ui_metadata_only' ||
    threadDirectoryPolicy.local_reset_role !==
      'retain_existing_aionui_conversation_semantics_not_app_server_history_reset' ||
    threadDirectoryPolicy.shell_local_storage_role !== 'drafts_preferences_and_rebuildable_cache_only' ||
    threadDirectoryPolicy.shell_thread_history_authority !== false ||
    threadDirectoryPolicy.codex_session_directory_authority !==
      'canonical_app_server_thread_overview_when_available' ||
    threadDirectoryPolicy.canonical_overview_unavailable_policy !==
      'fallback_to_shell_cache_without_reclassifying_cache_as_authority' ||
    threadDirectoryPolicy.stale_codex_acp_cache_row_policy !==
      'exclude_from_ordinary_projection_when_absent_from_available_canonical_overview' ||
    threadDirectoryPolicy.non_codex_local_row_policy !== 'preserve' ||
    threadDirectoryPolicy.workspace_directory_role !==
      'new_session_initial_cwd_mutable_cwd_grouping_and_visible_metadata_only' ||
    threadDirectoryPolicy.row_identity !== 'canonical_thread_id' ||
    threadDirectoryPolicy.duplicate_row_per_canonical_thread_allowed !== false ||
    threadDirectoryPolicy.title_based_deduplication_allowed !== false ||
    threadDirectoryPolicy.e2e_fixture_storage_policy !== 'isolated_storage_root_never_production_user_data' ||
    JSON.stringify(threadDirectoryPolicy.directory_group_policy) !== JSON.stringify(appOwnedDirectoryGroupPolicy) ||
    threadDirectoryPolicy.ordinary_coordination_entry_visible !== false ||
    threadDirectoryPolicy.coordination_context_action_keyboard_reachable !== true ||
    threadDirectoryPolicy.coordination_entry_placement !==
      'thread_detail_context_action_and_model_host_tool_no_ordinary_navigation'
  ) {
    issues.add('interaction baseline navigation rail must preserve the governed desktop and narrow-window skeleton');
  }

  const conversationScope = record(interactionBaseline.conversation_scope);
  const threadCoordination = record(interactionBaseline.thread_coordination);
  const threadModelToolEvidence = record(threadCoordination.model_tool_access_evidence_boundary);
  const sameAgentTreeTransport = record(threadCoordination.same_agent_tree_transport);
  const threadDispatchPolicy = record(threadCoordination.dispatch_policy);
  const threadDeliveryDefaults = record(threadCoordination.delivery_request_defaults);
  const threadTurnStartInheritance = record(threadCoordination.turn_start_inheritance_policy);
  const threadIdempotencyPolicy = record(threadCoordination.idempotency_policy);
  const threadCrossHostPolicy = record(threadCoordination.cross_host_policy);
  const threadServerRequestPolicy = record(threadCoordination.interactive_server_request_policy);
  const homeTarget = record(interactionBaseline.home);
  const capabilitySelection = record(interactionBaseline.capability_selection);
  const composerTarget = record(interactionBaseline.composer);
  const explicitSessionInputPolicy = record(conversationScope.explicit_session_input_policy);
  const sessionWorkspaceModel = record(conversationScope.session_workspace_model);
  const localWorktreeLifecycle = record(conversationScope.local_worktree_lifecycle);
  const permissionTarget = record(interactionBaseline.permission_access_mode);
  const taskSummaryTarget = record(interactionBaseline.current_task_summary_bar);
  const mobileActionSheet = record(composerTarget.mobile_action_sheet);
  if (JSON.stringify(sessionWorkspaceModel) !== JSON.stringify(appOwnedSessionWorkspaceModel)) {
    issues.add(
      'conversation scope must keep the canonical session identity while treating workspace as mutable cwd and grouping metadata',
    );
  }
  if (
    conversationScope.workspace_initialized_session_supported !== true ||
    conversationScope.projectless_conversation_supported !== true ||
    conversationScope.text_chat_without_workspace !== 'available' ||
    conversationScope.explicit_session_inputs_without_workspace !== 'available_subject_to_codex_permissions' ||
    conversationScope.workspace_directory_role !==
      'new_session_initial_cwd_mutable_cwd_sidebar_grouping_and_visible_metadata_only_not_owner_or_authorization_domain' ||
    JSON.stringify(explicitSessionInputPolicy) !== JSON.stringify(appOwnedExplicitSessionInputPolicy) ||
    'project_context_inputs' in conversationScope ||
    'projectless_input_policy' in conversationScope ||
    !sameStrings(conversationScope.conversation_management, [
      'search',
      'pin',
      'rename',
      'archive',
      'restore',
      'delete',
      'reset',
    ]) ||
    conversationScope.archived_surface !== 'independent' ||
    JSON.stringify(localWorktreeLifecycle) !== JSON.stringify(appOwnedLocalWorktreeLifecycle) ||
    homeTarget.title_policy !== 'dynamic_question_title' ||
    homeTarget.starter_limit !== null ||
    homeTarget.starter_visibility_policy !== 'all_user_visible_configured_shortcuts' ||
    homeTarget.starter_order_policy !== 'stable_configured_order' ||
    homeTarget.starter_layout_policy !== 'responsive_wrap' ||
    !sameStrings(homeTarget.default_visible_shortcut_ids, ['research', 'grant', 'ppt', 'oma']) ||
    record(homeTarget.visual_structure).starter_item_width !== 'compact_fixed_width' ||
    record(homeTarget.visual_structure).starter_count_layout !==
      'center_actual_visible_count_and_wrap_without_fixed_column_count' ||
    record(homeTarget.visual_structure).desktop_composer_max_width_px !== 736 ||
    record(homeTarget.visual_structure).desktop_composer_min_height_px !== 98 ||
    record(homeTarget.visual_structure).desktop_composer_corner_radius_px !== 22 ||
    record(homeTarget.visual_structure).desktop_context_bar_height_px !== 52 ||
    record(homeTarget.visual_structure).desktop_context_bar_overlap_px !== 13 ||
    record(homeTarget.visual_structure).desktop_context_bar_horizontal_inset_px !== 12 ||
    homeTarget.starter_truncation_allowed !== false ||
    record(homeTarget.workspace_selector_policy).primary_scope !== 'active_workspace_only' ||
    record(homeTarget.workspace_selector_policy).inactive_recent_directories_visible !== false ||
    record(homeTarget.workspace_selector_policy).management_entry !== 'registered_directories_modal' ||
    record(homeTarget.workspace_selector_policy).management_scope !== 'registered_workspaces' ||
    record(homeTarget.workspace_selector_policy).selection_effect !== 'set_new_session_initial_cwd_only' ||
    record(homeTarget.workspace_selector_policy).unregister_effect !== 'remove_registration_only' ||
    record(homeTarget.workspace_selector_policy).filesystem_delete_allowed !== false ||
    record(homeTarget.workspace_selector_policy).active_conversation_change_on_unregister !== false ||
    record(homeTarget.workspace_selector_policy).session_ownership_effect !== 'none' ||
    record(homeTarget.workspace_selector_policy).cascade_session_delete_allowed !== false ||
    record(homeTarget.home_shortcut_mutation_policy).pending_scope !== 'single_shortcut' ||
    record(homeTarget.home_shortcut_mutation_policy).pending_key !== 'shortcut_id' ||
    record(homeTarget.home_shortcut_mutation_policy).other_shortcuts_remain_interactive !== true ||
    record(homeTarget.home_shortcut_mutation_policy).readback_mode !== 'background_no_page_loading' ||
    !sameStrings(capabilitySelection.selection_surfaces, ['home_starter']) ||
    capabilitySelection.management_surface !== 'settings_agents' ||
    capabilitySelection.legacy_route_policy !== '/capabilities_redirects_to_home_without_mounting_a_selection_page' ||
    capabilitySelection.composer_persistent_variable_selector !== false ||
    capabilitySelection.composer_context_surface !== 'active_capability_chip' ||
    composerTarget.placement !== 'floating_bottom_with_safe_inset' ||
    !sameStrings(composerTarget.persistent_context, ['active_capability']) ||
    !sameStrings(composerTarget.send_scoped_inputs, ['attachments']) ||
    composerTarget.send_scoped_consumption_policy !== 'consumed_by_current_send_not_persisted_in_context_strip' ||
    !sameStrings(composerTarget.forbidden_persistent_context, [
      'project',
      'workspace',
      'locality',
      'branch',
      'attachments',
      'workspace_context_refs',
    ]) ||
    !sameStrings(composerTarget.desktop_action_row, ['attach', 'permission_access_mode', 'model_reasoning', 'send_stop']) ||
    !sameStrings(mobileActionSheet.allowed_actions, [
      'attach',
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
    issues.add('interaction baseline Home, conversation, composer, Agents management, and task summary markers must match the App target');
  }

  const pageStates = Array.isArray(pageStateMatrix.pages) ? pageStateMatrix.pages.map(record) : [];
  const guidHomePage = pageStates.find((page) => page.id === 'guid_home') ?? {};
  const guidHomeViewModel = record(record(guidHomePage).home_view_model);
  if (JSON.stringify(record(guidHomeViewModel.new_task_locality)) !== JSON.stringify(appOwnedNewTaskLocality)) {
    issues.add('Guid Home must expose only the implemented new-task Local or Worktree selection boundary');
  }
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
  const coordinationHardFailures = [
    'protocol_unavailable_or_invalid',
    'target_not_found',
    'target_archived',
    'target_not_writable',
    'cross_host_delivery_unsupported',
    'codex_permission_or_user_request_declined_or_cancelled',
    'interactive_server_request_handler_unavailable_or_invalid',
  ];
  const coordinationServerRequestMethods = [
    'item/commandExecution/requestApproval',
    'item/fileChange/requestApproval',
    'item/permissions/requestApproval',
    'item/tool/requestUserInput',
    'mcpServer/elicitation/request',
    'execCommandApproval',
    'applyPatchApproval',
  ];
  const coordinationServerRequestKinds = [
    'command_approval',
    'file_change_approval',
    'permissions_approval',
    'user_input',
    'mcp_elicitation',
  ];
  const coordinationServerRequestFailures = [
    'user_declined_or_cancelled',
    'request_no_longer_pending',
    'handler_unavailable_or_invalid',
    'protocol_error',
  ];
  const coordinationAdvisories = [
    'project_workspace_difference',
    'write_set_overlap',
    'delegation_cycle_or_repeated_route',
  ];
  const coordinationNonBlockingSignals = [
    'cross_project',
    'cross_workspace',
    'workspace_write',
    'write_set_overlap',
    'running_turn_steer',
    'delegation_cycle_advisory',
  ];
  const coordinationAuditFields = [
    'delivery_id',
    'source_thread_id',
    'target_thread_id',
    'sender',
    'reason',
    'message_summary',
    'protocol_method',
    'codex_permission_policy_inheritance',
    'project_workspace_context',
    'write_set_advisory',
    'loop_advisory',
    'idempotency_result',
    'status',
    'result_summary',
    'created_at',
    'completed_at',
  ];
  const coordinationStates = [
    'loading',
    'ready',
    'empty',
    'protocol_unavailable',
    'protocol_invalid',
    'target_not_found',
    'archived_target',
    'target_not_writable',
    'cross_host_unsupported',
    'permission_denied',
    'approval_pending',
    'user_input_pending',
    'mcp_elicitation_pending',
    'server_request_resolving',
    'server_request_declined',
    'server_request_handler_unavailable',
    'stale_status_refreshing',
    'dispatch_running',
    'dispatch_completed',
    'dispatch_failed',
  ];
  if (
    threadCoordination.product_role !== 'opl_host_cross_top_level_codex_thread_coordination' ||
    threadCoordination.entry_surface !==
      'thread_detail_context_action_and_model_host_tool_no_ordinary_navigation' ||
    threadCoordination.ordinary_navigation_visible !== false ||
    threadCoordination.keyboard_reachable_entry !== true ||
    threadCoordination.primary_composer_control_visible !== false ||
    threadCoordination.thread_detail_context_action_visible !== true ||
    threadCoordination.model_tool_access !== true ||
    threadModelToolEvidence.protocol_surface !== 'experimental_dynamic_tools_registered_on_thread_start' ||
    threadModelToolEvidence.implementation_evidence_required !==
      'dynamic_tool_registration_and_item_tool_call_round_trip' ||
    threadModelToolEvidence.user_coordination_surface_evidence_sufficient !== false ||
    threadModelToolEvidence.missing_implementation_state !== 'source_missing_protocol_blocked_required_target' ||
    threadModelToolEvidence.blocker_code !== 'source_missing_protocol_blocked' ||
    threadModelToolEvidence.protocol_capability !== 'codex_app_server_dynamic_tools_available' ||
    threadModelToolEvidence.current_shell_transport !== 'ordinary_conversation_acp_aioncore_codex_acp' ||
    threadModelToolEvidence.current_blocker !==
      'acp_session_new_or_load_has_no_dynamic_tools_input_or_item_tool_call_callback' ||
    !sameStrings(threadModelToolEvidence.primary_owners, ['aioncore', 'codex_acp']) ||
    threadModelToolEvidence.shell_role !== 'blocked_thin_adapter' ||
    !sameStrings(threadModelToolEvidence.required_owner_routes, [
      'aioncore_same_app_server_client_adapter',
      'codex_acp_dynamic_tool_input_response_and_acp_callback',
    ]) ||
    !sameStrings(threadModelToolEvidence.forbidden_workarounds, [
      'second_app_server_thread_runtime',
      'post_hoc_coordination_port_handler',
      'shell_owned_tool_or_thread_store',
    ]) ||
    threadCoordination.default_state !== 'capability_available_no_ordinary_navigation_coordination_panel_closed' ||
    threadCoordination.model_role !== 'decide_when_and_why_to_coordinate' ||
    threadCoordination.protocol_owner !== 'codex_core_app_server' ||
    threadCoordination.app_host_owner !== 'opl_app_host' ||
    threadCoordination.thread_store_owner !== 'codex_core_app_server' ||
    threadCoordination.thin_shell_behavior_policy !==
      'codex_app_behavior_with_opl_metadata_and_audit_not_an_additional_workspace_sandbox' ||
    threadCoordination.project_workspace_role !==
      'new_thread_default_cwd_sidebar_grouping_and_visible_metadata_only_not_authorization_domain' ||
    threadCoordination.post_start_filesystem_access_authority !==
      'codex_native_permissions_approval_and_sandbox' ||
    sameAgentTreeTransport.scope !== 'same_agent_tree_only' ||
    !sameStrings(sameAgentTreeTransport.methods, ['spawn_agent', 'send_input', 'wait_agent']) ||
    sameAgentTreeTransport.cross_top_level_use_forbidden !== true ||
    !sameStrings(threadCoordination.cross_top_level_protocol, [
      'thread/list',
      'thread/read',
      'thread/resume',
      'thread/fork',
      'thread/archive',
      'thread/unarchive',
      'turn/start',
      'turn/steer',
    ]) ||
    !sameStrings(threadCoordination.required_thread_fields, requiredThreadFields) ||
    !sameStrings(threadCoordination.thread_actions, ['read', 'resume', 'fork', 'archive', 'unarchive']) ||
    threadDispatchPolicy.idle_thread !== 'turn/start' ||
    threadDispatchPolicy.running_thread !== 'turn/steer' ||
    threadDispatchPolicy.unknown_or_stale_status !== 'refresh_then_route_or_protocol_failure' ||
    threadDispatchPolicy.opl_extra_confirmation_policy !==
      'none_including_archive_cross_project_cross_workspace_workspace_write_write_set_overlap_running_steer_and_loop_advisory' ||
    threadDeliveryDefaults.permission !== 'inherit' ||
    !sameStrings(threadDeliveryDefaults.write_set, []) ||
    threadDeliveryDefaults.write_set_role !== 'optional_advisory_metadata_not_permission_input' ||
    threadTurnStartInheritance.target_thread_sticky_settings_inherited !== true ||
    !sameStrings(threadTurnStartInheritance.fields_must_not_be_sent, [
      'cwd',
      'runtimeWorkspaceRoots',
      'approvalPolicy',
      'sandboxPolicy',
    ]) ||
    !sameStrings(threadCoordination.hard_failure_conditions, coordinationHardFailures) ||
    threadServerRequestPolicy.pending_state_role !== 'codex_native_interactive_request_not_dispatch_failure' ||
    !sameStrings(threadServerRequestPolicy.supported_methods, coordinationServerRequestMethods) ||
    !sameStrings(threadServerRequestPolicy.pending_kinds, coordinationServerRequestKinds) ||
    threadServerRequestPolicy.context_surface !==
      'selected_target_thread_detail_with_thread_turn_and_item_context_when_available' ||
    threadServerRequestPolicy.resolution_owner !== 'user_via_typed_opl_host_bridge' ||
    threadServerRequestPolicy.current_time_read_policy !== 'automatic_protocol_response' ||
    threadServerRequestPolicy.unknown_server_request_policy !== 'fail_closed_json_rpc_method_not_found' ||
    !sameStrings(threadServerRequestPolicy.failure_conditions, coordinationServerRequestFailures) ||
    threadServerRequestPolicy.delivery_audit_boundary !==
      'coordination_delivery_audit_records_codex_policy_inheritance_not_independent_approval_decisions' ||
    threadServerRequestPolicy.separate_persisted_approval_receipt_implemented !== false ||
    !sameStrings(threadCoordination.advisory_signals, coordinationAdvisories) ||
    !sameStrings(threadCoordination.must_not_block_or_confirm_for, coordinationNonBlockingSignals) ||
    threadIdempotencyPolicy.dedupe_scope !== 'same_opaque_request_or_idempotency_key_retry_only' ||
    threadIdempotencyPolicy.same_key_retry_behavior !==
      'return_first_receipt_and_result_with_ok_true_without_second_dispatch' ||
    threadIdempotencyPolicy.message_content_repeat_allowed !== true ||
    threadCrossHostPolicy.state !== 'required_target_protocol_owner_blocked_unavailable' ||
    threadCrossHostPolicy.blocker_code !== 'remote_host_handoff_owner_surface_unavailable' ||
    threadCrossHostPolicy.primary_owner !== 'codex_app_remote_connections_host_handoff_owner' ||
    threadCrossHostPolicy.product_contract_owner !== 'one_person_lab_app' ||
    threadCrossHostPolicy.shell_role !== 'blocked_thin_adapter' ||
    threadCrossHostPolicy.current_transport_state !== 'local_app_server_only_no_host_transfer_rpc' ||
    threadCrossHostPolicy.required_transport !==
      'connected_host_task_handoff_with_git_state_transfer_destination_readback_and_disconnect_recovery' ||
    threadCrossHostPolicy.direct_message_allowed !== false ||
    threadCrossHostPolicy.handoff_available !== false ||
    threadCrossHostPolicy.success_projection_allowed !== false ||
    threadCrossHostPolicy.parity_requirement !== 'current_required_target_blocked_on_protocol_owner' ||
    !sameStrings(threadCoordination.required_states, coordinationStates) ||
    !sameStrings(threadCoordination.audit_fields, coordinationAuditFields) ||
    threadCoordination.user_visibility_policy !==
      'sender_target_reason_message_result_permission_policy_and_advisory_context_visible_and_auditable_interactive_server_requests_visible_in_target_context' ||
    !sameStrings(threadCoordination.forbidden_implementations, [
      'send_input_as_cross_top_level_message_bus',
      'shell_owned_duplicate_thread_store',
      'model_generated_thread_id',
      'shell_owned_permission_model',
      'project_or_workspace_as_authorization_domain',
      'write_set_overlap_as_dispatch_blocker',
      'delegation_loop_as_dispatch_blocker',
      'message_content_as_dedupe_key',
      'duplicate_delivery_error_for_same_idempotency_key',
      'direct_cross_host_message_delivery',
      'any_opl_confirmation_for_thread_read_dispatch_steer_or_archive',
      'interactive_server_request_as_immediate_dispatch_failure',
      'delivery_audit_as_independent_approval_receipt',
    ]) ||
    coordinationViewModel.product_role !== threadCoordination.product_role ||
    coordinationViewModel.entry_surface !== threadCoordination.entry_surface ||
    coordinationViewModel.ordinary_navigation_visible !== false ||
    coordinationViewModel.keyboard_reachable_entry !== true ||
    coordinationViewModel.primary_composer_control_visible !== false ||
    coordinationViewModel.thread_detail_context_action_visible !== true ||
    coordinationViewModel.model_tool_access !== true ||
    JSON.stringify(record(coordinationViewModel.model_tool_access_evidence_boundary)) !==
      JSON.stringify(threadModelToolEvidence) ||
    coordinationViewModel.default_state !== 'capability_available_no_ordinary_navigation_coordination_panel_closed' ||
    coordinationViewModel.thread_list_protocol !== 'thread/list' ||
    coordinationViewModel.thread_read_protocol !== 'thread/read' ||
    !sameStrings(coordinationViewModel.thread_actions, ['thread/resume', 'thread/fork', 'thread/archive', 'thread/unarchive']) ||
    JSON.stringify(coordinationViewModel.task_rail_action_protocols) !==
      JSON.stringify({
        rename: 'thread/name/set',
        archive: 'thread/archive',
        restore: 'thread/unarchive',
        delete: 'thread/delete',
      }) ||
    coordinationViewModel.pin_role !== 'shell_ui_metadata_only' ||
    coordinationViewModel.local_reset_role !==
      'retain_existing_aionui_conversation_semantics_not_app_server_history_reset' ||
    coordinationViewModel.idle_dispatch_protocol !== 'turn/start' ||
    coordinationViewModel.running_dispatch_protocol !== 'turn/steer' ||
    JSON.stringify(coordinationViewModel.delivery_request_defaults) !== JSON.stringify(threadDeliveryDefaults) ||
    JSON.stringify(coordinationViewModel.turn_start_inheritance_policy) !== JSON.stringify(threadTurnStartInheritance) ||
    coordinationViewModel.project_workspace_role !== threadCoordination.project_workspace_role ||
    coordinationViewModel.post_start_filesystem_access_authority !== threadCoordination.post_start_filesystem_access_authority ||
    !sameStrings(coordinationViewModel.required_thread_fields, requiredThreadFields) ||
    !sameStrings(coordinationViewModel.hard_failure_conditions, coordinationHardFailures) ||
    JSON.stringify(record(coordinationViewModel.interactive_server_request_policy)) !==
      JSON.stringify(threadServerRequestPolicy) ||
    !sameStrings(coordinationViewModel.advisory_signals, coordinationAdvisories) ||
    !sameStrings(coordinationViewModel.must_not_block_or_confirm_for, coordinationNonBlockingSignals) ||
    !sameStrings(coordinationViewModel.required_states, coordinationStates) ||
    !sameStrings(coordinationViewModel.user_visible_audit_fields, [
      'sender',
      'source_thread_id',
      'target_thread_id',
      'reason',
      'message_summary',
      'protocol_method',
      'codex_permission_policy_inheritance',
      'project_workspace_context',
      'write_set_advisory',
      'loop_advisory',
      'idempotency_result',
      'status',
      'result_summary',
    ]) ||
    coordinationViewModel.unknown_or_stale_status_policy !== 'refresh_then_route_or_protocol_failure' ||
    coordinationViewModel.idempotency_policy !==
      'same_opaque_request_or_idempotency_key_retry_returns_first_receipt_and_result_ok_true_without_second_dispatch_message_content_repeat_allowed' ||
    coordinationViewModel.cross_host_policy !==
      'required_target_protocol_owner_blocked_unavailable_no_success_projection' ||
    coordinationViewModel.cross_host_blocker_code !== 'remote_host_handoff_owner_surface_unavailable' ||
    coordinationViewModel.cross_host_owner_route !== 'codex_app_remote_connections_host_handoff_owner' ||
    coordinationViewModel.cross_host_shell_role !== 'blocked_thin_adapter' ||
    coordinationViewModel.opl_extra_confirmation_policy !==
      'none_including_archive_cross_project_cross_workspace_workspace_write_write_set_overlap_running_steer_and_loop_advisory' ||
    coordinationViewModel.same_agent_tree_api_boundary !== 'spawn_agent_send_input_wait_agent_same_tree_only'
  ) {
    issues.add('cross-top-level coordination must preserve Codex App flexibility while keeping OPL metadata, advisories, idempotency, and audit');
  }

  const contextSurfaces = record(interactionBaseline.context_surfaces);
  const artifactPreview = record(interactionBaseline.artifact_preview);
  const ordinaryConversationPage = pageStates.find((page) => page.id === 'ordinary_conversation') ?? {};
  const ordinaryConversationViewModel = record(record(ordinaryConversationPage).conversation_view_model);
  const pageEnvironmentWorkspaceHandoff = record(ordinaryConversationViewModel.environment_workspace_handoff);
  const conversationEnvironmentWorkspaceHandoff = record(
    record(guiContract.ordinary_conversation).environment_workspace_handoff,
  );
  const pageArtifactPreview = record(ordinaryConversationViewModel.artifact_preview);
  const conversationArtifactPreview = record(record(guiContract.ordinary_conversation).artifact_preview);
  const environmentPopover = record(contextSurfaces.environment_popover);
  const sidePanel = record(contextSurfaces.side_panel);
  const reviewPane = record(contextSurfaces.review_pane);
  const reviewCapabilityStatus = record(reviewPane.source_capability_status);
  const rightContextInspectorPage = pageStates.find((page) => page.id === 'right_context_inspector') ?? {};
  const pageReviewPane = record(record(record(rightContextInspectorPage).inspector_view_model).review_surface);
  const settingsShell = record(interactionBaseline.settings_shell);
  const visualTarget = record(interactionBaseline.visual_target);
  const targetDefinitionRole = 'opl_target_translation_not_literal_codex_observation';
  if (oplTargetTranslation.some((key) => record(interactionBaseline[key]).definition_role !== targetDefinitionRole)) {
    issues.add('each OPL target translation section must declare that it is not a literal Codex observation');
  }
  if (
    JSON.stringify(pageEnvironmentWorkspaceHandoff) !==
      JSON.stringify(appOwnedPageStateEnvironmentWorkspaceHandoff) ||
    JSON.stringify(conversationEnvironmentWorkspaceHandoff) !==
      JSON.stringify(appOwnedGuiContractEnvironmentWorkspaceHandoff)
  ) {
    issues.add('ordinary conversation must keep same-host idle workspace handoff in Environment without claiming deferred capabilities');
  }
  if (
    artifactPreview.surface !== 'existing_aionui_preview_context_and_panel' ||
    !sameStrings(artifactPreview.entry_sources, [
      'session_attachment_ref',
      'conversation_result_ref',
      'explicit_absolute_local_path',
    ]) ||
    !sameStrings(artifactPreview.supported_content_types, ['markdown', 'pdf', 'code', 'image', 'html', 'diff']) ||
    !sameStrings(artifactPreview.markdown_embedded_renderers, ['mermaid', 'katex', 'code']) ||
    artifactPreview.ref_resolution_policy !==
      'explicit_session_attachment_or_conversation_result_ref_or_user_selected_legal_absolute_local_path_without_copying_artifact_body' ||
    JSON.stringify(artifactPreview.session_reference_policy) !== JSON.stringify({
      attachment_ref_scope: 'current_session_explicit_attachment_only',
      conversation_result_ref_scope: 'current_session_visible_result_only',
      workspace_membership_required: false,
      implicit_workspace_ref_allowed: false,
    }) ||
    record(artifactPreview.explicit_local_path_policy).user_initiated_only !== true ||
    record(artifactPreview.explicit_local_path_policy).path_form !== 'legal_absolute_local_file_path' ||
    record(artifactPreview.explicit_local_path_policy).workspace_membership_required !== false ||
    record(artifactPreview.explicit_local_path_policy).access_authority !== 'codex_permission_approval_and_sandbox' ||
    record(artifactPreview.explicit_local_path_policy).automatic_silent_read_allowed !== false ||
    'project_context_ref_policy' in artifactPreview ||
    !sameStrings(artifactPreview.forbidden_inputs, [
      'relative_parent_traversal',
      'illegal_or_unsupported_scheme',
      'automatic_silent_read',
      'implicit_workspace_context_ref',
    ]) ||
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
      session_reference_policy: artifactPreview.session_reference_policy,
      explicit_local_path_policy: artifactPreview.explicit_local_path_policy,
      forbidden_inputs: artifactPreview.forbidden_inputs,
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
    reviewPane.host_surface !== 'existing_files_changes_diff_surface' ||
    reviewPane.default_state !== 'closed' ||
    reviewPane.opens_on_user_request !== true ||
    !sameStrings(reviewPane.review_targets, ['uncommitted', 'base_branch', 'commit', 'custom']) ||
    !sameStrings(reviewPane.delivery_modes, ['inline', 'detached']) ||
    reviewPane.default_section !== 'unstaged' ||
    !sameStrings(reviewPane.sections, ['unstaged', 'staged', 'commit', 'branch', 'last_turn']) ||
    !sameStrings(reviewPane.capabilities, [
      'pull_request_context',
      'inline_comments',
      'stage',
      'commit',
      'push',
    ]) ||
    reviewPane.source_status !==
      'partial_last_turn_and_focus_context_implemented_inline_comments_protocol_blocked' ||
    reviewCapabilityStatus.last_turn !== 'source_implemented_existing_message_store' ||
    reviewCapabilityStatus.review_focus_context !==
      'source_implemented_same_review_turn_steer_expected_turn_id' ||
    reviewCapabilityStatus.inline_comments !== 'source_blocked_missing_typed_codex_protocol' ||
    reviewPane.last_turn_source_policy !==
      'latest_visible_user_message_then_completed_workspace_edit_tool_calls' ||
    reviewPane.review_focus_delivery_policy !==
      'non_custom_target_plain_text_turn_steer_same_review_thread_expected_turn_id_custom_instructions_not_duplicated' ||
    reviewPane.review_focus_failure_policy !==
      'typed_failure_without_success_on_steer_failure_stale_or_ended_turn' ||
    reviewPane.inline_comment_protocol_requirement !==
      'typed_codex_app_server_file_line_comment_request_location_and_failure_semantics' ||
    !sameStrings(reviewPane.inline_comment_forbidden_fallbacks, ['shell_local_annotation_store', 'fake_success']) ||
    reviewPane.pull_request_context_dependency !== 'gh' ||
    reviewPane.pull_request_context_unavailable_policy !== 'show_explicit_unavailable_state' ||
    reviewPane.git_authority !== 'existing_codex_git_integration' ||
    reviewPane.shell_role !== 'thin_adapter_only' ||
    reviewPane.duplicate_git_store_allowed !== false ||
    reviewPane.legacy_equal_weight_review_tab_allowed !== false ||
    JSON.stringify(pageReviewPane) !== JSON.stringify(reviewPane) ||
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
    pageStateBoundary.pixel_evidence_ref !== 'docs/product/gui/evidence/aionui-41301/manifest.json' ||
    pageStateBoundary.runtime_product_contract_ref !==
      'contracts/app-gui-product-contract.json#pages.runtime_status.runtime_cockpit_product_contract' ||
    pageStateBoundary.runtime_upstream_alignment_may_remove_or_weaken !== false ||
    pageStateBoundary.runtime_acceptance_requires_contract_page_state_validators_tests !== true
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
  const expectedUiLocalePolicy = {
    explicit_user_preference: 'preserve_across_launches',
    first_launch_without_preference: 'detect_system_locale_before_first_render',
    supported_normalization: 'zh_to_zh-CN_else_en-US',
    startup_must_not_overwrite_explicit_preference: true,
  };
  if (
    JSON.stringify(record(guiContract.ui_locale_policy)) !== JSON.stringify(expectedUiLocalePolicy) ||
    JSON.stringify(record(profileGui.ui_locale_policy)) !== JSON.stringify(expectedUiLocalePolicy)
  ) {
    issues.add('GUI contract and product profile must detect system locale before first render and preserve explicit language preferences');
  }
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
