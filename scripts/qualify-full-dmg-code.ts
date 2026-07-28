#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const digestPattern = /^[0-9a-f]{64}$/;
const officeCliVersionStderrLimitBytes = 4096;
const developerIdChainTail = [
  'Developer ID Certification Authority',
  'Apple Root CA',
] as const;
const executableBundleSuffixes = [
  '.app',
  '.appex',
  '.bundle',
  '.framework',
  '.mdimporter',
  '.plugin',
  '.prefpane',
  '.qlgenerator',
  '.saver',
  '.service',
  '.xpc',
] as const;
const machoMagics = new Set([
  'feedface',
  'cefaedfe',
  'feedfacf',
  'cffaedfe',
  'cafebabe',
  'bebafeca',
  'cafebabf',
  'bfbafeca',
]);

export type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string; input?: string },
) => CommandResult;

export type FullDmgCodeQualificationOptions = {
  dmgPath: string;
  outputPath: string;
  expectedDmgSha256: string;
  expectedDmgSizeBytes: number;
  expectedTeamIdentifier: string;
  expectedAuthority: string;
  expectedMachoCount?: number;
  expectedExecutableBundleCount?: number;
  officeCliRelativePath?: string;
  expectedOfficeCliVersion?: string;
  generatedAt?: string;
};

type CodeObjectKind = 'top_level_app' | 'executable_bundle' | 'mach_o';

type CodeObjectReceipt = {
  relative_path: string;
  kinds: CodeObjectKind[];
  macho_magic: string | null;
  verification: {
    strict: 'passed' | 'failed';
    aggregate_deep: boolean;
    identifier: string | null;
    format: string | null;
    authority_chain: string[];
    team_identifier: string | null;
    timestamp: string | null;
    code_directory_flags: string | null;
    hardened_runtime: boolean;
    entitlements: {
      readback: 'present' | 'absent' | 'failed';
      sha256: string | null;
      size_bytes: number | null;
      xml: string | null;
    };
  };
};

export type FullDmgCodeQualificationReceipt = {
  schema: 'opl_full_dmg_code_qualification.v1';
  generated_at: string;
  status: 'passed' | 'failed';
  artifact: {
    path: string;
    name: string;
    sha256: string | null;
    size_bytes: number | null;
  };
  expectations: {
    sha256: string;
    size_bytes: number;
    team_identifier: string;
    leaf_authority: string;
    authority_chain_tail: readonly string[];
    timestamp_required: true;
    hardened_runtime_required: true;
    entitlements_readback_required: true;
    macho_count: number | null;
    executable_bundle_count: number | null;
    officecli: {
      relative_path: string | null;
      expected_version: string | null;
    } | null;
  };
  app: {
    relative_path: string | null;
  };
  inventory: {
    top_level_app_count: number;
    macho_count: number;
    executable_bundle_count: number;
    nested_executable_bundle_count: number;
    unique_code_object_count: number;
    sha256: string | null;
  };
  code_objects: CodeObjectReceipt[];
  officecli: {
    relative_path: string;
    regular_non_symlink_file: boolean;
    macho: boolean;
    code_signature: 'passed' | 'failed';
    allow_jit: boolean;
    designated_requirement: string | null;
    designated_requirement_team_identifiers: string[];
    version: {
      status: 'passed' | 'failed' | 'not_run';
      exit_status: number | null;
      expected: string;
      stdout: string | null;
      stderr: string | null;
      stderr_size_bytes: number;
      stderr_truncated: boolean;
      warning: 'nonempty_stderr' | null;
    };
  } | null;
  errors: string[];
};

type Candidate = {
  absolutePath: string;
  relativePath: string;
  kinds: Set<CodeObjectKind>;
  machoMagic: string | null;
};

function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; input?: string },
): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
    timeout: 120_000,
    input: options.input,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? (result.error ? String(result.error.message) : ''),
  };
}

function sha256(bytes: Buffer | string): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256File(filePath: string): string {
  const digest = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) digest.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return digest.digest('hex');
}

