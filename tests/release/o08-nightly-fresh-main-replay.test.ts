import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assertExactPathSet,
  assertFreshMainOverlayResolution,
  assertHunkDigest,
  assertNoSourceGateReceiptReuse,
  assertOverlapResolution,
  assertWireRefIdentity,
  readReplayManifest,
  validateFreshSourceGateReceipt,
  validateReplayManifest,
  type O08ReplayManifest,
} from '../../scripts/validate-o08-nightly-fresh-main-replay.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = path.join(
  appRoot,
  'contracts',
  'o08-nightly-fresh-main-replay-manifest.json',
);

function manifest(): O08ReplayManifest {
  return structuredClone(readReplayManifest(manifestPath));
}

function sourceGateReceipt(
  sourceManifest: O08ReplayManifest,
  overrides: Record<string, any> = {},
): any {
  const appSha = overrides.appSha ?? 'a'.repeat(40);
  const generatedAt = overrides.generatedAt ?? '2026-07-26T11:01:00.000Z';
  return {
    schema: 'opl_app_release_source_gate.v1',
    generated_at: generatedAt,
    status: 'passed',
    expected_app_head: appSha,
    app_head: appSha,
    typed_blocker: null,
    admission: {
      status: 'passed',
      immutable_cohort: {
        version: '26.7.26',
        app_sha: appSha,
        shell_sha: sourceManifest.cohort_currentness.shell.commit,
        framework_sha: sourceManifest.cohort_currentness.framework.commit,
      },
    },
    checks: [{ id: 'app_release_boundary_contract', status: 'passed' }],
    required_gates: [{
      id: 'app_release_boundary_contract',
      required: true,
      executed: true,
    }],
    ...overrides.receipt,
  };
}

test('checked-in manifest freezes exact16 then exact17 into exact30 with exact3 overlap', () => {
  const sourceManifest = manifest();
  assert.deepEqual(sourceManifest.source_basis, {
    repository: 'https://github.com/gaofeng21cn/one-person-lab-app.git',
    commit: 'dbdbe9e4049893078ac1394b42ff06bd8527c8d7',
    tree: '4bd490da2260fe1bccdaed8daa26f518d6b179e4',
  });
  assert.equal(
    sourceManifest.fresh_main.commit,
    'd1a7e7a9da1bc5a73ee03b653145c79b9f35bfdd',
  );
  assert.equal(
    sourceManifest.fresh_main.tree,
    '4dfe9ae51c6b42ec54953baa68f42726ec60d315',
  );
  assert.deepEqual(sourceManifest.replay.order, [
    'e306_stable_source',
    'o08_standard_nightly',
  ]);
  assert.deepEqual(sourceManifest.replay.successor_chain, {
    process: {
      commit: '588052b0c11c218be34edefb0d012efdeccf144d',
      tree: '7de36e354be56f2144a0156911c4889a92616feb',
      parent: 'd1a7e7a9da1bc5a73ee03b653145c79b9f35bfdd',
    },
    nightly: {
      commit: 'ba1031416bb4b2bf768bd9b01685bad457e0f2da',
      tree: '553da90abfcc9e056adc5c2a9abf42858bcb9905',
      parent: '588052b0c11c218be34edefb0d012efdeccf144d',
    },
  });
  assert.deepEqual(sourceManifest.cohort_currentness, {
    shell: {
      repository: 'https://github.com/gaofeng21cn/opl-aion-shell.git',
      ref: 'refs/heads/main',
      commit: 'b8c180c77f4d5cef8bbaa041e41cfd01dc6809a9',
      tree: 'edda1786b2f515be0aa0b6fba601b7cac52c0ff5',
    },
    framework: {
      repository: 'https://github.com/gaofeng21cn/one-person-lab.git',
      ref: 'refs/heads/main',
      commit: '53129eba55c26ecb9c95625c93b3951b39ffeaa5',
      tree: 'aa3ec51fd7666cd063864b9a44e077636d28c690',
    },
  });
  assert.equal(sourceManifest.sources.process.tracked_path_count, 16);
  assert.equal(sourceManifest.sources.nightly.tracked_path_count, 17);
  assert.equal(sourceManifest.replay.tracked_path_count, 30);
  assert.equal(sourceManifest.replay.fresh_main_overlay_path_count, 2);
  assert.equal(sourceManifest.replay.overlap_path_count, 3);
  assert.equal(sourceManifest.replay.validator_support_paths.length, 4);
  assert.deepEqual(sourceManifest.readback.post_commit_requires.slice(0, 3), [
    'base_is_ancestor',
    'support_tip_descends_from_nightly_successor',
    'nightly_successor_to_support_tip_is_exact4',
  ]);
  assert.equal(sourceManifest.authority.mutation_authority, false);
  assert.equal(sourceManifest.authority.canonical_writer, 'Integrator');
});

