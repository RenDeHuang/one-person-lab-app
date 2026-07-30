import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  buildFullDmgInputQualification,
  canonicalDigestRef,
  type FullDmgInputQualificationRequest,
} from '../../scripts/qualify-full-dmg-input.ts';

type JsonRecord = Record<string, any>;

const desiredRootPackageIds = ['mas', 'mag', 'rca', 'oma', 'obf', 'opl-flow'];
const dependencyClosure = ['mas', 'mag', 'rca', 'oma', 'obf', 'mas-scholar-skills', 'opl-flow'];
const appProductProfileFixture = fs.readFileSync(
  new URL('../../contracts/app-product-profile.json', import.meta.url),
  'utf8',
);

function sha256(value: Buffer | string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function git(root: string, args: string[]): string {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function initRepo(root: string, files: Record<string, string>): string {
  fs.mkdirSync(root, { recursive: true });
  git(root, ['init', '--quiet']);
  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=OPL Test', '-c', 'user.email=opl@example.invalid', 'commit', '--quiet', '-m', 'fixture']);
  return git(root, ['rev-parse', 'HEAD']);
}

function selectedPackageSet(packageIds = desiredRootPackageIds) {
  const payload = {
    schema: 'opl_full_runtime_selected_package_set.v1',
    profile_id: 'starter',
    package_ids: packageIds,
    dependency_closure: dependencyClosure,
    packages: dependencyClosure.map((packageId, index) => ({
      package_id: packageId,
      source_commit: String(index + 1).repeat(40),
      source_fingerprint: `sha256:${String(index + 1).repeat(64)}`,
      runtime_module_relative_path: `modules/${packageId}`,
    })),
  };
  return { ...payload, identity: `sha256:${sha256(JSON.stringify(payload))}` };
}

function toolchainComponents(expectedPythonVersion = '3.12.12', observedPythonVersion = expectedPythonVersion) {
  const versions = {
    bun: '1.3.14',
    go: '1.26.4',
    python: expectedPythonVersion,
    uv: '0.9.5',
    zstd: '1.5.7',
  };
  return Object.fromEntries(Object.entries(versions).map(([id, version], index) => [id, {
    expected_version: version,
    version_output: `${id} ${id === 'python' ? observedPythonVersion : version}`,
    executable_path: `/tmp/${id}`,
    resolved_executable_path: `/tmp/${id}`,
    executable_sha256: String(index + 1).repeat(64),
  }]));
}

function frameworkBundle(refs: { app: string; shell: string; framework: string }, version = '26.7.25') {
  const core = {
    surface_kind: 'opl_release_bundle.v1',
    release: {
      channel: 'stable',
      version,
      updater_version: '26.7.2500',
      tag: `v${version}`,
      prerelease: false,
    },
    sources: {
      app: { repo: 'gaofeng21cn/one-person-lab-app', source_commit: refs.app },
      shell: { repo: 'gaofeng21cn/opl-aion-shell', source_commit: refs.shell },
      framework: { repo: 'gaofeng21cn/one-person-lab', source_commit: refs.framework },
    },
    identity_mode: 'app_standard_compatibility',
    package_compatibility: { abi: 'opl_packages.v1', version_range: '>=0.1.0 <1.0.0' },
    tracks: {
      standard: { required_for_latest: true },
      full: { additive_only: true, updater_metadata_allowed: false },
    },
    policy: { latest_required_track: 'standard' },
  };
  return { ...core, bundle_digest: canonicalDigestRef(core) };
}

function fixture(pythonRuntimeVersion = '3.12.12', expectedPythonVersion = '3.12.12') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-input-'));
  const appRoot = path.join(root, 'app');
  const shellRoot = path.join(root, 'shell');
  const frameworkRoot = path.join(root, 'framework');
  const officeCliRoot = path.join(root, 'officecli');
  const mineruRoot = path.join(root, 'mineru');
  const uiUxProMaxRoot = path.join(root, 'ui-ux-pro-max');
  const thirdParty = {
    schema: 'opl_app_full_third_party_source_manifest.v1',
    sources: {
      officecli: { repository: 'iOfficeAI/OfficeCLI', ref: '' },
      mineru: { repository: 'opendatalab/MinerU-Ecosystem', ref: '' },
      ui_ux_pro_max: { repository: 'nextlevelbuilder/ui-ux-pro-max-skill', ref: '' },
    },
    runtime_payloads: {
      temporal_cli: { version: '1.8.0', darwin_arm64_archive_sha256: 'a'.repeat(64) },
      officecli: { version: '1.0.139', darwin_arm64_asset_sha256: 'b'.repeat(64) },
    },
    toolchain: {
      bun: { version: '1.3.14' },
      go: { version: '1.26.4' },
      python: { version: expectedPythonVersion },
      uv: { version: '0.9.5' },
      zstd: { version: '1.5.7' },
    },
  };
  const qualification = {
    schema: 'opl_app_release_qualification_input_manifest.v1',
    runtime_payloads: { codex_cli: { version: '0.144.5' } },
  };
  const officeCliRef = initRepo(officeCliRoot, { 'README.md': 'officecli\n' });
  const mineruRef = initRepo(mineruRoot, { 'README.md': 'mineru\n' });
  const uiUxProMaxRef = initRepo(uiUxProMaxRoot, { 'README.md': 'ui ux\n' });
  thirdParty.sources.officecli.ref = officeCliRef;
  thirdParty.sources.mineru.ref = mineruRef;
  thirdParty.sources.ui_ux_pro_max.ref = uiUxProMaxRef;
  const appRef = initRepo(appRoot, {
    'contracts/app-full-third-party-source-manifest.json': `${JSON.stringify(thirdParty, null, 2)}\n`,
    'contracts/app-release-qualification-input-manifest.json': `${JSON.stringify(qualification, null, 2)}\n`,
    'contracts/app-product-profile.json': appProductProfileFixture,
    'contracts/full-runtime-prune-policy.json': '{"schema":"prune"}\n',
    'scripts/build-full-first-install-package/skills.ts': 'export const skills = true;\n',
  });
  const shellRef = initRepo(shellRoot, { 'package.json': '{"name":"shell"}\n' });
  const frameworkRef = initRepo(frameworkRoot, {
    'package.json': '{"name":"framework"}\n',
    'package-lock.json': '{"lockfileVersion":3}\n',
    'tsconfig.json': '{}\n',
    'opl/index.js': 'export {};\n',
  });
  const selected = selectedPackageSet();
  const layers = {
    toolchain: `full-runtime-v2-toolchain-${'1'.repeat(24)}`,
    'domain-runtime': `full-runtime-v2-domain-runtime-${'2'.repeat(24)}`,
    'opl-runtime': `full-runtime-v2-opl-runtime-${'3'.repeat(24)}`,
    skills: `full-runtime-v2-skills-${'4'.repeat(24)}`,
  };
  const runtimeReportPath = path.join(root, 'runtime-cache-keys.json');
  writeJson(runtimeReportPath, {
    status: 'runtime_cache_keys',
    version: '26.7.25',
    layer_ids: ['toolchain', 'domain-runtime', 'opl-runtime', 'skills'],
    selected_package_set: selected,
    aggregate_key_input: {
      schema: 'opl_full_runtime_cache_aggregate_key.v1',
      layer_ids: ['toolchain', 'domain-runtime', 'opl-runtime', 'skills'],
      layers,
    },
    layer_key_inputs: {
      toolchain: {
        codex_package_version: '0.144.5',
        temporal_cli_archive_sha256: 'a'.repeat(64),
        temporal_cli_version: 'temporal version 1.8.0',
        officecli_sha256: 'b'.repeat(64),
        officecli_version: '1.0.139',
        python_version: `Python ${pythonRuntimeVersion}`,
      },
      'domain-runtime': { selected_package_set: selected },
      'opl-runtime': { opl_commit: frameworkRef },
      skills: {
        app_product_profile_sha256: sha256(fs.readFileSync(path.join(appRoot, 'contracts', 'app-product-profile.json'))),
        skills_packager_sha256: sha256(fs.readFileSync(path.join(appRoot, 'scripts', 'build-full-first-install-package', 'skills.ts'))),
        officecli_root_commit: officeCliRef,
        ui_ux_pro_max_root_commit: uiUxProMaxRef,
      },
    },
    layers,
  });
  const toolchainObservationPath = path.join(root, 'toolchain-observation.json');
  writeJson(toolchainObservationPath, {
    schema: 'opl_app_full_toolchain_observation_receipt.v1',
    source_authority: {
      full_input_manifest_sha256: sha256(fs.readFileSync(path.join(appRoot, 'contracts', 'app-full-third-party-source-manifest.json'))),
      qualification_input_manifest_sha256: sha256(fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-qualification-input-manifest.json'))),
    },
    components: toolchainComponents(expectedPythonVersion, pythonRuntimeVersion),
  });
  const request: FullDmgInputQualificationRequest = {
    appRoot,
    appRef,
    shellRoot,
    shellRef,
    frameworkRoot,
    frameworkRef,
    officeCliRoot,
    mineruRoot,
    uiUxProMaxRoot,
    runtimeCacheKeyReportPath: runtimeReportPath,
    toolchainObservationPath,
  };
  return { root, request };
}

test('development qualification closes exact Full offline inputs without granting release authority', () => {
  const { root, request } = fixture();
  try {
    const first = buildFullDmgInputQualification(request);
    const second = buildFullDmgInputQualification(request);
    assert.equal(first.status, 'passed', JSON.stringify(first.issues));
    assert.equal(first.qualification_scope, 'development_full_input');
    assert.equal(first.append_full_input_eligible, false);
    assert.equal(first.release_authority_granted, false);
    assert.match(first.offline_payload_digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(first.input_closure_digest, second.input_closure_digest);
    assert.equal(first.observed_input.sources.app.commit, request.appRef);
    assert.equal(first.observed_input.selected_package_set_identity, selectedPackageSet().identity);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('dependency closure cannot become a second fixed Full root package list', () => {
  const { root, request } = fixture();
  try {
    const report = JSON.parse(fs.readFileSync(request.runtimeCacheKeyReportPath, 'utf8')) as JsonRecord;
    const staleFixedRoots = selectedPackageSet(dependencyClosure);
    report.selected_package_set = staleFixedRoots;
    report.layer_key_inputs['domain-runtime'].selected_package_set = staleFixedRoots;
    writeJson(request.runtimeCacheKeyReportPath, report);

    const receipt = buildFullDmgInputQualification(request);
    assert.equal(receipt.status, 'blocked');
    assert.ok(
      receipt.issues.some((issue) => issue.code === 'selected_package_set_membership_invalid'),
      JSON.stringify(receipt.issues),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('append_full input eligibility requires one canonical frozen Standard Bundle', () => {
  const { root, request } = fixture();
  try {
    const bundlePath = path.join(root, 'bundle.json');
    const bundle = frameworkBundle({
      app: request.appRef,
      shell: request.shellRef,
      framework: request.frameworkRef,
    });
    writeJson(bundlePath, bundle);
    const receipt = buildFullDmgInputQualification({ ...request, bundlePath });
    assert.equal(receipt.status, 'passed', JSON.stringify(receipt.issues));
    assert.equal(receipt.qualification_scope, 'append_full_input');
    assert.equal(receipt.append_full_input_eligible, true);
    assert.equal(receipt.observed_input.release.bundle_digest, bundle.bundle_digest);
    assert.equal(receipt.release_authority_granted, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an observed Python version drift remains fail-closed against the frozen authority', () => {
  const { root, request } = fixture('3.12.11');
  try {
    const receipt = buildFullDmgInputQualification(request);
    assert.equal(receipt.status, 'blocked');
    assert.equal(receipt.append_full_input_eligible, false);
    assert.deepEqual(
      receipt.issues.filter((issue) => issue.code.includes('python')).map((issue) => issue.code).sort(),
      ['python_payload_version_mismatch', 'toolchain_python_observed_version_mismatch'],
    );
    assert.match(receipt.input_closure_digest, /^sha256:[0-9a-f]{64}$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('bundle source drift blocks append_full input qualification', () => {
  const { root, request } = fixture();
  try {
    const bundlePath = path.join(root, 'bundle.json');
    writeJson(bundlePath, frameworkBundle({
      app: 'f'.repeat(40),
      shell: request.shellRef,
      framework: request.frameworkRef,
    }));
    const receipt = buildFullDmgInputQualification({ ...request, bundlePath });
    assert.equal(receipt.status, 'blocked');
    assert.equal(receipt.append_full_input_eligible, false);
    assert.ok(receipt.issues.some((issue) => issue.code === 'frozen_bundle_app_ref_mismatch'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
