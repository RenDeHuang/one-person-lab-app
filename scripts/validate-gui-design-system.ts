#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonRecord = Record<string, unknown>;
type ActiveSurfaceState = 'collapsed' | 'visible';
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
  release_ready: false;
};

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roleMarker = 'gui_shell_roles: active=aionui; foreground=opl-native-workbench; retained=hermes-codex; archived=agui-codex';
const stackMarker = 'gui_definition_stack: product_definition > visual_system > shell_implementation_conformance';
const shellAuthorityMarker = 'gui_shell_authority: implementation_only';
const codexReference = 'ChatGPT Codex macOS 26.707.31428 (2026-07-10)';
const supersededCodexReference = 'ChatGPT Codex macOS 26.707.31123 (2026-07-10)';

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

function idArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(record).map((item) => item.id).filter((id): id is string => typeof id === 'string')
    : [];
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

function requireMarker(text: string, marker: string, label: string, issues: Set<string>): void {
  if (!text.includes(marker)) issues.add(`${label} must include ${marker}`);
}

function requireExactMarkerLine(text: string, marker: string, label: string, issues: Set<string>): void {
  const present = text.split(/\r?\n/).some((line) => line.trim()
    .replace(/^-\s+/, '')
    .replace(/^`|`$/g, '') === marker);
  if (!present) issues.add(`${label} must include exact marker ${marker}`);
}

function markdownCells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
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

