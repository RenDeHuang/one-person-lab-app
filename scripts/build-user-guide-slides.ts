#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  appRoot,
  assetManifestPath,
  assertGuideAssets,
  expandList,
  expandTemplate,
  guideSourcePath,
  loadAssetManifest,
  loadGuide,
  readPdfInfo,
  relativeToApp,
  renderPdfPages,
  run,
  scanTextForSecrets,
  screenshotReleaseTag,
  screenshotSourceVerification,
  slideMarkdownPath,
  slidePdfPath,
  slidePptxPath,
  slideThemePath,
  slideVerificationPath,
  writeJson,
} from './user-guide-data.ts';

const tempDir = path.join(appRoot, 'tmp', 'pdfs', 'macos-app-install-slides');
const marpPackage = process.env.MARP_CLI_PACKAGE || '@marp-team/marp-cli@4.4.0';
const marpThemeName = 'opl-guide';
const guide = loadGuide();
const assetManifest = loadAssetManifest();
const screenshotTag = screenshotReleaseTag(assetManifest);
const totalSlides = guide.steps.length + 2;

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inlineHtml(value: string) {
  const codeSegments: string[] = [];
  const withPlaceholders = escapeHtml(value).replace(/`([^`]+)`/g, (_match, code) => {
    const token = `@@CODE_${codeSegments.length}@@`;
    codeSegments.push(`<code>${code}</code>`);
    return token;
  });
  const linked = withPlaceholders.replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return codeSegments.reduce((text, code, index) => text.replace(`@@CODE_${index}@@`, code), linked);
}

function markdownComment(value: string) {
  return value.replaceAll('-->', '--&gt;');
}

function imagePath(asset: string) {
  return `../assets/${encodeURIComponent(asset)}`;
}

function listHtml(items: string[]) {
  return `<ul>${items.map((item) => `<li>${inlineHtml(expandTemplate(item, guide, assetManifest))}</li>`).join('\n')}</ul>`;
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
}

section code {
  display: inline-block;
  max-width: 100%;
  padding: 1px 6px;
  border-radius: 5px;
  background: #eef2f7;
  color: #182230;
  font-family: Menlo, Consolas, monospace;
  font-size: 0.82em;
  white-space: normal;
  overflow-wrap: anywhere;
}

.brand {
  grid-row: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 17px;
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
  grid-template-rows: auto minmax(0, 1fr) auto;
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
  font-size: 51px;
  line-height: 1.06;
  letter-spacing: 0;
}

.cover-copy .lede {
  margin: 24px 0 0;
  color: var(--opl-muted);
  font-size: 25px;
  line-height: 1.42;
}

.command {
  margin-top: 28px;
  padding: 17px 19px;
  border-radius: 8px;
  background: #111827;
  color: #f8fafc;
  font-family: Menlo, Consolas, monospace;
  font-size: 17px;
  line-height: 1.38;
  overflow-wrap: anywhere;
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
  background: #eef2f7;
}

.checklist {
  margin-top: 18px;
  padding: 18px 22px;
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

.step-title h1 {
  margin: 0;
  color: var(--opl-ink);
  font-size: 35px;
  line-height: 1.16;
  letter-spacing: 0;
}

.step-title {
  grid-row: 2;
  min-width: 0;
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
  padding: 10px;
  border: 1px solid var(--opl-line);
  border-radius: 8px;
  background: #f2f5f9;
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
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  row-gap: 18px;
  background: #f8fafc;
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
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
}

.faq-list,
.notes {
  min-width: 0;
  min-height: 0;
  padding: 24px 26px;
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
  padding: 12px 16px;
  border: 1px solid #f3d08f;
  border-radius: 8px;
  background: var(--opl-warn-soft);
  color: var(--opl-ink);
  font-size: 17px;
  line-height: 1.35;
}
`;
  fs.writeFileSync(slideThemePath, theme, 'utf8');
}

