#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildReleaseNotesDocument } from './release-notes.ts';
import { resolveActiveShellPaths } from './app-shell-adapter.ts';

type Channel = 'stable' | 'nightly';

function parseArgs(argv: string[]) {
  const parsed: {
    version: string;
    channel: Channel;
    releaseRepo: string;
    shellRoot: string;
    includeFullPackage: boolean;
    fullPackageManifestPath: string;
    output: string;
    previousTag: string;
    currentTag: string;
    previousAppRef: string;
    currentAppRef: string;
    previousShellRef: string;
    currentShellRef: string;
  } = {
    version: '',
    channel: 'stable',
    releaseRepo: process.env.OPL_RELEASE_REPO || 'gaofeng21cn/one-person-lab-app',
    shellRoot: process.env.OPL_APP_SHELL_ROOT || process.env.OPL_AION_SHELL_ROOT || resolveActiveShellPaths().shellRoot,
    includeFullPackage: false,
    fullPackageManifestPath: '',
    output: '',
    previousTag: '',
    currentTag: '',
    previousAppRef: '',
    currentAppRef: '',
    previousShellRef: '',
    currentShellRef: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--include-full-package') {
      parsed.includeFullPackage = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    if (token === '--version') {
      parsed.version = value;
    } else if (token === '--channel') {
      if (value !== 'stable' && value !== 'nightly') {
        throw new Error(`Unsupported release note channel: ${value}`);
      }
      parsed.channel = value;
    } else if (token === '--repo') {
      parsed.releaseRepo = value;
    } else if (token === '--shell-root') {
      parsed.shellRoot = path.resolve(value);
    } else if (token === '--full-package-manifest') {
      parsed.fullPackageManifestPath = path.resolve(value);
      parsed.includeFullPackage = true;
    } else if (token === '--output') {
      parsed.output = path.resolve(value);
    } else if (token === '--previous-tag') {
      parsed.previousTag = value;
    } else if (token === '--current-tag') {
      parsed.currentTag = value;
    } else if (token === '--previous-app-ref') {
      parsed.previousAppRef = value;
    } else if (token === '--current-app-ref') {
      parsed.currentAppRef = value;
    } else if (token === '--previous-shell-ref') {
      parsed.previousShellRef = value;
    } else if (token === '--current-shell-ref') {
      parsed.currentShellRef = value;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
    index += 1;
  }

  if (!parsed.version) {
    throw new Error('Missing required --version.');
  }

  return parsed;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const fullPackageManifest = options.fullPackageManifestPath
    ? JSON.parse(fs.readFileSync(options.fullPackageManifestPath, 'utf8'))
    : null;
  const notes = buildReleaseNotesDocument({
    version: options.version,
    channel: options.channel,
    releaseRepo: options.releaseRepo,
    shellRoot: options.shellRoot,
    includeFullPackage: options.includeFullPackage,
    fullPackageManifest,
    previousTag: options.previousTag,
    currentTag: options.currentTag,
    previousAppRef: options.previousAppRef,
    currentAppRef: options.currentAppRef,
    previousShellRef: options.previousShellRef,
    currentShellRef: options.currentShellRef,
  });
  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, notes);
  } else {
    process.stdout.write(notes);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
