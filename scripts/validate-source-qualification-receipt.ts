#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { validateSourceQualificationReceipt } from './source-qualification-receipt.ts';

const { values } = parseArgs({
  options: {
    receipt: { type: 'string' },
    'expected-digest': { type: 'string' },
    'expected-run-id': { type: 'string' },
    'expected-head-sha': { type: 'string' },
  },
  strict: true,
});

if (!values.receipt) throw new Error('Missing --receipt');
const receiptPath = path.resolve(values.receipt);
const receipt = validateSourceQualificationReceipt(
  JSON.parse(fs.readFileSync(receiptPath, 'utf8')),
  {
    digest: values['expected-digest'],
    runId: values['expected-run-id'],
    headSha: values['expected-head-sha'],
  },
);

process.stdout.write(`${JSON.stringify({
  status: 'passed',
  receipt: receiptPath,
  receipt_digest: receipt.receipt_digest,
  run_id: receipt.execution.run_id,
  cohort: receipt.cohort,
})}\n`);
