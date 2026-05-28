#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type Step = {
  title: string;
  subtitle: string;
  asset: string;
  callouts: string[];
  notes: string;
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guideDir = path.join(appRoot, 'docs', 'user-guides');
const assetDir = path.join(guideDir, 'assets');
const pptxPath = path.join(guideDir, 'macos-app-install-slides.pptx');
const slidePdfPath = path.join(guideDir, 'macos-app-install-slides.pdf');
const verificationPath = path.join(guideDir, 'macos-app-install-slides-verification.json');
const tempDir = path.join(appRoot, 'tmp', 'pdfs', 'macos-app-install-slides');

const latestReleaseUrl = 'https://github.com/gaofeng21cn/one-person-lab-app/releases/latest';
const screenshotReleaseTag = process.env.OPL_APP_GUIDE_SCREENSHOT_RELEASE_TAG || 'v26.5.28';
const titleFont = 'Arial';
const cjkFont = 'PingFang SC';
const bodyFont = 'Arial';
const primary = '111827';
const muted = '5B6574';
const accent = '0F766E';
const softAccent = 'E6F4F1';
const panelFill = 'F8FAFC';
const border = 'D6DEE8';

const steps: Step[] = [
  {
    title: '1. 下载 One Person Lab',
    subtitle: '从 App repo 的最新 Release 下载 macOS Apple Silicon DMG。',
    asset: '01-download-release.png',
    callouts: [
      '从 GitHub Releases latest 页面下载。',
      '首次安装建议使用 Full 版 DMG。',
      '标准 DMG 适合已安装用户和后续更新。',
    ],
    notes: '打开 One Person Lab App 最新 Release 页面。首次安装或干净机器建议选择 Full 版 DMG；标准 DMG 体积更小，用于已经安装过的用户和后续自动更新。',
  },
  {
    title: '2. 安装 App',
    subtitle: '打开 DMG，把 One Person Lab 拖入 Applications。',
    asset: '02-install-dmg.png',
    callouts: [
      '安装完成后从 Applications 启动。',
      '不要长期在 DMG 挂载窗口中运行 App。',
    ],
    notes: '打开下载的 DMG，将 One Person Lab.app 拖入 Applications。首次打开如出现 macOS 安全提示，按系统提示确认。',
  },
  {
    title: '3. 配置 Codex 权限',
    subtitle: '首次启动如果要求 API Key 或 Codex 权限，联系 gflabtoken 管理员开通。',
    asset: '03-codex-config-needed.png',
    callouts: [
      '管理员开通后，按给出的方式完成配置。',
      '不要截图、转发或保存密钥到研究目录。',
    ],
    notes: '涉及 Codex API Key 或 Codex 权限配置时，请联系 gflabtoken 管理员开通。不要自行购买、复制来源不明的密钥，或把密钥写入研究数据目录。',
  },
  {
    title: '4. 等待首次环境检查',
    subtitle: '首屏只显示准备状态、三步进度、下一步和进入 OPL 的主按钮。',
    asset: '04-first-run-checking.png',
    callouts: [
      '先检查工作目录、Codex CLI 和 Codex 权限。',
      '技术 phase、刷新和原始错误默认收在技术细节里。',
      '遇到阻塞时先阅读界面提示。',
    ],
    notes: 'OPL 会先检查开始使用所需的关键项：工作目录、Codex CLI 和 Codex 权限。首屏只显示“正在准备 / 可以开始 / 需要处理”的简短状态、三步准备进度、下一步，以及进入 OPL 的主按钮。模块、skills、运行底座和本机工具属于后台维护，技术细节默认折叠。',
  },
  {
    title: '5. 进入科研入口',
    subtitle: '准备完成后，在主界面选择科研入口。',
    asset: '05-opl-ready-research-entry.png',
    callouts: [
      '通过 Research Foundry / Med Auto Science 进入 MAS。',
      '用户不需要另行获取 MAS 分发资产。',
    ],
    notes: '准备完成后，在主界面选择科研入口，进入 Research Foundry / Med Auto Science 工作流。MAS 通过 OPL 内的入口使用。',
  },
  {
    title: '6. 准备研究数据目录',
    subtitle: '按病种或稳定研究主题建立本地 workspace。',
    asset: '06-research-data-folder.png',
    callouts: [
      '原始或脱敏材料集中放入 raw_data/。',
      '患者数据需先脱敏，并遵守机构要求。',
    ],
    notes: '建议按一个病种或稳定研究主题新建本地 workspace，把原始或脱敏材料集中放入 raw_data/。新手首启阶段不需要手工建立 MAS 内部目录结构。',
  },
  {
    title: '7. 发起首次科研任务',
    subtitle: '用自然语言描述数据、workspace 和目标，让 MAS 先判断下一步。',
    asset: '07-first-research-entry.png',
    callouts: [
      '写清数据类型、专病 workspace、目标产物。',
      '让 MAS 先判断研究方向和证据缺口。',
    ],
    notes: '示例提示词：我有一批肺结节随访数据，专病 workspace 在“肺结节真实世界研究”，原始材料在 raw_data/，请先判断最值得推进的研究问题，并说明还缺哪些证据，目标是形成一篇可投稿论文。',
  },
  {
    title: '8. 查看进度与结果',
    subtitle: '任务启动后，重点查看当前阶段、阻塞项、下一步和产物位置。',
    asset: '08-opl-runtime-status.png',
    callouts: [
      '看到人工确认项时，由研究者或 PI 判断。',
      '投稿前科学判断、伦理合规和署名仍由团队负责。',
    ],
    notes: '任务启动后，重点查看当前阶段、阻塞项、下一步和产物位置。投稿前最终科学判断、伦理合规和署名安排仍由研究团队负责。',
  },
];

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

