#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type ValidationResult = {
  status: 'passed' | 'failed';
  diagnostics_dir: string;
  checked_files: string[];
  missing_files: string[];
  invalid_evidence: string[];
  forbidden_secret_markers: string[];
  secret_scan: {
    status: 'passed' | 'failed';
    forbidden_secret_markers: string[];
  };
  preservation_verdict: string | null;
  compose_volume_mapping: {
    status: 'passed' | 'failed';
    required_mounts: string[];
    missing_mounts: string[];
  };
  preservation_evidence: {
    status: 'passed' | 'failed';
    required_sections: string[];
    missing_sections: string[];
  };
  image_identity: {
    status: 'passed' | 'failed';
    image_id: string | null;
    repo_digests: string[];
    digest: string | null;
    remote_ref: string | null;
    remote_digest: string | null;
    currentness_status: 'not_checked' | 'current' | 'update_available' | 'unknown';
    currentness_evidence_source: string | null;
    currentness_claim: false;
  };
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
  'diagnostics-manifest.json',
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

const REQUIRED_PRESERVATION_SECTIONS = [
  'pre_data_inventory',
  'post_data_inventory',
  'pre_projects_inventory',
  'post_projects_inventory',
];

function extractJsonString(filePath: string, key: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const text = readText(filePath);
  const match = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));
  return match?.[1] ?? null;
}

function extractJsonStringArray(filePath: string, key: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  const text = readText(filePath);
  const match = text.match(new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]).filter(Boolean);
}

function normalizeImageDigest(imageId: string | null, repoDigests: string[]): string | null {
  const repoDigest = repoDigests.find((value) => /@sha256:[a-f0-9]{64}$/i.test(value));
  if (repoDigest) {
    return repoDigest.slice(repoDigest.indexOf('@') + 1);
  }
  return imageId && /^sha256:[a-f0-9]{64}$/i.test(imageId) ? imageId : null;
}

function extractDigestFromText(text: string): string | null {
  const match = text.match(/\bsha256:[a-f0-9]{64}\b/i);
  return match?.[0] ?? null;
}

function readRemoteImageDigest(diagnosticsDir: string): {
  remote_ref: string | null;
  remote_digest: string | null;
  currentness_evidence_source: string | null;
} {
  for (const file of ['remote-image-digest.txt', 'docker-remote-image.txt']) {
    const filePath = path.join(diagnosticsDir, file);
    if (!fs.existsSync(filePath)) continue;
    const text = readText(filePath);
    const keyValues = Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((line) => line.match(/^([^=\s]+)=(.*)$/))
        .filter((match): match is RegExpMatchArray => Boolean(match))
        .map((match) => [match[1], match[2]]),
    );
    return {
      remote_ref: keyValues.remote_ref ?? keyValues.image ?? null,
      remote_digest: keyValues.remote_digest ?? keyValues.digest ?? extractDigestFromText(text),
      currentness_evidence_source: file,
    };
  }
  return {
    remote_ref: null,
    remote_digest: null,
    currentness_evidence_source: null,
  };
}

function compareImageCurrentness(
  localDigest: string | null,
  remoteDigest: string | null,
  currentnessEvidenceSource: string | null,
): 'not_checked' | 'current' | 'update_available' | 'unknown' {
  if (!currentnessEvidenceSource) return 'not_checked';
  if (!localDigest || !remoteDigest) return 'unknown';
  return localDigest.toLowerCase() === remoteDigest.toLowerCase() ? 'current' : 'update_available';
}

