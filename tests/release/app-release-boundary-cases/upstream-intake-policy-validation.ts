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

const shellPaths = {
  shellRoot: '/fixture/active-shell',
  packageManifestPath: '/fixture/active-shell/package.json',
};

function validateContract(contract, options = {}) {
  return validateUpstreamIntakePolicy(contract, shellPaths, {
    readJsonFile: () => ({
      aioncoreVersion: dependency(contract, 'aioncore_database_recovery').version_gate.selective_absorption_version,
    }),
    isGitAncestor: () => true,
    ...options,
  });
}

test('AionUI v2.1.31 intake contract validates the fixed source refs and classification matrix', () => {
  const contract = readContract();
  const checkedRefs: string[] = [];
  let packagePath = '';

  assert.doesNotThrow(() => validateContract(contract, {
    readJsonFile: (filePath) => {
      packagePath = filePath;
      return { aioncoreVersion: 'v0.1.44' };
    },
    isGitAncestor: (ref) => {
      checkedRefs.push(ref);
      return true;
    },
  }));
  assert.equal(packagePath, shellPaths.packageManifestPath);
  assert.deepEqual(checkedRefs, [
    contract.upstream_intake.source_refs.selective_absorption_head.ref,
    capability(contract, 'feedback_diagnostics_privacy').remediation_ref,
    dependency(contract, 'aioncore_database_recovery').remediation_ref,
  ]);
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
  assert.equal(capability(contract, 'database_recovery').release_gate, 'database_recovery_dependency_satisfied');
  assert.equal(capability(contract, 'feedback_diagnostics_privacy').classification, 'absorbed');
  assert.equal(capability(contract, 'feedback_diagnostics_privacy').release_gate, 'feedback_privacy_redaction_verified');
  assert.equal(capability(contract, 'non_zh_en_locales').classification, 'rejected');
  assert.equal(capability(contract, 'aionui_team').classification, 'rejected');
  const aionCoreRecovery = dependency(contract, 'aioncore_database_recovery');
  assert.equal(aionCoreRecovery.classification, 'absorbed');
  assert.equal(aionCoreRecovery.release_gate, 'aioncore_database_recovery_verified');
  assert.equal(aionCoreRecovery.remediation_ref, 'a5811dd3947e72b3da69ad5a4457f4e9f5acf71c');
  assert.equal(aionCoreRecovery.version_gate.minimum_version, 'v0.1.44');
  assert.equal(
    aionCoreRecovery.capability_gate.required_boundary_stage,
    'database.recoverable_corruption',
  );
  assert.equal(aionCoreRecovery.capability_gate.state, 'verified');
});

test('AionUI intake validator rejects a missing required capability record', () => {
  const contract = readContract();
  contract.upstream_intake.capability_classifications = contract.upstream_intake.capability_classifications.filter(
    (entry) => entry.id !== 'cron_history',
  );

  assert.throws(
    () => validateContract(contract),
    /Active shell upstream intake capabilities ids/,
  );
});

test('AionUI intake validator rejects a missing required record field', () => {
  const contract = readContract();
  delete capability(contract, 'startup_directories').owner_ref;

  assert.throws(
    () => validateContract(contract),
    /startup_directories missing required field owner_ref/,
  );
});

test('AionUI intake validator rejects an invalid classification state', () => {
  const contract = readContract();
  capability(contract, 'database_recovery').classification = 'pending';

  assert.throws(
    () => validateContract(contract),
    /database_recovery\.classification must be one of absorbed, rejected, deferred/,
  );
});

test('AionUI intake validator rejects an unexpected dependency', () => {
  const contract = readContract();
  capability(contract, 'database_recovery').dependencies = ['unknown_aioncore_dependency'];

  assert.throws(
    () => validateContract(contract),
    /database_recovery\.dependencies must be \["aioncore_database_recovery"\]/,
  );
});

test('AionUI intake validator rejects missing evidence', () => {
  const contract = readContract();
  capability(contract, 'settings_i18n').evidence = [];

  assert.throws(
    () => validateContract(contract),
    /settings_i18n\.evidence must be a non-empty string array/,
  );
});

