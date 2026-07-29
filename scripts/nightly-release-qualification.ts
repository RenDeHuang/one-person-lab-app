#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';

import {
  sha256File,
  validateArtifactCohortV2,
  type BuildArtifactCohortV2,
} from './build-artifact-cohort.ts';
import {
  assertNightlyRequestDigest,
  type NightlyReleaseRequest,
} from './resolve-nightly-release-request.ts';
import { createAppComponentManifest } from './write-opl-app-component-manifest.ts';

type AssetIdentity = {
  name: string;
  size_bytes: number;
  sha256: string;
};

export type NightlyQualificationReceipt = {
  schema: 'opl_standard_nightly_qualification.v1';
  status: 'passed';
  request_digest: `sha256:${string}`;
  version: string;
  updater_version: string;
  tag: string;
  quality_status: 'preview';
  build_trigger: 'automated';
  preview_kind: 'nightly';
  cohort: NightlyReleaseRequest['source'];
  actions: NightlyReleaseRequest['actions'];
  package_kind: 'app_standard';
  include_full: false;
  stable_qualified: false;
  heavy_vm_required: false;
  sampled_vm_nonblocking: true;
  qualification_disclosure: {
    stable_qualified: false;
    passed_gates: [];
    skipped_gates: [
      'stable_heavy_vm',
      'homebrew_clean_install',
      'native_webui',
      'container_webui',
      'full',
    ];
    failed_gates: [];
    non_stable_notice: true;
  };
  full_assets_present: false;
  webui_assets_present: false;
  local_authorization: {
    required: true;
    gatekeeper_required: false;
    policy_sha256: string;
  };
  assets: AssetIdentity[];
  primary_dmg: AssetIdentity;
  updater_metadata: AssetIdentity;
  cohort_manifest_sha256: string;
};

const digestPattern = /^[0-9a-f]{64}$/;

function identity(filePath: string): AssetIdentity {
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size <= 0) throw new Error(`Nightly asset is missing or empty: ${filePath}`);
  return {
    name: path.basename(filePath),
    size_bytes: stat.size,
    sha256: sha256File(filePath),
  };
}

function exactDirectoryFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function assertLocalAuthorizationPolicy(policy: any): void {
  if (
    policy?.schema !== 'opl_local_authorized_macos_policy.v1'
    || policy?.package_kind !== 'app_standard'
    || policy?.release_install_path !== 'local_authorized_unsigned'
    || policy?.apple_developer_id_required !== false
    || policy?.gatekeeper_required !== false
    || policy?.local_authorization_required !== true
    || policy?.quarantine_removal_required !== true
  ) {
    throw new Error('Nightly local authorization policy must explicitly describe direct unsigned Preview behavior.');
  }
}

