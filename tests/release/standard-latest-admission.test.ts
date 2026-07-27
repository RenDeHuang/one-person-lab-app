import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  validateStandardLatestAdmission,
  type StandardLatestAdmissionInput,
} from '../../scripts/validate-standard-latest-admission.ts';
import { createLatestPointerOverrideAuthority } from '../../scripts/write-latest-pointer-override-authority.ts';
import { createAppComponentManifest } from '../../scripts/write-opl-app-component-manifest.ts';

const bundleDigest = `sha256:${'a'.repeat(64)}`;
const appSha = '1'.repeat(40);
const shellSha = '2'.repeat(40);
const frameworkSha = '3'.repeat(40);
const zipSha = 'b'.repeat(64);
const zipSize = 1_234_567;
const dmgSha = 'e'.repeat(64);
const dmgSize = 2_345_678;

function writeJson(root: string, relative: string, value: unknown): string {
  const filePath = path.join(root, relative);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function sha256(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function createUpdaterEvidence(root: string, baselineDisplay: string, baselineUpdater: string): string {
  const directory = path.join(root, `updater-${baselineDisplay}`);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'input-digest.txt'), `sha256:${'8'.repeat(64)}\n`);
  writeJson(directory, 'candidate-zip-identity.json', {
    schema: 'opl_updater_candidate_zip_identity.v1',
    sha256: zipSha,
    sha512: 'ignored-by-app-product-gate',
    size_bytes: zipSize,
    metadata_sha256: `sha256:${'c'.repeat(64)}`,
  });
  writeJson(directory, 'updater-upgrade-qualification-receipt.json', {
    schema: 'opl_updater_upgrade_qualification_receipt.v1',
    status: 'passed',
    latest_activation_allowed: true,
    bundle_digest: bundleDigest,
    cohort: { app_sha: appSha, shell_sha: shellSha, framework_sha: frameworkSha },
    baseline: { display_version: baselineDisplay, updater_version: baselineUpdater },
    candidate: {
      display_version: '26.7.21-r1',
      updater_version: '26.7.2101',
      feed: { zip: { sha256: zipSha, size_bytes: zipSize } },
    },
    qualification: {
      same_candidate_zip_downloaded: true,
      install_and_restart_completed: true,
      installed_app_version: '26.7.2101',
      second_check_no_update: true,
      allow_downgrade: false,
    },
  });
  return directory;
}

function configureCandidate(
  root: string,
  input: StandardLatestAdmissionInput,
  publicationChannel: 'stable' | 'preview' | 'nightly',
  version: string,
  updaterVersion: string,
): void {
  input.publicationChannel = publicationChannel;
  input.candidateDisplayVersion = version;
  input.candidateUpdaterVersion = updaterVersion;
  const expectedAssetNames = [
    'latest-arm64-mac.yml',
    `One-Person-Lab-${version}-mac-arm64.dmg`,
    `One-Person-Lab-${version}-mac-arm64.zip`,
    `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
    ...(publicationChannel === 'nightly'
      ? []
      : ['standard-gatekeeper-launch-policy.json', 'standard-apple-notarization-receipt.json']),
  ];
  const manifest = createAppComponentManifest({
    version,
    updaterVersion,
    sourceCommit: appSha,
    shellCommit: shellSha,
    frameworkCommit: frameworkSha,
    tag: `v${version}`,
    releaseUrl: `https://github.com/gaofeng21cn/one-person-lab-app/releases/tag/v${version}`,
    repo: 'gaofeng21cn/one-person-lab-app',
    assets: expectedAssetNames.map((name, index) => ({
      name,
      url: `https://example.invalid/${name}`,
      digest: name.endsWith('.dmg')
        ? `sha256:${dmgSha}`
        : name.endsWith('.zip')
          ? `sha256:${zipSha}`
          : `sha256:${String(index + 1).repeat(64)}`,
      size: name.endsWith('.dmg') ? dmgSize : name.endsWith('.zip') ? zipSize : 42,
    })),
  });
  writeJson(root, 'component-manifest.json', manifest);

  const staged = JSON.parse(fs.readFileSync(input.standardAssetsPath, 'utf8'));
  staged.assets.find((asset: any) => asset.name.endsWith('-mac-arm64.zip')).name =
    `One-Person-Lab-${version}-mac-arm64.zip`;
  staged.assets.find((asset: any) => asset.name.endsWith('-mac-arm64.dmg')).name =
    `One-Person-Lab-${version}-mac-arm64.dmg`;
  const manifestAsset = staged.assets.find((asset: any) => asset.name === 'opl-app-component-manifest.json');
  const manifestSha = sha256(input.componentManifestPath);
  if (manifestAsset) manifestAsset.sha256 = manifestSha;
  else staged.assets.push({
    name: 'opl-app-component-manifest.json',
    sha256: manifestSha,
    size_bytes: fs.statSync(input.componentManifestPath).size,
  });
  fs.writeFileSync(input.standardAssetsPath, `${JSON.stringify(staged, null, 2)}\n`);

  for (const directory of input.updaterEvidenceDirs) {
    const receiptPath = path.join(directory, 'updater-upgrade-qualification-receipt.json');
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    receipt.candidate.display_version = version;
    receipt.candidate.updater_version = updaterVersion;
    receipt.qualification.installed_app_version = updaterVersion;
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  }

  if (publicationChannel === 'stable') {
    input.latestOverrideAuthorityPath = undefined;
    return;
  }
  input.latestOverrideAuthorityPath = writeJson(
    root,
    'latest-override-authority.json',
    createLatestPointerOverrideAuthority(manifest, input.expectedCurrentLatestTag),
  );
}

