import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { validateStableDistributionReceipt } from '../../scripts/release-saga-receipts.ts';

const appRoot = process.cwd();
const digest = `sha256:${'a'.repeat(64)}`;
const appDigest = `sha256:${'b'.repeat(64)}`;
const sourceCommit = 'c'.repeat(40);
const frameworkSourceCommit = 'e'.repeat(40);
const generation = '26.7.13-r4';
const requestId = 'd'.repeat(64);
const sourceAppRunId = '123456';
const frameworkRunId = '654321';

function packageComponent(packageId: string) {
  return {
    component_id: packageId,
    version: '0.2.0',
    source_commit: sourceCommit,
    artifact_ref: `ghcr.io/gaofeng21cn/one-person-lab-packages/${packageId}:0.2.0`,
    artifact_digest: digest,
  };
}

function promotionReceipt(target: 'candidate' | 'latest-stable') {
  const packages = Object.fromEntries([
    'mas', 'mag', 'rca', 'oma', 'obf', 'mas-scholar-skills', 'opl-flow',
  ].map((packageId) => [packageId, packageComponent(packageId)]));
  const channelRefs = [
    `ghcr.io/gaofeng21cn/one-person-lab-manifest:${target}`,
    `ghcr.io/gaofeng21cn/one-person-lab-framework:${target}`,
    ...Object.keys(packages).map((packageId) => `ghcr.io/gaofeng21cn/one-person-lab-packages/${packageId}:${target}`),
  ].sort();
  return {
    surface_kind: 'opl_release_set_promotion_receipt.v1',
    status: target === 'candidate' ? 'published_immutable_candidate' : 'promoted_latest_stable',
    promotion_target: target,
    promotion_request_id: requestId,
    release_gate: 'app_stable_promotion',
    release_set_generation: generation,
    carrier: {
      immutable_ref: `ghcr.io/gaofeng21cn/one-person-lab-manifest:${generation}`,
      digest,
      channel_ref: `ghcr.io/gaofeng21cn/one-person-lab-manifest:${target}`,
    },
    framework_run: {
      repository: 'gaofeng21cn/one-person-lab',
      run_id: frameworkRunId,
      run_attempt: '1',
    },
    source_app_run_id: sourceAppRunId,
    app: {
      component_id: 'opl-app',
      version: '26.7.13',
      source_commit: sourceCommit,
      artifact_ref: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.13/One-Person-Lab-26.7.13-mac-arm64.dmg',
      artifact_digest: appDigest,
    },
    components: {
      base: {
        component_id: 'opl-base',
        version: '0.2.1',
        source_commit: frameworkSourceCommit,
        artifact_ref: 'ghcr.io/gaofeng21cn/one-person-lab-framework:0.2.1',
        artifact_digest: digest,
      },
      packages,
    },
    anonymous_readback: { status: 'verified', verified_refs: channelRefs },
  };
}

function validatePromotion(receiptPath: string, target: 'candidate' | 'latest-stable', extra: string[] = []) {
  return spawnSync(process.execPath, [
    '--experimental-strip-types',
    'scripts/validate-framework-release-promotion-receipt.ts',
    '--receipt', receiptPath,
    '--target', target,
    '--promotion-request-id', requestId,
    '--release-set-generation', generation,
    '--release-gate', 'app_stable_promotion',
    '--source-app-run-id', sourceAppRunId,
    '--app-version', '26.7.13',
    '--app-source-commit', sourceCommit,
    '--app-artifact-digest', appDigest,
    '--framework-source-commit', frameworkSourceCommit,
    '--framework-run-id', frameworkRunId,
    ...extra,
  ], { cwd: appRoot, encoding: 'utf8' });
}

test('Framework candidate and latest-stable receipts preserve one immutable Release Set cohort', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-framework-promotion-'));
  const candidatePath = path.join(root, 'candidate.json');
  const stablePath = path.join(root, 'latest-stable.json');
  fs.writeFileSync(candidatePath, `${JSON.stringify(promotionReceipt('candidate'))}\n`);
  fs.writeFileSync(stablePath, `${JSON.stringify(promotionReceipt('latest-stable'))}\n`);

  const candidate = validatePromotion(candidatePath, 'candidate');
  assert.equal(candidate.status, 0, candidate.stderr);
  const stable = validatePromotion(stablePath, 'latest-stable', [
    '--expected-carrier-digest', digest,
    '--candidate-receipt', candidatePath,
  ]);
  assert.equal(stable.status, 0, stable.stderr);
  assert.equal(JSON.parse(stable.stdout).carrier_digest, digest);
});

test('Framework promotion receipt rejects a noncanonical Package artifact', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-framework-promotion-invalid-'));
  const receipt = promotionReceipt('candidate');
  receipt.components.packages.rca.artifact_ref = 'ghcr.io/gaofeng21cn/legacy/redcube-ai:0.2.0';
  const receiptPath = path.join(root, 'candidate.json');
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
  const result = validatePromotion(receiptPath, 'candidate');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /canonical Package repository|must use ghcr\.io\/gaofeng21cn\/one-person-lab-packages\/rca/);
});

test('Framework promotion receipt rejects Base built from a different Framework commit', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-framework-promotion-stale-base-'));
  const receipt = promotionReceipt('candidate');
  receipt.components.base.source_commit = 'f'.repeat(40);
  const receiptPath = path.join(root, 'candidate.json');
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
  const result = validatePromotion(receiptPath, 'candidate');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /components\.base\.source_commit does not match the frozen Framework cohort SHA/);
});

