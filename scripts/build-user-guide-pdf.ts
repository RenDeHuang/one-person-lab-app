#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guideDir = path.join(appRoot, 'docs', 'user-guides');
const assetDir = path.join(guideDir, 'assets');
const assetManifestPath = path.join(guideDir, 'macos-app-install-assets.json');
const markdownPath = path.join(guideDir, 'macos-app-install.md');
const pdfPath = path.join(guideDir, 'macos-app-install-detailed-guide.pdf');
const verificationPath = path.join(guideDir, 'macos-app-install-verification.json');
const tempDir = path.join(appRoot, 'tmp', 'pdfs', 'macos-app-install');
const tempMarkdownPath = path.join(tempDir, 'macos-app-install.pandoc.md');

const latestReleaseUrl = 'https://github.com/gaofeng21cn/one-person-lab-app/releases/latest';
const assetManifest = JSON.parse(fs.readFileSync(assetManifestPath, 'utf8'));
const screenshotReleaseTag = process.env.OPL_APP_GUIDE_SCREENSHOT_RELEASE_TAG || assetManifest.release_tag || 'unknown';

const steps = [
  {
    title: '1. 下载 One Person Lab',
    body: '访问 One Person Lab App 最新 Release 页面，下载 macOS Apple Silicon DMG。首次安装或干净机器建议选择 Full 版 DMG。',
    asset: '01-download-release.png',
    notes: [
      `最新版本页面：${latestReleaseUrl}`,
      '最简单的稳定版安装命令：`curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install-stable.sh | bash`。',
      '稳定安装器会下载 latest Full DMG、复制到 Applications，并尽量清理 macOS quarantine，减少首次启动时反复授权。',
      'Full 版 DMG 是首次安装资产，包含 OPL Framework runtime、MAS/MAG/RCA、officecli、mineru-open-api 与推荐 skills 等 payload。',
      '标准 mac-arm64 DMG 体积更小，适合已经安装过 One Person Lab App 的用户和后续自动更新。',
    ],
  },
  {
    title: '2. 安装 App',
    body: '打开 DMG，将 One Person Lab 拖入 Applications。首次打开如出现 macOS 安全提示，按系统提示确认。',
    asset: '02-install-dmg.png',
    notes: ['安装完成后从 Applications 启动 App。', '不要长期在 DMG 挂载窗口内运行 App。'],
  },
  {
    title: '3. 配置访问权限',
    body: '首次启动如果提示访问权限未配置，请联系 gflabtoken 管理员获取访问密钥，并在首启页面完成配置。',
    asset: '03-codex-config-needed.png',
    notes: ['管理员开通后，在页面输入访问密钥并点击完成配置。', '不要把密钥截图、转发或写入研究数据目录。'],
  },
  {
    title: '4. 等待首次环境检查',
    body: 'OPL 会先检查开始使用所需的关键项：工作目录、本机助手和访问权限。首屏只显示“正在准备 / 可以开始 / 需要处理”的简短状态、三步准备进度、下一步，以及进入 OPL 的主按钮。',
    asset: '04-first-run-checking.png',
    notes: [
      '首启准备可能需要几分钟，进度来自 OPL 底层初始化状态；App 只负责展示，不单独维护另一套安装进度。',
      '模块、skills、运行底座和本机工具属于后台维护；技术 phase、刷新、运行时设置、原始错误和维护动作默认收在“技术细节”里，不会把新手停在 Homebrew、Node、Git 或命令行工具清单上。',
      '遇到阻塞时先阅读界面提示，再联系技术支持处理。',
    ],
  },
  {
    title: '5. 进入科研入口',
    body: '准备完成后，在主界面选择科研入口，进入 Research Foundry / Med Auto Science 工作流。',
    asset: '05-opl-ready-research-entry.png',
    notes: ['MAS 通过 OPL 内的 Research Foundry / Med Auto Science 入口使用。', '用户不需要另行获取 MAS 分发资产。'],
  },
  {
    title: '6. 确认工作目录和运行设置',
    body: '在本机运行环境中确认工作目录、Codex CLI、Temporal、更新状态和智能体模块。需要调整数据目录或运行设置时，从这里进入。',
    asset: '06-research-data-folder.png',
    notes: ['建议按一个病种或稳定研究主题建立本地 workspace，再把原始或脱敏材料集中放入工作目录。', '患者数据需先脱敏，并遵守本机构数据管理要求。'],
  },
  {
    title: '7. 发起首次科研任务',
    body: '第一条任务可直接用自然语言描述，让 MAS 先判断研究方向、证据缺口和下一步。',
    asset: '07-first-research-entry.png',
    notes: ['示例提示词：我有一批肺结节随访数据，专病 workspace 在“肺结节真实世界研究”，原始材料在 raw_data/，请先判断最值得推进的研究问题，并说明还缺哪些证据，目标是形成一篇可投稿论文。'],
  },
  {
    title: '8. 查看进度与结果',
    body: '任务启动后，重点查看当前阶段、阻塞项、下一步和产物位置。',
    asset: '08-opl-runtime-status.png',
    notes: ['看到需要人工确认的项目时，由研究者或 PI 判断是否继续。', '投稿前最终科学判断、伦理合规和署名安排仍由研究团队负责。'],
  },
];

