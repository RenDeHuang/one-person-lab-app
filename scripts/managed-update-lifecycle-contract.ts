import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readManagedUpdateLifecycleProviderMap(releaseChannelPath = path.join(appRoot, 'contracts', 'app-release-channel.json')): Record<string, string> {
  const releaseChannel = JSON.parse(fs.readFileSync(releaseChannelPath, 'utf8')) as Record<string, any>;
  const lifecycle = releaseChannel.managed_update_plane?.software_lifecycle;
  const objects = lifecycle?.objects;
  if (!objects || typeof objects !== 'object' || Array.isArray(objects)) {
    throw new Error('App release channel is missing managed update software lifecycle objects.');
  }
  const publicKeys = lifecycle.public_component_keys;
  if (!Array.isArray(publicKeys) || publicKeys.length === 0) {
    throw new Error('App release channel is missing managed update public component keys.');
  }
  return Object.fromEntries(
    publicKeys.map((componentId) => {
      const providerId = objects[componentId]?.provider_id;
      if (typeof componentId !== 'string' || typeof providerId !== 'string' || providerId.trim() === '') {
        throw new Error(`App release channel is missing provider_id for managed update component ${String(componentId)}.`);
      }
      return [componentId, providerId];
    }),
  );
}
