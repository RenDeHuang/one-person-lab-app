import type { ChangeBucket, ChangeBucketId } from './types.ts';

export const bucketOrder: ChangeBucketId[] = ['first_run', 'agents', 'ui_settings', 'release', 'docs', 'quality'];

export const bucketTitles: Record<ChangeBucketId, string> = {
  first_run: 'First-run setup',
  agents: 'OPL agent updates',
  ui_settings: 'App UI and runtime status',
  release: 'Packaging, updates, and release validation',
  docs: 'Documentation',
  quality: 'Maintenance',
};

export function normalizedSubject(subject: string) {
  return subject
    .replace(/\s+\(#\d+\)\s*$/, '')
    .replace(/^[a-z]+(?:\([^)]+\))?!?:\s*/i, '')
    .trim()
    .toLowerCase();
}

export function addUnique(target: string[], value: string) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function classifySubject(subject: string): { bucket: ChangeBucketId; bullet: string } {
  const normalized = normalizedSubject(subject);
  if (/^docs(?:\([^)]+\))?!?:/i.test(subject) || /(readme|guide|screenshot|tutorial)/i.test(subject)) {
    return {
      bucket: 'docs',
      bullet: 'Kept the install and getting-started guidance aligned with the agent entries and runtime payload shipped in the App.',
    };
  }
  if (/(first[- ]run|beginner|setup surface|bootstrap|initialize|launch ready|ready_to_launch|guid readiness)/i.test(subject)) {
    return {
      bucket: 'first_run',
      bullet: 'Simplified the first-run setup flow so new users see the required setup steps earlier and with less noise.',
    };
  }
  if (/(guid|assistant|skill|codex|model-selector|model selector|home skills|purpose assistant|route|mas|mag|rca|oma|opl meta agent|plugin)/i.test(subject)) {
    if (/model/i.test(subject)) {
      return {
        bucket: 'agents',
        bullet: 'Improved Codex model status and preference handling for MAS, MAG, RCA, and related OPL agent sessions.',
      };
    }
    return {
      bucket: 'agents',
      bullet: 'Updated the App-managed MAS, MAG, RCA, OPL Meta Agent, and Codex skill/plugin surface used by OPL agent sessions.',
    };
  }
  if (/(settings|gui|home|progress|runtime|provider|health|display)/i.test(subject)) {
    return {
      bucket: 'ui_settings',
      bullet: 'Made App runtime and provider readiness easier to read before users open MAS, MAG, RCA, or other OPL agent sessions.',
    };
  }
  if (/(release|build|ci|vm|full|package|installer|update|webui|docker|cache|aioncore|dmg|asset)/i.test(subject)) {
    return {
      bucket: 'release',
      bullet: 'Kept the standard DMG, Full DMG, one-shot installer, and Docker/WebUI install paths separately checked so users get the right package for their environment.',
    };
  }
  return {
    bucket: 'quality',
    bullet: 'Reduced maintenance noise around the App release surface so user-facing install and agent paths stay easier to verify.',
  };
}

export function summarizeChanges(subjects: string[]) {
  const buckets = new Map<ChangeBucketId, ChangeBucket>();
  for (const bucketId of bucketOrder) {
    buckets.set(bucketId, { title: bucketTitles[bucketId], bullets: [] });
  }

  for (const subject of subjects) {
    const { bucket, bullet } = classifySubject(subject);
    addUnique(buckets.get(bucket)?.bullets ?? [], bullet);
  }

  return bucketOrder
    .map((bucketId) => buckets.get(bucketId))
    .filter((bucket): bucket is ChangeBucket => Boolean(bucket && bucket.bullets.length > 0));
}

function ensureAgentBucket(buckets: ChangeBucket[]) {
  let agentBucket = buckets.find((bucket) => bucket.title === bucketTitles.agents);
  if (!agentBucket) {
    agentBucket = { title: bucketTitles.agents, bullets: [] };
    const agentIndex = bucketOrder.indexOf('agents');
    const insertAt = Math.min(agentIndex, buckets.length);
    buckets.splice(insertAt, 0, agentBucket);
  }
  return agentBucket;
}

export function appendAgentChangeSummary(buckets: ChangeBucket[], includeFullPackage: boolean) {
  const agentBucket = ensureAgentBucket(buckets);
  addUnique(
    agentBucket.bullets,
    includeFullPackage
      ? 'Shipped the App with the current MAS research workflow, MAG grant workflow, RCA visual-deliverable workflow, OPL Meta Agent, Framework runtime, and companion tools captured at build time.'
      : 'Kept the standard App package aligned with MAS, MAG, RCA, and OPL Meta Agent entry points plus the Codex plugin and skill sync surface.',
  );
}

export function humanizeCommitSubject(subject: string) {
  return subject
    .replace(/\s+\(#\d+\)\s*$/, '')
    .replace(/^[a-z]+(?:\([^)]+\))?!?:\s*/i, '')
    .replace(/\bMAS\b/g, 'MAS')
    .replace(/\bMAG\b/g, 'MAG')
    .replace(/\bRCA\b/g, 'RCA')
    .replace(/\bOMA\b/g, 'OPL Meta Agent')
    .replace(/\bOPL\b/g, 'OPL')
    .replace(/[-_]+/g, ' ')
    .trim();
}

export function fallbackChangeSummaryHint(label: string, subjects: string[]) {
  const detail = subjects
    .map(humanizeCommitSubject)
    .filter(Boolean)
    .slice(0, 2)
    .join('; ');
  if (!detail) {
    return null;
  }
  return `${label} change detail to cover in user terms: ${detail}.`;
}

export function buildChangeSummaryHint(label: string, subjects: string[]) {
  const text = subjects.join(' ');
  if (!text.trim()) {
    return null;
  }
  if (label === 'MAS') {
    if (/(currentness|closeout|handoff|route[- ]back|blocker|redrive|paper)/i.test(text)) {
      return 'Research workflows carry clearer currentness, blocker, route-back, and closeout handoff context before users rely on study or paper outputs.';
    }
  }
  if (label === 'MAG') {
    if (/(progress[- ]first|owner payload|grant|funding|generated interface|replacement boundary)/i.test(text)) {
      return 'Grant workflows expose progress-first owner payloads and generated-interface boundaries so funding work has clearer next-step context.';
    }
  }
  if (label === 'RCA') {
    if (/(currentness|operator evidence|provider|visual|slide|deliverable|wrapper)/i.test(text)) {
      return 'Visual deliverable workflows record provider currentness and operator evidence before users rely on generated slides or graphics.';
    }
  }
  if (label === 'OPL Meta Agent') {
    if (/(work[- ]order|currentness|progress[- ]first|install path|foundry|agent)/i.test(text)) {
      return 'Agent design and testing workflows carry clearer work-order currentness and progress-first gates.';
    }
  }
  if (label === 'OPL Framework') {
    if (/(runtime|progress[- ]first|provider|state|action|receipt|liveness|supervision)/i.test(text)) {
      return 'The shared runtime better surfaces progress-first supervision, provider liveness, and runtime state/action behavior.';
    }
  }
  return fallbackChangeSummaryHint(label, subjects);
}
