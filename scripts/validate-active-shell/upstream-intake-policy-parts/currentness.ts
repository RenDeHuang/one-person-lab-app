import path from 'node:path';
import { assertDeepEqualJson, readJson } from '../assertions.ts';
import {
  assertExactPackageVersion,
  assertGitSha,
  assertObject,
  assertSha256,
} from './assertions.ts';

export const REQUIRED_AIONCORE_VERSION = 'v0.1.44';
export const REQUIRED_STABLE_CURRENTNESS_RECEIPT = {
  path: 'contracts/aionui-upstream-intake.json',
  schema: 'opl_aionui_upstream_intake.v2',
  channel: 'stable_tags_only',
  read_policy: 'active_shell_checkout_read_only_fail_closed',
  implementation_ancestry_policy:
    'all_shell_projection_implementation_refs_must_be_ancestors_of_active_shell_head',
  managed_runtime_bindings: {
    minimum_aioncore_version: REQUIRED_AIONCORE_VERSION,
    aioncore_version: 'contracts/aionui-upstream-intake.json#managed_runtime.aioncore.version',
    aioncore_source_commit: 'contracts/aionui-upstream-intake.json#managed_runtime.aioncore.commit',
    aioncore_archive_sha256:
      'contracts/aionui-upstream-intake.json#managed_runtime.aioncore.archive_sha256',
    managed_resources_schema:
      'contracts/aionui-upstream-intake.json#managed_runtime.managed_resources_schema',
    managed_resources_manifest_sha256:
      'contracts/aionui-upstream-intake.json#managed_runtime.managed_resources_manifest_sha256',
    node_runtime_version: 'contracts/aionui-upstream-intake.json#managed_runtime.node_runtime.version',
    node_runtime_binary_sha256:
      'contracts/aionui-upstream-intake.json#managed_runtime.node_runtime.binary_sha256',
    claude_cli_package_version: 'contracts/aionui-upstream-intake.json#managed_runtime.claude_cli',
    claude_cli_binary_sha256:
      'contracts/aionui-upstream-intake.json#managed_runtime.claude_cli.binary_sha256',
    codex_cli_package_version: 'contracts/aionui-upstream-intake.json#managed_runtime.codex_cli',
    codex_cli_binary_sha256:
      'contracts/aionui-upstream-intake.json#managed_runtime.codex_cli.binary_sha256',
    qualification_contract: 'manual_qualification_contract',
    source_lock_requirement_source: 'manual_qualification_contract.exact_source_lock_required',
    packaged_manifest_authority:
      'manual_qualification_contract.runtime_dependencies.aioncore.resource_authority',
  },
  required_policy: {
    broad_history_merge: 'forbidden',
    newer_stable_release: 'review_required',
    network_unknown: 'unknown_fail_closed_for_release_admission',
    product_authority: 'one-person-lab-app',
  },
};

export function parseVersion(value, label) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) {
    throw new Error(`${label} must use vMAJOR.MINOR.PATCH`);
  }
  return match.slice(1).map(Number);
}

export function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function validateManagedRuntimeQualification(contract) {
  const qualification = assertObject(
    contract.manual_qualification_contract,
    'Active shell manual qualification contract',
  );
  if (qualification.exact_source_lock_required !== true) {
    throw new Error('Active shell managed runtime qualification must require an exact source lock');
  }
  const runtimeDependencies = assertObject(
    qualification.runtime_dependencies,
    'Active shell manual qualification runtime dependencies',
  );
  const aionCore = assertObject(runtimeDependencies.aioncore, 'Manual qualification AionCore dependency');
  if (
    aionCore.version_source !== 'package.json#aioncoreVersion' ||
    aionCore.resource_authority !==
      'bundled-aioncore/<platform>-<arch>/managed-resources/manifest.json'
  ) {
    throw new Error('Active shell AionCore qualification must bind package pin and packaged manifest authority');
  }
  if (Object.hasOwn(runtimeDependencies, 'managed_codex_acp')) {
    throw new Error('Active shell managed runtime qualification must reject retired Codex ACP truth');
  }
  const nodeRuntime = assertObject(runtimeDependencies.node_runtime, 'Manual qualification Node runtime dependency');
  if (
    nodeRuntime.version_source !==
      'AionCore producer manifest node runtime' ||
    nodeRuntime.target_platform_binary_required !== true
  ) {
    throw new Error('Active shell Node runtime qualification must bind the AionCore producer Node runtime and target binary');
  }
  if (Object.hasOwn(runtimeDependencies, 'claude_cli')) {
    throw new Error('Active shell packaged runtime qualification must not retain Claude CLI');
  }
  const codexCli = assertObject(runtimeDependencies.codex_cli, 'Manual qualification Codex CLI dependency');
  if (
    codexCli.package !== '@openai/codex' ||
    codexCli.version_source !==
      'contracts/aionui-upstream-intake.json#managed_runtime.codex_cli' ||
    codexCli.target_platform_binary_required !== true
  ) {
    throw new Error('Active shell Codex CLI qualification must bind the OPL-selected Codex source and target binary');
  }
}

