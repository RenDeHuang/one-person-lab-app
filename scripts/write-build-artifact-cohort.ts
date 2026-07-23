#!/usr/bin/env node

import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { buildArtifactCohortV2 } from './build-artifact-cohort.ts';

const { values } = parseArgs({
  options: {
    output: { type: 'string' }, artifact: { type: 'string' }, 'artifact-name': { type: 'string' },
    'packaged-tree': { type: 'string' }, 'app-profile': { type: 'string' }, 'gui-contract': { type: 'string' },
    'smoke-harness': { type: 'string' }, 'app-sha': { type: 'string' }, 'shell-sha': { type: 'string' },
    'compiled-expectations': { type: 'string' },
    'qualification-input-manifest': { type: 'string' },
    'full-input-manifest': { type: 'string', default: '' },
    'full-package-manifest': { type: 'string', default: '' },
    'full-toolchain-observation-receipt': { type: 'string', default: '' },
    'framework-sha': { type: 'string', default: '' }, version: { type: 'string' }, kind: { type: 'string' },
    'actions-run-id': { type: 'string' }, 'actions-run-attempt': { type: 'string', default: '1' },
    'actions-artifact-name': { type: 'string' },
    'stable-session-id': { type: 'string', default: '' }, 'release-cohort-ref': { type: 'string', default: '' },
  },
  strict: true,
});

for (const key of ['output', 'artifact', 'artifact-name', 'packaged-tree', 'app-profile', 'gui-contract', 'smoke-harness', 'compiled-expectations', 'qualification-input-manifest', 'app-sha', 'shell-sha', 'version', 'kind', 'actions-run-id', 'actions-artifact-name'] as const) {
  if (!values[key]) throw new Error(`Missing --${key}`);
}
if (values.kind !== 'standard' && values.kind !== 'full') throw new Error('--kind must be standard or full');

const manifest = buildArtifactCohortV2({
  appSha: values['app-sha']!, shellSha: values['shell-sha']!, frameworkSha: values['framework-sha'],
  version: values.version!, kind: values.kind, artifactPath: values.artifact!, artifactName: values['artifact-name']!,
  packagedTreePath: values['packaged-tree']!, appProductProfilePath: values['app-profile']!,
  guiProductContractPath: values['gui-contract']!, smokeHarnessPath: values['smoke-harness']!,
  compiledExpectationsPath: values['compiled-expectations']!,
  qualificationInputManifestPath: values['qualification-input-manifest']!,
  fullInputManifestPath: values['full-input-manifest'] || undefined,
  fullPackageManifestPath: values['full-package-manifest'] || undefined,
  fullToolchainObservationReceiptPath: values['full-toolchain-observation-receipt'] || undefined,
  actionsRunId: values['actions-run-id']!, actionsRunAttempt: values['actions-run-attempt']!,
  actionsArtifactName: values['actions-artifact-name']!,
  stableSessionId: values['stable-session-id'], releaseCohortRef: values['release-cohort-ref'],
});
fs.writeFileSync(values.output!, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ status: 'written', output: values.output, manifest })}\n`);
