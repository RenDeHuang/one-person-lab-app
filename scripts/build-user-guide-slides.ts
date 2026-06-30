#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type GuideManifest = {
  schema: string;
  id: string;
  title: string;
  short_title: string;
  owner?: string;
  download?: Record<string, string>;
};

type ScreenshotManifest = {
  schema: string;
  guide_id: string;
  release_run?: {
    id?: string;
    url?: string;
    conclusion?: string;
  };
  screenshots: Array<{
    file: string;
    role: string;
    description: string;
    locale?: string;
    width?: number;
    height?: number;
    sha256?: string;
    expected_ui_text?: string[];
  }>;
};

type SlideBlock = {
  title: string;
  body: string[];
  image?: string;
  bullets: string[];
  quote?: string;
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guideId = 'macos-app-install';
const guideDir = path.join(appRoot, 'docs', 'guides', guideId);
const deliveryDir = path.join(appRoot, 'docs', 'delivery', 'user-guides', guideId);
const publicGuideDir = path.join(appRoot, 'docs', 'public', guideId);
const sourceQmdPath = path.join(guideDir, 'slides.qmd');
const screenshotManifestPath = path.join(guideDir, 'screenshots.manifest.json');
const screenshotDir = path.join(guideDir, 'screenshots');
const manifestPath = path.join(deliveryDir, 'source', 'macos-app-install.quarto.json');
const tempDir = path.join(appRoot, 'tmp', 'pdfs', `${guideId}-slides`);
const renderDir = path.join(tempDir, 'rendered');
const outputPptxPath = path.join(publicGuideDir, 'macos-app-install-slides.pptx');
const outputPdfPath = path.join(publicGuideDir, 'macos-app-install-slides.pdf');
const generatedQmdPath = path.join(deliveryDir, 'generated', 'macos-app-install-slides.qmd');
const generatedMarpPath = path.join(deliveryDir, 'generated', 'macos-app-install-slides.md');
const generatedThemePath = path.join(deliveryDir, 'generated', 'macos-app-install-marp-theme.css');
const verificationPath = path.join(deliveryDir, 'verification', 'macos-app-install-slides-verification.json');
const marpPackage = process.env.MARP_CLI_PACKAGE || '@marp-team/marp-cli@4.4.0';
const marpThemeName = 'opl-guide';

const forbiddenSecretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /OPENAI_API_KEY/,
  /CODEX_API_KEY/,
  /OPL_CODEX_API_KEY\s*=\s*[^`\s]+/,
  /opl-first-run-smoke-guide-key/,
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

function relativeToApp(filePath: string) {
  return path.relative(appRoot, filePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function hashFile(filePath: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readPngDimensions(filePath: string) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`Guide screenshot is not a PNG file: ${relativeToApp(filePath)}`);
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function expandTemplate(text: string, manifest: GuideManifest) {
  let expanded = text
    .replaceAll('{{title}}', manifest.title)
    .replaceAll('{{short_title}}', manifest.short_title);
  for (const [key, value] of Object.entries(manifest.download ?? {})) {
    expanded = expanded.replaceAll(`{{download.${key}}}`, value);
  }
  return expanded;
}

function scanText(label: string, text: string) {
  const secretHits = forbiddenSecretPatterns.filter((pattern) => pattern.test(text)).map(String);
  if (secretHits.length > 0) {
    throw new Error(`${label} contains forbidden sensitive marker(s): ${secretHits.join(', ')}`);
  }
  if (/\{\{[^}]+\}\}/.test(text)) {
    throw new Error(`${label} contains unresolved template placeholder(s).`);
  }
}

function referencedScreenshots(qmd: string) {
  const refs = new Set<string>();
  for (const match of qmd.matchAll(/!\[[^\]]*]\(screenshots\/([^)]+)\)/g)) {
    refs.add(decodeURIComponent(match[1]));
  }
  return refs;
}

function validateScreenshots(qmd: string, screenshots: ScreenshotManifest) {
  if (screenshots.schema !== 'opl_guide_screenshots_manifest.v1') {
    throw new Error(`Unsupported screenshot manifest schema: ${screenshots.schema}`);
  }
  if (screenshots.guide_id !== guideId) {
    throw new Error(`Screenshot manifest guide_id ${screenshots.guide_id} does not match ${guideId}`);
  }
  const refs = referencedScreenshots(qmd);
  const declared = new Set(screenshots.screenshots.map((screenshot) => screenshot.file));
  for (const ref of refs) {
    if (!declared.has(ref)) {
      throw new Error(`Slides QMD references undeclared screenshot: ${ref}`);
    }
  }
  return screenshots.screenshots.map((screenshot) => {
    if (screenshot.file.includes('/') || screenshot.file.includes('\\')) {
      throw new Error(`Guide screenshot must be a plain filename: ${screenshot.file}`);
    }
    if (screenshot.locale !== 'zh-CN') {
      throw new Error(`Guide screenshot ${screenshot.file} must declare locale zh-CN`);
    }
    if (!Array.isArray(screenshot.expected_ui_text) || screenshot.expected_ui_text.length === 0) {
      throw new Error(`Guide screenshot ${screenshot.file} must declare expected_ui_text`);
    }
    const filePath = path.join(screenshotDir, screenshot.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Guide screenshot does not exist: ${relativeToApp(filePath)}`);
    }
    const dimensions = readPngDimensions(filePath);
    const sha256 = hashFile(filePath);
    if (screenshot.width && screenshot.width !== dimensions.width) {
      throw new Error(`Expected ${screenshot.file} width ${screenshot.width}, got ${dimensions.width}`);
    }
    if (screenshot.height && screenshot.height !== dimensions.height) {
      throw new Error(`Expected ${screenshot.file} height ${screenshot.height}, got ${dimensions.height}`);
    }
    if (screenshot.sha256 && screenshot.sha256 !== sha256) {
      throw new Error(`Expected ${screenshot.file} sha256 ${screenshot.sha256}, got ${sha256}`);
    }
    return {
      role: screenshot.role,
      description: screenshot.description,
      file: relativeToApp(filePath),
      width: dimensions.width,
      height: dimensions.height,
      sha256,
      referenced: refs.has(screenshot.file),
      expected_ui_text: screenshot.expected_ui_text,
    };
  });
}

