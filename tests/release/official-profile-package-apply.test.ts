import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { applyOfficialProfilePackages } from '../../scripts/official-profile-package-apply.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function status(installed: boolean, dependencyReasons: string[] = []) {
  return {
    version: 'g2',
    opl_agent_package_status: {
      installed_package_count: installed ? 1 : 0,
      package_dependency_readiness: {
        dependencies: dependencyReasons.length === 0 ? [] : [{
          package_id: 'required-capability',
          required: true,
          status: dependencyReasons.includes('dependency_lock_missing') ? 'missing' : 'incompatible',
          reasons: dependencyReasons,
        }],
      },
    },
  };
}

test('Official Profile apply mutates only missing roots or missing required closure and continues after a root failure', () => {
  const calls: string[][] = [];
  const statusQueues = new Map<string, any[]>([
    ['mas', [status(false), status(true)]],
    ['mag', [status(true)]],
    ['rca', [status(true, ['dependency_lock_missing']), status(true)]],
    ['oma', []],
    ['obf', [status(true)]],
  ]);
  const result = applyOfficialProfilePackages({
    intent: 'first_install',
    rootPackageIds: ['mas', 'mag', 'rca', 'oma', 'obf'],
    runtime: {
      execute(args) {
        calls.push(args);
        const packageId = args[args.indexOf('--package-id') + 1] ?? args[2];
        if (args[1] === 'status') {
          if (packageId === 'oma') return { status: 1, stdout: '', stderr: 'status unavailable' };
          return { status: 0, stdout: JSON.stringify(statusQueues.get(packageId)?.shift()), stderr: '' };
        }
        return { status: 0, stdout: JSON.stringify({ version: 'g2', result: { status: 'completed' } }), stderr: '' };
      },
    },
  });

  assert.equal(result.official_profile_package_apply.status, 'partial_failure');
  assert.deepEqual(result.official_profile_package_apply.items.map((item) => [item.package_id, item.status]), [
    ['mas', 'installed'],
    ['mag', 'already_present'],
    ['rca', 'reconciled'],
    ['oma', 'failed'],
    ['obf', 'already_present'],
  ]);
  assert.equal(calls.some((args) => args.join(' ') === 'packages install mas --json'), true);
  assert.equal(calls.some((args) => args.join(' ') === 'packages update rca --json'), true);
  assert.equal(calls.some((args) => args.includes('mag') && ['install', 'update'].includes(args[1])), false);
  assert.equal(calls.some((args) => args.includes('obf')), true, 'later roots continue after an earlier failure');
});

test('user removal survives restart, daily maintenance, and App update until explicit restore', () => {
  let installed = false;
  const calls: string[][] = [];
  const runtime = {
    execute(args: string[]) {
      calls.push(args);
      if (args[1] === 'status') {
        return { status: 0, stdout: JSON.stringify(status(installed)), stderr: '' };
      }
      if (args[1] === 'install') {
        installed = true;
        return { status: 0, stdout: JSON.stringify({ version: 'g2', result: { status: 'completed' } }), stderr: '' };
      }
      return { status: 1, stdout: '', stderr: `unexpected Package command: ${args.join(' ')}` };
    },
  };

  for (const intent of ['app_restart', 'daily_maintenance', 'app_update']) {
    assert.throws(() => applyOfficialProfilePackages({
      intent: intent as any,
      rootPackageIds: ['mas'],
      runtime,
    }), /first_install or explicit_restore/);
    assert.equal(installed, false, `${intent} must preserve the user's removal`);
    assert.equal(calls.length, 0, `${intent} must not execute a Package command`);
  }

  const result = applyOfficialProfilePackages({
    intent: 'explicit_restore',
    rootPackageIds: ['mas'],
    runtime,
  });
  assert.equal(installed, true);
  assert.deepEqual(calls.map((args) => args.slice(0, 2)), [
    ['packages', 'status'],
    ['packages', 'install'],
    ['packages', 'status'],
  ]);
  assert.equal(result.official_profile_package_apply.status, 'completed');
  assert.equal(result.official_profile_package_apply.intent, 'explicit_restore');
  assert.deepEqual(result.official_profile_package_apply.persistence, {
    desired_state_saved: false,
    startup_maintenance_registered: false,
    automatic_reapply_allowed: false,
  });
});

test('CLI accepts explicit root identities and performs read-only skips for present roots', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-official-profile-apply-'));
  const fakeOpl = path.join(root, 'opl');
  const logPath = path.join(root, 'calls.jsonl');
  fs.writeFileSync(fakeOpl, `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.OPL_FAKE_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
process.stdout.write(JSON.stringify({version:'g2',opl_agent_package_status:{installed_package_count:1,package_dependency_readiness:{dependencies:[]}}}));
`, { mode: 0o755 });
  try {
    const run = spawnSync(process.execPath, [
      '--experimental-strip-types',
      'scripts/official-profile-package-apply.ts',
      '--intent',
      'explicit_restore',
      '--root-package-id',
      'mas',
      '--root-package-id',
      'oma',
      '--opl-bin',
      fakeOpl,
    ], {
      cwd: appRoot,
      encoding: 'utf8',
      env: { ...process.env, OPL_FAKE_LOG: logPath },
    });
    assert.equal(run.status, 0, run.stderr);
    const output = JSON.parse(run.stdout);
    assert.equal(output.official_profile_package_apply.status, 'completed');
    assert.equal(output.official_profile_package_apply.persistence.desired_state_saved, false);
    assert.equal(output.official_profile_package_apply.persistence.startup_maintenance_registered, false);
    assert.equal(output.official_profile_package_apply.persistence.automatic_reapply_allowed, false);
    const calls = fs.readFileSync(logPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(output.official_profile_package_apply.root_package_ids, ['mas', 'oma']);
    assert.equal(calls.length, 2);
    assert.equal(calls.every((args) => args[0] === 'packages' && args[1] === 'status'), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