export function qualifyNightlyRelease(input: {
  request: NightlyReleaseRequest;
  assetsDir: string;
  cohortManifest: BuildArtifactCohortV2;
  cohortManifestPath: string;
}): NightlyQualificationReceipt {
  assertNightlyRequestDigest(input.request);
  const { request, assetsDir, cohortManifest } = input;
  const dmgName = `One-Person-Lab-${request.version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${request.version}-mac-arm64.zip`;
  const blockmapName = `${zipName}.blockmap`;
  const metadataName = 'latest-arm64-mac.yml';
  const linuxDebName = `One-Person-Lab-${request.version}-linux-x64.deb`;
  const frozenInstallerName = 'opl-install.sh';
  const policyName = 'standard-local-authorization-policy.json';
  const componentManifestName = 'opl-app-component-manifest.json';
  const expectedFiles = [
    blockmapName,
    dmgName,
    frozenInstallerName,
    linuxDebName,
    metadataName,
    policyName,
    zipName,
  ].sort();
  const observedFiles = exactDirectoryFiles(assetsDir);
  if (JSON.stringify(observedFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(`Nightly asset directory must contain exactly ${expectedFiles.join(', ')}; found ${observedFiles.join(', ')}.`);
  }
  if (observedFiles.some((name) => /Full|WebUI/i.test(name))) {
    throw new Error('Nightly must not contain Full or WebUI assets.');
  }

  const dmgPath = path.join(assetsDir, dmgName);
  const cohortErrors = validateArtifactCohortV2(cohortManifest, {
    appSha: request.source.app_sha,
    shellSha: request.source.shell_sha,
    frameworkSha: request.source.framework_sha,
    version: request.version,
    artifactPath: dmgPath,
    actionsRunId: request.actions.run_id,
  });
  if (cohortManifest.build.kind !== 'standard') cohortErrors.push('artifact cohort kind must be standard');
  if (cohortManifest.actions.run_attempt !== '1') cohortErrors.push('artifact cohort run attempt must be 1');
  if (cohortManifest.release.stable_session_id !== null || cohortManifest.release.release_cohort_ref !== null) {
    cohortErrors.push('Nightly artifact must not claim a Stable session or Release Bundle cohort');
  }
  if (cohortErrors.length > 0) throw new Error(`Nightly build cohort mismatch: ${cohortErrors.join('; ')}`);

  const policyPath = path.join(assetsDir, policyName);
  assertLocalAuthorizationPolicy(JSON.parse(fs.readFileSync(policyPath, 'utf8')));
  const metadataPath = path.join(assetsDir, metadataName);
  const metadata = parseYaml(fs.readFileSync(metadataPath, 'utf8')) as any;
  if (String(metadata?.version) !== request.updater_version) {
    throw new Error(`Nightly updater metadata must declare machine version ${request.updater_version}.`);
  }
  const metadataUrls = [
    ...(Array.isArray(metadata?.files) ? metadata.files.map((entry: any) => String(entry?.url ?? '')) : []),
    String(metadata?.path ?? ''),
  ];
  if (!metadataUrls.includes(zipName) || metadataUrls.some((value) => /Full|WebUI/i.test(value))) {
    throw new Error(`Nightly updater metadata must reference only ${zipName}.`);
  }

  const publicNames = [
    dmgName,
    zipName,
    blockmapName,
    metadataName,
    linuxDebName,
    frozenInstallerName,
  ];
  const releaseBase =
    `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/${request.tag}`;
  const componentManifest = createAppComponentManifest({
    version: request.version,
    updaterVersion: request.updater_version,
    sourceCommit: request.source.app_sha,
    shellCommit: request.source.shell_sha,
    frameworkCommit: request.source.framework_sha,
    tag: request.tag,
    releaseUrl:
      `https://github.com/gaofeng21cn/one-person-lab-app/releases/tag/${request.tag}`,
    repo: 'gaofeng21cn/one-person-lab-app',
    assets: publicNames.map((name) => ({
      name,
      url: `${releaseBase}/${name}`,
      digest: `sha256:${sha256File(path.join(assetsDir, name))}`,
      size: fs.statSync(path.join(assetsDir, name)).size,
      contentType: name.endsWith('.yml') ? 'application/yaml' : 'application/octet-stream',
    })),
  });
  fs.writeFileSync(
    path.join(assetsDir, componentManifestName),
    `${JSON.stringify(componentManifest, null, 2)}\n`,
    'utf8',
  );
  const expectedQualifiedFiles = [...expectedFiles, componentManifestName].sort();
  const qualifiedFiles = exactDirectoryFiles(assetsDir);
  if (JSON.stringify(qualifiedFiles) !== JSON.stringify(expectedQualifiedFiles)) {
    throw new Error('Nightly qualification produced an unexpected local asset set.');
  }
  publicNames.push(componentManifestName);
  const assets = publicNames.map((name) => identity(path.join(assetsDir, name)));
  for (const asset of assets) {
    if (!digestPattern.test(asset.sha256)) throw new Error(`Invalid Nightly SHA-256 for ${asset.name}.`);
  }
  return {
    schema: 'opl_standard_nightly_qualification.v1',
    status: 'passed',
    request_digest: request.request_digest,
    version: request.version,
    updater_version: request.updater_version,
    tag: request.tag,
    quality_status: 'preview',
    build_trigger: 'automated',
    preview_kind: 'nightly',
    cohort: request.source,
    actions: request.actions,
    package_kind: 'app_standard',
    include_full: false,
    stable_qualified: false,
    heavy_vm_required: false,
    sampled_vm_nonblocking: true,
    qualification_disclosure: {
      stable_qualified: false,
      passed_gates: [],
      skipped_gates: [
        'stable_heavy_vm',
        'homebrew_clean_install',
        'native_webui',
        'container_webui',
        'full',
      ],
      failed_gates: [],
      non_stable_notice: true,
    },
    full_assets_present: false,
    webui_assets_present: false,
    local_authorization: {
      required: true,
      gatekeeper_required: false,
      policy_sha256: sha256File(policyPath),
    },
    assets,
    primary_dmg: assets.find((asset) => asset.name === dmgName)!,
    updater_metadata: assets.find((asset) => asset.name === metadataName)!,
    cohort_manifest_sha256: sha256File(input.cohortManifestPath),
  };
}

function main(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      request: { type: 'string' },
      'assets-dir': { type: 'string' },
      cohort: { type: 'string' },
      output: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  const required = (name: keyof typeof values): string => {
    const value = values[name];
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`Missing --${String(name)}.`);
    return path.resolve(value.trim());
  };
  const requestPath = required('request');
  const assetsDir = required('assets-dir');
  const cohortPath = required('cohort');
  const output = required('output');
  const receipt = qualifyNightlyRelease({
    request: JSON.parse(fs.readFileSync(requestPath, 'utf8')),
    assetsDir,
    cohortManifest: JSON.parse(fs.readFileSync(cohortPath, 'utf8')),
    cohortManifestPath: cohortPath,
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
