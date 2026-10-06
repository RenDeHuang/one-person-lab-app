import path from 'node:path';
import { resolveActiveShellPaths } from '../app-shell-adapter.ts';
import { isGitCheckout } from '../active-shell-checkout.ts';
import { assertFile, root } from './validation-config.ts';
import {
  validateGuiAuthority,
  validateGuiProductContractPolicy,
  validateShellContractCapabilities,
  validateShellReplacementPolicy,
  validateStateSurfaceContract,
  validateValidationCommands,
} from './active-shell-boundary-validators.ts';

export function resolveValidationCwd(entry, contract, shellPaths) {
  if (entry.cwd === contract.shell_root) {
    return shellPaths.shellRoot;
  }
  return path.join(root, entry.cwd);
}

export function isDefaultReleaseAdapter(contract) {
  return contract.active_shell === 'opl-studio' && contract.shell_root === 'shells/opl-studio' && !contract.candidate_shell;
}

export function validateContractShape(contract) {
  if (contract.app_repo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`Unexpected app_repo: ${contract.app_repo}`);
  }
  if (contract.shell_source?.history_policy !== 'external_checkout_not_merged_into_app_default_branch') {
    throw new Error(`Unexpected shell history policy: ${contract.shell_source?.history_policy}`);
  }
  if (contract.runtime_bridge_contract !== 'contracts/app-runtime-bridge.json') {
    throw new Error(`Unexpected runtime bridge contract ref: ${contract.runtime_bridge_contract}`);
  }
  const defaultReleaseAdapter = isDefaultReleaseAdapter(contract);
  validateGuiAuthority(contract, defaultReleaseAdapter);
  validateShellReplacementPolicy(contract);
  validateShellContractCapabilities(contract);
  validateGuiProductContractPolicy(contract);
  validateStateSurfaceContract(contract);

  const shellPaths = resolveActiveShellPaths({ contract });
  assertFile(shellPaths.shellRoot, 'active shell root');
  if (!isGitCheckout(shellPaths.shellRoot)) {
    throw new Error(
      `Active shell root ${shellPaths.shellRootForDisplay} must be a standalone Git checkout; archive snapshots are valid only for isolated consumer projections.`,
    );
  }
  assertFile(shellPaths.packageManifestPath, 'active shell package.json');
  assertFile(shellPaths.agentsGuidePath, 'active shell AGENTS.md');
  if (defaultReleaseAdapter && contract.active_shell === 'opl-studio') {
    assertFile(shellPaths.electronBuilderConfigPath, 'active Studio Stable electron-builder config');
    assertFile(shellPaths.desktopReleaseCarrierManifestPath, 'active Studio Stable carrier manifest');
  }
  validateValidationCommands(contract, shellPaths, resolveValidationCwd);
}
