import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const digest = (bytes: Buffer) => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const namePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
type Download = (run: string, artifact: string, destination: string) => void;

export function prepareReplacementRequest(request: any, root: string, download: Download) {
  assert.equal(request.schema, 'opl_app_same_tag_replacement_request.v1');
  assert.equal(request.plan.repository, 'gaofeng21cn/one-person-lab-app');
  assert.match(request.plan.tag, /^v\d{2}\.\d{1,2}\.\d{1,2}(?:-r[1-9]\d*)?$/);
  fs.mkdirSync(root, { recursive: true });
  const downloaded = new Map<string, string>();
  const source = (spec: any) => {
    assert.match(spec.run_id, /^[1-9]\d*$/);
    assert.match(spec.artifact_name, namePattern);
    const key = `${spec.run_id}/${spec.artifact_name}`;
    if (!downloaded.has(key)) {
      const directory = path.join(root, `download-${downloaded.size}`);
      fs.mkdirSync(directory);
      download(spec.run_id, spec.artifact_name, directory);
      downloaded.set(key, directory);
    }
    return downloaded.get(key)!;
  };
  const evidenceRoot = source(request.qualification);
  const evidenceBytes = fs.readFileSync(path.join(evidenceRoot, 'tart-smoke-summary.json'));
  assert.equal(digest(evidenceBytes), request.qualification.receipt_sha256);
  const evidence = JSON.parse(evidenceBytes.toString('utf8'));
  assert.equal(evidence.schema, 'opl_studio_stable_clean_vm.v1');
  assert.equal(evidence.status, 'passed');
  assert.equal(evidence.artifact.expected_version, request.updater_version);
  const expectedDmg = path.basename(evidence.artifact.path);
  const files = new Map<string, string>();
  for (const file of request.files) {
    assert.match(file.name, namePattern);
    assert.ok(!files.has(file.name));
    const bytes = file.gzip_base64 !== undefined ? gunzipSync(Buffer.from(file.gzip_base64, 'base64'))
      : file.base64 !== undefined ? Buffer.from(file.base64, 'base64')
      : fs.readFileSync(path.join(source(file.source), file.name));
    assert.equal(digest(bytes), file.digest, `Candidate bytes changed: ${file.name}`);
    const destination = path.join(root, file.name);
    fs.writeFileSync(destination, bytes);
    files.set(file.name, destination);
  }
  assert.equal(digest(fs.readFileSync(files.get(expectedDmg)!)), `sha256:${evidence.artifact.sha256}`);
  const plan = structuredClone(request.plan);
  for (const replacement of plan.replacements) {
    assert.ok(files.has(replacement.current.name));
    replacement.file = files.get(replacement.current.name);
  }
  assert.equal(plan.replacements.length, files.size);
  if (request.body) {
    const bytes = Buffer.from(request.body.base64, 'base64');
    assert.equal(digest(bytes), request.body.digest);
    plan.body_file = path.join(root, 'release-body.md');
    fs.writeFileSync(plan.body_file, bytes);
  } else {
    delete plan.body_file;
    delete plan.expected_body_sha256;
  }
  const planFile = path.join(root, 'replacement-plan.json');
  fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
  return planFile;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const planFile = prepareReplacementRequest(request, path.resolve(process.argv[3]), (run, artifact, directory) => {
    const result = spawnSync('gh', ['run', 'download', run, '--repo', request.plan.repository, '--name', artifact, '--dir', directory],
      { encoding: 'utf8', timeout: 900_000 });
    if (result.error || result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Artifact download failed');
  });
  console.log(planFile);
}
