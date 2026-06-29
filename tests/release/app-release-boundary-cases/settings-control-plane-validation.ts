import {
  assert,
  fs,
  path,
  test,
  appRoot,
  readProductProfile,
} from './helpers.ts';
import { validateSettingsControlPlane } from '../../../scripts/validate-active-shell/settings-control-plane-validator.ts';

test('Settings control-plane validator binds contract, profile, page-state, and shell adapter behavior', () => {
  const controlPlaneContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-settings-control-plane.json'), 'utf8'),
  );
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const adapterContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'),
  );
  const productProfile = readProductProfile();

  assert.doesNotThrow(() =>
    validateSettingsControlPlane(controlPlaneContract, guiContract, pageStateMatrix, productProfile, adapterContract),
  );

  const invalidActionRoute = structuredClone(guiContract);
  invalidActionRoute.settings_navigation.settings_ia.protocols.action_catalog.action_route = 'direct shell mutation';
  assert.throws(
    () =>
      validateSettingsControlPlane(
        controlPlaneContract,
        invalidActionRoute,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /App action route/,
  );

  const invalidMatrix = structuredClone(pageStateMatrix);
  invalidMatrix.pages.find((page) => page.id === 'settings_workspace').route_scope = 'ordinary';
  assert.throws(
    () =>
      validateSettingsControlPlane(
        controlPlaneContract,
        guiContract,
        invalidMatrix,
        productProfile,
        adapterContract,
      ),
    /settings_workspace route_scope must be secondary_or_deep_link/,
  );
});
