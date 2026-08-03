import { appRoot, assert, fs, path, test } from "../helpers.ts";
import {
  appOwnedOfficialProfileRestoreAction,
  validateAppGuiProductContract,
} from "../../../../scripts/validate-active-shell/gui-product-contract-validator.ts";
import { validatePageStateMatrix } from "../../../../scripts/validate-active-shell/page-state-matrix-validator.ts";
import { validateSettingsControlPlane } from "../../../../scripts/validate-active-shell/settings-control-plane-validator.ts";
import {
  appOwnedStorageCarrierBehavior,
  appOwnedWebuiDataVolumeHostActionAbiRef,
  appOwnedWebuiDataVolumeHostActionCapabilityId,
} from "../../../../scripts/validate-active-shell/app-contract-constants.ts";

export { appRoot, assert, fs, path, test };
export {
  appOwnedOfficialProfileRestoreAction,
  appOwnedStorageCarrierBehavior,
  appOwnedWebuiDataVolumeHostActionAbiRef,
  appOwnedWebuiDataVolumeHostActionCapabilityId,
};

export function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), "utf8"));
}

export function contracts() {
  return {
    controlPlane: readJson("contracts/app-settings-control-plane.json"),
    guiContract: readJson("contracts/app-gui-product-contract.json"),
    pageStateMatrix: readJson("contracts/app-page-state-matrix.json"),
    productProfile: readJson("contracts/app-product-profile.json"),
    adapterContract: readJson("contracts/app-shell-adapter.json"),
  };
}

export function validate(values = contracts()) {
  validateSettingsControlPlane(
    values.controlPlane,
    values.guiContract,
    values.pageStateMatrix,
    values.productProfile,
    values.adapterContract,
  );
}

export function validateGui(guiContract) {
  validateAppGuiProductContract(
    guiContract,
    readJson("contracts/app-release-channel.json"),
    readJson("contracts/app-install-exposure-policy.json"),
  );
}

export { validatePageStateMatrix };
