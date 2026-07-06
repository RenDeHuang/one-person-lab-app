#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyStringOptionArg } from './cli-option-args.ts';
import { fileSha256, writeLinesFile } from './release-file-helpers.ts';
import { recordOrNull } from './release-json-helpers.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Options = {
  version: string;
  releaseMode: string;
  candidateRecordPath: string;
  readinessPath: string;
  remoteVerificationPath: string;
  preflightPath: string;
  gateReusePlanPath: string;
  output: string;
  markdown: string;
};

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    version: process.env.OPL_RELEASE_VERSION || '',
    releaseMode: process.env.OPL_RELEASE_MODE || '',
    candidateRecordPath: process.env.OPL_RELEASE_CANDIDATE_RECORD || '',
    readinessPath: process.env.OPL_RELEASE_READINESS_SUMMARY || '',
    remoteVerificationPath: process.env.OPL_REMOTE_RELEASE_VERIFICATION || '',
    preflightPath: process.env.OPL_RELEASE_PREFLIGHT_SUMMARY || '',
    gateReusePlanPath: process.env.OPL_RELEASE_GATE_REUSE_PLAN || '',
    output: process.env.OPL_RELEASE_COHORT_MANIFEST || '',
    markdown: process.env.OPL_RELEASE_COHORT_MANIFEST_MARKDOWN || '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const optionIndex = applyStringOptionArg(argv, index, {
      '--version': (value) => { parsed.version = value; },
      '--release-mode': (value) => { parsed.releaseMode = value; },
      '--candidate-record': (value) => { parsed.candidateRecordPath = value; },
      '--readiness': (value) => { parsed.readinessPath = value; },
      '--remote-verification': (value) => { parsed.remoteVerificationPath = value; },
      '--preflight': (value) => { parsed.preflightPath = value; },
      '--gate-reuse-plan': (value) => { parsed.gateReusePlanPath = value; },
      '--output': (value) => { parsed.output = value; },
      '--markdown': (value) => { parsed.markdown = value; },
    });
    if (optionIndex !== null) {
      index = optionIndex;
      continue;
    }
    throw new Error(`Unknown argument: ${argv[index]}`);
  }

  const required = [
    ['--version', parsed.version],
    ['--candidate-record', parsed.candidateRecordPath],
    ['--readiness', parsed.readinessPath],
    ['--remote-verification', parsed.remoteVerificationPath],
  ];
  for (const [label, value] of required) {
    if (!String(value).trim()) throw new Error(`Pass ${label} <value>.`);
  }
  return {
    ...parsed,
    candidateRecordPath: path.resolve(parsed.candidateRecordPath),
    readinessPath: path.resolve(parsed.readinessPath),
    remoteVerificationPath: path.resolve(parsed.remoteVerificationPath),
    preflightPath: parsed.preflightPath ? path.resolve(parsed.preflightPath) : '',
    gateReusePlanPath: parsed.gateReusePlanPath ? path.resolve(parsed.gateReusePlanPath) : '',
    output: parsed.output ? path.resolve(parsed.output) : path.resolve(appRoot, 'release-cohort-manifest.json'),
    markdown: parsed.markdown ? path.resolve(parsed.markdown) : '',
  };
}

