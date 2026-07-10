import { validateGuiDesignSystem } from '../../../scripts/validate-gui-design-system.ts';
import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
} from './helpers.ts';

const shellAuthorityMarker = 'gui_shell_authority: implementation_only';
const codexReference = 'ChatGPT Codex macOS 26.707.31428 (2026-07-10)';
const supersededCodexReference = 'ChatGPT Codex macOS 26.707.31123 (2026-07-10)';
const designRoot = 'docs/product/gui';

const conformanceMatrix = `# Shell conformance matrix

| 功能或交互要求 | AionUI contract | AionUI source | AionUI pixel | Native contract | Native source | Native pixel | 验证入口与边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Product authority | \`aligned_contract\` | \`source_implemented\` | \`not_applicable\` | \`candidate_target\` | \`source_implemented\` | \`not_applicable\` | Contract only. |
| Chat-first visual | \`current_contract_deviation\` | \`source_partial\` | \`pixel_blocked\` | \`candidate_target\` | \`source_partial\` | \`pixel_verified\` | Pixel evidence does not imply parity. |
`;

function writeFile(root: string, relativePath: string, contents: string): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function copyFixtureFile(root: string, relativePath: string): void {
  writeFile(root, relativePath, fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

function createFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-gui-design-system-'));
  for (const relativePath of [
    'AGENTS.md',
    'docs/decisions.md',
    'docs/invariants.md',
    'docs/product/gui/gui-shell-candidates.md',
    'docs/product/gui/ideal-interaction-spec.md',
    'docs/product/gui/codex-to-opl-app-delta.md',
    'docs/product/gui/element-audit.md',
    'docs/product/gui/feature-inventory.md',
    'contracts/app-shell-candidates.json',
    'contracts/app-product-profile.json',
    'contracts/app-gui-product-contract.json',
    'contracts/app-page-state-matrix.json',
    'contracts/app-shell-adapter.json',
    'package.json',
  ]) {
    copyFixtureFile(root, relativePath);
  }

  const readme = [
    `product_definition=${designRoot}/README.md,${designRoot}/feature-inventory.md`,
    `visual_system=${designRoot}/ideal-interaction-spec.md,${designRoot}/visual-system.md,${designRoot}/codex-to-opl-app-delta.md,${designRoot}/element-audit.md`,
    `shell_implementation_conformance=${designRoot}/shell-implementation-guide.md,${designRoot}/shell-conformance-matrix.md`,
    `entry_docs=${designRoot}/README.md,${designRoot}/feature-inventory.md,${designRoot}/ideal-interaction-spec.md,${designRoot}/visual-system.md,${designRoot}/codex-to-opl-app-delta.md,${designRoot}/element-audit.md,${designRoot}/shell-implementation-guide.md,${designRoot}/shell-conformance-matrix.md`,
    'contract_refs=contracts/app-gui-product-contract.json,contracts/app-product-profile.json,contracts/app-page-state-matrix.json,contracts/app-shell-candidates.json,contracts/app-shell-adapter.json',
    shellAuthorityMarker,
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
  ].join('\n');
  writeFile(root, `${designRoot}/README.md`, `${readme}\n`);
  writeFile(root, `${designRoot}/visual-system.md`, '# Visual system\n');
  writeFile(root, `${designRoot}/shell-implementation-guide.md`, '# Shell implementation guide\n');
  writeFile(root, `${designRoot}/shell-conformance-matrix.md`, conformanceMatrix);
  return root;
}

test('GUI design-system validator accepts a complete fixture without promoting release readiness', () => {
  const root = createFixture();
  const summary = validateGuiDesignSystem(root);
  const profile = JSON.parse(fs.readFileSync(path.join(root, 'contracts/app-product-profile.json'), 'utf8'));
  assert.equal(summary.status, 'consistent');
  assert.equal(summary.release_ready, false);
  assert.equal(summary.codex_reference, codexReference);
  assert.equal(summary.superseded_codex_reference, supersededCodexReference);
  assert.equal(summary.reference_boundary.app_contract_status, 'aligned_contract');
  assert.equal(summary.reference_boundary.page_state_status, 'aligned_contract');
  assert.equal(summary.reference_boundary.native_candidate_status, 'current_contract_deviation');
  assert.equal(summary.state_boundary.ideal_native_rail_visible, true);
  assert.equal(summary.state_boundary.active_aionui_rail_state, 'collapsed');
  assert.equal(summary.state_boundary.active_aionui_conformance.rail_matches_ideal, false);
  assert.equal(summary.state_boundary.active_aionui_conformance.rail_status, 'current_contract_deviation');
  assert.equal(summary.state_boundary.active_aionui_conformance.inspector_matches_ideal, true);
  assert.equal(summary.state_boundary.active_aionui_conformance.permission_access_mode_status, 'current_contract_deviation');
  assert.equal(summary.state_boundary.active_aionui_conformance.side_panel_information_architecture_status, 'current_contract_deviation');
  assert.deepEqual(summary.model_defaults, {
    model: profile.codex.default_model,
    reasoning_effort: profile.codex.default_reasoning_effort,
  });
  assert.equal(summary.conformance_matrix.rows_validated, 2);
  assert.deepEqual(summary.conformance_matrix.status_axes, ['contract_status', 'source_status', 'pixel_status']);
  assert.equal(summary.conformance_matrix.pixel_verified_implies_visual_parity, false);
});

test('GUI design-system validator follows a changed App-profile reasoning default', () => {
  const root = createFixture();
  const profilePath = path.join(root, 'contracts/app-product-profile.json');
  const registryPath = path.join(root, 'contracts/app-shell-candidates.json');
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  profile.codex.default_reasoning_effort = 'future-effort';
  registry.candidates.find((candidate) => candidate.id === 'opl-native-workbench')
    .visual_parity_contract.default_reasoning_effort = 'future-effort';
  writeJson(root, 'contracts/app-product-profile.json', profile);
  writeJson(root, 'contracts/app-shell-candidates.json', registry);

  assert.equal(validateGuiDesignSystem(root).model_defaults.reasoning_effort, 'future-effort');
});

test('GUI design-system validator accepts an active AionUI rail that has converged to visible', () => {
  const root = createFixture();
  const profilePath = path.join(root, 'contracts', 'app-product-profile.json');
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  profile.gui.home.home_layout.workspace_session_rail_default_state = 'visible';
  writeJson(root, 'contracts/app-product-profile.json', profile);

  const summary = validateGuiDesignSystem(root);
  assert.equal(summary.state_boundary.active_aionui_rail_state, 'visible');
  assert.equal(summary.state_boundary.active_aionui_conformance.rail_matches_ideal, true);
  assert.equal(summary.state_boundary.active_aionui_conformance.rail_status, 'aligned_contract');
  assert.equal(summary.state_boundary.active_aionui_inspector_state, 'collapsed');
  assert.equal(summary.state_boundary.active_aionui_conformance.inspector_matches_ideal, true);
});

test('GUI design-system validator rejects a missing current interaction reference marker', () => {
  const root = createFixture();
  const readmePath = path.join(root, designRoot, 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8').replace(
    `current_interaction_reference=${codexReference}`,
    'current_interaction_reference=missing',
  );
  fs.writeFileSync(readmePath, readme, 'utf8');
  assert.throws(
    () => validateGuiDesignSystem(root),
    /must include exact marker current_interaction_reference=/,
  );
});

test('GUI design-system validator rejects a stale App-owned current baseline', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.current_reference.build = '26.707.31123';
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);
  assert.throws(
    () => validateGuiDesignSystem(root),
    /interaction_baseline current reference must be ChatGPT Codex macOS 26\.707\.31428/,
  );
});

