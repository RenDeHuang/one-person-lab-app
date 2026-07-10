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
const codexReference = 'ChatGPT Codex macOS 26.707.31123 (2026-07-10)';
const designRoot = 'docs/product/gui';

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
    'product_definition',
    'visual_system',
    'shell_implementation_conformance',
    'docs/product/gui/ideal-interaction-spec.md',
    'docs/product/gui/codex-to-opl-app-delta.md',
    'docs/product/gui/feature-inventory.md',
    `${designRoot}/visual-system.md`,
    `${designRoot}/shell-implementation-guide.md`,
    `${designRoot}/shell-conformance-matrix.md`,
    'contracts/app-gui-product-contract.json',
    'contracts/app-product-profile.json',
    'contracts/app-page-state-matrix.json',
    'contracts/app-shell-candidates.json',
    'contracts/app-shell-adapter.json',
    shellAuthorityMarker,
    codexReference,
    'ideal_target.workspace_session_rail_default_visible=true',
    'ideal_target.inspector_default_visible=false',
    'active_aionui.workspace_session_rail_default_state=collapsed',
    'active_aionui.right_context_inspector_default_state=collapsed',
  ].join('\n');
  writeFile(root, `${designRoot}/README.md`, `${readme}\n`);
  writeFile(root, `${designRoot}/visual-system.md`, '# Visual system\n');
  writeFile(root, `${designRoot}/shell-implementation-guide.md`, '# Shell implementation guide\n');
  writeFile(root, `${designRoot}/shell-conformance-matrix.md`, '# Shell conformance matrix\n');
  return root;
}

test('GUI design-system validator accepts a complete fixture without promoting release readiness', () => {
  const summary = validateGuiDesignSystem(createFixture());
  assert.equal(summary.status, 'consistent');
  assert.equal(summary.release_ready, false);
  assert.equal(summary.state_boundary.ideal_native_rail_visible, true);
  assert.equal(summary.state_boundary.active_aionui_rail_state, 'collapsed');
  assert.deepEqual(summary.model_defaults, { model: 'gpt-5.6-sol', reasoning_effort: 'ultra' });
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

test('GUI design-system validator rejects a stale model copied into foundation docs', () => {
  const root = createFixture();
  fs.appendFileSync(path.join(root, designRoot, 'visual-system.md'), 'current_model=gpt-5.3-codex-spark\n');
  assert.throws(
    () => validateGuiDesignSystem(root),
    /foundation docs must not copy model catalogs or name non-default model gpt-5\.3-codex-spark/,
  );
});

test('GUI design-system validator rejects a native rail regression while active AionUI remains collapsed', () => {
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
