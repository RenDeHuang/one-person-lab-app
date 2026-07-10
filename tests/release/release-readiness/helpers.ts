import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

export function writeJson(filePath: string, payload: unknown) {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function releaseReadinessFixture(version: string, fields: Record<string, unknown> = {}) {
  return {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version,
    failed_required_gates: [],
    warnings: [],
    ...fields,
  };
}

export function releaseCandidateFixture(version: string, fields: Record<string, unknown> = {}) {
  return {
    schema: 'opl_release_candidate_record.v1',
    status: 'ready_to_promote',
    version,
    blocked_reasons: [],
    required_gate_failures: [],
    ...fields,
  };
}