test('GUI design-system validator rejects a page-state boundary that promotes contract target to source completion', () => {
  const root = createFixture();
  const matrixPath = path.join(root, 'contracts/app-page-state-matrix.json');
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  matrix.acceptance_boundary.contract_target_implies_source_complete = true;
  writeJson(root, 'contracts/app-page-state-matrix.json', matrix);
  assert.throws(
    () => validateGuiDesignSystem(root),
    /page-state acceptance boundary must keep human target separate from source and pixel completion/,
  );
});

test('GUI design-system validator rejects a stale foreground role marker', () => {
  const root = createFixture();
  const agentsPath = path.join(root, 'AGENTS.md');
  fs.writeFileSync(
    agentsPath,
    fs.readFileSync(agentsPath, 'utf8').replace('foreground=opl-native-workbench', 'foreground=hermes-codex'),
    'utf8',
  );
  assert.throws(() => validateGuiDesignSystem(root), /AGENTS\.md must include gui_shell_roles/);
});

test('GUI design-system validator rejects a document assigned to the wrong layer', () => {
  const root = createFixture();
  const readmePath = path.join(root, designRoot, 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8').replace(
    `product_definition=${designRoot}/README.md,${designRoot}/feature-inventory.md`,
    `product_definition=${designRoot}/README.md,${designRoot}/feature-inventory.md,${designRoot}/ideal-interaction-spec.md`,
  );
  fs.writeFileSync(readmePath, readme, 'utf8');
  assert.throws(
    () => validateGuiDesignSystem(root),
    /docs\/product\/gui\/README\.md must include exact marker product_definition=/,
  );
});