function assertAssets() {
  const dimensions: Record<string, { width: number; height: number }> = {};
  for (const step of steps) {
    const filePath = path.join(assetDir, step.asset);
    if (!fs.existsSync(filePath)) throw new Error(`Missing slide screenshot asset: ${step.asset}`);
    const info = imageInfo(filePath);
    if (info.width !== 3840 || info.height !== 2160) {
      throw new Error(`Expected ${step.asset} to be 3840x2160, got ${info.width}x${info.height}`);
    }
    dimensions[step.asset] = info;
  }
  return dimensions;
}

function addSlide(background = 'FFFFFF') {
  run('officecli', ['add', pptxPath, '/', '--type', 'slide', '--prop', 'layout=blank', '--prop', `background=${background}`]);
}

function prop(key: string, value: string | number | boolean) {
  return ['--prop', `${key}=${value}`];
}

function addShape(slide: number, props: Record<string, string | number | boolean>) {
  const args = ['add', pptxPath, `/slide[${slide}]`, '--type', 'shape'];
  for (const [key, value] of Object.entries(props)) args.push(...prop(key, value));
  run('officecli', args);
}

function addPicture(slide: number, props: Record<string, string | number | boolean>) {
  const args = ['add', pptxPath, `/slide[${slide}]`, '--type', 'picture'];
  for (const [key, value] of Object.entries(props)) args.push(...prop(key, value));
  run('officecli', args);
}

function addNotes(slide: number, text: string) {
  run('officecli', ['add', pptxPath, `/slide[${slide}]`, '--type', 'notes', '--prop', `text=${text}`]);
}

function addTitle(slide: number, title: string, subtitle?: string) {
  addShape(slide, {
    text: title,
    x: '1.25cm',
    y: '0.62cm',
    width: '30.8cm',
    height: '1.25cm',
    font: titleFont,
    'font.ea': cjkFont,
    size: 34,
    bold: true,
    color: primary,
    fill: 'none',
    margin: '0cm',
  });
  if (subtitle) {
    addShape(slide, {
      text: subtitle,
      x: '1.28cm',
      y: '1.95cm',
      width: '30.2cm',
      height: '0.9cm',
      font: bodyFont,
      'font.ea': cjkFont,
      size: 20,
      color: muted,
      fill: 'none',
      margin: '0cm',
    });
  }
}

function addFooter(slide: number, indexText: string) {
  addShape(slide, {
    text: indexText,
    x: '30.45cm',
    y: '17.9cm',
    width: '2.1cm',
    height: '0.55cm',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 11,
    color: '7A8494',
    fill: 'none',
    align: 'right',
    margin: '0cm',
  });
}

function addCalloutPanel(slide: number, callouts: string[]) {
  addShape(slide, {
    text: '本页重点',
    x: '25.9cm',
    y: '3.2cm',
    width: '6.4cm',
    height: '0.75cm',
    font: titleFont,
    'font.ea': cjkFont,
    size: 18,
    bold: true,
    color: accent,
    fill: 'none',
    margin: '0cm',
  });
  addShape(slide, {
    text: callouts.map((item) => `• ${item}`).join('\n'),
    x: '25.75cm',
    y: '4.18cm',
    width: '6.72cm',
    height: '8.1cm',
    geometry: 'roundRect',
    fill: panelFill,
    line: border,
    lineWidth: '1pt',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 17,
    color: primary,
    lineSpacing: '1.12x',
    margin: '0.35cm',
  });
}

