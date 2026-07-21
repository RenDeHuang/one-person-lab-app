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
  return {
    root,
    updateReadback,
    input: {
      bundleDigest,
      candidateDisplayVersion: '26.7.21-r1',
      candidateUpdaterVersion: '26.7.2101',
      appSha,
      shellSha,
      frameworkSha,
      standardAssetsPath,
      expectedCurrentLatestTag: 'v26.7.20',
      predecessors: ['26.7.20=26.7.20', '26.7.21=26.7.21'],
      updaterEvidenceDirs,
      homebrewPublicationPath,
      homebrewVmPath,
      homebrewReadbackPath,
    },
  };
}

test('Latest admission binds both real predecessors to one candidate ZIP and Homebrew readback', () => {
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
      /exactly the v26\.7\.20 and v26\.7\.21 public predecessor identities/,
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
      /must identify exactly one admitted updater predecessor/,
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
