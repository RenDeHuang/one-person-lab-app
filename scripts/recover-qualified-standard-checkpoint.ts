#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { validateArtifactQualificationReceipt } from './artifact-qualification-receipt.ts';
import { buildExecutorReceipt } from './framework-release-adapter-plan.ts';
import { readJson, sha256File, writeJson } from './framework-release-adapter-bundle.ts';

const repository = 'gaofeng21cn/one-person-lab-app';
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function command(executable: string, args: string[]) {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${path.basename(executable)} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

export function verifyQualifiedStandardRecovery(input: {
  sourceRunId: string; boundRoot: string; bundleRoot: string; vmRoot: string;
  attemptRoot: string; controlRoot: string; run: any; jobs: any[];
}) {
  const { sourceRunId, boundRoot, bundleRoot, vmRoot, attemptRoot, controlRoot, run, jobs } = input;
  assert.match(sourceRunId, /^[1-9][0-9]*$/);
  assert.equal(String(run.id), sourceRunId);
  assert.equal(run.repository.full_name, repository);
  assert.equal(run.path, '.github/workflows/release-stable.yml');
  assert.equal(run.run_attempt, 1);
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'failure');
  for (const name of ['standard / seal-standard-identity', 'standard / standard-clean-vm-qualification / Clean VM first launch']) {
    assert.equal(jobs.filter(job => job.name === name && job.conclusion === 'success').length, 1, `${name} must have succeeded`);
  }
  assert.equal(jobs.filter(job => job.name === 'standard / checkpoint-standard' && job.conclusion === 'failure').length, 1);
  assert(jobs.filter(job => job.name.includes('publish-standard')).every(job => job.conclusion === 'skipped'), 'publication must never have started');
  const bundle = readJson(path.join(bundleRoot, 'release-bundle.json'));
  const identity = readJson(path.join(boundRoot, 'standard-identity-receipt.json'));
  assert.equal(bundle.release.channel, 'stable');
  assert.equal(run.head_sha, bundle.sources.app.source_commit);
  assert.equal(identity.schema, 'opl_standard_release_identity_receipt.v2');
  assert.equal(identity.status, 'passed');
  assert.deepEqual(identity.source, { repository, run_id: sourceRunId, run_attempt: 1 });
  for (const key of ['channel', 'version', 'updater_version', 'tag']) assert.equal(identity.release[key], bundle.release[key]);
  assert.equal(identity.release.bundle_digest, bundle.bundle_digest);
  assert.deepEqual(identity.cohort, {
    app_sha: bundle.sources.app.source_commit, shell_sha: bundle.sources.shell.source_commit,
    framework_sha: bundle.sources.framework.source_commit,
  });
  // These are the original producer's hashes, including Apple trust sidecars.
  const descriptors = [identity.updater_metadata, identity.updater_compatibility_metadata, identity.updater_zip,
    identity.universal_installer, identity.component_manifest, identity.apple_distribution_trust.gatekeeper_policy,
    identity.apple_distribution_trust.notarization_receipt, identity.apple_distribution_trust.final_dmg];
  for (const descriptor of descriptors) {
    assert.equal(path.basename(descriptor.name), descriptor.name);
    const file = path.join(boundRoot, 'assets', descriptor.name);
    assert(fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink());
    assert.equal(`sha256:${sha256File(file)}`, descriptor.sha256);
  }
  const qualificationPath = path.join(vmRoot, 'artifact-qualification-receipt.json');
  const qualification = readJson(qualificationPath);
  const attempt = readJson(path.join(attemptRoot, 'qualification-attempt-receipt.json'));
  assert.equal(attempt.status, 'passed');
  assert.equal(attempt.retry.disposition, 'reconcile_only');
  assert.equal(attempt.identity.qualification_run_id, sourceRunId);
  assert.equal(attempt.evidence.strict_qualification_receipt_sha256, sha256File(qualificationPath));
  assert.deepEqual(validateArtifactQualificationReceipt(qualification as any, {
    stableSessionId: bundle.bundle_digest, releaseCohortRef: bundle.bundle_digest,
    version: bundle.release.version, packageProfile: 'standard', result: 'passed',
    qualificationRunId: sourceRunId, sourceArtifactRunId: sourceRunId,
    sourceArtifactName: `opl-release-standard-vm-bound-${sourceRunId}`,
    artifactSha256: identity.apple_distribution_trust.final_dmg.sha256.slice(7),
    appSha: identity.cohort.app_sha, shellSha: identity.cohort.shell_sha, frameworkSha: identity.cohort.framework_sha,
  }), []);
  const control = readJson(path.join(controlRoot, 'stable-operation-control.json'));
  assert.equal(control.run_id, sourceRunId);
  assert.deepEqual(control.cohort, identity.cohort);
  return { bundle, identity, qualificationPath, control };
}

