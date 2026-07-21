#!/usr/bin/env node

type Asset = { name: string; size: number; digest: string };

export function planFullAddonUpload(
  localAssets: Array<{ path: string; name: string; size: number; sha256: string }>,
  remoteAssets: Asset[],
) {
  const remote = new Map(remoteAssets.map((asset) => [asset.name, asset]));
  return localAssets.map((asset) => {
    const existing = remote.get(asset.name);
    if (!existing) return { ...asset, action: 'upload' as const };
    const remoteDigest = String(existing.digest || '').replace(/^sha256:/, '').toLowerCase();
    if (existing.size !== asset.size || remoteDigest !== asset.sha256) {
      throw new Error(`Published Full add-on asset ${asset.name} already exists with different bytes; create a new version.`);
    }
    return { ...asset, action: 'reuse' as const };
  });
}

function main() {
  process.stdout.write(`${JSON.stringify({
    schema: 'opl_app_retired_full_addon_publisher.v1',
    status: 'retired_fail_closed',
    lifecycle: 'asset_policy_helper_only',
    authoritative_for_new_release: false,
    mutation_authorized: false,
    replacement: 'scripts/framework-release-adapter.ts github-apply',
  }, null, 2)}\n`);
  process.exitCode = 2;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