test('manifest rejects the superseded reverse replay order', () => {
  const sourceManifest = manifest();
  sourceManifest.replay.order.reverse();
  assert.throws(
    () => validateReplayManifest(sourceManifest),
    /must be e306 Stable\/source first, then O08 Nightly/,
  );
});

test('manifest rejects any successor-chain parent drift', () => {
  const processDrift = manifest();
  processDrift.replay.successor_chain.process.parent = 'f'.repeat(40);
  assert.throws(
    () => validateReplayManifest(processDrift),
    /fresh main -> e306 successor -> O08 successor/,
  );

  const nightlyDrift = manifest();
  nightlyDrift.replay.successor_chain.nightly.parent = 'f'.repeat(40);
  assert.throws(
    () => validateReplayManifest(nightlyDrift),
    /fresh main -> e306 successor -> O08 successor/,
  );
});

test('manifest rejects fresh-main overlay inventory or whole-file semantic loss', () => {
  const extraOverlay = manifest();
  extraOverlay.replay.fresh_main_overlays.push({
    ...extraOverlay.replay.fresh_main_overlays[0]!,
    path: 'scripts/forbidden-fresh-main-overlay.ts',
  });
  extraOverlay.replay.fresh_main_overlay_path_count = 3;
  assert.throws(
    () => validateReplayManifest(extraOverlay),
    /Fresh-main overlay must remain exact2/,
  );

  const wholeFile = manifest();
  wholeFile.replay.fresh_main_overlays[0]!.combined_blob =
    wholeFile.replay.fresh_main_overlays[0]!.fresh_main_blob;
  assert.throws(
    () => validateReplayManifest(wholeFile),
    /forbidden whole-file resolution/,
  );
});

test('manifest rejects any 31st replay payload path', () => {
  const sourceManifest = manifest();
  sourceManifest.replay.tracked_paths.push('scripts/forbidden-31st-path.ts');
  sourceManifest.replay.tracked_path_count = 31;
  assert.throws(
    () => validateReplayManifest(sourceManifest),
    /exact30 union/,
  );
  assert.throws(
    () => assertExactPathSet(
      [...manifest().replay.tracked_paths, 'scripts/forbidden-31st-path.ts'],
      manifest().replay.tracked_paths,
    ),
    /unknown\/31st paths/,
  );
});

test('fresh-main overlay resolver rejects either single side and any unknown blob', () => {
  for (const overlay of manifest().replay.fresh_main_overlays) {
    assert.throws(
      () => assertFreshMainOverlayResolution(overlay, overlay.fresh_main_blob),
      /discarded either fresh-main or e306 semantics/,
    );
    assert.throws(
      () => assertFreshMainOverlayResolution(overlay, overlay.process_blob),
      /discarded either fresh-main or e306 semantics/,
    );
    assert.throws(
      () => assertFreshMainOverlayResolution(overlay, 'f'.repeat(40)),
      /fresh-main overlay blob drift/,
    );
    assert.doesNotThrow(
      () => assertFreshMainOverlayResolution(overlay, overlay.combined_blob),
    );
  }
});

test('overlap resolver rejects process-only, Nightly-only, and unknown blobs', () => {
  for (const overlap of manifest().replay.overlaps) {
    assert.throws(
      () => assertOverlapResolution(overlap, overlap.process_blob),
      /whole-file ours\/theirs/,
    );
    assert.throws(
      () => assertOverlapResolution(overlap, overlap.nightly_blob),
      /whole-file ours\/theirs/,
    );
    assert.throws(
      () => assertOverlapResolution(overlap, 'f'.repeat(40)),
      /overlap blob drift/,
    );
    assert.doesNotThrow(() => assertOverlapResolution(overlap, overlap.combined_blob));
  }
});

test('hunk digest and wire currentness drift fail closed', () => {
  const patch = 'exact semantic hunk\n';
  const digest = crypto.createHash('sha256').update(patch).digest('hex');
  assert.doesNotThrow(() => assertHunkDigest('contract.json', 'process', digest, patch));
  assert.throws(
    () => assertHunkDigest('contract.json', 'process', digest, `${patch}drift\n`),
    /hunk drift/,
  );
  assert.doesNotThrow(() => assertWireRefIdentity('App main', 'a'.repeat(40), 'a'.repeat(40)));
  assert.throws(
    () => assertWireRefIdentity('App main', 'a'.repeat(40), 'b'.repeat(40)),
    /currentness drift/,
  );
});