export function validateStableCurrentnessReceipt(contract, shellPaths, options, isGitAncestor) {
  const authority = contract.upstream_intake.stable_currentness_receipt;
  assertDeepEqualJson(
    authority,
    REQUIRED_STABLE_CURRENTNESS_RECEIPT,
    'Active shell stable currentness receipt contract',
  );
  const receiptPath = path.resolve(shellPaths.shellRoot, authority.path);
  const relativeReceiptPath = path.relative(shellPaths.shellRoot, receiptPath);
  if (
    !relativeReceiptPath ||
    relativeReceiptPath === '..' ||
    relativeReceiptPath.startsWith(`..${path.sep}`)
  ) {
    throw new Error('Active shell stable currentness receipt path escapes the Shell checkout');
  }
  const readShellReceipt = options.readShellReceipt ?? readJson;
  let receipt;
  try {
    receipt = assertObject(readShellReceipt(receiptPath), 'AionUI stable currentness receipt');
  } catch (error) {
    throw new Error(
      `Unable to read active shell stable currentness receipt: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (receipt.schema !== authority.schema) {
    throw new Error(`AionUI stable currentness receipt schema must be ${authority.schema}`);
  }
  if (receipt.upstream_repository !== 'https://github.com/iOfficeAI/AionUi.git') {
    throw new Error('AionUI stable currentness receipt must name the official upstream repository');
  }
  if (receipt.channel !== authority.channel) {
    throw new Error(`AionUI stable currentness receipt channel must be ${authority.channel}`);
  }

  const reviewed = assertObject(receipt.reviewed_release, 'AionUI receipt reviewed_release');
  const absorbed = assertObject(receipt.absorbed_release, 'AionUI receipt absorbed_release');
  const reviewedVersion = parseVersion(reviewed.tag, 'AionUI receipt reviewed release');
  const absorbedVersion = parseVersion(absorbed.tag, 'AionUI receipt absorbed release');
  if (reviewed.tag !== `v${reviewedVersion.join('.')}` || absorbed.tag !== `v${absorbedVersion.join('.')}`) {
    throw new Error('AionUI receipt release tags must use canonical vMAJOR.MINOR.PATCH');
  }
  assertGitSha(reviewed.commit, 'AionUI receipt reviewed_release.commit');
  assertGitSha(absorbed.commit, 'AionUI receipt absorbed_release.commit');
  if (
    typeof reviewed.published_at !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(reviewed.published_at) ||
    Number.isNaN(Date.parse(reviewed.published_at))
  ) {
    throw new Error('AionUI receipt reviewed_release.published_at must be a UTC ISO-8601 timestamp');
  }
  if (
    reviewed.draft !== false ||
    reviewed.prerelease !== false ||
    reviewed.url !== `https://github.com/iOfficeAI/AionUi/releases/tag/${reviewed.tag}`
  ) {
    throw new Error('AionUI receipt reviewed_release must bind official stable release metadata');
  }
  if (
    !['selectively_absorbed', 'reviewed_deferred', 'reviewed_rejected', 'reviewed_no_change'].includes(
      reviewed.disposition,
    )
  ) {
    throw new Error('AionUI receipt reviewed_release.disposition is unsupported');
  }
  if (compareVersions(absorbedVersion, reviewedVersion) > 0) {
    throw new Error('AionUI receipt absorbed release cannot be newer than reviewed release');
  }
  if (
    reviewed.disposition === 'selectively_absorbed' &&
    (absorbed.tag !== reviewed.tag || absorbed.commit !== reviewed.commit)
  ) {
    throw new Error('AionUI selectively absorbed receipt must bind the reviewed release');
  }

  const projection = assertObject(receipt.shell_projection, 'AionUI receipt shell_projection');
  if (!Array.isArray(projection.implementation_refs) || projection.implementation_refs.length === 0) {
    throw new Error('AionUI receipt implementation_refs must be a non-empty array');
  }
  for (const [index, ref] of projection.implementation_refs.entries()) {
    assertGitSha(ref, `AionUI receipt implementation_refs[${index}]`);
    if (!isGitAncestor(ref, shellPaths.shellRoot)) {
      throw new Error(`active shell HEAD must contain receipt implementation ref ${ref}`);
    }
  }
  if (
    projection.aioncore_version_source !== 'package.json#aioncoreVersion' ||
    typeof projection.human_record !== 'string' ||
    projection.human_record.length === 0
  ) {
    throw new Error('AionUI receipt shell projection must bind the Shell package pin and human record');
  }

  const runtime = assertObject(receipt.managed_runtime, 'AionUI receipt managed_runtime');
  const aionCore = assertObject(runtime.aioncore, 'AionUI receipt managed_runtime.aioncore');
  parseVersion(aionCore.version, 'AionUI receipt AionCore version');
  assertGitSha(aionCore.commit, 'AionUI receipt AionCore source commit');
  assertSha256(aionCore.archive_sha256, 'AionUI receipt AionCore archive');
  if (runtime.managed_resources_schema !== 2) {
    throw new Error('AionUI receipt managed resources schema must be 2');
  }
  assertSha256(runtime.managed_resources_manifest_sha256, 'AionUI receipt managed resources manifest');
  const managedResourcesProjection = assertObject(
    runtime.managed_resources_projection,
    'AionUI receipt managed resources projection',
  );
  if (
    managedResourcesProjection.composition !== 'aioncore_node_plus_opl_selected_cli' ||
    JSON.stringify(managedResourcesProjection.aioncore_source_cli_names) !== JSON.stringify([]) ||
    managedResourcesProjection.codex_source !== 'managed_runtime.codex_cli'
  ) {
    throw new Error('AionUI receipt managed resources projection must bind the OPL-composed Codex carrier');
  }
  if (Object.hasOwn(runtime, 'codex_acp')) {
    throw new Error('AionUI receipt must not retain retired Codex ACP truth');
  }
  const nodeRuntime = assertObject(runtime.node_runtime, 'AionUI receipt managed Node runtime');
  assertExactPackageVersion(nodeRuntime.version, 'AionUI receipt managed Node runtime version');
  assertSha256(nodeRuntime.binary_sha256, 'AionUI receipt managed Node runtime binary');
  const claudeCli = assertObject(runtime.claude_cli, 'AionUI receipt managed Claude CLI');
  if (claudeCli.package !== '@anthropic-ai/claude-code') {
    throw new Error('AionUI receipt managed Claude CLI package is not authoritative');
  }
  assertExactPackageVersion(claudeCli.version, 'AionUI receipt managed Claude CLI version');
  assertSha256(claudeCli.binary_sha256, 'AionUI receipt managed Claude CLI binary');
  if (
    claudeCli.carrier_status !== 'absent_legacy_producer_identity' ||
    claudeCli.required_in_bundle !== false
  ) {
    throw new Error('AionUI receipt must preserve Claude only as an absent legacy producer identity');
  }
  const codexCli = assertObject(runtime.codex_cli, 'AionUI receipt managed Codex CLI');
  if (codexCli.package !== '@openai/codex') {
    throw new Error('AionUI receipt managed Codex CLI package is not authoritative');
  }
  assertExactPackageVersion(codexCli.version, 'AionUI receipt managed Codex CLI version');
  assertSha256(codexCli.binary_sha256, 'AionUI receipt managed Codex CLI binary');
  if (
    codexCli.carrier !== 'opl_app_official_npm_platform_package' ||
    codexCli.opl_verified_aioncore_version !== aionCore.version
  ) {
    throw new Error('AionUI receipt managed Codex CLI must bind the OPL official package carrier and AionCore compatibility');
  }
  assertDeepEqualJson(receipt.policy, authority.required_policy, 'AionUI stable currentness receipt policy');
  validateManagedRuntimeQualification(contract);
  return receipt;
}
