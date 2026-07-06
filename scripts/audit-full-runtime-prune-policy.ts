#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs as parseNodeArgs } from 'node:util';
import {
  FULL_RUNTIME_PRUNE_POLICY,
  FULL_RUNTIME_PRUNE_POLICY_PATH,
  buildFullRuntimePrunePolicyHash,
  shouldExcludeNodeToolchainPackagePath,
  shouldExcludeProductionNodeModulePath,
  shouldExcludeRuntimePath,
} from './full-first-install-package.ts';
import { directorySizeBytes } from './build-full-first-install-package/filesystem.ts';
import { collectRuntimeAssertions } from './build-full-first-install-package/runtime-layers.ts';
import { formatBytes } from './release-size-reporting.ts';

type OutputMode = 'json' | 'markdown';

function parseArgs(argv: string[]) {
  const runtimeRootOption = '--runtime-root';
  const baselineOption = '--baseline';
  const runtimeRootKey = runtimeRootOption.slice(2) as 'runtime-root';
  const baselineKey = baselineOption.slice(2) as 'baseline';
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      [runtimeRootKey]: { type: 'string' },
      [baselineKey]: { type: 'string' },
      top: { type: 'string' },
      json: { type: 'boolean' },
      markdown: { type: 'boolean' },
    },
    allowPositionals: false,
  });
  const parsed = {
    runtimeRoot: values[runtimeRootKey] ? path.resolve(values[runtimeRootKey]) : '',
    baseline: values[baselineKey] ? path.resolve(values[baselineKey]) : '',
    top: 20,
    output: argv.lastIndexOf('--markdown') > argv.lastIndexOf('--json') ? 'markdown' as OutputMode : 'json' as OutputMode,
  };

  if (values.top) {
    if (!/^\d+$/.test(values.top) || Number(values.top) < 1) {
      throw new Error('--top requires a positive integer.');
    }
    parsed.top = Number(values.top);
  }

  return parsed;
}

function expectedExcluded(kind: string, relativePath: string) {
  if (kind === 'runtime_tree') return shouldExcludeRuntimePath(relativePath);
  if (kind === 'production_node_modules') return shouldExcludeProductionNodeModulePath(relativePath);
  if (kind === 'node_toolchain_global_packages') return shouldExcludeNodeToolchainPackagePath(relativePath);
  throw new Error(`Unsupported validation example kind: ${kind}`);
}

function evaluateExamples() {
  const failures: Array<Record<string, unknown>> = [];
  const groups = FULL_RUNTIME_PRUNE_POLICY.validation_examples ?? {};
  const results = Object.entries(groups).map(([kind, examples]) => {
    const excluded = Array.isArray((examples as any).excluded) ? (examples as any).excluded : [];
    const retained = Array.isArray((examples as any).retained) ? (examples as any).retained : [];
    const checks = [
      ...excluded.map((relativePath: string) => ({
        kind,
        path: relativePath,
        expected: 'excluded',
        actual: expectedExcluded(kind, relativePath) ? 'excluded' : 'retained',
      })),
      ...retained.map((relativePath: string) => ({
        kind,
        path: relativePath,
        expected: 'retained',
        actual: expectedExcluded(kind, relativePath) ? 'excluded' : 'retained',
      })),
    ];
    for (const check of checks) {
      if (check.expected !== check.actual) {
        failures.push(check);
      }
    }
    return {
      kind,
      excluded_count: excluded.length,
      retained_count: retained.length,
      passed: checks.filter((check) => check.expected === check.actual).length,
      failed: checks.filter((check) => check.expected !== check.actual).length,
    };
  });

  return {
    status: failures.length === 0 ? 'passed' : 'failed',
    groups: results,
    failures,
  };
}

function listRelativePaths(root: string) {
  const entries: string[] = [];
  if (!root || !fs.existsSync(root)) return entries;
  const stack = [''];
  while (stack.length > 0) {
    const relativePath = stack.pop() ?? '';
    const absolutePath = path.join(root, ...relativePath.split('/').filter(Boolean));
    const stat = fs.lstatSync(absolutePath);
    if (relativePath) entries.push(relativePath);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(absolutePath).sort().reverse()) {
        stack.push(relativePath ? path.posix.join(relativePath, entry) : entry);
      }
    }
  }
  return entries.sort();
}