function validateComposeVolumeMapping(composeText: string) {
  const missingMounts: string[] = [];
  const requiredMounts = ['host_data_dir -> /data', 'host_projects_dir -> /projects'];
  if (!/AIONUI_DATA_DIR:\s*\/data\b/.test(composeText) || !/-\s*["']?.+:\/data["']?\s*$/m.test(composeText)) {
    missingMounts.push('host_data_dir -> /data');
  }
  if (!/OPL_PROJECTS_DIR:\s*\/projects\b/.test(composeText) || !/-\s*["']?.+:\/projects["']?\s*$/m.test(composeText)) {
    missingMounts.push('host_projects_dir -> /projects');
  }
  return {
    status: missingMounts.length === 0 ? ('passed' as const) : ('failed' as const),
    required_mounts: requiredMounts,
    missing_mounts: missingMounts,
  };
}

function sectionBody(text: string, section: string): string {
  const match = text.match(new RegExp(`\\[${section}\\]\\n([\\s\\S]*?)(?:\\n\\[[^\\]]+\\]|$)`));
  return match?.[1]?.trim() ?? '';
}

function validatePreservationEvidence(text: string) {
  const missingSections = REQUIRED_PRESERVATION_SECTIONS.filter((section) => !text.includes(`[${section}]`));
  for (const section of ['post_data_inventory', 'post_projects_inventory']) {
    const body = sectionBody(text, section);
    if (!/^exists=true$/m.test(body) && !missingSections.includes(`${section}:exists=true`)) {
      missingSections.push(`${section}:exists=true`);
    }
  }
  return {
    status: missingSections.length === 0 ? ('passed' as const) : ('failed' as const),
    required_sections: REQUIRED_PRESERVATION_SECTIONS,
    missing_sections: missingSections,
  };
}

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
  const invalidEvidence: string[] = [];
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
  let preservationEvidence = {
    status: 'failed' as const,
    required_sections: REQUIRED_PRESERVATION_SECTIONS,
    missing_sections: [...REQUIRED_PRESERVATION_SECTIONS],
  };
  const preservationPath = path.join(diagnosticsDir, 'data-preservation.txt');
  if (fs.existsSync(preservationPath)) {
    const preservationText = readText(preservationPath);
    const match = preservationText.match(/^verdict=(.+)$/m);
    preservationVerdict = match?.[1] ?? null;
    if (!preservationVerdict) {
      missingFiles.push('data-preservation.txt:verdict');
    }
    preservationEvidence = validatePreservationEvidence(preservationText);
    invalidEvidence.push(...preservationEvidence.missing_sections.map((entry) => `data-preservation.txt:${entry}`));
  }

  let composeVolumeMapping = {
    status: 'failed' as const,
    required_mounts: ['host_data_dir -> /data', 'host_projects_dir -> /projects'],
    missing_mounts: ['host_data_dir -> /data', 'host_projects_dir -> /projects'],
  };
  const composePath = path.join(diagnosticsDir, 'compose.yaml');
  if (fs.existsSync(composePath)) {
    composeVolumeMapping = validateComposeVolumeMapping(readText(composePath));
    invalidEvidence.push(...composeVolumeMapping.missing_mounts.map((entry) => `compose.yaml:${entry}`));
  }

  const dockerImagePath = path.join(diagnosticsDir, 'docker-image.txt');
  const imageId = extractJsonString(dockerImagePath, 'Id');
  const repoDigests = extractJsonStringArray(dockerImagePath, 'RepoDigests');
  const digest = normalizeImageDigest(imageId, repoDigests);
  const remoteImage = readRemoteImageDigest(diagnosticsDir);
  const imageIdentity = {
    status: digest ? ('passed' as const) : ('failed' as const),
    image_id: imageId,
    repo_digests: repoDigests,
    digest,
    remote_ref: remoteImage.remote_ref,
    remote_digest: remoteImage.remote_digest,
    currentness_status: compareImageCurrentness(digest, remoteImage.remote_digest, remoteImage.currentness_evidence_source),
    currentness_evidence_source: remoteImage.currentness_evidence_source,
    currentness_claim: false as const,
  };
  if (!digest) {
    invalidEvidence.push('docker-image.txt:image_digest');
  }

  return {
    status: missingFiles.length === 0 && invalidEvidence.length === 0 && forbiddenSecretMarkers.length === 0 ? 'passed' : 'failed',
    diagnostics_dir: diagnosticsDir,
    checked_files: checkedFiles,
    missing_files: missingFiles,
    invalid_evidence: invalidEvidence,
    forbidden_secret_markers: forbiddenSecretMarkers,
    secret_scan: {
      status: forbiddenSecretMarkers.length === 0 ? 'passed' : 'failed',
      forbidden_secret_markers: forbiddenSecretMarkers,
    },
    preservation_verdict: preservationVerdict,
    compose_volume_mapping: composeVolumeMapping,
    preservation_evidence: preservationEvidence,
    image_identity: imageIdentity,
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
