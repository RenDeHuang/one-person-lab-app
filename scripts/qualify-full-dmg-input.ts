#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';

import { readAppProductProfile } from './app-product-profile/profile-contract.ts';
import { validateSelectedPackageSetInput } from './build-full-first-install-package/runtime-cache-package-set.ts';

type JsonRecord = Record<string, any>;

export type FullDmgInputQualification = {
  schema: 'opl_full_dmg_input_qualification.v1';
  status: 'passed' | 'blocked';
  qualification_scope: 'development_full_input' | 'append_full_input';
  append_full_input_eligible: boolean;
  release_authority_granted: false;
  artifact_built: false;
  issues: Array<{ code: string; message: string }>;
  observed_input: JsonRecord;
  offline_payload_digest: string;
  input_closure_digest: string;
};

export type FullDmgInputQualificationRequest = {
  appRoot: string;
  appRef: string;
  shellRoot: string;
  shellRef: string;
  frameworkRoot: string;
  frameworkRef: string;
  officeCliRoot: string;
  mineruRoot: string;
  uiUxProMaxRoot?: string;
  runtimeCacheKeyReportPath: string;
  toolchainObservationPath: string;
  bundlePath?: string;
};

const shaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const digestRefPattern = /^sha256:[0-9a-f]{64}$/;
const expectedLayerIds = ['toolchain', 'domain-runtime', 'opl-runtime', 'skills'] as const;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as JsonRecord;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function sha256(value: Buffer | string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function canonicalDigestRef(value: unknown): string {
  return `sha256:${sha256(canonicalJson(value))}`;
}

function fileSha256(filePath: string): string {
  return sha256(fs.readFileSync(filePath));
}

function regularFile(filePath: string, label: string): string {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error(`${label} must be a non-empty regular non-symlink file: ${resolved}`);
  }
  return resolved;
}

function readJson(filePath: string, label: string): JsonRecord {
  return JSON.parse(fs.readFileSync(regularFile(filePath, label), 'utf8')) as JsonRecord;
}

function runGit(root: string, args: string[], label: string): string {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Cannot resolve ${label}: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function relativeNestedFrameworkPath(appRoot: string, frameworkRoot: string): string | null {
  const relative = path.relative(appRoot, frameworkRoot).split(path.sep).join('/').replace(/\/+$/, '');
  return relative === 'framework-source' ? relative : null;
}

function gitIdentity(
  rootInput: string,
  expectedRef: string,
  label: string,
  issues: FullDmgInputQualification['issues'],
  allowedUntrackedDirectory: string | null = null,
) {
  const root = fs.realpathSync(rootInput);
  const commit = runGit(root, ['rev-parse', 'HEAD'], `${label} HEAD`);
  const tree = runGit(root, ['rev-parse', 'HEAD^{tree}'], `${label} tree`);
  const status = runGit(root, ['status', '--porcelain', '--untracked-files=all'], `${label} status`);
  const allowed = allowedUntrackedDirectory
    ? new Set([`?? ${allowedUntrackedDirectory}`, `?? ${allowedUntrackedDirectory}/`])
    : new Set<string>();
  const dirtyEntries = status.split(/\r?\n/).filter((line) => line && !allowed.has(line));

  if (!shaPattern.test(expectedRef)) {
    issues.push({ code: `${label}_expected_ref_invalid`, message: `${label} expected ref is not an exact Git SHA.` });
  } else if (commit !== expectedRef) {
    issues.push({
      code: `${label}_ref_mismatch`,
      message: `${label} HEAD ${commit} does not match expected ${expectedRef}.`,
    });
  }
  if (!shaPattern.test(commit) || !shaPattern.test(tree)) {
    issues.push({ code: `${label}_identity_invalid`, message: `${label} commit or tree identity is invalid.` });
  }
  if (dirtyEntries.length > 0) {
    issues.push({
      code: `${label}_checkout_dirty`,
      message: `${label} checkout has unbound changes: ${dirtyEntries.join(', ')}`,
    });
  }
  return { commit, tree, clean: dirtyEntries.length === 0 };
}

function stripLocalPaths(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripLocalPaths);
  if (!value || typeof value !== 'object') return value;
  const record = value as JsonRecord;
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !['source_path', 'executable_path', 'resolved_executable_path'].includes(key))
      .map(([key, entry]) => [key, stripLocalPaths(entry)]),
  );
}

