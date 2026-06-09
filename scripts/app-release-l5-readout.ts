import fs from 'node:fs';
import path from 'node:path';
import type { ReleaseEvidenceCohort, UnknownReleaseEvidenceCohort } from './release-evidence-cohort.ts';

type RefShape = string;

type L5EvidenceClassContract = {
  class_id: string;
  accepted_ref_shapes: RefShape[];
  artifact_ids?: string[];
  gate_ids?: string[];
  owner_acceptance_required?: boolean;
};

type L5ReadoutContract = {
  schema: string;
  scope: string;
  framework_l5_contract_ref: string;
  target_l5_module: string;
  ordinary_cockpit_excluded: boolean;
  ordinary_cockpit_policy_ref: string;
  forbidden_default_surfaces: string[];
  release_ready_claim_allowed: boolean;
  family_l5_claim_allowed: boolean;
  evidence_classes: L5EvidenceClassContract[];
};

type ArtifactState = {
  id: string;
  status: string;
  typed_blocker_ref?: string;
};

type GateState = {
  status: string;
  required?: boolean;
  reason?: string;
};

type ExistingClassReadout = {
  class_id?: string;
  status?: string;
  present_artifact_ids?: string[];
  missing_artifact_ids?: string[];
  blocked_artifact_ids?: string[];
  typed_blocker_refs?: string[];
};

type BuildOptions = {
  contract: unknown;
  artifacts?: ArtifactState[];
  gates?: Record<string, GateState>;
  upstreamReadout?: Record<string, unknown> | null;
  releaseCohort?: ReleaseEvidenceCohort | UnknownReleaseEvidenceCohort;
};

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function stringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new Error(`${label} must be a non-empty string array.`);
  }
  return value as string[];
}

export function readAppReleaseL5ReadoutContract(appRoot: string) {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  return asRecord(releaseContract.operator_evidence_bundle?.l5_evidence_readout, 'l5_evidence_readout');
}

export function validateAppReleaseL5ReadoutContract(contract: unknown): L5ReadoutContract {
  const record = asRecord(contract, 'l5_evidence_readout');
  if (record.schema !== 'opl_app_release_l5_evidence_readout_contract.v1') {
    throw new Error('App release L5 readout contract must use schema opl_app_release_l5_evidence_readout_contract.v1');
  }
  if (record.scope !== 'app_release_user_path_evidence_for_opl_console_l5_input') {
    throw new Error('App release L5 readout contract must stay scoped to App release/user-path evidence');
  }
  if (record.framework_l5_contract_ref !== 'one-person-lab/contracts/opl-framework/brand-module-l5-operating-evidence.json') {
    throw new Error('App release L5 readout contract must point at the OPL brand-module L5 evidence contract');
  }
  if (record.target_l5_module !== 'opl_console') {
    throw new Error('App release L5 readout contract must target the OPL Console L5 input only');
  }
  if (record.ordinary_cockpit_excluded !== true) {
    throw new Error('App release L5 evidence readout must be excluded from the ordinary cockpit');
  }
  if (record.ordinary_cockpit_policy_ref !== 'contracts/app-gui-product-contract.json#ordinary_cockpit_surface_budget') {
    throw new Error('App release L5 readout must reference the ordinary cockpit surface budget');
  }
  if (record.release_ready_claim_allowed !== false || record.family_l5_claim_allowed !== false) {
    throw new Error('App release L5 readout must not authorize release-ready or family L5 claims');
  }
  const forbiddenDefaultSurfaces = stringArray(record.forbidden_default_surfaces, 'l5_evidence_readout.forbidden_default_surfaces');
  for (const surface of ['guid_home', 'ordinary_conversation', 'runtime_default_cockpit', 'settings_general']) {
    if (!forbiddenDefaultSurfaces.includes(surface)) {
      throw new Error(`App release L5 readout must keep ${surface} out of default surfaces`);
    }
  }
  if (!Array.isArray(record.evidence_classes)) {
    throw new Error('App release L5 readout contract must declare evidence_classes');
  }
  const classes = record.evidence_classes.map((entry, index) => {
    const evidenceClass = asRecord(entry, `l5_evidence_readout.evidence_classes[${index}]`);
    if (typeof evidenceClass.class_id !== 'string' || !evidenceClass.class_id.trim()) {
      throw new Error('App release L5 evidence class must include class_id');
    }
    return {
      class_id: evidenceClass.class_id,
      accepted_ref_shapes: stringArray(evidenceClass.accepted_ref_shapes, `${evidenceClass.class_id}.accepted_ref_shapes`),
      artifact_ids: Array.isArray(evidenceClass.artifact_ids)
        ? stringArray(evidenceClass.artifact_ids, `${evidenceClass.class_id}.artifact_ids`)
        : [],
      gate_ids: Array.isArray(evidenceClass.gate_ids)
        ? stringArray(evidenceClass.gate_ids, `${evidenceClass.class_id}.gate_ids`)
        : [],
      owner_acceptance_required: evidenceClass.owner_acceptance_required === true,
    };
  });
  const classIds = classes.map((entry) => entry.class_id);
  for (const required of [
    'live_user_path',
    'cross_agent_scaleout',
    'long_soak_recovery',
    'release_install_evidence',
    'operator_repair_loop',
    'owner_acceptance',
    'no_second_truth_regression',
  ]) {
    if (!classIds.includes(required)) {
      throw new Error(`App release L5 readout contract is missing evidence class ${required}`);
    }
  }
  return {
    schema: record.schema as string,
    scope: record.scope as string,
    framework_l5_contract_ref: record.framework_l5_contract_ref as string,
    target_l5_module: record.target_l5_module as string,
    ordinary_cockpit_excluded: record.ordinary_cockpit_excluded as boolean,
    ordinary_cockpit_policy_ref: record.ordinary_cockpit_policy_ref as string,
    forbidden_default_surfaces: forbiddenDefaultSurfaces,
    release_ready_claim_allowed: record.release_ready_claim_allowed as boolean,
    family_l5_claim_allowed: record.family_l5_claim_allowed as boolean,
    evidence_classes: classes,
  };
}

