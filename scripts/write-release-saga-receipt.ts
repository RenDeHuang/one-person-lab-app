#!/usr/bin/env node

import fs from 'node:fs';
import { parseArgs } from 'node:util';
import crypto from 'node:crypto';
import { sha256File } from './build-artifact-cohort.ts';
import type { HomebrewActivationReceiptV2, PromotionSagaReceiptV2 } from './release-saga-receipts.ts';

const { values } = parseArgs({
  options: {
    kind: { type: 'string' }, output: { type: 'string' }, 'stable-session-id': { type: 'string' }, version: { type: 'string' },
    'distribution-receipt': { type: 'string', default: '' }, 'standard-evidence': { type: 'string', default: '' },
    'standard-evidence-ref': { type: 'string', default: '' }, 'standard-run-id': { type: 'string', default: '' },
    'homebrew-activation-receipt': { type: 'string', default: '' },
    'workflow-run-id': { type: 'string', default: '' }, 'workflow-run-attempt': { type: 'string', default: '' },
    'release-attempt-id': { type: 'string', default: '' }, 'controller-workflow-sha': { type: 'string', default: '' },
    'source-release-run-id': { type: 'string', default: '' }, 'standard-qualification-run-id': { type: 'string', default: '' },
    'release-cohort-ref': { type: 'string', default: '' }, 'app-sha': { type: 'string', default: '' },
    'shell-sha': { type: 'string', default: '' }, 'framework-sha': { type: 'string', default: '' },
    'release-set-generation': { type: 'string', default: '' }, 'release-set-manifest-digest': { type: 'string', default: '' },
    'release-owner-receipt-ref': { type: 'string', default: '' },
  },
  strict: true,
});
for (const key of ['kind', 'output', 'stable-session-id', 'version'] as const) {
  if (!values[key]) throw new Error(`Missing --${key}`);
}

let receipt: HomebrewActivationReceiptV2 | PromotionSagaReceiptV2;
if (values.kind === 'homebrew-activation') {
  for (const key of ['distribution-receipt', 'standard-evidence', 'standard-evidence-ref', 'standard-run-id'] as const) {
    if (!values[key]) throw new Error(`Missing --${key}`);
  }
  receipt = {
    schema: 'opl_app_homebrew_activation_receipt.v2', status: 'verified',
    stable_session_id: values['stable-session-id']!, version: values.version!,
    distribution_receipt_sha256: sha256File(values['distribution-receipt']!),
    standard: {
      package_profile: 'homebrew-standard', run_id: values['standard-run-id']!,
      evidence_ref: values['standard-evidence-ref']!, evidence_sha256: sha256File(values['standard-evidence']!), result: 'passed',
    },
  };
} else if (values.kind === 'promotion-saga') {
  for (const key of [
    'distribution-receipt', 'homebrew-activation-receipt', 'standard-run-id', 'workflow-run-id',
    'workflow-run-attempt', 'release-attempt-id', 'controller-workflow-sha', 'source-release-run-id',
    'standard-qualification-run-id', 'release-cohort-ref', 'app-sha', 'shell-sha', 'framework-sha',
    'release-set-generation', 'release-set-manifest-digest', 'release-owner-receipt-ref',
  ] as const) {
    if (!values[key]) throw new Error(`Missing --${key}`);
  }
  const distributionBytes = fs.readFileSync(values['distribution-receipt']!);
  const distributionReceipt = JSON.parse(distributionBytes.toString('utf8')) as {
    release_set?: { generation?: unknown; manifest_digest?: unknown };
  };
  if (
    distributionReceipt.release_set?.generation !== values['release-set-generation'] ||
    distributionReceipt.release_set?.manifest_digest !== values['release-set-manifest-digest']
  ) {
    throw new Error('Distribution receipt does not match the exact Release Set generation and digest.');
  }
  receipt = {
    schema: 'opl_app_promotion_saga_receipt.v2', status: 'verified',
    stable_session_id: values['stable-session-id']!, version: values.version!,
    release: { repo: 'gaofeng21cn/one-person-lab-app', tag: `v${values.version}`, public: true, latest: true },
    provenance: {
      workflow_run_id: values['workflow-run-id']!, workflow_run_attempt: 1,
      release_attempt_id: values['release-attempt-id']!,
      controller_workflow_sha: values['controller-workflow-sha']!,
      source_release_run_id: values['source-release-run-id']!,
      standard_qualification_run_id: values['standard-qualification-run-id']!,
    },
    cohort: {
      release_cohort_ref: values['release-cohort-ref']!, app_sha: values['app-sha']!,
      shell_sha: values['shell-sha']!, framework_sha: values['framework-sha']!,
      release_set_generation: values['release-set-generation']!,
      release_set_manifest_digest: values['release-set-manifest-digest']!,
    },
    release_owner: { receipt_ref: values['release-owner-receipt-ref']! },
    distribution: {
      receipt_ref: 'opl-stable-distribution-receipt.json',
      receipt_sha256: crypto.createHash('sha256').update(distributionBytes).digest('hex'),
      release_set_generation: values['release-set-generation']!,
      release_set_manifest_digest: values['release-set-manifest-digest']!,
    },
    homebrew_activation: {
      receipt_ref: 'opl-app-homebrew-activation-receipt.json',
      receipt_sha256: sha256File(values['homebrew-activation-receipt']!),
      standard_vm_run_id: values['standard-run-id']!,
    },
    stages: [
      { id: 'release_public_nonlatest', status: 'verified' },
      { id: 'distribution_synced', status: 'verified' },
      { id: 'homebrew_verified', status: 'verified' },
      { id: 'latest_activated', status: 'verified' },
    ],
  };
} else {
  throw new Error('--kind must be homebrew-activation or promotion-saga');
}
fs.writeFileSync(values.output!, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ status: 'written', kind: values.kind, output: values.output })}\n`);
