import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const appRoot = join(import.meta.dirname, '..', '..', '..');

test('Codex visual parity policy is discoverable and keeps sessions primary', () => {
  const readme = readFileSync(join(appRoot, 'docs/product/gui/README.md'), 'utf8');
  const policy = readFileSync(join(appRoot, 'docs/product/gui/codex-app-visual-parity.md'), 'utf8');
  const delta = readFileSync(join(appRoot, 'docs/product/gui/codex-to-opl-app-delta.md'), 'utf8');
  const visualSystem = readFileSync(join(appRoot, 'docs/product/gui/visual-system.md'), 'utf8');
  const conformance = readFileSync(join(appRoot, 'docs/product/gui/shell-conformance-matrix.md'), 'utf8');

  assert.match(readme, /codex-app-visual-parity\.md/);
  assert.match(policy, /visual_parity_target=codex_app_1_to_1_except_opl_owned_deltas/);
  assert.match(policy, /visual_reference=ChatGPT Codex macOS 26\.707\.72221 build 5307/);
  assert.match(policy, /project_owns_session=false/);
  assert.match(policy, /project_context_row=forbidden/);
  assert.match(policy, /conversation_search_location=rail_history_header_icon_button/);
  assert.match(policy, /composer_resting_shadow=required/);
  assert.match(policy, /aioncore_modification=forbidden/);
  assert.match(policy, /visual_acceptance=source_dom_and_installed_pixels/);
  assert.match(policy, /candidate_shell_commit_source=active_shell_checkout_git_head/);
  assert.doesNotMatch(policy, /candidate_shell_commit=[0-9a-f]{40}/);
  assert.match(policy, /candidate_webui_pixels=pending_on_clean_release_cohort/);
  assert.match(policy, /installed_pixel_acceptance=pending/);
  assert.match(policy, /visual_parity_complete=false/);
  assert.match(visualSystem, /26\.707\.72221 \/ build 5307/);
  assert.match(visualSystem, /grouped-row Control Center/);
  assert.doesNotMatch(conformance, /默认 cwd、分组与 context hint/);
  assert.match(delta, /稳定视觉 chrome 逐像素对齐/);
  assert.doesNotMatch(delta, /不宣称逐像素或逐行为复制/);
});
