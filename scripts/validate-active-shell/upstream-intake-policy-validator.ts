import { assertDeepEqualJson } from './assertions.ts';

const ALLOWED_CLASSIFICATIONS = ['absorbed', 'rejected', 'deferred'];
const REQUIRED_RECORD_FIELDS = [
  'id',
  'upstream_surface',
  'classification',
  'owner_ref',
  'release_gate',
  'dependencies',
  'evidence',
];

const REQUIRED_SOURCE_REFS = {
  fork_base: {
    ref: '70974c59a275e565e8fc2bd7ecaf2dcac74227f0',
    role: 'shared_fork_base',
  },
  evaluated_upstream: {
    release: 'v2.1.31',
    ref: 'e49cd94935f4e461f002a1260a47c1b7b2ce81ca',
    role: 'evaluated_upstream_release',
  },
  selective_absorption_head: {
    ref: 'e38b00ba37cafe56d704b498a4882264836463e4',
    role: 'scoped_absorption_and_intake_record_head',
  },
};

const REQUIRED_CAPABILITIES = [
  {
    id: 'startup_directories',
    classification: 'absorbed',
    releaseGate: 'shell_startup_focused_tests_plus_app_quick_gate',
    dependencies: [],
  },
  {
    id: 'database_recovery',
    classification: 'absorbed',
    releaseGate: 'blocked_until_aioncore_database_recovery_dependency_absorbed',
    dependencies: ['aioncore_database_recovery'],
  },
  {
    id: 'feedback_diagnostics_privacy',
    classification: 'deferred',
    releaseGate: 'blocked_until_feedback_privacy_redaction_evidence',
    dependencies: [],
  },
  {
    id: 'cron_history',
    classification: 'absorbed',
    releaseGate: 'shell_cron_focused_tests_plus_app_quick_gate',
    dependencies: [],
  },
  {
    id: 'guid_slash_allowlist',
    classification: 'absorbed',
    releaseGate: 'guid_slash_allowlist_focused_tests_plus_app_quick_gate',
    dependencies: [],
  },
  {
    id: 'settings_i18n',
    classification: 'absorbed',
    releaseGate: 'settings_i18n_focused_tests_plus_app_quick_gate',
    dependencies: [],
  },
  {
    id: 'non_zh_en_locales',
    classification: 'rejected',
    releaseGate: 'non_zh_en_locale_payload_must_remain_absent',
    dependencies: [],
  },
  {
    id: 'aionui_team',
    classification: 'rejected',
    releaseGate: 'implementation_probes.aionui_team_disabled_surface',
    dependencies: [],
  },
];

const REQUIRED_DEPENDENCIES = [
  {
    id: 'aioncore_database_recovery',
    classification: 'deferred',
    releaseGate: 'blocked_until_version_and_capability_gate_verified',
    dependencies: [],
  },
];

const AIONCORE_VERSION_GATE = {
  field_ref: 'package.json#aioncoreVersion',
  minimum_version: 'v0.1.44',
  evaluated_upstream_version: 'v0.1.44',
  selective_absorption_version: 'v0.1.28',
  state: 'below_minimum',
};

const AIONCORE_CAPABILITY_GATE = {
  required_boundary_code: 'BOOTSTRAP_DATA_INIT_FAILED',
  required_boundary_stage: 'database.recoverable_corruption',
  state: 'unverified',
  required_evidence: 'packaged_aioncore_boundary_and_recovery_smoke',
};

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertStringArray(value, label, { allowEmpty = false } = {}) {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    !value.every((entry) => typeof entry === 'string' && entry.trim())
  ) {
    throw new Error(`${label} must be ${allowEmpty ? 'a' : 'a non-empty'} string array`);
  }
}

