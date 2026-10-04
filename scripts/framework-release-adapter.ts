#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  activateLatest,
  activatePublishedLatestPointer,
  applyPublishPlan,
  GitHubMutationFailure,
  githubMutationFailure,
  GitHubReadError,
  inspectRelease,
  persistGitHubMutationFailure,
} from './framework-release-adapter-publication.ts';
import {
  buildExecutorReceipt,
  buildFreezeRequest,
  buildQualificationReceipt,
  buildWebuiBuildInput,
  parseCommon,
  requireOption,
} from './framework-release-adapter-plan.ts';
import { releaseOperationDeadlineTimestamp } from './release-operation-deadline.ts';
import { writeJson, type JsonRecord } from './framework-release-adapter-bundle.ts';

// Release-boundary source contracts retain these Bundle-owned identity markers at the facade.
// app_source, base_image, codex_cli, dockerfile, framework_seed, qualification_harness,
// shell_webui_source, and standardAttestationIdentity are implemented by the extracted parts.
// Canonical Stable publication requires exactly one unified public attestation.
// assertCanonicalStandardPublicationBoundary remains the canonical Stable boundary.
// Rehearsal output preserves github_native_immutable_expected: false.

export {
  activateLatest,
  activatePublishedLatestPointer,
  applyPublishPlan,
  GitHubMutationFailure,
  inspectRelease,
} from './framework-release-adapter-publication.ts';
export {
  fullAddonIdentity,
  fullAddonPublicReleaseBody,
  projectPublicReleaseBody,
} from './framework-release-adapter-bundle.ts';
export { buildExecutorReceipt } from './framework-release-adapter-plan.ts';
export {
  githubApplyFullRequiredOptionNames,
  githubApplyRequiredOptionNames,
} from './framework-release-adapter-bundle.ts';
export type {
  GitHubAdapterRuntime,
  GitHubCommandOptions,
  GitHubCommandResult,
} from './framework-release-adapter-publication.ts';

function main(): void {
  const { values, positionals } = parseCommon(process.argv.slice(2));
  const command = positionals[0];
  try {
    let output: JsonRecord;
    if (command === 'freeze-request') {
      output = buildFreezeRequest(values);
    } else if (command === 'webui-build-input') {
      output = buildWebuiBuildInput(values);
    } else if (command === 'executor-receipt') {
      output = buildExecutorReceipt(values);
    } else if (command === 'qualification-receipt') {
      output = buildQualificationReceipt(values);
    } else if (command === 'github-inspect') {
      if (typeof values['operation-deadline-at'] === 'string') {
        releaseOperationDeadlineTimestamp(values['operation-deadline-at']);
      }
      output = inspectRelease(requireOption(values, 'repo'), requireOption(values, 'tag'));
    } else if (command === 'github-apply') {
      output = applyPublishPlan(values);
    } else if (command === 'github-activate-latest') {
      output = activateLatest(values);
    } else if (command === 'github-move-latest-pointer') {
      output = activatePublishedLatestPointer(values);
    } else {
      throw new Error('Usage: framework-release-adapter <freeze-request|webui-build-input|executor-receipt|qualification-receipt|github-inspect|github-apply|github-activate-latest|github-move-latest-pointer> ...');
    }
    if (typeof values.output === 'string' && values.output.trim()) writeJson(path.resolve(values.output), output);
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch (error) {
    if (
      command === 'github-apply'
      || command === 'github-activate-latest'
      || command === 'github-move-latest-pointer'
    ) {
      const typed = error instanceof GitHubMutationFailure
        ? error
        : githubMutationFailure(
            command,
            values,
            'github_mutation_failed',
            error instanceof Error ? error.message : String(error),
            {},
            error instanceof GitHubReadError ? error.evidence : undefined,
          );
      persistGitHubMutationFailure(command, values, typed.result);
      throw typed;
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
