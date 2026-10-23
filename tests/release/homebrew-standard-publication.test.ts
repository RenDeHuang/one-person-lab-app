import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAppComponentManifest } from '../../scripts/write-opl-app-component-manifest.ts';
import { resolveReleaseVersionIdentity } from '../../scripts/release-version.ts';
import { resolveHomebrewStandardPublication } from '../../scripts/resolve-homebrew-standard-publication.ts';
import { resolveHomebrewFullPublication } from '../../scripts/resolve-homebrew-full-publication.ts';

const digest = (s: string | Buffer) => `sha256:${crypto.createHash('sha256').update(s).digest('hex')}`;
function fixture() {
  const version = '26.9.25-r1', tag = `v${version}`, source = 'a'.repeat(40);
  const updaterVersion = resolveReleaseVersionIdentity('stable', version).updaterVersion;
  const assets = ['latest-mac.yml', 'latest-arm64-mac.yml', `One-Person-Lab-${version}-mac-arm64.dmg`, `One-Person-Lab-${version}-mac-arm64.zip`, `One-Person-Lab-${version}-mac-arm64.zip.blockmap`, 'opl-install.sh'].map(name => ({ name, size: 100, digest: digest(name), url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/${tag}/${name}` }));
  const manifest: any = createAppComponentManifest({ version, updaterVersion, sourceCommit: source, shellCommit: 'b'.repeat(40), frameworkCommit: 'c'.repeat(40), tag, releaseUrl: `https://github.com/gaofeng21cn/one-person-lab-app/releases/tag/${tag}`, repo: 'gaofeng21cn/one-person-lab-app', assets });
  const bytes = Buffer.from(JSON.stringify(manifest));
  const release = { id: 42, tag_name: tag, target_commitish: source, draft: false, prerelease: false, immutable: false,
    assets: [...assets, { name: 'opl-app-component-manifest.json', size: bytes.length, digest: digest(bytes) }] };
  const handoff = { schema: 'opl_homebrew_standard_follower_handoff.v1', status: 'ready', release: { id: 42, tag, target_commitish: source, version, updater_version: updaterVersion }, standard_dmg: { sha256: manifest.primary_artifact.digest, size_bytes: 100 }, component_manifest: { sha256: digest(bytes), size_bytes: bytes.length } };
  return { manifest, bytes, release, handoff };
}
function seal(f: ReturnType<typeof fixture>) {
  delete f.manifest.component_manifest_digest;
  f.manifest.component_manifest_digest = digest(JSON.stringify(f.manifest));
  f.bytes = Buffer.from(JSON.stringify(f.manifest));
  Object.assign(f.release.assets.at(-1)!, { digest: digest(f.bytes), size: f.bytes.length });
}
test('Standard follower accepts original public bytes and qualified newer same-tag bytes', () => {
  const f = fixture();
  assert.equal(resolveHomebrewStandardPublication(f.handoff, f.release, f.bytes).updater_version, f.handoff.release.updater_version);
  f.manifest.same_tag_replacement = { schema: 'opl_app_same_tag_replacement.v1', tag_source_commit: f.release.target_commitish,
    previous_updater_version: f.manifest.updater_version, previous_manifest_digest: f.manifest.component_manifest_digest,
    qualification_receipt_sha256: digest('qualification'), build_run_id: '20', qualification_run_id: '21' };
  const parts = f.manifest.updater_version.split('.'); parts[2] = String(Number(parts[2]) + 1); f.manifest.updater_version = parts.join('.');
  f.manifest.source_commit = 'd'.repeat(40); f.manifest.source_cohort.app_sha = f.manifest.source_commit;
  f.manifest.primary_artifact.digest = digest('new signed DMG');
  f.release.assets.find(a => a.name.endsWith('.dmg'))!.digest = f.manifest.primary_artifact.digest;
  seal(f);
  assert.equal(resolveHomebrewStandardPublication(f.handoff, f.release, f.bytes).updater_version, f.manifest.updater_version);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-cask-replacement-'));
  try {
    const component = path.join(root, 'component.json');
    fs.writeFileSync(component, f.bytes);
    const base = `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/${f.release.tag_name}`;
    const args = ['scripts/update-homebrew-tap.ts', '--channel', 'stable', '--package-kind', 'app_full_first_install',
      '--version', f.manifest.version, '--updater-version', f.manifest.updater_version, '--component-manifest', component,
      '--tap-root', root, '--cask', 'Casks/one-person-lab-full.rb', '--manifest-url', `${base}/opl-release-manifest.json`,
      '--checksum-sha256', 'f'.repeat(64), '--download-url', `${base}/One-Person-Lab-Full-${f.manifest.version}-mac-arm64.dmg`];
    const run = () => spawnSync(process.execPath, args, { encoding: 'utf8' });
    const full = run();
    assert.equal(full.status, 0, full.stderr);
    assert.equal(JSON.parse(full.stdout).updater_version, f.manifest.updater_version);
    args[args.indexOf('--updater-version') + 1] = f.handoff.release.updater_version;
    assert.notEqual(run().status, 0, 'Full must use the qualified replacement machine version');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  f.release.target_commitish = 'e'.repeat(40);
  assert.throws(() => resolveHomebrewStandardPublication(f.handoff, f.release, f.bytes), /identity changed/);
});
test('Standard follower rejects unbound public bytes, duplicate assets and unqualified replacements', () => {
  const f = fixture();
  assert.throws(() => resolveHomebrewStandardPublication(f.handoff, f.release, Buffer.from('{}')), /manifest bytes/);
  f.release.assets.push(f.release.assets[0]);
  f.release.assets.push(f.release.assets.find(a => a.name.endsWith('.dmg'))!);
  assert.throws(() => resolveHomebrewStandardPublication(f.handoff, f.release, f.bytes), /Expected one public/);
  const g = fixture(); g.manifest.primary_artifact.digest = digest('unsigned replacement');
  g.release.assets.find(a => a.name.endsWith('.dmg'))!.digest = g.manifest.primary_artifact.digest; seal(g);
  assert.throws(() => resolveHomebrewStandardPublication(g.handoff, g.release, g.bytes), /Unqualified changes/);
});

test('Full follower reads a qualified public replacement while preserving original publication provenance', () => {
  const handoff = JSON.parse(fs.readFileSync('tests/release/fixtures/homebrew-full-handoff-g32.json', 'utf8'));
  const target = handoff.release.target_standard;
  const dmg = { name: handoff.artifact.name, digest: digest('new Full DMG'), size: 200 };
  const attestation = { name: 'opl-release-attestation.json', digest: digest('new Standard attestation'), size: 100 };
  const manifest: any = { schema: 'opl_public_release_manifest.v1', package_kind: 'opl_full_first_install_macos_arm64',
    version: handoff.release.version, primary_install_asset: dmg.name,
    assets: [{ name: dmg.name, sha256: dmg.digest, size_bytes: dmg.size }],
    carrier_context: { standard_attestation: { sha256: attestation.digest, size_bytes: attestation.size },
      full_content_sources: { app_sha: 'd'.repeat(40), shell_sha: 'e'.repeat(40), framework_sha: 'f'.repeat(40) } },
    same_tag_replacement: { schema: 'opl_app_same_tag_replacement.v1', tag_source_commit: target.target_commitish,
      previous_manifest_digest: handoff.manifest.sha256, qualification_receipt_sha256: digest('Full VM'), build_run_id: '20', qualification_run_id: '21' } };
  const bytes = Buffer.from(JSON.stringify(manifest));
  const release = { id: target.release_id, tag_name: target.tag, target_commitish: target.target_commitish,
    draft: false, prerelease: false, immutable: false, assets: [dmg, attestation, { name: 'opl-release-manifest.json', digest: digest(bytes), size: bytes.length }] };
  const result = resolveHomebrewFullPublication(handoff, release, bytes);
  assert.equal(result.artifact.sha256, dmg.digest);
  assert.deepEqual(result.source, handoff.source);
  assert.equal(result.build_provenance.shell_sha, 'e'.repeat(40));
  assert.equal(result.same_tag_replacement.qualification_receipt_sha256, digest('Full VM'));
  delete manifest.same_tag_replacement;
  const unqualified = Buffer.from(JSON.stringify(manifest));
  Object.assign(release.assets[2], { digest: digest(unqualified), size: unqualified.length });
  assert.throws(() => resolveHomebrewFullPublication(handoff, release, unqualified));
});