function relativePath(root: string, candidate: string): string {
  return path.relative(root, candidate).split(path.sep).join('/');
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function machoMagic(filePath: string): string | null {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const magic = Buffer.alloc(4);
    if (fs.readSync(descriptor, magic, 0, magic.length, 0) !== magic.length) return null;
    const hex = magic.toString('hex');
    return machoMagics.has(hex) ? hex : null;
  } finally {
    fs.closeSync(descriptor);
  }
}

function isExecutableBundle(directoryPath: string): boolean {
  const lower = path.basename(directoryPath).toLowerCase();
  return executableBundleSuffixes.some((suffix) => lower.endsWith(suffix));
}

function addCandidate(
  candidates: Map<string, Candidate>,
  mountRoot: string,
  absolutePath: string,
  kind: CodeObjectKind,
  magic: string | null = null,
): void {
  const relative = relativePath(mountRoot, absolutePath);
  const existing = candidates.get(relative);
  if (existing) {
    existing.kinds.add(kind);
    if (magic) existing.machoMagic = magic;
    return;
  }
  candidates.set(relative, {
    absolutePath,
    relativePath: relative,
    kinds: new Set([kind]),
    machoMagic: magic,
  });
}

function walkCodeObjects(
  mountRoot: string,
  directoryPath: string,
  candidates: Map<string, Candidate>,
): void {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true })
    .sort((left, right) => compareText(left.name, right.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      if (isExecutableBundle(absolutePath)) {
        addCandidate(candidates, mountRoot, absolutePath, 'executable_bundle');
      }
      walkCodeObjects(mountRoot, absolutePath, candidates);
      continue;
    }
    if (!entry.isFile()) continue;
    const magic = machoMagic(absolutePath);
    if (magic) addCandidate(candidates, mountRoot, absolutePath, 'mach_o', magic);
  }
}

function commandText(result: CommandResult): string {
  return [result.stdout, result.stderr].filter(Boolean).join('\n');
}

function metadataValue(metadata: string, key: string): string | null {
  const prefix = `${key}=`;
  const line = metadata.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() || null : null;
}

function authorityChain(metadata: string): string[] {
  return metadata.split(/\r?\n/)
    .filter((line) => line.startsWith('Authority='))
    .map((line) => line.slice('Authority='.length).trim())
    .filter(Boolean);
}

function codeDirectoryFlags(metadata: string): { raw: string | null; runtime: boolean } {
  const line = metadata.split(/\r?\n/).find((candidate) => candidate.startsWith('CodeDirectory '));
  const raw = line?.match(/\bflags=(0x[0-9a-fA-F]+)/)?.[1] ?? null;
  if (!raw) return { raw: null, runtime: false };
  const value = Number.parseInt(raw.slice(2), 16);
  return { raw: raw.toLowerCase(), runtime: Number.isFinite(value) && (value & 0x10000) !== 0 };
}

function entitlementsXml(result: CommandResult): string | null {
  for (const text of [result.stdout, result.stderr, commandText(result)]) {
    const start = text.indexOf('<?xml');
    const end = text.indexOf('</plist>', start);
    if (start >= 0 && end >= start) return text.slice(start, end + '</plist>'.length).trim();
  }
  return null;
}

function officeCliExpectation(options: FullDmgCodeQualificationOptions): {
  relativePath: string;
  expectedVersion: string;
} | null {
  if (options.officeCliRelativePath === undefined || options.expectedOfficeCliVersion === undefined) {
    return null;
  }
  return {
    relativePath: options.officeCliRelativePath,
    expectedVersion: options.expectedOfficeCliVersion,
  };
}

function normalizedMountedRelativePath(value: string): boolean {
  return Boolean(value)
    && value === value.trim()
    && !value.includes('\\')
    && !path.posix.isAbsolute(value)
    && path.posix.normalize(value) === value
    && value.split('/').every((segment) => Boolean(segment) && segment !== '.' && segment !== '..');
}

function codeObjectMatchesExpectedSignature(
  object: CodeObjectReceipt,
  expectedTeamIdentifier: string,
  expectedAuthority: string,
): boolean {
  return object.verification.strict === 'passed'
    && JSON.stringify(object.verification.authority_chain)
      === JSON.stringify([expectedAuthority, ...developerIdChainTail])
    && object.verification.team_identifier === expectedTeamIdentifier
    && Boolean(object.verification.timestamp)
    && object.verification.timestamp?.toLowerCase() !== 'none'
    && object.verification.hardened_runtime;
}

