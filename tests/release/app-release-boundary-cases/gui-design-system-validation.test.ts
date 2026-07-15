import { validateGuiDesignSystem } from '../../../scripts/validate-gui-design-system.ts';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assert, fs, os, path, test, appRoot } from './helpers.ts';

const shellAuthorityMarker = 'gui_shell_authority: implementation_only';
const codexReference = 'ChatGPT Codex macOS 26.707.41301 (2026-07-11)';
const supersededCodexReference = 'ChatGPT Codex macOS 26.707.31428 (2026-07-10)';
const earlierSupersededCodexReference = 'ChatGPT Codex macOS 26.707.31123 (2026-07-10)';
const designRoot = 'docs/product/gui';

const conformanceMatrix = `# Shell conformance matrix

- AionUI GUI conformance ancestor：\`opl-aion-shell@0000000000000000000000000000000000000000\`；fixture only。
- Current Shell source cohort：symbolic \`session_first_directory_current_source_cohort\`；fixture only。

| 功能或交互要求 | AionUI contract | AionUI source | AionUI pixel | Native contract | Native source | Native pixel | 验证入口与边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Product authority | \`aligned_contract\` | \`source_implemented\` | \`not_applicable\` | \`candidate_target\` | \`source_implemented\` | \`not_applicable\` | Contract only. |
| Chat-first visual | \`current_contract_deviation\` | \`source_partial\` | \`pixel_blocked\` | \`candidate_target\` | \`source_partial\` | \`pixel_verified\` | Pixel evidence does not imply parity. |
| 宽桌面 rail 默认展开且 \`280-340px\` 可调 | \`aligned_contract\` | \`source_partial\` | \`pixel_unverified\` | \`candidate_target\` | \`source_partial\` | \`pixel_unverified\` | Contract readback. |
| Permission/access mode 在 composer 可见且不用 backend/provider 术语 | \`aligned_contract\` | \`source_partial\` | \`pixel_unverified\` | \`current_contract_deviation\` | \`source_missing\` | \`pixel_unverified\` | Contract readback. |
| Advanced surfaces 默认无第三列；Files/Changes按需，Preview独立 | \`aligned_contract\` | \`source_partial\` | \`pixel_unverified\` | \`current_contract_deviation\` | \`source_partial\` | \`pixel_verified\` | Contract readback. |
| Terminal/Browser 从 Environment 或任务需要按需打开，无 Runtime duplicate | \`aligned_contract\` | \`source_partial\` | \`pixel_unverified\` | \`current_contract_deviation\` | \`source_partial\` | \`pixel_verified\` | Contract readback. |
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

function copyFixtureAsset(root: string, relativePath: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(appRoot, relativePath), target);
}

function refreshSourceManifestHash(root: string): void {
  const sourcePath = path.join(root, 'docs/product/gui/evidence/aionui-41301/source-manifest.json');
  const manifestPath = path.join(root, 'docs/product/gui/evidence/aionui-41301/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.source_manifest_sha256 = createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
  writeJson(root, 'docs/product/gui/evidence/aionui-41301/manifest.json', manifest);
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
    'docs/active/aionui-mainline-gui-convergence-plan.md',
    'contracts/app-shell-candidates.json',
    'contracts/app-product-profile.json',
    'contracts/app-gui-product-contract.json',
    'contracts/app-page-state-matrix.json',
    'contracts/app-shell-adapter.json',
    'docs/product/gui/evidence/aionui-41301/manifest.json',
    'docs/product/gui/evidence/aionui-41301/source-manifest.json',
    'package.json',
  ]) {
    copyFixtureFile(root, relativePath);
  }

  const guiContract = JSON.parse(fs.readFileSync(path.join(root, 'contracts/app-gui-product-contract.json'), 'utf8'));
  const historicalPixelShellSha =
    guiContract.interaction_baseline.acceptance_boundary.historical_pixel_shell_sha;
  const shellAdapter = JSON.parse(fs.readFileSync(path.join(root, 'contracts/app-shell-adapter.json'), 'utf8'));
  const guiConformanceRef = shellAdapter.shell_source.upstream_ref;
  const evidenceManifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/product/gui/evidence/aionui-41301/manifest.json'), 'utf8'));
  for (const entry of evidenceManifest.entries) copyFixtureAsset(root, entry.screenshot_path);

  const readme = [
    `product_definition=${designRoot}/README.md,${designRoot}/feature-inventory.md`,
    `visual_system=${designRoot}/ideal-interaction-spec.md,${designRoot}/visual-system.md,${designRoot}/codex-to-opl-app-delta.md,${designRoot}/element-audit.md`,
    `shell_implementation_conformance=${designRoot}/shell-implementation-guide.md,${designRoot}/shell-conformance-matrix.md`,
    `entry_docs=${designRoot}/README.md,${designRoot}/feature-inventory.md,${designRoot}/ideal-interaction-spec.md,${designRoot}/visual-system.md,${designRoot}/codex-to-opl-app-delta.md,${designRoot}/element-audit.md,${designRoot}/shell-implementation-guide.md,${designRoot}/shell-conformance-matrix.md`,
    'contract_refs=contracts/app-gui-product-contract.json,contracts/app-product-profile.json,contracts/app-page-state-matrix.json,contracts/app-shell-candidates.json,contracts/app-shell-adapter.json',
    shellAuthorityMarker,
    `current_interaction_reference=${codexReference}`,
    `superseded_interaction_observations=${supersededCodexReference},${earlierSupersededCodexReference}`,
    'human_target.owner=one-person-lab-app',
    'active_aionui.role=current_implementation_conformance_only',
    `active_aionui.gui_conformance_ref=${guiConformanceRef}`,
    'active_aionui.current_shell_head_source=active_shell_checkout_git_head',
    `active_aionui.historical_41301_evidence_sha=${historicalPixelShellSha}`,
    'runtime_cockpit.role=user_agent_collaboration_control_console',
    'runtime_cockpit.upstream_alignment_may_remove_or_weaken=false',
    'runtime_cockpit.acceptance_ref=contracts/app-page-state-matrix.json#pages[id=runtime].runtime_view_model.runtime_cockpit_acceptance',
    'docs_or_contract_imply_source_complete=false',
    'docs_or_contract_imply_pixel_complete=false',
    'ideal_target.workspace_session_rail_default_visible=true',
    'ideal_target.inspector_default_visible=false',
    'ideal_target.permission_access_mode_visible=true',
    'ideal_target.default_third_column_visible=false',
    'ideal_target.advanced_workspace_surfaces=files_changes,preview,terminal,browser',
    'active_aionui.state_source=contracts/app-product-profile.json#gui.home.home_layout',
  ].join('\n');
  writeFile(root, `${designRoot}/README.md`, `${readme}\n`);
  writeFile(root, `${designRoot}/visual-system.md`, '# Visual system\n');
  writeFile(root, `${designRoot}/shell-implementation-guide.md`, '# Shell implementation guide\n');
  writeFile(
    root,
    `${designRoot}/shell-conformance-matrix.md`,
    conformanceMatrix
      .replace('0000000000000000000000000000000000000000', guiConformanceRef)
      .replace('1111111111111111111111111111111111111111', guiConformanceRef),
  );
  return root;
}

function createShellCheckout(root: string): string {
  const shellRoot = path.join(root, 'shells/aionui');
  fs.mkdirSync(shellRoot, { recursive: true });
  execFileSync('git', ['init', '--quiet'], { cwd: shellRoot });
  writeFile(shellRoot, 'README.md', '# fixture shell\n');
  execFileSync('git', ['add', 'README.md'], { cwd: shellRoot });
  execFileSync(
    'git',
    ['-c', 'user.name=OPL Test', '-c', 'user.email=opl-test@example.invalid', 'commit', '--quiet', '-m', 'fixture'],
    { cwd: shellRoot },
  );
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: shellRoot, encoding: 'utf8' }).trim();
}

test('GUI design-system validator accepts a complete fixture without promoting release readiness', () => {
  const root = createFixture();
  const summary = validateGuiDesignSystem(root);
  const profile = JSON.parse(fs.readFileSync(path.join(root, 'contracts/app-product-profile.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'contracts/app-gui-product-contract.json'), 'utf8'));
  const historicalPixelShellSha =
    contract.interaction_baseline.acceptance_boundary.historical_pixel_shell_sha;
  assert.equal(summary.status, 'consistent');
  assert.equal(summary.release_ready, false);
  assert.equal(summary.codex_reference, codexReference);
  assert.equal(summary.superseded_codex_reference, supersededCodexReference);
  assert.equal(summary.reference_boundary.app_contract_status, 'aligned_contract');
  assert.equal(summary.reference_boundary.page_state_status, 'aligned_contract');
  assert.equal(summary.reference_boundary.native_candidate_status, 'aligned_contract');
  assert.equal(summary.state_boundary.ideal_native_rail_visible, true);
  assert.equal(summary.state_boundary.active_aionui_rail_state, 'visible_wide_drawer_narrow');
  assert.equal(summary.state_boundary.active_aionui_conformance.rail_matches_ideal, true);
  assert.equal(summary.state_boundary.active_aionui_conformance.rail_status, 'aligned_contract');
  assert.equal(summary.state_boundary.active_aionui_conformance.inspector_matches_ideal, true);
  assert.equal(summary.state_boundary.active_aionui_conformance.permission_access_mode_status, 'aligned_contract');
  assert.equal(summary.state_boundary.active_aionui_conformance.side_panel_information_architecture_status, 'aligned_contract');
  assert.deepEqual(summary.model_defaults, {
    model: profile.codex.default_model,
    reasoning_effort: profile.codex.default_reasoning_effort,
  });
  assert.equal(summary.conformance_matrix.rows_validated, 6);
  assert.deepEqual(summary.conformance_matrix.status_axes, ['contract_status', 'source_status', 'pixel_status']);
  assert.equal(summary.conformance_matrix.pixel_verified_implies_visual_parity, false);
  assert.deepEqual(summary.visual_evidence, {
    manifest: 'docs/product/gui/evidence/aionui-41301/manifest.json',
    shell_head: historicalPixelShellSha,
    entries_verified: 8,
    packaged_command: true,
  });
});

test('GUI design-system validator rejects a fixed Home shortcut limit', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.home.starter_limit = 4;
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /interaction baseline Home, conversation, composer, access, and task summary markers must match the App target/,
  );
});

test('GUI design-system validator rejects a duplicate Capabilities rail entry', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.navigation_rail.top_entries.push('capabilities');
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /interaction baseline navigation rail must preserve the governed desktop and narrow-window skeleton/,
  );
});

test('GUI design-system validator rejects a duplicate Capabilities selection surface', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.capability_selection.selection_surfaces.push('capabilities');
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /interaction baseline Home, conversation, composer, access, and task summary markers must match the App target/,
  );
});

test('GUI design-system validator rejects an unknown convergence plan state', () => {
  const root = createFixture();
  const planPath = path.join(root, 'docs/active/aionui-mainline-gui-convergence-plan.md');
  const currentPlan = fs.readFileSync(planPath, 'utf8');
  assert.match(currentPlan, /^State: `(active_parity_convergence|active_currentness_refresh|release_closeout_in_progress|complete)`$/m);
  const plan = currentPlan.replace(
    /^State: `(active_parity_convergence|active_currentness_refresh|release_closeout_in_progress|complete)`$/m,
    'State: `active_plan`',
  );
  fs.writeFileSync(planPath, plan, 'utf8');

  assert.throws(
    () => validateGuiDesignSystem(root),
    /must be in active_parity_convergence, active_currentness_refresh, release_closeout_in_progress, or complete state/,
  );
});

test('GUI design-system validator follows a changed App-profile reasoning default', () => {
  const root = createFixture();
  const profilePath = path.join(root, 'contracts/app-product-profile.json');
  const registryPath = path.join(root, 'contracts/app-shell-candidates.json');
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  profile.codex.default_reasoning_effort = 'future-effort';
  registry.candidates.find((candidate) => candidate.id === 'opl-native-workbench').visual_parity_contract.default_reasoning_effort =
    'future-effort';
  writeJson(root, 'contracts/app-product-profile.json', profile);
  writeJson(root, 'contracts/app-shell-candidates.json', registry);

  assert.equal(validateGuiDesignSystem(root).model_defaults.reasoning_effort, 'future-effort');
});

test('GUI design-system validator reports a collapsed active AionUI rail as a contract deviation', () => {
  const root = createFixture();
  const profilePath = path.join(root, 'contracts', 'app-product-profile.json');
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  profile.gui.home.home_layout.workspace_session_rail_default_state = 'collapsed';
  writeJson(root, 'contracts/app-product-profile.json', profile);
  const matrixPath = path.join(root, designRoot, 'shell-conformance-matrix.md');
  fs.writeFileSync(
    matrixPath,
    fs
      .readFileSync(matrixPath, 'utf8')
      .replace(
        '| 宽桌面 rail 默认展开且 `280-340px` 可调 | `aligned_contract`',
        '| 宽桌面 rail 默认展开且 `280-340px` 可调 | `current_contract_deviation`',
      ),
    'utf8',
  );

  const summary = validateGuiDesignSystem(root);
  assert.equal(summary.state_boundary.active_aionui_rail_state, 'collapsed');
  assert.equal(summary.state_boundary.active_aionui_conformance.rail_matches_ideal, false);
  assert.equal(summary.state_boundary.active_aionui_conformance.rail_status, 'current_contract_deviation');
  assert.equal(summary.state_boundary.active_aionui_inspector_state, 'collapsed');
  assert.equal(summary.state_boundary.active_aionui_conformance.inspector_matches_ideal, true);
});

test('GUI design-system validator rejects a missing current interaction reference marker', () => {
  const root = createFixture();
  const readmePath = path.join(root, designRoot, 'README.md');
  const readme = fs
    .readFileSync(readmePath, 'utf8')
    .replace(`current_interaction_reference=${codexReference}`, 'current_interaction_reference=missing');
  fs.writeFileSync(readmePath, readme, 'utf8');
  assert.throws(() => validateGuiDesignSystem(root), /must include exact marker current_interaction_reference=/);
});

test('GUI design-system validator rejects a stale App-owned current baseline', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.current_reference.build = '26.707.31123';
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);
  assert.throws(() => validateGuiDesignSystem(root), /schema v2 with current reference ChatGPT Codex macOS 26\.707\.41301/);
});

test('GUI design-system validator rejects the superseded v1 interaction baseline schema', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.schema_version = 1;
  contract.interaction_baseline.schema = 'opl_app_codex_interaction_baseline.v1';
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);
  assert.throws(() => validateGuiDesignSystem(root), /schema v2/);
});

test('GUI design-system validator rejects the legacy eight-surface inspector taxonomy', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.context_surfaces.side_panel.primary_tools = ['review', 'terminal', 'browser', 'files'];
  contract.interaction_baseline.context_surfaces.side_panel.secondary_sections = ['artifacts', 'runtime', 'actions', 'memory'];
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);
  assert.throws(() => validateGuiDesignSystem(root), /legacy equal-weight inspector taxonomy/);
});

test('GUI design-system validator rejects mixing OPL target entries into literal Codex observation', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  delete contract.interaction_baseline.literal_observation;
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);
  assert.throws(() => validateGuiDesignSystem(root), /must separate literal Codex observations from OPL-owned target translation/);
});

test('GUI design-system validator rejects removing the OPL Runtime entry for Codex parity', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.navigation_rail.top_entries = ['new_task', 'archived', 'capabilities'];
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);
  assert.throws(
    () => validateGuiDesignSystem(root),
    /interaction baseline navigation rail must preserve the governed desktop and narrow-window skeleton/,
  );
});

test('GUI design-system validator rejects weakening the Runtime cockpit for upstream parity', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.feature_preservation_policy.runtime_preservation_gate.upstream_alignment_may_remove_or_weaken = true;
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);
  assert.throws(
    () => validateGuiDesignSystem(root),
    /Codex reference alignment must preserve OPL-owned capabilities and same-change reachability/,
  );
});

test('GUI design-system validator rejects an undeclared candidate-registry Codex baseline', () => {
  const root = createFixture();
  const registryPath = path.join(root, 'contracts/app-shell-candidates.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  registry.design_system_governance.codex_reference.comparison_baseline = 'ChatGPT Codex macOS 0.0.0 (2026-07-11)';
  writeJson(root, 'contracts/app-shell-candidates.json', registry);
  assert.throws(
    () => validateGuiDesignSystem(root),
    /candidate registry Codex comparison baseline must be current or a declared superseded observation/,
  );
});

test('GUI design-system validator rejects a Native fallback to a superseded reference without deviation status', () => {
  const root = createFixture();
  const registryPath = path.join(root, 'contracts/app-shell-candidates.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  registry.candidates.find((candidate) => candidate.id === 'opl-native-workbench').visual_parity_contract.comparison_baseline =
    'ChatGPT Codex macOS 26.707.31123 (2026-07-10)';
  writeJson(root, 'contracts/app-shell-candidates.json', registry);
  assert.throws(
    () => validateGuiDesignSystem(root),
    /native candidate must explicitly declare its superseded Codex reference as a candidate deviation/,
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

test('GUI design-system validator rejects Runtime page-state acceptance weakened for upstream parity', () => {
  const root = createFixture();
  const matrixPath = path.join(root, 'contracts/app-page-state-matrix.json');
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  matrix.acceptance_boundary.runtime_upstream_alignment_may_remove_or_weaken = true;
  writeJson(root, 'contracts/app-page-state-matrix.json', matrix);
  assert.throws(
    () => validateGuiDesignSystem(root),
    /page-state acceptance boundary must keep human target separate from source and pixel completion/,
  );
});

test('GUI design-system validator rejects a historical evidence binding that drifts from its manifest', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.acceptance_boundary.historical_pixel_shell_sha =
    '0000000000000000000000000000000000000000';
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /AionUI 41301 visual evidence manifest must bind eight packaged route\/layout entries/,
  );
});

test('GUI design-system validator rejects treating historical pixels as the current source head', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.acceptance_boundary.current_source_head_source = 'contract_static_sha';
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /interaction baseline must keep the human target separate from source, pixel, and release completion/,
  );
});

test('GUI design-system validator rejects a GUI ancestor that drifts from the conformance snapshot', () => {
  const root = createFixture();
  const adapterPath = path.join(root, 'contracts/app-shell-adapter.json');
  const adapter = JSON.parse(fs.readFileSync(adapterPath, 'utf8'));
  adapter.shell_source.upstream_ref = '0000000000000000000000000000000000000000';
  writeJson(root, 'contracts/app-shell-adapter.json', adapter);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /shell conformance matrix GUI conformance ancestor must match the active shell adapter/,
  );
});

test('GUI design-system validator reads the current checkout without pinning its transient HEAD in human docs', () => {
  const root = createFixture();
  const currentHead = createShellCheckout(root);
  const matrixPath = path.join(root, 'docs/product/gui/shell-conformance-matrix.md');
  const matrix = fs.readFileSync(matrixPath, 'utf8');
  assert.equal(validateGuiDesignSystem(root).status, 'consistent');

  writeFile(
    root,
    'docs/product/gui/shell-conformance-matrix.md',
    matrix.replace(
      'symbolic `session_first_directory_current_source_cohort`',
      `\`opl-aion-shell@${currentHead}\``,
    ),
  );
  assert.throws(
    () => validateGuiDesignSystem(root),
    /must use the symbolic current Shell source cohort without pinning a transient HEAD/,
  );
});