function createFixture(): { root: string; input: StandardLatestAdmissionInput; updateReadback(): void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-standard-latest-admission-'));
  const standardAssetsPath = writeJson(root, 'checkpoint/tracks/standard/assets.json', {
    surface_kind: 'opl_release_bundle_staged_assets.v1',
    bundle_digest: bundleDigest,
    track: 'standard',
    assets: [
      {
        name: 'One-Person-Lab-26.7.21-r1-mac-arm64.zip',
        sha256: `sha256:${zipSha}`,
        size_bytes: zipSize,
      },
      {
        name: 'One-Person-Lab-26.7.21-r1-mac-arm64.dmg',
        sha256: `sha256:${dmgSha}`,
        size_bytes: dmgSize,
      },
    ],
  });
  const updaterEvidenceDirs = [
    createUpdaterEvidence(root, '26.7.20', '26.7.20'),
    createUpdaterEvidence(root, '26.7.21', '26.7.21'),
  ];
  const homebrewPublicationPath = writeJson(root, 'homebrew/publication.json', {
    schema: 'opl_bundle_homebrew_publication_receipt.v1',
    status: 'passed',
    track: 'standard',
    bundle_digest: bundleDigest,
    release_version: '26.7.21-r1',
    updater_version: '26.7.2101',
    tap_repository: 'gaofeng21cn/homebrew-one-person-lab',
    tap_commit: '4'.repeat(40),
    cask: { path: 'Casks/one-person-lab.rb', sha256: `sha256:${'d'.repeat(64)}` },
    artifact: {
      name: 'One-Person-Lab-26.7.21-r1-mac-arm64.dmg',
      sha256: `sha256:${dmgSha}`,
      url: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.21-r1/One-Person-Lab-26.7.21-r1-mac-arm64.dmg',
    },
    component_manifest_url: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.21-r1/opl-app-component-manifest.json',
  });
  const homebrewVmPath = writeJson(root, 'homebrew/tart-smoke-summary.json', {
    surface_id: 'opl_tart_gui_first_run_smoke',
    status: 'passed',
    smoke_profile: 'homebrew-standard-cask',
    runtime_profile: 'standard',
    homebrew_install_attempts: [{ attempt: 1, status: 'passed' }],
  });
  const homebrewReadbackPath = path.join(root, 'homebrew/readback.json');
  const updateReadback = (): void => {
    writeJson(root, 'homebrew/readback.json', {
      schema: 'opl_bundle_homebrew_readback_receipt.v1',
      status: 'passed',
      track: 'standard',
      bundle_digest: bundleDigest,
      release_version: '26.7.21-r1',
      updater_version: '26.7.2101',
      publication_receipt_sha256: sha256(homebrewPublicationPath),
      clean_vm_receipt_sha256: sha256(homebrewVmPath),
    });
  };
  updateReadback();
  const input: StandardLatestAdmissionInput = {
    publicationChannel: 'stable',
    bundleDigest,
    candidateDisplayVersion: '26.7.21-r1',
    candidateUpdaterVersion: '26.7.2101',
    appSha,
    shellSha,
    frameworkSha,
    standardAssetsPath,
    componentManifestPath: path.join(root, 'component-manifest.json'),
    expectedCurrentLatestTag: 'v26.7.20',
    highestPublicStableTag: 'v26.7.21',
    predecessors: ['26.7.20=26.7.20', '26.7.21=26.7.21'],
    updaterEvidenceDirs,
    homebrewPublicationPath,
    homebrewVmPath,
    homebrewReadbackPath,
  };
  configureCandidate(root, input, 'stable', '26.7.21-r1', '26.7.2101');
  return {
    root,
    updateReadback,
    input,
  };
}