function designatedRequirement(result: CommandResult): string | null {
  const text = commandText(result);
  const start = text.indexOf('designated =>');
  return start >= 0 ? text.slice(start).trim() || null : null;
}

function designatedRequirementTeamIdentifiers(requirement: string | null): string[] {
  if (!requirement) return [];
  const identifiers: string[] = [];
  const pattern = /certificate\s+leaf\[subject\.OU\]\s*=\s*(?:"([^"]+)"|([A-Z0-9]+))/g;
  for (const match of requirement.matchAll(pattern)) {
    identifiers.push((match[1] ?? match[2] ?? '').trim());
  }
  return identifiers.filter(Boolean);
}

function boundedUtf8Evidence(value: string, limitBytes: number): {
  value: string | null;
  sizeBytes: number;
  truncated: boolean;
} {
  const normalized = value.trim();
  const bytes = Buffer.from(normalized, 'utf8');
  if (bytes.length <= limitBytes) {
    return {
      value: normalized || null,
      sizeBytes: bytes.length,
      truncated: false,
    };
  }
  let end = limitBytes;
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end -= 1;
  return {
    value: bytes.subarray(0, end).toString('utf8'),
    sizeBytes: bytes.length,
    truncated: true,
  };
}

function verifyOfficeCliInvariant(
  options: FullDmgCodeQualificationOptions,
  mountRoot: string,
  candidates: Map<string, Candidate>,
  codeObjects: CodeObjectReceipt[],
  runner: CommandRunner,
  errors: string[],
): FullDmgCodeQualificationReceipt['officecli'] {
  const expectation = officeCliExpectation(options);
  if (!expectation) return null;
  if (!normalizedMountedRelativePath(expectation.relativePath)) {
    return {
      relative_path: expectation.relativePath,
      regular_non_symlink_file: false,
      macho: false,
      code_signature: 'failed',
      allow_jit: false,
      designated_requirement: null,
      designated_requirement_team_identifiers: [],
      version: {
        status: 'not_run',
        exit_status: null,
        expected: expectation.expectedVersion,
        stdout: null,
        stderr: null,
        stderr_size_bytes: 0,
        stderr_truncated: false,
        warning: null,
      },
    };
  }

  const absolutePath = path.join(mountRoot, ...expectation.relativePath.split('/'));
  const stat = fs.lstatSync(absolutePath, { throwIfNoEntry: false });
  const regularNonSymlinkFile = Boolean(stat?.isFile() && !stat.isSymbolicLink());
  if (!regularNonSymlinkFile) {
    errors.push(`${expectation.relativePath}: canonical OfficeCLI must be a regular non-symlink file`);
  }
  const candidate = candidates.get(expectation.relativePath);
  const macho = Boolean(candidate?.kinds.has('mach_o'));
  if (!macho) {
    errors.push(`${expectation.relativePath}: canonical OfficeCLI must be a Mach-O inventory object`);
  }
  const codeObject = codeObjects.find((entry) => entry.relative_path === expectation.relativePath);
  const codeSignature = codeObject
    ? codeObjectMatchesExpectedSignature(
        codeObject,
        options.expectedTeamIdentifier,
        options.expectedAuthority,
      )
    : false;
  if (!codeSignature) {
    errors.push(`${expectation.relativePath}: canonical OfficeCLI Developer ID code signature invariant failed`);
  }

  let allowJit = false;
  if (codeObject?.verification.entitlements.xml) {
    const parsed = runner(
      '/usr/bin/plutil',
      ['-extract', 'com\\.apple\\.security\\.cs\\.allow-jit', 'raw', '-o', '-', '-'],
      {
        cwd: path.dirname(absolutePath),
        input: codeObject.verification.entitlements.xml,
      },
    );
    allowJit = parsed.status === 0 && parsed.stdout.trim() === 'true';
    if (!allowJit) {
      errors.push(
        `${expectation.relativePath}: canonical OfficeCLI entitlement com.apple.security.cs.allow-jit must be true`,
      );
    }
  } else {
    errors.push(
      `${expectation.relativePath}: canonical OfficeCLI entitlement com.apple.security.cs.allow-jit must be true`,
    );
  }

  let requirement: string | null = null;
  let requirementTeams: string[] = [];
  if (regularNonSymlinkFile && macho) {
    const readback = runner(
      'codesign',
      ['--display', '--requirements', '-', absolutePath],
      { cwd: path.dirname(absolutePath) },
    );
    requirement = designatedRequirement(readback);
    requirementTeams = designatedRequirementTeamIdentifiers(requirement);
    if (
      readback.status !== 0
      || requirementTeams.length !== 1
      || requirementTeams[0] !== options.expectedTeamIdentifier
    ) {
      errors.push(
        `${expectation.relativePath}: designated requirement must contain only certificate leaf[subject.OU] = `
        + options.expectedTeamIdentifier,
      );
    }
  }
  const requirementPassed = requirementTeams.length === 1
    && requirementTeams[0] === options.expectedTeamIdentifier;

  let version: NonNullable<FullDmgCodeQualificationReceipt['officecli']>['version'] = {
    status: 'not_run',
    exit_status: null,
    expected: expectation.expectedVersion,
    stdout: null,
    stderr: null,
    stderr_size_bytes: 0,
    stderr_truncated: false,
    warning: null,
  };
  if (regularNonSymlinkFile && macho && codeSignature && allowJit && requirementPassed) {
    const observed = runner(absolutePath, ['--version'], { cwd: path.dirname(absolutePath) });
    const stdout = observed.stdout.trim();
    const stderr = boundedUtf8Evidence(observed.stderr, officeCliVersionStderrLimitBytes);
    const passed = observed.status === 0
      && stdout.length > 0
      && stdout === expectation.expectedVersion;
    version = {
      status: passed ? 'passed' : 'failed',
      exit_status: observed.status,
      expected: expectation.expectedVersion,
      stdout: stdout || null,
      stderr: stderr.value,
      stderr_size_bytes: stderr.sizeBytes,
      stderr_truncated: stderr.truncated,
      warning: stderr.value ? 'nonempty_stderr' : null,
    };
    if (!passed) {
      errors.push(
        `${expectation.relativePath}: --version must exit 0 with exact stdout `
        + `${JSON.stringify(expectation.expectedVersion)} (status=${String(observed.status)}, `
        + `stdout=${JSON.stringify(stdout)})`,
      );
    }
  }

  return {
    relative_path: expectation.relativePath,
    regular_non_symlink_file: regularNonSymlinkFile,
    macho,
    code_signature: codeSignature ? 'passed' : 'failed',
    allow_jit: allowJit,
    designated_requirement: requirement,
    designated_requirement_team_identifiers: requirementTeams,
    version,
  };
}