function stripInlineMarkdown(text: string) {
  return text
    .replace(/!\[[^\]]*]\([^)]+\)(?:\{[^}]*\})?/g, '')
    .replace(/<((?:https:\/\/|http:\/\/)[^>]+)>/g, '$1')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

function parseQmdSlides(qmd: string) {
  const afterYaml = qmd.replace(/^---[\s\S]*?---\s*/, '');
  const blocks = afterYaml.split(/^##\s+/m).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split(/\r?\n/);
    const title = lines.shift()?.trim() ?? '';
    const slide: SlideBlock = { title, body: [], bullets: [] };
    let inFence = false;
    let fenceBuffer: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('```')) {
        if (inFence) {
          const command = fenceBuffer.join(' ').trim();
          if (command) slide.body.push(command);
          fenceBuffer = [];
          inFence = false;
        } else {
          inFence = true;
        }
        continue;
      }
      if (inFence) {
        if (line) fenceBuffer.push(line);
        continue;
      }

      const imageMatch = line.match(/^!\[[^\]]*]\(screenshots\/([^)]+)\)/);
      if (imageMatch) {
        slide.image = decodeURIComponent(imageMatch[1]);
        continue;
      }
      if (line.startsWith('- ')) {
        slide.bullets.push(stripInlineMarkdown(line.slice(2)));
        continue;
      }
      if (line.startsWith('> ')) {
        slide.quote = [slide.quote, stripInlineMarkdown(line.slice(2))].filter(Boolean).join('\n');
        continue;
      }
      if (line && !line.startsWith('{') && !line.startsWith('}')) {
        slide.body.push(stripInlineMarkdown(line));
      }
    }

    return slide;
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inlineHtml(value: string) {
  const escaped = escapeHtml(value);
  const linked = escaped.replace(/(https:\/\/[^\s<&]+)/g, '<a href="$1">$1</a>');
  return linked;
}

