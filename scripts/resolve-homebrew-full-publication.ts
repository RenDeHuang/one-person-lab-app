import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const digest = (bytes: Buffer) => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;

export function resolveHomebrewFullPublication(handoff: any, release: any, bytes: Buffer) {
  const target = handoff.release.target_standard;
  assert.equal(release.id, target.release_id);
  assert.equal(release.tag_name, target.tag);
  assert.equal(release.target_commitish, target.target_commitish);
  assert.equal(release.draft, false);
  assert.equal(release.prerelease, false);
  assert.equal(release.immutable, false);
  const asset = (name: string) => {
    const matches = release.assets.filter((item: any) => item.name === name);
    assert.equal(matches.length, 1);
    return matches[0];
  };
  const manifestAsset = asset('opl-release-manifest.json');
  assert.equal(manifestAsset.digest, digest(bytes));
  assert.equal(manifestAsset.size, bytes.length);
  const manifest = JSON.parse(bytes.toString('utf8'));
  const dmg = asset(handoff.artifact.name);
  if (manifestAsset.digest === handoff.manifest.sha256 && dmg.digest === handoff.artifact.sha256) return handoff;
  const replacement = manifest.same_tag_replacement;
  assert.equal(manifest.schema, 'opl_public_release_manifest.v1');
  assert.equal(manifest.package_kind, 'opl_full_first_install_macos_arm64');
  assert.equal(manifest.version, handoff.release.version);
  assert.equal(manifest.primary_install_asset, dmg.name);
  assert.equal(replacement?.schema, 'opl_app_same_tag_replacement.v1');
  assert.equal(replacement.tag_source_commit, target.target_commitish);
  assert.equal(replacement.previous_manifest_digest, handoff.manifest.sha256);
  assert.match(replacement.qualification_receipt_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.match(replacement.build_run_id, /^[1-9]\d*$/);
  assert.match(replacement.qualification_run_id, /^[1-9]\d*$/);
  const payload = manifest.assets.find((item: any) => item.name === dmg.name);
  assert.equal(payload.sha256, dmg.digest);
  assert.equal(payload.size_bytes, dmg.size);
  const attestation = asset('opl-release-attestation.json');
  assert.equal(manifest.carrier_context.standard_attestation.sha256, attestation.digest);
  assert.equal(manifest.carrier_context.standard_attestation.size_bytes, attestation.size);
  const sources = manifest.carrier_context.full_content_sources;
  for (const key of ['app_sha', 'shell_sha', 'framework_sha']) assert.match(sources[key], /^[0-9a-f]{40}$/);
  // The original append_full handoff remains publication provenance. The public
  // replacement carries the qualification for the effective Full bytes.
  return { ...handoff, same_tag_replacement: replacement,
    build_provenance: { ...handoff.build_provenance, app_sha: sources.app_sha, shell_sha: sources.shell_sha, framework_sha: sources.framework_sha },
    artifact: { ...handoff.artifact, sha256: dmg.digest, size_bytes: dmg.size },
    manifest: { ...handoff.manifest, sha256: manifestAsset.digest, size_bytes: manifestAsset.size },
    release: { ...handoff.release, standard_attestation: { ...handoff.release.standard_attestation, sha256: attestation.digest, size_bytes: attestation.size } } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  const result = resolveHomebrewFullPublication(JSON.parse(fs.readFileSync(file, 'utf8')),
    JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), fs.readFileSync(process.argv[4]));
  fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
}