function verifyCodeObject(
  candidate: Candidate,
  expectedTeamIdentifier: string,
  expectedAuthority: string,
  runner: CommandRunner,
  errors: string[],
): CodeObjectReceipt {
  const aggregateDeep = candidate.kinds.has('top_level_app');
  const verifyArgs = [
    '--verify',
    ...(aggregateDeep ? ['--deep'] : []),
    '--strict',
    '--verbose=4',
    candidate.absolutePath,
  ];
  const verify = runner('codesign', verifyArgs, { cwd: path.dirname(candidate.absolutePath) });
  if (verify.status !== 0) {
    errors.push(`${candidate.relativePath}: codesign strict verification failed: ${commandText(verify).trim() || `status=${String(verify.status)}`}`);
  }

  const display = runner(
    'codesign',
    ['--display', '--verbose=4', candidate.absolutePath],
    { cwd: path.dirname(candidate.absolutePath) },
  );
  const metadata = commandText(display);
  if (display.status !== 0) {
    errors.push(`${candidate.relativePath}: codesign metadata readback failed: ${metadata.trim() || `status=${String(display.status)}`}`);
  }
  const identifier = metadataValue(metadata, 'Identifier');
  const format = metadataValue(metadata, 'Format');
  const authorities = authorityChain(metadata);
  const teamIdentifier = metadataValue(metadata, 'TeamIdentifier');
  const timestamp = metadataValue(metadata, 'Timestamp');
  const flags = codeDirectoryFlags(metadata);
  const wantedChain = [expectedAuthority, ...developerIdChainTail];

  if (!identifier) errors.push(`${candidate.relativePath}: codesign Identifier is missing`);
  if (!format) errors.push(`${candidate.relativePath}: codesign Format is missing`);
  if (JSON.stringify(authorities) !== JSON.stringify(wantedChain)) {
    errors.push(`${candidate.relativePath}: authority chain mismatch (expected ${wantedChain.join(' -> ')}, got ${authorities.join(' -> ') || '<missing>'})`);
  }
  if (teamIdentifier !== expectedTeamIdentifier) {
    errors.push(`${candidate.relativePath}: TeamIdentifier mismatch (expected ${expectedTeamIdentifier}, got ${teamIdentifier ?? '<missing>'})`);
  }
  if (!timestamp || timestamp.toLowerCase() === 'none') {
    errors.push(`${candidate.relativePath}: trusted timestamp is missing`);
  }
  if (!flags.runtime) {
    errors.push(`${candidate.relativePath}: hardened runtime flag is missing`);
  }

  const entitlements = runner(
    'codesign',
    ['--display', '--entitlements', ':-', candidate.absolutePath],
    { cwd: path.dirname(candidate.absolutePath) },
  );
  const xml = entitlementsXml(entitlements);
  if (entitlements.status !== 0) {
    errors.push(`${candidate.relativePath}: entitlements readback failed: ${commandText(entitlements).trim() || `status=${String(entitlements.status)}`}`);
  }

  return {
    relative_path: candidate.relativePath,
    kinds: [...candidate.kinds].sort(),
    macho_magic: candidate.machoMagic,
    verification: {
      strict: verify.status === 0 ? 'passed' : 'failed',
      aggregate_deep: aggregateDeep,
      identifier,
      format,
      authority_chain: authorities,
      team_identifier: teamIdentifier,
      timestamp,
      code_directory_flags: flags.raw,
      hardened_runtime: flags.runtime,
      entitlements: {
        readback: entitlements.status !== 0 ? 'failed' : xml ? 'present' : 'absent',
        sha256: entitlements.status === 0 ? sha256(xml ?? '') : null,
        size_bytes: entitlements.status === 0 ? Buffer.byteLength(xml ?? '', 'utf8') : null,
        xml,
      },
    },
  };
}

