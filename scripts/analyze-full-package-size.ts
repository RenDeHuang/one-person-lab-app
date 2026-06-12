#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FULL_RELEASE_OUTPUT_DIR,
  FULL_RUNTIME_CACHE_LAYER_IDS,
} from './full-first-install-package.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultManifestPath = path.join(appRoot, FULL_RELEASE_OUTPUT_DIR, 'full-package-manifest.json');

function parseArgs(argv: string[]) {
  const parsed = {
    manifestPath: defaultManifestPath,
    runtimeRoot: '',
    fullDmgSizeBytes: null as number | null,
    top: 12,
    markdown: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (token === '--manifest') {
      if (!value) throw new Error('--manifest requires a path.');
      parsed.manifestPath = path.resolve(value);
      index += 1;
    } else if (token === '--runtime-root') {
      if (!value) throw new Error('--runtime-root requires a path.');
      parsed.runtimeRoot = path.resolve(value);
      index += 1;
    } else if (token === '--full-dmg-size-bytes') {
      if (!value || !/^\d+$/.test(value)) throw new Error('--full-dmg-size-bytes requires a non-negative integer.');
      parsed.fullDmgSizeBytes = Number(value);
      index += 1;
    } else if (token === '--top') {
      if (!value || !/^\d+$/.test(value)) throw new Error('--top requires a positive integer.');
      parsed.top = Number(value);
      index += 1;
    } else if (token === '--markdown') {
      parsed.markdown = true;
    } else if (token === '--json') {
      parsed.markdown = false;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  return parsed;
}

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sizeBytes(root: string): number {
  if (!root || !fs.existsSync(root)) return 0;
  const stat = fs.lstatSync(root);
  if (stat.isFile()) return stat.size;
  let total = 0;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const currentStat = fs.lstatSync(current);
    if (currentStat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
    } else if (currentStat.isFile()) {
      total += currentStat.size;
    }
  }
  return total;
}

function formatBytes(bytes: number | null | undefined) {
  if (!Number.isFinite(bytes) || bytes === null || bytes === undefined) return 'n/a';
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function percent(part: number, total: number) {
  if (!total) return null;
  return Number(((part / total) * 100).toFixed(1));
}

function budgetStatus(value: number | null, limit: number | null, mode: 'warning_at_or_above' | 'fail_above' | 'review_above') {
  if (!Number.isFinite(value) || !Number.isFinite(limit)) return 'unavailable';
  if (mode === 'warning_at_or_above') return (value as number) >= (limit as number) ? 'warning' : 'passed';
  if (mode === 'review_above') return (value as number) > (limit as number) ? 'above_review_threshold' : 'within_review_threshold';
  return (value as number) > (limit as number) ? 'failed' : 'passed';
}

function componentEntries(manifest: Record<string, any>) {
  return Object.entries(manifest.components ?? {})
    .map(([id, component]) => ({
      id,
      size_bytes: Number.isFinite((component as any)?.size_bytes) ? (component as any).size_bytes : null,
      version: (component as any)?.version ?? null,
      git_commit: (component as any)?.git_commit ?? null,
      role: (component as any)?.role ?? null,
    }))
    .sort((left, right) => (right.size_bytes ?? -1) - (left.size_bytes ?? -1));
}

function layerEntries(manifest: Record<string, any>) {
  const layers = manifest.size_breakdown?.layers ?? {};
  const explicit = Object.entries(layers).map(([id, layer]) => ({
    id,
    size_bytes: Number.isFinite((layer as any)?.size_bytes) ? (layer as any).size_bytes : null,
  }));
  const missing = FULL_RUNTIME_CACHE_LAYER_IDS
    .filter((id) => !Object.prototype.hasOwnProperty.call(layers, id))
    .map((id) => ({ id, size_bytes: null }));
  return [...explicit, ...missing].sort((left, right) => (right.size_bytes ?? -1) - (left.size_bytes ?? -1));
}

function collectManifestSizeHotspots(manifest: Record<string, any>, top: number) {
  const layers = manifest.size_breakdown?.layers ?? {};
  const entries: Array<{ path: string; size_bytes: number }> = [];

  const visit = (prefix: string, node: any) => {
    const entryPath = prefix.replace(/^\/+/, '');
    if (Number.isFinite(node?.size_bytes) && entryPath) {
      entries.push({
        path: entryPath,
        size_bytes: node.size_bytes,
      });
    }
    const children = node?.children && typeof node.children === 'object' ? node.children : {};
    for (const [childId, child] of Object.entries(children)) {
      visit(entryPath ? `${entryPath}/${childId}` : childId, child);
    }
  };

  for (const [layerId, layer] of Object.entries(layers)) {
    visit(layerId, layer);
  }

  return entries
    .sort((left, right) => right.size_bytes - left.size_bytes)
    .slice(0, top);
}

function runtimeRootEntries(runtimeRoot: string, top: number) {
  if (!runtimeRoot || !fs.existsSync(runtimeRoot)) return [];
  return fs.readdirSync(runtimeRoot)
    .map((entry) => {
      const absolutePath = path.join(runtimeRoot, entry);
      return {
        path: entry,
        size_bytes: sizeBytes(absolutePath),
      };
    })
    .sort((left, right) => right.size_bytes - left.size_bytes)
    .slice(0, top);
}

function ranked<T extends { size_bytes: number | null }>(entries: T[], totalBytes: number | null, top: number) {
  return entries
    .filter((entry) => Number.isFinite(entry.size_bytes))
    .slice(0, top)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
      runtime_percent: Number.isFinite(entry.size_bytes) && Number.isFinite(totalBytes)
        ? percent(entry.size_bytes as number, totalBytes as number)
        : null,
    }));
}