test('GUI design-system validator rejects a stale model copied into foundation docs', () => {
  const root = createFixture();
  fs.appendFileSync(path.join(root, designRoot, 'visual-system.md'), 'current_model=gpt-5.3-codex-spark\n');
  assert.throws(
    () => validateGuiDesignSystem(root),
    /governed GUI docs must not copy model catalogs or name non-default model gpt-5\.3-codex-spark/,
  );
});

test('GUI design-system validator rejects a positive readiness claim anywhere in the governed stack', () => {
  const root = createFixture();
  fs.appendFileSync(path.join(root, designRoot, 'feature-inventory.md'), '\nThe candidate is release-ready.\n');
  assert.throws(
    () => validateGuiDesignSystem(root),
    /must not make a positive release or production readiness claim/,
  );
});

test('GUI design-system validator rejects a candidate-owned ideal target', () => {
  const root = createFixture();
  const registryPath = path.join(root, 'contracts', 'app-shell-candidates.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  registry.design_system_governance.state_boundary.ideal_target.source_candidate = 'opl-native-workbench';
  writeJson(root, 'contracts/app-shell-candidates.json', registry);
  assert.throws(
    () => validateGuiDesignSystem(root),
    /ideal target must be App-owned and flow one-way to shells without a source candidate/,
  );
});

test('GUI design-system validator rejects a native ideal rail regression', () => {
  const root = createFixture();
  const registryPath = path.join(root, 'contracts', 'app-shell-candidates.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  registry.candidates.find((candidate) => candidate.id === 'opl-native-workbench')
    .target_product_shape.workspace_session_rail_default_visible = false;
  writeJson(root, 'contracts/app-shell-candidates.json', registry);
  assert.throws(
    () => validateGuiDesignSystem(root),
    /native candidate and ideal target must keep the desktop workspace\/session rail visible/,
  );
});

test('GUI design-system validator rejects a matrix row with no source status', () => {
  const root = createFixture();
  const matrixPath = path.join(root, designRoot, 'shell-conformance-matrix.md');
  const matrix = fs.readFileSync(matrixPath, 'utf8').replace('`source_implemented` | `not_applicable`', ' | `not_applicable`');
  fs.writeFileSync(matrixPath, matrix, 'utf8');
  assert.throws(
    () => validateGuiDesignSystem(root),
    /must declare exactly one AionUI source_status/,
  );
});

test('GUI design-system validator rejects an unknown matrix status', () => {
  const root = createFixture();
  const matrixPath = path.join(root, designRoot, 'shell-conformance-matrix.md');
  const matrix = fs.readFileSync(matrixPath, 'utf8').replace('`source_partial`', '`source_unknown`');
  fs.writeFileSync(matrixPath, matrix, 'utf8');
  assert.throws(
    () => validateGuiDesignSystem(root),
    /must declare exactly one AionUI source_status/,
  );
});

test('GUI design-system validator rejects legacy aligned-contract-only status', () => {
  const root = createFixture();
  const matrixPath = path.join(root, designRoot, 'shell-conformance-matrix.md');
  fs.appendFileSync(matrixPath, '\nLegacy: aligned-contract\n');
  assert.throws(
    () => validateGuiDesignSystem(root),
    /must not use legacy aligned-contract without independent source and pixel status/,
  );
});

test('GUI design-system validator allows pixel_verified with source_partial', () => {
  const root = createFixture();
  assert.doesNotThrow(() => validateGuiDesignSystem(root));
});
