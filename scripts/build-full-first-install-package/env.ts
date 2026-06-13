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

function defaultOptions() {
  return {
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
}

const booleanOptionSetters = new Map([
  ['--skip-gui-build', (parsed) => { parsed.skipGuiBuild = true; }],
  ['--split-runtime', (parsed) => { parsed.splitRuntime = true; }],
  ['--reuse-gui-vite-output', (parsed) => { parsed.reuseGuiViteOutput = true; }],
  ['--print-runtime-cache-keys', (parsed) => { parsed.printRuntimeCacheKeys = true; }],
  ['--include-bun-runtime', (parsed) => { parsed.includeBunRuntime = true; }],
]);

const valueOptionSetters = new Map([
  ['--version', (parsed, value) => { parsed.version = value; }],
  ['--out-dir', (parsed, value) => { parsed.outDir = path.resolve(value); }],
  ['--framework-root', (parsed, value) => { parsed.frameworkRoot = path.resolve(value); }],
  ['--opl-root', (parsed, value) => { parsed.frameworkRoot = path.resolve(value); }],
  ['--gui-root', (parsed, value) => { parsed.guiRoot = path.resolve(value); }],
  ['--mas-root', (parsed, value) => { parsed.masRoot = path.resolve(value); }],
  ['--mag-root', (parsed, value) => { parsed.magRoot = path.resolve(value); }],
  ['--rca-root', (parsed, value) => { parsed.rcaRoot = path.resolve(value); }],
  ['--meta-agent-root', (parsed, value) => { parsed.metaAgentRoot = path.resolve(value); }],
  ['--superpowers-root', (parsed, value) => { parsed.superpowersRoot = path.resolve(value); }],
  ['--codex-root', (parsed, value) => { parsed.codexRoot = path.resolve(value); }],
  ['--node-bin', (parsed, value) => { parsed.nodeBin = path.resolve(value); }],
  ['--bun-bin', (parsed, value) => { parsed.bunBin = path.resolve(value); }],
  ['--uv-bin', (parsed, value) => { parsed.uvBin = path.resolve(value); }],
  ['--temporal-cli-bin', (parsed, value) => { parsed.temporalCliBin = path.resolve(value); }],
  ['--temporal-cli-archive', (parsed, value) => { parsed.temporalCliArchive = path.resolve(value); }],
  ['--python-root', (parsed, value) => { parsed.pythonRoot = path.resolve(value); }],
  ['--officecli-bin', (parsed, value) => { parsed.officeCliBin = path.resolve(value); }],
  ['--officecli-root', (parsed, value) => { parsed.officeCliRoot = path.resolve(value); }],
  ['--mineru-open-api-bin', (parsed, value) => { parsed.mineruOpenApiBin = path.resolve(value); }],
  ['--mineru-root', (parsed, value) => { parsed.mineruRoot = path.resolve(value); }],
  ['--mineru-document-extractor-root', (parsed, value) => {
    parsed.mineruDocumentExtractorRoot = path.resolve(value);
  }],
  ['--ui-ux-pro-max-root', (parsed, value) => { parsed.uiUxProMaxRoot = path.resolve(value); }],
  ['--runtime-cache-dir', (parsed, value) => { parsed.runtimeCacheDir = path.resolve(value); }],
  ['--runtime-cache-mode', (parsed, value) => { parsed.runtimeCacheMode = value; }],
]);

function applyBooleanOption(parsed, token) {
  const apply = booleanOptionSetters.get(token);
  if (!apply) {
    return false;
  }
  apply(parsed);
  return true;
}

function valueAfter(argv, index, token) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${token}`);
  }
  return value;
}

function applyValueOption(parsed, token, value) {
  const apply = valueOptionSetters.get(token);
  if (!apply) {
    throw new Error(`Unknown argument: ${token}`);
  }
  apply(parsed, value);
}

export function parseArgs(argv) {
  const parsed = defaultOptions();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (applyBooleanOption(parsed, token)) {
      continue;
    }

    applyValueOption(parsed, token, valueAfter(argv, index, token));
    index += 1;
  }

  if (!['readwrite', 'readonly', 'off'].includes(parsed.runtimeCacheMode)) {
    throw new Error(`Unsupported runtime cache mode: ${parsed.runtimeCacheMode}`);
  }

  return parsed;
}