test('source-gate receipt is forbidden before absorption', () => {
  assert.doesNotThrow(() => assertNoSourceGateReceiptReuse('', {}));
  assert.throws(
    () => assertNoSourceGateReceiptReuse('/tmp/stale-source-gate.json', {}),
    /reuse is forbidden before absorption/,
  );
  assert.throws(
    () => assertNoSourceGateReceiptReuse('', {
      OPL_RELEASE_SOURCE_GATE_RECEIPT: '/tmp/stale-source-gate.json',
    }),
    /OPL_RELEASE_SOURCE_GATE_RECEIPT/,
  );
});

test('absorption accepts only a fresh source-gate receipt bound to the new exact cohort', () => {
  const sourceManifest = manifest();
  const appSha = 'a'.repeat(40);
  const expected = {
    appSha,
    shellSha: sourceManifest.cohort_currentness.shell.commit,
    frameworkSha: sourceManifest.cohort_currentness.framework.commit,
    commitTimestamp: '2026-07-26T11:00:00.000Z',
  };
  assert.doesNotThrow(
    () => validateFreshSourceGateReceipt(sourceGateReceipt(sourceManifest), expected),
  );

  const staleApp = sourceGateReceipt(sourceManifest, { appSha: 'b'.repeat(40) });
  assert.throws(
    () => validateFreshSourceGateReceipt(staleApp, expected),
    /stale, incomplete, or cross-cohort/,
  );

  const staleTime = sourceGateReceipt(sourceManifest, {
    generatedAt: '2026-07-26T10:59:59.000Z',
  });
  assert.throws(
    () => validateFreshSourceGateReceipt(staleTime, expected),
    /predates the absorbed App commit/,
  );
});

test('all generated surfaces explicitly reject receipt and cohort reuse', () => {
  const surfaces = manifest().generated_surfaces;
  assert.equal(surfaces.length, 10);
  assert.equal(surfaces.every((surface) => surface.reuse_allowed === false), true);
  assert.deepEqual(
    surfaces.map((surface) => surface.schema),
    [
      'opl_app_release_source_gate.v1',
      'opl_release_dispatch_guard.v1',
      'opl_stable_release_admission_manifest.v1',
      'opl_stable_release_admission_verification.v1',
      'opl_app_source_qualification_receipt.v1',
      'opl_standard_nightly_request.v1',
      'opl_standard_nightly_qualification.v1',
      'opl_standard_nightly_publication_receipt.v1',
      'temporary_exact_shell_product_profile_projection',
      'opl_app_build_artifact_cohort.v2',
    ],
  );
});

test('gate orchestration uses canonical Node and contains no release/public mutation command', () => {
  const sourceManifest = manifest();
  const gates = sourceManifest.gates;
  assert.deepEqual(gates.map((gate) => gate.id), [
    'fresh_replay_validator_focused',
    'process_focused_38',
    'nightly_focused_expanded',
    'release_boundary_static',
    'release_boundary_aggregate',
    'active_shell_aggregate',
  ]);
  const commands = gates.map((gate) => gate.command.join(' ')).join('\n');
  assert.match(commands, /node --experimental-strip-types --test/);
  assert.match(commands, /npm run test:release-boundary/);
  assert.match(commands, /npm run validate:active-shell/);
  assert.doesNotMatch(
    commands,
    /workflow dispatch|release:nightly|nightly-release-publisher|git push|gh release|brew tap/i,
  );
  assert.deepEqual(sourceManifest.gate_environment, {
    required_variables: [
      'OPL_FULL_OPL_FLOW_ROOT',
      'OPL_FLOW_WORKFLOW_POLICY',
    ],
    policy_relative_to_root: 'contracts/workflow-policy.json',
    mutation_allowed: false,
  });
});

test('support slice stays disjoint from exact30 and the authority receipt is exact', () => {
  const sourceManifest = manifest();
  const payload = new Set(sourceManifest.replay.tracked_paths);
  assert.equal(
    sourceManifest.replay.validator_support_paths.every((candidatePath) => !payload.has(candidatePath)),
    true,
  );
  assert.deepEqual(sourceManifest.authority.order_receipt, {
    path: '/Users/gaofeng/Documents/Codex/2026-07-26/opl-closeout-successor-20260726/outputs/opl-o11-app-exact30-order-correction-20260726.md',
    sha256: 'b5e389bee7ef3e7301ac0bcbfab2bdfbed57b77226aec77ae31a28544dcc77c0',
    size_bytes: 1913,
    mode: '0444',
    supersedes: 'replay_order_only',
  });
  assert.equal(fs.existsSync(manifestPath), true);
});
