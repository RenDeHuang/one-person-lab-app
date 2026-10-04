import path from 'node:path';
import { assertReleaseOperationDeadline, releaseOperationDeadlineTimestamp } from './release-operation-deadline.ts';
import { assertLatestPointerOperationAdmissionReceipt } from './validate-latest-pointer-operation.ts';
import { assertStandardLatestAdmissionReceipt } from './validate-standard-latest-admission.ts';
import { assertUpdaterVersionMatchesDisplay } from './release-version.ts';
import {
  defaultGitHubRuntime,
  ghRead,
  inspectLatestForReconcile,
  inspectRelease,
  mutationAttemptId,
  rejectGitHubMutation,
  runGitHubMutation,
  stoppedMutation,
  unknownAfterAcceptedMutation,
  type GitHubAdapterRuntime,
} from './framework-release-adapter-publication-github.ts';
import { assertStableGitHubMutationAdmission, standardPublicationChannel } from './framework-release-adapter-publication-admission.ts';
import { bundleDocument, requireOption } from './framework-release-adapter-plan.ts';
import { exactJson, latestPointerInspectionIdentity, readJson, type AdapterOptionValues, type GitHubMutationCommand, type JsonRecord } from './framework-release-adapter-bundle.ts';

export function activateLatestCas(input: {
  command: GitHubMutationCommand;
  values: AdapterOptionValues;
  repo: string;
  tag: string;
  expectedCurrentLatestTag: string;
  attemptId: string;
  operationDeadlineAt: string;
  runtime: GitHubAdapterRuntime;
}): JsonRecord {
  const inspection = inspectRelease(input.repo, input.tag, input.runtime);
  if (!inspection.release.exists || !inspection.release.id) {
    throw new Error(`Release ${input.tag} is missing.`);
  }
  const latest = ghRead(
    ['api', `repos/${input.repo}/releases/latest`],
    input.runtime,
    { allow404: true },
  ) as JsonRecord | null;
  const observedLatestTag = typeof latest?.tag_name === 'string' ? latest.tag_name : null;
  if (observedLatestTag === input.tag) {
    return {
      status: 'idempotent',
      repository: input.repo,
      tag: input.tag,
      latest_compare_and_swap: {
        expected_current_tag: input.expectedCurrentLatestTag,
        observed_current_tag: observedLatestTag,
        patch_performed: false,
      },
    };
  }
  if (observedLatestTag !== input.expectedCurrentLatestTag) {
    rejectGitHubMutation(
      input.command,
      input.values,
      'github_latest_compare_and_swap_drift',
      `Latest drifted: expected ${input.expectedCurrentLatestTag}, observed ${observedLatestTag ?? '<missing>'}.`,
      {
        expected_current_tag: input.expectedCurrentLatestTag,
        observed_current_tag: observedLatestTag,
        candidate_tag: input.tag,
      },
      'inspect_only_no_patch_require_new_admission',
    );
  }
  const attempt = runGitHubMutation({
    mutation: 'latest_patch',
    attemptId: mutationAttemptId(
      input.attemptId,
      'latest_patch',
      `github-latest:${input.repo}@${input.tag}`,
      input.tag,
    ),
    remoteTarget: `github-latest:${input.repo}@${input.tag}`,
    args: [
      'api',
      '--method',
      'PATCH',
      `repos/${input.repo}/releases/${inspection.release.id}`,
      '--input',
      '-',
    ],
    body: JSON.stringify({ make_latest: 'true' }),
    operationDeadlineAt: input.operationDeadlineAt,
    runtime: input.runtime,
  });
  if (attempt.status !== 'accepted') {
    return stoppedMutation({
      attempt,
      repo: input.repo,
      tag: input.tag,
      reconciliation: inspectLatestForReconcile(input.repo, input.runtime),
    });
  }
  const reconciliation = inspectLatestForReconcile(input.repo, input.runtime);
  if (
    reconciliation.status !== 'complete'
    || reconciliation.observation?.tag_name !== input.tag
  ) {
    return unknownAfterAcceptedMutation({
      mutation: 'latest_patch',
      operationDeadlineAt: input.operationDeadlineAt,
      attemptEvidence: attempt.evidence,
      repo: input.repo,
      tag: input.tag,
      reconciliation,
      reason: `Latest readback did not prove ${input.tag}.`,
    });
  }
  return {
    status: 'complete',
    repository: input.repo,
    tag: input.tag,
    latest_compare_and_swap: {
      expected_current_tag: input.expectedCurrentLatestTag,
      observed_current_tag: observedLatestTag,
      patch_performed: true,
    },
  };
}

