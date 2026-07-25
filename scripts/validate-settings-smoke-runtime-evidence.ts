#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

type JsonRecord = Record<string, unknown>;

const requiredRoutes = [
  {
    id: 'runtime-settings-alias',
    requestedHash: '#/settings/runtime',
    resolvedHashPrefixes: ['#/settings/environment'],
  },
  {
    id: 'runtime-status',
    requestedHash: '#/runtime',
    resolvedHashPrefixes: ['#/runtime'],
  },
] as const;

function object(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonRecord;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function assertResolvedHash(value: unknown, prefixes: readonly string[], label: string): string {
  const resolvedHash = string(value, label);
  if (!prefixes.some((prefix) => resolvedHash.startsWith(prefix))) {
    throw new Error(`${label} must resolve to ${prefixes.join(' or ')}, got ${resolvedHash}.`);
  }
  return resolvedHash;
}

export function validateSettingsSmokeRuntimeEvidence(value: unknown) {
  const summary = object(value, 'Settings smoke summary');
  if (summary.surface_id !== 'opl_packaged_gui_settings_smoke' || summary.status !== 'passed') {
    throw new Error('Settings smoke summary must be the passed packaged GUI Settings surface.');
  }
  if (!Array.isArray(summary.pages)) throw new Error('Settings smoke summary pages must be an array.');

  const routes = requiredRoutes.map((expected) => {
    const matches = summary.pages.filter((entry) => {
      const page = object(entry, 'Settings smoke page');
      return page.id === expected.id || page.requested_hash === expected.requestedHash;
    });
    if (matches.length !== 1) {
      throw new Error(
        `Settings smoke summary must contain exactly one ${expected.requestedHash} Runtime refresh entry; found ${matches.length}.`,
      );
    }

    const page = object(matches[0], `${expected.requestedHash} page`);
    if (page.id !== expected.id || page.requested_hash !== expected.requestedHash) {
      throw new Error(`${expected.requestedHash} Runtime refresh entry has the wrong id or requested_hash.`);
    }
    const resolvedHash = assertResolvedHash(
      page.resolved_hash,
      expected.resolvedHashPrefixes,
      `${expected.requestedHash} resolved_hash`,
    );
    const interactions = object(page.interactions, `${expected.requestedHash} interactions`);
    const refresh = object(interactions.runtimeRefresh, `${expected.requestedHash} runtimeRefresh`);
    if (refresh.requested_hash !== expected.requestedHash || refresh.resolved_hash !== resolvedHash) {
      throw new Error(`${expected.requestedHash} nested Runtime refresh identity does not match the page evidence.`);
    }
    const readiness = object(refresh.readiness, `${expected.requestedHash} readiness`);
    if (readiness.pageReady !== true || !['ready', 'empty'].includes(String(readiness.state ?? ''))) {
      throw new Error(`${expected.requestedHash} Runtime page was not structurally ready.`);
    }
    const readinessHash = assertResolvedHash(
      readiness.hash,
      expected.resolvedHashPrefixes,
      `${expected.requestedHash} readiness hash`,
    );
    if (readinessHash !== resolvedHash) {
      throw new Error(`${expected.requestedHash} readiness hash does not match the resolved page evidence.`);
    }
    const interaction = object(refresh.refresh, `${expected.requestedHash} refresh interaction`);
    const beforeClick = object(interaction.before_click, `${expected.requestedHash} pre-click state`);
    const afterClick = object(interaction.after_click, `${expected.requestedHash} post-click state`);
    if (beforeClick.buttonReady !== true || afterClick.buttonReady !== true) {
      throw new Error(`${expected.requestedHash} Runtime refresh button was not idle before and after the click.`);
    }

    return {
      id: expected.id,
      requested_hash: expected.requestedHash,
      resolved_hash: resolvedHash,
      readiness_state: readiness.state,
    };
  });

  return {
    schema: 'opl_settings_runtime_refresh_evidence_verification.v1',
    status: 'passed',
    production_default_targets_required: true,
    synthetic_target_injection_allowed: false,
    routes,
  };
}

function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { summary: { type: 'string' } },
    strict: true,
  });
  if (!values.summary) throw new Error('Pass --summary <settings-smoke-summary.json>.');
  const summaryPath = path.resolve(values.summary);
  const stat = fs.lstatSync(summaryPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error(`Settings smoke summary must be a non-empty regular file: ${summaryPath}`);
  }
  const result = validateSettingsSmokeRuntimeEvidence(JSON.parse(fs.readFileSync(summaryPath, 'utf8')));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
