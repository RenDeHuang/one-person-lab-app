import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validatePageStateMatrix } from '../../scripts/validate-active-shell/page-state-matrix-validator.ts';
import { validateCoreRuntimeRoute } from '../../scripts/validate-active-shell/runtime-route-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

const validateMatrix = (matrix: any, guiContract = readJson('contracts/app-gui-product-contract.json')) => validatePageStateMatrix(
  matrix,
  readJson('contracts/app-shell-adapter.json'),
  guiContract,
);

const validateRoute = ({
  guiContract = readJson('contracts/app-gui-product-contract.json'),
  matrix = readJson('contracts/app-page-state-matrix.json'),
} = {}) => validateCoreRuntimeRoute({
  guiProductContract: guiContract,
  pageStateMatrix: matrix,
  shellAdapter: readJson('contracts/app-shell-adapter.json'),
  runtimeBridge: readJson('contracts/app-runtime-bridge.json'),
  releaseChannel: readJson('contracts/app-release-channel.json'),
  installExposurePolicy: readJson('contracts/app-install-exposure-policy.json'),
});

test('default product gates require the core Runtime route', () => {
  assert.doesNotThrow(() => validateRoute());

  const guiContract = readJson('contracts/app-gui-product-contract.json');
  delete guiContract.pages.runtime_status;
  assert.throws(() => validateMatrix(readJson('contracts/app-page-state-matrix.json'), guiContract));

  const matrix = readJson('contracts/app-page-state-matrix.json');
  matrix.pages = matrix.pages.filter((page: any) => page.id !== 'runtime');
  assert.throws(() => validateMatrix(matrix));
});

test('default page-state gate rejects core Runtime metadata that weakens the required scope', () => {
  const matrix = readJson('contracts/app-page-state-matrix.json');
  matrix.pages.find((page: any) => page.id === 'runtime').default_product_required = false;
  assert.throws(() => validateMatrix(matrix));
});

test('default release gate rejects contracts that make core Runtime optional', () => {
  const guiContract = readJson('contracts/app-gui-product-contract.json');
  guiContract.pages.runtime_status.default_release_gate = false;
  assert.throws(() => validateRoute({ guiContract }), /default release gate/);

  const preservationContract = readJson('contracts/app-gui-product-contract.json');
  preservationContract.interaction_baseline.feature_preservation_policy.runtime_preservation_gate.default_release_gate = false;
  assert.throws(() => validateRoute({ guiContract: preservationContract }), /default_release_gate/);

  const matrix = readJson('contracts/app-page-state-matrix.json');
  matrix.acceptance_boundary.runtime_default_release_gate_required = false;
  assert.throws(() => validateRoute({ matrix }), /runtime_default_release_gate_required/);
});