function baseReceipt(
  options: FullDmgCodeQualificationOptions,
  artifact: { sha256: string | null; sizeBytes: number | null },
): FullDmgCodeQualificationReceipt {
  return {
    schema: 'opl_full_dmg_code_qualification.v1',
    generated_at: options.generatedAt ?? new Date().toISOString(),
    status: 'failed',
    artifact: {
      path: path.resolve(options.dmgPath),
      name: path.basename(options.dmgPath),
      sha256: artifact.sha256,
      size_bytes: artifact.sizeBytes,
    },
    expectations: {
      sha256: options.expectedDmgSha256,
      size_bytes: options.expectedDmgSizeBytes,
      team_identifier: options.expectedTeamIdentifier,
      leaf_authority: options.expectedAuthority,
      authority_chain_tail: developerIdChainTail,
      timestamp_required: true,
      hardened_runtime_required: true,
      entitlements_readback_required: true,
      macho_count: options.expectedMachoCount ?? null,
      executable_bundle_count: options.expectedExecutableBundleCount ?? null,
      officecli: options.officeCliRelativePath !== undefined
        || options.expectedOfficeCliVersion !== undefined
        ? {
            relative_path: options.officeCliRelativePath ?? null,
            expected_version: options.expectedOfficeCliVersion ?? null,
          }
        : null,
    },
    app: { relative_path: null },
    inventory: {
      top_level_app_count: 0,
      macho_count: 0,
      executable_bundle_count: 0,
      nested_executable_bundle_count: 0,
      unique_code_object_count: 0,
      sha256: null,
    },
    code_objects: [],
    officecli: null,
    errors: [],
  };
}

