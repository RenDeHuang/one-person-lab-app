#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolveAioncoreManagedCodexBinding } from './manual-latest-build.ts';

type JsonRecord = Record<string, any>;

const shaPattern = /^[0-9a-f]{40}$/;
const canonicalFrameworkRepository = 'gaofeng21cn/one-person-lab';
const nestedFrameworkCheckoutPath = 'framework-source';
const packageSpecs = [
  { packageId: 'mas', componentKey: 'mas', resolvedRefKey: 'mas', repository: 'gaofeng21cn/med-autoscience' },
  { packageId: 'mag', componentKey: 'mag', resolvedRefKey: 'mag', repository: 'gaofeng21cn/med-autogrant' },
  { packageId: 'rca', componentKey: 'rca', resolvedRefKey: 'rca', repository: 'gaofeng21cn/redcube-ai' },
  { packageId: 'oma', componentKey: 'meta_agent', resolvedRefKey: 'opl_meta_agent', repository: 'gaofeng21cn/opl-meta-agent' },
  { packageId: 'obf', componentKey: 'bookforge', resolvedRefKey: 'opl_bookforge', repository: 'gaofeng21cn/opl-bookforge' },
  { packageId: 'mas-scholar-skills', componentKey: 'mas_scholar_skills', resolvedRefKey: 'mas_scholar_skills', repository: 'gaofeng21cn/mas-scholar-skills' },
  { packageId: 'opl-flow', componentKey: 'opl_flow', resolvedRefKey: 'opl_flow', repository: 'gaofeng21cn/opl-flow' },
] as const;

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${label}.`);
  return value.trim();
}

function requiredObject(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Missing ${label}.`);
  }
  return value as JsonRecord;
}

