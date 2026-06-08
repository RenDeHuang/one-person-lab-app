import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { CODEX_MACOS_ARM64_TARGET } from './paths.ts';
import { requirePath } from './filesystem.ts';
import { findExecutable } from './process.ts';

function findCompanionBinary(input) {
  const candidates = [
    input.explicitBin,
    input.envBin,
    findExecutable(input.name) || '',
    path.join(os.homedir(), '.local', 'bin', input.name),
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!found) {
    throw new Error(`${input.name} binary not found. Install ${input.name} or pass ${input.flagName} / set ${input.envName}.`);
  }
  return found;
}

function findOfficeCliBinary(explicitBin) {
  return findCompanionBinary({
    name: 'officecli',
    explicitBin,
    envBin: process.env.OPL_OFFICECLI_BIN || '',
    flagName: '--officecli-bin',
    envName: 'OPL_FULL_OFFICECLI_BIN',
  });
}

function findMineruOpenApiBinary(explicitBin) {
  return findCompanionBinary({
    name: 'mineru-open-api',
    explicitBin,
    envBin: process.env.OPL_MINERU_OPEN_API_BIN || '',
    flagName: '--mineru-open-api-bin',
    envName: 'OPL_FULL_MINERU_OPEN_API_BIN',
  });
}

export function findTemporalCliBinary(explicitBin) {
  return findCompanionBinary({
    name: 'temporal',
    explicitBin,
    envBin: process.env.OPL_TEMPORAL_CLI_BIN || '',
    flagName: '--temporal-cli-bin',
    envName: 'OPL_FULL_TEMPORAL_CLI_BIN',
  });
}

export function findTemporalCliArchive(explicitArchive) {
  return requirePath(explicitArchive || process.env.OPL_FULL_TEMPORAL_CLI_ARCHIVE || '', 'Temporal CLI archive');
}

function findCodexRoot(explicitRoot) {
  const candidates = [
    explicitRoot,
    path.join(os.homedir(), '.nvm', 'versions', 'node', 'v22.16.0', 'lib', 'node_modules', '@openai', 'codex'),
    path.join(os.homedir(), '.bun', 'install', 'global', 'node_modules', '@openai', 'codex'),
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'package.json')));
  if (!found) {
    throw new Error('Codex package root not found. Pass --codex-root or set OPL_FULL_CODEX_ROOT.');
  }
  return found;
}

