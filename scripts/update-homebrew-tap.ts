#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Channel = 'stable' | 'nightly';
type PackageKind = 'app_standard' | 'app_full_first_install';

type Options = {
  channel: Channel;
  packageKind: PackageKind | null;
  version: string;
  tapRoot: string;
  manifestUrl: string;
  checksumSha256: string;
  downloadUrl: string;
  targets: string[];
  write: boolean;
  summaryPath: string | null;
  remoteWriteMode: string;
  selfCheck: boolean;
};

type ResolvedOptions = Omit<Options, 'packageKind'> & {
  packageKind: PackageKind;
};

type TapUpdateTarget = {
  path: string;
  kind: 'formula' | 'cask';
  previous_exists: boolean;
  changed: boolean;
  content: string;
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultTapRoot = path.join(appRoot, 'dist', 'homebrew-tap-plan');
const fullPayloadPattern = /One-Person-Lab-Full-[^"'\s]+-mac-arm64\.dmg|opl-release-manifest\.json/i;
const sha256Pattern = /^[a-f0-9]{64}$/i;
const standardAppCaskTargets = new Set([
  'Casks/one-person-lab.rb',
  'Casks/one-person-lab-nightly.rb',
]);
const fullFirstInstallCaskTarget = 'Casks/one-person-lab-full.rb';
const caskConflictMap: Record<string, string[]> = {
  'one-person-lab': ['one-person-lab-full', 'one-person-lab-nightly'],
  'one-person-lab-nightly': ['one-person-lab', 'one-person-lab-full'],
  'one-person-lab-full': ['one-person-lab', 'one-person-lab-nightly'],
};

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    channel: 'stable',
    packageKind: null,
    version: '',
    tapRoot: defaultTapRoot,
    manifestUrl: '',
    checksumSha256: '',
    downloadUrl: '',
    targets: [],
    write: false,
    summaryPath: null,
    remoteWriteMode: 'none',
    selfCheck: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--self-check') {
      parsed.selfCheck = true;
      continue;
    }
    if (token === '--write') {
      parsed.write = true;
      continue;
    }
    if (token === '--dry-run') {
      parsed.write = false;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${token} requires a value.`);
    }
    index += 1;

    if (token === '--channel') {
      if (value !== 'stable' && value !== 'nightly') {
        throw new Error('--channel must be stable or nightly.');
      }
      parsed.channel = value;
    } else if (token === '--package-kind') {
      if (value !== 'app_standard' && value !== 'app_full_first_install') {
        throw new Error('--package-kind must be app_standard or app_full_first_install. Homebrew tap updates are App cask-only; agent packs are App/CLI-managed.');
      }
      parsed.packageKind = value;
    } else if (token === '--version') {
      parsed.version = value;
    } else if (token === '--tap-root') {
      parsed.tapRoot = path.resolve(value);
    } else if (token === '--formula' || token === '--cask') {
      parsed.targets.push(value);
    } else if (token === '--manifest-url') {
      parsed.manifestUrl = value;
    } else if (token === '--checksum-sha256') {
      parsed.checksumSha256 = value;
    } else if (token === '--download-url') {
      parsed.downloadUrl = value;
    } else if (token === '--summary-path') {
      parsed.summaryPath = path.resolve(value);
    } else if (token === '--remote-write-mode') {
      parsed.remoteWriteMode = value;
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }

  return parsed;
}

function classifyTarget(targetPath: string): 'formula' | 'cask' {
  return targetPath.startsWith('Formula/') ? 'formula' : 'cask';
}

function assertNoFullPayloadReference(label: string, value: string): void {
  if (fullPayloadPattern.test(value)) {
    throw new Error(`${label} must not reference Full first-install payloads.`);
  }
}

function assertFullPayloadReference(label: string, value: string): void {
  if (!fullPayloadPattern.test(value)) {
    throw new Error(`${label} must reference Full first-install payloads for app_full_first_install.`);
  }
}

function assertRelativeTapTarget(targetPath: string): void {
  if (path.isAbsolute(targetPath) || targetPath.split(/[\\/]/).includes('..')) {
    throw new Error(`Homebrew tap target must be a relative path inside the tap checkout: ${targetPath}`);
  }
  if (!/^(Formula|Casks)\//.test(targetPath)) {
    throw new Error(`Homebrew tap target must live under Formula/ or Casks/: ${targetPath}`);
  }
}

function inferPackageKind(options: Options): PackageKind {
  if (options.packageKind) return options.packageKind;
  return 'app_standard';
}

function validateOptions(options: Options): ResolvedOptions {
  if (options.selfCheck) {
    return { ...options, packageKind: options.packageKind ?? 'app_standard' };
  }
  if (!options.version) throw new Error('Missing required --version.');
  if (!options.manifestUrl) throw new Error('Missing required --manifest-url.');
  if (!options.downloadUrl) throw new Error('Missing required --download-url.');
  if (!sha256Pattern.test(options.checksumSha256)) {
    throw new Error('--checksum-sha256 must be a 64-character SHA-256 digest.');
  }
  if (options.targets.length === 0) {
    throw new Error('Pass at least one --formula or --cask target.');
  }

  const packageKind = inferPackageKind(options);

  if (options.channel === 'nightly' && !/nightly/i.test(options.version)) {
    throw new Error('Nightly Homebrew tap updates must use a nightly version.');
  }
  if (options.channel === 'stable' && /nightly/i.test(options.version)) {
    throw new Error('Stable Homebrew tap updates must not use a nightly version.');
  }
  if (packageKind === 'app_full_first_install' && options.channel !== 'stable') {
    throw new Error('Full first-install Homebrew cask updates must stay on the stable channel.');
  }

  if (packageKind === 'app_full_first_install') {
    assertFullPayloadReference('download URL', options.downloadUrl);
    if (!/opl-release-manifest\.json$/i.test(new URL(options.manifestUrl).pathname)) {
      throw new Error('Full first-install Homebrew cask updates must reference opl-release-manifest.json.');
    }
  } else {
    assertNoFullPayloadReference('manifest URL', options.manifestUrl);
    assertNoFullPayloadReference('download URL', options.downloadUrl);
  }

  for (const targetPath of options.targets) {
    assertRelativeTapTarget(targetPath);
    const isNightlyTarget = /nightly/i.test(path.basename(targetPath));
    if (classifyTarget(targetPath) !== 'cask') {
      throw new Error('Homebrew tap updates are App cask-only; agent packs are App/CLI-managed, not Homebrew formulae.');
    }
    if (packageKind === 'app_full_first_install') {
      if (targetPath !== fullFirstInstallCaskTarget) {
        throw new Error('Full first-install Homebrew cask updates may only update Casks/one-person-lab-full.rb.');
      }
      continue;
    }
    assertNoFullPayloadReference('Homebrew tap target', targetPath);
    if (!standardAppCaskTargets.has(targetPath)) {
      throw new Error('Homebrew tap updates are App cask-only; agent packs are App/CLI-managed, not Homebrew formulae.');
    }
    if (options.channel === 'nightly' && !isNightlyTarget) {
      throw new Error('Nightly Homebrew tap updates may only update nightly formula/cask targets.');
    }
    if (options.channel === 'stable' && isNightlyTarget) {
      throw new Error('Stable Homebrew tap updates must not update nightly formula/cask targets.');
    }
  }

  return { ...options, packageKind };
}

function boundaryBlock(options: ResolvedOptions): string {
  const fullFirstInstall = options.packageKind === 'app_full_first_install';
  const lines = [
    '# OPL_HOMEBREW_BOUNDARY_START',
    `# channel: ${options.channel}`,
    `# package_kind: ${options.packageKind}`,
    `# version: ${options.version}`,
    `# manifest: ${options.manifestUrl}`,
    `# checksum: sha256:${options.checksumSha256}`,
    `# full_first_install_allowed: ${fullFirstInstall ? 'true' : 'false'}`,
    '# stable_promotion_from_nightly_allowed: false',
    '# publishes_or_pushes_remote: false',
  ];
  lines.push(
    `# cohort: ${fullFirstInstall ? 'full_first_install_homebrew_distribution' : 'standard_desktop_homebrew_distribution'}`,
    `# standard_updater_visible: ${fullFirstInstall ? 'false' : 'true'}`,
    '# modules_payload_allowed: false',
    `# bundled_full_runtime_payload_allowed: ${fullFirstInstall ? 'true' : 'false'}`,
    '# agent_pack_homebrew_allowed: false',
    '# agent_pack_activation_owner: app_cli_managed_background_maintenance',
    '# forbidden_module_formulae: one-person-lab-modules,one-person-lab-modules-nightly',
    '# must_not_write_user_codex_state: true',
    '# must_not_define_agent_semantics: true',
  );
  lines.push('# OPL_HOMEBREW_BOUNDARY_END');
  return lines.join('\n');
}