function upstreamClassById(upstreamReadout: Record<string, unknown> | null | undefined) {
  const classes = Array.isArray(upstreamReadout?.evidence_classes)
    ? upstreamReadout.evidence_classes
    : [];
  const result = new Map<string, ExistingClassReadout>();
  for (const entry of classes) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as ExistingClassReadout;
    if (typeof record.class_id === 'string') result.set(record.class_id, record);
  }
  return result;
}

function arrayOrEmpty(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

export function buildAppReleaseL5EvidenceReadout(options: BuildOptions) {
  const contract = validateAppReleaseL5ReadoutContract(options.contract);
  const artifactById = new Map((options.artifacts ?? []).map((artifact) => [artifact.id, artifact]));
  const upstreamClasses = upstreamClassById(options.upstreamReadout);
  const gates = options.gates ?? {};
  const failedRequiredGateIds = Object.entries(gates)
    .filter(([, gate]) => gate.required !== false && gate.status !== 'passed')
    .map(([id]) => id);

  const evidenceClasses = contract.evidence_classes.map((evidenceClass) => {
    const upstream = upstreamClasses.get(evidenceClass.class_id);
    const presentArtifactIds = new Set(arrayOrEmpty(upstream?.present_artifact_ids));
    const missingArtifactIds = new Set(arrayOrEmpty(upstream?.missing_artifact_ids));
    const blockedArtifactIds = new Set(arrayOrEmpty(upstream?.blocked_artifact_ids));
    const typedBlockerRefs = new Set(arrayOrEmpty(upstream?.typed_blocker_refs));

    for (const artifactId of evidenceClass.artifact_ids ?? []) {
      const artifact = artifactById.get(artifactId);
      if (!artifact) continue;
      if (artifact.status === 'present') presentArtifactIds.add(artifactId);
      else if (artifact.status === 'typed_blocker' && artifact.typed_blocker_ref) {
        blockedArtifactIds.add(artifactId);
        typedBlockerRefs.add(artifact.typed_blocker_ref);
      } else {
        missingArtifactIds.add(artifactId);
      }
    }

    const presentGateIds: string[] = [];
    const missingGateIds: string[] = [];
    for (const gateId of evidenceClass.gate_ids ?? []) {
      const gate = gates[gateId];
      if (!gate) continue;
      if (gate.status === 'passed') presentGateIds.push(gateId);
      else if (gate.required !== false) missingGateIds.push(gateId);
    }

    let status = 'present';
    if (blockedArtifactIds.size > 0 || upstream?.status === 'blocked_evidence') {
      status = 'blocked_evidence';
    } else if (missingArtifactIds.size > 0 || missingGateIds.length > 0 || upstream?.status === 'missing_evidence') {
      status = 'missing_evidence';
    } else if (evidenceClass.owner_acceptance_required || upstream?.status === 'owner_acceptance_ref_required') {
      status = 'owner_acceptance_ref_required';
    } else if (
      presentArtifactIds.size === 0 &&
      presentGateIds.length === 0 &&
      (evidenceClass.artifact_ids ?? []).length === 0 &&
      (evidenceClass.gate_ids ?? []).length === 0
    ) {
      status = 'missing_evidence';
    }

    return {
      class_id: evidenceClass.class_id,
      status,
      accepted_ref_shapes: evidenceClass.accepted_ref_shapes,
      closeable_by: evidenceClass.accepted_ref_shapes,
      artifact_ids: evidenceClass.artifact_ids ?? [],
      gate_ids: evidenceClass.gate_ids ?? [],
      present_artifact_ids: [...presentArtifactIds],
      missing_artifact_ids: [...missingArtifactIds],
      blocked_artifact_ids: [...blockedArtifactIds],
      typed_blocker_refs: [...typedBlockerRefs],
      present_gate_ids: presentGateIds,
      missing_gate_ids: missingGateIds,
    };
  });

  return {
    schema: 'opl_app_release_l5_evidence_readout.v1',
    scope: contract.scope,
    framework_l5_contract_ref: contract.framework_l5_contract_ref,
    target_l5_module: contract.target_l5_module,
    release_ready_claim: false,
    family_l5_claim: false,
    app_release_evidence_is_l5_input_only: true,
    ordinary_cockpit_excluded: contract.ordinary_cockpit_excluded,
    ordinary_cockpit_policy_ref: contract.ordinary_cockpit_policy_ref,
    forbidden_default_surfaces: contract.forbidden_default_surfaces,
    release_cohort: options.releaseCohort,
    current_cohort_evidence: options.releaseCohort?.current_cohort_evidence === true,
    failed_required_gate_ids: failedRequiredGateIds,
    accepted_ref_shapes_by_class: Object.fromEntries(
      contract.evidence_classes.map((entry) => [entry.class_id, entry.accepted_ref_shapes]),
    ),
    evidence_classes: evidenceClasses,
    missing_current_cohort_evidence: evidenceClasses
      .filter((entry) => entry.status !== 'present')
      .map((entry) => ({
        class_id: entry.class_id,
        status: entry.status,
        missing_artifact_ids: entry.missing_artifact_ids,
        blocked_artifact_ids: entry.blocked_artifact_ids,
        missing_gate_ids: entry.missing_gate_ids,
        closeable_by: entry.closeable_by,
      })),
  };
}
