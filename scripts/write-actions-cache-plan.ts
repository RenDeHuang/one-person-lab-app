#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const PLAN_SCHEMA = 'opl_actions_cache_plan.v1';
const RECEIPT_SCHEMA = 'opl_actions_cache_receipt.v1';
const DEFAULT_WRITER_REF = 'refs/heads/main';
const RUNTIME_LAYER_IDS = ['toolchain', 'domain-runtime', 'opl-runtime', 'skills'] as const;
const SAVE_OUTCOMES = ['success', 'failure', 'skipped'] as const;
const shaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const truthBoundary = 'Cache evidence is acceleration evidence only and cannot claim artifact identity or release readiness.';

type RuntimeLayerId = typeof RUNTIME_LAYER_IDS[number];
type SaveOutcome = typeof SAVE_OUTCOMES[number];
type JsonRecord = Record<string, any>;

export type ActionsCachePlanInput = {
  mode: 'cache_only_warmup' | 'full_package';
  workflow: string;
  ref: string;
  appSha: string;
  shellSha: string;
  frameworkSha: string;
  runnerOs: string;
  runnerArch: string;
  catalogSha256: string;
  runtimeKeyReport: JsonRecord;
};

export type ActionsCacheReceiptInput = {
  plan: JsonRecord;
  runtimeEvents: JsonRecord;
  saveOutcomes: Record<RuntimeLayerId, SaveOutcome>;
};

