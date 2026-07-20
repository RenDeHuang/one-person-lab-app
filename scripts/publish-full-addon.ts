#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { assertReleaseVersionNotFuture } from './release-version.ts';

type Asset = { name: string; size: number; digest: string };

function sha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function gh(args: string[], timeoutMs = 15 * 60 * 1000): string {
  const result = spawnSync('gh', args, { encoding: 'utf8', env: process.env, timeout: timeoutMs });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `gh ${args.join(' ')} failed`).trim());
  return result.stdout;
}

type FullAddonDeadlineValidation = {
  schema: string;
  status: string;
  mode: string;
  version: string;
  stable_session_id: string;
  release_cohort_ref: string;
  workflow: string;
  attempt_id: string;
  exact_run_id: string | null;
  full_addon_deadline_at: string | null;
  signed_lookup_envelope?: {
    record?: { acceptance?: { full_addon_deadline_at?: string | null } };
  } | null;
};

export function remainingFullAddonMutationBudgetMs(
  validationPath: string,
  expected: { version: string; stableSessionId: string; releaseCohortRef: string; attemptId: string; runId: string },
  observedAtMs = Date.now(),
): number {
  const validation = JSON.parse(fs.readFileSync(path.resolve(validationPath), 'utf8')) as FullAddonDeadlineValidation;
  const deadlineAt = validation.full_addon_deadline_at;
  const signedDeadline = validation.signed_lookup_envelope?.record?.acceptance?.full_addon_deadline_at ?? null;
  const deadlineAtMs = Date.parse(String(deadlineAt));
  if (
    validation.schema !== 'opl_app_release_broker_workflow_acceptance_validation.v1' ||
    validation.status !== 'verified' || validation.mode !== 'historical' ||
    validation.version !== expected.version || validation.stable_session_id !== expected.stableSessionId ||
    validation.release_cohort_ref !== expected.releaseCohortRef ||
    validation.workflow !== 'desktop-release-full-addon.yml' || validation.attempt_id !== expected.attemptId ||
    validation.exact_run_id !== expected.runId || deadlineAt !== signedDeadline || !deadlineAt ||
    !Number.isFinite(deadlineAtMs) || new Date(deadlineAtMs).toISOString() !== deadlineAt
  ) {
    throw new Error('Full add-on publication deadline validation is not bound to the exact signed run identity.');
  }
  const remainingMs = deadlineAtMs - observedAtMs;
  if (remainingMs <= 0) throw new Error('full_addon_deadline_elapsed: release asset mutation is forbidden.');
  return remainingMs;
}

function releaseView(repo: string, tag: string): { tagName: string; isDraft: boolean; isPrerelease: boolean; publishedAt: string; assets: Asset[] } {
  return JSON.parse(gh(['release', 'view', tag, '--repo', repo, '--json', 'tagName,isDraft,isPrerelease,publishedAt,assets']));
}

export function planFullAddonUpload(localAssets: Array<{ path: string; name: string; size: number; sha256: string }>, remoteAssets: Asset[]) {
  const remote = new Map(remoteAssets.map((asset) => [asset.name, asset]));
  return localAssets.map((asset) => {
    const existing = remote.get(asset.name);
    if (!existing) return { ...asset, action: 'upload' as const };
    const remoteDigest = String(existing.digest || '').replace(/^sha256:/, '').toLowerCase();
    if (existing.size !== asset.size || remoteDigest !== asset.sha256) {
      throw new Error(`Published Full add-on asset ${asset.name} already exists with different bytes; create a new version.`);
    }
    return { ...asset, action: 'reuse' as const };
  });
}