function readRecord(filePath: string) {
  const record = recordOrNull(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  if (!record) throw new Error(`${filePath} must contain a JSON object.`);
  return record;
}

function readOptionalRecord(filePath: string) {
  return filePath && fs.existsSync(filePath) ? readRecord(filePath) : null;
}

function asRecordEntries(value: unknown) {
  const record = recordOrNull(value) ?? {};
  return Object.entries(record).map(([id, gate]) => ({
    id,
    ...(recordOrNull(gate) ?? {}),
  }));
}

function sortedAssets(remote: Record<string, unknown>) {
  return (Array.isArray(remote.verified_assets) ? remote.verified_assets : [])
    .map((asset) => recordOrNull(asset))
    .filter((asset): asset is Record<string, unknown> => asset !== null)
    .map((asset) => ({
      name: String(asset.name ?? ''),
      size: typeof asset.size === 'number' ? asset.size : null,
      sha256: String(asset.sha256 ?? ''),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function retryCommand(gateId: string, options: Options, candidate: Record<string, unknown>) {
  const tag = `v${options.version}`;
  const inputs = recordOrNull(candidate.inputs);
  const includeFull = inputs?.include_full_package === true;
  const shellRef = String(inputs?.shell_ref ?? '<shell-sha>');
  if (gateId === 'remote_release_verification') {
    return `npm run verify-remote-release -- --version ${options.version}${includeFull ? ' --include-full-package' : ''}`;
  }
  if (gateId === 'standard_dmg_clean_vm') {
    return `gh workflow run "OPL GUI First-Run VM" -f release_tag=${tag} -f package_profile=standard -f shell_ref=${shellRef}`;
  }
  if (gateId === 'full_dmg_clean_vm') {
    return `gh workflow run "OPL GUI First-Run VM" -f release_tag=${tag} -f release_artifact_name=opl-full-first-install-dmg-${options.version}-mac-arm64 -f package_profile=full -f shell_ref=${shellRef}`;
  }
  if (gateId === 'homebrew_standard_cask_clean_vm') {
    return `gh workflow run "OPL GUI First-Run VM" -f release_tag=${tag} -f package_profile=homebrew-standard -f shell_ref=${shellRef}`;
  }
  if (gateId === 'one_shot_app_installer') {
    return 'rerun job: Run one-shot App installer smoke';
  }
  if (gateId === 'docker_webui') {
    return 'rerun job: Run Docker WebUI smoke and stage GHCR publish';
  }
  if (gateId === 'webui_ghcr_publish') {
    return 'rerun job: Verify WebUI GHCR publish';
  }
  return `rerun or reuse gate ${gateId} from this cohort manifest`;
}

function buildManifest(options: Options) {
  const candidate = readRecord(options.candidateRecordPath);
  const readiness = readRecord(options.readinessPath);
  const remote = readRecord(options.remoteVerificationPath);
  const preflight = readOptionalRecord(options.preflightPath);
  const gateReusePlan = readOptionalRecord(options.gateReusePlanPath);
  const gates = asRecordEntries(readiness.gates).map((gate) => ({
    id: gate.id,
    status: String(gate.status ?? 'unknown'),
    required: gate.required !== false,
    artifact_name: typeof gate.artifact_name === 'string' ? gate.artifact_name : null,
    artifact_path: typeof gate.artifact_path === 'string' ? gate.artifact_path : null,
    retry_command: retryCommand(gate.id, options, candidate),
  }));
  const reusable = recordOrNull(gateReusePlan)?.decisions;

  return {
    schema: 'opl_release_cohort_manifest.v1',
    generated_at: new Date().toISOString(),
    status: String(candidate.status ?? 'unknown'),
    version: options.version,
    release_mode: options.releaseMode || String(candidate.release_mode ?? ''),
    tag: `v${options.version}`,
    source_files: {
      candidate_record: options.candidateRecordPath,
      candidate_record_sha256: fileSha256(options.candidateRecordPath),
      readiness: options.readinessPath,
      readiness_sha256: fileSha256(options.readinessPath),
      remote_verification: options.remoteVerificationPath,
      remote_verification_sha256: fileSha256(options.remoteVerificationPath),
      preflight: options.preflightPath || null,
      preflight_sha256: options.preflightPath ? fileSha256(options.preflightPath) : null,
      gate_reuse_plan: options.gateReusePlanPath || null,
      gate_reuse_plan_sha256: options.gateReusePlanPath ? fileSha256(options.gateReusePlanPath) : null,
    },
    cohort: {
      inputs: recordOrNull(candidate.inputs) ?? {},
      provenance: recordOrNull(candidate.provenance) ?? {},
      resolved_refs: recordOrNull(candidate.resolved_refs) ?? null,
      preflight_release_refs: Array.isArray(preflight?.release_refs) ? preflight.release_refs : [],
    },
    assets: sortedAssets(remote),
    gates,
    reusable_gates: Array.isArray(reusable) ? reusable : [],
    retry_policy: {
      build_once_promote_many: true,
      failed_gate_retry_should_consume_this_manifest: true,
      retry_must_not_rebuild_verified_assets_when_asset_sha256_matches: true,
      manifest_can_publish_release: false,
      manifest_can_claim_release_ready: false,
      manifest_can_write_runtime_truth: false,
    },
  };
}

function writeMarkdown(filePath: string, manifest: ReturnType<typeof buildManifest>) {
  if (!filePath) return;
  writeLinesFile(filePath, [
    '# Release Cohort Manifest',
    '',
    `- Status: ${manifest.status}`,
    `- Version: ${manifest.version}`,
    `- Tag: ${manifest.tag}`,
    `- Assets: ${manifest.assets.length}`,
    `- Gates: ${manifest.gates.length}`,
    '',
    '| Gate | Status | Retry command |',
    '| --- | --- | --- |',
    ...manifest.gates.map((gate) => (
      `| ${gate.id} | ${gate.status} | \`${gate.retry_command.replaceAll('`', '\\`')}\` |`
    )),
    '',
  ]);
}

try {
  const options = parseArgs(process.argv.slice(2));
  const manifest = buildManifest(options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  writeMarkdown(options.markdown, manifest);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
