import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  qualifyFullDmgCode,
  type CommandRunner,
  type FullDmgCodeQualificationOptions,
} from '../../scripts/qualify-full-dmg-code.ts';

const teamIdentifier = 'SVVC4TA784';
const authority = `Developer ID Application: FENG GAO (${teamIdentifier})`;
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const officeCliRelativePath = 'One Person Lab.app/Contents/Resources/runtime/current/bin/officecli';
const officeCliVersion = '1.0.139';
const officeCliRefreshStderr = 'officecli: refreshed 8 skill file(s) after upgrade (/mounted/runtime)';

function entitlementsWithAllowJit(allowJit: boolean): string {
  return [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    `<plist version="1.0"><dict><key>com.apple.security.cs.allow-jit</key><${allowJit ? 'true' : 'false'}/></dict></plist>`,
  ].join('\n');
}

const entitlements = entitlementsWithAllowJit(true);

function sha256(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function writeMachO(filePath: string, magic = 'cffaedfe'): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.concat([Buffer.from(magic, 'hex'), Buffer.from('fixture')]));
  fs.chmodSync(filePath, 0o755);
}

function populateMountedFullDmg(mountPoint: string): void {
  const app = path.join(mountPoint, 'One Person Lab.app');
  writeMachO(path.join(app, 'Contents', 'MacOS', 'One Person Lab'));
  writeMachO(path.join(app, 'Contents', 'Frameworks', 'Helper.app', 'Contents', 'MacOS', 'Helper'));
  writeMachO(path.join(app, 'Contents', 'Frameworks', 'libnative.dylib'), 'cafebabe');
  writeMachO(path.join(mountPoint, ...officeCliRelativePath.split('/')));
  fs.writeFileSync(path.join(app, 'Contents', 'Frameworks', 'run.sh'), '#!/bin/sh\nexit 0\n');
  fs.chmodSync(path.join(app, 'Contents', 'Frameworks', 'run.sh'), 0o755);
}

function fixtureOptions(root: string): FullDmgCodeQualificationOptions {
  const dmgPath = path.join(root, 'One-Person-Lab-Full.dmg');
  const bytes = Buffer.from('exact final Full DMG fixture bytes\n');
  fs.writeFileSync(dmgPath, bytes);
  return {
    dmgPath,
    outputPath: path.join(root, 'qualification.json'),
    expectedDmgSha256: sha256(bytes),
    expectedDmgSizeBytes: bytes.length,
    expectedTeamIdentifier: teamIdentifier,
    expectedAuthority: authority,
    expectedMachoCount: 4,
    expectedExecutableBundleCount: 2,
    officeCliRelativePath,
    expectedOfficeCliVersion: officeCliVersion,
    generatedAt: '2026-07-25T00:00:00.000Z',
  };
}

type FixtureOverride = {
  team?: string;
  authority?: string;
  timestamp?: string;
  flags?: string;
  strictStatus?: number;
  allowJit?: boolean;
  requirementTeams?: string[];
  versionOutput?: string;
  versionStderr?: string;
  versionStatus?: number;
};

