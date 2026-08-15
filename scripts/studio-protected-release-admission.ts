#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';

type GitIdentity = {
  commitSha: string;
  treeSha: string;
};

type StudioPackage = {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
};

type StudioBuilder = {
  appId?: string;
  productName?: string;
  artifactName?: string;
  mac?: {
    hardenedRuntime?: boolean;
    target?: unknown[];
  };
  publish?: {
    provider?: string;
    owner?: string;
    repo?: string;
  };
};

type PlannerInput = {
  app: GitIdentity;
  studio: GitIdentity;
  requestedTag: string;
  studioPackage: StudioPackage;
  studioBuilder: StudioBuilder;
};

const shaPattern = /^[0-9a-f]{40}$/;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const stageOrder = [
  'exact_source_checkout',
  'developer_id_signed_build',
  'apple_notarization',
  'staple_and_gatekeeper_validation',
  'exact_tag_publication',
  'anonymous_public_byte_readback',
  'studio_release_qualification',
] as const;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertGitIdentity(label: string, identity: GitIdentity): void {
  invariant(shaPattern.test(identity.commitSha), `${label} commit must be an exact lowercase 40-character SHA.`);
  invariant(shaPattern.test(identity.treeSha), `${label} tree must be an exact lowercase 40-character SHA.`);
}

function normalizedTargets(targets: unknown[] | undefined): string[] {
  if (!Array.isArray(targets)) return [];
  return targets.map((target) => {
    if (typeof target === 'string') return target;
    if (target && typeof target === 'object' && 'target' in target) {
      return String((target as { target?: unknown }).target ?? '');
    }
    return '';
  }).filter(Boolean);
}

export function buildStudioProtectedReleaseAdmission(input: PlannerInput) {
  assertGitIdentity('App', input.app);
  assertGitIdentity('Studio', input.studio);

  const packageVersion = input.studioPackage.version ?? '';
  invariant(input.studioPackage.name === 'opl-studio', 'Studio package name must remain opl-studio.');
  invariant(versionPattern.test(packageVersion), 'Studio package version must be SemVer.');
  invariant(input.requestedTag === `v${packageVersion}`, 'Protected Studio tag must equal package version.');

  const publish = input.studioBuilder.publish;
  invariant(
    publish?.provider === 'github'
      && publish.owner === 'gaofeng21cn'
      && publish.repo === 'opl-studio',
    'Studio must use the dedicated gaofeng21cn/opl-studio release repository.',
  );
  invariant(input.studioBuilder.mac?.hardenedRuntime === true, 'Studio macOS release must enable hardened runtime.');
  const targets = normalizedTargets(input.studioBuilder.mac?.target);
  invariant(targets.includes('dmg') && targets.includes('zip'), 'Studio macOS release must produce both DMG and ZIP targets.');
  invariant(
    input.studioBuilder.artifactName === 'one-person-lab-preview-${version}-${os}-${arch}.${ext}',
    'Studio release artifact namespace drifted from the admitted carrier contract.',
  );

  const releaseQualification = input.studioPackage.scripts?.['qualify:desktop:mac:release'] ?? '';
  invariant(
    releaseQualification.includes('scripts/desktop/macos-distribution.mjs')
      && releaseQualification.includes('--require-release-trust')
      && releaseQualification.includes('--require-public-feed'),
    'Studio release qualification must require trust and public feed.',
  );
  invariant(
    (input.studioPackage.scripts?.['dist:mac'] ?? '').includes('qualify:desktop:mac'),
    'Studio macOS distribution must run local distribution qualification.',
  );

  return {
    schema: 'opl_studio_protected_release_admission.v1',
    status: 'source_admitted_pending_protected_execution',
    authority: {
      owner: 'one-person-lab-app',
      workflow: '.github/workflows/release-stable.yml',
      entry_selector: 'studio_carrier_admission',
      framework_operation: null,
      environment: 'release-stable',
      framework_release_operation_created: false,
      second_release_owner_created: false,
    },
    app_executor: {
      commit_sha: input.app.commitSha,
      tree_sha: input.app.treeSha,
    },
    source: {
      repository: 'gaofeng21cn/opl-studio',
      commit_sha: input.studio.commitSha,
      tree_sha: input.studio.treeSha,
      package_version: packageVersion,
      tag: input.requestedTag,
      app_id: input.studioBuilder.appId,
      product_name: input.studioBuilder.productName,
      artifact_name_template: input.studioBuilder.artifactName,
      macos_targets: targets,
      update_feed: 'https://github.com/gaofeng21cn/opl-studio/releases/download/<exact-tag>/',
    },
    admitted_plan: {
      carrier: 'electron_desktop',
      stage_order: stageOrder,
      build_command: 'npm ci && npm run dist:mac',
      notarizer: 'one-person-lab-app/scripts/notarize-macos-dmg.ts',
      prepublication_qualification: 'node scripts/desktop/macos-distribution.mjs --require-release-trust',
      publication_target: 'gaofeng21cn/opl-studio GitHub Releases exact tag',
      public_readback_command: 'npm run qualify:desktop:mac:release',
    },
    gates: {
      exact_source_identity: 'passed',
      dedicated_release_namespace: 'passed',
      hardened_runtime_and_artifact_shape: 'passed',
      release_qualification_contract: 'passed',
      notarization_status_required: 'Accepted',
      stapler_validate_required: true,
      anonymous_public_byte_readback_required: true,
      any_failed_stage_blocks_later_stages: true,
    },
    secret_custody: {
      owner: 'one-person-lab-app release-stable protected environment',
      values_read_or_copied_by_admission: false,
      studio_repository_secret_copy_allowed: false,
      execution_must_verify_capabilities_before_first_external_mutation: [
        'developer_id_signing',
        'apple_notarization',
        'github_release_write_gaofeng21cn_opl-studio',
      ],
    },
    active_shell_unchanged: true,
    active_release_carrier: false,
    release_ready: false,
    public_mutation_authorized: false,
    external_mutation_attempted: false,
    remaining_protected_action: {
      authority: 'release-stable environment reviewer plus explicit user approval',
      exact_source_required: {
        repository: 'gaofeng21cn/opl-studio',
        commit_sha: input.studio.commitSha,
        tree_sha: input.studio.treeSha,
        tag: input.requestedTag,
      },
      required_sequence: stageOrder.slice(1),
      admission_receipt_is_publication_authority: false,
    },
  };
}

