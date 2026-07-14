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
    shell_local_delivery_forbidden: true,
  };

  assert.deepEqual(gui.utility_icon_policy.global_feedback_action, expected);
  assert.deepEqual(profile.gui.home.utility_icon_policy.global_feedback_action, expected);
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
