export const HISTORICAL_ADAPTER_ID = 'aionui';
export const ALLOWED_CLASSIFICATIONS = ['absorbed', 'rejected', 'deferred'];
export const REQUIRED_RECORD_FIELDS = [
  'id',
  'upstream_surface',
  'classification',
  'owner_ref',
  'release_gate',
  'dependencies',
  'evidence',
];
const REQUIRED_MANAGED_AGENT_REMEDIATION_REF = '6875ada9fa6e800b64980dadb02180def6b0f6e2';
export const REQUIRED_CAPABILITY_RULES = {
  startup_directories: {
    classification: 'absorbed',
    releaseGate: 'shell_startup_focused_tests_plus_app_quick_gate',
    dependencies: [],
  },
  database_recovery: {
    classification: 'absorbed',
    releaseGate: 'database_recovery_dependency_satisfied',
    dependencies: ['aioncore_database_recovery'],
  },
  managed_agent_api: {
    classification: 'absorbed',
    releaseGate: 'managed_agent_api_contract_and_shell_semantic_gate',
    dependencies: [],
    remediationRequired: true,
    remediationRef: REQUIRED_MANAGED_AGENT_REMEDIATION_REF,
  },
  feedback_diagnostics_privacy: {
    classification: 'absorbed',
    releaseGate: 'feedback_privacy_redaction_verified',
    dependencies: [],
    remediationRequired: true,
  },
  cron_history: {
    classification: 'absorbed',
    releaseGate: 'shell_cron_focused_tests_plus_app_quick_gate',
    dependencies: [],
  },
  guid_slash_allowlist: {
    classification: 'absorbed',
    releaseGate: 'guid_slash_allowlist_focused_tests_plus_app_quick_gate',
    dependencies: [],
  },
  settings_i18n: {
    classification: 'absorbed',
    releaseGate: 'settings_i18n_focused_tests_plus_app_quick_gate',
    dependencies: [],
  },
  non_zh_en_locales: {
    classification: 'rejected',
    releaseGate: 'non_zh_en_locale_payload_must_remain_absent',
    dependencies: [],
  },
  aionui_team: {
    classification: 'rejected',
    releaseGate: 'implementation_probes.aionui_team_disabled_surface',
    dependencies: [],
  },
};
export const REQUIRED_DEPENDENCY_RULES = {
  aioncore_database_recovery: {
    classification: 'absorbed',
    releaseGate: 'aioncore_database_recovery_verified',
    dependencies: [],
    remediationRequired: true,
  },
};
export const REQUIRED_CAPABILITY_IDS = Object.keys(REQUIRED_CAPABILITY_RULES);
export const REQUIRED_DEPENDENCY_IDS = Object.keys(REQUIRED_DEPENDENCY_RULES);
export const REQUIRED_SOURCE_REF_ROLES = {
  fork_base: 'shared_fork_base',
  evaluated_upstream: 'evaluated_upstream_release',
  selective_absorption_head: 'scoped_absorption_and_intake_record_head',
};
