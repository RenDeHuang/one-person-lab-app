#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { resolveNightlyReleaseVersion } from './release-version.ts';

function main(): void {
  const { values } = parseArgs({
    options: {
      'base-version': { type: 'string' },
      'existing-ref-file': { type: 'string' },
      json: { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  const baseVersion = values['base-version']?.trim() ?? '';
  const existingRefFile = values['existing-ref-file']?.trim() ?? '';
  if (!baseVersion) throw new Error('Pass --base-version <YY.M.D-nightly>.');
  if (!existingRefFile) throw new Error('Pass --existing-ref-file <path>.');

  const existingRefs = fs.readFileSync(path.resolve(existingRefFile), 'utf8').split(/\r?\n/);
  const resolution = resolveNightlyReleaseVersion(baseVersion, existingRefs);
  if (values.json) {
    process.stdout.write(`${JSON.stringify({
      base_version: resolution.baseVersion,
      version: resolution.version,
      tag: `v${resolution.version}`,
      rebuild_revision: resolution.rebuildRevision,
      observed_same_day_versions: resolution.observedSameDayVersions,
    })}\n`);
    return;
  }
  process.stdout.write(`${resolution.version}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
