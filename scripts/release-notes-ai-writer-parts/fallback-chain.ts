import type { ReleaseNotesEvidence } from '../release-notes.ts';
import { writeWithReleaseNoteFallback, type WriterOptions } from '../release-note-writer-chain.ts';
import { buildAiReleaseNotesPrompt } from './evidence-shaping.ts';
import { completeAiReleaseNotesWithEvidence, extractMarkdown, extractLocalizedReleaseNotes } from './markdown-normalization.ts';
import { markAiGeneratedReleaseNotes } from './provider-transport.ts';
import { validateAiReleaseNotes } from './validation.ts';
import { buildMechanicalReleaseNotes, mechanicalNotesMarker, validateMechanicalReleaseNotes } from './mechanical.ts';

export function validatePreparedReleaseNotes(notes: string, evidence: ReleaseNotesEvidence) {
  if (notes.includes(mechanicalNotesMarker)) validateMechanicalReleaseNotes(notes, evidence);
  else validateAiReleaseNotes(notes, evidence);
}
export async function buildFallbackReleaseNotes(evidence: ReleaseNotesEvidence, options: WriterOptions = {}) {
  const result = await writeWithReleaseNoteFallback(buildAiReleaseNotesPrompt(evidence), (content) => {
    if (content.includes(mechanicalNotesMarker)) throw new Error('Model output uses reserved provenance.');
    const markdown = extractMarkdown(content);
    if (!extractLocalizedReleaseNotes(markdown, 'en-US') || !extractLocalizedReleaseNotes(markdown, 'zh-CN')) {
      throw new Error('Writer response lacks required locale blocks.');
    }
    const notes = completeAiReleaseNotesWithEvidence(markdown, evidence);
    validateAiReleaseNotes(notes, evidence);
    return markAiGeneratedReleaseNotes(notes);
  }, () => buildMechanicalReleaseNotes(evidence), options);
  validatePreparedReleaseNotes(result.value, evidence);
  return { notes: result.value, writer: result.writer };
}
