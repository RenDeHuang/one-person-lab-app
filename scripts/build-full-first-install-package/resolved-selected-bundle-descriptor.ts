import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type DescriptorMode = '100644' | '100755';

type DescriptorFile = {
  relative_path: string;
  sha256: string;
  mode: DescriptorMode;
};

type DescriptorSkillRoot = {
  relative_path: string;
  entry_paths: string[];
  resources: DescriptorFile[];
  digest: string;
};

type DescriptorPackage = {
  package_id: string;
  carrier_root: string;
  owner_manifest: DescriptorFile;
  plugin_manifest: DescriptorFile & { plugin_id: string | null };
  skill_roots: DescriptorSkillRoot[];
  digest: string;
};

export type ResolvedSelectedBundleDescriptor = {
  descriptor_kind: 'internal_resolved_selected_bundle';
  package_ids: string[];
  packages: DescriptorPackage[];
  digest: string;
};

const RECEIPT_RELATIVE_PATH = 'selected-package-descriptors/resolved-selected-bundle-descriptor.json';
const digestPattern = /^sha256:[0-9a-f]{64}$/;

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Full runtime ${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: string[], label: string) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`Full runtime ${label} fields are unsupported: ${actual.join(', ')}.`);
  }
}

function stringValue(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Full runtime ${label} must be a non-empty string.`);
  }
  return value;
}

function digestValue(value: unknown, label: string) {
  const digest = stringValue(value, label);
  if (!digestPattern.test(digest)) {
    throw new Error(`Full runtime ${label} must be an exact SHA-256 digest.`);
  }
  return digest;
}

function relativePathValue(value: unknown, label: string) {
  const relativePath = stringValue(value, label);
  const normalized = path.posix.normalize(relativePath.replaceAll('\\', '/')).replace(/^\.\//, '');
  if (
    normalized === ''
    || normalized === '.'
    || normalized === '..'
    || normalized.startsWith('../')
    || path.posix.isAbsolute(normalized)
    || normalized.endsWith('/')
    || normalized !== relativePath.replaceAll('\\', '/').replace(/^\.\//, '')
  ) {
    throw new Error(`Full runtime ${label} must be a normalized carrier-relative path.`);
  }
  return normalized;
}

function stringList(value: unknown, label: string, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`Full runtime ${label} must be ${allowEmpty ? 'an' : 'a non-empty'} ordered string array.`);
  }
  const result = value.map((entry, index) => stringValue(entry, `${label}[${index}]`));
  if (new Set(result).size !== result.length) {
    throw new Error(`Full runtime ${label} must not contain duplicates.`);
  }
  return result;
}

function descriptorFile(value: unknown, label: string, pluginManifest = false): DescriptorFile & { plugin_id?: string | null } {
  const record = objectValue(value, label);
  exactKeys(
    record,
    pluginManifest ? ['relative_path', 'sha256', 'mode', 'plugin_id'] : ['relative_path', 'sha256', 'mode'],
    label,
  );
  const mode = stringValue(record.mode, `${label}.mode`);
  if (mode !== '100644' && mode !== '100755') {
    throw new Error(`Full runtime ${label}.mode must be 100644 or 100755.`);
  }
  if (
    pluginManifest
    && record.plugin_id !== null
    && (typeof record.plugin_id !== 'string' || record.plugin_id.trim() === '')
  ) {
    throw new Error(`Full runtime ${label}.plugin_id must be a non-empty string or null.`);
  }
  return {
    relative_path: relativePathValue(record.relative_path, `${label}.relative_path`),
    sha256: digestValue(record.sha256, `${label}.sha256`),
    mode,
    ...(pluginManifest ? { plugin_id: record.plugin_id as string | null } : {}),
  };
}

function isWithinRelativeRoot(root: string, candidate: string) {
  return candidate === root || candidate.startsWith(`${root}/`);
}

function descriptorSkillRoot(value: unknown, label: string): DescriptorSkillRoot {
  const record = objectValue(value, label);
  exactKeys(record, ['relative_path', 'entry_paths', 'resources', 'digest'], label);
  const relativePath = relativePathValue(record.relative_path, `${label}.relative_path`);
  const entryPaths = stringList(record.entry_paths, `${label}.entry_paths`)
    .map((entryPath, index) => relativePathValue(entryPath, `${label}.entry_paths[${index}]`));
  if (!Array.isArray(record.resources) || record.resources.length === 0) {
    throw new Error(`Full runtime ${label}.resources must be a non-empty ordered array.`);
  }
  const resources = record.resources.map((resource, index) => (
    descriptorFile(resource, `${label}.resources[${index}]`) as DescriptorFile
  ));
  const resourcePaths = resources.map((resource) => resource.relative_path);
  if (new Set(resourcePaths).size !== resourcePaths.length) {
    throw new Error(`Full runtime ${label}.resources must not contain duplicate paths.`);
  }
  if (JSON.stringify(resourcePaths) !== JSON.stringify([...resourcePaths].sort((left, right) => left.localeCompare(right, 'en')))) {
    throw new Error(`Full runtime ${label}.resources must use canonical path order.`);
  }
  if (JSON.stringify(entryPaths) !== JSON.stringify([...entryPaths].sort((left, right) => left.localeCompare(right, 'en')))) {
    throw new Error(`Full runtime ${label}.entry_paths must use canonical path order.`);
  }
  for (const resourcePath of resourcePaths) {
    if (!isWithinRelativeRoot(relativePath, resourcePath)) {
      throw new Error(`Full runtime ${label} resource escapes its owner-declared skill root: ${resourcePath}.`);
    }
  }
  for (const entryPath of entryPaths) {
    if (!entryPath.endsWith('/SKILL.md') && entryPath !== 'SKILL.md') {
      throw new Error(`Full runtime ${label} entry path must name SKILL.md: ${entryPath}.`);
    }
    if (!resourcePaths.includes(entryPath)) {
      throw new Error(`Full runtime ${label} entry path is absent from its resource closure: ${entryPath}.`);
    }
  }
  return {
    relative_path: relativePath,
    entry_paths: entryPaths,
    resources,
    digest: digestValue(record.digest, `${label}.digest`),
  };
}

function descriptorPackage(value: unknown, label: string): DescriptorPackage {
  const record = objectValue(value, label);
  exactKeys(
    record,
    ['package_id', 'carrier_root', 'owner_manifest', 'plugin_manifest', 'skill_roots', 'digest'],
    label,
  );
  const carrierRoot = stringValue(record.carrier_root, `${label}.carrier_root`);
  if (!path.isAbsolute(carrierRoot)) {
    throw new Error(`Full runtime ${label}.carrier_root must be absolute.`);
  }
  if (!Array.isArray(record.skill_roots)) {
    throw new Error(`Full runtime ${label}.skill_roots must be an ordered array.`);
  }
  const skillRoots = record.skill_roots.map((skillRoot, index) => (
    descriptorSkillRoot(skillRoot, `${label}.skill_roots[${index}]`)
  ));
  const skillRootPaths = skillRoots.map((skillRoot) => skillRoot.relative_path);
  if (new Set(skillRootPaths).size !== skillRootPaths.length) {
    throw new Error(`Full runtime ${label}.skill_roots must not contain duplicate paths.`);
  }
  const ownerManifest = descriptorFile(record.owner_manifest, `${label}.owner_manifest`) as DescriptorFile;
  const pluginManifest = descriptorFile(
    record.plugin_manifest,
    `${label}.plugin_manifest`,
    true,
  ) as DescriptorPackage['plugin_manifest'];
  const closurePaths = [
    ownerManifest.relative_path,
    pluginManifest.relative_path,
    ...skillRoots.flatMap((skillRoot) => skillRoot.resources.map((resource) => resource.relative_path)),
  ];
  if (new Set(closurePaths).size !== closurePaths.length) {
    throw new Error(`Full runtime ${label} closure must not contain duplicate target paths.`);
  }
  return {
    package_id: stringValue(record.package_id, `${label}.package_id`),
    carrier_root: carrierRoot,
    owner_manifest: ownerManifest,
    plugin_manifest: pluginManifest,
    skill_roots: skillRoots,
    digest: digestValue(record.digest, `${label}.digest`),
  };
}

export function validateResolvedSelectedBundleDescriptor(value: unknown): ResolvedSelectedBundleDescriptor {
  const descriptor = objectValue(value, 'resolved selected Bundle descriptor');
  exactKeys(descriptor, ['descriptor_kind', 'package_ids', 'packages', 'digest'], 'resolved selected Bundle descriptor');
  if (descriptor.descriptor_kind !== 'internal_resolved_selected_bundle') {
    throw new Error('Full runtime resolved selected Bundle descriptor kind is unsupported.');
  }
  const packageIds = stringList(
    descriptor.package_ids,
    'resolved selected Bundle descriptor.package_ids',
    { allowEmpty: true },
  );
  if (!Array.isArray(descriptor.packages)) {
    throw new Error('Full runtime resolved selected Bundle descriptor.packages must be an ordered array.');
  }
  const packages = descriptor.packages.map((entry, index) => (
    descriptorPackage(entry, `resolved selected Bundle descriptor.packages[${index}]`)
  ));
  if (JSON.stringify(packageIds) !== JSON.stringify(packages.map((entry) => entry.package_id))) {
    throw new Error('Full runtime resolved selected Bundle descriptor package order does not match package_ids.');
  }
  const digest = digestValue(descriptor.digest, 'resolved selected Bundle descriptor.digest');
  const expectedDigest = `sha256:${crypto.createHash('sha256')
    .update(packages.map((entry) => `${entry.package_id}\0${entry.digest}\0`).join(''))
    .digest('hex')}`;
  if (digest !== expectedDigest) {
    throw new Error('Full runtime resolved selected Bundle descriptor digest does not match its package closure.');
  }
  return {
    descriptor_kind: descriptor.descriptor_kind,
    package_ids: packageIds,
    packages,
    digest,
  };
}

function skillEntryPlans(packageEntry: DescriptorPackage) {
  return packageEntry.skill_roots.flatMap((skillRoot) => {
    const entryRoots = skillRoot.entry_paths.map((entryPath) => path.posix.dirname(entryPath));
    for (const left of entryRoots) {
      for (const right of entryRoots) {
        if (left !== right && isWithinRelativeRoot(left, right)) {
          throw new Error(
            `Full runtime selected Bundle package ${packageEntry.package_id} has overlapping skill entries ${left} and ${right}.`,
          );
        }
      }
    }
    const grouped = new Map(entryRoots.map((entryRoot) => [entryRoot, [] as DescriptorFile[]]));
    for (const resource of skillRoot.resources) {
      const owners = entryRoots.filter((entryRoot) => isWithinRelativeRoot(entryRoot, resource.relative_path));
      if (owners.length !== 1) {
        throw new Error(
          `Full runtime selected Bundle resource ${resource.relative_path} must belong to exactly one SKILL.md entry closure.`,
        );
      }
      grouped.get(owners[0])?.push(resource);
    }
    return entryRoots.map((entryRoot) => ({
      entryRoot,
      targetName: path.posix.basename(entryRoot),
      resources: grouped.get(entryRoot) ?? [],
      skillRootDigest: skillRoot.digest,
    }));
  });
}

function sha256(filePath: string) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function modeForFile(filePath: string): DescriptorMode {
  return fs.statSync(filePath).mode & 0o111 ? '100755' : '100644';
}

function modeAwareContentDigest(files: Array<{
  relativePath: string;
  sourcePath: string;
  mode: DescriptorMode;
}>) {
  const digest = crypto.createHash('sha256');
  for (const file of [...files].sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'en'))) {
    const pathBytes = Buffer.from(file.relativePath, 'utf8');
    const content = Buffer.concat([
      Buffer.from(`${file.mode}\0`, 'utf8'),
      fs.readFileSync(file.sourcePath),
    ]);
    const pathLength = Buffer.allocUnsafe(8);
    const fileLength = Buffer.allocUnsafe(8);
    pathLength.writeBigUInt64BE(BigInt(pathBytes.length));
    fileLength.writeBigUInt64BE(BigInt(content.length));
    digest.update(pathLength);
    digest.update(pathBytes);
    digest.update(fileLength);
    digest.update(content);
  }
  return `sha256:${digest.digest('hex')}`;
}

function resolveCarrierFile(packageEntry: DescriptorPackage, file: DescriptorFile) {
  const carrierRoot = path.resolve(packageEntry.carrier_root);
  if (!fs.existsSync(carrierRoot)) {
    throw new Error(`Full runtime selected Bundle carrier root is missing: ${carrierRoot}.`);
  }
  const rootStat = fs.lstatSync(carrierRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || fs.realpathSync(carrierRoot) !== carrierRoot) {
    throw new Error(`Full runtime selected Bundle carrier root must remain a real directory: ${carrierRoot}.`);
  }
  const sourcePath = path.resolve(carrierRoot, ...file.relative_path.split('/'));
  const relative = path.relative(carrierRoot, sourcePath);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(sourcePath)) {
    throw new Error(`Full runtime selected Bundle source is missing or escaped its carrier: ${file.relative_path}.`);
  }
  const sourceStat = fs.lstatSync(sourcePath);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || !fs.realpathSync(sourcePath).startsWith(`${carrierRoot}${path.sep}`)) {
    throw new Error(`Full runtime selected Bundle source must remain a regular carrier file: ${file.relative_path}.`);
  }
  if (sha256(sourcePath) !== file.sha256 || modeForFile(sourcePath) !== file.mode) {
    throw new Error(`Full runtime selected Bundle source bytes or mode drifted: ${file.relative_path}.`);
  }
  return sourcePath;
}

function assertDescriptorSourceClosure(descriptor: ResolvedSelectedBundleDescriptor) {
  for (const packageEntry of descriptor.packages) {
    const packageFiles: Array<{
      relativePath: string;
      sourcePath: string;
      mode: DescriptorMode;
    }> = [];
    for (const manifest of [packageEntry.owner_manifest, packageEntry.plugin_manifest]) {
      packageFiles.push({
        relativePath: manifest.relative_path,
        sourcePath: resolveCarrierFile(packageEntry, manifest),
        mode: manifest.mode,
      });
    }
    for (const skillRoot of packageEntry.skill_roots) {
      const skillFiles = skillRoot.resources.map((resource) => ({
        relativePath: resource.relative_path,
        sourcePath: resolveCarrierFile(packageEntry, resource),
        mode: resource.mode,
      }));
      if (modeAwareContentDigest(skillFiles) !== skillRoot.digest) {
        throw new Error(
          `Full runtime selected Bundle skill digest drifted: ${packageEntry.package_id}/${skillRoot.relative_path}.`,
        );
      }
      packageFiles.push(...skillFiles);
    }
    if (modeAwareContentDigest(packageFiles) !== packageEntry.digest) {
      throw new Error(`Full runtime selected Bundle package digest drifted: ${packageEntry.package_id}.`);
    }
  }
  return descriptor;
}

function copyDescriptorFile(sourcePath: string, targetPath: string, mode: DescriptorMode) {
  if (fs.existsSync(targetPath)) {
    throw new Error(`Full runtime selected Bundle target collides with an existing payload: ${targetPath}.`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  fs.chmodSync(targetPath, mode === '100755' ? 0o755 : 0o644);
}

function selectedBundleCacheProjection(descriptor: ResolvedSelectedBundleDescriptor) {
  return {
    descriptor_kind: descriptor.descriptor_kind,
    digest: descriptor.digest,
    package_ids: descriptor.package_ids,
    packages: descriptor.packages.map((entry) => ({
      package_id: entry.package_id,
      digest: entry.digest,
      owner_manifest_sha256: entry.owner_manifest.sha256,
      plugin_manifest_sha256: entry.plugin_manifest.sha256,
      skill_roots: entry.skill_roots.map((skillRoot) => ({
        relative_path: skillRoot.relative_path,
        entry_paths: skillRoot.entry_paths,
        digest: skillRoot.digest,
      })),
    })),
  };
}

export function resolvedSelectedBundleCacheInput(value: unknown) {
  const descriptor = assertDescriptorSourceClosure(validateResolvedSelectedBundleDescriptor(value));
  return selectedBundleCacheProjection(descriptor);
}

export function materializeResolvedSelectedBundleDescriptor(runtimeRoot: string, value: unknown) {
  const descriptor = assertDescriptorSourceClosure(validateResolvedSelectedBundleDescriptor(value));
  const descriptorRoot = path.join(runtimeRoot, 'selected-package-descriptors');
  if (fs.existsSync(descriptorRoot)) {
    throw new Error(`Full runtime selected Bundle descriptor target already exists: ${descriptorRoot}.`);
  }
  const usedSkillTargets = new Set<string>();
  fs.mkdirSync(descriptorRoot, { recursive: true });

  descriptor.packages.forEach((packageEntry, packageIndex) => {
    for (const manifest of [packageEntry.owner_manifest, packageEntry.plugin_manifest]) {
      const sourcePath = resolveCarrierFile(packageEntry, manifest);
      const targetPath = path.join(
        descriptorRoot,
        'packages',
        String(packageIndex).padStart(4, '0'),
        ...manifest.relative_path.split('/'),
      );
      copyDescriptorFile(sourcePath, targetPath, manifest.mode);
    }
    for (const skillRoot of packageEntry.skill_roots) {
      for (const resource of skillRoot.resources) {
        const sourcePath = resolveCarrierFile(packageEntry, resource);
        const targetPath = path.join(
          descriptorRoot,
          'packages',
          String(packageIndex).padStart(4, '0'),
          ...resource.relative_path.split('/'),
        );
        copyDescriptorFile(sourcePath, targetPath, resource.mode);
      }
    }
    for (const skill of skillEntryPlans(packageEntry)) {
      const targetRoot = path.join(runtimeRoot, 'skills', skill.targetName);
      if (usedSkillTargets.has(targetRoot) || fs.existsSync(targetRoot)) {
        throw new Error(`Full runtime selected Bundle skill target collides: skills/${skill.targetName}.`);
      }
      usedSkillTargets.add(targetRoot);
      for (const resource of skill.resources) {
        const sourcePath = resolveCarrierFile(packageEntry, resource);
        const relativeToEntry = path.posix.relative(skill.entryRoot, resource.relative_path);
        copyDescriptorFile(
          sourcePath,
          path.join(targetRoot, ...relativeToEntry.split('/')),
          resource.mode,
        );
      }
    }
  });

  fs.writeFileSync(
    path.join(runtimeRoot, ...RECEIPT_RELATIVE_PATH.split('/')),
    `${JSON.stringify(descriptor, null, 2)}\n`,
    'utf8',
  );
  return assertMaterializedResolvedSelectedBundleDescriptor(runtimeRoot, descriptor);
}

function assertRuntimeFile(runtimeRoot: string, relativePath: string, file: DescriptorFile) {
  const filePath = path.join(runtimeRoot, ...relativePath.split('/'));
  if (!fs.existsSync(filePath)) {
    throw new Error(`Full runtime selected Bundle materialized file is missing: ${relativePath}.`);
  }
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || sha256(filePath) !== file.sha256 || modeForFile(filePath) !== file.mode) {
    throw new Error(`Full runtime selected Bundle materialized bytes or mode drifted: ${relativePath}.`);
  }
  return {
    path: relativePath,
    exists: true,
    ...(file.mode === '100755' ? { executable: true } : {}),
  };
}

export function assertMaterializedResolvedSelectedBundleDescriptor(
  runtimeRoot: string,
  expectedValue?: unknown,
) {
  const receiptPath = path.join(runtimeRoot, ...RECEIPT_RELATIVE_PATH.split('/'));
  if (!fs.existsSync(receiptPath)) {
    throw new Error(`Full runtime selected Bundle descriptor receipt is missing: ${receiptPath}.`);
  }
  const descriptor = validateResolvedSelectedBundleDescriptor(
    JSON.parse(fs.readFileSync(receiptPath, 'utf8')),
  );
  if (expectedValue !== undefined) {
    const expected = validateResolvedSelectedBundleDescriptor(expectedValue);
    if (JSON.stringify(descriptor) !== JSON.stringify(expected)) {
      throw new Error('Full runtime selected Bundle descriptor receipt does not match the resolved producer input.');
    }
  }

  const payloads = [{ path: RECEIPT_RELATIVE_PATH, exists: true }];
  let skillCount = 0;
  descriptor.packages.forEach((packageEntry, packageIndex) => {
    for (const manifest of [packageEntry.owner_manifest, packageEntry.plugin_manifest]) {
      payloads.push(assertRuntimeFile(
        runtimeRoot,
        path.posix.join(
          'selected-package-descriptors',
          'packages',
          String(packageIndex).padStart(4, '0'),
          manifest.relative_path,
        ),
        manifest,
      ));
    }
    for (const skillRoot of packageEntry.skill_roots) {
      for (const resource of skillRoot.resources) {
        payloads.push(assertRuntimeFile(
          runtimeRoot,
          path.posix.join(
            'selected-package-descriptors',
            'packages',
            String(packageIndex).padStart(4, '0'),
            resource.relative_path,
          ),
          resource,
        ));
      }
    }
    for (const skill of skillEntryPlans(packageEntry)) {
      skillCount += 1;
      for (const resource of skill.resources) {
        payloads.push(assertRuntimeFile(
          runtimeRoot,
          path.posix.join(
            'skills',
            skill.targetName,
            path.posix.relative(skill.entryRoot, resource.relative_path),
          ),
          resource,
        ));
      }
    }
  });

  return {
    assertion: {
      status: 'verified',
      descriptor_kind: descriptor.descriptor_kind,
      digest: descriptor.digest,
      package_ids: descriptor.package_ids,
      package_count: descriptor.packages.length,
      owner_declared_skill_count: skillCount,
      packages: selectedBundleCacheProjection(descriptor).packages,
    },
    descriptor,
    payloads,
  };
}

export function readMaterializedResolvedSelectedBundleDescriptor(runtimeRoot: string) {
  const receiptPath = path.join(runtimeRoot, ...RECEIPT_RELATIVE_PATH.split('/'));
  return fs.existsSync(receiptPath)
    ? assertMaterializedResolvedSelectedBundleDescriptor(runtimeRoot)
    : null;
}
