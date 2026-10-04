import fs from 'node:fs';
import path from 'node:path';

import type { ReleaseValidationProfile } from './release-checks.ts';
import {
  validateGithubReleaseName,
  validateReleaseAssetIntegrity,
  validateLocalInstallReleaseProfile,
  validateReleaseExecutionTracks,
  validatePreparedNotesTransportPolicy,
  validateStandardUpdaterCompressionPolicy,
  validateStandardUpdaterCandidateSelection,
  validateStandardUpdaterMetadataMigration,
} from './release-contract-policy-parts/assets-updater.ts';
import {
  validateReleasePreflightContract,
  validateOptionalCertificationPolicy,
  validatePhysicalVmOptionalCertificationPolicy,
  validateSourceMaterialRouteContract,
} from './release-contract-policy-parts/admission-preflight.ts';
import {
  validateHomebrewVmGateStaticPolicy,
  validateWebuiPackagePolicy,
  validateReleaseAccelerationPolicy,
} from './release-contract-policy-parts/acceleration.ts';
import { validateReleasePlatformMatrix } from './release-contract-policy-parts/platform.ts';
import { validateGithubApplyCallerParity } from './release-contract-policy-parts/github-callers.ts';

function readJson(appRoot: string, relativePath: string): any {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

export { validateGithubApplyCallerParity };
export {
  evaluateReleaseBrokerAuthorityReadiness,
  validateReleaseAccelerationPolicy,
} from './release-contract-policy-parts/acceleration.ts';
export type {
  ReleaseBrokerAuthorityReadiness,
} from './release-contract-policy-parts/acceleration.ts';
export { validateReleasePlatformMatrix };

export function validateReleaseContractPolicies(
  appRoot: string,
  profile: ReleaseValidationProfile = 'aggregate',
): number {
  const releaseContract = readJson(appRoot, 'contracts/app-release-channel.json');
  const brokerAuthority = readJson(appRoot, 'contracts/app-release-broker-authority.json');
  const firstRunMatrix = readJson(appRoot, 'contracts/app-first-run-test-matrix.json');
  let failures = 0;

  failures += validateGithubReleaseName(releaseContract);
  failures += validateReleaseAssetIntegrity(releaseContract);
  failures += validateLocalInstallReleaseProfile(releaseContract);
  failures += validateReleaseExecutionTracks(releaseContract);
  failures += validatePreparedNotesTransportPolicy(releaseContract);
  failures += validateStandardUpdaterCompressionPolicy(appRoot, releaseContract);
  failures += validateStandardUpdaterCandidateSelection(releaseContract);
  failures += validateStandardUpdaterMetadataMigration(releaseContract);
  failures += validateReleasePreflightContract(releaseContract);
  failures += validateOptionalCertificationPolicy(releaseContract);
  failures += validatePhysicalVmOptionalCertificationPolicy(releaseContract);
  failures += validateHomebrewVmGateStaticPolicy(appRoot, releaseContract, firstRunMatrix);
  failures += validateWebuiPackagePolicy(releaseContract);
  failures += validateReleaseAccelerationPolicy(appRoot, releaseContract, brokerAuthority);
  failures += validateSourceMaterialRouteContract(appRoot);
  failures += validateReleasePlatformMatrix(releaseContract, profile);
  failures += validateGithubApplyCallerParity(appRoot);

  return failures;
}