test('GUI design-system validator rejects artifact preview body copying or unsafe ref guessing', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.artifact_preview.artifact_body_authority = 'shell_copy';
  contract.interaction_baseline.artifact_preview.unsafe_or_unsupported_ref_policy = 'guess_content';
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /artifact preview must reuse the existing Preview surface through a ref-only fail-closed adapter/,
  );
});

test('GUI design-system validator rejects workspace-readiness gating explicit session local inputs', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.conversation_scope.explicit_session_input_policy
    .workspace_readiness_boundary.send_scoped_local_file_inputs_require_workspace_root = true;
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /interaction baseline Home, conversation, composer, access, and task summary markers must match the App target/,
  );
});

test('GUI design-system validator rejects workspace-owned sessions and lossy workspace rebinding', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const sessionWorkspaceModel = contract.interaction_baseline.conversation_scope.session_workspace_model;
  sessionWorkspaceModel.workspace_owns_session = true;
  sessionWorkspaceModel.workspace_change_forbids = ['preserve_thread_id_by_copying_history'];
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /conversation scope must keep the canonical session identity while treating workspace as mutable cwd and grouping metadata/,
  );
});

test('GUI design-system validator rejects directory cascade delete and stale Codex cache authority', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const threadDirectory = contract.interaction_baseline.navigation_rail.thread_directory_policy;
  threadDirectory.directory_group_policy.cascade_session_delete_allowed = true;
  threadDirectory.stale_codex_acp_cache_row_policy = 'preserve_in_ordinary_projection';
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /interaction baseline navigation rail must preserve the governed desktop and narrow-window skeleton/,
  );
});

