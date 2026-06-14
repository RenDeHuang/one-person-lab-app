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

function pushOneShotInstallerMarkdown(lines: string[], summary: ReleaseReadinessMarkdownSummary) {
  const oneShotFields = summary.gates.one_shot_app_installer?.fields;
  if (!oneShotFields) return;
  const coreProgress = objectField(oneShotFields, 'core_progress');
  const coreProgressText = coreProgress
    ? `${String(coreProgress.completed ?? '?')}/${String(coreProgress.total ?? '?')}`
    : 'unknown';
  lines.push(
    '',
    '### One-shot installer',
    '',
    `- Entry: ${String(oneShotFields.installer_entry ?? '')}`,
    `- Bootstrap status source: ${String(oneShotFields.bootstrap_status_source ?? '')}`,
    `- Initialization source: ${String(oneShotFields.initialization_source ?? '')}`,
    `- Artifact files: ${arrayField(oneShotFields, 'artifact_files').join(', ')}`,
    `- setup_flow: ${String(oneShotFields.setup_flow_status ?? 'unknown')}`,
    `- core: ${coreProgressText}`,
    `- retry: ${String(oneShotFields.retry_detected ?? 'unknown')}`,
    `- skip_modules: ${String(oneShotFields.skip_modules ?? 'unknown')}`,
  );
}

function pushFullBuildSegmentMarkdown(lines: string[], summary: ReleaseReadinessMarkdownSummary) {
  const breakdown = summary.full_package.duration_seconds?.full_package_build_breakdown;
  if (!breakdown || typeof breakdown !== 'object') return;
  lines.push('', '| Full build segment | Seconds |', '| --- | ---: |');
  for (const [key, value] of Object.entries(breakdown)) {
    lines.push(`| ${key} | ${String(value)} |`);
  }
}

function pushWarningMarkdown(lines: string[], summary: ReleaseReadinessMarkdownSummary) {
  if (summary.warnings.length === 0) return;
  lines.push('', '### Warnings', '');
  for (const warning of summary.warnings) {
    const record = warning as Record<string, unknown>;
    lines.push(`- Full DMG size warning: ${String(record.message ?? record.code ?? 'warning')}`);
  }
}

function pushFullPackageSizeAnalysisMarkdown(lines: string[], summary: ReleaseReadinessMarkdownSummary) {
  const sizeAnalysis = summary.full_package.size_analysis;
  const topContributors = objectField(sizeAnalysis, 'top_contributors');
  const topLayers = arrayField(topContributors, 'layers').slice(0, 5) as Record<string, unknown>[];
  const topComponents = arrayField(topContributors, 'components').slice(0, 5) as Record<string, unknown>[];
  const optimizationCandidates = arrayField(sizeAnalysis, 'optimization_candidates').slice(0, 8) as Record<string, unknown>[];
  if (sizeAnalysis) {
    const budget = objectField(sizeAnalysis, 'budget');
    const compressedFullDmg = objectField(budget, 'compressed_full_dmg');
    const runtimeUncompressed = objectField(budget, 'runtime_uncompressed');
    lines.push(
      '',
      '### Full package size analysis',
      '',
      `- Source: ${String(sizeAnalysis.source ?? 'unknown')}`,
      `- Full DMG: ${String(compressedFullDmg?.full_dmg_size_bytes ?? 'n/a')} bytes; warning=${String(compressedFullDmg?.warning_status ?? 'n/a')}; review=${String(compressedFullDmg?.review_threshold_status ?? 'n/a')}; release_blocking=${String(compressedFullDmg?.release_blocking ?? false)}`,
      `- Runtime uncompressed: ${String(runtimeUncompressed?.total_runtime_uncompressed_bytes ?? 'n/a')} bytes; budget_status=${String(runtimeUncompressed?.status ?? 'n/a')}; used=${String(runtimeUncompressed?.used_percent ?? 'n/a')}%`,
    );
  }
  if (topLayers.length > 0) {
    lines.push('', '| Top Full runtime layer | Size bytes | Runtime % |', '| --- | ---: | ---: |');
    for (const entry of topLayers) {
      lines.push(`| ${String(entry.id)} | ${String(entry.size_bytes ?? 'n/a')} | ${String(entry.runtime_percent ?? 'n/a')} |`);
    }
  }
  if (topComponents.length > 0) {
    lines.push('', '| Top Full component | Size bytes | Runtime % |', '| --- | ---: | ---: |');
    for (const entry of topComponents) {
      lines.push(`| ${String(entry.id)} | ${String(entry.size_bytes ?? 'n/a')} | ${String(entry.runtime_percent ?? 'n/a')} |`);
    }
  }
  if (optimizationCandidates.length > 0) {
    lines.push('', '| Full size optimization candidate | Kind | Size bytes | Reason |', '| --- | --- | ---: | --- |');
    for (const entry of optimizationCandidates) {
      lines.push(`| ${String(entry.id)} | ${String(entry.kind)} | ${String(entry.size_bytes ?? 'n/a')} | ${String(entry.reason ?? '')} |`);
    }
  }
}

function pushRuntimeCacheMarkdown(lines: string[], summary: ReleaseReadinessMarkdownSummary) {
  if ((summary.full_package.runtime_cache?.miss_written_count ?? 0) > 0) {
    lines.push(
      '',
      `- Runtime cache miss_written layers: ${(summary.full_package.runtime_cache?.miss_written_layers ?? []).join(', ')}`,
    );
  }
}

export function writeReleaseReadinessMarkdown(
  filePath: string,
  summary: ReleaseReadinessMarkdownSummary,
) {
  if (!filePath) return;
  const lines = [
    '## Release Readiness Summary',
    '',
    `- Status: ${summary.status}`,
    `- Version: ${summary.version}`,
    `- Release mode: ${summary.release_mode}`,
    `- Full package: ${summary.include_full_package ? 'included' : 'not included'}`,
    `- VM smoke: ${summary.run_vm_smoke ? 'enabled' : 'disabled'}`,
    '- Artifact policy: small diagnostic artifacts only; no standard or Full DMG download in this aggregation job.',
    '',
    '| Gate | Required | Status | Artifact | Reason |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const [id, gate] of Object.entries(summary.gates)) {
    lines.push(`| ${id} | ${gate.required ? 'yes' : 'no'} | ${gate.status} | ${gate.artifact_name ?? ''} | ${gate.reason ?? ''} |`);
  }
  pushOneShotInstallerMarkdown(lines, summary);
  pushFullBuildSegmentMarkdown(lines, summary);
  pushWarningMarkdown(lines, summary);
  pushFullPackageSizeAnalysisMarkdown(lines, summary);
  pushRuntimeCacheMarkdown(lines, summary);
  lines.push('');
  writeLinesFile(filePath, lines);
}
