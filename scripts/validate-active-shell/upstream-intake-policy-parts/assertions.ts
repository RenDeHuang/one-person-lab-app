import { assertDeepEqualJson } from '../assertions.ts';
import {
  ALLOWED_CLASSIFICATIONS,
  REQUIRED_CAPABILITY_RULES,
  REQUIRED_DEPENDENCY_RULES,
  REQUIRED_RECORD_FIELDS,
  REQUIRED_SOURCE_REF_ROLES,
} from './contract-values.ts';

const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

export function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

export function assertStringArray(value, label, { allowEmpty = false } = {}) {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    !value.every((entry) => typeof entry === 'string' && entry.trim())
  ) {
    throw new Error(`${label} must be ${allowEmpty ? 'a' : 'a non-empty'} string array`);
  }
}

export function assertGitSha(value, label) {
  if (typeof value !== 'string' || !GIT_SHA_PATTERN.test(value)) {
    throw new Error(`${label} must be a full lowercase Git SHA`);
  }
}

export function isBlockedReleaseGate(value) {
  return value.startsWith('blocked_');
}

export function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

export function assertSha256(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
}

export function assertExactPackageVersion(value, label) {
  if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(`${label} must be an exact semantic version`);
  }
}

function validateRecordShape(record, label) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`${label} must be an object`);
  }
  for (const field of REQUIRED_RECORD_FIELDS) {
    if (!(field in record)) {
      throw new Error(`${label} missing required field ${field}`);
    }
  }
  for (const field of ['id', 'upstream_surface', 'classification', 'owner_ref', 'release_gate']) {
    assertNonEmptyString(record[field], `${label}.${field}`);
  }
  if (record.remediation_ref !== undefined) {
    assertGitSha(record.remediation_ref, `${label}.remediation_ref`);
  }
  assertStringArray(record.dependencies, `${label}.dependencies`, { allowEmpty: true });
  assertStringArray(record.evidence, `${label}.evidence`);
  if (!ALLOWED_CLASSIFICATIONS.includes(record.classification)) {
    throw new Error(`${label}.classification must be one of ${ALLOWED_CLASSIFICATIONS.join(', ')}`);
  }
  if (record.classification === 'deferred' && !isBlockedReleaseGate(record.release_gate)) {
    throw new Error(`${label} deferred classification must use a blocked release gate`);
  }
  if (record.classification === 'rejected' && record.dependencies.length > 0) {
    throw new Error(`${label} rejected classification must not declare dependencies`);
  }
}

export function indexRequiredRecords(records, rules, label) {
  if (!Array.isArray(records)) {
    throw new Error(`${label} must be an array`);
  }
  const requiredIds = Object.keys(rules);
  const ids = records.map((record) => record?.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} must not contain duplicate ids`);
  }
  assertDeepEqualJson(ids, requiredIds, `${label} ids`);
  const byId = new Map();
  for (const record of records) {
    validateRecordShape(record, `${label}.${record.id}`);
    const rule = rules[record.id];
    if (record.classification !== rule.classification) {
      throw new Error(`${label}.${record.id}.classification must be ${rule.classification}`);
    }
    if (record.release_gate !== rule.releaseGate) {
      throw new Error(`${label}.${record.id}.release_gate must be ${rule.releaseGate}`);
    }
    assertDeepEqualJson(record.dependencies, rule.dependencies, `${label}.${record.id}.dependencies`);
    if (rule.remediationRequired) {
      if (!record.remediation_ref) {
        throw new Error(`${label}.${record.id} requires remediation_ref`);
      }
      if (rule.remediationRef && record.remediation_ref !== rule.remediationRef) {
        throw new Error(`${label}.${record.id}.remediation_ref must be ${rule.remediationRef}`);
      }
      if (!record.evidence.includes(`shell_commit:${record.remediation_ref}`)) {
        throw new Error(`${label}.${record.id} evidence must bind shell_commit to remediation_ref`);
      }
    }
    byId.set(record.id, record);
  }
  return byId;
}

export function validateDependencyTopology(capabilityById, dependencyById) {
  for (const [id, record] of capabilityById) {
    for (const dependencyId of record.dependencies) {
      if (!dependencyById.has(dependencyId)) {
        throw new Error(`Active shell upstream intake capabilities.${id} references unknown dependency ${dependencyId}`);
      }
    }
    if (record.classification !== 'absorbed') continue;

    const unresolvedDependencies = record.dependencies.filter(
      (dependencyId) => dependencyById.get(dependencyId).classification !== 'absorbed',
    );
    if (unresolvedDependencies.length > 0 && !isBlockedReleaseGate(record.release_gate)) {
      throw new Error(`Active shell upstream intake capabilities.${id} must stay release-blocked while a dependency is not absorbed`);
    }
    if (unresolvedDependencies.length === 0 && isBlockedReleaseGate(record.release_gate)) {
      throw new Error(`Active shell upstream intake capabilities.${id} has a blocked release gate without an unresolved dependency`);
    }
  }
}

export function validateSourceRefs(upstreamIntake) {
  const sourceRefs = upstreamIntake.source_refs;
  if (!sourceRefs || typeof sourceRefs !== 'object' || Array.isArray(sourceRefs)) {
    throw new Error('Active shell upstream intake source_refs must be an object');
  }
  assertDeepEqualJson(
    Object.keys(sourceRefs).toSorted(),
    Object.keys(REQUIRED_SOURCE_REF_ROLES).toSorted(),
    'Active shell upstream intake source ref ids',
  );
  for (const [id, role] of Object.entries(REQUIRED_SOURCE_REF_ROLES)) {
    const sourceRef = sourceRefs[id];
    if (!sourceRef || typeof sourceRef !== 'object' || Array.isArray(sourceRef)) {
      throw new Error(`Active shell upstream intake source_refs.${id} must be an object`);
    }
    assertGitSha(sourceRef.ref, `Active shell upstream intake source_refs.${id}.ref`);
    if (sourceRef.role !== role) {
      throw new Error(`Active shell upstream intake source_refs.${id}.role must be ${role}`);
    }
  }
  if (sourceRefs.evaluated_upstream.release !== 'v2.1.31') {
    throw new Error('Active shell upstream intake evaluated release must be v2.1.31');
  }
  const refs = Object.values(sourceRefs).map((sourceRef) => sourceRef.ref);
  if (new Set(refs).size !== refs.length) {
    throw new Error('Active shell upstream intake source refs must identify distinct commits');
  }
}
