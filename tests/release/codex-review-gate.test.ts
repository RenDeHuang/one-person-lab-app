import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

import {
  evaluateCodexReviewGate,
  finalizeCodexReviewGateResult,
  isCodexReviewAdvisoryFailure,
} from '../../scripts/codex-review-gate.ts';

const headSha = 'a'.repeat(40);
const bot = 'chatgpt-codex-connector[bot]';

function cleanIssueComment(
  reviewedCommit = headSha.slice(0, 10),
  author = bot,
): { user: { login: string }; body: string } {
  return {
    user: { login: author },
    body: `Codex Review: Didn't find any major issues. :tada:\n\n**Reviewed commit:** \`${reviewedCommit}\``,
  };
}

test('Codex review gate waits until the current head has terminal review evidence', () => {
  const result = evaluateCodexReviewGate({
    headSha,
    reviews: [{ user: { login: bot }, commit_id: 'b'.repeat(40) }],
    reviewThreads: [],
  });
  assert.equal(result.status, 'waiting');
});

test('Codex review gate fails only for unresolved current bot threads', () => {
  const result = evaluateCodexReviewGate({
    headSha,
    reviews: [{ user: { login: bot }, commit_id: headSha }],
    reviewThreads: [
      { isResolved: false, isOutdated: false, comments: [{ author: { login: bot } }] },
      { isResolved: false, isOutdated: true, comments: [{ author: { login: bot } }] },
      { isResolved: false, isOutdated: false, comments: [{ author: { login: 'other-reviewer' } }] },
    ],
  });
  assert.equal(result.status, 'failed');
  assert.match(result.summary, /1 unresolved current review thread/);
});

test('Codex review gate accepts a current review without open threads', () => {
  const reviewed = evaluateCodexReviewGate({
    headSha,
    reviews: [{ user: { login: bot }, commit_id: headSha }],
    reviewThreads: [{ isResolved: true, isOutdated: false, comments: [{ author: { login: bot } }] }],
  });
  assert.equal(reviewed.status, 'passed');
});

test('Codex review gate accepts one connector-authored exact-head clean issue comment and still inspects threads', () => {
  const reviewed = evaluateCodexReviewGate({
    headSha,
    reviews: [],
    issueComments: [cleanIssueComment()],
    reviewThreads: [],
  });
  assert.equal(reviewed.status, 'passed');

  const unresolved = evaluateCodexReviewGate({
    headSha,
    reviews: [],
    issueComments: [cleanIssueComment()],
    reviewThreads: [{ isResolved: false, isOutdated: false, comments: [{ author: { login: bot } }] }],
  });
  assert.equal(unresolved.status, 'failed');
});

test('Codex review gate rejects stale, foreign, and ambiguous clean issue comments', () => {
  const stale = evaluateCodexReviewGate({
    headSha,
    reviews: [],
    issueComments: [cleanIssueComment('b'.repeat(10))],
    reviewThreads: [],
  });
  assert.equal(stale.status, 'waiting');

  const foreign = evaluateCodexReviewGate({
    headSha,
    reviews: [],
    issueComments: [cleanIssueComment(headSha.slice(0, 10), 'other-reviewer')],
    reviewThreads: [],
  });
  assert.equal(foreign.status, 'waiting');

  const ambiguous = evaluateCodexReviewGate({
    headSha,
    reviews: [],
    issueComments: [cleanIssueComment(), cleanIssueComment()],
    reviewThreads: [],
  });
  assert.equal(ambiguous.status, 'waiting');
  assert.match(ambiguous.summary, /ambiguous/);
});

test('Codex review gate treats missing immutable review evidence as advisory-inconclusive after waiting', () => {
  const waiting = evaluateCodexReviewGate({
    headSha,
    reviews: [],
    reviewThreads: [],
  });
  const terminal = finalizeCodexReviewGateResult(waiting, 900);
  assert.equal(terminal.status, 'inconclusive');
  assert.match(terminal.summary, /reaction-only evidence is intentionally inconclusive/);
  assert.equal(isCodexReviewAdvisoryFailure(terminal), false);
});

test('Codex review advisory is read-only and never becomes a required-check writer', () => {
  const source = fs.readFileSync(path.join(process.cwd(), '.github', 'workflows', 'codex-review-gate.yml'), 'utf8');
  const workflow = parseYaml(source) as Record<string, any>;
  assert.ok(workflow.on.pull_request_target);
  assert.ok(workflow.on.pull_request_review);
  assert.ok(workflow.on.workflow_dispatch.inputs.pull_number.required);
  assert.equal(workflow.permissions.checks, undefined);
  assert.equal(workflow.permissions.issues, 'read');
  assert.match(workflow.jobs.gate.if, /pull_request\.draft/);
  assert.equal(workflow.jobs.gate.name, 'Codex review advisory');
  assert.equal(workflow.jobs.gate.steps[0].with.ref, '${{ github.event.repository.default_branch }}');
  assert.match(source, /CODEX_REVIEW_WAIT_SECONDS/);
  assert.match(source, /github\.event_name == 'workflow_dispatch' && '0' \|\| '900'/);
  assert.match(source, /scripts\/codex-review-gate\.ts/);
  const gateSource = fs.readFileSync(path.join(process.cwd(), 'scripts', 'codex-review-gate.ts'), 'utf8');
  assert.doesNotMatch(gateSource, /issues\/comments\/.*\/reactions/);
  assert.doesNotMatch(gateSource, /check-runs/);
  assert.doesNotMatch(gateSource, /codex-review-head/);
  assert.match(gateSource, /issues\/\$\{pullNumber\}\/comments/);
  assert.match(gateSource, /exact-head clean issue comment/);
  assert.match(source, /pull_request_target/);
});
