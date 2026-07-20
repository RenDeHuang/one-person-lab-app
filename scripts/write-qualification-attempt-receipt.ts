#!/usr/bin/env node

import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  buildQualificationAttemptReceipt,
  writeQualificationAttemptReceiptAtomic,
} from './qualification-attempt-receipt.ts';

const { values } = parseArgs({
  options: {
    output: { type: 'string' }, status: { type: 'string', default: 'incomplete' },
    'failure-taxonomy': { type: 'string', default: 'unknown' },
    'stable-session-id': { type: 'string', default: '' }, 'release-cohort-ref': { type: 'string', default: '' },
    'artifact-kind': { type: 'string', default: '' }, 'package-profile': { type: 'string', default: '' },
    'qualification-run-id': { type: 'string', default: '' }, 'qualification-run-attempt': { type: 'string', default: '' },
    'source-artifact-run-id': { type: 'string', default: '' }, 'source-artifact-name': { type: 'string', default: '' },
    manifest: { type: 'string', default: '' }, 'strict-receipt': { type: 'string', default: '' },
    'smoke-summary': { type: 'string', default: '' }, 'critical-diagnostics': { type: 'string', default: '' },
    'scope-proof-base64': { type: 'string', default: '' },
    outcome: { type: 'string', multiple: true, default: [] }, error: { type: 'string', multiple: true, default: [] },
  },
  strict: true,
});
if (!values.output) throw new Error('Missing --output');
const outcomes: Record<string, string> = {};
for (const entry of values.outcome ?? []) {
  const separator = entry.indexOf('=');
  if (separator <= 0) continue;
  outcomes[entry.slice(0, separator)] = entry.slice(separator + 1);
}
const receipt = buildQualificationAttemptReceipt({
  status: values.status,
  failureTaxonomy: values['failure-taxonomy'],
  stableSessionId: values['stable-session-id'], releaseCohortRef: values['release-cohort-ref'],
  artifactKind: values['artifact-kind'], packageProfile: values['package-profile'],
  qualificationRunId: values['qualification-run-id'], qualificationRunAttempt: values['qualification-run-attempt'],
  sourceArtifactRunId: values['source-artifact-run-id'], sourceArtifactName: values['source-artifact-name'],
  manifestPath: values.manifest, strictQualificationReceiptPath: values['strict-receipt'],
  smokeSummaryPath: values['smoke-summary'], criticalDiagnosticsPath: values['critical-diagnostics'],
  scopeProofBase64: values['scope-proof-base64'],
  outcomes, errors: values.error,
});
writeQualificationAttemptReceiptAtomic(path.resolve(values.output), receipt);
process.stdout.write(`${JSON.stringify({ status: 'written', output: path.resolve(values.output), receipt_status: receipt.status })}\n`);