function exactArray(left: unknown, right: readonly unknown[]): boolean {
  return Array.isArray(left) && canonicalJson(left) === canonicalJson(right);
}

function validateFrameworkBundle(
  bundle: JsonRecord,
  refs: { app: string; shell: string; framework: string },
  issues: FullDmgInputQualification['issues'],
): string | null {
  const { bundle_digest: expectedDigest, ...core } = bundle;
  const actualDigest = canonicalDigestRef(core);
  if (!digestRefPattern.test(String(expectedDigest ?? '')) || expectedDigest !== actualDigest) {
    issues.push({
      code: 'frozen_bundle_digest_mismatch',
      message: 'Framework Bundle digest does not match its immutable canonical content.',
    });
  }
  const checks: Array<[boolean, string, string]> = [
    [bundle.surface_kind === 'opl_release_bundle.v1', 'frozen_bundle_schema_invalid', 'Bundle is not opl_release_bundle.v1.'],
    [bundle.release?.channel === 'stable', 'frozen_bundle_channel_invalid', 'Bundle is not Stable.'],
    [bundle.release?.prerelease === false, 'frozen_bundle_prerelease_invalid', 'Bundle must not be a prerelease.'],
    [bundle.sources?.app?.repo === 'gaofeng21cn/one-person-lab-app', 'frozen_bundle_app_repo_invalid', 'Bundle App repository is invalid.'],
    [bundle.sources?.shell?.repo === 'gaofeng21cn/opl-aion-shell', 'frozen_bundle_shell_repo_invalid', 'Bundle Shell repository is invalid.'],
    [bundle.sources?.framework?.repo === 'gaofeng21cn/one-person-lab', 'frozen_bundle_framework_repo_invalid', 'Bundle Framework repository is invalid.'],
    [bundle.sources?.app?.source_commit === refs.app, 'frozen_bundle_app_ref_mismatch', 'Bundle App ref does not match the checkout.'],
    [bundle.sources?.shell?.source_commit === refs.shell, 'frozen_bundle_shell_ref_mismatch', 'Bundle Shell ref does not match the checkout.'],
    [bundle.sources?.framework?.source_commit === refs.framework, 'frozen_bundle_framework_ref_mismatch', 'Bundle Framework ref does not match the checkout.'],
    [bundle.identity_mode === 'app_standard_compatibility', 'frozen_bundle_identity_mode_invalid', 'Bundle identity mode is invalid.'],
    [bundle.tracks?.standard?.required_for_latest === true, 'frozen_bundle_standard_track_invalid', 'Bundle does not bind the required Standard track.'],
    [bundle.tracks?.full?.additive_only === true, 'frozen_bundle_full_policy_invalid', 'Bundle Full track is not additive-only.'],
    [bundle.tracks?.full?.updater_metadata_allowed === false, 'frozen_bundle_full_updater_policy_invalid', 'Bundle Full track can modify updater metadata.'],
    [bundle.policy?.latest_required_track === 'standard', 'frozen_bundle_latest_policy_invalid', 'Bundle Latest policy is not Standard-only.'],
  ];
  for (const [passed, code, message] of checks) {
    if (!passed) issues.push({ code, message });
  }
  return typeof expectedDigest === 'string' ? expectedDigest : null;
}