test('AionUI intake validator rejects a weakened AionCore capability gate', () => {
  const contract = readContract();
  dependency(contract, 'aioncore_database_recovery').capability_gate.required_boundary_stage =
    'database.recovery_optional';

  assert.throws(
    () => validateContract(contract),
    /capability_gate\.required_boundary_stage must be database\.recoverable_corruption/,
  );
});

test('AionUI intake validator rejects a lowered AionCore minimum version', () => {
  const contract = readContract();
  dependency(contract, 'aioncore_database_recovery').version_gate.minimum_version = 'v0.1.28';

  assert.throws(
    () => validateContract(contract),
    /version_gate\.minimum_version must be v0\.1\.44/,
  );
});

test('AionUI intake validator rejects an active shell package version mismatch', () => {
  const contract = readContract();

  assert.throws(
    () => validateContract(contract, {
      readJsonFile: () => ({ aioncoreVersion: 'v0.1.28' }),
    }),
    /active shell package aioncoreVersion v0\.1\.28 must match selective_absorption_version v0\.1\.44/,
  );
});

test('AionUI intake validator rejects a selective absorption ref outside active shell history', () => {
  const contract = readContract();
  const selectiveRef = contract.upstream_intake.source_refs.selective_absorption_head.ref;

  assert.throws(
    () => validateContract(contract, {
      isGitAncestor: () => false,
    }),
    new RegExp(`active shell HEAD must contain selective absorption ref ${selectiveRef}`),
  );
});

test('AionUI intake validator rejects a remediation ref outside active shell history', () => {
  const contract = readContract();
  const remediationRef = 'f'.repeat(40);
  const aionCore = dependency(contract, 'aioncore_database_recovery');
  aionCore.evidence = aionCore.evidence.map((entry) =>
    entry.startsWith('shell_commit:') ? `shell_commit:${remediationRef}` : entry,
  );
  aionCore.remediation_ref = remediationRef;

  assert.throws(
    () => validateContract(contract, {
      isGitAncestor: (ref) => ref !== remediationRef,
    }),
    new RegExp(`active shell HEAD must contain remediation ref ${remediationRef}`),
  );
});

test('AionUI intake validator rejects absorbed feedback privacy without remediation evidence', () => {
  const contract = readContract();
  delete capability(contract, 'feedback_diagnostics_privacy').remediation_ref;

  assert.throws(
    () => validateContract(contract),
    /feedback_diagnostics_privacy requires remediation_ref/,
  );
});

test('AionUI intake validator rejects remediation evidence bound to a different commit', () => {
  const contract = readContract();
  capability(contract, 'feedback_diagnostics_privacy').remediation_ref = 'a'.repeat(40);

  assert.throws(
    () => validateContract(contract),
    /feedback_diagnostics_privacy evidence must bind shell_commit to remediation_ref/,
  );
});

test('AionUI intake validator rejects an absorbed AionCore dependency that remains release-blocked', () => {
  const contract = readContract();
  const aionCore = dependency(contract, 'aioncore_database_recovery');
  aionCore.release_gate = 'blocked_until_version_and_capability_gate_verified';

  assert.throws(
    () => validateContract(contract, {
      readJsonFile: () => ({ aioncoreVersion: 'v0.1.44' }),
    }),
    /aioncore_database_recovery\.release_gate must be aioncore_database_recovery_verified/,
  );
});

test('AionUI intake validator rejects an absorbed AionCore dependency that remains unverified', () => {
  const contract = readContract();
  const aionCore = dependency(contract, 'aioncore_database_recovery');
  aionCore.capability_gate.state = 'unverified';
  aionCore.capability_gate.evidence = [];

  assert.throws(
    () => validateContract(contract, {
      readJsonFile: () => ({ aioncoreVersion: 'v0.1.44' }),
    }),
    /absorbed AionCore database recovery dependency requires capability_gate\.state=verified/,
  );
});

test('AionUI intake validator accepts verified AionCore package and ancestor evidence', () => {
  const contract = readContract();

  assert.doesNotThrow(() => validateContract(contract, {
    readJsonFile: () => ({ aioncoreVersion: 'v0.1.44' }),
  }));
});