function nodeToolchainPackageRelativePath(relativePath: string) {
  const match = /^(node\/lib\/node_modules\/(?:npm|corepack))(?:\/(.+))?$/.exec(relativePath);
  if (!match) return null;
  return match[2] ?? '';
}

function productionNodeModuleRelativePath(relativePath: string) {
  const match = /^opl\/node_modules\/((?:@[^/]+\/)?[^/]+)(?:\/(.+))?$/.exec(relativePath);
  if (!match) return null;
  return {
    package_path: `opl/node_modules/${match[1]}`,
    package_relative_path: match[2] ?? '',
  };
}

function classifyRuntimePathExclusion(relativePath: string) {
  const nodePackageRelativePath = nodeToolchainPackageRelativePath(relativePath);
  if (nodePackageRelativePath !== null && shouldExcludeNodeToolchainPackagePath(nodePackageRelativePath)) {
    return {
      surface: 'node_toolchain_global_packages',
      package_relative_path: nodePackageRelativePath,
    };
  }
  if (nodePackageRelativePath !== null) {
    return null;
  }

  const productionModulePath = productionNodeModuleRelativePath(relativePath);
  if (
    productionModulePath
    && productionModulePath.package_relative_path
    && shouldExcludeProductionNodeModulePath(productionModulePath.package_relative_path)
  ) {
    return {
      surface: 'production_node_modules',
      package_path: productionModulePath.package_path,
      package_relative_path: productionModulePath.package_relative_path,
    };
  }
  if (productionModulePath || relativePath === 'opl/node_modules') {
    return null;
  }

  if (shouldExcludeRuntimePath(relativePath)) {
    return {
      surface: 'runtime_tree',
    };
  }

  return null;
}

function scanRuntimeRoot(runtimeRoot: string, top: number) {
  if (!runtimeRoot) return null;
  if (!fs.existsSync(runtimeRoot)) {
    throw new Error(`Runtime root not found: ${runtimeRoot}`);
  }
  const excluded = listRelativePaths(runtimeRoot)
    .map((relativePath) => {
      const exclusion = classifyRuntimePathExclusion(relativePath);
      if (!exclusion) return null;
      const absolutePath = path.join(runtimeRoot, ...relativePath.split('/'));
      return {
        path: relativePath,
        surface: exclusion.surface,
        package_path: 'package_path' in exclusion ? exclusion.package_path : null,
        package_relative_path: 'package_relative_path' in exclusion ? exclusion.package_relative_path : null,
        size_bytes: directorySizeBytes(absolutePath),
      };
    })
    .filter((entry) => entry !== null);
  const excludedPaths = excluded.map((entry) => entry.path).sort();
  const assertions = collectRuntimeAssertions(runtimeRoot);
  return {
    runtime_root: runtimeRoot,
    excluded_count: excluded.length,
    excluded_bytes: excluded.reduce((sum, entry) => sum + entry.size_bytes, 0),
    excluded_paths: excludedPaths,
    excluded_by_surface: Object.fromEntries(
      ['runtime_tree', 'production_node_modules', 'node_toolchain_global_packages'].map((surface) => [
        surface,
        excluded.filter((entry) => entry.surface === surface).length,
      ]),
    ),
    top_excluded_paths: excluded
      .sort((left, right) => right.size_bytes - left.size_bytes)
      .slice(0, top),
    runtime_assertions: assertions,
  };
}

function diffRuntimeScan(currentScan: ReturnType<typeof scanRuntimeRoot>, baselinePath: string) {
  if (!currentScan || !baselinePath) return null;
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const baselinePaths = new Set<string>(baseline.runtime_scan?.excluded_paths ?? []);
  const currentPaths = new Set<string>(currentScan.excluded_paths);
  return {
    baseline_path: baselinePath,
    added_excluded_paths: [...currentPaths].filter((entry) => !baselinePaths.has(entry)).sort(),
    removed_excluded_paths: [...baselinePaths].filter((entry) => !currentPaths.has(entry)).sort(),
  };
}