function validateToolchainObservation(
  observation: JsonRecord,
  thirdParty: JsonRecord,
  manifestDigests: { thirdParty: string; qualification: string },
  issues: FullDmgInputQualification['issues'],
) {
  if (observation.schema !== 'opl_app_full_toolchain_observation_receipt.v1') {
    issues.push({ code: 'toolchain_observation_schema_invalid', message: 'Toolchain observation schema is invalid.' });
  }
  if (observation.source_authority?.full_input_manifest_sha256 !== manifestDigests.thirdParty) {
    issues.push({ code: 'toolchain_full_manifest_mismatch', message: 'Toolchain observation does not bind the Full input manifest.' });
  }
  if (observation.source_authority?.qualification_input_manifest_sha256 !== manifestDigests.qualification) {
    issues.push({ code: 'toolchain_qualification_manifest_mismatch', message: 'Toolchain observation does not bind the qualification manifest.' });
  }
  for (const id of ['bun', 'go', 'python', 'uv', 'zstd']) {
    const expectedVersion = thirdParty.toolchain?.[id]?.version;
    const component = observation.components?.[id];
    if (typeof expectedVersion !== 'string' || component?.expected_version !== expectedVersion) {
      issues.push({
        code: `toolchain_${id}_expected_version_mismatch`,
        message: `Toolchain ${id} does not bind expected version ${String(expectedVersion)}.`,
      });
    }
    if (typeof component?.version_output !== 'string' || !component.version_output.includes(String(expectedVersion))) {
      issues.push({
        code: `toolchain_${id}_observed_version_mismatch`,
        message: `Toolchain ${id} output does not contain expected version ${String(expectedVersion)}.`,
      });
    }
    if (!digestPattern.test(String(component?.executable_sha256 ?? ''))) {
      issues.push({ code: `toolchain_${id}_digest_invalid`, message: `Toolchain ${id} executable digest is invalid.` });
    }
  }
}

