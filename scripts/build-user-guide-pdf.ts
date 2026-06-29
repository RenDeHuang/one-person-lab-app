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
const tempHeaderPath = path.join(tempDir, 'macos-app-install-header.tex');

const guide = loadGuide();
const assetManifest = loadAssetManifest();

function buildMarkdown() {
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
    lines.push(
      `## ${step.title}`,
      '',
      expandTemplate(step.body, guide, assetManifest),
      '',
      `![${step.title}](assets/${step.asset})`,
      '',
    );
    for (const note of expandList(step.notes, guide, assetManifest)) lines.push(`- ${note}`);
    lines.push('');
  }

  lines.push('## 常见问题', '');
  for (const faq of expandList(guide.faqs, guide, assetManifest)) lines.push(`- ${faq}`);
  lines.push('', '## 截图与验证来源', '');
  for (const note of expandList(guide.provenance_notes, guide, assetManifest)) lines.push(`- ${note}`);
  lines.push('');

  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

function normalizePdfInlineCode(markdown: string) {
  return markdown.replace(/`([^`\n]+)`/g, '$1');
}

function buildPdfMarkdown(markdown: string) {
  const cover = [
    '\\begin{titlepage}',
    '\\thispagestyle{empty}',
    '\\vspace*{24mm}',
    '{\\color{OPLTeal}\\Large One Person Lab App\\par}',
    '\\vspace{18mm}',
    `{\\Huge\\bfseries ${guide.title}\\par}`,
    '\\vspace{8mm}',
    `{\\Large ${guide.short_title}\\par}`,
    '\\vspace{14mm}',
    `{\\large ${guide.audience}${guide.intro}\\par}`,
    '\\vspace{10mm}',
    `{\\small 推荐首次安装资产：${guide.download.recommended_first_install_asset}\\par}`,
    '\\vfill',
    '{\\small Public user guide\\par}',
    '\\end{titlepage}',
    '\\newpage',
    '\\tableofcontents',
    '\\newpage',
    '',
  ].join('\n');
  const body = normalizePdfInlineCode(stripRepositoryMetadata(markdown))
    .replace(/^# .+\n\n/, '')
    .replace(/^## /gm, '# ');
  return `${cover}${body}`;
}

function buildHeader() {
  return String.raw`
\usepackage{xcolor}
\usepackage{fancyhdr}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage{graphicx}
\usepackage{float}
\definecolor{OPLTeal}{HTML}{0F766E}
\definecolor{OPLInk}{HTML}{101828}
\definecolor{OPLMuted}{HTML}{667085}
\definecolor{OPLLine}{HTML}{D0D5DD}
\setlength{\parindent}{0pt}
\setlength{\parskip}{6pt}
\setlist[itemize]{topsep=2pt,itemsep=2pt,leftmargin=18pt}
\titleformat{\section}{\Large\bfseries\color{OPLTeal}}{\thesection}{0.7em}{}
\titleformat{\subsection}{\large\bfseries\color{OPLInk}}{\thesubsection}{0.7em}{}
\pagestyle{fancy}
\fancyhf{}
\lhead{\small\color{OPLMuted}One Person Lab App}
\rhead{\small\color{OPLMuted}macOS install guide}
\cfoot{\small\thepage}
\renewcommand{\headrulewidth}{0.3pt}
\renewcommand{\headrule}{\hbox to\headwidth{\color{OPLLine}\leaders\hrule height \headrulewidth\hfill}}
\floatplacement{figure}{H}
`;
}

function extractPdfText() {
  return run('pdftotext', [detailedPdfPath, '-']).stdout;
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
  fs.mkdirSync(path.dirname(detailedPdfPath), { recursive: true });
  const markdown = buildMarkdown();
  scanTextForSecrets(markdown);
  fs.writeFileSync(markdownPath, markdown, 'utf8');
  fs.writeFileSync(tempHeaderPath, buildHeader(), 'utf8');
  fs.writeFileSync(tempMarkdownPath, buildPdfMarkdown(markdown), 'utf8');

  const font = process.env.OPL_APP_GUIDE_PDF_FONT || 'Noto Sans CJK SC';
  run('pandoc', [
    tempMarkdownPath,
    '--standalone',
    '--pdf-engine=xelatex',
    '--resource-path', `${appRoot}:${guideDir}`,
    '--number-sections',
    '--metadata', `title-meta=${guide.title}`,
    '--metadata', `author-meta=${guide.owner}`,
    '--metadata', 'lang=zh-CN',
    '--include-in-header', tempHeaderPath,
    '-V', `mainfont=${font}`,
    '-V', `CJKmainfont=${font}`,
    '-V', 'geometry:margin=18mm',
    '-V', 'colorlinks=true',
    '-V', 'linkcolor=OPLTeal',
    '-V', 'urlcolor=OPLTeal',
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
    throw new Error(`Expected an ebook-style multi-step guide PDF with at least 10 pages, got ${pages}`);
  }
  const pageSizeMatch = info.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m);
  const pageWidth = Number(pageSizeMatch?.[1] ?? 0);
  const pageHeight = Number(pageSizeMatch?.[2] ?? 0);
  if (pageHeight <= pageWidth) {
    throw new Error(`Expected portrait PDF page size, got ${pageWidth}x${pageHeight} pts`);
  }
  const text = extractPdfText();
  const requiredTerms = [
    guide.title,
    '准备清单',
    '下载 One Person Lab',
    '安装 App',
    '配置访问权限',
    '等待首次环境检查',
    '常见问题',
    '截图与验证来源',
  ];
  const missingTerms = requiredTerms.filter((term) => !text.includes(term));
  if (missingTerms.length > 0) {
    throw new Error(`Generated PDF text is missing required terms: ${missingTerms.join(', ')}`);
  }

  const verification = {
    status: 'macos_app_install_pdf_ready',
    generator: 'pandoc_xelatex_publication_template',
    pdf_layout: 'portrait_ebook',
    download_url: guide.download.latest_release_url,
    screenshot_release_tag: screenshotReleaseTag(assetManifest),
    guide_source: relativeToApp(guideSourcePath),
    screenshot_asset_manifest: relativeToApp(assetManifestPath),
    source_markdown: relativeToApp(markdownPath),
    pandoc_markdown: relativeToApp(tempMarkdownPath),
    pandoc_header: relativeToApp(tempHeaderPath),
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
    required_terms: requiredTerms,
    required_terms_status: 'present',
  };
  writeJson(detailedPdfVerificationPath, verification);
  console.log(JSON.stringify(verification, null, 2));
}

main();
