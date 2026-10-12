import { pathToFileURL } from 'node:url';

export type ReleaseNoteWriter = {
  mode: 'online-ai' | 'mechanical'; model?: string;
  attempts: { provider: string; status: 'passed' | 'failed' }[];
  reason?: string;
  policy?: { repository: string; source_commit: string | null; policy_sha256: string };
};
export type WriterOptions = {
  copilotToken?: string; apiKey?: string;
  copilot?: (prompt: string, token: string) => Promise<string>; request?: typeof fetch;
};

/** Thin product adapter. Model order, CLI version and transport live in Framework. */
export async function writeWithReleaseNoteFallback<T>(
  prompt: string, accept: (content: string) => T, mechanical: () => T, options: WriterOptions = {},
): Promise<{ value: T; writer: ReleaseNoteWriter }> {
  let shared;
  try {
    const file = process.env.OPL_RELEASE_NOTES_WRITER_MODULE;
    if (!file) throw new Error('shared_writer_unavailable');
    shared = await import(pathToFileURL(file).href);
    if (typeof shared.writeWithReleaseNoteFallback !== 'function') throw new Error('invalid_shared_writer');
  } catch {
    return { value: mechanical(), writer: { mode: 'mechanical', attempts: [], reason: 'shared_writer_unavailable' } };
  }
  try { return await shared.writeWithReleaseNoteFallback(prompt, accept, mechanical, options); }
  catch {
    return { value: mechanical(), writer: { mode: 'mechanical', attempts: [], reason: 'shared_writer_failed' } };
  }
}
