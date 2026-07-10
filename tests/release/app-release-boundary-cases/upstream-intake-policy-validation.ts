import { validateUpstreamIntakePolicy } from '../../../scripts/validate-active-shell/upstream-intake-policy-validator.ts';
import { assert, fs, path, test, appRoot } from './helpers.ts';

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
const failureBoundaries = [
  { stage: 'database.recoverable_corruption', required_corruption_markers_any_of: [] },
  {
    stage: 'database.open',
    required_corruption_markers_any_of: [
      'sqlite_corrupt',
      'sqlite_notadb',
      'database disk image is malformed',
      'file is not a database',
      'malformed database schema',
    ],
  },
];
const recoveryBoundary = {
  code: 'BOOTSTRAP_RECOVERED_DATABASE_CORRUPTION',
  stage: 'database.recovery',
};
const missingRemediationRef = 'f'.repeat(40);

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

  const intake = contract.upstream_intake;
  assert.equal(packagePath, shellPaths.packageManifestPath);
  assert.deepEqual(checkedRefs, [
    intake.source_refs.selective_absorption_head.ref,
    capability(contract, 'feedback_diagnostics_privacy').remediation_ref,
    dependency(contract, 'aioncore_database_recovery').remediation_ref,
  ]);
  assert.deepEqual(
    [intake.source_refs.fork_base.ref, intake.source_refs.evaluated_upstream.ref, intake.source_refs.selective_absorption_head.ref],
    ['70974c59a275e565e8fc2bd7ecaf2dcac74227f0', 'e49cd94935f4e461f002a1260a47c1b7b2ce81ca', 'e38b00ba37cafe56d704b498a4882264836463e4'],
  );
  assert.deepEqual([
    capability(contract, 'database_recovery').classification,
    capability(contract, 'database_recovery').release_gate,
    capability(contract, 'feedback_diagnostics_privacy').classification,
    capability(contract, 'feedback_diagnostics_privacy').release_gate,
    capability(contract, 'non_zh_en_locales').classification,
    capability(contract, 'aionui_team').classification,
  ], ['absorbed', 'database_recovery_dependency_satisfied', 'absorbed', 'feedback_privacy_redaction_verified', 'rejected', 'rejected']);
  const aionCore = dependency(contract, 'aioncore_database_recovery');
  assert.deepEqual([
    aionCore.classification,
    aionCore.release_gate,
    aionCore.remediation_ref,
    aionCore.version_gate.minimum_version,
    aionCore.capability_gate.state,
  ], ['absorbed', 'aioncore_database_recovery_verified', '81c8b37fdc067549341b41539d7648b09aa31d37', 'v0.1.44', 'verified']);
});

test('AionUI intake contract accepts typed corruption or strict open-stage corruption and records recovery success', () => {
  const contract = readContract();
  const gate = dependency(contract, 'aioncore_database_recovery').capability_gate;
  assert.equal(gate.required_boundary_stage, undefined);
  assert.deepEqual(gate.accepted_failure_boundaries, failureBoundaries);
  assert.deepEqual(gate.recovery_success_boundary, recoveryBoundary);
  assert.doesNotThrow(() => validateContract(contract));
});

