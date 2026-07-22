#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs as parseNodeArgs } from 'node:util';
import { buildReleaseNotesDocument, buildReleaseNotesEvidence } from './release-notes.ts';
import { resolveActiveShellPaths } from './app-shell-adapter.ts';

type Channel = 'stable' | 'nightly';

type ReleaseNotesCliOptions = {
  version: string;
  channel: Channel;
  releaseRepo: string;
  shellRoot: string;
  includeFullPackage: boolean;
  fullPackageManifestPath: string;
  fullPayloadAuthorityPath: string;
  previousFullPackageManifestPath: string;
  output: string;
  previousTag: string;
  currentTag: string;
  previousAppRef: string;
  currentAppRef: string;
  previousShellRef: string;
  currentShellRef: string;
  evidenceOutput: string;
};

function defaultOptions(): ReleaseNotesCliOptions {
  return {
    version: '',
    channel: 'stable',
    releaseRepo: process.env.OPL_RELEASE_REPO || 'gaofeng21cn/one-person-lab-app',
    shellRoot: process.env.OPL_APP_SHELL_ROOT || process.env.OPL_AION_SHELL_ROOT || resolveActiveShellPaths().shellRoot,
    includeFullPackage: false,
    fullPackageManifestPath: '',
    fullPayloadAuthorityPath: '',
    previousFullPackageManifestPath: '',
    output: '',
    previousTag: '',
    currentTag: '',
    previousAppRef: '',
    currentAppRef: '',
    previousShellRef: '',
    currentShellRef: '',
    evidenceOutput: process.env.OPL_RELEASE_NOTES_EVIDENCE_OUTPUT?.trim() || '',
  };
}

function parseArgs(argv: string[]) {
  const parsed = defaultOptions();
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      version: { type: 'string' },
      channel: { type: 'string' },
      repo: { type: 'string' },
      'shell-root': { type: 'string' },
      'include-full-package': { type: 'boolean' },
      'full-package-manifest': { type: 'string' },
      'full-payload-authority': { type: 'string' },
      'previous-full-package-manifest': { type: 'string' },
      output: { type: 'string' },
      'previous-tag': { type: 'string' },
      'current-tag': { type: 'string' },
      'previous-app-ref': { type: 'string' },
      'current-app-ref': { type: 'string' },
      'previous-shell-ref': { type: 'string' },
      'current-shell-ref': { type: 'string' },
      'evidence-output': { type: 'string' },
    } as const,
    allowPositionals: false,
    strict: true,
  });

  if (values.version) parsed.version = values.version;
  if (values.channel) {
    if (values.channel !== 'stable' && values.channel !== 'nightly') {
      throw new Error(`Unsupported release note channel: ${values.channel}`);
    }
    parsed.channel = values.channel;
  }
  if (values.repo) parsed.releaseRepo = values.repo;
  if (values['shell-root']) parsed.shellRoot = path.resolve(values['shell-root']);
  if (values['include-full-package']) parsed.includeFullPackage = true;
  if (values['full-package-manifest']) {
    parsed.fullPackageManifestPath = path.resolve(values['full-package-manifest']);
    parsed.includeFullPackage = true;
  }
  if (values['full-payload-authority']) {
    if (parsed.fullPackageManifestPath) {
      throw new Error('--full-payload-authority and --full-package-manifest are mutually exclusive.');
    }
    parsed.fullPayloadAuthorityPath = path.resolve(values['full-payload-authority']);
    parsed.fullPackageManifestPath = parsed.fullPayloadAuthorityPath;
    parsed.includeFullPackage = true;
  }
  if (values['previous-full-package-manifest']) parsed.previousFullPackageManifestPath = path.resolve(values['previous-full-package-manifest']);
  if (values.output) parsed.output = path.resolve(values.output);
  if (values['previous-tag']) parsed.previousTag = values['previous-tag'];
  if (values['current-tag']) parsed.currentTag = values['current-tag'];
  if (values['previous-app-ref']) parsed.previousAppRef = values['previous-app-ref'];
  if (values['current-app-ref']) parsed.currentAppRef = values['current-app-ref'];
  if (values['previous-shell-ref']) parsed.previousShellRef = values['previous-shell-ref'];
  if (values['current-shell-ref']) parsed.currentShellRef = values['current-shell-ref'];
  if (values['evidence-output']) parsed.evidenceOutput = path.resolve(values['evidence-output']);

  if (!parsed.version) {
    throw new Error('Missing required --version.');
  }
  if (parsed.includeFullPackage && parsed.evidenceOutput && !parsed.fullPayloadAuthorityPath) {
    throw new Error('Full prepared-notes evidence requires --full-payload-authority.');
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
  const fullPayloadAuthoritySha256 = options.fullPayloadAuthorityPath
    ? `sha256:${crypto.createHash('sha256').update(fs.readFileSync(options.fullPayloadAuthorityPath)).digest('hex')}`
    : undefined;
  const releaseNoteOptions = {
    version: options.version,
    channel: options.channel,
    releaseRepo: options.releaseRepo,
    shellRoot: options.shellRoot,
    includeFullPackage: options.includeFullPackage,
    fullPackageManifest,
    fullPayloadAuthoritySha256,
    previousFullPackageManifest,
    previousTag: options.previousTag,
    currentTag: options.currentTag,
    previousAppRef: options.previousAppRef,
    currentAppRef: options.currentAppRef,
    previousShellRef: options.previousShellRef,
    currentShellRef: options.currentShellRef,
  };
  if (options.evidenceOutput) {
    fs.mkdirSync(path.dirname(options.evidenceOutput), { recursive: true });
    fs.writeFileSync(
      options.evidenceOutput,
      `${JSON.stringify(buildReleaseNotesEvidence(releaseNoteOptions), null, 2)}\n`,
    );
  }
  const notes = buildReleaseNotesDocument(releaseNoteOptions);
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