function readRegularJson(filePath: string, label: string): JsonRecord {
  const stat = fs.lstatSync(filePath, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file: ${filePath}`);
  }
  return requiredObject(JSON.parse(fs.readFileSync(filePath, 'utf8')), label);
}

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function digestRef(filePath: string): string {
  return `sha256:${sha256File(filePath)}`;
}

function gitSha(root: string, label: string): string {
  const result = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  const value = result.stdout.trim();
  if (result.status !== 0 || !shaPattern.test(value)) {
    throw new Error(`Cannot resolve exact ${label} Git SHA: ${result.stderr.trim()}`);
  }
  return value;
}

function statusWithoutExactUntrackedDirectory(status: string, relativePath: string | null): string {
  if (!relativePath) return status;
  const normalized = relativePath.split(path.sep).join('/').replace(/\/+$/, '');
  const allowed = new Set([`?? ${normalized}`, `?? ${normalized}/`]);
  return status
    .split(/\r?\n/)
    .filter((line) => line && !allowed.has(line))
    .join('\n');
}

function assertExactGitSha(
  root: string,
  expected: string,
  label: string,
  allowedUntrackedDirectory: string | null = null,
): string {
  if (!shaPattern.test(expected)) throw new Error(`${label} ref must be an exact 40-character Git SHA.`);
  const actual = gitSha(root, label);
  if (actual !== expected) throw new Error(`${label} checkout drifted: expected ${expected}, got ${actual}.`);
  const status = spawnSync(
    'git',
    ['-C', root, 'status', '--porcelain', '--untracked-files=all'],
    { encoding: 'utf8' },
  );
  const dirtyStatus = statusWithoutExactUntrackedDirectory(status.stdout, allowedUntrackedDirectory);
  if (status.status !== 0 || dirtyStatus) {
    throw new Error(`${label} checkout must be clean before release-note authority is derived.`);
  }
  return actual;
}

function exactGitValue(root: string, args: string[], label: string): string {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000,
  });
  const value = result.stdout.trim();
  if (result.status !== 0 || !value) {
    throw new Error(`Cannot resolve ${label}: ${result.stderr.trim()}`);
  }
  return value;
}

function canonicalGithubRepository(remoteUrl: string): string | null {
  const normalized = remoteUrl.trim().replace(/\.git$/i, '');
  const match = normalized.match(/github\.com(?::\d+)?[/:]([^/]+\/[^/]+)$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function nestedFrameworkRelativePath(appRoot: string, frameworkRoot: string): string | null {
  const relative = path.relative(appRoot, frameworkRoot);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
  const normalized = relative.split(path.sep).join('/').replace(/\/+$/, '');
  if (normalized !== nestedFrameworkCheckoutPath) {
    throw new Error(`Framework checkout inside App must be exactly ${nestedFrameworkCheckoutPath}/.`);
  }
  return normalized;
}

function assertNestedFrameworkCheckout(
  frameworkRoot: string,
  expectedRef: string,
): string {
  const frameworkRef = assertExactGitSha(frameworkRoot, expectedRef, 'Framework');
  const topLevel = fs.realpathSync(exactGitValue(
    frameworkRoot,
    ['rev-parse', '--show-toplevel'],
    'nested Framework Git top-level',
  ));
  if (topLevel !== frameworkRoot) {
    throw new Error('Nested Framework checkout root must exactly match its Git top-level.');
  }

  const originUrl = exactGitValue(
    frameworkRoot,
    ['config', '--get', 'remote.origin.url'],
    'nested Framework origin URL',
  );
  if (canonicalGithubRepository(originUrl) !== canonicalFrameworkRepository) {
    throw new Error(`Nested Framework origin must be ${canonicalFrameworkRepository}.`);
  }

  const resolvedRef = exactGitValue(
    frameworkRoot,
    ['rev-parse', '--verify', `${expectedRef}^{commit}`],
    'nested Framework exact ref',
  );
  if (resolvedRef !== expectedRef) {
    throw new Error(`Nested Framework ref must resolve exactly to ${expectedRef}.`);
  }
  const headTree = exactGitValue(frameworkRoot, ['rev-parse', 'HEAD^{tree}'], 'nested Framework HEAD tree');
  const refTree = exactGitValue(
    frameworkRoot,
    ['rev-parse', `${expectedRef}^{tree}`],
    'nested Framework input ref tree',
  );
  if (!shaPattern.test(headTree) || headTree !== refTree) {
    throw new Error('Nested Framework HEAD tree does not match the workflow input ref tree.');
  }

  const remoteMain = exactGitValue(
    frameworkRoot,
    ['ls-remote', '--heads', 'origin', 'refs/heads/main'],
    'nested Framework live origin/main',
  );
  const remoteMainParts = remoteMain.split(/\s+/);
  if (
    remoteMainParts.length !== 2
    || remoteMainParts[1] !== 'refs/heads/main'
    || remoteMainParts[0] !== expectedRef
  ) {
    throw new Error(`Nested Framework live origin/main must exactly match ${expectedRef}.`);
  }
  return frameworkRef;
}

function assertContainedFile(root: string, candidate: string, label: string): string {
  const candidateStat = fs.lstatSync(candidate, { throwIfNoEntry: false });
  if (!candidateStat?.isFile() || candidateStat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file: ${candidate}`);
  }
  const rootRealpath = fs.realpathSync(root);
  const candidateRealpath = fs.realpathSync(candidate);
  const relative = path.relative(rootRealpath, candidateRealpath);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes its authority checkout: ${candidate}`);
  }
  return candidateRealpath;
}

function assertExactIds(actual: unknown, expected: readonly string[], label: string): void {
  if (!Array.isArray(actual) || actual.some((value) => typeof value !== 'string')) {
    throw new Error(`${label} must be a string array.`);
  }
  const normalized = [...actual].sort();
  const expectedNormalized = [...expected].sort();
  if (JSON.stringify(normalized) !== JSON.stringify(expectedNormalized)) {
    throw new Error(`${label} must contain exactly ${expected.join(', ')}.`);
  }
}

function frameworkContractRef(ref: string): string {
  const normalized = ref.split(path.sep).join('/');
  return normalized.startsWith('contracts/')
    ? normalized
    : path.posix.join('contracts/opl-framework', normalized);
}

function resolveCatalogFile(frameworkRoot: string, catalogRoot: string, ref: string, label: string): string {
  const candidate = path.resolve(ref.startsWith('contracts/') ? frameworkRoot : catalogRoot, ref);
  return assertContainedFile(frameworkRoot, candidate, label);
}

export async function buildReleaseNotesFullPayloadAuthority(input: {
  appRoot: string;
  appRef: string;
  shellRoot: string;
  shellRef: string;
  frameworkRoot: string;
  frameworkRef: string;
  releaseSetManifestPath: string;
  thirdPartySourceManifestPath: string;
}): Promise<JsonRecord> {
  const appRoot = fs.realpathSync(input.appRoot);
  const shellRoot = fs.realpathSync(input.shellRoot);
  const frameworkRoot = fs.realpathSync(input.frameworkRoot);
  const nestedFrameworkPath = nestedFrameworkRelativePath(appRoot, frameworkRoot);
  const frameworkRef = nestedFrameworkPath
    ? assertNestedFrameworkCheckout(frameworkRoot, input.frameworkRef)
    : assertExactGitSha(frameworkRoot, input.frameworkRef, 'Framework');
  const appRef = assertExactGitSha(appRoot, input.appRef, 'App', nestedFrameworkPath);
  const shellRef = assertExactGitSha(shellRoot, input.shellRef, 'Shell');

  const releaseSetPath = assertContainedFile(
    frameworkRoot,
    input.releaseSetManifestPath,
    'Framework Release Set manifest',
  );
  const releaseSet = readRegularJson(releaseSetPath, 'Framework Release Set manifest');
  if (releaseSet.surface_kind !== 'opl_release_set.v2') {
    throw new Error('Framework Release Set manifest has an unsupported surface_kind.');
  }
  const releasePackages = requiredObject(
    requiredObject(releaseSet.components, 'Framework Release Set components').packages,
    'Framework Release Set packages',
  );
  if (releasePackages.package_count !== packageSpecs.length) {
    throw new Error(`Framework Release Set must declare exactly ${packageSpecs.length} packages.`);
  }
  const packageIds = packageSpecs.map(({ packageId }) => packageId);
  assertExactIds(releasePackages.package_ids, packageIds, 'Framework Release Set package_ids');
  assertExactIds(
    requiredObject(releaseSet.owner_cohort_lock, 'Framework owner cohort lock').package_ids,
    packageIds,
    'Framework owner cohort package_ids',
  );

  const catalogPath = assertContainedFile(
    frameworkRoot,
    path.join(frameworkRoot, 'contracts', 'opl-framework', 'bundled-full-runtime-package-catalog.json'),
    'Framework bundled package catalog',
  );
  const catalog = readRegularJson(catalogPath, 'Framework bundled package catalog');
  if (catalog.surface_kind !== 'opl_bundled_full_runtime_package_catalog.v1') {
    throw new Error('Framework bundled package catalog has an unsupported surface_kind.');
  }
  const catalogPackages = requiredObject(catalog.packages, 'Framework bundled package catalog packages');
  assertExactIds(Object.keys(catalogPackages), packageIds, 'Framework bundled package catalog package ids');
  const releaseMembers = requiredObject(releasePackages.members, 'Framework Release Set package members');
  assertExactIds(Object.keys(releaseMembers), packageIds, 'Framework Release Set package member ids');
  const catalogRoot = path.dirname(catalogPath);

  const components: JsonRecord = {
    opl: { git_commit: frameworkRef },
  };
  const resolvedRefs: JsonRecord = {
    opl_framework: {
      label: 'OPL Framework',
      repository: 'gaofeng21cn/one-person-lab',
      resolved_commit: frameworkRef,
    },
  };
  const packageAuthority: JsonRecord = {};

  for (const spec of packageSpecs) {
    const entry = requiredObject(catalogPackages[spec.packageId], `Framework catalog ${spec.packageId}`);
    const member = requiredObject(releaseMembers[spec.packageId], `Framework Release Set ${spec.packageId}`);
    const version = requiredString(entry.package_version, `${spec.packageId} package version`);
    const ownerSourceCommit = requiredString(entry.owner_source_commit, `${spec.packageId} owner source commit`);
    if (!shaPattern.test(ownerSourceCommit)) throw new Error(`${spec.packageId} owner source commit is invalid.`);
    const manifestRef = frameworkContractRef(requiredString(entry.manifest_ref, `${spec.packageId} manifest ref`));
    const payloadManifestRef = frameworkContractRef(
      requiredString(entry.payload_manifest_ref, `${spec.packageId} payload manifest ref`),
    );
    const expectedFields = {
      version,
      source_commit: ownerSourceCommit,
      manifest_ref: manifestRef,
      manifest_sha256: requiredString(entry.manifest_sha256, `${spec.packageId} manifest digest`),
      payload_manifest_ref: payloadManifestRef,
      payload_manifest_sha256: requiredString(
        entry.payload_manifest_sha256,
        `${spec.packageId} payload manifest digest`,
      ),
    };
    for (const [field, expected] of Object.entries(expectedFields)) {
      if (member[field] !== expected) {
        throw new Error(`Framework Release Set ${spec.packageId}.${field} does not match the bundled catalog.`);
      }
    }

    const manifestPath = resolveCatalogFile(
      frameworkRoot,
      catalogRoot,
      requiredString(entry.manifest_ref, `${spec.packageId} manifest ref`),
      `${spec.packageId} package manifest`,
    );
    const payloadManifestPath = resolveCatalogFile(
      frameworkRoot,
      catalogRoot,
      requiredString(entry.payload_manifest_ref, `${spec.packageId} payload manifest ref`),
      `${spec.packageId} payload manifest`,
    );
    if (digestRef(manifestPath) !== expectedFields.manifest_sha256) {
      throw new Error(`${spec.packageId} package manifest bytes drifted from the Framework authority.`);
    }
    if (digestRef(payloadManifestPath) !== expectedFields.payload_manifest_sha256) {
      throw new Error(`${spec.packageId} payload manifest bytes drifted from the Framework authority.`);
    }
    const manifest = readRegularJson(manifestPath, `${spec.packageId} package manifest`);
    const payloadManifest = readRegularJson(payloadManifestPath, `${spec.packageId} payload manifest`);
    if (manifest.package_id !== spec.packageId || manifest.version !== version) {
      throw new Error(`${spec.packageId} package manifest identity does not match the Framework authority.`);
    }
    if (
      payloadManifest.package_id !== spec.packageId
      || payloadManifest.package_version !== version
      || payloadManifest.source_commit !== ownerSourceCommit
    ) {
      throw new Error(`${spec.packageId} payload manifest identity does not match the Framework authority.`);
    }

    components[spec.componentKey] = { version, git_commit: ownerSourceCommit };
    resolvedRefs[spec.resolvedRefKey] = {
      label: spec.packageId,
      repository: spec.repository,
      resolved_commit: ownerSourceCommit,
      version,
    };
    packageAuthority[spec.packageId] = {
      version,
      owner_source_commit: ownerSourceCommit,
      manifest_ref: manifestRef,
      manifest_sha256: expectedFields.manifest_sha256,
      payload_manifest_ref: payloadManifestRef,
      payload_manifest_sha256: expectedFields.payload_manifest_sha256,
    };
  }

  const thirdPartyManifestPath = assertContainedFile(
    appRoot,
    input.thirdPartySourceManifestPath,
    'App Full third-party source manifest',
  );
  const thirdPartyManifest = readRegularJson(
    thirdPartyManifestPath,
    'App Full third-party source manifest',
  );
  if (thirdPartyManifest.schema !== 'opl_app_full_third_party_source_manifest.v1') {
    throw new Error('App Full third-party source manifest has an unsupported schema.');
  }
  const thirdPartySources = requiredObject(thirdPartyManifest.sources, 'App Full third-party sources');
  const runtimePayloads = requiredObject(thirdPartyManifest.runtime_payloads, 'App Full runtime payloads');
  const officeSource = requiredObject(thirdPartySources.officecli, 'OfficeCLI source authority');
  const mineruSource = requiredObject(thirdPartySources.mineru, 'MinerU source authority');
  const officePayload = requiredObject(runtimePayloads.officecli, 'OfficeCLI runtime authority');
  const aioncoreBinding = resolveAioncoreManagedCodexBinding(shellRoot);
  const shellPackage = readRegularJson(path.join(shellRoot, 'package.json'), 'exact Shell package.json');
  const aioncoreVersion = requiredString(shellPackage.aioncoreVersion, 'Shell package.json#aioncoreVersion');
  if (!/^v\d+\.\d+\.\d+$/.test(aioncoreVersion)) {
    throw new Error(`Shell AionCore pin must be an exact version tag, got ${aioncoreVersion}.`);
  }
  const expectedAioncoreUrl = [
    'https://github.com/iOfficeAI/AionCore/releases/download',
    aioncoreVersion,
    `aioncore-${aioncoreVersion}-aarch64-apple-darwin.tar.gz`,
  ].join('/');
  if (
    aioncoreBinding.runtime_key !== 'darwin-arm64'
    || aioncoreBinding.aioncore.version !== aioncoreVersion
    || aioncoreBinding.aioncore.source_type !== 'download'
    || aioncoreBinding.aioncore.source_url !== expectedAioncoreUrl
  ) {
    throw new Error('AionCore root manifest must exactly match the Shell pin and official darwin-arm64 release.');
  }
  const codexVersion = requiredString(aioncoreBinding.codex_cli.version, 'AionCore managed Codex CLI version');
  const expectedCodexUrl = `https://registry.npmjs.org/@openai/codex/-/codex-${codexVersion}.tgz`;
  const expectedPlatformUrl = `https://registry.npmjs.org/@openai/codex/-/codex-${aioncoreBinding.codex_cli.platform_version}.tgz`;
  if (
    aioncoreBinding.codex_cli.lock_resolved !== expectedCodexUrl
    || aioncoreBinding.codex_cli.platform_lock_resolved !== expectedPlatformUrl
  ) {
    throw new Error('AionCore managed Codex lock must use the exact official npm tarballs.');
  }
  components.codex = { version: `codex-cli ${codexVersion}` };
  resolvedRefs.codex_cli = {
    label: 'Codex CLI',
    repository: 'npm:@openai/codex',
    resolved_version: codexVersion,
    npm_integrity: aioncoreBinding.codex_cli.lock_integrity,
    tarball_url: aioncoreBinding.codex_cli.lock_resolved,
    platform_version: aioncoreBinding.codex_cli.platform_version,
    platform_npm_integrity: aioncoreBinding.codex_cli.platform_lock_integrity,
    platform_tarball_url: aioncoreBinding.codex_cli.platform_lock_resolved,
    aioncore_version: aioncoreBinding.aioncore.version,
    codex_acp_version: aioncoreBinding.codex_acp.version,
    managed_resources_manifest_sha256: `sha256:${aioncoreBinding.managed_resources.manifest_sha256}`,
    package_lock_sha256: `sha256:${aioncoreBinding.codex_acp.package_lock_sha256}`,
  };
  const officeRef = requiredString(officeSource.ref, 'OfficeCLI source ref');
  const mineruRef = requiredString(mineruSource.ref, 'MinerU source ref');
  if (!shaPattern.test(officeRef) || !shaPattern.test(mineruRef)) {
    throw new Error('OfficeCLI and MinerU source refs must be exact 40-character Git SHAs.');
  }
  const officeVersion = requiredString(officePayload.version, 'OfficeCLI runtime version');
  if (requiredString(officeSource.release_tag, 'OfficeCLI release tag') !== `v${officeVersion}`) {
    throw new Error('OfficeCLI source tag and runtime version do not match.');
  }
  components.officecli = { version: officeVersion, git_commit: officeRef };
  components.mineru_open_api = { git_commit: mineruRef };
  resolvedRefs.officecli = {
    label: 'OfficeCLI',
    repository: requiredString(officeSource.repository, 'OfficeCLI repository'),
    resolved_commit: officeRef,
    version: officeVersion,
  };
  resolvedRefs.mineru = {
    label: 'MinerU',
    repository: requiredString(mineruSource.repository, 'MinerU repository'),
    resolved_commit: mineruRef,
  };

  return {
    schema: 'opl_app_release_notes_full_payload_authority.v1',
    intent: {
      include_full_package: true,
      phase: 'prebuild',
      build_artifact_bytes_known: false,
      usage: 'prepared_release_notes_evidence',
    },
    sources: {
      app: { source_commit: appRef },
      shell: { source_commit: shellRef },
      framework: { source_commit: frameworkRef },
    },
    framework_release_set: {
      generation: requiredString(releaseSet.generation, 'Framework Release Set generation'),
      manifest_ref: path.relative(frameworkRoot, releaseSetPath).split(path.sep).join('/'),
      manifest_sha256: digestRef(releaseSetPath),
      catalog_ref: 'contracts/opl-framework/bundled-full-runtime-package-catalog.json',
      catalog_sha256: digestRef(catalogPath),
    },
    packages: packageAuthority,
    runtime_authority: {
      codex_cli: {
        source: 'shell_aioncore_managed_manifest_and_lock',
        shell_source_commit: shellRef,
        runtime_key: aioncoreBinding.runtime_key,
        aioncore_version: aioncoreBinding.aioncore.version,
        aioncore_source_url: aioncoreBinding.aioncore.source_url,
        aioncore_root_manifest_ref: path.relative(shellRoot, aioncoreBinding.aioncore.root_manifest).split(path.sep).join('/'),
        aioncore_root_manifest_sha256: `sha256:${aioncoreBinding.aioncore.root_manifest_sha256}`,
        managed_resources_manifest_ref: path.relative(shellRoot, aioncoreBinding.managed_resources.manifest).split(path.sep).join('/'),
        managed_resources_manifest_sha256: `sha256:${aioncoreBinding.managed_resources.manifest_sha256}`,
        codex_acp_package: aioncoreBinding.codex_acp.package,
        codex_acp_version: aioncoreBinding.codex_acp.version,
        codex_acp_package_lock_ref: path.relative(shellRoot, aioncoreBinding.codex_acp.package_lock).split(path.sep).join('/'),
        codex_acp_package_lock_sha256: `sha256:${aioncoreBinding.codex_acp.package_lock_sha256}`,
        package: aioncoreBinding.codex_cli.package,
        version: codexVersion,
        npm_integrity: aioncoreBinding.codex_cli.lock_integrity,
        tarball_url: aioncoreBinding.codex_cli.lock_resolved,
        platform: {
          package: aioncoreBinding.codex_cli.platform_package,
          version: aioncoreBinding.codex_cli.platform_version,
          npm_integrity: aioncoreBinding.codex_cli.platform_lock_integrity,
          tarball_url: aioncoreBinding.codex_cli.platform_lock_resolved,
        },
        postbuild_manifest_version_and_bytes_required: true,
      },
      officecli: { source_commit: officeRef, version: officeVersion },
      mineru: { source_commit: mineruRef },
      app_third_party_source_manifest_sha256: digestRef(thirdPartyManifestPath),
    },
    components,
    resolved_refs: resolvedRefs,
  };
}

