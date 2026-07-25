import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  buildStableReleaseAdmissionManifest,
  canonicalJson,
  parseGitHubJsonLookup,
  stableAdmissionManifestDigest,
  type StableAdmissionInput,
  type StableAdmissionObservation,
} from '../../scripts/stable-release-admission-manifest.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');
const appRef = '1'.repeat(40);
const shellRef = '2'.repeat(40);
const frameworkRef = '3'.repeat(40);
const admissionRunId = '30150000001';
const workflowPaths = [
  '.github/workflows/release-stable.yml',
  '.github/workflows/_release-bundle.yml',
  '.github/workflows/_build-reusable.yml',
  '.github/workflows/release-apple-credentials-preflight.yml',
  'scripts/stable-release-admission-manifest.ts',
  'scripts/verify-apple-release-credentials.ts',
  'contracts/app-release-channel.json',
];
const requiredSecretNames = [
  'BUILD_CERTIFICATE_BASE64',
  'P12_PASSWORD',
  'APPLE_ID',
  'APPLE_ID_PASSWORD',
  'TEAM_ID',
  'IDENTITY',
];

function input(): StableAdmissionInput {
  return {
    baseVersion: '26.7.25',
    appRef,
    shellRef,
    frameworkRef,
    admissionRunId,
  };
}

function receipt() {
  return {
    schema: 'opl_apple_release_credentials_preflight.v1',
    status: 'passed',
    checked_at: '2026-07-25T05:00:00.000Z',
    platform: 'darwin',
    protected_environment: 'release-stable',
    execution: {
      environment: 'github_actions',
      admission_eligible: true,
      repository: 'gaofeng21cn/one-person-lab-app',
      workflow_ref:
        'gaofeng21cn/one-person-lab-app/.github/workflows/release-apple-credentials-preflight.yml@refs/heads/main',
      run_id: admissionRunId,
      run_attempt: 1,
      event_name: 'workflow_dispatch',
      ref: 'refs/heads/main',
      head_sha: appRef,
    },
    required_secret_names: [...requiredSecretNames],
    required_secret_count: requiredSecretNames.length,
    signing: {
      configured_identity_selector_resolved: true,
      configured_team_id_match: true,
      developer_id_application: true,
      hardened_runtime: true,
      trusted_timestamp: true,
      probe_codesign_strict: 'passed',
    },
    notarization: {
      authentication: 'passed',
      command: 'xcrun notarytool history',
      history_count: 1,
      submission_performed: false,
    },
    mutation: {
      release_dispatch_performed: false,
      notarization_submission_performed: false,
      public_asset_write_performed: false,
    },
  };
}

function observation(overrides: Partial<StableAdmissionObservation> = {}): StableAdmissionObservation {
  const credentialReceipt = receipt();
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  return {
    checkedAt: '2026-07-25T05:01:00.000Z',
    currentDate: '2026-07-25',
    mainRefs: { app: appRef, shell: shellRef, framework: frameworkRef },
    workflowBlobs: workflowPaths.map((workflowPath, index) => ({
      path: workflowPath,
      git_blob_sha: (index + 4).toString(16).repeat(40),
      sha256: `sha256:${((index + 11) % 16).toString(16).repeat(64)}`,
    })),
    credentialReceipt,
    credentialReceiptBytes: Buffer.from(`${JSON.stringify(credentialReceipt)}\n`),
    publishedReleases: [
      { tag_name: 'v26.7.24-r3', draft: false, prerelease: false },
      { tag_name: 'v26.7.24', draft: false, prerelease: false },
    ],
    tagRefs: [],
    webuiTags: ['latest', 'stable', '26.7.25', '26.7.24-r3'],
    homebrewCask: {
      repository: 'gaofeng21cn/homebrew-one-person-lab',
      path: 'Casks/one-person-lab.rb',
      git_blob_sha: 'b'.repeat(40),
      bytes: Buffer.from('cask "one-person-lab" do\n  version "26.7.24"\nend\n'),
    },
    homebrewPolicy: releaseContract,
    activeReleaseRuns: [],
    ...overrides,
  };
}