function validateRuntimeCacheReport(
  report: JsonRecord,
  thirdParty: JsonRecord,
  qualification: JsonRecord,
  desiredRootPackageIds: readonly string[],
  refs: { framework: string },
  issues: FullDmgInputQualification['issues'],
) {
  if (report.status !== 'runtime_cache_keys') {
    issues.push({ code: 'runtime_cache_report_status_invalid', message: 'Runtime cache key report status is invalid.' });
  }
  if (!exactArray(report.layer_ids, expectedLayerIds)) {
    issues.push({ code: 'runtime_cache_layer_ids_invalid', message: 'Runtime cache layer IDs are not the exact Full set.' });
  }
  if (!exactArray(report.aggregate_key_input?.layer_ids, expectedLayerIds)) {
    issues.push({ code: 'runtime_cache_aggregate_layer_ids_invalid', message: 'Aggregate cache input has invalid layer IDs.' });
  }
  if (canonicalJson(report.aggregate_key_input?.layers) !== canonicalJson(report.layers)) {
    issues.push({ code: 'runtime_cache_aggregate_layers_mismatch', message: 'Aggregate cache input does not bind the emitted layer keys.' });
  }
  for (const layerId of expectedLayerIds) {
    const escaped = layerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`^full-runtime-v2-${escaped}-[0-9a-f]{24}$`).test(String(report.layers?.[layerId] ?? ''))) {
      issues.push({ code: `runtime_cache_${layerId}_key_invalid`, message: `Runtime cache key for ${layerId} is invalid.` });
    }
  }
  try {
    validateSelectedPackageSetInput(report.selected_package_set);
  } catch (error) {
    issues.push({
      code: 'selected_package_set_invalid',
      message: error instanceof Error ? error.message : String(error),
    });
  }
  if (!exactArray(report.selected_package_set?.package_ids, desiredRootPackageIds)) {
    issues.push({
      code: 'selected_package_set_membership_invalid',
      message: 'Selected package set roots do not match the App Official Profile.',
    });
  }

  const toolchain = report.layer_key_inputs?.toolchain ?? {};
  const expectedCodex = qualification.runtime_payloads?.codex_cli?.version;
  const expectedTemporal = thirdParty.runtime_payloads?.temporal_cli;
  const expectedOfficeCli = thirdParty.runtime_payloads?.officecli;
  const expectedPython = thirdParty.toolchain?.python?.version;
  const flowBuildLock = toolchain.flow_capability_build_lock ?? {};
  const flowBuildLockItems = Array.isArray(flowBuildLock.items) ? flowBuildLock.items : [];
  const capabilityRefs = flowBuildLockItems.map((item: JsonRecord) => item?.capability_ref);
  if (
    !digestPattern.test(String(flowBuildLock.lock_digest ?? ''))
    || !digestPattern.test(String(flowBuildLock.flow_package?.policy_sha256 ?? ''))
    || !digestPattern.test(String(flowBuildLock.flow_package?.strategy_digest ?? ''))
    || !Array.isArray(flowBuildLock.items)
  ) {
    issues.push({
      code: 'flow_capability_build_lock_invalid',
      message: 'Runtime cache input does not bind a valid Framework-generated Flow capability build lock.',
    });
  }
  if (new Set(capabilityRefs).size !== capabilityRefs.length) {
    issues.push({
      code: 'flow_capability_build_lock_duplicate_ref',
      message: 'Flow capability build lock contains duplicate capability refs.',
    });
  }
  const supportedFullCapabilityRefs = new Set(['cli:officecli', 'cli:mineru-open-api']);
  for (const [index, item] of flowBuildLockItems.entries()) {
    if (
      !supportedFullCapabilityRefs.has(item?.capability_ref)
      || typeof item?.source_ref !== 'string'
      || !item.source_ref.trim()
      || !digestPattern.test(String(item?.source_sha256 ?? ''))
      || typeof item?.version !== 'string'
      || !item.version.trim()
    ) {
      issues.push({
        code: 'flow_capability_build_lock_item_invalid',
        message: `Flow capability build lock item ${index} is unsupported or incomplete.`,
      });
    }
  }
  const officeCliLock = flowBuildLockItems.find(
    (item: JsonRecord) => item.capability_ref === 'cli:officecli',
  );
  if (officeCliLock && (
    officeCliLock.source_sha256 !== expectedOfficeCli?.darwin_arm64_asset_sha256
    || !String(officeCliLock.version).includes(String(expectedOfficeCli?.version))
  )) {
    issues.push({
      code: 'officecli_build_lock_hint_mismatch',
      message: 'Selected OfficeCLI build-lock resolution differs from the App Full source hint.',
    });
  }
  const checks: Array<[boolean, string, string]> = [
    [toolchain.codex_package_version === expectedCodex, 'codex_payload_version_mismatch', 'Codex payload version differs from qualification authority.'],
    [toolchain.temporal_cli_archive_sha256 === expectedTemporal?.darwin_arm64_archive_sha256, 'temporal_payload_digest_mismatch', 'Temporal archive digest differs from Full authority.'],
    [typeof toolchain.temporal_cli_version === 'string' && toolchain.temporal_cli_version.includes(`temporal version ${expectedTemporal?.version}`), 'temporal_payload_version_mismatch', 'Temporal CLI version differs from Full authority.'],
    [toolchain.python_version === `Python ${expectedPython}`, 'python_payload_version_mismatch', `Python payload is ${String(toolchain.python_version)}, expected Python ${String(expectedPython)}.`],
    [report.layer_key_inputs?.['opl-runtime']?.opl_commit === refs.framework, 'framework_runtime_ref_mismatch', 'Runtime cache input does not bind the Framework ref.'],
  ];
  for (const [passed, code, message] of checks) {
    if (!passed) issues.push({ code, message });
  }
}

