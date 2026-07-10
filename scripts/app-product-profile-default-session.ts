const expectedProvider = 'gflab';
const expectedBaseUrl = 'https://gflabtoken.cn/v1';
const expectedExecutor = 'codex_cli';
const expectedModel = 'gpt-5.6-sol';
const expectedReasoningEffort = 'max';

export function assertDefaultCodexSessionProfile(profile, options = {}) {
  const label = options.label ?? 'App product profile';
  const defaultSession = profile.default_session_profile ?? {};
  if (defaultSession.executor !== expectedExecutor) {
    throw new Error(`Unexpected ${label} executor: ${defaultSession.executor}`);
  }
  if (defaultSession.provider !== expectedProvider) {
    throw new Error(`Unexpected ${label} provider: ${defaultSession.provider}`);
  }
  if (defaultSession.base_url !== expectedBaseUrl) {
    throw new Error(`Unexpected ${label} base URL: ${defaultSession.base_url}`);
  }
  if (options.requireLiteralDefaults && defaultSession.model !== expectedModel) {
    throw new Error(`Unexpected ${label} model: ${defaultSession.model}`);
  }
  if (options.requireLiteralDefaults && defaultSession.reasoning_effort !== expectedReasoningEffort) {
    throw new Error(`Unexpected ${label} reasoning effort: ${defaultSession.reasoning_effort}`);
  }
  if (defaultSession.model !== profile.codex?.default_model) {
    throw new Error(`${label} default_session_profile.model must match codex.default_model`);
  }
  if (defaultSession.reasoning_effort !== profile.codex?.default_reasoning_effort) {
    throw new Error(`${label} default_session_profile.reasoning_effort must match codex.default_reasoning_effort`);
  }
}