function parseCli(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'app-root': { type: 'string' },
      'app-ref': { type: 'string' },
      'shell-root': { type: 'string' },
      'shell-ref': { type: 'string' },
      'framework-root': { type: 'string' },
      'framework-ref': { type: 'string' },
      'release-set-manifest': { type: 'string' },
      'third-party-source-manifest': { type: 'string' },
      output: { type: 'string' },
    },
    allowPositionals: false,
    strict: true,
  });
  return {
    appRoot: path.resolve(requiredString(values['app-root'], '--app-root')),
    appRef: requiredString(values['app-ref'], '--app-ref'),
    shellRoot: path.resolve(requiredString(values['shell-root'], '--shell-root')),
    shellRef: requiredString(values['shell-ref'], '--shell-ref'),
    frameworkRoot: path.resolve(requiredString(values['framework-root'], '--framework-root')),
    frameworkRef: requiredString(values['framework-ref'], '--framework-ref'),
    releaseSetManifestPath: path.resolve(
      requiredString(values['release-set-manifest'], '--release-set-manifest'),
    ),
    thirdPartySourceManifestPath: path.resolve(
      requiredString(values['third-party-source-manifest'], '--third-party-source-manifest'),
    ),
    output: path.resolve(requiredString(values.output, '--output')),
  };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const output = await buildReleaseNotesFullPayloadAuthority(options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(output, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
