import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const guiProductContractPath = path.join(root, 'contracts', 'app-gui-product-contract.json');
export const runtimeBridgePath = path.join(root, 'contracts', 'app-runtime-bridge.json');
export const pageStateMatrixPath = path.join(root, 'contracts', 'app-page-state-matrix.json');
export const firstRunMatrixPath = path.join(root, 'contracts', 'app-first-run-test-matrix.json');
export const productProfilePath = path.join(root, 'contracts', 'app-product-profile.json');
export const settingsControlPlanePath = path.join(root, 'contracts', 'app-settings-control-plane.json');
export const installExposurePolicyPath = path.join(root, 'contracts', 'app-install-exposure-policy.json');
export const releaseChannelPath = path.join(root, 'contracts', 'app-release-channel.json');
export const defaultActiveShellContractPath = path.join(root, 'contracts', 'app-shell-adapter.json');
export const commandMaxBuffer = 128 * 1024 * 1024;

export function parseArgs(argv) {
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

export function assertFile(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${path.relative(root, filePath)}`);
  }
}
