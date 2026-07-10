#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type WhitepaperMetadata = {
  title: string;
  subtitle: string;
  publicationDate: string;
  owner: string;
  thesis: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceMarkdown = 'docs/whitepapers/opl-app-whitepaper.md';
const outputName = 'opl-app-whitepaper';
const status = 'opl_app_whitepaper_ready';
const owner = 'one-person-lab-app';
const coverLine = 'OPL App / Docker WebUI / OPL Workspace / Foundry Agents';
const headerTitle = 'OPL App Whitepaper';
const minPdfPages = 6;
const requiredSections = [
  '## 定位摘要',
  '## 为什么不是再做一个聊天框',
  '## OPL App 的答案：可信专业工作台',
  '## 一个工作台，不用跳工具',
  '## 专业智能体：用户先看到工作目的',
  '## 结果带来路',
  '## 工作台跟着工作走',
  '## 用已有资源，不重建世界',
  '## 为什么用户可以相信 OPL App 专业',
  '## 与 Framework、Cloud 和 Foundry Agents 的关系',
  '## 用户会如何感知 OPL App',
  '## 本文边界',
  '## 结语',
];
const requiredTerms = [
  'OPL App 白皮书',
  '可信专业工作台',
  '本地优先',
  '云端连续',
  '一个工作台，不用跳工具',
  '结果带来路',
  '工作台跟着工作走',
  'Docker/WebUI',
  'OPL Workspace',
  'OPL Framework',
  'OPL Cloud',
  'Foundry Agents',
  'Med Auto Science',
  'Med Auto Grant',
  'RedCube AI',
  'OPL Book Forge',
  'OPL Meta Agent',
  '为什么用户可以相信 OPL App 专业',
  '本文边界',
  '结语',
];
const forbiddenPatterns = [/sk-[A-Za-z0-9_-]+/, /OPENAI_API_KEY/, /CODEX_API_KEY/];
const whitepaperDir = path.join(repoRoot, 'docs', 'site', 'latest', 'whitepapers');
const tempDir = path.join(repoRoot, 'tmp', 'pdfs', outputName);
const output = {
  sourceMarkdownPath: path.join(repoRoot, sourceMarkdown),
  generatedMarkdownPath: path.join(whitepaperDir, `${outputName}.md`),
  htmlPath: path.join(whitepaperDir, `${outputName}.html`),
  pdfPath: path.join(whitepaperDir, `${outputName}.pdf`),
  verificationPath: path.join(repoRoot, 'docs', 'delivery', 'whitepapers', `${outputName}-verification.json`),
  tempDir,
  tempMarkdownPath: path.join(tempDir, `${outputName}.pandoc.md`),
  tempHeaderPath: path.join(tempDir, `${outputName}-header.tex`),
  candidatePdfPath: path.join(tempDir, `${outputName}.candidate.pdf`),
};

function run(command: string, args: string[], options: { env?: NodeJS.ProcessEnv } = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    throw new Error([`Command failed: ${command} ${args.join(' ')}`, result.stdout, result.stderr].filter(Boolean).join('\n'));
  }
  return result;
}