test('GUI design-system validator rejects restored workspace-scoped project context inputs', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.conversation_scope.project_context_inputs = {
    scope: 'canonical_workspace_path',
  };
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /interaction baseline Home, conversation, composer, access, and task summary markers must match the App target/,
  );
});

test('GUI design-system validator rejects a shell-owned ordinary rail thread history', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.navigation_rail.thread_directory_policy.shell_thread_history_authority = true;
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /interaction baseline navigation rail must preserve the governed desktop and narrow-window skeleton/,
  );
});

test('GUI design-system validator rejects a workspace-only explicit local artifact preview', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.artifact_preview.explicit_local_path_policy.workspace_membership_required = true;
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /artifact preview must reuse the existing Preview surface through a ref-only fail-closed adapter/,
  );
});

test('GUI design-system validator rejects ordinary-navigation coordination and duplicate-error idempotency', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.thread_coordination.ordinary_navigation_visible = true;
  contract.interaction_baseline.thread_coordination.idempotency_policy.same_key_retry_behavior =
    'return_duplicate_error';
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /cross-top-level coordination must preserve Codex App flexibility while keeping OPL metadata, advisories, idempotency, and audit/,
  );
});

test('GUI design-system validator rejects an English-first locale default without an explicit preference', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.ui_locale_policy.first_launch_without_preference = 'default_en-US_before_first_render';
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /GUI contract and product profile must detect system locale before first render/,
  );
});