export function buildFullDmgInputQualification(
  request: FullDmgInputQualificationRequest,
): FullDmgInputQualification {
  const issues: FullDmgInputQualification['issues'] = [];
  const appRoot = fs.realpathSync(request.appRoot);
  const shellRoot = fs.realpathSync(request.shellRoot);
  const frameworkRoot = fs.realpathSync(request.frameworkRoot);
  const nestedFramework = relativeNestedFrameworkPath(appRoot, frameworkRoot);
  const sources = {
    app: gitIdentity(appRoot, request.appRef, 'app', issues, nestedFramework),
    shell: gitIdentity(shellRoot, request.shellRef, 'shell', issues),
    framework: gitIdentity(frameworkRoot, request.frameworkRef, 'framework', issues),
  };

  const thirdPartyPath = regularFile(
    path.join(appRoot, 'contracts', 'app-full-third-party-source-manifest.json'),
    'Full third-party source manifest',
  );
  const qualificationPath = regularFile(
    path.join(appRoot, 'contracts', 'app-release-qualification-input-manifest.json'),
    'Release qualification input manifest',
  );
  const productProfilePath = regularFile(
    path.join(appRoot, 'contracts', 'app-product-profile.json'),
    'App product profile',
  );
  const appProductProfile = readAppProductProfile(productProfilePath);
  const prunePolicyPath = regularFile(
    path.join(appRoot, 'contracts', 'full-runtime-prune-policy.json'),
    'Full runtime prune policy',
  );
  const flowCapabilityConsumerPath = regularFile(
    path.join(appRoot, 'scripts', 'build-full-first-install-package', 'flow-capability-build-lock.ts'),
    'Flow capability build-lock consumer',
  );
  const thirdParty = readJson(thirdPartyPath, 'Full third-party source manifest');
  const qualification = readJson(qualificationPath, 'Release qualification input manifest');
  if (thirdParty.schema !== 'opl_app_full_third_party_source_manifest.v1') {
    issues.push({ code: 'full_third_party_manifest_schema_invalid', message: 'Full third-party source manifest schema is invalid.' });
  }
  if (qualification.schema !== 'opl_app_release_qualification_input_manifest.v1') {
    issues.push({ code: 'qualification_manifest_schema_invalid', message: 'Release qualification input manifest schema is invalid.' });
  }

  const manifestDigests = {
    third_party_source: fileSha256(thirdPartyPath),
    release_qualification_input: fileSha256(qualificationPath),
    app_product_profile: fileSha256(productProfilePath),
    full_runtime_prune_policy: fileSha256(prunePolicyPath),
    flow_capability_build_lock_consumer: fileSha256(flowCapabilityConsumerPath),
  };
  const thirdPartyRefs = {
    officeCli: String(thirdParty.sources?.officecli?.ref ?? ''),
    mineru: String(thirdParty.sources?.mineru?.ref ?? ''),
  };

  const runtimeCacheKeyReportPath = regularFile(request.runtimeCacheKeyReportPath, 'Runtime cache key report');
  const toolchainObservationPath = regularFile(request.toolchainObservationPath, 'Toolchain observation');
  const runtimeCacheKeyReport = readJson(runtimeCacheKeyReportPath, 'Runtime cache key report');
  const toolchainObservation = readJson(toolchainObservationPath, 'Toolchain observation');
  const selectedCapabilityRefs = new Set(
    (runtimeCacheKeyReport.layer_key_inputs?.toolchain?.flow_capability_build_lock?.items ?? [])
      .map((item: JsonRecord) => item?.capability_ref),
  );
  const thirdPartySources = {
    ...(selectedCapabilityRefs.has('cli:officecli')
      ? { officecli: gitIdentity(request.officeCliRoot, thirdPartyRefs.officeCli, 'officecli', issues) }
      : {}),
    ...(selectedCapabilityRefs.has('cli:mineru-open-api')
      ? { mineru: gitIdentity(request.mineruRoot, thirdPartyRefs.mineru, 'mineru', issues) }
      : {}),
  };
  validateRuntimeCacheReport(
    runtimeCacheKeyReport,
    thirdParty,
    qualification,
    appProductProfile.official_profile.desired_root_package_ids,
    {
      framework: request.frameworkRef,
    },
    issues,
  );
  validateToolchainObservation(
    toolchainObservation,
    thirdParty,
    {
      thirdParty: manifestDigests.third_party_source,
      qualification: manifestDigests.release_qualification_input,
    },
    issues,
  );

  let bundleDigest: string | null = null;
  let releaseIdentity: JsonRecord | null = null;
  if (request.bundlePath) {
    const bundle = readJson(request.bundlePath, 'Frozen Standard Bundle');
    bundleDigest = validateFrameworkBundle(
      bundle,
      { app: request.appRef, shell: request.shellRef, framework: request.frameworkRef },
      issues,
    );
    releaseIdentity = {
      bundle_digest: bundleDigest,
      version: bundle.release?.version ?? null,
      updater_version: bundle.release?.updater_version ?? null,
      tag: bundle.release?.tag ?? null,
    };
    if (runtimeCacheKeyReport.version !== bundle.release?.version) {
      issues.push({ code: 'runtime_cache_version_mismatch', message: 'Runtime cache report version differs from the frozen Bundle.' });
    }
  }

  const portableRuntimeInput = stripLocalPaths({
    version: runtimeCacheKeyReport.version,
    layer_ids: runtimeCacheKeyReport.layer_ids,
    selected_package_set: runtimeCacheKeyReport.selected_package_set,
    layer_key_inputs: runtimeCacheKeyReport.layer_key_inputs,
  });
  const portableToolchain = stripLocalPaths({
    source_authority: toolchainObservation.source_authority,
    components: toolchainObservation.components,
  });
  const offlinePayload = {
    authority_manifest_sha256: manifestDigests,
    third_party_sources: thirdPartySources,
    runtime_cache_input: portableRuntimeInput,
    toolchain_observation: portableToolchain,
  };
  const offlinePayloadDigest = canonicalDigestRef(offlinePayload);
  const observedInput = {
    mode: request.bundlePath ? 'append_full' : 'development',
    release: releaseIdentity,
    sources,
    third_party_sources: thirdPartySources,
    authority_manifest_sha256: manifestDigests,
    runtime_cache_key_report_sha256: fileSha256(runtimeCacheKeyReportPath),
    runtime_cache_aggregate_key_input_digest: canonicalDigestRef(runtimeCacheKeyReport.aggregate_key_input),
    runtime_cache_layers: runtimeCacheKeyReport.layers,
    selected_package_set_identity: runtimeCacheKeyReport.selected_package_set?.identity ?? null,
    toolchain_observation_sha256: fileSha256(toolchainObservationPath),
    offline_payload_digest: offlinePayloadDigest,
  };
  const inputClosureDigest = canonicalDigestRef(observedInput);
  const status = issues.length === 0 ? 'passed' : 'blocked';
  return {
    schema: 'opl_full_dmg_input_qualification.v1',
    status,
    qualification_scope: request.bundlePath ? 'append_full_input' : 'development_full_input',
    append_full_input_eligible: Boolean(request.bundlePath) && status === 'passed',
    release_authority_granted: false,
    artifact_built: false,
    issues,
    observed_input: observedInput,
    offline_payload_digest: offlinePayloadDigest,
    input_closure_digest: inputClosureDigest,
  };
}

