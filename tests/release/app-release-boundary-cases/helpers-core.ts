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
  '.github/workflows/desktop-release-diagnostics.yml',
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
  'opl-bookforge',
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
export const expectedOrdinaryForbiddenCapabilityPolicy = {
  forbidden_mcp_matchers: {
    exact: ['aionui-team'],
    prefixes: ['team_', 'mcp__aionui-team'],
    contains: ['aionui-team'],
  },
  scrub_extra_keys: [
    'team_mcp_stdio_config',
    'team_id',
    'teamId',
    'team_lead_team_id',
    'team_lead_team_slot_id',
    'team_lead_conversation_id',
    'tl',
  ],
};
export const expectedOrdinaryRequiredScrubTargets = [
  'mcp_servers entries matching forbidden_mcp_matchers',
  'mcp_statuses entries matching forbidden_mcp_matchers',
  'session_mcp_servers entries matching forbidden_mcp_matchers',
  'scrub_extra_keys',
];
export const expectedAionuiTeamProbeIds = [
  'team_mode_disabled',
  'team_route_redirect',
  'team_sidebar_gate',
  'team_created_redirect_noop',
  'ordinary_conversation_team_snapshot_scrub',
  'agent_switching_drops_team_mcp',
  'team_deep_link_not_whitelisted',
  'team_bridge_mutation_gate',
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
    sections: ['core.codex', 'provider.temporal', 'modules', 'module_maintenance', 'paths', 'release', 'managed_update_plane'],
    mustShow: [
      'Codex CLI version and default profile from app_state.core',
      'Temporal status from app_state.provider.temporal',
      'MAS/MAG/RCA/OMA module version and source from app_state.modules',
      'module path source explanation',
      'Developer Profile source_channel capability and managed GHCR OPL Packages channel default',
      'section-level refresh state',
      'environment page named Local Environment, distinct from Project Progress',
      'runtime/toolchain managed updater status from App state or opl update status',
      'OPL Packages status and post-update sync status',
      'OPL Packages capability exposure sync substatus',
      'user-facing OPL Packages maintenance entry under Local Environment',
      'BookForge module maintenance status alongside MAS/MAG/RCA/OMA',
      'ScholarSkills module maintenance status alongside MAS/MAG/RCA/OMA/BookForge',
      'OPL Packages state, capability exposure substatus, and recommended action',
      'manual check/apply/repair/rollback mappings through opl update or App action routes',
    ],
    mustNotShow: [
      'Med Deep Scientist as a default module',
      'page-wide spinner while one section refreshes',
      'GUI-owned Temporal restart judgment',
      'project progress as a settings runtime page',
      'new Settings top-level tab for module maintenance',
      'Developer Profile checkout as a silent update target',
      'dirty checkout overwrite as a repair action',
      'developer checkout/dirty checkout as a silent update target',
      'module maintenance writing runtime/domain truth or update receipts directly',
      'Homebrew/global tool silent upgrade controls',
    ],
  },
  settings_storage: {
    matrixId: 'storage',
    sections: ['updater_cache', 'conversation_artifacts', 'runtime_toolchain', 'logs'],
    mustShow: [
      'storage inventory for updater cache, conversation artifacts, runtime/toolchain, and logs',
      'path, exists, bytes, cleanup_mode, and silent_delete_allowed for each local data root',
      'conversation archive/export receipt and restore proof before delete can execute',
      'runtime pointer-prune dry-run plan before execute can remove unreferenced runtime roots',
      'log rotation dry-run candidates by age, count, and size before execute can remove logs',
      'updater cache cleanup scoped to stale installer packages only',
    ],
    mustNotShow: [
      'silent conversation workdir deletion',
      'runtime/toolchain cleanup without current or rollback pointer protection',
      'log cleanup as proof that user artifacts were archived or deleted',
      'Homebrew/global tool silent cleanup controls',
      'domain artifact bodies',
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

export function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { encoding: 'utf8', mode: 0o755 });
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

function escapedPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function assertFullFirstInstallOptionTables(buildScript: string) {
  assert.match(buildScript, /const booleanOptionSetters = new Map\(\[/);
  for (const option of [
    '--skip-gui-build',
    '--split-runtime',
    '--reuse-gui-vite-output',
    '--print-runtime-cache-keys',
    '--include-bun-runtime',
  ]) {
    assert.match(buildScript, new RegExp(`\\['${escapedPattern(option)}', \\(parsed\\) =>`));
  }
  assert.match(buildScript, /const valueOptionSetters = new Map\(\[/);
  for (const option of [
    '--version',
    '--out-dir',
    '--framework-root',
    '--opl-root',
    '--gui-root',
    '--mas-root',
    '--mag-root',
    '--rca-root',
    '--meta-agent-root',
    '--bookforge-root',
    '--superpowers-root',
    '--codex-root',
    '--node-bin',
    '--bun-bin',
    '--uv-bin',
    '--temporal-cli-bin',
    '--temporal-cli-archive',
    '--python-root',
    '--officecli-bin',
    '--officecli-root',
    '--mineru-open-api-bin',
    '--mineru-root',
    '--mineru-document-extractor-root',
    '--ui-ux-pro-max-root',
    '--runtime-cache-dir',
    '--runtime-cache-mode',
  ]) {
    assert.match(buildScript, new RegExp(`\\['${escapedPattern(option)}', \\(parsed, value\\) =>`));
  }
  assert.match(buildScript, /const apply = booleanOptionSetters\.get\(token\)/);
  assert.match(buildScript, /const apply = valueOptionSetters\.get\(token\)/);
  assert.match(buildScript, /throw new Error\(`Unknown argument: \$\{token\}`\)/);
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

export function releaseEvidenceCohort(version = '26.6.5') {
  return {
    schema: 'opl_app_release_evidence_cohort.v1',
    version,
    tag: `v${version}`,
    channel: /nightly/i.test(version) ? 'nightly' : 'stable',
    source: 'test_fixture',
    current_cohort_evidence: true,
  };
}

export function remoteReleaseVerificationSummary(version = '26.6.5', fields = {}) {
  return {
    status: 'passed',
    repo: 'gaofeng21cn/one-person-lab-app',
    tag: `v${version}`,
    version,
    include_full_package: true,
    verified_asset_count: 10,
    full_first_install_budget: {
      status: 'passed',
    },
    ...fields,
  };
}

export function writeRemoteReleaseVerificationSummary(tempRoot, version = '26.6.5', fields = {}) {
  writeFile(
    path.join(tempRoot, 'remote-release-verification.json'),
    `${JSON.stringify(remoteReleaseVerificationSummary(version, fields))}\n`,
  );
}

export function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function writeFakeMacosTrustCommands(binDir, options = {}) {
  const teamIdentifier = options.teamIdentifier ?? 'TESTTEAMID';
  const signature = options.signature ?? 'Developer ID Application: Test (TESTTEAMID)';
  writeExecutable(path.join(binDir, 'codesign'), [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'if [ "$1" = "-dv" ]; then',
    `  echo ${JSON.stringify(`Signature=${signature}`)} >&2`,
    `  echo ${JSON.stringify(`TeamIdentifier=${teamIdentifier}`)} >&2`,
    '  exit 0',
    'fi',
    'exit 0',
    '',
  ].join('\n'));
  writeExecutable(path.join(binDir, 'spctl'), [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'exit 0',
    '',
  ].join('\n'));
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