test('GUI design-system validator rejects approval-required as an immediate dispatch failure', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.thread_coordination.hard_failure_conditions = [
    'codex_permission_denied_or_approval_required',
  ];
  contract.interaction_baseline.thread_coordination.interactive_server_request_policy.pending_state_role =
    'dispatch_failure';
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /cross-top-level coordination must preserve Codex App flexibility while keeping OPL metadata, advisories, idempotency, and audit/,
  );
});

test('GUI design-system validator rejects a post-start access authority that omits the Codex sandbox', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.thread_coordination.post_start_filesystem_access_authority =
    'codex_native_permissions_and_approval';
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /cross-top-level coordination must preserve Codex App flexibility while keeping OPL metadata, advisories, idempotency, and audit/,
  );
});

test('GUI design-system validator rejects rail evidence as proof of model-facing host-tool access', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.thread_coordination.model_tool_access_evidence_boundary = {
    protocol_surface: 'ordinary_rail_thread_directory',
    implementation_evidence_required: 'rail_entry_visible',
    user_coordination_surface_evidence_sufficient: true,
    missing_implementation_state: 'source_implemented',
  };
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /cross-top-level coordination must preserve Codex App flexibility while keeping OPL metadata, advisories, idempotency, and audit/,
  );
});

test('GUI design-system validator rejects a shell-local workaround for model-facing host tools', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const evidence = contract.interaction_baseline.thread_coordination.model_tool_access_evidence_boundary;
  evidence.current_blocker = 'post_hoc_handler_is_sufficient';
  evidence.required_owner_routes = ['shell_local_handler'];
  evidence.forbidden_workarounds = [];
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /cross-top-level coordination must preserve Codex App flexibility while keeping OPL metadata, advisories, idempotency, and audit/,
  );
});

