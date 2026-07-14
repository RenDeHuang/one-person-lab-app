import fs from 'node:fs';
import type { BuildArtifactCohortV2 } from './build-artifact-cohort.ts';
import { sha256File } from './build-artifact-cohort.ts';
import {
  validateQualificationHarnessScopeProof,
  type QualificationHarnessScopeProof,
} from './qualification-harness-scope.ts';

export type ArtifactQualificationReceiptV1 = {
  schema: 'opl_app_artifact_qualification_receipt.v1';
  status: 'passed' | 'failed';
  stable_session_id: string;
  release_cohort_ref: string;
  version: string;
  package_profile: 'standard' | 'full' | 'homebrew-standard' | 'homebrew-full';
  qualification: {
    run_id: string;
    source_artifact_run_id: string;
    source_artifact_name: string;
    evidence_ref: string;
    result: 'passed' | 'failed';
  };
  artifact: BuildArtifactCohortV2['artifact'];
  cohort: BuildArtifactCohortV2['cohort'];
  build_manifest: {
    schema: BuildArtifactCohortV2['schema'];
    sha256: string;
    smoke_harness_sha256: string;
  };
  verification_harness: {
    app_sha: string;
    shell_sha: string;
    smoke_harness_sha256: string;
    differs_from_artifact_cohort: boolean;
    change_scope: 'same_as_artifact_cohort' | 'smoke_or_validator_only';
    scope_proof: QualificationHarnessScopeProof;
  } | null;
  smoke_summary: {
    path: string | null;
    sha256: string | null;
  };
};

const digestPattern = /^[0-9a-f]{64}$/;
const digestRefPattern = /^sha256:[0-9a-f]{64}$/;
const shaPattern = /^[0-9a-f]{40}$/i;

export function buildArtifactQualificationReceipt(input: {
  manifest: BuildArtifactCohortV2;
  manifestPath: string;
  result: 'passed' | 'failed';
  packageProfile: ArtifactQualificationReceiptV1['package_profile'];
  qualificationRunId: string;
  sourceArtifactRunId: string;
  sourceArtifactName: string;
  evidenceRef: string;
  smokeSummaryPath?: string;
  verificationHarness?: {
    appSha: string;
    shellSha: string;
    smokeHarnessPath: string;
    scopeProof: QualificationHarnessScopeProof;
  };
}): ArtifactQualificationReceiptV1 {
  if (!input.manifest.release.stable_session_id || !input.manifest.release.release_cohort_ref) {
    throw new Error('Qualification receipt requires a release-bound artifact manifest with stable session and cohort refs.');
  }
  const smokeSummaryExists = Boolean(input.smokeSummaryPath && fs.existsSync(input.smokeSummaryPath));
  const verificationSmokeHarnessSha256 = input.verificationHarness
    ? sha256File(input.verificationHarness.smokeHarnessPath)
    : null;
  if (input.verificationHarness) {
    const scopeErrors = validateQualificationHarnessScopeProof(input.verificationHarness.scopeProof, {
      artifactAppSha: input.manifest.cohort.app_sha,
      verificationAppSha: input.verificationHarness.appSha,
      artifactShellSha: input.manifest.cohort.shell_sha,
      verificationShellSha: input.verificationHarness.shellSha,
    });
    if (scopeErrors.length > 0) {
      throw new Error(`Invalid qualification harness scope proof: ${scopeErrors.join('; ')}`);
    }
    if (
      input.verificationHarness.scopeProof.classification === 'same_as_artifact_cohort' &&
      verificationSmokeHarnessSha256 !== input.manifest.digests.smoke_harness_sha256
    ) {
      throw new Error('Verification smoke harness digest changed without a changed-path scope proof.');
    }
  }
  const verificationDiffersFromArtifactCohort = input.verificationHarness
    ? input.verificationHarness.appSha !== input.manifest.cohort.app_sha ||
      input.verificationHarness.shellSha !== input.manifest.cohort.shell_sha ||
      verificationSmokeHarnessSha256 !== input.manifest.digests.smoke_harness_sha256
    : false;
  const verificationHarness = input.verificationHarness && verificationSmokeHarnessSha256
    ? {
        app_sha: input.verificationHarness.appSha,
        shell_sha: input.verificationHarness.shellSha,
        smoke_harness_sha256: verificationSmokeHarnessSha256,
        differs_from_artifact_cohort: verificationDiffersFromArtifactCohort,
        change_scope: input.verificationHarness.scopeProof.classification,
        scope_proof: input.verificationHarness.scopeProof,
      }
    : null;
  return {
    schema: 'opl_app_artifact_qualification_receipt.v1',
    status: input.result,
    stable_session_id: input.manifest.release.stable_session_id,
    release_cohort_ref: input.manifest.release.release_cohort_ref,
    version: input.manifest.build.version,
    package_profile: input.packageProfile,
    qualification: {
      run_id: input.qualificationRunId,
      source_artifact_run_id: input.sourceArtifactRunId,
      source_artifact_name: input.sourceArtifactName,
      evidence_ref: input.evidenceRef,
      result: input.result,
    },
    artifact: input.manifest.artifact,
    cohort: input.manifest.cohort,
    build_manifest: {
      schema: input.manifest.schema,
      sha256: sha256File(input.manifestPath),
      smoke_harness_sha256: input.manifest.digests.smoke_harness_sha256,
    },
    verification_harness: verificationHarness,
    smoke_summary: {
      path: smokeSummaryExists ? input.smokeSummaryPath! : null,
      sha256: smokeSummaryExists ? sha256File(input.smokeSummaryPath!) : null,
    },
  };
}

