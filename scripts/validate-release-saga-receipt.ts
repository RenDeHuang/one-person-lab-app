#!/usr/bin/env node

import { parseArgs } from 'node:util';
import {
  readReceipt,
  validateHomebrewActivationReceipt,
  validateLocalActivationReceipt,
  validatePromotionSagaReceipt,
  validateStableDistributionReceipt,
} from './release-saga-receipts.ts';

const { values } = parseArgs({
  options: {
    kind: { type: 'string' }, receipt: { type: 'string' }, 'stable-session-id': { type: 'string' },
    version: { type: 'string' }, 'release-cohort-ref': { type: 'string', default: '' },
    'app-sha': { type: 'string', default: '' }, 'shell-sha': { type: 'string', default: '' },
    'framework-sha': { type: 'string', default: '' }, 'source-release-run-id': { type: 'string', default: '' },
    'release-set-generation': { type: 'string', default: '' }, 'release-set-manifest-digest': { type: 'string', default: '' },
    'standard-vm-run-id': { type: 'string', default: '' }, 'distribution-receipt-sha256': { type: 'string', default: '' },
    'artifact-sha256': { type: 'string', default: '' },
    'local-authorization-policy': { type: 'string', default: '' },
    'promotion-run-id': { type: 'string', default: '' }, 'promotion-run-attempt': { type: 'string', default: '' },
    'promotion-attempt-id': { type: 'string', default: '' }, 'controller-workflow-sha': { type: 'string', default: '' },
    'release-owner-receipt-ref': { type: 'string', default: '' },
  },
  strict: true,
});
for (const key of ['kind', 'receipt', 'stable-session-id', 'version'] as const) {
  if (!values[key]) throw new Error(`Missing --${key}`);
}
const expected = {
  stableSessionId: values['stable-session-id']!, version: values.version!,
  releaseCohortRef: values['release-cohort-ref'] || undefined, appSha: values['app-sha'] || undefined,
  shellSha: values['shell-sha'] || undefined, frameworkSha: values['framework-sha'] || undefined,
  releaseSetGeneration: values['release-set-generation'] || undefined,
  releaseSetManifestDigest: values['release-set-manifest-digest'] || undefined,
  sourceReleaseRunId: values['source-release-run-id'] || undefined, standardVmRunId: values['standard-vm-run-id'] || undefined,
  promotionRunId: values['promotion-run-id'] || undefined,
  promotionRunAttempt: values['promotion-run-attempt'] ? Number(values['promotion-run-attempt']) : undefined,
  promotionAttemptId: values['promotion-attempt-id'] || undefined,
  controllerWorkflowSha: values['controller-workflow-sha'] || undefined,
  ownerReceiptRef: values['release-owner-receipt-ref'] || undefined,
};
const receipt = readReceipt(values.receipt!);
let errors: string[];
if (values.kind === 'distribution') errors = validateStableDistributionReceipt(receipt, expected);
else if (values.kind === 'homebrew-activation') errors = validateHomebrewActivationReceipt(receipt, { ...expected, distributionReceiptSha256: values['distribution-receipt-sha256']! });
else if (values.kind === 'local-activation') errors = validateLocalActivationReceipt(receipt, {
  ...expected,
  artifactSha256: values['artifact-sha256'] || undefined,
  localAuthorizationPolicyPath: values['local-authorization-policy'] || undefined,
});
else if (values.kind === 'promotion-saga') errors = validatePromotionSagaReceipt(receipt, expected);
else throw new Error('--kind must be distribution, homebrew-activation, promotion-saga, or local-activation');
if (errors.length > 0) throw new Error(`${values.kind} receipt invalid: ${errors.join('; ')}`);
process.stdout.write(`${JSON.stringify({ status: 'verified', kind: values.kind, receipt: values.receipt })}\n`);