function main() {
  const { values } = parseArgs({ options: {
    version: { type: 'string' }, repo: { type: 'string', default: 'gaofeng21cn/one-person-lab-app' },
    'full-package-dir': { type: 'string' }, output: { type: 'string' },
    'stable-session-id': { type: 'string' }, 'release-cohort-ref': { type: 'string' },
    'app-sha': { type: 'string' }, 'shell-sha': { type: 'string' }, 'framework-sha': { type: 'string' },
    'qualification-run-id': { type: 'string' }, 'source-artifact-run-id': { type: 'string' },
    'release-set-generation': { type: 'string' }, 'release-set-manifest-digest': { type: 'string' },
    'qualification-input-manifest-sha256': { type: 'string' }, 'full-input-manifest-sha256': { type: 'string' },
    'framework-bundled-catalog-sha256': { type: 'string' }, 'full-toolchain-observation-receipt-sha256': { type: 'string' },
    'release-attempt-id': { type: 'string' }, 'deadline-validation': { type: 'string' },
    'dry-run': { type: 'boolean' },
  }, strict: true });
  if (!values.version) throw new Error('Missing --version.');
  assertReleaseVersionNotFuture('stable', values.version);
  for (const key of ['full-package-dir', 'output', 'stable-session-id', 'release-cohort-ref', 'app-sha', 'shell-sha', 'framework-sha', 'qualification-run-id', 'source-artifact-run-id', 'release-set-generation', 'release-set-manifest-digest', 'qualification-input-manifest-sha256', 'full-input-manifest-sha256', 'framework-bundled-catalog-sha256', 'full-toolchain-observation-receipt-sha256'] as const) {
    if (!values[key]) throw new Error(`Missing --${key}.`);
  }
  if (!values['dry-run']) {
    if (!values['release-attempt-id'] || !/^sha256:[0-9a-f]{64}$/.test(values['release-attempt-id'])) {
      throw new Error('Full add-on publication requires an exact --release-attempt-id.');
    }
    if (!values['deadline-validation']) throw new Error('Full add-on publication requires --deadline-validation.');
  }
  for (const key of ['stable-session-id', 'release-cohort-ref', 'release-set-manifest-digest'] as const) {
    if (!/^sha256:[0-9a-f]{64}$/.test(values[key]!)) throw new Error(`--${key} must be a lowercase sha256 ref.`);
  }
  for (const key of ['app-sha', 'shell-sha', 'framework-sha'] as const) {
    if (!/^[0-9a-f]{40}$/.test(values[key]!)) throw new Error(`--${key} must be a lowercase 40-character Git SHA.`);
  }
  for (const key of ['qualification-input-manifest-sha256', 'full-input-manifest-sha256', 'framework-bundled-catalog-sha256', 'full-toolchain-observation-receipt-sha256'] as const) {
    if (!/^[0-9a-f]{64}$/.test(values[key]!)) throw new Error(`--${key} must be a lowercase SHA-256 digest.`);
  }
  const tag = `v${values.version}`;
  const release = releaseView(values.repo!, tag);
  if (release.tagName !== tag || release.isDraft || release.isPrerelease || !release.publishedAt) {
    throw new Error('Full add-on requires the exact already-published Stable release.');
  }
  const dir = path.resolve(values['full-package-dir']!);
  const names = [`One-Person-Lab-Full-${values.version}-mac-arm64.dmg`, 'opl-release-manifest.json'];
  const localAssets = names.map((name) => {
    const filePath = path.join(dir, name);
    if (!fs.existsSync(filePath)) throw new Error(`Missing Full add-on asset ${filePath}.`);
    return { path: filePath, name, size: fs.statSync(filePath).size, sha256: sha256(filePath) };
  });
  const manifest = JSON.parse(fs.readFileSync(localAssets[1].path, 'utf8'));
  if (manifest.schema !== 'opl_public_release_manifest.v1' || manifest.version !== values.version
    || manifest.primary_install_asset !== localAssets[0].name
    || !manifest.assets?.some((asset: Record<string, unknown>) => asset.name === localAssets[0].name
      && asset.sha256 === localAssets[0].sha256 && asset.size_bytes === localAssets[0].size)) {
    throw new Error('Full public manifest does not bind the local Full DMG bytes.');
  }
  let plan = planFullAddonUpload(localAssets, release.assets || []);
  if (!values['dry-run']) {
    const deadlineExpected = {
      version: values.version!, stableSessionId: values['stable-session-id']!,
      releaseCohortRef: values['release-cohort-ref']!, attemptId: values['release-attempt-id']!,
      runId: values['qualification-run-id']!,
    };
    for (const asset of plan.filter((entry) => entry.action === 'upload')) {
      const remainingMs = remainingFullAddonMutationBudgetMs(values['deadline-validation']!, deadlineExpected);
      gh(['release', 'upload', tag, asset.path, '--repo', values.repo!], Math.max(1, Math.min(15 * 60 * 1000, remainingMs)));
    }
    plan = planFullAddonUpload(localAssets, releaseView(values.repo!, tag).assets || []);
    if (plan.some((entry) => entry.action !== 'reuse')) throw new Error('Full add-on remote digest readback did not converge.');
  }
  const receipt = {
    schema: 'opl_app_full_addon_receipt.v1', status: values['dry-run'] ? 'planned' : 'verified',
    version: values.version, tag, repo: values.repo, stable_session_id: values['stable-session-id'],
    release_cohort_ref: values['release-cohort-ref'], cohort: { app_sha: values['app-sha'], shell_sha: values['shell-sha'], framework_sha: values['framework-sha'] },
    release_set: { generation: values['release-set-generation'], manifest_digest: values['release-set-manifest-digest'] },
    source_authority: {
      qualification_input_manifest_sha256: values['qualification-input-manifest-sha256'],
      full_input_manifest_sha256: values['full-input-manifest-sha256'],
      framework_bundled_catalog_sha256: values['framework-bundled-catalog-sha256'],
      full_toolchain_observation_receipt_sha256: values['full-toolchain-observation-receipt-sha256'],
    },
    qualification: { run_id: values['qualification-run-id'], source_artifact_run_id: values['source-artifact-run-id'], result: 'passed' },
    mutation_policy: { mode: 'additive_only', standard_assets_modified: false, updater_metadata_modified: false, latest_modified: false, release_notes_modified: false },
    assets: plan.map(({ path: _path, ...asset }) => asset),
  };
  fs.writeFileSync(path.resolve(values.output!), `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); }
}
