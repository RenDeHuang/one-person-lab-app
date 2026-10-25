import { assertDeepEqualJson, readJson } from './assertions.ts';
import {
  ALLOWED_CLASSIFICATIONS,
  HISTORICAL_ADAPTER_ID,
  REQUIRED_CAPABILITY_IDS,
  REQUIRED_DEPENDENCY_IDS,
  REQUIRED_RECORD_FIELDS,
  REQUIRED_CAPABILITY_RULES,
  REQUIRED_DEPENDENCY_RULES,
} from './upstream-intake-policy-parts/contract-values.ts';
import {
  indexRequiredRecords,
  validateDependencyTopology,
  validateSourceRefs,
} from './upstream-intake-policy-parts/assertions.ts';
import { validateStableCurrentnessReceipt } from './upstream-intake-policy-parts/currentness.ts';
import { validateManagedAgentApiCompatibility } from './upstream-intake-policy-parts/managed-agent.ts';
import { validateAionCoreRecoveryGate } from './upstream-intake-policy-parts/aioncore.ts';
import {
  defaultIsGitAncestor,
  validateActiveShellAncestry,
  validateRejectedBoundaries,
} from './upstream-intake-policy-parts/ancestry-and-rejection.ts';

// This validator is retained only for the historical AionUI adapter contract.
// Studio is the sole current carrier and must never enter this AionCore intake path.
export function validateHistoricalAionuiUpstreamIntakePolicy(contract, shellPaths, options = {}) {
  if (contract?.adapter_id !== HISTORICAL_ADAPTER_ID && contract?.active_shell !== HISTORICAL_ADAPTER_ID) {
    throw new Error('Historical AionUI upstream intake validation cannot be used for the active Studio carrier');
  }
  const upstreamIntake = contract.upstream_intake;
  if (
    upstreamIntake?.classification_policy !==
    'classify_every_required_capability_and_dependency_before_app_release'
  ) {
    throw new Error(
      'Active shell upstream_intake.classification_policy must classify every required capability and dependency before release',
    );
  }
  if (upstreamIntake.schema_version !== 1) {
    throw new Error('Active shell upstream_intake.schema_version must be 1');
  }
  if (!shellPaths?.shellRoot || !shellPaths?.packageManifestPath) {
    throw new Error('Active shell upstream intake validation requires resolved shell paths');
  }
  validateSourceRefs(upstreamIntake);
  assertDeepEqualJson(
    upstreamIntake.allowed_classifications,
    ALLOWED_CLASSIFICATIONS,
    'Active shell upstream intake classifications',
  );
  assertDeepEqualJson(
    upstreamIntake.required_record_fields,
    REQUIRED_RECORD_FIELDS,
    'Active shell upstream intake required record fields',
  );
  assertDeepEqualJson(
    upstreamIntake.required_capability_ids,
    REQUIRED_CAPABILITY_IDS,
    'Active shell upstream intake required capability ids',
  );
  assertDeepEqualJson(
    upstreamIntake.required_dependency_ids,
    REQUIRED_DEPENDENCY_IDS,
    'Active shell upstream intake required dependency ids',
  );

  const dependencyById = indexRequiredRecords(
    upstreamIntake.dependency_classifications,
    REQUIRED_DEPENDENCY_RULES,
    'Active shell upstream intake dependencies',
  );
  const capabilityById = indexRequiredRecords(
    upstreamIntake.capability_classifications,
    REQUIRED_CAPABILITY_RULES,
    'Active shell upstream intake capabilities',
  );
  validateDependencyTopology(capabilityById, dependencyById);
  validateRejectedBoundaries(contract, capabilityById);

  const readJsonFile = options.readJsonFile ?? readJson;
  const shellPackage = readJsonFile(shellPaths.packageManifestPath);
  const aionCoreDependency = dependencyById.get('aioncore_database_recovery');
  const isGitAncestor = options.isGitAncestor ?? defaultIsGitAncestor;
  const stableReceipt = validateStableCurrentnessReceipt(contract, shellPaths, options, isGitAncestor);
  validateAionCoreRecoveryGate(aionCoreDependency, shellPackage, stableReceipt);
  validateManagedAgentApiCompatibility(contract, shellPaths, options);

  const guiConformanceRef = contract.shell_source?.upstream_ref;
  if (!guiConformanceRef || !isGitAncestor(guiConformanceRef, shellPaths.shellRoot)) {
    throw new Error(`active shell HEAD must contain verified GUI conformance ref ${String(guiConformanceRef)}`);
  }
  validateActiveShellAncestry(
    upstreamIntake,
    [...capabilityById.values(), ...dependencyById.values()],
    shellPaths.shellRoot,
    isGitAncestor,
  );
}