function digestJson(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function fileSha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function requireSha(value: string, label: string): string {
  const normalized = value.toLowerCase();
  if (!shaPattern.test(normalized)) {
    throw new Error(`${label} must be an exact 40-character Git SHA`);
  }
  return normalized;
}

function runtimeLayersFromReport(report: JsonRecord, runnerOs: string, runnerArch: string) {
  const layers = report.layers as JsonRecord | undefined;
  if (!layers) throw new Error('runtime key report must contain layers');
  return RUNTIME_LAYER_IDS.map((layerId) => {
    const runtimeKey = requireString(layers[layerId], `runtime key ${layerId}`);
    return {
      layer_id: layerId,
      runtime_key: runtimeKey,
      actions_key: `opl-full-runtime-layer-${runnerOs}-${runnerArch}-${runtimeKey}`,
      restore_mode: 'exact_only',
    };
  });
}

export function buildActionsCachePlan(input: ActionsCachePlanInput): JsonRecord {
  if (!['cache_only_warmup', 'full_package'].includes(input.mode)) {
    throw new Error(`unsupported cache plan mode: ${input.mode}`);
  }
  const ref = requireString(input.ref, 'ref');
  if (input.mode === 'cache_only_warmup' && ref !== DEFAULT_WRITER_REF) {
    throw new Error(`cache-only warmup plans must use ${DEFAULT_WRITER_REF}`);
  }
  if (!/^[0-9a-f]{64}$/.test(input.catalogSha256)) {
    throw new Error('catalogSha256 must be a 64-character SHA-256 digest');
  }
  const runner = {
    os: requireString(input.runnerOs, 'runnerOs'),
    arch: requireString(input.runnerArch, 'runnerArch'),
  };
  const payload = {
    schema: PLAN_SCHEMA,
    mode: input.mode,
    workflow: requireString(input.workflow, 'workflow'),
    ref,
    writer_eligible: ref === DEFAULT_WRITER_REF,
    cohort: {
      app_sha: requireSha(input.appSha, 'appSha'),
      shell_sha: requireSha(input.shellSha, 'shellSha'),
      framework_sha: requireSha(input.frameworkSha, 'frameworkSha'),
    },
    runner,
    catalog_sha256: input.catalogSha256,
    runtime_cache_aggregate_key_input: input.runtimeKeyReport.aggregate_key_input ?? null,
    runtime_layers: runtimeLayersFromReport(
      input.runtimeKeyReport,
      runner.os,
      runner.arch,
    ),
    truth_boundary: truthBoundary,
  };
  return {
    ...payload,
    identity: digestJson(payload),
  };
}

export function validateActionsCachePlan(plan: JsonRecord): void {
  if (plan.schema !== PLAN_SCHEMA) throw new Error(`cache plan schema must be ${PLAN_SCHEMA}`);
  if (!digestPattern.test(String(plan.identity ?? ''))) throw new Error('cache plan identity must be sha256:<digest>');
  const { identity, ...payload } = plan;
  if (digestJson(payload) !== identity) throw new Error('cache plan identity does not match its payload');
  if (!['cache_only_warmup', 'full_package'].includes(plan.mode)) {
    throw new Error('cache plan mode is unsupported');
  }
  requireString(plan.workflow, 'cache plan workflow');
  const ref = requireString(plan.ref, 'cache plan ref');
  if (plan.writer_eligible !== (ref === DEFAULT_WRITER_REF)) {
    throw new Error('cache plan writer eligibility does not match its ref');
  }
  if (plan.mode === 'cache_only_warmup' && ref !== DEFAULT_WRITER_REF) {
    throw new Error(`cache-only warmup plans must use ${DEFAULT_WRITER_REF}`);
  }
  const runnerOs = requireString(plan.runner?.os, 'cache plan runner os');
  const runnerArch = requireString(plan.runner?.arch, 'cache plan runner arch');
  for (const [field, value] of Object.entries({
    app_sha: plan.cohort?.app_sha,
    shell_sha: plan.cohort?.shell_sha,
    framework_sha: plan.cohort?.framework_sha,
  })) {
    if (typeof value !== 'string' || !shaPattern.test(value)) {
      throw new Error(`cache plan cohort ${field} must be an exact Git SHA`);
    }
  }
  if (!/^[0-9a-f]{64}$/.test(String(plan.catalog_sha256 ?? ''))) {
    throw new Error('cache plan catalog digest is invalid');
  }
  const layers = Array.isArray(plan.runtime_layers) ? plan.runtime_layers as Array<JsonRecord> : [];
  const layerIds = layers.map((layer) => layer.layer_id);
  if (JSON.stringify(layerIds) !== JSON.stringify(RUNTIME_LAYER_IDS)) {
    throw new Error('cache plan runtime layers must use the canonical ordered layer set');
  }
  for (const layer of layers) {
    const runtimeKeyPattern = new RegExp(`^full-runtime-v[0-9]+-${layer.layer_id}-[0-9a-f]{24}$`);
    if (
      typeof layer.runtime_key !== 'string' || !runtimeKeyPattern.test(layer.runtime_key) ||
      layer.actions_key !== `opl-full-runtime-layer-${runnerOs}-${runnerArch}-${layer.runtime_key}` ||
      layer.restore_mode !== 'exact_only'
    ) {
      throw new Error(`cache plan runtime layer ${String(layer.layer_id)} is invalid`);
    }
  }
  if (plan.truth_boundary !== truthBoundary) {
    throw new Error('cache plan truth boundary is invalid');
  }
}

export function buildActionsCacheReceipt(input: ActionsCacheReceiptInput): JsonRecord {
  validateActionsCachePlan(input.plan);
  const events = Array.isArray(input.runtimeEvents.events) ? input.runtimeEvents.events : [];
  if (events.length !== RUNTIME_LAYER_IDS.length) {
    throw new Error('runtime events must contain exactly one event for each canonical cache layer');
  }
  const eventLayerIds = events.map((event: JsonRecord) => event.layer_id);
  if (
    new Set(eventLayerIds).size !== RUNTIME_LAYER_IDS.length ||
    eventLayerIds.some((layerId: unknown) => !RUNTIME_LAYER_IDS.includes(layerId as RuntimeLayerId))
  ) {
    throw new Error('runtime events contain a missing, duplicated, or unsupported cache layer');
  }
  const eventByLayer = new Map(events.map((event: JsonRecord) => [event.layer_id, event]));
  const planLayers = input.plan.runtime_layers as Array<JsonRecord>;
  const runtimeLayerEvents = planLayers.map((layer) => {
    const event = eventByLayer.get(layer.layer_id) as JsonRecord | undefined;
    if (!event || event.key !== layer.runtime_key) {
      throw new Error(`runtime event for ${layer.layer_id} is missing or does not match the cache plan`);
    }
    const validEventShape =
      (event.status === 'hit' && event.read_archive === true && event.write_archive === false) ||
      (event.status === 'miss_written' && event.read_archive === false && event.write_archive === true);
    if (!validEventShape) {
      throw new Error(`runtime event for ${layer.layer_id} has an invalid status or archive disposition`);
    }
    return {
      layer_id: layer.layer_id,
      runtime_key: layer.runtime_key,
      actions_key: layer.actions_key,
      status: event.status,
      duration_seconds: event.duration_seconds ?? null,
      read_archive: event.read_archive === true,
      write_archive: event.write_archive === true,
    };
  });
  const saveOutcomes = Object.fromEntries(RUNTIME_LAYER_IDS.map((layerId) => {
    const outcome = input.saveOutcomes[layerId];
    if (!SAVE_OUTCOMES.includes(outcome)) {
      throw new Error(`save outcome for ${layerId} must be success, failure, or skipped`);
    }
    const event = eventByLayer.get(layerId) as JsonRecord;
    if (!input.plan.writer_eligible && outcome !== 'skipped') {
      throw new Error(`save outcome for ${layerId} must be skipped when the plan is not writer eligible`);
    }
    if (input.plan.writer_eligible && event.status === 'hit' && outcome !== 'skipped') {
      throw new Error(`save outcome for ${layerId} must be skipped after an exact cache hit`);
    }
    if (
      input.plan.writer_eligible &&
      event.status === 'miss_written' &&
      outcome !== 'success' &&
      outcome !== 'failure'
    ) {
      throw new Error(`save outcome for ${layerId} must record the save attempt after a cache miss`);
    }
    return [layerId, outcome];
  }));
  return {
    schema: RECEIPT_SCHEMA,
    plan_identity: input.plan.identity,
    mode: input.plan.mode,
    writer_eligible: input.plan.writer_eligible,
    runtime_layer_events: runtimeLayerEvents,
    save_outcomes: saveOutcomes,
    truth_boundary: truthBoundary,
  };
}

function parseSaveOutcomes(values: string[] | undefined): Record<RuntimeLayerId, SaveOutcome> {
  const outcomes: Partial<Record<RuntimeLayerId, SaveOutcome>> = {};
  for (const value of values ?? []) {
    const separator = value.indexOf('=');
    const layerId = value.slice(0, separator) as RuntimeLayerId;
    const outcome = value.slice(separator + 1);
    if (
      separator <= 0 ||
      !RUNTIME_LAYER_IDS.includes(layerId) ||
      !SAVE_OUTCOMES.includes(outcome as SaveOutcome) ||
      outcomes[layerId] !== undefined
    ) {
      throw new Error(`invalid --save-outcome value: ${value}`);
    }
    outcomes[layerId] = outcome as SaveOutcome;
  }
  const missing = RUNTIME_LAYER_IDS.filter((layerId) => outcomes[layerId] === undefined);
  if (missing.length > 0) {
    throw new Error(`missing --save-outcome values for: ${missing.join(', ')}`);
  }
  return outcomes as Record<RuntimeLayerId, SaveOutcome>;
}

function parseCommand(argv: string[]) {
  const [command, ...args] = argv;
  if (command !== 'plan' && command !== 'receipt') {
    throw new Error('usage: write-actions-cache-plan.ts <plan|receipt> [options]');
  }
  const { values } = parseArgs({
    args,
    options: {
      output: { type: 'string' },
      catalog: { type: 'string' },
      'runtime-key-report': { type: 'string' },
      'runtime-events': { type: 'string' },
      plan: { type: 'string' },
      mode: { type: 'string' },
      workflow: { type: 'string' },
      ref: { type: 'string' },
      'app-sha': { type: 'string' },
      'shell-sha': { type: 'string' },
      'framework-sha': { type: 'string' },
      'runner-os': { type: 'string' },
      'runner-arch': { type: 'string' },
      'save-outcome': { type: 'string', multiple: true },
    },
    allowPositionals: false,
  });
  return { command, values };
}

function requiredOption(value: string | undefined, name: string): string {
  if (!value) throw new Error(`missing required option --${name}`);
  return value;
}

function main(argv: string[]): void {
  const { command, values } = parseCommand(argv);
  const output = path.resolve(requiredOption(values.output, 'output'));
  if (command === 'plan') {
    const catalogPath = path.resolve(requiredOption(values.catalog, 'catalog'));
    const runtimeKeyReportPath = path.resolve(requiredOption(values['runtime-key-report'], 'runtime-key-report'));
    const plan = buildActionsCachePlan({
      mode: requiredOption(values.mode, 'mode') as ActionsCachePlanInput['mode'],
      workflow: requiredOption(values.workflow, 'workflow'),
      ref: requiredOption(values.ref, 'ref'),
      appSha: requiredOption(values['app-sha'], 'app-sha'),
      shellSha: requiredOption(values['shell-sha'], 'shell-sha'),
      frameworkSha: requiredOption(values['framework-sha'], 'framework-sha'),
      runnerOs: requiredOption(values['runner-os'], 'runner-os'),
      runnerArch: requiredOption(values['runner-arch'], 'runner-arch'),
      catalogSha256: fileSha256(catalogPath),
      runtimeKeyReport: readJson(runtimeKeyReportPath),
    });
    writeJson(output, plan);
    return;
  }

  const receipt = buildActionsCacheReceipt({
    plan: readJson(path.resolve(requiredOption(values.plan, 'plan'))),
    runtimeEvents: readJson(path.resolve(requiredOption(values['runtime-events'], 'runtime-events'))),
    saveOutcomes: parseSaveOutcomes(values['save-outcome']),
  });
  writeJson(output, receipt);
}

const isEntrypoint = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isEntrypoint) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
