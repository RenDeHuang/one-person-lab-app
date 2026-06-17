import { writeLinesFile } from './release-file-helpers.ts';
import { arrayField, objectField } from './release-json-helpers.ts';

type MarkdownGateSummary = {
  status: string;
  required: boolean;
  artifact_name?: unknown;
  reason?: unknown;
  fields?: Record<string, unknown> | null;
};

type ReleaseReadinessMarkdownSummary = {
  status: string;
  version: string;
  release_mode: string;
  include_full_package: boolean;
  run_vm_smoke: boolean;
  warnings: unknown[];
  bottlenecks?: unknown[];
  optimization_recommendations?: unknown[];
  gates: Record<string, MarkdownGateSummary>;
  full_package: {
    duration_seconds?: {
      full_package_build_breakdown?: Record<string, unknown>;
    } | null;
    size_analysis?: Record<string, unknown> | null;
    runtime_cache?: {
      miss_written_count?: number;
      miss_written_layers?: string[];
    } | null;
  };
};

function valueText(value: unknown, fallback = '') {
  return String(value ?? fallback);
}

function recordText(record: Record<string, unknown> | null | undefined, key: string, fallback = '') {
  return valueText(record?.[key], fallback);
}

function requiredText(required: boolean) {
  return required ? 'yes' : 'no';
}

function progressText(progress: Record<string, unknown> | null) {
  if (!progress) return 'unknown';
  return `${recordText(progress, 'completed', '?')}/${recordText(progress, 'total', '?')}`;
}

function recordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)) as Record<string, unknown>[]
    : [];
}

function headerMarkdown(summary: ReleaseReadinessMarkdownSummary) {
  return [
    '## Release Readiness Summary',
    '',
    `- Status: ${summary.status}`,
    `- Version: ${summary.version}`,
    `- Release mode: ${summary.release_mode}`,
    `- Full package: ${summary.include_full_package ? 'included' : 'not included'}`,
    `- VM smoke: ${summary.run_vm_smoke ? 'enabled' : 'disabled'}`,
    '- Artifact policy: small diagnostic artifacts only; no standard or Full DMG download in this aggregation job.',
  ];
}

function gateTableMarkdown(summary: ReleaseReadinessMarkdownSummary) {
  return [
    '',
    '| Gate | Required | Status | Artifact | Reason |',
    '| --- | --- | --- | --- | --- |',
    ...Object.entries(summary.gates).map(([id, gate]) => (
      `| ${id} | ${requiredText(gate.required)} | ${gate.status} | ${gate.artifact_name ?? ''} | ${gate.reason ?? ''} |`
    )),
  ];
}

function pushOneShotInstallerMarkdown(lines: string[], summary: ReleaseReadinessMarkdownSummary) {
  const oneShotFields = summary.gates.one_shot_app_installer?.fields;
  if (!oneShotFields) return;
  lines.push(
    '',
    '### One-shot installer',
    '',
    `- Entry: ${recordText(oneShotFields, 'installer_entry')}`,
    `- Bootstrap status source: ${recordText(oneShotFields, 'bootstrap_status_source')}`,
    `- Initialization source: ${recordText(oneShotFields, 'initialization_source')}`,
    `- Artifact files: ${arrayField(oneShotFields, 'artifact_files').join(', ')}`,
    `- setup_flow: ${recordText(oneShotFields, 'setup_flow_status', 'unknown')}`,
    `- core: ${progressText(objectField(oneShotFields, 'core_progress'))}`,
    `- retry: ${recordText(oneShotFields, 'retry_detected', 'unknown')}`,
    `- skip_modules: ${recordText(oneShotFields, 'skip_modules', 'unknown')}`,
  );
}

function pushFullBuildSegmentMarkdown(lines: string[], summary: ReleaseReadinessMarkdownSummary) {
  const breakdown = summary.full_package.duration_seconds?.full_package_build_breakdown;
  if (!breakdown || typeof breakdown !== 'object') return;
  lines.push(
    '',
    '| Full build segment | Seconds |',
    '| --- | ---: |',
    ...Object.entries(breakdown).map(([key, value]) => `| ${key} | ${String(value)} |`),
  );
}

function pushWarningMarkdown(lines: string[], summary: ReleaseReadinessMarkdownSummary) {
  if (summary.warnings.length === 0) return;
  lines.push('', '### Warnings', '');
  for (const warning of summary.warnings) {
    const record = warning as Record<string, unknown>;
    lines.push(`- Full DMG size warning: ${valueText(record.message ?? record.code, 'warning')}`);
  }
}