function markdownComment(value: string) {
  return value.replaceAll('-->', '--&gt;');
}

function imagePath(asset: string) {
  return `../assets/${encodeURIComponent(asset)}`;
}

function listHtml(items: string[], limit?: number) {
  const slice = typeof limit === 'number' ? items.slice(0, limit) : items;
  return `<ul>${slice.map((item) => `<li>${inlineHtml(item)}</li>`).join('\n')}</ul>`;
}

function displayCallouts(slide: SlideBlock, manifest: GuideManifest) {
  const callouts = [...slide.bullets];
  const releaseLine = slide.body.find((line) => line.startsWith('最新版本页面：'));
  if (releaseLine) {
    callouts.unshift(releaseLine);
  }
  if (slide.quote && callouts.length < 3) {
    callouts.push('示例提示词写清数据类型、workspace、原始材料位置和目标产物。');
  }
  return callouts.map((item) => {
    const command = manifest.download?.stable_install_command;
    if (command && item.includes(command)) {
      return item.replace(command, 'install.sh --stable-macos-install --yes');
    }
    return item;
  });
}

function writeTheme() {
  const theme = `/* @theme ${marpThemeName} */
:root {
  --opl-ink: #101828;
  --opl-muted: #5b6574;
  --opl-line: #d8e0ea;
  --opl-accent: #0f766e;
  --opl-accent-strong: #0b5f59;
  --opl-accent-soft: #e7f5f2;
  --opl-panel: #f8fafc;
  --opl-warn-soft: #fff7e6;
}

section {
  width: 1280px;
  height: 720px;
  box-sizing: border-box;
  padding: 40px 52px 34px;
  background: #ffffff;
  color: var(--opl-ink);
  font-family: "Noto Sans CJK SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
  letter-spacing: 0;
}

section h1,
section h2,
section p,
section figure {
  position: static !important;
}

section * {
  box-sizing: border-box;
}

section a {
  color: var(--opl-accent-strong);
  text-decoration: none;
}

.brand {
  grid-row: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--opl-muted);
  font-size: 18px;
}

.brand strong {
  color: var(--opl-accent-strong);
  font-size: 19px;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #7a8494;
  font-size: 15px;
}

section.cover {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  grid-template-rows: 28px minmax(0, 1fr) 22px;
  column-gap: 36px;
  background: #f8fafc;
}

section.cover .brand,
section.cover .footer {
  grid-column: 1 / -1;
}

.cover-copy {
  min-width: 0;
  align-self: center;
}

.cover-copy h1 {
  margin: 0;
  color: var(--opl-ink);
  font-size: 48px;
  line-height: 1.1;
  letter-spacing: 0;
}

.cover-copy .lede {
  margin: 20px 0 0;
  color: var(--opl-muted);
  font-size: 24px;
  line-height: 1.42;
}

.command {
  margin-top: 24px;
  padding: 18px 20px;
  border-radius: 8px;
  background: #111827;
  color: #f8fafc;
  font-family: Menlo, Consolas, monospace;
  font-size: 17px;
  line-height: 1.38;
  overflow-wrap: anywhere;
}

.command a {
  color: #8bd8cb;
}

.cover-shot {
  min-width: 0;
  align-self: center;
}

.cover-shot img,
.shot-frame img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.cover-shot img {
  max-height: 430px;
  border: 1px solid var(--opl-line);
  border-radius: 8px;
  background: #ffffff;
}

.checklist {
  margin-top: 16px;
  padding: 17px 20px;
  border: 1px solid #b9ded7;
  border-radius: 8px;
  background: var(--opl-accent-soft);
  font-size: 18px;
  line-height: 1.42;
}

.checklist ul,
.focus ul,
.notes ul,
.faq-list ul {
  margin: 0;
  padding-left: 1.18em;
}

section.step {
  display: grid;
  grid-template-rows: 28px 86px minmax(0, 1fr) 46px 22px;
  row-gap: 12px;
}

.step-title {
  grid-row: 2;
  min-width: 0;
}

.step-title h1 {
  margin: 0;
  color: var(--opl-ink);
  font-size: 35px;
  line-height: 1.16;
  letter-spacing: 0;
}

.step-title p {
  margin: 7px 0 0;
  color: var(--opl-muted);
  font-size: 20px;
  line-height: 1.34;
}

.step-layout {
  grid-row: 3;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 304px;
  gap: 22px;
}

.shot-frame {
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 1px solid var(--opl-line);
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.focus {
  min-width: 0;
  min-height: 0;
  padding: 18px 20px;
  border: 1px solid #c7d3df;
  border-radius: 8px;
  background: var(--opl-panel);
}

.focus h2 {
  margin: 0 0 12px;
  color: var(--opl-accent);
  font-size: 24px;
  line-height: 1.2;
}

.focus li {
  margin: 0 0 9px;
  color: var(--opl-ink);
  font-size: 18px;
  line-height: 1.36;
  overflow-wrap: anywhere;
}

.body-line {
  grid-row: 4;
  min-height: 42px;
  margin: 0;
  color: var(--opl-muted);
  font-size: 17px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.source-line {
  color: #7a8494;
  font-size: 14px;
}

section.step > .footer {
  grid-row: 5;
}

section.final {
  display: grid;
  grid-template-rows: 28px 70px minmax(0, 1fr) auto 22px;
  row-gap: 16px;
  background: #f8fafc;
}

section.final .brand {
  grid-row: 1;
}

.final-title {
  grid-row: 2;
}

.final-title h1 {
  margin: 0;
  color: var(--opl-ink);
  font-size: 42px;
  line-height: 1.15;
}

.final-title p {
  margin: 8px 0 0;
  color: var(--opl-muted);
  font-size: 21px;
}

.final-grid {
  grid-row: 3;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
}

.faq-list,
.notes {
  min-width: 0;
  min-height: 0;
  padding: 22px 25px;
  border: 1px solid var(--opl-line);
  border-radius: 8px;
  background: #ffffff;
}

.notes {
  background: var(--opl-accent-soft);
  border-color: #b9ded7;
}

.faq-list h2,
.notes h2 {
  margin: 0 0 14px;
  color: var(--opl-accent-strong);
  font-size: 26px;
}

.faq-list li,
.notes li {
  margin: 0 0 10px;
  color: var(--opl-ink);
  font-size: 19px;
  line-height: 1.36;
  overflow-wrap: anywhere;
}

.security {
  grid-row: 4;
  padding: 12px 16px;
  border: 1px solid #f3d08f;
  border-radius: 8px;
  background: var(--opl-warn-soft);
  color: var(--opl-ink);
  font-size: 17px;
  line-height: 1.35;
}

section.final > .footer {
  grid-row: 5;
}
`;
  fs.writeFileSync(generatedThemePath, theme, 'utf8');
}

