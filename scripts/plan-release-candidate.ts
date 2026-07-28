#!/usr/bin/env node

import { parseArgs as parseNodeArgs } from 'node:util';
import {
  assertReleaseVersionNotFuture,
  resolveReleaseVersionIdentity,
} from './release-version.ts';

type StableOperation = 'standard' | 'resume_standard' | 'append_full';

type Options = {
  version: string;
  includeFullIntent: boolean;
  qualificationRequested: boolean;
};

const stableOperations: StableOperation[] = [
  'standard',
  'resume_standard',
  'append_full',
];

function parseArgs(argv: string[]): Options {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      version: { type: 'string' },
      profile: { type: 'string' },
      'include-full-package': { type: 'boolean' },
      'no-settings-vm': { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  const version = values.version?.trim() || process.env.OPL_RELEASE_VERSION?.trim() || '';
  const profile = values.profile?.trim() || 'stable';
  if (!version) throw new Error('Missing --version <display-version>.');
  if (profile !== 'stable') {
    throw new Error('This retired projection accepts only the Stable Framework Bundle topology.');
  }
  assertReleaseVersionNotFuture('stable', version);
  return {
    version,
    includeFullIntent: values['include-full-package'] === true,
    qualificationRequested: values['no-settings-vm'] !== true,
  };
}

function buildProjection(options: Options) {
  const identity = resolveReleaseVersionIdentity('stable', options.version);
  return {
    schema: 'opl_app_framework_release_operation_projection.v1',
    lifecycle: 'retired_read_only_projection',
    authoritative: false,
    display_version: identity.displayVersion,
    updater_version: identity.updaterVersion,
    state_authority: {
      owner: 'OPL Framework',
      cli: 'opl release',
      checkpoint_schema: 'opl_release_bundle_checkpoint.v1',
      receipt_schema: 'opl_release_bundle_operation_receipt.v1',
    },
    stable_entry: '.github/workflows/release-stable.yml',
    stable_operations: [
      {
        operation: 'standard' as const,
        source: 'new_framework_bundle',
        build_allowed: true,
        qualification_requested: options.qualificationRequested,
        standard_latest_may_complete_before_full: true,
      },
      {
        operation: 'resume_standard' as const,
        source: 'portable_framework_checkpoint',
        completed_stages: 'skip',
        rebuild_performed: false,
        unknown_outcome: 'inspect_then_framework_reconcile',
      },
      {
        operation: 'append_full' as const,
        source: 'portable_framework_checkpoint_at_or_after_standard_built',
        requested: options.includeFullIntent,
        completed_standard_stages: 'skip',
        rebuild_performed: false,
        modifies_standard_or_latest: false,
      },
    ],
    exact_operation_set: stableOperations,
    authority_boundary: {
      projection_can_create_state: false,
      projection_can_authorize_mutation: false,
      projection_can_dispatch: false,
      projection_can_publish: false,
      projection_can_claim_release_ready: false,
    },
  };
}

try {
  process.stdout.write(`${JSON.stringify(buildProjection(parseArgs(process.argv.slice(2))), null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