function coverSlide() {
  const checklist = expandList(guide.prepare_checklist.slice(0, 4), guide, assetManifest);
  return `<!-- _class: cover -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<div class="cover-copy">
  <h1>${escapeHtml(guide.title)}</h1>
  <p class="lede">${inlineHtml(guide.cover.description)}</p>
  <div class="command">${inlineHtml(guide.download.stable_install_command)}</div>
  <div class="checklist">${listHtml(checklist)}</div>
</div>

<figure class="cover-shot">
  <img src="${imagePath(guide.cover.image_asset)}" alt="${escapeHtml(guide.cover.description)}" />
</figure>

<div class="footer"><span>中文 1080p VM 截图 · ${escapeHtml(screenshotTag)}</span><span>1 / ${totalSlides}</span></div>

<!--
${markdownComment(`本教程用于 macOS App 首次安装和首启说明。截图来自 ${screenshotTag} 的中文 1080p VM guide artifact 与同一次 VM smoke 的 App CDP 截图。`)}
-->`;
}

function stepSlide(step: (typeof guide.steps)[number], index: number) {
  const slideNumber = index + 2;
  return `<!-- _class: step -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<header class="step-title">
  <h1>${escapeHtml(step.title)}</h1>
  <p>${inlineHtml(expandTemplate(step.subtitle, guide, assetManifest))}</p>
</header>

<main class="step-layout">
  <figure class="shot-frame">
    <img src="${imagePath(step.asset)}" alt="${escapeHtml(step.title)}" />
  </figure>
  <aside class="focus">
    <h2>本页重点</h2>
    ${listHtml(step.callouts)}
  </aside>
</main>

<p class="body-line">${inlineHtml(expandTemplate(step.body, guide, assetManifest))}</p>
<div class="footer"><span class="source-line">截图来自 ${escapeHtml(screenshotTag)}；PNG 保留原始 VM/CDP 尺寸。</span><span>${slideNumber} / ${totalSlides}</span></div>

<!--
${markdownComment(expandTemplate(step.speaker_notes, guide, assetManifest))}
-->`;
}

function finalSlide() {
  return `<!-- _class: final -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<header class="final-title">
  <h1>常见问题与验证来源</h1>
  <p>遇到下载、权限、模块、数据路径问题时，先按界面提示和本页检查。</p>
</header>

<main class="final-grid">
  <div class="faq-list">
    <h2>常见问题</h2>
    ${listHtml(guide.faqs.slice(0, 4))}
  </div>
  <div class="notes">
    <h2>验证来源</h2>
    ${listHtml(guide.verification_callouts)}
  </div>
</main>

<div class="security">${inlineHtml(guide.security_notice)}</div>
<div class="footer"><span>Release、DMG、首启日志和模块状态以 App repo contracts / workflow / VM smoke artifacts 为机器真相。</span><span>${totalSlides} / ${totalSlides}</span></div>

<!--
${markdownComment(expandList(guide.provenance_notes, guide, assetManifest).join(' '))}
-->`;
}

function buildMarpMarkdown() {
  const slides = [coverSlide(), ...guide.steps.map(stepSlide), finalSlide()];
  return `---
marp: true
theme: ${marpThemeName}
size: 16:9
paginate: false
title: ${JSON.stringify(guide.title)}
description: ${JSON.stringify(guide.cover.description)}
author: ${JSON.stringify(guide.owner)}
---

${slides.join('\n\n---\n\n')}
`;
}

function writeMarpSource() {
  fs.mkdirSync(path.dirname(slideMarkdownPath), { recursive: true });
  writeTheme();
  const markdown = buildMarpMarkdown();
  scanTextForSecrets(markdown);
  fs.writeFileSync(slideMarkdownPath, markdown, 'utf8');
}

function marp(args: string[]) {
  return run('npx', ['--yes', marpPackage, ...args]);
}