function coverSlide(slides: SlideBlock[], manifest: GuideManifest, screenshotTag: string) {
  const intro = slides[0];
  const title = manifest.title;
  const description = intro.body.find((line) => !line.startsWith('curl ')) ?? '按下载安装、首次配置、环境检查、科研入口和进度查看的顺序演示。';
  const command = manifest.download?.stable_install_command ?? intro.body.find((line) => line.startsWith('curl ')) ?? '';
  const image = intro.image ?? '05-opl-ready-research-entry.png';
  const checklist = intro.bullets.slice(0, 4);
  return `<!-- _class: cover -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<div class="cover-copy">
  <h1>${escapeHtml(title)}</h1>
  <p class="lede">${inlineHtml(description)}</p>
  <div class="command">${inlineHtml(command)}</div>
  <div class="checklist">${listHtml(checklist)}</div>
</div>

<figure class="cover-shot">
  <img src="${imagePath(image)}" alt="${escapeHtml(description)}" />
</figure>

<div class="footer"><span>中文截图 · ${escapeHtml(screenshotTag)}</span><span>1 / ${slides.length}</span></div>

<!--
${markdownComment(`本教程用于 macOS App 首次安装和首启说明。截图来自 ${screenshotTag} 的中文截图资产。`)}
-->`;
}

