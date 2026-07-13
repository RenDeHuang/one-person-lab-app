#!/usr/bin/env node

import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { validateArtifactCohortV2, type BuildArtifactCohortV2 } from './build-artifact-cohort.ts';

const { values } = parseArgs({
  options: {
    manifest: { type: 'string' }, artifact: { type: 'string' }, 'app-sha': { type: 'string' },
    'shell-sha': { type: 'string' }, 'framework-sha': { type: 'string', default: '' },
    version: { type: 'string', default: '' }, 'actions-run-id': { type: 'string', default: '' },
    'stable-session-id': { type: 'string', default: '' }, 'release-cohort-ref': { type: 'string', default: '' },
  },
  strict: true,
});
if (!values.manifest || !values['app-sha'] || !values['shell-sha']) {
  throw new Error('Usage: validate-build-artifact-cohort.ts --manifest <path> --app-sha <sha> --shell-sha <sha> [--artifact <dmg>] [--framework-sha <sha>] [--version <version>] [--actions-run-id <id>]');
}

const manifest = JSON.parse(fs.readFileSync(values.manifest, 'utf8')) as BuildArtifactCohortV2;
const errors = validateArtifactCohortV2(manifest, {
  appSha: values['app-sha'], shellSha: values['shell-sha'], frameworkSha: values['framework-sha'] || undefined,
  version: values.version || undefined, artifactPath: values.artifact || undefined,
  actionsRunId: values['actions-run-id'] || undefined,
  stableSessionId: values['stable-session-id'] || undefined,
  releaseCohortRef: values['release-cohort-ref'] || undefined,
});
if (errors.length > 0) throw new Error(`Build artifact cohort mismatch; refusing cross-cohort VM smoke: ${errors.join('; ')}`);
process.stdout.write(`${JSON.stringify({ status: 'passed', manifest })}\n`);
