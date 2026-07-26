#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultManifestPath = path.join(
  appRoot,
  'contracts',
  'o08-nightly-fresh-main-replay-manifest.json',
);
const fullShaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const conflictMarkerPattern = /^(?:<<<<<<<|=======|>>>>>>>)(?: |$)/m;
const receiptEnvironmentKeys = [
  'OPL_RELEASE_SOURCE_GATE_OUTPUT',
  'OPL_RELEASE_SOURCE_GATE_RECEIPT',
  'OPL_SOURCE_GATE_RECEIPT',
] as const;

type ReplayPhase = 'replay' | 'gates' | 'post-commit' | 'absorption';
type TrackedChange = { status: string; path: string };
type WireIdentity = { repository: string; ref: string; commit: string; tree?: string };
type HistoricalIdentity = { repository: string; commit: string; tree: string };
type ReplaySuccessor = { commit: string; tree: string; parent: string };
type SourceSpec = WireIdentity & {
  id: string;
  apply_order: number;
  tracked_path_count: number;
  tracked_changes: TrackedChange[];
  required_semantics: string[];
};
export type OverlapSpec = {
  path: string;
  resolution: string;
  order: string[];
  process_patch_sha256: string;
  nightly_patch_sha256: string;
  process_blob: string;
  nightly_blob: string;
  combined_blob: string;
};
export type FreshMainOverlaySpec = {
  path: string;
  resolution: string;
  fresh_main_patch_sha256: string;
  process_patch_sha256: string;
  fresh_main_blob: string;
  process_blob: string;
  combined_blob: string;
};
export type O08ReplayManifest = {
  schema: string;
  lane: string;
  authority: {
    mutation_authority: boolean;
    canonical_writer: string;
    order_receipt: {
      path: string;
      sha256: string;
      size_bytes: number;
      mode: string;
      supersedes: string;
    };
    forbidden_mutations: string[];
  };
  source_basis: HistoricalIdentity;
  fresh_main: WireIdentity & { tree: string };
  cohort_currentness: {
    shell: WireIdentity & { tree: string };
    framework: WireIdentity & { tree: string };
  };
  sources: {
    process: SourceSpec;
    nightly: SourceSpec;
  };
  replay: {
    order: string[];
    successor_chain: {
      process: ReplaySuccessor;
      nightly: ReplaySuccessor;
    };
    tracked_path_count: number;
    tracked_paths: string[];
    fresh_main_overlay_path_count: number;
    fresh_main_overlays: FreshMainOverlaySpec[];
    overlap_path_count: number;
    overlaps: OverlapSpec[];
    validator_support_paths: string[];
    forbidden: Record<string, boolean>;
  };
  generated_surfaces: Array<{
    schema: string;
    producer: string;
    reuse_allowed: boolean;
  }>;
  gate_environment: {
    required_variables: string[];
    policy_relative_to_root: string;
    mutation_allowed: boolean;
  };
  gates: Array<{
    id: string;
    cwd: 'app' | 'shell';
    command: string[];
  }>;
  readback: {
    post_commit_requires: string[];
    absorption_requires: string[];
  };
};

export type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};
export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string },
) => CommandResult;

type CliOptions = {
  phase: ReplayPhase;
  manifestPath: string;
  repoRoot: string;
  authorityReceiptPath: string;
  postCommitSha: string;
  sourceGateReceiptPath: string;
  output: string;
  json: boolean;
};

type ValidationReport = {
  schema: 'opl_o08_fresh_main_replay_validation.v2';
  generated_at: string;
  phase: ReplayPhase;
  status: 'passed' | 'failed';
  manifest: {
    path: string;
    sha256: string;
    order_receipt_sha256: string;
  };
  base: {
    source_basis: { commit: string; tree: string };
    fresh_main: { commit: string; tree: string };
  };
  sources: {
    process: { commit: string; tree: string; tracked_path_count: number };
    nightly: { commit: string; tree: string; tracked_path_count: number };
  };
  successors: {
    process: ReplaySuccessor;
    nightly: ReplaySuccessor;
  };
  currentness: Array<{ label: string; ref: string; expected: string; observed: string }>;
  payload: {
    tracked_path_count: number;
    overlap_path_count: number;
    payload_digest: string;
    blobs: Array<{ path: string; blob: string; mode: string }>;
  } | null;
  gates: Array<{
    id: string;
    status: 'passed';
    command: string;
    stdout_tail: string;
    stderr_tail: string;
  }>;
  post_commit: {
    commit: string;
    tree: string;
    support_blobs: Array<{ path: string; blob: string }>;
  } | null;
  absorption: {
    wire_main_sha: string;
    local_main_sha: string;
    tree: string;
    post_commit_ancestor: true;
    source_gate_receipt_sha256: string;
  } | null;
  failure: string | null;
  next_action: string;
};

function run(command: string, args: string[], options: { cwd: string }): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? result.error?.message ?? '',
  };
}

function commandText(command: string, args: string[]): string {
  return [command, ...args].map((value) => JSON.stringify(value)).join(' ');
}

function commandOutput(
  runner: CommandRunner,
  cwd: string,
  command: string,
  args: string[],
): string {
  const result = runner(command, args, { cwd });
  if (result.status !== 0) {
    throw new Error(
      `${commandText(command, args)} failed: ${(result.stderr || result.stdout).trim()}`,
    );
  }
  return result.stdout;
}

function git(
  runner: CommandRunner,
  repoRoot: string,
  args: string[],
): string {
  return commandOutput(runner, repoRoot, 'git', args);
}

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath: string): string {
  return sha256(fs.readFileSync(filePath));
}

function exactSha(value: unknown, label: string): string {
  if (typeof value !== 'string' || !fullShaPattern.test(value)) {
    throw new Error(`${label} must be an exact lowercase 40-character SHA.`);
  }
  return value;
}

