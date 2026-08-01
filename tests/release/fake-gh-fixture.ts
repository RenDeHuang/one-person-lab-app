import fs from 'node:fs';
import path from 'node:path';

const fakeGhSource = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const stateFile = process.env.FAKE_GH_STATE_FILE || '';
const deleted = stateFile && fs.existsSync(stateFile) && fs.readFileSync(stateFile, 'utf8').trim() === 'deleted';
const emit = (name) => {
  for (const value of JSON.parse(process.env[name] || '[]')) {
    process.stdout.write(JSON.stringify(value) + '\\n');
  }
};
if (args[0] === 'api' && args[1] === '--method' && args[2] === 'DELETE' && args[3] && args[3].includes('/releases/')) {
  fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(args) + '\\n');
  if (stateFile && process.env.FAKE_DELETE_OUTCOME !== 'unknown_unchanged') fs.writeFileSync(stateFile, 'deleted');
  if ((process.env.FAKE_DELETE_OUTCOME || '').startsWith('unknown_')) process.exit(1);
} else if (args[0] === 'api' && args[1] && /\\/releases\\/[0-9]+$/.test(args[1])) {
  if (deleted || process.env.FAKE_EXACT_RELEASE_ABSENT === 'true') process.exit(1);
  if (!process.env.FAKE_EXACT_RELEASE_JSON) process.exit(2);
  process.stdout.write(process.env.FAKE_EXACT_RELEASE_JSON + '\\n');
} else if (args[0] === 'api' && args[1] && args[1].includes('/git/matching-refs/tags/')) {
  process.stdout.write((process.env.FAKE_MATCHING_TAG_REFS_JSON || '[]') + '\\n');
} else if (args[0] === 'release' && args[1] === 'view') {
  if (!process.env.FAKE_STABLE_RELEASE_JSON) process.exit(1);
  process.stdout.write(process.env.FAKE_STABLE_RELEASE_JSON + '\\n');
} else if (args[0] === 'api' && args.some((arg) => arg.includes('/packages/container/')) && args.includes('--jq')) {
  emit('FAKE_PACKAGE_VERSIONS_JSON');
} else if (args[0] === 'api' && args.includes('-X') && args.includes('DELETE')) {
  fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(args) + '\\n');
} else if (args[0] === 'api') {
  emit('FAKE_RELEASES_JSON');
} else if (args[0] === 'release' && args[1] === 'delete') {
  fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(args) + '\\n');
} else {
  console.error('unexpected gh args: ' + JSON.stringify(args));
  process.exit(2);
}
`;

export function writeFakeGh(tempRoot: string) {
  const binDir = path.join(tempRoot, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const ghPath = path.join(binDir, 'gh');
  fs.writeFileSync(ghPath, fakeGhSource);
  fs.chmodSync(ghPath, 0o755);
  return binDir;
}

export function fakeGhEnv(binDir: string, logPath: string, values: NodeJS.ProcessEnv) {
  return {
    PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    FAKE_GH_LOG: logPath,
    ...values,
  };
}
