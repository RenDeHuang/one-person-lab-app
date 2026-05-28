#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type GateStatus = 'passed' | 'failed' | 'skipped';

type GateSummary = {
  status: GateStatus;
  required: boolean;
  artifact_name?: string;
  artifact_path?: string;
  reason?: string;
  fields?: Record<string, unknown>;
};

type Options = {
  version: string;
  releaseMode: string;
  includeFullPackage: boolean;
  runVmSmoke: boolean;
  artifactsDir: string;
  output: string;
  markdown: string;
};

function parseBoolean(value: string | undefined, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    version: process.env.OPL_RELEASE_VERSION || '',
    releaseMode: process.env.OPL_RELEASE_MODE || '',
    includeFullPackage: parseBoolean(process.env.OPL_INCLUDE_FULL_PACKAGE),
    runVmSmoke: parseBoolean(process.env.OPL_RUN_VM_SMOKE),
    artifactsDir: process.env.OPL_RELEASE_READINESS_ARTIFACTS_DIR || '',
    output: process.env.OPL_RELEASE_READINESS_OUTPUT || '',
    markdown: process.env.OPL_RELEASE_READINESS_MARKDOWN || '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--include-full-package' || token === '--run-vm-smoke') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
      if (token === '--include-full-package') parsed.includeFullPackage = parseBoolean(value);
      else parsed.runVmSmoke = parseBoolean(value);
      index += 1;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    if (token === '--version') parsed.version = value;
    else if (token === '--release-mode') parsed.releaseMode = value;
    else if (token === '--artifacts-dir') parsed.artifactsDir = value;
    else if (token === '--output') parsed.output = value;
    else if (token === '--markdown') parsed.markdown = value;
    else throw new Error(`Unknown argument: ${token}`);
    index += 1;
  }

  if (!parsed.version.trim()) throw new Error('Pass --version <version> or set OPL_RELEASE_VERSION.');
  if (!parsed.releaseMode.trim()) throw new Error('Pass --release-mode <mode> or set OPL_RELEASE_MODE.');
  if (!parsed.artifactsDir.trim()) throw new Error('Pass --artifacts-dir <dir> or set OPL_RELEASE_READINESS_ARTIFACTS_DIR.');
  return {
    ...parsed,
    artifactsDir: path.resolve(parsed.artifactsDir),
    output: parsed.output ? path.resolve(parsed.output) : path.resolve(appRoot, 'release-readiness-summary.json'),
    markdown: parsed.markdown ? path.resolve(parsed.markdown) : '',
  };
}

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findFile(root: string, name: string) {
  if (!fs.existsSync(root)) return null;
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(entryPath);
      else if (entry.isFile() && entry.name === name) return entryPath;
    }
  }
  return null;
}

function artifactDir(options: Options, artifactName: string) {
  return path.join(options.artifactsDir, artifactName);
}

function missingGate(required: boolean, artifactName: string, reason: string): GateSummary {
  return {
    status: required ? 'failed' : 'skipped',
    required,
    artifact_name: artifactName,
    reason,
  };
}

function jsonGate(options: Options, gate: {
  required: boolean;
  artifactName: string;
  fileName: string;
  validate: (payload: Record<string, unknown>) => { fields?: Record<string, unknown>; reason?: string };
}): GateSummary {
  const root = artifactDir(options, gate.artifactName);
  const filePath = findFile(root, gate.fileName);
  if (!filePath) {
    return missingGate(gate.required, gate.artifactName, `Missing ${gate.fileName} in ${gate.artifactName}.`);
  }
  try {
    const payload = readJson(filePath);
    const record = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    const result = gate.validate(record);
    if (result.reason) {
      return {
        status: gate.required ? 'failed' : 'skipped',
        required: gate.required,
        artifact_name: gate.artifactName,
        artifact_path: path.relative(options.artifactsDir, filePath),
        reason: result.reason,
        fields: result.fields,
      };
    }
    return {
      status: 'passed',
      required: gate.required,
      artifact_name: gate.artifactName,
      artifact_path: path.relative(options.artifactsDir, filePath),
      fields: result.fields,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: gate.required ? 'failed' : 'skipped',
      required: gate.required,
      artifact_name: gate.artifactName,
      artifact_path: path.relative(options.artifactsDir, filePath),
      reason: message,
    };
  }
}

