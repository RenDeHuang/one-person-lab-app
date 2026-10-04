import {
  inspectRelease,
  inspectReleaseById,
  inspectReleaseByIdForReconcile,
  inspectReleaseForReconcile,
  inspectReleaseTagRef,
  mutationAttemptId,
  runGitHubMutation,
  stoppedMutation,
  unknownAfterAcceptedMutation,
  assertReleaseIdentity,
  acceptedDraftReleaseId,
  type GitHubAdapterRuntime,
} from './framework-release-adapter-publication-github.ts';
import {
  assertCanonicalStandardPublicationBoundary,
  assertPublicationAuthority,
  assertReleaseAssetSet,
  publicationTagTargetCommitish,
} from './framework-release-adapter-publication-admission.ts';
import { requireOption } from './framework-release-adapter-plan.ts';
import { bundlePublicReleaseBody, canonicalStableRepository, type AdapterOptionValues, type GitHubApplyMode, type JsonRecord, type StandardPublicationChannel, type Track } from './framework-release-adapter-bundle.ts';

export function ensureRelease(options: {
  baseAttemptId: string;
  repo: string;
  tag: string;
  name: string;
  notes: string;
  targetCommitish: string;
  prerelease: boolean;
  operationDeadlineAt: string;
  runtime: GitHubAdapterRuntime;
  initialInspection?: JsonRecord;
}): JsonRecord {
  const expectedBody = options.notes;
  const remoteTarget = `github-release:${options.repo}@${options.tag}`;
  let inspection = options.initialInspection ?? inspectRelease(options.repo, options.tag, options.runtime);
  if (!inspection.release.exists) {
    const expectedRef = `refs/tags/${options.tag}`;
    const existingTagRef = inspectReleaseTagRef(options.repo, options.tag, options.runtime);
    const exactTagPreexisting = existingTagRef.exists === true;
    if (existingTagRef.exists) {
      if (existingTagRef.target_commitish !== options.targetCommitish) {
        throw new Error(
          `Existing ${expectedRef} points to ${existingTagRef.target_commitish}, expected ${options.targetCommitish}.`,
        );
      }
    }
    const payload = JSON.stringify({
      tag_name: options.tag,
      ...(!exactTagPreexisting ? { target_commitish: options.targetCommitish } : {}),
      name: options.name,
      body: expectedBody,
      draft: true,
      prerelease: options.prerelease,
      make_latest: 'false',
    });
    const attempt = runGitHubMutation({
      mutation: 'release_create',
      attemptId: mutationAttemptId(options.baseAttemptId, 'release_create', remoteTarget, options.tag),
      remoteTarget,
      args: ['api', '--method', 'POST', `repos/${options.repo}/releases`, '--input', '-'],
      body: payload,
      operationDeadlineAt: options.operationDeadlineAt,
      runtime: options.runtime,
    });
    if (attempt.status !== 'accepted') {
      return stoppedMutation({
        attempt,
        repo: options.repo,
        tag: options.tag,
        reconciliation: inspectReleaseForReconcile(options.repo, options.tag, options.runtime),
      });
    }
    let releaseId: number;
    try {
      releaseId = acceptedDraftReleaseId(attempt.evidence, { ...options, exactTagPreexisting });
    } catch (error) {
      const fallback = inspectReleaseForReconcile(options.repo, options.tag, options.runtime);
      return unknownAfterAcceptedMutation({
        mutation: 'release_create',
        operationDeadlineAt: options.operationDeadlineAt,
        attemptEvidence: attempt.evidence,
        repo: options.repo,
        tag: options.tag,
        reconciliation: {
          status: 'create_response_invalid',
          failure: { error_message: error instanceof Error ? error.message : String(error) },
          fallback,
        },
        reason: 'GitHub accepted Release creation but returned an invalid draft identity response.',
      });
    }
    const reconciliation = inspectReleaseByIdForReconcile(
      options.repo,
      options.tag,
      releaseId,
      options.runtime,
    );
    if (reconciliation.status !== 'complete' || !reconciliation.observation.release.exists) {
      return unknownAfterAcceptedMutation({
        mutation: 'release_create',
        operationDeadlineAt: options.operationDeadlineAt,
        attemptEvidence: attempt.evidence,
        repo: options.repo,
        tag: options.tag,
        reconciliation,
        reason: 'GitHub accepted Release creation but exact identity readback did not complete.',
      });
    }
    inspection = reconciliation.observation;
  }
  if (inspection.release.draft === true) {
    assertReleaseIdentity(inspection, { ...options, draft: true });
  } else if (inspection.release.draft === false) {
    assertReleaseIdentity(inspection, { ...options, draft: false });
  } else {
    throw new Error(`Existing ${options.tag} Release has an invalid draft state.`);
  }
  return { status: 'complete', inspection };
}