test('Framework promotion dispatch carries the frozen Framework SHA through both targets and receipt validation', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release-promote.yml'), 'utf8');
  const helper = fs.readFileSync(path.join(appRoot, 'scripts/framework-release-promotion-step.sh'), 'utf8');
  assert.equal(
    workflow.match(/OPL_FRAMEWORK_SOURCE_COMMIT: \$\{\{ needs\.prepare\.outputs\.framework_sha \}\}/g)?.length,
    2,
  );
  assert.match(helper, /OPL_FRAMEWORK_SOURCE_COMMIT:\?OPL_FRAMEWORK_SOURCE_COMMIT is required/);
  assert.match(helper, /expected_framework_source_commit=\$OPL_FRAMEWORK_SOURCE_COMMIT/);
  assert.match(helper, /--framework-source-commit "\$OPL_FRAMEWORK_SOURCE_COMMIT"/);
});

test('Homebrew Stable dispatch carries the validated Full VM receipt raw bytes without cross-repo download', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release-promote.yml'), 'utf8');
  assert.match(
    workflow,
    /full_vm_evidence_base64: \$\{\{ steps\.full-vm\.outputs\.evidence_base64 \}\}/,
  );
  assert.match(workflow, /const bytes = fs\.readFileSync\(receiptPath\)/);
  assert.match(workflow, /const encoded = bytes\.toString\('base64'\)/);
  assert.match(workflow, /evidence_base64=\$\{encoded\}/);
  assert.match(
    workflow,
    /FULL_VM_EVIDENCE_BASE64: \$\{\{ needs\.prepare\.outputs\.full_vm_evidence_base64 \}\}/,
  );
  assert.match(workflow, /test -n "\$FULL_VM_EVIDENCE_BASE64"/);
  assert.match(workflow, /--field full_vm_evidence_base64="\$FULL_VM_EVIDENCE_BASE64"/);
  assert.doesNotMatch(workflow, /repos\/\$TAP_REPO\/actions\/artifacts[\s\S]*artifact-qualification-receipt/);
});

test('Homebrew Stable distribution v2 binds Formula and App casks to the Framework Release Set digest', () => {
  const formula = {
    path: 'Formula/opl.rb',
    formula_name: 'opl',
    version: '0.2.1',
    source_head: sourceCommit,
    artifact_ref: 'ghcr.io/gaofeng21cn/one-person-lab-framework:0.2.1',
    artifact_digest: digest,
    transport_sha256: 'e'.repeat(64),
    sha256: 'f'.repeat(64),
  };
  const cask = (name: string, version = '26.7.13') => ({
    path: `Casks/${name}.rb`,
    version,
    sha256: '1'.repeat(64),
    url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.13/${name}.dmg`,
  });
  const receipt = {
    schema: 'opl_stable_distribution_receipt.v2',
    status: 'verified',
    stable_session_id: `sha256:${'2'.repeat(64)}`,
    release_set: {
      generation,
      manifest_ref: `ghcr.io/gaofeng21cn/one-person-lab-manifest:${generation}`,
      manifest_digest: digest,
      stable_channel_ref: 'ghcr.io/gaofeng21cn/one-person-lab-manifest:latest-stable',
      stable_channel_digest: digest,
      base: {
        component_id: 'opl-base', version: '0.2.1', source_commit: sourceCommit,
        artifact_ref: formula.artifact_ref, artifact_digest: digest,
      },
      app: {
        component_id: 'opl-app', version: '26.7.13', source_commit: sourceCommit,
        artifact_ref: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.13/One-Person-Lab-26.7.13-mac-arm64.dmg',
        artifact_digest: appDigest,
      },
      formula,
    },
    release: {
      repo: 'gaofeng21cn/one-person-lab-app', tag: 'v26.7.13', version: '26.7.13',
      public: true, latest: false, source_release_run_id: sourceAppRunId,
    },
    cohort: {
      release_cohort_ref: `sha256:${'3'.repeat(64)}`,
      app_sha: sourceCommit,
      shell_sha: sourceCommit,
      framework_sha: sourceCommit,
      release_set_generation: generation,
      release_set_manifest_digest: digest,
    },
    full_vm: {
      run_id: frameworkRunId, evidence_ref: 'opl-first-run-vm-full-654321',
      evidence_sha256: '4'.repeat(64), result: 'passed',
    },
    tap: {
      repo: 'gaofeng21cn/homebrew-one-person-lab', commit_sha: sourceCommit,
      annotated_tag: 'stable-distribution/v26.7.13', formula,
      standard_cask: cask('one-person-lab'),
      full_cask: cask('one-person-lab-full'),
      nightly_cask: cask('one-person-lab-nightly', '26.7.13-nightly.r1'),
    },
  };
  assert.deepEqual(validateStableDistributionReceipt(receipt, {
    stableSessionId: receipt.stable_session_id,
    version: '26.7.13',
    releaseCohortRef: receipt.cohort.release_cohort_ref,
    appSha: sourceCommit,
    shellSha: sourceCommit,
    frameworkSha: sourceCommit,
    releaseSetGeneration: generation,
    releaseSetManifestDigest: digest,
    sourceReleaseRunId: sourceAppRunId,
    fullVmRunId: frameworkRunId,
  }), []);
});

test('only desktop-release-promote owns the WebUI Stable mutation', () => {
  const source = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release.yml'), 'utf8');
  const promote = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release-promote.yml'), 'utf8');
  assert.doesNotMatch(source, /\$\{ghcr_image\}:stable/);
  assert.match(promote, /oras tag "\$\{WEBUI_IMAGE\}@\$\{WEBUI_VERSION_DIGEST\}" stable/);
  assert.equal(fs.existsSync(path.join(appRoot, '.github/workflows/webui-ghcr-release.yml')), false);
  assert.equal(fs.existsSync(path.join(appRoot, '.github/workflows/homebrew-tap-update.yml')), false);
});