const forbiddenPatterns = [/sk-[A-Za-z0-9_-]+/, /OPENAI_API_KEY/, /CODEX_API_KEY/, /opl-first-run-smoke-guide-key/];

function run(command: string, args: string[], options: { cwd?: string } = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? appRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error([
      `Command failed: ${command} ${args.join(' ')}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'));
  }
  return result;
}

function imageInfo(filePath: string) {
  const result = run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath]);
  const width = Number(result.stdout.match(/pixelWidth:\s+(\d+)/)?.[1] ?? 0);
  const height = Number(result.stdout.match(/pixelHeight:\s+(\d+)/)?.[1] ?? 0);
  return { width, height };
}

function fileSha256(filePath: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function expectedAssetNumber(expected: Record<string, unknown>, key: string, asset: string) {
  const value = Number(expected[key]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Guide screenshot provenance for ${asset} must include positive numeric ${key}`);
  }
  return value;
}

function expectedAssetSha256(expected: Record<string, unknown>, asset: string) {
  const value = typeof expected.sha256 === 'string' ? expected.sha256.trim() : '';
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`Guide screenshot provenance for ${asset} must include sha256`);
  }
  return value;
}

function assertAssets() {
  const missing = steps
    .map((step) => step.asset)
    .filter((asset) => !fs.existsSync(path.join(assetDir, asset)));
  if (missing.length > 0) {
    throw new Error(`Missing guide screenshot assets:\n${missing.join('\n')}`);
  }

  const dimensions: Record<string, { width: number; height: number }> = {};
  const assets: Record<string, Record<string, unknown>> = {};
  for (const step of steps) {
    const filePath = path.join(assetDir, step.asset);
    const info = imageInfo(filePath);
    const expected = assetManifest.assets?.[step.asset];
    if (!expected) {
      throw new Error(`Missing guide screenshot provenance in ${path.relative(appRoot, assetManifestPath)}: ${step.asset}`);
    }
    const sha256 = fileSha256(filePath);
    const expectedWidth = expectedAssetNumber(expected, 'width', step.asset);
    const expectedHeight = expectedAssetNumber(expected, 'height', step.asset);
    const expectedSha256 = expectedAssetSha256(expected, step.asset);
    dimensions[step.asset] = info;
    if (info.width !== expectedWidth || info.height !== expectedHeight) {
      throw new Error(`Expected ${step.asset} to be ${expectedWidth}x${expectedHeight}, got ${info.width}x${info.height}`);
    }
    if (sha256 !== expectedSha256) {
      throw new Error(`Guide screenshot hash mismatch for ${step.asset}: expected ${expectedSha256}, got ${sha256}`);
    }
    assets[step.asset] = {
      title: expected.title,
      source_kind: expected.source_kind,
      source: expected.source,
      source_width: expected.source_width,
      source_height: expected.source_height,
      source_sha256: expected.source_sha256,
      width: info.width,
      height: info.height,
      sha256,
    };
  }
  return { dimensions, assets };
}

