#!/usr/bin/env node

import fs from 'node:fs';
import { parseArgs } from 'node:util';
import type { BuildArtifactCohortV2 } from './build-artifact-cohort.ts';
import { buildArtifactQualificationReceipt } from './artifact-qualification-receipt.ts';
import type { QualificationHarnessScopeProof } from './qualification-harness-scope.ts';

const { values } = parseArgs({
  options: {
    manifest: { type: 'string' }, output: { type: 'string' }, result: { type: 'string' },
    'package-profile': { type: 'string' }, 'qualification-run-id': { type: 'string' },
    'source-artifact-run-id': { type: 'string' }, 'source-artifact-name': { type: 'string' },
    'evidence-ref': { type: 'string' }, 'smoke-summary': { type: 'string', default: '' },
    'verification-app-sha': { type: 'string', default: '' },
    'verification-shell-sha': { type: 'string', default: '' },
    'verification-smoke-harness': { type: 'string', default: '' },
    'verification-scope-proof-base64': { type: 'string', default: '' },
  },
  strict: true,
});
for (const key of ['manifest', 'output', 'result', 'package-profile', 'qualification-run-id', 'source-artifact-run-id', 'source-artifact-name', 'evidence-ref'] as const) {
  if (!values[key]) throw new Error(`Missing --${key}`);
}
if (values.result !== 'passed' && values.result !== 'failed') throw new Error('--result must be passed or failed');
if (!['standard', 'full', 'homebrew-standard', 'homebrew-full'].includes(values['package-profile']!)) throw new Error('--package-profile is invalid');
const verificationHarnessValues = [
  values['verification-app-sha'],
  values['verification-shell-sha'],
  values['verification-smoke-harness'],
  values['verification-scope-proof-base64'],
].filter(Boolean);
if (verificationHarnessValues.length !== 0 && verificationHarnessValues.length !== 4) {
  throw new Error('Pass all verification harness fields together.');
}
let verificationScopeProof: QualificationHarnessScopeProof | undefined;
if (values['verification-scope-proof-base64']) {
  try {
    verificationScopeProof = JSON.parse(
      Buffer.from(values['verification-scope-proof-base64'], 'base64').toString('utf8'),
    ) as QualificationHarnessScopeProof;
  } catch (error) {
    throw new Error(`--verification-scope-proof-base64 must encode valid JSON: ${String(error)}`);
  }
}
const manifest = JSON.parse(fs.readFileSync(values.manifest!, 'utf8')) as BuildArtifactCohortV2;
const receipt = buildArtifactQualificationReceipt({
  manifest, manifestPath: values.manifest!, result: values.result,
  packageProfile: values['package-profile'] as 'standard' | 'full' | 'homebrew-standard' | 'homebrew-full',
  qualificationRunId: values['qualification-run-id']!, sourceArtifactRunId: values['source-artifact-run-id']!,
  sourceArtifactName: values['source-artifact-name']!, evidenceRef: values['evidence-ref']!,
  smokeSummaryPath: values['smoke-summary'] || undefined,
  verificationHarness:
    values['verification-app-sha'] && values['verification-shell-sha'] && values['verification-smoke-harness'] && verificationScopeProof
      ? {
          appSha: values['verification-app-sha'],
          shellSha: values['verification-shell-sha'],
          smokeHarnessPath: values['verification-smoke-harness'],
          scopeProof: verificationScopeProof,
        }
      : undefined,
});
fs.writeFileSync(values.output!, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ status: 'written', output: values.output })}\n`);
