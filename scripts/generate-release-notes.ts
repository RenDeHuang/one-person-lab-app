#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildReleaseNotesDocument, buildReleaseNotesEvidence } from './release-notes.ts';
import { buildAiReleaseNotesDocument } from './release-notes-ai-writer.ts';
import { resolveActiveShellPaths } from './app-shell-adapter.ts';

type Channel = 'stable' | 'nightly';

function parseArgs(argv: string[]) {
  const parsed: {
    version: string;
    channel: Channel;
    releaseRepo: string;
    shellRoot: string;
    includeFullPackage: boolean;
    ai: boolean;
    fullPackageManifestPath: string;
    previousFullPackageManifestPath: string;
    output: string;
    previousTag: string;
    currentTag: string;
    previousAppRef: string;
    currentAppRef: string;
    previousShellRef: string;
    currentShellRef: string;
    evidenceOutput: string;
  } = {
    version: '',
    channel: 'stable',
    releaseRepo: process.env.OPL_RELEASE_REPO || 'gaofeng21cn/one-person-lab-app',
    shellRoot: process.env.OPL_APP_SHELL_ROOT || process.env.OPL_AION_SHELL_ROOT || resolveActiveShellPaths().shellRoot,
    includeFullPackage: false,
    ai: false,
    fullPackageManifestPath: '',
    previousFullPackageManifestPath: '',
    output: '',
    previousTag: '',
    currentTag: '',
    previousAppRef: '',
    currentAppRef: '',
    previousShellRef: '',
    currentShellRef: '',
    evidenceOutput: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--include-full-package') {
      parsed.includeFullPackage = true;
      continue;
    }
    if (token === '--ai') {
      parsed.ai = true;
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
    } else if (token === '--previous-full-package-manifest') {
      parsed.previousFullPackageManifestPath = path.resolve(value);
    } else if (token === '--output') {
      parsed.output = path.resolve(value);
    } else if (token === '--evidence-output') {
      parsed.evidenceOutput = path.resolve(value);
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
  const previousFullPackageManifest = options.previousFullPackageManifestPath
    ? JSON.parse(fs.readFileSync(options.previousFullPackageManifestPath, 'utf8'))
    : null;
  const releaseNoteOptions = {
    version: options.version,
    channel: options.channel,
    releaseRepo: options.releaseRepo,
    shellRoot: options.shellRoot,
    includeFullPackage: options.includeFullPackage,
    fullPackageManifest,
    previousFullPackageManifest,
    previousTag: options.previousTag,
    currentTag: options.currentTag,
    previousAppRef: options.previousAppRef,
    currentAppRef: options.currentAppRef,
    previousShellRef: options.previousShellRef,
    currentShellRef: options.currentShellRef,
  };
  const evidence = buildReleaseNotesEvidence(releaseNoteOptions);
  if (options.evidenceOutput) {
    fs.mkdirSync(path.dirname(options.evidenceOutput), { recursive: true });
    fs.writeFileSync(options.evidenceOutput, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  const notes = options.ai
    ? buildAiReleaseNotesDocument(evidence)
    : buildReleaseNotesDocument(releaseNoteOptions);
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