test('Latest admission binds distinct public predecessors to one candidate ZIP and Homebrew readback', () => {
  const fixture = createFixture();
  try {
    const receipt = validateStandardLatestAdmission(fixture.input);
    assert.equal(receipt.status, 'passed');
    assert.equal(receipt.latest_activation_admitted, true);
    assert.deepEqual(
      receipt.updater_receipts.map((entry: any) => entry.baseline.display_version),
      ['26.7.20', '26.7.21'],
    );
    assert.deepEqual(receipt.candidate.zip, {
      name: 'One-Person-Lab-26.7.21-r1-mac-arm64.zip',
      sha256: `sha256:${zipSha}`,
      size_bytes: zipSize,
    });
    assert.deepEqual(receipt.latest_compare_and_swap, {
      expected_current: {
        tag: 'v26.7.20',
        display_version: '26.7.20',
        updater_version: '26.7.20',
      },
      candidate: { tag: 'v26.7.21-r1' },
    });
    assert.match(receipt.input_digest, /^sha256:[0-9a-f]{64}$/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Latest admission accepts a qualified Preview as current Latest for Stable reclaim', () => {
  const fixture = createFixture();
  try {
    fixture.input.expectedCurrentLatestTag = 'v26.7.20-preview.r1';
    fixture.input.predecessors[0] = '26.7.20-preview.r1=26.7.2001';
    fixture.input.updaterEvidenceDirs[0] = createUpdaterEvidence(
      fixture.root,
      '26.7.20-preview.r1',
      '26.7.2001',
    );
    const receipt = validateStandardLatestAdmission(fixture.input);
    assert.equal(receipt.latest_compare_and_swap.expected_current.tag, 'v26.7.20-preview.r1');
    assert.equal(receipt.latest_compare_and_swap.candidate.tag, 'v26.7.21-r1');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('explicit single-use authority may move Latest to Dev Preview without changing quality', () => {
  const fixture = createFixture();
  try {
    fixture.input.homebrewPublicationPath = undefined;
    fixture.input.homebrewVmPath = undefined;
    fixture.input.homebrewReadbackPath = undefined;
    configureCandidate(fixture.root, fixture.input, 'preview', '26.7.21-preview.r1', '26.7.2101');
    const receipt = validateStandardLatestAdmission(fixture.input);
    assert.equal(receipt.publication_channel, 'preview');
    assert.equal(receipt.operation, 'move_latest_pointer');
    assert.equal(receipt.classification.quality_status, 'preview');
    assert.equal(receipt.classification.preview_kind, 'dev');
    assert.equal(receipt.classification.quality_unchanged, true);
    assert.equal(receipt.pointer_authority.single_use, true);
    assert.equal(receipt.pointer_authority.persistent_override, false);
    assert.equal(receipt.pointer_authority.stable_reclaim, 'next_qualified_stable');
    assert.equal(receipt.homebrew, null);
    assert.equal(receipt.latest_compare_and_swap.candidate.tag, 'v26.7.21-preview.r1');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('explicit single-use authority may move Latest to Nightly Preview without changing quality', () => {
  const fixture = createFixture();
  try {
    fixture.input.homebrewPublicationPath = undefined;
    fixture.input.homebrewVmPath = undefined;
    fixture.input.homebrewReadbackPath = undefined;
    configureCandidate(
      fixture.root,
      fixture.input,
      'nightly',
      '26.7.21-nightly.r1',
      '26.7.2191-nightly.1',
    );
    const receipt = validateStandardLatestAdmission(fixture.input);
    assert.equal(receipt.publication_channel, 'nightly');
    assert.equal(receipt.classification.quality_status, 'preview');
    assert.equal(receipt.classification.build_trigger, 'automated');
    assert.equal(receipt.classification.preview_kind, 'nightly');
    assert.equal(receipt.classification.quality_unchanged, true);
    assert.equal(receipt.pointer_authority.mode, 'protected_single_use_exact_version');
    assert.equal(receipt.pointer_authority.failure_policy, 'preserve_current_latest_lkg');
    assert.equal(receipt.latest_compare_and_swap.candidate.tag, 'v26.7.21-nightly.r1');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Preview Latest admission fails closed without exact single-use authority', () => {
  const fixture = createFixture();
  try {
    fixture.input.homebrewPublicationPath = undefined;
    fixture.input.homebrewVmPath = undefined;
    fixture.input.homebrewReadbackPath = undefined;
    configureCandidate(fixture.root, fixture.input, 'preview', '26.7.21-preview.r1', '26.7.2101');
    fixture.input.latestOverrideAuthorityPath = undefined;
    assert.throws(
      () => validateStandardLatestAdmission(fixture.input),
      /requires protected single-use user authority/,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Preview Latest admission rejects Homebrew evidence', () => {
  const fixture = createFixture();
  try {
    configureCandidate(fixture.root, fixture.input, 'preview', '26.7.21-preview.r1', '26.7.2101');
    assert.throws(
      () => validateStandardLatestAdmission(fixture.input),
      /Preview Latest admission rejects Homebrew evidence/,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Latest admission rejects a missing predecessor receipt', () => {
  const fixture = createFixture();
  try {
    fixture.input.updaterEvidenceDirs.pop();
    assert.throws(
      () => validateStandardLatestAdmission(fixture.input),
      /Every distinct predecessor requires one real updater evidence directory/,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Latest admission rejects a caller that omits one required public predecessor', () => {
  const fixture = createFixture();
  try {
    fixture.input.predecessors.pop();
    fixture.input.updaterEvidenceDirs.pop();
    assert.throws(
      () => validateStandardLatestAdmission(fixture.input),
      /exactly the current Latest and highest public Stable predecessor identities/,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Latest admission requires only one predecessor when current Latest is highest public Stable', () => {
  const fixture = createFixture();
  try {
    fixture.input.highestPublicStableTag = fixture.input.expectedCurrentLatestTag;
    fixture.input.predecessors.pop();
    fixture.input.updaterEvidenceDirs.pop();
    const receipt = validateStandardLatestAdmission(fixture.input);
    assert.equal(receipt.updater_predecessor_policy.distinct_predecessor_count, 1);
    assert.deepEqual(
      receipt.updater_receipts.map((entry: any) => entry.baseline.display_version),
      ['26.7.20'],
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Latest admission rejects an expected current tag outside the admitted predecessors', () => {
  const fixture = createFixture();
  try {
    fixture.input.expectedCurrentLatestTag = 'v26.7.19';
    assert.throws(
      () => validateStandardLatestAdmission(fixture.input),
      /exactly the current Latest and highest public Stable predecessor identities/,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Latest admission input digest binds the frozen current Latest tag', () => {
  const fixture = createFixture();
  try {
    const first = validateStandardLatestAdmission(fixture.input);
    fixture.input.expectedCurrentLatestTag = 'v26.7.21';
    fixture.input.predecessors.shift();
    fixture.input.updaterEvidenceDirs.shift();
    const second = validateStandardLatestAdmission(fixture.input);
    assert.notEqual(first.input_digest, second.input_digest);
    assert.equal(second.latest_compare_and_swap.expected_current.tag, 'v26.7.21');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Latest admission rejects predecessor receipts that used different ZIP bytes', () => {
  const fixture = createFixture();
  try {
    writeJson(fixture.input.updaterEvidenceDirs[1], 'candidate-zip-identity.json', {
      schema: 'opl_updater_candidate_zip_identity.v1',
      sha256: 'f'.repeat(64),
      size_bytes: zipSize,
    });
    assert.throws(
      () => validateStandardLatestAdmission(fixture.input),
      /Candidate ZIP identity sha256 does not match/,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Latest admission rejects Homebrew readback that is not bound to source receipt bytes', () => {
  const fixture = createFixture();
  try {
    const readback = JSON.parse(fs.readFileSync(fixture.input.homebrewReadbackPath, 'utf8'));
    readback.publication_receipt_sha256 = `sha256:${'0'.repeat(64)}`;
    fs.writeFileSync(fixture.input.homebrewReadbackPath, `${JSON.stringify(readback)}\n`);
    assert.throws(
      () => validateStandardLatestAdmission(fixture.input),
      /Homebrew publication receipt digest does not match/,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Latest admission rejects a clean VM without a passed Homebrew install attempt', () => {
  const fixture = createFixture();
  try {
    writeJson(fixture.root, 'homebrew/tart-smoke-summary.json', {
      surface_id: 'opl_tart_gui_first_run_smoke',
      status: 'passed',
      smoke_profile: 'homebrew-standard-cask',
      runtime_profile: 'standard',
      homebrew_install_attempts: [{ attempt: 1, status: 'failed' }],
    });
    fixture.updateReadback();
    assert.throws(
      () => validateStandardLatestAdmission(fixture.input),
      /passed cask installation attempt/,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Latest admission rejects Homebrew publication for bytes outside the frozen Standard assets', () => {
  const fixture = createFixture();
  try {
    const publication = JSON.parse(fs.readFileSync(fixture.input.homebrewPublicationPath, 'utf8'));
    publication.artifact.sha256 = `sha256:${'f'.repeat(64)}`;
    fs.writeFileSync(fixture.input.homebrewPublicationPath, `${JSON.stringify(publication)}\n`);
    fixture.updateReadback();
    assert.throws(
      () => validateStandardLatestAdmission(fixture.input),
      /Homebrew DMG sha256 does not match/,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Latest admission rejects an updater receipt from another frozen cohort', () => {
  const fixture = createFixture();
  try {
    const receiptPath = path.join(fixture.input.updaterEvidenceDirs[0], 'updater-upgrade-qualification-receipt.json');
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    receipt.cohort.shell_sha = '9'.repeat(40);
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
    assert.throws(() => validateStandardLatestAdmission(fixture.input), /Updater receipt shell_sha does not match/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