const invalid = (name, mutate, error, options?) => ({ name, mutate, error, options });
const invalidCases = [
  invalid('a missing required capability record', (c) => {
    c.upstream_intake.capability_classifications = c.upstream_intake.capability_classifications.filter((entry) => entry.id !== 'cron_history');
  }, /Active shell upstream intake capabilities ids/),
  invalid('a missing required record field', (c) => delete capability(c, 'startup_directories').owner_ref, /startup_directories missing required field owner_ref/),
  invalid('an invalid classification state', (c) => { capability(c, 'database_recovery').classification = 'pending'; }, /database_recovery\.classification must be one of absorbed, rejected, deferred/),
  invalid('an unexpected dependency', (c) => { capability(c, 'database_recovery').dependencies = ['unknown_aioncore_dependency']; }, /database_recovery\.dependencies must be \["aioncore_database_recovery"\]/),
  invalid('missing evidence', (c) => { capability(c, 'settings_i18n').evidence = []; }, /settings_i18n\.evidence must be a non-empty string array/),
  invalid('a weakened AionCore boundary code', (c) => {
    dependency(c, 'aioncore_database_recovery').capability_gate.required_boundary_code = 'BOOTSTRAP_DATA_INIT_WARNING';
  }, /AionCore database recovery boundary contract/),
  invalid('database.open recovery without a strict corruption marker', (c) => {
    const gate = dependency(c, 'aioncore_database_recovery').capability_gate;
    gate.accepted_failure_boundaries = structuredClone(failureBoundaries);
    gate.accepted_failure_boundaries[1].required_corruption_markers_any_of = [];
  }, /AionCore database recovery boundary contract/),
  invalid('a recovery success boundary outside database.recovery', (c) => {
    dependency(c, 'aioncore_database_recovery').capability_gate.recovery_success_boundary = { ...recoveryBoundary, stage: 'database.open' };
  }, /AionCore database recovery boundary contract/),
  invalid('a lowered AionCore minimum version', (c) => { dependency(c, 'aioncore_database_recovery').version_gate.minimum_version = 'v0.1.28'; }, /version_gate\.minimum_version must be v0\.1\.44/),
  invalid('an active shell package version mismatch', () => {}, /active shell package aioncoreVersion v0\.1\.28 must match selective_absorption_version v0\.1\.44/, () => ({ readJsonFile: () => ({ aioncoreVersion: 'v0.1.28' }) })),
  invalid('a selective absorption ref outside active shell history', () => {}, (c) => new RegExp('active shell HEAD must contain selective absorption ref ' + c.upstream_intake.source_refs.selective_absorption_head.ref), () => ({ isGitAncestor: () => false })),
  invalid('a remediation ref outside active shell history', (c) => {
    const aionCore = dependency(c, 'aioncore_database_recovery');
    aionCore.evidence = aionCore.evidence.map((entry) => entry.startsWith('shell_commit:') ? 'shell_commit:' + missingRemediationRef : entry);
    aionCore.remediation_ref = missingRemediationRef;
  }, new RegExp('active shell HEAD must contain remediation ref ' + missingRemediationRef), () => ({ isGitAncestor: (ref) => ref !== missingRemediationRef })),
  invalid('absorbed feedback privacy without remediation evidence', (c) => delete capability(c, 'feedback_diagnostics_privacy').remediation_ref, /feedback_diagnostics_privacy requires remediation_ref/),
  invalid('remediation evidence bound to a different commit', (c) => { capability(c, 'feedback_diagnostics_privacy').remediation_ref = 'a'.repeat(40); }, /feedback_diagnostics_privacy evidence must bind shell_commit to remediation_ref/),
  invalid('an absorbed AionCore dependency that remains release-blocked', (c) => { dependency(c, 'aioncore_database_recovery').release_gate = 'blocked_until_version_and_capability_gate_verified'; }, /aioncore_database_recovery\.release_gate must be aioncore_database_recovery_verified/),
  invalid('an absorbed AionCore dependency that remains unverified', (c) => {
    const gate = dependency(c, 'aioncore_database_recovery').capability_gate;
    gate.state = 'unverified';
    gate.evidence = [];
  }, /absorbed AionCore database recovery dependency requires capability_gate\.state=verified/),
];

for (const { name, mutate, options, error } of invalidCases) {
  test('AionUI intake validator rejects ' + name, () => {
    const contract = readContract();
    mutate(contract);
    assert.throws(
      () => validateContract(contract, options?.(contract)),
      typeof error === 'function' ? error(contract) : error,
    );
  });
}

test('AionUI intake validator accepts verified AionCore package and ancestor evidence', () => {
  const contract = readContract();
  assert.doesNotThrow(() => validateContract(contract, {
    readJsonFile: () => ({ aioncoreVersion: 'v0.1.44' }),
  }));
});
