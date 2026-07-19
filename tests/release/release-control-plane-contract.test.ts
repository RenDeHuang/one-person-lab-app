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
  assert.equal(stateMachine.execution_policy.promotion_minimum_remaining_budget_seconds, 900);
  assert.equal(stateMachine.execution_policy.promotion_failure_absorbing_for_mutation, true);
  assert.equal(stateMachine.execution_policy.promotion_same_session_successor_allowed, false);
  assert.equal(
    stateMachine.execution_policy.promotion_retry,
    'new_stable_session_required_after_read_only_reconcile',
  );
  assert.equal(stateMachine.latest_monotonicity_policy.target_must_be_newer_than_current_latest, true);
  assert.equal(stateMachine.latest_monotonicity_policy.equal_target_dispatch_allowed, false);
  assert.equal(stateMachine.latest_monotonicity_policy.downgrade_dispatch_allowed, false);
  assert.deepEqual(stateMachine.latest_monotonicity_policy.checks, [
    'controller_pre_dispatch',
    'workflow_prepare',
    'before_public_nonlatest',
    'before_latest_activation',
  ]);
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
      release.release_acceleration.stable_release_state_machine.execution_policy
        .promotion_same_session_successor_allowed = true;
    },
    (release) => {
      release.release_acceleration.stable_release_state_machine.execution_policy
        .promotion_minimum_remaining_budget_seconds = 0;
    },
    (release) => {
      release.release_acceleration.stable_release_state_machine.latest_monotonicity_policy
        .downgrade_dispatch_allowed = true;
    },
    (release) => {
      release.release_acceleration.stable_release_state_machine.latest_monotonicity_policy
        .checks = ['workflow_prepare'];
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

test('canonical unprovisioned broker authority is post-release hardening, not a current admission blocker', () => {
  const releaseContract = readJson('contracts/app-release-channel.json');
  const brokerAuthority = readJson('contracts/app-release-broker-authority.json');
  const gate = releaseContract.release_acceleration.github_actions
    .release_readiness_admission.broker_authority_gate;
  const readiness = evaluateReleaseBrokerAuthorityReadiness(brokerAuthority);

  assert.equal(brokerAuthority.status, 'unprovisioned_release_blocking');
  assert.equal(readiness.current_release_admission_readiness.status, 'ready');
  assert.deepEqual(readiness.current_release_admission_readiness.blockers, []);
  assert.equal(readiness.isolated_broker_hardening.status, 'blocked');
  assert.equal(readiness.isolated_broker_hardening.disposition, 'post_release_hardening');
  assert.ok(readiness.isolated_broker_hardening.blockers.some((blocker) => blocker.includes('not provisioned')));
  assert.equal(gate.current_admission_mode, 'admin_one_shot_controller');
  assert.equal(gate.required_before_positive_readiness, false);
  assert.equal(gate.required_status, 'structurally_valid');
  assert.equal(gate.fresh_credential_isolation_receipt_required, false);
  assert.equal(gate.unprovisioned_or_invalid_result, 'post_release_hardening_debt');
  assert.equal(gate.current_release_admission_readiness_field, 'current_release_admission_readiness');
  assert.equal(gate.isolated_broker_hardening_readiness_field, 'isolated_broker_hardening');
  assert.equal(brokerAuthority.current_release_admission.redispatch_after_unknown_outcome, false);
  assert.equal(brokerAuthority.current_release_admission.rerun_allowed, false);
  assert.equal(brokerAuthority.current_release_admission.cancel_allowed, false);

  const missingGate = structuredClone(releaseContract);
  delete missingGate.release_acceleration.github_actions.release_readiness_admission.broker_authority_gate;
  assert.ok(validateSilently(missingGate, brokerAuthority) > 0);
});
