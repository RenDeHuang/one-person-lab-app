#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  appRoot,
  assetManifestPath,
  assertGuideAssets,
  detailedPdfPath,
  detailedPdfVerificationPath,
  expandList,
  expandTemplate,
  guideDir,
  guideSourcePath,
  loadAssetManifest,
  loadGuide,
  markdownPath,
  readPdfInfo,
  relativeToApp,
  renderPdfPages,
  run,
  scanTextForSecrets,
  screenshotReleaseTag,
  screenshotSourceVerification,
  writeJson,
} from './user-guide-data.ts';

const tempDir = path.join(appRoot, 'tmp', 'pdfs', 'macos-app-install');
const tempMarkdownPath = path.join(tempDir, 'macos-app-install.pandoc.md');

const guide = loadGuide();
const assetManifest = loadAssetManifest();

function buildMarkdown(options: { pandocPageBreaks?: boolean } = {}) {
  const lines: string[] = [
    `# ${guide.title}`,
    '',
    `Owner: \`${guide.owner}\``,
    'Purpose: `macos_app_install_user_guide_pdf_source`',
    `State: \`${guide.state}\``,
    'Machine boundary: Human-readable user guide. Release contracts, workflows, VM smoke artifacts, screenshot manifest, and App release metadata remain the machine truth.',
    '',
    `适用对象：${guide.audience}${guide.intro}`,
    '',
    `下载最新版本：${guide.download.latest_release_url}`,
    '',
    `> ${guide.security_notice}`,
    '',
    '## 准备清单',
    '',
  ];

  for (const item of expandList(guide.prepare_checklist, guide, assetManifest)) {
    lines.push(`- ${item}`);
  }
  lines.push('');

  for (const step of guide.steps) {
    if (options.pandocPageBreaks) lines.push('\\newpage', '');
    lines.push(
      `## ${step.title}`,
      '',
      expandTemplate(step.body, guide, assetManifest),
      '',
      `![${step.title}](assets/${step.asset})${options.pandocPageBreaks ? '{ height=64% }' : ''}`,
      '',
    );
    for (const note of expandList(step.notes, guide, assetManifest)) lines.push(`- ${note}`);
    lines.push('');
  }

  if (options.pandocPageBreaks) lines.push('\\newpage', '');
  lines.push('## 常见问题', '');
  for (const faq of expandList(guide.faqs, guide, assetManifest)) lines.push(`- ${faq}`);
  lines.push('', '## 截图与验证来源', '');
  for (const note of expandList(guide.provenance_notes, guide, assetManifest)) lines.push(`- ${note}`);
  lines.push('');

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
    '--metadata', `title=${guide.title}`,
    '-V', `mainfont=${font}`,
    '-V', `CJKmainfont=${font}`,
    '-V', 'geometry:margin=14mm,landscape',
    '-V', 'colorlinks=true',
    '-V', 'linkcolor=blue',
    '-V', 'urlcolor=blue',
    '-V', 'pagestyle=plain',
    '-o', detailedPdfPath,
  ]);
}

function main() {
  const { dimensions, assets } = assertGuideAssets('Guide', guide, assetManifest);
  buildPdf();
  const render = renderPdfPages({ tempDir, pdfPath: detailedPdfPath, pagePrefix: 'page' });
  const info = readPdfInfo(detailedPdfPath);
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
    download_url: guide.download.latest_release_url,
    screenshot_release_tag: screenshotReleaseTag(assetManifest),
    guide_source: relativeToApp(guideSourcePath),
    screenshot_asset_manifest: relativeToApp(assetManifestPath),
    source_markdown: relativeToApp(markdownPath),
    output_pdf: relativeToApp(detailedPdfPath),
    screenshot_source: screenshotSourceVerification(assetManifest),
    screenshot_assets: assets,
    screenshot_dimensions: dimensions,
    pdf_pages: pages,
    pdf_page_size_pts: {
      width: pageWidth,
      height: pageHeight,
    },
    rendered_pages: render.pages.length,
    rendered_dir: relativeToApp(render.renderDir),
  };
  writeJson(detailedPdfVerificationPath, verification);
  console.log(JSON.stringify(verification, null, 2));
}

main();