function commandPath(command: string) {
  const result = spawnSync('which', [command], { encoding: 'utf8', stdio: 'pipe' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function firstMatch(markdown: string, pattern: RegExp, label: string) {
  const match = pattern.exec(markdown);
  const value = match?.[1]?.trim();
  if (!value) throw new Error(`Whitepaper Markdown is missing ${label}.`);
  return value;
}

function parseMarkdownMetadata(markdown: string): WhitepaperMetadata {
  const title = firstMatch(markdown, /^#\s+(.+)$/m, 'top-level title');
  const subtitle = firstMatch(markdown, /^>\s+(.+)$/m, 'subtitle blockquote');
  const publicationDate = firstMatch(markdown, /^发布日期：(.+)$/m, 'publication date');
  const thesis = firstMatch(markdown, /^核心判断：(.+)$/m, 'core thesis');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publicationDate)) {
    throw new Error(`Whitepaper publication date must use YYYY-MM-DD, got ${publicationDate}.`);
  }
  for (const section of requiredSections) {
    if (!markdown.includes(section)) throw new Error(`Whitepaper Markdown must include ${section}.`);
  }
  return { title, subtitle, publicationDate, owner, thesis };
}

function scanTextForSecrets(text: string) {
  const hits = forbiddenPatterns.filter((pattern) => pattern.test(text)).map(String);
  if (hits.length > 0) throw new Error(`Whitepaper text contains forbidden sensitive marker(s): ${hits.join(', ')}`);
}

function normalizePdfInlineCode(markdown: string) {
  return markdown.replace(/`([^`\n]+)`/g, '$1');
}

function stripMarkdownTitleBlock(markdown: string) {
  return markdown.replace(/^# .+\n\n> .+\n\n/, '').replace(/^## /gm, '# ').replace(/^### /gm, '## ');
}

function escapeLatexText(value: string) {
  return value
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}%$#&_])/g, '\\$1')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}');
}

function buildHeader() {
  return String.raw`
\usepackage{xcolor}
\usepackage{fancyhdr}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage{booktabs}
\usepackage{longtable}
\usepackage{array}
\definecolor{OPLTeal}{HTML}{0F766E}
\definecolor{OPLInk}{HTML}{101828}
\definecolor{OPLMuted}{HTML}{667085}
\definecolor{OPLLine}{HTML}{D0D5DD}
\setlength{\parindent}{0pt}
\setlength{\parskip}{6pt}
\setlist[itemize]{topsep=2pt,itemsep=2pt,leftmargin=18pt}
\titleformat{\section}{\Large\bfseries\color{OPLTeal}}{\thesection}{0.7em}{}
\titleformat{\subsection}{\large\bfseries\color{OPLInk}}{\thesubsection}{0.7em}{}
\titleformat{\subsubsection}{\normalsize\bfseries\color{OPLInk}}{\thesubsubsection}{0.7em}{}
\pagestyle{fancy}
\fancyhf{}
\lhead{\small\color{OPLMuted}One Person Lab}
\rhead{\small\color{OPLMuted}${escapeLatexText(headerTitle)}}
\cfoot{\small\thepage}
\renewcommand{\headrulewidth}{0.3pt}
\renewcommand{\headrule}{\hbox to\headwidth{\color{OPLLine}\leaders\hrule height \headrulewidth\hfill}}
`;
}

function buildPdfMarkdown(metadata: WhitepaperMetadata, markdown: string) {
  const cover = [
    '\\begin{titlepage}',
    '\\thispagestyle{empty}',
    '\\vspace*{26mm}',
    '{\\color{OPLTeal}\\Large One Person Lab\\par}',
    '\\vspace{18mm}',
    `{\\Huge\\bfseries ${escapeLatexText(metadata.title)}\\par}`,
    '\\vspace{8mm}',
    `{\\LARGE ${escapeLatexText(metadata.subtitle)}\\par}`,
    '\\vspace{18mm}',
    `{\\large ${escapeLatexText(metadata.thesis)}\\par}`,
    '\\vspace{10mm}',
    `{\\large ${escapeLatexText(coverLine)}\\par}`,
    '\\vfill',
    `{\\large ${metadata.publicationDate}\\par}`,
    '\\vspace{4mm}',
    '{\\small Public whitepaper\\par}',
    '\\end{titlepage}',
    '\\newpage',
    '\\tableofcontents',
    '\\newpage',
    '',
  ].join('\n');
  return `${cover}${stripMarkdownTitleBlock(normalizePdfInlineCode(markdown))}`;
}

function buildHtml(metadata: WhitepaperMetadata) {
  run('pandoc', [
    output.sourceMarkdownPath,
    '--standalone',
    '--metadata', `title=${metadata.title}`,
    '--metadata', 'lang=zh-CN',
    '-o', output.htmlPath,
  ]);
}

function buildPdf(metadata: WhitepaperMetadata, markdown: string) {
  fs.mkdirSync(output.tempDir, { recursive: true });
  fs.writeFileSync(output.tempHeaderPath, buildHeader(), 'utf8');
  fs.writeFileSync(output.tempMarkdownPath, buildPdfMarkdown(metadata, markdown), 'utf8');
  const font = process.env.OPL_WHITEPAPER_PDF_FONT || 'Noto Sans CJK SC';
  const sourceDateEpoch = String(Math.floor(new Date(`${metadata.publicationDate}T00:00:00Z`).getTime() / 1000));
  run('pandoc', [
    output.tempMarkdownPath,
    '--standalone',
    '--pdf-engine=xelatex',
    '--number-sections',
    '--metadata', `title-meta=${metadata.title}`,
    '--metadata', `author-meta=${metadata.owner}`,
    '--metadata', 'lang=zh-CN',
    '--include-in-header', output.tempHeaderPath,
    '-V', `mainfont=${font}`,
    '-V', `CJKmainfont=${font}`,
    '-V', 'geometry:margin=18mm',
    '-V', 'colorlinks=true',
    '-V', 'linkcolor=OPLTeal',
    '-V', 'urlcolor=OPLTeal',
    '-o', output.candidatePdfPath,
  ], { env: { SOURCE_DATE_EPOCH: sourceDateEpoch } });
  fs.copyFileSync(output.candidatePdfPath, output.pdfPath);
  fs.rmSync(output.candidatePdfPath, { force: true });
}

function parsePdfInfo(pdfFile: string) {
  const result = run('pdfinfo', [pdfFile]);
  const pages = Number(result.stdout.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  const size = result.stdout.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m);
  return {
    pages,
    page_size_pts: {
      width: Number(size?.[1] ?? 0),
      height: Number(size?.[2] ?? 0),
    },
  };
}

function renderPdf(pdfFile: string, renderDir: string) {
  fs.rmSync(renderDir, { recursive: true, force: true });
  fs.mkdirSync(renderDir, { recursive: true });
  run('pdftoppm', ['-png', '-r', '120', pdfFile, path.join(renderDir, 'page')]);
  return { renderDir, pages: fs.readdirSync(renderDir).filter((name) => name.endsWith('.png')).sort() };
}

function fileSha1(filePath: string) {
  return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
}

function parseMarkdownLinks(markdown: string) {
  return [...markdown.matchAll(/- \[([^\]]+)\]\(([^)]+)\)：(.+)/g)].map((match) => ({
    label: match[1],
    url: match[2],
    note: match[3],
  }));
}

function relativeToRepo(filePath: string) {
  return path.relative(repoRoot, filePath);
}

function main() {
  fs.mkdirSync(path.dirname(output.htmlPath), { recursive: true });
  const markdown = fs.readFileSync(output.sourceMarkdownPath, 'utf8');
  const metadata = parseMarkdownMetadata(markdown);
  scanTextForSecrets(markdown);
  buildHtml(metadata);
  buildPdf(metadata, markdown);

  const render = renderPdf(output.pdfPath, path.join(output.tempDir, 'rendered'));
  const info = parsePdfInfo(output.pdfPath);
  if (info.pages < minPdfPages) {
    throw new Error(`Expected whitepaper PDF to have at least ${minPdfPages} pages, got ${info.pages}.`);
  }
  if (info.page_size_pts.height <= info.page_size_pts.width) {
    throw new Error(`Expected portrait PDF, got ${info.page_size_pts.width}x${info.page_size_pts.height} pts.`);
  }

  const rawText = run('pdftotext', [output.pdfPath, '-']).stdout;
  const text = rawText.replace(/[\u2010-\u2015]/g, '-');
  const missingTerms = requiredTerms.filter((term) => !text.includes(term));
  if (missingTerms.length > 0) throw new Error(`Generated PDF text is missing required terms: ${missingTerms.join(', ')}`);

  const verification = {
    status,
    generated_at: `${metadata.publicationDate}T00:00:00.000Z`,
    source_markdown: relativeToRepo(output.sourceMarkdownPath),
    generated_markdown: relativeToRepo(output.generatedMarkdownPath),
    generated_html: relativeToRepo(output.htmlPath),
    generated_pdf: relativeToRepo(output.pdfPath),
    temp_markdown: relativeToRepo(output.tempMarkdownPath),
    rendered_dir: relativeToRepo(render.renderDir),
    rendered_pages: render.pages.length,
    rendered_page_hashes: render.pages.map((page) => ({ page, sha1: fileSha1(path.join(render.renderDir, page)) })),
    pdf_pages: info.pages,
    pdf_page_size_pts: info.page_size_pts,
    required_terms: requiredTerms,
    required_terms_status: 'present',
    style_profile: 'opl-whitepaper-pandoc-xelatex-v1',
    tools: {
      pandoc: commandPath('pandoc'),
      xelatex: commandPath('xelatex'),
      pdfinfo: commandPath('pdfinfo'),
      pdftoppm: commandPath('pdftoppm'),
      pdftotext: commandPath('pdftotext'),
    },
    references: parseMarkdownLinks(markdown),
  };

  fs.copyFileSync(output.sourceMarkdownPath, output.generatedMarkdownPath);
  fs.mkdirSync(path.dirname(output.verificationPath), { recursive: true });
  fs.writeFileSync(output.verificationPath, `${JSON.stringify(verification, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(verification, null, 2));
}

main();