function textArtifactGate(options: Options, gate: {
  required: boolean;
  artifactName: string;
  files: string[];
}): GateSummary {
  const root = artifactDir(options, gate.artifactName);
  const foundFiles = gate.files.map((fileName) => findFile(root, fileName));
  const missing = gate.files.filter((_, index) => !foundFiles[index]);
  if (missing.length > 0) {
    return missingGate(gate.required, gate.artifactName, `Missing ${missing.join(', ')} in ${gate.artifactName}.`);
  }
  const sizePath = foundFiles[gate.files.indexOf('opl-webui-image-size-bytes.txt')];
  const imageSizeBytes = sizePath ? Number(fs.readFileSync(sizePath, 'utf8').trim()) : null;
  return {
    status: 'passed',
    required: gate.required,
    artifact_name: gate.artifactName,
    artifact_path: gate.files.map((fileName) => path.relative(options.artifactsDir, findFile(root, fileName) as string)).join(', '),
    fields: {
      files: gate.files,
      image_size_bytes: Number.isFinite(imageSizeBytes) ? imageSizeBytes : null,
    },
  };
}

function statusString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function buildSummary(options: Options) {
  const remoteArtifactName = `remote-release-verification-${options.version}`;
  const standardVmArtifactName = `opl-first-run-vm-standard-${process.env.GITHUB_RUN_ID || 'local'}`;
  const fullVmArtifactName = `opl-first-run-vm-full-${process.env.GITHUB_RUN_ID || 'local'}`;
  const oneShotArtifactName = `one-shot-app-installer-smoke-${options.version}`;
  const dockerArtifactName = `docker-webui-smoke-${options.version}`;
  const fullTelemetryArtifactName = `opl-full-workflow-telemetry-${options.version}`;
  const fullDiagnosticsArtifactName = `opl-full-diagnostics-${options.version}`;

  const remoteGate = jsonGate(options, {
    required: true,
    artifactName: remoteArtifactName,
    fileName: 'remote-release-verification.json',
    validate: (payload) => {
      const includeFullPackage = payload.include_full_package === true;
      const fields = {
        include_full_package: payload.include_full_package,
        verified_asset_count: payload.verified_asset_count,
        full_first_install_budget: payload.full_first_install_budget ?? null,
      };
      if (payload.status !== 'passed') return { reason: `Remote verification status is ${statusString(payload.status) || 'unknown'}.`, fields };
      if (options.includeFullPackage && !includeFullPackage) return { reason: 'Remote verification did not include the Full package.', fields };
      return { fields };
    },
  });

  const vmGate = (artifactName: string, profile: string, required: boolean) => jsonGate(options, {
    required,
    artifactName,
    fileName: 'tart-smoke-summary.json',
    validate: (payload) => {
      const fields = {
        runtime_profile: payload.runtime_profile,
        settings_smoke: payload.settings_smoke ?? null,
      };
      if (payload.status !== 'passed') return { reason: `VM smoke status is ${statusString(payload.status) || 'unknown'}.`, fields };
      if (payload.runtime_profile !== profile) return { reason: `Expected runtime_profile ${profile}, got ${String(payload.runtime_profile)}.`, fields };
      const settingsSmoke = payload.settings_smoke as Record<string, unknown> | undefined;
      if (!settingsSmoke || settingsSmoke.status !== 'passed') return { reason: 'VM smoke did not include passed Settings evidence.', fields };
      return { fields };
    },
  });

  const oneShotGate = jsonGate(options, {
    required: true,
    artifactName: oneShotArtifactName,
    fileName: 'opl-one-shot-system-initialize.json',
    validate: (payload) => {
      const setupFlow = (payload.system_initialize as Record<string, unknown> | undefined)?.setup_flow as Record<string, unknown> | undefined;
      const fields = { setup_flow_status: setupFlow?.status ?? payload.status ?? null };
      if (payload.status === 'failed') return { reason: 'One-shot installer reported failed status.', fields };
      if (setupFlow?.status && !['ready_to_launch', 'passed', 'initialized'].includes(String(setupFlow.status))) {
        return { reason: `One-shot setup_flow status is ${String(setupFlow.status)}.`, fields };
      }
      return { fields };
    },
  });

  const dockerGate = textArtifactGate(options, {
    required: true,
    artifactName: dockerArtifactName,
    files: [
      'opl-webui-index.html',
      'opl-webui-manifest.webmanifest',
      'opl-webui-image-size-bytes.txt',
    ],
  });

  const fullTelemetryGate = jsonGate(options, {
    required: options.includeFullPackage,
    artifactName: fullTelemetryArtifactName,
    fileName: 'full-workflow-telemetry.json',
    validate: (payload) => {
      const durationSeconds = payload.duration_seconds as Record<string, unknown> | undefined;
      const breakdown = durationSeconds?.full_package_build_breakdown as Record<string, unknown> | undefined;
      const requiredBreakdown = [
        'runtime_materialize',
        'runtime_cache_materialize',
        'payload_sync',
        'shell_build',
        'dmg_package_compression',
        'manifest_checksum',
      ];
      const fields = {
        cache: payload.cache ?? null,
        duration_seconds: durationSeconds ?? null,
        resolved_refs: payload.resolved_refs ?? null,
      };
      if (payload.schema !== 'opl_full_workflow_telemetry.v1') return { reason: 'Full telemetry schema is not opl_full_workflow_telemetry.v1.', fields };
      if (!durationSeconds || typeof durationSeconds.full_package_build !== 'number') return { reason: 'Full telemetry is missing duration_seconds.full_package_build.', fields };
      if (!breakdown || typeof breakdown !== 'object') return { reason: 'Full telemetry is missing duration_seconds.full_package_build_breakdown.', fields };
      const missing = requiredBreakdown.filter((key) => typeof breakdown[key] !== 'number');
      if (missing.length > 0) return { reason: `Full telemetry breakdown is missing numeric fields: ${missing.join(', ')}.`, fields };
      return { fields };
    },
  });

  const fullDiagnosticsRoot = artifactDir(options, fullDiagnosticsArtifactName);
  const manifestPath = findFile(fullDiagnosticsRoot, 'full-package-manifest.json');
  const runtimeCacheEventsPath = findFile(fullDiagnosticsRoot, 'runtime-cache-events.json');
  const checksumPath = findFile(fullDiagnosticsRoot, 'SHA256SUMS.txt');
  const fullDiagnosticsGate: GateSummary = !options.includeFullPackage
    ? missingGate(false, fullDiagnosticsArtifactName, 'Full package is not included.')
    : manifestPath && runtimeCacheEventsPath && checksumPath
      ? {
          status: 'passed',
          required: true,
          artifact_name: fullDiagnosticsArtifactName,
          artifact_path: [
            path.relative(options.artifactsDir, manifestPath),
            path.relative(options.artifactsDir, runtimeCacheEventsPath),
            path.relative(options.artifactsDir, checksumPath),
          ].join(', '),
          fields: {
            full_package_manifest: readJson(manifestPath),
            runtime_cache_events: readJson(runtimeCacheEventsPath),
          },
        }
      : missingGate(true, fullDiagnosticsArtifactName, 'Missing Full diagnostics manifest, runtime cache events, or SHA256SUMS.');

  const fullSizeCacheTimingGate: GateSummary = options.includeFullPackage
    ? fullTelemetryGate.status === 'passed' && fullDiagnosticsGate.status === 'passed'
      ? {
          status: 'passed',
          required: true,
          artifact_name: `${fullTelemetryArtifactName}, ${fullDiagnosticsArtifactName}`,
          fields: {
            telemetry: fullTelemetryGate.fields,
            diagnostics: fullDiagnosticsGate.fields,
          },
        }
      : {
          status: 'failed',
          required: true,
          artifact_name: `${fullTelemetryArtifactName}, ${fullDiagnosticsArtifactName}`,
          reason: [fullTelemetryGate.reason, fullDiagnosticsGate.reason].filter(Boolean).join(' '),
          fields: {
            telemetry_status: fullTelemetryGate.status,
            diagnostics_status: fullDiagnosticsGate.status,
          },
        }
    : missingGate(false, `${fullTelemetryArtifactName}, ${fullDiagnosticsArtifactName}`, 'Full package is not included.');

  const gates = {
    remote_release_verification: remoteGate,
    standard_dmg_clean_vm: options.runVmSmoke
      ? vmGate(standardVmArtifactName, 'standard', true)
      : missingGate(false, standardVmArtifactName, 'VM smoke disabled for this run.'),
    full_dmg_clean_vm: options.includeFullPackage && options.runVmSmoke
      ? vmGate(fullVmArtifactName, 'full', true)
      : missingGate(false, fullVmArtifactName, options.includeFullPackage ? 'VM smoke disabled for this run.' : 'Full package is not included.'),
    one_shot_app_installer: oneShotGate,
    docker_webui: dockerGate,
    full_size_cache_timing: fullSizeCacheTimingGate,
  };

  const failedRequired = Object.entries(gates)
    .filter(([, gate]) => gate.required && gate.status !== 'passed')
    .map(([id, gate]) => ({ id, status: gate.status, reason: gate.reason || 'gate did not pass' }));
  const telemetryPath = findFile(artifactDir(options, fullTelemetryArtifactName), 'full-workflow-telemetry.json');
  const fullPackage = telemetryPath ? readJson(telemetryPath) : null;
  const manifest = manifestPath ? readJson(manifestPath) : null;

  return {
    schema: 'opl_release_readiness_summary.v1',
    status: failedRequired.length === 0 ? 'passed' : 'failed',
    version: options.version,
    release_mode: options.releaseMode,
    include_full_package: options.includeFullPackage,
    run_vm_smoke: options.runVmSmoke,
    generated_at: new Date().toISOString(),
    artifacts_policy: {
      downloads_large_dmg_artifacts: false,
      rule: 'readiness aggregation downloads only small diagnostic artifacts and summaries; DMG assets are validated by remote verification and VM jobs.',
    },
    gates,
    failed_required_gates: failedRequired,
    full_package: {
      duration_seconds: fullPackage?.duration_seconds ?? null,
      cache: fullPackage?.cache ?? null,
      resolved_refs: fullPackage?.resolved_refs ?? manifest?.resolved_refs ?? null,
      size_breakdown: manifest?.size_breakdown ?? null,
    },
  };
}