test('GUI design-system validator rejects a false line-comment source-complete claim', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.context_surfaces.review_pane.source_capability_status.inline_comments =
    'source_implemented_shell_annotation_store';
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /interaction baseline must reject the legacy equal-weight inspector taxonomy and keep Settings in maintenance/,
  );
});

test('GUI design-system validator rejects duplicate Git stores for Worktree and Review parity', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.conversation_scope.local_worktree_lifecycle.duplicate_git_or_thread_store_allowed = true;
  contract.interaction_baseline.context_surfaces.review_pane.duplicate_git_store_allowed = true;
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /interaction baseline Home, conversation, composer, access, and task summary markers must match the App target|interaction baseline must reject the legacy equal-weight inspector taxonomy/,
  );
});

test('GUI design-system validator rejects lossy Worktree snapshot, cleanup, and cross-host claims', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const lifecycle = contract.interaction_baseline.conversation_scope.local_worktree_lifecycle;
  lifecycle.snapshot_restore.durable_git_ref_namespace = 'shell-local-snapshot-store';
  lifecycle.cleanup.snapshot_precondition = 'remove_before_snapshot';
  lifecycle.cross_host.success_projection_allowed = true;
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /interaction baseline Home, conversation, composer, access, and task summary markers must match the App target/,
  );
});

