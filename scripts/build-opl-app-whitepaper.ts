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
const sourceDir = path.join(repoRoot, 'docs', 'whitepapers');
const whitepaperDir = path.join(repoRoot, 'docs', 'site', 'latest', 'whitepapers');
const markdownPath = path.join(whitepaperDir, 'opl-app-whitepaper.md');
const sourceMarkdownPath = path.join(sourceDir, 'opl-app-whitepaper.md');
const htmlPath = path.join(whitepaperDir, 'opl-app-whitepaper.html');
const pdfPath = path.join(whitepaperDir, 'opl-app-whitepaper.pdf');
const verificationPath = path.join(repoRoot, 'docs', 'delivery', 'whitepapers', 'opl-app-whitepaper-verification.json');
const templateHeaderPath = path.join(repoRoot, 'docs', 'publishing', 'templates', 'opl-whitepaper', 'header.tex');
const tempDir = path.join(repoRoot, 'tmp', 'pdfs', 'opl-app-whitepaper');
const tempMarkdownPath = path.join(tempDir, 'opl-app-whitepaper.pandoc.md');
const tempHeaderPath = path.join(tempDir, 'opl-app-whitepaper-header.tex');

const forbiddenPatterns = [/sk-[A-Za-z0-9_-]+/, /OPENAI_API_KEY/, /CODEX_API_KEY/];

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
  'OPL BookForge',
  'OPL Meta Agent',
  '为什么用户可以相信 OPL App 专业',
  '本文边界',
  '结语',
];

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
  for (const section of [
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
  ]) {
    if (!markdown.includes(section)) throw new Error(`Whitepaper Markdown must include ${section}.`);
  }
  return { title, subtitle, publicationDate, owner: 'one-person-lab-app', thesis };
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
  const templateHeader = fs.readFileSync(templateHeaderPath, 'utf8');
  return `${templateHeader}\n\\fancyhead[R]{\\small\\color{OPLMuted}OPL App Whitepaper}\n`;
}

