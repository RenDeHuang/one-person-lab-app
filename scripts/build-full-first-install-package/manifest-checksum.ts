import fs from 'node:fs';
import path from 'node:path';

import { buildFullPackageManifest } from '../full-first-install-package.ts';
import { FULL_RUNTIME_CACHE_LAYER_TAXONOMY } from '../full-first-install-package.ts';
import { directorySizeBytes } from './filesystem.ts';
import { readGitHead, readGitOriginUrl } from './git.ts';
import { packageJsonVersion } from './hashing.ts';
import { run } from './process.ts';
import { collectRuntimeAssertions } from './runtime-layers.ts';

export function buildResolvedFullPayloadRefs(options, sources, components) {
  const mineruRepoRoot = sources.mineruRepoRoot || options.mineruRoot;
  return {
    opl_framework: {
      label: 'OPL Framework',
      source_path: options.frameworkRoot,
      repository: readGitOriginUrl(options.frameworkRoot) || 'gaofeng21cn/one-person-lab',
      requested_ref: options.frameworkRef || 'main',
      resolved_commit: components.opl?.git_commit ?? readGitHead(options.frameworkRoot),
    },
    opl_runtime_environment_substrate: {
      label: 'OPL Runtime Environment Substrate',
      source_path: path.join(options.frameworkRoot, 'contracts', 'opl-framework', 'runtime-environment-substrate-contract.json'),
      repository: readGitOriginUrl(options.frameworkRoot) || 'gaofeng21cn/one-person-lab',
      requested_ref: options.frameworkRef || 'main',
      resolved_commit: components.opl?.git_commit ?? readGitHead(options.frameworkRoot),
      contract_path: 'contracts/opl-framework/runtime-environment-substrate-contract.json',
      readback_commands: [
        'opl runtime env contract --json',
        'opl runtime env build --domain <domain> --profile <profile> --platform <platform> --json',
        'opl runtime env materialize --domain <domain> --profile <profile> --platform <platform> --dry-run --json',
        'opl runtime env run-context --domain <domain> --profile <profile> --platform <platform> --json',
      ],
    },
    mas: {
      label: 'MAS',
      source_path: options.masRoot,
      repository: readGitOriginUrl(options.masRoot) || 'gaofeng21cn/med-autoscience',
      requested_ref: options.masRef,
      resolved_commit: components.mas?.git_commit ?? readGitHead(options.masRoot),
    },
    mag: {
      label: 'MAG',
      source_path: options.magRoot,
      repository: readGitOriginUrl(options.magRoot) || 'gaofeng21cn/med-autogrant',
      requested_ref: options.magRef,
      resolved_commit: components.mag?.git_commit ?? readGitHead(options.magRoot),
    },
    rca: {
      label: 'RCA',
      source_path: options.rcaRoot,
      repository: readGitOriginUrl(options.rcaRoot) || 'gaofeng21cn/redcube-ai',
      requested_ref: options.rcaRef,
      resolved_commit: components.rca?.git_commit ?? readGitHead(options.rcaRoot),
    },
    opl_meta_agent: {
      label: 'OPL Meta Agent',
      source_path: options.metaAgentRoot,
      repository: readGitOriginUrl(options.metaAgentRoot) || 'gaofeng21cn/opl-meta-agent',
      requested_ref: options.metaAgentRef,
      resolved_commit: components.meta_agent?.git_commit ?? readGitHead(options.metaAgentRoot),
    },
    opl_bookforge: {
      label: 'OPL BookForge',
      source_path: options.bookforgeRoot,
      repository: readGitOriginUrl(options.bookforgeRoot) || 'gaofeng21cn/opl-bookforge',
      requested_ref: options.bookforgeRef,
      resolved_commit: components.bookforge?.git_commit ?? readGitHead(options.bookforgeRoot),
    },
    superpowers: {
      label: 'Superpowers',
      source_path: options.superpowersRoot,
      repository: readGitOriginUrl(options.superpowersRoot) || 'obra/superpowers',
      requested_ref: options.superpowersRef,
      resolved_commit: readGitHead(options.superpowersRoot),
      version: packageJsonVersion(path.join(options.superpowersRoot, 'package.json')),
    },
    officecli: {
      label: 'OfficeCLI',
      source_path: options.officeCliRoot,
      repository: readGitOriginUrl(options.officeCliRoot) || 'iOfficeAI/OfficeCLI',
      requested_ref: options.officeCliRef,
      resolved_commit: readGitHead(options.officeCliRoot),
      version: components.officecli?.version ?? null,
    },
    mineru: {
      label: 'MinerU',
      source_path: mineruRepoRoot,
      repository: 'opendatalab/MinerU-Ecosystem',
      requested_ref: options.mineruRef,
      resolved_commit: readGitHead(mineruRepoRoot),
      version: components.mineru_open_api?.version ?? null,
    },
    ui_ux_skill: {
      label: 'UI UX skill',
      source_path: options.uiUxProMaxRoot,
      repository: readGitOriginUrl(options.uiUxProMaxRoot) || 'nextlevelbuilder/ui-ux-pro-max-skill',
      requested_ref: options.uiUxProMaxRef,
      resolved_commit: readGitHead(options.uiUxProMaxRoot),
    },
  };
}

