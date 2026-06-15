import { assert } from './helpers-core.ts';

export function workflowStepBlock(workflow, stepName) {
  const escaped = stepName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = workflow.match(new RegExp(`\\n\\s+- name: ${escaped}[\\s\\S]*?(?=\\n\\s+- name: |$)`));
  assert.ok(match, `workflow must include step: ${stepName}`);
  return match[0];
}

export function workflowJobBlock(workflow, jobName) {
  const escaped = jobName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = workflow.match(new RegExp(`\\n  ${escaped}:\\n[\\s\\S]*?(?=\\n  [a-zA-Z0-9_-]+:\\n|\\n[^\\s]|$)`));
  assert.ok(match, `workflow must include job: ${jobName}`);
  return match[0];
}
