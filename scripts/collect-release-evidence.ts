#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const commandMaxBuffer = 128 * 1024 * 1024;

type Options = {
  bundleDir: string;
  actionId: string;
  executeAction: boolean;
  overwrite: boolean;
  oplBin: string;
};

type CollectedArtifactId =
  | 'app_state_summary'
  | 'app_state_full'
  | 'drilldown_full'
  | 'action_dry_run_result'
  | 'action_execute_result';

type ManifestArtifact = {
  id: string;
  status: string;
};

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    bundleDir: process.env.OPL_RELEASE_EVIDENCE_BUNDLE_DIR || '',
    actionId: process.env.OPL_RELEASE_EVIDENCE_ACTION_ID || '',
    executeAction: false,
    overwrite: false,
    oplBin: process.env.OPL_BIN || 'opl',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--execute-action') {
      parsed.executeAction = true;
      continue;
    }
    if (token === '--overwrite') {
      parsed.overwrite = true;
      continue;
    }
    const value = argv[index + 1];
    if (token === '--bundle-dir') {
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --bundle-dir');
      }
      parsed.bundleDir = value;
      index += 1;
      continue;
    }
    if (token === '--action-id') {
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --action-id');
      }
      parsed.actionId = value;
      index += 1;
      continue;
    }
    if (token === '--opl-bin') {
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --opl-bin');
      }
      parsed.oplBin = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!parsed.bundleDir.trim()) {
    throw new Error('Pass --bundle-dir <release-evidence-dir> or set OPL_RELEASE_EVIDENCE_BUNDLE_DIR.');
  }
  if (!parsed.actionId.trim()) {
    throw new Error('Pass --action-id <opl-runtime-safe-action-id> or set OPL_RELEASE_EVIDENCE_ACTION_ID.');
  }

  return {
    ...parsed,
    bundleDir: path.resolve(parsed.bundleDir),
  };
}

function resolveBundlePath(bundleDir: string, artifactPath: string): string {
  const resolved = path.resolve(bundleDir, artifactPath);
  const relative = path.relative(bundleDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Evidence artifact path escapes bundle root: ${artifactPath}`);
  }
  return resolved;
}

function writeJsonArtifact(bundleDir: string, artifactPath: string, payload: unknown): void {
  const resolved = resolveBundlePath(bundleDir, artifactPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function runJsonCommand(options: Options, args: string[]): unknown {
  const result = spawnSync(options.oplBin, args, {
    cwd: appRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: commandMaxBuffer,
  });
  if (result.error) {
    throw new Error(`OPL command failed to launch or buffer output: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error([
      `OPL command failed: ${options.oplBin} ${args.join(' ')}`,
      result.stderr.trim(),
      result.stdout.trim(),
    ].filter(Boolean).join('\n'));
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`OPL command returned invalid JSON: ${options.oplBin} ${args.join(' ')}\n${message}`);
  }
}

function runNodeScript(args: string[]): unknown {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error([
      `Node script failed: ${args.join(' ')}`,
      result.stderr.trim(),
      result.stdout.trim(),
    ].filter(Boolean).join('\n'));
  }
  return JSON.parse(result.stdout);
}

function collectRuntimeEvidence(options: Options): CollectedArtifactId[] {
  const collected: CollectedArtifactId[] = [];
  writeJsonArtifact(
    options.bundleDir,
    'app-state-summary.json',
    runJsonCommand(options, ['app', 'state', '--profile', 'fast', '--json']),
  );
  collected.push('app_state_summary');

  writeJsonArtifact(
    options.bundleDir,
    'app-state-full.json',
    runJsonCommand(options, ['app', 'state', '--profile', 'full', '--json']),
  );
  collected.push('app_state_full');

  writeJsonArtifact(
    options.bundleDir,
    'drilldown-full.json',
    runJsonCommand(options, ['runtime', 'app-operator-drilldown', '--detail', 'full', '--json']),
  );
  collected.push('drilldown_full');

  writeJsonArtifact(
    options.bundleDir,
    'action-dry-run-result.json',
    runJsonCommand(options, ['app', 'action', 'execute', '--action', options.actionId, '--dry-run', '--json']),
  );
  collected.push('action_dry_run_result');

  if (options.executeAction) {
    writeJsonArtifact(
      options.bundleDir,
      'action-execute-result.json',
      runJsonCommand(options, ['app', 'action', 'execute', '--action', options.actionId, '--json']),
    );
    collected.push('action_execute_result');
  }

  return collected;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (fs.existsSync(options.bundleDir) && !options.overwrite) {
    throw new Error(`Bundle directory already exists: ${options.bundleDir}. Pass --overwrite to refresh it.`);
  }
  fs.mkdirSync(options.bundleDir, { recursive: true });

  const collectedArtifacts = collectRuntimeEvidence(options);
  const manifest = runNodeScript([
    'scripts/write-release-evidence-manifest.ts',
    '--bundle-dir',
    options.bundleDir,
    '--overwrite',
  ]) as {
    status: string;
    packaged_app_evidence: boolean;
  };
  const manifestJson = JSON.parse(
    fs.readFileSync(resolveBundlePath(options.bundleDir, 'evidence-manifest.json'), 'utf8'),
  ) as {
    artifacts: ManifestArtifact[];
  };
  const missingArtifacts = manifestJson.artifacts
    .filter((artifact) => artifact.status === 'missing')
    .map((artifact) => artifact.id);

  console.log(JSON.stringify({
    status: manifest.status,
    bundle_dir: options.bundleDir,
    manifest_path: 'evidence-manifest.json',
    packaged_app_evidence: manifest.packaged_app_evidence,
    refs_only: true,
    action_id: options.actionId,
    action_execute_collected: options.executeAction,
    collected_artifacts: collectedArtifacts,
    missing_artifact_count: missingArtifacts.length,
    missing_artifacts: missingArtifacts,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
