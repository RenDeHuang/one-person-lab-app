import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateAppGuiProductContract } from '../../scripts/validate-active-shell/gui-product-contract-validator.ts';
import { validatePageStateMatrix } from '../../scripts/validate-active-shell/page-state-matrix-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

const validateGui = (guiContract: any) => validateAppGuiProductContract(
  guiContract,
  readJson('contracts/app-release-channel.json'),
  readJson('contracts/app-install-exposure-policy.json'),
);

const validateMatrix = (matrix: any) => validatePageStateMatrix(
  matrix,
  readJson('contracts/app-shell-adapter.json'),
  readJson('contracts/app-gui-product-contract.json'),
);

test('default product gates allow the optional Runtime route to be absent', () => {
  const guiContract = readJson('contracts/app-gui-product-contract.json');
  delete guiContract.pages.runtime_status;
  assert.doesNotThrow(() => validateGui(guiContract));

  const matrix = readJson('contracts/app-page-state-matrix.json');
  matrix.pages = matrix.pages.filter((page: any) => page.id !== 'runtime');
  assert.doesNotThrow(() => validateMatrix(matrix));
});

test('default page-state gate still rejects optional Runtime metadata that expands default scope', () => {
  const matrix = readJson('contracts/app-page-state-matrix.json');
  matrix.pages.find((page: any) => page.id === 'runtime').default_product_required = false;
  assert.throws(() => validateMatrix(matrix));
});
