import { validateUpstreamIntakePolicy } from '../../../scripts/validate-active-shell/upstream-intake-policy-validator.ts';
import {
  assert,
  fs,
  path,
  test,
  appRoot,
} from './helpers.ts';

function readContract() {
  return JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'));
}

function capability(contract, id: string) {
  return contract.upstream_intake.capability_classifications.find((entry) => entry.id === id);
}

function dependency(contract, id: string) {
  return contract.upstream_intake.dependency_classifications.find((entry) => entry.id === id);
}

test('AionUI v2.1.31 intake contract validates the fixed source refs and classification matrix', () => {
  const contract = readContract();

  assert.doesNotThrow(() => validateUpstreamIntakePolicy(contract));
  assert.equal(
    contract.upstream_intake.source_refs.fork_base.ref,
    '70974c59a275e565e8fc2bd7ecaf2dcac74227f0',
  );
  assert.equal(
    contract.upstream_intake.source_refs.evaluated_upstream.ref,
    'e49cd94935f4e461f002a1260a47c1b7b2ce81ca',
  );
  assert.equal(
    contract.upstream_intake.source_refs.selective_absorption_head.ref,
    'e38b00ba37cafe56d704b498a4882264836463e4',
  );
  assert.equal(capability(contract, 'database_recovery').classification, 'absorbed');
  assert.equal(capability(contract, 'feedback_diagnostics_privacy').classification, 'deferred');
  assert.equal(capability(contract, 'non_zh_en_locales').classification, 'rejected');
  assert.equal(capability(contract, 'aionui_team').classification, 'rejected');
  assert.equal(dependency(contract, 'aioncore_database_recovery').version_gate.minimum_version, 'v0.1.44');
  assert.equal(
    dependency(contract, 'aioncore_database_recovery').capability_gate.required_boundary_stage,
    'database.recoverable_corruption',
  );
});

test('AionUI intake validator rejects a missing required capability record', () => {
  const contract = readContract();
  contract.upstream_intake.capability_classifications = contract.upstream_intake.capability_classifications.filter(
    (entry) => entry.id !== 'cron_history',
  );

  assert.throws(
    () => validateUpstreamIntakePolicy(contract),
    /Active shell upstream intake capabilities ids/,
  );
});

test('AionUI intake validator rejects a missing required record field', () => {
  const contract = readContract();
  delete capability(contract, 'startup_directories').owner_ref;

  assert.throws(
    () => validateUpstreamIntakePolicy(contract),
    /startup_directories missing required field owner_ref/,
  );
});

test('AionUI intake validator rejects an invalid classification state', () => {
  const contract = readContract();
  capability(contract, 'database_recovery').classification = 'deferred';

  assert.throws(
    () => validateUpstreamIntakePolicy(contract),
    /database_recovery\.classification must be absorbed, received deferred/,
  );
});

test('AionUI intake validator rejects an unknown dependency', () => {
  const contract = readContract();
  capability(contract, 'database_recovery').dependencies = ['unknown_aioncore_dependency'];

  assert.throws(
    () => validateUpstreamIntakePolicy(contract),
    /references unknown dependency unknown_aioncore_dependency/,
  );
});

test('AionUI intake validator rejects missing evidence', () => {
  const contract = readContract();
  capability(contract, 'settings_i18n').evidence = [];

  assert.throws(
    () => validateUpstreamIntakePolicy(contract),
    /settings_i18n\.evidence must be a non-empty string array/,
  );
});

test('AionUI intake validator rejects a weakened AionCore capability gate', () => {
  const contract = readContract();
  dependency(contract, 'aioncore_database_recovery').capability_gate.required_boundary_stage =
    'database.recovery_optional';

  assert.throws(
    () => validateUpstreamIntakePolicy(contract),
    /capability_gate\.required_boundary_stage must be database\.recoverable_corruption/,
  );
});
