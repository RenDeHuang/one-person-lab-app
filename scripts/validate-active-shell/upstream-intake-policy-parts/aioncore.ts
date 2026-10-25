import { assertDeepEqualJson } from '../assertions.ts';
import {
  assertNonEmptyString,
  assertStringArray,
  isBlockedReleaseGate,
} from './assertions.ts';
import {
  compareVersions,
  parseVersion,
  REQUIRED_AIONCORE_VERSION,
  REQUIRED_STABLE_CURRENTNESS_RECEIPT,
} from './currentness.ts';

const REQUIRED_AIONCORE_EVIDENCE = 'packaged_aioncore_boundary_and_recovery_smoke';
const REQUIRED_AIONCORE_BOUNDARY = {
  required_boundary_code: 'BOOTSTRAP_DATA_INIT_FAILED',
  accepted_failure_boundaries: [
    {
      stage: 'database.recoverable_corruption',
      required_corruption_markers_any_of: [],
    },
    {
      stage: 'database.open',
      required_corruption_markers_any_of: [
        'sqlite_corrupt',
        'sqlite_notadb',
        'database disk image is malformed',
        'file is not a database',
        'malformed database schema',
      ],
    },
  ],
  recovery_success_boundary: {
    code: 'BOOTSTRAP_RECOVERED_DATABASE_CORRUPTION',
    stage: 'database.recovery',
  },
};

export function validateAionCoreRecoveryGate(dependency, shellPackage, stableReceipt) {
  if (!dependency.version_gate || typeof dependency.version_gate !== 'object') {
    throw new Error('Active shell AionCore database recovery version_gate must be an object');
  }
  const versionGate = dependency.version_gate;
  for (const field of [
    'field_ref',
    'minimum_version',
    'evaluated_upstream_version',
    'selected_version_source',
    'state',
  ]) {
    assertNonEmptyString(versionGate[field], `Active shell AionCore database recovery version_gate.${field}`);
  }
  if (versionGate.field_ref !== 'package.json#aioncoreVersion') {
    throw new Error('Active shell AionCore database recovery version_gate.field_ref must be package.json#aioncoreVersion');
  }
  if (versionGate.minimum_version !== REQUIRED_AIONCORE_VERSION) {
    throw new Error(`Active shell AionCore database recovery version_gate.minimum_version must be ${REQUIRED_AIONCORE_VERSION}`);
  }
  if (versionGate.evaluated_upstream_version !== REQUIRED_AIONCORE_VERSION) {
    throw new Error(
      `Active shell AionCore database recovery version_gate.evaluated_upstream_version must be ${REQUIRED_AIONCORE_VERSION}`,
    );
  }
  if (
    versionGate.selected_version_source !==
    REQUIRED_STABLE_CURRENTNESS_RECEIPT.managed_runtime_bindings.aioncore_version
  ) {
    throw new Error('Active shell AionCore selected version must come from the stable currentness receipt');
  }

  assertNonEmptyString(shellPackage?.aioncoreVersion, 'Active shell package aioncoreVersion');
  const selectedVersion = stableReceipt.managed_runtime.aioncore.version;
  if (shellPackage.aioncoreVersion !== selectedVersion) {
    throw new Error(
      `active shell package aioncoreVersion ${shellPackage.aioncoreVersion} must match receipt AionCore version ${selectedVersion}`,
    );
  }

  const parsedSelectedVersion = parseVersion(selectedVersion, 'Active shell receipt AionCore version');
  const minimumVersion = parseVersion(versionGate.minimum_version, 'Active shell AionCore minimum recovery version');
  const evaluatedVersion = parseVersion(
    versionGate.evaluated_upstream_version,
    'Active shell evaluated upstream AionCore version',
  );
  if (compareVersions(evaluatedVersion, minimumVersion) < 0) {
    throw new Error('Evaluated upstream AionCore version must satisfy the minimum recovery version');
  }
  const meetsMinimum = compareVersions(parsedSelectedVersion, minimumVersion) >= 0;
  const expectedVersionState = meetsMinimum ? 'meets_minimum' : 'below_minimum';
  if (versionGate.state !== expectedVersionState) {
    throw new Error(`Active shell AionCore database recovery version_gate.state must be ${expectedVersionState}`);
  }

  const capabilityGate = dependency.capability_gate;
  if (!capabilityGate || typeof capabilityGate !== 'object' || Array.isArray(capabilityGate)) {
    throw new Error('Active shell AionCore database recovery capability gate must be an object');
  }
  if ('required_boundary_stage' in capabilityGate) {
    throw new Error('Active shell AionCore database recovery must not require one fixed required_boundary_stage');
  }
  assertDeepEqualJson(
    {
      required_boundary_code: capabilityGate.required_boundary_code,
      accepted_failure_boundaries: capabilityGate.accepted_failure_boundaries,
      recovery_success_boundary: capabilityGate.recovery_success_boundary,
    },
    REQUIRED_AIONCORE_BOUNDARY,
    'Active shell AionCore database recovery boundary contract',
  );
  if (!['unverified', 'verified'].includes(capabilityGate.state)) {
    throw new Error('Active shell AionCore database recovery capability_gate.state must be unverified or verified');
  }
  assertNonEmptyString(
    capabilityGate.required_evidence,
    'Active shell AionCore database recovery capability_gate.required_evidence',
  );
  if (capabilityGate.required_evidence !== REQUIRED_AIONCORE_EVIDENCE) {
    throw new Error(
      `Active shell AionCore database recovery capability_gate.required_evidence must be ${REQUIRED_AIONCORE_EVIDENCE}`,
    );
  }
  assertStringArray(capabilityGate.evidence, 'Active shell AionCore database recovery capability_gate.evidence', {
    allowEmpty: capabilityGate.state !== 'verified',
  });
  if (
    capabilityGate.state === 'verified' &&
    !capabilityGate.evidence.some((entry) => entry.startsWith(`${REQUIRED_AIONCORE_EVIDENCE}:`))
  ) {
    throw new Error('verified AionCore database recovery capability gate must bind its required evidence');
  }

  if (!['deferred', 'absorbed'].includes(dependency.classification)) {
    throw new Error('AionCore database recovery dependency classification must be deferred or absorbed');
  }
  if (dependency.classification === 'absorbed') {
    if (isBlockedReleaseGate(dependency.release_gate)) {
      throw new Error('absorbed AionCore database recovery dependency must not remain release-blocked');
    }
    if (!meetsMinimum) {
      throw new Error('absorbed AionCore database recovery dependency must satisfy its minimum version');
    }
    if (capabilityGate.state !== 'verified') {
      throw new Error('absorbed AionCore database recovery dependency requires capability_gate.state=verified');
    }
    if (!dependency.remediation_ref) {
      throw new Error('absorbed AionCore database recovery dependency requires remediation_ref');
    }
  }
}
