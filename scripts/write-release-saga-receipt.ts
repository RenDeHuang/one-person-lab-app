#!/usr/bin/env node

import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { sha256File } from './build-artifact-cohort.ts';
import type { HomebrewActivationReceiptV2, PromotionSagaReceiptV2 } from './release-saga-receipts.ts';

const { values } = parseArgs({
  options: {
    kind: { type: 'string' }, output: { type: 'string' }, 'stable-session-id': { type: 'string' }, version: { type: 'string' },
    'distribution-receipt': { type: 'string', default: '' }, 'standard-evidence': { type: 'string', default: '' },
    'standard-evidence-ref': { type: 'string', default: '' }, 'standard-run-id': { type: 'string', default: '' },
    'homebrew-activation-receipt': { type: 'string', default: '' },
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
  for (const key of ['distribution-receipt', 'homebrew-activation-receipt', 'standard-run-id'] as const) {
    if (!values[key]) throw new Error(`Missing --${key}`);
  }
  receipt = {
    schema: 'opl_app_promotion_saga_receipt.v2', status: 'verified',
    stable_session_id: values['stable-session-id']!, version: values.version!,
    release: { repo: 'gaofeng21cn/one-person-lab-app', tag: `v${values.version}`, public: true, latest: true },
    distribution: { receipt_ref: 'opl-stable-distribution-receipt.json', receipt_sha256: sha256File(values['distribution-receipt']!) },
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