function renderHomebrewDownloadUrl(targetPath: string, options: ResolvedOptions): string {
  if (options.packageKind === 'app_full_first_install') {
    const fullDownloadUrl = `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${options.version}/One-Person-Lab-Full-${options.version}-mac-arm64.dmg`;
    if (classifyTarget(targetPath) === 'cask' && options.downloadUrl === fullDownloadUrl) {
      return 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v#{version}/One-Person-Lab-Full-#{version}-mac-arm64.dmg';
    }
    return options.downloadUrl;
  }

  const appDownloadUrl = `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${options.version}/One-Person-Lab-${options.version}-mac-arm64.dmg`;
  if (options.packageKind === 'app_standard' && classifyTarget(targetPath) === 'cask' && options.downloadUrl === appDownloadUrl) {
    return 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v#{version}/One-Person-Lab-#{version}-mac-arm64.dmg';
  }

  return options.downloadUrl;
}

function skeletonContent(targetPath: string, options: ResolvedOptions): string {
  const token = path.basename(targetPath, '.rb');
  const fullFirstInstall = options.packageKind === 'app_full_first_install';
  const conflicts = caskConflictMap[token] ?? [];
  if (classifyTarget(targetPath) === 'formula') {
    throw new Error('Homebrew tap updates are App cask-only; agent packs are App/CLI-managed, not Homebrew formulae.');
  }
  return [
    `cask "${token}" do`,
    `  version "${options.version}"`,
    `  sha256 "${options.checksumSha256}"`,
    '',
    `  url "${renderHomebrewDownloadUrl(targetPath, options)}"`,
    `  name "${fullFirstInstall ? 'One Person Lab Full' : 'One Person Lab'}"`,
    `  desc "${fullFirstInstall ? 'Complete first-install package for One Person Lab' : 'AI-first desktop research and agent orchestration app'}"`,
    '  homepage "https://github.com/gaofeng21cn/one-person-lab-app"',
    '',
    ...(options.channel === 'stable' || fullFirstInstall
      ? [
          '  livecheck do',
          '    url "https://github.com/gaofeng21cn/one-person-lab-app/releases/latest"',
          '    regex(%r{/releases/tag/v?(\\d+(?:\\.\\d+)*)}i)',
          '  end',
          '',
        ]
      : [
          '  livecheck do',
          '    skip "Nightly casks track prerelease cohorts through App release automation"',
          '  end',
          '',
    ]),
    ...(conflicts.length > 0
      ? [
          `  conflicts_with cask: ${conflicts.length === 1
            ? `"${conflicts[0]}"`
            : `[${conflicts.map((conflict) => `"${conflict}"`).join(', ')}]`}`,
        ]
      : []),
    '  depends_on macos: :big_sur',
    '  depends_on arch: :arm64',
    '',
    `  ${boundaryBlock(options).split('\n').join('\n  ')}`,
    '',
    '  app "One Person Lab.app"',
    ...(fullFirstInstall
      ? [
          '',
          '  caveats <<~EOS',
          '    This cask installs the complete first-install package. After launch,',
          '    One Person Lab manages runtime, modules, and agent exposure through',
          '    the App/CLI; Full assets stay outside standard updater metadata.',
          '  EOS',
        ]
      : []),
    'end',
    '',
  ].join('\n');
}

