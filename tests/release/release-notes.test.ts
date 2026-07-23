import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
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
const canonicalFrameworkRemote = 'https://github.com/gaofeng21cn/one-person-lab.git';

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

function runFixtureGit(root: string, args: string[]) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function configureCanonicalFrameworkRemote(fixtureRoot: string, framework: { root: string; ref: string }) {
  runFixtureGit(framework.root, ['branch', '-M', 'main']);
  const remoteRoot = path.join(fixtureRoot, 'framework-origin.git');
  const clone = spawnSync('git', ['clone', '-q', '--bare', framework.root, remoteRoot], { encoding: 'utf8' });
  assert.equal(clone.status, 0, clone.stderr);
  runFixtureGit(framework.root, ['remote', 'add', 'origin', canonicalFrameworkRemote]);
  runFixtureGit(framework.root, [
    'config',
    `url.${pathToFileURL(remoteRoot).href}.insteadOf`,
    canonicalFrameworkRemote,
  ]);
}

function advanceCanonicalFrameworkRemote(framework: { root: string; ref: string }) {
  const tree = runFixtureGit(framework.root, ['rev-parse', 'HEAD^{tree}']);
  const remoteCommit = runFixtureGit(framework.root, [
    'commit-tree', tree, '-p', framework.ref, '-m', 'remote advance',
  ]);
  runFixtureGit(framework.root, ['push', 'origin', `${remoteCommit}:refs/heads/main`]);
}

