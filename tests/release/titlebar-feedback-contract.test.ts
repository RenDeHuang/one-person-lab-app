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
    icon: 'comment',
    target_url: 'https://github.com/gaofeng21cn/one-person-lab-app/issues/new',
    open_mode: 'external_browser_user_review_and_submit',
    prefill_fields: ['localized_title', 'localized_body', 'current_route', 'app_release_version'],
    shell_local_delivery_forbidden: true,
  };

  assert.deepEqual(gui.utility_icon_policy.global_feedback_action, expected);
  assert.deepEqual(profile.gui.home.utility_icon_policy.global_feedback_action, expected);
});

test('ordinary Home keeps feedback out of the footer utility row', () => {
  const gui = readJson('contracts/app-gui-product-contract.json');

  assert.equal(gui.pages.guid_home.home_footer_quick_actions_policy.visible, false);
  assert.ok(gui.pages.guid_home.home_footer_quick_actions_policy.forbidden_controls.includes('feedback icon'));
});
