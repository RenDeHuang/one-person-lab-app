#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonRecord = Record<string, unknown>;
type ActiveSurfaceState = 'collapsed' | 'visible';

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
    };
  };
  evidence_scope: 'design_system_governance_consistency_only';
  release_ready: false;
};

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roleMarker = 'gui_shell_roles: active=aionui; foreground=opl-native-workbench; retained=hermes-codex; archived=agui-codex';
const stackMarker = 'gui_definition_stack: product_definition > visual_system > shell_implementation_conformance';
const shellAuthorityMarker = 'gui_shell_authority: implementation_only';
const codexReference = 'ChatGPT Codex macOS 26.707.31123 (2026-07-10)';

const foundationDocs = {
  readme: 'docs/product/gui/README.md',
  visual_system: 'docs/product/gui/visual-system.md',
  shell_implementation_guide: 'docs/product/gui/shell-implementation-guide.md',
  shell_conformance_matrix: 'docs/product/gui/shell-conformance-matrix.md',
} as const;

const expectedStack = [
  {
    id: 'product_definition',
    priority: 1,
    entry_docs: [
      foundationDocs.readme,
      'docs/product/gui/ideal-interaction-spec.md',
      'docs/product/gui/codex-to-opl-app-delta.md',
      'docs/product/gui/feature-inventory.md',
    ],
    contract_refs: [
      'contracts/app-gui-product-contract.json',
      'contracts/app-product-profile.json',
      'contracts/app-page-state-matrix.json',
    ],
  },
  {
    id: 'visual_system',
    priority: 2,
    entry_docs: [foundationDocs.visual_system],
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
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : [];
}

function sameStrings(actual: unknown, expected: readonly string[]): boolean {
  return JSON.stringify(stringArray(actual)) === JSON.stringify(expected);
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

function requireMarker(text: string, marker: string, label: string, issues: Set<string>): void {
  if (!text.includes(marker)) issues.add(`${label} must include ${marker}`);
}

export function validateGuiDesignSystem(root = defaultRoot): GuiDesignSystemValidation {
  const issues = new Set<string>();
  const registry = readJson(root, 'contracts/app-shell-candidates.json', issues);
  const profile = readJson(root, 'contracts/app-product-profile.json', issues);
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
  if (!sameStrings(governance.priority_order, expectedStack.map((layer) => layer.id))) {
    issues.add('design_system_governance.priority_order must follow product, visual, then shell conformance');
  }
  if (governance.shell_authority !== 'implementation_only_cannot_redefine_product') {
    issues.add('design_system_governance.shell_authority must keep shells implementation-only');
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

  const foundationPaths = Object.values(foundationDocs);
  const foundationFilesPresent = foundationPaths.every((relativePath) => fs.existsSync(path.join(root, relativePath)));
  const foundationText = foundationPaths
    .map((relativePath) => readText(root, relativePath, issues))
    .join('\n');
  const foundationReadme = readText(root, foundationDocs.readme, issues);
  if (foundationFilesPresent) {
    for (const layer of expectedStack) {
      requireMarker(foundationText, layer.id, 'GUI design-system foundation docs', issues);
      for (const relativePath of layer.entry_docs) {
        if (relativePath !== foundationDocs.readme) {
          requireMarker(foundationReadme, relativePath, foundationDocs.readme, issues);
        }
      }
      for (const contractRef of layer.contract_refs) {
        requireMarker(foundationText, contractRef, 'GUI design-system foundation docs', issues);
      }
    }
    requireMarker(foundationText, shellAuthorityMarker, 'GUI design-system foundation docs', issues);
    requireMarker(foundationText, codexReference, 'GUI design-system foundation docs', issues);
    for (const marker of [
      'ideal_target.workspace_session_rail_default_visible=true',
      'ideal_target.inspector_default_visible=false',
      'active_aionui.state_source=contracts/app-product-profile.json#gui.home.home_layout',
    ]) {
      requireMarker(foundationText, marker, 'GUI design-system foundation docs', issues);
    }
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
  if (idealTarget.source_candidate !== 'opl-native-workbench') {
    issues.add('ideal target state must point to opl-native-workbench');
  }

  const homeLayout = record(record(record(profile.gui).home).home_layout);
  const activeAionui = record(stateBoundary.active_aionui);
  const activeRailState = homeLayout.workspace_session_rail_default_state;
  const activeInspectorState = homeLayout.right_context_inspector_default_state;
  const allowedActiveStates = ['collapsed', 'visible'];
  if (!allowedActiveStates.includes(String(activeRailState))) {
    issues.add('active AionUI rail state must be collapsed or visible in app-product-profile');
  }
  if (!allowedActiveStates.includes(String(activeInspectorState))) {
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

  const codex = record(profile.codex);
  const defaultModel = typeof codex.default_model === 'string' ? codex.default_model : '';
  const defaultReasoningEffort = typeof codex.default_reasoning_effort === 'string'
    ? codex.default_reasoning_effort
    : '';
  if (!defaultModel || !defaultReasoningEffort) {
    issues.add('app-product-profile Codex defaults must be non-empty strings');
  }
  if (
    nativeVisualContract.default_model !== defaultModel ||
    nativeVisualContract.default_reasoning_effort !== defaultReasoningEffort
  ) {
    issues.add('native candidate model defaults must derive from app-product-profile');
  }
  const mentionedModels = new Set((foundationText.match(/\bgpt-[a-z0-9.-]+\b/gi) ?? []).map((value) => value.toLowerCase()));
  for (const model of mentionedModels) {
    if (model !== defaultModel) {
      issues.add(`foundation docs must not copy model catalogs or name non-default model ${model}`);
    }
  }
  if (/\brelease[_ -]ready\s*[:=]\s*true\b/i.test(foundationText)) {
    issues.add('foundation docs must not mark release readiness true');
  }

  const codexGovernance = record(governance.codex_reference);
  if (
    codexGovernance.comparison_baseline !== codexReference ||
    nativeVisualContract.comparison_baseline !== codexReference
  ) {
    issues.add(`Codex comparison baseline must be ${codexReference}`);
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
    nativeVisualContract.docs_or_contract_only_completion_allowed !== false
  ) {
    issues.add('design-system validation and visual/docs evidence must not claim release readiness');
  }

  const scripts = record(packageJson.scripts);
  if (scripts['validate:gui-design-system'] !== 'node --experimental-strip-types scripts/validate-gui-design-system.ts') {
    issues.add('package.json must expose validate:gui-design-system');
  }
  if (typeof scripts['validate:shell-convergence'] !== 'string' || !scripts['validate:shell-convergence'].includes('npm run validate:gui-design-system')) {
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
        rail_matches_ideal: activeRailState === (idealTarget.workspace_session_rail_default_visible ? 'visible' : 'collapsed'),
        inspector_matches_ideal: activeInspectorState === (idealTarget.inspector_default_visible ? 'visible' : 'collapsed'),
      },
    },
    evidence_scope: 'design_system_governance_consistency_only',
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
