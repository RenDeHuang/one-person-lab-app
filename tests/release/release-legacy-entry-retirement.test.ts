import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { validateReleaseBrokerAuthority } from '../../scripts/release-broker-authority.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
const readJson = (relativePath: string) => JSON.parse(read(relativePath)) as Record<string, any>;
const packageJson = readJson('package.json');

test('retired control-plane and direct publisher aliases have no package mutation entrypoint', () => {
  const packageJson = readJson('package.json');

  for (const script of [
    'release:stable',
    'release:operator',
    'release:publish',
    'release:bundle',
    'release:plan',
    'release:cohort-lock',
    'release:cohort-plan',
    'release:closeout',
    'release:cleanup-drafts',
    'release:gate-reuse-plan',
    'release:cohort-manifest',
    'release:candidate-record',
    'release:candidate-record:resolve-owner',
    'release:candidate-record:validate',
    'release:candidate-record:status',
    'release:owner-candidate-record:verify',
  ]) assert.equal(packageJson.scripts[script], undefined, script);
  assert.equal(
    packageJson.scripts['release:historical-candidate-record:status'],
    'node --experimental-strip-types scripts/validate-release-candidate-record.ts --status',
  );
  assert.equal(
    packageJson.scripts['release:historical-bundle:status'],
    'node --experimental-strip-types scripts/release-bundle.ts status',
  );
  assert.equal(
    packageJson.scripts['release:framework-adapter'],
    'node --experimental-strip-types scripts/framework-release-adapter.ts',
  );
  assert.equal(
    packageJson.scripts['release:deadline'],
    'node --experimental-strip-types scripts/release-operation-deadline.ts',
  );
  assert.equal(
    packageJson.scripts['release:bind-standard'],
    'node --experimental-strip-types scripts/bind-standard-release-track.ts',
  );
});

test('legacy implementations remain present only for historical receipt compatibility', () => {
  for (const relativePath of [
    'scripts/run-stable-release.ts',
    'scripts/release-operator.ts',
    'scripts/stable-release-session.ts',
    'scripts/release-mutation-broker.ts',
    'scripts/release-session-lease.ts',
  ]) {
    assert.equal(fs.existsSync(path.join(appRoot, relativePath)), true, `${relativePath} must remain readable`);
  }
  assert.equal(fs.existsSync(path.join(appRoot, 'scripts/stable-release-reconcile.ts')), false);

  const release = readJson('contracts/app-release-channel.json');
  const legacy = release.release_bundle_control_plane.legacy_compatibility;
  assert.equal(legacy.mode, 'read_only_receipt_parser');
  assert.equal(legacy.retired_scripts_may_parse_historical_receipts, true);
  assert.equal(legacy.retired_scripts_may_be_package_or_workflow_mutation_entrypoints, false);
  for (const script of legacy.retired_package_scripts) {
    assert.equal(packageJson.scripts[script], undefined, `${script} must stay retired`);
  }
  assert.deepEqual(legacy.retained_read_only_package_scripts, [
    'release:historical-candidate-record:status',
    'release:historical-bundle:status',
  ]);
});

test('retired desktop workflow surface is absent while historical readers and Framework route remain', () => {
  for (const relativePath of [
    '.github/workflows/desktop-release.yml',
    '.github/workflows/desktop-release-promote.yml',
    '.github/workflows/desktop-release-full-addon.yml',
    '.github/workflows/desktop-release-cleanup-drafts.yml',
  ]) {
    assert.equal(fs.existsSync(path.join(appRoot, relativePath)), false, `${relativePath} must stay retired`);
  }

  const historicalCandidateReader = read('scripts/validate-release-candidate-record.ts');
  const historicalBundleReader = read('scripts/release-bundle.ts');
  assert.match(historicalCandidateReader, /status: 'historical_read_only'/);
  assert.match(historicalCandidateReader, /inspect_framework_checkpoint_and_receipts/);
  assert.match(historicalBundleReader, /historical/);

  const stableWorkflow = read('.github/workflows/release-stable.yml');
  assert.match(stableWorkflow, /workflow_dispatch:/);
  assert.match(stableWorkflow, /uses: \.\/\.github\/workflows\/_release-bundle\.yml/);
  assert.match(stableWorkflow, /operation: standard/);
});

