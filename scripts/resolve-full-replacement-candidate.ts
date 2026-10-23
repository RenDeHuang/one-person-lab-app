import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export function resolveFullReplacementCandidate(input: {
  run: any; jobs: any[]; cohort: any; manifest: any; notarization: any; trust: any;
  repository: string; runId: string; tag: string; app: string; shell: string; framework: string;
}) {
  const { run, cohort, manifest, notarization } = input;
  assert.match(input.runId, /^[1-9]\d*$/);
  assert.equal(String(run.id), input.runId);
  assert.equal(run.status, 'completed');
  assert.equal(run.run_attempt, 1);
  assert.equal(run.repository.full_name, input.repository);
  assert.equal(run.path, '.github/workflows/build-manual.yml');
  const builds = input.jobs.filter(job => job.name === 'Build the same-tag Full replacement / Build App-owned Full first-install DMG');
  assert.equal(builds.length, 1);
  assert.equal(builds[0].conclusion, 'success');
  assert.match(input.tag, /^v\d+\.\d+\.\d+(?:-r[1-9]\d*)?$/);
  const version = input.tag.replace(/^v/, '');
  const name = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  assert.equal(cohort.schema, 'opl_app_build_artifact_cohort.v2');
  assert.deepEqual(cohort.cohort, { app_sha: input.app, shell_sha: input.shell, framework_sha: input.framework });
  assert.deepEqual(cohort.build, { version, kind: 'full' });
  assert.equal(cohort.actions.run_id, input.runId);
  assert.equal(cohort.actions.run_attempt, '1');
  assert.equal(cohort.actions.artifact_name, `opl-full-first-install-dmg-${version}-mac-arm64`);
  assert.equal(cohort.artifact.name, name);
  assert.match(cohort.artifact.sha256, /^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(cohort.artifact.size_bytes) && cohort.artifact.size_bytes > 0);
  assert.equal(manifest.version, version);
  assert.equal(manifest.resolved_refs.opl_framework.resolved_commit, input.framework);
  assert.equal(notarization.status, 'passed');
  assert.equal(notarization.notarization.status, 'Accepted');
  assert.equal(input.trust.status, 'passed');
  assert.equal(cohort.artifact.sha256, notarization.final_stapled_dmg_sha256);
  assert.equal(cohort.artifact.size_bytes, notarization.final_stapled_dmg_size_bytes);
  const result = {
    full_mas_ref: manifest.resolved_refs.mas.resolved_commit,
    full_mas_scholar_skills_ref: manifest.resolved_refs.mas_scholar_skills.resolved_commit,
  };
  for (const ref of Object.values(result)) assert.match(ref, /^[0-9a-f]{40}$/);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: Object.fromEntries(['run', 'jobs', 'cohort', 'diagnostics', 'github-output'].map(key => [key, { type: 'string' as const }])) });
  const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = resolveFullReplacementCandidate({
    run: read(values.run!), jobs: read(values.jobs!).jobs, cohort: read(values.cohort!),
    manifest: read(path.join(values.diagnostics!, 'full-package-manifest.json')),
    notarization: read(path.join(values.diagnostics!, 'full-apple-notarization-receipt.json')),
    trust: read(path.join(values.diagnostics!, 'full-runtime-native-trust.json')),
    repository: process.env.GITHUB_REPOSITORY!, runId: process.env.CANDIDATE_FULL_RUN!,
    tag: process.env.REPLACEMENT_TAG!, app: process.env.CANDIDATE_APP!,
    shell: process.env.CANDIDATE_SHELL!, framework: process.env.CANDIDATE_FRAMEWORK!,
  });
  fs.appendFileSync(values['github-output']!, Object.entries(result).map(([key, value]) => `${key}=${value}\n`).join(''));
  console.log(JSON.stringify({ status: 'qualified_build_reused', source_run_id: process.env.CANDIDATE_FULL_RUN, ...result }));
}