test('single Stable admission manifest allocates the first unused cross-namespace revision', () => {
  const manifest = buildStableReleaseAdmissionManifest(input(), observation());
  assert.equal(manifest.status, 'passed');
  assert.deepEqual(manifest.cohort, {
    app_sha: appRef,
    shell_sha: shellRef,
    framework_sha: frameworkRef,
  });
  assert.equal(manifest.version.display, '26.7.25-r1');
  assert.equal(manifest.version.updater, '26.7.2501');
  assert.equal(manifest.version.tag, 'v26.7.25-r1');
  assert.deepEqual(manifest.allocator.observed_same_day_versions, ['26.7.25']);
  assert.deepEqual(manifest.namespace.webui_tags, ['26.7.25']);
  assert.equal(manifest.apple_credentials.required_secret_count, 6);
  assert.deepEqual(manifest.apple_credentials.required_secret_names, requiredSecretNames);
  assert.equal(manifest.dispatcher_contract.raw_standard_version_or_ref_inputs_allowed, false);
  const { manifest_digest: digest, ...core } = manifest;
  assert.equal(digest, stableAdmissionManifestDigest(core));
  assert.equal(canonicalJson(manifest), canonicalJson(JSON.parse(JSON.stringify(manifest))));
});

test('admission fails closed when any frozen main ref drifts', () => {
  const drifted = observation({
    mainRefs: { app: appRef, shell: 'f'.repeat(40), framework: frameworkRef },
  });
  assert.throws(
    () => buildStableReleaseAdmissionManifest(input(), drifted),
    /Shell live main drifted/,
  );
});

test('admission fails closed when a release writer is already active', () => {
  const active = observation({
    activeReleaseRuns: [{
      id: 30150000002,
      path: '.github/workflows/release-stable.yml',
      status: 'in_progress',
      head_sha: appRef,
    }],
  });
  assert.throws(
    () => buildStableReleaseAdmissionManifest(input(), active),
    /zero other active release runs/,
  );
});

test('admission requires exact 6/6 Apple secret names and runtime proof', () => {
  const credentialReceipt = receipt();
  credentialReceipt.required_secret_names.pop();
  credentialReceipt.required_secret_count = 5;
  assert.throws(
    () => buildStableReleaseAdmissionManifest(input(), observation({
      credentialReceipt,
      credentialReceiptBytes: Buffer.from(JSON.stringify(credentialReceipt)),
    })),
    /exact 6\/6 protected secret names/,
  );
});

test('admission rejects Homebrew policy drift before Standard dispatch', () => {
  const homebrewPolicy = structuredClone(observation().homebrewPolicy);
  homebrewPolicy.homebrew_tap_distribution.tap_update_policy.app_release_workflow_write_mode =
    'unprotected_retrying_push';
  assert.throws(
    () => buildStableReleaseAdmissionManifest(input(), observation({ homebrewPolicy })),
    /Homebrew tap update policy/,
  );
});

test('admission rejects a stale base version and an occupied allocated namespace', () => {
  assert.throws(
    () => buildStableReleaseAdmissionManifest(
      { ...input(), baseVersion: '26.7.24' },
      observation(),
    ),
    /must match Asia\/Shanghai date/,
  );
  const fullyOccupied = observation({
    webuiTags: [
      '26.7.25',
      '26.7.25-r1',
      '26.7.25-r2',
      '26.7.25-r3',
      '26.7.25-r4',
      '26.7.25-r5',
      '26.7.25-r6',
      '26.7.25-r7',
      '26.7.25-r8',
      '26.7.25-r9',
    ],
  });
  assert.throws(
    () => buildStableReleaseAdmissionManifest(input(), fullyOccupied),
    /revisions stop at r9/,
  );
});

test('GitHub lookup failures and non-JSON responses fail closed', () => {
  assert.throws(
    () => parseGitHubJsonLookup('repos/example/releases', {
      status: 1,
      stdout: '',
      stderr: 'HTTP 503',
    }),
    /GitHub lookup repos\/example\/releases failed[\s\S]*HTTP 503/,
  );
  assert.throws(
    () => parseGitHubJsonLookup('repos/example/releases', {
      status: 0,
      stdout: '<html>bad gateway</html>',
      stderr: '',
    }),
    /did not return JSON/,
  );
});

test('manifest digest changes for workflow or receipt drift', () => {
  const current = buildStableReleaseAdmissionManifest(input(), observation());
  const workflowDrift = observation();
  workflowDrift.workflowBlobs[0] = {
    ...workflowDrift.workflowBlobs[0]!,
    sha256: `sha256:${'f'.repeat(64)}`,
  };
  const changed = buildStableReleaseAdmissionManifest(input(), workflowDrift);
  assert.notEqual(changed.manifest_digest, current.manifest_digest);
});