function gitIdentity(root: string): GitIdentity {
  const read = (revision: string) => {
    const result = spawnSync('git', ['rev-parse', revision], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    if (result.status !== 0) {
      throw new Error(`Unable to read Git identity under ${root}: ${result.stderr.trim()}`);
    }
    return result.stdout.trim();
  };
  return { commitSha: read('HEAD'), treeSha: read('HEAD^{tree}') };
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

function runCli(argv: string[]): void {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      'app-root': { type: 'string' },
      'studio-root': { type: 'string' },
      'studio-sha': { type: 'string' },
      'studio-tree': { type: 'string' },
      'studio-tag': { type: 'string' },
      output: { type: 'string' },
    },
  });
  invariant(positionals.length === 1 && positionals[0] === 'plan', 'Usage: studio-protected-release-admission.ts plan <options>');
  for (const option of ['app-root', 'studio-root', 'studio-sha', 'studio-tree', 'studio-tag', 'output'] as const) {
    invariant(values[option], `Missing required option: --${option}`);
  }

  const appRoot = path.resolve(values['app-root']!);
  const studioRoot = path.resolve(values['studio-root']!);
  const app = gitIdentity(appRoot);
  const studio = gitIdentity(studioRoot);
  invariant(studio.commitSha === values['studio-sha'], 'Studio commit does not match protected request.');
  invariant(studio.treeSha === values['studio-tree'], 'Studio tree does not match protected request.');

  const receipt = buildStudioProtectedReleaseAdmission({
    app,
    studio,
    requestedTag: values['studio-tag']!,
    studioPackage: readJson(path.join(studioRoot, 'package.json')) as StudioPackage,
    studioBuilder: parseYaml(fs.readFileSync(path.join(studioRoot, 'electron-builder.yml'), 'utf8')) as StudioBuilder,
  });
  writeJsonAtomic(path.resolve(values.output!), receipt);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