function pushFullPackageBudgetMarkdown(lines: string[], sizeAnalysis: Record<string, unknown>) {
  const budget = objectField(sizeAnalysis, 'budget');
  const compressedFullDmg = objectField(budget, 'compressed_full_dmg');
  const runtimeUncompressed = objectField(budget, 'runtime_uncompressed');
  lines.push(
    '',
    '### Full package size analysis',
    '',
    `- Source: ${recordText(sizeAnalysis, 'source', 'unknown')}`,
    `- Full DMG: ${recordText(compressedFullDmg, 'full_dmg_size_bytes', 'n/a')} bytes; warning=${recordText(compressedFullDmg, 'warning_status', 'n/a')}; review=${recordText(compressedFullDmg, 'review_threshold_status', 'n/a')}; release_blocking=${recordText(compressedFullDmg, 'release_blocking', 'false')}`,
    `- Runtime uncompressed: ${recordText(runtimeUncompressed, 'total_runtime_uncompressed_bytes', 'n/a')} bytes; budget_status=${recordText(runtimeUncompressed, 'status', 'n/a')}; used=${recordText(runtimeUncompressed, 'used_percent', 'n/a')}%`,
  );
}

function pushSizeEntriesTable(
  lines: string[],
  entries: Record<string, unknown>[],
  heading: string,
) {
  if (entries.length === 0) return;
  lines.push(
    '',
    `| ${heading} | Size bytes | Runtime % |`,
    '| --- | ---: | ---: |',
    ...entries.map((entry) => (
      `| ${recordText(entry, 'id')} | ${recordText(entry, 'size_bytes', 'n/a')} | ${recordText(entry, 'runtime_percent', 'n/a')} |`
    )),
  );
}

function pushOptimizationCandidateTable(lines: string[], entries: Record<string, unknown>[]) {
  if (entries.length === 0) return;
  lines.push(
    '',
    '| Full size optimization candidate | Kind | Size bytes | Reason |',
    '| --- | --- | ---: | --- |',
    ...entries.map((entry) => (
      `| ${recordText(entry, 'id')} | ${recordText(entry, 'kind')} | ${recordText(entry, 'size_bytes', 'n/a')} | ${recordText(entry, 'reason')} |`
    )),
  );
}

function pushBottleneckTable(lines: string[], entries: Record<string, unknown>[]) {
  if (entries.length === 0) return;
  lines.push(
    '',
    '### Bottlenecks',
    '',
    '| Bottleneck | Category | Evidence | Signal | Reason |',
    '| --- | --- | --- | --- | --- |',
    ...entries.map((entry) => {
      const signal = [
        recordText(entry, 'duration_seconds'),
        recordText(entry, 'size_bytes'),
        recordText(entry, 'miss_written_count'),
      ].find((value) => value !== '') ?? '';
      return `| ${recordText(entry, 'id')} | ${recordText(entry, 'category')} | ${recordText(entry, 'source')} | ${signal} | ${recordText(entry, 'reason')} |`;
    }),
  );
}

function pushOptimizationRecommendationTable(lines: string[], entries: Record<string, unknown>[]) {
  if (entries.length === 0) return;
  lines.push(
    '',
    '### Optimization recommendations',
    '',
    '| Recommendation | Category | Evidence | Reason |',
    '| --- | --- | --- | --- |',
    ...entries.map((entry) => (
      `| ${recordText(entry, 'id')} | ${recordText(entry, 'category')} | ${recordText(entry, 'source')} | ${recordText(entry, 'reason')} |`
    )),
  );
}

function pushFullPackageSizeAnalysisMarkdown(lines: string[], summary: ReleaseReadinessMarkdownSummary) {
  const sizeAnalysis = summary.full_package.size_analysis;
  const topContributors = objectField(sizeAnalysis, 'top_contributors');
  const topLayers = arrayField(topContributors, 'layers').slice(0, 5) as Record<string, unknown>[];
  const topComponents = arrayField(topContributors, 'components').slice(0, 5) as Record<string, unknown>[];
  const optimizationCandidates = arrayField(sizeAnalysis, 'optimization_candidates').slice(0, 8) as Record<string, unknown>[];
  if (sizeAnalysis) {
    pushFullPackageBudgetMarkdown(lines, sizeAnalysis);
  }
  pushSizeEntriesTable(lines, topLayers, 'Top Full runtime layer');
  pushSizeEntriesTable(lines, topComponents, 'Top Full component');
  pushOptimizationCandidateTable(lines, optimizationCandidates);
}

function pushRuntimeCacheMarkdown(lines: string[], summary: ReleaseReadinessMarkdownSummary) {
  const runtimeCache = summary.full_package.runtime_cache;
  if (!runtimeCache?.miss_written_count) return;
  lines.push('', `- Runtime cache miss_written layers: ${(runtimeCache.miss_written_layers ?? []).join(', ')}`);
}

export function writeReleaseReadinessMarkdown(
  filePath: string,
  summary: ReleaseReadinessMarkdownSummary,
) {
  if (!filePath) return;
  const lines = [...headerMarkdown(summary), ...gateTableMarkdown(summary)];
  pushOneShotInstallerMarkdown(lines, summary);
  pushFullBuildSegmentMarkdown(lines, summary);
  pushWarningMarkdown(lines, summary);
  pushBottleneckTable(lines, recordArray(summary.bottlenecks));
  pushOptimizationRecommendationTable(lines, recordArray(summary.optimization_recommendations));
  pushFullPackageSizeAnalysisMarkdown(lines, summary);
  pushRuntimeCacheMarkdown(lines, summary);
  lines.push('');
  writeLinesFile(filePath, lines);
}