function validateExpectations(
  options: FullDmgCodeQualificationOptions,
  receipt: FullDmgCodeQualificationReceipt,
): void {
  if (!digestPattern.test(options.expectedDmgSha256)) {
    receipt.errors.push('expected DMG SHA-256 must be 64 lowercase hexadecimal characters');
  }
  if (!Number.isSafeInteger(options.expectedDmgSizeBytes) || options.expectedDmgSizeBytes <= 0) {
    receipt.errors.push('expected DMG size must be a positive safe integer');
  }
  if (!/^[A-Z0-9]{10}$/.test(options.expectedTeamIdentifier)) {
    receipt.errors.push('expected TeamIdentifier must be exactly 10 uppercase alphanumeric characters');
  }
  if (
    !options.expectedAuthority.startsWith('Developer ID Application: ')
    || !options.expectedAuthority.endsWith(`(${options.expectedTeamIdentifier})`)
  ) {
    receipt.errors.push('expected authority must be a Developer ID Application leaf bound to the expected TeamIdentifier');
  }
  for (const [label, value] of [
    ['expected Mach-O count', options.expectedMachoCount],
    ['expected executable bundle count', options.expectedExecutableBundleCount],
  ] as const) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) {
      receipt.errors.push(`${label} must be a positive safe integer when provided`);
    }
  }
  const officeCliPathProvided = options.officeCliRelativePath !== undefined;
  const officeCliVersionProvided = options.expectedOfficeCliVersion !== undefined;
  if (officeCliPathProvided !== officeCliVersionProvided) {
    receipt.errors.push(
      'canonical OfficeCLI qualification requires both officeCliRelativePath and expectedOfficeCliVersion',
    );
  }
  if (officeCliPathProvided) {
    const relative = options.officeCliRelativePath!;
    if (!normalizedMountedRelativePath(relative)) {
      receipt.errors.push('canonical OfficeCLI path must be an exact normalized mounted-root relative path');
    }
  }
  if (officeCliVersionProvided) {
    const version = options.expectedOfficeCliVersion!;
    if (!version || version !== version.trim() || /[\r\n\0]/.test(version)) {
      receipt.errors.push('canonical OfficeCLI expected version must be one exact non-empty line');
    }
  }
}

export function qualifyMountedFullDmgCode(
  options: FullDmgCodeQualificationOptions,
  mountRoot: string,
  runner: CommandRunner = runCommand,
): FullDmgCodeQualificationReceipt {
  const stat = fs.statSync(options.dmgPath);
  const receipt = baseReceipt(options, {
    sha256: sha256File(options.dmgPath),
    sizeBytes: stat.size,
  });
  validateExpectations(options, receipt);
  if (receipt.artifact.sha256 !== options.expectedDmgSha256) {
    receipt.errors.push(`DMG SHA-256 mismatch (expected ${options.expectedDmgSha256}, got ${receipt.artifact.sha256})`);
  }
  if (receipt.artifact.size_bytes !== options.expectedDmgSizeBytes) {
    receipt.errors.push(`DMG size mismatch (expected ${options.expectedDmgSizeBytes}, got ${receipt.artifact.size_bytes})`);
  }

  const apps = fs.readdirSync(mountRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && entry.name.toLowerCase().endsWith('.app'))
    .sort((left, right) => compareText(left.name, right.name));
  receipt.inventory.top_level_app_count = apps.length;
  if (apps.length !== 1) {
    receipt.errors.push(`Full DMG must contain exactly one top-level .app bundle, found ${apps.length}`);
    return receipt;
  }

  const appPath = path.join(mountRoot, apps[0]!.name);
  receipt.app.relative_path = relativePath(mountRoot, appPath);
  const candidates = new Map<string, Candidate>();
  addCandidate(candidates, mountRoot, appPath, 'top_level_app');
  addCandidate(candidates, mountRoot, appPath, 'executable_bundle');
  walkCodeObjects(mountRoot, appPath, candidates);
  const orderedCandidates = [...candidates.values()]
    .sort((left, right) => compareText(left.relativePath, right.relativePath));

  receipt.inventory.macho_count = orderedCandidates.filter((candidate) => candidate.kinds.has('mach_o')).length;
  receipt.inventory.executable_bundle_count = orderedCandidates
    .filter((candidate) => candidate.kinds.has('executable_bundle')).length;
  receipt.inventory.nested_executable_bundle_count = receipt.inventory.executable_bundle_count - 1;
  receipt.inventory.unique_code_object_count = orderedCandidates.length;
  if (receipt.inventory.macho_count === 0) {
    receipt.errors.push('Full DMG app contains no Mach-O code objects');
  }
  if (
    options.expectedMachoCount !== undefined
    && receipt.inventory.macho_count !== options.expectedMachoCount
  ) {
    receipt.errors.push(`Mach-O count mismatch (expected ${options.expectedMachoCount}, got ${receipt.inventory.macho_count})`);
  }
  if (
    options.expectedExecutableBundleCount !== undefined
    && receipt.inventory.executable_bundle_count !== options.expectedExecutableBundleCount
  ) {
    receipt.errors.push(`executable bundle count mismatch (expected ${options.expectedExecutableBundleCount}, got ${receipt.inventory.executable_bundle_count})`);
  }

  receipt.code_objects = orderedCandidates.map((candidate) => verifyCodeObject(
    candidate,
    options.expectedTeamIdentifier,
    options.expectedAuthority,
    runner,
    receipt.errors,
  ));
  receipt.officecli = verifyOfficeCliInvariant(
    options,
    mountRoot,
    candidates,
    receipt.code_objects,
    runner,
    receipt.errors,
  );
  receipt.inventory.sha256 = sha256(JSON.stringify(receipt.code_objects.map((entry) => ({
    relative_path: entry.relative_path,
    kinds: entry.kinds,
    macho_magic: entry.macho_magic,
  }))));
  receipt.status = receipt.errors.length === 0 ? 'passed' : 'failed';
  return receipt;
}