function main() {
  const { values } = parseArgs({ options: Object.fromEntries([
    'source-run-id', 'bound-root', 'bundle-root', 'vm-root', 'attempt-root', 'control-root',
    'product-app-root', 'framework-root', 'output', 'operation-id', 'operation-started-at', 'operation-deadline-at',
  ].map(key => [key, { type: 'string' as const }])) });
  const required = (key: string) => { assert(values[key], `Missing --${key}`); return values[key] as string; };
  const sourceRunId = required('source-run-id');
  assert.match(sourceRunId, /^[1-9][0-9]*$/);
  const run = JSON.parse(command('gh', ['api', `repos/${repository}/actions/runs/${sourceRunId}`]));
  const pages = JSON.parse(command('gh', ['api', '--paginate', '--slurp', `repos/${repository}/actions/runs/${sourceRunId}/jobs?per_page=100`]));
  const input = {
    sourceRunId, boundRoot: required('bound-root'), bundleRoot: required('bundle-root'), vmRoot: required('vm-root'),
    attemptRoot: required('attempt-root'), controlRoot: required('control-root'), run,
    jobs: pages.flatMap((page: any) => page.jobs),
  };
  const { bundle, identity, qualificationPath, control } = verifyQualifiedStandardRecovery(input);
  const controlFile = (name: string) => path.join(input.controlRoot, name);
  command(process.execPath, ['--experimental-strip-types', path.join(appRoot, 'scripts/stable-operation-control.ts'), 'verify',
    '--control', controlFile('stable-operation-control.json'), '--input', controlFile('stable-operation-consumption.json'),
    '--app-root', required('product-app-root'), '--source-gate', controlFile('source-gate.json'),
    '--pre-nonce-guard', controlFile('pre-issued-pre-nonce-guard.json'), '--run-authority-reconcile', controlFile('run-authority-reconcile.json'),
    '--expected-run-id', sourceRunId, '--expected-actor', control.actor,
    '--expected-app-sha', identity.cohort.app_sha, '--expected-shell-sha', identity.cohort.shell_sha,
    '--expected-framework-sha', identity.cohort.framework_sha]);
  const output = path.resolve(required('output'));
  assert(!fs.existsSync(output), 'Recovery destination must be new');
  fs.mkdirSync(output, { recursive: true });
  const store = `${output}-store`;
  const operationId = required('operation-id');
  const operation = ['--operation', 'standard', '--operation-id', operationId,
    '--operation-started-at', required('operation-started-at'), '--operation-deadline-at', required('operation-deadline-at')];
  const frameworkRoot = path.resolve(required('framework-root'));
  const opl = path.join(frameworkRoot, 'bin/opl');
  const frozen = JSON.parse(command(opl, ['release', 'freeze', '--request', path.join(input.bundleRoot, 'freeze-request.json'),
    '--source-root', frameworkRoot, '--store', store, '--json']));
  assert.equal(frozen.release_bundle_freeze.bundle_digest, bundle.bundle_digest);
  command(opl, ['release', 'operation', 'admit', '--bundle', bundle.bundle_digest, ...operation, '--store', store, '--json']);
  const buildReceiptPath = path.join(output, 'standard-build-receipt.json');
  writeJson(buildReceiptPath, buildExecutorReceipt({ operation: 'build', executor: 'remote',
    'attempt-id': `${operationId}-recovered-build`, 'release-operation': 'standard', 'operation-id': operationId,
    'remote-target': `github-actions:${repository}/runs/${sourceRunId}/standard-build`,
    bundle: path.join(input.bundleRoot, 'release-bundle.json'), track: 'standard', outcome: 'complete',
    'assets-dir': path.join(input.boundRoot, 'assets') }));
  // Framework consumes the receipt and existing bytes; no product builder is invoked.
  command(opl, ['release', 'build', '--bundle', bundle.bundle_digest, '--executor-receipt', buildReceiptPath,
    ...operation, '--store', store, '--json']);
  const exported = JSON.parse(command(opl, ['release', 'checkpoint', 'export', '--bundle', bundle.bundle_digest,
    '--output', path.join(output, 'standard-checkpoint'), '--store', store, '--json']));
  assert.equal(exported.release_bundle_checkpoint_export.checkpoint_stage, 'standard_built');
  fs.copyFileSync(path.join(input.boundRoot, 'standard-identity-receipt.json'), path.join(output, 'standard-identity-receipt.json'));
  fs.copyFileSync(qualificationPath, path.join(output, 'standard-clean-vm-qualification-receipt.json'));
  fs.writeFileSync(path.join(output, 'standard-clean-vm-qualification-receipt.sha256'), `sha256:${sha256File(qualificationPath)}\n`);
  fs.cpSync(input.controlRoot, path.join(output, 'stable-operation-control'), { recursive: true });
  writeJson(path.join(output, 'recovery.json'), { schema: 'opl_qualified_standard_checkpoint_recovery.v1',
    source_run_id: sourceRunId, bundle_digest: bundle.bundle_digest, rebuild_performed: false,
    qualification_repeated: false, publication_attempted: false });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
