import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  evaluateReleaseBrokerAuthorityReadiness,
  validateReleaseAccelerationPolicy,
} from '../../scripts/validate-release-boundary/release-contract-policy.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');

function readJson(relativePath: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8')) as Record<string, any>;
}

function validateSilently(releaseContract: Record<string, any>, brokerAuthority: unknown): number {
  const originalError = console.error;
  console.error = () => {};
  try {
    return validateReleaseAccelerationPolicy(releaseContract, brokerAuthority);
  } finally {
    console.error = originalError;
  }
}

test('release control-plane contract enforces absorbing Standard and Full deadlines', () => {
  const releaseContract = readJson('contracts/app-release-channel.json');
  const brokerAuthority = readJson('contracts/app-release-broker-authority.json');
  const stateMachine = releaseContract.release_acceleration.stable_release_state_machine;

  assert.equal(validateReleaseAccelerationPolicy(releaseContract, brokerAuthority), 0);
  assert.equal(stateMachine.standard_deadline_policy.warning_after_seconds, 3600);
  assert.equal(stateMachine.standard_deadline_policy.deadline_after_seconds, 5400);
  assert.equal(stateMachine.standard_deadline_policy.deadline_boundary, 'at_or_after_90_minutes');
  assert.equal(stateMachine.standard_deadline_policy.absorbing, true);
  assert.deepEqual(
    stateMachine.standard_deadline_policy.legal_after_deadline,
    ['read_only_reconcile', 'emergency_cancel'],
  );
  assert.equal(stateMachine.full_addon_deadline_policy.deadline_after_seconds, 3000);
  assert.equal(stateMachine.full_addon_deadline_policy.deadline_signed_in_acceptance, true);
  assert.equal(stateMachine.full_addon_deadline_policy.terminal_status, 'blocked_with_debt');
  assert.equal(stateMachine.full_addon_deadline_policy.absorbing, true);
});

test('release boundary rejects deadline, late-success, and conversation authority drift', () => {
  const canonicalRelease = readJson('contracts/app-release-channel.json');
  const brokerAuthority = readJson('contracts/app-release-broker-authority.json');
  const mutations: Array<(release: Record<string, any>) => void> = [
    (release) => {
      release.release_acceleration.stable_release_state_machine.standard_deadline_policy.absorbing = false;
    },
    (release) => {
      release.release_acceleration.stable_release_state_machine.standard_deadline_policy
        .late_success_policy = 'upgrade_terminal';
    },
    (release) => {
      release.release_acceleration.stable_release_state_machine.full_addon_deadline_policy
        .deadline_signed_in_acceptance = false;
    },
    (release) => {
      release.release_acceleration.stable_release_state_machine.coordination_boundary
        .conversation_or_agent_tree_can_watch = true;
    },
    (release) => {
      release.release_acceleration.gate_reuse.attempt_strategy_switch.after_deadline_legal_actions = [
        'same_artifact_targeted_recovery',
      ];
    },
  ];

  for (const mutate of mutations) {
    const drifted = structuredClone(canonicalRelease);
    mutate(drifted);
    assert.ok(validateSilently(drifted, brokerAuthority) > 0);
  }
});

test('canonical unprovisioned broker authority is a release-readiness blocker', () => {
  const releaseContract = readJson('contracts/app-release-channel.json');
  const brokerAuthority = readJson('contracts/app-release-broker-authority.json');
  const gate = releaseContract.release_acceleration.github_actions
    .release_readiness_admission.broker_authority_gate;
  const readiness = evaluateReleaseBrokerAuthorityReadiness(brokerAuthority);

  assert.equal(brokerAuthority.status, 'unprovisioned_release_blocking');
  assert.equal(readiness.status, 'blocked');
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('not provisioned')));
  assert.equal(gate.required_before_positive_readiness, true);
  assert.equal(gate.required_status, 'provisioned');
  assert.equal(gate.fresh_credential_isolation_receipt_required, true);
  assert.equal(gate.unprovisioned_or_invalid_result, 'typed_terminal_blocker');
  assert.equal(gate.unprovisioned_status_is_release_ready, false);

  const missingGate = structuredClone(releaseContract);
  delete missingGate.release_acceleration.github_actions.release_readiness_admission.broker_authority_gate;
  assert.ok(validateSilently(missingGate, brokerAuthority) > 0);
});
