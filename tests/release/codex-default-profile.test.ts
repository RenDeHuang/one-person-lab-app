import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateAppGuiProductContract } from '../../scripts/validate-active-shell/gui-product-contract-validator.ts';
import { validatePrimaryInteractionPages } from '../../scripts/validate-active-shell/page-state-primary-interaction-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

test('GUI contract rejects Codex model order drift from the App product profile', () => {
  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.executor_policy.frontier_model_preference_order.reverse();

  assert.throws(() => validateAppGuiProductContract(
    guiContract,
    readJson('contracts/app-release-channel.json'),
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('GUI contract rejects Codex model availability role drift from the App product profile', () => {
  const guiContract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
  guiContract.executor_policy.frontier_model_preference_order_role =
    'fallback_when_codex_cli_model_list_unavailable';

  assert.throws(() => validateAppGuiProductContract(
    guiContract,
    readJson('contracts/app-release-channel.json'),
    readJson('contracts/app-install-exposure-policy.json'),
  ));
});

test('page-state matrix rejects Codex model order drift', () => {
  const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
  const guidHome = matrix.pages.find(({ id }) => id === 'guid_home');
  guidHome.home_view_model.codex_frontier_model_preference_order.reverse();

  assert.throws(() => validatePrimaryInteractionPages(matrix));
});
