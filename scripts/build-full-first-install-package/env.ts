import os from 'node:os';
import path from 'node:path';

import {
  FULL_FIRST_INSTALL_OUTPUT_DIR,
  FULL_RELEASE_OUTPUT_DIR,
} from '../full-first-install-package.ts';
import { resolveActiveShellPaths } from '../app-shell-adapter.ts';
import { appRepoRoot, workspaceRoot } from './paths.ts';

function defaultRuntimeCacheDir() {
  if (process.env.OPL_FULL_RUNTIME_CACHE_DIR?.trim()) {
    return process.env.OPL_FULL_RUNTIME_CACHE_DIR;
  }
  return path.join(os.homedir(), 'Library', 'Caches', 'One Person Lab', 'full-runtime-layers');
}

export function parseArgs(argv) {
  const parsed = {
    version: process.env.OPL_RELEASE_VERSION || '26.5.1',
    outDir: process.env.CI === 'true'
      ? path.join(appRepoRoot, FULL_RELEASE_OUTPUT_DIR)
      : FULL_FIRST_INSTALL_OUTPUT_DIR,
    frameworkRoot: process.env.OPL_FRAMEWORK_ROOT
      || process.env.OPL_FULL_OPL_ROOT
      || path.join(workspaceRoot, 'one-person-lab'),
    guiRoot: process.env.OPL_FULL_GUI_ROOT || resolveActiveShellPaths().shellRoot,
    masRoot: process.env.OPL_FULL_MAS_ROOT || path.join(workspaceRoot, 'med-autoscience'),
    magRoot: process.env.OPL_FULL_MAG_ROOT || path.join(workspaceRoot, 'med-autogrant'),
    rcaRoot: process.env.OPL_FULL_RCA_ROOT || path.join(workspaceRoot, 'redcube-ai'),
    metaAgentRoot: process.env.OPL_FULL_META_AGENT_ROOT || path.join(workspaceRoot, 'opl-meta-agent'),
    superpowersRoot: process.env.OPL_FULL_SUPERPOWERS_ROOT || path.join(os.homedir(), '.codex', 'superpowers'),
    codexRoot: process.env.OPL_FULL_CODEX_ROOT || '',
    nodeBin: process.env.OPL_FULL_NODE_BIN || '',
    bunBin: process.env.OPL_FULL_BUN_BIN || '',
    includeBunRuntime: process.env.OPL_FULL_INCLUDE_BUN_RUNTIME === '1',
    uvBin: process.env.OPL_FULL_UV_BIN || path.join(os.homedir(), '.local', 'bin', 'uv'),
    temporalCliBin: process.env.OPL_FULL_TEMPORAL_CLI_BIN || '',
    temporalCliArchive: process.env.OPL_FULL_TEMPORAL_CLI_ARCHIVE || '',
    pythonRoot: process.env.OPL_FULL_PYTHON_ROOT || '',
    officeCliBin: process.env.OPL_FULL_OFFICECLI_BIN || '',
    officeCliRoot: process.env.OPL_FULL_OFFICECLI_ROOT || path.join(workspaceRoot, 'OfficeCLI'),
    mineruOpenApiBin: process.env.OPL_FULL_MINERU_OPEN_API_BIN || '',
    mineruRoot: process.env.OPL_FULL_MINERU_ROOT || path.join(workspaceRoot, 'MinerU-Ecosystem'),
    mineruDocumentExtractorRoot: process.env.OPL_FULL_MINERU_DOCUMENT_EXTRACTOR_ROOT
      || path.join(appRepoRoot, 'assets', 'companion-skills', 'mineru-document-extractor'),
    uiUxProMaxRoot: process.env.OPL_FULL_UI_UX_PRO_MAX_ROOT || path.join(workspaceRoot, 'ui-ux-pro-max-skill'),
    skipGuiBuild: false,
    splitRuntime: process.env.OPL_FULL_SPLIT_RUNTIME === '1',
    reuseGuiViteOutput: process.env.OPL_FULL_REUSE_GUI_VITE_OUTPUT === '1',
    runtimeCacheDir: defaultRuntimeCacheDir(),
    runtimeCacheMode: process.env.OPL_FULL_RUNTIME_CACHE_MODE || 'readwrite',
    printRuntimeCacheKeys: false,
    frameworkRef: process.env.OPL_FULL_FRAMEWORK_REF || process.env.OPL_FRAMEWORK_REF || null,
    masRef: process.env.OPL_FULL_MAS_REF || 'main',
    magRef: process.env.OPL_FULL_MAG_REF || 'main',
    rcaRef: process.env.OPL_FULL_RCA_REF || 'main',
    metaAgentRef: process.env.OPL_FULL_META_AGENT_REF || 'main',
    superpowersRef: process.env.OPL_FULL_SUPERPOWERS_REF || 'main',
    officeCliRef: process.env.OPL_FULL_OFFICECLI_REF || 'main',
    mineruRef: process.env.OPL_FULL_MINERU_REF || 'main',
    uiUxProMaxRef: process.env.OPL_FULL_UI_UX_PRO_MAX_REF || 'main',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--skip-gui-build') {
      parsed.skipGuiBuild = true;
      continue;
    }
    if (token === '--split-runtime') {
      parsed.splitRuntime = true;
      continue;
    }
    if (token === '--reuse-gui-vite-output') {
      parsed.reuseGuiViteOutput = true;
      continue;
    }
    if (token === '--print-runtime-cache-keys') {
      parsed.printRuntimeCacheKeys = true;
      continue;
    }
    if (token === '--include-bun-runtime') {
      parsed.includeBunRuntime = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    index += 1;
    if (token === '--version') parsed.version = value;
    else if (token === '--out-dir') parsed.outDir = path.resolve(value);
    else if (token === '--framework-root' || token === '--opl-root') parsed.frameworkRoot = path.resolve(value);
    else if (token === '--gui-root') parsed.guiRoot = path.resolve(value);
    else if (token === '--mas-root') parsed.masRoot = path.resolve(value);
    else if (token === '--mag-root') parsed.magRoot = path.resolve(value);
    else if (token === '--rca-root') parsed.rcaRoot = path.resolve(value);
    else if (token === '--meta-agent-root') parsed.metaAgentRoot = path.resolve(value);
    else if (token === '--superpowers-root') parsed.superpowersRoot = path.resolve(value);
    else if (token === '--codex-root') parsed.codexRoot = path.resolve(value);
    else if (token === '--node-bin') parsed.nodeBin = path.resolve(value);
    else if (token === '--bun-bin') parsed.bunBin = path.resolve(value);
    else if (token === '--uv-bin') parsed.uvBin = path.resolve(value);
    else if (token === '--temporal-cli-bin') parsed.temporalCliBin = path.resolve(value);
    else if (token === '--temporal-cli-archive') parsed.temporalCliArchive = path.resolve(value);
    else if (token === '--python-root') parsed.pythonRoot = path.resolve(value);
    else if (token === '--officecli-bin') parsed.officeCliBin = path.resolve(value);
    else if (token === '--officecli-root') parsed.officeCliRoot = path.resolve(value);
    else if (token === '--mineru-open-api-bin') parsed.mineruOpenApiBin = path.resolve(value);
    else if (token === '--mineru-root') parsed.mineruRoot = path.resolve(value);
    else if (token === '--mineru-document-extractor-root') parsed.mineruDocumentExtractorRoot = path.resolve(value);
    else if (token === '--ui-ux-pro-max-root') parsed.uiUxProMaxRoot = path.resolve(value);
    else if (token === '--runtime-cache-dir') parsed.runtimeCacheDir = path.resolve(value);
    else if (token === '--runtime-cache-mode') parsed.runtimeCacheMode = value;
    else throw new Error(`Unknown argument: ${token}`);
  }

  if (!['readwrite', 'readonly', 'off'].includes(parsed.runtimeCacheMode)) {
    throw new Error(`Unsupported runtime cache mode: ${parsed.runtimeCacheMode}`);
  }

  return parsed;
}