function exactDigest(value: unknown, label: string): string {
  if (typeof value !== 'string' || !digestPattern.test(value)) {
    throw new Error(`${label} must be an exact lowercase SHA-256 digest.`);
  }
  return value;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function sameStrings(actual: string[], expected: string[]): boolean {
  return JSON.stringify(uniqueSorted(actual)) === JSON.stringify(uniqueSorted(expected));
}

function sameChanges(actual: TrackedChange[], expected: TrackedChange[]): boolean {
  const normalize = (values: TrackedChange[]) => values
    .map(({ status, path: candidatePath }) => `${status}\t${candidatePath}`)
    .sort();
  return JSON.stringify(normalize(actual)) === JSON.stringify(normalize(expected));
}

export function assertExactPathSet(
  observedPaths: string[],
  manifestPaths: string[],
  label = 'replay payload',
): void {
  const observed = uniqueSorted(observedPaths);
  const expected = uniqueSorted(manifestPaths);
  const extra = observed.filter((candidatePath) => !expected.includes(candidatePath));
  const missing = expected.filter((candidatePath) => !observed.includes(candidatePath));
  if (extra.length > 0 || missing.length > 0) {
    throw new Error(
      `${label} is not exact: unknown/31st paths=[${extra.join(', ')}], missing=[${missing.join(', ')}].`,
    );
  }
}

export function assertWireRefIdentity(
  label: string,
  expectedSha: string,
  observedSha: string,
): void {
  if (exactSha(observedSha, `${label} observed wire SHA`) !== exactSha(expectedSha, `${label} expected SHA`)) {
    throw new Error(`${label} currentness drift: expected ${expectedSha}, observed ${observedSha}.`);
  }
}

export function assertOverlapResolution(overlap: OverlapSpec, candidateBlob: string): void {
  exactSha(candidateBlob, `${overlap.path} candidate blob`);
  if (candidateBlob === overlap.process_blob || candidateBlob === overlap.nightly_blob) {
    throw new Error(
      `${overlap.path} resolved as a whole-file ours/theirs blob; hunk-by-hunk combination is required.`,
    );
  }
  if (candidateBlob !== overlap.combined_blob) {
    throw new Error(
      `${overlap.path} overlap blob drift: expected ${overlap.combined_blob}, observed ${candidateBlob}.`,
    );
  }
}

export function assertFreshMainOverlayResolution(
  overlay: FreshMainOverlaySpec,
  candidateBlob: string,
): void {
  exactSha(candidateBlob, `${overlay.path} fresh-main overlay candidate blob`);
  if (candidateBlob === overlay.fresh_main_blob || candidateBlob === overlay.process_blob) {
    throw new Error(
      `${overlay.path} discarded either fresh-main or e306 semantics as a whole-file blob.`,
    );
  }
  if (candidateBlob !== overlay.combined_blob) {
    throw new Error(
      `${overlay.path} fresh-main overlay blob drift: expected ${overlay.combined_blob}, observed ${candidateBlob}.`,
    );
  }
}

export function assertHunkDigest(
  pathLabel: string,
  side: 'fresh-main' | 'process' | 'nightly',
  expectedDigest: string,
  observedPatch: string,
): void {
  const observedDigest = sha256(observedPatch);
  if (observedDigest !== exactDigest(expectedDigest, `${pathLabel} ${side} patch digest`)) {
    throw new Error(
      `${pathLabel} ${side} hunk drift: expected ${expectedDigest}, observed ${observedDigest}.`,
    );
  }
}

function manifestPaths(source: SourceSpec): string[] {
  return source.tracked_changes.map((change) => change.path);
}

export function validateReplayManifest(manifest: O08ReplayManifest): void {
  if (manifest.schema !== 'opl_o08_fresh_main_replay_manifest.v2') {
    throw new Error('Unexpected O08 replay manifest schema.');
  }
  if (manifest.authority.mutation_authority !== false || manifest.authority.canonical_writer !== 'Integrator') {
    throw new Error('O08 replay manifest must preserve authority0 and the sole Integrator writer.');
  }
  exactDigest(manifest.authority.order_receipt.sha256, 'order receipt digest');
  if (
    manifest.authority.order_receipt.size_bytes !== 1913
    || manifest.authority.order_receipt.mode !== '0444'
    || manifest.authority.order_receipt.supersedes !== 'replay_order_only'
  ) {
    throw new Error('Order correction receipt identity drifted.');
  }
  exactSha(manifest.source_basis.commit, 'source basis commit');
  exactSha(manifest.source_basis.tree, 'source basis tree');
  exactSha(manifest.fresh_main.commit, 'fresh main commit');
  exactSha(manifest.fresh_main.tree, 'fresh main tree');
  exactSha(manifest.sources.process.commit, 'process commit');
  exactSha(manifest.sources.process.tree, 'process tree');
  exactSha(manifest.sources.nightly.commit, 'nightly commit');
  exactSha(manifest.sources.nightly.tree, 'nightly tree');
  for (const [label, successor] of Object.entries(manifest.replay.successor_chain)) {
    exactSha(successor.commit, `${label} successor commit`);
    exactSha(successor.tree, `${label} successor tree`);
    exactSha(successor.parent, `${label} successor parent`);
  }
  if (
    manifest.sources.process.id !== 'e306_stable_source'
    || manifest.sources.process.apply_order !== 1
    || manifest.sources.nightly.id !== 'o08_standard_nightly'
    || manifest.sources.nightly.apply_order !== 2
    || JSON.stringify(manifest.replay.order) !== JSON.stringify([
      'e306_stable_source',
      'o08_standard_nightly',
    ])
  ) {
    throw new Error('Replay order must be e306 Stable/source first, then O08 Nightly, with no alternate.');
  }
  if (
    manifest.replay.successor_chain.process.parent !== manifest.fresh_main.commit
    || manifest.replay.successor_chain.nightly.parent
      !== manifest.replay.successor_chain.process.commit
  ) {
    throw new Error('Replay successor chain must be fresh main -> e306 successor -> O08 successor.');
  }

  for (const source of [manifest.sources.process, manifest.sources.nightly]) {
    if (
      source.tracked_path_count !== source.tracked_changes.length
      || uniqueSorted(manifestPaths(source)).length !== source.tracked_path_count
    ) {
      throw new Error(`${source.id} tracked path inventory is not exact.`);
    }
  }
  if (
    manifest.sources.process.tracked_path_count !== 16
    || manifest.sources.nightly.tracked_path_count !== 17
  ) {
    throw new Error('Source inventories must remain exact16 and exact17.');
  }

  const processPaths = manifestPaths(manifest.sources.process);
  const nightlyPaths = manifestPaths(manifest.sources.nightly);
  const union = uniqueSorted([...processPaths, ...nightlyPaths]);
  const overlap = processPaths.filter((candidatePath) => nightlyPaths.includes(candidatePath)).sort();
  if (
    manifest.replay.tracked_path_count !== 30
    || manifest.replay.tracked_paths.length !== 30
    || !sameStrings(union, manifest.replay.tracked_paths)
  ) {
    throw new Error('Replay payload must remain the exact30 union.');
  }
  if (
    manifest.replay.overlap_path_count !== 3
    || manifest.replay.overlaps.length !== 3
    || !sameStrings(overlap, manifest.replay.overlaps.map((entry) => entry.path))
  ) {
    throw new Error('Replay overlap must remain the exact3 intersection.');
  }
  if (
    manifest.replay.validator_support_paths.length !== 4
    || uniqueSorted(manifest.replay.validator_support_paths).length !== 4
    || manifest.replay.validator_support_paths.some((candidatePath) => union.includes(candidatePath))
  ) {
    throw new Error('Validator support slice must remain exact4 and disjoint from exact30.');
  }

  const overlayPaths = manifest.replay.fresh_main_overlays.map((entry) => entry.path);
  if (
    manifest.replay.fresh_main_overlay_path_count !== 2
    || manifest.replay.fresh_main_overlays.length !== 2
    || uniqueSorted(overlayPaths).length !== 2
    || overlayPaths.some((candidatePath) => !processPaths.includes(candidatePath))
    || overlayPaths.some((candidatePath) => nightlyPaths.includes(candidatePath))
  ) {
    throw new Error('Fresh-main overlay must remain exact2 inside the process-only exact16 paths.');
  }
  for (const overlay of manifest.replay.fresh_main_overlays) {
    if (overlay.resolution !== 'hunk_by_hunk_preserve_both') {
      throw new Error(`${overlay.path} fresh-main overlay must preserve both semantic sides.`);
    }
    exactDigest(overlay.fresh_main_patch_sha256, `${overlay.path} fresh-main patch digest`);
    exactDigest(overlay.process_patch_sha256, `${overlay.path} process patch digest`);
    for (const [label, value] of Object.entries({
      fresh_main_blob: overlay.fresh_main_blob,
      process_blob: overlay.process_blob,
      combined_blob: overlay.combined_blob,
    })) {
      exactSha(value, `${overlay.path} ${label}`);
    }
    if (
      overlay.combined_blob === overlay.fresh_main_blob
      || overlay.combined_blob === overlay.process_blob
    ) {
      throw new Error(`${overlay.path} fresh-main overlay encodes forbidden whole-file resolution.`);
    }
  }

  for (const overlapSpec of manifest.replay.overlaps) {
    if (
      overlapSpec.resolution !== 'hunk_by_hunk'
      || JSON.stringify(overlapSpec.order) !== JSON.stringify(manifest.replay.order)
    ) {
      throw new Error(`${overlapSpec.path} does not preserve the unique hunk-level order.`);
    }
    for (const [label, value] of Object.entries({
      process_patch_sha256: overlapSpec.process_patch_sha256,
      nightly_patch_sha256: overlapSpec.nightly_patch_sha256,
    })) {
      exactDigest(value, `${overlapSpec.path} ${label}`);
    }
    for (const [label, value] of Object.entries({
      process_blob: overlapSpec.process_blob,
      nightly_blob: overlapSpec.nightly_blob,
      combined_blob: overlapSpec.combined_blob,
    })) {
      exactSha(value, `${overlapSpec.path} ${label}`);
    }
    if (
      overlapSpec.combined_blob === overlapSpec.process_blob
      || overlapSpec.combined_blob === overlapSpec.nightly_blob
    ) {
      throw new Error(`${overlapSpec.path} manifest encodes forbidden whole-file resolution.`);
    }
  }

  const requiredForbidden = [
    'unknown_replay_path',
    'replay_path_31',
    'whole_file_ours_or_theirs',
    'overlap_blob_drift',
    'source_basis_or_fresh_main_overlay_drift',
    'fresh_main_or_cohort_currentness_drift',
    'successor_chain_drift',
    'source_gate_receipt_before_absorption',
    'stale_or_cross_cohort_source_gate_receipt',
    'source_commit_ancestry_in_post_commit',
  ];
  if (requiredForbidden.some((key) => manifest.replay.forbidden[key] !== true)) {
    throw new Error('Replay manifest must fail closed on every required forbidden condition.');
  }
  if (
    manifest.generated_surfaces.length !== 10
    || manifest.generated_surfaces.some((surface) => surface.reuse_allowed !== false)
  ) {
    throw new Error('Every generated replay/release surface must reject reuse.');
  }
  if (
    JSON.stringify(manifest.gate_environment.required_variables) !== JSON.stringify([
      'OPL_FULL_OPL_FLOW_ROOT',
      'OPL_FLOW_WORKFLOW_POLICY',
    ])
    || manifest.gate_environment.policy_relative_to_root !== 'contracts/workflow-policy.json'
    || manifest.gate_environment.mutation_allowed !== false
  ) {
    throw new Error('Aggregate gate environment must bind one read-only OPL Flow policy source.');
  }
}

export function readReplayManifest(manifestPath: string): O08ReplayManifest {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as O08ReplayManifest;
  validateReplayManifest(manifest);
  return manifest;
}

function parseNameStatus(output: string): TrackedChange[] {
  const tokens = output.split('\0').filter(Boolean);
  if (tokens.length % 2 !== 0) throw new Error('Unexpected git diff --name-status -z output.');
  const changes: TrackedChange[] = [];
  for (let index = 0; index < tokens.length; index += 2) {
    const status = tokens[index]!;
    const candidatePath = tokens[index + 1]!;
    if (!['A', 'M', 'D', 'T', 'U'].includes(status)) {
      throw new Error(`Replay rejects non-exact change status ${status} for ${candidatePath}.`);
    }
    changes.push({ status, path: candidatePath });
  }
  return changes;
}

function diffChanges(
  runner: CommandRunner,
  repoRoot: string,
  base: string,
  target?: string,
): TrackedChange[] {
  const args = ['diff', '--name-status', '-z', '--no-renames', base];
  if (target) args.push(target);
  args.push('--');
  return parseNameStatus(git(runner, repoRoot, args));
}

function statusPaths(runner: CommandRunner, repoRoot: string): string[] {
  const output = git(runner, repoRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const entries = output.split('\0').filter(Boolean);
  const paths: string[] = [];
  for (const entry of entries) {
    const status = entry.slice(0, 2);
    const candidatePath = entry.slice(3);
    if (status.includes('R') || status.includes('C') || !candidatePath) {
      throw new Error(`Replay rejects non-exact worktree status ${JSON.stringify(entry)}.`);
    }
    paths.push(candidatePath);
  }
  return paths;
}

function wireSha(
  runner: CommandRunner,
  repoRoot: string,
  identity: WireIdentity,
): string {
  const output = git(runner, repoRoot, [
    'ls-remote',
    '--exit-code',
    '--heads',
    identity.repository,
    identity.ref,
  ]);
  const matches = output
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts[1] === identity.ref);
  if (matches.length !== 1) {
    throw new Error(`Wire identity ${identity.repository} ${identity.ref} returned ${matches.length} matches.`);
  }
  return exactSha(matches[0]![0], `${identity.ref} wire SHA`);
}

function validateAuthorityReceipt(
  manifest: O08ReplayManifest,
  receiptPath: string,
): void {
  if (!receiptPath || !fs.existsSync(receiptPath)) {
    throw new Error('Exact O11 replay-order receipt is required.');
  }
  const stat = fs.statSync(receiptPath);
  const mode = (stat.mode & 0o777).toString(8).padStart(4, '0');
  const expected = manifest.authority.order_receipt;
  if (
    stat.size !== expected.size_bytes
    || mode !== expected.mode
    || sha256File(receiptPath) !== expected.sha256
  ) {
    throw new Error('O11 replay-order receipt bytes, mode, or SHA-256 drifted.');
  }
}

function validateLocalSourceIdentities(
  manifest: O08ReplayManifest,
  runner: CommandRunner,
  repoRoot: string,
): void {
  const identities = [
    ['source basis', manifest.source_basis],
    ['fresh main', manifest.fresh_main],
    ['process', manifest.sources.process],
    ['nightly', manifest.sources.nightly],
    ['process successor', manifest.replay.successor_chain.process],
    ['Nightly successor', manifest.replay.successor_chain.nightly],
  ] as const;
  for (const [label, identity] of identities) {
    const tree = git(runner, repoRoot, ['rev-parse', `${identity.commit}^{tree}`]).trim();
    if (tree !== identity.tree) {
      throw new Error(`${label} tree drift: expected ${identity.tree}, observed ${tree}.`);
    }
  }
  const mergeBase = git(
    runner,
    repoRoot,
    ['merge-base', manifest.source_basis.commit, manifest.fresh_main.commit],
  ).trim();
  if (mergeBase !== manifest.source_basis.commit) {
    throw new Error('Fresh App main is not descended from the frozen source basis.');
  }
  for (const [label, successor] of Object.entries(manifest.replay.successor_chain)) {
    const parent = git(runner, repoRoot, ['rev-parse', `${successor.commit}^`]).trim();
    if (parent !== successor.parent) {
      throw new Error(
        `${label} successor parent drift: expected ${successor.parent}, observed ${parent}.`,
      );
    }
  }
}

function validateSourceDeltas(
  manifest: O08ReplayManifest,
  runner: CommandRunner,
  repoRoot: string,
): void {
  for (const source of [manifest.sources.process, manifest.sources.nightly]) {
    const observed = diffChanges(runner, repoRoot, manifest.source_basis.commit, source.commit);
    if (!sameChanges(observed, source.tracked_changes)) {
      throw new Error(`${source.id} tracked delta drifted from its exact manifest inventory.`);
    }
  }
  const freshMainChanges = diffChanges(
    runner,
    repoRoot,
    manifest.source_basis.commit,
    manifest.fresh_main.commit,
  );
  const expectedFreshMainChanges = manifest.replay.fresh_main_overlays.map((overlay) => ({
    status: 'M',
    path: overlay.path,
  }));
  if (!sameChanges(freshMainChanges, expectedFreshMainChanges)) {
    throw new Error('Fresh App main delta from source basis drifted from the exact2 overlay.');
  }
  for (const overlay of manifest.replay.fresh_main_overlays) {
    const freshMainPatch = git(runner, repoRoot, [
      'diff',
      '--no-ext-diff',
      '--unified=0',
      manifest.source_basis.commit,
      manifest.fresh_main.commit,
      '--',
      overlay.path,
    ]);
    const processPatch = git(runner, repoRoot, [
      'diff',
      '--no-ext-diff',
      '--unified=0',
      manifest.source_basis.commit,
      manifest.sources.process.commit,
      '--',
      overlay.path,
    ]);
    assertHunkDigest(
      overlay.path,
      'fresh-main',
      overlay.fresh_main_patch_sha256,
      freshMainPatch,
    );
    assertHunkDigest(overlay.path, 'process', overlay.process_patch_sha256, processPatch);
    const observedFreshMainBlob = sourceBlob(
      runner,
      repoRoot,
      manifest.fresh_main.commit,
      overlay.path,
    );
    const observedProcessBlob = sourceBlob(
      runner,
      repoRoot,
      manifest.sources.process.commit,
      overlay.path,
    );
    if (
      observedFreshMainBlob !== overlay.fresh_main_blob
      || observedProcessBlob !== overlay.process_blob
    ) {
      throw new Error(`${overlay.path} fresh-main or process source blob drifted.`);
    }
  }
  for (const overlap of manifest.replay.overlaps) {
    const processPatch = git(runner, repoRoot, [
      'diff',
      '--no-ext-diff',
      '--unified=0',
      manifest.source_basis.commit,
      manifest.sources.process.commit,
      '--',
      overlap.path,
    ]);
    const nightlyPatch = git(runner, repoRoot, [
      'diff',
      '--no-ext-diff',
      '--unified=0',
      manifest.source_basis.commit,
      manifest.sources.nightly.commit,
      '--',
      overlap.path,
    ]);
    assertHunkDigest(overlap.path, 'process', overlap.process_patch_sha256, processPatch);
    assertHunkDigest(overlap.path, 'nightly', overlap.nightly_patch_sha256, nightlyPatch);
  }
}

function currentnessIdentities(
  manifest: O08ReplayManifest,
  includeAppMain: boolean,
): Array<[string, WireIdentity]> {
  return [
    ...(includeAppMain ? [['App main', manifest.fresh_main] as [string, WireIdentity]] : []),
    ['process source', manifest.sources.process],
    ['Nightly source', manifest.sources.nightly],
    ['Shell main', manifest.cohort_currentness.shell],
    ['Framework main', manifest.cohort_currentness.framework],
  ];
}

function validateCurrentness(
  manifest: O08ReplayManifest,
  runner: CommandRunner,
  repoRoot: string,
  includeAppMain: boolean,
): ValidationReport['currentness'] {
  return currentnessIdentities(manifest, includeAppMain).map(([label, identity]) => {
    const observed = wireSha(runner, repoRoot, identity);
    assertWireRefIdentity(label, identity.commit, observed);
    return { label, ref: identity.ref, expected: identity.commit, observed };
  });
}

function expectedChangeMap(manifest: O08ReplayManifest): Map<string, string> {
  const result = new Map<string, string>();
  for (const source of [manifest.sources.process, manifest.sources.nightly]) {
    for (const change of source.tracked_changes) {
      const previous = result.get(change.path);
      if (previous && previous !== change.status) {
        throw new Error(`${change.path} has conflicting source change statuses.`);
      }
      result.set(change.path, change.status);
    }
  }
  return result;
}

function sourceBlob(
  runner: CommandRunner,
  repoRoot: string,
  commit: string,
  candidatePath: string,
): string {
  return exactSha(
    git(runner, repoRoot, ['rev-parse', `${commit}:${candidatePath}`]).trim(),
    `${candidatePath} source blob`,
  );
}

function sourceMode(
  runner: CommandRunner,
  repoRoot: string,
  commit: string,
  candidatePath: string,
): string {
  const output = git(runner, repoRoot, ['ls-tree', commit, '--', candidatePath]).trim();
  const mode = output.split(/\s+/)[0];
  if (!/^(?:100644|100755)$/.test(mode ?? '')) {
    throw new Error(`${candidatePath} has unsupported source mode ${mode ?? '(missing)'}.`);
  }
  return mode!;
}

function expectedPathIdentity(
  manifest: O08ReplayManifest,
  runner: CommandRunner,
  repoRoot: string,
  candidatePath: string,
): { blob: string; mode: string } {
  const freshMainOverlay = manifest.replay.fresh_main_overlays.find(
    (entry) => entry.path === candidatePath,
  );
  if (freshMainOverlay) {
    const freshMainMode = sourceMode(
      runner,
      repoRoot,
      manifest.fresh_main.commit,
      candidatePath,
    );
    const processMode = sourceMode(
      runner,
      repoRoot,
      manifest.sources.process.commit,
      candidatePath,
    );
    if (freshMainMode !== processMode) {
      throw new Error(`${candidatePath} mode differs between fresh main and process source.`);
    }
    return { blob: freshMainOverlay.combined_blob, mode: freshMainMode };
  }
  const overlap = manifest.replay.overlaps.find((entry) => entry.path === candidatePath);
  if (overlap) {
    const processMode = sourceMode(
      runner,
      repoRoot,
      manifest.sources.process.commit,
      candidatePath,
    );
    const nightlyMode = sourceMode(
      runner,
      repoRoot,
      manifest.sources.nightly.commit,
      candidatePath,
    );
    if (processMode !== nightlyMode) {
      throw new Error(`${candidatePath} overlap mode differs between sources.`);
    }
    return { blob: overlap.combined_blob, mode: processMode };
  }
  const inProcess = manifestPaths(manifest.sources.process).includes(candidatePath);
  const source = inProcess ? manifest.sources.process : manifest.sources.nightly;
  return {
    blob: sourceBlob(runner, repoRoot, source.commit, candidatePath),
    mode: sourceMode(runner, repoRoot, source.commit, candidatePath),
  };
}

function workingPathIdentity(
  runner: CommandRunner,
  repoRoot: string,
  candidatePath: string,
): { blob: string; mode: string } {
  const absolutePath = path.join(repoRoot, candidatePath);
  const stat = fs.lstatSync(absolutePath);
  if (!stat.isFile()) throw new Error(`${candidatePath} must be a regular file in replay.`);
  const blob = exactSha(
    git(runner, repoRoot, ['hash-object', '--', candidatePath]).trim(),
    `${candidatePath} working blob`,
  );
  return {
    blob,
    mode: stat.mode & 0o111 ? '100755' : '100644',
  };
}

function commitPathIdentity(
  runner: CommandRunner,
  repoRoot: string,
  commit: string,
  candidatePath: string,
): { blob: string; mode: string } {
  return {
    blob: sourceBlob(runner, repoRoot, commit, candidatePath),
    mode: sourceMode(runner, repoRoot, commit, candidatePath),
  };
}

function payloadDigest(blobs: Array<{ path: string; blob: string; mode: string }>): string {
  return sha256(
    blobs
      .map(({ path: candidatePath, blob, mode }) => `${candidatePath}\0${mode}\0${blob}\n`)
      .sort()
      .join(''),
  );
}

function validateCandidatePayload(
  manifest: O08ReplayManifest,
  runner: CommandRunner,
  repoRoot: string,
  targetCommit?: string,
): ValidationReport['payload'] {
  const changes = diffChanges(
    runner,
    repoRoot,
    manifest.fresh_main.commit,
    targetCommit,
  );
  const candidateStatusPaths = targetCommit ? [] : statusPaths(runner, repoRoot);
  const allowedPaths = [
    ...manifest.replay.tracked_paths,
    ...manifest.replay.validator_support_paths,
  ];
  assertExactPathSet(
    [...changes.map((change) => change.path), ...candidateStatusPaths],
    allowedPaths,
    'replay plus validator support',
  );

  const expectedStatuses = expectedChangeMap(manifest);
  const replayChanges = changes.filter((change) => manifest.replay.tracked_paths.includes(change.path));
  const expectedReplayChanges = [...expectedStatuses].map(([candidatePath, status]) => ({
    path: candidatePath,
    status,
  }));
  if (!sameChanges(replayChanges, expectedReplayChanges)) {
    throw new Error('Replay exact30 change status inventory drifted.');
  }

  const unmerged = git(runner, repoRoot, ['ls-files', '-u', '-z']);
  if (unmerged !== '') throw new Error('Replay contains unmerged index entries.');
  commandOutput(
    runner,
    repoRoot,
    'git',
    ['diff', '--check', manifest.fresh_main.commit, ...(targetCommit ? [targetCommit] : []), '--'],
  );

  const blobs = manifest.replay.tracked_paths.map((candidatePath) => {
    const expected = expectedPathIdentity(manifest, runner, repoRoot, candidatePath);
    const observed = targetCommit
      ? commitPathIdentity(runner, repoRoot, targetCommit, candidatePath)
      : workingPathIdentity(runner, repoRoot, candidatePath);
    const overlap = manifest.replay.overlaps.find((entry) => entry.path === candidatePath);
    const freshMainOverlay = manifest.replay.fresh_main_overlays.find(
      (entry) => entry.path === candidatePath,
    );
    if (freshMainOverlay) assertFreshMainOverlayResolution(freshMainOverlay, observed.blob);
    if (overlap) assertOverlapResolution(overlap, observed.blob);
    if (observed.blob !== expected.blob || observed.mode !== expected.mode) {
      throw new Error(
        `${candidatePath} blob/mode drift: expected ${expected.mode} ${expected.blob}, observed ${observed.mode} ${observed.blob}.`,
      );
    }
    const content = fs.readFileSync(path.join(repoRoot, candidatePath), 'utf8');
    if (!targetCommit && conflictMarkerPattern.test(content)) {
      throw new Error(`${candidatePath} contains a conflict marker.`);
    }
    return { path: candidatePath, ...observed };
  });
  return {
    tracked_path_count: blobs.length,
    overlap_path_count: manifest.replay.overlaps.length,
    payload_digest: payloadDigest(blobs),
    blobs,
  };
}

export function assertNoSourceGateReceiptReuse(
  sourceGateReceiptPath: string,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const configuredEnvironment = receiptEnvironmentKeys
    .filter((key) => typeof environment[key] === 'string' && environment[key]!.trim() !== '');
  if (sourceGateReceiptPath.trim() !== '' || configuredEnvironment.length > 0) {
    throw new Error(
      `Source-gate receipt reuse is forbidden before absorption; configured=[${configuredEnvironment.join(', ')}].`,
    );
  }
}

export function validateFreshSourceGateReceipt(
  receipt: any,
  expected: {
    appSha: string;
    shellSha: string;
    frameworkSha: string;
    commitTimestamp: string;
  },
): void {
  const cohort = receipt?.admission?.immutable_cohort;
  if (
    receipt?.schema !== 'opl_app_release_source_gate.v1'
    || receipt?.status !== 'passed'
    || receipt?.admission?.status !== 'passed'
    || receipt?.typed_blocker !== null
    || receipt?.expected_app_head !== expected.appSha
    || receipt?.app_head !== expected.appSha
    || cohort?.app_sha !== expected.appSha
    || cohort?.shell_sha !== expected.shellSha
    || cohort?.framework_sha !== expected.frameworkSha
    || !Array.isArray(receipt?.checks)
    || receipt.checks.some((check: any) => check?.status !== 'passed')
    || !Array.isArray(receipt?.required_gates)
    || receipt.required_gates.some((gate: any) => gate?.required !== true || gate?.executed !== true)
  ) {
    throw new Error('Source-gate receipt is stale, incomplete, or cross-cohort.');
  }
  const generatedAt = Date.parse(String(receipt.generated_at ?? ''));
  const commitTimestamp = Date.parse(expected.commitTimestamp);
  if (!Number.isFinite(generatedAt) || !Number.isFinite(commitTimestamp) || generatedAt < commitTimestamp) {
    throw new Error('Source-gate receipt predates the absorbed App commit and cannot be reused.');
  }
}

function validateReplayBase(
  manifest: O08ReplayManifest,
  runner: CommandRunner,
  repoRoot: string,
  targetCommit?: string,
): void {
  const target = targetCommit ?? git(runner, repoRoot, ['rev-parse', 'HEAD']).trim();
  const mergeBase = git(
    runner,
    repoRoot,
    ['merge-base', manifest.fresh_main.commit, target],
  ).trim();
  if (mergeBase !== manifest.fresh_main.commit) {
    throw new Error('Replay target is not based on the frozen fresh App main.');
  }
  const nightlySuccessor = manifest.replay.successor_chain.nightly.commit;
  const successorMergeBase = git(
    runner,
    repoRoot,
    ['merge-base', nightlySuccessor, target],
  ).trim();
  if (successorMergeBase !== nightlySuccessor) {
    throw new Error('Support tip is not descended from the frozen Nightly successor.');
  }
  const supportChanges = diffChanges(runner, repoRoot, nightlySuccessor, target);
  const supportStatusPaths = targetCommit ? [] : statusPaths(runner, repoRoot);
  assertExactPathSet(
    [...supportChanges.map((change) => change.path), ...supportStatusPaths],
    manifest.replay.validator_support_paths,
    'Nightly successor to support tip',
  );
  if (targetCommit) {
    const expectedSupportChanges = manifest.replay.validator_support_paths.map(
      (candidatePath) => ({ status: 'A', path: candidatePath }),
    );
    if (!sameChanges(supportChanges, expectedSupportChanges)) {
      throw new Error('Committed support lineage must remain exact4 additions.');
    }
  }
}

function validateSupportPathsAtCommit(
  manifest: O08ReplayManifest,
  runner: CommandRunner,
  repoRoot: string,
  commit: string,
): Array<{ path: string; blob: string }> {
  return manifest.replay.validator_support_paths.map((candidatePath) => ({
    path: candidatePath,
    blob: sourceBlob(runner, repoRoot, commit, candidatePath),
  }));
}

function assertSourceCommitsNotAncestors(
  manifest: O08ReplayManifest,
  runner: CommandRunner,
  repoRoot: string,
  targetCommit: string,
): void {
  for (const source of [manifest.sources.process, manifest.sources.nightly]) {
    const result = runner(
      'git',
      ['merge-base', '--is-ancestor', source.commit, targetCommit],
      { cwd: repoRoot },
    );
    if (result.status === 0) {
      throw new Error(`${source.id} is an ancestor of replay target; historical source ancestry is forbidden.`);
    }
    if (result.status !== 1) {
      throw new Error(`Unable to inspect ${source.id} ancestry: ${result.stderr.trim()}`);
    }
  }
}

function requireCleanWorktree(runner: CommandRunner, repoRoot: string): void {
  const status = git(runner, repoRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  if (status !== '') throw new Error('Post-commit/absorption readback requires a clean worktree.');
}

function tail(value: string, maxLength = 2000): string {
  return value.length <= maxLength ? value : value.slice(-maxLength);
}

function executeGates(
  manifest: O08ReplayManifest,
  runner: CommandRunner,
  repoRoot: string,
): ValidationReport['gates'] {
  const flowRoot = process.env.OPL_FULL_OPL_FLOW_ROOT?.trim() ?? '';
  const policyPath = process.env.OPL_FLOW_WORKFLOW_POLICY?.trim() ?? '';
  if (!flowRoot || !policyPath) {
    throw new Error(
      `Gate environment requires ${manifest.gate_environment.required_variables.join(' and ')}.`,
    );
  }
  const expectedPolicyPath = path.join(
    path.resolve(flowRoot),
    manifest.gate_environment.policy_relative_to_root,
  );
  if (
    path.resolve(policyPath) !== expectedPolicyPath
    || !fs.statSync(flowRoot).isDirectory()
    || !fs.statSync(policyPath).isFile()
  ) {
    throw new Error('Gate environment does not bind the declared read-only OPL Flow policy file.');
  }
  return manifest.gates.map((gate) => {
    if (gate.command.length === 0) throw new Error(`${gate.id} has no command.`);
    const cwd = gate.cwd === 'shell' ? path.join(repoRoot, 'shells', 'aionui') : repoRoot;
    const [command, ...args] = gate.command;
    const result = runner(command!, args, { cwd });
    if (result.status !== 0) {
      throw new Error(
        `Gate ${gate.id} failed: ${(result.stderr || result.stdout).trim()}`,
      );
    }
    return {
      id: gate.id,
      status: 'passed' as const,
      command: commandText(command!, args),
      stdout_tail: tail(result.stdout),
      stderr_tail: tail(result.stderr),
    };
  });
}

function baseReport(
  options: CliOptions,
  manifest: O08ReplayManifest,
): ValidationReport {
  return {
    schema: 'opl_o08_fresh_main_replay_validation.v2',
    generated_at: new Date().toISOString(),
    phase: options.phase,
    status: 'passed',
    manifest: {
      path: options.manifestPath,
      sha256: sha256File(options.manifestPath),
      order_receipt_sha256: manifest.authority.order_receipt.sha256,
    },
    base: {
      source_basis: {
        commit: manifest.source_basis.commit,
        tree: manifest.source_basis.tree,
      },
      fresh_main: {
        commit: manifest.fresh_main.commit,
        tree: manifest.fresh_main.tree,
      },
    },
    sources: {
      process: {
        commit: manifest.sources.process.commit,
        tree: manifest.sources.process.tree,
        tracked_path_count: manifest.sources.process.tracked_path_count,
      },
      nightly: {
        commit: manifest.sources.nightly.commit,
        tree: manifest.sources.nightly.tree,
        tracked_path_count: manifest.sources.nightly.tracked_path_count,
      },
    },
    successors: structuredClone(manifest.replay.successor_chain),
    currentness: [],
    payload: null,
    gates: [],
    post_commit: null,
    absorption: null,
    failure: null,
    next_action: 'follow_manifest_gate_order',
  };
}

export function executeValidation(
  options: CliOptions,
  runner: CommandRunner = run,
): ValidationReport {
  const manifest = readReplayManifest(options.manifestPath);
  validateAuthorityReceipt(manifest, options.authorityReceiptPath);
  validateLocalSourceIdentities(manifest, runner, options.repoRoot);
  validateSourceDeltas(manifest, runner, options.repoRoot);
  const report = baseReport(options, manifest);

  if (options.phase !== 'absorption') {
    assertNoSourceGateReceiptReuse(options.sourceGateReceiptPath);
    report.currentness = validateCurrentness(manifest, runner, options.repoRoot, true);
    validateReplayBase(manifest, runner, options.repoRoot, options.postCommitSha || undefined);
  } else {
    report.currentness = validateCurrentness(manifest, runner, options.repoRoot, false);
  }

  if (options.phase === 'replay' || options.phase === 'gates') {
    report.payload = validateCandidatePayload(manifest, runner, options.repoRoot);
    if (options.phase === 'gates') {
      report.gates = executeGates(manifest, runner, options.repoRoot);
      report.next_action = 'commit_support_and_exact30_then_run_post_commit';
    } else {
      report.next_action = 'run_gates';
    }
    return report;
  }

  const postCommitSha = exactSha(options.postCommitSha, 'post-commit SHA');
  if (options.phase === 'post-commit') {
    const head = git(runner, options.repoRoot, ['rev-parse', 'HEAD']).trim();
    if (head !== postCommitSha) throw new Error('Post-commit SHA must equal repository HEAD.');
    requireCleanWorktree(runner, options.repoRoot);
    assertSourceCommitsNotAncestors(manifest, runner, options.repoRoot, postCommitSha);
    report.payload = validateCandidatePayload(manifest, runner, options.repoRoot, postCommitSha);
    report.post_commit = {
      commit: postCommitSha,
      tree: git(runner, options.repoRoot, ['rev-parse', `${postCommitSha}^{tree}`]).trim(),
      support_blobs: validateSupportPathsAtCommit(
        manifest,
        runner,
        options.repoRoot,
        postCommitSha,
      ),
    };
    report.next_action = 'integrator_absorb_then_generate_fresh_source_gate_receipt';
    return report;
  }

  if (!options.sourceGateReceiptPath) {
    throw new Error('Absorption readback requires a fresh source-gate receipt.');
  }
  requireCleanWorktree(runner, options.repoRoot);
  const localMain = git(runner, options.repoRoot, ['rev-parse', 'HEAD']).trim();
  const wireMain = wireSha(runner, options.repoRoot, {
    repository: manifest.fresh_main.repository,
    ref: manifest.fresh_main.ref,
    commit: localMain,
  });
  if (wireMain !== localMain) {
    throw new Error(`Absorption readback requires local main ${localMain} to equal wire main ${wireMain}.`);
  }
  const ancestry = runner(
    'git',
    ['merge-base', '--is-ancestor', postCommitSha, localMain],
    { cwd: options.repoRoot },
  );
  if (ancestry.status !== 0) {
    throw new Error('Post-commit SHA is not absorbed into canonical main.');
  }
  report.payload = validateCandidatePayload(manifest, runner, options.repoRoot, localMain);
  const receipt = JSON.parse(fs.readFileSync(options.sourceGateReceiptPath, 'utf8'));
  const commitTimestamp = git(
    runner,
    options.repoRoot,
    ['show', '-s', '--format=%cI', localMain],
  ).trim();
  validateFreshSourceGateReceipt(receipt, {
    appSha: localMain,
    shellSha: manifest.cohort_currentness.shell.commit,
    frameworkSha: manifest.cohort_currentness.framework.commit,
    commitTimestamp,
  });
  report.absorption = {
    wire_main_sha: wireMain,
    local_main_sha: localMain,
    tree: git(runner, options.repoRoot, ['rev-parse', `${localMain}^{tree}`]).trim(),
    post_commit_ancestor: true,
    source_gate_receipt_sha256: sha256File(options.sourceGateReceiptPath),
  };
  report.next_action = 'record_absorption_without_cleanup_or_public_mutation';
  return report;
}

function parseCli(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      phase: { type: 'string', default: 'replay' },
      manifest: { type: 'string', default: defaultManifestPath },
      'repo-root': { type: 'string', default: appRoot },
      'authority-receipt': { type: 'string', default: '' },
      'post-commit-sha': { type: 'string', default: '' },
      'source-gate-receipt': { type: 'string', default: '' },
      output: { type: 'string', default: '' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(`Usage:
  node --experimental-strip-types scripts/validate-o08-nightly-fresh-main-replay.ts --phase <replay|gates|post-commit|absorption>

Options:
  --manifest <path>             Machine manifest. Default: contracts/o08-nightly-fresh-main-replay-manifest.json
  --repo-root <path>            Candidate or canonical App checkout.
  --authority-receipt <path>    Exact O11 order correction receipt.
  --post-commit-sha <sha>       Required for post-commit and absorption.
  --source-gate-receipt <path>  Forbidden before absorption; required for absorption.
  --output <path>               Write machine validation JSON.
  --json                        Print JSON report.
`);
    process.exit(0);
  }
  if (!['replay', 'gates', 'post-commit', 'absorption'].includes(values.phase!)) {
    throw new Error(`Unsupported phase ${values.phase}.`);
  }
  const manifestPath = path.resolve(values.manifest!);
  const manifest = readReplayManifest(manifestPath);
  return {
    phase: values.phase as ReplayPhase,
    manifestPath,
    repoRoot: path.resolve(values['repo-root']!),
    authorityReceiptPath: path.resolve(
      values['authority-receipt'] || manifest.authority.order_receipt.path,
    ),
    postCommitSha: values['post-commit-sha']!.trim(),
    sourceGateReceiptPath: (
      values['source-gate-receipt']
      || process.env.OPL_RELEASE_SOURCE_GATE_RECEIPT
      || process.env.OPL_SOURCE_GATE_RECEIPT
      || ''
    ).trim(),
    output: values.output ? path.resolve(values.output) : '',
    json: values.json!,
  };
}

function writeReport(report: ValidationReport, output: string): void {
  if (!output) return;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function isMainModule(): boolean {
  return process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  let options: CliOptions | null = null;
  try {
    options = parseCli(process.argv.slice(2));
    const report = executeValidation(options);
    writeReport(report, options.output);
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(`O08 fresh-main replay ${report.phase} PASS.\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options) {
      const manifest = readReplayManifest(options.manifestPath);
      const report = baseReport(options, manifest);
      report.status = 'failed';
      report.failure = message;
      report.next_action = 'stop_and_refresh_owner_manifest_or_replay';
      writeReport(report, options.output);
      if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }
    console.error(`O08 fresh-main replay FAIL: ${message}`);
    process.exit(1);
  }
}
