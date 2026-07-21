import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const workflowRoot = path.join(process.cwd(), '.github', 'workflows');

test('VM finalizer skips absent source artifacts and always has typed receipt paths', () => {
  const workflow = fs.readFileSync(path.join(workflowRoot, 'opl-first-run-vm.yml'), 'utf8');
  const downloadMarker = '      - name: Download exact source artifact manifest without making it a receipt prerequisite';
  const receiptMarker = '      - name: Write durable typed attempt receipt';
  const downloadStart = workflow.indexOf(downloadMarker);
  const receiptStart = workflow.indexOf(receiptMarker);
  assert.ok(downloadStart >= 0 && receiptStart > downloadStart);
  const download = workflow.slice(downloadStart, workflow.indexOf('\n      - name:', downloadStart + downloadMarker.length));
  const receipt = workflow.slice(receiptStart, workflow.indexOf('\n      - name:', receiptStart + receiptMarker.length));

  assert.match(download, /if: \$\{\{ inputs\.release_artifact_name != '' && inputs\.release_artifact_run_id != '' \}\}/);
  assert.match(download, /run-id: \$\{\{ inputs\.release_artifact_run_id \}\}/);
  assert.match(receipt, /mkdir -p recovered-artifact-manifest recovered-vm-evidence/);
  assert.equal((receipt.match(/-print -quit 2>\/dev\/null \|\| true/g) || []).length, 4);
  assert.match(receipt, /-name vm-gate-failure-summary\.json/);
  assert.match(receipt, /--critical-diagnostics "\$critical_diagnostics"/);
});