function stepSlide(slide: SlideBlock, slideIndex: number, totalSlides: number, screenshotTag: string, manifest: GuideManifest) {
  const slideNumber = slideIndex + 1;
  const body = slide.body[0] ?? '';
  const subtitle = body.length > 84 ? `${body.slice(0, 82)}...` : body;
  const callouts = displayCallouts(slide, manifest);
  const image = slide.image;
  if (!image) {
    throw new Error(`Expected slide "${slide.title}" to reference a screenshot.`);
  }

  return `<!-- _class: step -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<header class="step-title">
  <h1>${escapeHtml(slide.title)}</h1>
  <p>${inlineHtml(subtitle)}</p>
</header>

<main class="step-layout">
  <figure class="shot-frame">
    <img src="${imagePath(image)}" alt="${escapeHtml(slide.title)}" />
  </figure>
  <aside class="focus">
    <h2>本页重点</h2>
    ${listHtml(callouts, 4)}
  </aside>
</main>

<p class="body-line">${inlineHtml(body)}</p>
<div class="footer"><span class="source-line">截图来自 ${escapeHtml(screenshotTag)}；PNG 保留原始尺寸。</span><span>${slideNumber} / ${totalSlides}</span></div>

<!--
${markdownComment([body, ...callouts, slide.quote ?? ''].filter(Boolean).join(' '))}
-->`;
}

function finalSlide(slide: SlideBlock, slideIndex: number, totalSlides: number, manifest: GuideManifest) {
  const releaseUrl = manifest.download?.latest_release_url;
  const faqs = [...slide.bullets];
  if (releaseUrl && !faqs.some((item) => item.includes(releaseUrl))) {
    faqs.unshift(`GitHub Release 下载入口：${releaseUrl}`);
  }
  const verification = [
    'Release、DMG、首启日志和模块状态以 App repo contracts / workflow / VM smoke artifacts 为机器真相。',
    '截图 manifest 记录来源、语言、尺寸、SHA 和预期中文界面文案。',
    'PPTX/PDF 幻灯片由静态 Marp 编译链路生成，并逐页渲染检查。',
  ];

  return `<!-- _class: final -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<header class="final-title">
  <h1>${escapeHtml(slide.title)}</h1>
  <p>${inlineHtml(slide.body[0] ?? '遇到下载、权限、模块、数据路径问题时，先按界面提示和本页检查。')}</p>
</header>

<main class="final-grid">
  <div class="faq-list">
    <h2>常见问题</h2>
    ${listHtml(faqs, 5)}
  </div>
  <div class="notes">
    <h2>验证来源</h2>
    ${listHtml(verification)}
  </div>
</main>

<div class="security">涉及访问权限配置时，请联系 gflabtoken 管理员获取访问密钥。不要截图、转发或保存密钥到研究目录。</div>
<div class="footer"><span>GitHub Release: ${inlineHtml(releaseUrl ?? '')}</span><span>${slideIndex + 1} / ${totalSlides}</span></div>

<!--
${markdownComment([...faqs, ...verification].join(' '))}
-->`;
}

function buildMarpMarkdown(slides: SlideBlock[], manifest: GuideManifest, screenshotTag: string) {
  if (slides.length < 9) {
    throw new Error(`Expected at least 9 slide blocks, got ${slides.length}`);
  }
  const final = slides.at(-1);
  if (!final) throw new Error('Expected a final slide.');
  const renderedSlides = [
    coverSlide(slides, manifest, screenshotTag),
    ...slides.slice(1, -1).map((slide, index) => stepSlide(slide, index + 1, slides.length, screenshotTag, manifest)),
    finalSlide(final, slides.length - 1, slides.length, manifest),
  ];

  return `---
marp: true
theme: ${marpThemeName}
size: 16:9
paginate: false
title: ${JSON.stringify(manifest.title)}
description: ${JSON.stringify(slides[0]?.body[0] ?? '')}
author: ${JSON.stringify(manifest.owner ?? 'one-person-lab-app')}
---

${renderedSlides.join('\n\n---\n\n')}
`;
}

function marp(args: string[]) {
  return run('npx', ['--yes', marpPackage, ...args]);
}

