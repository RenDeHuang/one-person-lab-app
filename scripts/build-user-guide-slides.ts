#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import type { GuideStep } from './user-guide-data.ts';
import {
  appRoot,
  assetDir,
  assetManifestPath,
  assertGuideAssets,
  expandList,
  expandTemplate,
  guideDir,
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
  slidePdfPath,
  slidePptxPath,
  slideVerificationPath,
  writeJson,
} from './user-guide-data.ts';

const tempDir = path.join(appRoot, 'tmp', 'pdfs', 'macos-app-install-slides');

const guide = loadGuide();
const assetManifest = loadAssetManifest();
const screenshotTag = screenshotReleaseTag(assetManifest);
const titleFont = 'Noto Sans CJK SC';
const cjkFont = 'Noto Sans CJK SC';
const bodyFont = 'Noto Sans CJK SC';
const monoFont = 'Menlo';
const primary = '111827';
const muted = '5B6574';
const accent = '0F766E';
const accentStrong = '0B5F59';
const softAccent = 'E6F4F1';
const panelFill = 'F8FAFC';
const border = 'D6DEE8';
const warnSoft = 'FFF7E6';
const totalSlides = guide.steps.length + 2;

function addSlide(background = 'FFFFFF') {
  run('officecli', ['add', slidePptxPath, '/', '--type', 'slide', '--prop', 'layout=blank', '--prop', `background=${background}`]);
}

function prop(key: string, value: string | number | boolean) {
  return ['--prop', `${key}=${value}`];
}

function addShape(slide: number, props: Record<string, string | number | boolean>) {
  const args = ['add', slidePptxPath, `/slide[${slide}]`, '--type', 'shape'];
  for (const [key, value] of Object.entries(props)) args.push(...prop(key, value));
  run('officecli', args);
}

function addPicture(slide: number, props: Record<string, string | number | boolean>) {
  const args = ['add', slidePptxPath, `/slide[${slide}]`, '--type', 'picture'];
  for (const [key, value] of Object.entries(props)) args.push(...prop(key, value));
  run('officecli', args);
}

function addNotes(slide: number, text: string) {
  run('officecli', ['add', slidePptxPath, `/slide[${slide}]`, '--type', 'notes', '--prop', `text=${text}`]);
}