function directoryChildSizes(root) {
  if (!fs.existsSync(root)) {
    return {};
  }
  return Object.fromEntries(
    fs.readdirSync(root)
      .sort()
      .map((entry) => [
        entry,
        {
          relative_path: entry,
          size_bytes: directorySizeBytes(path.join(root, entry)),
        },
      ]),
  );
}

function sizeBreakdownEntry(runtimeRoot, relativePath, children = undefined) {
  const absolutePath = path.join(runtimeRoot, ...relativePath.split('/').filter(Boolean));
  return {
    relative_path: relativePath,
    size_bytes: directorySizeBytes(absolutePath),
    ...(children ? { children } : {}),
  };
}

function collectFullRuntimeSizeBreakdown(runtimeRoot) {
  return {
    measurement_policy: 'uncompressed_file_bytes_after_full_runtime_pruning',
    total_runtime_uncompressed_bytes: directorySizeBytes(runtimeRoot),
    opl_layer_taxonomy: FULL_RUNTIME_CACHE_LAYER_TAXONOMY,
    layers: {
      toolchain: {
        relative_paths: ['bin', 'node', 'python', 'uv', 'vendor'],
        size_bytes: directorySizeBytes(path.join(runtimeRoot, 'bin'))
          + directorySizeBytes(path.join(runtimeRoot, 'node'))
          + directorySizeBytes(path.join(runtimeRoot, 'python'))
          + directorySizeBytes(path.join(runtimeRoot, 'uv'))
          + directorySizeBytes(path.join(runtimeRoot, 'vendor')),
        children: {
          bin: sizeBreakdownEntry(runtimeRoot, 'bin', directoryChildSizes(path.join(runtimeRoot, 'bin'))),
          node: sizeBreakdownEntry(runtimeRoot, 'node'),
          python: sizeBreakdownEntry(runtimeRoot, 'python'),
          uv: sizeBreakdownEntry(runtimeRoot, 'uv'),
          vendor: sizeBreakdownEntry(runtimeRoot, 'vendor', directoryChildSizes(path.join(runtimeRoot, 'vendor'))),
        },
      },
      'domain-runtime': sizeBreakdownEntry(runtimeRoot, 'modules', directoryChildSizes(path.join(runtimeRoot, 'modules'))),
      'opl-runtime': sizeBreakdownEntry(runtimeRoot, 'opl', {
        'node_modules': sizeBreakdownEntry(runtimeRoot, 'opl/node_modules'),
      }),
      skills: sizeBreakdownEntry(runtimeRoot, 'skills', directoryChildSizes(path.join(runtimeRoot, 'skills'))),
    },
  };
}

export function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assertOfflineRequiredPayloadsPresent(runtimeAssertions) {
  const missingPayloads = (runtimeAssertions.offline_required_payloads ?? []).filter((entry) => {
    if (entry.exists !== true) return true;
    return Object.prototype.hasOwnProperty.call(entry, 'executable') && entry.executable !== true;
  });
  if (missingPayloads.length > 0) {
    throw new Error(
      [
        'Full runtime package is missing required offline payload(s):',
        ...missingPayloads.map((entry) =>
          Object.prototype.hasOwnProperty.call(entry, 'executable') && entry.executable !== true
            ? `  - ${entry.path} (not executable)`
            : `  - ${entry.path}`,
        ),
      ].join('\n'),
    );
  }
}

export function writeFullRuntimeManifest(runtimeRoot, options, packagedAt, components, resolvedRefs, optionalComponents = {}, nativeTrust = undefined) {
  const manifestDir = path.join(runtimeRoot, 'manifest');
  const manifestPath = path.join(manifestDir, 'full-package-manifest.json');
  fs.mkdirSync(manifestDir, { recursive: true });

  const runtimeAssertions = collectRuntimeAssertions(runtimeRoot);
  assertOfflineRequiredPayloadsPresent(runtimeAssertions);
  let manifest = buildFullPackageManifest({
    version: options.version,
    generatedAt: packagedAt,
    components,
    optionalComponents,
    resolvedRefs,
    runtimeAssertions,
    nativeTrust,
  });

  for (let attempt = 0; attempt < 8; attempt += 1) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const sizeBreakdown = collectFullRuntimeSizeBreakdown(runtimeRoot);
    const nextRuntimeAssertions = collectRuntimeAssertions(runtimeRoot);
    assertOfflineRequiredPayloadsPresent(nextRuntimeAssertions);
    const nextManifest = buildFullPackageManifest({
      version: options.version,
      generatedAt: packagedAt,
      components,
      optionalComponents,
      resolvedRefs,
      runtimeAssertions: nextRuntimeAssertions,
      nativeTrust,
      sizeBreakdown,
    });
    fs.writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');

    if (JSON.stringify(sizeBreakdown) === JSON.stringify(collectFullRuntimeSizeBreakdown(runtimeRoot))) {
      return nextManifest;
    }
    manifest = nextManifest;
  }

  throw new Error('Full runtime manifest size_breakdown did not stabilize.');
}

export function writeChecksums(outDir, files) {
  const lines = files.map((filePath) => {
    const result = run('shasum', ['-a', '256', filePath], { capture: true });
    const hash = result.stdout.trim().split(/\s+/)[0];
    return `${hash}  ${path.basename(filePath)}`;
  });
  const checksumPath = path.join(outDir, 'SHA256SUMS.txt');
  fs.writeFileSync(checksumPath, `${lines.join('\n')}\n`, 'utf8');
  return checksumPath;
}