function optimizationCandidates(args: {
  components: ReturnType<typeof componentEntries>;
  layers: ReturnType<typeof layerEntries>;
  hotspots: Array<{ path: string; size_bytes: number }>;
  totalRuntimeBytes: number | null;
  top: number;
}) {
  const candidates: Array<Record<string, unknown>> = [];
  for (const layer of ranked(args.layers, args.totalRuntimeBytes, Math.min(args.top, 5))) {
    candidates.push({
      kind: 'layer',
      id: layer.id,
      size_bytes: layer.size_bytes,
      runtime_percent: layer.runtime_percent,
      reason: 'largest_runtime_layer',
    });
  }
  for (const component of ranked(args.components, args.totalRuntimeBytes, Math.min(args.top, 5))) {
    candidates.push({
      kind: 'component',
      id: component.id,
      size_bytes: component.size_bytes,
      runtime_percent: component.runtime_percent,
      reason: 'largest_packaged_component',
    });
  }
  for (const hotspot of args.hotspots.slice(0, Math.min(args.top, 5))) {
    candidates.push({
      kind: 'manifest_path',
      id: hotspot.path,
      size_bytes: hotspot.size_bytes,
      runtime_percent: Number.isFinite(args.totalRuntimeBytes)
        ? percent(hotspot.size_bytes, args.totalRuntimeBytes as number)
        : null,
      reason: 'largest_manifest_hotspot',
    });
  }
  return candidates
    .sort((left, right) => Number(right.size_bytes ?? -1) - Number(left.size_bytes ?? -1))
    .slice(0, args.top)
    .map((candidate, index) => ({
      rank: index + 1,
      ...candidate,
    }));
}

function buildSummary(options: ReturnType<typeof parseArgs>) {
  if (!fs.existsSync(options.manifestPath)) {
    throw new Error(`Full package manifest not found: ${options.manifestPath}`);
  }
  const manifest = readJson(options.manifestPath);
  const totalRuntimeBytes = manifest.size_breakdown?.total_runtime_uncompressed_bytes ?? null;
  const maxRuntimeBytes = manifest.size_budget?.max_runtime_uncompressed_bytes ?? null;
  const warningFullDmgBytes = manifest.size_budget?.warning_full_dmg_bytes ?? null;
  const maxFullDmgBytes = manifest.size_budget?.max_full_dmg_bytes ?? null;
  const budgetPercent = Number.isFinite(totalRuntimeBytes) && Number.isFinite(maxRuntimeBytes)
    ? percent(totalRuntimeBytes, maxRuntimeBytes)
    : null;
  const components = componentEntries(manifest);
  const layers = layerEntries(manifest);
  const manifestSizeHotspots = collectManifestSizeHotspots(manifest, options.top);
  const fullDmgWarningStatus = budgetStatus(options.fullDmgSizeBytes, warningFullDmgBytes, 'warning_at_or_above');
  const fullDmgReviewThresholdStatus = budgetStatus(options.fullDmgSizeBytes, maxFullDmgBytes, 'review_above');
  const runtimeUncompressedStatus = budgetStatus(totalRuntimeBytes, maxRuntimeBytes, 'fail_above');
  const topComponents = ranked(components, totalRuntimeBytes, options.top);
  const topLayers = ranked(layers, totalRuntimeBytes, options.top);

  return {
    schema: 'opl_full_package_size_summary.v1',
    manifest_path: options.manifestPath,
    manifest_version: manifest.manifest_version ?? null,
    version: manifest.version ?? null,
    package_kind: manifest.package_kind ?? null,
    budget: {
      status: runtimeUncompressedStatus === 'failed' ? 'failed' : 'passed',
      compressed_full_dmg: {
        measurement_source: options.fullDmgSizeBytes === null ? 'not_provided' : 'local_full_dmg_file_size_bytes',
        full_dmg_size_bytes: options.fullDmgSizeBytes,
        warning_full_dmg_bytes: warningFullDmgBytes,
        max_full_dmg_bytes: maxFullDmgBytes,
        warning_status: fullDmgWarningStatus,
        review_threshold_status: fullDmgReviewThresholdStatus,
        release_blocking: false,
      },
      runtime_uncompressed: {
        measurement_source: 'full-package-manifest.json#size_breakdown.total_runtime_uncompressed_bytes',
        total_runtime_uncompressed_bytes: totalRuntimeBytes,
        max_runtime_uncompressed_bytes: maxRuntimeBytes,
        status: runtimeUncompressedStatus,
        used_percent: budgetPercent,
        release_blocking: true,
      },
    },
    total_runtime_uncompressed_bytes: totalRuntimeBytes,
    full_dmg_size_bytes: options.fullDmgSizeBytes,
    warning_full_dmg_bytes: warningFullDmgBytes,
    max_full_dmg_bytes: maxFullDmgBytes,
    max_runtime_uncompressed_bytes: maxRuntimeBytes,
    runtime_budget_used_percent: budgetPercent,
    components: components.map((component) => ({
      ...component,
      runtime_percent: Number.isFinite(component.size_bytes) && Number.isFinite(totalRuntimeBytes)
        ? percent(component.size_bytes as number, totalRuntimeBytes)
        : null,
    })),
    layers: layers.map((layer) => ({
      ...layer,
      runtime_percent: Number.isFinite(layer.size_bytes) && Number.isFinite(totalRuntimeBytes)
        ? percent(layer.size_bytes as number, totalRuntimeBytes)
        : null,
    })),
    top_contributors: {
      components: topComponents,
      layers: topLayers,
      manifest_size_hotspots: manifestSizeHotspots.map((entry, index) => ({
        rank: index + 1,
        ...entry,
        runtime_percent: Number.isFinite(totalRuntimeBytes)
          ? percent(entry.size_bytes, totalRuntimeBytes as number)
          : null,
      })),
    },
    optimization_candidates: optimizationCandidates({
      components,
      layers,
      hotspots: manifestSizeHotspots,
      totalRuntimeBytes,
      top: options.top,
    }),
    manifest_size_hotspots: manifestSizeHotspots,
    runtime_root: options.runtimeRoot || null,
    runtime_root_top_entries: runtimeRootEntries(options.runtimeRoot, options.top),
  };
}