function buildPdfMarkdown(metadata: WhitepaperMetadata, markdown: string) {
  const cover = [
    '\\begin{titlepage}',
    '\\thispagestyle{empty}',
    '\\vspace*{26mm}',
    '{\\color{OPLBlue}\\Large One Person Lab\\par}',
    '\\vspace{18mm}',
    `{\\Huge\\bfseries ${escapeLatexText(metadata.title)}\\par}`,
    '\\vspace{8mm}',
    `{\\LARGE ${escapeLatexText(metadata.subtitle)}\\par}`,
    '\\vspace{18mm}',
    `{\\large ${escapeLatexText(metadata.thesis)}\\par}`,
    '\\vspace{10mm}',
    '{\\large OPL App / Docker WebUI / OPL Workspace / Foundry Agents\\par}',
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

function buildPdf(metadata: WhitepaperMetadata, markdown: string) {
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(whitepaperDir, { recursive: true });
  fs.writeFileSync(tempHeaderPath, buildHeader(), 'utf8');
  fs.writeFileSync(tempMarkdownPath, buildPdfMarkdown(metadata, markdown), 'utf8');
  const latinFont = process.env.OPL_WHITEPAPER_LATIN_FONT || 'Helvetica Neue';
  const cjkFont = process.env.OPL_WHITEPAPER_CJK_FONT || process.env.OPL_WHITEPAPER_PDF_FONT || 'Noto Sans CJK SC';
  const sourceDateEpoch = String(Math.floor(new Date(`${metadata.publicationDate}T00:00:00Z`).getTime() / 1000));
  run('pandoc', [
    tempMarkdownPath,
    '--standalone',
    '--pdf-engine=xelatex',
    '--number-sections',
    '--metadata', `title-meta=${metadata.title}`,
    '--metadata', `author-meta=${metadata.owner}`,
    '--metadata', 'lang=zh-CN',
    '--include-in-header', tempHeaderPath,
    '-V', `mainfont=${latinFont}`,
    '-V', `CJKmainfont=${cjkFont}`,
    '-V', 'geometry:margin=18mm',
    '-V', 'colorlinks=true',
    '-V', 'linkcolor=OPLBlue',
    '-V', 'urlcolor=OPLBlue',
    '-o', pdfPath,
  ], { env: { SOURCE_DATE_EPOCH: sourceDateEpoch } });
}

function buildHtml(metadata: WhitepaperMetadata) {
  fs.mkdirSync(whitepaperDir, { recursive: true });
  run('pandoc', [
    sourceMarkdownPath,
    '--standalone',
    '--metadata', `title=${metadata.title}`,
    '--metadata', 'lang=zh-CN',
    '-o', htmlPath,
  ]);
}

function parsePdfInfo(pdfFile: string) {
  const result = run('pdfinfo', [pdfFile]);
  const pages = Number(result.stdout.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  const size = result.stdout.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m);
  return {
    raw: result.stdout,
    pages,
    page_size_pts: {
      width: Number(size?.[1] ?? 0),
      height: Number(size?.[2] ?? 0),
    },
  };
}

function renderPdf(pdfFile: string) {
  const renderDir = path.join(tempDir, 'rendered');
  fs.rmSync(renderDir, { recursive: true, force: true });
  fs.mkdirSync(renderDir, { recursive: true });
  run('pdftoppm', ['-png', '-r', '120', pdfFile, path.join(renderDir, 'page')]);
  return { renderDir, pages: fs.readdirSync(renderDir).filter((name) => name.endsWith('.png')).sort() };
}

function extractPdfText(pdfFile: string) {
  return run('pdftotext', [pdfFile, '-']).stdout;
}

function assertNoUnicodeDashes(text: string) {
  const dashHits = Array.from(new Set(text.match(/[\u2010-\u2015]/g) ?? []));
  if (dashHits.length > 0) {
    const labels = dashHits.map((dash) => `${dash} U+${dash.codePointAt(0)?.toString(16).toUpperCase()}`).join(', ');
    throw new Error(`Generated PDF text contains non-ASCII dash characters: ${labels}`);
  }
}

function fileSha1(filePath: string) {
  return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
}

function relativeToRepo(filePath: string) {
  return path.relative(repoRoot, filePath);
}

function main() {
  const markdown = fs.readFileSync(sourceMarkdownPath, 'utf8');
  const metadata = parseMarkdownMetadata(markdown);
  scanTextForSecrets(markdown);
  buildHtml(metadata);
  buildPdf(metadata, markdown);

  const render = renderPdf(pdfPath);
  const info = parsePdfInfo(pdfPath);
  if (info.pages < 6) throw new Error(`Expected whitepaper PDF to have at least 6 pages, got ${info.pages}.`);
  if (info.page_size_pts.height <= info.page_size_pts.width) {
    throw new Error(`Expected portrait PDF, got ${info.page_size_pts.width}x${info.page_size_pts.height} pts.`);
  }

  const text = extractPdfText(pdfPath);
  assertNoUnicodeDashes(text);
  const missingTerms = requiredTerms.filter((term) => !text.includes(term));
  if (missingTerms.length > 0) throw new Error(`Generated PDF text is missing required terms: ${missingTerms.join(', ')}`);

  const renderedPageHashes = render.pages.map((page) => ({
    page,
    sha1: fileSha1(path.join(render.renderDir, page)),
  }));
  const verification = {
    status: 'opl_app_whitepaper_ready',
    generated_at: `${metadata.publicationDate}T00:00:00.000Z`,
    source_markdown: relativeToRepo(sourceMarkdownPath),
    generated_markdown: relativeToRepo(markdownPath),
    generated_html: relativeToRepo(htmlPath),
    generated_pdf: relativeToRepo(pdfPath),
    temp_markdown: relativeToRepo(tempMarkdownPath),
    rendered_dir: relativeToRepo(render.renderDir),
    rendered_pages: render.pages.length,
    rendered_page_hashes: renderedPageHashes,
    pdf_pages: info.pages,
    pdf_page_size_pts: info.page_size_pts,
    required_terms: requiredTerms,
    required_terms_status: 'present',
    tools: {
      pandoc: commandPath('pandoc'),
      xelatex: commandPath('xelatex'),
      pdfinfo: commandPath('pdfinfo'),
      pdftoppm: commandPath('pdftoppm'),
      pdftotext: commandPath('pdftotext'),
    },
  };
  fs.copyFileSync(sourceMarkdownPath, markdownPath);
  fs.mkdirSync(path.dirname(verificationPath), { recursive: true });
  fs.writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(verification, null, 2));
}

main();