function replaceOrAppendBoundaryBlock(content: string, options: ResolvedOptions): string {
  const nextBlock = boundaryBlock(options);
  const blockPattern = /# OPL_HOMEBREW_BOUNDARY_START[\s\S]*?# OPL_HOMEBREW_BOUNDARY_END/;
  if (blockPattern.test(content)) {
    return content.replace(blockPattern, nextBlock);
  }
  return `${content.trimEnd()}\n\n${nextBlock}\n`;
}

function updateContent(content: string, targetPath: string, options: ResolvedOptions): string {
  let next = content.includes('OPL_HOMEBREW_BOUNDARY_START')
    ? skeletonContent(targetPath, options)
    : content.trim()
      ? replaceOrAppendBoundaryBlock(content, options)
      : skeletonContent(targetPath, options);
  next = next.replace(/(version\s+)["'][^"']+["']/, `$1"${options.version}"`);
  next = next.replace(/(sha256\s+)["'][^"']+["']/, `$1"${options.checksumSha256}"`);
  next = next.replace(/(url\s+)["'][^"']+["']/, `$1"${renderHomebrewDownloadUrl(targetPath, options)}"`);
  if (!next.endsWith('\n')) next += '\n';
  return next;
}

function validateUpdatedContent(target: TapUpdateTarget, options: ResolvedOptions): void {
  if (options.packageKind === 'app_full_first_install') {
    assertFullPayloadReference('Homebrew tap content', target.content);
  } else {
    assertNoFullPayloadReference('Homebrew tap content', target.content);
  }
  if (target.kind !== 'cask') {
    throw new Error(`${target.path} must be an App cask target.`);
  }
  if (!target.content.includes(options.manifestUrl)) {
    throw new Error(`${target.path} must reference the release manifest URL.`);
  }
  const expectedDownloadUrl = renderHomebrewDownloadUrl(target.path, options);
  if (!target.content.includes(expectedDownloadUrl) && !target.content.includes(options.downloadUrl)) {
    throw new Error(`${target.path} must reference the release download URL.`);
  }
  if (!target.content.includes(options.checksumSha256)) {
    throw new Error(`${target.path} must reference the SHA-256 checksum.`);
  }
  if (!target.content.includes('stable_promotion_from_nightly_allowed: false')) {
    throw new Error(`${target.path} must declare that stable promotion is not automatic from nightly.`);
  }
  if (options.packageKind === 'app_full_first_install') {
    for (const required of [
      'package_kind: app_full_first_install',
      'full_first_install_allowed: true',
      'standard_updater_visible: false',
      'cohort: full_first_install_homebrew_distribution',
      'bundled_full_runtime_payload_allowed: true',
    ]) {
      if (!target.content.includes(required)) {
        throw new Error(`${target.path} must declare Full first-install cask boundaries.`);
      }
    }
  } else if (!target.content.includes('full_first_install_allowed: false')) {
    throw new Error(`${target.path} must declare that standard Homebrew casks do not distribute Full first-install payloads.`);
  }
  const token = path.basename(target.path, '.rb');
  for (const conflictingCask of caskConflictMap[token] ?? []) {
    if (!target.content.includes(`"${conflictingCask}"`)) {
      throw new Error(`${target.path} must declare Homebrew cask conflict with ${conflictingCask}.`);
    }
  }
  if (!target.content.includes('modules_payload_allowed: false')) {
    throw new Error(`${target.path} must declare that standard App Homebrew distribution does not carry module payloads.`);
  }
  for (const required of [
    'agent_pack_homebrew_allowed: false',
    'agent_pack_activation_owner: app_cli_managed_background_maintenance',
    'must_not_write_user_codex_state: true',
    'must_not_define_agent_semantics: true',
  ]) {
    if (!target.content.includes(required)) {
      throw new Error(`${target.path} must declare App/CLI-managed agent-pack boundaries.`);
    }
  }
}

