import { runCopilotReleaseNotes } from './copilot-release-notes.ts';

export const gatewayReleaseNoteModels = ['deepseek-flash', 'gpt-6-luna'] as const;
export type ReleaseNoteModel = 'copilot-auto' | typeof gatewayReleaseNoteModels[number];
export type ReleaseNoteWriter = {
  mode: 'online-ai' | 'mechanical'; model?: ReleaseNoteModel;
  attempts: { provider: ReleaseNoteModel; status: 'passed' | 'failed' }[];
  reason?: string;
};
export type WriterOptions = {
  copilotToken?: string; apiKey?: string;
  copilot?: typeof runCopilotReleaseNotes; request?: typeof fetch;
};

/** Provider failure affects prose only; fixed evidence is always available as the final writer. */
export async function writeWithReleaseNoteFallback<T>(
  prompt: string, accept: (content: string) => T, mechanical: () => T, options: WriterOptions = {},
): Promise<{ value: T; writer: ReleaseNoteWriter }> {
  const token = options.copilotToken ?? process.env.GITHUB_TOKEN;
  const apiKey = options.apiKey ?? process.env.OPL_RELEASE_NOTES_CODEX_API_KEY;
  const attempts: ReleaseNoteWriter['attempts'] = [];
  const accepted = (content: unknown, model: ReleaseNoteModel) => {
    if (typeof content !== 'string' || [token, apiKey].some((secret) => secret && content.includes(secret))) {
      throw new Error('invalid_writer_response');
    }
    const value = accept(content);
    attempts.push({ provider: model, status: 'passed' });
    return { value, writer: { mode: 'online-ai', model, attempts } satisfies ReleaseNoteWriter };
  };
  if (token) {
    try { return accepted(await (options.copilot ?? runCopilotReleaseNotes)(prompt, token), 'copilot-auto'); }
    catch { attempts.push({ provider: 'copilot-auto', status: 'failed' }); }
  }
  if (apiKey) for (const model of gatewayReleaseNoteModels) {
    try {
      const response = await (options.request ?? fetch)('https://gateway.medopl.com/v1/chat/completions', {
        method: 'POST', headers: { authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({ model, reasoning_effort: 'low', messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error('gateway_call_failed');
      const payload = await response.json();
      const choice = payload.choices?.[0];
      if (choice?.finish_reason && choice.finish_reason !== 'stop') throw new Error('gateway_incomplete');
      return accepted(choice?.message?.content, model);
    } catch { attempts.push({ provider: model, status: 'failed' }); }
  }
  return { value: mechanical(), writer: { mode: 'mechanical', attempts, reason: 'providers_unavailable_or_invalid' } };
}
