import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prepareReplacementRequest } from '../../scripts/prepare-same-tag-replacement-request.ts';

test('runner transport binds exact candidate bytes to the downloaded passed VM receipt', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-replacement-request-'));
  const hash = (value: string) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
  const name = 'One-Person-Lab-26.10.23-mac-arm64.dmg';
  const receipt = JSON.stringify({ schema: 'opl_studio_stable_clean_vm.v1', status: 'passed', artifact: {
    path: `/qualified/${name}`, sha256: hash('qualified bytes').slice(7), expected_version: '26.10.2392' } });
  const request = { schema: 'opl_app_same_tag_replacement_request.v1', updater_version: '26.10.2392',
    plan: { repository: 'gaofeng21cn/one-person-lab-app', tag: 'v26.10.23', replacements: [{ current: { name } }] },
    qualification: { run_id: '123', artifact_name: 'vm', receipt_sha256: hash(receipt) },
    files: [{ name, digest: hash('qualified bytes'), source: { run_id: '123', artifact_name: 'build' } }] };
  const download = (_run: string, artifact: string, destination: string) => fs.writeFileSync(
    path.join(destination, artifact === 'vm' ? 'tart-smoke-summary.json' : name), artifact === 'vm' ? receipt : 'qualified bytes');
  try {
    const file = prepareReplacementRequest(request, path.join(root, 'pass'), download);
    assert.equal(fs.readFileSync(JSON.parse(fs.readFileSync(file, 'utf8')).replacements[0].file, 'utf8'), 'qualified bytes');
    const changed = structuredClone(request); changed.files[0].digest = hash('other bytes');
    assert.throws(() => prepareReplacementRequest(changed, path.join(root, 'changed'), download), /Candidate bytes changed/);
    const unqualified = structuredClone(request); unqualified.updater_version = '26.10.2393';
    assert.throws(() => prepareReplacementRequest(unqualified, path.join(root, 'unqualified'), download));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
