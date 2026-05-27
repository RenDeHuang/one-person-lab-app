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

function componentEntries(manifest: Record<string, any>) {
  return Object.entries(manifest.components ?? {})
    .map(([id, component]) => ({
      id,
      size_bytes: Number.isFinite(component?.size_bytes) ? component.size_bytes : null,
      version: component?.version ?? null,
      git_commit: component?.git_commit ?? null,
      role: component?.role ?? null,
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

function buildSummary(options: ReturnType<typeof parseArgs>) {
  if (!fs.existsSync(options.manifestPath)) {
    throw new Error(`Full package manifest not found: ${options.manifestPath}`);
  }
  const manifest = readJson(options.manifestPath);
  const totalRuntimeBytes = manifest.size_breakdown?.total_runtime_uncompressed_bytes ?? null;
  const maxRuntimeBytes = manifest.size_budget?.max_runtime_uncompressed_bytes ?? null;
  const budgetPercent = Number.isFinite(totalRuntimeBytes) && Number.isFinite(maxRuntimeBytes)
    ? percent(totalRuntimeBytes, maxRuntimeBytes)
    : null;
  const components = componentEntries(manifest);
  const layers = layerEntries(manifest);

  return {
    manifest_path: options.manifestPath,
    manifest_version: manifest.manifest_version ?? null,
    version: manifest.version ?? null,
    package_kind: manifest.package_kind ?? null,
    total_runtime_uncompressed_bytes: totalRuntimeBytes,
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
    `- Runtime total: ${formatBytes(summary.total_runtime_uncompressed_bytes)}`,
    `- Runtime budget: ${formatBytes(summary.max_runtime_uncompressed_bytes)}${summary.runtime_budget_used_percent === null ? '' : ` (${summary.runtime_budget_used_percent}% used)`}`,
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

main();
