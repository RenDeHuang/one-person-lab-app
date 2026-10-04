import path from 'node:path';
import { assertUpdaterVersionMatchesDisplay } from './release-version.ts';
import { releaseOperationDeadlineTimestamp } from './release-operation-deadline.ts';
import {
  assertStableGitHubMutationAdmission,
  githubApplyMode,
  plannedUploadActions,
  standardPublicationChannel,
  supplementalUploadActions,
} from './framework-release-adapter-publication-admission.ts';
import {
  defaultGitHubRuntime,
  githubMutationFailure,
  GitHubMutationFailure,
  GitHubReadError,
  persistGitHubMutationFailure,
  type GitHubAdapterRuntime,
} from './framework-release-adapter-publication-github.ts';
import { applyFullAddonPlan } from './framework-release-adapter-publication-full-addon.ts';
import { applyStandardPublishPlan } from './framework-release-adapter-publication-standard.ts';
import { bundleDocument, requireOption } from './framework-release-adapter-plan.ts';
import { readJson, type AdapterOptionValues, type JsonRecord } from './framework-release-adapter-bundle.ts';

export * from './framework-release-adapter-publication-github.ts';
export * from './framework-release-adapter-publication-admission.ts';
export * from './framework-release-adapter-publication-standard.ts';
export * from './framework-release-adapter-publication-full-addon.ts';
export * from './framework-release-adapter-publication-latest.ts';

export function applyPublishPlanInternal(
  values: AdapterOptionValues,
  runtime: GitHubAdapterRuntime = defaultGitHubRuntime,
): JsonRecord {
  const admission = assertStableGitHubMutationAdmission('github-apply', values);
  const mutationMode = githubApplyMode(values);
  const operationDeadlineAt = requireOption(values, 'operation-deadline-at');
  releaseOperationDeadlineTimestamp(operationDeadlineAt);
  const bundle = bundleDocument(requireOption(values, 'bundle'));
  const publicationChannel = standardPublicationChannel('github-apply', values, bundle);
  if (admission.track === 'full' && publicationChannel !== 'stable') {
    throw githubMutationFailure(
      'github-apply',
      values,
      'github_mutation_non_stable_full_publication',
      'Full publication requires the Stable publication channel.',
      { publication_channel: publicationChannel, operation: admission.operation, track: admission.track },
    );
  }
  assertUpdaterVersionMatchesDisplay(
    publicationChannel,
    String(bundle.release?.version ?? ''),
    String(bundle.release?.updater_version ?? ''),
  );
  const plan = readJson(path.resolve(requireOption(values, 'plan')));
  const publication = plan.release_bundle_publish;
  if (publication?.bundle_digest !== bundle.bundle_digest) {
    throw new Error('Framework publish plan is bound to a different Bundle.');
  }
  if (publication.track !== admission.track) {
    throw githubMutationFailure(
      'github-apply',
      values,
      'github_mutation_framework_track_mismatch',
      `Framework publish plan track ${String(publication.track ?? '<missing>')} does not match admitted ${admission.track}.`,
      {
        operation: admission.operation,
        admitted_track: admission.track,
        framework_plan_track: publication.track ?? null,
      },
    );
  }
  const frameworkControl = publication.receipt?.operation_control;
  if (
    publication.receipt?.release_operation !== admission.operation
    || frameworkControl?.operation_id !== admission.operationId
    || frameworkControl?.operation_started_at !== admission.operationStartedAt
    || frameworkControl?.operation_deadline_at !== operationDeadlineAt
  ) {
    throw githubMutationFailure(
      'github-apply',
      values,
      'github_mutation_framework_operation_mismatch',
      'Framework publish plan does not match the exact admitted operation control.',
      {
        admitted_operation: admission.operation,
        admitted_operation_id: admission.operationId,
        framework_operation: publication.receipt?.release_operation ?? null,
        framework_operation_control: frameworkControl ?? null,
      },
    );
  }
  const actions = publication.receipt?.details?.upload_actions;
  const uploadActions = plannedUploadActions([
    ...plannedUploadActions(actions),
    ...supplementalUploadActions(values),
  ]);
  if (admission.track === 'full') {
    return applyFullAddonPlan({
      values,
      runtime,
      bundle,
      admission,
      uploadActions,
      operationDeadlineAt,
      mutationMode,
      publicationStatus: String(publication.status ?? ''),
    });
  }
  return applyStandardPublishPlan({
    values,
    runtime,
    bundle,
    admission,
    uploadActions,
    operationDeadlineAt,
    mutationMode,
    publicationChannel,
    publicationStatus: String(publication.status ?? ''),
  });
}

export function applyPublishPlan(
  values: AdapterOptionValues,
  runtime: GitHubAdapterRuntime = defaultGitHubRuntime,
): JsonRecord {
  const mutationAttempts: JsonRecord[] = [];
  const trackedRuntime: GitHubAdapterRuntime = {
    ...runtime,
    run: runtime.run.bind(runtime),
    now: runtime.now.bind(runtime),
    ...(runtime.wait ? { wait: runtime.wait.bind(runtime) } : {}),
    onMutationAttempt(evidence) {
      mutationAttempts.push(evidence);
      runtime.onMutationAttempt?.(evidence);
    },
  };
  try {
    return applyPublishPlanInternal(values, trackedRuntime);
  } catch (error) {
    if (mutationAttempts.length === 0) throw error;
    if (error instanceof GitHubMutationFailure) {
      throw new GitHubMutationFailure(error.message, {
        ...error.result,
        mutation_attempted: true,
        mutation_attempts: mutationAttempts,
        retry_disposition: 'read_only_reconcile_only_no_retry',
        failure: {
          ...error.result.failure,
          mutation_attempted: true,
          mutation_attempts: mutationAttempts,
        },
      });
    }
    const typed = githubMutationFailure(
      'github-apply',
      values,
      'github_mutation_failed',
      error instanceof Error ? error.message : String(error),
      {
        mutation_attempted: true,
        mutation_attempts: mutationAttempts,
      },
      error instanceof GitHubReadError ? error.evidence : undefined,
      'read_only_reconcile_only_no_retry',
    );
    typed.result.mutation_attempted = true;
    typed.result.mutation_attempts = mutationAttempts;
    throw typed;
  }
}
