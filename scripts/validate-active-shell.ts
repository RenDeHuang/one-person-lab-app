#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = path.join(root, 'contracts', 'app-shell-adapter.json');
const pageStateMatrixPath = path.join(root, 'contracts', 'app-page-state-matrix.json');
const firstRunMatrixPath = path.join(root, 'contracts', 'app-first-run-test-matrix.json');
const productProfilePath = path.join(root, 'contracts', 'app-product-profile.json');
const releaseChannelPath = path.join(root, 'contracts', 'app-release-channel.json');

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function parseArgs(argv) {
  const parsed = { quick: false, only: new Set() };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--quick') {
      parsed.quick = true;
      continue;
    }
    if (arg === '--only') {
      const value = argv[++index];
      if (!value) throw new Error('Missing value for --only');
      for (const id of value.split(',').map((entry) => entry.trim()).filter(Boolean)) {
        parsed.only.add(id);
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function assertFile(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${path.relative(root, filePath)}`);
  }
}

function validateContractShape(contract) {
  if (contract.app_repo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`Unexpected app_repo: ${contract.app_repo}`);
  }
  if (contract.active_shell !== 'aionui') {
    throw new Error(`Unexpected active_shell: ${contract.active_shell}`);
  }
  if (contract.shell_root !== 'shells/aionui') {
    throw new Error(`Unexpected shell_root: ${contract.shell_root}`);
  }
  if (contract.shell_source?.owner_repo !== 'gaofeng21cn/opl-aion-shell') {
    throw new Error(`Unexpected shell_source owner: ${contract.shell_source?.owner_repo}`);
  }
  if (contract.shell_source?.history_policy !== 'external_checkout_not_merged_into_app_default_branch') {
    throw new Error(`Unexpected shell history policy: ${contract.shell_source?.history_policy}`);
  }

  const shellRoot = path.join(root, contract.shell_root);
  assertFile(shellRoot, 'active shell root');
  assertFile(path.join(shellRoot, 'package.json'), 'active shell package.json');
  assertFile(path.join(shellRoot, 'AGENTS.md'), 'active shell AGENTS.md');

  if (!Array.isArray(contract.validation_commands) || contract.validation_commands.length === 0) {
    throw new Error('validation_commands must be a non-empty array');
  }

  for (const entry of contract.validation_commands) {
    if (!entry.id || !entry.cwd || !entry.command) {
      throw new Error(`Invalid validation command entry: ${JSON.stringify(entry)}`);
    }
    assertFile(path.join(root, entry.cwd), `validation cwd for ${entry.id}`);
  }
}

function validatePageStateMatrix(matrix, contract) {
  if (matrix.active_shell !== contract.active_shell || matrix.shell_root !== contract.shell_root) {
    throw new Error('Page-state matrix must target the active shell contract');
  }

  const requiredPages = new Set([
    'runtime',
    'settings_overview',
    'environment',
    'about',
    'update',
    'first_launch_readiness',
  ]);
  for (const page of matrix.pages ?? []) {
    requiredPages.delete(page.id);
    if (!page.expected_source || !Array.isArray(page.must_show) || page.must_show.length === 0) {
      throw new Error(`Invalid page-state entry: ${JSON.stringify(page)}`);
    }
  }
  if (requiredPages.size > 0) {
    throw new Error(`Page-state matrix is missing required page(s): ${[...requiredPages].join(', ')}`);
  }

  const runtimePage = (matrix.pages ?? []).find((page) => page.id === 'runtime');
  if (!runtimePage) {
    throw new Error('Page-state matrix is missing runtime page');
  }
  if (runtimePage.machine_source !== 'runtime_tray_snapshot.app_operator_drilldown') {
    throw new Error(`Runtime page must consume OPL app_operator_drilldown, got: ${runtimePage.machine_source}`);
  }
  if (runtimePage.framework_command !== 'opl runtime app-operator-drilldown --json') {
    throw new Error(`Runtime page must use the OPL drilldown command, got: ${runtimePage.framework_command}`);
  }
  if (runtimePage.framework_full_detail_command !== 'opl runtime app-operator-drilldown --json --detail full') {
    throw new Error(`Runtime page must lazy-load full App/operator drilldown through the whitelisted OPL command, got: ${runtimePage.framework_full_detail_command}`);
  }
  if (runtimePage.framework_action_command !== 'opl runtime action execute --action <id> [--payload refs-only-json] [--dry-run]') {
    throw new Error(`Runtime page must expose only the whitelisted OPL action command, got: ${runtimePage.framework_action_command}`);
  }
  const acceptancePath = runtimePage.operator_evidence_acceptance_path;
  if (acceptancePath?.role !== 'runtime_page_operator_evidence_acceptance') {
    throw new Error('Runtime page must declare operator evidence acceptance path');
  }
  if (acceptancePath.accepts_refs_only_json !== true) {
    throw new Error('Runtime page operator evidence acceptance must be refs-only JSON');
  }
  for (const [field, expected] of Object.entries({
    summary_drilldown_command: 'opl runtime app-operator-drilldown --json',
    full_drilldown_command: 'opl runtime app-operator-drilldown --json --detail full',
    action_dry_run_command: 'opl runtime action execute --action <action_id> --dry-run',
    action_execute_command: 'opl runtime action execute --action <action_id>',
    action_route_source: 'runtime_tray_snapshot.app_operator_drilldown.safe_action_routes',
    action_execution_policy: 'operator_selected_safe_action_route_only',
  })) {
    if (acceptancePath[field] !== expected) {
      throw new Error(`Runtime page operator evidence acceptance ${field} must be ${expected}`);
    }
  }
  const requiredEvidencePath = [
    'summary-first app operator read model',
    'full detail lazy load',
    'safe action dry-run',
    'safe action execute',
    'receipt/count refresh after execute',
    'authority boundary fields',
  ];
  for (const signal of requiredEvidencePath) {
    if (!runtimePage.operator_evidence_path?.includes(signal)) {
      throw new Error(`Runtime page operator evidence path must include ${signal}`);
    }
  }
  const requiredRuntimeSignals = [
    'operator evidence acceptance state',
    'summary-first app operator read model',
    'full detail lazy load',
    'safe action dry-run/execute controls',
    'receipt/count refresh after execute',
    'route graph and decision map refs',
    'review and repair queue',
    'artifact gallery and package/export lifecycle refs',
    'memory refs and writeback receipt refs',
    'quality/readiness refs',
    'provider SLO and repair refs',
    'owner-aware action routing',
    'safe action dry-run and execute result refs',
  ];
  for (const signal of requiredRuntimeSignals) {
    if (!runtimePage.must_show.includes(signal)) {
      throw new Error(`Runtime page must show ${signal}`);
    }
  }
  const forbiddenRuntimeOwners = [
    'runtime truth',
    'provider implementation',
    'domain truth',
    'memory body',
    'artifact body',
    'quality/readiness/export verdict',
    'action route authority',
    'domain action approval override',
  ];
  for (const owner of forbiddenRuntimeOwners) {
    if (!runtimePage.must_not_own?.includes(owner)) {
      throw new Error(`Runtime page must not own ${owner}`);
    }
  }
}

function validateReleaseEvidenceBundle(releaseChannel, pageStateMatrix, firstRunMatrix) {
  const bundle = releaseChannel.operator_evidence_bundle;
  if (bundle?.purpose !== 'runtime_page_operator_evidence_acceptance') {
    throw new Error('Release channel must declare operator_evidence_bundle purpose');
  }
  if (bundle.acceptance_path !== 'Runtime page') {
    throw new Error(`Unexpected operator evidence acceptance path: ${bundle.acceptance_path}`);
  }
  if (bundle.runtime_page_contract !== 'contracts/app-page-state-matrix.json#runtime') {
    throw new Error(`Unexpected runtime page contract ref: ${bundle.runtime_page_contract}`);
  }
  if (bundle.refs_only !== true) {
    throw new Error('Operator evidence bundle must be refs-only');
  }

  const artifactById = new Map((bundle.required_artifacts ?? []).map((artifact) => [artifact.id, artifact]));
  const requiredArtifacts = {
    runtime_snapshot: {
      path: 'runtime-snapshot.json',
      producer: 'opl runtime snapshot --json',
      kind: 'json',
    },
    drilldown_summary: {
      path: 'drilldown-summary.json',
      producer: 'opl runtime app-operator-drilldown --json',
      kind: 'json',
    },
    drilldown_full: {
      path: 'drilldown-full.json',
      producer: 'opl runtime app-operator-drilldown --json --detail full',
      kind: 'json',
    },
    action_dry_run_result: {
      path: 'action-dry-run-result.json',
      producer: 'opl runtime action execute --action <action_id> --dry-run',
      kind: 'json',
    },
    action_execute_result: {
      path: 'action-execute-result.json',
      producer: 'opl runtime action execute --action <action_id>',
      kind: 'json',
    },
    runtime_screenshot: {
      path: 'screenshots/runtime.png',
      producer: 'Runtime page screenshot',
      kind: 'image',
    },
    full_screenshot: {
      path: 'screenshots/full.png',
      producer: 'Full first-install release screenshot',
      kind: 'image',
    },
    action_screenshot: {
      path: 'screenshots/action.png',
      producer: 'Runtime action confirmation/result screenshot',
      kind: 'image',
    },
    first_run_log: {
      path: 'first-run.log',
      producer: 'clean first-run VM smoke',
      kind: 'log',
    },
    settings_smoke: {
      path: 'settings-smoke.json',
      producer: 'settings smoke',
      kind: 'json',
    },
    remote_release_verification: {
      path: 'remote-release-verification.json',
      producer: 'npm run verify-remote-release -- --version <version> --include-full-package --summary-path remote-release-verification.json',
      kind: 'json',
    },
  };
  for (const [id, expected] of Object.entries(requiredArtifacts)) {
    const artifact = artifactById.get(id);
    if (!artifact) {
      throw new Error(`Operator evidence bundle missing artifact ${id}`);
    }
    for (const [field, expectedValue] of Object.entries(expected)) {
      if (artifact[field] !== expectedValue) {
        throw new Error(`Operator evidence bundle artifact ${id}.${field} must be ${expectedValue}`);
      }
    }
  }

  const runtimePage = (pageStateMatrix.pages ?? []).find((page) => page.id === 'runtime');
  if (runtimePage?.operator_evidence_acceptance_path?.full_drilldown_command !== requiredArtifacts.drilldown_full.producer) {
    throw new Error('Runtime page full drilldown command must match release evidence bundle producer');
  }
  if (runtimePage?.operator_evidence_acceptance_path?.action_dry_run_command !== requiredArtifacts.action_dry_run_result.producer) {
    throw new Error('Runtime page dry-run command must match release evidence bundle producer');
  }
  if (runtimePage?.operator_evidence_acceptance_path?.action_execute_command !== requiredArtifacts.action_execute_result.producer) {
    throw new Error('Runtime page execute command must match release evidence bundle producer');
  }

  const fullFirstInstall = (firstRunMatrix.scenarios ?? []).find((scenario) => scenario.id === 'full_first_install_clean_machine');
  for (const artifactPath of ['first-run.log', 'settings-smoke.json']) {
    if (!fullFirstInstall?.release_evidence_artifacts?.includes(artifactPath)) {
      throw new Error(`Full first-install first-run scenario must list release evidence artifact ${artifactPath}`);
    }
  }

  for (const forbidden of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    if (!bundle.forbidden_authority?.includes(forbidden)) {
      throw new Error(`Operator evidence bundle must exclude ${forbidden}`);
    }
  }
}

function validateFirstRunMatrix(matrix, contract) {
  if (matrix.active_shell !== contract.active_shell || matrix.shell_root !== contract.shell_root) {
    throw new Error('First-run matrix must target the active shell contract');
  }
  if (!Array.isArray(matrix.scenarios) || matrix.scenarios.length === 0) {
    throw new Error('First-run matrix must declare scenarios');
  }
  for (const scenario of matrix.scenarios) {
    if (!scenario.id || !scenario.package_type || !Array.isArray(scenario.expects) || scenario.expects.length === 0) {
      throw new Error(`Invalid first-run scenario: ${JSON.stringify(scenario)}`);
    }
  }
}

function validateProductProfile(profile) {
  if (profile.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected product profile owner: ${profile.owner}`);
  }
  if (profile.purpose !== 'app_owned_product_profile') {
    throw new Error(`Unexpected product profile purpose: ${profile.purpose}`);
  }
  if (profile.app_repo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`Unexpected product profile repo: ${profile.app_repo}`);
  }
  for (const [label, expected] of Object.entries({
    active_shell: contractPath,
    page_state: pageStateMatrixPath,
    first_run: firstRunMatrixPath,
  })) {
    const value = profile.contract_refs?.[label];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Product profile missing contract_refs.${label}`);
    }
    assertFile(path.join(root, value), `product profile ${label} contract ref`);
    if (path.resolve(root, value) !== path.resolve(expected)) {
      throw new Error(`Unexpected product profile contract_refs.${label}: ${value}`);
    }
  }
  if (profile.default_session_profile?.executor !== 'codex_cli') {
    throw new Error(`Unexpected product profile executor: ${profile.default_session_profile?.executor}`);
  }
  if (profile.default_session_profile?.model !== profile.codex?.default_model) {
    throw new Error('Product profile default_session_profile.model must match codex.default_model');
  }
  if (profile.default_session_profile?.reasoning_effort !== profile.codex?.default_reasoning_effort) {
    throw new Error('Product profile default_session_profile.reasoning_effort must match codex.default_reasoning_effort');
  }
  if (!Array.isArray(profile.codex?.default_visible_skills) || !profile.codex.default_visible_skills.includes('mineru-document-extractor')) {
    throw new Error('Product profile must include mineru-document-extractor as a default visible skill');
  }
  if (!Array.isArray(profile.codex?.default_visible_skills) || !profile.codex.default_visible_skills.includes('ui-ux-pro-max')) {
    throw new Error('Product profile must include ui-ux-pro-max as a default visible skill');
  }
  for (const forbidden of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    if (!profile.boundary?.app_does_not_own?.includes(forbidden)) {
      throw new Error(`Product profile boundary must exclude ${forbidden}`);
    }
  }
}

function runCommand(entry) {
  const cwd = path.join(root, entry.cwd);
  console.log(`\n==> ${entry.id}: ${entry.command}`);
  const result = spawnSync(entry.command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Validation command failed: ${entry.id}`);
  }
}

const args = parseArgs(process.argv);
const contract = readJson(contractPath);
const pageStateMatrix = readJson(pageStateMatrixPath);
const firstRunMatrix = readJson(firstRunMatrixPath);
validateContractShape(contract);
validatePageStateMatrix(pageStateMatrix, contract);
validateFirstRunMatrix(firstRunMatrix, contract);
validateProductProfile(readJson(productProfilePath));
validateReleaseEvidenceBundle(readJson(releaseChannelPath), pageStateMatrix, firstRunMatrix);

if (args.quick) {
  console.log('Active shell contract is structurally valid.');
  process.exit(0);
}

const commands = contract.validation_commands.filter((entry) => args.only.size === 0 || args.only.has(entry.id));
if (commands.length === 0) {
  throw new Error(`No validation commands selected by --only=${[...args.only].join(',')}`);
}

for (const command of commands) {
  runCommand(command);
}

console.log('\nActive shell validation passed.');
