import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function readJson(path: string): any {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

test('global titlebar feedback opens a prefilled OPL App GitHub issue', () => {
  const gui = readJson('contracts/app-gui-product-contract.json');
  const profile = readJson('contracts/app-product-profile.json');
  const expected = {
    placement: 'titlebar_trailing_utility',
    icon: 'circle_question',
    icon_style: 'regular_outline',
    target_url: 'https://github.com/gaofeng21cn/one-person-lab-app/issues/new',
    open_mode: 'external_browser_user_review_and_submit',
    prefill_fields: ['localized_title', 'localized_body', 'current_route', 'app_release_version'],
    startup_failure_action: {
      placement: 'blocking_startup_failure_dialog',
      delivery_channel: 'electron_main_process_native_open_external_via_preload_ipc',
      backend_dependency: 'none',
      submission_policy: 'external_browser_user_review_and_submit',
      automatic_submission: false,
      prefill_fields: [
        'localized_title',
        'localized_body',
        'app_release_version',
        'platform',
        'architecture',
        'startup_failure_reason',
        'backend_boundary_code',
        'backend_boundary_stage',
      ],
      automatic_attachment_policy: 'forbidden_no_logs_paths_credentials_or_user_content',
    },
    shell_local_delivery_forbidden: true,
  };

  assert.deepEqual(gui.utility_icon_policy.global_feedback_action, expected);
  assert.deepEqual(profile.gui.home.utility_icon_policy.global_feedback_action, expected);
});

test('blocking startup feedback remains usable without the backend and requires user review', () => {
  const gui = readJson('contracts/app-gui-product-contract.json');
  const startupAction = gui.utility_icon_policy.global_feedback_action.startup_failure_action;

  assert.equal(startupAction.backend_dependency, 'none');
  assert.equal(startupAction.delivery_channel, 'electron_main_process_native_open_external_via_preload_ipc');
  assert.equal(startupAction.submission_policy, 'external_browser_user_review_and_submit');
  assert.equal(startupAction.automatic_submission, false);
  assert.equal(
    startupAction.automatic_attachment_policy,
    'forbidden_no_logs_paths_credentials_or_user_content',
  );
});

test('navigation account identity uses a green circle with locale-aware initials', () => {
  const gui = readJson('contracts/app-gui-product-contract.json');
  const profile = readJson('contracts/app-product-profile.json');
  const expected = {
    shape: 'circle',
    background: 'semantic_success_green',
    foreground: 'inverse',
    han_name_initials: 'first_han_character_only',
    non_han_name_initials: 'first_letters_of_first_two_words_uppercase_else_first_two_codepoints',
    email_fallback_initials: 'first_two_local_part_codepoints_uppercase',
    empty_fallback: 'OP',
  };

  assert.deepEqual(gui.utility_icon_policy.account_identity_avatar, expected);
  assert.deepEqual(profile.gui.home.utility_icon_policy.account_identity_avatar, expected);
});

test('ordinary Home keeps feedback out of the footer utility row', () => {
  const gui = readJson('contracts/app-gui-product-contract.json');

  assert.equal(gui.pages.guid_home.home_footer_quick_actions_policy.visible, false);
  assert.ok(gui.pages.guid_home.home_footer_quick_actions_policy.forbidden_controls.includes('feedback icon'));
});