function buildAudit(options: ReturnType<typeof parseArgs>) {
  const examples = evaluateExamples();
  const runtimeScan = scanRuntimeRoot(options.runtimeRoot, options.top);
  return {
    schema: 'opl_full_runtime_prune_policy_audit.v1',
    policy_path: path.relative(process.cwd(), FULL_RUNTIME_PRUNE_POLICY_PATH) || FULL_RUNTIME_PRUNE_POLICY_PATH,
    policy_id: FULL_RUNTIME_PRUNE_POLICY.id,
    policy_schema: FULL_RUNTIME_PRUNE_POLICY.schema,
    policy_hash: buildFullRuntimePrunePolicyHash(),
    policy_mode: FULL_RUNTIME_PRUNE_POLICY.mode,
    source_of_truth: 'contracts/full-runtime-prune-policy.json',
    external_practice_refs: FULL_RUNTIME_PRUNE_POLICY.external_practice_refs ?? [],
    examples,
    runtime_scan: runtimeScan,
    runtime_scan_diff: diffRuntimeScan(runtimeScan, options.baseline),
  };
}

function renderMarkdown(audit: ReturnType<typeof buildAudit>) {
  const lines = [
    '## Full Runtime Prune Policy Audit',
    '',
    `- Policy: ${audit.policy_path}`,
    `- Policy id: ${audit.policy_id}`,
    `- Policy hash: ${audit.policy_hash}`,
    `- Example status: ${audit.examples.status}`,
    '',
    '### External Practice Refs',
    '',
    '| Source | Adopted pattern | URL |',
    '| --- | --- | --- |',
    ...audit.external_practice_refs.map((entry: any) =>
      `| ${entry.source} | ${entry.adopted_pattern} | ${entry.url} |`,
    ),
    '',
    '### Validation Examples',
    '',
    '| Group | Excluded examples | Retained examples | Failed |',
    '| --- | --- | --- | --- |',
    ...audit.examples.groups.map((group) =>
      `| ${group.kind} | ${group.excluded_count} | ${group.retained_count} | ${group.failed} |`,
    ),
  ];

  if (audit.runtime_scan) {
    lines.push(
      '',
      '### Runtime Scan',
      '',
      `- Runtime root: ${audit.runtime_scan.runtime_root}`,
      `- Excluded paths: ${audit.runtime_scan.excluded_count}`,
      `- Excluded bytes: ${formatBytes(audit.runtime_scan.excluded_bytes)}`,
      `- Runtime tree exclusions: ${audit.runtime_scan.excluded_by_surface.runtime_tree}`,
      `- Production node module exclusions: ${audit.runtime_scan.excluded_by_surface.production_node_modules}`,
      `- Node toolchain package exclusions: ${audit.runtime_scan.excluded_by_surface.node_toolchain_global_packages}`,
      '',
      '| Path | Size |',
      '| --- | --- |',
      ...audit.runtime_scan.top_excluded_paths.map((entry) => `| ${entry.path} | ${formatBytes(entry.size_bytes)} |`),
    );
  }

  if (audit.runtime_scan_diff) {
    lines.push(
      '',
      '### Runtime Scan Diff',
      '',
      `- Baseline: ${audit.runtime_scan_diff.baseline_path}`,
      `- Added excluded paths: ${audit.runtime_scan_diff.added_excluded_paths.length}`,
      `- Removed excluded paths: ${audit.runtime_scan_diff.removed_excluded_paths.length}`,
    );
  }

  if (audit.examples.failures.length > 0) {
    lines.push('', '### Failures', '', '```json', JSON.stringify(audit.examples.failures, null, 2), '```');
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const audit = buildAudit(options);
  if (options.output === 'markdown') {
    process.stdout.write(renderMarkdown(audit));
  } else {
    process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
  }
  if (audit.examples.status !== 'passed') {
    process.exitCode = 1;
  }
}

main();
