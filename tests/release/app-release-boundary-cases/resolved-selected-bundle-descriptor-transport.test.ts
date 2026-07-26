import {
  assert,
  fs,
  os,
  path,
  test,
  writeFile,
} from './helpers.ts';
import { pathToFileURL } from 'node:url';

import {
  assertMaterializedResolvedSelectedBundleDescriptor,
  materializeResolvedSelectedBundleDescriptor,
  resolvedSelectedBundleCacheInput,
  validateResolvedSelectedBundleDescriptor,
} from '../../../scripts/build-full-first-install-package/resolved-selected-bundle-descriptor.ts';

const producerModulePath = process.env.OPL_FRAMEWORK_DESCRIPTOR_MODULE;

function writeJson(filePath, value) {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeProducerPackage(root, packageId, skillRoot = 'skills/custom-skill') {
  writeJson(path.join(root, 'owner.json'), { package_id: packageId });
  writeJson(path.join(root, '.codex-plugin', 'plugin.json'), {
    name: `${packageId}-plugin`,
    skills: skillRoot ? [skillRoot] : [],
  });
  if (skillRoot) {
    writeFile(path.join(root, skillRoot, 'SKILL.md'), `# ${packageId}\n`);
    writeFile(path.join(root, skillRoot, 'references', 'nested.md'), `${packageId} nested resource\n`);
    const executable = path.join(root, skillRoot, 'bin', 'run.sh');
    writeFile(executable, '#!/bin/sh\necho selected\n');
    fs.chmodSync(executable, 0o755);
  }
  return {
    packageId,
    carrierRoot: root,
    ownerManifestPath: 'owner.json',
    pluginManifestPath: '.codex-plugin/plugin.json',
  };
}

test(
  'Framework resolved Bundle descriptor reaches the App materializer without App package inference',
  { skip: !producerModulePath },
  async (t) => {
    const { resolveSelectedBundleDescriptor } = await import(pathToFileURL(path.resolve(producerModulePath)).href);
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-w3-descriptor-transport-'));
    t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

    const selectedZeroSkill = writeProducerPackage(path.join(tempRoot, 'selected-zero'), 'custom-zero', '');
    const selectedSkill = writeProducerPackage(path.join(tempRoot, 'selected-skill'), 'custom-skill');
    const unselected = writeProducerPackage(path.join(tempRoot, 'unselected-fixed-app'), 'fixed-app-package');
    const descriptor = resolveSelectedBundleDescriptor([selectedZeroSkill, selectedSkill]);

    assert.deepEqual(descriptor.package_ids, ['custom-zero', 'custom-skill']);
    assert.equal(descriptor.packages[0].skill_roots.length, 0);
    assert.equal(descriptor.packages.some((entry) => entry.package_id === unselected.packageId), false);
    assert.doesNotThrow(() => validateResolvedSelectedBundleDescriptor(descriptor));

    const cacheInput = resolvedSelectedBundleCacheInput(descriptor);
    assert.equal(cacheInput.digest, descriptor.digest);
    assert.deepEqual(cacheInput.package_ids, descriptor.package_ids);
    assert.equal(cacheInput.packages[1].skill_roots[0].digest, descriptor.packages[1].skill_roots[0].digest);

    const runtimeRoot = path.join(tempRoot, 'runtime');
    writeFile(path.join(runtimeRoot, 'skills', 'app-compatibility-seed', 'SKILL.md'), '# App seed\n');
    const materialized = materializeResolvedSelectedBundleDescriptor(runtimeRoot, descriptor);
    assert.equal(materialized.assertion.digest, descriptor.digest);
    assert.equal(materialized.assertion.owner_declared_skill_count, 1);
    assert.equal(
      fs.readFileSync(path.join(runtimeRoot, 'skills', 'custom-skill', 'references', 'nested.md'), 'utf8'),
      'custom-skill nested resource\n',
    );
    assert.equal(
      fs.statSync(path.join(runtimeRoot, 'skills', 'custom-skill', 'bin', 'run.sh')).mode & 0o111,
      0o111,
    );
    assert.equal(fs.existsSync(path.join(runtimeRoot, 'skills', 'fixed-app-package')), false);
    assert.equal(
      fs.readFileSync(path.join(runtimeRoot, 'selected-package-descriptors', 'packages', '0001', 'owner.json'), 'utf8'),
      fs.readFileSync(path.join(selectedSkill.carrierRoot, 'owner.json'), 'utf8'),
    );
    assert.equal(
      assertMaterializedResolvedSelectedBundleDescriptor(runtimeRoot, descriptor).assertion.status,
      'verified',
    );

    const escaped = structuredClone(descriptor);
    escaped.packages[1].owner_manifest.relative_path = '../owner.json';
    assert.throws(
      () => validateResolvedSelectedBundleDescriptor(escaped),
      /carrier-relative path/,
    );

    const duplicate = writeProducerPackage(path.join(tempRoot, 'duplicate-skill'), 'duplicate-skill');
    assert.throws(
      () => resolveSelectedBundleDescriptor([selectedSkill, duplicate]),
      /materialization targets must be unique/,
    );

    const missing = writeProducerPackage(path.join(tempRoot, 'missing-skill'), 'missing-skill');
    const missingDescriptor = resolveSelectedBundleDescriptor([missing]);
    fs.rmSync(path.join(missing.carrierRoot, 'skills', 'custom-skill', 'references', 'nested.md'));
    assert.throws(
      () => materializeResolvedSelectedBundleDescriptor(path.join(tempRoot, 'missing-runtime'), missingDescriptor),
      /source is missing or escaped/,
    );

    const drifted = writeProducerPackage(path.join(tempRoot, 'drifted-skill'), 'drifted-skill');
    const driftedDescriptor = resolveSelectedBundleDescriptor([drifted]);
    const driftedExecutable = path.join(drifted.carrierRoot, 'skills', 'custom-skill', 'bin', 'run.sh');
    writeFile(driftedExecutable, '#!/bin/sh\necho changed\n');
    fs.chmodSync(driftedExecutable, 0o644);
    assert.throws(
      () => materializeResolvedSelectedBundleDescriptor(path.join(tempRoot, 'drifted-runtime'), driftedDescriptor),
      /source bytes or mode drifted/,
    );

    fs.rmSync(selectedZeroSkill.carrierRoot, { recursive: true, force: true });
    fs.rmSync(selectedSkill.carrierRoot, { recursive: true, force: true });
    assert.equal(
      assertMaterializedResolvedSelectedBundleDescriptor(runtimeRoot, descriptor).assertion.status,
      'verified',
    );

    writeFile(path.join(runtimeRoot, 'skills', 'custom-skill', 'references', 'nested.md'), 'runtime drift\n');
    assert.throws(
      () => assertMaterializedResolvedSelectedBundleDescriptor(runtimeRoot, descriptor),
      /materialized bytes or mode drifted/,
    );
  },
);