export function writeFullDmgCodeQualificationReceiptAtomic(
  outputPath: string,
  receipt: FullDmgCodeQualificationReceipt,
): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporaryPath, outputPath);
    const directory = fs.openSync(path.dirname(outputPath), 'r');
    try {
      fs.fsyncSync(directory);
    } finally {
      fs.closeSync(directory);
    }
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    fs.rmSync(temporaryPath, { force: true });
  }
}

function appendFailure(
  receipt: FullDmgCodeQualificationReceipt,
  error: unknown,
): FullDmgCodeQualificationReceipt {
  receipt.status = 'failed';
  receipt.errors.push(error instanceof Error ? error.message : String(error));
  return receipt;
}

export function qualifyFullDmgCode(
  options: FullDmgCodeQualificationOptions,
  runner: CommandRunner = runCommand,
  platform: NodeJS.Platform = process.platform,
): FullDmgCodeQualificationReceipt {
  let artifact = { sha256: null as string | null, sizeBytes: null as number | null };
  try {
    const stat = fs.statSync(options.dmgPath);
    if (!stat.isFile()) throw new Error(`DMG path is not a regular file: ${options.dmgPath}`);
    artifact = {
      sha256: sha256File(options.dmgPath),
      sizeBytes: stat.size,
    };
  } catch (error) {
    const receipt = appendFailure(baseReceipt(options, artifact), error);
    writeFullDmgCodeQualificationReceiptAtomic(options.outputPath, receipt);
    return receipt;
  }

  let receipt = baseReceipt(options, artifact);
  validateExpectations(options, receipt);
  if (artifact.sha256 !== options.expectedDmgSha256) {
    receipt.errors.push(`DMG SHA-256 mismatch (expected ${options.expectedDmgSha256}, got ${artifact.sha256})`);
  }
  if (artifact.sizeBytes !== options.expectedDmgSizeBytes) {
    receipt.errors.push(`DMG size mismatch (expected ${options.expectedDmgSizeBytes}, got ${artifact.sizeBytes})`);
  }
  if (platform !== 'darwin') receipt.errors.push('Full DMG code qualification requires macOS');
  if (receipt.errors.length > 0) {
    writeFullDmgCodeQualificationReceiptAtomic(options.outputPath, receipt);
    return receipt;
  }

  const mountPoint = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-code-'));
  let attached = false;
  try {
    const attach = runner(
      'hdiutil',
      ['attach', path.resolve(options.dmgPath), '-nobrowse', '-readonly', '-mountpoint', mountPoint],
      { cwd: path.dirname(path.resolve(options.dmgPath)) },
    );
    if (attach.status !== 0) {
      throw new Error(`hdiutil attach failed: ${commandText(attach).trim() || `status=${String(attach.status)}`}`);
    }
    attached = true;
    receipt = qualifyMountedFullDmgCode(options, mountPoint, runner);
  } catch (error) {
    appendFailure(receipt, error);
  } finally {
    if (attached) {
      const detach = runner('hdiutil', ['detach', mountPoint], { cwd: path.dirname(mountPoint) });
      if (detach.status !== 0) {
        receipt.errors.push(`hdiutil detach failed: ${commandText(detach).trim() || `status=${String(detach.status)}`}`);
      }
    }
    try {
      fs.rmdirSync(mountPoint);
    } catch (error) {
      receipt.errors.push(`mount-point cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  try {
    const finalStat = fs.statSync(options.dmgPath);
    const finalSha256 = sha256File(options.dmgPath);
    if (finalSha256 !== receipt.artifact.sha256 || finalStat.size !== receipt.artifact.size_bytes) {
      receipt.errors.push(
        `DMG bytes changed during qualification (qualified sha256=${receipt.artifact.sha256}, size=${receipt.artifact.size_bytes}; `
        + `final sha256=${finalSha256}, size=${finalStat.size})`,
      );
    }
  } catch (error) {
    receipt.errors.push(`final DMG byte readback failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  receipt.status = receipt.errors.length === 0 ? 'passed' : 'failed';
  writeFullDmgCodeQualificationReceiptAtomic(options.outputPath, receipt);
  return receipt;
}

function parsePositiveInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return parsed;
}

function cli(): void {
  const { values } = parseArgs({
    options: {
      dmg: { type: 'string' },
      output: { type: 'string' },
      'expected-dmg-sha256': { type: 'string' },
      'expected-dmg-size-bytes': { type: 'string' },
      'expected-team-id': { type: 'string' },
      'expected-authority': { type: 'string' },
      'expected-macho-count': { type: 'string' },
      'expected-executable-bundle-count': { type: 'string' },
      'officecli-relative-path': { type: 'string' },
      'expected-officecli-version': { type: 'string' },
    },
    strict: true,
  });
  for (const key of [
    'dmg',
    'output',
    'expected-dmg-sha256',
    'expected-dmg-size-bytes',
    'expected-team-id',
    'expected-authority',
  ] as const) {
    if (!values[key]) throw new Error(`Missing --${key}`);
  }
  const options: FullDmgCodeQualificationOptions = {
    dmgPath: path.resolve(values.dmg!),
    outputPath: path.resolve(values.output!),
    expectedDmgSha256: values['expected-dmg-sha256']!,
    expectedDmgSizeBytes: parsePositiveInteger(values['expected-dmg-size-bytes'], '--expected-dmg-size-bytes'),
    expectedTeamIdentifier: values['expected-team-id']!,
    expectedAuthority: values['expected-authority']!,
    expectedMachoCount: values['expected-macho-count']
      ? parsePositiveInteger(values['expected-macho-count'], '--expected-macho-count')
      : undefined,
    expectedExecutableBundleCount: values['expected-executable-bundle-count']
      ? parsePositiveInteger(values['expected-executable-bundle-count'], '--expected-executable-bundle-count')
      : undefined,
    officeCliRelativePath: values['officecli-relative-path'],
    expectedOfficeCliVersion: values['expected-officecli-version'],
  };
  if (options.dmgPath === options.outputPath) {
    throw new Error('--output must not overwrite the DMG');
  }
  const receipt = qualifyFullDmgCode(options);
  process.stdout.write(`${JSON.stringify({
    status: receipt.status,
    receipt: options.outputPath,
    artifact_sha256: receipt.artifact.sha256,
    artifact_size_bytes: receipt.artifact.size_bytes,
    team_identifier: receipt.expectations.team_identifier,
    macho_count: receipt.inventory.macho_count,
    executable_bundle_count: receipt.inventory.executable_bundle_count,
    officecli: receipt.officecli,
  })}\n`);
  if (receipt.status !== 'passed') {
    process.stderr.write(`${receipt.errors.join('\n')}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli();