function assertUniqueIds(records, label) {
  const ids = records.map((record) => record?.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} must not contain duplicate ids`);
  }
}

function validateRecordShape(record, label) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`${label} must be an object`);
  }
  for (const field of REQUIRED_RECORD_FIELDS) {
    if (!(field in record)) {
      throw new Error(`${label} missing required field ${field}`);
    }
  }
  for (const field of ['id', 'upstream_surface', 'classification', 'owner_ref', 'release_gate']) {
    assertNonEmptyString(record[field], `${label}.${field}`);
  }
  assertStringArray(record.dependencies, `${label}.dependencies`, { allowEmpty: true });
  assertStringArray(record.evidence, `${label}.evidence`);
  if (!ALLOWED_CLASSIFICATIONS.includes(record.classification)) {
    throw new Error(`${label}.classification must be one of ${ALLOWED_CLASSIFICATIONS.join(', ')}`);
  }
  if (record.classification === 'deferred' && !record.release_gate.startsWith('blocked_')) {
    throw new Error(`${label} deferred classification must use a blocked release gate`);
  }
  if (record.classification === 'rejected' && record.dependencies.length > 0) {
    throw new Error(`${label} rejected classification must not declare dependencies`);
  }
}

function validateRequiredRecords(records, requirements, dependencyRecords, label) {
  if (!Array.isArray(records)) {
    throw new Error(`${label} must be an array`);
  }
  assertUniqueIds(records, label);
  assertDeepEqualJson(
    records.map((record) => record.id),
    requirements.map((requirement) => requirement.id),
    `${label} ids`,
  );
  const dependencyById = new Map(dependencyRecords.map((record) => [record.id, record]));
  for (const requirement of requirements) {
    const record = records.find((entry) => entry.id === requirement.id);
    validateRecordShape(record, `${label}.${requirement.id}`);
    for (const dependencyId of record.dependencies) {
      if (!dependencyById.has(dependencyId)) {
        throw new Error(`${label}.${requirement.id} references unknown dependency ${dependencyId}`);
      }
    }
    if (record.classification !== requirement.classification) {
      throw new Error(
        `${label}.${requirement.id}.classification must be ${requirement.classification}, received ${record.classification}`,
      );
    }
    if (record.release_gate !== requirement.releaseGate) {
      throw new Error(`${label}.${requirement.id}.release_gate must be ${requirement.releaseGate}`);
    }
    assertDeepEqualJson(record.dependencies, requirement.dependencies, `${label}.${requirement.id}.dependencies`);
    const unresolvedDependencies = record.dependencies.filter(
      (dependencyId) => dependencyById.get(dependencyId)?.classification !== 'absorbed',
    );
    if (record.classification === 'absorbed') {
      if (unresolvedDependencies.length > 0 && !record.release_gate.startsWith('blocked_')) {
        throw new Error(`${label}.${requirement.id} must stay release-blocked while a dependency is not absorbed`);
      }
      if (unresolvedDependencies.length === 0 && record.release_gate.startsWith('blocked_')) {
        throw new Error(`${label}.${requirement.id} has a blocked release gate without an unresolved dependency`);
      }
    }
  }
}

function parseVersion(value, label) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) {
    throw new Error(`${label} must use vMAJOR.MINOR.PATCH`);
  }
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function validateAionCoreRecoveryGate(dependency) {
  assertDeepEqualJson(
    dependency.version_gate,
    AIONCORE_VERSION_GATE,
    'Active shell AionCore database recovery version gate',
  );
  const capabilityGate = dependency.capability_gate;
  if (!capabilityGate || typeof capabilityGate !== 'object' || Array.isArray(capabilityGate)) {
    throw new Error('Active shell AionCore database recovery capability gate must be an object');
  }
  for (const [field, expected] of Object.entries(AIONCORE_CAPABILITY_GATE)) {
    if (capabilityGate[field] !== expected) {
      throw new Error(`Active shell AionCore database recovery capability_gate.${field} must be ${expected}`);
    }
  }
  assertStringArray(capabilityGate.evidence, 'Active shell AionCore database recovery capability_gate.evidence', {
    allowEmpty: true,
  });

  const selectedVersion = parseVersion(
    dependency.version_gate.selective_absorption_version,
    'Active shell AionCore selective absorption version',
  );
  const minimumVersion = parseVersion(
    dependency.version_gate.minimum_version,
    'Active shell AionCore minimum recovery version',
  );
  if (compareVersions(selectedVersion, minimumVersion) >= 0) {
    throw new Error('Deferred AionCore database recovery dependency must remain below the admitted minimum version');
  }
  if (dependency.classification === 'absorbed') {
    if (compareVersions(selectedVersion, minimumVersion) < 0 || capabilityGate.state !== 'verified') {
      throw new Error('AionCore database recovery cannot be absorbed before version and capability gates pass');
    }
    assertStringArray(
      capabilityGate.evidence,
      'Active shell verified AionCore database recovery capability_gate.evidence',
    );
  }
}

function validateTeamPolicy(contract, teamIntake) {
  if (
    teamIntake?.classification !== 'rejected' ||
    teamIntake?.ordinary_surface !== 'forbidden' ||
    teamIntake?.owner_ref !== 'contracts/app-gui-product-contract.json#settings_navigation.team_surface_policy' ||
    teamIntake?.release_gate !== 'implementation_probes.aionui_team_disabled_surface'
  ) {
    throw new Error('Active shell upstream intake must classify AionUI Team as rejected for ordinary surfaces');
  }
  const teamPolicy = contract.disabled_feature_policy?.aionui_team;
  for (const [field, expected] of Object.entries({
    state: 'disabled',
    ordinary_surface: 'rejected',
    route_policy: 'redirect_to_app_home',
    mutation_policy: 'team_created_redirect_noop',
    deep_link_policy: 'not_whitelisted',
    capability_snapshot_policy: 'scrub_before_render_or_inherit',
    agent_switching_policy: 'must_not_inherit_team_mcp',
  })) {
    if (teamPolicy?.[field] !== expected) {
      throw new Error(`Active shell disabled_feature_policy.aionui_team.${field} must be ${expected}`);
    }
  }
  const probeGroup = contract.implementation_probes?.aionui_team_disabled_surface;
  if (
    probeGroup?.source !== 'app_shell_upgrade_architecture_hardening' ||
    probeGroup?.policy !== 'fail_closed_required_for_active_shell_upgrade'
  ) {
    throw new Error('Active shell AionUI Team implementation probes must be fail-closed upgrade probes');
  }
  assertDeepEqualJson(
    (probeGroup.probes ?? []).map((probe) => probe.id),
    [
      'team_mode_disabled',
      'team_route_redirect',
      'team_sidebar_gate',
      'team_created_redirect_noop',
      'ordinary_conversation_team_snapshot_scrub',
      'agent_switching_drops_team_mcp',
      'team_deep_link_not_whitelisted',
      'team_bridge_mutation_gate',
    ],
    'Active shell AionUI Team implementation probe ids',
  );
  for (const probe of probeGroup.probes ?? []) {
    if (
      probe.source_ref !== 'contracts/app-gui-product-contract.json#settings_navigation.team_surface_policy' ||
      probe.required !== true ||
      !Array.isArray(probe.required_evidence) ||
      probe.required_evidence.length === 0
    ) {
      throw new Error(`Active shell implementation probe ${probe.id} must bind required evidence to the App GUI Team policy`);
    }
  }
}

export function validateUpstreamIntakePolicy(contract) {
  const upstreamIntake = contract.upstream_intake;
  if (
    upstreamIntake?.classification_policy !==
    'classify_every_required_capability_and_dependency_before_app_release'
  ) {
    throw new Error(
      'Active shell upstream_intake.classification_policy must classify every required capability and dependency before release',
    );
  }
  if (upstreamIntake.schema_version !== 1) {
    throw new Error('Active shell upstream_intake.schema_version must be 1');
  }
  assertDeepEqualJson(upstreamIntake.source_refs, REQUIRED_SOURCE_REFS, 'Active shell upstream intake source refs');
  assertDeepEqualJson(
    upstreamIntake.allowed_classifications,
    ALLOWED_CLASSIFICATIONS,
    'Active shell upstream intake classifications',
  );
  assertDeepEqualJson(
    upstreamIntake.required_record_fields,
    REQUIRED_RECORD_FIELDS,
    'Active shell upstream intake required record fields',
  );
  assertDeepEqualJson(
    upstreamIntake.required_capability_ids,
    REQUIRED_CAPABILITIES.map((requirement) => requirement.id),
    'Active shell upstream intake required capability ids',
  );
  assertDeepEqualJson(
    upstreamIntake.required_dependency_ids,
    REQUIRED_DEPENDENCIES.map((requirement) => requirement.id),
    'Active shell upstream intake required dependency ids',
  );

  const dependencyRecords = upstreamIntake.dependency_classifications;
  validateRequiredRecords(
    dependencyRecords,
    REQUIRED_DEPENDENCIES,
    dependencyRecords ?? [],
    'Active shell upstream intake dependencies',
  );
  validateRequiredRecords(
    upstreamIntake.capability_classifications,
    REQUIRED_CAPABILITIES,
    dependencyRecords,
    'Active shell upstream intake capabilities',
  );

  const aionCoreDependency = dependencyRecords.find((entry) => entry.id === 'aioncore_database_recovery');
  validateAionCoreRecoveryGate(aionCoreDependency);
  const teamIntake = upstreamIntake.capability_classifications.find((entry) => entry.id === 'aionui_team');
  validateTeamPolicy(contract, teamIntake);
}
