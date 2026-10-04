import {
  inspectReleaseById,
  inspectReleaseByIdForReconcile,
  inspectReleaseForReconcile,
  mutationAttemptId,
  runGitHubMutation,
  stoppedMutation,
  unknownAfterAcceptedMutation,
  type GitHubAdapterRuntime,
} from './framework-release-adapter-publication-github.ts';
import {
  assertSameTagFullAssetPolicy,
  mutableStandardIdentityState,
  publicationTagTargetCommitish,
} from './framework-release-adapter-publication-admission.ts';
import { requireOption } from './framework-release-adapter-plan.ts';
import { digestRef, fullAddonIdentity, fullAddonPublicReleaseBody, sha256Bytes, type AdapterOptionValues, type GitHubApplyMode, type JsonRecord } from './framework-release-adapter-bundle.ts';

export function applyFullAddonPlan(input: {
  values: AdapterOptionValues;
  runtime: GitHubAdapterRuntime;
  bundle: JsonRecord;
  admission: JsonRecord;
  uploadActions: JsonRecord[];
  operationDeadlineAt: string;
  mutationMode: GitHubApplyMode;
  publicationStatus: string;
}): JsonRecord {
  const addon = fullAddonIdentity(
    input.bundle,
    input.uploadActions,
    requireOption(input.values, 'standard-attestation'),
  );
  const repo = String(input.bundle.sources?.app?.repo ?? '');
  const tag = String(addon.tag);
  const targetCommitish = publicationTagTargetCommitish(input.values, input.bundle, addon);
  const preexisting = inspectReleaseForReconcile(repo, tag, input.runtime, true);
  const currentBody = preexisting.status === 'complete' ? preexisting.observation.release.body : undefined;
  if (input.publicationStatus === 'reconcile_only') {
    const observation = preexisting;
    if (observation.status !== 'complete') {
      return {
        surface_kind: 'opl_app_github_same_tag_full_reconcile.v1',
        status: 'reconcile_only',
        repository: repo,
        tag,
        mutation_authorized: false,
        mutation_attempted: false,
        retry_disposition: 'read_only_reconcile_only_no_retry',
        reconciliation: { classification: 'unknown', ...observation },
        addon,
      };
    }
    try {
      const notesState = mutableStandardIdentityState(observation.observation, input.bundle, addon, currentBody);
      assertSameTagFullAssetPolicy(observation.observation, addon, input.uploadActions, false);
      const missing = input.uploadActions
        .filter((action) => !observation.observation.assets.some(
          (asset: JsonRecord) => asset.name === action.name,
        ))
        .map((action) => action.name);
      if (notesState === 'full_visible' && missing.length > 0) {
        throw new Error('Full availability notes cannot precede the exact Full asset set.');
      }
      const releaseNotesUpdateRequired = notesState !== 'full_visible';
      return {
        surface_kind: 'opl_app_github_same_tag_full_reconcile.v1',
        status: 'reconcile_only',
        repository: repo,
        tag,
        mutation_authorized: false,
        mutation_attempted: false,
        retry_disposition: 'read_only_reconcile_only_no_retry',
        reconciliation: {
          classification: missing.length === 0 && !releaseNotesUpdateRequired ? 'complete' : 'incomplete',
          missing_full_assets: missing,
          release_notes_update_required: releaseNotesUpdateRequired,
          observation: observation.observation,
        },
        addon,
      };
    } catch (error) {
      return {
        surface_kind: 'opl_app_github_same_tag_full_reconcile.v1',
        status: 'reconcile_only',
        repository: repo,
        tag,
        mutation_authorized: false,
        mutation_attempted: false,
        retry_disposition: 'read_only_reconcile_only_no_retry',
        reconciliation: {
          classification: 'conflict',
          reason: error instanceof Error ? error.message : String(error),
          observation: observation.observation,
        },
        addon,
      };
    }
  }
  if (preexisting.status !== 'complete') {
    throw new Error('Full append requires a complete read-only inspection of the exact Standard Release.');
  }
  const preexistingNotesState = mutableStandardIdentityState(preexisting.observation, input.bundle, addon, currentBody);
  assertSameTagFullAssetPolicy(preexisting.observation, addon, input.uploadActions, false);
  const preexistingMissing = input.uploadActions.filter((action) => !preexisting.observation.assets.some(
    (asset: JsonRecord) => asset.name === action.name,
  ));
  if (preexistingNotesState === 'full_visible' && preexistingMissing.length > 0) {
    throw new Error('Full availability notes cannot precede the exact Full asset set.');
  }
  if (input.mutationMode === 'rehearsal') {
    return {
      surface_kind: 'opl_app_github_publication_rehearsal.v1',
      status: 'rehearsal_complete',
      mutation_authorized: false,
      mutation_attempted: false,
      repository: repo,
      tag,
      track: 'full',
      operation: input.admission.operation,
      operation_id: input.admission.operationId,
      publication_channel: 'stable',
      target_commitish: targetCommitish,
      upload_actions: input.uploadActions.map((action) => ({
        name: action.name,
        size_bytes: action.size_bytes,
        sha256: action.sha256,
      })),
      preexisting_release: preexisting.observation.release,
      release_notes_patch_required: preexistingNotesState !== 'full_visible',
      release_notes_sha256: digestRef(sha256Bytes(fullAddonPublicReleaseBody(input.bundle, addon, currentBody))),
      addon,
      forbidden_mutations: ['tag_reserve', 'release_create', 'release_publish', 'latest_patch'],
    };
  }

  const uploaded: string[] = [];
  const releaseId = Number(addon.target_standard_release.release_id);
  for (const action of input.uploadActions) {
    const before = inspectReleaseById(repo, tag, releaseId, input.runtime);
    const notesState = mutableStandardIdentityState(before, input.bundle, addon, currentBody);
    assertSameTagFullAssetPolicy(before, addon, input.uploadActions, false);
    const missingBefore = input.uploadActions.filter((candidate) => !before.assets.some(
      (asset: JsonRecord) => asset.name === candidate.name,
    ));
    if (notesState === 'full_visible' && missingBefore.length > 0) {
      throw new Error('Full availability notes cannot precede the exact Full asset set.');
    }
    const current = before.assets.find((asset: JsonRecord) => asset.name === action.name);
    if (current) continue;
    const attempt = runGitHubMutation({
      mutation: 'asset_upload',
      attemptId: mutationAttemptId(
        input.admission.attemptId,
        'asset_upload',
        `github-release:${repo}@${tag}`,
        String(action.name),
      ),
      remoteTarget: `github-release:${repo}@${tag}`,
      args: ['release', 'upload', tag, action.source_path, '--repo', repo],
      operationDeadlineAt: input.operationDeadlineAt,
      runtime: input.runtime,
    });
    if (attempt.status !== 'accepted') {
      return stoppedMutation({
        attempt,
        repo,
        tag,
        uploaded,
        unresolvedAsset: action.name,
        reconciliation: inspectReleaseByIdForReconcile(repo, tag, releaseId, input.runtime),
      });
    }
    const reconciliation = inspectReleaseByIdForReconcile(repo, tag, releaseId, input.runtime);
    if (reconciliation.status !== 'complete') {
      return unknownAfterAcceptedMutation({
        mutation: 'asset_upload',
        operationDeadlineAt: input.operationDeadlineAt,
        attemptEvidence: attempt.evidence,
        repo,
        tag,
        uploaded,
        unresolvedAsset: action.name,
        reconciliation,
        reason: `GitHub accepted ${action.name} append but exact digest readback failed.`,
      });
    }
    const after = reconciliation.observation;
    try {
      mutableStandardIdentityState(after, input.bundle, addon, currentBody);
      assertSameTagFullAssetPolicy(after, addon, input.uploadActions, false);
    } catch (error) {
      return unknownAfterAcceptedMutation({
        mutation: 'asset_upload',
        operationDeadlineAt: input.operationDeadlineAt,
        attemptEvidence: attempt.evidence,
        repo,
        tag,
        uploaded,
        unresolvedAsset: action.name,
        reconciliation,
        reason: `GitHub accepted ${action.name} append but the sealed Standard or release identity changed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
    const observed = after.assets.find((asset: JsonRecord) => asset.name === action.name);
    if (observed?.sha256 === action.sha256 && observed?.size_bytes === action.size_bytes) {
      uploaded.push(action.name);
      continue;
    }
    return unknownAfterAcceptedMutation({
      mutation: 'asset_upload',
      operationDeadlineAt: input.operationDeadlineAt,
      attemptEvidence: attempt.evidence,
      repo,
      tag,
      uploaded,
      unresolvedAsset: action.name,
      reconciliation,
      reason: `GitHub accepted ${action.name} append but did not expose the exact digest.`,
    });
  }
  let finalInspection = inspectReleaseById(repo, tag, releaseId, input.runtime);
  const notesState = mutableStandardIdentityState(finalInspection, input.bundle, addon, currentBody);
  assertSameTagFullAssetPolicy(finalInspection, addon, input.uploadActions, true);
  let releaseNotesPatchApplied = false;
  if (notesState !== 'full_visible') {
    const desiredBody = fullAddonPublicReleaseBody(input.bundle, addon, currentBody);
    const remoteTarget = `github-release:${repo}@${tag}`;
    const attempt = runGitHubMutation({
      mutation: 'release_notes_patch',
      attemptId: mutationAttemptId(
        input.admission.attemptId,
        'release_notes_patch',
        remoteTarget,
        digestRef(sha256Bytes(desiredBody)),
      ),
      remoteTarget,
      args: ['api', '--method', 'PATCH', `repos/${repo}/releases/${releaseId}`, '--input', '-'],
      body: JSON.stringify({ body: desiredBody }),
      operationDeadlineAt: input.operationDeadlineAt,
      runtime: input.runtime,
    });
    if (attempt.status !== 'accepted') {
      return stoppedMutation({
        attempt,
        repo,
        tag,
        uploaded,
        unresolvedAsset: 'release-notes',
        reconciliation: inspectReleaseByIdForReconcile(repo, tag, releaseId, input.runtime),
      });
    }
    const reconciliation = inspectReleaseByIdForReconcile(repo, tag, releaseId, input.runtime);
    if (reconciliation.status !== 'complete') {
      return unknownAfterAcceptedMutation({
        mutation: 'release_notes_patch',
        operationDeadlineAt: input.operationDeadlineAt,
        attemptEvidence: attempt.evidence,
        repo,
        tag,
        uploaded,
        unresolvedAsset: 'release-notes',
        reconciliation,
        reason: 'GitHub accepted the Full availability notes patch but exact readback failed.',
      });
    }
    finalInspection = reconciliation.observation;
    try {
      if (mutableStandardIdentityState(finalInspection, input.bundle, addon, currentBody) !== 'full_visible') {
        throw new Error('Full availability notes digest did not match.');
      }
      assertSameTagFullAssetPolicy(finalInspection, addon, input.uploadActions, true);
    } catch (error) {
      return unknownAfterAcceptedMutation({
        mutation: 'release_notes_patch',
        operationDeadlineAt: input.operationDeadlineAt,
        attemptEvidence: attempt.evidence,
        repo,
        tag,
        uploaded,
        unresolvedAsset: 'release-notes',
        reconciliation,
        reason: `GitHub accepted the Full availability notes patch but public identity changed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
    releaseNotesPatchApplied = true;
  }
  return {
    surface_kind: 'opl_app_github_same_tag_full_append_result.v1',
    status: 'complete',
    repository: repo,
    tag,
    uploaded,
    inspection: finalInspection,
    addon: {
      ...addon,
      release_url: `https://github.com/${repo}/releases/tag/${tag}`,
      asset_download_base_url: `https://github.com/${repo}/releases/download/${tag}`,
    },
    standard_assets_modified: false,
    release_notes_modified: true,
    release_notes_patch_applied: releaseNotesPatchApplied,
    release_notes_sha256: digestRef(sha256Bytes(fullAddonPublicReleaseBody(input.bundle, addon, currentBody))),
    latest_modified: false,
    updater_metadata_modified: false,
  };
}
