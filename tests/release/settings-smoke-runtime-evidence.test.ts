import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSettingsSmokeRuntimeEvidence } from '../../scripts/validate-settings-smoke-runtime-evidence.ts';

function route(id: string, requestedHash: string, resolvedHash: string) {
  return {
    id,
    requested_hash: requestedHash,
    resolved_hash: resolvedHash,
    interactions: {
      runtimeRefresh: {
        requested_hash: requestedHash,
        resolved_hash: resolvedHash,
        readiness: { hash: resolvedHash, state: 'ready', pageReady: true },
        refresh: {
          before_click: { buttonReady: true },
          after_click: { buttonReady: true },
        },
      },
    },
  };
}

function summary() {
  return {
    surface_id: 'opl_packaged_gui_settings_smoke',
    status: 'passed',
    pages: [
      { id: 'general', hash: '#/settings/general' },
      route('runtime-settings-alias', '#/settings/runtime', '#/settings/environment'),
      route('runtime-status', '#/runtime', '#/runtime'),
    ],
  };
}

test('production Settings evidence requires separate alias and standalone Runtime refreshes', () => {
  assert.deepEqual(validateSettingsSmokeRuntimeEvidence(summary()), {
    schema: 'opl_settings_runtime_refresh_evidence_verification.v1',
    status: 'passed',
    production_default_targets_required: true,
    synthetic_target_injection_allowed: false,
    routes: [
      {
        id: 'runtime-settings-alias',
        requested_hash: '#/settings/runtime',
        resolved_hash: '#/settings/environment',
        readiness_state: 'ready',
      },
      {
        id: 'runtime-status',
        requested_hash: '#/runtime',
        resolved_hash: '#/runtime',
        readiness_state: 'ready',
      },
    ],
  });
});

test('production Settings evidence rejects missing, duplicate, misrouted, or non-ready probes', () => {
  const missing = summary();
  missing.pages.pop();
  assert.throws(() => validateSettingsSmokeRuntimeEvidence(missing), /exactly one #\/runtime/);

  const duplicate = summary();
  duplicate.pages.push(route('runtime-status', '#/runtime', '#/runtime'));
  assert.throws(() => validateSettingsSmokeRuntimeEvidence(duplicate), /exactly one #\/runtime/);

  const misrouted = summary();
  misrouted.pages[1].resolved_hash = '#/runtime';
  assert.throws(() => validateSettingsSmokeRuntimeEvidence(misrouted), /must resolve to #\/settings\/environment/);

  const notReady = summary();
  notReady.pages[2].interactions.runtimeRefresh.readiness.pageReady = false;
  assert.throws(() => validateSettingsSmokeRuntimeEvidence(notReady), /was not structurally ready/);

  const mismatched = summary();
  mismatched.pages[2].interactions.runtimeRefresh.resolved_hash = '#/settings/environment';
  assert.throws(() => validateSettingsSmokeRuntimeEvidence(mismatched), /nested Runtime refresh identity/);

  const readinessMismatch = summary();
  readinessMismatch.pages[1].interactions.runtimeRefresh.readiness.hash = '#/settings/environment?stale=1';
  assert.throws(() => validateSettingsSmokeRuntimeEvidence(readinessMismatch), /readiness hash does not match/);
});
