import fs from 'node:fs';
import type { BuildArtifactCohortV2 } from './build-artifact-cohort.ts';
import { sha256File } from './build-artifact-cohort.ts';

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
  smoke_summary: {
    path: string | null;
    sha256: string | null;
  };
};

const digestPattern = /^[0-9a-f]{64}$/;
const digestRefPattern = /^sha256:[0-9a-f]{64}$/;

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
}): ArtifactQualificationReceiptV1 {
  if (!input.manifest.release.stable_session_id || !input.manifest.release.release_cohort_ref) {
    throw new Error('Qualification receipt requires a release-bound artifact manifest with stable session and cohort refs.');
  }
  const smokeSummaryExists = Boolean(input.smokeSummaryPath && fs.existsSync(input.smokeSummaryPath));
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
  return errors;
}