function runner(
  metadataForPath: (filePath: string) => FixtureOverride = () => ({}),
): CommandRunner {
  return (command, args, commandOptions) => {
    if (command === 'hdiutil' && args[0] === 'attach') {
      const mountPoint = args[args.indexOf('-mountpoint') + 1]!;
      populateMountedFullDmg(mountPoint);
      return { status: 0, stdout: 'attached\n', stderr: '' };
    }
    if (command === 'hdiutil' && args[0] === 'detach') {
      fs.rmSync(args[1]!, { recursive: true, force: true });
      fs.mkdirSync(args[1]!, { recursive: true });
      return { status: 0, stdout: 'detached\n', stderr: '' };
    }
    if (command === '/usr/bin/plutil') {
      const value = commandOptions.input?.includes('<true/>') ? 'true' : 'false';
      return { status: 0, stdout: `${value}\n`, stderr: '' };
    }
    if (command.endsWith('/officecli') && args.length === 1 && args[0] === '--version') {
      const override = metadataForPath(command);
      return {
        status: override.versionStatus ?? 0,
        stdout: `${override.versionOutput ?? officeCliVersion}\n`,
        stderr: `${override.versionStderr ?? officeCliRefreshStderr}\n`,
      };
    }
    if (command !== 'codesign') {
      return { status: 1, stdout: '', stderr: `unexpected command ${command}` };
    }
    const filePath = args.at(-1)!;
    const override = metadataForPath(filePath);
    if (args.includes('--verify')) {
      return {
        status: override.strictStatus ?? 0,
        stdout: '',
        stderr: 'valid on disk\nsatisfies its Designated Requirement\n',
      };
    }
    if (args.includes('--requirements')) {
      const teams = override.requirementTeams ?? [teamIdentifier];
      const clauses = teams.map((team) => `certificate leaf[subject.OU] = ${team}`).join(' and ');
      return {
        status: 0,
        stdout: '',
        stderr: `Executable=${filePath}\ndesignated => identifier "com.iOfficeAI.officecli" and ${clauses}\n`,
      };
    }
    if (args.includes('--entitlements')) {
      const xml = filePath.endsWith('One Person Lab.app')
        ? entitlements
        : filePath.endsWith('/officecli')
          ? entitlementsWithAllowJit(override.allowJit ?? true)
          : '';
      return { status: 0, stdout: xml, stderr: '' };
    }
    return {
      status: 0,
      stdout: '',
      stderr: [
        `Executable=${filePath}`,
        `Identifier=com.onepersonlab.${path.basename(filePath).replaceAll(' ', '-').toLowerCase()}`,
        'Format=Mach-O thin (arm64)',
        'CodeDirectory v=20500 size=123 flags=' + (override.flags ?? '0x10000(runtime)') + ' hashes=1+7 location=embedded',
        `Authority=${override.authority ?? authority}`,
        'Authority=Developer ID Certification Authority',
        'Authority=Apple Root CA',
        `Timestamp=${override.timestamp ?? 'Jul 25, 2026 at 08:00:00'}`,
        `TeamIdentifier=${override.team ?? teamIdentifier}`,
      ].join('\n'),
    };
  };
}

