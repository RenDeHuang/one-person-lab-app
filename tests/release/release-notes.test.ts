import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot } from './release-readiness/helpers.ts';
import {
  stableInstallCommand,
  validStandardAiReleaseNotes,
} from './app-release-boundary-cases/release-notes-fixtures.ts';
import {
  completeAiReleaseNotesWithEvidence,
  publicMarkdownBeforeTechnicalDetails,
} from '../../scripts/release-notes-ai-writer-parts/markdown-normalization.ts';
import { validateAiReleaseNotes } from '../../scripts/release-notes-ai-writer-parts/validation.ts';

function runNode(args, options = {}) {
  return spawnSync(process.execPath, ['--experimental-strip-types', ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

const fullPayloadPackages = [
  { packageId: 'mas', componentLabel: 'MAS' },
  { packageId: 'mag', componentLabel: 'MAG' },
  { packageId: 'rca', componentLabel: 'RCA' },
  { packageId: 'oma', componentLabel: 'OPL Meta Agent' },
  { packageId: 'obf', componentLabel: 'OPL Book Forge' },
  { packageId: 'mas-scholar-skills', componentLabel: 'MAS Scholar Skills' },
  { packageId: 'opl-flow', componentLabel: 'OPL Flow' },
] as const;

function jsonFile(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256Ref(filePath: string) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function gitFixture(root: string, name: string, setup: (directory: string) => void) {
  const directory = path.join(root, name);
  fs.mkdirSync(directory, { recursive: true });
  setup(directory);
  for (const args of [
    ['init', '-q'],
    ['config', 'user.email', 'fixture@example.invalid'],
    ['config', 'user.name', 'Fixture'],
    ['add', '.'],
    ['commit', '-qm', 'fixture'],
  ]) {
    const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  return {
    root: directory,
    ref: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).stdout.trim(),
  };
}

function commitFixtureChange(root: string, message: string) {
  for (const args of [
    ['add', '-A'],
    ['commit', '-qm', message],
  ]) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  return spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
}

function fullPayloadAuthorityFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-full-authority-'));
  const codexVersion = '0.144.5';
  const officeRef = 'a'.repeat(40);
  const mineruRef = 'b'.repeat(40);
  const app = gitFixture(root, 'app', (directory) => {
    jsonFile(path.join(directory, 'contracts', 'app-release-qualification-input-manifest.json'), {
      schema: 'opl_app_release_qualification_input_manifest.v1',
      runtime_payloads: {
        codex_cli: {
          package: '@openai/codex',
          version: codexVersion,
          npm_integrity: 'sha512-YWJjZA==',
          tarball_url: `https://registry.npmjs.org/@openai/codex/-/codex-${codexVersion}.tgz`,
          tarball_sha256: 'c'.repeat(64),
          platform: {
            package: '@openai/codex',
            version: `${codexVersion}-darwin-arm64`,
            npm_integrity: 'sha512-ZWZnaA==',
            tarball_url: `https://registry.npmjs.org/@openai/codex/-/codex-${codexVersion}-darwin-arm64.tgz`,
            tarball_sha256: 'd'.repeat(64),
          },
        },
      },
    });
    jsonFile(path.join(directory, 'contracts', 'app-full-third-party-source-manifest.json'), {
      schema: 'opl_app_full_third_party_source_manifest.v1',
      sources: {
        officecli: { repository: 'iOfficeAI/OfficeCLI', ref: officeRef, release_tag: 'v1.2.3' },
        mineru: { repository: 'opendatalab/MinerU-Ecosystem', ref: mineruRef },
      },
      runtime_payloads: {
        codex_cli: {
          version: codexVersion,
          qualification_input_ref: 'contracts/app-release-qualification-input-manifest.json#runtime_payloads.codex_cli',
        },
        officecli: { version: '1.2.3' },
      },
    });
  });
  const shell = gitFixture(root, 'shell', (directory) => {
    fs.writeFileSync(path.join(directory, 'package.json'), '{"name":"fixture-shell"}\n');
  });
  let releaseSetPath = '';
  const ownerRefs: Record<string, string> = {};
  const framework = gitFixture(root, 'framework', (directory) => {
    const catalogRoot = path.join(directory, 'contracts', 'opl-framework');
    const catalogPackages: Record<string, unknown> = {};
    const releaseMembers: Record<string, unknown> = {};
    for (const [index, spec] of fullPayloadPackages.entries()) {
      const version = `0.${index + 1}.0`;
      const ownerRef = (index + 2).toString(16).repeat(40).slice(0, 40);
      ownerRefs[spec.packageId] = ownerRef;
      const manifestRef = `packages/${spec.packageId}.json`;
      const payloadManifestRef = `packages/payloads/${spec.packageId}-${version}.json`;
      const manifestPath = path.join(catalogRoot, manifestRef);
      const payloadPath = path.join(catalogRoot, payloadManifestRef);
      jsonFile(manifestPath, { package_id: spec.packageId, version });
      jsonFile(payloadPath, {
        package_id: spec.packageId,
        package_version: version,
        source_commit: ownerRef,
      });
      const authority = {
        package_version: version,
        owner_source_commit: ownerRef,
        manifest_ref: manifestRef,
        manifest_sha256: sha256Ref(manifestPath),
        payload_manifest_ref: payloadManifestRef,
        payload_manifest_sha256: sha256Ref(payloadPath),
      };
      catalogPackages[spec.packageId] = authority;
      releaseMembers[spec.packageId] = {
        version,
        source_commit: ownerRef,
        manifest_ref: `contracts/opl-framework/${manifestRef}`,
        manifest_sha256: authority.manifest_sha256,
        payload_manifest_ref: `contracts/opl-framework/${payloadManifestRef}`,
        payload_manifest_sha256: authority.payload_manifest_sha256,
      };
    }
    jsonFile(path.join(catalogRoot, 'bundled-full-runtime-package-catalog.json'), {
      surface_kind: 'opl_bundled_full_runtime_package_catalog.v1',
      packages: catalogPackages,
    });
    releaseSetPath = path.join(directory, 'release', 'cohorts', 'fixture', 'release-set.json');
    jsonFile(releaseSetPath, {
      surface_kind: 'opl_release_set.v2',
      generation: 'fixture',
      owner_cohort_lock: { package_ids: fullPayloadPackages.map(({ packageId }) => packageId) },
      components: {
        packages: {
          package_count: fullPayloadPackages.length,
          package_ids: fullPayloadPackages.map(({ packageId }) => packageId),
          members: releaseMembers,
        },
      },
    });
  });
  return {
    root,
    app,
    shell,
    framework,
    releaseSetPath,
    thirdPartyManifestPath: path.join(app.root, 'contracts', 'app-full-third-party-source-manifest.json'),
    codexVersion,
    officeRef,
    mineruRef,
    ownerRefs,
  };
}

function fullPayloadAuthorityArgs(fixture: ReturnType<typeof fullPayloadAuthorityFixture>, output: string) {
  return [
    'scripts/prepare-release-notes-full-payload-authority.ts',
    '--app-root', fixture.app.root,
    '--app-ref', fixture.app.ref,
    '--shell-root', fixture.shell.root,
    '--shell-ref', fixture.shell.ref,
    '--framework-root', fixture.framework.root,
    '--framework-ref', fixture.framework.ref,
    '--release-set-manifest', fixture.releaseSetPath,
    '--third-party-source-manifest', fixture.thirdPartyManifestPath,
    '--output', output,
  ];
}

function standardEvidence(version = '26.9.1', overrides: any = {}) {
  const base = {
    schema: 'opl_app_release_notes_evidence.v1',
    version,
    channel: 'stable',
    release_title: `One Person Lab v${version}`,
    release_repo: 'gaofeng21cn/one-person-lab-app',
    current_tag: `v${version}`,
    previous_tag: 'v26.9.0',
    install_command: stableInstallCommand,
    full_changelog_url: `https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.9.0...v${version}`,
    grouped_changes: [{
      title: 'First launch and setup',
      bullets: ['First launch setup is clearer before users open built-in OPL sessions.'],
    }],
    payload: {
      include_full_package: false,
      lines: ['- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin and skill sync policy.'],
      bundled_refs: [],
      updates_since_previous_stable: [],
    },
    agent_runtime_changes: [],
    family_repo_changes: [{
      label: 'One Person Lab App',
      repository: 'gaofeng21cn/one-person-lab-app',
      previous_ref: 'v26.9.0',
      current_ref: `v${version}`,
      compare_url: `https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.9.0...v${version}`,
      commit_count: 1,
      change_subjects: ['fix(first-run): clarify setup'],
    }],
  };
  return {
    ...base,
    ...overrides,
    payload: { ...base.payload, ...(overrides.payload ?? {}) },
  };
}

function writeSequencedOpenAiCompatibleCurl(binDir: string, requestLogPath: string, responses: string[]) {
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, 'curl'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const payload = JSON.parse(args[args.indexOf('-d') + 1]);
const requestLogPath = ${JSON.stringify(requestLogPath)};
const requests = fs.existsSync(requestLogPath) ? JSON.parse(fs.readFileSync(requestLogPath, 'utf8')) : [];
requests.push(String(payload.messages?.[0]?.content || ''));
fs.writeFileSync(requestLogPath, JSON.stringify(requests));
const responses = ${JSON.stringify(responses)};
const content = responses[Math.min(requests.length - 1, responses.length - 1)];
process.stdout.write(JSON.stringify({ choices: [{ message: { content } }] }));
`, { mode: 0o755 });
}

function writeTransientOpenAiCompatibleCurl(
  binDir: string,
  attemptPath: string,
  failuresBeforeSuccess: number,
  successMarkdown: string,
) {
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, 'curl'), `#!/usr/bin/env node
const fs = require('node:fs');
const attemptPath = ${JSON.stringify(attemptPath)};
const attempt = fs.existsSync(attemptPath) ? Number(fs.readFileSync(attemptPath, 'utf8')) + 1 : 1;
fs.writeFileSync(attemptPath, String(attempt));
if (attempt <= ${failuresBeforeSuccess}) {
  process.stderr.write('curl: (28) Operation timed out with 0 bytes received\\n');
  process.exit(28);
}
process.stdout.write(JSON.stringify({ choices: [{ message: { content: ${JSON.stringify(successMarkdown)} } }] }));
`, { mode: 0o755 });
}

function runWithFakeOpenAiNotes(evidence: any, responses: string[]) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-openai-compatible-notes-repair-'));
  const binDir = path.join(tempRoot, 'bin');
  const requestLogPath = path.join(tempRoot, 'requests.json');
  const evidencePath = path.join(tempRoot, 'evidence.json');
  const outputPath = path.join(tempRoot, 'notes.md');
  writeSequencedOpenAiCompatibleCurl(binDir, requestLogPath, responses);
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  const result = runNode([
    'scripts/release-notes-ai-writer.ts',
    '--evidence', evidencePath,
    '--output', outputPath,
  ], {
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      OPL_RELEASE_NOTES_PROVIDER: 'auto',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL: 'http://127.0.0.1:3001/v1',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY: 'freellmapi-test',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_MODEL: 'auto',
    },
  });
  return {
    result,
    outputPath,
    requests: JSON.parse(fs.readFileSync(requestLogPath, 'utf8')),
  };
}

test('AI release notes writer auto provider prefers the OpenAI-compatible online endpoint', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-openai-compatible-notes-'));
  const binDir = path.join(tempRoot, 'bin');
  const requestPath = path.join(tempRoot, 'request.json');
  const evidencePath = path.join(tempRoot, 'evidence.json');
  const outputPath = path.join(tempRoot, 'notes.md');
  const remoteMarker = '<!-- OPENAI_COMPATIBLE_REMOTE_FIXTURE -->';
  const aiMarkdown = validStandardAiReleaseNotes('26.9.1')
    .replace('## What improved', `${remoteMarker}\n\n## What improved`);

  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, 'curl'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const endpoint = args.find((arg) => /^https?:\\/\\//.test(arg));
const payload = JSON.parse(args[args.indexOf('-d') + 1]);
fs.writeFileSync(${JSON.stringify(requestPath)}, JSON.stringify({
  endpoint,
  model: payload.model,
  contentIncludesEvidence: String(payload.messages?.[0]?.content || '').includes('"release_evidence"'),
  hasBearer: args.includes('Authorization: Bearer freellmapi-test'),
}));
process.stdout.write(JSON.stringify({ choices: [{ message: { content: ${JSON.stringify(aiMarkdown)} } }] }));
`, { mode: 0o755 });
  fs.writeFileSync(evidencePath, `${JSON.stringify({
    schema: 'opl_app_release_notes_evidence.v1',
    version: '26.9.1',
    channel: 'stable',
    release_title: 'One Person Lab v26.9.1',
    release_repo: 'gaofeng21cn/one-person-lab-app',
    current_tag: 'v26.9.1',
    previous_tag: 'v26.9.0',
    install_command: stableInstallCommand,
    full_changelog_url: 'https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.9.0...v26.9.1',
    grouped_changes: [{
      title: 'First launch and setup',
      bullets: ['First launch setup is clearer before users open built-in OPL sessions.'],
    }],
    payload: {
      include_full_package: false,
      lines: ['- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin and skill sync policy.'],
      bundled_refs: [],
      updates_since_previous_stable: [],
    },
    agent_runtime_changes: [],
    family_repo_changes: [{
      label: 'One Person Lab App',
      repository: 'gaofeng21cn/one-person-lab-app',
      previous_ref: 'v26.9.0',
      current_ref: 'v26.9.1',
      compare_url: 'https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.9.0...v26.9.1',
      commit_count: 1,
      change_subjects: ['fix(first-run): clarify setup'],
    }],
  }, null, 2)}\n`);

  const result = runNode([
    'scripts/release-notes-ai-writer.ts',
    '--evidence',
    evidencePath,
    '--output',
    outputPath,
  ], {
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      OPL_RELEASE_NOTES_PROVIDER: 'auto',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL: 'http://127.0.0.1:3001/v1',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY: 'freellmapi-test',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_MODEL: 'auto',
      GITHUB_TOKEN: 'github-models-legacy-token',
      GH_TOKEN: 'github-models-legacy-token',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(requestPath, 'utf8')), {
    endpoint: 'http://127.0.0.1:3001/v1/chat/completions',
    model: 'auto',
    contentIncludesEvidence: true,
    hasBearer: true,
  });
  const output = fs.readFileSync(outputPath, 'utf8');
  assert.match(output, /OPENAI_COMPATIBLE_REMOTE_FIXTURE/);
  assert.match(output, /<!-- OPL_RELEASE_NOTES_GENERATOR:online-ai -->/);
});

test('online AI notes retries bounded transport timeouts in the same job and writes a passed receipt', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-openai-compatible-transport-retry-'));
  const binDir = path.join(tempRoot, 'bin');
  const attemptPath = path.join(tempRoot, 'attempt.txt');
  const evidencePath = path.join(tempRoot, 'evidence.json');
  const outputPath = path.join(tempRoot, 'notes.md');
  const receiptPath = path.join(tempRoot, 'notes-prepare-receipt.json');
  const evidence = standardEvidence('26.9.6');
  writeTransientOpenAiCompatibleCurl(binDir, attemptPath, 2, validStandardAiReleaseNotes('26.9.6'));
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  const result = runNode([
    'scripts/release-notes-ai-writer.ts',
    '--evidence', evidencePath,
    '--output', outputPath,
    '--receipt-output', receiptPath,
  ], {
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      OPL_RELEASE_NOTES_PROVIDER: 'openai_compatible',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL: 'http://127.0.0.1:3001/v1',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY: 'freellmapi-test',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_MODEL: 'auto',
      OPL_RELEASE_NOTES_AI_RETRY_DELAY_MS: '0',
      GITHUB_RUN_ID: '789',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(attemptPath, 'utf8'), '3');
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.identity.workflow_run_id, '789');
  assert.equal(receipt.provider.max_transport_attempts_per_request, 3);
  assert.match(receipt.notes_sha256, /^[0-9a-f]{64}$/);
  assert.equal(receipt.failure, null);
});

test('online AI notes exhausts bounded timeout retries and writes a typed failure receipt', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-openai-compatible-transport-failure-'));
  const binDir = path.join(tempRoot, 'bin');
  const attemptPath = path.join(tempRoot, 'attempt.txt');
  const evidencePath = path.join(tempRoot, 'evidence.json');
  const outputPath = path.join(tempRoot, 'notes.md');
  const receiptPath = path.join(tempRoot, 'notes-prepare-receipt.json');
  const evidence = standardEvidence('26.9.7');
  writeTransientOpenAiCompatibleCurl(binDir, attemptPath, 3, validStandardAiReleaseNotes('26.9.7'));
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  const result = runNode([
    'scripts/release-notes-ai-writer.ts',
    '--evidence', evidencePath,
    '--output', outputPath,
    '--receipt-output', receiptPath,
  ], {
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      OPL_RELEASE_NOTES_PROVIDER: 'openai_compatible',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL: 'http://127.0.0.1:3001/v1',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY: 'freellmapi-test',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_MODEL: 'auto',
      OPL_RELEASE_NOTES_AI_RETRY_DELAY_MS: '0',
      GITHUB_RUN_ID: '790',
    },
  });

  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(attemptPath, 'utf8'), '3');
  assert.match(result.stderr, /provider_transport_timeout.*transport attempt 3\/3/s);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.identity.workflow_run_id, '790');
  assert.deepEqual(receipt.failure, {
    taxonomy: 'transport',
    type: 'provider_transport_timeout',
    transport_attempts: 3,
    transport_retry_exhausted: true,
    message: receipt.failure.message,
  });
  assert.match(receipt.failure.message, /transport attempt 3\/3/);
  assert.equal(receipt.notes_sha256, null);
  assert.equal(fs.existsSync(outputPath), false);
});

test('stable manifest notes expose install, component refs, and version changes', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-manifest-'));
  const currentPath = path.join(tempRoot, 'current.json');
  const previousPath = path.join(tempRoot, 'previous.json');
  fs.writeFileSync(currentPath, JSON.stringify({ components: {
    mas: { git_commit: 'a'.repeat(40) },
    officecli: { version: '1.2.3' },
  } }));
  fs.writeFileSync(previousPath, JSON.stringify({ components: {
    mas: { git_commit: 'b'.repeat(40) },
    officecli: { version: '1.2.2' },
  } }));

  const result = runNode([
    'scripts/generate-release-notes.ts',
    '--version', '26.9.2',
    '--channel', 'stable',
    '--previous-tag', 'v26.9.1',
    '--current-tag', 'v26.9.2',
    '--shell-root', appRoot,
    '--previous-app-ref', 'HEAD',
    '--current-app-ref', 'HEAD',
    '--previous-shell-ref', 'HEAD',
    '--current-shell-ref', 'HEAD',
    '--full-package-manifest', currentPath,
    '--previous-full-package-manifest', previousPath,
  ], { env: { OPL_RELEASE_NOTES_SKIP_REMOTE_FAMILY_REPOS: '1' } });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(stableInstallCommand));
  assert.match(result.stdout, /Packaged component refs: MAS @ aaaaaaa; OfficeCLI 1\.2\.3/);
  assert.match(result.stdout, /Component updates since previous Stable: MAS bbbbbbb -> aaaaaaa; OfficeCLI 1\.2\.2 -> 1\.2\.3/);
});

test('Full notes derive every prebuild payload ref from exact App, Shell, and Framework authorities', () => {
  const fixture = fullPayloadAuthorityFixture();
  const authorityPath = path.join(fixture.root, 'full-payload-authority.json');
  const evidencePath = path.join(fixture.root, 'notes-evidence.json');
  const authorityResult = runNode(fullPayloadAuthorityArgs(fixture, authorityPath));
  assert.equal(authorityResult.status, 0, authorityResult.stderr);

  const authority = JSON.parse(fs.readFileSync(authorityPath, 'utf8'));
  assert.deepEqual(authority.intent, {
    include_full_package: true,
    phase: 'prebuild',
    build_artifact_bytes_known: false,
    usage: 'prepared_release_notes_evidence',
  });
  assert.deepEqual(authority.components.codex, { version: `codex-cli ${fixture.codexVersion}` });
  assert.equal(authority.runtime_authority.codex_cli.shell_source_commit, fixture.shell.ref);
  assert.equal(authority.runtime_authority.codex_cli.tarball_sha256, 'c'.repeat(64));
  assert.deepEqual(Object.keys(authority.packages), fullPayloadPackages.map(({ packageId }) => packageId));
  assert.doesNotMatch(JSON.stringify(authority), /size_bytes|dmg_sha256|artifact_sha256/);

  const notesResult = runNode([
    'scripts/generate-release-notes.ts',
    '--version', '26.9.8',
    '--channel', 'stable',
    '--previous-tag', 'v26.9.7',
    '--current-tag', 'v26.9.8',
    '--shell-root', fixture.shell.root,
    '--previous-app-ref', 'HEAD',
    '--current-app-ref', 'HEAD',
    '--previous-shell-ref', fixture.shell.ref,
    '--current-shell-ref', fixture.shell.ref,
    '--include-full-package',
    '--full-package-manifest', authorityPath,
    '--previous-full-package-manifest', authorityPath,
    '--evidence-output', evidencePath,
  ], { env: { OPL_RELEASE_NOTES_SKIP_REMOTE_FAMILY_REPOS: '1' } });
  assert.equal(notesResult.status, 0, notesResult.stderr);

  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const expectedRefs = [
    `OPL Framework @ ${fixture.framework.ref.slice(0, 7)}`,
    `Codex CLI ${fixture.codexVersion}`,
    ...fullPayloadPackages.map(
      ({ packageId, componentLabel }) => `${componentLabel} @ ${fixture.ownerRefs[packageId].slice(0, 7)}`,
    ),
    `OfficeCLI @ ${fixture.officeRef.slice(0, 7)}`,
    `MinerU @ ${fixture.mineruRef.slice(0, 7)}`,
  ];
  assert.equal(evidence.payload.include_full_package, true);
  assert.deepEqual(evidence.payload.bundled_refs, expectedRefs);
  assert.match(evidence.payload.lines[0], /Full first-install package includes the OPL Framework runtime/);
  assert.equal(evidence.payload.lines[1], `- Packaged component refs: ${expectedRefs.join('; ')}.`);
});

test('prebuild Full notes authority rejects missing Release Set input before writing evidence', () => {
  const fixture = fullPayloadAuthorityFixture();
  const authorityPath = path.join(fixture.root, 'missing-release-set-authority.json');
  const args = fullPayloadAuthorityArgs(fixture, authorityPath);
  const optionIndex = args.indexOf('--release-set-manifest');
  args.splice(optionIndex, 2);
  const result = runNode(args);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing --release-set-manifest/);
  assert.equal(fs.existsSync(authorityPath), false);
});

test('prebuild Full notes authority rejects a missing frozen Codex input before writing evidence', () => {
  const fixture = fullPayloadAuthorityFixture();
  const thirdParty = JSON.parse(fs.readFileSync(fixture.thirdPartyManifestPath, 'utf8'));
  thirdParty.runtime_payloads.codex_cli.qualification_input_ref =
    'contracts/missing-qualification-input.json#runtime_payloads.codex_cli';
  jsonFile(fixture.thirdPartyManifestPath, thirdParty);
  fixture.app.ref = commitFixtureChange(fixture.app.root, 'remove Codex qualification authority');
  const authorityPath = path.join(fixture.root, 'missing-codex-authority.json');
  const result = runNode(fullPayloadAuthorityArgs(fixture, authorityPath));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /App Codex qualification input manifest must be a regular non-symlink file/);
  assert.equal(fs.existsSync(authorityPath), false);
});

test('prebuild Full notes authority rejects a Release Set owner ref that drifted from the catalog', () => {
  const fixture = fullPayloadAuthorityFixture();
  const releaseSet = JSON.parse(fs.readFileSync(fixture.releaseSetPath, 'utf8'));
  releaseSet.components.packages.members.mas.source_commit = 'f'.repeat(40);
  jsonFile(fixture.releaseSetPath, releaseSet);
  fixture.framework.ref = commitFixtureChange(fixture.framework.root, 'drift release set');
  const authorityPath = path.join(fixture.root, 'drifted-release-set-authority.json');
  const result = runNode(fullPayloadAuthorityArgs(fixture, authorityPath));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Release Set mas\.source_commit does not match the bundled catalog/);
  assert.equal(fs.existsSync(authorityPath), false);
});

test('final notes normalization sanitizes evidence sections added after model cleanup', () => {
  const evidence = standardEvidence('26.9.3', {
    grouped_changes: [{
      title: 'Release readiness',
      bullets: ['The workflow gate keeps first-launch setup ready for research sessions.'],
    }],
  });
  const rawMarkdown = `${evidence.release_title}\n\nUsers can install or upgrade One Person Lab App to open MAS research, MAG grant-writing, RCA visual deliverable, and OPL Meta Agent sessions.\n`;
  const output = completeAiReleaseNotesWithEvidence(rawMarkdown, evidence);
  const publicMarkdown = publicMarkdownBeforeTechnicalDetails(output);

  assert.doesNotMatch(publicMarkdown, /\b(?:gate|workflow)\b/i);
  assert.match(publicMarkdown, /checks|sessions/i);
  assert.doesNotThrow(() => validateAiReleaseNotes(output, evidence));
});

test('online AI notes performs one bounded repair without echoing the validator diagnostic', () => {
  const evidence = standardEvidence('26.9.4', {
    agent_runtime_changes: [
      { label: 'MAS', user_value_hint: 'Supports research sessions.', change_summary_hint: 'Runtime state is clearer.' },
      { label: 'MAG', user_value_hint: 'Supports grant writing.', change_summary_hint: 'Runtime state is clearer.' },
      { label: 'RCA', user_value_hint: 'Supports visual deliverables.', change_summary_hint: 'Runtime state is clearer.' },
    ],
  });
  const firstDraft = validStandardAiReleaseNotes('26.9.4');
  const repairedDraft = firstDraft.replace(
    '## What improved',
    'MAS research sessions, MAG grant writing, and RCA visual deliverable work now shows clearer runtime state.\n\n## What improved',
  );
  const { result, requests, outputPath } = runWithFakeOpenAiNotes(evidence, [firstDraft, repairedDraft]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(requests.length, 2);
  assert.match(requests[1], /Do not quote or paraphrase any diagnostic message/);
  assert.doesNotMatch(requests[1], /Quality gate failure to fix|missing concrete runtime change detail/);
  assert.ok(fs.existsSync(outputPath));
  assert.match(fs.readFileSync(outputPath, 'utf8'), /<!-- OPL_RELEASE_NOTES_GENERATOR:online-ai -->/);
});

test('online AI notes fails closed after the single repair remains invalid', () => {
  const evidence = standardEvidence('26.9.5', {
    agent_runtime_changes: [
      { label: 'MAS', user_value_hint: 'Supports research sessions.', change_summary_hint: 'Runtime state is clearer.' },
      { label: 'MAG', user_value_hint: 'Supports grant writing.', change_summary_hint: 'Runtime state is clearer.' },
      { label: 'RCA', user_value_hint: 'Supports visual deliverables.', change_summary_hint: 'Runtime state is clearer.' },
    ],
  });
  const invalidDraft = validStandardAiReleaseNotes('26.9.5');
  const { result, requests, outputPath } = runWithFakeOpenAiNotes(evidence, [invalidDraft, invalidDraft]);

  assert.notEqual(result.status, 0);
  assert.equal(requests.length, 2);
  assert.match(result.stderr, /AI release notes failed quality gate/);
  assert.equal(fs.existsSync(outputPath), false);
});
