import fs from 'node:fs';
import path from 'node:path';
import type { ReleaseEvidenceCohort, UnknownReleaseEvidenceCohort } from './release-evidence-cohort.ts';

type ReleaseOwnerVerdictContract = {
  schema: string;
  scope: string;
  owner: string;
  release_cohort_required: boolean;
  ordinary_cockpit_excluded: boolean;
  accepted_output_ref_shapes: string[];
  pending_status: string;
  typed_blocker_status: string;
  pending_ref_template: string;
  release_owner_verdict_ref_template: string;
  release_ready_claim_allowed: boolean;
  stable_latest_promotion_claim_allowed: boolean;
  family_production_ready_claim_allowed: boolean;
  evidence_only_can_close_opl_app_release_user_path: boolean;
  next_owner_action: string;
  authority_boundary: Record<string, unknown>;
};

type BuildOptions = {
  contract: unknown;
  releaseCohort: ReleaseEvidenceCohort | UnknownReleaseEvidenceCohort;
  summaryStatus: string;
  failedRequiredGates: { id: string; status: string; reason?: string }[];
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

function renderTemplate(template: string, releaseCohort: ReleaseEvidenceCohort | UnknownReleaseEvidenceCohort) {
  const tag = releaseCohort.current_cohort_evidence === true ? releaseCohort.tag : 'unknown-cohort';
  return template.replaceAll('<tag>', tag);
}

export function readAppReleaseOwnerVerdictContract(appRoot: string) {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  return asRecord(releaseContract.operator_evidence_bundle?.release_owner_verdict, 'release_owner_verdict');
}

export function validateAppReleaseOwnerVerdictContract(contract: unknown): ReleaseOwnerVerdictContract {
  const record = asRecord(contract, 'release_owner_verdict');
  if (record.schema !== 'opl_app_release_owner_verdict_contract.v1') {
    throw new Error('App release owner verdict contract must use schema opl_app_release_owner_verdict_contract.v1');
  }
  if (record.scope !== 'same_cohort_app_release_user_path_owner_verdict') {
    throw new Error('App release owner verdict contract must stay scoped to same-cohort App release/user-path verdicts');
  }
  if (record.owner !== 'one-person-lab-app release owner') {
    throw new Error('App release owner verdict contract owner must be one-person-lab-app release owner');
  }
  if (record.release_cohort_required !== true || record.ordinary_cockpit_excluded !== true) {
    throw new Error('App release owner verdict contract must require release_cohort and stay out of ordinary cockpit');
  }
  const acceptedOutputRefShapes = stringArray(
    record.accepted_output_ref_shapes,
    'release_owner_verdict.accepted_output_ref_shapes',
  );
  for (const shape of [
    'release_owner_verdict_ref',
    'release_owner_receipt_ref',
    'release_owner_typed_blocker_ref',
    'typed_blocker_ref',
    'human_gate_ref',
  ]) {
    if (!acceptedOutputRefShapes.includes(shape)) {
      throw new Error(`App release owner verdict accepted output ref shapes must include ${shape}`);
    }
  }
  if (record.pending_status !== 'release_owner_verdict_pending') {
    throw new Error('App release owner verdict contract pending_status must be release_owner_verdict_pending');
  }
  if (record.typed_blocker_status !== 'release_owner_typed_blocker_required') {
    throw new Error('App release owner verdict contract typed_blocker_status must be release_owner_typed_blocker_required');
  }
  if (record.pending_ref_template !== 'typed_blocker_ref://one-person-lab-app/release-owner/<tag>/verdict-pending') {
    throw new Error('App release owner verdict pending_ref_template must be the stable typed blocker ref template');
  }
  if (record.release_owner_verdict_ref_template !== 'release_owner_verdict_ref://one-person-lab-app/release-owner/<tag>/<decision_id>') {
    throw new Error('App release owner verdict ref template must include tag and decision id placeholders');
  }
  if (
    record.release_ready_claim_allowed !== false
    || record.stable_latest_promotion_claim_allowed !== false
    || record.family_production_ready_claim_allowed !== false
    || record.evidence_only_can_close_opl_app_release_user_path !== false
  ) {
    throw new Error('App release owner verdict contract must not turn evidence into release-ready or production-ready claims');
  }
  if (typeof record.next_owner_action !== 'string' || !record.next_owner_action.trim()) {
    throw new Error('App release owner verdict contract must include next_owner_action');
  }
  const authorityBoundary = asRecord(record.authority_boundary, 'release_owner_verdict.authority_boundary');
  for (const [key, expected] of Object.entries({
    can_claim_app_release_ready_from_evidence: false,
    can_claim_stable_latest_from_evidence: false,
    can_claim_family_production_ready: false,
    can_write_domain_truth: false,
    can_sign_domain_owner_receipt: false,
  })) {
    if (authorityBoundary[key] !== expected) {
      throw new Error(`App release owner verdict authority boundary ${key} must be ${String(expected)}`);
    }
  }
  return {
    schema: record.schema as string,
    scope: record.scope as string,
    owner: record.owner as string,
    release_cohort_required: record.release_cohort_required as boolean,
    ordinary_cockpit_excluded: record.ordinary_cockpit_excluded as boolean,
    accepted_output_ref_shapes: acceptedOutputRefShapes,
    pending_status: record.pending_status as string,
    typed_blocker_status: record.typed_blocker_status as string,
    pending_ref_template: record.pending_ref_template as string,
    release_owner_verdict_ref_template: record.release_owner_verdict_ref_template as string,
    release_ready_claim_allowed: record.release_ready_claim_allowed as boolean,
    stable_latest_promotion_claim_allowed: record.stable_latest_promotion_claim_allowed as boolean,
    family_production_ready_claim_allowed: record.family_production_ready_claim_allowed as boolean,
    evidence_only_can_close_opl_app_release_user_path:
      record.evidence_only_can_close_opl_app_release_user_path as boolean,
    next_owner_action: record.next_owner_action as string,
    authority_boundary: authorityBoundary,
  };
}

export function buildAppReleaseOwnerVerdictReadout(options: BuildOptions) {
  const contract = validateAppReleaseOwnerVerdictContract(options.contract);
  const sameCohortEvidencePassed = (
    options.summaryStatus === 'passed'
    && options.releaseCohort.current_cohort_evidence === true
    && options.failedRequiredGates.length === 0
  );
  const status = sameCohortEvidencePassed
    ? contract.pending_status
    : contract.typed_blocker_status;
  const releaseOwnerTypedBlockerRef = renderTemplate(contract.pending_ref_template, options.releaseCohort);
  const evidenceRefs = options.releaseCohort.current_cohort_evidence === true
    ? [
        `release_readiness_summary_ref://one-person-lab-app/${options.releaseCohort.tag}`,
        `operator_evidence_bundle_ref://one-person-lab-app/${options.releaseCohort.tag}`,
        `remote_release_verification_ref://one-person-lab-app/${options.releaseCohort.tag}`,
      ]
    : ['release_readiness_summary_ref://one-person-lab-app/unknown-cohort'];

  return {
    schema: 'opl_app_release_owner_verdict_readout.v1',
    scope: contract.scope,
    owner: contract.owner,
    status,
    release_cohort: options.releaseCohort,
    same_cohort_evidence_status: sameCohortEvidencePassed
      ? 'same_cohort_evidence_passed_owner_verdict_pending'
      : 'same_cohort_evidence_incomplete_or_blocked',
    release_ready_claim: false,
    stable_latest_promotion_claim: false,
    family_production_ready_claim: false,
    release_owner_verdict_ref: null,
    release_owner_typed_blocker_ref: releaseOwnerTypedBlockerRef,
    typed_blocker_ref: releaseOwnerTypedBlockerRef,
    blocker_kind: sameCohortEvidencePassed
      ? 'release_owner_verdict_required'
      : 'same_cohort_release_evidence_incomplete_or_blocked',
    reason: sameCohortEvidencePassed
      ? 'Same-cohort release/user-path evidence is present, but App release ready still requires an explicit App release owner verdict or promotion receipt.'
      : 'Same-cohort release/user-path evidence is incomplete or blocked; App release owner must record a typed blocker or rerun the missing gates.',
    evidence_refs: evidenceRefs,
    blocked_by_required_gate_ids: options.failedRequiredGates.map((gate) => gate.id),
    accepted_ref_shapes: contract.accepted_output_ref_shapes,
    next_owner_action: contract.next_owner_action,
    can_close_opl_app_release_user_path: false,
    authority_boundary: contract.authority_boundary,
  };
}
