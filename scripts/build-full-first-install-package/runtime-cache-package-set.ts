import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { readGitHead } from './git.ts';
import { existingFileSha256 } from './hashing.ts';

export const FULL_RUNTIME_PACKAGE_IDS = [
  'mas',
  'mag',
  'rca',
  'oma',
  'obf',
  'mas-scholar-skills',
  'opl-flow',
] as const;

type FullRuntimePackageId = typeof FULL_RUNTIME_PACKAGE_IDS[number];
type JsonRecord = Record<string, any>;

const shaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const catalogRef = 'contracts/opl-framework/bundled-full-runtime-package-catalog.json';

function digestJson(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function safeCatalogRef(value: unknown, label: string): string {
  const ref = requireString(value, label);
  const normalized = path.posix.normalize(ref).replace(/^\.\//, '');
  if (
    normalized !== ref ||
    !normalized.startsWith('packages/') ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`${label} must stay under the Framework packages catalog root`);
  }
  return normalized;
}

function safeRuntimeModulePath(value: unknown, label: string): string {
  const relativePath = requireString(value, label);
  const normalized = path.posix.normalize(relativePath).replace(/^\.\//, '');
  if (
    normalized !== relativePath ||
    !normalized.startsWith('modules/') ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`${label} must stay under the Full runtime modules root`);
  }
  return normalized;
}

export function validateFrameworkPackageSetInput(packageSet: JsonRecord): void {
  if (!packageSet || typeof packageSet !== 'object' || Array.isArray(packageSet)) {
    throw new Error('Framework package set must be an object');
  }
  if (packageSet.schema !== 'opl_full_runtime_framework_package_set.v1') {
    throw new Error('Framework package set schema is unsupported');
  }
  if (!shaPattern.test(String(packageSet.framework_sha ?? ''))) {
    throw new Error('Framework package set framework SHA must be exact');
  }
  if (packageSet.catalog_ref !== catalogRef) {
    throw new Error('Framework package set catalog ref is not canonical');
  }
  if (!digestPattern.test(String(packageSet.catalog_sha256 ?? ''))) {
    throw new Error('Framework package set catalog digest must be exact');
  }
  const packages = Array.isArray(packageSet.packages) ? packageSet.packages as JsonRecord[] : [];
  const packageIds = packages.map((entry) => entry.package_id);
  if (JSON.stringify(packageIds) !== JSON.stringify(FULL_RUNTIME_PACKAGE_IDS)) {
    throw new Error('Framework package set must contain the canonical ordered Full package set');
  }
  const referencedFiles = new Set<string>();
  for (const entry of packages) {
    const packageId = entry.package_id as FullRuntimePackageId;
    requireString(entry.package_role, `${packageId} package_role`);
    requireString(entry.package_version, `${packageId} package_version`);
    if (!shaPattern.test(String(entry.owner_source_commit ?? ''))) {
      throw new Error(`Framework package ${packageId} owner source commit must be exact`);
    }
    safeRuntimeModulePath(entry.runtime_module_relative_path, `${packageId} runtime_module_relative_path`);
    for (const [refField, digestField] of [
      ['manifest_ref', 'manifest_sha256'],
      ['payload_manifest_ref', 'payload_manifest_sha256'],
    ] as const) {
      const ref = safeCatalogRef(entry[refField], `${packageId} ${refField}`);
      if (referencedFiles.has(ref)) {
        throw new Error(`Framework package set contains duplicated catalog ref: ${ref}`);
      }
      referencedFiles.add(ref);
      if (!digestPattern.test(String(entry[digestField] ?? ''))) {
        throw new Error(`Framework package ${packageId} ${digestField} must be exact`);
      }
    }
  }
  if (!digestPattern.test(String(packageSet.identity ?? ''))) {
    throw new Error('Framework package set identity must be exact');
  }
  const { identity, ...payload } = packageSet;
  if (digestJson(payload) !== identity) {
    throw new Error('Framework package set identity does not match its payload');
  }
}

export function buildFrameworkPackageSetInput(input: {
  frameworkSha: string;
  catalogSha256: string;
  catalog: JsonRecord;
  sourceCommits: Record<FullRuntimePackageId, string>;
  referencedFileSha256: Record<string, string>;
}) {
  if (!shaPattern.test(input.frameworkSha)) {
    throw new Error('Framework package set framework SHA must be exact');
  }
  if (!/^[0-9a-f]{64}$/.test(input.catalogSha256)) {
    throw new Error('Framework package catalog SHA-256 must be exact');
  }
  if (input.catalog.surface_kind !== 'opl_bundled_full_runtime_package_catalog.v1') {
    throw new Error('Framework package catalog surface_kind is unsupported');
  }
  const packages = input.catalog.packages as JsonRecord | undefined;
  if (!packages || JSON.stringify(Object.keys(packages).sort()) !== JSON.stringify([...FULL_RUNTIME_PACKAGE_IDS].sort())) {
    throw new Error('Framework package catalog must contain the exact canonical Full package set');
  }

  const packageBindings = FULL_RUNTIME_PACKAGE_IDS.map((packageId) => {
    const entry = packages[packageId] as JsonRecord | undefined;
    if (!entry || entry.package_id !== packageId) {
      throw new Error(`Framework package catalog entry ${packageId} is missing or misidentified`);
    }
    const ownerSourceCommit = requireString(entry.owner_source_commit, `${packageId} owner_source_commit`);
    if (!shaPattern.test(ownerSourceCommit) || input.sourceCommits[packageId] !== ownerSourceCommit) {
      throw new Error(`Framework package ${packageId} owner source does not match the frozen checkout`);
    }
    const manifestRef = safeCatalogRef(entry.manifest_ref, `${packageId} manifest_ref`);
    const payloadManifestRef = safeCatalogRef(entry.payload_manifest_ref, `${packageId} payload_manifest_ref`);
    const manifestSha256 = requireString(entry.manifest_sha256, `${packageId} manifest_sha256`);
    const payloadManifestSha256 = requireString(
      entry.payload_manifest_sha256,
      `${packageId} payload_manifest_sha256`,
    );
    if (
      !digestPattern.test(manifestSha256) ||
      !digestPattern.test(payloadManifestSha256) ||
      input.referencedFileSha256[manifestRef] !== manifestSha256 ||
      input.referencedFileSha256[payloadManifestRef] !== payloadManifestSha256
    ) {
      throw new Error(`Framework package ${packageId} manifest or payload digest does not match catalog bytes`);
    }
    return {
      package_id: packageId,
      package_role: requireString(entry.package_role, `${packageId} package_role`),
      package_version: requireString(entry.package_version, `${packageId} package_version`),
      owner_source_commit: ownerSourceCommit,
      runtime_module_relative_path: safeRuntimeModulePath(
        entry.runtime_module_relative_path,
        `${packageId} runtime_module_relative_path`,
      ),
      manifest_ref: manifestRef,
      manifest_sha256: manifestSha256,
      payload_manifest_ref: payloadManifestRef,
      payload_manifest_sha256: payloadManifestSha256,
    };
  });
  const payload = {
    schema: 'opl_full_runtime_framework_package_set.v1',
    framework_sha: input.frameworkSha,
    catalog_ref: catalogRef,
    catalog_sha256: `sha256:${input.catalogSha256}`,
    packages: packageBindings,
  };
  const result = {
    ...payload,
    identity: digestJson(payload),
  };
  validateFrameworkPackageSetInput(result);
  return result;
}

function frameworkCatalogFile(frameworkRoot: string, relativeRef: string): string {
  const catalogRoot = path.resolve(frameworkRoot, 'contracts', 'opl-framework');
  const normalized = safeCatalogRef(relativeRef, 'Framework package catalog ref');
  const resolved = path.resolve(catalogRoot, ...normalized.split('/'));
  if (
    !resolved.startsWith(`${catalogRoot}${path.sep}`) ||
    !fs.existsSync(resolved) ||
    !fs.statSync(resolved).isFile()
  ) {
    throw new Error(`Framework package catalog file is missing or unsafe: ${relativeRef}`);
  }
  return resolved;
}

export function resolveFrameworkPackageSetInput(options: JsonRecord) {
  const catalogPath = path.join(options.frameworkRoot, ...catalogRef.split('/'));
  if (!fs.existsSync(catalogPath) || !fs.statSync(catalogPath).isFile()) {
    throw new Error(`Framework bundled Full package catalog is missing: ${catalogPath}`);
  }
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as JsonRecord;
  const packages = catalog.packages as JsonRecord | undefined;
  const referencedFileSha256: Record<string, string> = {};
  for (const packageId of FULL_RUNTIME_PACKAGE_IDS) {
    const entry = packages?.[packageId] as JsonRecord | undefined;
    for (const field of ['manifest_ref', 'payload_manifest_ref']) {
      const relativeRef = safeCatalogRef(entry?.[field], `${packageId} ${field}`);
      const digest = existingFileSha256(frameworkCatalogFile(options.frameworkRoot, relativeRef));
      if (!digest) throw new Error(`Framework package catalog file digest is unavailable: ${relativeRef}`);
      referencedFileSha256[relativeRef] = `sha256:${digest}`;
    }
  }
  const sourceRoots: Record<FullRuntimePackageId, string> = {
    mas: options.masRoot,
    mag: options.magRoot,
    rca: options.rcaRoot,
    oma: options.metaAgentRoot,
    obf: options.bookforgeRoot,
    'mas-scholar-skills': options.masScholarSkillsRoot,
    'opl-flow': options.oplFlowRoot,
  };
  const catalogSha256 = existingFileSha256(catalogPath);
  if (!catalogSha256) throw new Error(`Framework package catalog digest is unavailable: ${catalogPath}`);
  return buildFrameworkPackageSetInput({
    frameworkSha: readGitHead(options.frameworkRoot),
    catalogSha256,
    catalog,
    sourceCommits: Object.fromEntries(
      FULL_RUNTIME_PACKAGE_IDS.map((packageId) => [packageId, readGitHead(sourceRoots[packageId])]),
    ) as Record<FullRuntimePackageId, string>,
    referencedFileSha256,
  });
}
