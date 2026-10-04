import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function readJson(root: string, relativePath: string, issues: Set<string>): JsonRecord {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    issues.add(`missing ${relativePath}`);
    return {};
  }
  try {
    return record(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch (error) {
    issues.add(`${relativePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

function sha256(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function isExactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function hasExactRecord(actual: JsonRecord, expected: JsonRecord): boolean {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return JSON.stringify(actualKeys) === JSON.stringify(expectedKeys) && expectedKeys.every((key) => actual[key] === expected[key]);
}

export function validateVisualEvidence(root: string, historicalPixelShellSha: string, issues: Set<string>): number {
  const manifestPath = 'docs/product/gui/evidence/aionui-41301/manifest.json';
  const manifest = readJson(root, manifestPath, issues);
  const sourceManifestPath = 'docs/product/gui/evidence/aionui-41301/source-manifest.json';
  const sourceManifest = readJson(root, sourceManifestPath, issues);
  const entries = Array.isArray(manifest.entries) ? manifest.entries.map(record) : [];
  const sourceEntries = Array.isArray(sourceManifest.entries) ? sourceManifest.entries.map(record) : [];
  const claims = record(manifest.claims);
  const sourceClaims = record(sourceManifest.claims);
  const expectedClaims = {
    route_state_non_empty: true,
    layout_bounds_checked: true,
    parity_1_to_1: false,
    release_ready: false,
  };

  if (
    manifest.schema !== 'opl_app_gui_visual_evidence.v1' ||
    manifest.owner !== 'one-person-lab-app' ||
    manifest.shell_head !== historicalPixelShellSha ||
    manifest.source_manifest !== sourceManifestPath ||
    manifest.entry_count !== 8 ||
    entries.length !== 8 ||
    typeof manifest.command !== 'string' ||
    !manifest.command.includes('E2E_PACKAGED=1') ||
    !hasExactRecord(claims, expectedClaims)
  ) {
    issues.add('AionUI 41301 visual evidence manifest must bind eight packaged route/layout entries without parity or release claims');
  }

  const sourcePath = path.join(root, sourceManifestPath);
  if (
    !fs.existsSync(sourcePath) ||
    manifest.source_manifest_sha256 !== sha256(sourcePath) ||
    sourceManifest.schema !== 'opl_aionui_gui_route_visual_evidence.v1' ||
    sourceManifest.shell_head !== historicalPixelShellSha ||
    sourceManifest.command !== manifest.command ||
    sourceEntries.length !== 8
  ) {
    issues.add('AionUI 41301 promoted evidence must preserve the exact source manifest and final Shell binding');
  }

  if (
    !isExactIsoTimestamp(manifest.generated_at) ||
    !isExactIsoTimestamp(sourceManifest.generated_at) ||
    manifest.generated_at !== sourceManifest.generated_at
  ) {
    issues.add('AionUI 41301 promoted and source evidence must share one exact ISO generated_at timestamp');
  }
  if (
    manifest.evidence_scope !== 'route_state_non_empty_and_layout_only' ||
    sourceManifest.evidence_scope !== manifest.evidence_scope
  ) {
    issues.add('AionUI 41301 promoted and source evidence must share the route-state and layout-only evidence_scope');
  }
  if (!hasExactRecord(sourceClaims, expectedClaims) || !hasExactRecord(sourceClaims, claims)) {
    issues.add('AionUI 41301 promoted and source evidence claims must be identical and limited to the governed claim set');
  }

  const ids = new Set<string>();
  for (const entry of entries) {
    const id = typeof entry.id === 'string' ? entry.id : '';
    const screenshotPath = typeof entry.screenshot_path === 'string' ? entry.screenshot_path : '';
    const filePath = path.join(root, screenshotPath);
    if (
      !id ||
      ids.has(id) ||
      !screenshotPath.startsWith('docs/product/gui/evidence/aionui-41301/screenshots/') ||
      !fs.existsSync(filePath) ||
      entry.bytes !== fs.statSync(filePath).size ||
      entry.sha256 !== sha256(filePath)
    ) {
      issues.add(
        `AionUI 41301 visual evidence entry ${id || '<missing>'} must bind a unique promoted screenshot with exact bytes and SHA-256`,
      );
    }
    ids.add(id);
  }

  const promotedEntryIds = entries.map((entry) => entry.id);
  const sourceEntryIds = sourceEntries.map((entry) => entry.id);
  if (JSON.stringify(promotedEntryIds) !== JSON.stringify(sourceEntryIds)) {
    issues.add('AionUI 41301 promoted and source evidence must preserve the same ordered entry ID set');
  }

  for (const entry of sourceEntries) {
    const anchors = Array.isArray(entry.anchors) ? entry.anchors.map(record) : [];
    const layoutChecks = Array.isArray(entry.layout_checks) ? entry.layout_checks.map(record) : [];
    const coverageGaps = Array.isArray(entry.coverage_gaps) ? entry.coverage_gaps : [];
    if (
      entry.shell_head !== historicalPixelShellSha ||
      anchors.length === 0 ||
      anchors.some((anchor) => anchor.matched !== true) ||
      layoutChecks.length === 0 ||
      layoutChecks.some((check) => check.passed !== true) ||
      coverageGaps.length !== 0
    ) {
      issues.add(`AionUI 41301 source evidence entry ${String(entry.id)} must pass every anchor/layout check with no declared gap`);
    }
  }

  return entries.length;
}