export function activateLatest(
  values: AdapterOptionValues,
  runtime: GitHubAdapterRuntime = defaultGitHubRuntime,
): JsonRecord {
  const admission = assertStableGitHubMutationAdmission('github-activate-latest', values, 'standard');
  const operationDeadlineAt = requireOption(values, 'operation-deadline-at');
  releaseOperationDeadlineTimestamp(operationDeadlineAt);
  const bundle = bundleDocument(requireOption(values, 'bundle'));
  const publicationChannel = standardPublicationChannel('github-activate-latest', values, bundle);
  assertUpdaterVersionMatchesDisplay(
    publicationChannel,
    String(bundle.release?.version ?? ''),
    String(bundle.release?.updater_version ?? ''),
  );
  const status = readJson(path.resolve(requireOption(values, 'status'))).release_bundle_status;
  if (status?.bundle_digest !== bundle.bundle_digest) {
    throw new Error('Framework status does not describe the immutable Bundle input.');
  }
  const statusBundle = status.bundle;
  if (
    statusBundle?.bundle_digest !== bundle.bundle_digest
    || statusBundle?.release?.channel !== bundle.release.channel
    || statusBundle?.release?.version !== bundle.release.version
    || statusBundle?.release?.updater_version !== bundle.release.updater_version
    || statusBundle?.release?.tag !== bundle.release.tag
    || statusBundle?.release?.prerelease !== bundle.release.prerelease
    || statusBundle?.sources?.app?.source_commit !== bundle.sources.app.source_commit
    || statusBundle?.sources?.shell?.source_commit !== bundle.sources.shell.source_commit
    || statusBundle?.sources?.framework?.source_commit !== bundle.sources.framework.source_commit
  ) {
    throw new Error('Framework status Bundle projection does not match the immutable Bundle input.');
  }
  if (!Array.isArray(status.tracks?.standard?.assets)) {
    throw new Error('Framework status has no verified Standard staged assets.');
  }
  const standardControl = status.operation_controls?.standard;
  if (
    standardControl?.operation_id !== admission.operationId
    || standardControl?.operation_started_at !== admission.operationStartedAt
    || standardControl?.operation_deadline_at !== operationDeadlineAt
  ) {
    throw new Error('Framework status does not match the exact admitted Standard operation control.');
  }
  const latestAdmission = readJson(path.resolve(requireOption(values, 'latest-admission')));
  assertStandardLatestAdmissionReceipt(latestAdmission, {
    publicationChannel,
    bundleDigest: bundle.bundle_digest,
    candidateDisplayVersion: bundle.release.version,
    candidateUpdaterVersion: bundle.release.updater_version,
    appSha: bundle.sources.app.source_commit,
    shellSha: bundle.sources.shell.source_commit,
    frameworkSha: bundle.sources.framework.source_commit,
    standardAssets: status.tracks.standard.assets,
  });
  const repo = bundle.sources.app.repo;
  const tag = bundle.release.tag;
  const expectedCurrentLatestTag = latestAdmission.latest_compare_and_swap.expected_current.tag;
  return activateLatestCas({
    command: 'github-activate-latest',
    values,
    repo,
    tag,
    expectedCurrentLatestTag,
    attemptId: admission.attemptId,
    operationDeadlineAt,
    runtime,
  });
}

export function activatePublishedLatestPointer(
  values: AdapterOptionValues,
  runtime: GitHubAdapterRuntime = defaultGitHubRuntime,
): JsonRecord {
  if (values['run-attempt'] !== '1' || values.operation !== 'move_latest_pointer') {
    rejectGitHubMutation(
      'github-move-latest-pointer',
      values,
      'github_pointer_operation_rejected',
      'Published Latest pointer mutation requires move_latest_pointer on run attempt 1.',
    );
  }
  const operationId = requireOption(values, 'operation-id');
  const attemptId = requireOption(values, 'attempt-id');
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(operationId)
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(attemptId)
  ) {
    rejectGitHubMutation(
      'github-move-latest-pointer',
      values,
      'github_pointer_operation_identity_rejected',
      'Published Latest pointer mutation requires exact operation and attempt identities.',
    );
  }
  const operationStartedAt = requireOption(values, 'operation-started-at');
  const operationDeadlineAt = requireOption(values, 'operation-deadline-at');
  assertReleaseOperationDeadline({
    operation: 'move_latest_pointer',
    startedAt: operationStartedAt,
    deadlineAt: operationDeadlineAt,
    now: new Date(runtime.now()).toISOString(),
  });
  const repo = requireOption(values, 'repo');
  const tag = requireOption(values, 'tag');
  const expectedCurrentLatestTag = requireOption(values, 'expected-current-latest-tag');
  const releaseInspectionPath = path.resolve(requireOption(values, 'release-inspection'));
  const pointerInput = {
    repository: repo,
    componentManifestPath: path.resolve(requireOption(values, 'component-manifest')),
    releaseInspectionPath,
    authorityPath: path.resolve(requireOption(values, 'pointer-authority')),
    expectedCurrentLatestTag,
    runId: operationId,
    runAttempt: requireOption(values, 'run-attempt'),
    operationStartedAt,
    operationDeadlineAt,
  };
  const receipt = readJson(path.resolve(requireOption(values, 'pointer-admission')));
  assertLatestPointerOperationAdmissionReceipt(receipt, pointerInput);
  const freshInspection = inspectRelease(repo, tag, runtime);
  exactJson(
    latestPointerInspectionIdentity(freshInspection),
    latestPointerInspectionIdentity(readJson(releaseInspectionPath)),
    'Published exact release inspection',
  );
  if (
    tag !== receipt.candidate?.tag
    || expectedCurrentLatestTag
      !== receipt.latest_compare_and_swap?.expected_current_tag
  ) {
    rejectGitHubMutation(
      'github-move-latest-pointer',
      values,
      'github_pointer_receipt_identity_rejected',
      'Published Latest pointer mutation differs from its exact admission receipt.',
    );
  }
  const result = activateLatestCas({
    command: 'github-move-latest-pointer',
    values,
    repo,
    tag,
    expectedCurrentLatestTag,
    attemptId,
    operationDeadlineAt,
    runtime,
  });
  return {
    ...result,
    operation: 'move_latest_pointer',
    component_manifest_digest: receipt.candidate.component_manifest_digest,
    quality_status: receipt.candidate.quality_status,
    build_trigger: receipt.candidate.build_trigger,
    preview_kind: receipt.candidate.preview_kind,
    quality_unchanged: true,
    non_stable_notice: receipt.candidate.quality_status === 'preview',
    skipped_gates: receipt.candidate.qualification_disclosure.skipped_gates,
    persistent_override: false,
    stable_reclaim: 'next_qualified_stable',
  };
}