function buildMarkdown(options: { pandocPageBreaks?: boolean } = {}) {
  const lines: string[] = [
    '# OPL + MAS 新手首次启动图文教程',
    '',
    'Owner: `one-person-lab-app`',
    'Purpose: `macos_app_install_user_guide_pdf_source`',
    'State: `active`',
    'Machine boundary: Human-readable user guide. Release contracts, workflows, VM smoke artifacts, and App release metadata remain the machine truth.',
    '',
    '适用对象：医生、PI、课题负责人；不要求计算机基础。本文以 macOS App 首次启动为主线，说明如何下载、安装、配置 One Person Lab，并通过 Research Foundry / Med Auto Science 发起首次科研任务。',
    '',
    `下载最新版本：${latestReleaseUrl}`,
    '',
    '> 涉及访问权限配置时，请联系 gflabtoken 管理员获取访问密钥。不要自行购买、复制来源不明的密钥，或把密钥写入研究数据目录。',
    '',
    '## 准备清单',
    '',
    '- 一台 Apple Silicon Mac 或可运行 macOS App 的 Mac。',
    '- 稳定网络，用于下载 One Person Lab 和完成首次环境检查。',
    '- gflabtoken 开通状态；涉及访问权限时请联系 gflabtoken 管理员获取访问密钥。',
    '- 本地研究数据文件夹，数据需完成脱敏并符合本机构数据管理要求。',
    '- 变量说明、纳排标准、终点定义、统计计划、参考文献或已有草稿；可以先放入专病 workspace 的 `raw_data/`。',
    '',
  ];

  for (const step of steps) {
    if (options.pandocPageBreaks) lines.push('\\newpage', '');
    lines.push(
      `## ${step.title}`,
      '',
      step.body,
      '',
      `![${step.title}](assets/${step.asset})${options.pandocPageBreaks ? '{ height=64% }' : ''}`,
      '',
    );
    for (const note of step.notes) lines.push(`- ${note}`);
    lines.push('');
  }

  if (options.pandocPageBreaks) lines.push('\\newpage', '');
  lines.push(
    '## 常见问题',
    '',
    '- 下载失败：换网络后重试，或请技术支持人员确认 GitHub Release 是否可访问。',
    '- 打不开 App：优先使用稳定安装命令重新安装；手动安装时确认已拖入 Applications，并按 macOS 安全提示允许打开。',
    '- 访问权限未配置：联系 gflabtoken 管理员获取访问密钥，并在首启页面完成配置。',
    '- 模块未就绪：在 App 的环境管理中重新检查，确认 OPL 完整安装资产与本机网络状态。',
    '- 数据路径看不到：确认选择的是本机可访问的专病 workspace，或能看到其中的 `raw_data/`。',
    '- 任务启动后不知道看哪里：查看运行状态页的当前阶段、下一步和需要人工确认的项目。',
    '',
    '## 截图与验证来源',
    '',
    `- 截图来自 ${screenshotReleaseTag} 的中文 1080p VM guide artifact 与同一次 VM smoke 的 App CDP 截图；PNG 保留各自原始输出尺寸，不做统一画布要求。`,
    '- VM smoke 使用真实 DMG 安装到 `/Applications/One Person Lab.app`；标准版验证 GUID 输入页、Settings 和 MAS/MAG/RCA 入口可用。首启截图和 layout gate 会验证新手首屏保持简化，技术细节默认折叠。',
    '- 每张截图的来源、尺寸和 SHA256 记录在 `macos-app-install-assets.json` 与生成后的 verification JSON 中。',
    '- Release、DMG、首启日志和模块状态以 App repo contracts / workflow / VM smoke artifacts 为机器真相。',
    '',
  );

  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

function stripRepositoryMetadata(markdown: string) {
  const metadataKeys = new Set(['Owner', 'Purpose', 'State', 'Machine boundary']);
  return markdown
    .split(/\r?\n/)
    .filter((line) => {
      const match = /^([^:]+):\s+/.exec(line);
      return !match || !metadataKeys.has(match[1]);
    })
    .join('\n');
}

function scanTextForSecrets(text: string) {
  const hits = forbiddenPatterns.filter((pattern) => pattern.test(text)).map(String);
  if (hits.length > 0) throw new Error(`Guide text contains forbidden sensitive marker(s): ${hits.join(', ')}`);
}

function buildPdf() {
  fs.mkdirSync(tempDir, { recursive: true });
  const markdown = buildMarkdown();
  const pandocMarkdown = buildMarkdown({ pandocPageBreaks: true });
  scanTextForSecrets(markdown);
  fs.writeFileSync(markdownPath, markdown, 'utf8');
  fs.writeFileSync(tempMarkdownPath, stripRepositoryMetadata(pandocMarkdown), 'utf8');

  const font = process.env.OPL_APP_GUIDE_PDF_FONT || 'Noto Sans CJK SC';
  run('pandoc', [
    tempMarkdownPath,
    '--standalone',
    '--pdf-engine=xelatex',
    '--resource-path', `${appRoot}:${guideDir}`,
    '--metadata', 'title=OPL + MAS 新手首次启动图文教程',
    '-V', `mainfont=${font}`,
    '-V', `CJKmainfont=${font}`,
    '-V', 'geometry:margin=14mm,landscape',
    '-V', 'colorlinks=true',
    '-V', 'linkcolor=blue',
    '-V', 'urlcolor=blue',
    '-V', 'pagestyle=plain',
    '-o', pdfPath,
  ]);
}

function renderPdf() {
  const renderDir = path.join(tempDir, 'rendered');
  fs.rmSync(renderDir, { recursive: true, force: true });
  fs.mkdirSync(renderDir, { recursive: true });
  run('pdftoppm', ['-png', '-r', '120', pdfPath, path.join(renderDir, 'page')]);
  const pages = fs.readdirSync(renderDir).filter((name) => name.endsWith('.png')).sort();
  return { renderDir, pages };
}

function pdfInfo() {
  const result = run('pdfinfo', [pdfPath]);
  return result.stdout;
}

function main() {
  const { dimensions, assets } = assertAssets();
  buildPdf();
  const render = renderPdf();
  const info = pdfInfo();
  const pageMatch = info.match(/^Pages:\s+(\d+)/m);
  const pages = Number(pageMatch?.[1] ?? 0);
  if (pages < 10) {
    throw new Error(`Expected a multi-step guide PDF with at least 10 pages, got ${pages}`);
  }
  const pageSizeMatch = info.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m);
  const pageWidth = Number(pageSizeMatch?.[1] ?? 0);
  const pageHeight = Number(pageSizeMatch?.[2] ?? 0);
  if (pageWidth <= pageHeight) {
    throw new Error(`Expected landscape PDF page size, got ${pageWidth}x${pageHeight} pts`);
  }

  const verification = {
    status: 'macos_app_install_pdf_ready',
    pdf_layout: 'landscape',
    download_url: latestReleaseUrl,
    screenshot_release_tag: screenshotReleaseTag,
    screenshot_asset_manifest: path.relative(appRoot, assetManifestPath),
    source_markdown: path.relative(appRoot, markdownPath),
    output_pdf: path.relative(appRoot, pdfPath),
    screenshot_source: {
      source: assetManifest.screenshot_source,
      release_run_id: assetManifest.release_run?.id,
      release_run_url: assetManifest.release_run?.url,
      release_run_conclusion: assetManifest.release_run?.conclusion,
    },
    screenshot_assets: assets,
    screenshot_dimensions: dimensions,
    pdf_pages: pages,
    pdf_page_size_pts: {
      width: pageWidth,
      height: pageHeight,
    },
    rendered_pages: render.pages.length,
    rendered_dir: path.relative(appRoot, render.renderDir),
  };
  fs.writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(verification, null, 2));
}

main();
