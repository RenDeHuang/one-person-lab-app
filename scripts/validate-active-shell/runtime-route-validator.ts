import { validateAppGuiProductContract } from './gui-product-contract-validator.ts';
import { validateOptionalRuntimePageStateMatrix } from './page-state-matrix-validator.ts';
import {
  validateRuntimeCockpitProductContract,
  validateRuntimeCockpitPreservationPolicy,
} from './runtime-cockpit-product-validator.ts';
import {
  validateRuntimeBridgeContract,
  validateRuntimeProgressPageDisplayPolicy,
} from './runtime-bridge-validator.ts';

export function validateOptionalRuntimeRoute({
  guiProductContract,
  pageStateMatrix,
  shellAdapter,
  runtimeBridge,
  releaseChannel,
  installExposurePolicy,
}) {
  validateAppGuiProductContract(guiProductContract, releaseChannel, installExposurePolicy);
  validateRuntimeCockpitPreservationPolicy(
    guiProductContract.interaction_baseline?.feature_preservation_policy?.runtime_preservation_gate,
    'Optional Runtime route preservation policy',
  );
  const runtimeStatus = guiProductContract.pages?.runtime_status;
  if (!runtimeStatus) {
    throw new Error('Explicit Runtime route validation requires pages.runtime_status');
  }
  validateRuntimeCockpitProductContract(
    runtimeStatus.runtime_cockpit_product_contract,
    'Optional Runtime route product contract',
  );
  validateOptionalRuntimePageStateMatrix(pageStateMatrix, shellAdapter, guiProductContract);
  validateRuntimeBridgeContract(runtimeBridge, shellAdapter);
  validateRuntimeProgressPageDisplayPolicy(runtimeBridge);
}
