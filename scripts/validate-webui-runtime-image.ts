#!/usr/bin/env node

import fs from 'node:fs';
import { parseArgs as parseNodeArgs } from 'node:util';
import { asRecord, readJsonFile } from './release-json-helpers.ts';

type Args = {
  imageInspectPath: string;
  imageManifestPath: string;
  seedMetadataPath: string;
  expectedProfile: 'webui-full' | 'webui-slim';
  summaryPath?: string;
};

function parseArgs(): Args {
  const { values } = parseNodeArgs({
    args: process.argv.slice(2),
    options: {
      'image-inspect': { type: 'string' },
      'image-manifest': { type: 'string' },
      'seed-metadata': { type: 'string' },
      'expected-profile': { type: 'string' },
      'summary-path': { type: 'string' },
    } as const,
    allowPositionals: false,
    strict: true,
  });
  const expectedProfile = values['expected-profile'] ?? 'webui-full';
  if (expectedProfile !== 'webui-full' && expectedProfile !== 'webui-slim') {
    throw new Error(`Unsupported WebUI image profile: ${expectedProfile}`);
  }
  const args: Args = {
    imageInspectPath: values['image-inspect'] ?? '',
    imageManifestPath: values['image-manifest'] ?? '',
    seedMetadataPath: values['seed-metadata'] ?? '',
    expectedProfile,
    summaryPath: values['summary-path'],
  };
  for (const [field, value] of Object.entries({
    imageInspectPath: args.imageInspectPath,
    imageManifestPath: args.imageManifestPath,
    seedMetadataPath: args.seedMetadataPath,
  })) {
    if (!value) {
      throw new Error(`Missing required option for ${field}`);
    }
  }
  return args;
}

function envMap(rawEnv: unknown) {
  if (!Array.isArray(rawEnv)) {
    throw new Error('Docker image inspect Config.Env must be an array.');
  }
  return new Map(
    rawEnv.map((entry) => {
      if (typeof entry !== 'string' || !entry.includes('=')) {
        throw new Error(`Invalid Docker env entry: ${String(entry)}`);
      }
      const separator = entry.indexOf('=');
      return [entry.slice(0, separator), entry.slice(separator + 1)] as const;
    }),
  );
}

function requireEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label} must be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function requireStringArrayIncludes(value: unknown, expected: string[], label: string) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${label} must be a string array.`);
  }
  for (const item of expected) {
    if (!value.includes(item)) {
      throw new Error(`${label} must include ${item}`);
    }
  }
}

function requiredComponentIds(seedMetadata: Record<string, unknown>) {
  const components = seedMetadata.components;
  if (!Array.isArray(components)) {
    throw new Error('WebUI full seed metadata must include components[].');
  }
  return components.map((component) => {
    const record = asRecord(component, 'seed metadata component');
    if (typeof record.id !== 'string' || !record.id) {
      throw new Error('Each seed metadata component must include id.');
    }
    for (const field of ['version', 'source', 'payload_path', 'receipt_kind']) {
      if (typeof record[field] !== 'string' || !record[field]) {
        throw new Error(`Seed metadata component ${record.id} must include ${field}.`);
      }
    }
    if (typeof record.sha256 !== 'string' && typeof record.source_fingerprint !== 'string') {
      throw new Error(`Seed metadata component ${record.id} must include sha256 or source_fingerprint.`);
    }
    if (record.sha256 !== undefined && typeof record.sha256 !== 'string') {
      throw new Error(`Seed metadata component ${record.id} sha256 must be a string when present.`);
    }
    if (record.size_bytes !== undefined && (typeof record.size_bytes !== 'number' || record.size_bytes <= 0)) {
      throw new Error(`Seed metadata component ${record.id} size_bytes must be a positive number when present.`);
    }
    return record.id;
  });
}

const args = parseArgs();
const imageInspect = readJsonFile<unknown>(args.imageInspectPath);
const image = Array.isArray(imageInspect) ? asRecord(imageInspect[0], 'Docker image inspect[0]') : asRecord(imageInspect, 'Docker image inspect');
const config = asRecord(image.Config, 'Docker image inspect Config');
const labels = asRecord(config.Labels, 'Docker image inspect labels');
const env = envMap(config.Env);
const volumes = asRecord(config.Volumes, 'Docker image inspect volumes');
const imageManifest = asRecord(readJsonFile(args.imageManifestPath), 'WebUI image manifest');
const seedMetadata = asRecord(readJsonFile(args.seedMetadataPath), 'WebUI image seed metadata');

requireEqual(labels['org.opencontainers.image.source'], 'https://github.com/gaofeng21cn/one-person-lab-app', 'OCI source label');
if (typeof labels['org.opencontainers.image.revision'] !== 'string' || !labels['org.opencontainers.image.revision']) {
  throw new Error('OCI revision label must be present.');
}
for (const volume of ['/data', '/projects']) {
  if (!(volume in volumes)) {
    throw new Error(`Docker image must declare VOLUME ${volume}.`);
  }
}
for (const [key, expected] of Object.entries({
  HOME: '/data',
  AIONUI_DATA_DIR: '/data',
  OPL_DATA_DIR: '/data',
  OPL_PROJECTS_DIR: '/projects',
  OPL_WORKSPACE_ROOT: '/projects',
})) {
  requireEqual(env.get(key), expected, `Docker env ${key}`);
}
for (const key of ['OPL_IMAGE_MANIFEST_PATH', 'OPL_IMAGE_SEED_DIR']) {
  if (!env.get(key)) {
    throw new Error(`Docker env ${key} must be present.`);
  }
}
const pathEnv = env.get('PATH') ?? '';
if (args.expectedProfile === 'webui-full') {
  for (const requiredPath of ['/opt/opl/seed/payload/opl_framework/bin', '/opt/opl/seed/payload/codex_cli/bin']) {
    if (!pathEnv.split(':').includes(requiredPath)) {
      throw new Error(`webui-full Docker PATH must include ${requiredPath}.`);
    }
  }
}

requireEqual(imageManifest.schema, 'dev.onepersonlab.opl-webui-image-manifest.v1', 'image manifest schema');
requireEqual(imageManifest.image_role, 'opl_webui_runtime_image', 'image manifest image_role');
requireEqual(imageManifest.data_dir, '/data', 'image manifest data_dir');
requireEqual(imageManifest.projects_dir, '/projects', 'image manifest projects_dir');
requireEqual(imageManifest.seed_dir, '/opt/opl/seed', 'image manifest seed_dir');
requireEqual(imageManifest.seed_metadata, '/opt/opl/seed/metadata.json', 'image manifest seed_metadata');
if (typeof imageManifest.base_image_family !== 'string' || /alpine/i.test(imageManifest.base_image_family)) {
  throw new Error('Docker/WebUI runtime image must use a glibc LTS/slim base, not Alpine.');
}
const webuiPackage = asRecord(imageManifest.webui_package, 'image manifest webui_package');
if (webuiPackage.name !== '@aionui/web-cli' || typeof webuiPackage.version !== 'string') {
  throw new Error('Image manifest must identify the bundled @aionui/web-cli package.');
}
const bundledAioncore = asRecord(imageManifest.bundled_aioncore, 'image manifest bundled_aioncore');
requireStringArrayIncludes(bundledAioncore.platforms, ['linux-x64'], 'bundled AionCore platforms');

requireEqual(seedMetadata.schema, 'dev.onepersonlab.opl-webui-image-seed.v1', 'seed metadata schema');
requireEqual(seedMetadata.data_dir, '/data', 'seed metadata data_dir');
requireEqual(seedMetadata.projects_dir, '/projects', 'seed metadata projects_dir');

const seedStrategy = String(imageManifest.seed_strategy ?? seedMetadata.strategy ?? '');
if (args.expectedProfile === 'webui-full') {
  if (seedStrategy === 'metadata_only') {
    throw new Error('webui-full image must not use metadata_only seed strategy.');
  }
  if (!['payload_manifest', 'payload_preheated'].includes(seedStrategy)) {
    throw new Error(`webui-full image must use payload_manifest or payload_preheated seed strategy, got ${seedStrategy}`);
  }
  const componentIds = requiredComponentIds(seedMetadata);
  for (const id of ['opl_framework', 'codex_cli', 'companion_skills', 'domain_modules']) {
    if (!componentIds.includes(id)) {
      throw new Error(`webui-full seed metadata must include component ${id}`);
    }
  }
} else if (seedStrategy !== 'metadata_only') {
  throw new Error(`webui-slim image must use metadata_only seed strategy, got ${seedStrategy}`);
}

const summary = {
  status: 'passed',
  expected_profile: args.expectedProfile,
  image_id: image.Id,
  created: image.Created,
  oci_revision: labels['org.opencontainers.image.revision'],
  manifest_path: env.get('OPL_IMAGE_MANIFEST_PATH'),
  seed_dir: env.get('OPL_IMAGE_SEED_DIR'),
  seed_strategy: seedStrategy,
  volumes: Object.keys(volumes),
};
if (args.summaryPath) {
  fs.writeFileSync(args.summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
}
console.log(JSON.stringify(summary));
