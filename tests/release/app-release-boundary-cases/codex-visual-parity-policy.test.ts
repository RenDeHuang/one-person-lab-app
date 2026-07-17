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
  const guiContract = JSON.parse(
    readFileSync(join(appRoot, 'contracts/app-gui-product-contract.json'), 'utf8'),
  );
  const productProfile = JSON.parse(
    readFileSync(join(appRoot, 'contracts/app-product-profile.json'), 'utf8'),
  );

  assert.match(readme, /codex-app-visual-parity\.md/);
  assert.match(policy, /visual_parity_target=codex_app_1_to_1_except_opl_owned_deltas/);
  assert.match(policy, /visual_reference=ChatGPT Codex macOS 26\.707\.72221 build 5307/);
  assert.match(policy, /project_owns_session=false/);
  assert.match(policy, /project_context_row=forbidden/);
  assert.match(policy, /conversation_search_location=rail_history_header_icon_button/);
  assert.match(policy, /composer_resting_shadow=required/);
  assert.match(policy, /home_starter_selected_alignment=centered_no_layout_shift/);
  assert.match(policy, /settings_surface_audit=all_routes_light_dark_desktop_narrow/);
  assert.match(policy, /temporal_maintenance=server_worker_detect_install_configure_start_restart_run_now_readback/);
  assert.match(
    policy,
    /temporal_server_supervisor=login_resident_stable_launcher_run_at_load_keep_alive_repairable/,
  );
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

  const homeVisual = guiContract.interaction_baseline.home.visual_structure;
  assert.equal(homeVisual.starter_typography, '13/18/500');
  assert.equal(
    homeVisual.starter_content_alignment,
    'icon_label_and_check_share_one_vertical_centerline',
  );
  assert.equal(homeVisual.selected_starter_layout_shift_allowed, false);
  assert.deepStrictEqual(guiContract.interaction_baseline.composer.visual_metrics, {
    textarea_typography: '14/20/400',
    bottom_control_typography: '12/18/400_or_500',
    bottom_control_max_font_px: 12,
    icon_size_px: 16,
    action_height_px: 32,
    border_px: 1,
    corner_radius_px: 22,
    resting_shadow_source:
      'interaction_baseline.visual_target.light_surfaces.composer_shadow_or_dark_surfaces.composer_shadow',
    focus_geometry_policy:
      'enhance_border_or_ring_without_removing_resting_shadow_or_changing_size',
  });
  assert.deepStrictEqual(guiContract.utility_icon_policy.icon_text_action_geometry, {
    icon_size_px: 16,
    icon_slot_px: 20,
    icon_color: 'currentColor',
    icon_background: 'transparent_none',
    icon_label_gap_px: 8,
    alignment: 'icon_slot_and_label_share_one_vertical_centerline',
    contrast_policy: 'button_foreground_color_applies_to_icon_and_label_together',
    disabled_policy:
      'apply_disabled_opacity_to_the_whole_control_never_hide_only_the_icon',
  });
  assert.deepStrictEqual(
    productProfile.gui.home.utility_icon_policy,
    guiContract.utility_icon_policy,
  );
  assert.equal(guiContract.home_layout.workspace_selector_visible, false);
  assert.equal(guiContract.home_layout.projectless_context_placeholder_visible, false);
  assert.deepStrictEqual(
    guiContract.ordinary_conversation.unified_context_menu.groups.map(
      (group: { id: string }) => group.id,
    ),
    ['local_inputs', 'working_directory', 'skills', 'apps_and_connections'],
  );
  assert.ok(
    guiContract.ordinary_conversation.unified_context_menu.forbidden_entries.includes(
      'unavailable_or_synthetic_plugins',
    ),
  );
  const catalogPolicy = productProfile.gui.agent_package_registry.catalog_presentation_policy;
  assert.deepStrictEqual(catalogPolicy.section_order, [
    'professional_agents',
    'workflow_profiles',
    'shared_dependencies',
    'other_packages',
  ]);
  assert.equal(catalogPolicy.raw_package_role_visible, false);
  assert.equal(
    catalogPolicy.dependency_hierarchy.source,
    'app_state.agent_packages.status_index.packages[].dependent_guard.required_by_package_ids',
  );
  assert.equal(catalogPolicy.dependency_hierarchy.hardcoded_package_relationships_allowed, false);
  assert.equal(catalogPolicy.dependency_hierarchy.duplicate_rows_allowed, false);
  assert.equal(
    guiContract.interaction_baseline.visual_target.light_surfaces.composer_shadow,
    '0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.05)',
  );
  assert.equal(
    guiContract.interaction_baseline.visual_target.dark_surfaces.composer_shadow,
    '0 1px 2px rgba(0, 0, 0, 0.28), 0 4px 12px rgba(0, 0, 0, 0.18)',
  );
  const settingsAudit =
    guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations
      .settings_component_audit;
  assert.deepStrictEqual(settingsAudit.allowed_bounded_group_kinds, [
    'repeated_entity',
    'confirmation',
  ]);
  assert.equal(settingsAudit.source_dom_or_single_screenshot_only_is_sufficient, false);
  assert.ok(settingsAudit.checks.includes('no_nested_card_or_border_wall'));
  assert.ok(settingsAudit.checks.includes('icon_uses_currentColor_with_stable_slot_and_visible_contrast'));
});
