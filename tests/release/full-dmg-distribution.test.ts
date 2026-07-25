import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  FullDmgDistributionQualificationError,
  parseFullDmgDistributionCli,
  qualifyFullDmgDistribution,
  type CommandRunner,
  writeFullDmgDistributionReceiptAtomic,
} from '../../scripts/qualify-full-dmg-distribution.ts';

function sha256(bytes: Buffer | string): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function tempRoot(t: test.TestContext): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-distribution-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

async function fixtureServer(t: test.TestContext, bytes: Buffer) {
  const server = http.createServer((request, response) => {
    if (request.url !== '/One-Person-Lab-Full-26.7.25-mac-arm64.dmg') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'application/x-apple-diskimage',
      'Content-Length': String(bytes.length),
    });
    response.end(bytes);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}/One-Person-Lab-Full-26.7.25-mac-arm64.dmg`;
}

test('CLI defaults to a read-only dry-run plan for an exact GitHub Release asset', async () => {
  const options = parseFullDmgDistributionCli([
    '--repo', 'gaofeng21cn/one-person-lab-app',
    '--tag', 'v26.7.25',
    '--asset', 'One-Person-Lab-Full-26.7.25-mac-arm64.dmg',
    '--expected-sha256', 'a'.repeat(64),
    '--expected-size', '123',
  ]);
  const result = await qualifyFullDmgDistribution(options);

  assert.equal(result.status, 'planned');
  assert.equal(result.mode, 'dry_run');
  assert.equal(result.authority, 'read_only_no_public_mutation');
  assert.deepEqual(result.public_mutations, []);
  assert.equal(
    result.source.url,
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/'
      + 'v26.7.25/One-Person-Lab-Full-26.7.25-mac-arm64.dmg',
  );
  assert.deepEqual(result.forbidden_workarounds, {
    xattr_invocation: false,
    right_click_open: false,
    system_settings_authorization: false,
  });
});

test('CLI accepts an explicit atomic receipt path', () => {
  const options = parseFullDmgDistributionCli([
    '--source-file', '/tmp/One-Person-Lab-Full-26.7.25-mac-arm64.dmg',
    '--expected-sha256', 'a'.repeat(64),
    '--expected-size', '123',
    '--output', '/tmp/full-dmg-distribution-receipt.json',
  ]);

  assert.equal(options.outputPath, '/tmp/full-dmg-distribution-receipt.json');
});

test('receipt output cannot overwrite a Full DMG artifact', async () => {
  const source = '/tmp/One-Person-Lab-Full-26.7.25-mac-arm64.dmg';
  await assert.rejects(
    qualifyFullDmgDistribution({
      sourceFile: source,
      expectedSha256: 'a'.repeat(64),
      expectedSize: 123,
      outputPath: source,
    }),
    /must identify a \.json receipt file|must not overwrite a Full DMG artifact/,
  );
});

test('receipt writer atomically emits private exact JSON', (t) => {
  const output = path.join(tempRoot(t), 'nested', 'receipt.json');
  const receipt = {
    schema: 'opl_full_dmg_distribution_qualification.v1',
    status: 'passed',
    public_mutations: [],
  };

  writeFullDmgDistributionReceiptAtomic(output, receipt);

  assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), receipt);
  assert.equal(fs.statSync(output).mode & 0o777, 0o600);
  assert.equal(
    fs.readdirSync(path.dirname(output)).some((name) => name.includes('.tmp-')),
    false,
  );
});

test('loopback HTTP fixture proves exact downloaded bytes, size, and cleanup', async (t) => {
  const bytes = Buffer.from('exact full dmg fixture bytes\n');
  const assetUrl = await fixtureServer(t, bytes);
  const workDir = tempRoot(t);

  const result = await qualifyFullDmgDistribution({
    execute: true,
    assetUrl,
    expectedSha256: sha256(bytes),
    expectedSize: bytes.length,
    workDir,
  });

  assert.equal(result.status, 'passed');
  assert.deepEqual(result.downloaded_identity, {
    sha256: sha256(bytes),
    size_bytes: bytes.length,
  });
  assert.deepEqual(result.public_mutations, []);
  assert.equal(result.work_root.retained, false);
  assert.equal(fs.existsSync(result.work_root.path), false);
});

test('HTTP exact-byte readback fails closed on SHA mismatch', async (t) => {
  const bytes = Buffer.from('unexpected remote bytes\n');
  const assetUrl = await fixtureServer(t, bytes);

  await assert.rejects(
    qualifyFullDmgDistribution({
      execute: true,
      assetUrl,
      expectedSha256: '0'.repeat(64),
      expectedSize: bytes.length,
      workDir: tempRoot(t),
    }),
    /Downloaded Full DMG SHA-256 mismatch/,
  );
});

test('HTTP exact-byte readback fails closed on size mismatch', async (t) => {
  const bytes = Buffer.from('remote bytes with unexpected size\n');
  const assetUrl = await fixtureServer(t, bytes);

  await assert.rejects(
    qualifyFullDmgDistribution({
      execute: true,
      assetUrl,
      expectedSha256: sha256(bytes),
      expectedSize: bytes.length + 1,
      workDir: tempRoot(t),
    }),
    /Downloaded Full DMG size mismatch/,
  );
});

test('install qualification preserves quarantine and uses no bypass commands', {
  skip: process.platform !== 'darwin',
}, async (t) => {
  const root = tempRoot(t);
  const source = path.join(root, 'One-Person-Lab-Full-26.7.25-mac-arm64.dmg');
  const bytes = Buffer.from('fake dmg bytes for command-boundary fixture\n');
  fs.writeFileSync(source, bytes);
  let launched = false;
  const commandNames: string[] = [];

  const runner: CommandRunner = (command, args) => {
    const name = path.basename(command);
    commandNames.push(name);
    if (name === 'ditto') {
      const sourcePath = args.at(-2)!;
      const destinationPath = args.at(-1)!;
      if (fs.statSync(sourcePath).isDirectory()) {
        fs.cpSync(sourcePath, destinationPath, { recursive: true });
      } else {
        fs.copyFileSync(sourcePath, destinationPath);
      }
    }
    if (name === 'hdiutil' && args[0] === 'attach') {
      const mountPoint = args[args.indexOf('-mountpoint') + 1];
      fs.mkdirSync(path.join(mountPoint, 'One Person Lab.app'), { recursive: true });
    }
    if (name === 'ls') {
      return {
        status: 0,
        stdout: `${args.at(-1)}\n\tcom.apple.quarantine\t57\n`,
        stderr: '',
      };
    }
    if (name === 'open') launched = true;
    return { status: 0, stdout: '', stderr: '' };
  };

  const result = await qualifyFullDmgDistribution({
    execute: true,
    qualifyInstall: true,
    sourceFile: source,
    expectedSha256: sha256(bytes),
    expectedSize: bytes.length,
    healthFile: path.join(root, 'health.txt'),
    workDir: root,
  }, {
    runner,
    healthProbe: async () => launched,
    now: () => '2026-07-25T00:00:00.000Z',
  });

  assert.equal(result.status, 'passed');
  assert.deepEqual(result.quarantine, {
    install_source_dmg: true,
    mounted_app: true,
    installed_app: true,
  });
  assert.equal(result.installation.first_launch, 'passed');
  assert.equal(result.installation.health_readback, 'passed');
  assert.equal(result.cleanup.status, 'completed');
  assert.equal(result.cleanup.app_quit_requested, true);
  assert.equal(result.cleanup.mount_detached, true);
  assert.equal(result.cleanup.installed_app_removed, true);
  assert.ok(commandNames.includes('hdiutil'));
  assert.ok(commandNames.includes('ditto'));
  assert.ok(commandNames.includes('xcrun'));
  assert.ok(commandNames.includes('codesign'));
  assert.ok(commandNames.includes('spctl'));
  assert.ok(commandNames.includes('open'));
  assert.equal(commandNames.includes('xattr'), false);
  assert.equal(
    result.command_trace.some(({ command, args }) => (
      /xattr/.test(path.basename(command))
      || args.some((arg) => /right.?click|systempreferences|Privacy_Security/i.test(arg))
    )),
    false,
  );
  assert.deepEqual(result.public_mutations, []);
  assert.equal(fs.existsSync(result.work_root.path), false);
});

test('install qualification fails before mount when quarantine is absent', {
  skip: process.platform !== 'darwin',
}, async (t) => {
  const root = tempRoot(t);
  const source = path.join(root, 'One-Person-Lab-Full-26.7.25-mac-arm64.dmg');
  const bytes = Buffer.from('unquarantined fake dmg\n');
  fs.writeFileSync(source, bytes);
  const commands: string[] = [];
  const runner: CommandRunner = (command, args) => {
    const name = path.basename(command);
    commands.push(name);
    if (name === 'ditto') {
      fs.copyFileSync(args.at(-2)!, args.at(-1)!);
    }
    if (name === 'ls') {
      return { status: 0, stdout: `${args.at(-1)}\n`, stderr: '' };
    }
    return { status: 0, stdout: '', stderr: '' };
  };

  let failure: FullDmgDistributionQualificationError | null = null;
  try {
    await qualifyFullDmgDistribution({
      execute: true,
      qualifyInstall: true,
      sourceFile: source,
      expectedSha256: sha256(bytes),
      expectedSize: bytes.length,
      healthFile: path.join(root, 'health.txt'),
      workDir: root,
    }, { runner });
  } catch (error) {
    assert.ok(error instanceof FullDmgDistributionQualificationError);
    failure = error;
  }
  assert.ok(failure);
  assert.match(failure.message, /missing com\.apple\.quarantine/);
  assert.equal(failure.receipt.status, 'failed');
  assert.deepEqual(failure.receipt.public_mutations, []);
  assert.equal(failure.receipt.cleanup.status, 'completed');
  assert.equal(failure.receipt.cleanup.mount_detached, false);
  assert.equal(failure.receipt.cleanup.installed_app_removed, false);
  assert.equal(fs.existsSync(failure.receipt.work_root.path), false);
  assert.equal(commands.includes('hdiutil'), false);
  assert.equal(commands.includes('xattr'), false);
});

test('install qualification preserves the primary failure and failed cleanup receipt', {
  skip: process.platform !== 'darwin',
}, async (t) => {
  const root = tempRoot(t);
  const source = path.join(root, 'One-Person-Lab-Full-26.7.25-mac-arm64.dmg');
  const bytes = Buffer.from('cleanup failure fixture\n');
  fs.writeFileSync(source, bytes);

  const runner: CommandRunner = (command, args) => {
    const name = path.basename(command);
    if (name === 'ditto') {
      fs.copyFileSync(args.at(-2)!, args.at(-1)!);
    }
    if (name === 'ls') {
      return {
        status: 0,
        stdout: `${args.at(-1)}\n\tcom.apple.quarantine\t57\n`,
        stderr: '',
      };
    }
    if (name === 'hdiutil' && args[0] === 'attach') {
      const mountPoint = args[args.indexOf('-mountpoint') + 1];
      fs.mkdirSync(path.join(mountPoint, 'One Person Lab.app'), { recursive: true });
    }
    if (name === 'hdiutil' && args[0] === 'detach') {
      return { status: 1, stdout: '', stderr: 'detach fixture failure' };
    }
    if (name === 'spctl' && args.includes('execute')) {
      return { status: 3, stdout: '', stderr: 'unnotarized fixture' };
    }
    return { status: 0, stdout: '', stderr: '' };
  };

  let failure: FullDmgDistributionQualificationError | null = null;
  try {
    await qualifyFullDmgDistribution({
      execute: true,
      qualifyInstall: true,
      sourceFile: source,
      expectedSha256: sha256(bytes),
      expectedSize: bytes.length,
      healthFile: path.join(root, 'health.txt'),
      workDir: root,
    }, { runner });
  } catch (error) {
    assert.ok(error instanceof FullDmgDistributionQualificationError);
    failure = error;
  }

  assert.ok(failure);
  assert.match(failure.message, /spctl.*execute/);
  assert.match(failure.message, /Qualification cleanup failed/);
  assert.equal(failure.receipt.cleanup.status, 'failed');
  assert.match(failure.receipt.cleanup.errors.join('\n'), /detach fixture failure/);
  assert.equal(failure.receipt.cleanup.mount_detached, false);
  assert.deepEqual(failure.receipt.public_mutations, []);
});

test('install qualification refuses the real system Applications directory', async () => {
  await assert.rejects(
    qualifyFullDmgDistribution({
      qualifyInstall: true,
      sourceFile: '/tmp/One-Person-Lab-Full-26.7.25-mac-arm64.dmg',
      expectedSha256: 'a'.repeat(64),
      expectedSize: 1,
      healthFile: '/tmp/opl-full-health.txt',
      applicationsDir: '/Applications',
    }),
    /must be an isolated directory named Applications/,
  );
});
