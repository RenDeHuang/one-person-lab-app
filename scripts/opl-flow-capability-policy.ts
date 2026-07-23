import fs from 'node:fs';

type OplFlowCapability = {
  id?: unknown;
  kind?: unknown;
  online_install_default?: unknown;
  offline_bundle?: unknown;
};

type OplFlowPolicy = Record<string, any> & {
  schema?: unknown;
  package?: { id?: unknown };
  provides?: OplFlowCapability[];
  requires?: OplFlowCapability[];
  recommends?: OplFlowCapability[];
  compatible_optional?: OplFlowCapability[];
};

const supportedPolicySchemas = new Set([
  'opl_flow_workflow_policy.v1',
  'opl_flow_workflow_policy.v2',
]);

export function assertOplFlowCapabilityPolicy(policy: OplFlowPolicy, label: string): OplFlowPolicy {
  if (!supportedPolicySchemas.has(String(policy.schema)) || policy.package?.id !== 'opl-flow') {
    throw new Error(`Invalid OPL Flow workflow policy: ${label}`);
  }
  const declaredCapabilities = [
    ...(policy.provides ?? []),
    ...(policy.requires ?? []),
    ...(policy.recommends ?? []),
    ...(policy.compatible_optional ?? []),
  ];
  const identities = new Set<string>();
  for (const entry of declaredCapabilities) {
    if (typeof entry?.kind !== 'string' || !entry.kind || typeof entry?.id !== 'string' || !entry.id) {
      throw new Error(`OPL Flow capability declarations require non-empty kind and id: ${label}`);
    }
    const identity = `${entry.kind}\u0000${entry.id}`;
    if (identities.has(identity)) {
      throw new Error(`Duplicate OPL Flow capability identity (${entry.kind}, ${entry.id}): ${label}`);
    }
    identities.add(identity);
    if (entry.online_install_default === true && entry.offline_bundle !== 'full') {
      throw new Error(
        `OPL Flow default capability (${entry.kind}, ${entry.id}) must be embedded in Full for Standard/Full convergence`,
      );
    }
  }
  return policy;
}

export function readOplFlowCapabilityPolicy(policyPath: string): OplFlowPolicy {
  if (!fs.existsSync(policyPath)) {
    throw new Error(`OPL Flow workflow policy not found: ${policyPath}`);
  }
  return assertOplFlowCapabilityPolicy(JSON.parse(fs.readFileSync(policyPath, 'utf8')), policyPath);
}

export function resolveOplFlowFullSkillDependencyIds(policy: OplFlowPolicy): string[] {
  const dependencies = [...(policy.requires ?? []), ...(policy.recommends ?? [])];
  return [...new Set(dependencies
    .filter((entry) => (
      entry.kind === 'codex_skill' &&
      entry.online_install_default === true &&
      entry.offline_bundle === 'full'
    ))
    .map((entry) => String(entry.id)))];
}
