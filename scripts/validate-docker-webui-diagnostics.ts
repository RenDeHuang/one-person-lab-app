#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type ValidationResult = {
  status: 'passed' | 'failed';
  diagnostics_dir: string;
  checked_files: string[];
  missing_files: string[];
  forbidden_secret_markers: string[];
  preservation_verdict: string | null;
};

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/g,
  /OPENAI_API_KEY\s*[:=]\s*[^ \n\r]+/gi,
  /ANTHROPIC_API_KEY\s*[:=]\s*[^ \n\r]+/gi,
  /GFLABTOKEN\s*[:=]\s*[^ \n\r]+/gi,
  /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi,
];

const REQUIRED_FILES = [
  'metadata.txt',
  'compose.yaml',
  'docker-version.txt',
  'docker-compose-version.txt',
  'docker-compose-ps.txt',
  'docker-compose-logs.txt',
  'docker-image.txt',
  'http-probe.txt',
  'directories.txt',
  'data-preservation.txt',
];

function parseArgs(argv: string[]) {
  const options = {
    diagnosticsDir: '',
    output: '',
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--diagnostics-dir') {
      options.diagnosticsDir = argv[++index] ?? '';
    } else if (arg.startsWith('--diagnostics-dir=')) {
      options.diagnosticsDir = arg.slice('--diagnostics-dir='.length);
    } else if (arg === '--output') {
      options.output = argv[++index] ?? '';
    } else if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!options.diagnosticsDir) {
    throw new Error('Missing --diagnostics-dir');
  }
  return options;
}

function printUsage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/validate-docker-webui-diagnostics.ts --diagnostics-dir <path> [--output <json>] [--json]

Validates a Docker/WebUI installer diagnostic directory without treating it as release-ready evidence.`);
}

function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

export function validateDockerWebuiDiagnostics(diagnosticsDir: string): ValidationResult {
  const checkedFiles: string[] = [];
  const missingFiles: string[] = [];
  const forbiddenSecretMarkers: string[] = [];

  for (const file of REQUIRED_FILES) {
    const fullPath = path.join(diagnosticsDir, file);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(file);
      continue;
    }
    checkedFiles.push(file);
    const text = readText(fullPath);
    for (const pattern of SECRET_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        forbiddenSecretMarkers.push(...matches.map((match) => `${file}:${match.slice(0, 48)}`));
      }
    }
  }

  let preservationVerdict: string | null = null;
  const preservationPath = path.join(diagnosticsDir, 'data-preservation.txt');
  if (fs.existsSync(preservationPath)) {
    const match = readText(preservationPath).match(/^verdict=(.+)$/m);
    preservationVerdict = match?.[1] ?? null;
    if (!preservationVerdict) {
      missingFiles.push('data-preservation.txt:verdict');
    }
  }

  return {
    status: missingFiles.length === 0 && forbiddenSecretMarkers.length === 0 ? 'passed' : 'failed',
    diagnostics_dir: diagnosticsDir,
    checked_files: checkedFiles,
    missing_files: missingFiles,
    forbidden_secret_markers: forbiddenSecretMarkers,
    preservation_verdict: preservationVerdict,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = validateDockerWebuiDiagnostics(path.resolve(options.diagnosticsDir));
  const payload = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output) {
    fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
    fs.writeFileSync(options.output, payload);
  }
  if (options.json || !options.output) {
    process.stdout.write(payload);
  }
  if (result.status !== 'passed') {
    process.exitCode = 1;
  }
}
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
