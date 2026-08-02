import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { copySingleFile } from './filesystem.ts';
import { commandOutput } from './process.ts';

export const FLOW_CAPABILITY_BUILD_LOCK_RELATIVE_PATH =
  'capability-locks/opl-flow-capability-build-lock.json';

// Physical carrier support only; the Framework-compiled Flow plan owns selection.
const FULL_CARRIER_ADAPTERS = {
  'cli:officecli': {
    sourceKey: 'officeCliBin',
    runtimeRelativePath: 'bin/officecli',
    versionArgs: ['--version'],
  },
  'cli:mineru-open-api': {
    sourceKey: 'mineruOpenApiBin',
    runtimeRelativePath: 'bin/mineru-open-api',
    versionArgs: ['version'],
  },
} as const;

type FullCapabilityRef = keyof typeof FULL_CARRIER_ADAPTERS;

function sha256File(filePath: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function objectValue(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, any>;
}

function fullPlanItems(strategy: unknown) {
  const value = objectValue(strategy, 'Framework Flow capability strategy');
  if (
    value.surface_kind !== 'opl_flow_capability_strategy_projection.v1'
    || value.authority !== 'opl-flow'
    || value.policy_schema !== 'opl_flow_workflow_policy.v4'
  ) {
    throw new Error('Framework returned an unsupported OPL Flow capability strategy projection.');
  }
  const plan = objectValue(value.full_distribution_plan, 'Flow Full distribution plan');
  if (plan.target !== 'full_offline_seed' || !Array.isArray(plan.items)) {
    throw new Error('Framework Flow capability strategy has no Full distribution plan.');
  }
  const refs = plan.items.map((item, index) => {
    const entry = objectValue(item, `Flow Full distribution plan item ${index}`);
    if (typeof entry.capability_ref !== 'string' || !entry.capability_ref.trim()) {
      throw new Error(`Flow Full distribution plan item ${index} has no capability_ref.`);
    }
    if (!(entry.capability_ref in FULL_CARRIER_ADAPTERS)) {
      throw new Error(`App Full carrier has no adapter for ${entry.capability_ref}.`);
    }
    return entry;
  });
  if (new Set(refs.map((item) => item.capability_ref)).size !== refs.length) {
    throw new Error('Flow Full distribution plan contains duplicate capability refs.');
  }
  return refs;
}

function runFrameworkCompiler(input: {
  frameworkRoot: string;
  flowRoot: string;
  resolutions?: Array<Record<string, unknown>>;
}) {
  const compilerPath = path.join(
    input.frameworkRoot,
    'scripts',
    'compile-opl-flow-capability-projections.mjs',
  );
  if (!fs.existsSync(compilerPath) || !fs.statSync(compilerPath).isFile()) {
    throw new Error(`Framework Flow capability compiler is unavailable: ${compilerPath}`);
  }
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-flow-capability-compile-'));
  try {
    const args = [
      '--experimental-strip-types',
      compilerPath,
      '--flow-root',
      input.flowRoot,
      '--json',
    ];
    if (input.resolutions) {
      const resolutionsPath = path.join(tempRoot, 'resolutions.json');
      const lockPath = path.join(tempRoot, 'build-lock.json');
      fs.writeFileSync(resolutionsPath, `${JSON.stringify(input.resolutions, null, 2)}\n`, 'utf8');
      args.push('--resolutions', resolutionsPath, '--build-lock-output', lockPath);
    }
    const result = spawnSync(process.execPath, args, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    if (result.status !== 0) {
      throw new Error(
        `Framework Flow capability compiler failed: ${result.stderr || result.stdout || 'unknown failure'}`,
      );
    }
    return objectValue(JSON.parse(result.stdout), 'Framework Flow capability compiler receipt');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function compileFlowCapabilityStrategyForFull(input: {
  frameworkRoot: string;
  flowRoot: string;
}) {
  const receipt = runFrameworkCompiler(input);
  fullPlanItems(receipt.strategy);
  return receipt.strategy;
}

export function selectedFlowFullCapabilityRefs(strategy: unknown): FullCapabilityRef[] {
  return fullPlanItems(strategy).map((item) => item.capability_ref as FullCapabilityRef);
}

export function selectedFlowFullCliIds(strategy: unknown) {
  return fullPlanItems(strategy).map((item) => String(item.id));
}

function validateBuildLock(lock: unknown, strategy: unknown) {
  const value = objectValue(lock, 'Framework Flow capability build lock');
  if (
    value.surface_kind !== 'opl_flow_capability_build_lock.v1'
    || value.authority !== 'opl-framework'
    || value.target !== 'full_offline_seed'
    || typeof value.lock_digest !== 'string'
    || !/^[a-f0-9]{64}$/.test(value.lock_digest)
    || !Array.isArray(value.items)
  ) {
    throw new Error('Framework returned an unsupported OPL Flow capability build lock.');
  }
  const expectedRefs = selectedFlowFullCapabilityRefs(strategy);
  const actualRefs = value.items.map((item, index) => {
    const entry = objectValue(item, `Flow capability build lock item ${index}`);
    if (
      typeof entry.capability_ref !== 'string'
      || typeof entry.source_ref !== 'string'
      || !entry.source_ref.trim()
      || typeof entry.source_sha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(entry.source_sha256)
    ) {
      throw new Error(`Flow capability build lock item ${index} is incomplete.`);
    }
    return entry.capability_ref;
  });
  if (JSON.stringify(actualRefs) !== JSON.stringify(expectedRefs)) {
    throw new Error('Flow capability build lock does not exactly match the Framework Full plan.');
  }
  if (value.flow_package?.strategy_digest !== (strategy as any).strategy_digest) {
    throw new Error('Flow capability build lock strategy identity drifted during compilation.');
  }
  return value;
}

export function compileFlowCapabilityBuildLock(input: {
  frameworkRoot: string;
  flowRoot: string;
  strategy: unknown;
  sources: Record<string, any>;
}) {
  const resolutions = fullPlanItems(input.strategy).map((item) => {
    const adapter = FULL_CARRIER_ADAPTERS[item.capability_ref as FullCapabilityRef];
    const sourcePath = input.sources[adapter.sourceKey];
    if (!sourcePath || !fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      throw new Error(`Selected Flow Full capability source is unavailable: ${item.capability_ref}.`);
    }
    const sourceSha256 = sha256File(sourcePath);
    const version = commandOutput(sourcePath, [...adapter.versionArgs]);
    return {
      capability_ref: item.capability_ref,
      source_ref: `${item.source ?? item.owner ?? item.id}@${version || sourceSha256}`,
      source_sha256: sourceSha256,
      version: version || null,
    };
  });
  const receipt = runFrameworkCompiler({
    frameworkRoot: input.frameworkRoot,
    flowRoot: input.flowRoot,
    resolutions,
  });
  if (receipt.strategy?.strategy_digest !== (input.strategy as any).strategy_digest) {
    throw new Error('Flow capability strategy changed while compiling the Full build lock.');
  }
  return validateBuildLock(receipt.build_lock, input.strategy);
}

export function flowCapabilityBuildLockCacheInput(lock: unknown) {
  const value = objectValue(lock, 'Flow capability build lock cache input');
  return {
    lock_digest: value.lock_digest,
    flow_package: value.flow_package,
    items: value.items.map((item) => ({
      capability_ref: item.capability_ref,
      source_ref: item.source_ref,
      source_sha256: item.source_sha256,
      version: item.version,
    })),
  };
}

export function materializeFlowCapabilityBuildLock(
  layerRoot: string,
  sources: Record<string, any>,
  lock: unknown,
) {
  const value = objectValue(lock, 'Flow capability build lock');
  const selected = new Set(value.items.map((item) => item.capability_ref));
  for (const [capabilityRef, adapter] of Object.entries(FULL_CARRIER_ADAPTERS)) {
    const targetPath = path.join(layerRoot, ...adapter.runtimeRelativePath.split('/'));
    if (!selected.has(capabilityRef)) {
      if (fs.existsSync(targetPath)) {
        throw new Error(`Unselected Flow Full capability payload is present: ${capabilityRef}.`);
      }
      continue;
    }
    const item = value.items.find((candidate) => candidate.capability_ref === capabilityRef);
    const sourcePath = sources[adapter.sourceKey];
    if (!sourcePath || sha256File(sourcePath) !== item.source_sha256) {
      throw new Error(`Flow Full capability source drifted after build-lock compilation: ${capabilityRef}.`);
    }
    copySingleFile(sourcePath, targetPath);
    if (sha256File(targetPath) !== item.source_sha256) {
      throw new Error(`Flow Full capability payload copy drifted: ${capabilityRef}.`);
    }
  }
  const lockPath = path.join(layerRoot, ...FLOW_CAPABILITY_BUILD_LOCK_RELATIVE_PATH.split('/'));
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function readMaterializedFlowCapabilityBuildLock(runtimeRoot: string) {
  const lockPath = path.join(runtimeRoot, ...FLOW_CAPABILITY_BUILD_LOCK_RELATIVE_PATH.split('/'));
  if (!fs.existsSync(lockPath) || !fs.statSync(lockPath).isFile()) {
    throw new Error(`Full runtime Flow capability build lock is missing: ${lockPath}`);
  }
  return objectValue(JSON.parse(fs.readFileSync(lockPath, 'utf8')), 'Materialized Flow capability build lock');
}

export function assertMaterializedFlowCapabilityBuildLock(runtimeRoot: string) {
  const lock = readMaterializedFlowCapabilityBuildLock(runtimeRoot);
  const selected = new Set(lock.items.map((item) => item.capability_ref));
  const items = [];
  for (const [capabilityRef, adapter] of Object.entries(FULL_CARRIER_ADAPTERS)) {
    const payloadPath = path.join(runtimeRoot, ...adapter.runtimeRelativePath.split('/'));
    if (!selected.has(capabilityRef)) {
      if (fs.existsSync(payloadPath)) {
        throw new Error(`Full runtime contains an unselected Flow capability payload: ${capabilityRef}.`);
      }
      continue;
    }
    if (!fs.existsSync(payloadPath) || !fs.statSync(payloadPath).isFile()) {
      throw new Error(`Full runtime is missing selected Flow capability payload: ${capabilityRef}.`);
    }
    const stat = fs.statSync(payloadPath);
    if ((stat.mode & 0o111) === 0) {
      throw new Error(`Full runtime Flow capability payload is not executable: ${capabilityRef}.`);
    }
    const locked = lock.items.find((item) => item.capability_ref === capabilityRef);
    items.push({
      capability_ref: capabilityRef,
      runtime_relative_path: adapter.runtimeRelativePath,
      source_ref: locked.source_ref,
      source_sha256: locked.source_sha256,
      payload_sha256: sha256File(payloadPath),
      version: locked.version,
    });
  }
  if (items.length !== lock.items.length) {
    throw new Error('Full runtime Flow capability payload count does not match its build lock.');
  }
  return {
    surface_kind: 'opl_flow_capability_carrier_assembly.v1',
    lock_digest: lock.lock_digest,
    lock_path: FLOW_CAPABILITY_BUILD_LOCK_RELATIVE_PATH,
    items,
  };
}
