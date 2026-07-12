import fs from 'node:fs';
import path from 'node:path';
import { parseArgs as parseNodeArgs } from 'node:util';
import type { ReleaseNotesEvidence } from '../release-notes.ts';
import { completeAiReleaseNotesWithEvidence } from './markdown-normalization.ts';
import {
  buildAiReleaseNotesDocument,
  runOpenAICompatibleProbe,
  type AiReleaseNotesOptions,
} from './provider-transport.ts';
import { validateAiReleaseNotes } from './validation.ts';

type ReleaseNotesMode = 'ai' | 'template';

function releaseNotesMode(): ReleaseNotesMode {
  const value = (process.env.OPL_RELEASE_NOTES_MODE || 'ai').trim().toLowerCase();
  if (value !== 'ai' && value !== 'template') {
    throw new Error(`Unsupported OPL_RELEASE_NOTES_MODE: ${process.env.OPL_RELEASE_NOTES_MODE}`);
  }
  return value;
}
type AiReleaseNotesCliOptions = AiReleaseNotesOptions & {
  evidencePath: string;
  inputPath: string;
  outputPath: string;
  probeOpenAICompatible: boolean;
};

const probeOpenAICompatibleFlag = '--probe-openai-compatible';
const probeOpenAICompatibleOption = probeOpenAICompatibleFlag.slice(2);

function parseCliArgs(argv: string[]): AiReleaseNotesCliOptions {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      evidence: { type: 'string' },
      input: { type: 'string' },
      output: { type: 'string' },
      'provider-command': { type: 'string' },
      model: { type: 'string' },
      [probeOpenAICompatibleOption]: { type: 'boolean' },
    } as const,
    allowPositionals: false,
    strict: true,
  });
  const parsed: AiReleaseNotesCliOptions = {
    evidencePath: values.evidence ? path.resolve(values.evidence) : process.env.OPL_RELEASE_NOTES_EVIDENCE_INPUT?.trim() || '',
    inputPath: values.input ? path.resolve(values.input) : '',
    outputPath: values.output ? path.resolve(values.output) : '',
    providerCommand: values['provider-command'],
    model: values.model,
    probeOpenAICompatible: values[probeOpenAICompatibleOption] === true,
  };
  if (!parsed.probeOpenAICompatible && !parsed.evidencePath) {
    throw new Error(`Missing required --evidence unless ${probeOpenAICompatibleFlag} is set.`);
  }
  return parsed;
}

function readReleaseNotesEvidence(evidencePath: string): ReleaseNotesEvidence {
  const payload = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  return (payload?.release_evidence ?? payload) as ReleaseNotesEvidence;
}

export function runAiReleaseNotesCli() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.probeOpenAICompatible) {
    runOpenAICompatibleProbe();
    return;
  }
  const evidence = readReleaseNotesEvidence(options.evidencePath);
  const mode = releaseNotesMode();
  if (mode === 'template' && !options.inputPath) {
    throw new Error('OPL_RELEASE_NOTES_MODE=template requires --input with a deterministic template file.');
  }
  const notes =
    mode === 'template'
      ? completeAiReleaseNotesWithEvidence(fs.readFileSync(options.inputPath, 'utf8'), evidence)
      : options.inputPath
        ? fs.readFileSync(options.inputPath, 'utf8')
        : buildAiReleaseNotesDocument(evidence, options);
  validateAiReleaseNotes(notes, evidence);
  if (options.outputPath) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, notes);
  } else {
    process.stdout.write(notes);
  }
}
