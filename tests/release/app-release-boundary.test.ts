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

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const externalShellRoot = process.env.OPL_APP_SHELL_ROOT?.trim()
  ? path.resolve(appRoot, process.env.OPL_APP_SHELL_ROOT)
  : null;
const activeShellRoot = externalShellRoot ?? path.join(appRoot, 'shells', 'aionui');
const releaseWorkflowPaths = [
  '.github/workflows/_build-reusable.yml',
  '.github/workflows/build-and-release.yml',
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
const expectedDefaultCompanionSkillSyncIds = [
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
const expectedDefaultPackagedSkillIds = [
  'mas',
  'mag',
  'rca',
  ...expectedDefaultCompanionSkillSyncIds,
];
const expectedRuntimeProjectProgressUserFields = [
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
const expectedOrdinaryCockpitForbiddenTerms = [
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
const expectedHomeActivityCenterForbiddenDisplays = [
  'expanded continue-work center',
  'needs attention / active / recent activity groups',
  'per-assistant running badges',
  'module_runtime dirty state as task',
  'domain artifact body',
  'memory body',
  'quality verdict body',
  'provider implementation details',
];
const expectedSettingsPageSections = {
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
    sections: ['developer_profile', 'paths', 'logs', 'opl_flow_context', 'opl_agent_codex_context', 'diagnostics'],
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

function runNode(args, options = {}) {
  return spawnSync(process.execPath, ['--experimental-strip-types', ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

function writeFile(filePath, content = 'artifact') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeFakeReleaseNotesAiWriter(scriptPath, body) {
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

function validStandardAiReleaseNotes(version) {
  const publicMarkdown = `One Person Lab ${version}

This release helps users upgrade the standard OPL App package with a clearer first launch path for MAS, MAG, RCA, and OPL Meta Agent entries.

## What improved

### Built-in OPL agent entries are easier to reach
- New users can open the built-in OPL entries for MAS, MAG, RCA, and OPL Meta Agent from the standard App package with less setup ambiguity.

## OPL agents and runtime payload
- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin/skill sync policy.

## Release scope
- Standard macOS arm64 updater package is published for this release.
`;
  return withHiddenLocalizedReleaseNotes(publicMarkdown, `One Person Lab ${version}

这次更新让用户升级标准 OPL App 包后，更容易从首次启动进入 MAS、MAG、RCA 和 OPL Meta Agent 入口。

## What improved

### 内置 OPL 智能体入口更容易到达
- 新用户可以从标准 App 包打开 MAS、MAG、RCA 和 OPL Meta Agent，设置路径更清晰。

## OPL agents and runtime payload
- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin/skill sync policy.

## Release scope
- Standard macOS arm64 updater package is published for this release.
`);
}

function withHiddenLocalizedReleaseNotes(publicMarkdown, zhMarkdown) {
  return `${publicMarkdown.trimEnd()}

<!-- OPL_RELEASE_NOTES:en-US
${publicMarkdown.trimEnd()}
-->
<!-- OPL_RELEASE_NOTES:zh-CN
${zhMarkdown.trimEnd()}
-->
`;
}

function stripLocalizedReleaseNotesForTest(markdown) {
  return `${markdown
    .replace(/<!--\s*OPL_RELEASE_NOTES:[A-Za-z-]+\s*\n[\s\S]*?\n?-->\s*/g, '')
    .replace(/<!--\s*OPL_RELEASE_NOTES:[A-Za-z-]+\s*-->[\s\S]*?<!--\s*\/OPL_RELEASE_NOTES:[A-Za-z-]+\s*-->\s*/g, '')
    .trimEnd()}\n`;
}

function writeBinaryFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writeScreenshotPng(filePath, width = 640, height = 360) {
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

function writeWebpVp8x(filePath, width, height, minimumSize = 4096) {
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

function writeAssistantRouteSmokeScreenshots(tempRoot) {
  for (const assistantId of ['mas', 'mag', 'rca']) {
    writeScreenshotPng(path.join(tempRoot, 'artifacts', 'assistant-route-smoke', `${assistantId}.png`));
  }
}

function writeRuntimeEvidenceJsonFiles(tempRoot) {
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

function writeCollectorFakeOpl(fakeOpl, actionLog = '') {
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

function writeVmSmokeSummaryFiles(tempRoot, runtimeProfile = 'full') {
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

function writeTypedBlockerFile(tempRoot, artifactId, fields = {}) {
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

function writeReleaseMetadata(outDir, version, assetName) {
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

function gatekeeperLaunchPolicy(packageKind) {
  return `${JSON.stringify({
    schema: 'opl_gatekeeper_launch_policy.v1',
    package_kind: packageKind,
    app_path: '/Applications/One Person Lab.app',
    codesign_status: 'passed',
    spctl_status: 'passed',
  }, null, 2)}\n`;
}

function writeStandardGatekeeperLaunchPolicy(outDir) {
  writeFile(
    path.join(outDir, 'standard-gatekeeper-launch-policy.json'),
    gatekeeperLaunchPolicy('app_standard'),
  );
}

function writeFullGatekeeperLaunchPolicy(outDir) {
  writeFile(
    path.join(outDir, 'full-gatekeeper-launch-policy.json'),
    gatekeeperLaunchPolicy('app_full_first_install'),
  );
}

function writeFullRuntimeNativeTrust(outDir) {
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

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function workflowStepBlock(workflow, stepName) {
  const escaped = stepName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = workflow.match(new RegExp(`\\n\\s+- name: ${escaped}[\\s\\S]*?(?=\\n\\s+- name: |$)`));
  assert.ok(match, `workflow must include step: ${stepName}`);
  return match[0];
}

function buildRemoteReleaseView(assetDir, names, tagName) {
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

function standardRemoteAssetNames(version) {
  return [
    `One-Person-Lab-${version}-mac-arm64.dmg`,
    `One-Person-Lab-${version}-mac-arm64.zip`,
    `One-Person-Lab-${version}-mac-arm64.dmg.blockmap`,
    `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
    'latest-mac.yml',
    'latest-arm64-mac.yml',
    'standard-gatekeeper-launch-policy.json',
  ];
}

function writeStandardRemoteAssets(outDir, version, options = {}) {
  const names = standardRemoteAssetNames(version);
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  writeFile(path.join(outDir, dmgName), 'standard-dmg');
  writeFile(path.join(outDir, zipName), 'standard-zip');
  writeFile(path.join(outDir, `${dmgName}.blockmap`), 'standard-dmg-blockmap');
  writeFile(path.join(outDir, `${zipName}.blockmap`), 'standard-zip-blockmap');
  writeStandardGatekeeperLaunchPolicy(outDir);
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

function writeFullRemoteAssets(outDir, version, options = {}) {
  const fullDmgName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  const manifest = {
    manifest_version: 2,
    version,
    package_kind: 'opl_full_first_install_macos_arm64',
    size_budget: {
      platform_scope: 'macos-arm64',
      warning_full_dmg_bytes: 700000000,
      max_full_dmg_bytes: 750000000,
      max_runtime_uncompressed_bytes: 950000000,
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
  writeFullGatekeeperLaunchPolicy(outDir);
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
    'full-gatekeeper-launch-policy.json',
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
    'full-gatekeeper-launch-policy.json',
  ];
}

function readProductProfile() {
  return JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-product-profile.json'), 'utf8'));
}

function readInstallExposurePolicy() {
  return JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-install-exposure-policy.json'), 'utf8'));
}

function walkFiles(dir) {
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

function matchCount(source, pattern) {
  return Array.from(source.matchAll(pattern)).length;
}

test('release boundary guard keeps App release ownership in App repo', () => {
  const result = runNode(['scripts/validate-release-boundary.ts']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /App release boundary is App-owned/);
});

test('Homebrew tap updater is a local cohort-bound manifest and checksum planner', () => {
  const tapRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-tap-test-'));
  const digest = 'b'.repeat(64);
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const boundaryScript = fs.readFileSync(path.join(appRoot, 'scripts', 'validate-release-boundary.ts'), 'utf8');
  const homebrewScript = fs.readFileSync(path.join(appRoot, 'scripts', 'update-homebrew-tap.ts'), 'utf8');

  assert.equal(
    packageJson.scripts['homebrew:tap:plan'],
    'node --experimental-strip-types scripts/update-homebrew-tap.ts',
  );
  assert.equal(
    packageJson.scripts['validate:homebrew-tap'],
    'node --experimental-strip-types scripts/update-homebrew-tap.ts --self-check',
  );
  assert.match(boundaryScript, /scripts\/update-homebrew-tap\.ts/);
  assert.match(boundaryScript, /--self-check/);
  assert.match(homebrewScript, /manifest_required: true/);
  assert.match(homebrewScript, /checksum_required: true/);
  assert.match(homebrewScript, /nightly_targets_only_for_nightly: true/);
  assert.match(homebrewScript, /stable_promotion_from_nightly_allowed: false/);
  assert.match(homebrewScript, /full_first_install_allowed: false/);
  assert.match(homebrewScript, /full_first_install_allowed: true/);
  assert.match(homebrewScript, /standard_updater_visible: false/);
  assert.match(homebrewScript, /bundled_full_runtime_payload_allowed: true/);
  assert.match(homebrewScript, /app_full_first_install/);
  assert.match(homebrewScript, /modules_payload_allowed: false/);
  assert.match(homebrewScript, /agent_pack_homebrew_allowed: false/);
  assert.match(homebrewScript, /agent_pack_activation_owner: app_cli_managed_background_maintenance/);
  assert.match(homebrewScript, /publishes_or_pushes_remote: false/);
  assert.doesNotMatch(homebrewScript, /from 'node:child_process'|spawnSync\(|execSync\(|execFileSync\(/);

  const stableResult = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--version',
    '26.6.4',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/latest-arm64-mac.yml',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-26.6.4-mac-arm64.dmg',
    '--write',
  ]);
  assert.equal(stableResult.status, 0, stableResult.stderr || stableResult.stdout);
  const stablePlan = JSON.parse(stableResult.stdout);
  assert.equal(stablePlan.channel, 'stable');
  assert.equal(stablePlan.package_kind, 'app_standard');
  assert.equal(stablePlan.policy.manifest_required, true);
  assert.equal(stablePlan.policy.checksum_required, true);
  assert.equal(stablePlan.policy.full_first_install_allowed, false);
  assert.equal(stablePlan.policy.modules_payload_allowed, false);
  assert.equal(stablePlan.policy.agent_pack_homebrew_allowed, false);
  assert.equal(stablePlan.policy.agent_pack_activation_owner, 'app_cli_managed_background_maintenance');
  assert.equal(stablePlan.policy.stable_promotion_from_nightly_allowed, false);
  const stableCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab.rb'), 'utf8');
  assert.match(stableCask, /latest-arm64-mac\.yml/);
  assert.match(stableCask, new RegExp(digest));
  assert.match(stableCask, /stable_promotion_from_nightly_allowed: false/);
  assert.match(stableCask, /full_first_install_allowed: false/);
  assert.match(stableCask, /modules_payload_allowed: false/);
  assert.match(stableCask, /agent_pack_homebrew_allowed: false/);
  assert.match(stableCask, /agent_pack_activation_owner: app_cli_managed_background_maintenance/);
  assert.match(stableCask, /desc "AI-first desktop research and agent orchestration app"/);
  assert.match(stableCask, /url "https:\/\/github\.com\/gaofeng21cn\/one-person-lab-app\/releases\/download\/v#\{version\}\/One-Person-Lab-#\{version\}-mac-arm64\.dmg"/);
  assert.match(stableCask, /depends_on macos: :big_sur/);
  assert.match(stableCask, /depends_on arch: :arm64/);
  assert.match(stableCask, /conflicts_with cask: \["one-person-lab-full", "one-person-lab-nightly"\]/);
  assert.match(stableCask, /livecheck do[\s\S]*releases\/latest[\s\S]*regex\(%r\{\/releases\/tag\/v\?\(\\d\+\(\?:\\\.\\d\+\)\*\)\}i\)/);
  assert.match(stableCask, /app "One Person Lab\.app"/);
  assert.ok(stableCask.indexOf('  livecheck do') < stableCask.indexOf('  depends_on macos: :big_sur'));

  const fullResult = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--package-kind',
    'app_full_first_install',
    '--version',
    '26.6.4',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab-full.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/full-package-manifest.json',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-Full-26.6.4-mac-arm64.dmg',
    '--write',
  ]);
  assert.equal(fullResult.status, 0, fullResult.stderr || fullResult.stdout);
  const fullPlan = JSON.parse(fullResult.stdout);
  assert.equal(fullPlan.channel, 'stable');
  assert.equal(fullPlan.package_kind, 'app_full_first_install');
  assert.equal(fullPlan.policy.full_first_install_allowed, true);
  assert.equal(fullPlan.policy.standard_updater_visible, false);
  assert.equal(fullPlan.policy.full_cask_install_surface, true);
  assert.equal(fullPlan.policy.bundled_full_runtime_payload_allowed, true);
  assert.equal(fullPlan.policy.agent_pack_homebrew_allowed, false);
  const fullCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab-full.rb'), 'utf8');
  assert.match(fullCask, /One-Person-Lab-Full-#\{version\}-mac-arm64\.dmg/);
  assert.match(fullCask, /full-package-manifest\.json/);
  assert.match(fullCask, /package_kind: app_full_first_install/);
  assert.match(fullCask, /full_first_install_allowed: true/);
  assert.match(fullCask, /standard_updater_visible: false/);
  assert.match(fullCask, /cohort: full_first_install_homebrew_distribution/);
  assert.match(fullCask, /bundled_full_runtime_payload_allowed: true/);
  assert.match(fullCask, /agent_pack_homebrew_allowed: false/);
  assert.match(fullCask, /conflicts_with cask: \["one-person-lab", "one-person-lab-nightly"\]/);
  assert.match(fullCask, /Full assets stay outside standard updater metadata/);
  assert.match(fullCask, /app "One Person Lab\.app"/);

  const stableRefresh = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--version',
    '26.6.5',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.5/latest-arm64-mac.yml',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.5/One-Person-Lab-26.6.5-mac-arm64.dmg',
    '--write',
  ]);
  assert.equal(stableRefresh.status, 0, stableRefresh.stderr || stableRefresh.stdout);
  const stableRefreshedCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab.rb'), 'utf8');
  assert.match(stableRefreshedCask, /desc "AI-first desktop research and agent orchestration app"/);
  assert.match(stableRefreshedCask, /depends_on macos: :big_sur/);
  assert.match(stableRefreshedCask, /\n  # OPL_HOMEBREW_BOUNDARY_START\n  # channel: stable/);

  const modulesPackageKind = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--package-kind',
    'modules_bundle',
    '--version',
    '26.6.4',
    '--tap-root',
    tapRoot,
    '--formula',
    'Formula/one-person-lab-modules.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/opl-modules-manifest.json',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/one-person-lab-modules-26.6.4.tar.gz',
    '--write',
  ]);
  assert.notEqual(modulesPackageKind.status, 0);
  assert.match(modulesPackageKind.stderr, /Homebrew tap updates are App cask-only/);

  const nightlyResult = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'nightly',
    '--version',
    '26.6.4-nightly',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab-nightly.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/latest-arm64-mac.yml',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/One-Person-Lab-26.6.4-nightly-mac-arm64.dmg',
    '--write',
  ]);
  assert.equal(nightlyResult.status, 0, nightlyResult.stderr || nightlyResult.stdout);
  assert.equal(JSON.parse(nightlyResult.stdout).targets[0].path, 'Casks/one-person-lab-nightly.rb');
  const nightlyPlanRootCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab-nightly.rb'), 'utf8');
  assert.match(nightlyPlanRootCask, /livecheck do[\s\S]*skip "Nightly casks track prerelease cohorts through App release automation"/);

  const nightlyToStable = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'nightly',
    '--version',
    '26.6.4-nightly',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/latest-arm64-mac.yml',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/One-Person-Lab-26.6.4-nightly-mac-arm64.dmg',
  ]);
  assert.notEqual(nightlyToStable.status, 0);
  assert.match(nightlyToStable.stderr, /Nightly Homebrew tap updates may only update nightly formula\/cask targets/);

  const stableNightlyPromotion = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--version',
    '26.6.4-nightly',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/latest-arm64-mac.yml',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/One-Person-Lab-26.6.4-nightly-mac-arm64.dmg',
  ]);
  assert.notEqual(stableNightlyPromotion.status, 0);
  assert.match(stableNightlyPromotion.stderr, /Stable Homebrew tap updates must not use a nightly version/);

  const appToModules = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--package-kind',
    'app_standard',
    '--version',
    '26.6.4',
    '--tap-root',
    tapRoot,
    '--formula',
    'Formula/one-person-lab-modules.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/opl-modules-manifest.json',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/one-person-lab-modules-26.6.4.tar.gz',
  ]);
  assert.notEqual(appToModules.status, 0);
  assert.match(appToModules.stderr, /Homebrew tap updates are App cask-only/);

  const fullLeakInStandardPlan = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--version',
    '26.6.4',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/full-package-manifest.json',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-26.6.4-mac-arm64.dmg',
  ]);
  assert.notEqual(fullLeakInStandardPlan.status, 0);
  assert.match(fullLeakInStandardPlan.stderr, /Full first-install payloads/);

  const fullNightly = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'nightly',
    '--package-kind',
    'app_full_first_install',
    '--version',
    '26.6.4-nightly',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab-full.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/full-package-manifest.json',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/One-Person-Lab-Full-26.6.4-nightly-mac-arm64.dmg',
  ]);
  assert.notEqual(fullNightly.status, 0);
  assert.match(fullNightly.stderr, /Full first-install Homebrew cask updates must stay on the stable channel/);

  const fullToStandard = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--package-kind',
    'app_full_first_install',
    '--version',
    '26.6.4',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/full-package-manifest.json',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-Full-26.6.4-mac-arm64.dmg',
  ]);
  assert.notEqual(fullToStandard.status, 0);
  assert.match(fullToStandard.stderr, /Full first-install Homebrew cask updates may only update Casks\/one-person-lab-full\.rb/);

  const selfCheck = runNode(['scripts/update-homebrew-tap.ts', '--self-check']);
  assert.equal(selfCheck.status, 0, selfCheck.stderr || selfCheck.stdout);
  assert.match(selfCheck.stdout, /Full cask isolation/);
  assert.match(selfCheck.stdout, /agent-pack App\/CLI ownership/);
});

test('agent installation contract validator is wired into release boundary guard', () => {
  const boundaryScript = fs.readFileSync(path.join(appRoot, 'scripts', 'validate-release-boundary.ts'), 'utf8');
  const result = runNode(['scripts/validate-agent-installation-contract.ts']);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /App agent installation contract is consistent/);
  assert.match(boundaryScript, /validate-agent-installation-contract\.ts/);
});

test('agent installation validator rejects duplicate bare MAS/MAG/RCA skill mirrors', () => {
  const skillsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-codex-skills-'));
  const cleanResult = runNode([
    'scripts/validate-agent-installation-contract.ts',
    '--codex-skills-root',
    skillsRoot,
  ]);
  assert.equal(cleanResult.status, 0, cleanResult.stderr || cleanResult.stdout);
  assert.match(cleanResult.stdout, /"validated_codex_skills_root"/);

  writeFile(path.join(skillsRoot, 'mas', 'SKILL.md'), '# duplicate MAS skill\n');
  const duplicateResult = runNode([
    'scripts/validate-agent-installation-contract.ts',
    '--codex-skills-root',
    skillsRoot,
  ]);
  assert.notEqual(duplicateResult.status, 0);
  assert.match(duplicateResult.stderr, /mas must not be mirrored as a bare Codex skill/);
});

test('agent installation validator accepts generated OMA local plugin roots', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-oma-plugin-'));
  const pluginRoot = path.join(tempRoot, 'opl-meta-agent');
  try {
    writeFile(
      path.join(pluginRoot, '.codex-plugin', 'plugin.json'),
      `${JSON.stringify({ name: 'opl-meta-agent', skills: './skills/' }, null, 2)}\n`,
    );
    writeFile(path.join(pluginRoot, 'skills', 'opl-meta-agent', 'SKILL.md'), '# OPL Meta Agent\n');

    const result = runNode([
      'scripts/validate-agent-installation-contract.ts',
      '--agent-root',
      `oma=${pluginRoot}`,
    ]);

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /"generated_plugin_agents"/);
    assert.match(result.stdout, /"oma":/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release workflows force JavaScript actions onto the Node 24 runtime', () => {
  for (const workflowPath of releaseWorkflowPaths) {
    const workflow = fs.readFileSync(path.join(appRoot, workflowPath), 'utf8');

    assert.match(
      workflow,
      /\nenv:\n(?:  [A-Z0-9_]+: .+\n)*  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true\n/,
      `${workflowPath} must declare the Node 24 JavaScript action runtime policy in top-level env`,
    );
  }
});

test('App product profile owns user-facing defaults without runtime authority', () => {
  const profile = readProductProfile();
  const installExposurePolicy = readInstallExposurePolicy();

  assert.equal(profile.owner, 'one-person-lab-app');
  assert.equal(profile.purpose, 'app_owned_product_profile');
  assert.equal(profile.app_repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(profile.default_session_profile.executor, 'codex_cli');
  assert.equal(profile.default_session_profile.model, profile.codex.default_model);
  assert.equal(profile.default_session_profile.reasoning_effort, profile.codex.default_reasoning_effort);
  assert.equal(profile.gui.authority, 'app_repo_owned_product_truth');
  assert.equal(profile.gui.implementation_carrier, 'opl-aion-shell');
  assert.equal(profile.gui.appearance.default_css_theme_id, 'default-theme');
  assert.equal(profile.gui.appearance.codex_theme_default_enabled, false);
  assert.equal(profile.gui.home.primary_input_surface, 'single_card');
  assert.equal(profile.gui.home.nested_input_card_frames_allowed, false);
  assert.equal(profile.gui.home.codex_cli_fixed_executor, true);
  assert.equal(profile.gui.home.home_executor_selector_visible, false);
  assert.equal(profile.gui.home.codex_model_selector_visible, true);
  assert.equal(profile.gui.home.codex_model_list_visible, true);
  assert.equal(profile.gui.home.codex_model_policy, 'codex_cli_latest_strongest_model_selector_visible');
  assert.equal(profile.gui.home.codex_default_model, 'gpt-5.5');
  assert.equal(profile.gui.home.codex_default_reasoning_effort, profile.codex.default_reasoning_effort);
  assert.equal(profile.gui.home.codex_default_permission_mode, 'full-access');
  assert.equal(profile.gui.home.permission_mode_selector_visible, false);
  assert.equal(profile.gui.home.conversation_backend_selector_visible, false);
  assert.equal(profile.gui.home.conversation_model_selector_visible, true);
  assert.equal(profile.gui.home.conversation_permission_mode_selector_visible, false);
  assert.equal(profile.gui.home.codex_home_model_status_label, 'GPT-5.5（超高）');
  assert.equal(profile.gui.home.codex_home_model_status_label_en, 'GPT-5.5 (Ultra)');
  assert.equal(profile.gui.home.codex_precise_model_display_policy, 'friendly_default_model_and_reasoning_visible');
  assert.deepEqual(profile.gui.home.home_layout, {
    default_mode: 'composer_first_chat_canvas',
    first_screen_policy: 'chat_first_no_dashboard_or_landing_copy',
    composer_position: 'pinned_bottom',
    composer_primary: true,
    workspace_selector_visible: true,
    purpose_entries_visible: ['research', 'grant', 'ppt'],
    workspace_session_rail_default_state: 'collapsed',
    right_context_inspector_default_state: 'collapsed',
    must_not_show: [
      'dashboard-first home',
      'explanatory landing page',
      'backend settings panel in composer',
      'AionUI Team nav entry',
      'AionUI Team page as ordinary App surface',
    ],
  });
  assert.deepEqual(profile.gui.ordinary_conversation, {
    path_id: 'ordinary_codex_conversation',
    entry_source: 'home_purpose_entry_or_new_conversation',
    executor: 'codex_cli',
    composer_position: 'pinned_bottom',
    purpose_tag_visible: true,
    assistant_route_receipt_required: true,
    backend_selector_visible: false,
    model_selector_visible: true,
    permission_mode_selector_visible: false,
    provider_selector_visible: false,
    model_status_surface: 'gui.home.codex_home_model_status_label',
    technical_details_policy: 'friendly_default_model_and_reasoning_visible',
  });
  assert.deepEqual(
    profile.gui.right_context_inspector.tabs.map((tab) => tab.id),
    ['files', 'capabilities', 'runtime', 'memory', 'automations', 'settings'],
  );
  assert.equal(profile.gui.right_context_inspector.placement, 'right');
  assert.equal(profile.gui.right_context_inspector.default_state, 'collapsed');
  assert.equal(profile.gui.right_context_inspector.opens_on_user_request_only, true);
  assert.equal(profile.gui.right_context_inspector.chat_canvas_remains_primary, true);
  assert.equal(profile.gui.home.codex_auto_model_selection.strategy, 'codex_cli_auto_latest_available_frontier');
  assert.equal(profile.gui.home.codex_auto_model_selection.user_can_override_model, true);
  assert.equal(profile.gui.home.codex_auto_model_selection.user_can_restore_auto, true);
  assert.equal(profile.gui.home.codex_auto_model_selection.selection_persists_into_conversation, true);
  assert.deepEqual(
    profile.gui.home.codex_auto_model_selection.frontier_model_preference_order,
    ['gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2'],
  );
  assert.deepEqual(profile.gui.home.retired_codex_models_must_not_be_exposed, [
    'gpt-5.2-codex',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini',
  ]);
  assert.deepEqual(profile.gui.home.home_purpose_entries.map((entry) => entry.id), ['research', 'grant', 'ppt']);
  assert.deepEqual(profile.gui.home.home_purpose_entries.map((entry) => entry.primary_label), ['科研', '基金', '演示']);
  assert.deepEqual(profile.gui.home.home_purpose_entries.map((entry) => entry.target_assistant_id), ['mas', 'mag', 'rca']);
  assert.ok(profile.gui.home.home_purpose_entries.every((entry) => entry.display_policy === 'purpose_first'));
  assert.deepEqual(profile.gui.default_assistants.map((assistant) => assistant.id), ['mas', 'mag', 'rca']);
  assert.ok(profile.gui.default_assistants.every((assistant) => assistant.home_entry_policy === 'purpose_entry_target'));
  assert.deepEqual(profile.gui.assistant_skill_profiles.map((profile) => profile.assistant_id), ['mas', 'mag', 'rca']);
  assert.deepEqual(
    Object.fromEntries(profile.gui.assistant_skill_profiles.map((profile) => [profile.assistant_id, profile.required_skills])),
    { mas: ['mas'], mag: ['mag'], rca: ['rca'] },
  );
  assert.ok(
    profile.gui.assistant_skill_profiles.every(
      (profile) => profile.skill_menu_policy === 'assistant_scoped_required_checked_optional_visible',
    ),
  );
  const appPackagedSkillIds = new Set(profile.companion_payloads.default_packaged_codex_skill_ids);
  assert.ok(
    profile.gui.assistant_skill_profiles.every((profile) =>
      [...profile.required_skills, ...profile.optional_skills].every((skill) => appPackagedSkillIds.has(skill)),
    ),
  );
  assert.ok(profile.gui.assistant_skill_profiles.every((profile) => !('hidden_home_skill_names' in profile)));
  assert.ok(profile.gui.assistant_skill_profiles.every((profile) => !profile.optional_skills.includes('morph-ppt')));
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.scope, 'home_purpose_entry_to_conversation');
  assert.deepEqual(profile.gui.builtin_assistant_route_receipt_policy.required_for_assistants, ['mas', 'mag', 'rca']);
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.route_kind, 'builtin_capability');
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.executor, 'codex_cli');
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.source, 'opl_app_home');
  assert.deepEqual(profile.gui.builtin_assistant_route_receipt_policy.required_fields, [
    'route_kind',
    'executor',
    'assistant_id',
    'assistant_short_name',
    'source',
  ]);
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.must_not_depend_on_visible_backend_selection, true);
  assert.deepEqual(profile.gui.ordinary_capability_selector_policy, {
    scope: 'home_composer_and_ordinary_conversation',
    authority: 'app_owned_opl_allowlist',
    skill_source_ref: 'gui.assistant_skill_profiles.required_skills + optional_skills',
    skill_menu_policy: 'assistant_scoped_required_checked_optional_visible',
    conversation_loaded_skill_display_policy: 'filter_to_ordinary_skill_allowlist',
    mcp_server_source_ref: 'gui.ordinary_capability_selector_policy.visible_mcp_server_ids',
    mcp_menu_policy: 'empty_until_app_explicitly_whitelists_opl_mcp_servers',
    visible_mcp_server_ids: [],
    conversation_loaded_mcp_display_policy: 'filter_to_visible_mcp_server_ids',
    forbidden_skill_examples: ['aionui-skills', 'aionui-webui-setup', 'skill-creator', 'cron'],
    forbidden_mcp_policy: 'do_not_surface_user_or_aionui_mcp_servers_in_ordinary_home_without_app_profile_allowlist',
  });
  assert.deepEqual(profile.settings.visible_tabs, [
    'general',
    'access',
    'capabilities',
    'environment',
    'appearance',
    'advanced',
    'about',
  ]);
  assert.deepEqual(profile.settings.legacy_route_redirects, {
    overview: 'general',
    runtime: 'environment',
    system: 'advanced',
    model: 'environment',
    agent: 'capabilities',
    assistants: 'capabilities',
    'skills-hub': 'capabilities',
    tools: 'capabilities',
    display: 'appearance',
    webui: 'access',
    pet: 'appearance',
  });
  assert.deepEqual(Object.keys(profile.settings.settings_information_architecture), [
    'general',
    'access',
    'capabilities',
    'environment',
    'appearance',
    'advanced',
    'about',
  ]);
  assert.deepEqual(profile.settings.developer_profile.capability_axes, [
    'source_channel',
    'workspace_trust',
    'github_authority',
    'agent_automation',
    'runtime_mutation_scope',
  ]);
  assert.equal(profile.settings.developer_profile.default_profile, 'standard_user');
  assert.equal(profile.settings.developer_profile.opt_in_policy, 'explicit_opt_in_only');
  assert.equal(
    profile.settings.developer_profile.capabilities.source_channel.standard_default,
    'stable_package_channel',
  );
  assert.equal(
    profile.settings.developer_profile.capabilities.source_channel.developer_opt_in,
    'github_repo_or_local_checkout',
  );
  assert.equal(
    profile.settings.developer_profile.capabilities.runtime_mutation_scope.standard_default,
    'app_action_route_only',
  );
  assert.equal(profile.settings.developer_profile.legacy_developer_mode_alias.state_source, 'app_state.developer_mode');
  assert.equal(profile.settings.developer_profile.legacy_developer_mode_alias.display_policy, 'show_as_profile_summary_not_primary_switch');
  assert.equal(profile.gui.non_default_assistants.find((assistant) => assistant.id === 'oma').home_default_visible, false);
  assert.ok(profile.codex.default_visible_skills.includes('superpowers'));
  assert.ok(profile.codex.default_visible_skills.includes('cron'));
  assert.ok(profile.codex.default_visible_skills.includes('pdf'));
  assert.ok(profile.codex.default_visible_skills.includes('mineru-document-extractor'));
  assert.ok(profile.codex.default_visible_skills.includes('ui-ux-pro-max'));
  assert.ok(profile.companion_payloads.default_packaged_codex_skill_ids.includes('superpowers'));
  assert.deepEqual(profile.companion_payloads.default_packaged_codex_skill_ids, expectedDefaultPackagedSkillIds);
  assert.ok(profile.companion_payloads.packaged_not_default_visible_codex_skill_ids.includes('opl-meta-agent'));
  assert.ok(!profile.codex.skill_priority.includes('morph-ppt'));
  assert.ok(!profile.companion_payloads.default_packaged_codex_skill_ids.includes('morph-ppt'));
  assert.ok(profile.first_run.deferred_blockers.includes('domain_modules'));
  assert.deepEqual(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.missing_host_tools_allowed,
    ['command_line_tools', 'homebrew', 'node', 'git'],
  );
  assert.equal(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.initial_runtime_source,
    'bundled_runtime',
  );
  assert.equal(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.core_ready_without_host_tools,
    true,
  );
  assert.deepEqual(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.must_not_block_core_ready,
    [
      'repo_sync',
      'module_reconcile',
      'command_line_tools_install',
      'native_helpers',
      'companion_skills_install',
      'ecosystem_module_updates',
    ],
  );
  assert.deepEqual(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.post_core_ready_background_policy,
    {
      mode: 'best_effort_non_blocking',
      continues_after_core_ready: true,
      managed_items: [
        'repo_sync',
        'module_reconcile',
        'command_line_tools_install',
        'native_helpers',
        'companion_skills_install',
        'ecosystem_module_updates',
      ],
      user_confirmation_items: ['command_line_tools_install'],
    },
  );
  assert.equal(profile.first_run.background_maintenance.blocks_core_ready, false);
  assert.equal(profile.first_run.background_maintenance.mode, 'best_effort_after_core_ready');
  assert.equal(profile.first_run.background_maintenance.continues_after_core_ready, true);
  assert.deepEqual(
    profile.first_run.background_maintenance.items,
    [
      'repo_sync',
      'module_reconcile',
      'command_line_tools_install',
      'native_helpers',
      'companion_skills_install',
      'ecosystem_module_updates',
    ],
  );
  assert.equal(profile.first_run.core_ready_policy.standard_package.bootstrap_owner, 'app_managed');
  assert.equal(profile.first_run.core_ready_policy.standard_package.maintenance_owner, 'app_managed');
  assert.equal(
    profile.first_run.core_ready_policy.standard_package.user_first_screen_terminal_instruction_allowed,
    false,
  );
  assert.equal(
    profile.first_run.core_ready_policy.standard_package.manual_host_tool_install_terminal_state_allowed,
    false,
  );
  assert.equal(
    profile.first_run.core_ready_policy.standard_package.maintenance_resolution_policy,
    'app_or_cli_managed_best_effort_until_ready',
  );
  assert.deepEqual(
    profile.first_run.core_ready_policy.standard_package.forbidden_terminal_instruction_end_states,
    ['install_homebrew_first', 'install_node_first', 'install_git_first'],
  );
  assert.equal(profile.first_run.command_line_tools.auto_request_installer, true);
  assert.equal(profile.first_run.command_line_tools.installer_command, 'xcode-select --install');
  assert.equal(profile.first_run.command_line_tools.system_installer_only, true);
  assert.equal(profile.first_run.command_line_tools.waits_for_user_confirmation, true);
  assert.equal(profile.first_run.command_line_tools.blocks_full_first_launch, false);
  assert.match(
    profile.first_run.command_line_tools.messages.join('\n'),
    /keep using One Person Lab while that Apple installer runs/,
  );
  assert.doesNotMatch(profile.first_run.command_line_tools.messages.join('\n'), /retry setup/i);
  assert.equal(
    profile.first_run.updates.standard_channel.implementation_reference,
    'electron_autoUpdater_background_download_update_downloaded_restart_prompt',
  );
  assert.deepEqual(profile.first_run.updates.standard_channel.metadata_scope, [
    'latest-mac.yml',
    'latest-arm64-mac.yml',
  ]);
  assert.equal(profile.first_run.updates.standard_channel.download_policy, 'background_download');
  assert.equal(profile.first_run.updates.standard_channel.apply_policy, 'restart_when_ready');
  assert.equal(profile.first_run.updates.standard_channel.ready_prompt, 'prompt_restart_after_download_ready');
  assert.equal(profile.first_run.updates.standard_channel.full_first_install_metadata_allowed, false);
  assert.equal(profile.first_run.updates.standard_channel.blocks_core_ready, false);
  assert.deepEqual(profile.companion_payloads.ecosystem_modules, ['officecli', 'mineru', 'opl-meta-agent']);
  assert.equal(profile.companion_payloads.management_authority.officecli, 'app_or_cli_managed');
  assert.equal(profile.companion_payloads.management_authority.mineru, 'app_or_cli_managed');
  assert.equal(profile.companion_payloads.management_authority['opl-meta-agent'], 'app_or_cli_managed');
  assert.ok(profile.companion_payloads.domain_modules.includes('opl-meta-agent'));
  assert.equal(profile.companion_payloads.install_exposure_policy_ref, 'contracts/app-install-exposure-policy.json');
  assert.equal(profile.companion_payloads.public_abi.primary_semantic_entry, 'skill');
  assert.equal(profile.companion_payloads.public_abi.plugin_must_not_create_second_semantics, true);
  assert.equal(profile.companion_payloads.domain_plugin_skills_must_not_be_companion_mirrors, true);
  assert.deepEqual(profile.companion_payloads.domain_plugin_skill_ids, ['mas', 'mag', 'rca']);
  assert.deepEqual(profile.companion_payloads.companion_skill_sync_default_ids, expectedDefaultCompanionSkillSyncIds);
  for (const domainPluginId of profile.companion_payloads.domain_plugin_skill_ids) {
    assert.equal(profile.companion_payloads.companion_skill_sync_default_ids.includes(domainPluginId), false);
  }
  assert.equal(installExposurePolicy.public_abi.primary_semantic_entry, profile.companion_payloads.public_abi.primary_semantic_entry);
  for (const forbiddenOwner of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    assert.ok(profile.boundary.app_does_not_own.includes(forbiddenOwner), forbiddenOwner);
  }
});

test('App install exposure policy keeps skill ABI and plugin distribution separate', () => {
  const policy = readInstallExposurePolicy();
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));

  assert.equal(policy.owner, 'one-person-lab-app');
  assert.equal(policy.purpose, 'app_install_exposure_policy');
  assert.equal(policy.producer_owner, 'one-person-lab');
  assert.deepEqual(policy.canonical_metadata_sources.sources, [
    'family_action_catalog',
    'family_stage_control_plane',
    'family-product-entry-manifest-v2',
  ]);
  assert.equal(policy.public_abi.primary_semantic_entry, 'skill');
  assert.equal(policy.public_abi.plugin_role, 'codex_app_distribution_and_capability_bundle');
  assert.equal(policy.public_abi.direct_skill_compatibility_required, true);
  assert.equal(policy.public_abi.plugin_must_not_create_second_semantics, true);
  assert.equal(policy.public_abi.app_must_not_mirror_plugin_skill_as_duplicate_bare_skill, true);

  const exposureClassById = new Map(policy.exposure_classes.map((entry) => [entry.id, entry]));
  assert.deepEqual(exposureClassById.get('family_domain_plugin_surfaces').members, ['mas', 'mag', 'rca']);
  assert.equal(exposureClassById.get('family_domain_plugin_surfaces').sync_target, 'codex_plugin_registry');
  assert.deepEqual(exposureClassById.get('family_domain_plugin_surfaces').must_not_sync_to, [
    '~/.codex/skills/mas',
    '~/.codex/skills/mag',
    '~/.codex/skills/rca',
  ]);
  assert.equal(exposureClassById.get('opl_generated_plugin_surfaces').sync_target, 'opl_generated_codex_plugin_surface');
  assert.deepEqual(exposureClassById.get('opl_generated_plugin_surfaces').members, ['opl-meta-agent']);
  assert.deepEqual(exposureClassById.get('companion_skill_sync').members, expectedDefaultCompanionSkillSyncIds);
  assert.equal(exposureClassById.get('companion_skill_sync').members.includes('mas'), false);
  assert.equal(exposureClassById.get('companion_skill_sync').members.includes('mag'), false);
  assert.equal(exposureClassById.get('companion_skill_sync').members.includes('rca'), false);

  const domainById = new Map(policy.domain_exposure.map((entry) => [entry.domain_id, entry]));
  assert.equal(domainById.get('mas').preferred_app_distribution, 'plugin_packaged_skill');
  assert.equal(domainById.get('mag').preferred_app_distribution, 'plugin_packaged_skill');
  assert.equal(domainById.get('rca').preferred_app_distribution, 'plugin_packaged_skill');
  assert.equal(domainById.get('oma').preferred_app_distribution, 'opl_generated_codex_plugin_surface');
  assert.equal(domainById.get('oma').default_home_visible, false);

  for (const surface of policy.installer_surfaces) {
    assert.equal(surface.progress_source, 'opl system initialize --json');
  }
  assert.equal(policy.first_run_user_presentation.skill_plugin_distinction_visible_by_default, false);
  assert.deepEqual(policy.setup_flow_contract.ready_to_launch_required_core_items, [
    'workspace_root',
    'codex_cli',
    'codex_config',
  ]);

  assert.equal(
    packageJson.scripts['validate:agent-installation'],
    'node --experimental-strip-types scripts/validate-agent-installation-contract.ts',
  );

  assert.equal(policy.agent_installation_contract.owner, 'one-person-lab-app');
  assert.equal(policy.agent_installation_contract.producer_owner, 'one-person-lab');
  assert.equal(policy.agent_installation_contract.unified_sync_command, 'opl skill sync');
  assert.equal(policy.agent_installation_contract.managed_install_source, 'opl_managed_modules');
  assert.equal(policy.agent_installation_contract.user_agent_installation_mode, 'consume_shared_skill_action_stage_metadata');
  assert.equal(policy.agent_installation_contract.codex_plugin_registry_target, 'codex_plugin_registry');
  assert.equal(policy.agent_installation_contract.direct_skill_target, 'codex_user_skill_discovery_path');
  assert.equal(policy.agent_installation_contract.product_entry_target, 'family-product-entry-manifest-v2');
  assert.deepEqual(policy.agent_installation_contract.required_agent_ids, ['mas', 'mag', 'rca', 'oma']);
  assert.deepEqual(policy.agent_installation_contract.default_plugin_agent_ids, ['mas', 'mag', 'rca']);
  assert.deepEqual(policy.agent_installation_contract.generated_plugin_agent_ids, ['oma']);
  assert.deepEqual(policy.agent_installation_contract.fail_closed_states, policy.sync_and_install_contract.fail_closed_states);
  assert.equal(policy.agent_installation_contract.may_use_developer_checkout_by_default, false);
  assert.equal(policy.agent_installation_contract.developer_checkout_override_policy, 'explicit_opt_in_only');
  assert.equal(
    policy.agent_installation_contract.developer_checkout_override_surface,
    'Developer Profile source_channel capability',
  );
  assert.equal(policy.agent_installation_contract.ordinary_user_module_source, 'app_cli_managed_stable_package_channel');
  assert.deepEqual(policy.agent_installation_contract.module_package_channel_agent_ids, ['mas', 'mag', 'rca', 'oma']);
  assert.deepEqual(policy.agent_installation_contract.non_module_workflow_plugin_ids, ['opl-flow']);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.channel_id, 'opl_distribution_cohort');
  assert.equal(
    policy.agent_installation_contract.managed_agent_pack_distribution.default_transport,
    'app_cli_managed_background_maintenance',
  );
  assert.deepEqual(policy.agent_installation_contract.managed_agent_pack_distribution.package_agent_ids, ['mas', 'mag', 'rca', 'oma']);
  assert.deepEqual(policy.agent_installation_contract.managed_agent_pack_distribution.activation_commands, [
    'opl module reconcile',
    'opl skill sync',
  ]);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.homebrew_distribution_allowed, false);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.homebrew_formula_allowed, false);
  assert.deepEqual(policy.agent_installation_contract.managed_agent_pack_distribution.forbidden_homebrew_formulae, [
    'one-person-lab-modules',
    'one-person-lab-modules-nightly',
  ]);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.must_not_write_user_codex_state, true);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.must_not_define_agent_semantics, true);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.cohort_manifest_required, true);
  assert.equal(policy.agent_installation_contract.duplicate_bare_skill_policy, 'forbid_domain_plugin_skill_mirrors');
  assert.equal(policy.agent_installation_contract.plugin_registration_validation_command, 'npm run validate:agent-installation');
  assert.equal(policy.agent_installation_contract.plugin_registration_validation_inputs.plugin_root_flag, '--agent-root <agent_id>=<path>');
  assert.equal(policy.agent_installation_contract.plugin_registration_validation_inputs.codex_skills_root_flag, '--codex-skills-root <path>');
  assert.equal(policy.agent_installation_contract.plugin_registration_validation_inputs.default_live_codex_skills_root, '~/.codex/skills');
  assert.deepEqual(policy.agent_installation_contract.plugin_registration_validation_inputs.validated_output_fields, [
    'validated_plugin_roots',
    'validated_codex_skills_root',
  ]);
  assert.deepEqual(policy.agent_installation_contract.managed_agent_pack_distribution.fallback_source_order, [
    'bundled_full_runtime_modules',
    'app_cli_managed_stable_package_channel',
    'explicit_developer_checkout_override',
  ]);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.must_not_depend_on_single_github_packages_tag, true);
  assert.equal(
    policy.agent_installation_contract.managed_agent_pack_distribution.github_packages_unavailable_policy,
    'fail_closed_with_actionable_background_maintenance_error',
  );

  const installAgentById = new Map(policy.agent_installation_contract.agents.map((entry) => [entry.agent_id, entry]));
  for (const agentId of ['mas', 'mag', 'rca']) {
    const entry = installAgentById.get(agentId);
    assert.equal(entry.plugin_registry_required, true);
    assert.equal(entry.direct_skill_compatibility_required, true);
    assert.equal(entry.plugin_must_package_skill, true);
    assert.equal(entry.must_not_create_second_semantics, true);
    assert.equal(entry.sync_command, 'opl skill sync');
    assert.equal(entry.product_entry_manifest, 'family-product-entry-manifest-v2');
    assert.equal(entry.canonical_metadata_source, 'domain_action_catalog_and_stage_control_plane');
    assert.equal(entry.codex_visible_entry, agentId);
  }
  assert.equal(installAgentById.get('oma').plugin_registry_required, true);
  assert.equal(installAgentById.get('oma').preferred_distribution, 'opl_generated_codex_plugin_surface');
  assert.equal(installAgentById.get('oma').canonical_metadata_source, 'opl_generated_interface_contract_pack');
  assert.equal(policy.temporal_auto_configuration.provider_env_default, 'OPL_FAMILY_RUNTIME_PROVIDER=temporal');
  assert.deepEqual(policy.temporal_auto_configuration.local_service_defaults, {
    address_env: 'OPL_TEMPORAL_ADDRESS',
    default_address: '127.0.0.1:7233',
    namespace_env: 'OPL_TEMPORAL_NAMESPACE',
    default_namespace: 'default',
    task_queue_env: 'OPL_TEMPORAL_TASK_QUEUE',
    default_task_queue: 'opl-stage-attempts',
  });
  assert.deepEqual(policy.temporal_auto_configuration.managed_commands, [
    'opl family-runtime service start --provider temporal',
    'opl family-runtime worker status --provider temporal',
    'opl family-runtime worker start --provider temporal',
    'opl family-runtime residency proof --provider temporal --production',
  ]);
  assert.equal(policy.temporal_auto_configuration.first_run_policy.ready_to_launch_blocking, false);
  assert.equal(policy.setup_flow_contract.first_conversation_readiness.gate, 'acp_warmup_before_initial_send');
  assert.deepEqual(policy.setup_flow_contract.first_conversation_readiness.must_wait_for, [
    'conversation_record_ready',
    'acp_warmup_complete',
  ]);
});

test('Homebrew distribution channel is transport-only and keeps OPL activation authoritative', () => {
  const policy = readInstallExposurePolicy();
  const homebrew = policy.distribution_channels.homebrew;

  assert.equal(homebrew.role, 'app_cask_transport_and_install_index_only');
  assert.equal(homebrew.tap, 'gaofeng21cn/one-person-lab');
  assert.equal(homebrew.must_not_own_agent_semantics, true);
  assert.equal(homebrew.must_not_write_user_codex_state, true);
  assert.equal(homebrew.user_state_activation_owner, 'opl_framework');
  assert.deepEqual(homebrew.activation_commands, ['opl module reconcile', 'opl skill sync']);
  assert.deepEqual(homebrew.formulae, {});
  assert.deepEqual(homebrew.casks, {
    standard_app: 'one-person-lab',
    nightly_standard_app: 'one-person-lab-nightly',
    full_first_install_app: 'one-person-lab-full',
  });
  assert.deepEqual(homebrew.allowed_user_targets, [
    'Casks/one-person-lab.rb',
    'Casks/one-person-lab-nightly.rb',
    'Casks/one-person-lab-full.rb',
  ]);
  assert.deepEqual(homebrew.initial_live_targets, [
    'Casks/one-person-lab.rb',
    'Casks/one-person-lab-nightly.rb',
    'Casks/one-person-lab-full.rb',
  ]);
  assert.deepEqual(homebrew.forbidden_formulae, ['one-person-lab-modules', 'one-person-lab-modules-nightly']);
  assert.deepEqual(homebrew.full_first_install_cask, {
    name: 'one-person-lab-full',
    target: 'Casks/one-person-lab-full.rb',
    asset: 'One-Person-Lab-Full-<version>-mac-arm64.dmg',
    manifest: 'full-package-manifest.json',
    standard_updater_visible: false,
    stable_only: true,
  });
  assert.deepEqual(homebrew.agent_pack_policy.managed_agent_ids, ['mas', 'mag', 'rca', 'oma']);
  assert.equal(homebrew.agent_pack_policy.homebrew_distribution_allowed, false);
  assert.equal(homebrew.agent_pack_policy.user_visible_formula_allowed, false);
  assert.equal(homebrew.agent_pack_policy.activation_policy, 'app_cli_managed_background_maintenance');
  assert.deepEqual(homebrew.agent_pack_policy.maintenance_commands, ['opl module reconcile', 'opl skill sync']);
});

test('first-run matrix locks Full clean-machine and App-managed bootstrap rules', () => {
  const matrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-first-run-test-matrix.json'), 'utf8'),
  );
  const scenarioById = new Map(matrix.scenarios.map((scenario) => [scenario.id, scenario]));
  const fullClean = scenarioById.get('full_first_install_clean_machine');

  assert.deepEqual(fullClean.clean_machine_missing_tools, ['command_line_tools', 'homebrew', 'node', 'git']);
  assert.equal(fullClean.core_ready_source, 'bundled_runtime');
  assert.deepEqual(fullClean.background_maintenance, [
    'repo_sync',
    'module_reconcile',
    'command_line_tools_install',
    'native_helpers',
    'companion_skills_install',
    'ecosystem_module_updates',
  ]);
  assert.deepEqual(fullClean.post_core_ready_background_policy, {
    mode: 'best_effort_non_blocking',
    continues_after_core_ready: true,
    managed_items: [
      'repo_sync',
      'module_reconcile',
      'command_line_tools_install',
      'native_helpers',
      'companion_skills_install',
      'ecosystem_module_updates',
    ],
  });
  assert.ok(fullClean.expects.some((entry) => /without requiring host CLT, Homebrew, Node, or Git/.test(entry)));
  assert.ok(fullClean.expects.some((entry) => /best-effort background maintenance after Core ready/.test(entry)));

  const standardClean = scenarioById.get('standard_dmg_clean_vm_smoke');
  assert.equal(standardClean.release_gate, true);
  assert.equal(standardClean.vm.runtime_profile, 'standard');
  assert.ok(standardClean.expects.some((entry) => /Framework CLI when opl is missing/.test(entry)));
  assert.ok(standardClean.expects.some((entry) => /Core first-launch readiness.*opl system initialize --json/.test(entry)));
  assert.ok(standardClean.release_evidence_artifacts.includes('artifacts/system-initialize.json'));
  assert.ok(standardClean.release_evidence_artifacts.includes('artifacts/assistant-route-smoke-summary.json'));
  assert.ok(standardClean.expects.some((entry) => /Packaged GUI route smoke selects MAS, MAG, and RCA/.test(entry)));

  const standardBootstrap = scenarioById.get('standard_app_managed_bootstrap');
  assert.equal(standardBootstrap.bootstrap_owner, 'app_managed');
  assert.equal(
    standardBootstrap.maintenance_resolution_policy,
    'app_or_cli_managed_best_effort_until_ready',
  );
  assert.ok(standardBootstrap.expects.some((entry) => /packaged App installer/.test(entry)));
  assert.ok(standardBootstrap.expects.some((entry) => /modules, GUI open, native-helper repair, and online family runtime install disabled/.test(entry)));
  assert.ok(standardBootstrap.expects.some((entry) => /does not end.*Homebrew, Node, or Git/i.test(entry)));
  assert.ok(standardBootstrap.expects.some((entry) => /App-managed bootstrap or maintenance remains responsible/.test(entry)));

  const clt = scenarioById.get('macos_clt_system_installer');
  assert.equal(clt.command, 'xcode-select --install');
  assert.ok(clt.expects.some((entry) => /user confirmation/.test(entry)));
  assert.ok(clt.expects.some((entry) => /Core ready is not blocked/.test(entry)));

  const updater = scenarioById.get('updater_standard_channel');
  assert.deepEqual(updater.update_policy, {
    download: 'background',
    apply: 'restart_when_ready',
    ready_prompt: 'prompt_restart_after_download_ready',
    full_first_install_metadata_allowed: false,
    scope: 'desktop_app_assets_only',
    module_package_update_allowed: false,
    developer_checkout_selection_allowed: false,
    opl_flow_install_allowed: false,
  });
  assert.ok(updater.expects.includes('standard updater does not update domain module packages'));
  assert.ok(updater.expects.includes('standard updater does not select Developer Profile source_channel checkouts'));
  assert.ok(updater.expects.includes('standard updater does not install opl-flow'));

  const ecosystem = scenarioById.get('ecosystem_modules_app_cli_managed');
  assert.deepEqual(ecosystem.modules, ['officecli', 'mineru', 'opl-meta-agent']);
});

test('one-shot App installer defaults to App-first core setup', () => {
  const script = fs.readFileSync(path.join(appRoot, 'install.sh'), 'utf8');

  assert.match(script, /OPL_APP_INSTALL_MODE=\$\{OPL_APP_INSTALL_MODE:-app-first\}/);
  assert.match(script, /--complete/);
  assert.match(script, /--skip-modules/);
  assert.match(script, /curl -fsSL "\$OPL_INSTALL_SCRIPT_URL" \| bash -s -- "\$\{INSTALL_ARGS\[@\]\}"/);
  assert.doesNotMatch(script, /bash -s -- "\$@"/);
});

test('runtime page consumes OPL App/operator drilldown instead of App-owned runtime truth', () => {
  const activeShellContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'),
  );
  const runtimeBridge = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-runtime-bridge.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const guidHomePage = pageStateMatrix.pages.find((page) => page.id === 'guid_home');
  const runtimePage = pageStateMatrix.pages.find((page) => page.id === 'runtime');
  const environmentPage = pageStateMatrix.pages.find((page) => page.id === 'environment');
  const settingsThemePage = pageStateMatrix.pages.find((page) => page.id === 'settings_theme');
  const pageById = new Map(pageStateMatrix.pages.map((page) => [page.id, page]));

  assert.equal(activeShellContract.runtime_bridge_contract, 'contracts/app-runtime-bridge.json');
  assert.equal(runtimeBridge.owner, 'one-person-lab-app');
  assert.equal(runtimeBridge.purpose, 'runtime_bridge_abstraction');
  assert.equal(runtimeBridge.active_adapter, activeShellContract.active_shell);
  assert.equal(runtimeBridge.adapter_role, 'replaceable_gui_shell_adapter');
  assert.equal(runtimeBridge.protocol_owner, 'one-person-lab');
  assert.equal(runtimeBridge.ui_contract_owner, 'one-person-lab-app');
  assert.equal(runtimeBridge.default_adapter_repo, activeShellContract.shell_source.owner_repo);
  assert.equal(runtimeBridge.default_adapter_path, activeShellContract.shell_root);
  assert.equal(runtimeBridge.summary_command, 'opl app state --profile fast --json');
  assert.equal(runtimeBridge.refresh_command, 'opl app state --profile fast --json');
  assert.equal(runtimeBridge.default_operator_payload, 'current_owner_delta');
  assert.equal(runtimeBridge.compatibility_operator_payload, 'compact_owner_delta_projection');
  assert.equal(runtimeBridge.full_state_command, 'opl app state --profile full --json');
  assert.equal(runtimeBridge.full_state_policy, 'diagnostic_or_release_evidence_only');
  assert.equal(runtimeBridge.full_detail_command, 'opl runtime app-operator-drilldown --detail full --json');
  assert.deepEqual(runtimeBridge.default_read_surface_policy, {
    default_projection: 'opl_current_owner_delta',
    compatibility_projection: 'opl_compact_owner_delta_projection',
    source_path: 'app_state.operator.default_read_surface_policy',
    first_screen_answers: [
      'next_safe_action_or_none',
      'current_owner',
      'required_delta',
      'accepted_return_shapes',
      'readiness_false_flags',
      'count_summary',
    ],
    full_detail_policy: 'explicit_full_detail_or_lazy_diagnostic_only',
    raw_refs_policy: 'raw_refs_require_explicit_full_detail',
    full_detail_auto_poll: false,
    shell_must_not_use_full_drilldown_as_normal_state: true,
    shell_must_not_derive_layout_from_raw_runtime_projection: true,
    forbidden_default_state_fields: [
      'runtime_tray_snapshot',
      'raw_evidence_envelope',
      'stage_replay_packet_body',
      'private_residue_inventory_body',
      'provider_internal_ledger_body',
    ],
  });
  assert.equal(runtimeBridge.action_command, 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json');
  assert.equal(runtimeBridge.live_conformance_gate.mode, 'explicit_env_opt_in');
  assert.equal(runtimeBridge.live_conformance_gate.default_enforcement, 'disabled');
  assert.equal(runtimeBridge.live_conformance_gate.enable_env, 'OPL_APP_LIVE_CONFORMANCE');
  assert.equal(runtimeBridge.live_conformance_gate.opl_root_env, 'OPL_APP_LIVE_OPL_ROOT');
  assert.equal(runtimeBridge.live_conformance_gate.action_fixture_env, 'OPL_APP_LIVE_ACTION_FIXTURE');
  assert.equal(runtimeBridge.live_conformance_gate.fast_state_max_bytes, 500000);
  assert.equal(runtimeBridge.live_conformance_gate.required_state_schema, 'opl_app_state.v1');
  assert.equal(runtimeBridge.live_conformance_gate.golden_fast_state_fixture, 'contracts/fixtures/opl-app-state-fast.fixture.json');
  assert.equal(runtimeBridge.projection_sources.primary, 'app_state.operator user task status projection');
  assert.equal(runtimeBridge.projection_sources.provider, 'runtime_tray_snapshot.app_operator_drilldown.current_control_state.states.provider_run');
  assert.equal(runtimeBridge.projection_sources.actions, 'app_state.actions');
  assert.equal(
    runtimeBridge.projection_sources.policy,
    'user_task_status_from_app_state_project_refs_provider_projection_diagnostic_only',
  );
  assert.deepEqual(runtimeBridge.user_task_status_projection, {
    source: 'app_state.operator.workbench.summary_cards + app_state.operator.workbench.activity_center + app_state.operator.workbench.task_drilldowns + app_state.operator.visual_ref_groups.active_project_refs',
    authority: 'opl_framework_refs_only_user_task_projection',
    display_policy: 'user_task_status_first_provider_projection_diagnostic_only',
    default_user_question:
      "How many tasks are running, how many projects or tasks are active or queued, how many need attention, and what is each task's current step?",
    summary_fields: [
      'running_task_count',
      'active_project_count',
      'queued_project_count',
      'attention_count',
    ],
    task_fields: [
      'task_id',
      'title',
      'status',
      'stage',
      'progress_label',
      'next_step',
      'owner',
      'last_progress',
    ],
    count_policies: {
      running_task_count: 'count user tasks projected as actively running or advancing, never raw provider attempts',
      active_project_count: 'count active user-visible project lines from the framework project-line projection',
      queued_project_count: 'count queued or waiting user-visible project/task lines without claiming active worker runs',
      attention_count: 'count user-visible blockers, human gates, failed safe actions, or owner attention states',
    },
    running_state_policy:
      'only explicit running, in_progress, or advancing status/state counts as running; active_run_id alone is context, not liveness proof',
    progress_label_policy:
      'render framework progress classification and stage labels as human task progress labels without exposing raw projection or ledger names',
    diagnostic_source_policy:
      'provider/projection/ref/ledger/current_control_state details stay secondary and are not the default page language',
    must_not_default_display_terms: [
      'Temporal',
      'provider',
      'projection',
      'ref',
      'stage attempt',
      'ledger',
      'current_control_state',
    ],
    refs_only: true,
    app_role: 'display_only_user_task_status_consumer',
  });
  assert.deepEqual(runtimePage.runtime_view_model.must_not_default_display_terms, expectedOrdinaryCockpitForbiddenTerms);
  assert.equal(
    runtimePage.runtime_view_model.ordinary_cockpit_surface_budget_ref,
    'contracts/app-gui-product-contract.json#ordinary_cockpit_surface_budget',
  );
  assert.deepEqual(runtimeBridge.project_progress_projection, {
    source: 'app_state.operator.workbench.task_drilldowns',
    authority: 'opl_framework_shared_project_progress_projection',
    display_policy: 'project_progress_refs_secondary_no_module_runtime_dirty_as_project',
    required_fields: [
      'task_id',
      'title',
      'domain_id',
      'state',
      'active_stage_id',
      'progress_delta_classification',
      'deliverable_progress_delta',
      'platform_repair_delta',
      'blocker_ref_count',
      'next_visible_step',
      'next_owner',
    ],
    optional_user_fields: [
      'domain_label',
      'active_stage_label',
      'next_visible_step',
      'next_owner',
      'last_progress_at',
    ],
    diagnostics_treatment: 'secondary_disclosure',
    safe_actions_treatment: 'secondary_operator_disclosure',
    active_project_line_projection: {
      source: 'app_state.operator.workbench.activity_center.active_projects + app_state.operator.visual_ref_groups.active_project_refs',
      authority: 'opl_framework_refs_only_project_line_projection',
      display_policy: 'active_project_line_count_can_include_queued_or_escalated_owner_handled_lines_without_active_worker_run',
      status_preservation_required: true,
      project_group_expansion_policy: {
        running_group_default: 'expanded',
        attention_group_default: 'visible_when_nonempty',
        inactive_group_default: 'collapsed',
        inactive_states: ['queued', 'pending', 'waiting', 'stopped', 'parked', 'checkpointed', 'blocked', 'attention_needed'],
        inactive_summary_fields: ['count', 'status', 'next_visible_step'],
      },
      required_fields: [
        'task_id',
        'title',
        'state',
        'status',
        'study_id',
        'active_run_id',
        'next_visible_step',
      ],
      must_not_claim: [
        'active_worker_run',
        'provider_execution_running',
        'domain_ready',
        'paper_quality_ready',
      ],
    },
    app_role: 'display_only_project_progress_consumer',
    forbidden_running_task_sources: [
      'module_runtime dirty state',
      'domain lane active_task_count',
      'assistant purpose cards',
      'module readiness diagnostics',
    ],
  });
  assert.deepEqual(runtimePage.runtime_view_model.project_progress.user_display_fields, expectedRuntimeProjectProgressUserFields);
  assert.equal(runtimeBridge.authority_boundary.shell_adapter_can_own_runtime_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_own_runtime_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_write_domain_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_read_artifact_body, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_read_memory_body, false);
  assert.equal(runtimeBridge.replacement_policy.runtime_protocol_stable_across_shell_replacement, true);

  assert.equal(
    guidHomePage.machine_source,
    'contracts/app-gui-product-contract.json#pages.guid_home + opl app state --profile fast --json',
  );
  assert.equal(guidHomePage.page_contract, 'guid_home_entry');
  assert.equal(guidHomePage.home_view_model.authority, 'app_repo_owned_product_truth');
  assert.equal(guidHomePage.home_view_model.implementation_carrier, 'opl-aion-shell');
  assert.equal(guidHomePage.home_view_model.primary_input_surface, 'single_card');
  assert.equal(guidHomePage.home_view_model.nested_input_card_frames_allowed, false);
  assert.equal(guidHomePage.home_view_model.appearance_default_css_theme_id, 'default-theme');
  assert.equal(guidHomePage.home_view_model.codex_cli_fixed_executor, true);
  assert.equal(guidHomePage.home_view_model.home_executor_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.codex_model_selector_visible, true);
  assert.equal(guidHomePage.home_view_model.codex_model_list_visible, true);
  assert.equal(guidHomePage.home_view_model.codex_model_policy, 'codex_cli_latest_strongest_model_selector_visible');
  assert.equal(guidHomePage.home_view_model.codex_default_model, 'gpt-5.5');
  assert.equal(guidHomePage.home_view_model.codex_default_reasoning_effort, 'xhigh');
  assert.equal(guidHomePage.home_view_model.codex_default_display_label, 'GPT-5.5（超高）');
  assert.equal(guidHomePage.home_view_model.codex_default_model_display_value, 'GPT-5.5（超高）');
  assert.equal(
    guidHomePage.home_view_model.codex_model_status_display_policy,
    'default_model_and_reasoning_status_with_visible_selector',
  );
  assert.equal(guidHomePage.home_view_model.codex_default_permission_mode, 'full-access');
  assert.equal(guidHomePage.home_view_model.permission_mode_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.conversation_backend_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.conversation_model_selector_visible, true);
  assert.equal(guidHomePage.home_view_model.conversation_permission_mode_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.codex_precise_model_display_policy, 'friendly_default_model_and_reasoning_visible');
  assert.deepEqual(guidHomePage.home_view_model.codex_frontier_model_preference_order, [
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.3-codex',
    'gpt-5.2',
  ]);
  assert.equal(guidHomePage.home_view_model.codex_user_can_override_model, true);
  assert.equal(guidHomePage.home_view_model.codex_user_can_restore_auto, true);
  assert.deepEqual(guidHomePage.home_view_model.home_layout, {
    default_mode: 'composer_first_chat_canvas',
    first_screen_policy: 'chat_first_no_dashboard_or_landing_copy',
    composer_position: 'pinned_bottom',
    composer_primary: true,
    workspace_selector_visible: true,
    purpose_entries_visible: ['research', 'grant', 'ppt'],
    workspace_session_rail_default_state: 'collapsed',
    right_context_inspector_default_state: 'collapsed',
    must_not_show: [
      'dashboard-first home',
      'explanatory landing page',
      'backend settings panel in composer',
      'AionUI Team nav entry',
      'AionUI Team page as ordinary App surface',
    ],
  });
  assert.deepEqual(guidHomePage.home_view_model.retired_codex_models_must_not_be_exposed, [
    'gpt-5.2-codex',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini',
  ]);
  assert.equal(guidHomePage.home_view_model.state_source, 'opl app state --profile fast --json');
  assert.equal(guidHomePage.home_view_model.refresh_source, 'opl app state --profile fast --json');
  assert.equal(guidHomePage.home_view_model.executor_policy_ref, 'contracts/app-gui-product-contract.json#executor_policy');
  assert.equal(guidHomePage.home_view_model.assistant_source_ref, 'contracts/app-gui-product-contract.json#default_assistants');
  assert.equal(guidHomePage.home_view_model.codex_only_default, true);
  assert.equal(guidHomePage.home_view_model.executor_tab_visible_when_single_executor, false);
  assert.equal(guidHomePage.home_view_model.purpose_entry_source_ref, 'contracts/app-gui-product-contract.json#home_purpose_entries');
  assert.equal(
    guidHomePage.home_view_model.assistant_skill_profile_source_ref,
    'contracts/app-gui-product-contract.json#assistant_skill_profiles',
  );
  assert.equal(
    guidHomePage.home_view_model.conversation_pending_feedback_policy,
    'elapsed_seconds_visible_while_ai_processing_or_backend_running',
  );
  assert.equal(
    guidHomePage.home_view_model.conversation_model_status_display_policy,
    'same_model_status_and_selector_in_codex_conversation_composer',
  );
  assert.equal(
    guidHomePage.home_view_model.route_receipt_source_ref,
    'contracts/app-gui-product-contract.json#builtin_assistant_route_receipt_policy',
  );
  assert.deepEqual(guidHomePage.home_view_model.route_receipt_required_fields, [
    'route_kind',
    'executor',
    'assistant_id',
    'assistant_short_name',
    'source',
  ]);
  assert.deepEqual(guidHomePage.home_view_model.default_assistants, ['mas', 'mag', 'rca']);
  assert.deepEqual(guidHomePage.home_view_model.default_assistant_required_skills, {
    mas: ['mas'],
    mag: ['mag'],
    rca: ['rca'],
  });
  assert.deepEqual(guidHomePage.home_view_model.home_purpose_entries.map((entry) => entry.id), ['research', 'grant', 'ppt']);
  assert.deepEqual(guidHomePage.home_view_model.home_purpose_entries.map((entry) => entry.primary_label), ['科研', '基金', '演示']);
  assert.deepEqual(guidHomePage.home_view_model.home_purpose_entries.map((entry) => entry.target_assistant_id), ['mas', 'mag', 'rca']);
  assert.ok(guidHomePage.home_view_model.home_purpose_entries.every((entry) => entry.display_policy === 'purpose_first'));
  assert.equal(guidHomePage.home_view_model.activity_center.authority, 'app_owned_home_minimal_command_surface');
  assert.equal(guidHomePage.home_view_model.activity_center.source, 'not_rendered_on_ordinary_home');
  assert.equal(guidHomePage.home_view_model.activity_center.default_placement, 'not_rendered_on_ordinary_home');
  assert.equal(
    guidHomePage.home_view_model.activity_center.home_surface_policy,
    'ordinary_home_must_not_render_activity_center_or_continue_work_grid',
  );
  assert.deepEqual(guidHomePage.home_view_model.activity_center.allowed_home_runtime_context, []);
  assert.deepEqual(guidHomePage.home_view_model.activity_center.must_not_display, expectedHomeActivityCenterForbiddenDisplays);
  assert.equal(
    guidHomePage.home_view_model.activity_center.footer_quick_actions_policy,
    'do_not_render_feedback_star_web_icons_on_home',
  );
  for (const expected of [
    'Codex CLI fixed executor experience',
    'Codex model selector defaulting to GPT-5.5（超高）',
    'default model and reasoning status GPT-5.5（超高）',
    'conversation pending elapsed seconds while Codex is working',
    'purpose-first entries 科研/MAS, 基金/MAG, 演示/RCA',
    'selected assistant keeps purpose entry switcher visible',
    'assistant-scoped skill menu with required skill checked',
    'workspace selector',
    'file attachment control',
    'send action',
    'workspace/session rail collapsed by default',
    'right context inspector collapsed by default',
  ]) {
    assert.ok(guidHomePage.must_show.includes(expected), expected);
  }
  for (const forbidden of [
    'executor selector on the home input',
    'Aion CLI or Claude Code backend choices on the home input',
    'retired Codex model choices on the home input',
    'permission mode selector on the home input',
    'backend or permission selectors after entering an ordinary Codex conversation',
    'full assistant names as default home entry labels',
    'skills outside the App packaged skill set in home skill menu',
    'OPL Meta Agent as a default home assistant',
    'retired Codex model choices',
    'nested input card frames',
    'dashboard-first home',
    'explanatory landing page',
    'backend settings panel in composer',
    'domain artifact body in Home activity center',
    'memory body in Home activity center',
  ]) {
    assert.ok(guidHomePage.must_not_show.includes(forbidden), forbidden);
  }

  const ordinaryConversationPage = pageStateMatrix.pages.find((page) => page.id === 'ordinary_conversation');
  const rightContextInspectorPage = pageStateMatrix.pages.find((page) => page.id === 'right_context_inspector');
  assert.equal(ordinaryConversationPage.page_contract, 'ordinary_codex_conversation');
  assert.deepEqual(ordinaryConversationPage.conversation_view_model, {
    path_id: 'ordinary_codex_conversation',
    entry_source: 'home_purpose_entry_or_new_conversation',
    executor: 'codex_cli',
    composer_position: 'pinned_bottom',
    purpose_tag_visible: true,
    assistant_route_receipt_required: true,
    backend_selector_visible: false,
    model_selector_visible: true,
    permission_mode_selector_visible: false,
    provider_selector_visible: false,
    model_status_surface_ref: 'contracts/app-gui-product-contract.json#executor_policy.default_model_display_value',
    technical_details_policy: 'friendly_default_model_and_reasoning_visible',
  });
  assert.deepEqual(
    rightContextInspectorPage.inspector_view_model.tabs.map((tab) => tab.id),
    ['files', 'capabilities', 'runtime', 'memory', 'automations', 'settings'],
  );
  assert.equal(rightContextInspectorPage.inspector_view_model.placement, 'right');
  assert.equal(rightContextInspectorPage.inspector_view_model.default_state, 'collapsed');
  assert.equal(rightContextInspectorPage.inspector_view_model.chat_canvas_remains_primary, true);
  assert.equal(rightContextInspectorPage.inspector_view_model.opens_on_user_request_only, true);

  for (const [pageContract, expected] of Object.entries(expectedSettingsPageSections)) {
    const page = pageById.get(expected.matrixId);
    assert.equal(page.page_contract, pageContract);
    assert.deepEqual(page.sections, expected.sections);
    for (const item of expected.mustShow) {
      assert.ok(page.must_show.includes(item), `${expected.matrixId} must show ${item}`);
    }
    for (const item of expected.mustNotShow) {
      assert.ok(page.must_not_show.includes(item), `${expected.matrixId} must not show ${item}`);
    }
  }

  assert.equal(
    runtimePage.machine_source,
    'opl app state --profile fast --json',
  );
  assert.equal(runtimePage.default_state_source, 'opl app state --profile fast --json');
  assert.equal(runtimePage.diagnostic_source, 'opl runtime app-operator-drilldown --json');
  assert.equal(
    runtimePage.primary_projection,
    'app_state.operator user task status projection',
  );
  assert.equal(runtimePage.fallback_projection, 'fast App state only for availability/actions; full drilldown only for explicit detail');
  assert.equal(runtimePage.framework_command, 'opl app state --profile fast --json');
  assert.equal(runtimePage.framework_full_detail_command, 'opl runtime app-operator-drilldown --detail full --json');
  assert.equal(runtimePage.framework_action_command, 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json');
  assert.equal(runtimePage.page_contract, 'runtime_user_task_status_first');
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.role,
    'runtime_page_operator_evidence_acceptance',
  );
  assert.equal(runtimePage.operator_evidence_acceptance_path.accepts_refs_only_json, true);
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.summary_state_command,
    'opl app state --profile fast --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.refresh_state_command,
    'opl app state --profile fast --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.full_drilldown_command,
    'opl runtime app-operator-drilldown --detail full --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_dry_run_command,
    'opl app action execute --action <action_id> --dry-run --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_execute_command,
    'opl app action execute --action <action_id> --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_route_source,
    'app_state.actions',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_execution_policy,
    'operator_selected_safe_app_action_route_only',
  );
  assert.equal(runtimePage.runtime_view_model.role, 'opl_runtime_user_task_status');
  assert.equal(runtimePage.runtime_view_model.bridge_contract, 'contracts/app-runtime-bridge.json');
  assert.equal(runtimePage.runtime_view_model.default_mode, 'user_task_status_first');
  assert.equal(runtimePage.runtime_view_model.full_detail_policy, 'on_demand_only');
  assert.equal(runtimePage.runtime_view_model.polling_fallback.interval_seconds_min, 5);
  assert.equal(runtimePage.runtime_view_model.polling_fallback.interval_seconds_max, 10);
  assert.equal(runtimePage.runtime_view_model.polling_fallback.policy, 'lightweight_polling_until_push_projection_available');
  assert.deepEqual(runtimePage.runtime_view_model.diagnostics, {
    default_visibility: 'secondary_disclosure',
    sections: ['operator summary', 'safe actions', 'evidence refs', 'full detail digest'],
  });
  assert.equal(runtimePage.runtime_view_model.action_queue.source, 'app_state.actions');
  assert.equal(runtimePage.runtime_view_model.action_queue.fallback_source, 'app_state.operator.actions');
  assert.equal(runtimePage.runtime_view_model.action_queue.authority, 'framework_refs_only');
  assert.deepEqual(runtimePage.runtime_view_model.user_task_status_projection, {
    source: 'app_state.operator.workbench.summary_cards + app_state.operator.workbench.activity_center + app_state.operator.workbench.task_drilldowns + app_state.operator.visual_ref_groups.active_project_refs',
    authority: 'opl_framework_refs_only_user_task_projection',
    display_policy: 'user_task_status_first_provider_projection_diagnostic_only',
    default_user_question:
      "How many tasks are running, how many projects or tasks are active or queued, how many need attention, and what is each task's current step?",
    summary_fields: [
      'running_task_count',
      'active_project_count',
      'queued_project_count',
      'attention_count',
    ],
    task_fields: [
      'task_id',
      'title',
      'status',
      'stage',
      'progress_label',
      'next_step',
      'owner',
      'last_progress',
    ],
    count_policies: {
      running_task_count: 'count user tasks projected as actively running or advancing, never raw provider attempts',
      active_project_count: 'count active user-visible project lines from the framework project-line projection',
      queued_project_count: 'count queued or waiting user-visible project/task lines without claiming active worker runs',
      attention_count: 'count user-visible blockers, human gates, failed safe actions, or owner attention states',
    },
    running_state_policy:
      'only explicit running, in_progress, or advancing status/state counts as running; active_run_id alone is context, not liveness proof',
    progress_label_policy:
      'render framework progress classification and stage labels as human task progress labels without exposing raw projection or ledger names',
    diagnostic_source_policy:
      'provider/projection/ref/ledger/current_control_state details stay secondary and are not the default page language',
    must_not_default_display_terms: [
      'Temporal',
      'provider',
      'projection',
      'ref',
      'stage attempt',
      'ledger',
      'current_control_state',
    ],
    refs_only: true,
  });
  assert.deepEqual(runtimePage.runtime_view_model.project_progress, {
    source: 'app_state.operator.workbench.task_drilldowns',
    authority: 'opl_framework_shared_project_progress_projection',
    display_policy: 'project_progress_refs_secondary_no_module_runtime_dirty_as_project',
    required_fields: [
      'task_id',
      'title',
      'domain_id',
      'state',
      'active_stage_id',
      'progress_delta_classification',
      'deliverable_progress_delta',
      'platform_repair_delta',
      'blocker_ref_count',
      'next_visible_step',
      'next_owner',
    ],
    optional_user_fields: [
      'domain_label',
      'active_stage_label',
      'next_visible_step',
      'next_owner',
      'last_progress_at',
    ],
    user_display_fields: expectedRuntimeProjectProgressUserFields,
    diagnostics_treatment: 'secondary_disclosure',
    safe_actions_treatment: 'secondary_operator_disclosure',
    active_project_line_projection: {
      source: 'app_state.operator.workbench.activity_center.active_projects + app_state.operator.visual_ref_groups.active_project_refs',
      authority: 'opl_framework_refs_only_project_line_projection',
      display_policy: 'active_project_line_count_can_include_queued_or_escalated_owner_handled_lines_without_active_worker_run',
      status_preservation_required: true,
      project_group_expansion_policy: {
        running_group_default: 'expanded',
        attention_group_default: 'visible_when_nonempty',
        inactive_group_default: 'collapsed',
        inactive_states: ['queued', 'pending', 'waiting', 'stopped', 'parked', 'checkpointed', 'blocked', 'attention_needed'],
        inactive_summary_fields: ['count', 'status', 'next_visible_step'],
      },
      required_fields: [
        'task_id',
        'title',
        'state',
        'status',
        'study_id',
        'active_run_id',
        'next_visible_step',
      ],
      must_not_claim: [
        'active_worker_run',
        'provider_execution_running',
        'domain_ready',
        'paper_quality_ready',
      ],
    },
    forbidden_running_task_sources: [
      'module_runtime dirty state',
      'domain lane active_task_count',
      'assistant purpose cards',
      'module readiness diagnostics',
    ],
  });
  assert.deepEqual(runtimePage.runtime_view_model.default_attention.active_project_line_fields, [
    'app_state.operator.workbench.summary_cards[active_projects]',
    'app_state.operator.workbench.activity_center.active_projects',
    'app_state.operator.visual_ref_groups.active_project_refs',
  ]);
  assert.equal(
    runtimePage.runtime_view_model.default_attention.active_project_line_policy,
    'queued_or_escalated_owner_handled_project_lines_count_as_user_visible_active_projects_without_claiming_active_worker_run',
  );
  assert.deepEqual(runtimePage.runtime_view_model.default_attention.project_group_expansion_policy, {
    running_group_default: 'expanded',
    attention_group_default: 'visible_when_nonempty',
    inactive_group_default: 'collapsed',
    inactive_states: ['queued', 'pending', 'waiting', 'stopped', 'parked', 'checkpointed', 'blocked', 'attention_needed'],
    inactive_summary_fields: ['count', 'status', 'next_visible_step'],
  });
  assert.equal(
    runtimePage.runtime_view_model.progress_delta.source,
    'app_state.operator.workbench.task_drilldowns.progress_delta_classification',
  );
  assert.equal(runtimePage.runtime_view_model.progress_delta.authority, 'opl_framework_shared_progress_projection');
  assert.equal(runtimePage.runtime_view_model.progress_delta.display_policy, 'classification_only_no_domain_artifact_body');
  assert.deepEqual(runtimePage.runtime_view_model.progress_delta.required_fields, [
    'deliverable_progress_delta',
    'platform_repair_delta',
    'progress_delta_classification',
  ]);
  assert.deepEqual(runtimePage.runtime_view_model.progress_delta.visible_classes, [
    'deliverable_progress',
    'platform_repair',
    'mixed',
    'typed_blocker',
    'human_gate',
    'stop_loss',
  ]);
  assert.equal(runtimePage.runtime_view_model.progress_delta.deliverable_progress_source, 'deliverable_progress_delta');
  assert.equal(runtimePage.runtime_view_model.progress_delta.platform_repair_source, 'platform_repair_delta');
  assert.equal(runtimePage.runtime_view_model.progress_delta.classification_source, 'progress_delta_classification');
  assert.equal(
    runtimePage.runtime_view_model.progress_delta.platform_repair_display_treatment,
    'separate_infrastructure_repair_not_deliverable_progress',
  );
  assert.equal(runtimePage.runtime_view_model.progress_delta.forbidden_delivery_claim_for_platform_repair, true);
  assert.equal(runtimePage.runtime_view_model.primary_state_source, 'opl app state --profile fast --json');
  assert.equal(runtimePage.runtime_view_model.refresh_state_source, 'opl app state --profile fast --json');
  assert.equal(runtimePage.runtime_view_model.summary_source, 'opl runtime app-operator-drilldown --json');
  assert.equal(runtimePage.runtime_view_model.full_detail_source, 'opl runtime app-operator-drilldown --detail full --json');
  assert.deepEqual(runtimePage.runtime_view_model.running_task_projection, {
    source: 'app_operator_drilldown.current_control_state.summary + current_control_state.states',
    authority: 'opl_framework_provider_attempt_projection',
    display_policy: 'diagnostic_only_no_provider_attempt_count_as_user_running_task_count',
    user_visible_grain: 'domain_and_active_execution_summary_until_project_projection_available',
    active_execution_filter:
      'states where running_provider_attempt is true and provider_run.provider_status or current_attempt_state is running',
    diagnostic_provider_ref_policy:
      'running_provider_attempt_count may include checkpointed provider refs and must not be displayed as the user-visible running task count',
    forbidden_sources: [
      'domain_lane_map active_task_count',
      'app_state.operator.workbench.task_drilldowns where active_stage_id is module_runtime',
      'app_state.modules',
      'module_runtime dirty state',
      'repo/worktree diagnostics',
      'assistant cards',
    ],
    required_user_fields: [
      'current_control_state.states[].running_provider_attempt',
      'current_control_state.states[].provider_run.provider_status',
      'current_control_state.states[].current_attempt_state',
      'running_provider_attempt_count',
      'running_provider_attempt_domain_ids',
      'running_provider_attempt_task_kinds',
      'latest_running_provider_heartbeat_at',
      'running_provider_attempt_summary_policy',
    ],
  });
  assert.equal(runtimePage.runtime_view_model.provider_status.source, 'app_state.provider');
  assert.equal(runtimePage.runtime_view_model.provider_status.authority, 'opl_framework');
  assert.equal(runtimePage.runtime_view_model.authority_boundary.refs_only, true);
  assert.equal(runtimePage.runtime_view_model.authority_boundary.non_authority_display_only, true);
  assert.equal(runtimePage.runtime_view_model.authority_boundary.action_execution_owner, 'opl_framework');
  assert.equal(runtimePage.runtime_view_model.authority_boundary.domain_verdict_owner, 'domain_agent');
  for (const expected of [
    'user task status first OPL runtime status',
    'running task count from framework user task projection',
    'active project count from framework project-line projection',
    'queued project count from framework project-line projection',
    'attention count from framework blocker and owner-attention projection',
    'task title/status/stage/progress label/next step/next owner/owner/accepted answer shape/artifact or blocker/last progress',
    'provider/current_control_state details as diagnostics only',
    'summary OPL operator drilldown read model',
    'fast App state refresh',
    'app_state.operator.workbench.task_drilldowns project progress refs',
    'app_state.operator.workbench.activity_center.active_projects active project lines',
    'app_state.operator.visual_ref_groups.active_project_refs',
    'non-running waiting or stopped projects collapsed by default',
    'full detail lazy load',
    'app_state.operator.summary refs',
    'app_state.provider readiness refs',
    'app_state.actions safe action refs',
    'refs-only non-authority boundary',
    'safe app action dry-run',
    'safe app action execute',
    'receipt/count refresh after execute',
    'authority boundary fields',
  ]) {
    assert.ok(runtimePage.operator_evidence_path.includes(expected), expected);
  }
  for (const expected of [
    'user task status first OPL runtime status',
    'running task count',
    'active project count',
    'queued project count',
    'attention count',
    'task title/status/stage/progress label/next step/next owner/owner/accepted answer shape/artifact or blocker/last progress',
    'project progress from app_state.operator.workbench.task_drilldowns',
    'active project line count from app_state.operator.workbench.activity_center.active_projects',
    'project title/domain/current state/current stage',
    'next visible step when projected',
    'blocker count and user attention status',
    'progress delta rendered as user-facing labels',
    'runtime diagnostics as secondary disclosure',
    'provider readiness from app_state.provider',
    'operator summary from app_state.operator',
    'safe action refs from app_state.actions',
    'non-running waiting or stopped projects collapsed by default',
    'summary OPL operator drilldown read model',
    'full detail lazy load',
    'safe app action dry-run/execute controls',
    'deliverable progress delta classification',
    'platform repair delta as separate infrastructure repair',
    'receipt/count refresh after execute',
    'refs-only non-authority boundary',
    'next owner action before full evidence ledger',
    'full evidence ledger only as secondary on-demand diagnostic',
  ]) {
    assert.ok(runtimePage.must_show.includes(expected), expected);
  }
  for (const forbiddenOwner of [
    'runtime truth',
    'provider implementation',
    'domain truth',
    'memory body',
    'artifact body',
    'quality/readiness/export verdict',
    'deliverable progress truth',
    'platform repair truth',
    'action route authority',
    'domain action approval override',
  ]) {
    assert.ok(runtimePage.must_not_own.includes(forbiddenOwner), forbiddenOwner);
  }
  assert.equal(pageStateMatrix.canonical_state_surface.default_command, 'opl app state --profile fast --json');
  assert.equal(pageStateMatrix.canonical_state_surface.refresh_command, 'opl app state --profile fast --json');
  assert.equal(
    pageStateMatrix.canonical_action_surface.command,
    'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
  );
  assert.equal(
    pageStateMatrix.full_detail_exception.command,
    'opl runtime app-operator-drilldown --detail full --json',
  );
  assert.equal(environmentPage.machine_source, 'opl app state --profile fast --json');
  assert.equal(environmentPage.refresh_source, 'opl app state --profile fast --json');
  assert.equal(
    environmentPage.module_path_source_policy_ref,
    'contracts/app-gui-product-contract.json#module_path_source_policy',
  );
  assert.ok(environmentPage.must_show.includes('module path source explanation'));
  assert.ok(environmentPage.must_not_show.includes('Med Deep Scientist as a default module'));
  assert.equal(settingsThemePage.machine_source, 'opl app state --profile fast --json');
  assert.equal(settingsThemePage.refresh_source, 'opl app state --profile fast --json');
  assert.ok(settingsThemePage.must_show.includes('Default theme option'));
  assert.ok(settingsThemePage.must_show.includes('Codex theme option'));
  const aboutPage = pageStateMatrix.pages.find((page) => page.id === 'about');
  assert.ok(aboutPage.must_show.includes('OPL Framework revision'));
  assert.ok(pageStateMatrix.pages.every((page) => page.id !== 'docker_webui'));
});

test('release evidence bundle records Runtime page acceptance artifacts without App authority', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const firstRunMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-first-run-test-matrix.json'), 'utf8'),
  );
  const runtimePage = pageStateMatrix.pages.find((page) => page.id === 'runtime');
  const fullFirstRun = firstRunMatrix.scenarios.find((scenario) => scenario.id === 'full_first_install_clean_machine');
  const bundle = releaseContract.operator_evidence_bundle;
  const artifactById = new Map(bundle.required_artifacts.map((artifact) => [artifact.id, artifact]));
  const diagnosticById = new Map((bundle.optional_diagnostic_artifacts ?? []).map((artifact) => [artifact.id, artifact]));

  assert.equal(bundle.purpose, 'runtime_page_operator_evidence_acceptance');
  assert.equal(bundle.acceptance_path, 'Runtime page');
  assert.equal(bundle.runtime_page_contract, 'contracts/app-page-state-matrix.json#runtime');
  assert.equal(bundle.refs_only, true);
  assert.equal(bundle.bundle_root_pattern, 'release-evidence/<version>/');
  assert.equal(bundle.manifest_path, 'evidence-manifest.json');
  assert.deepEqual(bundle.missing_evidence_policy, {
    default_validation: 'fail_closed',
    allow_missing_evidence_flag: '--allow-missing-evidence',
    missing_status: 'missing_evidence',
    allowed_artifact_statuses: [
      'present',
      'missing',
      'typed_blocker',
      'not_applicable',
    ],
    typed_blocker_status_requires: [
      'reason',
      'typed_blocker_ref',
    ],
    not_applicable_status_requires: [
      'reason',
      'not_applicable_reason',
    ],
    packaged_app_evidence_requires: 'all_required_artifacts_present_and_verified',
  });
  assert.deepEqual(bundle.image_evidence_policy, {
    applies_to_kind: 'image',
    minimum_width_px: 640,
    minimum_height_px: 360,
    minimum_file_size_bytes: 4096,
    placeholder_screenshot_allowed: false,
  });
  assert.equal(
    artifactById.get('app_state_summary').producer,
    'opl app state --profile fast --json',
  );
  assert.equal(
    artifactById.get('app_state_full').producer,
    'opl app state --profile full --json',
  );
  assert.equal(
    artifactById.get('drilldown_full').producer,
    runtimePage.operator_evidence_acceptance_path.full_drilldown_command,
  );
  assert.equal(
    artifactById.get('action_dry_run_result').producer,
    runtimePage.operator_evidence_acceptance_path.action_dry_run_command,
  );
  assert.equal(
    artifactById.get('action_execute_result').producer,
    runtimePage.operator_evidence_acceptance_path.action_execute_command,
  );
  assert.deepEqual(
    [...artifactById.values()].map((artifact) => artifact.path),
    [
      'app-state-summary.json',
      'app-state-full.json',
      'drilldown-full.json',
      'action-dry-run-result.json',
      'action-execute-result.json',
      'screenshots/runtime.png',
      'screenshots/full.png',
      'screenshots/action.png',
      'tart-smoke-summary.json',
      'artifacts/smoke-summary.json',
      'artifacts/assistant-route-smoke-summary.json',
      'artifacts/codex-functional-check-summary.json',
      'artifacts/assistant-route-smoke/mas.png',
      'artifacts/assistant-route-smoke/mag.png',
      'artifacts/assistant-route-smoke/rca.png',
      'remote-release-verification.json',
    ],
  );
  assert.deepEqual(diagnosticById.get('codex_ai_self_check_summary'), {
    id: 'codex_ai_self_check_summary',
    path: 'artifacts/codex-ai-self-check-summary.json',
    kind: 'json',
    producer: 'packaged GUI Codex AI-first post-install self-check',
    source_kind: 'packaged_gui_codex_ai_self_check',
  });
  assert.deepEqual(
    [...artifactById.values()].map((artifact) => artifact.source_kind),
    [
      'opl_app_state_summary',
      'opl_app_state_full',
      'opl_app_operator_drilldown_full',
      'opl_app_action_dry_run',
      'opl_app_action_execute',
      'app_runtime_page_screenshot',
      'full_first_install_release_screenshot',
      'app_runtime_action_screenshot',
      'clean_first_run_vm_smoke',
      'packaged_gui_first_run_smoke',
      'packaged_gui_assistant_route_smoke',
      'packaged_gui_codex_functional_check',
      'packaged_gui_assistant_route_smoke_screenshot',
      'packaged_gui_assistant_route_smoke_screenshot',
      'packaged_gui_assistant_route_smoke_screenshot',
      'remote_release_verification',
    ],
  );
  assert.deepEqual(fullFirstRun.release_evidence_artifacts, [
    'tart-smoke-summary.json',
    'artifacts/smoke-summary.json',
    'artifacts/system-initialize.json',
    'artifacts/settings-smoke-summary.json',
    'artifacts/assistant-route-smoke-summary.json',
    'artifacts/codex-functional-check-summary.json',
    'artifacts/assistant-route-smoke/mas.png',
    'artifacts/assistant-route-smoke/mag.png',
    'artifacts/assistant-route-smoke/rca.png',
  ]);
  for (const forbiddenAuthority of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    assert.ok(bundle.forbidden_authority.includes(forbiddenAuthority), forbiddenAuthority);
  }
  assert.match(bundle.acceptance_rule, /does not reinterpret the bundle as runtime truth/);
});

test('release evidence bundle validator accepts the declared Runtime page artifact set', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const artifacts = releaseContract.operator_evidence_bundle.required_artifacts;
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'passed',
    packaged_app_evidence: true,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts: artifacts.map((artifact) => ({ ...artifact, status: 'present' })),
    missing_evidence: [],
    blocked_evidence: [],
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeVmSmokeSummaryFiles(tempRoot);
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeFile(path.join(tempRoot, 'remote-release-verification.json'), '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n');
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const result = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, 'passed');
  assert.equal(payload.bundle_dir, tempRoot);
  assert.equal(payload.manifest_path, 'evidence-manifest.json');
  assert.equal(payload.packaged_app_evidence, true);
  assert.equal(
    payload.evidence_boundary,
    'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
  );
  assert.equal(payload.verified_artifact_count, 16);
  assert.equal(payload.verified_diagnostic_count, 0);
  assert.equal(payload.missing_artifact_count, 0);
  assert.deepEqual(
    payload.verified_artifacts.map((artifact) => artifact.id),
    [
      'app_state_summary',
      'app_state_full',
      'drilldown_full',
      'action_dry_run_result',
      'action_execute_result',
      'runtime_screenshot',
      'full_screenshot',
      'action_screenshot',
      'first_run_vm_summary',
      'guest_smoke_summary',
      'assistant_route_smoke_summary',
      'codex_functional_check_summary',
      'assistant_route_smoke_mas_screenshot',
      'assistant_route_smoke_mag_screenshot',
      'assistant_route_smoke_rca_screenshot',
      'remote_release_verification',
    ],
  );
});

test('release evidence bundle validator rejects Codex functional checks without packaged route receipt coverage', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-weak-codex-check-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const artifacts = releaseContract.operator_evidence_bundle.required_artifacts;
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'passed',
    packaged_app_evidence: true,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts: artifacts.map((artifact) => ({ ...artifact, status: 'present' })),
    missing_evidence: [],
    blocked_evidence: [],
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeVmSmokeSummaryFiles(tempRoot);
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeFile(
    path.join(tempRoot, 'artifacts', 'codex-functional-check-summary.json'),
    `${JSON.stringify({
      schema: 'opl_codex_functional_check_receipt.v1',
      status: 'diagnostic_skipped',
      blocking_release_gate: {
        stable_vm_gate: 'receipt_file_exists_and_deterministic_fields_passed',
        deterministic_fields_passed: true,
        llm_invocation_required: false,
      },
    })}\n`,
  );
  writeFile(path.join(tempRoot, 'remote-release-verification.json'), '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n');
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const result = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /assistant route receipts/i);
});

test('release evidence bundle validator accepts optional Codex AI self-check diagnostics without making them required', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-ai-diagnostic-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const requiredArtifacts = releaseContract.operator_evidence_bundle.required_artifacts;
  const diagnostics = releaseContract.operator_evidence_bundle.optional_diagnostic_artifacts;
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'passed',
    packaged_app_evidence: true,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts: requiredArtifacts.map((artifact) => ({ ...artifact, status: 'present' })),
    diagnostics: diagnostics.map((artifact) => ({ ...artifact, status: 'present' })),
    missing_evidence: [],
    blocked_evidence: [],
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeVmSmokeSummaryFiles(tempRoot);
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeFile(path.join(tempRoot, 'remote-release-verification.json'), '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n');
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const result = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, 'passed');
  assert.equal(payload.verified_artifact_count, 16);
  assert.equal(payload.verified_diagnostic_count, 1);
  assert.deepEqual(payload.verified_diagnostics.map((artifact) => artifact.id), [
    'codex_ai_self_check_summary',
  ]);
  assert.equal(payload.missing_artifact_count, 0);
});

test('release evidence bundle validator fails closed for incomplete packaged App evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-missing-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const missingArtifactIds = new Set([
    'first_run_vm_summary',
    'guest_smoke_summary',
    'assistant_route_smoke_summary',
    'codex_functional_check_summary',
    'assistant_route_smoke_mas_screenshot',
    'assistant_route_smoke_mag_screenshot',
    'assistant_route_smoke_rca_screenshot',
    'remote_release_verification',
  ]);
  const artifacts = releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => (
    missingArtifactIds.has(artifact.id)
      ? {
          ...artifact,
          status: 'missing',
          missing_reason: `${artifact.producer} was not generated in this environment`,
        }
      : {
          ...artifact,
          status: 'present',
        }
  ));
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'missing_evidence',
    packaged_app_evidence: false,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts,
    missing_evidence: artifacts
    .filter((artifact) => artifact.status === 'missing')
    .map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      status: artifact.status,
      reason: artifact.missing_reason,
    })),
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const blocked = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /cannot be used as packaged App evidence/);

  const allowed = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
    '--allow-missing-evidence',
  ]);

  assert.equal(allowed.status, 0, allowed.stderr || allowed.stdout);
  const payload = JSON.parse(allowed.stdout);
  assert.equal(payload.status, 'missing_evidence');
  assert.equal(payload.packaged_app_evidence, false);
  assert.equal(payload.verified_artifact_count, 8);
  assert.equal(payload.missing_artifact_count, 8);
  assert.deepEqual(payload.missing_artifacts.map((artifact) => artifact.id), [
    'first_run_vm_summary',
    'guest_smoke_summary',
    'assistant_route_smoke_summary',
    'codex_functional_check_summary',
    'assistant_route_smoke_mas_screenshot',
    'assistant_route_smoke_mag_screenshot',
    'assistant_route_smoke_rca_screenshot',
    'remote_release_verification',
  ]);
});

test('release evidence bundle validator classifies typed blockers and not-applicable artifacts without packaged evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-classified-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const nonPresentById = new Map([
    ['first_run_vm_summary', {
      status: 'typed_blocker',
      reason: 'clean VM host is unavailable for this cohort',
      typed_blocker_ref: 'github-actions:opl-first-run-vm#blocked-no-runner',
    }],
    ['guest_smoke_summary', {
      status: 'not_applicable',
      reason: 'draft evidence cohort did not package a launchable app',
      not_applicable_reason: 'draft_evidence_only_no_packaged_app',
    }],
  ]);
  const artifacts = releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => (
    nonPresentById.has(artifact.id)
      ? {
          ...artifact,
          ...nonPresentById.get(artifact.id),
        }
      : {
          ...artifact,
          status: 'present',
        }
  ));
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'missing_evidence',
    packaged_app_evidence: false,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts,
    missing_evidence: artifacts
      .filter((artifact) => artifact.status !== 'present')
      .map((artifact) => ({
        id: artifact.id,
        path: artifact.path,
        status: artifact.status,
        reason: artifact.reason,
        ...(artifact.typed_blocker_ref ? { typed_blocker_ref: artifact.typed_blocker_ref } : {}),
        ...(artifact.not_applicable_reason ? { not_applicable_reason: artifact.not_applicable_reason } : {}),
      })),
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeVmSmokeSummaryFiles(tempRoot);
  writeFile(path.join(tempRoot, 'remote-release-verification.json'), '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n');
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const blocked = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /cannot be used as packaged App evidence/);

  const allowed = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
    '--allow-missing-evidence',
  ]);

  assert.equal(allowed.status, 0, allowed.stderr || allowed.stdout);
  const payload = JSON.parse(allowed.stdout);
  assert.equal(payload.status, 'missing_evidence');
  assert.equal(payload.packaged_app_evidence, false);
  assert.equal(payload.verified_artifact_count, 14);
  assert.equal(payload.missing_artifact_count, 2);
  assert.deepEqual(
    payload.missing_artifacts.map((artifact) => [artifact.id, artifact.status]),
    [
      ['first_run_vm_summary', 'typed_blocker'],
      ['guest_smoke_summary', 'not_applicable'],
    ],
  );
  assert.equal(
    payload.missing_artifacts.find((artifact) => artifact.id === 'first_run_vm_summary').typed_blocker_ref,
    'github-actions:opl-first-run-vm#blocked-no-runner',
  );
  assert.equal(
    payload.missing_artifacts.find((artifact) => artifact.id === 'guest_smoke_summary').not_applicable_reason,
    'draft_evidence_only_no_packaged_app',
  );
});

test('release evidence manifest generator applies explicit artifact classifications', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-classified-generated-'));
  const classificationPath = path.join(tempRoot, 'artifact-classifications.json');
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));
  writeFile(path.join(classificationPath), `${JSON.stringify({
    artifact_classifications: [
      {
        id: 'first_run_vm_summary',
        status: 'typed_blocker',
        reason: 'clean VM host is unavailable for this cohort',
        typed_blocker_ref: 'github-actions:opl-first-run-vm#blocked-no-runner',
      },
      {
        id: 'guest_smoke_summary',
        status: 'not_applicable',
        reason: 'draft evidence cohort did not package a launchable app',
        not_applicable_reason: 'draft_evidence_only_no_packaged_app',
      },
    ],
  }, null, 2)}\n`);

  const generated = runNode([
    'scripts/write-release-evidence-manifest.ts',
    '--bundle-dir',
    tempRoot,
    '--classification',
    classificationPath,
  ]);

  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  const generatedPayload = JSON.parse(generated.stdout);
  assert.equal(generatedPayload.status, 'missing_evidence');
  assert.equal(generatedPayload.packaged_app_evidence, false);

  const manifest = JSON.parse(fs.readFileSync(path.join(tempRoot, 'evidence-manifest.json'), 'utf8'));
  assert.deepEqual(
    manifest.missing_evidence.map((artifact) => [artifact.id, artifact.status]),
    [
      ['first_run_vm_summary', 'typed_blocker'],
      ['guest_smoke_summary', 'not_applicable'],
      ['assistant_route_smoke_summary', 'missing'],
      ['codex_functional_check_summary', 'missing'],
      ['assistant_route_smoke_mas_screenshot', 'missing'],
      ['assistant_route_smoke_mag_screenshot', 'missing'],
      ['assistant_route_smoke_rca_screenshot', 'missing'],
      ['remote_release_verification', 'missing'],
    ],
  );
  assert.equal(
    manifest.missing_evidence.find((artifact) => artifact.id === 'first_run_vm_summary').typed_blocker_ref,
    'github-actions:opl-first-run-vm#blocked-no-runner',
  );
  assert.equal(
    manifest.missing_evidence.find((artifact) => artifact.id === 'guest_smoke_summary').not_applicable_reason,
    'draft_evidence_only_no_packaged_app',
  );
});

test('release evidence bundle validator rejects contract-only runtime JSON placeholders', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-placeholder-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'passed',
    packaged_app_evidence: true,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts: releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => ({
      ...artifact,
      status: 'present',
    })),
    missing_evidence: [],
    blocked_evidence: [],
  }, null, 2)}\n`);
  for (const name of [
    'app-state-summary.json',
    'app-state-full.json',
    'drilldown-full.json',
    'action-dry-run-result.json',
    'action-execute-result.json',
    'artifacts/assistant-route-smoke-summary.json',
    'remote-release-verification.json',
  ]) {
    writeFile(path.join(tempRoot, name), '{"status":"passed","refs_only":true}\n');
  }
  writeVmSmokeSummaryFiles(tempRoot);
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const result = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /app_state_summary\.app_state/);
});

test('release evidence bundle validator rejects undersized WebP screenshot evidence', () => {
  const tempAppRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-webp-contract-'));
  const tempRoot = path.join(tempAppRoot, 'release-evidence');
  const tempScriptPath = path.join(tempAppRoot, 'scripts', 'validate-release-evidence-bundle.ts');
  const tempContractPath = path.join(tempAppRoot, 'contracts', 'app-release-channel.json');
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  fs.mkdirSync(path.dirname(tempScriptPath), { recursive: true });
  fs.copyFileSync(path.join(appRoot, 'scripts', 'validate-release-evidence-bundle.ts'), tempScriptPath);
  releaseContract.operator_evidence_bundle.required_artifacts = releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => (
    artifact.id === 'runtime_screenshot'
      ? { ...artifact, path: 'screenshots/runtime.webp', status: 'present' }
      : { ...artifact, status: 'present' }
  ));
  const artifacts = releaseContract.operator_evidence_bundle.required_artifacts;
  writeFile(tempContractPath, `${JSON.stringify(releaseContract, null, 2)}\n`);
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'passed',
    packaged_app_evidence: true,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts,
    missing_evidence: [],
    blocked_evidence: [],
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeVmSmokeSummaryFiles(tempRoot);
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeFile(path.join(tempRoot, 'remote-release-verification.json'), '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n');
  writeWebpVp8x(path.join(tempRoot, 'screenshots', 'runtime.webp'), 1, 1);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    tempScriptPath,
    '--bundle-dir',
    tempRoot,
  ], {
    cwd: tempAppRoot,
    encoding: 'utf8',
    env: process.env,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /runtime_screenshot must be at least 640x360px screenshot evidence/);
});

test('release evidence bundle validator rejects image policy without image scope', () => {
  const tempAppRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-image-policy-'));
  const tempRoot = path.join(tempAppRoot, 'release-evidence');
  const tempScriptPath = path.join(tempAppRoot, 'scripts', 'validate-release-evidence-bundle.ts');
  const tempContractPath = path.join(tempAppRoot, 'contracts', 'app-release-channel.json');
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  fs.mkdirSync(path.dirname(tempScriptPath), { recursive: true });
  fs.copyFileSync(path.join(appRoot, 'scripts', 'validate-release-evidence-bundle.ts'), tempScriptPath);
  releaseContract.operator_evidence_bundle.image_evidence_policy.applies_to_kind = 'json';
  writeFile(tempContractPath, `${JSON.stringify(releaseContract, null, 2)}\n`);
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'missing_evidence',
    packaged_app_evidence: false,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts: releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => ({
      ...artifact,
      status: 'missing',
      missing_reason: `${artifact.producer} output was not generated in this environment`,
    })),
    missing_evidence: releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      reason: `${artifact.producer} output was not generated in this environment`,
    })),
    blocked_evidence: [],
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    tempScriptPath,
    '--bundle-dir',
    tempRoot,
    '--allow-missing-evidence',
  ], {
    cwd: tempAppRoot,
    encoding: 'utf8',
    env: process.env,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /image evidence policy must apply to image artifacts/);
});

test('release evidence manifest generator records missing artifacts without claiming packaged App evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-generated-'));
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const generated = runNode([
    'scripts/write-release-evidence-manifest.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  const generatedPayload = JSON.parse(generated.stdout);
  assert.equal(generatedPayload.status, 'missing_evidence');
  assert.equal(generatedPayload.packaged_app_evidence, false);
  assert.equal(generatedPayload.missing_artifact_count, 8);
  assert.deepEqual(generatedPayload.missing_artifacts.map((artifact) => artifact.id), [
    'first_run_vm_summary',
    'guest_smoke_summary',
    'assistant_route_smoke_summary',
    'codex_functional_check_summary',
    'assistant_route_smoke_mas_screenshot',
    'assistant_route_smoke_mag_screenshot',
    'assistant_route_smoke_rca_screenshot',
    'remote_release_verification',
  ]);

  const manifest = JSON.parse(fs.readFileSync(path.join(tempRoot, 'evidence-manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'missing_evidence');
  assert.equal(manifest.packaged_app_evidence, false);
  assert.deepEqual(manifest.diagnostics, []);
  assert.deepEqual(manifest.missing_evidence.map((artifact) => artifact.id), [
    'first_run_vm_summary',
    'guest_smoke_summary',
    'assistant_route_smoke_summary',
    'codex_functional_check_summary',
    'assistant_route_smoke_mas_screenshot',
    'assistant_route_smoke_mag_screenshot',
    'assistant_route_smoke_rca_screenshot',
    'remote_release_verification',
  ]);

  const validation = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
    '--allow-missing-evidence',
  ]);

  assert.equal(validation.status, 0, validation.stderr || validation.stdout);
  const validationPayload = JSON.parse(validation.stdout);
  assert.equal(validationPayload.status, 'missing_evidence');
  assert.equal(validationPayload.packaged_app_evidence, false);
});

test('release evidence collector captures live OPL runtime refs and keeps missing App evidence explicit', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-collector-'));
  const fakeBin = path.join(tempRoot, 'bin');
  const bundleDir = path.join(tempRoot, 'bundle');
  const actionLog = path.join(tempRoot, 'opl-actions.jsonl');
  const fakeOpl = path.join(fakeBin, 'opl');
  fs.mkdirSync(fakeBin, { recursive: true });
  fs.writeFileSync(fakeOpl, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(actionLog)}, JSON.stringify(args) + '\\n');
function out(value) {
  process.stdout.write(JSON.stringify(value) + '\\n');
}
if (args.join(' ') === 'app state --profile fast --json') {
  out({
    app_state: {
      schema: 'opl_app_state.v1',
      profile: 'fast',
      operator: {
        summary: { stage_attempt_count: 2 },
        actions: [{ action_id: 'provider-scheduler:temporal:trigger' }]
      },
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
      operator: {
        summary: { stage_attempt_count: 2 },
        actions: [{ action_id: 'provider-scheduler:temporal:trigger' }]
      },
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
  const actionId = args[4];
  const dryRun = args.includes('--dry-run');
  out({
    app_action_execution: {
      surface_kind: 'opl_app_action_execution.v1',
      action_id: actionId,
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

  const collected = runNode([
    'scripts/collect-release-evidence.ts',
    '--bundle-dir',
    bundleDir,
    '--action-id',
    'provider-scheduler:temporal:trigger',
    '--execute-action',
    '--overwrite',
  ], {
    env: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` },
  });

  assert.equal(collected.status, 0, collected.stderr || collected.stdout);
  const payload = JSON.parse(collected.stdout);
  assert.equal(payload.status, 'missing_evidence');
  assert.equal(payload.packaged_app_evidence, false);
  assert.equal(payload.action_id, 'provider-scheduler:temporal:trigger');
  assert.deepEqual(payload.collected_artifacts, [
    'app_state_summary',
    'app_state_full',
    'drilldown_full',
    'action_dry_run_result',
    'action_execute_result',
  ]);
  assert.deepEqual(payload.missing_artifacts, [
    'runtime_screenshot',
    'full_screenshot',
    'action_screenshot',
    'first_run_vm_summary',
    'guest_smoke_summary',
    'assistant_route_smoke_summary',
    'codex_functional_check_summary',
    'assistant_route_smoke_mas_screenshot',
    'assistant_route_smoke_mag_screenshot',
    'assistant_route_smoke_rca_screenshot',
    'remote_release_verification',
  ]);

  const validation = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    bundleDir,
    '--allow-missing-evidence',
  ]);
  assert.equal(validation.status, 0, validation.stderr || validation.stdout);
  const validationPayload = JSON.parse(validation.stdout);
  assert.equal(validationPayload.status, 'missing_evidence');
  assert.equal(validationPayload.verified_artifact_count, 5);
  assert.equal(validationPayload.missing_artifact_count, 11);

  const actionArgs = fs.readFileSync(actionLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(actionArgs, [
    ['app', 'state', '--profile', 'fast', '--json'],
    ['app', 'state', '--profile', 'full', '--json'],
    ['runtime', 'app-operator-drilldown', '--detail', 'full', '--json'],
    ['app', 'action', 'execute', '--action', 'provider-scheduler:temporal:trigger', '--dry-run', '--json'],
    ['app', 'action', 'execute', '--action', 'provider-scheduler:temporal:trigger', '--json'],
  ]);
});

test('release evidence collector validates generated bundle shape before reporting success', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-collector-invalid-'));
  const fakeBin = path.join(tempRoot, 'bin');
  const bundleDir = path.join(tempRoot, 'bundle');
  const fakeOpl = path.join(fakeBin, 'opl');
  fs.mkdirSync(fakeBin, { recursive: true });
  fs.writeFileSync(fakeOpl, `#!/usr/bin/env node
const args = process.argv.slice(2);
function out(value) {
  process.stdout.write(JSON.stringify(value) + '\\n');
}
if (args.join(' ') === 'app state --profile fast --json') {
  out({ status: 'passed', refs_only: true });
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

  const collected = runNode([
    'scripts/collect-release-evidence.ts',
    '--bundle-dir',
    bundleDir,
    '--action-id',
    'provider-scheduler:temporal:trigger',
    '--overwrite',
  ], {
    env: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` },
  });

  assert.notEqual(collected.status, 0);
  assert.match(collected.stderr, /Release evidence bundle validation failed/);
  assert.match(collected.stderr, /app_state_summary\.app_state/);
});

test('release evidence collector can attach externally produced contracted artifacts', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-collector-attach-'));
  const fakeBin = path.join(tempRoot, 'bin');
  const bundleDir = path.join(tempRoot, 'bundle');
  const externalEvidence = path.join(tempRoot, 'external-evidence');
  const fakeOpl = path.join(fakeBin, 'opl');
  fs.mkdirSync(fakeBin, { recursive: true });
  fs.writeFileSync(fakeOpl, `#!/usr/bin/env node
const args = process.argv.slice(2);
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
  writeScreenshotPng(path.join(externalEvidence, 'runtime.png'));
  writeScreenshotPng(path.join(externalEvidence, 'full.png'));
  writeScreenshotPng(path.join(externalEvidence, 'action.png'));
  writeVmSmokeSummaryFiles(externalEvidence);
  writeAssistantRouteSmokeScreenshots(externalEvidence);
  writeFile(
    path.join(externalEvidence, 'remote-release-verification.json'),
    '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n',
  );

  const collected = runNode([
    'scripts/collect-release-evidence.ts',
    '--bundle-dir',
    bundleDir,
    '--action-id',
    'provider-scheduler:temporal:trigger',
    '--overwrite',
    '--execute-action',
    '--artifact',
    `runtime_screenshot=${path.join(externalEvidence, 'runtime.png')}`,
    '--artifact',
    `full_screenshot=${path.join(externalEvidence, 'full.png')}`,
    '--artifact',
    `action_screenshot=${path.join(externalEvidence, 'action.png')}`,
    '--artifact',
    `first_run_vm_summary=${path.join(externalEvidence, 'tart-smoke-summary.json')}`,
    '--artifact',
    `guest_smoke_summary=${path.join(externalEvidence, 'artifacts', 'smoke-summary.json')}`,
    '--artifact',
    `assistant_route_smoke_summary=${path.join(externalEvidence, 'artifacts', 'assistant-route-smoke-summary.json')}`,
    '--artifact',
    `codex_functional_check_summary=${path.join(externalEvidence, 'artifacts', 'codex-functional-check-summary.json')}`,
    '--artifact',
    `codex_ai_self_check_summary=${path.join(externalEvidence, 'artifacts', 'codex-ai-self-check-summary.json')}`,
    '--artifact',
    `assistant_route_smoke_mas_screenshot=${path.join(externalEvidence, 'artifacts', 'assistant-route-smoke', 'mas.png')}`,
    '--artifact',
    `assistant_route_smoke_mag_screenshot=${path.join(externalEvidence, 'artifacts', 'assistant-route-smoke', 'mag.png')}`,
    '--artifact',
    `assistant_route_smoke_rca_screenshot=${path.join(externalEvidence, 'artifacts', 'assistant-route-smoke', 'rca.png')}`,
    '--artifact',
    `remote_release_verification=${path.join(externalEvidence, 'remote-release-verification.json')}`,
  ], {
    env: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` },
  });

  assert.equal(collected.status, 0, collected.stderr || collected.stdout);
  const payload = JSON.parse(collected.stdout);
  assert.equal(payload.status, 'passed');
  assert.equal(payload.packaged_app_evidence, true);
  assert.equal(payload.missing_artifact_count, 0);
  assert.deepEqual(payload.attached_artifacts, [
    'runtime_screenshot',
    'full_screenshot',
    'action_screenshot',
    'first_run_vm_summary',
    'guest_smoke_summary',
    'assistant_route_smoke_summary',
    'codex_functional_check_summary',
    'assistant_route_smoke_mas_screenshot',
    'assistant_route_smoke_mag_screenshot',
    'assistant_route_smoke_rca_screenshot',
    'remote_release_verification',
    'codex_ai_self_check_summary',
  ]);

  const validation = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    bundleDir,
  ]);
  assert.equal(validation.status, 0, validation.stderr || validation.stdout);
  const validationPayload = JSON.parse(validation.stdout);
  assert.equal(validationPayload.status, 'passed');
  assert.equal(validationPayload.verified_artifact_count, 16);
  assert.equal(validationPayload.verified_diagnostic_count, 1);
  assert.equal(validationPayload.missing_artifact_count, 0);
});

test('release evidence collector imports standard smoke source directories without hand-mapping every artifact', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-collector-source-dir-'));
  const fakeBin = path.join(tempRoot, 'bin');
  const bundleDir = path.join(tempRoot, 'bundle');
  const sourceDir = path.join(tempRoot, 'standard-smoke-source');
  const overrideEvidence = path.join(tempRoot, 'override-evidence');
  const fakeOpl = path.join(fakeBin, 'opl');
  writeCollectorFakeOpl(fakeOpl);

  writeVmSmokeSummaryFiles(sourceDir);
  writeAssistantRouteSmokeScreenshots(sourceDir);
  writeScreenshotPng(path.join(sourceDir, 'first-run-beginner.png'));
  writeScreenshotPng(path.join(sourceDir, 'action.png'));
  writeScreenshotPng(path.join(sourceDir, 'settings-pages', 'runtime.png'), 1, 1);
  writeFile(
    path.join(sourceDir, 'remote-release-verification.json'),
    '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n',
  );
  writeScreenshotPng(path.join(overrideEvidence, 'runtime.png'));

  const collected = runNode([
    'scripts/collect-release-evidence.ts',
    '--bundle-dir',
    bundleDir,
    '--action-id',
    'provider-scheduler:temporal:trigger',
    '--overwrite',
    '--execute-action',
    '--evidence-source-dir',
    sourceDir,
    '--artifact',
    `runtime_screenshot=${path.join(overrideEvidence, 'runtime.png')}`,
  ], {
    env: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` },
  });

  assert.equal(collected.status, 0, collected.stderr || collected.stdout);
  const payload = JSON.parse(collected.stdout);
  assert.equal(payload.status, 'passed');
  assert.equal(payload.packaged_app_evidence, true);
  assert.equal(payload.missing_artifact_count, 0);
  assert.deepEqual(payload.attached_artifacts, [
    'runtime_screenshot',
    'full_screenshot',
    'action_screenshot',
    'first_run_vm_summary',
    'guest_smoke_summary',
    'assistant_route_smoke_summary',
    'codex_functional_check_summary',
    'assistant_route_smoke_mas_screenshot',
    'assistant_route_smoke_mag_screenshot',
    'assistant_route_smoke_rca_screenshot',
    'remote_release_verification',
    'codex_ai_self_check_summary',
  ]);
  assert.equal(
    fileSha256(path.join(bundleDir, 'screenshots', 'runtime.png')),
    fileSha256(path.join(overrideEvidence, 'runtime.png')),
  );

  const validation = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    bundleDir,
  ]);
  assert.equal(validation.status, 0, validation.stderr || validation.stdout);
  const validationPayload = JSON.parse(validation.stdout);
  assert.equal(validationPayload.status, 'passed');
  assert.equal(validationPayload.verified_artifact_count, 16);
  assert.equal(validationPayload.verified_diagnostic_count, 1);
  assert.equal(validationPayload.missing_artifact_count, 0);
});

test('release evidence collector imports typed blockers as blocked evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-collector-blocker-'));
  const fakeBin = path.join(tempRoot, 'bin');
  const bundleDir = path.join(tempRoot, 'bundle');
  const sourceDir = path.join(tempRoot, 'standard-smoke-source');
  const blockerRoot = path.join(tempRoot, 'blockers');
  const fakeOpl = path.join(fakeBin, 'opl');
  writeCollectorFakeOpl(fakeOpl);

  writeScreenshotPng(path.join(sourceDir, 'runtime.png'));
  writeScreenshotPng(path.join(sourceDir, 'first-run-beginner.png'));
  writeScreenshotPng(path.join(sourceDir, 'action.png'));
  writeVmSmokeSummaryFiles(sourceDir);
  writeAssistantRouteSmokeScreenshots(sourceDir);
  writeFile(
    path.join(sourceDir, 'remote-release-verification.json'),
    '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n',
  );
  fs.rmSync(path.join(sourceDir, 'tart-smoke-summary.json'), { force: true });
  writeTypedBlockerFile(blockerRoot, 'first_run_vm_summary', {
    typed_blocker_ref: 'typed_blocker_ref://one-person-lab-app/test/collector-first-run-vm-summary',
  });

  const collected = runNode([
    'scripts/collect-release-evidence.ts',
    '--bundle-dir',
    bundleDir,
    '--action-id',
    'provider-scheduler:temporal:trigger',
    '--overwrite',
    '--execute-action',
    '--evidence-source-dir',
    sourceDir,
    '--typed-blocker',
    `first_run_vm_summary=${path.join(blockerRoot, 'typed-blockers', 'first_run_vm_summary.json')}`,
  ], {
    env: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` },
  });

  assert.equal(collected.status, 0, collected.stderr || collected.stdout);
  const payload = JSON.parse(collected.stdout);
  assert.equal(payload.status, 'blocked_evidence');
  assert.equal(payload.packaged_app_evidence, false);
  assert.deepEqual(payload.attached_artifacts, [
    'runtime_screenshot',
    'full_screenshot',
    'action_screenshot',
    'guest_smoke_summary',
    'assistant_route_smoke_summary',
    'codex_functional_check_summary',
    'assistant_route_smoke_mas_screenshot',
    'assistant_route_smoke_mag_screenshot',
    'assistant_route_smoke_rca_screenshot',
    'remote_release_verification',
    'codex_ai_self_check_summary',
    'first_run_vm_summary:typed_blocker',
  ]);
  assert.equal(payload.blocked_artifact_count, 1);
  assert.deepEqual(payload.blocked_artifacts, ['first_run_vm_summary']);
  assert.equal(payload.missing_artifact_count, 0);

  const validation = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    bundleDir,
    '--allow-missing-evidence',
  ]);
  assert.equal(validation.status, 0, validation.stderr || validation.stdout);
  const validationPayload = JSON.parse(validation.stdout);
  assert.equal(validationPayload.status, 'blocked_evidence');
  assert.equal(validationPayload.verified_artifact_count, 15);
  assert.equal(validationPayload.blocked_artifact_count, 1);
  assert.equal(
    validationPayload.blocked_artifacts[0].typed_blocker_ref,
    'typed_blocker_ref://one-person-lab-app/test/collector-first-run-vm-summary',
  );
});

test('App-owned automation entrypoints are TypeScript, not JavaScript wrappers', () => {
  const appOwnedEntrypoints = [
    ...walkFiles(path.join(appRoot, 'scripts')),
    ...walkFiles(path.join(appRoot, 'tests')),
  ];
  const javascriptEntrypoints = appOwnedEntrypoints
    .map((filePath) => path.relative(appRoot, filePath))
    .filter((relativePath) => /\.(mjs|cjs|js)$/.test(relativePath));

  assert.deepEqual(javascriptEntrypoints, []);
});

test('tracked App repo implementation files do not reintroduce JavaScript', () => {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: appRoot,
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr);

  const javascriptFiles = result.stdout
    .split('\0')
    .filter(Boolean)
    .filter((relativePath) => /\.(mjs|cjs|js|jsx)$/.test(relativePath));

  assert.deepEqual(javascriptFiles, []);
});

test('publish dry run defaults to the App GitHub Release repo', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const version = '26.5.15-test';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;

  writeFile(path.join(outDir, dmgName));
  writeFile(path.join(outDir, `One-Person-Lab-${version}-mac-arm64.zip`));
  writeReleaseMetadata(outDir, version, dmgName);
  writeStandardGatekeeperLaunchPolicy(outDir);
  writeFakeReleaseNotesAiWriter(fakeAi, validStandardAiReleaseNotes(version));

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_NOTES_MODE: 'ai',
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(payload.tag, `v${version}`);
  assert.equal(payload.release_notes_mode, 'ai');
  assert.ok(payload.artifacts.some((artifact) => artifact.endsWith(dmgName)));
});

test('publish dry run accepts prebuilt standard release assets from GitHub Actions', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-prebuilt-release-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const version = '26.5.15-test';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const metadata = [
    `version: ${version}`,
    'files:',
    `  - url: ${dmgName}`,
    '    sha512: test',
    '    size: 1',
    `path: ${dmgName}`,
    'sha512: test',
    '',
  ].join('\n');

  writeFile(path.join(releaseAssetsDir, dmgName));
  writeFile(path.join(releaseAssetsDir, zipName));
  writeFile(path.join(releaseAssetsDir, `${dmgName}.blockmap`));
  writeFile(path.join(releaseAssetsDir, `${zipName}.blockmap`));
  writeFile(path.join(releaseAssetsDir, 'latest-mac.yml'), metadata);
  writeFile(path.join(releaseAssetsDir, 'latest-arm64-mac.yml'), metadata);
  writeStandardGatekeeperLaunchPolicy(releaseAssetsDir);
  writeFakeReleaseNotesAiWriter(fakeAi, validStandardAiReleaseNotes(version));

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--standard-artifacts-dir',
    releaseAssetsDir,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '0',
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.standard_artifacts_dir, releaseAssetsDir);
  assert.equal(payload.release_notes_mode, 'ai');
  assert.ok(payload.standard_artifacts.some((artifact) => artifact.endsWith(dmgName)));
  assert.ok(payload.standard_artifacts.some((artifact) => artifact.endsWith('latest-arm64-mac.yml')));
  assert.ok(payload.upload_command.includes('--clobber'));
  assert.ok(payload.upload_commands.every((command) => command.includes('--clobber')));
  assert.equal(payload.upload_commands.length, payload.upload_command.filter((part) => String(part).startsWith(releaseAssetsDir)).length);
});

test('prebuilt standard release assets must include updater metadata', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-prebuilt-release-missing-metadata-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.5.15-test';

  writeFile(path.join(releaseAssetsDir, `One-Person-Lab-${version}-mac-arm64.dmg`));
  writeFile(path.join(releaseAssetsDir, `One-Person-Lab-${version}-mac-arm64.zip`));

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--standard-artifacts-dir',
    releaseAssetsDir,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '0',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /latest-mac\.yml/);
});

test('release asset validation fails before tagging when updater metadata keeps the shell version', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-shell-version-metadata-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.5.25';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const metadata = [
    'version: 2.1.1',
    'files:',
    `  - url: ${zipName}`,
    '    sha512: test-zip',
    '    size: 1',
    `  - url: ${dmgName}`,
    '    sha512: test-dmg',
    '    size: 1',
    `path: ${zipName}`,
    'sha512: test-zip',
    '',
  ].join('\n');

  writeFile(path.join(releaseAssetsDir, dmgName));
  writeFile(path.join(releaseAssetsDir, zipName));
  writeFile(path.join(releaseAssetsDir, `${dmgName}.blockmap`));
  writeFile(path.join(releaseAssetsDir, `${zipName}.blockmap`));
  writeFile(path.join(releaseAssetsDir, 'latest-mac.yml'), metadata);
  writeFile(path.join(releaseAssetsDir, 'latest-arm64-mac.yml'), metadata);

  const result = runNode(['scripts/validate-release.ts', releaseAssetsDir], {
    env: { OPL_RELEASE_VERSION: version },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /latest-mac\.yml does not declare OPL release version 26\.5\.25/);
  assert.match(result.stderr, /latest-arm64-mac\.yml does not declare OPL release version 26\.5\.25/);
});

test('release asset preparation drops stale standard assets from older OPL versions', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-stale-assets-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const artifactsDir = path.join(tempRoot, 'artifacts');
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.5.28';
  const previousVersion = '26.5.27';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const metadata = [
    `version: ${version}`,
    'files:',
    `  - url: ${zipName}`,
    '    sha512: test-zip',
    '    size: 1',
    `  - url: ${dmgName}`,
    '    sha512: test-dmg',
    '    size: 1',
    `path: ${zipName}`,
    'sha512: test-zip',
    '',
  ].join('\n');

  writeFile(
    path.join(shellRoot, 'scripts', 'prepare-release-assets.sh'),
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'rm -rf "$2"',
      'mkdir -p "$2"',
      'cp -f "$1"/* "$2"/',
      '',
    ].join('\n'),
  );
  fs.chmodSync(path.join(shellRoot, 'scripts', 'prepare-release-assets.sh'), 0o755);

  writeFile(path.join(artifactsDir, dmgName));
  writeFile(path.join(artifactsDir, zipName));
  writeFile(path.join(artifactsDir, `${dmgName}.blockmap`));
  writeFile(path.join(artifactsDir, `${zipName}.blockmap`));
  writeFile(
    path.join(artifactsDir, 'standard-gatekeeper-launch-policy.json'),
    `${JSON.stringify({
      schema: 'opl_gatekeeper_launch_policy.v1',
      package_kind: 'app_standard',
      app_path: '/Applications/One Person Lab.app',
      codesign_status: 'passed',
      spctl_status: 'passed',
    }, null, 2)}\n`,
  );
  writeFile(path.join(artifactsDir, `One-Person-Lab-${previousVersion}-mac-arm64.dmg.blockmap`));
  writeFile(path.join(artifactsDir, `One-Person-Lab-${previousVersion}-mac-arm64.zip.blockmap`));
  writeFile(path.join(artifactsDir, 'latest-mac.yml'), metadata);
  writeFile(path.join(artifactsDir, 'latest-arm64-mac.yml'), metadata);

  const result = runNode(['scripts/prepare-release-assets.ts', artifactsDir, releaseAssetsDir], {
    env: {
      OPL_APP_SHELL_ROOT: shellRoot,
      OPL_RELEASE_VERSION: version,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(releaseAssetsDir).sort(), [
    dmgName,
    `${dmgName}.blockmap`,
    zipName,
    `${zipName}.blockmap`,
    'latest-arm64-mac.yml',
    'latest-mac.yml',
    'standard-gatekeeper-launch-policy.json',
  ]);
});

test('remote release verifier validates standard and Full assets from GitHub release view', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-'));
  const version = '26.5.19-remote';
  const names = [
    ...writeStandardRemoteAssets(tempRoot, version),
    ...writeFullRemoteAssets(tempRoot, version),
  ];
  const summaryPath = path.join(tempRoot, 'remote-release-verification.json');
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--include-full-package',
    '--download-dir',
    tempRoot,
    '--summary-path',
    summaryPath,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.equal(summary.repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(summary.tag, `v${version}`);
  assert.equal(summary.include_full_package, true);
  assert.equal(summary.download_dir, tempRoot);
  assert.equal(summary.verified_asset_count, names.length);
  assert.deepEqual(summary.verified_assets.map((asset) => asset.name), names);
  assert.equal(summary.full_first_install_budget.status, 'passed');
  assert.equal(summary.full_first_install_budget.platform_scope, 'macos-arm64');
  assert.equal(summary.full_first_install_budget.warning_full_dmg_bytes, 700000000);
  assert.equal(summary.full_first_install_budget.max_full_dmg_bytes, 750000000);
  assert.equal(summary.full_first_install_budget.full_dmg_size_bytes, Buffer.byteLength('full-dmg'));
  assert.equal(summary.full_first_install_budget.runtime_uncompressed_bytes, 128);
  assert.deepEqual(summary.full_first_install_budget.temporal_core_bridge_releases, ['aarch64-apple-darwin']);
  assert.equal(summary.full_first_install_budget.excluded_module_venv_count, 0);
  assert.equal(summary.full_first_install_budget.required_components.temporal_cli.version, 'temporal version 1.7.0');
  assert.equal(summary.full_first_install_budget.optional_components.bun.status, 'not_packaged');
});

test('remote release verifier fails closed when Full runtime assertions are missing or broad', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-runtime-assertions-'));
  const version = '26.5.19-runtime-assertions';
  const names = writeStandardRemoteAssets(tempRoot, version);
  names.push(...writeFullRemoteAssets(tempRoot, version, {
    manifest: {
      runtime_assertions: {
        temporal_core_bridge_releases: ['aarch64-apple-darwin', 'x86_64-apple-darwin'],
        excluded_module_venv_count: 1,
      },
    },
  }));
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--include-full-package',
    '--download-dir',
    tempRoot,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Temporal core-bridge releases must be only aarch64-apple-darwin/);
});

test('remote release verifier rejects standard updater metadata that references Full assets', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-full-leak-'));
  const version = '26.5.19-remote-leak';
  const names = writeStandardRemoteAssets(tempRoot, version, { fullLeak: true });
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--download-dir',
    tempRoot,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /latest-mac\.yml references Full first-install assets/);
});

test('remote release verifier fails closed when Full size budget is exceeded', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-budget-'));
  const version = '26.5.19-budget';
  const names = [
    ...writeStandardRemoteAssets(tempRoot, version),
    ...writeFullRemoteAssets(tempRoot, version, {
      dmgContent: 'oversized-full-dmg',
      manifest: {
        size_budget: {
          platform_scope: 'macos-arm64',
          warning_full_dmg_bytes: 1,
          max_full_dmg_bytes: 4,
          max_runtime_uncompressed_bytes: 950000000,
        },
      },
    }),
  ];
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--include-full-package',
    '--download-dir',
    tempRoot,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Full DMG size budget exceeded/);
});

test('release plan exposes parallel lanes and the serialized no-CLT VM gate', () => {
  const result = runNode([
    'scripts/plan-release-candidate.ts',
    '--version',
    '26.5.19',
    '--include-full-package',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.version, '26.5.19');
  assert.equal(payload.strategy.same_tag_replacement, 'avoid_for_new_versions');
  assert.equal(payload.strategy.resume_uploads, 'skip_existing_assets_when_size_and_sha256_digest_match');
  assert.equal(payload.strategy.full_runtime_cache, 'content_addressed_layer_cache');
  assert.ok(payload.lanes.some((lane) => lane.id === 'standard_build' && lane.can_run_with.includes('full_build')));
  assert.ok(payload.lanes.some((lane) => lane.id === 'full_build' && lane.command.includes('OPL_FULL_RUNTIME_CACHE_MODE=readwrite')));
  assert.equal(payload.profile, 'stable');
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'standard_dmg_clean_vm_smoke'
    && lane.phase === 'installation_gate'
    && lane.command.includes('One-Person-Lab-26.5.19-mac-arm64.dmg')
    && lane.command.includes('--smoke-profile no-clt-clean-vm')
    && lane.command.includes('--display 1920x1080px')
    && lane.command.includes('--settings-smoke')
    && lane.command.includes('--assistant-route-smoke')
    && lane.command.includes('--runtime-profile standard')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'homebrew_standard_cask_clean_vm_smoke'
    && lane.phase === 'installation_gate'
    && lane.command.includes('--install-mode homebrew-cask')
    && lane.command.includes('--homebrew-cask one-person-lab')
    && lane.command.includes('--smoke-profile homebrew-standard-cask')
    && lane.command.includes('--display 1920x1080px')
    && lane.command.includes('--settings-smoke')
    && lane.command.includes('--assistant-route-smoke')
    && lane.command.includes('--runtime-profile standard')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'full_dmg_clean_vm_smoke'
    && lane.phase === 'release_gate'
    && lane.command.includes('One-Person-Lab-Full-26.5.19-mac-arm64.dmg')
    && lane.command.includes('--smoke-profile no-clt-clean-vm')
    && lane.command.includes('--display 1920x1080px')
    && lane.command.includes('--settings-smoke')
    && lane.command.includes('--assistant-route-smoke')
    && lane.command.includes('--runtime-profile full')
  )));
  assert.ok(payload.lanes.some((lane) => lane.id === 'one_shot_app_installer_smoke'));
  assert.ok(payload.lanes.some((lane) => lane.id === 'docker_webui_smoke'));
  assert.ok(payload.lanes.some((lane) => lane.id === 'release_evidence_bundle'));
});

test('nightly release plan stays lightweight and excludes stable installation gates', () => {
  const result = runNode([
    'scripts/plan-release-candidate.ts',
    '--version',
    '26.5.19-nightly.20260527',
    '--profile',
    'nightly',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.profile, 'nightly_standard');
  assert.deepEqual(payload.lanes.map((lane) => lane.id), [
    'release_boundary',
    'standard_build',
    'publish_nightly_prerelease',
    'remote_verify_standard',
    'webui_ghcr_publish',
  ]);
  assert.ok(payload.lanes.every((lane) => !/full|vm|installer|docker|evidence/i.test(lane.id)));
  assert.ok(
    payload.lanes
      .find((lane) => lane.id === 'webui_ghcr_publish')
      ?.command.includes('ghcr.io/<owner>/one-person-lab-webui:nightly'),
  );
});

test('publish dry run skips existing release assets when a resumed upload already has matching files', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-resume-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const version = '26.5.19-resume';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;

  const dmgContent = 'dmg';
  const zipContent = 'zip';
  writeFile(path.join(outDir, dmgName), dmgContent);
  writeFile(path.join(outDir, zipName), zipContent);
  writeReleaseMetadata(outDir, version, dmgName);
  writeStandardGatekeeperLaunchPolicy(outDir);
  writeFakeReleaseNotesAiWriter(fakeAi, validStandardAiReleaseNotes(version));

  const existingAssets = [
    { name: dmgName, size: Buffer.byteLength(dmgContent), digest: `sha256:${sha256(dmgContent)}` },
    { name: zipName, size: Buffer.byteLength(zipContent), digest: `sha256:${sha256(zipContent)}` },
    {
      name: 'latest-mac.yml',
      size: fs.statSync(path.join(outDir, 'latest-mac.yml')).size,
      digest: `sha256:${sha256(fs.readFileSync(path.join(outDir, 'latest-mac.yml')))}`,
    },
  ];
  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '1',
      OPL_RELEASE_EXISTING_ASSETS_JSON: JSON.stringify(existingAssets),
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_exists, true);
  assert.ok(payload.skipped_existing_artifacts.some((artifact) => artifact.name === dmgName));
  assert.ok(payload.skipped_existing_artifacts.some((artifact) => artifact.name === zipName));
  assert.ok(payload.upload_command.every((part) => !String(part).endsWith('.dmg')));
  assert.equal(payload.force_upload, false);
});

test('publish dry run reuploads same-size existing release assets when sha256 digest is missing or different', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-resume-strict-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const version = '26.5.19-resume-strict';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;

  writeFile(path.join(outDir, dmgName), 'dmg');
  writeFile(path.join(outDir, zipName), 'zip');
  writeReleaseMetadata(outDir, version, dmgName);
  writeStandardGatekeeperLaunchPolicy(outDir);
  writeFakeReleaseNotesAiWriter(fakeAi, validStandardAiReleaseNotes(version));

  const existingAssets = [
    { name: dmgName, size: 3 },
    { name: zipName, size: 3, digest: `sha256:${sha256('old')}` },
  ];
  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '1',
      OPL_RELEASE_EXISTING_ASSETS_JSON: JSON.stringify(existingAssets),
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.ok(payload.upload_command.some((part) => String(part).endsWith('.dmg')));
  assert.ok(payload.upload_command.some((part) => String(part).endsWith('.zip')));
  assert.deepEqual(payload.skipped_existing_artifacts, []);
});

test('publish dry run generates deterministic English release notes for Full-only lane', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-notes-'));
  const fullPackageDir = path.join(tempRoot, 'full');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const version = '26.5.18';
  const manifest = {
    generated_at: '2026-05-18T12:00:00.000Z',
    distribution: {
      updater_metadata_allowed: false,
    },
      components: {
        opl: { git_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        codex: { version: 'codex-cli 0.130.0' },
        mas: { git_commit: '1111111111111111111111111111111111111111' },
        mag: { git_commit: '2222222222222222222222222222222222222222' },
        rca: { git_commit: '3333333333333333333333333333333333333333' },
      meta_agent: { git_commit: '4444444444444444444444444444444444444444' },
      officecli: { version: '1.2.3' },
      mineru_open_api: { version: 'mineru-open-api version v0.1.3' },
    },
  };

  writeFile(path.join(fullPackageDir, `One-Person-Lab-Full-${version}-mac-arm64.dmg`));
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFullGatekeeperLaunchPolicy(fullPackageDir);
  writeFullRuntimeNativeTrust(fullPackageDir);
  const publicMarkdown = `One Person Lab 26.5.18

This release makes a clean OPL install more useful immediately by shipping refreshed MAS, MAG, RCA, OPL Meta Agent, OPL Framework, Codex CLI, OfficeCLI, MinerU, and packaged Codex skills together in the Full installer.

## What improved

### Packaged OPL agents are ready sooner
- MAS, MAG, RCA, and OPL Meta Agent are bundled from the Full package manifest, so new users reach the built-in research, grant-writing, visual-deliverable, and meta-agent entries with less module reconciliation after first launch.

### Installation proof is clearer
- The release keeps standard DMG, Full DMG, one-shot installer, and Docker/WebUI validation as separate install surfaces, so a failed gate points to the user path that needs attention.

## OPL agents and runtime payload
- Full clean-install DMG payload: OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills.
- Build-time payload refs: OPL Framework @ aaaaaaa; Codex CLI 0.130.0; MAS @ 1111111; MAG @ 2222222; RCA @ 3333333; OPL Meta Agent @ 4444444; OfficeCLI 1.2.3; MinerU v0.1.3.
- Payload updates since previous Stable: OPL Framework de72385 -> aaaaaaa; Codex CLI 0.129.0 -> 0.130.0; MAS 29369d4 -> 1111111; MAG 36ce5a9 -> 2222222; RCA c4af4b3 -> 3333333; OPL Meta Agent added at 4444444; OfficeCLI 1.0.93 -> 1.2.3; MinerU added at v0.1.3.

## Release scope
- Standard macOS arm64 updater package plus Full clean-install DMG.

**Full Changelog**: https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.5.17...v26.5.18
`;
  writeFakeReleaseNotesAiWriter(fakeAi, withHiddenLocalizedReleaseNotes(publicMarkdown, `One Person Lab 26.5.18

这次更新让一次干净的 OPL 安装更快可用：Full installer 会同时带上更新后的 MAS、MAG、RCA、OPL Meta Agent、OPL Framework、Codex CLI、OfficeCLI、MinerU 和打包的 Codex skills。

## What improved

### 打包的 OPL 智能体更快可用
- MAS、MAG、RCA 和 OPL Meta Agent 会随 Full package manifest 一起打包，新用户首次启动后更少需要等待模块 reconcile。

### 安装证明更清晰
- 标准 DMG、Full DMG、一键安装器和 Docker/WebUI 验证继续分开，失败时可以定位到具体用户路径。

## OPL agents and runtime payload
- Full clean-install DMG payload: OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills.
- Build-time payload refs: OPL Framework @ aaaaaaa; Codex CLI 0.130.0; MAS @ 1111111; MAG @ 2222222; RCA @ 3333333; OPL Meta Agent @ 4444444; OfficeCLI 1.2.3; MinerU v0.1.3.
- Payload updates since previous Stable: OPL Framework de72385 -> aaaaaaa; Codex CLI 0.129.0 -> 0.130.0; MAS 29369d4 -> 1111111; MAG 36ce5a9 -> 2222222; RCA c4af4b3 -> 3333333; OPL Meta Agent added at 4444444; OfficeCLI 1.0.93 -> 1.2.3; MinerU added at v0.1.3.

## Release scope
- Standard macOS arm64 updater package plus Full clean-install DMG.

**Full Changelog**: https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.5.17...v26.5.18
`));

  const result = runNode([
    'scripts/publish-release.ts',
    '--dry-run',
    '--version',
    version,
    '--full-package-only',
    '--include-full-package',
    '--full-package-dir',
    fullPackageDir,
  ], {
    env: {
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_notes_mode, 'template');
  const notes = payload.release_notes;
  const publicNotes = stripLocalizedReleaseNotesForTest(notes);
  assert.match(notes, /One Person Lab 26\.5\.18/);
  assert.match(notes, /What changed/);
  assert.match(notes, /Release scope/);
  assert.match(notes, /Standard macOS arm64 updater package plus Full clean-install DMG/);
  assert.match(notes, /OPL agents and runtime payload/);
  assert.match(notes, /MAS @ 1111111/);
  assert.match(notes, /MAG @ 2222222/);
  assert.match(notes, /RCA @ 3333333/);
  assert.match(notes, /OPL Meta Agent @ 4444444/);
  assert.match(notes, /OfficeCLI 1\.2\.3/);
  assert.match(notes, /MinerU v0\.1\.3/);
  assert.doesNotMatch(notes, /Release focus/);
  assert.doesNotMatch(notes, /Update channel guidance/);
  assert.doesNotMatch(notes, /Full first-install package/);
  assert.doesNotMatch(publicNotes, /[\u3400-\u9fff]/);
});

test('publish rejects Full notes when OPL Meta Agent release-note metadata is missing', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-notes-meta-agent-'));
  const fullPackageDir = path.join(tempRoot, 'full');
  const version = '26.5.19-meta-missing';
  const manifest = {
    generated_at: '2026-05-19T12:00:00.000Z',
    distribution: {
      updater_metadata_allowed: false,
    },
      components: {
        opl: { git_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        codex: { version: 'codex-cli 0.130.0' },
        mas: { git_commit: '1111111111111111111111111111111111111111' },
        mag: { git_commit: '2222222222222222222222222222222222222222' },
        rca: { git_commit: '3333333333333333333333333333333333333333' },
      officecli: { version: '1.2.3' },
      mineru_open_api: { version: 'mineru-open-api version v0.1.3' },
    },
  };

  writeFile(path.join(fullPackageDir, `One-Person-Lab-Full-${version}-mac-arm64.dmg`));
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFullGatekeeperLaunchPolicy(fullPackageDir);
  writeFullRuntimeNativeTrust(fullPackageDir);

  const result = runNode([
    'scripts/publish-release.ts',
    '--dry-run',
    '--version',
    version,
    '--full-package-only',
    '--include-full-package',
    '--full-package-dir',
    fullPackageDir,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /components\.meta_agent\.git_commit/);
});

test('publish rejects Full package native trust before Gatekeeper assessment passes', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-full-native-trust-pending-'));
  const fullPackageDir = path.join(tempRoot, 'full');
  const version = '26.5.19-native-trust-pending';
  const manifest = {
    generated_at: '2026-05-19T12:00:00.000Z',
    distribution: {
      updater_metadata_allowed: false,
    },
    components: {
      opl: { git_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      codex: { version: 'codex-cli 0.130.0' },
      mas: { git_commit: '1111111111111111111111111111111111111111' },
      mag: { git_commit: '2222222222222222222222222222222222222222' },
      rca: { git_commit: '3333333333333333333333333333333333333333' },
      meta_agent: { git_commit: '4444444444444444444444444444444444444444' },
      officecli: { version: '1.2.3' },
      mineru_open_api: { version: 'mineru-open-api version v0.1.3' },
    },
  };

  writeFile(path.join(fullPackageDir, `One-Person-Lab-Full-${version}-mac-arm64.dmg`));
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFullGatekeeperLaunchPolicy(fullPackageDir);
  writeFile(
    path.join(fullPackageDir, 'full-runtime-native-trust.json'),
    `${JSON.stringify({
      schema: 'opl_full_runtime_native_trust.v1',
      status: 'signed_pending_gatekeeper_assessment',
      executable_count: 2,
      executables: [
        {
          relative_path: 'runtime/current/node/bin/node',
          assessment_kind: 'launched_executable',
          codesign_status: 'passed',
          spctl_status: 'deferred_until_notarized_app',
          team_identifier: 'TESTTEAMID',
          signature: 'Developer ID Application: Test',
          quarantine_status: 'absent',
        },
        {
          relative_path: 'runtime/current/vendor/temporal/cli/temporal',
          assessment_kind: 'launched_executable',
          codesign_status: 'passed',
          spctl_status: 'deferred_until_notarized_app',
          team_identifier: 'TESTTEAMID',
          signature: 'Developer ID Application: Test',
          quarantine_status: 'absent',
        },
      ],
    }, null, 2)}\n`,
  );

  const result = runNode([
    'scripts/publish-release.ts',
    '--dry-run',
    '--version',
    version,
    '--full-package-only',
    '--include-full-package',
    '--full-package-dir',
    fullPackageDir,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /full-runtime-native-trust\.json must prove Full runtime native executable trust passed/);
});

test('Full-only release publish uses deterministic notes and does not call the AI note writer', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-full-only-template-notes-'));
  const fullPackageDir = path.join(tempRoot, 'full');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const evidencePath = path.join(tempRoot, 'full-release-notes-evidence.json');
  const version = '26.5.20-full-only-template';
  const manifest = {
    generated_at: '2026-05-20T12:00:00.000Z',
    distribution: {
      updater_metadata_allowed: false,
    },
    components: {
      opl: { git_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      codex: { version: 'codex-cli 0.130.0' },
      mas: { git_commit: '1111111111111111111111111111111111111111' },
      mag: { git_commit: '2222222222222222222222222222222222222222' },
      rca: { git_commit: '3333333333333333333333333333333333333333' },
      meta_agent: { git_commit: '4444444444444444444444444444444444444444' },
      officecli: { version: '1.2.3' },
      mineru_open_api: { version: 'mineru-open-api version v0.1.3' },
    },
  };

  writeFile(path.join(fullPackageDir, `One-Person-Lab-Full-${version}-mac-arm64.dmg`));
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFullGatekeeperLaunchPolicy(fullPackageDir);
  writeFullRuntimeNativeTrust(fullPackageDir);
  fs.mkdirSync(path.dirname(fakeAi), { recursive: true });
  fs.writeFileSync(fakeAi, '#!/usr/bin/env node\nprocess.exit(42);\n', { mode: 0o755 });

  const result = runNode([
    'scripts/publish-release.ts',
    '--dry-run',
    '--version',
    version,
    '--full-package-only',
    '--include-full-package',
    '--full-package-dir',
    fullPackageDir,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '1',
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
      OPL_RELEASE_NOTES_EVIDENCE_OUTPUT: evidencePath,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_notes_mode, 'template');
  assert.equal(payload.full_package_only, true);
  assert.equal(payload.create_release, false);
  assert.match(payload.release_notes, /OPL agents and runtime payload/);
  assert.match(payload.release_notes, /MAS @ 1111111/);
  assert.match(payload.release_notes, /MAG @ 2222222/);
  assert.match(payload.release_notes, /RCA @ 3333333/);
  assert.match(payload.release_notes, /OPL Meta Agent @ 4444444/);
  assert.ok(fs.existsSync(evidencePath));
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  assert.equal(evidence.payload.include_full_package, true);
  assert.ok(evidence.payload.bundled_refs.some((line) => line.includes('MAS @ 1111111')));
});

test('existing same-tag standard plus Full publish uses deterministic full release notes body', () => {
  const source = fs.readFileSync(path.join(appRoot, 'scripts', 'publish-release.ts'), 'utf8');

  assert.match(source, /else if \(options\.includeFullPackage && options\.fullPackageOnly\)/);
  assert.match(source, /replaceReleaseNotes\(options\.releaseRepo, tag, releaseNotes\)/);
  assert.match(source, /buildAiReleaseNotesDocument\(evidence\)/);
  assert.match(source, /OPL_RELEASE_NOTES_EVIDENCE_OUTPUT/);
  assert.match(source, /options\.fullPackageOnly \? 'template' : 'ai'/);
  assert.match(source, /Full-only asset refreshes/);
  assert.match(
    source,
    /else if \(options\.includeFullPackage\) {\s*replaceReleaseNotes\(options\.releaseRepo, tag, releaseNotes\);/
  );
  assert.doesNotMatch(source, /Bundled OPL runtime and agent versions/);
  assert.doesNotMatch(source, /buildBundledModuleNotes/);
});

test('tag-triggered release workflow stamps package metadata from tag version', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  const tagVersionResolver = [
    'if [ -z "$version" ] && [[ "$GITHUB_REF" == refs/tags/v* ]]; then',
    'version="${REF_NAME#v}"',
    'echo "OPL_RELEASE_VERSION=$version" >> "$GITHUB_ENV"',
  ];

  for (const expectedLine of tagVersionResolver) {
    assert.match(workflow, new RegExp(expectedLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('active shell command wrapper injects App release version for local builds', () => {
  const today = new Date();
  const expectedDefaultVersion = `${String(today.getUTCFullYear()).slice(-2)}.${today.getUTCMonth() + 1}.${today.getUTCDate()}`;
  const printVersion = ['scripts/run-active-shell-command.ts', process.execPath, '-e', 'process.stdout.write(process.env.OPL_RELEASE_VERSION || "")'];

  const defaultResult = runNode(printVersion, { env: { OPL_RELEASE_VERSION: '' } });
  assert.equal(defaultResult.status, 0, defaultResult.stderr || defaultResult.stdout);
  assert.equal(defaultResult.stdout, expectedDefaultVersion);

  const explicitResult = runNode(printVersion, { env: { OPL_RELEASE_VERSION: '30.1.2-test.3' } });
  assert.equal(explicitResult.status, 0, explicitResult.stderr || explicitResult.stdout);
  assert.equal(explicitResult.stdout, '30.1.2-test.3');
});

test('release code-quality uses App active-shell test runner', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');

  assert.match(workflow, /node --experimental-strip-types scripts\/run-active-shell-tests\.ts/);
  assert.doesNotMatch(workflow, /run:\s*bunx vitest run/);
});

test('release build uses App wrappers for cross-shell active-shell commands', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const adapterContract = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'));
  const shellBuildScript = fs.readFileSync(path.join(activeShellRoot, 'scripts', 'build-with-builder.js'), 'utf8');
  const shellViteConfig = fs.readFileSync(
    path.join(activeShellRoot, 'packages', 'desktop', 'electron.vite.config.ts'),
    'utf8',
  );

  assert.match(workflow, /command:\s*bun install --cwd shells\/aionui --frozen-lockfile/);
  assert.doesNotMatch(workflow, /command:\s*cd shells\/aionui && bun install --frozen-lockfile/);
  assert.equal(adapterContract.shell_contract.layout_id, 'aionui_v2_workspace');
  assert.equal(adapterContract.shell_contract.paths.product_profile_target, 'packages/desktop/src/common/config/oplProductProfile/oplProductProfile.generated.json');
  assert.equal(adapterContract.shell_contract.paths.electron_builder_config, 'packages/desktop/electron-builder.yml');
  assert.equal(adapterContract.shell_source.upstream_ref, 'fbce423c7a698048dd4422020541a004785e5d82');
  assert.match(
    workflow,
    /name: Prepare standard App payload[\s\S]*working-directory: \$\{\{ github\.workspace \}\}[\s\S]*run: node --experimental-strip-types scripts\/prepare-standard-release-payload\.ts/,
  );
  assert.match(
    workflow,
    /name: Verify packaged bundled bun assets[\s\S]*working-directory: \$\{\{ github\.workspace \}\}[\s\S]*run: bun run validate:opl-package/,
  );
  assert.equal(packageJson.scripts['test:packaged:bun'], 'node --experimental-strip-types scripts/run-active-shell-command.ts bun run validate:opl-package');
  assert.equal(packageJson.scripts['install:shell'], 'node --experimental-strip-types scripts/run-active-shell-command.ts bun install --frozen-lockfile');
  assert.equal(
    packageJson.scripts['validate:gui-shell'],
    'node --experimental-strip-types scripts/validate-active-shell.ts && node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run package',
  );
  assert.doesNotMatch(JSON.stringify(packageJson.scripts), /--cwd shells\/aionui|cd shells\/aionui/);
  assert.match(shellBuildScript, /--config\.extraMetadata\.version=\$\{version\}/);
  assert.match(shellBuildScript, /\$\{publishArg\} \$\{oplReleaseVersionConfigArg\}/);
  assert.match(shellViteConfig, /const appReleaseVersion = injectedOplReleaseVersion \|\| rootPackageJson\.version/);
  assert.match(shellViteConfig, /__APP_VERSION__:\s*JSON\.stringify\(appReleaseVersion\)/);
});

test('active shell adapter keeps GUI authority and replacement gates in the App repo', () => {
  const adapterContract = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'));

  assert.equal(adapterContract.gui_authority.source_of_truth, 'one-person-lab-app');
  assert.equal(adapterContract.gui_authority.implementation_role, 'active_shell_implementation_carrier');
  for (const contractRef of [
    'contracts/app-gui-product-contract.json',
    'contracts/app-product-profile.json',
    'contracts/app-install-exposure-policy.json',
    'contracts/app-page-state-matrix.json',
    'contracts/app-first-run-test-matrix.json',
    'contracts/app-release-channel.json',
  ]) {
    assert.ok(adapterContract.gui_authority.product_contracts.includes(contractRef), contractRef);
  }
  assert.deepEqual(adapterContract.gui_authority.shell_may_own, [
    'concrete renderer implementation',
    'process and preload implementation',
    'shell package metadata',
    'shell tests and release hooks',
    'upstream AionUI intake',
    'shell-local implementation details',
    'shell-local tests that prove App contracts are implemented',
  ]);
  assert.deepEqual(adapterContract.gui_authority.shell_must_not_own, [
    'App GUI product truth',
    'App user-facing page-state authority',
    'App model-selection policy',
    'App onboarding policy',
    'App release/user documentation authority',
    'App release gate policy',
    'OPL runtime truth',
    'domain truth',
    'provider implementation',
  ]);
  assert.equal(
    adapterContract.gui_authority.upstream_intake_policy,
    'check_against_app_owned_gui_contracts_before_acceptance',
  );
  assert.equal(adapterContract.gui_product_contract, 'contracts/app-gui-product-contract.json');
  assert.deepEqual(adapterContract.gui_product_contract_policy, {
    must_implement: true,
    source_of_truth: 'one-person-lab-app',
    upstream_override_allowed: false,
    upstream_family_role: 'implementation_material_only',
    aionui_upstream_must_not_override_app_truth: true,
  });
  assert.deepEqual(adapterContract.state_surface_contract, {
    primary_read_command: 'opl app state --profile fast --json',
    refresh_read_command: 'opl app state --profile fast --json',
    full_state_read_command: 'opl app state --profile full --json',
    full_state_policy: 'diagnostic_or_release_evidence_only',
    action_command: 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
    full_drilldown_exception: 'opl runtime app-operator-drilldown --detail full --json',
    forbidden_gui_truth_sources: [
      'direct opl modules --json page aggregation',
      'direct opl system developer-supervisor page aggregation',
      'direct opl family-runtime worker status page aggregation',
      'application.systemInfo as OPL path truth',
      'application.appVersions as OPL release truth',
      'direct reads of OPL internal state files',
    ],
  });
  for (const capability of [
    'app_owned_gui_product_contract',
    'opl_app_state_bridge',
    'opl_app_action_bridge',
    'app_gui_release_channel_gating',
  ]) {
    assert.ok(adapterContract.shell_contract.capabilities.includes(capability), capability);
  }
  assert.ok(!('docker_webui_contract' in adapterContract));

  assert.equal(adapterContract.shell_replacement_policy.candidate_root_pattern, 'shells/<candidate>');
  assert.equal(
    adapterContract.shell_replacement_policy.candidate_state,
    'candidate_until_contracts_and_tests_complete',
  );
  assert.equal(adapterContract.shell_replacement_policy.authority_transfer_allowed, false);
  for (const gate of [
    'declare candidate in contracts/app-shell-candidates.json',
    'implement contracts/app-gui-product-contract.json',
    'sync App product profile into the candidate shell target',
    'pass App page-state and first-run matrices',
    'pass App-root active shell validation',
    'pass GUI package compile through App wrapper',
    'preserve external checkout history policy',
  ]) {
    assert.ok(adapterContract.shell_replacement_policy.adoption_gate.includes(gate), gate);
  }
  assert.ok(
    !adapterContract.shell_replacement_policy.adoption_gate.includes('declare candidate in contracts/app-shell-adapter.json'),
  );
});

test('App shell candidates are isolated from active AionUI release shell', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const adapterContract = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'));
  const candidateRegistry = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-candidates.json'), 'utf8'),
  );
  const aguiCandidate = candidateRegistry.candidates.find((candidate) => candidate.id === 'agui-codex');

  assert.equal(packageJson.scripts['validate:shell-candidates'], 'node --experimental-strip-types scripts/validate-shell-candidates.ts');
  assert.equal(candidateRegistry.owner, 'one-person-lab-app');
  assert.equal(candidateRegistry.purpose, 'app_shell_candidate_registry');
  assert.equal(candidateRegistry.state, 'active_experimental');
  assert.equal(candidateRegistry.active_shell_unchanged, adapterContract.active_shell);
  assert.equal(candidateRegistry.release_shell_contract, 'contracts/app-shell-adapter.json');
  assert.equal(candidateRegistry.candidate_policy.release_participation_until_adopted, 'explicit_candidate_build_only');
  assert.equal(candidateRegistry.candidate_policy.release_scripts_must_use_active_shell_adapter, true);
  assert.equal(candidateRegistry.candidate_policy.authority_transfer_allowed, false);
  assert.ok(candidateRegistry.candidate_policy.adoption_gate.includes('candidate is declared in contracts/app-shell-candidates.json'));
  assert.ok(
    candidateRegistry.candidate_policy.adoption_gate.includes(
      'contracts/app-shell-adapter.json is changed only when candidate becomes active release shell',
    ),
  );
  assert.ok(aguiCandidate);
  assert.equal(aguiCandidate.state, 'technical_verification');
  assert.equal(aguiCandidate.candidate_root, 'shells/agui-codex');
  assert.equal(aguiCandidate.adapter_contract, 'contracts/shell-adapters/agui-codex.json');
  assert.equal(aguiCandidate.source_topology, 'external_checkout_linked_shell_repo');
  assert.equal(aguiCandidate.release_participation, 'selectable_for_explicit_candidate_build');
  assert.equal(aguiCandidate.target_product_shape.codex_cli_fixed_executor, true);
  assert.equal(aguiCandidate.target_product_shape.home_executor_selector_visible, false);
  assert.equal(aguiCandidate.target_product_shape.home_backend_selector_visible, false);
  assert.equal(aguiCandidate.target_product_shape.home_model_selector_visible, true);
  assert.equal(aguiCandidate.target_product_shape.permission_mode_selector_visible, false);
  assert.deepEqual(aguiCandidate.target_product_shape.purpose_entries, ['research', 'grant', 'ppt']);
  assert.equal(aguiCandidate.framework_surfaces.state, 'opl app state --profile fast --json');
  assert.equal(
    aguiCandidate.framework_surfaces.action,
    'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
  );
  assert.ok(aguiCandidate.required_capabilities.includes('agui_event_contract_map'));
  assert.ok(aguiCandidate.required_capabilities.includes('release_isolation'));
  assert.ok(aguiCandidate.required_capabilities.includes('candidate_app_bundle_package'));
  assert.ok(aguiCandidate.validation_commands.some((entry) => (
    entry.id === 'candidate_app_bundle_build'
    && /OPL_APP_SHELL_ADAPTER_CONTRACT=contracts\/shell-adapters\/agui-codex\.json npm run package/.test(entry.command)
  )));
  assert.ok(aguiCandidate.must_not_own.includes('App GUI product truth'));
  assert.ok(aguiCandidate.must_not_own.includes('OPL runtime truth'));
  assert.ok(aguiCandidate.must_not_own.includes('domain truth'));
  assert.ok(aguiCandidate.non_goals.includes('do not switch active_shell away from aionui'));
  assert.ok(aguiCandidate.non_goals.includes('do not enter default stable or nightly release packaging'));
});

test('explicit AG-UI/Codex adapter contract selects linked external candidate shell', () => {
  const result = runNode(
    [
      '-e',
      "import('./scripts/app-shell-adapter.ts').then(({ resolveActiveShellPaths }) => { const shell = resolveActiveShellPaths(); console.log(JSON.stringify({ active_shell: shell.contract.active_shell, shell_root: shell.contract.shell_root, shell_root_for_display: shell.shellRootForDisplay, product_profile_target: shell.productProfileTargetPath, release_role: shell.contract.release_role })); })",
    ],
    {
      env: {
        OPL_APP_SHELL_ADAPTER_CONTRACT: 'contracts/shell-adapters/agui-codex.json',
        OPL_APP_SHELL_ROOT: '',
      },
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const resolved = JSON.parse(result.stdout);
  assert.equal(resolved.active_shell, 'agui-codex');
  assert.equal(resolved.shell_root, 'shells/agui-codex');
  assert.equal(resolved.shell_root_for_display, 'shells/agui-codex');
  assert.match(resolved.product_profile_target, /shells\/agui-codex\/src\/generated\/oplProductProfile\.generated\.json$/);
  assert.equal(resolved.release_role, 'experimental_candidate_shell');
});

test('AG-UI/Codex candidate package validation requires a real app bundle manifest', () => {
  const source = fs.readFileSync(path.join(appRoot, 'scripts', 'validate-shell-candidates.ts'), 'utf8');
  const candidateAdapter = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'shell-adapters', 'agui-codex.json'), 'utf8'),
  );

  assert.equal(candidateAdapter.shell_contract.layout_id, 'agui_codex_app_bundle');
  assert.ok(candidateAdapter.shell_contract.capabilities.includes('candidate_app_bundle_package'));
  assert.ok(candidateAdapter.validation_commands.some((entry) => entry.id === 'candidate_app_bundle_build'));
  assert.match(source, /validateCandidatePackageManifest/);
  assert.match(source, /candidate_app_bundle_ready/);
  assert.match(source, /explicit_candidate_app_bundle/);
  assert.match(source, /\.endsWith\('\.app'\)/);
  assert.match(source, /assertDirectory\(appBundleRoot/);
  assert.match(source, /Contents', 'Info\.plist'/);
  assert.match(source, /Contents', 'MacOS'/);
  assert.match(source, /findMacAppExecutable/);
  assert.match(source, /assertNoAbsoluteSymlinks/);
  assert.match(source, /App-owned product profile input/);
  assert.doesNotMatch(JSON.stringify(candidateAdapter), /candidate_package_smoke|candidate_package_smoke_ready|\.txt/);
});

test('default shell adapter remains stable AionUI when no candidate adapter is selected', () => {
  const result = runNode([
    '-e',
    "import('./scripts/app-shell-adapter.ts').then(({ resolveActiveShellPaths }) => { const shell = resolveActiveShellPaths(); console.log(JSON.stringify({ active_shell: shell.contract.active_shell, shell_root: shell.contract.shell_root, release_role: shell.contract.release_role })); })",
  ], { env: { OPL_APP_SHELL_ADAPTER_CONTRACT: '' } });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const resolved = JSON.parse(result.stdout);
  assert.equal(resolved.active_shell, 'aionui');
  assert.equal(resolved.shell_root, 'shells/aionui');
  assert.equal(resolved.release_role, 'stable_app_shell');
});

test('App GUI product contract owns GUI requirements and unified OPL state/action boundaries', () => {
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const productProfile = readProductProfile();

  assert.equal(guiContract.owner, 'one-person-lab-app');
  assert.equal(guiContract.purpose, 'app_owned_gui_product_contract');
  assert.equal(guiContract.product_authority.source_of_truth, 'one-person-lab-app');
  assert.equal(guiContract.product_authority.active_shell_role, 'implementation_carrier');
  assert.equal(guiContract.product_authority.upstream_gui_role, 'implementation_material_only');
  assert.equal(
    guiContract.product_authority.upstream_behavior_acceptance_policy,
    'must_match_app_owned_gui_product_contract_before_release',
  );
  assert.equal(guiContract.product_authority.shell_upgrade_policy.role, 'replaceable_implementation_carrier');
  assert.ok(guiContract.product_authority.shell_upgrade_policy.app_repo_controls.includes('settings information architecture'));
  assert.ok(guiContract.product_authority.shell_upgrade_policy.app_repo_controls.includes('home command center requirements'));
  assert.ok(guiContract.product_authority.shell_upgrade_policy.app_repo_controls.includes('page-state acceptance matrix'));
  assert.ok(guiContract.product_authority.shell_upgrade_policy.shell_repo_controls.includes('renderer implementation details'));
  assert.ok(guiContract.product_authority.shell_upgrade_policy.shell_repo_controls.includes('upstream AionUI intake patches'));
  assert.match(guiContract.product_authority.shell_upgrade_policy.upgrade_rule, /App-owned contracts/);
  assert.match(guiContract.product_authority.shell_upgrade_policy.replacement_rule, /active-shell validation/);
  assert.equal(guiContract.framework_surfaces.canonical_state.default_command, 'opl app state --profile fast --json');
  assert.equal(guiContract.framework_surfaces.canonical_state.refresh_command, 'opl app state --profile fast --json');
  assert.equal(guiContract.framework_surfaces.canonical_state.default_operator_payload, 'current_owner_delta');
  assert.equal(guiContract.framework_surfaces.canonical_state.compatibility_operator_payload, 'compact_owner_delta_projection');
  assert.equal(guiContract.framework_surfaces.canonical_state.default_profile, 'fast');
  assert.equal(guiContract.framework_surfaces.canonical_state.manual_refresh_profile, 'fast');
  assert.equal(guiContract.framework_surfaces.canonical_state.full_profile_policy, 'diagnostic_or_release_evidence_only');
  assert.deepEqual(guiContract.framework_surfaces.canonical_state.default_read_surface_policy, {
    default_projection: 'opl_current_owner_delta',
    compatibility_projection: 'opl_compact_owner_delta_projection',
    source_path: 'app_state.operator.default_read_surface_policy',
    full_detail_policy: 'explicit_full_detail_or_lazy_diagnostic_only',
    raw_refs_policy: 'raw_refs_require_explicit_full_detail',
    full_detail_auto_poll: false,
    shell_must_not_use_full_drilldown_as_normal_state: true,
    shell_must_not_derive_layout_from_raw_runtime_projection: true,
  });
  assert.equal(
    guiContract.framework_surfaces.canonical_action.command,
    'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
  );
  assert.equal(
    guiContract.framework_surfaces.runtime_full_drilldown.command,
    'opl runtime app-operator-drilldown --detail full --json',
  );
  assert.equal(guiContract.framework_surfaces.runtime_full_drilldown.policy, 'on_demand_only');
  assert.deepEqual(guiContract.framework_surfaces.runtime_default_attention.active_project_line_fields, [
    'app_state.operator.workbench.summary_cards[active_projects]',
    'app_state.operator.workbench.activity_center.active_projects',
    'app_state.operator.visual_ref_groups.active_project_refs',
  ]);
  assert.equal(
    guiContract.framework_surfaces.runtime_default_attention.active_project_line_policy,
    'queued_or_escalated_owner_handled_project_lines_count_as_user_visible_active_projects_without_claiming_active_worker_run',
  );
  assert.deepEqual(guiContract.framework_surfaces.runtime_default_attention.project_group_expansion_policy, {
    running_group_default: 'expanded',
    attention_group_default: 'visible_when_nonempty',
    inactive_group_default: 'collapsed',
    inactive_states: ['queued', 'pending', 'waiting', 'stopped', 'parked', 'checkpointed', 'blocked', 'attention_needed'],
    inactive_summary_fields: ['count', 'status', 'next_visible_step'],
  });
  assert.deepEqual(
    guiContract.framework_surfaces.runtime_default_attention.must_not_default_display_terms,
    [
      'Temporal',
      'provider',
      'projection',
      'ref',
      'stage attempt',
      'ledger',
      'current_control_state',
      'AionUI',
      'backend selector',
      'shell candidate',
      'runtime implementation selector',
    ],
  );
  assert.deepEqual(guiContract.ordinary_cockpit_surface_budget, {
    surface_id: 'ordinary_app_cockpit_surface_budget',
    purpose: 'keep Home, Runtime, and Settings focused on purpose, task status, next owner, artifact/blocker, and release facts',
    applies_to_pages: [
      'guid_home',
      'runtime',
      'settings_general',
      'access',
      'capabilities',
      'environment',
      'settings_theme',
      'advanced',
      'about',
      'update',
    ],
    ordinary_allowed_answer_shapes: [
      'purpose_entry',
      'task_status',
      'next_owner',
      'accepted_answer_shape',
      'artifact_or_blocker',
      'release_fact',
      'app_profile',
      'access_status',
      'agent_capability',
      'local_environment_status',
      'appearance_preference',
      'advanced_diagnostic_link',
      'about_update_fact',
    ],
    ordinary_must_not_default_display_terms: expectedOrdinaryCockpitForbiddenTerms,
    diagnostics_escape_hatch: 'Advanced, release evidence, developer detail, or explicit full-detail drilldown only',
    source_policy: 'ordinary views consume opl app state --profile fast --json and must not derive first-screen layout from raw runtime drilldown',
  });
  assert.equal(guiContract.executor_policy.default_executor, 'codex_cli');
  assert.equal(guiContract.executor_policy.codex_cli_fixed_executor, true);
  assert.equal(guiContract.executor_policy.codex_only_default, true);
  assert.equal(guiContract.executor_policy.home_executor_selector_visible, false);
  assert.equal(guiContract.executor_policy.executor_tab_visible_when_single_executor, false);
  assert.equal(guiContract.executor_policy.default_model_strategy, 'codex_cli_auto_latest_available_frontier');
  assert.equal(guiContract.executor_policy.default_model_display_value, 'GPT-5.5（超高）');
  assert.equal(guiContract.executor_policy.home_model_status_label, 'GPT-5.5（超高）');
  assert.equal(
    guiContract.executor_policy.home_model_status_policy,
    'display_default_model_and_reasoning_with_visible_selector',
  );
  assert.equal(
    guiContract.executor_policy.conversation_model_status_policy,
    'display_same_model_and_reasoning_with_visible_selector_in_codex_conversation',
  );
  assert.equal(
    guiContract.executor_policy.conversation_pending_feedback_policy,
    'display_elapsed_seconds_while_ai_processing_or_backend_running',
  );
  assert.equal(guiContract.executor_policy.precise_model_display_policy, 'friendly_default_model_and_reasoning_visible');
  assert.equal(guiContract.executor_policy.permission_mode_selector_visible_on_home, false);
  assert.equal(guiContract.executor_policy.model_selector_visible_on_new_conversation, true);
  assert.equal(guiContract.executor_policy.model_selector_visible_in_conversation, true);
  assert.equal(guiContract.executor_policy.backend_selector_visible_in_conversation, false);
  assert.equal(guiContract.executor_policy.permission_mode_selector_visible_in_conversation, false);
  assert.equal(guiContract.executor_policy.user_model_override_allowed, true);
  assert.equal(guiContract.executor_policy.restore_auto_model_selection_allowed, true);
  assert.deepEqual(guiContract.executor_policy.frontier_model_preference_order, [
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.3-codex',
    'gpt-5.2',
  ]);
  assert.deepEqual(guiContract.default_assistants.map((assistant) => assistant.id), ['mas', 'mag', 'rca']);
  assert.ok(guiContract.default_assistants.every((assistant) => assistant.home_entry_policy === 'purpose_entry_target'));
  assert.deepEqual(guiContract.assistant_skill_profiles.map((profile) => profile.assistant_id), ['mas', 'mag', 'rca']);
  assert.deepEqual(
    Object.fromEntries(guiContract.assistant_skill_profiles.map((profile) => [profile.assistant_id, profile.required_skills])),
    { mas: ['mas'], mag: ['mag'], rca: ['rca'] },
  );
  assert.ok(
    guiContract.assistant_skill_profiles.every(
      (profile) => profile.skill_menu_policy === 'assistant_scoped_required_checked_optional_visible',
    ),
  );
  const guiContractPackagedSkillIds = new Set(productProfile.companion_payloads.default_packaged_codex_skill_ids);
  assert.ok(
    guiContract.assistant_skill_profiles.every((profile) =>
      [...profile.required_skills, ...profile.optional_skills].every((skill) => guiContractPackagedSkillIds.has(skill)),
    ),
  );
  assert.ok(guiContract.assistant_skill_profiles.every((profile) => !('hidden_home_skill_names' in profile)));
  assert.ok(guiContract.assistant_skill_profiles.every((profile) => !profile.optional_skills.includes('morph-ppt')));
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.scope, 'home_purpose_entry_to_conversation');
  assert.deepEqual(guiContract.builtin_assistant_route_receipt_policy.required_for_assistants, ['mas', 'mag', 'rca']);
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.route_kind, 'builtin_capability');
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.executor, 'codex_cli');
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.source, 'opl_app_home');
  assert.deepEqual(guiContract.builtin_assistant_route_receipt_policy.required_fields, [
    'route_kind',
    'executor',
    'assistant_id',
    'assistant_short_name',
    'source',
  ]);
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.must_not_depend_on_visible_backend_selection, true);
  assert.deepEqual(guiContract.ordinary_capability_selector_policy, {
    scope: 'home_composer_and_ordinary_conversation',
    authority: 'app_owned_opl_allowlist',
    skill_source_ref: 'assistant_skill_profiles.required_skills + optional_skills',
    skill_menu_policy: 'assistant_scoped_required_checked_optional_visible',
    conversation_loaded_skill_display_policy: 'filter_to_ordinary_skill_allowlist',
    mcp_server_source_ref: 'contracts/app-product-profile.json#gui.ordinary_capability_selector_policy.visible_mcp_server_ids',
    mcp_menu_policy: 'empty_until_app_explicitly_whitelists_opl_mcp_servers',
    visible_mcp_server_ids: [],
    conversation_loaded_mcp_display_policy: 'filter_to_visible_mcp_server_ids',
    forbidden_skill_examples: ['aionui-skills', 'aionui-webui-setup', 'skill-creator', 'cron'],
    forbidden_mcp_policy: 'do_not_surface_user_or_aionui_mcp_servers_in_ordinary_home_without_app_profile_allowlist',
  });
  assert.deepEqual(guiContract.home_purpose_entries.map((entry) => entry.id), ['research', 'grant', 'ppt']);
  assert.deepEqual(guiContract.home_purpose_entries.map((entry) => entry.primary_label), ['科研', '基金', '演示']);
  assert.deepEqual(guiContract.home_purpose_entries.map((entry) => entry.target_assistant_id), ['mas', 'mag', 'rca']);
  assert.ok(guiContract.home_purpose_entries.every((entry) => entry.display_policy === 'purpose_first'));
  assert.equal(guiContract.non_default_assistants.find((assistant) => assistant.id === 'oma').home_default_visible, false);
  assert.equal(guiContract.retired_domain_agents.find((agent) => agent.id === 'mds').default_display_allowed, false);
  assert.equal(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.policy,
    'app_contract_first_thin_shell_delta',
  );
  assert.ok(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.preferred_optimization_path.includes(
      'encode product behavior in App contracts and product profile',
    ),
  );
  assert.ok(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.allowed_shell_delta.includes(
      'thin renderer components for App-owned pages',
    ),
  );
  assert.ok(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.requires_app_contract_before_shell_change.includes(
      'new visible model/provider/permission control',
    ),
  );
  assert.ok(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.forbidden_shell_delta.includes(
      'shell-owned product IA',
    ),
  );
  assert.equal(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.replacement_rule,
    'a candidate shell should implement the same App contracts by swapping adapters/profile consumers, not by inheriting AionUI-specific product logic',
  );
  assert.equal(guiContract.pages.guid_home.hero_prompt, '把研究、基金和汇报交给 One Person Lab 自动推进');
  assert.equal(guiContract.pages.guid_home.model_status.display_value, 'GPT-5.5（超高）');
  assert.equal(guiContract.pages.guid_home.model_status.selector_visible, true);
  assert.equal(
    guiContract.pages.guid_home.conversation_feedback_policy.pending_indicator,
    'visible elapsed seconds while request is pending or backend is running',
  );
  assert.equal(
    guiContract.pages.guid_home.conversation_feedback_policy.model_status,
    'same model status and selector appear in Codex conversation composer',
  );
  assert.equal(guiContract.pages.guid_home.conversation_feedback_policy.raw_trace_visible, false);
  assert.ok(guiContract.pages.guid_home.must_show.includes('single composer-first home input'));
  assert.ok(guiContract.pages.guid_home.must_show.includes('runtime/task progress available from Runtime page, not Home activity grid'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('expanded workbench or activity refs grid on ordinary home'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('compact continue-work entry near the home input'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('Home footer feedback icon'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('Home footer favorite/star icon'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('Home footer web/access globe icon'));
  assert.equal(
    guiContract.pages.guid_home.activity_center_policy.source,
    'runtime page only; Home does not query running task lists',
  );
  assert.equal(guiContract.pages.guid_home.activity_center_policy.authority, 'app_owned_home_minimal_command_surface');
  assert.equal(
    guiContract.pages.guid_home.activity_center_policy.role,
    'home_runtime_activity_suppressed_to_keep_composer_first',
  );
  assert.equal(
    guiContract.pages.guid_home.activity_center_policy.default_placement,
    'not_rendered_on_ordinary_home',
  );
  assert.equal(
    guiContract.pages.guid_home.activity_center_policy.home_surface_policy,
    'ordinary_home_must_not_render_activity_center_or_continue_work_grid',
  );
  assert.deepEqual(guiContract.pages.guid_home.activity_center_policy.allowed_home_runtime_context, []);
  assert.ok(guiContract.pages.guid_home.activity_center_policy.must_not_display.includes('expanded continue-work center'));
  assert.ok(guiContract.pages.guid_home.activity_center_policy.must_not_display.includes('needs attention / active / recent activity groups'));
  assert.ok(guiContract.pages.guid_home.activity_center_policy.must_not_display.includes('domain artifact body'));
  assert.ok(guiContract.pages.guid_home.activity_center_policy.must_not_display.includes('memory body'));
  assert.ok(guiContract.pages.settings_advanced.must_show.includes('OPL Flow Context'));
  assert.ok(guiContract.pages.settings_advanced.sections.includes('opl_agent_codex_context'));
  assert.ok(guiContract.pages.settings_advanced.legacy_state_sections.includes('opl_agent_codex_context'));
  for (const pageId of guiContract.ordinary_cockpit_surface_budget.applies_to_pages) {
    const matrixPage = pageStateMatrix.pages.find((page) => page.id === pageId);
    assert.equal(
      matrixPage.ordinary_cockpit_surface_budget_ref,
      'contracts/app-gui-product-contract.json#ordinary_cockpit_surface_budget',
      `${pageId} must consume the ordinary cockpit surface budget`,
    );
  }
  assert.deepEqual(guiContract.settings_navigation.ordinary_visible_tabs, [
    'general',
    'access',
    'capabilities',
    'environment',
    'appearance',
    'advanced',
    'about',
  ]);
  assert.deepEqual(guiContract.settings_navigation.legacy_route_redirects, {
    overview: 'general',
    runtime: 'environment',
    system: 'advanced',
    model: 'environment',
    agent: 'capabilities',
    assistants: 'capabilities',
    'skills-hub': 'capabilities',
    tools: 'capabilities',
    display: 'appearance',
    webui: 'access',
    pet: 'appearance',
  });
  assert.deepEqual(guiContract.settings_navigation.ordinary_hidden_legacy_tabs, [
    'overview',
    'runtime',
    'system',
    'model',
    'agent',
    'assistants',
    'skills-hub',
    'tools',
    'display',
    'webui',
    'pet',
  ]);
  assert.deepEqual(guiContract.settings_navigation.required_sections, [
    'general',
    'access',
    'capabilities',
    'environment',
    'appearance',
    'advanced',
    'about',
    'update',
    'theme',
  ]);
  assert.deepEqual(guiContract.settings_navigation.ordinary_hidden_upstream_surfaces, [
    'AionUI Team',
    'Team nav entry',
    'Team leader configuration',
    'team deep link navigation',
  ]);
  assert.deepEqual(guiContract.settings_navigation.team_surface_policy, {
    ordinary_visible: false,
    route_policy: 'disabled_or_redirect_to_app_owned_home',
    deep_link_policy: 'not_whitelisted',
    rationale: 'upstream AionUI Team is configured around shell-local agents and is not an OPL ordinary-user capability',
  });
  assert.equal(guiContract.settings_navigation.source, 'opl app state --profile fast --json');
  assert.equal(guiContract.settings_navigation.refresh_source, 'opl app state --profile fast --json');
  assert.equal(guiContract.settings_navigation.primary_tabs.general.label_zh, '通用');
  assert.equal(guiContract.settings_navigation.primary_tabs.environment.label_en, 'Local Environment');
  for (const [pageId, expected] of Object.entries(expectedSettingsPageSections)) {
    assert.deepEqual(guiContract.pages[pageId].sections, expected.sections);
    for (const item of expected.mustShow) {
      assert.ok(guiContract.pages[pageId].must_show.includes(item), `${pageId} must show ${item}`);
    }
    for (const item of expected.mustNotShow) {
      assert.ok(guiContract.pages[pageId].must_not_show.includes(item), `${pageId} must not show ${item}`);
    }
  }
  assert.equal(
    guiContract.pages.settings_capabilities.builtin_skill_catalog_policy.allowed_set_ref,
    'contracts/app-product-profile.json#companion_payloads.default_packaged_codex_skill_ids + packaged_not_default_visible_codex_skill_ids',
  );
  assert.ok(
    guiContract.pages.settings_capabilities.builtin_skill_catalog_policy.forbidden_examples.includes('aionui-skills'),
  );
  assert.equal(
    guiContract.pages.settings_capabilities.auto_injected_skills_policy.allowed_set_ref,
    'contracts/app-product-profile.json#companion_payloads.default_packaged_codex_skill_ids',
  );
  assert.ok(
    guiContract.pages.settings_capabilities.must_show.includes(
      'builtin skill catalog and auto-injected skills filtered to App packaged skill ids',
    ),
  );
  assert.ok(
    guiContract.pages.settings_capabilities.must_not_show.includes(
      'AionUI implementation skills such as aionui-skills',
    ),
  );
  assert.ok(guiContract.pages.settings_capabilities.auto_injected_skills_policy.forbidden_examples.includes('aionui-skills'));
  assert.equal(guiContract.desktop_tray_policy.default_visible, true);
  assert.equal(guiContract.desktop_tray_policy.desktop_startup_behavior, 'create_tray_by_default');
  assert.equal(guiContract.desktop_tray_policy.e2e_startup_behavior, 'destroy_tray_and_disable_close_to_tray');
  assert.equal(guiContract.desktop_tray_policy.close_to_tray_role, 'window_close_behavior_only');
  assert.equal(guiContract.desktop_tray_policy.settings_key, 'system.closeToTray');
  assert.equal(guiContract.desktop_tray_policy.must_not_gate_tray_visibility_on_close_to_tray, true);
  assert.equal(
    guiContract.first_launch_readiness_policy.beginner_presentation.post_install_ai_self_check_entry.target_route,
    '/guid',
  );
  assert.equal(
    guiContract.first_launch_readiness_policy.beginner_presentation.post_install_ai_self_check_entry.route_state,
    'postInstallSelfCheck',
  );
  assert.deepEqual(
    guiContract.first_launch_readiness_policy.beginner_presentation.post_install_ai_self_check_entry.target_state_checks,
    [
      'codex_cli_callable',
      'ui_language_policy',
      'session_scoped_opl_flow_context',
      'user_agents_md_respected_no_overwrite',
      'mas_mag_rca_routes_visible',
      'opl_meta_agent_capability_visible',
      'codex_skills_plugins_visible',
      'module_update_skill_plugin_continuity',
    ],
  );
  assert.equal(
    guiContract.first_launch_readiness_policy.beginner_presentation.post_install_ai_self_check_entry.mutation_policy,
    'diagnose_first_no_file_mutation_without_user_confirmation',
  );
  assert.equal(
    guiContract.module_path_source_policy.source,
    'app_state.modules[].source + app_state.modules[].path + app_state.paths',
  );
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from the bundled Full runtime payload'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from the App/CLI-managed stable package channel'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from the App/CLI-managed nightly package channel'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from a local domain repository checkout'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether Developer Profile source_channel uses a GitHub repo or local checkout'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module is managed by App/CLI maintenance'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('that module path display is refs-only and not domain truth authority'));
  assert.equal(guiContract.module_path_source_policy.ordinary_user_source, 'app_cli_managed_stable_package_channel');
  assert.equal(guiContract.module_path_source_policy.ordinary_user_transport, 'app_cli_managed');
  assert.equal(guiContract.module_path_source_policy.developer_override_surface, 'Developer Profile source_channel capability');
  assert.equal(guiContract.module_path_source_policy.developer_override_policy, 'explicit_opt_in_only');
  assert.equal(guiContract.module_path_source_policy.developer_profile_ref, 'developer_profile.capabilities.source_channel');
  assert.deepEqual(guiContract.developer_profile.capability_axes, [
    'source_channel',
    'workspace_trust',
    'github_authority',
    'agent_automation',
    'runtime_mutation_scope',
  ]);
  assert.equal(guiContract.developer_profile.default_profile, 'standard_user');
  assert.equal(guiContract.developer_profile.opt_in_policy, 'explicit_opt_in_only');
  assert.equal(guiContract.developer_profile.ordinary_user_defaults.source_channel, 'stable_package_channel');
  assert.equal(guiContract.developer_profile.capabilities.source_channel.developer_opt_in, 'github_repo_or_local_checkout');
  assert.equal(guiContract.developer_profile.capabilities.workspace_trust.standard_default, 'selected_workspace_only');
  assert.equal(guiContract.developer_profile.capabilities.github_authority.developer_opt_in, 'repo_checkout_and_remote_intent_visible');
  assert.equal(guiContract.developer_profile.capabilities.agent_automation.standard_default, 'user_confirmed_app_actions');
  assert.equal(guiContract.developer_profile.capabilities.runtime_mutation_scope.standard_default, 'app_action_route_only');
  assert.ok(guiContract.module_path_source_policy.must_not_use.includes('raw OPL_MODULE_SOURCE_MODE as ordinary Settings UI'));
  assert.equal(guiContract.pages.settings_environment.module_path_source_policy_ref, 'module_path_source_policy');
  assert.ok(guiContract.pages.about.must_show.includes('OPL Framework revision'));
  assert.equal(guiContract.theme_and_branding.default_theme_id, 'default-theme');
  assert.deepEqual(guiContract.theme_and_branding.allowed_theme_ids, ['default-theme', 'codex']);
  assert.ok(guiContract.pages.settings_theme.must_show.includes('Default theme option'));
  assert.ok(guiContract.pages.settings_theme.must_show.includes('Codex theme option'));
  assert.deepEqual(
    guiContract.release_channel_policy.stable.must_gate,
    releaseContract.release_validation_profiles.stable.required_lanes,
  );
  assert.deepEqual(
    guiContract.release_channel_policy.nightly.must_gate,
    releaseContract.release_validation_profiles.nightly_standard.required_lanes,
  );
  assert.deepEqual(
    guiContract.release_channel_policy.nightly.must_not_gate,
    releaseContract.release_validation_profiles.nightly_standard.forbidden_lanes,
  );
  assert.ok(!('docker_webui' in guiContract));
  assert.doesNotMatch(JSON.stringify(guiContract), /username input gate|must_skip_username_input|manifest_name|logo_policy/);
});

test('App fallow hygiene is not the active GUI shell validation gate', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const fallowConfig = JSON.parse(fs.readFileSync(path.join(appRoot, '.fallowrc.json'), 'utf8'));
  const testingDocs = fs.readFileSync(path.join(appRoot, 'docs', 'testing', 'README.md'), 'utf8');
  const scriptsDocs = fs.readFileSync(path.join(appRoot, 'scripts', 'README.md'), 'utf8');
  const combinedDocs = `${testingDocs}\n${scriptsDocs}`;

  assert.deepEqual(fallowConfig.ignorePatterns, ['shells/aionui/**', 'shells/agui-codex/**']);
  assert.equal(packageJson.scripts['hygiene:fallow'], 'npx --yes fallow@latest --root . --no-cache --production');
  assert.match(packageJson.scripts['validate:gui-shell'], /validate-active-shell\.ts/);
  assert.match(packageJson.scripts['validate:gui-shell'], /run-active-shell-command\.ts bun run package/);
  assert.match(combinedDocs, /hygiene:fallow[\s\S]*not GUI shell build or runtime evidence/i);
  assert.match(combinedDocs, /validate:gui-shell[\s\S]*active shell[\s\S]*GUI compile/i);
});

test('active shell validation exposes opt-in live OPL conformance without making it default', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const activeShellValidator = fs.readFileSync(path.join(appRoot, 'scripts', 'validate-active-shell.ts'), 'utf8');
  const runtimeBridge = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-runtime-bridge.json'), 'utf8'),
  );
  const testingDocs = fs.readFileSync(path.join(appRoot, 'docs', 'testing', 'README.md'), 'utf8');
  const architectureDocs = fs.readFileSync(path.join(appRoot, 'docs', 'architecture.md'), 'utf8');
  const combinedDocs = `${testingDocs}\n${architectureDocs}`;

  assert.equal(packageJson.scripts['validate:active-shell'], 'node --experimental-strip-types scripts/validate-active-shell.ts');
  assert.match(activeShellValidator, /useAcpInitialMessage\.ts/);
  assert.match(activeShellValidator, /await warmupConversation\(conversation_id\)/);
  assert.equal(runtimeBridge.live_conformance_gate.mode, 'explicit_env_opt_in');
  assert.equal(runtimeBridge.live_conformance_gate.default_enforcement, 'disabled');
  assert.equal(runtimeBridge.live_conformance_gate.opl_bin, './bin/opl');
  assert.equal(runtimeBridge.live_conformance_gate.fast_state_command, './bin/opl app state --profile fast --json');
  assert.equal(runtimeBridge.live_conformance_gate.full_state_command, './bin/opl app state --profile full --json');
  assert.equal(
    runtimeBridge.live_conformance_gate.action_dry_run_command,
    './bin/opl app action execute --action <fixture> --dry-run --json',
  );
  assert.equal(runtimeBridge.live_conformance_gate.fast_state_max_bytes, 500000);
  assert.equal(
    runtimeBridge.live_conformance_gate.golden_fast_state_fixture,
    'contracts/fixtures/opl-app-state-fast.fixture.json',
  );
  assert.deepEqual(runtimeBridge.live_conformance_gate.state_schema_paths, [
    'app_state.schema_version',
    'app_state.surface_kind',
    'app_state.schema',
    'app_state.surface',
    'schema',
    'surface',
  ]);
  assert.match(combinedDocs, /OPL_APP_LIVE_CONFORMANCE=1[\s\S]*OPL_APP_LIVE_OPL_ROOT/i);
  assert.match(combinedDocs, /fast[\s\S]*500KB[\s\S]*opl_app_state\.v1/i);
  const fixture = JSON.parse(
    fs.readFileSync(path.join(appRoot, runtimeBridge.live_conformance_gate.golden_fast_state_fixture), 'utf8'),
  );
  assert.equal(fixture.app_state.surface_kind, 'opl_app_state.v1');
  assert.equal(fixture.app_state.operator.workbench.view_model_schema, 'opl_app_operator_workbench.v1');
  assert.equal(
    fixture.app_state.operator.workbench.performance_policy.shell_must_not_derive_layout_from_raw_runtime_projection,
    true,
  );

  const defaultResult = runNode(['scripts/validate-active-shell.ts', '--quick'], {
    env: {
      OPL_APP_LIVE_CONFORMANCE: '',
      OPL_APP_LIVE_OPL_ROOT: '',
      OPL_APP_LIVE_ACTION_FIXTURE: '',
    },
  });
  assert.equal(defaultResult.status, 0, defaultResult.stderr || defaultResult.stdout);

  const enabledWithoutRoot = runNode(['scripts/validate-active-shell.ts', '--quick'], {
    env: {
      OPL_APP_LIVE_CONFORMANCE: '1',
      OPL_APP_LIVE_OPL_ROOT: '',
      OPL_APP_LIVE_ACTION_FIXTURE: 'fixture',
    },
  });
  assert.notEqual(enabledWithoutRoot.status, 0);
  assert.match(enabledWithoutRoot.stderr, /Set OPL_APP_LIVE_OPL_ROOT/);
});

test('release artifact upload preserves electron-updater blockmaps', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');

  assert.match(workflow, /find out\/ -type f[\s\S]*-name "\*\.blockmap"/);
  assert.match(workflow, /shells\/aionui\/out\/\*\.blockmap/);
});

test('stable release workflow publishes only macOS arm64 standard assets', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'build-and-release.yml'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(workflow, /"platform":"macos-arm64"/);
  assert.match(workflow, /"artifact-name":"macos-build-arm64"/);
  assert.doesNotMatch(workflow, /"platform":"windows-/);
  assert.doesNotMatch(workflow, /"platform":"linux-/);
  assert.doesNotMatch(workflow, /"platform":"macos-universal"/);
  assert.equal(packageJson.scripts['build-mac:arm64'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-mac:arm64');
  assert.equal(packageJson.scripts['build-mac'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-mac');
  assert.equal(packageJson.scripts['build-mac:x64'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-mac:x64');
  assert.equal(packageJson.scripts['build-win'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-win');
  assert.equal(packageJson.scripts['build-deb'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-deb');
  assert.deepEqual(releaseContract.standard_updater.allowed_metadata, [
    'latest-mac.yml',
    'latest-arm64-mac.yml',
  ]);
  assert.deepEqual(releaseContract.standard_updater.allowed_assets, [
    'One-Person-Lab-*-mac-arm64.dmg',
    'One-Person-Lab-*-mac-arm64.zip',
    'One-Person-Lab-*-mac-arm64.dmg.blockmap',
    'One-Person-Lab-*-mac-arm64.zip.blockmap',
  ]);
  assert.equal(releaseContract.standard_updater.scope, 'desktop_app_assets_only');
  assert.equal(releaseContract.standard_updater.module_package_update_allowed, false);
  assert.equal(releaseContract.standard_updater.developer_checkout_selection_allowed, false);
  assert.equal(releaseContract.standard_updater.opl_flow_install_allowed, false);
  assert.match(workflow, /release-assets\/\*\*\/\*\.dmg/);
  assert.match(workflow, /release-assets\/\*\*\/\*\.zip/);
  assert.match(workflow, /release-assets\/\*\*\/\*\.blockmap/);
  assert.match(workflow, /release-assets\/\*\*\/\*\.yml/);
  assert.match(workflow, /Install Codex release-note writer/);
  assert.match(workflow, /npm install -g @openai\/codex@latest/);
  assert.match(workflow, /models: read/);
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_PROVIDER: auto/);
  assert.match(workflow, /OPL_RELEASE_NOTES_GITHUB_MODEL: \$\{\{ vars\.OPL_RELEASE_NOTES_GITHUB_MODEL \|\| 'openai\/gpt-5-mini' \}\}/);
  assert.match(workflow, /Configure Codex release-note writer/);
  assert.match(workflow, /CODEX_HOME: \$\{\{ runner\.temp \}\}\/release-notes-codex-home/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_PROVIDER: \$\{\{ vars\.OPL_RELEASE_NOTES_CODEX_PROVIDER \|\| 'gflab' \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_BASE_URL: \$\{\{ vars\.OPL_RELEASE_NOTES_CODEX_BASE_URL \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_API_KEY: \$\{\{ secrets\.OPL_RELEASE_NOTES_CODEX_API_KEY \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_WIRE_API: \$\{\{ vars\.OPL_RELEASE_NOTES_CODEX_WIRE_API \|\| 'responses' \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_MODEL: \$\{\{ vars\.OPL_RELEASE_NOTES_MODEL \}\}/);
  assert.match(workflow, /node --experimental-strip-types scripts\/setup-release-notes-codex-config\.ts/);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}/);
  assert.match(workflow, /node --experimental-strip-types scripts\/generate-release-notes\.ts[\s\S]*--ai[\s\S]*--evidence-output "\$RUNNER_TEMP\/opl-release-notes-evidence\.json"[\s\S]*--output "\$RUNNER_TEMP\/opl-release-notes\.md"/);
  assert.match(workflow, /body_path: \$\{\{ runner\.temp \}\}\/opl-release-notes\.md/);
  assert.match(workflow, /release-notes-evidence-\$\{\{ steps\.version\.outputs\.version \}\}/);
  assert.doesNotMatch(workflow, /generate_release_notes: true/);
  assert.doesNotMatch(workflow, /release-assets\/\*\*\/\*\.exe/);
  assert.doesNotMatch(workflow, /release-assets\/\*\*\/\*\.msi/);
  assert.doesNotMatch(workflow, /release-assets\/\*\*\/\*\.deb/);
});

test('manual desktop release workflow supports new releases and same-tag refreshes in GitHub Actions', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release.yml'), 'utf8');
  const fullWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-first-install-release.yml'), 'utf8');
  const fullPackageScript = fs.readFileSync(path.join(appRoot, 'scripts', 'build-full-first-install-package.ts'), 'utf8');
  const vmWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'opl-first-run-vm.yml'), 'utf8');
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(workflow, /name: OPL Desktop Release/);
  assert.match(workflow, /release_mode:[\s\S]*refresh_existing[\s\S]*new_release[\s\S]*draft_candidate/);
  assert.match(workflow, /permissions:[\s\S]*packages: write/);
  assert.match(workflow, /shell_ref:[\s\S]*description: opl-aion-shell ref to build and verify/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/_build-reusable\.yml/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/_build-reusable\.yml[\s\S]*shell_ref: \$\{\{ inputs\.shell_ref \}\}/);
  assert.match(workflow, /node --experimental-strip-types scripts\/prepare-release-assets\.ts build-artifacts release-assets/);
  assert.match(workflow, /name: Verify standard release assets[\s\S]*OPL_RELEASE_VERSION: \$\{\{ inputs\.opl_version \}\}[\s\S]*node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
  assert.match(workflow, /node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
  assert.match(workflow, /Install Codex release-note writer/);
  assert.match(workflow, /npm install -g @openai\/codex@latest/);
  assert.match(workflow, /models: read/);
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_PROVIDER: auto/);
  assert.match(workflow, /OPL_RELEASE_NOTES_GITHUB_MODEL: \$\{\{ vars\.OPL_RELEASE_NOTES_GITHUB_MODEL \|\| 'openai\/gpt-5-mini' \}\}/);
  assert.match(workflow, /Configure Codex release-note writer/);
  assert.match(workflow, /CODEX_HOME: \$\{\{ runner\.temp \}\}\/release-notes-codex-home/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_PROVIDER: \$\{\{ vars\.OPL_RELEASE_NOTES_CODEX_PROVIDER \|\| 'gflab' \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_BASE_URL: \$\{\{ vars\.OPL_RELEASE_NOTES_CODEX_BASE_URL \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_API_KEY: \$\{\{ secrets\.OPL_RELEASE_NOTES_CODEX_API_KEY \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_WIRE_API: \$\{\{ vars\.OPL_RELEASE_NOTES_CODEX_WIRE_API \|\| 'responses' \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_MODEL: \$\{\{ vars\.OPL_RELEASE_NOTES_MODEL \}\}/);
  assert.match(workflow, /node --experimental-strip-types scripts\/setup-release-notes-codex-config\.ts/);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_EVIDENCE_OUTPUT: \$\{\{ runner\.temp \}\}\/standard-release-notes-evidence\.json/);
  assert.match(workflow, /standard-release-notes-evidence-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /full-release-notes-evidence-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /git tag "\$tag" "\$GITHUB_SHA"/);
  assert.match(workflow, /--standard-artifacts-dir release-assets/);
  assert.match(workflow, /publish_args\+=\(--draft\)/);
  assert.match(workflow, /remote-verify-standard:/);
  assert.match(workflow, /remote-verify-full:/);
  assert.match(workflow, /npm run verify-remote-release/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/full-first-install-release\.yml/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/full-first-install-release\.yml[\s\S]*shell_ref: \$\{\{ inputs\.shell_ref \}\}/);
  assert.match(workflow, /publish_to_release: false/);
  assert.match(workflow, /publish-full-assets:/);
  assert.match(workflow, /--full-package-dir full-package-artifacts/);
  assert.match(workflow, /remote-verify-full:[\s\S]*needs: publish-full-assets/);
  assert.match(workflow, /standard-first-run-vm-smoke-after-full:[\s\S]*needs: publish-standard/);
  assert.match(workflow, /run_vm_smoke:/);
  assert.match(workflow, /default: true/);
  assert.match(workflow, /guide_screenshots:[\s\S]*Capture user-guide screenshots/);
  assert.match(workflow, /permissions:[\s\S]*packages: write/);
  assert.match(workflow, /standard-first-run-vm-smoke-after-standard-only:/);
  assert.match(workflow, /standard-first-run-vm-smoke-after-full:/);
  assert.match(workflow, /homebrew-standard-first-run-vm-smoke:/);
  assert.match(workflow, /full-first-run-vm-smoke:/);
  assert.match(workflow, /one-shot-app-installer-smoke:/);
  assert.match(workflow, /docker-webui-smoke:/);
  assert.match(workflow, /webui-ghcr-publish:/);
  assert.match(workflow, /OPL_INSTALL_SCRIPT_URL: file:\/\/\$\{\{ github\.workspace \}\}\/one-person-lab\/install\.sh/);
  assert.match(workflow, /\.\/install\.sh --complete --skip-modules/);
  assert.match(workflow, /docker build[\s\S]*--label "org\.opencontainers\.image\.source=https:\/\/github\.com\/\$\{GITHUB_REPOSITORY\}"[\s\S]*-t "one-person-lab-webui:\$\{\{ inputs\.opl_version \}\}"[\s\S]*shells\/aionui/);
  assert.match(workflow, /curl -fsS "http:\/\/127\.0\.0\.1:\$\{port\}\/manifest\.webmanifest"/);
  assert.match(workflow, /docker login ghcr\.io -u "\$GITHUB_ACTOR" --password-stdin/);
  assert.match(workflow, /ghcr\.io\/\$\{image_owner\}\/one-person-lab-webui/);
  assert.match(workflow, /write_publish_summary "failed" "ghcr_write_package_denied"/);
  assert.match(workflow, /required_actions_access_repository: 'gaofeng21cn\/one-person-lab-app'/);
  assert.match(workflow, /source_repository: 'https:\/\/github\.com\/\$\{GITHUB_REPOSITORY\}'/);
  assert.match(workflow, /"\$\{ghcr_image\}:\$\{\{ inputs\.opl_version \}\}"/);
  assert.match(workflow, /"\$\{ghcr_image\}:stable"/);
  assert.match(workflow, /"\$\{ghcr_image\}:latest"/);
  assert.match(workflow, /RELEASE_MODE.*draft_candidate/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/opl-first-run-vm\.yml/);
  assert.match(workflow, /release_tag: v\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/opl-first-run-vm\.yml[\s\S]*shell_ref: \$\{\{ inputs\.shell_ref \}\}/);
  assert.match(workflow, /release_artifact_name: macos-build-arm64/);
  assert.match(workflow, /release_artifact_name: opl-full-first-install-\$\{\{ inputs\.opl_version \}\}-mac-arm64/);
  assert.match(workflow, /package_profile: standard/);
  assert.match(workflow, /package_profile: full/);
  assert.match(workflow, /package_profile: homebrew-standard/);
  assert.match(workflow, /opl-first-run-vm-homebrew-standard-\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /guide_screenshots: \$\{\{ inputs\.guide_screenshots \}\}/);
  assert.match(fullWorkflow, /workflow_call:/);
  assert.doesNotMatch(fullWorkflow, /workflow_call:[\s\S]*secrets:[\s\S]*GH_TOKEN:/);
  assert.match(fullWorkflow, /shell_ref:[\s\S]*description: opl-aion-shell ref to bundle/);
  assert.match(fullWorkflow, /name: Checkout active shell[\s\S]*ref: \$\{\{ inputs\.shell_ref \|\| 'main' \}\}/);
  assert.match(fullWorkflow, /name: Checkout OPL Meta Agent/);
  assert.match(fullWorkflow, /repository: gaofeng21cn\/opl-meta-agent/);
  assert.match(fullWorkflow, /path: opl-meta-agent/);
  assert.match(fullWorkflow, /name: Checkout MinerU Ecosystem/);
  assert.match(fullWorkflow, /repository: opendatalab\/MinerU-Ecosystem/);
  assert.match(fullWorkflow, /path: MinerU-Ecosystem/);
  assert.match(fullWorkflow, /uses: actions\/setup-go@v6/);
  assert.match(fullWorkflow, /go-version: '1\.26\.x'/);
  assert.match(fullWorkflow, /mineru_root="\$GITHUB_WORKSPACE\/MinerU-Ecosystem\/cli\/mineru-open-api"/);
  assert.match(fullWorkflow, /go install -ldflags/);
  assert.match(fullWorkflow, /MinerU-Ecosystem\/cli\/mineru-open-api\/cmd\.version=\$mineru_version/);
  assert.match(fullWorkflow, /echo "\$HOME\/go\/bin" >> "\$GITHUB_PATH"/);
  assert.match(fullWorkflow, /OPL_FULL_META_AGENT_ROOT="\$GITHUB_WORKSPACE\/opl-meta-agent"/);
  assert.match(fullWorkflow, /OPL_FULL_MINERU_OPEN_API_BIN/);
  assert.match(fullWorkflow, /assets\/companion-skills\/mineru-document-extractor/);
  assert.match(fullPackageScript, /assets', 'companion-skills', 'mineru-document-extractor/);
  assert.ok(
    fs.existsSync(path.join(appRoot, 'assets', 'companion-skills', 'mineru-document-extractor', 'SKILL.md')),
  );
  assert.match(vmWorkflow, /workflow_call:/);
  assert.match(vmWorkflow, /shell_ref:[\s\S]*description: 'opl-aion-shell ref containing the first-run smoke scripts/);
  assert.match(vmWorkflow, /name: Checkout active shell[\s\S]*ref: \$\{\{ inputs\.shell_ref \|\| 'main' \}\}/);
  assert.match(vmWorkflow, /release_artifact_name:/);
  assert.match(vmWorkflow, /actions\/download-artifact@v8/);
  assert.match(vmWorkflow, /Using same-run workflow artifact/);
  assert.match(vmWorkflow, /release tag \$\{\{ inputs\.release_tag \}\} kept for provenance/);
  assert.match(vmWorkflow, /fetch_release_metadata_with_retry\(\)/);
  assert.match(vmWorkflow, /Release metadata fetch failed on attempt \$attempt/);
  assert.match(vmWorkflow, /download_asset_with_retry\(\)/);
  assert.match(vmWorkflow, /download_release_with_retry\(\)/);
  assert.match(vmWorkflow, /max_attempts=8/);
  assert.match(vmWorkflow, /Resolved release DMG asset: \$asset_name/);
  assert.match(vmWorkflow, /Release DMG asset download failed on attempt \$attempt/);
  assert.match(vmWorkflow, /curl -fL --retry 5 --retry-all-errors --retry-delay 10 --connect-timeout 30 --max-time 1800 --continue-at -/);
  assert.match(vmWorkflow, /Resolve host Node\.js runtime for guest smoke/);
  assert.match(vmWorkflow, /os\.path\.realpath/);
  assert.match(vmWorkflow, /--guest-node-root "\$\{\{ steps\.host_node\.outputs\.node_root \}\}"/);
  assert.match(vmWorkflow, /schedule:/);
  assert.match(vmWorkflow, /concurrency:/);
  assert.match(vmWorkflow, /github\.event_name == 'schedule'/);
  assert.match(vmWorkflow, /opl-gui-first-run-vm-scheduled/);
  assert.match(vmWorkflow, /opl-gui-first-run-vm-manual/);
  assert.match(vmWorkflow, /cancel-in-progress: \$\{\{ github\.event_name == 'schedule' \}\}/);
  assert.match(vmWorkflow, /Resolve Tart source VM/);
  assert.match(vmWorkflow, /package_profile:/);
  assert.match(vmWorkflow, /homebrew-standard/);
  assert.match(vmWorkflow, /guide_screenshots:/);
  assert.match(vmWorkflow, /Resolve package profile/);
  assert.match(vmWorkflow, /Set workflow input tart_source_vm or repository variable OPL_FIRST_RUN_TART_SOURCE/);
  assert.match(vmWorkflow, /OPL_FIRST_RUN_HOMEBREW_TART_SOURCE/);
  assert.match(vmWorkflow, /package_profile=homebrew-standard/);
  assert.match(vmWorkflow, /source_vm=\$SOURCE_VM/);
  assert.doesNotMatch(vmWorkflow, /skip_smoke=true/);
  assert.doesNotMatch(vmWorkflow, /steps\.scheduled_config\.outputs\.skip_smoke != 'true'/);
  assert.match(vmWorkflow, /One-Person-Lab-Full-\*-mac-arm64\.dmg/);
  assert.match(vmWorkflow, /One-Person-Lab-\*-mac-arm64\.dmg/);
  assert.match(vmWorkflow, /!\s+-name 'One-Person-Lab-Full-\*'/);
  assert.match(vmWorkflow, /find artifacts\/release -type f -name 'One-Person-Lab-\*-mac-arm64\.dmg'/);
  assert.match(vmWorkflow, /--smoke-profile no-clt-clean-vm/);
  assert.match(vmWorkflow, /--smoke-profile homebrew-standard-cask/);
  assert.match(vmWorkflow, /--install-mode homebrew-cask/);
  assert.match(vmWorkflow, /--homebrew-cask "\$\{\{ steps\.package_profile\.outputs\.homebrew_cask \}\}"/);
  assert.match(vmWorkflow, /--display 1920x1080px/);
  assert.match(vmWorkflow, /--settings-smoke/);
  assert.match(vmWorkflow, /--assistant-route-smoke/);
  assert.match(vmWorkflow, /Write first-run VM preflight summary/);
  assert.match(vmWorkflow, /deterministic release-blocking clean VM first launch/);
  assert.match(vmWorkflow, /--runtime-profile "\$\{\{ steps\.package_profile\.outputs\.runtime_profile \}\}"/);
  assert.match(vmWorkflow, /CMD\+=\(--guide-screenshots\)/);
  assert.equal(
    releaseContract.standard_updater.same_tag_refresh.mode,
    'github_actions_prebuilt_assets_upload_clobber',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.desktop_release_workflow,
    '.github/workflows/desktop-release.yml',
  );
  assert.deepEqual(releaseContract.webui_ghcr_image, {
    owner: 'one-person-lab-app',
    registry: 'ghcr.io',
    image: 'ghcr.io/<owner>/one-person-lab-webui',
    version_tag: '<app_or_opl_version>',
    source: 'shells/aionui Dockerfile',
    source_repository: 'https://github.com/gaofeng21cn/one-person-lab-app',
    required_oci_labels: {
      'org.opencontainers.image.source': 'https://github.com/gaofeng21cn/one-person-lab-app',
    },
    github_package_access: {
      package_url: 'https://github.com/users/gaofeng21cn/packages/container/package/one-person-lab-webui/settings',
      package_landing_url: 'https://github.com/users/gaofeng21cn/packages/container/package/one-person-lab-webui',
      target_repository_association: 'gaofeng21cn/one-person-lab-app',
      current_historical_association_allowed_until_ui_migration: 'gaofeng21cn/one-person-lab',
      repository_association_surface: 'GitHub Packages settings Connect repository',
      required_actions_access_repository: 'gaofeng21cn/one-person-lab-app',
      required_actions_access_permission: 'write',
      configuration_surface: 'GitHub Packages settings Manage Actions access',
      public_api_policy: 'GitHub does not expose a stable public REST or GraphQL endpoint for configuring personal package repository association or Actions access; configure these gates through the package settings UI.',
      failure_signal: 'docker push denied: permission_denied: write_package',
      rule: 'App-owned WebUI GHCR publishing requires the one-person-lab-webui package to be associated with gaofeng21cn/one-person-lab-app and to grant write Actions access to gaofeng21cn/one-person-lab-app before App workflows can update existing GHCR tags.',
    },
    retention_policy: {
      strategy: 'retain_latest_n_versions_and_declared_rollbacks',
      retain_stable_versions: 5,
      retain_nightly_versions: 7,
      protected_tags: ['latest', 'stable', 'nightly'],
      cleanup_execution_mode: 'dry_run_first_explicit_execute_required',
      destructive_action_requires: 'package_admin_with_delete_packages_scope',
      rule: 'WebUI GHCR cleanup must retain protected moving tags, recent stable/nightly versions, and declared rollback tags; deletion is never part of ordinary release publishing.',
    },
    publish_workflows: [
      '.github/workflows/desktop-release.yml',
      '.github/workflows/nightly-standard-release.yml',
    ],
    stable_tags: ['<app_or_opl_version>', 'stable', 'latest'],
    nightly_tags: ['<app_or_opl_version>', 'nightly'],
    draft_candidate_push: false,
    full_first_install_payload_allowed: false,
    module_package_publish_allowed: false,
    opl_flow_plugin_publish_allowed: false,
    framework_role: 'references_image_coordinate_only',
    rule: 'WebUI GHCR image publish truth is App-owned; Framework may reference the image coordinate but does not own publishing.',
  });
  assert.equal(
    releaseContract.release_acceleration.github_actions.first_run_vm_workflow,
    '.github/workflows/opl-first-run-vm.yml',
  );
  assert.deepEqual(releaseContract.webui_ghcr_image, {
    owner: 'one-person-lab-app',
    registry: 'ghcr.io',
    image: 'ghcr.io/<owner>/one-person-lab-webui',
    version_tag: '<app_or_opl_version>',
    source: 'shells/aionui Dockerfile',
    source_repository: 'https://github.com/gaofeng21cn/one-person-lab-app',
    required_oci_labels: {
      'org.opencontainers.image.source': 'https://github.com/gaofeng21cn/one-person-lab-app',
    },
    github_package_access: {
      package_url: 'https://github.com/users/gaofeng21cn/packages/container/package/one-person-lab-webui/settings',
      package_landing_url: 'https://github.com/users/gaofeng21cn/packages/container/package/one-person-lab-webui',
      target_repository_association: 'gaofeng21cn/one-person-lab-app',
      current_historical_association_allowed_until_ui_migration: 'gaofeng21cn/one-person-lab',
      repository_association_surface: 'GitHub Packages settings Connect repository',
      required_actions_access_repository: 'gaofeng21cn/one-person-lab-app',
      required_actions_access_permission: 'write',
      configuration_surface: 'GitHub Packages settings Manage Actions access',
      public_api_policy: 'GitHub does not expose a stable public REST or GraphQL endpoint for configuring personal package repository association or Actions access; configure these gates through the package settings UI.',
      failure_signal: 'docker push denied: permission_denied: write_package',
      rule: 'App-owned WebUI GHCR publishing requires the one-person-lab-webui package to be associated with gaofeng21cn/one-person-lab-app and to grant write Actions access to gaofeng21cn/one-person-lab-app before App workflows can update existing GHCR tags.',
    },
    retention_policy: {
      strategy: 'retain_latest_n_versions_and_declared_rollbacks',
      retain_stable_versions: 5,
      retain_nightly_versions: 7,
      protected_tags: ['latest', 'stable', 'nightly'],
      cleanup_execution_mode: 'dry_run_first_explicit_execute_required',
      destructive_action_requires: 'package_admin_with_delete_packages_scope',
      rule: 'WebUI GHCR cleanup must retain protected moving tags, recent stable/nightly versions, and declared rollback tags; deletion is never part of ordinary release publishing.',
    },
    publish_workflows: [
      '.github/workflows/desktop-release.yml',
      '.github/workflows/nightly-standard-release.yml',
    ],
    stable_tags: ['<app_or_opl_version>', 'stable', 'latest'],
    nightly_tags: ['<app_or_opl_version>', 'nightly'],
    draft_candidate_push: false,
    full_first_install_payload_allowed: false,
    module_package_publish_allowed: false,
    opl_flow_plugin_publish_allowed: false,
    framework_role: 'references_image_coordinate_only',
    rule: 'WebUI GHCR image publish truth is App-owned; Framework may reference the image coordinate but does not own publishing.',
  });
  assert.deepEqual(
    releaseContract.release_acceleration.vm_gates.map((gate) => gate.id),
    ['standard_dmg_clean_vm_smoke', 'homebrew_standard_cask_clean_vm_smoke', 'full_dmg_clean_vm_smoke'],
  );
  assert.equal(releaseContract.release_acceleration.vm_gate.gate_policy, 'deterministic_release_blocking');
  assert.equal(releaseContract.release_acceleration.vm_gate.source, 'clean no-CLT Tart base clone');
  assert.equal(releaseContract.release_acceleration.vm_gate.artifact, 'One-Person-Lab-Full-<version>-mac-arm64.dmg');
  assert.equal(releaseContract.release_acceleration.vm_gate.smoke_profile, 'no-clt-clean-vm');
  assert.equal(releaseContract.release_acceleration.vm_gate.display, '1920x1080px');
  assert.equal(releaseContract.release_acceleration.vm_gate.runtime_profile, 'full');
  assert.ok(releaseContract.release_acceleration.vm_gate.preflight_summary_fields.includes('runner_labels'));
  assert.ok(releaseContract.release_acceleration.vm_gate.preflight_summary_fields.includes('dmg_artifact_path'));
  assert.equal(releaseContract.release_acceleration.ai_exploratory_policy.codex_app, 'non_blocking_exploratory_only');
  assert.equal(
    releaseContract.release_acceleration.ai_exploratory_policy.release_blocking_requirement,
    'findings_must_be_promoted_to_deterministic_contract_workflow_or_script_gate',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.draft_candidate_mode,
    'draft_candidate',
  );
  assert.equal(
    releaseContract.release_acceleration.post_publish_remote_verification.script,
    'npm run verify-remote-release -- --version <version>',
  );
  assert.deepEqual(
    releaseContract.release_acceleration.post_publish_remote_verification.checks,
    [
      'remote_asset_size',
      'remote_asset_sha256_digest',
      'gatekeeper_launch_policy',
      'standard_updater_metadata',
      'full_sha256sums',
      'full_runtime_cache_events',
      'full_runtime_native_trust',
      'full_manifest_distribution_boundary',
      'full_manifest_size_budget',
      'full_release_asset_size_budget',
      'full_runtime_uncompressed_size_budget',
      'full_readme_english_only',
    ],
  );
});

test('Nightly release workflow publishes standard-only semver prereleases', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'nightly-standard-release.yml'), 'utf8');
  const boundaryScript = fs.readFileSync(path.join(appRoot, 'scripts', 'validate-release-boundary.ts'), 'utf8');
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(workflow, /name: OPL Nightly Standard Release/);
  assert.match(workflow, /permissions:[\s\S]*packages: write/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: '17 18 \* \* \*'/);
  assert.match(workflow, /group: opl-nightly-standard-release/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /version="\$\(date -u \+'%y\.%-m\.%-d'\)-nightly"/);
  assert.match(workflow, /tag="v\$\{version\}"/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/_build-reusable\.yml/);
  assert.match(workflow, /opl_release_version: \$\{\{ needs\.resolve-nightly\.outputs\.version \}\}/);
  assert.match(workflow, /node --experimental-strip-types scripts\/prepare-release-assets\.ts build-artifacts release-assets/);
  assert.match(workflow, /node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
  assert.match(workflow, /node --experimental-strip-types scripts\/generate-release-notes\.ts[\s\S]*--channel nightly/);
  assert.match(workflow, /OPL_RELEASE_NOTES_EVIDENCE_OUTPUT: \$\{\{ runner\.temp \}\}\/opl-nightly-notes-evidence\.json/);
  assert.match(workflow, /node --experimental-strip-types scripts\/generate-release-notes\.ts[\s\S]*--evidence-output "\$OPL_RELEASE_NOTES_EVIDENCE_OUTPUT"[\s\S]*--output "\$notes_file"/);
  assert.match(workflow, /release-notes-evidence-\$\{\{ needs\.resolve-nightly\.outputs\.version \}\}/);
  assert.match(workflow, /remote_tag_sha="\$\(git ls-remote --tags origin "refs\/tags\/\$\{OPL_RELEASE_TAG\}" \| awk '\{print \$1\}'\)"/);
  assert.match(workflow, /git push --force-with-lease="refs\/tags\/\$\{OPL_RELEASE_TAG\}:\$\{remote_tag_sha\}" origin "refs\/tags\/\$\{OPL_RELEASE_TAG\}"/);
  assert.match(workflow, /git push origin "refs\/tags\/\$\{OPL_RELEASE_TAG\}"/);
  assert.match(workflow, /gh release create "\$\{OPL_RELEASE_TAG\}"[\s\S]*--prerelease[\s\S]*--latest=false[\s\S]*--verify-tag/);
  assert.match(workflow, /gh release edit "\$\{OPL_RELEASE_TAG\}"[\s\S]*--prerelease/);
  assert.match(workflow, /--title "\$\{OPL_RELEASE_TAG\}"/);
  assert.match(workflow, /gh release upload "\$\{OPL_RELEASE_TAG\}" release-assets\/\*/);
  assert.match(workflow, /npm run verify-remote-release/);
  assert.match(workflow, /webui-ghcr-publish:/);
  assert.match(workflow, /docker build[\s\S]*--label "org\.opencontainers\.image\.source=https:\/\/github\.com\/\$\{GITHUB_REPOSITORY\}"[\s\S]*-t "one-person-lab-webui:\$\{\{ needs\.resolve-nightly\.outputs\.version \}\}"[\s\S]*shells\/aionui/);
  assert.match(workflow, /curl -fsS "http:\/\/127\.0\.0\.1:\$\{port\}\/manifest\.webmanifest"/);
  assert.match(workflow, /docker login ghcr\.io -u "\$GITHUB_ACTOR" --password-stdin/);
  assert.match(workflow, /ghcr\.io\/\$\{image_owner\}\/one-person-lab-webui/);
  assert.match(workflow, /write_publish_summary "failed" "ghcr_write_package_denied"/);
  assert.match(workflow, /required_actions_access_repository: 'gaofeng21cn\/one-person-lab-app'/);
  assert.match(workflow, /source_repository: 'https:\/\/github\.com\/\$\{GITHUB_REPOSITORY\}'/);
  assert.match(workflow, /"\$\{ghcr_image\}:\$\{\{ needs\.resolve-nightly\.outputs\.version \}\}"/);
  assert.match(workflow, /"\$\{ghcr_image\}:nightly"/);
  assert.doesNotMatch(workflow, /full-first-install-release\.yml/);
  assert.doesNotMatch(workflow, /include_full_package/);
  assert.doesNotMatch(workflow, /One-Person-Lab-Full/);
  assert.doesNotMatch(workflow, /nightly\.\$\{stamp\}/);
  assert.doesNotMatch(workflow, /One Person Lab Nightly \$\{OPL_RELEASE_VERSION\}/);
  assert.doesNotMatch(workflow, /This prerelease is for users who opt into prerelease\/Nightly updates/);
  assert.doesNotMatch(workflow, /"\$\{ghcr_image\}:latest"/);
  assert.doesNotMatch(workflow, /"\$\{ghcr_image\}:stable"/);
  assert.match(boundaryScript, /nightly_standard_release_workflow/);
  assert.equal(
    releaseContract.release_acceleration.github_actions.nightly_standard_release_workflow,
    '.github/workflows/nightly-standard-release.yml',
  );
  assert.equal(releaseContract.nightly_standard.prerelease, true);
  assert.equal(releaseContract.nightly_standard.full_first_install_allowed, false);
  assert.equal(releaseContract.nightly_standard.latest_release_allowed, false);
  assert.deepEqual(releaseContract.release_validation_profiles.nightly_standard.required_lanes, [
    'release_boundary_contract',
    'standard_macos_arm64_build',
    'local_standard_asset_validation',
    'remote_standard_release_verification',
    'webui_ghcr_publish',
  ]);
  assert.ok(
    releaseContract.release_validation_profiles.nightly_standard.forbidden_lanes.includes('full_first_install_build'),
  );
  assert.ok(
    releaseContract.release_validation_profiles.nightly_standard.forbidden_lanes.includes('docker_webui_smoke'),
  );
  assert.ok(
    !releaseContract.release_validation_profiles.nightly_standard.required_lanes.includes('docker_webui_smoke'),
  );
});

test('Homebrew tap publication is cohort-based and separates stable from nightly', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const homebrewWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'homebrew-tap-update.yml'), 'utf8');
  const nightlyWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'nightly-standard-release.yml'), 'utf8');
  const releaseDocs = fs.readFileSync(path.join(appRoot, 'docs', 'release', 'README.md'), 'utf8');
  const homebrew = releaseContract.homebrew_tap_distribution;

  assert.equal(homebrew.owner, 'one-person-lab-app');
  assert.equal(homebrew.tap_repo, 'gaofeng21cn/homebrew-one-person-lab');
  assert.equal(homebrew.role, 'external_app_cask_index_for_distribution_cohorts');
  assert.equal(homebrew.cohort_manifest_required, true);
  assert.deepEqual(homebrew.formulae, []);
  assert.deepEqual(homebrew.casks, ['one-person-lab', 'one-person-lab-full']);
  assert.deepEqual(homebrew.initial_live_targets, [
    'Casks/one-person-lab.rb',
    'Casks/one-person-lab-nightly.rb',
    'Casks/one-person-lab-full.rb',
  ]);
  assert.deepEqual(homebrew.forbidden_formulae, ['one-person-lab-modules', 'one-person-lab-modules-nightly']);
  assert.deepEqual(homebrew.excluded_casks, []);
  assert.deepEqual(homebrew.full_casks, ['one-person-lab-full']);
  assert.deepEqual(homebrew.nightly_formulae, []);
  assert.deepEqual(homebrew.nightly_casks, ['one-person-lab-nightly']);
  assert.equal(
    homebrew.tap_update_policy.discovery_model,
    'user_taps_github_homebrew_tap_repo_then_homebrew_reads_formula_or_cask',
  );
  assert.equal(homebrew.tap_update_policy.download_source, 'app_owned_github_release_asset_url');
  assert.equal(
    homebrew.tap_update_policy.default_remote_write_path,
    'tap_repo_github_actions_self_sync_direct_commit_after_tap_check',
  );
  assert.equal(homebrew.tap_update_policy.default_workflow_repo, 'gaofeng21cn/homebrew-one-person-lab');
  assert.equal(homebrew.tap_update_policy.default_workflow, '.github/workflows/sync-from-app-releases.yml');
  assert.equal(homebrew.tap_update_policy.tap_sync_script, 'scripts/sync-cask-from-release.mjs');
  assert.equal(homebrew.tap_update_policy.app_release_pr_workflow, '.github/workflows/homebrew-tap-update.yml');
  assert.equal(homebrew.tap_update_policy.app_release_pr_token, 'OPL_HOMEBREW_TAP_TOKEN');
  assert.equal(homebrew.tap_update_policy.planner_script, 'scripts/update-homebrew-tap.ts');
  assert.equal(homebrew.tap_update_policy.nightly.mode, 'tap_repo_scheduled_self_sync_to_nightly_cask');
  assert.equal(homebrew.tap_update_policy.nightly.may_update_stable, false);
  assert.equal(homebrew.tap_update_policy.stable.mode, 'manual_tap_repo_sync_after_stable_release_gates_and_owner_promotion');
  assert.equal(homebrew.tap_update_policy.stable.may_consume_nightly_directly, false);
  assert.equal(homebrew.tap_update_policy.full.mode, 'stable_full_first_install_cask_after_full_release_gates');
  assert.equal(homebrew.tap_update_policy.full.may_update_standard_cask, false);
  assert.equal(homebrew.tap_update_policy.full.may_update_nightly_cask, false);
  assert.equal(homebrew.tap_update_policy.full.manifest, 'full-package-manifest.json');
  assert.equal(homebrew.tap_update_policy.full.asset, 'One-Person-Lab-Full-<version>-mac-arm64.dmg');
  assert.equal(homebrew.tap_update_policy.full.standard_updater_visible, false);
  assert.deepEqual(homebrew.tap_update_policy.required_manifest_fields, [
    'channel',
    'artifact',
    'sha256',
    'manifest_url',
    'gatekeeper_launch_policy_asset',
  ]);
  assert.equal(homebrew.agent_pack_policy.package_kind, 'app_cli_managed_agent_packs');
  assert.equal(homebrew.agent_pack_policy.semantic_authority, 'one-person-lab_and_domain_repositories');
  assert.equal(homebrew.agent_pack_policy.homebrew_role, 'not_a_distribution_target');
  assert.equal(homebrew.agent_pack_policy.activation_owner, 'app_cli_managed_background_maintenance');
  assert.equal(homebrew.agent_pack_policy.homebrew_distribution_allowed, false);
  assert.equal(homebrew.agent_pack_policy.homebrew_formula_allowed, false);
  assert.deepEqual(homebrew.agent_pack_policy.forbidden_formulae, ['one-person-lab-modules', 'one-person-lab-modules-nightly']);
  assert.equal(homebrew.agent_pack_policy.must_not_write_user_codex_state, true);
  assert.equal(homebrew.agent_pack_policy.must_not_define_agent_semantics, true);
  assert.deepEqual(homebrew.agent_pack_policy.activation_commands, ['opl module reconcile', 'opl skill sync']);
  assert.equal(
    homebrew.full_first_install_policy,
    'stable_full_cask_or_github_release_first_install_asset; never standard updater metadata',
  );
  assert.equal(homebrew.codex_temporal_policy.compatibility_mode, 'minimum_version_plus_capability_smoke');
  assert.equal(homebrew.codex_temporal_policy.prefer_valid_newer_system_tool, true);
  assert.equal(homebrew.codex_temporal_policy.bundled_fallback_allowed, true);

  assert.match(homebrewWorkflow, /name: OPL Homebrew Tap Update/);
  assert.match(homebrewWorkflow, /workflow_dispatch:/);
  assert.match(homebrewWorkflow, /workflow_call:/);
  assert.match(homebrewWorkflow, /OPL_HOMEBREW_TAP_TOKEN/);
  assert.match(homebrewWorkflow, /repository: \$\{\{ inputs\.tap_repo \}\}/);
  assert.match(homebrewWorkflow, /gh release view "\$tag"[\s\S]*--json tagName,isDraft,isPrerelease,assets/);
  assert.match(homebrewWorkflow, /Homebrew tap updates must read assets from gaofeng21cn\/one-person-lab-app/);
  assert.match(homebrewWorkflow, /GitHub Release asset \$\{asset\.name\} must expose a sha256 digest/);
  assert.match(homebrewWorkflow, /Homebrew tap updates must not read draft GitHub Releases/);
  assert.match(homebrewWorkflow, /One-Person-Lab-\$\{version\}-mac-arm64\.dmg/);
  assert.match(homebrewWorkflow, /One-Person-Lab-Full-\$\{version\}-mac-arm64\.dmg/);
  assert.match(homebrewWorkflow, /full-package-manifest\.json/);
  assert.match(homebrewWorkflow, /Casks\/one-person-lab-full\.rb/);
  assert.match(homebrewWorkflow, /Full first-install Homebrew cask updates must stay on the stable channel/);
  assert.match(homebrewWorkflow, /Homebrew tap updates are App cask-only; agent packs are App\/CLI-managed/);
  assert.doesNotMatch(homebrewWorkflow, /one-person-lab-modules-\$\{version\}\.tar\.gz/);
  assert.match(homebrewWorkflow, /node --experimental-strip-types scripts\/update-homebrew-tap\.ts[\s\S]*--summary-path "\$RUNNER_TEMP\/homebrew-tap-plan\.json"[\s\S]*--write/);
  assert.match(homebrewWorkflow, /peter-evans\/create-pull-request@v8/);
  assert.match(homebrewWorkflow, /path: homebrew-tap/);
  assert.match(homebrewWorkflow, /Homebrew remains an App cask transport\/index/);
  assert.match(homebrewWorkflow, /Full cask is an explicit stable first-install surface outside standard updater metadata/);
  assert.doesNotMatch(homebrewWorkflow, /gh release upload/);
  assert.doesNotMatch(homebrewWorkflow, /git push origin main|git push origin HEAD:main/);

  assert.match(nightlyWorkflow, /homebrew-tap-update:/);
  assert.match(nightlyWorkflow, /uses: \.\/\.github\/workflows\/homebrew-tap-update\.yml/);
  assert.match(nightlyWorkflow, /channel: nightly/);
  assert.match(nightlyWorkflow, /package_kind: app_standard/);
  assert.match(nightlyWorkflow, /tap_repo: gaofeng21cn\/homebrew-one-person-lab/);

  assert.match(releaseDocs, /brew tap gaofeng21cn\/one-person-lab/);
  assert.match(releaseDocs, /brew install --cask gaofeng21cn\/one-person-lab\/one-person-lab/);
  assert.match(releaseDocs, /brew install --cask one-person-lab-full/);
  assert.match(releaseDocs, /gaofeng21cn\/homebrew-one-person-lab/);
  assert.match(releaseDocs, /gaofeng21cn\/one-person-lab-app` GitHub Releases/);
  assert.match(releaseDocs, /Sync From App Releases/);
  assert.match(releaseDocs, /scripts\/sync-cask-from-release\.mjs/);
  assert.match(releaseDocs, /scheduled run[\s\S]*Nightly prerelease/);
  assert.match(releaseDocs, /stable cask updates are manual workflow dispatches/);
  assert.match(releaseDocs, /Full cask updates are stable[\s\S]*Full release gates pass/);
  assert.match(releaseDocs, /explicit Full cask/);
  assert.match(releaseDocs, /OPL Homebrew Tap Update/);
  assert.match(releaseDocs, /OPL_HOMEBREW_TAP_TOKEN/);
  assert.match(releaseDocs, /nightly freshness does not depend on that[\s\S]*cross-repo secret/);
});

test('stable validation profile covers every user installation surface', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const firstRunMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-first-run-test-matrix.json'), 'utf8'),
  );
  const releaseDocs = fs.readFileSync(path.join(appRoot, 'docs', 'release', 'README.md'), 'utf8');
  const testingDocs = fs.readFileSync(path.join(appRoot, 'docs', 'testing', 'README.md'), 'utf8');
  const scriptsDocs = fs.readFileSync(path.join(appRoot, 'scripts', 'README.md'), 'utf8');
  const combinedDocs = `${releaseDocs}\n${testingDocs}\n${scriptsDocs}`;
  const scenarioIds = firstRunMatrix.scenarios.map((scenario) => scenario.id);
  const stable = releaseContract.release_validation_profiles.stable;

  assert.ok(stable.required_lanes.includes('webui_ghcr_publish'));
  assert.ok(stable.required_lanes.indexOf('webui_ghcr_publish') > stable.required_lanes.indexOf('docker_webui_smoke'));
  assert.deepEqual(stable.required_installation_surfaces, [
    'standard_dmg_clean_vm_smoke',
    'homebrew_standard_cask_clean_vm_smoke',
    'full_dmg_clean_vm_smoke',
    'one_shot_app_installer_fresh_install_smoke',
    'docker_webui_smoke',
  ]);
  assert.ok(stable.required_lanes.includes('docker_webui_smoke'));
  assert.ok(stable.required_lanes.includes('webui_ghcr_publish'));
  assert.ok(stable.required_lanes.indexOf('webui_ghcr_publish') > stable.required_lanes.indexOf('docker_webui_smoke'));
  assert.deepEqual(
    firstRunMatrix.scenarios.find((scenario) => scenario.id === 'docker_webui_smoke'),
    {
      id: 'docker_webui_smoke',
      package_type: 'docker_webui',
      release_gate: true,
      command: 'docker build -t one-person-lab-webui:<version> shells/aionui && docker run -p 127.0.0.1::<container_port> one-person-lab-webui:<version>',
      expects: [
        'Docker image builds from the active AionUI shell Dockerfile',
        'WebUI container starts on port 3000',
        'HTTP / returns 200',
        'HTTP /manifest.webmanifest returns 200',
      ],
    },
  );
  assert.ok(stable.required_lanes.includes('operator_evidence_bundle'));
  for (const scenarioId of stable.required_installation_surfaces) {
    assert.ok(scenarioIds.includes(scenarioId), scenarioId);
  }
  assert.match(combinedDocs, /Nightly[\s\S]*standard[\s\S]*remote/i);
  assert.match(combinedDocs, /Stable[\s\S]*standard DMG[\s\S]*Full DMG[\s\S]*one-shot[\s\S]*Docker\/WebUI/i);
  assert.match(combinedDocs, /ghcr\.io\/<owner>\/one-person-lab-webui:<app_or_opl_version>/);
  assert.match(combinedDocs, /Manage Actions access/);
  assert.match(combinedDocs, /permission_denied: write_package/);
  assert.match(combinedDocs, /ghcr_write_package_denied/);
  assert.match(combinedDocs, /Framework[\s\S]*references?[\s\S]*image coordinate/i);
  assert.match(combinedDocs, /Full[\s\S]*DMG[\s\S]*must not include[\s\S]*WebUI GHCR image/i);
});

test('release automation workflows cover remote verification, Full cache warmup, and draft promotion', () => {
  const verifyWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'release-verify-remote.yml'), 'utf8');
  const warmupWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-runtime-cache-warmup.yml'), 'utf8');
  const promoteWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release-promote.yml'), 'utf8');
  const cleanupWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release-cleanup-drafts.yml'), 'utf8');
  const cleanupScript = fs.readFileSync(path.join(appRoot, 'scripts', 'cleanup-draft-release-candidates.ts'), 'utf8');
  const webuiCleanupScript = fs.readFileSync(path.join(appRoot, 'scripts', 'cleanup-webui-ghcr-versions.ts'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const releaseDocs = fs.readFileSync(path.join(appRoot, 'docs', 'release', 'README.md'), 'utf8');
  const scriptsDocs = fs.readFileSync(path.join(appRoot, 'scripts', 'README.md'), 'utf8');
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(verifyWorkflow, /name: OPL Remote Release Verification/);
  assert.match(verifyWorkflow, /npm run verify-remote-release/);
  assert.match(verifyWorkflow, /--summary-path remote-release-verification\.json/);
  assert.match(verifyWorkflow, /verify_args\+=\(--include-full-package\)/);
  assert.match(verifyWorkflow, /actions\/upload-artifact@v7/);

  assert.match(warmupWorkflow, /name: OPL Full Runtime Cache Warmup/);
  assert.match(warmupWorkflow, /schedule:/);
  assert.match(warmupWorkflow, /permissions:[\s\S]*contents: write/);
  assert.match(warmupWorkflow, /permissions:[\s\S]*models: read/);
  assert.match(warmupWorkflow, /uses: \.\/\.github\/workflows\/full-first-install-release\.yml/);
  assert.match(warmupWorkflow, /publish_to_release: false/);
  assert.match(warmupWorkflow, /force_rebuild_runtime_cache:/);
  assert.doesNotMatch(warmupWorkflow, /secrets: inherit/);

  assert.match(promoteWorkflow, /name: OPL Desktop Release Promote/);
  assert.match(promoteWorkflow, /npm run verify-remote-release/);
  assert.match(promoteWorkflow, /gh release edit "v\$\{OPL_RELEASE_VERSION\}"/);
  assert.match(promoteWorkflow, /--draft=false/);
  assert.match(promoteWorkflow, /--latest/);

  assert.equal(packageJson.scripts['release:cleanup-drafts'], 'node --experimental-strip-types scripts/cleanup-draft-release-candidates.ts');
  assert.equal(packageJson.scripts['release:cleanup-webui-ghcr'], 'node --experimental-strip-types scripts/cleanup-webui-ghcr-versions.ts');
  assert.match(cleanupWorkflow, /name: OPL Desktop Release Cleanup Drafts/);
  assert.match(cleanupWorkflow, /workflow_dispatch:/);
  assert.match(cleanupWorkflow, /dry_run:/);
  assert.match(cleanupWorkflow, /permissions:[\s\S]*contents: write/);
  assert.match(cleanupWorkflow, /npm run release:cleanup-drafts/);
  assert.match(cleanupWorkflow, /--summary-path release-draft-cleanup-summary\.json/);
  assert.match(cleanupWorkflow, /cleanup_args\+=\(--execute\)/);
  assert.match(cleanupWorkflow, /cleanup_args\+=\(--dry-run\)/);
  assert.match(cleanupWorkflow, /actions\/upload-artifact@v7/);
  assert.doesNotMatch(cleanupWorkflow, /actions\/download-artifact/);
  assert.doesNotMatch(cleanupWorkflow, /gh release download/);
  assert.match(cleanupScript, /\^v\$\{escaped\}-\(draft\|readiness\)\\\\\.\\\\d\{14\}\$/);
  assert.match(cleanupScript, /must be a published stable release/);
  assert.match(cleanupScript, /'--cleanup-tag'/);
  assert.match(webuiCleanupScript, /cleanup_execution_mode !== 'dry_run_first_explicit_execute_required'/);
  assert.match(webuiCleanupScript, /retainedStableIds/);
  assert.match(webuiCleanupScript, /retainedNightlyIds/);
  assert.match(webuiCleanupScript, /'-X'[\s\S]*'DELETE'/);
  assert.match(`${releaseDocs}\n${scriptsDocs}`, /release:cleanup-drafts[\s\S]*dry-run/i);
  assert.match(`${releaseDocs}\n${scriptsDocs}`, /release:cleanup-webui-ghcr[\s\S]*dry-run/i);
  assert.match(`${releaseDocs}\n${scriptsDocs}`, /OPL Desktop Release Cleanup Drafts[\s\S]*v<version>-draft\.\*[\s\S]*v<version>-readiness\.\*/i);

  assert.equal(
    releaseContract.release_acceleration.github_actions.remote_verification_workflow,
    '.github/workflows/release-verify-remote.yml',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.full_runtime_cache_warmup_workflow,
    '.github/workflows/full-runtime-cache-warmup.yml',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.promote_workflow,
    '.github/workflows/desktop-release-promote.yml',
  );
});

test('release CI operations policy distinguishes workflow hygiene from release evidence', () => {
  const testingDocs = fs.readFileSync(path.join(appRoot, 'docs', 'testing', 'README.md'), 'utf8');
  const scriptsDocs = fs.readFileSync(path.join(appRoot, 'scripts', 'README.md'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const vmWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'opl-first-run-vm.yml'), 'utf8');
  const workflowActionsDir = path.join(appRoot, '.github', 'actions');
  const combinedDocs = `${testingDocs}\n${scriptsDocs}`;

  assert.match(combinedDocs, /actionlint[\s\S]*(workflow semantic gate|workflow semantic gate in the reusable build quality jobs)/i);
  assert.match(combinedDocs, /YAML parsing[\s\S]*syntax check|YAML parsing[\s\S]*only proves syntax/i);
  assert.ok(
    !Object.values(packageJson.scripts).some((script) => String(script).includes('actionlint')),
    'actionlint is a CI gate, not an App-root package script',
  );

  assert.match(vmWorkflow, /concurrency:[\s\S]*opl-gui-first-run-vm-scheduled[\s\S]*opl-gui-first-run-vm-manual/);
  assert.match(vmWorkflow, /cancel-in-progress: \$\{\{ github\.event_name == 'schedule' \}\}/);
  assert.match(combinedDocs, /concurrency[\s\S]*duplicate-run governance/i);
  assert.match(combinedDocs, /not release evidence|not as proof/i);

  assert.match(combinedDocs, /Machine-readable release telemetry[\s\S]*JSON artifact|Machine-readable telemetry[\s\S]*JSON artifact/i);
  assert.match(combinedDocs, /after-release tuning|post-release tuning/i);
  assert.match(combinedDocs, /does not replace[\s\S]*(manifests|manifest)[\s\S]*SHA256SUMS[\s\S]*remote verification[\s\S]*VM/i);
  assert.match(combinedDocs, /same-run workflow artifact[\s\S]*draft/i);
  assert.match(combinedDocs, /release tag[\s\S]*provenance/i);

  assert.equal(fs.existsSync(path.join(workflowActionsDir, 'setup-active-shell-deps', 'action.yml')), true);
  assert.match(combinedDocs, /Composite\/setup[\s\S]*(checked-in composite action|checked in)/i);
  assert.match(combinedDocs, /\.github\/actions\/setup-active-shell-deps/i);
});

test('Full first-install workflow has one MinerU checkout and keeps standalone binary build path', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-first-install-release.yml'), 'utf8');

  assert.match(workflow, /npm view @openai\/codex version/);
  assert.match(workflow, /npm install -g "@openai\/codex@\$\{codex_latest\}"/);
  assert.match(workflow, /echo "OPL_FULL_CODEX_VERSION=\$codex_latest" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /\[\[ "\$codex_version" == "codex-cli \$codex_latest" \]\]/);
  assert.match(workflow, /brew install zstd temporal \|\| true/);
  assert.match(workflow, /temporal --version/);
  assert.match(workflow, /echo "OPL_FULL_BUN_BIN=\$\(command -v bun\)" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /echo "OPL_FULL_TEMPORAL_CLI_BIN=\$\(command -v temporal\)" >> "\$GITHUB_ENV"/);
  assert.equal(matchCount(workflow, /name: Checkout MinerU Ecosystem/g), 1);
  assert.equal(matchCount(workflow, /repository: opendatalab\/MinerU-Ecosystem/g), 1);
  assert.equal(matchCount(workflow, /^\s+path: MinerU-Ecosystem$/gm), 1);
  assert.match(workflow, /mineru_root="\$GITHUB_WORKSPACE\/MinerU-Ecosystem\/cli\/mineru-open-api"/);
  assert.match(workflow, /mineru_built_at="\$\(git -C "\$GITHUB_WORKSPACE\/MinerU-Ecosystem" show -s --format=%cI HEAD\)"/);
  assert.doesNotMatch(workflow, /mineru_built_at="\$\(date -u/);
  assert.match(workflow, /cd "\$mineru_root"[\s\S]*go install -ldflags/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /github\.com\/opendatalab\/MinerU-Ecosystem\/cli\/mineru-open-api\/cmd\.version=\$mineru_version/);
  assert.match(workflow, /github\.com\/opendatalab\/MinerU-Ecosystem\/cli\/mineru-open-api\/cmd\.commit=\$mineru_commit/);
  assert.match(workflow, /github\.com\/opendatalab\/MinerU-Ecosystem\/cli\/mineru-open-api\/cmd\.date=\$mineru_built_at/);
  assert.match(workflow, /name: Summarize Full package size/);
  assert.match(workflow, /npm run release:full:size -- --markdown >> "\$GITHUB_STEP_SUMMARY"/);
  assert.match(workflow, /name: Summarize Full caches and timings/);
  assert.match(workflow, /name: Cache Electron artifacts[\s\S]*id: electron-cache/);
  assert.match(workflow, /full-electron-cache-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}/);
  assert.match(workflow, /electron-cache-macos-arm64-arm64-/);
  assert.match(workflow, /ELECTRON_CACHE: \$\{\{ runner\.temp \}\}\/\.cache\/electron/);
  assert.match(workflow, /ELECTRON_BUILDER_CACHE: \$\{\{ runner\.temp \}\}\/\.cache\/electron-builder/);
  assert.match(workflow, /opl-full-runtime-cache-aggregate-key\.json/);
  assert.match(workflow, /export OPL_FULL_BUN_BIN="\$\{OPL_FULL_BUN_BIN:-\$\(command -v bun\)\}"/);
  assert.match(workflow, /export OPL_FULL_TEMPORAL_CLI_BIN="\$\{OPL_FULL_TEMPORAL_CLI_BIN:-\$\(command -v temporal\)\}"/);
  assert.match(workflow, /input\.aggregate_key_input/);
  assert.match(workflow, /toolchain:\s+'toolchain'/);
  assert.match(workflow, /'domain-runtime':\s+'domain_runtime'/);
  assert.match(workflow, /'opl-runtime':\s+'opl_runtime'/);
  assert.match(workflow, /skills:\s+'skills'/);
  assert.match(workflow, /\$\{outputName\}_cache_key=opl-full-runtime-layer-\$\{process\.env\.RUNNER_OS\}-\$\{process\.env\.RUNNER_ARCH\}-\$\{key\}/);
  assert.match(workflow, /name: Restore Full toolchain runtime cache[\s\S]*path: \$\{\{ steps\.runtime-cache-keys\.outputs\.toolchain_cache_dir \}\}/);
  assert.match(workflow, /name: Restore Full domain runtime cache[\s\S]*path: \$\{\{ steps\.runtime-cache-keys\.outputs\.domain_runtime_cache_dir \}\}/);
  assert.match(workflow, /name: Restore Full OPL runtime cache[\s\S]*path: \$\{\{ steps\.runtime-cache-keys\.outputs\.opl_runtime_cache_dir \}\}/);
  assert.match(workflow, /name: Restore Full skills runtime cache[\s\S]*path: \$\{\{ steps\.runtime-cache-keys\.outputs\.skills_cache_dir \}\}/);
  assert.match(workflow, /name: Save Full toolchain runtime cache[\s\S]*key: \$\{\{ steps\.runtime-cache-keys\.outputs\.toolchain_cache_key \}\}/);
  assert.match(workflow, /name: Save Full domain runtime cache[\s\S]*key: \$\{\{ steps\.runtime-cache-keys\.outputs\.domain_runtime_cache_key \}\}/);
  assert.match(workflow, /name: Save Full OPL runtime cache[\s\S]*key: \$\{\{ steps\.runtime-cache-keys\.outputs\.opl_runtime_cache_key \}\}/);
  assert.match(workflow, /name: Save Full skills runtime cache[\s\S]*key: \$\{\{ steps\.runtime-cache-keys\.outputs\.skills_cache_key \}\}/);
  assert.doesNotMatch(workflow, /restore-keys:\s*\|\s*\n\s*opl-full-runtime-layers-/);
  assert.match(workflow, /runtime-cache-events\.json/);
  assert.match(workflow, /full_runtime_layer_events/);
  assert.match(workflow, /full_runtime_layer_key_inputs/);
  assert.match(workflow, /electron_artifacts/);
  assert.match(workflow, /full-package-build-timing\.json/);
  assert.match(workflow, /full_package_build_breakdown/);
  assert.match(workflow, /## Full Package Build Breakdown/);
  assert.match(workflow, /payload_refs:\s+fullManifest\?\.resolved_refs/);
  assert.match(workflow, /resolved_refs:\s+fullManifest\?\.resolved_refs/);
  assert.match(workflow, /## Full Payload Resolved Refs/);
  assert.match(workflow, /requires_distributable_assets="\$\{\{ inputs\.publish_to_release \|\| inputs\.upload_full_package_artifact \}\}"/);
  assert.match(workflow, /echo "OPL_FULL_DISTRIBUTABLE_ASSETS=\$requires_distributable_assets" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /No Developer ID certificate secrets configured; continuing because this run does not publish or upload distributable Full assets\./);
  assert.match(workflow, /if \[ "\$\{OPL_FULL_DISTRIBUTABLE_ASSETS:-false\}" = "true" \]; then[\s\S]*Strict signing was not enabled for a distributable Full asset run/);
  assert.match(workflow, /name: Verify release upload plan[\s\S]*if:\s+\$\{\{ inputs\.publish_to_release \|\| inputs\.upload_full_package_artifact \}\}/);
  for (const expected of [
    'gaofeng21cn/one-person-lab',
    'gaofeng21cn/med-autoscience',
    'gaofeng21cn/med-autogrant',
    'gaofeng21cn/redcube-ai',
    'gaofeng21cn/opl-meta-agent',
    'iOfficeAI/OfficeCLI',
    'opendatalab/MinerU-Ecosystem',
    'nextlevelbuilder/ui-ux-pro-max-skill',
  ]) {
    assert.match(`${workflow}\n${fs.readFileSync(path.join(appRoot, 'scripts', 'plan-release-candidate.ts'), 'utf8')}`, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const diagnosticsStep = workflowStepBlock(workflow, 'Upload Full diagnostics artifact');
  const gatekeeperStep = workflowStepBlock(workflow, 'Upload Full Gatekeeper launch policy');
  assert.match(workflow, /name:\s+opl-full-diagnostics-\$\{\{ env\.OPL_RELEASE_VERSION \}\}/);
  assert.match(diagnosticsStep, /full-package-build-timing\.json[\s\S]*full-package-manifest\.json[\s\S]*runtime-cache-events\.json[\s\S]*full-runtime-native-trust\.json[\s\S]*SHA256SUMS\.txt/);
  assert.doesNotMatch(diagnosticsStep, /full-gatekeeper-launch-policy\.json/);
  assert.match(gatekeeperStep, /if:\s+\$\{\{ inputs\.publish_to_release \|\| inputs\.upload_full_package_artifact \}\}[\s\S]*full-gatekeeper-launch-policy\.json/);
  assert.match(workflow, /verify-full-runtime-native-trust\.ts[\s\S]*--require-spctl[\s\S]*full-runtime-native-trust\.json/);
  assert.match(workflow, /upload_full_package_artifact:[\s\S]*default:\s+true/);
  assert.match(workflow, /Upload Full package workflow artifact[\s\S]*if:\s+\$\{\{ inputs\.upload_full_package_artifact \}\}/);
  assert.match(workflow, /bash "\$GITHUB_WORKSPACE\/OfficeCLI\/install\.sh"/);
  assert.doesNotMatch(workflow, /raw\.githubusercontent\.com\/iOfficeAI\/OfficeCLI\/main\/install\.sh/);
  const warmupWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-runtime-cache-warmup.yml'), 'utf8');
  assert.match(warmupWorkflow, /upload_full_package_artifact:\s+false/);
  assert.match(warmupWorkflow, /publish_to_release:\s+false/);
  assert.match(workflow, /node -e 'const fs = require\("node:fs"\); const report = JSON\.parse\(fs\.readFileSync\(process\.argv\[1\], "utf8"\)\);/);
  assert.doesNotMatch(
    workflow,
    /runtime-cache-events\.json[\s\S]{0,400}<<'NODE'[\s\S]{0,400}NODE/,
    'runtime-cache-events summary must not use a nested heredoc; indented heredoc delimiters break bash on GitHub Actions',
  );
});

test('Full release docs publish size policy and remote verifier budget boundaries', () => {
  const releaseDocs = fs.readFileSync(path.join(appRoot, 'docs', 'release', 'README.md'), 'utf8');
  const scriptsDocs = fs.readFileSync(path.join(appRoot, 'scripts', 'README.md'), 'utf8');
  const combinedDocs = `${releaseDocs}\n${scriptsDocs}`;

  for (const expected of [
    'Full size policy',
    'compressed DMG size',
    'uncompressed runtime size',
    'layer breakdown',
    'remote verifier size budget',
    '700MB warning threshold',
    'miss_written',
    'release:full:size',
    '.codegraph',
    'runtime-state',
    'domain repositories',
    'domain repository',
  ]) {
    assert.match(combinedDocs, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }

  assert.match(releaseDocs, /Full size policy/i);
  assert.match(releaseDocs, /compressed DMG size/i);
  assert.match(releaseDocs, /uncompressed runtime size/i);
  assert.match(releaseDocs, /layer breakdown/i);
  assert.match(releaseDocs, /remote verifier size budget/i);
  assert.match(releaseDocs, /Full runtime packaging follows a hygiene-first policy/i);
  assert.match(releaseDocs, /Any narrower runtime allowlist must be declared by the owning domain repository/i);
  assert.match(scriptsDocs, /verify-remote-release-assets\.ts[\s\S]*remote verifier size budget/i);
});

test('Full package size analyzer reports manifest component and layer budgets', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-size-analysis-'));
  const manifestPath = path.join(tempRoot, 'full-package-manifest.json');
  writeFile(
    manifestPath,
    JSON.stringify({
      manifest_version: 2,
      version: '26.5.27-size',
      package_kind: 'opl_full_first_install_macos_arm64',
      size_budget: {
        platform_scope: 'macos-arm64',
        warning_full_dmg_bytes: 700000000,
        max_full_dmg_bytes: 750000000,
        max_runtime_uncompressed_bytes: 1000,
      },
      size_breakdown: {
        total_runtime_uncompressed_bytes: 500,
        layers: {
          toolchain: { size_bytes: 200 },
          'domain-runtime': { size_bytes: 180 },
          'opl-runtime': { size_bytes: 100 },
          skills: { size_bytes: 20 },
        },
      },
      components: {
        mas: { size_bytes: 180, git_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        codex: { size_bytes: 120, version: 'codex-cli 0.130.0' },
        opl: { size_bytes: 100, git_commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      },
    }, null, 2),
  );

  const jsonResult = runNode([
    'scripts/analyze-full-package-size.ts',
    '--manifest',
    manifestPath,
  ]);
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const summary = JSON.parse(jsonResult.stdout);
  assert.equal(summary.version, '26.5.27-size');
  assert.equal(summary.warning_full_dmg_bytes, 700000000);
  assert.equal(summary.max_full_dmg_bytes, 750000000);
  assert.equal(summary.runtime_budget_used_percent, 50);
  assert.equal(summary.components[0].id, 'mas');
  assert.equal(summary.layers[0].id, 'toolchain');

  const markdownResult = runNode([
    'scripts/analyze-full-package-size.ts',
    '--manifest',
    manifestPath,
    '--markdown',
  ]);
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /## Full Package Size/);
  assert.match(markdownResult.stdout, /\| Component \| Size \| Runtime % \| Version \/ Commit \|/);
  assert.match(markdownResult.stdout, /mas/);
  assert.match(markdownResult.stdout, /50% used/);
  assert.match(markdownResult.stdout, /Full DMG warning threshold: 667\.6 MiB/);
  assert.match(markdownResult.stdout, /Full DMG hard budget: 715\.3 MiB/);
  assert.match(markdownResult.stdout, /Runtime budget: 1000 B \(50% used\)/);
  assert.match(markdownResult.stdout, /\| mas \| 180 B \| 36% \|/);
});

test('release docs lock first-install maintenance and updater reference boundaries', () => {
  const releaseDocs = fs.readFileSync(path.join(appRoot, 'docs', 'release', 'README.md'), 'utf8');
  const statusDocs = fs.readFileSync(path.join(appRoot, 'docs', 'status.md'), 'utf8');
  const combinedDocs = `${releaseDocs}\n${statusDocs}`;

  assert.match(combinedDocs, /Core ready[\s\S]*best-effort background maintenance/i);
  assert.match(combinedDocs, /companion skills/i);
  assert.match(combinedDocs, /standard package[\s\S]*App-managed bootstrap[\s\S]*maintenance/i);
  assert.match(combinedDocs, /Electron autoUpdater/i);
  assert.match(combinedDocs, /background download/i);
  assert.match(combinedDocs, /restart/i);
  assert.match(combinedDocs, /Full[\s\S]*not[\s\S]*updater metadata/i);
  assert.match(combinedDocs, /Apple Command Line Tools/i);
  assert.match(combinedDocs, /xcode-select --install/i);
  assert.match(combinedDocs, /user confirmation/i);
});

test('manual build workflow keeps cross-platform builds behind an explicit switch', () => {
  const reusableWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  const manualWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'build-manual.yml'), 'utf8');

  assert.match(manualWorkflow, /default: 'macos-arm64'/);
  for (const platform of [
    'macos-arm64',
    'macos-x64',
    'macos-universal',
    'windows-x64',
    'windows-arm64',
    'linux-x64',
    'linux-arm64',
    'all',
  ]) {
    assert.match(manualWorkflow, new RegExp(`- ${platform}`));
  }

  assert.match(manualWorkflow, /case "\$PLATFORM" in/);
  assert.match(manualWorkflow, /WINDOWS_X64=.*"platform":"windows-x64"/);
  assert.match(manualWorkflow, /LINUX_X64=.*"platform":"linux-x64"/);
  assert.match(reusableWorkflow, /Build with electron-builder \(Windows\)/);
  assert.match(reusableWorkflow, /Build with electron-builder \(Linux\)/);
  assert.match(reusableWorkflow, /shells\/aionui\/out\/\*\.exe/);
  assert.match(reusableWorkflow, /shells\/aionui\/out\/\*\.deb/);
});

test('release creation job runs TypeScript asset scripts under Node 22', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'build-and-release.yml'), 'utf8');

  assert.match(
    workflow,
    /name: Create Release[\s\S]*name: Checkout active shell[\s\S]*repository: gaofeng21cn\/opl-aion-shell[\s\S]*path: shells\/aionui[\s\S]*name: Setup Node\.js[\s\S]*uses: actions\/setup-node@v6[\s\S]*node-version: '22'[\s\S]*node --experimental-strip-types scripts\/prepare-release-assets\.ts/,
  );
});

test('publish rejects standard App artifacts that contain the Full runtime payload', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-full-leak-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const version = '26.5.15-test';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;

  writeFile(path.join(outDir, dmgName));
  writeFile(path.join(outDir, `One-Person-Lab-${version}-mac-arm64.zip`));
  writeReleaseMetadata(outDir, version, dmgName);
  writeFile(
    path.join(shellRoot, 'out', 'mac-arm64', 'One Person Lab.app', 'Contents', 'Resources', 'opl-full-runtime', 'runtime', 'current', 'manifest', 'full-package-manifest.json'),
    '{}\n',
  );

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /contains Full runtime payload/);
});

test('packaged runtime validator only requires Full runtime when explicitly requested', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-packaged-runtime-'));
  const resourcesRoot = path.join(tempRoot, 'One Person Lab.app', 'Contents', 'Resources');
  const asarPath = path.join(resourcesRoot, 'app.asar');

  fs.mkdirSync(resourcesRoot, { recursive: true });
  fs.writeFileSync(asarPath, '', 'utf8');

  const validator = require(path.join(activeShellRoot, 'scripts', 'validate-packaged-runtime.js'));
  const optional = validator.validateFullRuntimeResources(resourcesRoot, { require: false });
  const required = validator.validateFullRuntimeResources(resourcesRoot, { require: true });

  assert.equal(optional.checked, false);
  assert.deepEqual(optional.issues, []);
  assert.equal(required.checked, false);
  assert.match(required.issues.join('\n'), /missing opl-full-runtime extraResource/);
});

test('Full first-install manifest declares App-owned distribution and Framework payload role', async () => {
  const mod = await import('../../scripts/full-first-install-package.ts');
  const manifest = mod.buildFullPackageManifest({ version: '26.5.15' });

  assert.equal(manifest.manifest_version, 2);
  assert.deepEqual(manifest.size_budget, {
    platform_scope: 'macos-arm64',
    warning_full_dmg_bytes: 700000000,
    max_full_dmg_bytes: 750000000,
    max_runtime_uncompressed_bytes: 950000000,
  });
  assert.deepEqual(manifest.measurement_policy, {
    full_dmg_bytes: 'github_release_asset_size_bytes',
    runtime_uncompressed_bytes: 'manifest_size_breakdown_total_runtime_uncompressed_bytes',
  });
  assert.deepEqual(manifest.runtime_assertions, {
    temporal_core_bridge_releases: [],
    excluded_module_venv_count: 0,
    packaged_global_node_packages: [],
  });
  assert.deepEqual(Object.keys(manifest.size_breakdown.layers), [
    'toolchain',
    'domain-runtime',
    'opl-runtime',
    'skills',
  ]);
  assert.equal(manifest.distribution.owner_repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(manifest.distribution.updater_metadata_allowed, false);
  assert.equal(
    manifest.runtime.domain_module_payload_policy,
    'packaged_runtime_modules_are_launch_sources; managed repo reconciliation is deferred maintenance',
  );
  assert.equal(manifest.components.opl.role, 'framework_cli_and_shared_contracts_payload_source');
});

test('Full first-install payload boundary stays assembly-only', async () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const mod = await import('../../scripts/full-first-install-package.ts');
  const manifest = mod.buildFullPackageManifest({ version: '26.5.15' });
  const profile = readProductProfile();
  const codexProfilePhrase = `${profile.codex.default_model} with ${profile.codex.default_reasoning_effort} reasoning`;

  assert.equal(
    releaseContract.full_first_install.payload_boundary.role,
    'declared_payload_assembly_and_validation',
  );
  assert.equal(releaseContract.full_first_install.generated_companion_text_language, 'en');
  assert.equal(releaseContract.full_first_install.updater_visible, false);
  assert.equal(releaseContract.full_first_install.updater_metadata_allowed, false);
  assert.equal(releaseContract.full_first_install.same_tag_refresh.mode, 'github_release_upload_clobber');
  assert.deepEqual(releaseContract.full_first_install.required_payloads.codex_cli, {
    compatibility_mode: 'minimum_version_plus_capability_smoke',
    minimum_version_source: 'distribution cohort manifest components.codex_cli.minimum_version',
    preferred_sources: ['explicit_user_path', 'system_path', 'homebrew_formula'],
    fallback_version_source: 'distribution cohort manifest components.codex_cli.fallback_version',
    fallback_runtime_path: 'runtime/current/bin/codex',
    must_prefer_valid_newer_user_version: true,
    verification: 'codex --version must satisfy minimum_version and Codex functional smoke must pass',
  });
  assert.equal(releaseContract.full_first_install.required_payloads.bun_cli, undefined);
  assert.deepEqual(releaseContract.full_first_install.optional_payloads.bun_cli, {
    source: 'Full workflow setup-bun resolved binary',
    runtime_path: 'runtime/current/bin/bun',
    default_packaged: false,
    enable_env: 'OPL_FULL_INCLUDE_BUN_RUNTIME=1',
    verification: 'Full manifest optional_components.bun records packaged or not_packaged status',
  });
  assert.deepEqual(releaseContract.full_first_install.required_payloads.temporal_cli, {
    compatibility_mode: 'minimum_version_plus_capability_smoke',
    minimum_version_source: 'distribution cohort manifest components.temporal_cli.minimum_version',
    preferred_sources: ['explicit_user_path', 'system_path', 'homebrew_formula'],
    fallback_version_source: 'distribution cohort manifest components.temporal_cli.fallback_version',
    fallback_runtime_path: 'runtime/current/bin/temporal',
    fallback_binary_path: 'runtime/current/vendor/temporal/cli/temporal',
    fallback_payload_path: 'runtime/current/vendor/temporal/temporal_cli_darwin_arm64.tar.gz',
    must_prefer_valid_newer_user_version: true,
    verification: 'temporal --version must satisfy minimum_version, bundled fallback must execute from the pre-extracted signed binary, and Temporal provider smoke must pass',
  });
  assert.deepEqual(releaseContract.full_first_install.required_payloads.temporal_runtime_provider, {
    provider_env_default: 'OPL_FAMILY_RUNTIME_PROVIDER=temporal',
    local_service_defaults: {
      address_env: 'OPL_TEMPORAL_ADDRESS',
      default_address: '127.0.0.1:7233',
      namespace_env: 'OPL_TEMPORAL_NAMESPACE',
      default_namespace: 'default',
      task_queue_env: 'OPL_TEMPORAL_TASK_QUEUE',
      default_task_queue: 'opl-stage-attempts',
    },
    managed_commands: [
      'opl family-runtime service start --provider temporal',
      'opl family-runtime worker status --provider temporal',
      'opl family-runtime worker start --provider temporal',
      'opl family-runtime residency proof --provider temporal --production',
    ],
    required_packages: [
      '@temporalio/activity',
      '@temporalio/client',
      '@temporalio/common',
      '@temporalio/worker',
      '@temporalio/workflow',
    ],
    forbidden_packages: ['@temporalio/testing'],
    native_core_bridge_releases: ['aarch64-apple-darwin'],
    verification: 'Full manifest runtime_assertions.temporal_core_bridge_releases must be exactly aarch64-apple-darwin and wrapper must export local Temporal defaults',
  });
  assert.deepEqual(
    manifest.distribution.payload_boundary.app_repo_does_not_own,
    releaseContract.full_first_install.payload_boundary.forbidden_authority,
  );
  assert.equal(manifest.distribution.product_profile_contract, 'contracts/app-product-profile.json');
  assert.deepEqual(
    manifest.distribution.product_profile.default_packaged_codex_skill_ids,
    profile.companion_payloads.default_packaged_codex_skill_ids,
  );
  assert.deepEqual(
    manifest.distribution.product_profile.packaged_not_default_visible_codex_skill_ids,
    profile.companion_payloads.packaged_not_default_visible_codex_skill_ids,
  );
  assert.equal(
    manifest.distribution.payload_boundary.truth_sources.framework_runtime_contracts,
    'gaofeng21cn/one-person-lab',
  );
  assert.equal(
    manifest.distribution.payload_boundary.truth_sources.research_domain_truth,
    'gaofeng21cn/med-autoscience',
  );
  assert.equal(
    manifest.distribution.payload_boundary.truth_sources.foundry_agent_domain_truth,
    'gaofeng21cn/opl-meta-agent',
  );
  assert.equal(
    manifest.distribution.payload_boundary.truth_sources.grant_domain_truth,
    'gaofeng21cn/med-autogrant',
  );
  assert.equal(
    manifest.distribution.payload_boundary.truth_sources.visual_deliverable_domain_truth,
    'gaofeng21cn/redcube-ai',
  );
  assert.equal(manifest.components.mineru_open_api.role, 'document_extraction_cli_binary');
  assert.equal(
    manifest.components.skills.role,
    'packaged_codex_skills_declared_by_app_product_profile',
  );
  assert.equal(manifest.components.temporal_cli.role, 'temporal_cli_preextracted_binary_wrapper');
  assert.equal(manifest.components.temporal_cli.required, true);
  assert.equal(manifest.optional_components.bun.role, 'optional_bun_cli_runtime_payload');
  assert.equal(manifest.optional_components.bun.required, false);
  assert.equal(manifest.optional_components.bun.status, 'not_packaged');
  const fullReadme = mod.buildFullFirstInstallReadme({
    version: '26.5.15',
    dmgName: 'One-Person-Lab-Full-26.5.15-mac-arm64.dmg',
    runtimeTarName: null,
    notarized: false,
  });
  assert.match(fullReadme, /The Full package only assembles and validates declared framework\/runtime, domain module, and companion tool payloads/);
  assert.match(fullReadme, /OPL Meta Agent/);
  assert.match(fullReadme, /mineru-open-api CLI binary/);
  assert.match(fullReadme, /mineru-document-extractor/);
  assert.ok(fullReadme.includes(codexProfilePhrase));
  assert.match(fullReadme, /deferred maintenance and does not block first launch/);
  assert.match(fullReadme, /without requiring Command Line Tools or git to finish first/);
  assert.doesNotMatch(fullReadme, /materialized under the standard module directory/);
  assert.doesNotMatch(fullReadme, /[\u3400-\u9fff]/);
});

test('Full first-install cache and release acceleration contract are explicit', async () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const buildScript = fs.readFileSync(path.join(appRoot, 'scripts', 'build-full-first-install-package.ts'), 'utf8');
  const fullWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-first-install-release.yml'), 'utf8');
  const publishScript = fs.readFileSync(path.join(appRoot, 'scripts', 'publish-release.ts'), 'utf8');
  const prepareStandardScript = fs.readFileSync(path.join(appRoot, 'scripts', 'prepare-standard-release-payload.ts'), 'utf8');
  const electronBuilder = fs.readFileSync(path.join(activeShellRoot, 'packages', 'desktop', 'electron-builder.yml'), 'utf8');
  const mod = await import('../../scripts/full-first-install-package.ts');
  const cacheDir = path.join(os.tmpdir(), 'opl-full-runtime-cache-test');
  const cacheKey = mod.buildFullRuntimeCacheKey({
    layerId: 'opl-runtime',
    parts: {
      opl_commit: '1111111111111111111111111111111111111111',
      package_lock_sha256: '2222222222222222222222222222222222222222222222222222222222222222',
    },
  });
  const cacheMiss = mod.classifyFullRuntimeLayerCache({
    mode: 'readwrite',
    cacheDir,
    layerId: 'opl-runtime',
    key: cacheKey,
    archiveExists: false,
  });
  const cacheHit = mod.classifyFullRuntimeLayerCache({
    mode: 'readwrite',
    cacheDir,
    layerId: 'opl-runtime',
    key: cacheKey,
    archiveExists: true,
  });
  const readonlyMiss = mod.classifyFullRuntimeLayerCache({
    mode: 'readonly',
    cacheDir,
    layerId: 'opl-runtime',
    key: cacheKey,
    archiveExists: false,
  });
  const disabled = mod.classifyFullRuntimeLayerCache({
    mode: 'off',
    cacheDir,
    layerId: 'opl-runtime',
    key: cacheKey,
    archiveExists: true,
  });

  assert.equal(packageJson.scripts['release:plan'], 'node --experimental-strip-types scripts/plan-release-candidate.ts');
  assert.equal(
    packageJson.scripts['release:full:size'],
    'node --experimental-strip-types scripts/analyze-full-package-size.ts',
  );
  assert.equal(releaseContract.release_acceleration.full_runtime_cache.enabled_by_default, true);
  assert.deepEqual(releaseContract.release_acceleration.full_runtime_cache.layer_ids, mod.FULL_RUNTIME_CACHE_LAYER_IDS);
  assert.deepEqual(releaseContract.release_acceleration.full_runtime_packaging_hygiene.local_state_excluded, [
    '.codegraph',
    '.git',
    '.worktrees',
    '.venv',
    'node_modules',
    'runtime',
    'runtime-state',
    'runs',
    'sessions',
    'tests',
  ]);
  assert.equal(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.measurement_command,
    'npm run release:full:size -- --markdown',
  );
  assert.equal(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.domain_runtime_allowlist_owner,
    'domain_repositories',
  );
  assert.deepEqual(releaseContract.release_acceleration.publish_resume.match_fields, ['asset_name', 'size', 'sha256']);
  assert.equal(releaseContract.release_acceleration.publish_resume.upload_order, 'largest_assets_first_then_name');
  assert.equal(releaseContract.release_acceleration.publish_resume.upload_mode, 'one_asset_per_gh_release_upload_command');
  assert.deepEqual(releaseContract.release_acceleration.publish_resume.new_release_upload_failure_cleanup, {
    enabled: true,
    scope: 'release created by the current publish invocation before asset upload',
    command: 'gh release delete <tag> --repo <repo> --yes --cleanup-tag',
    existing_release_refresh_cleanup_allowed: false,
    rule: 'If standard or Full asset upload fails after creating a new draft or release, delete that newly-created incomplete release and tag so the next same-cohort attempt starts from a clean remote state.',
  });
  assert.equal(cacheMiss.status, 'miss_written');
  assert.equal(cacheMiss.build_layer, true);
  assert.equal(cacheMiss.write_archive, true);
  assert.equal(cacheMiss.read_archive, false);
  assert.equal(cacheHit.status, 'hit');
  assert.equal(cacheHit.build_layer, false);
  assert.equal(cacheHit.read_archive, true);
  assert.equal(cacheHit.write_archive, false);
  assert.equal(readonlyMiss.status, 'miss_readonly');
  assert.equal(readonlyMiss.build_layer, true);
  assert.equal(readonlyMiss.write_archive, false);
  assert.equal(disabled.status, 'disabled');
  assert.equal(disabled.archive_path, null);
  assert.equal(mod.FULL_RUNTIME_CACHE_AGGREGATE_KEY_SCHEMA, 'opl_full_runtime_cache_aggregate_key.v1');
  assert.deepEqual(
    mod.buildFullRuntimeAggregateCacheKeyInput({
      layers: {
        toolchain: 'full-runtime-v1-toolchain-a',
        'domain-runtime': 'full-runtime-v1-domain-runtime-b',
        'opl-runtime': 'full-runtime-v1-opl-runtime-c',
        skills: 'full-runtime-v1-skills-d',
      },
    }),
    {
      schema: 'opl_full_runtime_cache_aggregate_key.v1',
      layout_version: 1,
      layer_ids: ['toolchain', 'domain-runtime', 'opl-runtime', 'skills'],
      layers: {
        toolchain: 'full-runtime-v1-toolchain-a',
        'domain-runtime': 'full-runtime-v1-domain-runtime-b',
        'opl-runtime': 'full-runtime-v1-opl-runtime-c',
        skills: 'full-runtime-v1-skills-d',
      },
    },
  );
  assert.match(cacheHit.archive_path, /opl-runtime/);
  assert.match(buildScript, /Library', 'Caches', 'One Person Lab', 'full-runtime-layers'/);
  assert.match(buildScript, /runtimeCacheMode: process\.env\.OPL_FULL_RUNTIME_CACHE_MODE \|\| 'readwrite'/);
  assert.match(buildScript, /CODEX_MACOS_ARM64_TARGET = 'aarch64-apple-darwin'/);
  assert.match(buildScript, /path\.join\(platformVendorRoot, 'bin', 'codex'\)/);
  assert.match(buildScript, /path\.join\(localVendorRoot, 'bin', 'codex'\)/);
  assert.match(buildScript, /path\.join\(platformVendorRoot, 'codex-path', 'rg'\)/);
  assert.match(buildScript, /path\.join\(localVendorRoot, 'codex-path', 'rg'\)/);
  assert.match(buildScript, /path\.join\(platformVendorRoot, 'codex', 'codex'\)/);
  assert.match(buildScript, /path\.join\(platformVendorRoot, 'path', 'rg'\)/);
  assert.match(buildScript, /function findNodeToolchain\(explicitNodeBin\)/);
  assert.match(buildScript, /npmBin: requireNodeToolchainFile\(nodeBinDir, 'npm'/);
  assert.match(buildScript, /npxBin: requireNodeToolchainFile\(nodeBinDir, 'npx'/);
  assert.match(buildScript, /npmRoot: requireNodeToolchainDirectory\(path\.join\(nodeRoot, 'lib', 'node_modules', 'npm'\)/);
  assert.match(buildScript, /bunBin: process\.env\.OPL_FULL_BUN_BIN \|\| ''/);
  assert.match(buildScript, /includeBunRuntime: process\.env\.OPL_FULL_INCLUDE_BUN_RUNTIME === '1'/);
  assert.match(buildScript, /temporalCliBin: process\.env\.OPL_FULL_TEMPORAL_CLI_BIN \|\| ''/);
  assert.match(buildScript, /temporalCliArchive: process\.env\.OPL_FULL_TEMPORAL_CLI_ARCHIVE \|\| ''/);
  assert.doesNotMatch(buildScript, /--hermes-root/);
  assert.match(buildScript, /else if \(token === '--bun-bin'\) parsed\.bunBin = path\.resolve\(value\)/);
  assert.match(buildScript, /token === '--include-bun-runtime'/);
  assert.match(buildScript, /else if \(token === '--temporal-cli-bin'\) parsed\.temporalCliBin = path\.resolve\(value\)/);
  assert.match(buildScript, /else if \(token === '--temporal-cli-archive'\) parsed\.temporalCliArchive = path\.resolve\(value\)/);
  assert.match(buildScript, /function findBunBinary\(explicitBunBin\)/);
  assert.match(buildScript, /function findTemporalCliBinary\(explicitBin\)/);
  assert.match(buildScript, /function findTemporalCliArchive\(explicitArchive\)/);
  assert.match(buildScript, /options\.includeBunRuntime \? findBunBinary\(options\.bunBin\) : null/);
  assert.match(buildScript, /findTemporalCliArchive,/);
  assert.match(buildScript, /copyPortableTree,\s+copyExecutableOrSymlinkTarget,\s+copyNodeRuntimePayload,\s+writeTemporalCliWrapper,\s+extractTemporalCliBinary,\s+assertNoExternalSymlinks,/);
  assert.match(buildScript, /if \(sources\.bunBin\) {\s*copySingleFile\(sources\.bunBin, path\.join\(layerRoot, 'bin', 'bun'\)\);\s*}/);
  assert.match(buildScript, /copySingleFile\(sources\.temporalCliArchive, path\.join\(layerRoot, 'vendor', 'temporal', 'temporal_cli_darwin_arm64\.tar\.gz'\)\)/);
  assert.match(buildScript, /extractTemporalCliBinary\(sources\.temporalCliArchive, path\.join\(layerRoot, 'vendor', 'temporal', 'cli', 'temporal'\)\)/);
  assert.match(buildScript, /writeTemporalCliWrapper\(path\.join\(layerRoot, 'bin', 'temporal'\), commandOutput\(sources\.temporalCliBin, \['--version'\]\)\)/);
  assert.match(buildScript, /function writeTemporalCliWrapper\(targetPath, versionOutput\)/);
  assert.match(buildScript, /TEMPORAL_VERSION_OUTPUT=\$\{shellSingleQuote\(versionOutput\)\}/);
  assert.match(buildScript, /if \[\[ "\\\$\{1:-\}" == "--version" \]\]/);
  assert.match(buildScript, /TEMPORAL_BIN="\$RUNTIME_HOME\/vendor\/temporal\/cli\/temporal"/);
  assert.doesNotMatch(buildScript, /ARCHIVE="\$RUNTIME_HOME\/vendor\/temporal\/temporal_cli_darwin_arm64\.tar\.gz"/);
  assert.doesNotMatch(buildScript, /tar -xzf "\$ARCHIVE" -C "\$EXTRACT_ROOT"/);
  assert.match(buildScript, /copyNodeRuntimePayload\(path\.dirname\(path\.dirname\(sources\.nodeToolchain\.nodeBin\)\), path\.join\(layerRoot, 'node'\)\)/);
  assert.match(buildScript, /function copyNodeRuntimePayload\(nodeRoot, targetRoot\)/);
  assert.match(buildScript, /for \(const relativePath of \['bin\/node', 'bin\/npm', 'bin\/npx'\]\)/);
  assert.match(buildScript, /for \(const packageName of \['npm', 'corepack'\]\)/);
  assert.match(buildScript, /assertNoExternalSymlinks\(targetRoot, 'Full first-install Node runtime'\)/);
  assert.match(buildScript, /function assertNoExternalSymlinks\(root, label\)/);
  assert.match(buildScript, /path\.isAbsolute\(linkTarget\) \|\| !isInsidePath\(rootPath, resolvedTarget\)/);
  assert.match(buildScript, /npm_bin_sha256: fileSha256\(sources\.nodeToolchain\.npmBin\)/);
  assert.match(buildScript, /npx_bin_sha256: fileSha256\(sources\.nodeToolchain\.npxBin\)/);
  assert.match(buildScript, /npm_package_version: packageJsonVersion\(path\.join\(sources\.nodeToolchain\.npmRoot, 'package\.json'\)\)/);
  assert.match(buildScript, /npm_package_fingerprint: directoryFingerprint\(sources\.nodeToolchain\.npmRoot, 'node\/lib\/node_modules\/npm'\)/);
  assert.match(buildScript, /bun_runtime_included: options\.includeBunRuntime/);
  assert.match(buildScript, /bun_sha256: sources\.bunBin \? fileSha256\(sources\.bunBin\) : null/);
  assert.match(buildScript, /temporal_cli_sha256: fileSha256\(sources\.temporalCliBin\)/);
  assert.match(buildScript, /temporal_cli_version: commandOutput\(sources\.temporalCliBin, \['--version'\]\)/);
  assert.match(buildScript, /temporal_cli_archive_sha256: fileSha256\(sources\.temporalCliArchive\)/);
  assert.match(buildScript, /packaged_global_node_packages: fs\.existsSync\(path\.join\(runtimeRoot, 'node', 'lib', 'node_modules'\)\)/);
  assert.match(buildScript, /optionalComponents = \{[\s\S]*bun: sources\.bunBin/);
  assert.match(buildScript, /status: 'not_packaged'/);
  assert.match(buildScript, /temporal_cli: \{[\s\S]*source_path: sources\.temporalCliBin/);
  assert.match(buildScript, /function copyOplMetaAgentSkill\(targetRoot, options\)/);
  assert.match(buildScript, /'agent', 'skills', 'opl-meta-agent-domain-skill\.md'/);
  assert.match(buildScript, /fs\.copyFileSync\(domainSkill, path\.join\(target, 'SKILL\.md'\)\)/);
  assert.match(buildScript, /\['knowledge', 'prompts', 'quality_gates', 'skills', 'stages'\]/);
  assert.match(buildScript, /function copySuperpowersBundle\(targetRoot, options\)/);
  assert.match(buildScript, /path\.join\(sourceRoot, 'skills'\)/);
  assert.match(buildScript, /path\.join\(skillsRoot, 'using-superpowers', 'SKILL\.md'\)/);
  assert.match(buildScript, /superpowers: \(targetRoot, options\) => copySuperpowersBundle\(targetRoot, options\)/);
  assert.match(buildScript, /superpowers_fingerprint: directoryFingerprint\(options\.superpowersRoot, 'skills\/superpowers'\)/);
  assert.match(fullWorkflow, /repository: obra\/superpowers/);
  assert.match(fullWorkflow, /path: superpowers/);
  assert.match(fullWorkflow, /OPL_FULL_SUPERPOWERS_ROOT="\$GITHUB_WORKSPACE\/superpowers"/);
  assert.match(buildScript, /cron: \(targetRoot\) => copyFirstSkillSource\('cron', targetRoot, appCompanionSkillCandidates\('cron'\)\)/);
  assert.match(buildScript, /'opl-meta-agent': \(targetRoot, options\) => copyOplMetaAgentSkill\(targetRoot, options\)/);
  assert.match(buildScript, /pdf: \(targetRoot\) => copyFirstSkillSource\('pdf', targetRoot, appCompanionSkillCandidates\('pdf'\)\)/);
  assert.match(
    buildScript,
    /'mineru-document-extractor': \(targetRoot, options\) => copyFirstSkillSource\(\s*'mineru-document-extractor'/,
  );
  assert.match(buildScript, /copySingleFile\(sources\.mineruOpenApiBin, path\.join\(layerRoot, 'bin', 'mineru-open-api'\)\)/);
  assert.match(buildScript, /version: commandOutput\(sources\.mineruOpenApiBin, \['version'\]\)/);
  assert.match(buildScript, /plugins', 'opl-meta-agent', 'skills', 'opl-meta-agent'/);
  assert.match(buildScript, /function masSkillCandidates\(options\)[\s\S]*options\.masRoot[\s\S]*\.codex', 'skills', 'mas'/);
  assert.match(buildScript, /copyFirstSkillSource\('mas', targetRoot, masSkillCandidates\(options\)\)/);
  assert.match(buildScript, /meta_agent_skill_source: metaAgentSkillSnapshot\(options\)/);
  assert.match(buildScript, /cron_skill_source: skillSourceSnapshot\(appCompanionSkillCandidates\('cron'\), 'skills\/cron'\)/);
  assert.match(buildScript, /pdf_skill_source: skillSourceSnapshot\(appCompanionSkillCandidates\('pdf'\), 'skills\/pdf'\)/);
  assert.match(buildScript, /mineru_document_extractor_source: skillSourceSnapshot\(mineruDocumentExtractorSkillCandidates\(options\), 'skills\/mineru-document-extractor'\)/);
  assert.match(buildScript, /runtime_layer_builder_source_hash: functionSourceSha256/);
  assert.match(buildScript, /key_inputs: cacheKeyInputs/);
  assert.match(buildScript, /guiRoot: process\.env\.OPL_FULL_GUI_ROOT \|\| resolveActiveShellPaths\(\)\.shellRoot/);
  assert.doesNotMatch(buildScript, /guiRoot: process\.env\.OPL_FULL_GUI_ROOT \|\| path\.join\(appRepoRoot, 'shells', 'aionui'\)/);
  assert.match(buildScript, /syncAppProductProfileToShell\(options\.guiRoot\)/);
  const fullRuntimeWrapperScript = fs.readFileSync(
    path.join(appRoot, 'scripts', 'full-first-install-runtime-wrappers.ts'),
    'utf8',
  );
  assert.match(fullRuntimeWrapperScript, /OPL_MODULE_PATH_MEDAUTOSCIENCE="\$RUNTIME_HOME\/modules\/mas"/);
  assert.match(fullRuntimeWrapperScript, /OPL_MODULE_PATH_MEDAUTOGRANT="\$RUNTIME_HOME\/modules\/mag"/);
  assert.match(fullRuntimeWrapperScript, /OPL_MODULE_PATH_REDCUBE="\$RUNTIME_HOME\/modules\/rca"/);
  assert.match(fullRuntimeWrapperScript, /OPL_MODULE_PATH_OPLMETAAGENT="\$RUNTIME_HOME\/modules\/meta-agent"/);
  assert.match(fullRuntimeWrapperScript, /OPL_TEMPORAL_ADDRESS="\\\$\{OPL_TEMPORAL_ADDRESS:-127\.0\.0\.1:7233\}"/);
  assert.match(fullRuntimeWrapperScript, /OPL_TEMPORAL_NAMESPACE="\\\$\{OPL_TEMPORAL_NAMESPACE:-default\}"/);
  assert.match(fullRuntimeWrapperScript, /OPL_TEMPORAL_TASK_QUEUE="\\\$\{OPL_TEMPORAL_TASK_QUEUE:-opl-stage-attempts\}"/);
  assert.match(prepareStandardScript, /syncAppProductProfileToShell\(shellPaths\.shellRoot, \{ optional: true \}\)/);
  assert.match(prepareStandardScript, /fs\.copyFileSync\(appInstallerPath, shellBootstrapInstallerPath\)/);
  assert.match(prepareStandardScript, /fs\.chmodSync\(shellBootstrapInstallerPath, 0o755\)/);
  assert.match(electronBuilder, /from: resources\/opl-install\.sh\s+to: opl-install\.sh/);
  assert.match(
    buildScript,
    /if \(cacheEvent\.read_archive\) {\s*extractLayer\(archivePath, targetRoot\);\s*return {\s*\.\.\.cacheEvent,\s*duration_seconds: durationSeconds\(startedAt, monotonicSeconds\(\)\),\s*};\s*}\s*const tempLayerRoot/,
  );
  assert.match(buildScript, /duration_seconds: durationSeconds\(startedAt, monotonicSeconds\(\)\)/);
  assert.match(buildScript, /aggregate_key_input: buildFullRuntimeAggregateCacheKeyInput\(\{ layers \}\)/);
  assert.match(buildScript, /artifactNames\.runtimeCacheEvents/);
  assert.match(publishScript, /skipped_existing_artifacts/);
  assert.match(publishScript, /--force-upload/);
  assert.match(publishScript, /cleanupNewlyCreatedReleaseAfterUploadFailure/);
  assert.match(publishScript, /'release', 'delete', tag, '--repo', repo, '--yes', '--cleanup-tag'/);
});

test('Full runtime pruning keeps macOS arm64 launch payloads without development environments', async () => {
  const mod = await import('../../scripts/full-first-install-package.ts');
  const buildScript = fs.readFileSync(path.join(appRoot, 'scripts', 'build-full-first-install-package.ts'), 'utf8');

  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/.venv/lib/python3.12/site-packages/numpy/core.so'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mag/.venv/pyvenv.cfg'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/node_modules/@types/node/index.d.ts'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/src/med_autoscience/__init__.py'), false);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/contracts/runtime-program/schema.json'), false);
  assert.equal(
    mod.shouldExcludeRuntimePath('modules/meta-agent/runtime/authority_functions/meta-agent-authority-functions.json'),
    false,
  );
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/runtime/legacy-state.json'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/.codegraph/codegraph.db'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/.codegraph/codegraph.db-wal'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/runtime-state/quest/output.png'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/runs/2026-05-27/result.json'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/prompts/xiaohongshu/style-references/ref.png'), false);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/assets/branding/logo.png'), false);
  assert.match(buildScript, /MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET = 'aarch64-apple-darwin'/);
  assert.match(buildScript, /pruneTemporalCoreBridgeReleases\(path\.join\(targetRoot, 'node_modules'\)\)/);
  assert.match(buildScript, /assertTemporalCoreBridgeMacosArm64Only\(path\.join\(runtimeRoot, 'opl', 'node_modules'\)\)/);
  assert.match(buildScript, /runtimeAssertions: collectRuntimeAssertions\(runtimeRoot\)/);
  assert.match(buildScript, /bunBin: process\.env\.OPL_FULL_BUN_BIN \|\| ''/);
  assert.match(buildScript, /includeBunRuntime: process\.env\.OPL_FULL_INCLUDE_BUN_RUNTIME === '1'/);
  assert.match(buildScript, /temporalCliBin: process\.env\.OPL_FULL_TEMPORAL_CLI_BIN \|\| ''/);
  assert.match(buildScript, /temporalCliArchive: process\.env\.OPL_FULL_TEMPORAL_CLI_ARCHIVE \|\| ''/);
  assert.match(buildScript, /else if \(token === '--bun-bin'\) parsed\.bunBin = path\.resolve\(value\)/);
  assert.match(buildScript, /token === '--include-bun-runtime'/);
  assert.match(buildScript, /else if \(token === '--temporal-cli-bin'\) parsed\.temporalCliBin = path\.resolve\(value\)/);
  assert.match(buildScript, /else if \(token === '--temporal-cli-archive'\) parsed\.temporalCliArchive = path\.resolve\(value\)/);
  assert.match(buildScript, /function findTemporalCliBinary\(explicitBin\)/);
  assert.match(buildScript, /function findTemporalCliArchive\(explicitArchive\)/);
  assert.match(buildScript, /function findBunBinary\(explicitBunBin\)/);
  assert.match(buildScript, /if \(sources\.bunBin\) {\s*copySingleFile\(sources\.bunBin, path\.join\(layerRoot, 'bin', 'bun'\)\);\s*}/);
  assert.match(buildScript, /copySingleFile\(sources\.temporalCliArchive, path\.join\(layerRoot, 'vendor', 'temporal', 'temporal_cli_darwin_arm64\.tar\.gz'\)\)/);
  assert.match(buildScript, /extractTemporalCliBinary\(sources\.temporalCliArchive, path\.join\(layerRoot, 'vendor', 'temporal', 'cli', 'temporal'\)\)/);
  assert.match(buildScript, /writeTemporalCliWrapper\(path\.join\(layerRoot, 'bin', 'temporal'\), commandOutput\(sources\.temporalCliBin, \['--version'\]\)\)/);
  assert.match(buildScript, /copyNodeRuntimePayload\(path\.dirname\(path\.dirname\(sources\.nodeToolchain\.nodeBin\)\), path\.join\(layerRoot, 'node'\)\)/);
  assert.match(buildScript, /assertNoExternalSymlinks\(targetRoot, 'Full first-install Node runtime'\)/);
  assert.match(buildScript, /packaged_global_node_packages:/);
  assert.match(buildScript, /optionalComponents = \{[\s\S]*bun: sources\.bunBin/);
  assert.match(buildScript, /status: 'not_packaged'/);
  assert.match(buildScript, /temporal_cli: \{[\s\S]*source_path: sources\.temporalCliBin[\s\S]*binary_path: 'runtime\/current\/vendor\/temporal\/cli\/temporal'/);
  assert.match(buildScript, /version: commandOutput\(path\.join\(runtimeRoot, 'bin', 'temporal'\), \['--version'\]\)/);
  assert.match(buildScript, /writeJsonFile\(runtimeNativeTrustPath, prepared\.manifest\.native_trust\)/);
  assert.match(buildScript, /codex: \{ source_path: sources\.codexRoot[\s\S]*size_bytes: directorySizeBytes\(path\.join\(runtimeRoot, 'bin', 'codex'\)\)/);
});
