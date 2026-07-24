import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const appRoot = path.resolve(import.meta.dirname, '../..');
const agents = fs.readFileSync(path.join(appRoot, 'AGENTS.md'), 'utf8');
const releaseGuide = fs.readFileSync(
  path.join(appRoot, 'docs', 'delivery', 'release', 'README.md'),
  'utf8',
);

test('repo instructions keep Framework checkpoint as the only live release state authority', () => {
  assert.match(agents, /唯一状态权威是 Framework `opl release`/);
  assert.match(agents, /portable checkpoint 和 receipt/);
  assert.match(agents, /不得复制 checkpoint schema、状态机、skip\/idempotency 或 reconciliation 语义/);
  assert.match(agents, /completed stage 由 Framework 判定并保持 `rebuild_performed=false`/);
});

test('repo instructions expose only the three Stable operations and validation-only Canary', () => {
  assert.match(agents, /`standard`、`resume_standard`、`append_full` 三种 operation/);
  assert.match(agents, /Canary 必须以 validation-only 模式真实启动上层及低层 reusable topology/);
  assert.match(agents, /不继承发布 secrets/);
  assert.match(agents, /不得执行 build、VM、外部写入或 Stable mutation/);
});

test('repo instructions and release guide separate WebUI development validation from production order', () => {
  for (const text of [agents, releaseGuide]) {
    assert.match(text, /development_validation/);
    assert.match(text, /production_release/);
    assert.match(text, /release-webui-development\.yml/);
    assert.match(text, /release-webui-follower\.yml/);
    assert.match(text, /Desktop Latest/);
  }
  assert.match(agents, /可在 Desktop Latest 前独立验证并公开交付 WebUI/);
  assert.match(agents, /开发 receipt 不得冒充 production Latest 或 follower handoff/);
  assert.match(releaseGuide, /may build, qualify,\s+publish, and promote the WebUI before Desktop Latest/);
  assert.match(releaseGuide, /receipt does not satisfy\s+production Latest or follower handoff/);
  assert.match(releaseGuide, /promotion-only\s+delivery bridge/);
});

test('repo instructions retire broker session and operator mutation authority', () => {
  assert.match(agents, /旧 broker、session、operator 仅允许读取和解释历史 receipt/);
  assert.match(agents, /不得提供新 admission、dispatch、cancel、promote、resume、reconcile 或 mutation CLI/);
  assert.match(agents, /未知时只能 fresh inspect 后调用 Framework reconcile/);
  assert.match(agents, /禁止 redispatch、rerun、cancel 或猜测成功/);
  assert.doesNotMatch(agents, /只有 broker (?:可以|可) (?:dispatch|cancel|promote)/i);
  assert.doesNotMatch(agents, /新的 brokered attempt/i);
});

test('repo instructions retain protected environment and credential isolation', () => {
  assert.match(agents, /受保护 `release-stable` environment/);
  assert.match(agents, /日常 Codex credential 不得获得 release mutation authority/);
  assert.match(agents, /发布 secret 只能在受保护 mutation job 中按需可达/);
});
