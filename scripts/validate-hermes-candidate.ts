#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { readAppShellAdapterContract } from './app-shell-adapter.ts';
import { readJson, registryPath, root } from './validate-shell-candidates/shared.ts';
import type { ShellCandidateRegistry } from './validate-shell-candidates/types.ts';

const hermesAdapter = 'contracts/shell-adapters/hermes-codex.json';
const repoLocalCheckout = 'shells/hermes';
const siblingCheckout = '../opl-hermes-shell';
const requiredWrapperFiles = [
  'package.json',
  'AGENTS.md',
  'README.md',
  'UPSTREAM_README.md',
  'electron/main.cjs',
  'electron/opl-codex-gateway.cjs',
  'scripts/package-opl-candidate-app.cjs',
  'scripts/validate-hermes-codex-candidate.cjs',
];

function pathExists(repoRelativePath: string): boolean {
  return fs.existsSync(path.resolve(root, repoRelativePath));
}

function missingWrapperFiles(checkoutPath: string): string[] {
  return requiredWrapperFiles.filter((relativePath) => !pathExists(path.join(checkoutPath, relativePath)));
}

function resolveHermesCheckout(): { status: 'available'; path: string } | { status: 'blocked'; checkoutPath: string | null; blockers: string[] } {
  if (pathExists(repoLocalCheckout)) {
    const missing = missingWrapperFiles(repoLocalCheckout);
    return missing.length === 0
      ? { status: 'available', path: repoLocalCheckout }
      : {
        status: 'blocked',
        checkoutPath: repoLocalCheckout,
        blockers: missing.map((relativePath) => `missing_wrapper_file:${repoLocalCheckout}/${relativePath}`),
      };
  }
  if (pathExists(siblingCheckout)) {
    const missing = missingWrapperFiles(siblingCheckout);
    return missing.length === 0
      ? { status: 'available', path: siblingCheckout }
      : {
        status: 'blocked',
        checkoutPath: siblingCheckout,
        blockers: missing.map((relativePath) => `missing_wrapper_file:${siblingCheckout}/${relativePath}`),
      };
  }
  return {
    status: 'blocked',
    checkoutPath: null,
    blockers: [
      'missing_shell_checkout:shells/hermes',
      'missing_shell_checkout:../opl-hermes-shell',
    ],
  };
}

function main(): void {
  const registry = readJson<ShellCandidateRegistry>(registryPath);
  const candidate = registry.candidates.find((entry) => entry.id === 'hermes-codex');
  if (!candidate) {
    throw new Error('Hermes candidate is not declared in contracts/app-shell-candidates.json');
  }
  if (candidate.adapter_contract !== hermesAdapter) {
    throw new Error(`Hermes candidate adapter_contract must be ${hermesAdapter}`);
  }
  const adapter = readAppShellAdapterContract(path.join(root, hermesAdapter));
  if (adapter.active_shell !== 'hermes-codex') {
    throw new Error('Hermes adapter active_shell must be hermes-codex');
  }
  if (adapter.shell_source.owner_repo !== 'NousResearch/hermes-agent') {
    throw new Error('Hermes adapter source must be NousResearch/hermes-agent');
  }
  if (adapter.shell_source.upstream_ref !== 'apps/desktop') {
    throw new Error('Hermes adapter upstream_ref must be apps/desktop');
  }
  if (adapter.release_role !== 'experimental_candidate_shell') {
    throw new Error('Hermes adapter must remain an experimental candidate shell');
  }
  if (adapter.candidate_stage !== 'upstream_feature_comparison_minimal_opl_adapter') {
    throw new Error('Hermes adapter must remain at minimal OPL adapter stage until feature comparison is recorded');
  }
  if (!adapter.shell_contract.capabilities.includes('upstream_hermes_desktop_feature_baseline_preserved')) {
    throw new Error('Hermes adapter must declare upstream Hermes Desktop feature baseline preservation');
  }
  if (!adapter.shell_contract.capabilities.includes('codex_cli_candidate_backend_adapter')) {
    throw new Error('Hermes adapter must declare the Codex CLI candidate backend adapter');
  }
  if (!adapter.deferred_until_feature_comparison?.surfaces?.includes('opl_app_state_action_bridge')) {
    throw new Error('Hermes adapter must defer OPL app state/action bridge until Hermes feature comparison is recorded');
  }

  const checkout = resolveHermesCheckout();
  console.log(JSON.stringify({
    status: checkout.status === 'available' ? 'hermes_candidate_contract_valid' : 'hermes_candidate_blocked',
    candidate: candidate.id,
    adapter_contract: hermesAdapter,
    source: 'NousResearch/hermes-agent apps/desktop',
    license: 'MIT',
    active_shell_unchanged: registry.active_shell_unchanged,
    candidate_root: candidate.candidate_root,
    selectable_adapter_build_command: `OPL_APP_SHELL_ADAPTER_CONTRACT=${hermesAdapter} npm run package`,
    sibling_checkout_build_command: `OPL_APP_SHELL_ROOT=${siblingCheckout} OPL_APP_SHELL_ADAPTER_CONTRACT=${hermesAdapter} npm run package`,
    checkout_path: checkout.status === 'available' ? checkout.path : checkout.checkoutPath,
    blockers: checkout.status === 'blocked' ? checkout.blockers : [],
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
