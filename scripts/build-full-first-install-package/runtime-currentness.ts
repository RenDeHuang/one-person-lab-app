import fs from 'node:fs';
import path from 'node:path';

import { readGitHead } from './git.ts';
import { run } from './process.ts';

const REQUIRED_MANAGED_UPDATE_COMPONENTS = [
  'app_binary',
  'runtime_toolchain',
  'agent_package_channel',
  'capability_exposure',
] as const;

function parseJsonCommand(command: string, args: string[], env: NodeJS.ProcessEnv): unknown {
  const result = run(command, args, {
    capture: true,
    env,
  });
  return JSON.parse(result.stdout);
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Full runtime currentness probe expected object at ${label}.`);
  }
  return value as Record<string, unknown>;
}

function arrayValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Full runtime currentness probe expected array at ${label}.`);
  }
  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Full runtime currentness probe expected non-empty string at ${label}.`);
  }
  return value;
}

function runtimeProbeEnv(runtimeRoot: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    OPL_FULL_RUNTIME_HOME: runtimeRoot,
    OPL_PACKAGED_SKILLS_ROOT: path.join(runtimeRoot, 'skills'),
    OPL_CODEX_BIN: path.join(runtimeRoot, 'bin', 'codex'),
    OPL_SKIP_SKILL_SYNC: '1',
    PATH: [
      path.join(runtimeRoot, 'bin'),
      path.join(runtimeRoot, 'node', 'bin'),
      path.join(runtimeRoot, 'uv', 'bin'),
      process.env.PATH ?? '',
    ].filter(Boolean).join(path.delimiter),
  };
}

function assertManifestFrameworkRef(runtimeRoot: string, frameworkRoot: string): Record<string, unknown> {
  const manifestPath = path.join(runtimeRoot, 'manifest', 'full-package-manifest.json');
  const manifest = objectValue(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), 'manifest');
  const components = objectValue(manifest.components, 'manifest.components');
  const oplComponent = objectValue(components.opl, 'manifest.components.opl');
  const packagedCommit = stringValue(oplComponent.git_commit, 'manifest.components.opl.git_commit');
  const expectedCommit = readGitHead(frameworkRoot);
  if (packagedCommit !== expectedCommit) {
    throw new Error(
      `Full runtime OPL Framework payload is stale: manifest has ${packagedCommit}, expected ${expectedCommit}.`,
    );
  }

  const resolvedRefs = objectValue(manifest.resolved_refs, 'manifest.resolved_refs');
  const frameworkRef = objectValue(resolvedRefs.opl_framework, 'manifest.resolved_refs.opl_framework');
  const resolvedCommit = stringValue(
    frameworkRef.resolved_commit,
    'manifest.resolved_refs.opl_framework.resolved_commit',
  );
  if (resolvedCommit !== expectedCommit) {
    throw new Error(
      `Full runtime resolved Framework ref is stale: manifest has ${resolvedCommit}, expected ${expectedCommit}.`,
    );
  }
  return manifest;
}

function assertManagedUpdateProbe(payload: unknown): Record<string, unknown> {
  const root = objectValue(payload, 'update status payload');
  const managedUpdate = objectValue(root.managed_update, 'managed_update');
  if (managedUpdate.surface_id !== 'opl_managed_updater_kernel') {
    throw new Error(
      `Full runtime managed update probe returned unexpected surface: ${String(managedUpdate.surface_id)}`,
    );
  }

  const componentIds = new Set(
    arrayValue(managedUpdate.components, 'managed_update.components')
      .map((component) => objectValue(component, 'managed_update.components[]').component_id)
      .filter((componentId): componentId is string => typeof componentId === 'string'),
  );
  const missing = REQUIRED_MANAGED_UPDATE_COMPONENTS.filter((componentId) => !componentIds.has(componentId));
  if (missing.length > 0) {
    throw new Error(`Full runtime managed update probe is missing component(s): ${missing.join(', ')}.`);
  }
  return managedUpdate;
}

function assertAppStateProbe(payload: unknown): Record<string, unknown> {
  const root = objectValue(payload, 'app state payload');
  const appState = objectValue(root.app_state, 'app_state');
  if (appState.schema_version !== 'opl_app_state.v1') {
    throw new Error(`Full runtime App state probe returned unexpected schema: ${String(appState.schema_version)}`);
  }

  const modules = objectValue(appState.modules, 'app_state.modules');
  const moduleItems = arrayValue(modules.items, 'app_state.modules.items');
  if (moduleItems.length === 0) {
    throw new Error('Full runtime App state probe returned no module items.');
  }

  for (const item of moduleItems) {
    const record = objectValue(item, 'app_state.modules.items[]');
    stringValue(record.module_id, 'app_state.modules.items[].module_id');
    stringValue(record.health_status, `app_state.modules.items[${String(record.module_id)}].health_status`);
  }
  return appState;
}

export function assertFullRuntimeCurrentness(runtimeRoot: string, options: { frameworkRoot: string }) {
  const command = path.join(runtimeRoot, 'bin', 'opl');
  if (!fs.existsSync(command)) {
    throw new Error(`Full runtime currentness probe cannot find packaged opl wrapper: ${command}`);
  }

  const manifest = assertManifestFrameworkRef(runtimeRoot, options.frameworkRoot);
  const env = runtimeProbeEnv(runtimeRoot);
  const managedUpdate = assertManagedUpdateProbe(
    parseJsonCommand(command, ['update', 'status', '--json'], env),
  );
  const appState = assertAppStateProbe(
    parseJsonCommand(command, ['app', 'state', '--profile', 'fast', '--json'], env),
  );

  return {
    schema: 'opl_full_runtime_currentness_probe.v1',
    status: 'passed',
    runtime_root: runtimeRoot,
    framework_commit: stringValue(
      objectValue(objectValue(manifest.components, 'manifest.components').opl, 'manifest.components.opl').git_commit,
      'manifest.components.opl.git_commit',
    ),
    managed_update_surface_id: managedUpdate.surface_id,
    managed_update_components: REQUIRED_MANAGED_UPDATE_COMPONENTS,
    app_state_schema_version: appState.schema_version,
    app_state_module_count: arrayValue(objectValue(appState.modules, 'app_state.modules').items, 'app_state.modules.items').length,
  };
}
