import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  buildArtifactQualificationReceipt,
} from '../../scripts/artifact-qualification-receipt.ts';
import type { BuildArtifactCohortV2 } from '../../scripts/build-artifact-cohort.ts';
import { fileSha256 } from '../../scripts/release-file-helpers.ts';
import {
  assembleReleaseBundle,
  validateReleaseBundle,
} from '../../scripts/release-bundle.ts';
import { appRoot } from './app-release-boundary-cases/helpers.ts';

const cli = path.join(appRoot, 'scripts', 'release-bundle.ts');
const releaseCohortRef = `sha256:${'1'.repeat(64)}`;
const stableSessionId = `sha256:${'2'.repeat(64)}`;
const appSha = 'a'.repeat(40);
const shellSha = 'b'.repeat(40);
const frameworkSha = 'c'.repeat(40);

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function frozenCodexCliIdentity() {
  const version = '0.144.5';
  const integrity = `sha512-${'A'.repeat(86)}==`;
  return {
    package: '@openai/codex' as const,
    version,
    npm_integrity: integrity,
    tarball_url: `https://registry.npmjs.org/@openai/codex/-/codex-${version}.tgz`,
    tarball_sha256: 'e'.repeat(64),
    platform: {
      package: '@openai/codex' as const,
      version: `${version}-darwin-arm64`,
      npm_integrity: integrity,
      tarball_url: `https://registry.npmjs.org/@openai/codex/-/codex-${version}-darwin-arm64.tgz`,
      tarball_sha256: 'f'.repeat(64),
    },
  };
}

function temporalSupervisorProof() {
  const databasePath = '/Users/opl/Library/Application Support/OPL/state/family-runtime/temporal-server/temporal.sqlite';
  const plistPath = '/Users/opl/Library/LaunchAgents/ai.opl.family-runtime.temporal-service.plist';
  const lifecycleStatus = (pid: number) => ({
    surface_kind: 'temporal_service_lifecycle_status',
    provider_kind: 'temporal',
    service_status: 'running',
    address: '127.0.0.1:7233',
    address_source: 'managed_service_supervisor',
    server_reachable: true,
    supervisor: {
      surface_kind: 'opl_temporal_service_supervisor_state',
      status: 'loaded_running',
      installed: true,
      loaded: true,
      ready: true,
      observed_at: `2026-07-20T00:00:0${pid - 101}.000Z`,
      error: null,
      supported: true,
      applicable: true,
      required: true,
      configuration_current: true,
      process_state: 'running',
      pid,
      run_at_load: true,
      keep_alive: true,
    },
  });
  const readback = (pid: number) => ({
    service_ready: true,
    server_reachable: true,
    service_status: 'running',
    supervisor: {
      surface_kind: 'opl_temporal_service_supervisor_state',
      status: 'loaded_running',
      installed: true,
      loaded: true,
      ready: true,
      observed_at: `2026-07-20T00:00:0${pid - 101}.000Z`,
      error: null,
      supported: true,
      applicable: true,
      required: true,
      configuration_current: true,
      process_state: 'running',
      pid,
      last_exit_status: 0,
      last_exit_signal: null,
      run_at_load: true,
      keep_alive: true,
      throttle_interval_seconds: 15,
      address: '127.0.0.1:7233',
      database_path: databasePath,
      launcher_source: 'temporal_cli_path',
      schedule_independent: true,
    },
  });
  return {
    schema: 'opl_temporal_service_supervisor_proof.v1',
    status: 'passed',
    runtime_profile: 'full',
    applicable: true,
    required: true,
    supervisor_label: 'ai.opl.family-runtime.temporal-service',
    start_action: {
      action_id: 'provider_service_start',
      dry_run: false,
      delegated_surface: 'opl family-runtime service start --provider temporal',
      result: {
        version: 'g2',
        family_runtime_service: {
          surface_id: 'opl_family_runtime_service',
          action: 'start',
          surface_kind: 'temporal_service_lifecycle_start',
          provider_kind: 'temporal',
          start_status: 'started_supervised',
          status: lifecycleStatus(101),
          supervisor_operation: { action: 'install', status: 'ready', ready: true, error: null },
        },
      },
    },
    restart_action: {
      action_id: 'provider_service_restart',
      dry_run: false,
      delegated_surface: 'opl family-runtime service restart --provider temporal',
      result: {
        version: 'g2',
        family_runtime_service: {
          surface_id: 'opl_family_runtime_service',
          action: 'restart',
          surface_kind: 'temporal_service_lifecycle_restart',
          provider_kind: 'temporal',
          restart_status: 'restarted',
          applicable: true,
          ready: true,
          reason: null,
          previous_supervisor_pid: 102,
          supervisor_pid: 103,
          supervisor_pid_changed: true,
          status: lifecycleStatus(103),
          supervisor_operation: { action: 'trigger', status: 'ready', ready: true, error: null },
        },
      },
    },
    plist: {
      path: plistPath,
      label: 'ai.opl.family-runtime.temporal-service',
      program_arguments: ['/runtime/bin/temporal', 'server', 'start-dev', '--db-filename', databasePath],
      run_at_load: true,
      keep_alive: true,
      database_path: databasePath,
    },
    initial_readback: readback(101),
    keep_alive_recovery: {
      termination: { pid: 101, signal: 'SIGTERM', status: 'sent' },
      readback: readback(102),
    },
    restart_readback: readback(103),
    session_reload: {
      bootout: {
        args: ['bootout', 'gui/501/ai.opl.family-runtime.temporal-service'],
        status: 0,
        signal: null,
        stdout: '',
        stderr: '',
      },
      bootstrap: {
        args: ['bootstrap', 'gui/501', plistPath],
        status: 0,
        signal: null,
        stdout: '',
        stderr: '',
      },
      readback: readback(104),
    },
    persistent_database: {
      path: databasePath,
      sqlite_header_valid: true,
      initial_size_bytes: 4096,
      file_identity: '1:42',
      same_file_after_keep_alive_recovery: true,
      same_file_after_restart: true,
      same_file_after_session_reload: true,
    },
  } as const;
}