export function publishDraftRelease(options: {
  baseAttemptId: string;
  values: AdapterOptionValues;
  repo: string;
  tag: string;
  name: string;
  notes: string;
  targetCommitish: string;
  prerelease: boolean;
  releaseId: number;
  actions: JsonRecord[];
  operationDeadlineAt: string;
  runtime: GitHubAdapterRuntime;
  bundle: JsonRecord;
}): JsonRecord {
  const before = inspectReleaseById(options.repo, options.tag, options.releaseId, options.runtime);
  assertReleaseIdentity(before, { ...options, draft: true });
  assertReleaseAssetSet(before, options.actions, true);
  const admission = {
    operationId: requireOption(options.values, 'operation-id'),
    track: requireOption(options.values, 'track') as Track,
  };
  if (options.repo === canonicalStableRepository && options.bundle.release?.channel === 'stable') {
    assertCanonicalStandardPublicationBoundary(
      options.values,
      options.repo,
      options.bundle,
      admission,
      options.actions,
    );
  } else {
    assertPublicationAuthority(
      options.values,
      options.repo,
      options.bundle,
      admission,
      options.actions,
    );
  }
  const remoteTarget = `github-release:${options.repo}@${options.tag}`;
  const attempt = runGitHubMutation({
    mutation: 'release_publish',
    attemptId: mutationAttemptId(
      options.baseAttemptId,
      'release_publish',
      remoteTarget,
      options.tag,
    ),
    remoteTarget,
    args: [
      'api',
      '--method',
      'PATCH',
      `repos/${options.repo}/releases/${before.release.id}`,
      '--input',
      '-',
    ],
    body: JSON.stringify({ draft: false, make_latest: 'false' }),
    operationDeadlineAt: options.operationDeadlineAt,
    runtime: options.runtime,
  });
  if (attempt.status !== 'accepted') {
    return stoppedMutation({
      attempt,
      repo: options.repo,
      tag: options.tag,
      reconciliation: inspectReleaseByIdForReconcile(
        options.repo,
        options.tag,
        options.releaseId,
        options.runtime,
      ),
    });
  }
  const reconciliation = inspectReleaseByIdForReconcile(
    options.repo,
    options.tag,
    options.releaseId,
    options.runtime,
  );
  if (reconciliation.status !== 'complete' || !reconciliation.observation.release.exists) {
    return unknownAfterAcceptedMutation({
      mutation: 'release_publish',
      operationDeadlineAt: options.operationDeadlineAt,
      attemptEvidence: attempt.evidence,
      repo: options.repo,
      tag: options.tag,
      reconciliation,
      reason: 'GitHub accepted draft publication but exact release readback did not complete.',
    });
  }
  const published = reconciliation.observation;
  if (published.release.immutable !== false) {
    return unknownAfterAcceptedMutation({
      mutation: 'release_publish',
      operationDeadlineAt: options.operationDeadlineAt,
      attemptEvidence: attempt.evidence,
      repo: options.repo,
      tag: options.tag,
      reconciliation,
      reason: 'GitHub accepted publication but readback unexpectedly reported immutable=true.',
    });
  }
  try {
    assertReleaseIdentity(published, { ...options, draft: false });
    assertReleaseAssetSet(published, options.actions, true);
  } catch (error) {
    return unknownAfterAcceptedMutation({
      mutation: 'release_publish',
      operationDeadlineAt: options.operationDeadlineAt,
      attemptEvidence: attempt.evidence,
      repo: options.repo,
      tag: options.tag,
      reconciliation,
      reason: `GitHub accepted draft publication but exact identity or asset readback failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
  return {
    status: 'complete',
    repository: options.repo,
    tag: options.tag,
    uploaded: [],
    release_publish: attempt.evidence,
    inspection: published,
    github_native_immutable: false,
    mutable_release_protection: options.bundle.release?.channel === 'stable'
      ? 'workflow_asset_name_digest_cas_and_unified_attestation'
      : 'workflow_asset_name_digest_cas',
  };
}

export function applyStandardPublishPlan(input: {
  values: AdapterOptionValues;
  runtime: GitHubAdapterRuntime;
  bundle: JsonRecord;
  admission: {
    operation: string;
    operationId: string;
    operationStartedAt: string;
    attemptId: string;
    track: Track;
  };
  uploadActions: JsonRecord[];
  operationDeadlineAt: string;
  mutationMode: GitHubApplyMode;
  publicationChannel: StandardPublicationChannel;
  publicationStatus: string;
}): JsonRecord {
  const {
    values,
    runtime,
    bundle,
    admission,
    uploadActions,
    operationDeadlineAt,
    mutationMode,
    publicationChannel,
    publicationStatus,
  } = input;
  const targetCommitish = publicationTagTargetCommitish(values, bundle, null);
  const repo = bundle.sources.app.repo;
  const tag = bundle.release.tag;
  if (publicationStatus === 'reconcile_only') {
    return { status: 'reconcile_only', repository: repo, tag, uploaded: [] };
  }
  const name = `One Person Lab v${bundle.release.version}`;
  const notes = bundlePublicReleaseBody(bundle);
  const preexisting = inspectReleaseForReconcile(repo, tag, runtime);
  const canonicalStableStandard = repo === canonicalStableRepository && publicationChannel === 'stable';
  const exactPublishedCarrier = preexisting.status === 'complete'
    && preexisting.observation.release.exists === true
    && preexisting.observation.release.draft === false;
  if (!exactPublishedCarrier) {
    if (canonicalStableStandard) {
      assertCanonicalStandardPublicationBoundary(values, repo, bundle, admission, uploadActions);
    } else {
      assertPublicationAuthority(values, repo, bundle, admission, uploadActions);
    }
  }
  if (mutationMode === 'rehearsal') {
    return {
      surface_kind: 'opl_app_github_publication_rehearsal.v1',
      status: 'rehearsal_complete',
      mutation_authorized: false,
      mutation_attempted: false,
      repository: repo,
      tag,
      track: admission.track,
      operation: admission.operation,
      operation_id: admission.operationId,
      publication_channel: publicationChannel,
      target_commitish: targetCommitish,
      upload_actions: uploadActions.map((action) => ({
        name: action.name,
        size_bytes: action.size_bytes,
        sha256: action.sha256,
      })),
      preexisting_release: preexisting.status === 'complete'
        ? preexisting.observation.release
        : null,
      github_native_immutable_expected: false,
    };
  }
  const releaseResult = ensureRelease({
    baseAttemptId: admission.attemptId,
    repo,
    tag,
    name,
    notes,
    targetCommitish,
    prerelease: publicationChannel === 'nightly',
    operationDeadlineAt,
    runtime,
    initialInspection: preexisting.status === 'complete' ? preexisting.observation : undefined,
  });
  if (releaseResult.status !== 'complete') return releaseResult;
  if (releaseResult.inspection.release.draft === false) {
    assertReleaseAssetSet(releaseResult.inspection, uploadActions, true);
    return {
      status: 'complete',
      repository: repo,
      tag,
      uploaded: [],
      inspection: releaseResult.inspection,
      github_native_immutable: releaseResult.inspection.release.immutable === true,
    };
  }
  assertReleaseAssetSet(releaseResult.inspection, uploadActions, false);
  const uploaded: string[] = [];
  const releaseId = Number(releaseResult.inspection.release.id);
  for (const action of uploadActions) {
    const expectedDigest = action.sha256;
    const expectedSize = action.size_bytes;
    const before = inspectReleaseById(repo, tag, releaseId, runtime);
    assertReleaseIdentity(before, {
      tag,
      name,
      notes,
      targetCommitish,
      prerelease: publicationChannel === 'nightly',
      draft: true,
    });
    assertReleaseAssetSet(before, uploadActions, false);
    const current = before.assets.find((asset: JsonRecord) => asset.name === action.name);
    if (current) {
      if (current.sha256 === expectedDigest && current.size_bytes === expectedSize) continue;
      throw new Error(`Remote asset ${action.name} conflicts with the immutable Bundle.`);
    }
    const attempt = runGitHubMutation({
      mutation: 'asset_upload',
      attemptId: mutationAttemptId(
        admission.attemptId,
        'asset_upload',
        `github-release:${repo}@${tag}`,
        String(action.name),
      ),
      remoteTarget: `github-release:${repo}@${tag}`,
      args: ['release', 'upload', tag, action.source_path, '--repo', repo],
      operationDeadlineAt,
      runtime,
    });
    if (attempt.status !== 'accepted') {
      return stoppedMutation({
        attempt,
        repo,
        tag,
        uploaded,
        unresolvedAsset: action.name,
        reconciliation: inspectReleaseByIdForReconcile(repo, tag, releaseId, runtime),
      });
    }
    const reconciliation = inspectReleaseByIdForReconcile(repo, tag, releaseId, runtime);
    if (reconciliation.status !== 'complete') {
      return unknownAfterAcceptedMutation({
        mutation: 'asset_upload',
        operationDeadlineAt,
        attemptEvidence: attempt.evidence,
        repo,
        tag,
        uploaded,
        unresolvedAsset: action.name,
        reconciliation,
        reason: `GitHub accepted ${action.name} upload but immutable digest readback failed.`,
      });
    }
    const after = reconciliation.observation;
    assertReleaseIdentity(after, {
      tag,
      name,
      notes,
      targetCommitish,
      prerelease: publicationChannel === 'nightly',
      draft: true,
    });
    assertReleaseAssetSet(after, uploadActions, false);
    const observed = after.assets.find((asset: JsonRecord) => asset.name === action.name);
    if (observed?.sha256 === expectedDigest && observed?.size_bytes === expectedSize) {
      uploaded.push(action.name);
      continue;
    }
    if (observed) throw new Error(`Remote asset ${action.name} digest changed during upload.`);
    return unknownAfterAcceptedMutation({
      mutation: 'asset_upload',
      operationDeadlineAt,
      attemptEvidence: attempt.evidence,
      repo,
      tag,
      uploaded,
      unresolvedAsset: action.name,
      reconciliation,
      reason: 'GitHub accepted the upload but did not expose its immutable digest.',
    });
  }
  const publicationResult = publishDraftRelease({
    baseAttemptId: admission.attemptId,
    values,
    repo,
    tag,
    name,
    notes,
    targetCommitish,
    prerelease: publicationChannel === 'nightly',
    releaseId,
    actions: uploadActions,
    operationDeadlineAt,
    runtime,
    bundle,
  });
  if (publicationResult.status !== 'complete') {
    return { ...publicationResult, uploaded };
  }
  return {
    ...publicationResult,
    uploaded,
  };
}
