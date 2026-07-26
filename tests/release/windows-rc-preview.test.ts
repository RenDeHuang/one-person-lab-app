import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

import { appRoot } from './app-release-boundary-cases/helpers.ts';
import { buildWindowsRcBuildCohort } from '../../scripts/write-windows-rc-build-cohort.ts';

const appSha = 'a'.repeat(40);
const appTree = 'b'.repeat(40);
const shellSha = 'c'.repeat(40);
const shellTree = 'd'.repeat(40);
const frameworkSha = 'e'.repeat(40);

function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-windows-rc-cohort-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const out = path.join(root, 'out');
  const packagedTree = path.join(out, 'win-unpacked');
  const runtimeRoot = path.join(packagedTree, 'resources', 'bundled-aioncore', 'win32-x64');
  const toolRoot = path.join(
    runtimeRoot,
    'managed-resources',
    'acp',
    'codex-acp',
    '1.1.2',
    'win32-x64',
  );
  const codexRoot = path.join(
    toolRoot,
    'node_modules',
    '@openai',
    'codex-win32-x64',
    'vendor',
    'x86_64-pc-windows-msvc',
    'bin',
  );
  fs.mkdirSync(codexRoot, { recursive: true });
  fs.writeFileSync(path.join(out, 'One-Person-Lab-26.7.26-rc.1-win-x64.exe'), 'installer');
  fs.writeFileSync(path.join(runtimeRoot, 'aioncore.exe'), 'aioncore');
  fs.writeFileSync(path.join(runtimeRoot, 'manifest.json'), JSON.stringify({ platform: 'win32', arch: 'x64' }));
  fs.writeFileSync(
    path.join(runtimeRoot, 'managed-resources', 'manifest.json'),
    JSON.stringify({ acpTools: [{ slug: 'codex-acp', version: '1.1.2' }] }),
  );
  fs.writeFileSync(path.join(codexRoot, 'codex.exe'), 'codex');
  fs.writeFileSync(path.join(toolRoot, 'package.json'), '{}');
  return {
    installer: path.join(out, 'One-Person-Lab-26.7.26-rc.1-win-x64.exe'),
    packagedTree,
  };
}

test('Windows RC cohort seals the exact installer, packaged tree, and bundled native runtime without claiming WSL2-only', (t) => {
  const input = fixture(t);
  const cohort = buildWindowsRcBuildCohort({
    installerPath: input.installer,
    packagedTreePath: input.packagedTree,
    appSha,
    appTree,
    shellSha,
    shellTree,
    frameworkSha,
    version: '26.7.26-rc.1',
    platform: 'win32',
    arch: 'x64',
    actionsRunId: '12345',
    actionsRunAttempt: '1',
    actionsArtifactName: 'windows-build-x64-a1b2c3d',
  });
  assert.equal(cohort.schema, 'opl_windows_rc_build_cohort.v1');
  assert.equal(cohort.release.quality, 'preview');
  assert.equal(cohort.release.latest_allowed, false);
  assert.equal(cohort.source.framework_sha, frameworkSha);
  assert.equal(cohort.target.runtime_key, 'win32-x64');
  assert.equal(cohort.runtime.execution_substrate, 'bundled_native_windows_aioncore_and_codex_acp');
  assert.equal(cohort.runtime.wsl2_only_terminal_claim, false);
  assert.match(cohort.runtime.codex.path, /@openai\/codex-win32-x64\/vendor\/.+\/bin\/codex\.exe$/);
  assert.ok(cohort.packaged_tree.file_count >= 5);
  assert.equal(cohort.packaged_tree.sha256.length, 64);
});

test('Windows RC cohort rejects non-RC versions and missing exact source identities', (t) => {
  const input = fixture(t);
  const base = {
    installerPath: input.installer,
    packagedTreePath: input.packagedTree,
    appSha,
    appTree,
    shellSha,
    shellTree,
    frameworkSha,
    version: '26.7.26-rc.1',
    platform: 'win32',
    arch: 'x64',
    actionsRunId: '12345',
    actionsRunAttempt: '1',
    actionsArtifactName: 'windows-build-x64-a1b2c3d',
  };
  assert.throws(() => buildWindowsRcBuildCohort({ ...base, version: '26.7.26' }), /must match/);
  assert.throws(() => buildWindowsRcBuildCohort({ ...base, appSha: 'main' }), /exact 40-character/);
});

