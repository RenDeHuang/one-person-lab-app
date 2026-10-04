import { runReleaseBoundaryTextChecks } from './text-check-runner-parts/mutation-policy.ts';
import {
  validateStableReleaseControlPlane,
  validateReleaseBundleTopology,
} from './text-check-runner-parts/release-control-plane.ts';
import {
  validateStableFollowupTopology,
  validateHomebrewFullPromotionTopology,
  validateNightlyReleaseTopology,
  validateReleaseBundleCanaryTopology,
} from './text-check-runner-parts/release-followup-topology.ts';
import {
  validatePreviewLatestPointerTopology,
  validateManualFullPreviewControlPlane,
  validateIndependentWebuiPreviewTopology,
} from './text-check-runner-parts/release-preview-topology.ts';
import {
  validateWorkflowTopologyPolicy,
  validateWorkflowNode24Policy,
  validateStableReleaseActionPinPolicy,
  validateWorkflowDispatchWriteAuthorityForWorkflows,
} from './text-check-runner-parts/workflow-policy.ts';

export {
  stableReleaseActionPaths,
  isAuthorizedWebuiStablePromotionWriteJob,
} from './text-check-runner-parts/workflow-policy.ts';

export {
  runReleaseBoundaryTextChecks,
  validateStableReleaseControlPlane,
  validateReleaseBundleTopology,
  validateStableFollowupTopology,
  validateHomebrewFullPromotionTopology,
  validateNightlyReleaseTopology,
  validateReleaseBundleCanaryTopology,
  validateWorkflowTopologyPolicy,
  validateWorkflowNode24Policy,
  validateStableReleaseActionPinPolicy,
  validateManualFullPreviewControlPlane,
  validateIndependentWebuiPreviewTopology,
};

export function validateWorkflowDispatchWriteAuthority(appRoot: string): number {
  let failures = validateStableReleaseControlPlane(appRoot) +
    validateReleaseBundleTopology(appRoot) +
    validateStableFollowupTopology(appRoot) +
    validateReleaseBundleCanaryTopology(appRoot) +
    validateNightlyReleaseTopology(appRoot) +
    validatePreviewLatestPointerTopology(appRoot) +
    validateIndependentWebuiPreviewTopology(appRoot) +
    validateManualFullPreviewControlPlane(appRoot) +
    validateHomebrewFullPromotionTopology(appRoot);
  failures += validateWorkflowDispatchWriteAuthorityForWorkflows(appRoot);
  return failures;
}