function findCodexBinary(codexRoot) {
  const scopedPackageRoot = path.dirname(codexRoot);
  const siblingPlatformVendorRoot = path.join(
    scopedPackageRoot,
    'codex-darwin-arm64',
    'vendor',
    CODEX_MACOS_ARM64_TARGET,
  );
  const platformVendorRoot = path.join(
    codexRoot,
    'node_modules',
    '@openai',
    'codex-darwin-arm64',
    'vendor',
    CODEX_MACOS_ARM64_TARGET,
  );
  const localVendorRoot = path.join(codexRoot, 'vendor', CODEX_MACOS_ARM64_TARGET);
  const vendorRoots = [siblingPlatformVendorRoot, platformVendorRoot, localVendorRoot];
  const requireFirstPath = (candidates, label) => {
    const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!found) {
      throw new Error(`${label} not found. Checked:\n${candidates.map((candidate) => `  - ${candidate}`).join('\n')}`);
    }
    return found;
  };
  const codexCandidatesForVendorRoot = (vendorRoot) => [
    path.join(vendorRoot, 'bin', 'codex'),
    path.join(vendorRoot, 'codex', 'codex'),
  ];
  const rgCandidatesForVendorRoot = (vendorRoot) => [
    path.join(vendorRoot, 'codex-path', 'rg'),
    path.join(vendorRoot, 'path', 'rg'),
  ];
  const hasAnyFile = (candidates) => candidates.some((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  const requireFirstVendorRoot = () => {
    const found = vendorRoots.find((vendorRoot) => {
      return hasAnyFile(codexCandidatesForVendorRoot(vendorRoot))
        && hasAnyFile(rgCandidatesForVendorRoot(vendorRoot));
    });
    if (!found) {
      throw new Error(`Codex darwin-arm64 vendor root not found. Checked:\n${vendorRoots.map((candidate) => `  - ${candidate}`).join('\n')}`);
    }
    return found;
  };
  const vendorRoot = requireFirstVendorRoot();
  return {
    vendorRoot,
    codex: requireFirstPath(codexCandidatesForVendorRoot(vendorRoot), 'Codex darwin-arm64 binary'),
    rg: requireFirstPath(rgCandidatesForVendorRoot(vendorRoot), 'Codex bundled rg'),
  };
}

function requireNodeToolchainFile(nodeBinDir, name) {
  const filePath = path.join(nodeBinDir, name);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Node toolchain file not found: ${filePath}`);
  }
  return filePath;
}

function requireNodeToolchainDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
    throw new Error(`Node toolchain directory not found: ${directoryPath}`);
  }
  return directoryPath;
}

function findNodeToolchain(explicitNodeBin) {
  const candidates = [
    explicitNodeBin,
    path.join(os.homedir(), '.nvm', 'versions', 'node', 'v22.16.0', 'bin', 'node'),
    process.execPath,
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!found) {
    throw new Error('Node binary not found. Pass --node-bin or set OPL_FULL_NODE_BIN.');
  }
  const nodeBin = found;
  const nodeBinDir = path.dirname(nodeBin);
  const nodeRoot = path.dirname(nodeBinDir);
  return {
    nodeBin,
    npmBin: requireNodeToolchainFile(nodeBinDir, 'npm'),
    npxBin: requireNodeToolchainFile(nodeBinDir, 'npx'),
    npmRoot: requireNodeToolchainDirectory(path.join(nodeRoot, 'lib', 'node_modules', 'npm')),
  };
}

export function findBunBinary(explicitBunBin) {
  const candidates = [
    explicitBunBin,
    findExecutable('bun') || '',
    path.join(os.homedir(), '.bun', 'bin', 'bun'),
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!found) {
    throw new Error('Bun binary not found. Pass --bun-bin or set OPL_FULL_BUN_BIN.');
  }
  return found;
}

function findPythonRoot(explicitPythonRoot) {
  if (explicitPythonRoot) {
    return requirePath(explicitPythonRoot, 'Python root');
  }

  const uvPythonRoot = path.join(os.homedir(), '.local', 'share', 'uv', 'python');
  const candidates = fs.existsSync(uvPythonRoot)
    ? fs.readdirSync(uvPythonRoot)
        .filter((entry) => /^cpython-3\.12\..*-macos-aarch64-none$/.test(entry))
        .sort()
        .reverse()
        .map((entry) => path.join(uvPythonRoot, entry))
    : [];
  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'bin', 'python3')));
  if (!found) {
    throw new Error('uv-managed Python 3.12 arm64 root not found. Pass --python-root or set OPL_FULL_PYTHON_ROOT.');
  }
  return found;
}

export function resolveRuntimeSources(options) {
  const codexRoot = findCodexRoot(options.codexRoot);
  const codexBinaries = findCodexBinary(codexRoot);
  const nodeToolchain = findNodeToolchain(options.nodeBin);
  const bunBin = options.includeBunRuntime ? findBunBinary(options.bunBin) : null;
  const pythonRoot = findPythonRoot(options.pythonRoot);
  const uvBin = requirePath(options.uvBin, 'uv binary');
  const temporalCliBin = findTemporalCliBinary(options.temporalCliBin);
  const temporalCliArchive = findTemporalCliArchive(options.temporalCliArchive);
  const officeCliBin = findOfficeCliBinary(options.officeCliBin);
  const mineruOpenApiBin = findMineruOpenApiBinary(options.mineruOpenApiBin);

  return {
    codexRoot,
    codexBinaries,
    nodeToolchain,
    bunBin,
    pythonRoot,
    uvBin,
    temporalCliBin,
    temporalCliArchive,
    officeCliBin,
    mineruOpenApiBin,
    mineruRepoRoot: fs.existsSync(path.join(options.mineruRoot, '.git')) ? options.mineruRoot : null,
  };
}
