import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import test from 'node:test';

export { assert, crypto, fs, os, path, spawnSync, deflateSync, test };

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const require = createRequire(import.meta.url);
export const externalShellRoot = process.env.OPL_APP_SHELL_ROOT?.trim()
  ? path.resolve(appRoot, process.env.OPL_APP_SHELL_ROOT)
  : null;
export const activeShellRoot = externalShellRoot ?? path.join(appRoot, 'shells', 'aionui');
export const releaseWorkflowPaths = [
  '.github/workflows/_build-reusable.yml',
  '.github/workflows/build-manual.yml',
  '.github/workflows/desktop-release-cleanup-drafts.yml',
  '.github/workflows/desktop-release-promote.yml',
  '.github/workflows/desktop-release.yml',
  '.github/workflows/full-first-install-release.yml',
  '.github/workflows/full-runtime-cache-warmup.yml',
  '.github/workflows/homebrew-tap-update.yml',
  '.github/workflows/nightly-standard-release.yml',
  '.github/workflows/opl-first-run-vm.yml',
  '.github/workflows/release-verify-remote.yml',
];
export const expectedDefaultCompanionSkillSyncIds = [
  'superpowers',
  'cron',
  'officecli',
  'officecli-docx',
  'officecli-pptx',
  'officecli-xlsx',
  'officecli-academic-paper',
  'officecli-data-dashboard',
  'officecli-financial-model',
  'officecli-pitch-deck',
  'pdf',
  'mineru-document-extractor',
  'ui-ux-pro-max',
];
export const expectedDefaultPackagedSkillIds = [
  'mas',
  'mag',
  'rca',
  ...expectedDefaultCompanionSkillSyncIds,
];
export const expectedRuntimeProjectProgressUserFields = [
  'task_id',
  'title',
  'domain_label',
  'state',
  'active_stage_label',
  'next_visible_step',
  'artifact_or_blocker',
  'accepted_answer_shape',
  'next_owner',
  'blocker_ref_count',
  'last_progress_at',
];
export const expectedOrdinaryCockpitForbiddenTerms = [
  'Temporal',
  'provider',
  'ledger',
  'projection',
  'stage attempt',
  'AionUI',
  'backend selector',
  'shell candidate',
  'runtime implementation selector',
];
export const expectedHomeActivityCenterForbiddenDisplays = [
  'expanded continue-work center',
  'needs attention / active / recent activity groups',
  'per-assistant running badges',
  'module_runtime dirty state as task',
  'domain artifact body',
  'memory body',
  'quality verdict body',
  'provider implementation details',
];
export const expectedSettingsPageSections = {
  settings_general: {
    matrixId: 'settings_general',
    sections: ['workspace', 'startup', 'tray', 'language'],
    mustShow: [
      'workspace root from app_state.paths',
      'startup and tray preferences as App product preferences',
      'language preference',
      'short links to Access, Agents & Capabilities, Local Environment, and Project Progress',
    ],
    mustNotShow: [
      'raw OPL internal state files',
      'provider implementation internals as ordinary General settings',
    ],
  },
  settings_access: {
    matrixId: 'access',
    sections: ['codex_cli', 'provider_readiness', 'api_keys', 'webui_compatibility'],
    mustShow: [
      'whether Codex CLI can run now',
      'whether configured provider access can work now',
      'current permission meaning in user-facing language',
      'API key and base URL controls behind advanced disclosure',
      'section-level refresh state',
    ],
    mustNotShow: [
      'raw base URL and token paths as first-screen content',
      'backend selector as ordinary App configuration',
      'WebUI as the primary access mental model',
    ],
  },
  settings_capabilities: {
    matrixId: 'capabilities',
    sections: ['research', 'grant', 'ppt', 'opl_meta_agent', 'skills_detail', 'tools_detail'],
    mustShow: [
      'purpose-grouped MAS research capability',
      'purpose-grouped MAG grant capability',
      'purpose-grouped RCA presentation capability',
      'OPL Meta Agent as explicit non-default capability',
      'required skills locked and optional skills selectable by assistant',
      'builtin skill catalog and auto-injected skills filtered to App packaged skill ids',
      'MCP and tool details as secondary support details',
    ],
    mustNotShow: [
      'Skills and Tools as the only top-level mental model',
      'AG-UI as a user-visible capability concept',
      'AionUI implementation skills such as aionui-skills',
      'OPL Meta Agent as a default Home assistant',
    ],
  },
  settings_environment: {
    matrixId: 'environment',
    sections: ['core.codex', 'provider.temporal', 'modules', 'paths', 'release'],
    mustShow: [
      'Codex CLI version and default profile from app_state.core',
      'Temporal status from app_state.provider.temporal',
      'MAS/MAG/RCA/OMA module version and source from app_state.modules',
      'module path source explanation',
      'Developer Profile source_channel capability and stable package channel default',
      'section-level refresh state',
      'environment page named Local Environment, distinct from Project Progress',
    ],
    mustNotShow: [
      'Med Deep Scientist as a default module',
      'page-wide spinner while one section refreshes',
      'GUI-owned Temporal restart judgment',
      'project progress as a settings runtime page',
    ],
  },
  settings_advanced: {
    matrixId: 'advanced',
    sections: ['developer_profile', 'paths', 'logs', 'opl_flow_context', 'diagnostics'],
    mustShow: [
      'Developer Profile effective state and capabilities from app_state.developer_profile',
      'Developer Profile explicit opt-in state for repo or local checkout source_channel',
      'workspace path from app_state.paths',
      'logs path from app_state.paths',
      'OPL Flow Context',
      'diagnostics and raw refs behind Advanced navigation',
    ],
    mustNotShow: [
      'delayed developer mode flip from a shell-local cache',
      'AionUI local directory as OPL path truth',
      'Developer Profile as ordinary first-level user setup',
      'single Developer Mode switch as the only capability expression',
    ],
  },
};