export function validateGuiDesignSystem(root = defaultRoot): GuiDesignSystemValidation {
  const issues = new Set<string>();
  const registry = readJson(root, 'contracts/app-shell-candidates.json', issues);
  const profile = readJson(root, 'contracts/app-product-profile.json', issues);
  const guiContract = readJson(root, 'contracts/app-gui-product-contract.json', issues);
  const pageStateMatrix = readJson(root, 'contracts/app-page-state-matrix.json', issues);
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
  const governedText = governedDocPaths
    .map((relativePath) => readText(root, relativePath, issues))
    .join('\n');
  const foundationReadme = readText(root, foundationDocs.readme, issues);
  const conformanceMatrix = readText(root, foundationDocs.shell_conformance_matrix, issues);
  const conformanceRowsValidated = validateConformanceMatrix(conformanceMatrix, issues);
  if (governedDocsPresent) {
    for (const layer of expectedStack) {
      requireExactMarkerLine(
        foundationReadme,
        `${layer.id}=${layer.entry_docs.join(',')}`,
        foundationDocs.readme,
        issues,
      );
    }
    requireExactMarkerLine(
      foundationReadme,
      `entry_docs=${governedDocPaths.join(',')}`,
      foundationDocs.readme,
      issues,
    );
    const contractRefs = [...new Set(expectedStack.flatMap((layer) => layer.contract_refs))];
    requireExactMarkerLine(
      foundationReadme,
      `contract_refs=${contractRefs.join(',')}`,
      foundationDocs.readme,
      issues,
    );
    requireMarker(foundationReadme, shellAuthorityMarker, foundationDocs.readme, issues);
    for (const marker of [
      `current_interaction_reference=${codexReference}`,
      `superseded_interaction_observation=${supersededCodexReference}`,
      'human_target.owner=one-person-lab-app',
      'active_aionui.role=current_implementation_conformance_only',
      'docs_or_contract_imply_source_complete=false',
      'docs_or_contract_imply_pixel_complete=false',
      'ideal_target.workspace_session_rail_default_visible=true',
      'ideal_target.inspector_default_visible=false',
      'ideal_target.permission_access_mode_visible=true',
      'ideal_target.side_panel_primary_tools=review,terminal,browser,files',
      'active_aionui.state_source=contracts/app-product-profile.json#gui.home.home_layout',
    ]) {
      requireExactMarkerLine(foundationReadme, marker, foundationDocs.readme, issues);
    }
  }

  const interactionBaseline = record(guiContract.interaction_baseline);
  const currentReference = record(interactionBaseline.current_reference);
  if (
    interactionBaseline.schema !== 'opl_app_codex_interaction_baseline.v1' ||
    currentReference.product !== 'ChatGPT Codex macOS' ||
    currentReference.build !== '26.707.31428' ||
    currentReference.observed_on !== '2026-07-10' ||
    currentReference.usage !== 'visual_and_interaction_reference_only_no_code_brand_account_or_authority_copy'
  ) {
    issues.add(`interaction_baseline current reference must be ${codexReference}`);
  }
  const supersededObservations = Array.isArray(interactionBaseline.superseded_observations)
    ? interactionBaseline.superseded_observations.map(record)
    : [];
  if (!supersededObservations.some((observation) => (
    observation.product === 'ChatGPT Codex macOS' &&
    observation.build === '26.707.31123' &&
    observation.observed_on === '2026-07-10' &&
    observation.status === 'superseded_observation_only'
  ))) {
    issues.add(`interaction_baseline must retain ${supersededCodexReference} only as a superseded observation`);
  }

  const acceptanceBoundary = record(interactionBaseline.acceptance_boundary);
  if (
    acceptanceBoundary.human_target_owner !== 'one-person-lab-app' ||
    acceptanceBoundary.active_shell !== 'aionui' ||
    acceptanceBoundary.active_shell_role !== 'current_implementation_conformance_only' ||
    acceptanceBoundary.docs_or_contract_imply_source_complete !== false ||
    acceptanceBoundary.docs_or_contract_imply_pixel_complete !== false ||
    acceptanceBoundary.docs_or_contract_imply_release_ready !== false
  ) {
    issues.add('interaction baseline must keep the human target separate from source, pixel, and release completion');
  }

  const navigationRail = record(interactionBaseline.navigation_rail);
  const railWidth = record(navigationRail.resizable_width_px);
  if (
    navigationRail.wide_desktop_default !== 'expanded' ||
    navigationRail.narrow_window_mode !== 'drawer' ||
    railWidth.min !== 280 ||
    railWidth.max !== 340 ||
    !sameStrings(navigationRail.top_entries, ['new_task', 'archived', 'capabilities']) ||
    !sameStrings(navigationRail.forbidden_entries_without_opl_product_capability, ['sites', 'chat']) ||
    !sameStrings(navigationRail.bottom_entries, ['account', 'help', 'settings']) ||
    !sameStrings(navigationRail.desktop_affordances, ['back', 'forward', 'previous_task', 'next_task', 'new_window'])
  ) {
    issues.add('interaction baseline navigation rail must preserve the governed desktop and narrow-window skeleton');
  }

  const conversationScope = record(interactionBaseline.conversation_scope);
  const homeTarget = record(interactionBaseline.home);
  const capabilitySelection = record(interactionBaseline.capability_selection);
  const composerTarget = record(interactionBaseline.composer);
  const permissionTarget = record(interactionBaseline.permission_access_mode);
  const taskSummaryTarget = record(interactionBaseline.current_task_summary_bar);
  if (
    conversationScope.project_task_supported !== true ||
    conversationScope.projectless_conversation_supported !== true ||
    conversationScope.text_chat_without_workspace !== 'available' ||
    conversationScope.file_and_project_features_without_workspace !== 'restricted_with_explanation' ||
    !sameStrings(conversationScope.conversation_management, ['search', 'pin', 'rename', 'archive', 'reset']) ||
    conversationScope.archived_surface !== 'independent' ||
    homeTarget.title_policy !== 'dynamic_question_title' ||
    homeTarget.starter_limit !== 4 ||
    capabilitySelection.composer_persistent_variable_selector !== false ||
    capabilitySelection.composer_context_surface !== 'active_capability_chip' ||
    composerTarget.placement !== 'floating_bottom_with_safe_inset' ||
    !sameStrings(composerTarget.context_strip, ['project', 'local', 'branch', 'active_capability']) ||
    composerTarget.model_reasoning_control !== 'single_compact_menu' ||
    !sameStrings(permissionTarget.visible_on, ['home_composer', 'conversation_composer']) ||
    permissionTarget.provider_or_backend_terms_visible !== false ||
    taskSummaryTarget.pin_supported !== true ||
    !sameStrings(taskSummaryTarget.fields, ['status', 'elapsed', 'progress', 'next_action', 'stop'])
  ) {
    issues.add('interaction baseline Home, conversation, composer, access, and task summary markers must match the App target');
  }

  const contextSurfaces = record(interactionBaseline.context_surfaces);
  const environmentPopover = record(contextSurfaces.environment_popover);
  const sidePanel = record(contextSurfaces.side_panel);
  const settingsShell = record(interactionBaseline.settings_shell);
  const visualTarget = record(interactionBaseline.visual_target);
  if (
    !sameStrings(environmentPopover.summary_fields, ['workspace', 'local', 'git', 'subtasks', 'sources']) ||
    sidePanel.wide_desktop !== 'resizable_split' ||
    sidePanel.default_state !== 'closed' ||
    !sameStrings(sidePanel.primary_tools, ['review', 'terminal', 'browser', 'files']) ||
    !sameStrings(sidePanel.secondary_sections, ['artifacts', 'runtime', 'actions', 'memory']) ||
    sidePanel.secondary_presentation !== 'sections_or_disclosures_not_equal_weight_tabs' ||
    !sameStrings(contextSurfaces.advanced_work_surfaces, ['bottom_panel', 'file_tree', 'terminal', 'browser']) ||
    contextSurfaces.advanced_work_surfaces_default !== 'closed' ||
    settingsShell.frame !== 'codex_full_window_return_search_grouped_rows' ||
    settingsShell.information_architecture !== 'existing_opl_settings_ia_unchanged' ||
    visualTarget.main_canvas !== 'white' ||
    visualTarget.rail_and_subtle_surfaces !== 'neutral_gray' ||
    visualTarget.opl_teal_and_brand_retained !== true
  ) {
    issues.add('interaction baseline context surfaces, Settings shell, and visual target must match the App target');
  }

  const pageStateBoundary = record(pageStateMatrix.acceptance_boundary);
  if (
    pageStateMatrix.interaction_baseline_ref !== 'contracts/app-gui-product-contract.json#interaction_baseline' ||
    pageStateBoundary.human_target_owner !== 'one-person-lab-app' ||
    pageStateBoundary.active_aionui_role !== 'current_implementation_conformance_only' ||
    pageStateBoundary.contract_target_implies_source_complete !== false ||
    pageStateBoundary.contract_target_implies_pixel_complete !== false
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
  const railMatchesIdeal = activeRailState === (idealTarget.workspace_session_rail_default_visible ? 'visible' : 'collapsed');
  const inspectorMatchesIdeal = activeInspectorState === (idealTarget.inspector_default_visible ? 'visible' : 'collapsed');
  const permissionAccessModeMatchesIdeal = (
    profileHome.permission_mode_selector_visible === true &&
    profileHome.conversation_permission_mode_selector_visible === true &&
    activeConversation.permission_mode_selector_visible === true
  );
  const sidePanelInformationArchitectureMatchesIdeal = (
    sameStrings(idArray(activeInspector.primary_tools), stringArray(sidePanel.primary_tools)) &&
    sameStrings(idArray(activeInspector.secondary_sections), stringArray(sidePanel.secondary_sections)) &&
    !Array.isArray(activeInspector.tabs)
  );

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
  const nativeCandidateReference = typeof nativeVisualContract.comparison_baseline === 'string'
    ? nativeVisualContract.comparison_baseline
    : '';
  const allowedCandidateReferences = [codexReference, supersededCodexReference];
  if (
    !allowedCandidateReferences.includes(String(codexGovernance.comparison_baseline)) ||
    nativeCandidateReference !== codexGovernance.comparison_baseline
  ) {
    issues.add(`candidate Codex comparison baseline must be ${codexReference} or the declared superseded observation`);
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
