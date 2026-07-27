import { fs, path } from './helpers-core.ts';

export function writeFakeReleaseNotesAiWriter(scriptPath, body) {
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(scriptPath, `#!/usr/bin/env node
const fs = require('node:fs');
const input = fs.readFileSync(0, 'utf8');
if (!input.includes('"release_evidence"')) {
  console.error('missing release evidence input');
  process.exit(2);
}
process.stdout.write(${JSON.stringify(body)});
`, { mode: 0o755 });
}

export const stableInstallCommand = 'brew install --cask gaofeng21cn/one-person-lab/one-person-lab';

export function validStandardAiReleaseNotes(version) {
  const publicMarkdown = `One Person Lab v${version}

This release helps users upgrade the standard OPL App package with a clearer first launch path for MAS, MAG, RCA, and OPL Meta Agent entries.

## What improved

### Built-in OPL agent entries are easier to reach
- New users can open the built-in OPL entries for MAS, MAG, RCA, and OPL Meta Agent from the standard App package with less setup ambiguity.

## OPL agents and runtime payload
- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin/skill sync policy.

## OPL family updates
- One Person Lab App: current standard package changes keep the built-in OPL entries aligned.
- OPL Aion Shell: current shell changes keep the first-run and settings UI aligned with the App release.

## Install Stable
\`${stableInstallCommand}\`

This installer downloads the Stable macOS package, copies One Person Lab.app into /Applications, removes local quarantine markers, and opens the App.

## Release scope
- Standard macOS arm64 updater package is published for this release.
`;
  return withHiddenLocalizedReleaseNotes(publicMarkdown, `One Person Lab v${version}

这次更新让用户升级标准 OPL App 包后，更容易从首次启动进入 MAS、MAG、RCA 和 OPL Meta Agent 入口。

## What improved

### 内置 OPL 智能体入口更容易到达
- 新用户可以从标准 App 包打开 MAS、MAG、RCA 和 OPL Meta Agent，设置路径更清晰。

## OPL agents and runtime payload
- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin/skill sync policy.

## OPL family updates
- One Person Lab App: 当前标准包更新会让内置 OPL 入口保持一致。
- OPL Aion Shell: 当前 shell 更新会让首次启动和设置界面与 App 发布保持一致。

## Install Stable
\`${stableInstallCommand}\`

这个安装器会下载 Stable macOS 包，把 One Person Lab.app 复制到 /Applications，清理本地 quarantine 标记，然后打开 App。

## Release scope
- Standard macOS arm64 updater package is published for this release.
`);
}

export function withHiddenLocalizedReleaseNotes(publicMarkdown, zhMarkdown) {
  return `${publicMarkdown.trimEnd()}

<!-- OPL_RELEASE_NOTES:en-US
${publicMarkdown.trimEnd()}
-->
<!-- OPL_RELEASE_NOTES:zh-CN
${zhMarkdown.trimEnd()}
-->
`;
}