function buildCoverSlide() {
  addSlide('F8FAFC');
  addShape(1, {
    text: 'OPL + MAS\n新手首次启动图文教程',
    x: '1.35cm',
    y: '2.25cm',
    width: '14.2cm',
    height: '4.35cm',
    font: titleFont,
    'font.ea': cjkFont,
    size: 38,
    bold: true,
    color: primary,
    fill: 'none',
    margin: '0cm',
  });
  addShape(1, {
    text: '面向医生、PI、课题负责人。按首次安装、配置、进入科研入口、发起任务和查看进度的顺序演示。',
    x: '1.4cm',
    y: '6.85cm',
    width: '13.5cm',
    height: '2.75cm',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 22,
    color: muted,
    fill: 'none',
    lineSpacing: '1.08x',
    margin: '0cm',
  });
  addShape(1, {
    text: `下载最新版本\n${latestReleaseUrl}`,
    x: '1.45cm',
    y: '10.85cm',
    width: '13.3cm',
    height: '2.8cm',
    geometry: 'roundRect',
    fill: softAccent,
    line: accent,
    lineWidth: '1pt',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 18,
    color: primary,
    margin: '0.35cm',
  });
  addPicture(1, {
    src: path.join(assetDir, '05-opl-ready-research-entry.png'),
    x: '16.1cm',
    y: '2.0cm',
    width: '16.5cm',
    height: '9.28cm',
    alt: 'One Person Lab 首次启动后的科研入口截图',
  });
  addShape(1, {
    text: '中文 VM 截图 · 1920×1080 逻辑桌面 · Retina 3840×2160',
    x: '16.1cm',
    y: '11.65cm',
    width: '16.45cm',
    height: '0.8cm',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 16,
    color: muted,
    fill: 'none',
    align: 'center',
    margin: '0cm',
  });
  addNotes(1, '本教程用于 macOS App 首次安装和首启说明。截图来自中文 macOS VM，逻辑桌面 1920x1080，Retina 输出 3840x2160。');
  addFooter(1, '1 / 10');
}

function buildStepSlide(step: Step, index: number) {
  const slide = index + 2;
  addSlide('FFFFFF');
  addTitle(slide, step.title, step.subtitle);
  addPicture(slide, {
    src: path.join(assetDir, step.asset),
    x: '1.25cm',
    y: '3.15cm',
    width: '23.65cm',
    height: '13.3cm',
    alt: step.title,
  });
  addCalloutPanel(slide, step.callouts);
  addNotes(slide, step.notes);
  addFooter(slide, `${slide} / 10`);
}

function buildFinalSlide() {
  addSlide('FFFFFF');
  addTitle(10, '常见问题与验证来源', '遇到下载、权限、模块、数据路径问题时，先按界面提示和本页检查。');

  const left = [
    '下载失败：换网络后重试，或确认 GitHub Release 可访问。',
    '打不开 App：确认已拖入 Applications，并按 macOS 安全提示允许打开。',
    'Codex 未配置：联系 gflabtoken 管理员开通。',
    '模块未就绪：在 App 的环境管理中重新检查。',
  ];
  const right = [
    '截图来自中文 macOS VM。',
    '逻辑桌面 1920×1080，Retina 输出 3840×2160。',
    '真实 DMG 安装到 /Applications/One Person Lab.app。',
    '标准版验证 GUID 输入页，Full 版额外验证 Codex 向导。',
  ];

  addShape(10, {
    text: '常见问题',
    x: '1.3cm',
    y: '3.25cm',
    width: '14.7cm',
    height: '0.95cm',
    font: titleFont,
    'font.ea': cjkFont,
    size: 24,
    bold: true,
    color: accent,
    fill: 'none',
    margin: '0cm',
  });
  addShape(10, {
    text: left.map((item) => `• ${item}`).join('\n'),
    x: '1.25cm',
    y: '4.55cm',
    width: '14.8cm',
    height: '7.7cm',
    geometry: 'roundRect',
    fill: panelFill,
    line: border,
    lineWidth: '1pt',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 19,
    color: primary,
    lineSpacing: '1.15x',
    margin: '0.42cm',
  });
  addShape(10, {
    text: '验证来源',
    x: '17.3cm',
    y: '3.25cm',
    width: '14.7cm',
    height: '0.95cm',
    font: titleFont,
    'font.ea': cjkFont,
    size: 24,
    bold: true,
    color: accent,
    fill: 'none',
    margin: '0cm',
  });
  addShape(10, {
    text: right.map((item) => `• ${item}`).join('\n'),
    x: '17.25cm',
    y: '4.55cm',
    width: '14.8cm',
    height: '7.7cm',
    geometry: 'roundRect',
    fill: softAccent,
    line: accent,
    lineWidth: '1pt',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 19,
    color: primary,
    lineSpacing: '1.15x',
    margin: '0.42cm',
  });
  addPicture(10, {
    src: path.join(assetDir, '08-opl-runtime-status.png'),
    x: '9.0cm',
    y: '13.05cm',
    width: '15.8cm',
    height: '4.45cm',
    cropTop: 18,
    cropBottom: 20,
    cropLeft: 5,
    cropRight: 5,
    alt: 'OPL 运行状态截图裁切预览',
  });
  addNotes(10, '本页用于快速排查首次安装和首启问题。Release、DMG、首启日志和模块状态以 App repo contracts、workflow、VM smoke artifacts 为机器真相。');
  addFooter(10, '10 / 10');
}