function renderTable(headers: string[], rows: string[][]) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function renderMarkdown(summary: ReturnType<typeof buildSummary>, top: number) {
  const lines = [
    '## Full Package Size',
    '',
    `- Version: ${summary.version ?? 'unknown'}`,
    `- Manifest: ${summary.manifest_path}`,
    `- Full DMG size: ${formatBytes(summary.full_dmg_size_bytes)} (${summary.budget.compressed_full_dmg.warning_status})`,
    `- Runtime total: ${formatBytes(summary.total_runtime_uncompressed_bytes)}`,
    `- Full DMG warning threshold: ${formatBytes(summary.warning_full_dmg_bytes)}`,
    `- Full DMG review threshold: ${formatBytes(summary.max_full_dmg_bytes)}`,
    `- Runtime budget: ${formatBytes(summary.max_runtime_uncompressed_bytes)}${summary.runtime_budget_used_percent === null ? '' : ` (${summary.runtime_budget_used_percent}% used, ${summary.budget.runtime_uncompressed.status})`}`,
    '',
    '### Layers',
    '',
    renderTable(
      ['Layer', 'Size', 'Runtime %'],
      summary.layers.map((layer) => [
        layer.id,
        formatBytes(layer.size_bytes),
        layer.runtime_percent === null ? 'n/a' : `${layer.runtime_percent}%`,
      ]),
    ),
    '',
    '### Components',
    '',
    renderTable(
      ['Component', 'Size', 'Runtime %', 'Version / Commit'],
      summary.components.slice(0, top).map((component) => [
        component.id,
        formatBytes(component.size_bytes),
        component.runtime_percent === null ? 'n/a' : `${component.runtime_percent}%`,
        String(component.version ?? component.git_commit ?? ''),
      ]),
    ),
  ];

  if (summary.manifest_size_hotspots.length > 0) {
    lines.push(
      '',
      '### Manifest Size Hotspots',
      '',
      renderTable(
        ['Path', 'Size'],
        summary.manifest_size_hotspots.map((entry) => [entry.path, formatBytes(entry.size_bytes)]),
      ),
    );
  }

  if (summary.runtime_root_top_entries.length > 0) {
    lines.push(
      '',
      '### Runtime Root Entries',
      '',
      renderTable(
        ['Path', 'Size'],
        summary.runtime_root_top_entries.map((entry) => [entry.path, formatBytes(entry.size_bytes)]),
      ),
    );
  }

  if (summary.optimization_candidates.length > 0) {
    lines.push(
      '',
      '### Optimization Candidates',
      '',
      renderTable(
        ['Rank', 'Kind', 'ID', 'Size', 'Runtime %', 'Reason'],
        summary.optimization_candidates.map((candidate) => [
          String(candidate.rank),
          String(candidate.kind),
          String(candidate.id),
          formatBytes(candidate.size_bytes as number),
          candidate.runtime_percent === null ? 'n/a' : `${String(candidate.runtime_percent)}%`,
          String(candidate.reason),
        ]),
      ),
    );
  }

  return lines.join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const summary = buildSummary(options);
  if (options.markdown) {
    console.log(renderMarkdown(summary, options.top));
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
