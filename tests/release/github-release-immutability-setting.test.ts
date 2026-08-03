import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertImmutabilitySettingReceipt,
  buildSettingReceipt,
} from '../../scripts/github-release-immutability-setting.ts';
import { hasExactImmutabilityWindowPhases } from '../../scripts/validate-release-boundary/release-contract-policy.ts';

const observedAt = '2026-08-03T08:00:00.000Z';

test('immutability window phases are ordered, not merely set-equal', () => {
  const phases = [
    'preflight_enabled_not_owner_enforced',
    'disable_before_release_creation',
    'publish_standard_and_activate_latest',
    'restore_enabled_and_read_back',
  ];
  assert.equal(hasExactImmutabilityWindowPhases(phases), true);
  assert.equal(hasExactImmutabilityWindowPhases([phases[1], phases[0], ...phases.slice(2)]), false);
  assert.equal(hasExactImmutabilityWindowPhases([...phases, phases[3]]), false);
});

test('setting receipts bind enabled -> disabled -> restored without a retroactive lock claim', () => {
  const preflight = buildSettingReceipt({
    phase: 'preflight',
    setting: { enabled: true, enforced_by_owner: false },
    observedAt,
  });
  const disabled = buildSettingReceipt({
    phase: 'disabled',
    setting: { enabled: false, enforced_by_owner: false },
    observedAt: '2026-08-03T08:00:01.000Z',
    priorReceipt: preflight,
  });
  const restored = buildSettingReceipt({
    phase: 'restored',
    setting: { enabled: true, enforced_by_owner: false },
    observedAt: '2026-08-03T08:05:00.000Z',
    priorReceipt: disabled,
    preflightReceipt: preflight,
    release: { id: 4242, tag: 'v26.8.4', immutable: false },
  });

  assert.equal(assertImmutabilitySettingReceipt(preflight, 'preflight'), preflight);
  assert.equal(assertImmutabilitySettingReceipt(disabled, 'disabled', preflight), disabled);
  assert.equal(assertImmutabilitySettingReceipt(restored, 'restored', disabled, preflight), restored);
  assert.equal(restored.applies_to, 'future_releases_only');
  assert.equal(restored.candidate_native_immutable, false);
  assert.equal(restored.retroactive_lock_claimed, false);
  assert.equal(restored.candidate_protection, 'workflow_asset_name_digest_cas_and_unified_attestation');
});

test('setting receipts reject owner enforcement and immutable candidate claims', () => {
  assert.throws(
    () => buildSettingReceipt({
      phase: 'preflight',
      setting: { enabled: true, enforced_by_owner: true },
      observedAt,
    }),
    /owner enforcement/,
  );
  const preflight = buildSettingReceipt({
    phase: 'preflight',
    setting: { enabled: true, enforced_by_owner: false },
    observedAt,
  });
  const disabled = buildSettingReceipt({
    phase: 'disabled',
    setting: { enabled: false, enforced_by_owner: false },
    observedAt,
    priorReceipt: preflight,
  });
  assert.throws(
    () => buildSettingReceipt({
      phase: 'restored',
      setting: { enabled: true, enforced_by_owner: false },
      observedAt,
      priorReceipt: disabled,
      preflightReceipt: preflight,
      release: { id: 4242, tag: 'v26.8.4', immutable: true },
    }),
    /published mutable Standard/,
  );
});

test('phase validators reject forged setting semantics, candidate claims, and broken receipt chains', () => {
  const preflight = buildSettingReceipt({
    phase: 'preflight',
    setting: { enabled: true, enforced_by_owner: false },
    observedAt,
  });
  const disabled = buildSettingReceipt({
    phase: 'disabled',
    setting: { enabled: false, enforced_by_owner: false },
    observedAt: '2026-08-03T08:00:01.000Z',
    priorReceipt: preflight,
  });
  const restored = buildSettingReceipt({
    phase: 'restored',
    setting: { enabled: true, enforced_by_owner: false },
    observedAt: '2026-08-03T08:05:00.000Z',
    priorReceipt: disabled,
    preflightReceipt: preflight,
    release: { id: 4242, tag: 'v26.8.4', immutable: false },
  });
  for (const mutate of [
    (value: any) => { value.setting.enabled = true; },
    (value: any) => { value.setting.enforced_by_owner = true; },
    (value: any) => { value.applies_to = 'retroactive'; },
    (value: any) => { value.prior_receipt_sha256 = `sha256:${'0'.repeat(64)}`; },
    (value: any) => { value.candidate_release = { id: 1, tag: 'v1.2.3', immutable: false }; },
    (value: any) => { value.retroactive_lock_claimed = true; },
  ]) {
    const forged = structuredClone(disabled);
    mutate(forged);
    assert.throws(() => assertImmutabilitySettingReceipt(forged, 'disabled', preflight));
  }
  assert.throws(() => assertImmutabilitySettingReceipt(disabled, 'disabled'), /exact prior receipt/);
  assert.throws(
    () => assertImmutabilitySettingReceipt(restored, 'restored', disabled, {
      ...preflight,
      observed_at: '2026-08-03T07:59:59.000Z',
    }),
    /prior digest is broken/,
  );
  const claimedImmutable = structuredClone(restored);
  claimedImmutable.candidate_native_immutable = true;
  assert.throws(
    () => assertImmutabilitySettingReceipt(claimedImmutable, 'restored', disabled, preflight),
    /published mutable Standard/,
  );
});

test('failed publication can restore the future-release setting without claiming a candidate', () => {
  const preflight = buildSettingReceipt({
    phase: 'preflight',
    setting: { enabled: true, enforced_by_owner: false },
    observedAt,
  });
  const disabled = buildSettingReceipt({
    phase: 'disabled',
    setting: { enabled: false, enforced_by_owner: false },
    observedAt,
    priorReceipt: preflight,
  });
  const restored = buildSettingReceipt({
    phase: 'restored',
    setting: { enabled: true, enforced_by_owner: false },
    observedAt,
    priorReceipt: disabled,
    preflightReceipt: preflight,
  });
  assert.equal(assertImmutabilitySettingReceipt(restored, 'restored', disabled, preflight), restored);
  assert.equal(restored.publication_outcome, 'not_published');
  assert.equal(restored.candidate_release, null);
});

test('unknown publication recovery restores the setting without inventing candidate identity', () => {
  const preflight = buildSettingReceipt({
    phase: 'preflight',
    setting: { enabled: true, enforced_by_owner: false },
    observedAt,
  });
  const disabled = buildSettingReceipt({
    phase: 'disabled',
    setting: { enabled: false, enforced_by_owner: false },
    observedAt,
    priorReceipt: preflight,
  });
  const restored = buildSettingReceipt({
    phase: 'restored',
    setting: { enabled: true, enforced_by_owner: false },
    observedAt,
    priorReceipt: disabled,
    preflightReceipt: preflight,
    publicationOutcome: 'unknown',
  });
  assert.equal(assertImmutabilitySettingReceipt(restored, 'restored', disabled, preflight), restored);
  assert.equal(restored.publication_outcome, 'unknown');
  assert.equal(restored.candidate_release, null);
  assert.equal(restored.candidate_native_immutable, null);
  assert.equal(restored.retroactive_lock_claimed, false);
});