test('qualifies and cross-binds every executable bundle and Mach-O in a final Full DMG', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-code-pass-'));
  try {
    const options = fixtureOptions(root);
    const receipt = qualifyFullDmgCode(options, runner(), 'darwin');

    assert.equal(receipt.status, 'passed', receipt.errors.join('\n'));
    assert.equal(receipt.artifact.sha256, options.expectedDmgSha256);
    assert.equal(receipt.artifact.size_bytes, options.expectedDmgSizeBytes);
    assert.equal(receipt.expectations.team_identifier, teamIdentifier);
    assert.equal(receipt.inventory.top_level_app_count, 1);
    assert.equal(receipt.inventory.macho_count, 4);
    assert.equal(receipt.inventory.executable_bundle_count, 2);
    assert.equal(receipt.inventory.nested_executable_bundle_count, 1);
    assert.equal(receipt.inventory.unique_code_object_count, 6);
    assert.match(receipt.inventory.sha256!, /^[0-9a-f]{64}$/);
    assert.deepEqual(receipt.code_objects.map((entry) => entry.relative_path), [
      'One Person Lab.app',
      'One Person Lab.app/Contents/Frameworks/Helper.app',
      'One Person Lab.app/Contents/Frameworks/Helper.app/Contents/MacOS/Helper',
      'One Person Lab.app/Contents/Frameworks/libnative.dylib',
      'One Person Lab.app/Contents/MacOS/One Person Lab',
      officeCliRelativePath,
    ]);
    assert.ok(receipt.code_objects.every((entry) => entry.verification.strict === 'passed'));
    assert.ok(receipt.code_objects.every((entry) => entry.verification.hardened_runtime));
    assert.ok(receipt.code_objects.every((entry) => entry.verification.team_identifier === teamIdentifier));
    assert.equal(receipt.code_objects[0]!.verification.aggregate_deep, true);
    assert.equal(receipt.code_objects[0]!.verification.entitlements.readback, 'present');
    assert.equal(receipt.code_objects[1]!.verification.entitlements.readback, 'absent');
    assert.equal(receipt.officecli?.relative_path, officeCliRelativePath);
    assert.equal(receipt.officecli?.macho, true);
    assert.equal(receipt.officecli?.code_signature, 'passed');
    assert.equal(receipt.officecli?.allow_jit, true);
    assert.deepEqual(receipt.officecli?.designated_requirement_team_identifiers, [teamIdentifier]);
    assert.equal(receipt.officecli?.version.status, 'passed');
    assert.equal(receipt.officecli?.version.stdout, officeCliVersion);
    assert.equal(receipt.officecli?.version.stderr, officeCliRefreshStderr);
    assert.equal(receipt.officecli?.version.stderr_truncated, false);
    assert.equal(receipt.officecli?.version.warning, 'nonempty_stderr');

    const persisted = JSON.parse(fs.readFileSync(options.outputPath, 'utf8'));
    assert.deepEqual(persisted, receipt);
    assert.equal(fs.statSync(options.outputPath).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fails closed when any nested Mach-O has the wrong TeamIdentifier', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-code-team-'));
  try {
    const options = fixtureOptions(root);
    const receipt = qualifyFullDmgCode(
      options,
      runner((filePath) => filePath.endsWith('/Helper') ? { team: 'WRONGTEAM1' } : {}),
      'darwin',
    );

    assert.equal(receipt.status, 'failed');
    assert.match(receipt.errors.join('\n'), /Helper: TeamIdentifier mismatch/);
    assert.equal(JSON.parse(fs.readFileSync(options.outputPath, 'utf8')).status, 'failed');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fails before mounting when final DMG bytes do not match the admitted digest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-code-digest-'));
  try {
    const options = fixtureOptions(root);
    options.expectedDmgSha256 = 'a'.repeat(64);
    let calls = 0;
    const noMountRunner: CommandRunner = () => {
      calls += 1;
      return { status: 1, stdout: '', stderr: 'must not run' };
    };
    const receipt = qualifyFullDmgCode(options, noMountRunner, 'darwin');

    assert.equal(receipt.status, 'failed');
    assert.match(receipt.errors.join('\n'), /DMG SHA-256 mismatch/);
    assert.equal(calls, 0);
    assert.equal(receipt.inventory.unique_code_object_count, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fails when the DMG path bytes change before final readback', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-code-race-'));
  try {
    const options = fixtureOptions(root);
    const baseRunner = runner();
    const mutatingRunner: CommandRunner = (command, args, commandOptions) => {
      const result = baseRunner(command, args, commandOptions);
      if (command === 'hdiutil' && args[0] === 'detach') {
        fs.appendFileSync(options.dmgPath, 'mutated\n');
      }
      return result;
    };
    const receipt = qualifyFullDmgCode(options, mutatingRunner, 'darwin');

    assert.equal(receipt.status, 'failed');
    assert.match(receipt.errors.join('\n'), /DMG bytes changed during qualification/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fails closed on missing timestamp or hardened runtime and records absent entitlements', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-code-runtime-'));
  try {
    const options = fixtureOptions(root);
    const receipt = qualifyFullDmgCode(
      options,
      runner((filePath) => filePath.endsWith('libnative.dylib')
        ? { timestamp: 'none', flags: '0x0(none)' }
        : {}),
      'darwin',
    );

    assert.equal(receipt.status, 'failed');
    assert.match(receipt.errors.join('\n'), /libnative\.dylib: trusted timestamp is missing/);
    assert.match(receipt.errors.join('\n'), /libnative\.dylib: hardened runtime flag is missing/);
    const dylib = receipt.code_objects.find((entry) => entry.relative_path.endsWith('libnative.dylib'));
    assert.equal(dylib?.verification.entitlements.readback, 'absent');
    assert.equal(dylib?.verification.entitlements.sha256, sha256(Buffer.alloc(0)));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('canonical OfficeCLI mounted-byte invariant rejects unsafe or unpaired expectations before mount', async (t) => {
  for (const scenario of [
    {
      name: 'unpaired version',
      mutate: (options: FullDmgCodeQualificationOptions) => {
        options.expectedOfficeCliVersion = undefined;
      },
      error: /requires both officeCliRelativePath and expectedOfficeCliVersion/,
    },
    {
      name: 'traversal path',
      mutate: (options: FullDmgCodeQualificationOptions) => {
        options.officeCliRelativePath = '../officecli';
      },
      error: /must be an exact normalized mounted-root relative path/,
    },
  ]) {
    await t.test(scenario.name, () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-code-officecli-input-'));
      try {
        const options = fixtureOptions(root);
        scenario.mutate(options);
        let calls = 0;
        const receipt = qualifyFullDmgCode(options, () => {
          calls += 1;
          return { status: 1, stdout: '', stderr: 'must not run' };
        }, 'darwin');
        assert.equal(receipt.status, 'failed');
        assert.match(receipt.errors.join('\n'), scenario.error);
        assert.equal(calls, 0);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

test('canonical OfficeCLI mounted-byte invariant fails closed on every trust or version mismatch', async (t) => {
  const scenarios: Array<{
    name: string;
    mutateOptions?: (options: FullDmgCodeQualificationOptions) => void;
    override?: (filePath: string) => FixtureOverride;
    error: RegExp;
  }> = [
    {
      name: 'not Mach-O',
      mutateOptions: (options) => {
        options.officeCliRelativePath = 'One Person Lab.app/Contents/Frameworks/run.sh';
      },
      error: /canonical OfficeCLI must be a Mach-O inventory object/,
    },
    {
      name: 'wrong TeamIdentifier',
      override: (filePath) => filePath.endsWith('/officecli') ? { team: 'WRONGTEAM1' } : {},
      error: /canonical OfficeCLI Developer ID code signature invariant failed/,
    },
    {
      name: 'strict verification failure',
      override: (filePath) => filePath.endsWith('/officecli') ? { strictStatus: 1 } : {},
      error: /canonical OfficeCLI Developer ID code signature invariant failed/,
    },
    {
      name: 'wrong Developer ID leaf authority',
      override: (filePath) => filePath.endsWith('/officecli')
        ? { authority: `Developer ID Application: Previous Owner (${teamIdentifier})` }
        : {},
      error: /canonical OfficeCLI Developer ID code signature invariant failed/,
    },
    {
      name: 'missing hardened runtime and timestamp',
      override: (filePath) => filePath.endsWith('/officecli')
        ? { flags: '0x0(none)', timestamp: 'none' }
        : {},
      error: /canonical OfficeCLI Developer ID code signature invariant failed/,
    },
    {
      name: 'allow-jit false',
      override: (filePath) => filePath.endsWith('/officecli') ? { allowJit: false } : {},
      error: /entitlement com\.apple\.security\.cs\.allow-jit must be true/,
    },
    {
      name: 'old designated requirement preserved',
      override: (filePath) => filePath.endsWith('/officecli')
        ? { requirementTeams: [teamIdentifier, 'OLDTEAM123'] }
        : {},
      error: /designated requirement must contain only certificate leaf\[subject\.OU\]/,
    },
    {
      name: 'version mismatch',
      override: (filePath) => filePath.endsWith('/officecli')
        ? { versionOutput: '1.0.138' }
        : {},
      error: /--version must exit 0 with exact stdout/,
    },
    {
      name: 'version command nonzero',
      override: (filePath) => filePath.endsWith('/officecli')
        ? { versionStatus: 9 }
        : {},
      error: /--version must exit 0 with exact stdout/,
    },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-code-officecli-fail-'));
      try {
        const options = fixtureOptions(root);
        scenario.mutateOptions?.(options);
        const receipt = qualifyFullDmgCode(options, runner(scenario.override), 'darwin');
        assert.equal(receipt.status, 'failed');
        assert.match(receipt.errors.join('\n'), scenario.error);
        if (!scenario.name.startsWith('version ')) {
          assert.equal(receipt.officecli?.version.status, 'not_run');
        }
        assert.equal(JSON.parse(fs.readFileSync(options.outputPath, 'utf8')).status, 'failed');
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

test('canonical OfficeCLI records bounded version stderr without failing exact stdout', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-code-officecli-stderr-'));
  try {
    const options = fixtureOptions(root);
    const rawStderr = `officecli warning: ${'x'.repeat(5000)}`;
    const receipt = qualifyFullDmgCode(
      options,
      runner((filePath) => filePath.endsWith('/officecli') ? { versionStderr: rawStderr } : {}),
      'darwin',
    );

    assert.equal(receipt.status, 'passed', receipt.errors.join('\n'));
    assert.equal(receipt.officecli?.version.status, 'passed');
    assert.equal(receipt.officecli?.version.stdout, officeCliVersion);
    assert.equal(receipt.officecli?.version.stderr_size_bytes, Buffer.byteLength(rawStderr));
    assert.equal(receipt.officecli?.version.stderr_truncated, true);
    assert.equal(receipt.officecli?.version.warning, 'nonempty_stderr');
    assert.ok(Buffer.byteLength(receipt.officecli?.version.stderr ?? '') <= 4096);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CLI writes a failed receipt and exits nonzero before mounting mismatched bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-code-cli-'));
  try {
    const options = fixtureOptions(root);
    const result = spawnSync(process.execPath, [
      '--experimental-strip-types',
      'scripts/qualify-full-dmg-code.ts',
      '--dmg',
      options.dmgPath,
      '--output',
      options.outputPath,
      '--expected-dmg-sha256',
      'b'.repeat(64),
      '--expected-dmg-size-bytes',
      String(options.expectedDmgSizeBytes),
      '--expected-team-id',
      teamIdentifier,
      '--expected-authority',
      authority,
    ], {
      cwd: appRoot,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /DMG SHA-256 mismatch/);
    assert.equal(JSON.parse(fs.readFileSync(options.outputPath, 'utf8')).status, 'failed');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
