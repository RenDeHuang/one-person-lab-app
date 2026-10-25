import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveActiveShellPaths } from '../app-shell-adapter.ts';
import type { ReleaseBoundaryCheck } from './release-checks-parts/types.ts';
import {
  activeShellReleaseValidationProfile,
  filterReleaseBoundaryChecksForProfile,
  releaseValidationProfile,
  releaseWorkflowPaths,
  releaseWorkflowPathsForProfile,
} from './release-checks-parts/profile.ts';
import { buildLegacyAdmissionChecks } from './release-checks-parts/legacy-admission.ts';
import { legacyDistributionChecks } from './release-checks-parts/legacy-distribution.ts';
import { buildLegacyFoundationChecks } from './release-checks-parts/legacy-foundation.ts';
import {
  buildStudioBoundaryChecks,
  studioCarrierChecks,
} from './release-checks-parts/studio-carrier.ts';
import { studioBundleChecks } from './release-checks-parts/studio-bundle.ts';
import { studioFollowupChecks } from './release-checks-parts/studio-followups.ts';

export type { ReleaseBoundaryCheck, ReleaseValidationProfile } from './release-checks-parts/types.ts';
export {
  activeShellReleaseValidationProfile,
  releaseValidationProfile,
  releaseWorkflowPaths,
  releaseWorkflowPathsForProfile,
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const shellPaths = resolveActiveShellPaths();

const legacyReleaseBoundaryChecks: ReleaseBoundaryCheck[] = [
  ...buildLegacyFoundationChecks(appRoot, shellPaths),
  ...legacyDistributionChecks,
  ...buildLegacyAdmissionChecks(appRoot, shellPaths),
];

const studioBoundaryChecks = buildStudioBoundaryChecks(
  appRoot,
  shellPaths,
  legacyReleaseBoundaryChecks,
);

export const releaseBoundaryChecks: ReleaseBoundaryCheck[] = [
  ...legacyReleaseBoundaryChecks.map((check) => shellPaths.contract.active_shell === 'opl-studio'
    ? studioBoundaryChecks[check.id] ?? check : check),
  ...studioCarrierChecks,
  ...studioBundleChecks,
  ...studioFollowupChecks,
];

export function releaseBoundaryChecksForProfile(
  profile = releaseValidationProfile(),
): ReleaseBoundaryCheck[] {
  return filterReleaseBoundaryChecksForProfile(releaseBoundaryChecks, profile);
}