function buildDeckArtifacts() {
  fs.mkdirSync(path.dirname(slidePdfPath), { recursive: true });
  fs.rmSync(slidePdfPath, { force: true });
  fs.rmSync(slidePptxPath, { force: true });
  const commonArgs = [
    slideMarkdownPath,
    '--theme-set',
    slideThemePath,
    '--allow-local-files',
    '--html',
    '--browser-timeout',
    '90',
  ];
  marp([...commonArgs, '--pdf', '--pdf-outlines', '--output', slidePdfPath]);
  marp([...commonArgs, '--pptx', '--output', slidePptxPath]);
}

function validatePptx() {
  const output = run('officecli', ['view', slidePptxPath, 'issues']).stdout.trim();
  const issueCount = Number(output.match(/Found\s+(\d+)\s+issue\(s\)/i)?.[1] ?? 0);
  if (issueCount > 0) {
    throw new Error(`Marp-generated PPTX has layout issues:\n${output}`);
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
    slidePptxPath,
  ]);
  const roundtripPdfPath = path.join(pptxCheckDir, `${path.basename(slidePptxPath, '.pptx')}.pdf`);
  if (!fs.existsSync(roundtripPdfPath)) {
    throw new Error(`Expected LibreOffice to convert Marp PPTX to PDF at ${roundtripPdfPath}`);
  }
  const roundtripInfo = readPdfInfo(roundtripPdfPath);
  const roundtripPages = Number(roundtripInfo.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  if (roundtripPages !== totalSlides) {
    throw new Error(`Expected Marp PPTX roundtrip PDF to have ${totalSlides} pages, got ${roundtripPages}`);
  }
  return {
    officecli_issues: output,
    roundtrip_pdf: relativeToApp(roundtripPdfPath),
    roundtrip_pages: roundtripPages,
  };
}

function main() {
  const { dimensions, assets } = assertGuideAssets('Slide', guide, assetManifest);
  writeMarpSource();
  const marpVersion = marp(['--version']).stdout.trim();
  buildDeckArtifacts();

  const render = renderPdfPages({ tempDir, pdfPath: slidePdfPath, pagePrefix: 'slide' });
  const info = readPdfInfo(slidePdfPath);
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  const pageSizeMatch = info.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m);
  const pageWidth = Number(pageSizeMatch?.[1] ?? 0);
  const pageHeight = Number(pageSizeMatch?.[2] ?? 0);
  if (pages !== totalSlides) throw new Error(`Expected ${totalSlides} Marp PDF pages, got ${pages}`);
  if (pageWidth <= pageHeight) throw new Error(`Expected landscape Marp PDF, got ${pageWidth}x${pageHeight} pts`);

  const pptxVerification = validatePptx();
  const verification = {
    status: 'macos_app_install_slides_ready',
    generator: 'marp_cli',
    generator_version: marpVersion,
    source_model: 'single_guide_json_to_marp_markdown_and_css_theme',
    download_url: guide.download.latest_release_url,
    screenshot_release_tag: screenshotTag,
    guide_source: relativeToApp(guideSourcePath),
    screenshot_asset_manifest: relativeToApp(assetManifestPath),
    marp_markdown: relativeToApp(slideMarkdownPath),
    marp_theme: relativeToApp(slideThemePath),
    output_pptx: relativeToApp(slidePptxPath),
    output_pdf: relativeToApp(slidePdfPath),
    slide_layout: '16:9',
    slides: totalSlides,
    pdf_pages: pages,
    pdf_page_size_pts: {
      width: pageWidth,
      height: pageHeight,
    },
    screenshot_source: screenshotSourceVerification(assetManifest),
    screenshot_assets: assets,
    screenshot_dimensions: dimensions,
    pptx_layout_issues: pptxVerification.officecli_issues,
    pptx_roundtrip_pdf: pptxVerification.roundtrip_pdf,
    pptx_roundtrip_pages: pptxVerification.roundtrip_pages,
    rendered_pages: render.pages.length,
    rendered_dir: relativeToApp(render.renderDir),
  };
  writeJson(slideVerificationPath, verification);
  console.log(JSON.stringify(verification, null, 2));
}

main();