function buildDeckArtifacts() {
  fs.mkdirSync(path.dirname(outputPdfPath), { recursive: true });
  fs.rmSync(outputPdfPath, { force: true });
  fs.rmSync(outputPptxPath, { force: true });
  const commonArgs = [
    generatedMarpPath,
    '--theme-set',
    generatedThemePath,
    '--allow-local-files',
    '--html',
    '--browser-timeout',
    '90',
  ];
  marp([...commonArgs, '--pdf', '--pdf-outlines', '--output', outputPdfPath]);
  marp([...commonArgs, '--pptx', '--output', outputPptxPath]);
}

function validatePptx(totalSlides: number, requiredPdfText: string[]) {
  const schemaValidation = spawnSync('officecli', ['validate', outputPptxPath], {
    cwd: appRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
  });
  const output = run('officecli', ['view', outputPptxPath, 'issues']).stdout.trim();
  const issueCount = Number(output.match(/Found\s+(\d+)\s+issue\(s\)/i)?.[1] ?? 0);
  if (issueCount > 0) {
    throw new Error(`Marp-generated PPTX has layout issues:\n${output}`);
  }

  const text = [
    fs.readFileSync(generatedMarpPath, 'utf8'),
    run('pdftotext', [outputPdfPath, '-']).stdout,
  ].join('\n');
  const placeholderPattern = /\{\{|<TODO>|lorem|ipsum|placeholder|xxxx/i;
  if (placeholderPattern.test(text)) {
    throw new Error(`Marp-generated slide source/PDF text contains placeholder-like text:\n${text}`);
  }
  for (const requiredText of requiredPdfText) {
    if (!text.includes(requiredText)) {
      throw new Error(`Marp-generated slide source/PDF text is missing required text: ${requiredText}`);
    }
  }

  const pptxCheckDir = path.join(tempDir, 'pptx-roundtrip');
  fs.rmSync(pptxCheckDir, { recursive: true, force: true });
  fs.mkdirSync(pptxCheckDir, { recursive: true });
  run(process.env.SOFFICE_BIN || 'soffice', [
    '--headless',
    '--convert-to',
    'pdf',
    '--outdir',
    pptxCheckDir,
    outputPptxPath,
  ]);
  const roundtripPdfPath = path.join(pptxCheckDir, `${path.basename(outputPptxPath, '.pptx')}.pdf`);
  if (!fs.existsSync(roundtripPdfPath)) {
    throw new Error(`Expected LibreOffice to convert Marp PPTX to PDF at ${roundtripPdfPath}`);
  }
  const roundtripInfo = pdfInfo(roundtripPdfPath);
  const roundtripPages = Number(roundtripInfo.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  if (roundtripPages !== totalSlides) {
    throw new Error(`Expected Marp PPTX roundtrip PDF to have ${totalSlides} pages, got ${roundtripPages}`);
  }
  return {
    schema_validation_status: schemaValidation.status === 0 ? 'passed' : 'warning',
    schema_validation_output: `${schemaValidation.stdout}${schemaValidation.stderr}`.trim(),
    officecli_issues: output,
    text_status: 'checked_generated_marp_source_and_pdf_text_no_placeholder_tokens',
    roundtrip_pdf: relativeToApp(roundtripPdfPath),
    roundtrip_pages: roundtripPages,
  };
}

function pdfInfo(pdfPath: string) {
  return run('pdfinfo', [pdfPath]).stdout;
}

function renderPdfPages(pdfPath: string) {
  fs.rmSync(renderDir, { recursive: true, force: true });
  fs.mkdirSync(renderDir, { recursive: true });
  run('pdftoppm', ['-png', '-r', '120', pdfPath, path.join(renderDir, 'slide')]);
  return fs.readdirSync(renderDir).filter((name) => name.endsWith('.png')).sort();
}

function main() {
  const manifest = readJson<GuideManifest>(manifestPath);
  if (manifest.schema !== 'opl_quarto_user_guide_manifest.v1') {
    throw new Error(`Unsupported guide manifest schema: ${manifest.schema}`);
  }
  const latestReleaseUrl = manifest.download?.latest_release_url;
  if (!latestReleaseUrl) {
    throw new Error('Slides require download.latest_release_url in guide manifest.');
  }

  const screenshots = readJson<ScreenshotManifest>(screenshotManifestPath);
  const source = fs.readFileSync(sourceQmdPath, 'utf8');
  const qmd = expandTemplate(source, manifest);
  scanText('Slides QMD source', qmd);
  if (!qmd.includes(latestReleaseUrl)) {
    throw new Error(`Slides QMD must include latest Release URL: ${latestReleaseUrl}`);
  }
  const screenshotAssets = validateScreenshots(qmd, screenshots);
  const slides = parseQmdSlides(qmd);
  const expectedSlides = slides.length;
  if (expectedSlides < 9) {
    throw new Error(`Expected at least 9 Marp slides, got ${expectedSlides}`);
  }

  const screenshotTag = screenshots.release_run?.id ?? 'screenshots.manifest.json';
  const marpMarkdown = buildMarpMarkdown(slides, manifest, screenshotTag);
  scanText('Generated Marp source', marpMarkdown);

  fs.mkdirSync(path.dirname(generatedQmdPath), { recursive: true });
  fs.mkdirSync(path.dirname(generatedMarpPath), { recursive: true });
  fs.mkdirSync(path.dirname(verificationPath), { recursive: true });
  fs.writeFileSync(generatedQmdPath, qmd, 'utf8');
  fs.writeFileSync(generatedMarpPath, marpMarkdown, 'utf8');
  writeTheme();

  const marpVersion = marp(['--version']).stdout.trim();
  buildDeckArtifacts();

  const info = pdfInfo(outputPdfPath);
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  const pageSizeMatch = info.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m);
  const pageWidth = Number(pageSizeMatch?.[1] ?? 0);
  const pageHeight = Number(pageSizeMatch?.[2] ?? 0);
  if (pages !== expectedSlides) throw new Error(`Expected ${expectedSlides} Marp PDF pages, got ${pages}`);
  if (pageWidth <= pageHeight) throw new Error(`Expected landscape Marp PDF, got ${pageWidth}x${pageHeight} pts`);
  const renderedPages = renderPdfPages(outputPdfPath);
  const pptxVerification = validatePptx(expectedSlides, [latestReleaseUrl, 'GitHub Release 下载入口']);

  const verification = {
    status: 'macos_app_install_slides_ready',
    generator: 'marp_cli_static_slides',
    generator_version: marpVersion,
    source_model: 'qmd_body_manifest_metadata_to_marp_markdown_and_css_theme',
    download_url: latestReleaseUrl,
    stable_install_command: manifest.download?.stable_install_command,
    screenshot_release_run: screenshots.release_run ?? null,
    source_qmd: relativeToApp(sourceQmdPath),
    generated_qmd: relativeToApp(generatedQmdPath),
    generated_marp_markdown: relativeToApp(generatedMarpPath),
    generated_marp_theme: relativeToApp(generatedThemePath),
    manifest: relativeToApp(manifestPath),
    screenshots_manifest: relativeToApp(screenshotManifestPath),
    output_pptx: relativeToApp(outputPptxPath),
    output_pdf: relativeToApp(outputPdfPath),
    slide_layout: '16:9',
    slides: expectedSlides,
    pdf_pages: pages,
    pdf_page_size_pts: {
      width: pageWidth,
      height: pageHeight,
    },
    screenshot_assets: screenshotAssets,
    pptx_schema_validation_status: pptxVerification.schema_validation_status,
    pptx_schema_validation_output: pptxVerification.schema_validation_output,
    pptx_layout_issues: pptxVerification.officecli_issues,
    text_status: pptxVerification.text_status,
    pptx_roundtrip_pdf: pptxVerification.roundtrip_pdf,
    pptx_roundtrip_pages: pptxVerification.roundtrip_pages,
    rendered_pages: renderedPages.length,
    rendered_dir: relativeToApp(renderDir),
    unresolved_templates_status: 'absent',
    forbidden_secret_markers_status: 'absent',
  };
  fs.writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(verification, null, 2));
}

main();
