const expectedProvider = 'gflab';
const expectedProviderName = 'OPL Gateway';
const expectedExistingProviderNamePolicy = 'preserve_existing_provider_name_no_migration';
const expectedBaseUrl = 'https://gflabtoken.cn/v1';
const expectedExecutor = 'codex_cli';

export function assertDefaultCodexSessionProfile(profile, options = {}) {
  const label = options.label ?? 'App product profile';
  const defaultSession = profile.default_session_profile ?? {};
  const configuredDefault = profile.codex?.auto_model_policy?.configured_default ?? {};
  if (defaultSession.executor !== expectedExecutor) {
    throw new Error(`Unexpected ${label} executor: ${defaultSession.executor}`);
  }
  if (defaultSession.provider !== expectedProvider) {
    throw new Error(`Unexpected ${label} provider: ${defaultSession.provider}`);
  }
  if (defaultSession.provider_name !== expectedProviderName) {
    throw new Error(`Unexpected ${label} provider name: ${defaultSession.provider_name}`);
  }
  if (defaultSession.existing_provider_name_policy !== expectedExistingProviderNamePolicy) {
    throw new Error(
      `Unexpected ${label} existing provider name policy: ${defaultSession.existing_provider_name_policy}`,
    );
  }
  if (defaultSession.base_url !== expectedBaseUrl) {
    throw new Error(`Unexpected ${label} base URL: ${defaultSession.base_url}`);
  }
  if (typeof configuredDefault.model !== 'string' || !configuredDefault.model.trim()) {
    throw new Error(`${label} must define codex.auto_model_policy.configured_default.model`);
  }
  if (typeof configuredDefault.reasoning_effort !== 'string' || !configuredDefault.reasoning_effort.trim()) {
    throw new Error(`${label} must define codex.auto_model_policy.configured_default.reasoning_effort`);
  }
  if (defaultSession.model !== profile.codex?.default_model) {
    throw new Error(`${label} default_session_profile.model must match codex.default_model`);
  }
  if (defaultSession.reasoning_effort !== profile.codex?.default_reasoning_effort) {
    throw new Error(`${label} default_session_profile.reasoning_effort must match codex.default_reasoning_effort`);
  }
  if (
    profile.codex?.default_model !== configuredDefault.model ||
    profile.codex?.default_reasoning_effort !== configuredDefault.reasoning_effort
  ) {
    throw new Error(`${label} Codex defaults must derive from codex.auto_model_policy.configured_default`);
  }
}
