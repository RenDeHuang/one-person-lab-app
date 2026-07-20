#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAppRootBoundary } from './app-root-boundary.ts';
import { validateReleaseContractPolicies } from './validate-release-boundary/release-contract-policy.ts';
import { validateReleaseBoundaryScriptDependencies } from './validate-release-boundary/script-dependencies.ts';
import { validateActionsCachePolicy } from './validate-release-boundary/actions-cache-policy.ts';
import {
  runReleaseBoundaryTextChecks,
  validateStableReleaseActionPinPolicy,
  validateWorkflowDispatchWriteAuthority,
  validateWorkflowNode24Policy,
} from './validate-release-boundary/text-check-runner.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
try {
  assertAppRootBoundary({ phase: 'release boundary validation' });
} catch (error) {
  console.error(`FAIL app_root_boundary: ${error instanceof Error ? error.message : String(error)}`);
  failures += 1;
}

failures += runReleaseBoundaryTextChecks(appRoot);
failures += validateWorkflowNode24Policy(appRoot);
failures += validateStableReleaseActionPinPolicy(appRoot);
failures += validateWorkflowDispatchWriteAuthority(appRoot);
failures += validateActionsCachePolicy(appRoot);
failures += validateReleaseBoundaryScriptDependencies(appRoot);
failures += validateReleaseContractPolicies(appRoot);

if (failures > 0) {
  process.exit(1);
}

console.log('PASS: App release boundary is App-owned, Actions caches are reusable and bounded, agent installation is contract-validated, and release workflows force JavaScript actions onto Node 24.');