test('retired planners and direct publisher expose no mutation bypass', () => {
  const candidate = read('scripts/plan-release-candidate.ts');
  const publisher = read('scripts/publish-release.ts');
  const fullAddonPublisher = read('scripts/publish-full-addon.ts');
  const gateReuse = read('scripts/plan-release-gate-reuse.ts');
  const cohort = read('scripts/plan-release-cohort.ts');
  const manifest = read('scripts/write-release-cohort-manifest.ts');
  const closeout = read('scripts/closeout-release-run.ts');

  assert.match(candidate, /'standard'[\s\S]*'resume_standard'[\s\S]*'append_full'/);
  assert.doesNotMatch(candidate, /desktop-release|release:candidate|broker|promote/i);
  assert.doesNotMatch(publisher, /spawnSync|gh release|upload_command|upload_commands/);
  assert.match(publisher, /remote_read_attempted: false/);
  assert.doesNotMatch(fullAddonPublisher, /spawnSync|node:child_process|gh release|release upload|stable_session_id/);
  assert.match(fullAddonPublisher, /status: 'retired_fail_closed'/);
  assert.match(gateReuse, /reuse_allowed_count: 0/);
  assert.doesNotMatch(gateReuse, /ready_to_promote|status: 'reuse_allowed'/);
  assert.doesNotMatch(`${cohort}\n${manifest}\n${closeout}`, /npm run release:(?:plan|stable|closeout|candidate-record)/);
});

test('legacy broker contract is parseable but cannot authorize a new mutation', () => {
  const broker = readJson('contracts/app-release-broker-authority.json');

  assert.deepEqual(validateReleaseBrokerAuthority(broker, { capability: 'contract_read' }), []);
  assert.ok(
    validateReleaseBrokerAuthority(broker, {
      capability: 'mutation_submit',
      requireCredentialReceipt: false,
    }).length > 0,
  );
  assert.equal(broker.lifecycle, 'retired_historical_receipt_verification_only');
  assert.equal(broker.live_mutation_authority, false);
  assert.equal(broker.new_admission_allowed, false);
  assert.equal(broker.mutation_broker.execution_allowed, false);
});

test('legacy broker and session surfaces cannot bypass the Framework control plane', () => {
  const broker = read('scripts/release-mutation-broker.ts');
  const session = read('scripts/stable-release-session.ts');
  const lease = read('scripts/release-session-lease.ts');
  const vm = read('.github/workflows/opl-first-run-vm.yml');
  const full = read('.github/workflows/full-first-install-release.yml');
  const reusableBuild = read('.github/workflows/_build-reusable.yml');
  const diagnostics = read('scripts/write-first-run-vm-critical-diagnostics.ts');
  const installExposure = read('contracts/app-install-exposure-policy.json');

  assert.match(broker, /retiredMutationApi\('externalReleaseMutationBroker\.submit'\)/);
  assert.match(broker, /retiredMutationApi\('externalReleaseMutationBroker\.lookup'\)/);
  assert.match(broker, /mutation_authorized: false/);
  assert.doesNotMatch(broker, /spawnSync|crypto\.sign|operation: 'submit'/);
  assert.doesNotMatch(session, /export function (?:build|write|create|transition|plan|issue|recover).*StableRelease/);
  assert.doesNotMatch(lease, /export function (?:build|encode)ReleaseSessionLease|crypto\.sign/);
  for (const workflow of [vm, full, reusableBuild]) {
    assert.doesNotMatch(workflow, /inputs\.(?:stable_session_id|release_session_lease_base64|release_attempt_id|pre_api_admission_receipt_base64|release_mutation|broker_admission_validation_sha256)/);
    assert.doesNotMatch(workflow, /verify-release-(?:broker-acceptance|session-lease)\.ts/);
  }
  assert.doesNotMatch(diagnostics, /npm run release:stable|retry-qualification|reconcile_stable_session/);
  assert.match(diagnostics, /opl release status --bundle/);
  assert.doesNotMatch(installExposure, /\.github\/workflows\/desktop-release\.yml/);
});

test('release documentation exposes only Framework checkpoint and App executor operations', () => {
  const releaseReadme = read('docs/delivery/release/README.md');
  const immutableBundle = read('docs/delivery/release/immutable-release-bundle.md');
  const scriptsReadme = read('scripts/README.md');
  const combined = `${releaseReadme}\n${immutableBundle}\n${scriptsReadme}`;

  assert.match(releaseReadme, /Framework `opl release`/);
  assert.match(releaseReadme, /`standard`, `resume_standard`, and `append_full`/);
  assert.match(immutableBundle, /opl release checkpoint export/);
  assert.match(immutableBundle, /opl release checkpoint import/);
  assert.match(combined, /historical receipt/i);
  assert.doesNotMatch(combined, /npm run release:(?:stable|operator)/);
  assert.doesNotMatch(combined, /`release:(?:stable|operator)` is the canonical/);
});