function addTitle(slide: number, title: string, subtitle?: string) {
  addShape(slide, {
    text: title,
    x: '1.25cm',
    y: '1.35cm',
    width: '30.8cm',
    height: '1.08cm',
    font: titleFont,
    'font.ea': cjkFont,
    size: 31,
    bold: true,
    color: primary,
    fill: 'none',
    margin: '0cm',
  });
  if (subtitle) {
    addShape(slide, {
      text: expandTemplate(subtitle, guide, assetManifest),
      x: '1.28cm',
      y: '2.55cm',
      width: '30.2cm',
      height: '1.42cm',
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

function plainGuideText(text: string) {
  return expandTemplate(text, guide, assetManifest)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function addBrandHeader(slide: number, eyebrow = 'macOS 首次安装与首启') {
  addShape(slide, {
    text: 'One Person Lab App',
    x: '1.25cm',
    y: '0.62cm',
    width: '8.8cm',
    height: '0.55cm',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 13,
    bold: true,
    color: accentStrong,
    fill: 'none',
    margin: '0cm',
  });
  addShape(slide, {
    text: eyebrow,
    x: '10.15cm',
    y: '0.62cm',
    width: '11.8cm',
    height: '0.55cm',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 12,
    color: muted,
    fill: 'none',
    margin: '0cm',
  });
}

function addCalloutPanel(slide: number, callouts: string[]) {
  addShape(slide, {
    text: '本页重点',
    x: '25.95cm',
    y: '3.65cm',
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
    text: expandList(callouts, guide, assetManifest).map((item) => `• ${plainGuideText(item)}`).join('\n'),
    x: '25.65cm',
    y: '4.6cm',
    width: '6.72cm',
    height: '9.05cm',
    geometry: 'roundRect',
    fill: panelFill,
    line: border,
    lineWidth: '1pt',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 14.2,
    color: primary,
    lineSpacing: '1.05x',
    margin: '0.35cm',
  });
  addShape(slide, {
    text: '截图来自 v26.6.5 中文 1080p VM 验证。',
    x: '25.65cm',
    y: '14.05cm',
    width: '6.72cm',
    height: '1.0cm',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 11,
    color: muted,
    fill: 'none',
    margin: '0cm',
  });
}

function buildCoverSlide() {
  addSlide(panelFill);
  addBrandHeader(1);
  addShape(1, {
    text: guide.title.replace('App ', 'App\n'),
    x: '1.25cm',
    y: '2.0cm',
    width: '14.9cm',
    height: '2.75cm',
    font: titleFont,
    'font.ea': cjkFont,
    size: 34,
    bold: true,
    color: primary,
    fill: 'none',
    lineSpacing: '1.02x',
    margin: '0cm',
  });
  addShape(1, {
    text: guide.cover.description,
    x: '1.25cm',
    y: '4.95cm',
    width: '14.7cm',
    height: '1.6cm',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 20,
    color: muted,
    fill: 'none',
    lineSpacing: '1.08x',
    margin: '0cm',
  });
  addShape(1, {
    text: `稳定版安装命令\n${guide.download.stable_install_command}`,
    x: '1.25cm',
    y: '7.25cm',
    width: '14.7cm',
    height: '3.0cm',
    geometry: 'roundRect',
    fill: primary,
    line: primary,
    lineWidth: '1pt',
    font: monoFont,
    'font.ea': cjkFont,
    size: 12.5,
    color: 'FFFFFF',
    lineSpacing: '1.05x',
    margin: '0.35cm',
  });
  addShape(1, {
    text: `下载最新版本：${guide.download.latest_release_url}`,
    x: '1.25cm',
    y: '10.75cm',
    width: '14.7cm',
    height: '1.05cm',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 14,
    color: muted,
    fill: 'none',
    margin: '0cm',
  });
  addPicture(1, {
    src: path.join(assetDir, guide.cover.image_asset),
    x: '16.45cm',
    y: '2.1cm',
    width: '16.05cm',
    height: '9.55cm',
    alt: 'One Person Lab 首次启动后的科研入口截图',
  });
  addShape(1, {
    text: `中文 1080p VM 截图 · ${screenshotTag} · 同源生成 HTML / PDF / PPTX`,
    x: '16.45cm',
    y: '12.05cm',
    width: '16.05cm',
    height: '0.7cm',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 12.5,
    color: muted,
    fill: 'none',
    align: 'center',
    margin: '0cm',
  });
  addShape(1, {
    text: expandList(guide.prepare_checklist.slice(0, 4), guide, assetManifest).map((item) => `• ${plainGuideText(item)}`).join('\n'),
    x: '1.25cm',
    y: '13.45cm',
    width: '31.25cm',
    height: '3.6cm',
    geometry: 'roundRect',
    fill: softAccent,
    line: 'B9DED7',
    lineWidth: '1pt',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 15.5,
    color: primary,
    lineSpacing: '1.1x',
    margin: '0.35cm',
  });
  addNotes(1, `本教程用于 macOS App 首次安装和首启说明。截图来自 ${screenshotTag} 的中文 1080p VM guide artifact 与同一次 VM smoke 的 App CDP 截图。`);
  addFooter(1, `1 / ${totalSlides}`);
}

function buildStepSlide(step: GuideStep, index: number) {
  const slide = index + 2;
  addSlide('FFFFFF');
  addBrandHeader(slide);
  addTitle(slide, step.title, step.subtitle);
  addPicture(slide, {
    src: path.join(assetDir, step.asset),
    x: '1.25cm',
    y: '4.15cm',
    width: '22.85cm',
    height: '12.05cm',
    alt: step.title,
  });
  addShape(slide, {
    text: plainGuideText(step.body),
    x: '1.25cm',
    y: '16.55cm',
    width: '22.85cm',
    height: '1.1cm',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 13,
    color: muted,
    fill: 'none',
    margin: '0cm',
  });
  addCalloutPanel(slide, step.callouts);
  addNotes(slide, expandTemplate(step.speaker_notes, guide, assetManifest));
  addFooter(slide, `${slide} / ${totalSlides}`);
}

function buildFinalSlide() {
  const slide = totalSlides;
  addSlide(panelFill);
  addBrandHeader(slide);
  addTitle(slide, '常见问题与验证来源', '遇到下载、权限、模块、数据路径问题时，先按界面提示和本页检查。');

  addShape(slide, {
    text: '常见问题',
    x: '1.3cm',
    y: '4.1cm',
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
  addShape(slide, {
    text: expandList(guide.faqs.slice(0, 4), guide, assetManifest).map((item) => `• ${plainGuideText(item)}`).join('\n'),
    x: '1.25cm',
    y: '5.25cm',
    width: '14.8cm',
    height: '10.75cm',
    geometry: 'roundRect',
    fill: panelFill,
    line: border,
    lineWidth: '1pt',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 16.3,
    color: primary,
    lineSpacing: '1.1x',
    margin: '0.42cm',
  });
  addShape(slide, {
    text: '验证来源',
    x: '17.3cm',
    y: '4.1cm',
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
  addShape(slide, {
    text: expandList(guide.verification_callouts, guide, assetManifest).map((item) => `• ${plainGuideText(item)}`).join('\n'),
    x: '17.25cm',
    y: '5.25cm',
    width: '14.8cm',
    height: '10.75cm',
    geometry: 'roundRect',
    fill: softAccent,
    line: accent,
    lineWidth: '1pt',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 16.8,
    color: primary,
    lineSpacing: '1.1x',
    margin: '0.42cm',
  });
  addShape(slide, {
    text: guide.security_notice,
    x: '1.25cm',
    y: '16.65cm',
    width: '30.8cm',
    height: '0.9cm',
    geometry: 'roundRect',
    fill: warnSoft,
    line: 'F3D08F',
    lineWidth: '1pt',
    font: bodyFont,
    'font.ea': cjkFont,
    size: 13,
    color: primary,
    margin: '0.22cm',
  });
  addNotes(slide, expandList(guide.provenance_notes, guide, assetManifest).join(' '));
  addFooter(slide, `${slide} / ${totalSlides}`);
}

function buildPptx() {
  const slideText = [
    guide.title,
    guide.cover.description,
    ...guide.steps.flatMap((step) => [step.title, step.subtitle, step.body, ...step.callouts, step.speaker_notes, ...step.notes]),
    ...guide.faqs,
    ...guide.provenance_notes,
  ].map((text) => expandTemplate(text, guide, assetManifest)).join('\n');
  scanTextForSecrets(slideText);

  fs.rmSync(slidePptxPath, { force: true });
  fs.rmSync(slidePdfPath, { force: true });
  run('officecli', ['create', slidePptxPath, '--force']);
  run('officecli', ['set', slidePptxPath, '/', '--prop', `title=${guide.title}`, '--prop', `author=${guide.owner}`, '--prop', 'subject=macOS App first-run slide guide']);
  buildCoverSlide();
  guide.steps.forEach(buildStepSlide);
  buildFinalSlide();
  run('officecli', ['close', slidePptxPath]);
  run('officecli', ['validate', slidePptxPath]);
}

function exportSlidePdf() {
  const soffice = process.env.SOFFICE_BIN || 'soffice';
  const generatedPdfPath = path.join(guideDir, `${path.basename(slidePptxPath, '.pptx')}.pdf`);
  fs.rmSync(generatedPdfPath, { force: true });
  fs.rmSync(slidePdfPath, { force: true });
  run(soffice, [
    '--headless',
    '--convert-to',
    'pdf',
    '--outdir',
    guideDir,
    slidePptxPath,
  ]);
  if (!fs.existsSync(generatedPdfPath)) throw new Error(`Expected LibreOffice PDF output at ${generatedPdfPath}`);
  fs.renameSync(generatedPdfPath, slidePdfPath);
}

function pptxStats() {
  return run('officecli', ['view', slidePptxPath, 'stats']).stdout;
}

function assertNoPptxIssues() {
  const output = run('officecli', ['view', slidePptxPath, 'issues']).stdout.trim();
  const issueCount = Number(output.match(/Found\s+(\d+)\s+issue\(s\)/i)?.[1] ?? 0);
  if (issueCount > 0) {
    throw new Error(`Slide deck has layout issues:\n${output}`);
  }
  return output;
}

function main() {
  const { dimensions, assets } = assertGuideAssets('Slide', guide, assetManifest);
  buildPptx();
  exportSlidePdf();
  const render = renderPdfPages({ tempDir, pdfPath: slidePdfPath, pagePrefix: 'slide' });
  const info = readPdfInfo(slidePdfPath);
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  const pageSizeMatch = info.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m);
  const pageWidth = Number(pageSizeMatch?.[1] ?? 0);
  const pageHeight = Number(pageSizeMatch?.[2] ?? 0);
  if (pages !== totalSlides) throw new Error(`Expected ${totalSlides} slide PDF pages, got ${pages}`);
  if (pageWidth <= pageHeight) throw new Error(`Expected landscape slide PDF, got ${pageWidth}x${pageHeight} pts`);

  const stats = pptxStats();
  const pptxIssues = assertNoPptxIssues();
  const slideMatch = stats.match(/Slides:\s+(\d+)/i) ?? stats.match(/totalSlides:\s+(\d+)/i);
  const slides = Number(slideMatch?.[1] ?? totalSlides);

  const verification = {
    status: 'macos_app_install_slides_ready',
    download_url: guide.download.latest_release_url,
    screenshot_release_tag: screenshotTag,
    guide_source: relativeToApp(guideSourcePath),
    screenshot_asset_manifest: relativeToApp(assetManifestPath),
    output_pptx: relativeToApp(slidePptxPath),
    output_pdf: relativeToApp(slidePdfPath),
    slide_layout: '16:9',
    slides,
    pdf_pages: pages,
    pdf_page_size_pts: {
      width: pageWidth,
      height: pageHeight,
    },
    typography: {
      font_family: titleFont,
      step_title_pt: 31,
      step_subtitle_pt: 20,
      step_body_pt: 13,
      callout_pt: '14.2-18',
      cover_title_pt: 34,
    },
    screenshot_source: screenshotSourceVerification(assetManifest),
    screenshot_assets: assets,
    screenshot_dimensions: dimensions,
    pptx_layout_issues: pptxIssues,
    rendered_pages: render.pages.length,
    rendered_dir: relativeToApp(render.renderDir),
  };
  writeJson(slideVerificationPath, verification);
  console.log(JSON.stringify(verification, null, 2));
}

main();
