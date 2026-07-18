import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const guiProductContractPath = path.join(root, 'contracts', 'app-gui-product-contract.json');
export const runtimeBridgePath = path.join(root, 'contracts', 'app-runtime-bridge.json');
export const pageStateMatrixPath = path.join(root, 'contracts', 'app-page-state-matrix.json');
export const firstRunMatrixPath = path.join(root, 'contracts', 'app-first-run-test-matrix.json');
export const firstRunCompiledExpectationsPath = path.join(root, 'contracts', 'app-first-run-compiled-expectations.json');
export const productProfilePath = path.join(root, 'contracts', 'app-product-profile.json');
export const settingsControlPlanePath = path.join(root, 'contracts', 'app-settings-control-plane.json');
export const installExposurePolicyPath = path.join(root, 'contracts', 'app-install-exposure-policy.json');
export const releaseChannelPath = path.join(root, 'contracts', 'app-release-channel.json');
export const defaultActiveShellContractPath = path.join(root, 'contracts', 'app-shell-adapter.json');
export const commandMaxBuffer = 128 * 1024 * 1024;

export function parseArgs(argv) {
  const parsed = { quick: false, only: new Set() };
  const { tokens } = parseNodeArgs({
    args: argv.slice(2),
    options: {
      quick: { type: 'boolean' },
      only: { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
    tokens: true,
  });

  for (const token of tokens) {
    if (token.kind === 'positional') {
      throw new Error(`Unknown argument: ${token.value}`);
    }
    if (token.inlineValue) {
      throw new Error(`Unknown argument: ${token.rawName}=${token.value ?? ''}`);
    }
    if (token.name === 'quick') {
      parsed.quick = true;
      continue;
    }
    if (token.name === 'only') {
      if (!token.value || token.value.startsWith('--')) throw new Error('Missing value for --only');
      for (const id of token.value.split(',').map((entry) => entry.trim()).filter(Boolean)) {
        parsed.only.add(id);
      }
      continue;
    }
    throw new Error(`Unknown argument: ${token.rawName}`);
  }
  return parsed;
}

export function assertFile(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${path.relative(root, filePath)}`);
  }
}