function assetNames(kind: 'standard' | 'full', version: string): string[] {
  return kind === 'standard'
    ? [
        `One-Person-Lab-${version}-mac-arm64.dmg`,
        `One-Person-Lab-${version}-mac-arm64.zip`,
        `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
        'latest-arm64-mac.yml',
        'opl-app-component-manifest.json',
        'standard-local-authorization-policy.json',
      ]
    : [`One-Person-Lab-Full-${version}-mac-arm64.dmg`, 'opl-release-manifest.json'];
}

function writeTrack(root: string, kind: 'standard' | 'full', version: string): void {
  const trackRoot = path.join(root, kind);
  const assetsRoot = path.join(trackRoot, 'assets');
  const runId = kind === 'standard' ? 'local-standard-1' : 'github-full-2';
  fs.mkdirSync(assetsRoot, { recursive: true });
  for (const name of assetNames(kind, version)) {
    fs.writeFileSync(path.join(assetsRoot, name), `${kind}:${name}\n`);
  }
  const dmgName = assetNames(kind, version)[0];
  const dmgPath = path.join(assetsRoot, dmgName);
  const manifestPath = path.join(trackRoot, 'build-artifact-cohort.json');
  const smokeSummaryPath = path.join(trackRoot, 'smoke-summary.json');
  const manifest: BuildArtifactCohortV2 = {
    schema: 'opl_app_build_artifact_cohort.v2',
    release: { stable_session_id: stableSessionId, release_cohort_ref: releaseCohortRef },
    cohort: { app_sha: appSha, shell_sha: shellSha, framework_sha: frameworkSha },
    build: { version, kind },
    artifact: {
      name: dmgName,
      sha256: fileSha256(dmgPath),
      size_bytes: fs.statSync(dmgPath).size,
    },
    actions: { run_id: runId, run_attempt: '1', artifact_name: `${kind}-dmg-${version}` },
    digests: {
      packaged_tree_sha256: '0'.repeat(64),
      app_product_profile_sha256: '1'.repeat(64),
      gui_product_contract_sha256: '2'.repeat(64),
      smoke_harness_sha256: '3'.repeat(64),
      compiled_expectation_semantic_sha256: '4'.repeat(64),
      compiled_expectation_probe_sha256: '5'.repeat(64),
      qualification_input_manifest_sha256: '6'.repeat(64),
      ...(kind === 'full' ? {
        full_input_manifest_sha256: '7'.repeat(64),
        framework_bundled_catalog_sha256: '8'.repeat(64),
        full_toolchain_observation_receipt_sha256: '9'.repeat(64),
      } : {}),
    },
    qualification_runtime: { codex_cli: frozenCodexCliIdentity() },
  };
  writeJson(manifestPath, manifest);
  writeJson(smokeSummaryPath, {
    schema: 'opl_test_smoke_summary.v1',
    status: 'passed',
    ...(kind === 'full' ? { temporal_service_supervisor_proof: temporalSupervisorProof() } : {}),
  });
  const receipt = buildArtifactQualificationReceipt({
    manifest,
    manifestPath,
    result: 'passed',
    packageProfile: kind,
    qualificationRunId: `${kind}-qualification-1`,
    sourceArtifactRunId: runId,
    sourceArtifactName: manifest.actions.artifact_name,
    evidenceRef: `${kind}-qualification-evidence`,
    smokeSummaryPath,
  });
  writeJson(path.join(trackRoot, 'qualification-receipt.json'), receipt);
  fs.rmSync(smokeSummaryPath);
}

function fixture(options: {
  channel?: 'stable' | 'nightly';
  version?: string;
  includeFull?: boolean;
} = {}) {
  const channel = options.channel ?? 'stable';
  const version = options.version ?? (channel === 'stable' ? '26.7.20' : '26.7.20-nightly');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-bundle-'));
  writeJson(path.join(root, 'release-input.json'), {
    schema: 'opl_app_release_bundle_input.v1',
    channel,
    version,
    release_cohort_ref: releaseCohortRef,
    cohort: {
      app_sha: appSha,
      shell_sha: shellSha,
      framework_sha: frameworkSha,
    },
  });
  fs.writeFileSync(path.join(root, 'notes.md'), `# One Person Lab v${version}\n\nRelease notes.\n`);
  writeJson(path.join(root, 'notes-evidence.json'), {
    schema: 'opl_app_release_notes_evidence.v1',
    version,
    channel,
    release_title: `One Person Lab v${version}`,
    current_tag: `v${version}`,
  });
  writeTrack(root, 'standard', version);
  if (options.includeFull) writeTrack(root, 'full', version);
  return { root, version };
}

function withFixture(
  body: (input: ReturnType<typeof fixture>) => void,
  options?: Parameters<typeof fixture>[0],
): void {
  const input = fixture(options);
  try {
    body(input);
  } finally {
    fs.rmSync(input.root, { recursive: true, force: true });
  }
}

function runCli(args: string[]) {
  return spawnSync(process.execPath, ['--experimental-strip-types', cli, ...args], {
    cwd: appRoot,
    encoding: 'utf8',
  });
}

test('assembles a deterministic Standard binding without claiming release readiness', () => {
  withFixture(({ root, version }) => {
    const first = assembleReleaseBundle(root);
    const second = assembleReleaseBundle(root);
    assert.deepEqual(first, second);
    assert.equal(first.release.version, version);
    assert.equal(first.policy.latest.channel_allows_promotion, true);
    assert.equal(first.policy.latest.bundle_can_claim_release_ready, false);
    assert.equal(first.policy.latest.full_required, false);
    assert.equal(first.tracks.standard.status, 'bound');
    assert.equal(first.tracks.standard.builder_run_id, 'local-standard-1');
    assert.equal(first.tracks.standard.assets.length, 6);
    assert.deepEqual(first.tracks.full, { status: 'absent' });
    assert.deepEqual(validateReleaseBundle(first), []);
  });
});

test('binds a same-cohort Full add-on without changing updater authority', () => {
  withFixture(({ root }) => {
    const bundle = assembleReleaseBundle(root);
    assert.equal(bundle.tracks.full.status, 'bound');
    assert.equal(bundle.tracks.full.status === 'bound' && bundle.tracks.full.assets.length, 2);
    assert.equal(bundle.policy.updater.track, 'standard');
    assert.equal(bundle.policy.full.updater_metadata_allowed, false);
  }, { includeFull: true });
});

test('Nightly uses the same bundle contract but disallows Latest promotion', () => {
  withFixture(({ root }) => {
    const bundle = assembleReleaseBundle(root);
    assert.equal(bundle.release.prerelease, true);
    assert.equal(bundle.policy.latest.channel_allows_promotion, false);
    assert.equal(bundle.policy.latest.bundle_can_claim_release_ready, false);
    assert.equal(bundle.tracks.standard.assets.length, 6);
  }, { channel: 'nightly' });
});

test('CLI assemble, exact-input verify, and status expose one stable bundle identity', () => {
  withFixture(({ root }) => {
    const output = path.join(root, '..', `${path.basename(root)}-bundle.json`);
    try {
      const assembled = runCli(['assemble', '--input', root, '--output', output]);
      assert.equal(assembled.status, 0, assembled.stderr);
      const assembleStatus = JSON.parse(assembled.stdout);
      assert.equal(assembleStatus.content_verification, 'exact_input');

      const verified = runCli(['verify', '--bundle', output, '--input', root]);
      assert.equal(verified.status, 0, verified.stderr);
      assert.equal(JSON.parse(verified.stdout).bundle_id, assembleStatus.bundle_id);

      const status = runCli(['status', '--bundle', output]);
      assert.equal(status.status, 0, status.stderr);
      assert.equal(JSON.parse(status.stdout).content_verification, 'bundle_only');
    } finally {
      fs.rmSync(output, { force: true });
    }
  });
});

test('rejects missing, extra, and symlinked public assets', () => {
  withFixture(({ root, version }) => {
    const assets = path.join(root, 'standard', 'assets');
    fs.rmSync(path.join(assets, `One-Person-Lab-${version}-mac-arm64.zip.blockmap`));
    assert.throws(() => assembleReleaseBundle(root), /exact closed directory/);
  });
  withFixture(({ root }) => {
    fs.writeFileSync(path.join(root, 'standard', 'assets', 'unexpected.txt'), 'extra');
    assert.throws(() => assembleReleaseBundle(root), /exact closed directory/);
  });
  withFixture(({ root, version }) => {
    const assets = path.join(root, 'standard', 'assets');
    const target = path.join(assets, `One-Person-Lab-${version}-mac-arm64.zip`);
    fs.rmSync(target);
    fs.symlinkSync(path.join(assets, `One-Person-Lab-${version}-mac-arm64.dmg`), target);
    assert.throws(() => assembleReleaseBundle(root), /regular file|symlink/);
  });
});

test('rejects undeclared files at the Bundle and track boundaries', () => {
  withFixture(({ root }) => {
    fs.writeFileSync(path.join(root, 'ignored-release-state.json'), '{}\n');
    assert.throws(() => assembleReleaseBundle(root), /exact closed directory/);
  });
  withFixture(({ root }) => {
    fs.writeFileSync(path.join(root, 'standard', 'unbound-receipt.json'), '{}\n');
    assert.throws(() => assembleReleaseBundle(root), /exact closed directory/);
  });
});

test('rejects asset mutation even when every Git SHA remains unchanged', () => {
  withFixture(({ root, version }) => {
    const bundlePath = path.join(root, '..', `${path.basename(root)}-mutated-bundle.json`);
    try {
      const assembled = runCli(['assemble', '--input', root, '--output', bundlePath]);
      assert.equal(assembled.status, 0, assembled.stderr);
      fs.appendFileSync(
        path.join(root, 'standard', 'assets', `One-Person-Lab-${version}-mac-arm64.dmg`),
        'mutated',
      );
      const verified = runCli(['verify', '--bundle', bundlePath, '--input', root]);
      assert.equal(verified.status, 1);
      assert.match(verified.stderr, /artifact (size|SHA-256)/);
    } finally {
      fs.rmSync(bundlePath, { force: true });
    }
  });
});

test('rejects Full built for another release cohort', () => {
  withFixture(({ root }) => {
    const manifestPath = path.join(root, 'full', 'build-artifact-cohort.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.release.release_cohort_ref = `sha256:${'9'.repeat(64)}`;
    writeJson(manifestPath, manifest);
    assert.throws(() => assembleReleaseBundle(root), /release_cohort_ref expected/);
  }, { includeFull: true });
});

test('rejects a failed qualification receipt', () => {
  withFixture(({ root }) => {
    const receiptPath = path.join(root, 'standard', 'qualification-receipt.json');
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    receipt.status = 'failed';
    receipt.qualification.result = 'failed';
    writeJson(receiptPath, receipt);
    assert.throws(() => assembleReleaseBundle(root), /qualification result/);
  });
});

test('rejects release notes evidence from another version', () => {
  withFixture(({ root }) => {
    const evidencePath = path.join(root, 'notes-evidence.json');
    const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    evidence.version = '26.7.19';
    writeJson(evidencePath, evidence);
    assert.throws(() => assembleReleaseBundle(root), /version\/channel/);
  });
});

test('rejects unknown Release Bundle input fields instead of silently widening authority', () => {
  withFixture(({ root }) => {
    const inputPath = path.join(root, 'release-input.json');
    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    input.broker_admission = { bypass: true };
    writeJson(inputPath, input);
    assert.throws(() => assembleReleaseBundle(root), /invalid closed shape/);
  });
});

test('detects a self-consistent-looking bundle mutation through bundle_id', () => {
  withFixture(({ root }) => {
    const bundle = assembleReleaseBundle(root);
    bundle.tracks.standard.assets[0].size_bytes += 1;
    assert.match(validateReleaseBundle(bundle).join('; '), /bundle_id expected/);
  });
});

test('schema is Draft 2020-12 and closes every object boundary used by the bundle', () => {
  const schema = JSON.parse(fs.readFileSync(
    path.join(appRoot, 'contracts', 'app-release-bundle.schema.json'),
    'utf8',
  ));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.release.additionalProperties, false);
  assert.equal(schema.properties.tracks.additionalProperties, false);
  assert.equal(schema.$defs.bound_track.additionalProperties, false);
  assert.equal(schema.$defs.asset.additionalProperties, false);
  assert.equal(schema.$defs.standard_track.allOf[1].properties.assets.minItems, 6);
  assert.equal(schema.$defs.full_track.allOf[1].properties.assets.maxItems, 2);
  assert.equal(schema.allOf[0].then.properties.release.properties.prerelease.const, false);
  assert.equal(
    schema.allOf[0].else.properties.policy.properties.latest.properties.channel_allows_promotion.const,
    false,
  );
});