function buildPptx() {
  fs.rmSync(pptxPath, { force: true });
  fs.rmSync(slidePdfPath, { force: true });
  run('officecli', ['create', pptxPath, '--force']);
  run('officecli', ['set', pptxPath, '/', '--prop', 'title=OPL + MAS 新手首次启动图文教程', '--prop', 'author=one-person-lab-app', '--prop', 'subject=macOS App first-run slide guide']);
  buildCoverSlide();
  steps.forEach(buildStepSlide);
  buildFinalSlide();
  run('officecli', ['close', pptxPath]);
  run('officecli', ['validate', pptxPath]);
}

function exportSlidePdf() {
  const soffice = process.env.SOFFICE_BIN || 'soffice';
  const generatedPdfPath = path.join(guideDir, `${path.basename(pptxPath, '.pptx')}.pdf`);
  fs.rmSync(generatedPdfPath, { force: true });
  fs.rmSync(slidePdfPath, { force: true });
  run(soffice, [
    '--headless',
    '--convert-to',
    'pdf',
    '--outdir',
    guideDir,
    pptxPath,
  ]);
  if (!fs.existsSync(generatedPdfPath)) throw new Error(`Expected LibreOffice PDF output at ${generatedPdfPath}`);
  fs.renameSync(generatedPdfPath, slidePdfPath);
}

function renderPdf() {
  const renderDir = path.join(tempDir, 'rendered');
  fs.rmSync(renderDir, { recursive: true, force: true });
  fs.mkdirSync(renderDir, { recursive: true });
  run('pdftoppm', ['-png', '-r', '120', slidePdfPath, path.join(renderDir, 'slide')]);
  const pages = fs.readdirSync(renderDir).filter((name) => name.endsWith('.png')).sort();
  return { renderDir, pages };
}

function pdfInfo() {
  return run('pdfinfo', [slidePdfPath]).stdout;
}

function pptxStats() {
  return run('officecli', ['view', pptxPath, 'stats']).stdout;
}

function main() {
  const dimensions = assertAssets();
  buildPptx();
  exportSlidePdf();
  const render = renderPdf();
  const info = pdfInfo();
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  const pageSizeMatch = info.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m);
  const pageWidth = Number(pageSizeMatch?.[1] ?? 0);
  const pageHeight = Number(pageSizeMatch?.[2] ?? 0);
  if (pages !== 10) throw new Error(`Expected 10 slide PDF pages, got ${pages}`);
  if (pageWidth <= pageHeight) throw new Error(`Expected landscape slide PDF, got ${pageWidth}x${pageHeight} pts`);

  const stats = pptxStats();
  const slideMatch = stats.match(/Slides:\s+(\d+)/i) ?? stats.match(/totalSlides:\s+(\d+)/i);
  const slides = Number(slideMatch?.[1] ?? 10);

  const verification = {
    status: 'macos_app_install_slides_ready',
    download_url: latestReleaseUrl,
    screenshot_release_tag: screenshotReleaseTag,
    output_pptx: path.relative(appRoot, pptxPath),
    output_pdf: path.relative(appRoot, slidePdfPath),
    slide_layout: '16:9',
    slides,
    pdf_pages: pages,
    pdf_page_size_pts: {
      width: pageWidth,
      height: pageHeight,
    },
    typography: {
      title_pt: 34,
      body_pt: '17-22',
      cover_title_pt: 38,
    },
    screenshot_source: {
      vm_type: 'Tart',
      macos_language: 'zh-Hans',
      macos_locale: 'zh_CN',
      logical_resolution: '1920x1080',
      retina_pixels: '3840x2160',
      smoke_summary: 'tmp/vm-smoke/opl-first-run-tart-zh1080-20260515-230311/tart-smoke-summary.json',
    },
    screenshot_dimensions: dimensions,
    rendered_pages: render.pages.length,
    rendered_dir: path.relative(appRoot, render.renderDir),
  };
  fs.writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(verification, null, 2));
}

main();
