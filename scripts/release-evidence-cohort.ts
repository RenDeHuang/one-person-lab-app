export type ReleaseEvidenceCohort = {
  schema: 'opl_app_release_evidence_cohort.v1';
  version: string;
  tag: string;
  channel: 'stable' | 'nightly';
  source: string;
  current_cohort_evidence: true;
};

export type UnknownReleaseEvidenceCohort = {
  schema: 'opl_app_release_evidence_cohort.v1';
  status: 'unknown';
  current_cohort_evidence: false;
  reason: string;
};

const versionPattern = /^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function inferReleaseChannel(version: string): 'stable' | 'nightly' {
  return /nightly/i.test(version) ? 'nightly' : 'stable';
}

export function buildReleaseEvidenceCohort(input: {
  version: string;
  tag?: string;
  channel?: string;
  source: string;
}): ReleaseEvidenceCohort {
  const version = input.version.trim();
  if (!versionPattern.test(version)) {
    throw new Error(`release_cohort.version must be a release version, got ${JSON.stringify(input.version)}.`);
  }
  const tag = (input.tag?.trim() || `v${version}`);
  if (tag !== `v${version}`) {
    throw new Error(`release_cohort.tag must match v<version>; expected v${version}, got ${tag}.`);
  }
  const channel = input.channel?.trim() || inferReleaseChannel(version);
  if (channel !== 'stable' && channel !== 'nightly') {
    throw new Error(`release_cohort.channel must be stable or nightly, got ${channel}.`);
  }
  if (channel === 'stable' && /nightly/i.test(version)) {
    throw new Error('release_cohort.channel stable must not use a nightly version.');
  }
  if (channel === 'nightly' && !/nightly/i.test(version)) {
    throw new Error('release_cohort.channel nightly must use a nightly version.');
  }
  const source = input.source.trim();
  if (!source) {
    throw new Error('release_cohort.source must be non-empty.');
  }
  return {
    schema: 'opl_app_release_evidence_cohort.v1',
    version,
    tag,
    channel,
    source,
    current_cohort_evidence: true,
  };
}

export function normalizeReleaseEvidenceCohort(value: unknown, label = 'release_cohort'): ReleaseEvidenceCohort {
  const record = asRecord(value, label);
  if (record.schema !== 'opl_app_release_evidence_cohort.v1') {
    throw new Error(`${label}.schema must be opl_app_release_evidence_cohort.v1.`);
  }
  if (record.current_cohort_evidence !== true) {
    throw new Error(`${label}.current_cohort_evidence must be true for a known release cohort.`);
  }
  return buildReleaseEvidenceCohort({
    version: String(record.version ?? ''),
    tag: String(record.tag ?? ''),
    channel: typeof record.channel === 'string' ? record.channel : undefined,
    source: String(record.source ?? ''),
  });
}

export function unknownReleaseEvidenceCohort(reason: string): UnknownReleaseEvidenceCohort {
  return {
    schema: 'opl_app_release_evidence_cohort.v1',
    status: 'unknown',
    current_cohort_evidence: false,
    reason,
  };
}

export function releaseCohortFromRemoteVerification(
  payload: unknown,
  source = 'remote_release_verification',
): ReleaseEvidenceCohort | null {
  const record = asRecord(payload, source);
  if (typeof record.version !== 'string' || !record.version.trim()) {
    return null;
  }
  return buildReleaseEvidenceCohort({
    version: record.version,
    tag: typeof record.tag === 'string' ? record.tag : undefined,
    source,
  });
}

export function assertRemoteReleaseCohortMatches(
  manifestCohort: ReleaseEvidenceCohort,
  payload: unknown,
  label = 'remote_release_verification',
): void {
  const remoteCohort = releaseCohortFromRemoteVerification(payload, label);
  if (!remoteCohort) {
    throw new Error(`${label} must include version and tag for same-cohort release evidence validation.`);
  }
  if (remoteCohort.version !== manifestCohort.version || remoteCohort.tag !== manifestCohort.tag) {
    throw new Error(
      `${label} release cohort mismatch: manifest ${manifestCohort.tag} (${manifestCohort.version}) `
      + `vs remote ${remoteCohort.tag} (${remoteCohort.version}).`,
    );
  }
}