function buildPlan(inputOptions: Options): {
  channel: Channel;
  package_kind: PackageKind;
  version: string;
  dry_run: boolean;
  manifest_url: string;
  checksum_sha256: string;
  download_url: string;
  targets: Array<Omit<TapUpdateTarget, 'content'>>;
  policy: Record<string, boolean | string>;
} {
  const options = validateOptions(inputOptions);
  const targets = options.targets.map((targetPath): TapUpdateTarget => {
    const absolutePath = path.join(options.tapRoot, targetPath);
    const previous = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
    const content = updateContent(previous, targetPath, options);
    const target = {
      path: targetPath,
      kind: classifyTarget(targetPath),
      previous_exists: Boolean(previous),
      changed: previous !== content,
      content,
    };
    validateUpdatedContent(target, options);
    if (options.write) {
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content, 'utf8');
    }
    return target;
  });

  return {
    channel: options.channel,
    package_kind: options.packageKind,
    version: options.version,
    dry_run: !options.write,
    manifest_url: options.manifestUrl,
    checksum_sha256: options.checksumSha256,
    download_url: options.downloadUrl,
    targets: targets.map(({ content: _content, ...target }) => target),
    policy: {
      cohort: options.packageKind === 'app_full_first_install'
        ? 'full_first_install_homebrew_distribution'
        : 'standard_desktop_homebrew_distribution',
      manifest_required: true,
      checksum_required: true,
      nightly_targets_only_for_nightly: true,
      stable_promotion_from_nightly_allowed: false,
      full_first_install_allowed: options.packageKind === 'app_full_first_install',
      standard_updater_visible: options.packageKind !== 'app_full_first_install',
      full_cask_install_surface: options.packageKind === 'app_full_first_install',
      modules_payload_allowed: false,
      bundled_full_runtime_payload_allowed: options.packageKind === 'app_full_first_install',
      modules_activation_owner: 'app_cli_maintenance',
      agent_pack_homebrew_allowed: false,
      agent_pack_activation_owner: 'app_cli_managed_background_maintenance',
      must_not_write_user_codex_state: true,
      must_not_define_agent_semantics: true,
      publishes_or_pushes_remote: options.remoteWriteMode === 'direct_commit',
      remote_write_mode: options.remoteWriteMode,
    },
  };
}