export function validateArtifactQualificationReceipt(
  receipt: ArtifactQualificationReceiptV1,
  expected: {
    stableSessionId: string;
    releaseCohortRef: string;
    version: string;
    packageProfile: ArtifactQualificationReceiptV1['package_profile'];
    result?: 'passed' | 'failed';
    qualificationRunId?: string;
    sourceArtifactRunId?: string;
    sourceArtifactName?: string;
    artifactSha256?: string;
    appSha?: string;
    shellSha?: string;
    frameworkSha?: string;
    verificationAppSha?: string;
    verificationShellSha?: string;
    verificationSmokeHarnessSha256?: string;
    verificationScopeProof?: QualificationHarnessScopeProof;
  },
): string[] {
  const errors: string[] = [];
  if (receipt.schema !== 'opl_app_artifact_qualification_receipt.v1') errors.push(`schema is ${String(receipt.schema)}`);
  if (receipt.stable_session_id !== expected.stableSessionId || !digestRefPattern.test(receipt.stable_session_id)) errors.push(`stable_session_id is ${receipt.stable_session_id}`);
  if (receipt.release_cohort_ref !== expected.releaseCohortRef || !digestRefPattern.test(receipt.release_cohort_ref)) errors.push(`release_cohort_ref is ${receipt.release_cohort_ref}`);
  if (receipt.version !== expected.version) errors.push(`version is ${receipt.version}`);
  if (receipt.package_profile !== expected.packageProfile) errors.push(`package_profile is ${receipt.package_profile}`);
  if (expected.result && (receipt.status !== expected.result || receipt.qualification.result !== expected.result)) errors.push(`qualification result is ${receipt.status}/${receipt.qualification.result}`);
  for (const [key, value] of [
    ['run_id', expected.qualificationRunId],
    ['source_artifact_run_id', expected.sourceArtifactRunId],
    ['source_artifact_name', expected.sourceArtifactName],
  ] as const) {
    if (value && receipt.qualification[key] !== value) errors.push(`${key} is ${receipt.qualification[key]}`);
  }
  if (expected.artifactSha256 && receipt.artifact.sha256 !== expected.artifactSha256) errors.push(`artifact sha256 is ${receipt.artifact.sha256}`);
  if (!digestPattern.test(receipt.artifact.sha256) || !digestPattern.test(receipt.build_manifest.sha256) || !digestPattern.test(receipt.build_manifest.smoke_harness_sha256)) errors.push('qualification receipt contains an invalid digest');
  for (const [key, value] of [
    ['app_sha', expected.appSha], ['shell_sha', expected.shellSha], ['framework_sha', expected.frameworkSha],
  ] as const) {
    if (value && receipt.cohort[key] !== value) errors.push(`${key} is ${String(receipt.cohort[key])}`);
  }
  const verificationHarness = receipt.verification_harness;
  if (verificationHarness) {
    if (!shaPattern.test(verificationHarness.app_sha) || !shaPattern.test(verificationHarness.shell_sha)) {
      errors.push('verification harness contains an invalid Git SHA');
    }
    if (!digestPattern.test(verificationHarness.smoke_harness_sha256)) {
      errors.push('verification harness contains an invalid smoke harness digest');
    }
    const differsFromArtifactCohort =
      verificationHarness.app_sha !== receipt.cohort.app_sha ||
      verificationHarness.shell_sha !== receipt.cohort.shell_sha ||
      verificationHarness.smoke_harness_sha256 !== receipt.build_manifest.smoke_harness_sha256;
    if (verificationHarness.differs_from_artifact_cohort !== differsFromArtifactCohort) {
      errors.push('verification harness differs_from_artifact_cohort is inconsistent');
    }
    const expectedScope = differsFromArtifactCohort ? 'smoke_or_validator_only' : 'same_as_artifact_cohort';
    if (verificationHarness.change_scope !== expectedScope) {
      errors.push(`verification harness change_scope is ${verificationHarness.change_scope}`);
    }
    const scopeErrors = validateQualificationHarnessScopeProof(verificationHarness.scope_proof, {
      artifactAppSha: receipt.cohort.app_sha,
      verificationAppSha: verificationHarness.app_sha,
      artifactShellSha: receipt.cohort.shell_sha,
      verificationShellSha: verificationHarness.shell_sha,
    });
    errors.push(...scopeErrors);
    if (verificationHarness.scope_proof?.classification !== verificationHarness.change_scope) {
      errors.push('verification harness scope proof classification is inconsistent');
    }
  }
  for (const [label, actual, expectedValue] of [
    ['verification app_sha', verificationHarness?.app_sha, expected.verificationAppSha],
    ['verification shell_sha', verificationHarness?.shell_sha, expected.verificationShellSha],
    ['verification smoke_harness_sha256', verificationHarness?.smoke_harness_sha256, expected.verificationSmokeHarnessSha256],
  ] as const) {
    if (expectedValue && actual !== expectedValue) errors.push(`${label} is ${String(actual)}`);
  }
  if (
    expected.verificationScopeProof &&
    JSON.stringify(verificationHarness?.scope_proof) !== JSON.stringify(expected.verificationScopeProof)
  ) {
    errors.push('verification harness scope proof does not match the release session');
  }
  return errors;
}
