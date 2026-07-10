import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateAppGuiProductContract } from '../../scripts/validate-active-shell/gui-product-contract-validator.ts';
import { validatePrimaryInteractionPages } from '../../scripts/validate-active-shell/page-state-primary-interaction-validator.ts';
import { validateProductProfile } from '../../scripts/validate-active-shell/product-profile-validator.ts';
import { assertCurrentGuidHomeSelectionSources } from '../../scripts/validate-active-shell/shell-ordinary-experience-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

test('Codex interaction surfaces stay aligned across the App profile and contracts', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  assert.doesNotThrow(() => validateProductProfile(
    readJson('contracts/app-product-profile.json'),
    installExposure,
  ));
  assert.doesNotThrow(() => validateAppGuiProductContract(
    readJson('contracts/app-gui-product-contract.json'),
    readJson('contracts/app-release-channel.json'),
    installExposure,
  ));
  assert.doesNotThrow(() => validatePrimaryInteractionPages(
    readJson('contracts/app-page-state-matrix.json'),
  ));
});

test('product profile rejects pre-Codex-baseline interaction states', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  for (const mutate of [
    (profile: any) => { profile.gui.home.permission_mode_selector_visible = false; },
    (profile: any) => { profile.gui.home.conversation_permission_mode_selector_visible = false; },
    (profile: any) => { profile.gui.home.home_layout.workspace_session_rail_default_state = 'collapsed'; },
    (profile: any) => { profile.gui.ordinary_conversation.entry_source = 'home_purpose_entry_or_new_conversation'; },
    (profile: any) => { profile.gui.ordinary_conversation.composer_position = 'pinned_bottom'; },
    (profile: any) => { profile.gui.ordinary_conversation.permission_mode_selector_visible = false; },
    (profile: any) => { profile.gui.right_context_inspector.tabs = []; },
  ]) {
    const profile = structuredClone(readJson('contracts/app-product-profile.json'));
    mutate(profile);
    assert.throws(() => validateProductProfile(profile, installExposure));
  }
});

test('active-shell source gate requires Home starters and Capabilities routing instead of retired selectors', () => {
  const currentSources = {
    guidPage: [
      'HomeStarters',
      'activeCapabilityId={selectedAssistantRecord?.id}',
      'onSelect={(assistantId) =>',
      'onClear={() =>',
    ].join('\n'),
    homeStarters: [
      "data-testid='opl-home-starters'",
      'aria-pressed={active}',
      'active && onClear ? onClear() : onSelect(assistant.id)',
    ].join('\n'),
    capabilitiesPage: [
      'useCustomAgentsLoader',
      "navigate('/guid', {",
      'state: { selectedCapabilityId: capability.id }',
    ].join('\n'),
  };
  assert.doesNotThrow(() => assertCurrentGuidHomeSelectionSources(currentSources));
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      guidPage: `${currentSources.guidPage}\nAssistantSelectionArea\nMentionSelectorBadge`,
    }),
  );
});

test('GUI contract rejects Auto model policy source drift from the App product profile', () => {
  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.executor_policy.auto_model_policy_source_ref = 'shell-local-policy';

  assert.throws(() => validateAppGuiProductContract(
    guiContract,
    readJson('contracts/app-release-channel.json'),
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('product profile rejects static allowlist semantics for future Codex defaults', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  productProfile.codex.auto_model_policy.unknown_default_model_policy = 'reject_unknown_models';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('product profile rejects reasoning policies that do not use the highest CLI-advertised effort', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  productProfile.codex.auto_model_policy.unknown_model_reasoning_effort_policy = 'use_app_default';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('product profile rejects Codex CLI catalog field drift', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  productProfile.codex.auto_model_policy.catalog_default_model_field = 'default';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));

  productProfile.codex.auto_model_policy.catalog_default_model_field = 'isDefault';
  productProfile.codex.auto_model_policy.catalog_supported_reasoning_efforts_field = 'reasoningEfforts';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('product profile freezes the real paginated Codex model/list response shape', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  const policy = productProfile.codex.auto_model_policy;

  assert.equal(policy.catalog_response_models_field, 'data');
  assert.equal(policy.catalog_pagination_request_cursor_field, 'cursor');
  assert.equal(policy.catalog_pagination_response_cursor_field, 'nextCursor');
  assert.equal(policy.catalog_pagination_completion_policy, 'exhaust_pages_until_next_cursor_is_null');
  assert.equal(policy.catalog_supported_reasoning_effort_option_value_field, 'reasoningEffort');
  assert.equal(policy.catalog_hidden_model_field, 'hidden');
  assert.equal(policy.catalog_hidden_model_policy, 'exclude_hidden_models_from_auto_and_fixed_options');
});

test('Auto display contract keeps runtime resolution out of the static App profile', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  const auto = productProfile.gui.home.codex_model_display_options.auto_option;

  assert.equal('resolved_model' in auto, false);
  assert.equal('resolved_reasoning_effort' in auto, false);
  assert.equal(auto.catalog_unavailable_fallback_model, 'gpt-5.6-sol');
  assert.equal(auto.catalog_unavailable_fallback_reasoning_effort, 'xhigh');
});

test('Auto persistence contract defines reasoning override and stale fixed selection behavior', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  const persistence = productProfile.codex.auto_model_policy.persistence_policy;

  assert.equal(persistence.state_encoding, 'auto_has_no_model_snapshot_fixed_has_model_and_reasoning');
  assert.equal(persistence.reasoning_override_from_auto, 'pin_current_resolved_model_and_exit_auto');
  assert.equal(
    persistence.stale_fixed_model,
    'preserve_fixed_selection_as_unavailable_until_user_restores_auto_or_selects_available_model',
  );
});

test('product profile rejects known 5.6 Sol reasoning override drift', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  productProfile.codex.auto_model_policy.known_model_reasoning_effort_overrides['gpt-5.6-sol'] = 'ultra';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('product profile rejects persisting Auto as a resolved model snapshot', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  productProfile.codex.auto_model_policy.persistence_policy.auto = 'persist_resolved_model';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('product profile rejects catalog fallback drift from 5.6 Sol xhigh', () => {
  const productProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  productProfile.codex.auto_model_policy.catalog_unavailable_fallback.reasoning_effort = 'high';

  assert.throws(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('GUI contract rejects Codex selector button policies that allow an Auto prefix', () => {
  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.executor_policy.model_display_options_policy.button_label_policy =
    'auto_or_fixed_model_compact_label_with_selected_reasoning_effort';

  assert.throws(() => validateAppGuiProductContract(
    guiContract,
    readJson('contracts/app-release-channel.json'),
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('page-state matrix rejects Codex Auto policy source drift', () => {
  const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
  const guidHome = matrix.pages.find(({ id }) => id === 'guid_home');
  guidHome.home_view_model.codex_auto_model_policy_ref = 'shell-local-policy';

  assert.throws(() => validatePrimaryInteractionPages(matrix));
});
