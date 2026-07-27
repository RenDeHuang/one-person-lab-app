#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { resolveReleaseOperationWindow } from './release-operation-deadline.ts';
import { resolvePreviewReleaseVersion } from './release-version.ts';

export type PreviewReleaseRequest = {
  operation: 'preview' | 'resume_preview';
  baseVersion?: string;
  appRef: string;
  shellRef?: string;
  frameworkRef?: string;
  sourceRunId?: string;
  sourceArtifact?: string;
  existingRefs?: string[];
  operationStartedAt?: string;
  latestOverrideRequested?: boolean;
};

const shaPattern = /^[0-9a-f]{40}$/;
const runIdPattern = /^[1-9][0-9]*$/;
const artifactPattern = /^[A-Za-z0-9._-]+$/;

function exactSha(value: string | undefined, label: string): string {
  if (!value || !shaPattern.test(value)) throw new Error(`${label} must be an exact lowercase Git SHA.`);
  return value;
}

export function resolvePreviewReleaseRequest(input: PreviewReleaseRequest) {
  const appRef = exactSha(input.appRef, 'App ref');
  if (input.operation === 'preview') {
    if (input.sourceRunId || input.sourceArtifact) {
      throw new Error('A new Preview cannot consume a recovery source.');
    }
    const baseVersion = input.baseVersion?.trim() ?? '';
    if (!/^\d{2}\.\d{1,2}\.\d{1,2}$/.test(baseVersion)) {
      throw new Error('Preview base version must be an unrevised YY.M.D value.');
    }
    const shellRef = exactSha(input.shellRef, 'Shell ref');
    const frameworkRef = exactSha(input.frameworkRef, 'Framework ref');
    const window = resolveReleaseOperationWindow({
      operation: 'standard',
      startedAt: input.operationStartedAt ?? '',
    });
    const identity = resolvePreviewReleaseVersion(baseVersion, input.existingRefs ?? []);
    return {
      schema: 'opl_manual_standard_preview_request.v1',
      operation: input.operation,
      publication_channel: 'preview',
      quality_status: 'preview',
      build_trigger: 'manual',
      preview_kind: 'dev',
      latest_override_requested: input.latestOverrideRequested === true,
      latest_override_authority: input.latestOverrideRequested === true
        ? 'protected_single_use_exact_version'
        : 'none',
      qualification_disclosure: {
        stable_qualified: false,
        passed_gates: ['standard_vm'],
        skipped_gates: ['homebrew_clean_install', 'native_webui', 'container_webui', 'full'],
        failed_gates: [],
        non_stable_notice: true,
      },
      version: identity.version,
      updater_version: identity.updaterVersion,
      app_ref: appRef,
      shell_ref: shellRef,
      framework_ref: frameworkRef,
      source_run_id: null,
      source_artifact: null,
      operation_started_at: window.startedAt,
      operation_deadline_at: window.deadlineAt,
    };
  }
  if (input.operation !== 'resume_preview') throw new Error('Preview operation must be preview or resume_preview.');
  if (
    input.baseVersion
    || input.shellRef
    || input.operationStartedAt
    || input.latestOverrideRequested !== undefined
    || (input.existingRefs?.length ?? 0) > 0
  ) {
    throw new Error('Preview recovery consumes only its exact checkpoint identity.');
  }
  if (!input.sourceRunId || !runIdPattern.test(input.sourceRunId)) {
    throw new Error('Preview recovery requires an exact source run id.');
  }
  if (!input.sourceArtifact || !artifactPattern.test(input.sourceArtifact)) {
    throw new Error('Preview recovery requires an exact source artifact name.');
  }
  const frameworkRef = input.frameworkRef ? exactSha(input.frameworkRef, 'Framework ref') : null;
  return {
    schema: 'opl_manual_standard_preview_request.v1',
    operation: input.operation,
    publication_channel: 'preview',
    quality_status: 'preview',
    build_trigger: 'manual',
    preview_kind: 'dev',
    latest_override_requested: null,
    latest_override_authority: 'checkpoint',
    qualification_disclosure: null,
    version: null,
    updater_version: null,
    app_ref: appRef,
    shell_ref: null,
    framework_ref: frameworkRef,
    source_run_id: input.sourceRunId,
    source_artifact: input.sourceArtifact,
    operation_started_at: null,
    operation_deadline_at: null,
  };
}

function main(): void {
  const { values } = parseArgs({
    options: {
      operation: { type: 'string' },
      'base-version': { type: 'string' },
      'app-ref': { type: 'string' },
      'shell-ref': { type: 'string' },
      'framework-ref': { type: 'string' },
      'source-run-id': { type: 'string' },
      'source-artifact': { type: 'string' },
      'existing-ref': { type: 'string', multiple: true },
      'operation-started-at': { type: 'string' },
      'latest-override-requested': { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  const operation = values.operation;
  if (operation !== 'preview' && operation !== 'resume_preview') {
    throw new Error('--operation must be preview or resume_preview.');
  }
  const latestOverrideValue = values['latest-override-requested'];
  if (
    latestOverrideValue !== undefined
    && latestOverrideValue !== 'true'
    && latestOverrideValue !== 'false'
  ) {
    throw new Error('--latest-override-requested must be true or false.');
  }
  const result = resolvePreviewReleaseRequest({
    operation,
    baseVersion: values['base-version'],
    appRef: values['app-ref'] ?? '',
    shellRef: values['shell-ref'],
    frameworkRef: values['framework-ref'],
    sourceRunId: values['source-run-id'],
    sourceArtifact: values['source-artifact'],
    existingRefs: values['existing-ref'],
    operationStartedAt: values['operation-started-at'],
    latestOverrideRequested: latestOverrideValue === undefined
      ? undefined
      : latestOverrideValue === 'true',
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
