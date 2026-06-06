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
  relativeToApp,
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
const titleFont = 'Arial';
const cjkFont = 'PingFang SC';
const bodyFont = 'Arial';
const primary = '111827';
const muted = '5B6574';
const accent = '0F766E';
const softAccent = 'E6F4F1';
const panelFill = 'F8FAFC';
const border = 'D6DEE8';
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
      text: expandTemplate(subtitle, guide, assetManifest),
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
    text: expandList(callouts, guide, assetManifest).map((item) => `• ${item}`).join('\n'),
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
    text: guide.title,
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
    text: guide.cover.description,
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
    text: `下载最新版本\n${guide.download.latest_release_url}`,
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
    src: path.join(assetDir, guide.cover.image_asset),
    x: '16.1cm',
    y: '2.0cm',
    width: '16.5cm',
    height: '9.28cm',
    alt: 'One Person Lab 首次启动后的科研入口截图',
  });
  addShape(1, {
    text: `中文 1080p VM 截图 · ${screenshotTag}`,
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
  addNotes(1, `本教程用于 macOS App 首次安装和首启说明。截图来自 ${screenshotTag} 的中文 1080p VM guide artifact 与同一次 VM smoke 的 App CDP 截图。`);
  addFooter(1, `1 / ${totalSlides}`);
}

function buildStepSlide(step: GuideStep, index: number) {
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
  addNotes(slide, expandTemplate(step.speaker_notes, guide, assetManifest));
  addFooter(slide, `${slide} / ${totalSlides}`);
}

function buildFinalSlide() {
  const slide = totalSlides;
  addSlide('FFFFFF');
  addTitle(slide, '常见问题与验证来源', '遇到下载、权限、模块、数据路径问题时，先按界面提示和本页检查。');

  addShape(slide, {
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
  addShape(slide, {
    text: expandList(guide.faqs.slice(0, 4), guide, assetManifest).map((item) => `• ${item}`).join('\n'),
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
  addShape(slide, {
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
  addShape(slide, {
    text: expandList(guide.verification_callouts, guide, assetManifest).map((item) => `• ${item}`).join('\n'),
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
  addPicture(slide, {
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
  return run('officecli', ['view', slidePptxPath, 'stats']).stdout;
}

function main() {
  const { dimensions, assets } = assertGuideAssets('Slide', guide, assetManifest);
  buildPptx();
  exportSlidePdf();
  const render = renderPdf();
  const info = pdfInfo();
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  const pageSizeMatch = info.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m);
  const pageWidth = Number(pageSizeMatch?.[1] ?? 0);
  const pageHeight = Number(pageSizeMatch?.[2] ?? 0);
  if (pages !== totalSlides) throw new Error(`Expected ${totalSlides} slide PDF pages, got ${pages}`);
  if (pageWidth <= pageHeight) throw new Error(`Expected landscape slide PDF, got ${pageWidth}x${pageHeight} pts`);

  const stats = pptxStats();
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
      title_pt: 34,
      body_pt: '17-22',
      cover_title_pt: 38,
    },
    screenshot_source: screenshotSourceVerification(assetManifest),
    screenshot_assets: assets,
    screenshot_dimensions: dimensions,
    rendered_pages: render.pages.length,
    rendered_dir: relativeToApp(render.renderDir),
  };
  writeJson(slideVerificationPath, verification);
  console.log(JSON.stringify(verification, null, 2));
}

main();