test('GUI design-system validator rejects send_input as a cross-top-level thread bus', () => {
  const root = createFixture();
  const contractPath = path.join(root, 'contracts/app-gui-product-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.interaction_baseline.thread_coordination.same_agent_tree_transport.cross_top_level_use_forbidden = false;
  contract.interaction_baseline.thread_coordination.cross_top_level_protocol = ['send_input'];
  writeJson(root, 'contracts/app-gui-product-contract.json', contract);

  assert.throws(
    () => validateGuiDesignSystem(root),
    /cross-top-level coordination must preserve Codex App flexibility while keeping OPL metadata, advisories, idempotency, and audit/,
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
  const readme = fs
    .readFileSync(readmePath, 'utf8')
    .replace(
      `product_definition=${designRoot}/README.md,${designRoot}/feature-inventory.md`,
      `product_definition=${designRoot}/README.md,${designRoot}/feature-inventory.md,${designRoot}/ideal-interaction-spec.md`,
    );
  fs.writeFileSync(readmePath, readme, 'utf8');
  assert.throws(() => validateGuiDesignSystem(root), /docs\/product\/gui\/README\.md must include exact marker product_definition=/);
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
  assert.throws(() => validateGuiDesignSystem(root), /must not make a positive release or production readiness claim/);
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
  registry.candidates.find(
    (candidate) => candidate.id === 'opl-native-workbench',
  ).target_product_shape.workspace_session_rail_default_visible = false;
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
  assert.throws(() => validateGuiDesignSystem(root), /must declare exactly one AionUI source_status/);
});

test('GUI design-system validator rejects an unknown matrix status', () => {
  const root = createFixture();
  const matrixPath = path.join(root, designRoot, 'shell-conformance-matrix.md');
  const matrix = fs.readFileSync(matrixPath, 'utf8').replace('`source_partial`', '`source_unknown`');
  fs.writeFileSync(matrixPath, matrix, 'utf8');
  assert.throws(() => validateGuiDesignSystem(root), /must declare exactly one AionUI source_status/);
});

test('GUI design-system validator rejects a stale dynamic AionUI contract row', () => {
  const root = createFixture();
  const matrixPath = path.join(root, designRoot, 'shell-conformance-matrix.md');
  fs.writeFileSync(
    matrixPath,
    fs
      .readFileSync(matrixPath, 'utf8')
      .replace(
        '| Permission/access mode 在 composer 可见且不用 backend/provider 术语 | `aligned_contract`',
        '| Permission/access mode 在 composer 可见且不用 backend/provider 术语 | `current_contract_deviation`',
      ),
    'utf8',
  );
  assert.throws(() => validateGuiDesignSystem(root), /Permission\/access mode.*must report AionUI contract_status aligned_contract/);
});

test('GUI design-system validator requires an exact AionUI GUI conformance ancestor', () => {
  const root = createFixture();
  const matrixPath = path.join(root, designRoot, 'shell-conformance-matrix.md');
  fs.writeFileSync(matrixPath, fs.readFileSync(matrixPath, 'utf8').replace(/opl-aion-shell@[0-9a-f]{40}/, 'opl-aion-shell@stale'), 'utf8');
  assert.throws(() => validateGuiDesignSystem(root), /must bind an exact 40-character AionUI GUI conformance ancestor/);
});

test('GUI design-system validator rejects legacy aligned-contract-only status', () => {
  const root = createFixture();
  const matrixPath = path.join(root, designRoot, 'shell-conformance-matrix.md');
  fs.appendFileSync(matrixPath, '\nLegacy: aligned-contract\n');
  assert.throws(() => validateGuiDesignSystem(root), /must not use legacy aligned-contract without independent source and pixel status/);
});

test('GUI design-system validator allows pixel_verified with source_partial', () => {
  const root = createFixture();
  assert.doesNotThrow(() => validateGuiDesignSystem(root));
});

test('GUI design-system validator rejects promoted and source evidence timestamp drift', () => {
  const root = createFixture();
  const sourcePath = path.join(root, 'docs/product/gui/evidence/aionui-41301/source-manifest.json');
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  source.generated_at = '2026-07-11T00:00:00.000Z';
  writeJson(root, 'docs/product/gui/evidence/aionui-41301/source-manifest.json', source);
  refreshSourceManifestHash(root);

  assert.throws(() => validateGuiDesignSystem(root), /must share one exact ISO generated_at timestamp/);
});

test('GUI design-system validator rejects promoted and source evidence scope drift', () => {
  const root = createFixture();
  const sourcePath = path.join(root, 'docs/product/gui/evidence/aionui-41301/source-manifest.json');
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  source.evidence_scope = 'route_state_only';
  writeJson(root, 'docs/product/gui/evidence/aionui-41301/source-manifest.json', source);
  refreshSourceManifestHash(root);

  assert.throws(() => validateGuiDesignSystem(root), /must share the route-state and layout-only evidence_scope/);
});

test('GUI design-system validator rejects promoted and source evidence claim drift', () => {
  const root = createFixture();
  const sourcePath = path.join(root, 'docs/product/gui/evidence/aionui-41301/source-manifest.json');
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  source.claims.parity_1_to_1 = true;
  writeJson(root, 'docs/product/gui/evidence/aionui-41301/source-manifest.json', source);
  refreshSourceManifestHash(root);

  assert.throws(() => validateGuiDesignSystem(root), /evidence claims must be identical and limited to the governed claim set/);
});

test('GUI design-system validator rejects promoted and source evidence entry ID drift', () => {
  const root = createFixture();
  const sourcePath = path.join(root, 'docs/product/gui/evidence/aionui-41301/source-manifest.json');
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  source.entries[0].id = 'stale-entry-id';
  writeJson(root, 'docs/product/gui/evidence/aionui-41301/source-manifest.json', source);
  refreshSourceManifestHash(root);

  assert.throws(() => validateGuiDesignSystem(root), /must preserve the same ordered entry ID set/);
});
