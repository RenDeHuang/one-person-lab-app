import path from 'node:path';
import { validateStableOperationPublicationRecord } from './stable-operation-publication-record.ts';
import { rejectGitHubMutation } from './framework-release-adapter-publication-github.ts';
import { requireOption } from './framework-release-adapter-plan.ts';
import { canonicalJson, canonicalStableRepository, digestPattern, fullAddonPublicReleaseBody, bundlePublicReleaseBody, readJson, regularFileBytes, releaseAssetNamePattern, sha256Bytes, standardAttestationIdentity, standardInstallerSidecarAssetNames, type AdapterOptionValues, type GitHubApplyMode, type JsonRecord, type StableReleaseOperation, type StandardPublicationChannel, type Track } from './framework-release-adapter-bundle.ts';

export function assertStableGitHubMutationAdmission(
  command: 'github-apply' | 'github-activate-latest',
  values: AdapterOptionValues,
  requiredTrack?: Track,
): {
  operation: StableReleaseOperation;
  operationId: string;
  operationStartedAt: string;
  attemptId: string;
  track: Track;
} {
  const runAttempt = values['run-attempt'];
  if (runAttempt !== '1') {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_run_attempt_rejected',
      'GitHub mutation requires --run-attempt 1.',
    );
  }
  const operation = values.operation;
  if (operation !== 'standard' && operation !== 'resume_standard' && operation !== 'append_full') {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_operation_rejected',
      'GitHub mutation requires --operation standard, resume_standard, or append_full.',
    );
  }
  const track = values.track;
  if (track !== 'standard' && track !== 'full') {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_track_rejected',
      'GitHub mutation requires --track standard or full.',
    );
  }
  if (
    (track === 'standard' && operation === 'append_full')
    || (track === 'full' && operation !== 'append_full')
    || (requiredTrack !== undefined && track !== requiredTrack)
  ) {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_operation_track_mismatch',
      `${command} rejects operation ${operation} for track ${track}.`,
      { operation, track, required_track: requiredTrack ?? null },
    );
  }
  const operationId = values['operation-id'];
  if (typeof operationId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(operationId)) {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_operation_id_rejected',
      'GitHub mutation requires one canonical --operation-id.',
    );
  }
  const attemptId = values['attempt-id'];
  if (typeof attemptId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(attemptId)) {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_attempt_id_rejected',
      'GitHub mutation requires one canonical --attempt-id.',
    );
  }
  const operationStartedAt = values['operation-started-at'];
  if (typeof operationStartedAt !== 'string' || !operationStartedAt.trim()) {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_operation_start_rejected',
      'GitHub mutation requires the immutable --operation-started-at.',
    );
  }
  return { operation, operationId, operationStartedAt, attemptId, track };
}

export function standardPublicationChannel(
  command: 'github-apply' | 'github-activate-latest',
  values: AdapterOptionValues,
  bundle: JsonRecord,
): StandardPublicationChannel {
  const requested = values['publication-channel'];
  if (requested !== 'stable' && requested !== 'nightly' && requested !== 'preview') {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_publication_channel_rejected',
      'Missing --publication-channel or invalid value; expected stable, nightly, or preview.',
    );
  }
  const publicationChannel = requested as StandardPublicationChannel;
  const expectedPrerelease = publicationChannel === 'nightly';
  if (
    bundle.release?.channel !== publicationChannel
    || bundle.release?.prerelease !== expectedPrerelease
  ) {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_publication_bundle_mismatch',
      `Publication channel ${publicationChannel} requires a ${publicationChannel} Bundle with prerelease=${expectedPrerelease}.`,
      { publication_channel: publicationChannel },
    );
  }
  return publicationChannel;
}

export function githubApplyMode(values: AdapterOptionValues): GitHubApplyMode {
  const mode = values['mutation-mode'];
  if (mode !== 'rehearsal' && mode !== 'execute') {
    rejectGitHubMutation(
      'github-apply',
      values,
      'github_mutation_mode_rejected',
      'Missing --mutation-mode or invalid value; expected rehearsal or execute.',
    );
  }
  return mode as GitHubApplyMode;
}