function runSelfCheck(): void {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-tap-'));
  const digest = 'a'.repeat(64);
  const stablePlan = buildPlan({
    channel: 'stable',
    packageKind: 'app_standard',
    version: '26.6.4',
    tapRoot: tempRoot,
    manifestUrl: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/latest-arm64-mac.yml',
    checksumSha256: digest,
    downloadUrl: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-26.6.4-mac-arm64.dmg',
    targets: ['Casks/one-person-lab.rb'],
    write: true,
    summaryPath: null,
    selfCheck: false,
  });
  if (stablePlan.dry_run || !stablePlan.policy.manifest_required || !stablePlan.policy.checksum_required) {
    throw new Error('Homebrew stable self-check did not produce the required manifest/checksum policy.');
  }

  const fullPlan = buildPlan({
    channel: 'stable',
    packageKind: 'app_full_first_install',
    version: '26.6.4',
    tapRoot: tempRoot,
    manifestUrl: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/opl-release-manifest.json',
    checksumSha256: digest,
    downloadUrl: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-Full-26.6.4-mac-arm64.dmg',
    targets: ['Casks/one-person-lab-full.rb'],
    write: true,
    summaryPath: null,
    selfCheck: false,
  });
  if (!fullPlan.policy.full_first_install_allowed || fullPlan.policy.standard_updater_visible) {
    throw new Error('Homebrew Full self-check did not keep Full cask outside standard updater visibility.');
  }

  let rejectedModulePackageKind = false;
  try {
    parseArgs(['--package-kind', 'modules_bundle']);
  } catch (error) {
    rejectedModulePackageKind = String(error).includes('App cask-only');
  }
  if (!rejectedModulePackageKind) {
    throw new Error('Homebrew self-check did not reject module-bundle package kind.');
  }

  const nightlyPlan = buildPlan({
    channel: 'nightly',
    packageKind: 'app_standard',
    version: '26.6.4-nightly',
    tapRoot: tempRoot,
    manifestUrl: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/latest-arm64-mac.yml',
    checksumSha256: digest,
    downloadUrl: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/One-Person-Lab-26.6.4-nightly-mac-arm64.dmg',
    targets: ['Casks/one-person-lab-nightly.rb'],
    write: false,
    summaryPath: null,
    selfCheck: false,
  });
  if (!nightlyPlan.dry_run || nightlyPlan.targets[0]?.path !== 'Casks/one-person-lab-nightly.rb') {
    throw new Error('Homebrew nightly self-check did not stay on the nightly target.');
  }

  for (const blocked of [
    {
      channel: 'nightly' as Channel,
      packageKind: 'app_standard' as PackageKind,
      version: '26.6.4-nightly',
      targets: ['Casks/one-person-lab.rb'],
      message: 'nightly formula/cask',
    },
    {
      channel: 'stable' as Channel,
      packageKind: 'app_standard' as PackageKind,
      version: '26.6.4-nightly',
      targets: ['Casks/one-person-lab.rb'],
      message: 'Stable Homebrew tap updates must not use a nightly version',
    },
    {
      channel: 'stable' as Channel,
      packageKind: 'app_standard' as PackageKind,
      version: '26.6.4',
      targets: ['Formula/one-person-lab-modules.rb'],
      message: 'App cask-only',
    },
    {
      channel: 'stable' as Channel,
      packageKind: 'app_standard' as PackageKind,
      version: '26.6.4',
      manifestUrl: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/opl-release-manifest.json',
      downloadUrl: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-26.6.4-mac-arm64.dmg',
      targets: ['Casks/one-person-lab.rb'],
      message: 'Full first-install payloads',
    },
    {
      channel: 'nightly' as Channel,
      packageKind: 'app_full_first_install' as PackageKind,
      version: '26.6.4-nightly',
      targets: ['Casks/one-person-lab-full.rb'],
      message: 'Full first-install Homebrew cask updates must stay on the stable channel',
    },
    {
      channel: 'stable' as Channel,
      packageKind: 'app_full_first_install' as PackageKind,
      version: '26.6.4',
      targets: ['Casks/one-person-lab.rb'],
      message: 'Full first-install Homebrew cask updates may only update Casks/one-person-lab-full.rb',
    },
  ]) {
    let failed = false;
    try {
      buildPlan({
        channel: blocked.channel,
        packageKind: blocked.packageKind,
        version: blocked.version,
        tapRoot: tempRoot,
        manifestUrl: blocked.packageKind === 'app_full_first_install'
          ? 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/opl-release-manifest.json'
          : blocked.manifestUrl ?? 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/latest-arm64-mac.yml',
        checksumSha256: digest,
        downloadUrl: blocked.packageKind === 'app_full_first_install'
          ? 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-Full-26.6.4-mac-arm64.dmg'
          : blocked.downloadUrl ?? 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-26.6.4-mac-arm64.dmg',
        targets: blocked.targets,
        write: false,
        summaryPath: null,
        selfCheck: false,
      });
    } catch (error) {
      failed = String(error).includes(blocked.message);
    }
    if (!failed) {
      throw new Error(`Homebrew self-check expected rejection containing: ${blocked.message}`);
    }
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfCheck) {
    runSelfCheck();
    console.log('PASS: Homebrew tap boundary validates App cask-only manifest/checksum references, Full cask isolation, agent-pack App/CLI ownership, and cohort separation.');
    return;
  }

  const plan = buildPlan(options);
  const output = `${JSON.stringify(plan, null, 2)}\n`;
  if (options.summaryPath) {
    fs.mkdirSync(path.dirname(options.summaryPath), { recursive: true });
    fs.writeFileSync(options.summaryPath, output, 'utf8');
  }
  process.stdout.write(output);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
