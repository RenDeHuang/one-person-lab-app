#!/usr/bin/env node

import fs from 'node:fs';
import { parseArgs } from 'node:util';
import type { BuildArtifactCohortV2 } from './build-artifact-cohort.ts';
import { buildArtifactQualificationReceipt } from './artifact-qualification-receipt.ts';

const { values } = parseArgs({
  options: {
    manifest: { type: 'string' }, output: { type: 'string' }, result: { type: 'string' },
    'package-profile': { type: 'string' }, 'qualification-run-id': { type: 'string' },
    'source-artifact-run-id': { type: 'string' }, 'source-artifact-name': { type: 'string' },
    'evidence-ref': { type: 'string' }, 'smoke-summary': { type: 'string', default: '' },
  },
  strict: true,
});
for (const key of ['manifest', 'output', 'result', 'package-profile', 'qualification-run-id', 'source-artifact-run-id', 'source-artifact-name', 'evidence-ref'] as const) {
  if (!values[key]) throw new Error(`Missing --${key}`);
}
if (values.result !== 'passed' && values.result !== 'failed') throw new Error('--result must be passed or failed');
if (!['standard', 'full', 'homebrew-standard', 'homebrew-full'].includes(values['package-profile']!)) throw new Error('--package-profile is invalid');
const manifest = JSON.parse(fs.readFileSync(values.manifest!, 'utf8')) as BuildArtifactCohortV2;
const receipt = buildArtifactQualificationReceipt({
  manifest, manifestPath: values.manifest!, result: values.result,
  packageProfile: values['package-profile'] as 'standard' | 'full' | 'homebrew-standard' | 'homebrew-full',
  qualificationRunId: values['qualification-run-id']!, sourceArtifactRunId: values['source-artifact-run-id']!,
  sourceArtifactName: values['source-artifact-name']!, evidenceRef: values['evidence-ref']!,
  smokeSummaryPath: values['smoke-summary'] || undefined,
});
fs.writeFileSync(values.output!, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ status: 'written', output: values.output })}\n`);