test('manual Windows builds reuse the multi-platform builder and emit a Windows-specific cohort', () => {
  const reusableText = fs.readFileSync(path.join(appRoot, '.github/workflows/_build-reusable.yml'), 'utf8');
  const manualText = fs.readFileSync(path.join(appRoot, '.github/workflows/build-manual.yml'), 'utf8');
  const reusable = parseYaml(reusableText) as any;
  const manual = parseYaml(manualText) as any;
  const steps = reusable.jobs.build.steps as Array<{ name?: string; if?: string; run?: string; with?: any }>;
  const macCohort = steps.find((step) => step.name === 'Write build artifact cohort manifest');
  const windowsCohort = steps.find((step) => step.name === 'Write Windows RC build artifact cohort manifest');
  const upload = steps.find((step) => step.name === 'Upload build artifacts');

  assert.match(String(macCohort?.if), /startsWith\(matrix\.platform, 'macos'\)/);
  assert.match(String(windowsCohort?.if), /startsWith\(matrix\.platform, 'windows'\)/);
  assert.match(String(windowsCohort?.run), /write-windows-rc-build-cohort\.ts/);
  assert.match(String(windowsCohort?.run), /out\/win-unpacked/);
  assert.match(String(windowsCohort?.run), /-name '\*\.exe'/);
  assert.match(String(upload?.with?.path), /opl-windows-rc-build-cohort\.json/);
  assert.equal(manual.on.workflow_dispatch.inputs.shell_ref.type, 'string');
  assert.equal(manual.on.workflow_dispatch.inputs.framework_ref.type, 'string');
  assert.equal(manual.jobs['build-pipeline'].with.shell_ref, '${{ inputs.shell_ref }}');
  assert.equal(manual.jobs['build-pipeline'].with.framework_ref, '${{ inputs.framework_ref }}');
});

test('Windows RC Preview remains an isolated non-Latest lane with an explicit WSL2-only gap', () => {
  const release = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts/app-release-channel.json'), 'utf8'));
  const install = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts/app-install-exposure-policy.json'), 'utf8'),
  );
  const target = release.distribution_semantics.approved_targets.windows_x64_rc_preview;
  const routing = install.distribution_install_model.platform_routing.windows_personal;

  assert.equal(target.quality, 'preview');
  assert.equal(target.prerelease_required, true);
  assert.equal(target.latest_allowed, false);
  assert.equal(target.stable_updater_allowed, false);
  assert.equal(target.homebrew_allowed, false);
  assert.equal(target.runtime_execution_substrate, 'bundled_native_windows_aioncore_and_codex_acp');
  assert.equal(target.wsl2_only_terminal_claim, false);
  assert.ok(target.deferred_supported_release_gates.includes(
    'wsl2_only_runtime_for_every_codex_backed_path_without_native_fallback',
  ));
  assert.equal(routing.current_default_runtime_form, 'container_webui');
  assert.equal(routing.desktop_preview_changes_default_route, false);
  assert.equal(routing.wsl2_only_supported_desktop_target_requires_separate_qualification, true);
});

test('Windows install guide binds the exact RC assets and preserves credential and SmartScreen boundaries', () => {
  const manifest = JSON.parse(fs.readFileSync(
    path.join(
      appRoot,
      'docs/delivery/user-guides/windows-app-install/source/windows-app-install.quarto.json',
    ),
    'utf8',
  ));
  const guide = fs.readFileSync(path.join(appRoot, 'docs/guides/windows-app-install/guide.qmd'), 'utf8');

  assert.equal(manifest.state, 'active_preview');
  assert.equal(manifest.download.installer_asset, 'One-Person-Lab-26.7.26-rc.1-win-x64.exe');
  assert.match(manifest.download.preview_release_url, /windows-rc-26\.7\.26-rc\.1$/);
  for (const term of manifest.required_terms) assert.match(guide, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const phrase of manifest.forbidden_phrases) assert.doesNotMatch(guide, new RegExp(phrase));
  assert.match(guide, /密码、token 和 API Key 不应进入 PowerShell/);
  assert.match(guide, /不要关闭\s+Microsoft Defender/);
  assert.match(guide, /当前 RC 的桌面会话仍使用随包的原生 Windows/);
});