export function publicationTagTargetCommitish(
  values: AdapterOptionValues,
  bundle: JsonRecord,
  fullAddon: JsonRecord | null,
): string {
  const bundleAppSource = String(bundle.sources?.app?.source_commit ?? '');
  if (!/^[0-9a-f]{40}$/.test(bundleAppSource)) {
    throw new Error('Framework Bundle App source commit is not an exact lowercase SHA.');
  }
  if (!fullAddon) return bundleAppSource;

  const executorAppSha = requireOption(values, 'executor-app-sha');
  const manifestExecutorAppSha = String(fullAddon.release_executor?.app_sha ?? '');
  if (!/^[0-9a-f]{40}$/.test(executorAppSha) || executorAppSha !== manifestExecutorAppSha) {
    rejectGitHubMutation(
      'github-apply',
      values,
      'github_full_executor_identity_rejected',
      'Full publication executor SHA must match the exact release executor recorded by the Full manifest.',
      {
        executor_app_sha: executorAppSha,
        manifest_executor_app_sha: manifestExecutorAppSha || null,
      },
    );
  }
  return String(fullAddon.target_standard_release?.target_commitish ?? '');
}
export function assertPublicationAuthority(
  values: AdapterOptionValues,
  repo: string,
  bundle: JsonRecord,
  admission: { operationId: string; track: Track },
  actions: JsonRecord[],
): void {
  const publicationRecordPath = values['publication-record'];
  if (typeof publicationRecordPath === 'string' && publicationRecordPath.trim()) {
    try {
      if (bundle.release?.channel !== 'stable') {
        throw new Error('A Stable publication record cannot authorize a non-Stable carrier.');
      }
      const publicationRecord = validateStableOperationPublicationRecord(
        readJson(path.resolve(publicationRecordPath)),
      );
      const authority = publicationRecord.operation.authority;
      if (
        publicationRecord.publication_target.repository !== repo
        || publicationRecord.publication_target.tag !== bundle.release?.tag
        || authority.cohort.app_sha !== bundle.sources?.app?.source_commit
        || authority.cohort.shell_sha !== bundle.sources?.shell?.source_commit
        || authority.cohort.framework_sha !== bundle.sources?.framework?.source_commit
      ) {
        throw new Error('Publication record repository, base tag, or cohort does not match the exact Bundle.');
      }
      if (admission.track === 'standard') {
        // Stable authority and Framework Bundle publication are distinct operation domains.
        const authorityRunId = values['authority-run-id'];
        if (
          typeof authorityRunId !== 'string'
          || !/^[1-9][0-9]*$/.test(authorityRunId)
          || publicationRecord.operation.run_bound_control.run_id !== authorityRunId
        ) {
          throw new Error('Publication record authority run does not match the admitted Stable source run.');
        }
        const recordBytes = regularFileBytes(
          path.resolve(publicationRecordPath),
          'Stable operation publication record',
        );
        if (canonicalJson(JSON.parse(recordBytes.toString('utf8'))) !== canonicalJson(publicationRecord)) {
          throw new Error('Durable publication record file does not match the validated internal evidence.');
        }
        const expectedPayload = publicationRecord.publication_intent.payload_assets
          .map((asset) => ({
            name: asset.name,
            digest: asset.digest,
            size_bytes: asset.size_bytes,
          }))
          .sort((left, right) => left.name.localeCompare(right.name));
        const actualPayload = actions
          .filter((action) => (
            action.name !== 'opl-release-attestation.json'
            && !standardInstallerSidecarAssetNames.includes(action.name)
          ))
          .map((action) => ({
            name: String(action.name),
            digest: String(action.sha256),
            size_bytes: Number(action.size_bytes),
          }))
          .sort((left, right) => left.name.localeCompare(right.name));
        if (canonicalJson(actualPayload) !== canonicalJson(expectedPayload)) {
          throw new Error('Publication record payload assets do not match the exact Standard publish plan.');
        }
      }
      return;
    } catch (error) {
      rejectGitHubMutation(
        'github-apply',
        values,
        'github_publication_record_invalid',
        'Bound Stable publication authority is invalid.',
        {
          repository: repo,
          publication_record: publicationRecordPath,
          validation_error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }
  if (bundle.release?.channel === 'stable' && repo === canonicalStableRepository) {
    rejectGitHubMutation(
      'github-apply',
      values,
      'github_publication_record_invalid',
      'Canonical Stable publication requires the source-gate-bound publication record.',
      { repository: repo, publication_record: null },
    );
  }
}

export function assertCanonicalStandardPublicationBoundary(
  values: AdapterOptionValues,
  repo: string,
  bundle: JsonRecord,
  admission: { operationId: string; track: Track },
  actions: JsonRecord[],
): void {
  assertPublicationAuthority(values, repo, bundle, admission, actions);
  const attestationActions = actions.filter((action) => action.name === 'opl-release-attestation.json');
  if (attestationActions.length !== 1) {
    rejectGitHubMutation(
      'github-apply',
      values,
      'github_standard_attestation_missing',
      'Canonical Stable publication requires exactly one unified public attestation.',
    );
  }
  const attestationIdentity = standardAttestationIdentity(
    String(attestationActions[0]!.source_path),
    bundle,
  );
  if (
    attestationActions[0]!.sha256 !== attestationIdentity.sha256
    || attestationActions[0]!.size_bytes !== attestationIdentity.size_bytes
  ) {
    rejectGitHubMutation(
      'github-apply',
      values,
      'github_standard_attestation_mismatch',
      'Unified public attestation upload action does not match its exact bytes.',
    );
  }
}
export function plannedUploadActions(actions: unknown): JsonRecord[] {
  if (!Array.isArray(actions)) {
    throw new Error('Framework publish plan has no structured upload_actions.');
  }
  const names = new Set<string>();
  for (const action of actions as JsonRecord[]) {
    if (
      action.action !== 'upload'
      || typeof action.name !== 'string'
      || action.name.trim() !== action.name
      || action.name.length === 0
      || typeof action.source_path !== 'string'
      || action.source_path.length === 0
      || !Number.isSafeInteger(action.size_bytes)
      || Number(action.size_bytes) <= 0
      || !digestPattern.test(String(action.sha256 ?? ''))
      || names.has(action.name)
    ) {
      throw new Error('Framework publish plan contains duplicate or invalid asset names.');
    }
    names.add(action.name);
  }
  return actions as JsonRecord[];
}

export function supplementalUploadActions(values: AdapterOptionValues): JsonRecord[] {
  const source = values['additional-upload-actions'];
  if (source === undefined || source === '') return [];
  if (typeof source !== 'string') {
    throw new Error('Additional immutable upload actions must be one JSON file path.');
  }
  const document = readJson(path.resolve(source));
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('Additional immutable upload actions must be one JSON object.');
  }
  const actions = (document as JsonRecord).upload_actions;
  if (!Array.isArray(actions)) {
    throw new Error('Additional immutable upload actions must expose upload_actions.');
  }
  return actions as JsonRecord[];
}

export function assertReleaseAssetSet(
  inspection: JsonRecord,
  actions: JsonRecord[],
  exact: boolean,
): void {
  const planned = new Map(actions.map((action) => [String(action.name), action]));
  const remoteNames = new Set<string>();
  for (const asset of inspection.assets as JsonRecord[]) {
    const name = String(asset.name ?? '');
    if (!name || remoteNames.has(name)) {
      throw new Error(`Remote Release contains duplicate asset name ${name || '<missing>'}.`);
    }
    remoteNames.add(name);
    const expected = planned.get(name);
    if (!expected) {
      throw new Error(`Remote Release contains unexpected asset outside the exact planned set: ${name}.`);
    }
    if (asset.sha256 !== expected.sha256 || asset.size_bytes !== expected.size_bytes) {
      throw new Error(`Remote asset ${name} conflicts with the immutable publish plan.`);
    }
  }
  if (
    exact
    && (
      remoteNames.size !== planned.size
      || [...planned.keys()].some((name) => !remoteNames.has(name))
    )
  ) {
    throw new Error('Remote Release asset set is incomplete for immutable publication.');
  }
}

export function mutableStandardIdentityState(
  inspection: JsonRecord,
  bundle: JsonRecord,
  addon: JsonRecord,
  currentBody?: string,
): 'standard_notes' | 'full_visible' {
  const target = addon.target_standard_release as JsonRecord;
  if (
    inspection.release?.exists !== true
    || inspection.release?.id !== target.release_id
    || inspection.tag !== target.tag
    || inspection.release?.draft !== false
    || inspection.release?.prerelease !== false
    || inspection.release?.immutable !== false
    || inspection.release?.target_commitish !== target.target_commitish
    || inspection.release?.name !== `One Person Lab v${bundle.release?.version}`
  ) {
    throw new Error('Full append target is not the exact published mutable Standard Release.');
  }
  const bodySha256 = String(inspection.release?.body_sha256 ?? '');
  if (bodySha256 === sha256Bytes(fullAddonPublicReleaseBody(bundle, addon, currentBody))) return 'full_visible';
  if (bodySha256 === sha256Bytes(currentBody ?? bundlePublicReleaseBody(bundle))) return 'standard_notes';
  throw new Error('Full append target has unrecognized Release notes.');
}

export function assertSameTagFullAssetPolicy(
  inspection: JsonRecord,
  addon: JsonRecord,
  actions: JsonRecord[],
  exactFull: boolean,
): void {
  const standard = new Map(
    (addon.sealed_standard_assets as JsonRecord[]).map((asset) => [String(asset.name), asset]),
  );
  const full = new Map(actions.map((asset) => [String(asset.name), asset]));
  const remote = new Map<string, JsonRecord>();
  for (const asset of inspection.assets as JsonRecord[]) {
    const name = String(asset.name ?? '');
    if (!name || remote.has(name)) throw new Error(`Remote Release contains duplicate asset name ${name || '<missing>'}.`);
    if (!releaseAssetNamePattern.test(name)) {
      throw new Error(`Remote Release asset ${name || '<missing>'} has an unsafe basename.`);
    }
    if (
      !Number.isSafeInteger(asset.size_bytes)
      || Number(asset.size_bytes) <= 0
      || !digestPattern.test(String(asset.sha256 ?? ''))
    ) {
      throw new Error(`Remote mutable Standard asset ${name || '<missing>'} has no exact digest and positive size.`);
    }
    remote.set(name, asset);
    const expected = standard.get(name) ?? full.get(name);
    if (expected && (asset.sha256 !== expected.sha256 || asset.size_bytes !== expected.size_bytes)) {
      throw new Error(`Remote asset ${name} conflicts with its sealed name, size, or digest.`);
    }
  }
  for (const name of standard.keys()) {
    if (!remote.has(name)) throw new Error(`Remote mutable Standard is missing sealed Standard asset ${name}.`);
  }
  if (exactFull) {
    for (const name of full.keys()) {
      if (!remote.has(name)) throw new Error(`Remote mutable Standard is missing appended Full asset ${name}.`);
    }
  }
}
