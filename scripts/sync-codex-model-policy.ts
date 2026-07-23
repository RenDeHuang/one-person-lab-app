import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  projectCodexModelPolicyContracts,
  type CodexModelPolicyContractBundle,
} from './app-product-profile/codex-model-policy-projection.ts';
import { appRoot } from './app-product-profile/paths.ts';
import { readOplFlowCapabilityPolicy } from './opl-flow-capability-policy.ts';

const contractPaths = {
  productProfile: 'contracts/app-product-profile.json',
  guiProductContract: 'contracts/app-gui-product-contract.json',
  pageStateMatrix: 'contracts/app-page-state-matrix.json',
} as const;

function readOplFlowConfiguredDefault(): { model: string; reasoning_effort: string } {
  const policyPath = process.env.OPL_FLOW_WORKFLOW_POLICY?.trim()
    || path.resolve(appRoot, '..', 'opl-flow', 'contracts', 'workflow-policy.json');
  const policy = readOplFlowCapabilityPolicy(policyPath);
  if (policy.codex_model_policy?.authority !== 'opl-flow') {
    throw new Error(`Invalid OPL Flow model policy: ${policyPath}`);
  }
  return policy.codex_model_policy.configured_default;
}

function applyOplFlowSource(bundle: CodexModelPolicyContractBundle): CodexModelPolicyContractBundle {
  const next = structuredClone(bundle);
  next.productProfile.codex.auto_model_policy.configured_default = readOplFlowConfiguredDefault();
  return next;
}

function readBundle(): CodexModelPolicyContractBundle {
  return Object.fromEntries(Object.entries(contractPaths).map(([key, relativePath]) => [
    key,
    JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8')),
  ])) as CodexModelPolicyContractBundle;
}

function writeBundle(bundle: CodexModelPolicyContractBundle): string[] {
  const changed: string[] = [];
  for (const [key, relativePath] of Object.entries(contractPaths)) {
    const targetPath = path.join(appRoot, relativePath);
    const currentText = fs.readFileSync(targetPath, 'utf8');
    const nextValue = bundle[key as keyof CodexModelPolicyContractBundle];
    if (JSON.stringify(JSON.parse(currentText)) !== JSON.stringify(nextValue)) {
      const next = `${JSON.stringify(nextValue, null, 2)}\n`;
      fs.writeFileSync(targetPath, next, 'utf8');
      changed.push(relativePath);
    }
  }
  return changed;
}

function main(): void {
  const current = readBundle();
  const projected = projectCodexModelPolicyContracts(applyOplFlowSource(current));
  const checkOnly = process.argv.includes('--check');
  if (checkOnly) {
    if (JSON.stringify(current) !== JSON.stringify(projected)) {
      throw new Error('Codex model policy projections are stale; run npm run codex:model-policy:sync');
    }
    console.log(JSON.stringify({
      status: 'current',
      authority: 'gaofeng21cn/opl-flow:contracts/workflow-policy.json#codex_model_policy.configured_default',
      projection: contractPaths.productProfile,
    }, null, 2));
    return;
  }
  console.log(JSON.stringify({
    status: 'synced',
    authority: 'gaofeng21cn/opl-flow:contracts/workflow-policy.json#codex_model_policy.configured_default',
    changed: writeBundle(projected),
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
