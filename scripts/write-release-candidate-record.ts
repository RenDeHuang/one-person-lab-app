#!/usr/bin/env node

const frameworkHandoff = {
  state_authority: 'framework_opl_release_portable_checkpoint_and_receipt',
  checkpoint_schema_ref: 'opl_release_bundle_checkpoint.v1',
  receipt_schema_refs: [
    'opl_release_bundle_executor_receipt.v1',
    'opl_release_bundle_operation_receipt.v1',
    'opl_release_bundle_qualification_receipt.v1',
  ],
  status_command: 'opl release status --bundle <sha256:digest> --store <directory>',
  required_handoff: ['portable_framework_checkpoint', 'original_framework_receipts'],
  inspect_only: true,
  mutation_authorized: false,
} as const;

function retiredWriterResult() {
  return {
    schema: 'opl_app_release_candidate_record_writer_retired.v1',
    status: 'retired_fail_closed',
    lifecycle: 'historical_read_only',
    candidate_record_generated: false,
    authoritative_for_new_release: false,
    mutation_authorized: false,
    replacement_authority: frameworkHandoff.state_authority,
    next_action: 'inspect_framework_checkpoint_and_receipts',
    framework_handoff: frameworkHandoff,
    reason: 'App candidate records are historical evidence only and cannot authorize or describe a new release mutation.',
  };
}

function usage() {
  process.stdout.write(`Usage:
  node --experimental-strip-types scripts/write-release-candidate-record.ts

This retired writer never creates a candidate record. Inspect the Framework portable checkpoint and original receipts with opl release status.
`);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
} else {
  process.stdout.write(`${JSON.stringify(retiredWriterResult(), null, 2)}\n`);
  process.exitCode = 2;
}
