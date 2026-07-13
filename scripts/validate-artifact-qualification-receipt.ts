#!/usr/bin/env node

import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { validateArtifactQualificationReceipt, type ArtifactQualificationReceiptV1 } from './artifact-qualification-receipt.ts';

const { values } = parseArgs({
  options: {
    receipt: { type: 'string' }, 'stable-session-id': { type: 'string' }, 'release-cohort-ref': { type: 'string' },
    version: { type: 'string' }, 'package-profile': { type: 'string' }, result: { type: 'string', default: '' },
    'qualification-run-id': { type: 'string', default: '' }, 'source-artifact-run-id': { type: 'string', default: '' },
    'source-artifact-name': { type: 'string', default: '' }, 'artifact-sha256': { type: 'string', default: '' },
    'app-sha': { type: 'string', default: '' }, 'shell-sha': { type: 'string', default: '' }, 'framework-sha': { type: 'string', default: '' },
  },
  strict: true,
});
for (const key of ['receipt', 'stable-session-id', 'release-cohort-ref', 'version', 'package-profile'] as const) {
  if (!values[key]) throw new Error(`Missing --${key}`);
}
const receipt = JSON.parse(fs.readFileSync(values.receipt!, 'utf8')) as ArtifactQualificationReceiptV1;
const errors = validateArtifactQualificationReceipt(receipt, {
  stableSessionId: values['stable-session-id']!, releaseCohortRef: values['release-cohort-ref']!, version: values.version!,
  packageProfile: values['package-profile'] as ArtifactQualificationReceiptV1['package_profile'],
  result: (values.result || undefined) as 'passed' | 'failed' | undefined,
  qualificationRunId: values['qualification-run-id'] || undefined, sourceArtifactRunId: values['source-artifact-run-id'] || undefined,
  sourceArtifactName: values['source-artifact-name'] || undefined, artifactSha256: values['artifact-sha256'] || undefined,
  appSha: values['app-sha'] || undefined, shellSha: values['shell-sha'] || undefined, frameworkSha: values['framework-sha'] || undefined,
});
if (errors.length > 0) throw new Error(`Artifact qualification receipt invalid: ${errors.join('; ')}`);
process.stdout.write(`${JSON.stringify({ status: 'verified', receipt: values.receipt })}\n`);