function fullPayloadAuthorityFixture(options: { nestedFramework?: boolean } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-full-authority-'));
  const codexVersion = '0.144.6';
  const staleAppCodexProjection = '0.144.5';
  const codexAcpVersion = '1.1.2';
  const officeRef = 'a'.repeat(40);
  const mineruRef = 'b'.repeat(40);
  const app = gitFixture(root, 'app', (directory) => {
    jsonFile(path.join(directory, 'contracts', 'app-full-third-party-source-manifest.json'), {
      schema: 'opl_app_full_third_party_source_manifest.v1',
      sources: {
        officecli: { repository: 'iOfficeAI/OfficeCLI', ref: officeRef, release_tag: 'v1.2.3' },
        mineru: { repository: 'opendatalab/MinerU-Ecosystem', ref: mineruRef },
      },
      runtime_payloads: {
        codex_cli: {
          version: staleAppCodexProjection,
          qualification_input_ref: 'contracts/missing-qualification-input.json#runtime_payloads.codex_cli',
        },
        officecli: { version: '1.2.3' },
      },
    });
    const qualificationHarnessPath = path.join(directory, 'scripts', 'validate-webui-runtime-image.ts');
    fs.mkdirSync(path.dirname(qualificationHarnessPath), { recursive: true });
    fs.writeFileSync(qualificationHarnessPath, 'export const fixtureHarness = true;\n');
  });
  const shell = gitFixture(root, 'shell', (directory) => {
    jsonFile(path.join(directory, 'package.json'), { aioncoreVersion: 'v0.1.49' });
    fs.writeFileSync(path.join(directory, 'Dockerfile'), 'FROM node:22-bookworm-slim\n');
    jsonFile(path.join(directory, 'contracts', 'aionui-upstream-intake.json'), {
      managed_runtime: { codex_cli: { package: '@openai/codex', version: codexVersion } },
    });
    const runtimeKey = 'darwin-arm64';
    const runtimeRoot = path.join(directory, 'resources', 'bundled-aioncore', runtimeKey);
    const managedRoot = path.join(runtimeRoot, 'managed-resources');
    const toolRootRelative = `acp/codex-acp/${codexAcpVersion}/${runtimeKey}`;
    const toolRoot = path.join(managedRoot, toolRootRelative);
    const platformPackage = `@openai/codex-${runtimeKey}`;
    const platformVersion = `${codexVersion}-${runtimeKey}`;
    const platformExecutable = `node_modules/${platformPackage}/vendor/aarch64-apple-darwin/bin/codex`;
    jsonFile(path.join(runtimeRoot, 'manifest.json'), {
      platform: 'darwin',
      arch: 'arm64',
      version: 'v0.1.49',
      sourceType: 'download',
      source: {
        url: 'https://github.com/iOfficeAI/AionCore/releases/download/v0.1.49/aioncore-v0.1.49-aarch64-apple-darwin.tar.gz',
      },
    });
    fs.mkdirSync(runtimeRoot, { recursive: true });
    fs.writeFileSync(path.join(runtimeRoot, 'aioncore'), 'aioncore fixture\n');
    jsonFile(path.join(managedRoot, 'manifest.json'), {
      schemaVersion: 1,
      runtimeKey,
      acpTools: [{
        slug: 'codex-acp',
        version: codexAcpVersion,
        packageName: '@agentclientprotocol/codex-acp',
        root: toolRootRelative,
        platformDirectory: runtimeKey,
        manifest: 'manifest.json',
        entrypoint: 'node_modules/@agentclientprotocol/codex-acp/dist/index.js',
        requiredFiles: ['package.json', 'package-lock.json'],
        requiredDirectories: ['node_modules'],
        platformExecutable,
      }],
    });
    jsonFile(path.join(toolRoot, 'manifest.json'), { entrypoint: 'node_modules/@agentclientprotocol/codex-acp/dist/index.js' });
    jsonFile(path.join(toolRoot, 'package.json'), {
      name: 'aioncore-managed-codex-acp',
      dependencies: { '@agentclientprotocol/codex-acp': codexAcpVersion },
    });
    jsonFile(path.join(toolRoot, 'package-lock.json'), {
      name: 'aioncore-managed-codex-acp',
      lockfileVersion: 3,
      packages: {
        '': { dependencies: { '@agentclientprotocol/codex-acp': codexAcpVersion } },
        'node_modules/@agentclientprotocol/codex-acp': {
          version: codexAcpVersion,
          integrity: 'sha512-YWNwLWxvY2s=',
        },
        'node_modules/@openai/codex': {
          version: codexVersion,
          resolved: `https://registry.npmjs.org/@openai/codex/-/codex-${codexVersion}.tgz`,
          integrity: 'sha512-Y29kZXgtbG9jaw==',
        },
        [`node_modules/${platformPackage}`]: {
          name: '@openai/codex',
          version: platformVersion,
          resolved: `https://registry.npmjs.org/@openai/codex/-/codex-${platformVersion}.tgz`,
          integrity: 'sha512-cGxhdGZvcm0tbG9jaw==',
        },
      },
    });
    fs.mkdirSync(path.join(toolRoot, 'node_modules', '@agentclientprotocol', 'codex-acp', 'dist'), { recursive: true });
    fs.writeFileSync(
      path.join(toolRoot, 'node_modules', '@agentclientprotocol', 'codex-acp', 'dist', 'index.js'),
      'console.log("codex-acp fixture")\n',
    );
    jsonFile(path.join(toolRoot, 'node_modules', '@openai', 'codex', 'package.json'), {
      name: '@openai/codex',
      version: codexVersion,
      optionalDependencies: { [platformPackage]: `npm:@openai/codex@${platformVersion}` },
    });
    jsonFile(path.join(toolRoot, 'node_modules', '@openai', `codex-${runtimeKey}`, 'package.json'), {
      name: '@openai/codex',
      version: platformVersion,
    });
    fs.mkdirSync(path.dirname(path.join(toolRoot, platformExecutable)), { recursive: true });
    fs.writeFileSync(path.join(toolRoot, platformExecutable), 'codex fixture\n');
  });
  let releaseSetPath = '';
  const ownerRefs: Record<string, string> = {};
  const framework = gitFixture(root, options.nestedFramework ? path.join('app', 'framework-source') : 'framework', (directory) => {
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
  if (options.nestedFramework) configureCanonicalFrameworkRemote(root, framework);
  const baseImageIndexPath = path.join(root, 'base-image-index.json');
  jsonFile(baseImageIndexPath, {
    schemaVersion: 2,
    mediaType: 'application/vnd.oci.image.index.v1+json',
    manifests: [{
      digest: `sha256:${'c'.repeat(64)}`,
      size: 4321,
      platform: { os: 'linux', architecture: 'amd64' },
    }],
  });
  const codexPackageRoot = path.join(root, 'codex-package', 'package');
  fs.mkdirSync(codexPackageRoot, { recursive: true });
  jsonFile(path.join(codexPackageRoot, 'package.json'), {
    name: '@openai/codex',
    version: codexVersion,
  });
  const codexTarballPath = path.join(root, 'codex-cli.tgz');
  const packed = spawnSync('tar', ['-czf', codexTarballPath, 'package'], {
    cwd: path.dirname(codexPackageRoot),
    encoding: 'utf8',
  });
  assert.equal(packed.status, 0, packed.stderr);
  return {
    root,
    app,
    shell,
    framework,
    releaseSetPath,
    baseImageIndexPath,
    codexTarballPath,
    thirdPartyManifestPath: path.join(app.root, 'contracts', 'app-full-third-party-source-manifest.json'),
    codexLockPath: path.join(
      shell.root,
      'resources',
      'bundled-aioncore',
      'darwin-arm64',
      'managed-resources',
      'acp',
      'codex-acp',
      codexAcpVersion,
      'darwin-arm64',
      'package-lock.json',
    ),
    codexVersion,
    staleAppCodexProjection,
    codexAcpVersion,
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
  assert.equal(path.relative(fixture.app.root, fixture.framework.root).startsWith('..'), true);
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
  assert.equal(authority.runtime_authority.codex_cli.source, 'shell_aioncore_managed_manifest_and_lock');
  assert.equal(authority.runtime_authority.codex_cli.version, fixture.codexVersion);
  assert.equal(authority.runtime_authority.codex_cli.codex_acp_version, fixture.codexAcpVersion);
  assert.match(authority.runtime_authority.codex_cli.codex_acp_package_lock_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.equal(authority.runtime_authority.codex_cli.qualification_input_ref, undefined);
  assert.notEqual(authority.runtime_authority.codex_cli.version, fixture.staleAppCodexProjection);
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
    '--full-payload-authority', authorityPath,
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
  assert.equal(evidence.payload.full_payload_authority_sha256, sha256Ref(authorityPath));
  assert.deepEqual(evidence.payload.bundled_refs, expectedRefs);
  assert.match(evidence.payload.lines[0], /Full first-install package includes the OPL Framework runtime/);
  assert.equal(evidence.payload.lines[1], `- Packaged component refs: ${expectedRefs.join('; ')}.`);
});

test('freeze adapter rejects retired Full and Release Set authority flags', () => {
  const fixture = fullPayloadAuthorityFixture();
  const authorityPath = path.join(fixture.root, 'full-payload-authority.json');
  const notesPath = path.join(fixture.root, 'prepared-notes.md');
  const evidencePath = path.join(fixture.root, 'prepared-notes-evidence.json');
  const outputPath = path.join(fixture.root, 'retired-freeze-request.json');
  const authorityResult = runNode(fullPayloadAuthorityArgs(fixture, authorityPath));
  assert.equal(authorityResult.status, 0, authorityResult.stderr);
  fs.writeFileSync(
    notesPath,
    '# One Person Lab v26.7.20\n\nPrepared notes.\n\n<!-- OPL_RELEASE_NOTES_GENERATOR:online-ai -->\n',
  );

  jsonFile(evidencePath, {
    schema: 'opl_app_release_notes_evidence.v1',
    payload: {
      include_full_package: true,
      full_payload_authority_sha256: sha256Ref(authorityPath),
    },
  });
  const result = runNode([
    'scripts/framework-release-adapter.ts',
    'freeze-request',
    '--channel', 'stable',
    '--version', '26.7.20',
    '--updater-version', '26.7.20',
    '--app-root', fixture.app.root,
    '--shell-root', fixture.shell.root,
    '--framework-root', fixture.framework.root,
    '--notes', notesPath,
    '--notes-evidence', evidencePath,
    '--notes-full-payload-authority', authorityPath,
    '--include-full-package', 'true',
    '--release-set-manifest', fixture.releaseSetPath,
    '--source-cutoff-observed-at', '2026-07-23T00:00:00.000Z',
    '--frozen-base-release-set-generation', '26.7.20',
    '--frozen-base-release-set-digest', `sha256:${'d'.repeat(64)}`,
    '--base-image-index', fixture.baseImageIndexPath,
    '--frozen-codex-tarball', fixture.codexTarballPath,
    '--output', outputPath,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option '--notes-full-payload-authority'/);
  assert.equal(fs.existsSync(outputPath), false);
});

test('prebuild Full notes authority accepts the verified Actions nested Framework checkout topology', () => {
  const fixture = fullPayloadAuthorityFixture({ nestedFramework: true });
  assert.equal(path.relative(fixture.app.root, fixture.framework.root), 'framework-source');
  const authorityPath = path.join(fixture.root, 'nested-framework-authority.json');
  const result = runNode(fullPayloadAuthorityArgs(fixture, authorityPath));

  assert.equal(result.status, 0, result.stderr);
  const authority = JSON.parse(fs.readFileSync(authorityPath, 'utf8'));
  assert.equal(authority.sources.app.source_commit, fixture.app.ref);
  assert.equal(authority.sources.framework.source_commit, fixture.framework.ref);
});

test('prebuild Full notes authority rejects a nested checkout from the wrong repository', () => {
  const fixture = fullPayloadAuthorityFixture({ nestedFramework: true });
  runFixtureGit(fixture.framework.root, [
    'remote', 'set-url', 'origin', 'https://github.com/gaofeng21cn/not-one-person-lab.git',
  ]);
  const authorityPath = path.join(fixture.root, 'wrong-framework-repo-authority.json');
  const result = runNode(fullPayloadAuthorityArgs(fixture, authorityPath));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Nested Framework origin must be gaofeng21cn\/one-person-lab/);
  assert.equal(fs.existsSync(authorityPath), false);
});

test('prebuild Full notes authority rejects a nested checkout at the wrong workflow input SHA', () => {
  const fixture = fullPayloadAuthorityFixture({ nestedFramework: true });
  const authorityPath = path.join(fixture.root, 'wrong-framework-sha-authority.json');
  const args = fullPayloadAuthorityArgs(fixture, authorityPath);
  args[args.indexOf('--framework-ref') + 1] = 'f'.repeat(40);
  const result = runNode(args);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Framework checkout drifted/);
  assert.equal(fs.existsSync(authorityPath), false);
});

test('prebuild Full notes authority rejects a nested checkout behind live Framework main', () => {
  const fixture = fullPayloadAuthorityFixture({ nestedFramework: true });
  advanceCanonicalFrameworkRemote(fixture.framework);
  const authorityPath = path.join(fixture.root, 'stale-framework-main-authority.json');
  const result = runNode(fullPayloadAuthorityArgs(fixture, authorityPath));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Nested Framework live origin\/main must exactly match/);
  assert.equal(fs.existsSync(authorityPath), false);
});

test('prebuild Full notes authority rejects nested extras and every other App dirty state', () => {
  const fixture = fullPayloadAuthorityFixture({ nestedFramework: true });
  const authorityPath = path.join(fixture.root, 'dirty-nested-framework-authority.json');
  const frameworkExtra = path.join(fixture.framework.root, 'unexpected.txt');
  fs.writeFileSync(frameworkExtra, 'unexpected\n');

  const frameworkDirty = runNode(fullPayloadAuthorityArgs(fixture, authorityPath));
  assert.notEqual(frameworkDirty.status, 0);
  assert.match(frameworkDirty.stderr, /Framework checkout must be clean/);
  assert.equal(fs.existsSync(authorityPath), false);
  fs.rmSync(frameworkExtra);

  const appExtra = path.join(fixture.app.root, 'unexpected-app.txt');
  fs.writeFileSync(appExtra, 'unexpected\n');
  const appUntracked = runNode(fullPayloadAuthorityArgs(fixture, authorityPath));
  assert.notEqual(appUntracked.status, 0);
  assert.match(appUntracked.stderr, /App checkout must be clean/);
  assert.equal(fs.existsSync(authorityPath), false);
  fs.rmSync(appExtra);

  fs.appendFileSync(fixture.thirdPartyManifestPath, '\n');
  runFixtureGit(fixture.app.root, ['add', 'contracts/app-full-third-party-source-manifest.json']);
  const appIndexed = runNode(fullPayloadAuthorityArgs(fixture, authorityPath));
  assert.notEqual(appIndexed.status, 0);
  assert.match(appIndexed.stderr, /App checkout must be clean/);
  assert.equal(fs.existsSync(authorityPath), false);
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

test('prebuild Full notes authority rejects absent or drifted Shell AionCore materialization', async (context) => {
  for (const [label, mutate, expected] of [
    [
      'missing root manifest',
      (fixture: ReturnType<typeof fullPayloadAuthorityFixture>) => fs.rmSync(path.join(
        fixture.shell.root,
        'resources',
        'bundled-aioncore',
        'darwin-arm64',
        'manifest.json',
      )),
      /AionCore root manifest file is missing/,
    ],
    [
      'missing managed manifest',
      (fixture: ReturnType<typeof fullPayloadAuthorityFixture>) => fs.rmSync(path.join(
        fixture.shell.root,
        'resources',
        'bundled-aioncore',
        'darwin-arm64',
        'managed-resources',
        'manifest.json',
      )),
      /AionCore managed-resources manifest file is missing/,
    ],
    [
      'Shell pin drift',
      (fixture: ReturnType<typeof fullPayloadAuthorityFixture>) => jsonFile(
        path.join(fixture.shell.root, 'package.json'),
        { aioncoreVersion: 'v0.1.50' },
      ),
      /root manifest must exactly match the Shell pin/,
    ],
    [
      'official release URL drift',
      (fixture: ReturnType<typeof fullPayloadAuthorityFixture>) => {
        const manifestPath = path.join(
          fixture.shell.root,
          'resources',
          'bundled-aioncore',
          'darwin-arm64',
          'manifest.json',
        );
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifest.source.url = 'https://github.com/iOfficeAI/AionCore/releases/latest/download/aioncore.tar.gz';
        jsonFile(manifestPath, manifest);
      },
      /root manifest must exactly match the Shell pin/,
    ],
    [
      'official Codex lock URL drift',
      (fixture: ReturnType<typeof fullPayloadAuthorityFixture>) => {
        const lock = JSON.parse(fs.readFileSync(fixture.codexLockPath, 'utf8'));
        lock.packages['node_modules/@openai/codex'].resolved = 'https://registry.example.invalid/codex.tgz';
        jsonFile(fixture.codexLockPath, lock);
      },
      /managed Codex lock must use the exact official npm tarballs/,
    ],
  ] as const) {
    await context.test(label, () => {
      const fixture = fullPayloadAuthorityFixture();
      mutate(fixture);
      fixture.shell.ref = commitFixtureChange(fixture.shell.root, label);
      const authorityPath = path.join(fixture.root, 'invalid-aioncore-authority.json');
      const result = runNode(fullPayloadAuthorityArgs(fixture, authorityPath));
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, expected);
      assert.equal(fs.existsSync(authorityPath), false);
    });
  }
});

test('prebuild Full notes authority rejects Shell AionCore managed Codex lock drift before writing evidence', () => {
  const fixture = fullPayloadAuthorityFixture();
  const lock = JSON.parse(fs.readFileSync(fixture.codexLockPath, 'utf8'));
  lock.packages['node_modules/@openai/codex'].version = fixture.staleAppCodexProjection;
  jsonFile(fixture.codexLockPath, lock);
  fixture.shell.ref = commitFixtureChange(fixture.shell.root, 'drift managed Codex lock');
  const authorityPath = path.join(fixture.root, 'drifted-codex-authority.json');
  const result = runNode(fullPayloadAuthorityArgs(fixture, authorityPath));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /managed Codex package and lock versions are inconsistent/);
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
