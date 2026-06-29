import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const installerPath = path.join(appRoot, 'scripts', 'install-docker-webui.sh');

function runInstaller(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync('bash', [installerPath, ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('Docker/WebUI installer shell parses cleanly', () => {
  const result = spawnSync('bash', ['-n', installerPath], {
    cwd: appRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('Docker/WebUI installer dry-run generates the compose-only startup plan', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-installer-home-'));
  const result = runInstaller(
    [
      '--dry-run',
      '--port',
      '3917',
      '--tag',
      '26.6.30',
      '--data-dir',
      path.join(home, 'data-dir'),
      '--projects-dir',
      path.join(home, 'projects-dir'),
      '--no-open',
    ],
    { HOME: home },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /image: ghcr\.io\/gaofeng21cn\/one-person-lab-webui:26\.6\.30/);
  assert.match(result.stdout, /"127\.0\.0\.1:3917:3000"/);
  assert.match(result.stdout, /AIONUI_ALLOW_REMOTE: "true"/);
  assert.match(result.stdout, /AIONUI_DATA_DIR: \/data/);
  assert.match(result.stdout, /OPL_PROJECTS_DIR: \/projects/);
  assert.match(result.stdout, new RegExp(`${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/data-dir:/data`));
  assert.match(result.stdout, new RegExp(`${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/projects-dir:/projects`));
  assert.match(result.stdout, /docker compose -f .*compose\.yaml up -d/);
  assert.doesNotMatch(result.stdout, /docker run/);
  assert.doesNotMatch(result.stdout, /OPENAI_API_KEY|ANTHROPIC_API_KEY|api_key/i);
  assert.equal(fs.existsSync(path.join(home, 'OnePersonLab')), false, 'dry-run must not create host directories');
});

test('Docker/WebUI installer rejects API key parameters', () => {
  const result = runInstaller(['--dry-run', '--api-key', 'secret']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Do not pass API keys/);

  const providerKeyResult = runInstaller(['--dry-run', '--anthropic-api-key=secret']);
  assert.notEqual(providerKeyResult.status, 0);
  assert.match(providerKeyResult.stderr, /Do not pass API keys/);
});

test('Docker/WebUI installer keeps OS-specific Docker policy explicit', () => {
  const script = fs.readFileSync(installerPath, 'utf8');

  assert.match(script, /Automatic Docker Engine installation is supported only on Ubuntu/);
  assert.match(script, /download\.docker\.com\/linux\/ubuntu/);
  assert.match(script, /ca-certificates curl gnupg/);
  assert.match(script, /docker-ce docker-ce-cli containerd\.io docker-buildx-plugin docker-compose-plugin/);
  assert.match(script, /Docker is installed but the daemon is not reachable/);
  assert.match(script, /On macOS, would only check Docker availability/);
  assert.doesNotMatch(script, /brew install|curl .*Docker\.dmg|hdiutil .*Docker|orbctl|colima start/i);
});