export function runNode(args, options = {}) {
  return spawnSync(process.execPath, ['--experimental-strip-types', ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

export function writeFile(filePath, content = 'artifact') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

export function readFullPackageBuilderSource() {
  const partsRoot = path.join(appRoot, 'scripts', 'build-full-first-install-package');
  return [
    fs.readFileSync(path.join(appRoot, 'scripts', 'build-full-first-install-package.ts'), 'utf8'),
    ...fs.readdirSync(partsRoot)
      .filter((entry) => entry.endsWith('.ts'))
      .sort()
      .map((entry) => fs.readFileSync(path.join(partsRoot, entry), 'utf8')),
  ].join('\n');
}

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

export const stableInstallCommand = 'curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install-stable.sh | bash';

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

export function stripLocalizedReleaseNotesForTest(markdown) {
  return `${markdown
    .replace(/<!--\s*OPL_RELEASE_NOTES:[A-Za-z-]+\s*\n[\s\S]*?\n?-->\s*/g, '')
    .replace(/<!--\s*OPL_RELEASE_NOTES:[A-Za-z-]+\s*-->[\s\S]*?<!--\s*\/OPL_RELEASE_NOTES:[A-Za-z-]+\s*-->\s*/g, '')
    .trimEnd()}\n`;
}

export function writeBinaryFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

export function writeScreenshotPng(filePath, width = 640, height = 360) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + 1 + x * 4;
      raw[offset] = (x + y) % 256;
      raw[offset + 1] = (x * 3 + y) % 256;
      raw[offset + 2] = (x + y * 3) % 256;
      raw[offset + 3] = 255;
    }
  }
  writeBinaryFile(
    filePath,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', deflateSync(raw)),
      pngChunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

export function writeWebpVp8x(filePath, width, height, minimumSize = 4096) {
  const payload = Buffer.alloc(10);
  payload[4] = (width - 1) & 0xff;
  payload[5] = ((width - 1) >> 8) & 0xff;
  payload[6] = ((width - 1) >> 16) & 0xff;
  payload[7] = (height - 1) & 0xff;
  payload[8] = ((height - 1) >> 8) & 0xff;
  payload[9] = ((height - 1) >> 16) & 0xff;
  const chunkSize = Buffer.alloc(4);
  chunkSize.writeUInt32LE(payload.length);
  const chunk = Buffer.concat([Buffer.from('VP8X', 'ascii'), chunkSize, payload]);
  const padding = Buffer.alloc(Math.max(0, minimumSize - 12 - chunk.length));
  const riffSize = Buffer.alloc(4);
  riffSize.writeUInt32LE(4 + chunk.length + padding.length);
  writeBinaryFile(filePath, Buffer.concat([Buffer.from('RIFF', 'ascii'), riffSize, Buffer.from('WEBP', 'ascii'), chunk, padding]));
}

export function writeAssistantRouteSmokeScreenshots(tempRoot) {
  for (const assistantId of ['mas', 'mag', 'rca']) {
    writeScreenshotPng(path.join(tempRoot, 'artifacts', 'assistant-route-smoke', `${assistantId}.png`));
  }
}

export function writeRuntimeEvidenceJsonFiles(tempRoot) {
  writeFile(
    path.join(tempRoot, 'app-state-summary.json'),
    '{"app_state":{"schema":"opl_app_state.v1","profile":"fast","operator":{"summary":{"stage_attempt_count":1},"actions":[{"action_id":"provider-scheduler:temporal:trigger"}]},"provider":{"temporal":{"status":"ready"}}}}\n',
  );
  writeFile(
    path.join(tempRoot, 'app-state-full.json'),
    '{"app_state":{"schema":"opl_app_state.v1","profile":"full","operator":{"summary":{"stage_attempt_count":1},"actions":[{"action_id":"provider-scheduler:temporal:trigger"}]},"provider":{"temporal":{"status":"ready"}}}}\n',
  );
  writeFile(
    path.join(tempRoot, 'drilldown-full.json'),
    '{"app_operator_drilldown":{"surface_kind":"opl_app_operator_drilldown_read_model","detail_level":"full","summary":{"stage_attempt_count":1}}}\n',
  );
  writeFile(
    path.join(tempRoot, 'action-dry-run-result.json'),
    '{"app_action_execution":{"surface_kind":"opl_app_action_execution.v1","action_id":"stage-production-attempt:medautoscience:analysis-campaign","dry_run":true,"result":{"execution":{"execution_status":"dry_run"}},"authority_boundary":{"can_write_domain_truth":false}}}\n',
  );
  writeFile(
    path.join(tempRoot, 'action-execute-result.json'),
    '{"app_action_execution":{"surface_kind":"opl_app_action_execution.v1","action_id":"stage-production-attempt:medautoscience:analysis-campaign","dry_run":false,"result":{"execution":{"execution_status":"executed"}},"authority_boundary":{"can_write_domain_truth":false}}}\n',
  );
}

export function writeCollectorFakeOpl(fakeOpl, actionLog = '') {
  fs.mkdirSync(path.dirname(fakeOpl), { recursive: true });
  fs.writeFileSync(fakeOpl, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
${actionLog ? `fs.appendFileSync(${JSON.stringify(actionLog)}, JSON.stringify(args) + '\\n');` : ''}
function out(value) {
  process.stdout.write(JSON.stringify(value) + '\\n');
}
if (args.join(' ') === 'app state --profile fast --json') {
  out({
    app_state: {
      schema: 'opl_app_state.v1',
      profile: 'fast',
      operator: { summary: { stage_attempt_count: 2 } },
      provider: { temporal: { status: 'ready' } }
    }
  });
  process.exit(0);
}
if (args.join(' ') === 'app state --profile full --json') {
  out({
    app_state: {
      schema: 'opl_app_state.v1',
      profile: 'full',
      operator: { summary: { stage_attempt_count: 2 } },
      provider: { temporal: { status: 'ready' } }
    }
  });
  process.exit(0);
}
if (args.join(' ') === 'runtime app-operator-drilldown --detail full --json') {
  out({
    app_operator_drilldown: {
      surface_kind: 'opl_app_operator_drilldown_read_model',
      detail_level: 'full',
      summary: { stage_attempt_count: 2 }
    }
  });
  process.exit(0);
}
if (args.slice(0, 4).join(' ') === 'app action execute --action') {
  const dryRun = args.includes('--dry-run');
  out({
    app_action_execution: {
      surface_kind: 'opl_app_action_execution.v1',
      action_id: args[4],
      dry_run: dryRun,
      result: { execution: { execution_status: dryRun ? 'dry_run' : 'executed' } },
      authority_boundary: { can_write_domain_truth: false }
    }
  });
  process.exit(0);
}
console.error('unexpected opl args: ' + args.join(' '));
process.exit(2);
`, { mode: 0o755 });
}

export function writeVmSmokeSummaryFiles(tempRoot, runtimeProfile = 'full') {
  const settingsSmoke = { status: 'passed', pages: ['general', 'access', 'capabilities', 'environment', 'appearance', 'advanced', 'about'] };
  const assistantRouteSmoke = { status: 'passed', assistants: ['mas', 'mag', 'rca'] };
  const codexFunctionalCheck = {
    schema: 'opl_codex_functional_check_receipt.v1',
    status: 'diagnostic_skipped',
    ui_language: 'zh-CN',
    opl_flow_context_expected: {
      status: 'passed',
      context_id: 'opl-flow',
      deterministic: true,
    },
    user_agents_policy: {
      status: 'passed',
      agents_override_allowed: false,
      deterministic: true,
    },
    codex_cli_invokable: {
      status: 'missing',
      detected: false,
      deterministic: true,
    },
    assistant_route_receipts_checked: {
      status: 'passed',
      required: ['mas', 'mag', 'rca'],
      checked: ['mas', 'mag', 'rca'],
      deterministic: true,
    },
    skills_or_plugins_policy_checked: {
      status: 'passed',
      companion_skills_policy: 'codex_visible_companion_skills',
      domain_routes_policy: 'plugin_visible_domain_routes_not_companion_skill_mirrors',
      deterministic: true,
    },
    blocking_release_gate: {
      stable_vm_gate: 'receipt_file_exists_and_deterministic_fields_passed',
      deterministic_fields_passed: true,
      llm_invocation_required: false,
    },
    future_codex_invocation: {
      status: 'diagnostic_skipped',
      reason: 'missing_codex_credentials',
    },
  };
  const codexAiSelfCheck = {
    schema: 'opl_codex_ai_self_check_receipt.v1',
    status: 'skipped_missing_codex_config',
    mode: 'diagnose',
    mutations_allowed: false,
    blocking_release_gate: false,
    codex_cli: {
      command: 'codex',
      detected: false,
      version: null,
    },
    skip_reason: 'missing_codex_config',
  };
  const guestSummary = {
    surface_id: 'opl_packaged_gui_first_run_smoke',
    status: 'passed',
    runtime_profile: runtimeProfile,
    gui_ready: {
      hash: '#/guid',
      textLength: 240,
      hasGuidInput: true,
      hasGuidSendButton: true,
      hasAgentPill: true,
    },
    codex_config_wizard_seen: runtimeProfile === 'full',
    codex_config_wizard_submitted: runtimeProfile === 'full',
    settings_smoke: settingsSmoke,
    assistant_route_smoke: assistantRouteSmoke,
    codex_functional_check: codexFunctionalCheck,
    codex_ai_self_check: codexAiSelfCheck,
  };
  writeFile(path.join(tempRoot, 'artifacts', 'smoke-summary.json'), `${JSON.stringify(guestSummary)}\n`);
  writeFile(
    path.join(tempRoot, 'artifacts', 'codex-functional-check-summary.json'),
    `${JSON.stringify(codexFunctionalCheck)}\n`,
  );
  writeFile(
    path.join(tempRoot, 'artifacts', 'codex-ai-self-check-summary.json'),
    `${JSON.stringify(codexAiSelfCheck)}\n`,
  );
  writeFile(
    path.join(tempRoot, 'artifacts', 'assistant-route-smoke-summary.json'),
    `${JSON.stringify({
      surface_id: 'opl_packaged_gui_assistant_route_smoke',
      status: 'passed',
      cdp_port: 9230,
      assistants: ['mas', 'mag', 'rca'].map((id) => {
        const shortName = id.toUpperCase();
        const badge = `@${shortName}`;
        return {
          id,
          badge,
          ready: {
            assistant_id: id,
            badge,
            selectors_hidden: true,
          },
          receipt: {
            status: 'passed',
            conversation_id: `${id}-conversation`,
            conversation_type: 'acp',
            backend: 'codex',
            route: {
              route_kind: 'builtin_capability',
              executor: 'codex_cli',
              assistant_id: id,
              assistant_short_name: shortName,
              source: 'opl_app_home',
            },
          },
        };
      }),
    })}\n`,
  );
  writeFile(
    path.join(tempRoot, 'tart-smoke-summary.json'),
    `${JSON.stringify({
      surface_id: 'opl_tart_gui_first_run_smoke',
      status: 'passed',
      runtime_profile: runtimeProfile,
      require_codex_config_wizard: runtimeProfile === 'full',
      settings_smoke: settingsSmoke,
      assistant_route_smoke: assistantRouteSmoke,
      codex_functional_check: codexFunctionalCheck,
      codex_ai_self_check: codexAiSelfCheck,
      guest_summary: guestSummary,
    })}\n`,
  );
}

export function writeTypedBlockerFile(tempRoot, artifactId, fields = {}) {
  writeFile(
    path.join(tempRoot, 'typed-blockers', `${artifactId}.json`),
    `${JSON.stringify({
      artifact_id: artifactId,
      typed_blocker_ref: `typed_blocker_ref://one-person-lab-app/test/${artifactId}`,
      owner: 'one-person-lab-app',
      blocker_kind: 'release_evidence_producer_blocked',
      reason: `${artifactId} producer did not complete in this test environment`,
      evidence_refs: [`log_ref://one-person-lab-app/test/${artifactId}`],
      next_action: `rerun ${artifactId} producer with a reachable release environment`,
      ...fields,
    }, null, 2)}\n`,
  );
}

export function writeReleaseMetadata(outDir, version, assetName) {
  writeFile(path.join(outDir, 'latest-mac.yml'), [
    `version: ${version}`,
    'files:',
    `  - url: ${assetName}`,
    '    sha512: test',
    '    size: 1',
    `path: ${assetName}`,
    'sha512: test',
    '',
  ].join('\n'));
}

export function localAuthorizationPolicy(packageKind) {
  return `${JSON.stringify({
    schema: 'opl_local_authorized_macos_policy.v1',
    package_kind: packageKind,
    stable_release_path: 'local_authorized_unsigned',
    apple_developer_id_required: false,
    gatekeeper_required: false,
    local_authorization_required: true,
    quarantine_removal_required: true,
    install_entrypoint: 'install-stable.sh',
    backing_entrypoint: 'install.sh --stable-macos-install --yes',
    default_package_profile: packageKind === 'app_full_first_install' ? 'full' : 'standard',
    user_prompt_policy: 'one_terminal_command_no_system_settings_override_expected_after_quarantine_clear',
    app_path: '/Applications/One Person Lab.app',
    codesign_status: 'passed',
    spctl_status: 'rejected_allowed_unsigned',
    quarantine_status: 'absent',
    quarantine_attribute_count: 0,
  }, null, 2)}\n`;
}

export function writeStandardLocalAuthorizationPolicy(outDir) {
  writeFile(
    path.join(outDir, 'standard-local-authorization-policy.json'),
    localAuthorizationPolicy('app_standard'),
  );
}

export function writeFullLocalAuthorizationPolicy(outDir) {
  writeFile(
    path.join(outDir, 'full-local-authorization-policy.json'),
    localAuthorizationPolicy('app_full_first_install'),
  );
}

export function writeFullRuntimeNativeTrust(outDir) {
  writeFile(
    path.join(outDir, 'full-runtime-native-trust.json'),
    `${JSON.stringify({
      schema: 'opl_full_runtime_native_trust.v1',
      status: 'passed',
      executable_count: 2,
      executables: [
        {
          relative_path: 'runtime/current/node/bin/node',
          assessment_kind: 'launched_executable',
          codesign_status: 'passed',
          spctl_status: 'passed',
          team_identifier: 'TESTTEAMID',
          signature: 'Developer ID Application: Test',
          quarantine_status: 'absent',
          provenance_status: 'absent',
        },
        {
          relative_path: 'runtime/current/vendor/temporal/cli/temporal',
          assessment_kind: 'launched_executable',
          codesign_status: 'passed',
          spctl_status: 'passed',
          team_identifier: 'TESTTEAMID',
          signature: 'Developer ID Application: Test',
          quarantine_status: 'absent',
          provenance_status: 'absent',
        },
      ],
    }, null, 2)}\n`,
  );
}

export function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function workflowStepBlock(workflow, stepName) {
  const escaped = stepName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = workflow.match(new RegExp(`\\n\\s+- name: ${escaped}[\\s\\S]*?(?=\\n\\s+- name: |$)`));
  assert.ok(match, `workflow must include step: ${stepName}`);
  return match[0];
}

export function buildRemoteReleaseView(assetDir, names, tagName) {
  return {
    tagName,
    isDraft: false,
    isPrerelease: false,
    assets: names.map((name) => {
      const filePath = path.join(assetDir, name);
      return {
        name,
        size: fs.statSync(filePath).size,
        digest: `sha256:${fileSha256(filePath)}`,
      };
    }),
  };
}

export function standardRemoteAssetNames(version) {
  return [
    `One-Person-Lab-${version}-mac-arm64.dmg`,
    `One-Person-Lab-${version}-mac-arm64.zip`,
    `One-Person-Lab-${version}-mac-arm64.dmg.blockmap`,
    `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
    'latest-mac.yml',
    'latest-arm64-mac.yml',
    'standard-local-authorization-policy.json',
  ];
}

export function writeStandardRemoteAssets(outDir, version, options = {}) {
  const names = standardRemoteAssetNames(version);
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  writeFile(path.join(outDir, dmgName), 'standard-dmg');
  writeFile(path.join(outDir, zipName), 'standard-zip');
  writeFile(path.join(outDir, `${dmgName}.blockmap`), 'standard-dmg-blockmap');
  writeFile(path.join(outDir, `${zipName}.blockmap`), 'standard-zip-blockmap');
  writeStandardLocalAuthorizationPolicy(outDir);
  const metadata = [
    `version: ${version}`,
    'files:',
    `  - url: ${dmgName}`,
    '    sha512: test-dmg',
    '    size: 12',
    `  - url: ${zipName}`,
    '    sha512: test-zip',
    '    size: 12',
    `path: ${dmgName}`,
    'sha512: test-dmg',
    ...(options.fullLeak ? [`notes: One-Person-Lab-Full-${version}-mac-arm64.dmg`] : []),
    '',
  ].join('\n');
  writeFile(path.join(outDir, 'latest-mac.yml'), metadata);
  writeFile(path.join(outDir, 'latest-arm64-mac.yml'), metadata);
  return names;
}

export function writeFullRemoteAssets(outDir, version, options = {}) {
  const fullDmgName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  const manifest = {
    manifest_version: 2,
    version,
    package_kind: 'opl_full_first_install_macos_arm64',
    size_budget: {
      platform_scope: 'macos-arm64',
      warning_full_dmg_bytes: 700000000,
      max_full_dmg_bytes: 750000000,
      max_runtime_uncompressed_bytes: 1500000000,
    },
    measurement_policy: {
      full_dmg_bytes: 'github_release_asset_size_bytes',
      runtime_uncompressed_bytes: 'manifest_size_breakdown_total_runtime_uncompressed_bytes',
    },
    runtime_assertions: {
      temporal_core_bridge_releases: ['aarch64-apple-darwin'],
      excluded_module_venv_count: 0,
    },
    size_breakdown: {
      total_runtime_uncompressed_bytes: 128,
      layers: {
        toolchain: { size_bytes: 64 },
        'domain-runtime': { size_bytes: 32 },
        'opl-runtime': { size_bytes: 24 },
        skills: { size_bytes: 8 },
      },
    },
    distribution: {
      updater_metadata_allowed: false,
    },
    components: {
      temporal_cli: {
        source_path: '/tmp/temporal',
        version: 'temporal version 1.7.0',
        size_bytes: 801,
        role: 'temporal_cli_preextracted_binary_wrapper',
        required: true,
        binary_path: 'runtime/current/vendor/temporal/cli/temporal',
        archive_path: 'runtime/current/vendor/temporal/temporal_cli_darwin_arm64.tar.gz',
        archive_size_bytes: 114835528,
      },
    },
    optional_components: {
      bun: {
        source_path: null,
        version: null,
        size_bytes: 0,
        role: 'optional_bun_cli_runtime_payload',
        required: false,
        status: 'not_packaged',
      },
    },
    ...(options.manifest ?? {}),
  };
  writeFile(path.join(outDir, fullDmgName), options.dmgContent ?? 'full-dmg');
  writeFile(path.join(outDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFullLocalAuthorizationPolicy(outDir);
  writeFullRuntimeNativeTrust(outDir);
  writeFile(
    path.join(outDir, 'runtime-cache-events.json'),
    `${JSON.stringify({
      mode: 'readwrite',
      dir: '/tmp/opl-full-runtime-cache-test',
      keys: {
        toolchain: 'full-runtime-v1-toolchain-test',
        'domain-runtime': 'full-runtime-v1-domain-runtime-test',
        'opl-runtime': 'full-runtime-v1-opl-runtime-test',
        skills: 'full-runtime-v1-skills-test',
      },
      events: [
        {
          layer_id: 'toolchain',
          key: 'full-runtime-v1-toolchain-test',
          status: 'hit',
          archive_path: '/tmp/opl-full-runtime-cache-test/toolchain/full-runtime-v1-toolchain-test.tar.zst',
          read_archive: true,
          write_archive: false,
          build_layer: false,
        },
      ],
    }, null, 2)}\n`,
  );
  writeFile(path.join(outDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  const checksumNames = [
    fullDmgName,
    'full-package-manifest.json',
    'runtime-cache-events.json',
    'full-runtime-native-trust.json',
    'README-Full-First-Install.txt',
    'full-local-authorization-policy.json',
  ];
  writeFile(
    path.join(outDir, 'SHA256SUMS.txt'),
    checksumNames.map((name) => `${fileSha256(path.join(outDir, name))}  ${name}`).join('\n') + '\n',
  );
  return [
    fullDmgName,
    'full-package-manifest.json',
    'runtime-cache-events.json',
    'full-runtime-native-trust.json',
    'README-Full-First-Install.txt',
    'SHA256SUMS.txt',
    'full-local-authorization-policy.json',
  ];
}

export function readProductProfile() {
  return JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-product-profile.json'), 'utf8'));
}

export function readInstallExposurePolicy() {
  return JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-install-exposure-policy.json'), 'utf8'));
}

export function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((left, right) => (
    left.name.localeCompare(right.name)
  ));
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

export function matchCount(source, pattern) {
  return Array.from(source.matchAll(pattern)).length;
}

export function workflowJobBlock(workflow, jobName) {
  const escaped = jobName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = workflow.match(new RegExp(`\\n  ${escaped}:\\n[\\s\\S]*?(?=\\n  [a-zA-Z0-9_-]+:\\n|\\n[^\\s]|$)`));
  assert.ok(match, `workflow must include job: ${jobName}`);
  return match[0];
}
