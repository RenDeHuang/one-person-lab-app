import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string): string => fs.readFileSync(path, 'utf8');

test('public entry points expose privacy and code-signing policies', () => {
  for (const readme of ['README.md', 'README.zh-CN.md']) {
    const text = read(readme);
    assert.match(text, /docs\/security\/privacy-policy\.md/);
    assert.match(text, /docs\/security\/code-signing-policy\.md/);
    assert.match(text, /SignPath\.io\]\(https:\/\/about\.signpath\.io\/\)/);
    assert.match(text, /SignPath Foundation\]\(https:\/\/signpath\.org\/\)/);
    assert.match(text, /optional trust enhancement|可选信誉增强/);
    assert.match(text, /not a publication\s+gate|不是发布门禁/);
    assert.match(text, /review never blocks a\s+release|审核不会阻断发布/);
  }
});

test('code-signing policy keeps provider review optional while verifying every claimed signature', () => {
  const policy = read('docs/security/code-signing-policy.md');

  assert.match(policy, /Authenticode is an optional trust enhancement, not a Windows publication gate/);
  assert.match(policy, /Provider review timelines do not block[\s\S]*Preview, Stable base, Latest/);
  assert.match(policy, /must never be represented as signed/);
  assert.match(policy, /Committer and reviewer: \[gaofeng21cn\]/);
  assert.match(policy, /Signing approver: \[gaofeng21cn\]/);
  assert.match(policy, /Every signing request requires an explicit manual approval/);
  assert.match(policy, /Third-party and upstream[\s\S]*are not re-signed/);
  assert.match(policy, /generated from and verified against the final signed bytes/);
  assert.match(policy, /Signing does\s+not move Stable, Latest, or any release pointer by itself/);
  assert.match(policy, /honestly declared\s+unsigned artifact is allowed only through the unsigned channel policy/);
});

test('official workflow cannot silently enable Sentry collection', () => {
  const workflow = read('.github/workflows/_build-reusable.yml');
  for (const secret of ['SENTRY_DSN', 'SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT']) {
    assert.doesNotMatch(workflow, new RegExp(`secrets\\.${secret}`));
  }

  const privacy = read('docs/security/privacy-policy.md');
  assert.match(privacy, /without a Sentry DSN or Sentry\s+upload credentials/);
  assert.match(privacy, /one automatic update check shortly after startup/);
  assert.match(privacy, /do not automatically send[\s\S]*persistent installation identifier/);
  assert.match(privacy, /user reviews and submits the issue/);
  assert.match(
    privacy,
    /do not\s+submit it automatically or attach logs, credentials, project content, or\s+screenshots automatically/,
  );
});