function writeMarkdown(filePath: string, summary: ReturnType<typeof buildSummary>) {
  if (!filePath) return;
  const lines = [
    '## Release Readiness Summary',
    '',
    `- Status: ${summary.status}`,
    `- Version: ${summary.version}`,
    `- Release mode: ${summary.release_mode}`,
    `- Full package: ${summary.include_full_package ? 'included' : 'not included'}`,
    `- VM smoke: ${summary.run_vm_smoke ? 'enabled' : 'disabled'}`,
    '- Artifact policy: small diagnostic artifacts only; no standard or Full DMG download in this aggregation job.',
    '',
    '| Gate | Required | Status | Artifact | Reason |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const [id, gate] of Object.entries(summary.gates)) {
    lines.push(`| ${id} | ${gate.required ? 'yes' : 'no'} | ${gate.status} | ${gate.artifact_name ?? ''} | ${gate.reason ?? ''} |`);
  }
  const breakdown = summary.full_package.duration_seconds?.full_package_build_breakdown as Record<string, unknown> | undefined;
  if (breakdown && typeof breakdown === 'object') {
    lines.push('', '| Full build segment | Seconds |', '| --- | ---: |');
    for (const [key, value] of Object.entries(breakdown)) {
      lines.push(`| ${key} | ${String(value)} |`);
    }
  }
  lines.push('');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

try {
  const options = parseArgs(process.argv.slice(2));
  const summary = buildSummary(options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeMarkdown(options.markdown, summary);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.status !== 'passed') {
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