function required(values: Record<string, string | undefined>, name: string): string {
  const value = values[name]?.trim();
  if (!value) throw new Error(`Missing --${name}.`);
  return value;
}

function cli(): void {
  const { values } = parseNodeArgs({
    options: {
      'app-root': { type: 'string' },
      'app-ref': { type: 'string' },
      'shell-root': { type: 'string' },
      'shell-ref': { type: 'string' },
      'framework-root': { type: 'string' },
      'framework-ref': { type: 'string' },
      'officecli-root': { type: 'string' },
      'mineru-root': { type: 'string' },
      'ui-ux-pro-max-root': { type: 'string' },
      'runtime-cache-key-report': { type: 'string' },
      'toolchain-observation': { type: 'string' },
      bundle: { type: 'string' },
      output: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  const stringValues = values as Record<string, string | undefined>;
  const outputPath = path.resolve(required(stringValues, 'output'));
  const receipt = buildFullDmgInputQualification({
    appRoot: required(stringValues, 'app-root'),
    appRef: required(stringValues, 'app-ref'),
    shellRoot: required(stringValues, 'shell-root'),
    shellRef: required(stringValues, 'shell-ref'),
    frameworkRoot: required(stringValues, 'framework-root'),
    frameworkRef: required(stringValues, 'framework-ref'),
    officeCliRoot: required(stringValues, 'officecli-root'),
    mineruRoot: required(stringValues, 'mineru-root'),
    uiUxProMaxRoot: stringValues['ui-ux-pro-max-root'],
    runtimeCacheKeyReportPath: required(stringValues, 'runtime-cache-key-report'),
    toolchainObservationPath: required(stringValues, 'toolchain-observation'),
    bundlePath: stringValues.bundle,
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (receipt.status !== 'passed') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    cli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
