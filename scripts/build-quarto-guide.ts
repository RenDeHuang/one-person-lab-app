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
  owner: string;
  purpose: string;
  state: string;
  machine_boundary: string;
  audience: string;
  intro: string;
  source_qmd: string;
  output: {
    public_dir: string;
    html: string;
    pdf: string;
    generated_markdown: string;
    verification: string;
  };
  book?: {
    chapters?: string[];
  };
  download?: Record<string, string>;
  assets: Array<{
    file: string;
    role: string;
    description: string;
    width?: number;
    height?: number;
    sha256?: string;
  }>;
  required_terms: string[];
  forbidden_phrases?: string[];
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guideId = process.argv[2];
const manifestFileName = process.argv[3] ?? `${guideId}.guide.json`;

if (!guideId) {
  throw new Error('Usage: node --experimental-strip-types scripts/build-quarto-guide.ts <guide-id>');
}

const guideDir = path.join(appRoot, 'docs', 'delivery', 'user-guides', guideId);
const manifestPath = path.join(guideDir, 'source', manifestFileName);
const assetsDir = path.join(guideDir, 'assets');
const tempDir = path.join(appRoot, 'tmp', 'quarto-guides', guideId);
const projectDir = path.join(tempDir, 'project');
const outputDir = path.join(projectDir, '_book');

const forbiddenSecretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /OPENAI_API_KEY/,
  /CODEX_API_KEY/,
  /OPL_CODEX_API_KEY\s*=\s*[^`\s]+/,
  /opl-first-run-smoke-guide-key/,
];

function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? appRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    env: options.env ?? process.env,
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

function loadManifest() {
  const manifest = readJson<GuideManifest>(manifestPath);
  if (manifest.schema !== 'opl_quarto_user_guide_manifest.v1') {
    throw new Error(`Unsupported Quarto guide manifest schema for ${guideId}: ${manifest.schema}`);
  }
  if (!manifest.title || !manifest.source_qmd || !manifest.output?.pdf || !manifest.output?.html) {
    throw new Error(`Quarto guide manifest is incomplete: ${relativeToApp(manifestPath)}`);
  }
  if (!Array.isArray(manifest.assets)) {
    throw new Error(`Quarto guide manifest must list assets: ${relativeToApp(manifestPath)}`);
  }
  return manifest;
}

function sourceQmdPath(manifest: GuideManifest) {
  if (path.isAbsolute(manifest.source_qmd) || manifest.source_qmd.includes('..')) {
    throw new Error(`source_qmd must be relative to guide dir: ${manifest.source_qmd}`);
  }
  return path.join(guideDir, manifest.source_qmd);
}

function sourceQmdPaths(manifest: GuideManifest) {
  const chapters = manifest.book?.chapters?.length ? manifest.book.chapters : [manifest.source_qmd];
  return chapters.map((chapter, index) => {
    if (path.isAbsolute(chapter) || chapter.includes('..')) {
      throw new Error(`Book chapter must be relative to guide dir: ${chapter}`);
    }
    return {
      source: chapter,
      absolute: path.join(guideDir, chapter),
      projectName: index === 0 ? 'index.qmd' : path.basename(chapter),
    };
  });
}

function outputPath(relativePath: string) {
  if (path.isAbsolute(relativePath) || relativePath.includes('..')) {
    throw new Error(`Output path must be relative to app root: ${relativePath}`);
  }
  return path.join(appRoot, relativePath);
}

function expandTemplate(text: string, manifest: GuideManifest) {
  let expanded = text
    .replaceAll('{{title}}', manifest.title)
    .replaceAll('{{short_title}}', manifest.short_title)
    .replaceAll('{{audience}}', manifest.audience)
    .replaceAll('{{intro}}', manifest.intro);
  for (const [key, value] of Object.entries(manifest.download ?? {})) {
    expanded = expanded.replaceAll(`{{download.${key}}}`, value);
  }
  return expanded;
}

function scanText(label: string, text: string, manifest: GuideManifest) {
  const secretHits = forbiddenSecretPatterns.filter((pattern) => pattern.test(text)).map(String);
  if (secretHits.length > 0) {
    throw new Error(`${label} contains forbidden sensitive marker(s): ${secretHits.join(', ')}`);
  }
  if (/\{\{[^}]+\}\}/.test(text)) {
    throw new Error(`${label} contains unresolved template placeholder(s).`);
  }
  const forbiddenPhraseHits = (manifest.forbidden_phrases ?? []).filter((phrase) => text.includes(phrase));
  if (forbiddenPhraseHits.length > 0) {
    throw new Error(`${label} contains forbidden phrase(s): ${forbiddenPhraseHits.join(', ')}`);
  }
}

function htmlVisibleText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function readPngDimensions(filePath: string) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`Guide asset is not a PNG file: ${relativeToApp(filePath)}`);
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function hashFile(filePath: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function referencedAssets(qmd: string) {
  const refs = new Set<string>();
  for (const match of qmd.matchAll(/!\[[^\]]*]\(assets\/([^)]+)\)/g)) {
    refs.add(decodeURIComponent(match[1]));
  }
  return refs;
}

function validateAssets(manifest: GuideManifest, qmd: string) {
  const refs = referencedAssets(qmd);
  const declaredNames = new Set(manifest.assets.map((asset) => asset.file));
  for (const ref of refs) {
    if (!declaredNames.has(ref)) {
      throw new Error(`QMD references undeclared guide asset: ${ref}`);
    }
  }

  return manifest.assets.map((asset) => {
    if (asset.file.includes('/') || asset.file.includes('\\')) {
      throw new Error(`Guide asset must be a plain filename: ${asset.file}`);
    }
    const filePath = path.join(assetsDir, asset.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Guide asset does not exist: ${relativeToApp(filePath)}`);
    }
    const dimensions = readPngDimensions(filePath);
    const sha256 = hashFile(filePath);
    if (asset.width && dimensions.width !== asset.width) {
      throw new Error(`Expected ${asset.file} width ${asset.width}, got ${dimensions.width}`);
    }
    if (asset.height && dimensions.height !== asset.height) {
      throw new Error(`Expected ${asset.file} height ${asset.height}, got ${dimensions.height}`);
    }
    if (asset.sha256 && sha256 !== asset.sha256) {
      throw new Error(`Expected ${asset.file} sha256 ${asset.sha256}, got ${sha256}`);
    }
    return {
      role: asset.role,
      description: asset.description,
      file: relativeToApp(filePath),
      public_file: `assets/${asset.file}`,
      width: dimensions.width,
      height: dimensions.height,
      sha256,
      referenced: refs.has(asset.file),
    };
  });
}

function copyDir(src: string, dst: string) {
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src)) {
    const from = path.join(src, entry);
    const to = path.join(dst, entry);
    const stat = fs.statSync(from);
    if (stat.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function trimLineEndings(text: string) {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

function writeProject(manifest: GuideManifest, qmd: string) {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });
  for (const asset of manifest.assets) {
    fs.copyFileSync(path.join(assetsDir, asset.file), path.join(projectDir, 'assets', asset.file));
  }
  for (const chapter of sourceQmdPaths(manifest)) {
    const raw = fs.readFileSync(chapter.absolute, 'utf8');
    const expanded = expandTemplate(raw, manifest);
    scanText(`QMD source ${chapter.source}`, expanded, manifest);
    fs.writeFileSync(path.join(projectDir, chapter.projectName), expanded, 'utf8');
  }
  fs.writeFileSync(path.join(projectDir, '_quarto.yml'), quartoYaml(manifest), 'utf8');
  fs.writeFileSync(path.join(projectDir, 'styles.scss'), stylesScss(), 'utf8');
  fs.writeFileSync(path.join(projectDir, 'header.tex'), latexHeader(), 'utf8');
}

function quartoYaml(manifest: GuideManifest) {
  const font = process.env.OPL_APP_GUIDE_PDF_FONT || 'Noto Sans CJK SC';
  return `project:
  type: book
  output-dir: _book

book:
  title: "${manifest.title}"
  chapters:
${sourceQmdPaths(manifest).map((chapter) => `    - ${chapter.projectName}`).join('\n')}

lang: zh-CN
toc: true
number-sections: false

format:
  html:
    theme: cosmo
    css: styles.scss
    embed-resources: true
    title-block-banner: true
  pdf:
    documentclass: scrreprt
    pdf-engine: xelatex
    mainfont: "${font}"
    CJKmainfont: "${font}"
    geometry:
      - margin=18mm
    colorlinks: true
    include-in-header: header.tex
    fig-pos: H
`;
}

function stylesScss() {
  return `/*-- scss:defaults --*/
$primary: #0f766e;
$body-color: #101828;
$link-color: #0b5f59;
$font-family-sans-serif: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;

/*-- scss:rules --*/
body {
  letter-spacing: 0;
}

h1, h2, h3 {
  letter-spacing: 0;
}

img {
  border: 1px solid #d8e0ea;
  border-radius: 6px;
}

pre {
  border-radius: 8px;
}
`;
}

function latexHeader() {
  return String.raw`
\usepackage{xcolor}
\usepackage{fancyhdr}
\usepackage{titlesec}
\usepackage{enumitem}
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
\rhead{\small\color{OPLMuted}Guide}
\cfoot{\small\thepage}
\renewcommand{\headrulewidth}{0.3pt}
\renewcommand{\headrule}{\hbox to\headwidth{\color{OPLLine}\leaders\hrule height \headrulewidth\hfill}}
`;
}

function renderQuarto() {
  fs.rmSync(outputDir, { recursive: true, force: true });
  run('quarto', ['render'], { cwd: projectDir });
}

function renderPdfPages(pdfPath: string) {
  const renderDir = path.join(tempDir, 'rendered');
  fs.rmSync(renderDir, { recursive: true, force: true });
  fs.mkdirSync(renderDir, { recursive: true });
  run('pdftoppm', ['-png', '-r', '120', pdfPath, path.join(renderDir, 'page')]);
  const pages = fs.readdirSync(renderDir).filter((name) => name.endsWith('.png')).sort();
  return { renderDir, pages };
}

function pdfInfo(pdfPath: string) {
  return run('pdfinfo', [pdfPath]).stdout;
}

function pdfText(pdfPath: string) {
  return run('pdftotext', [pdfPath, '-']).stdout;
}

function main() {
  const manifest = loadManifest();
  const qmd = sourceQmdPaths(manifest)
    .map((chapter) => expandTemplate(fs.readFileSync(chapter.absolute, 'utf8'), manifest))
    .join('\n\n');
  scanText('QMD source', qmd, manifest);
  const assetVerification = validateAssets(manifest, qmd);
  writeProject(manifest, qmd);
  renderQuarto();

  const publicDir = outputPath(manifest.output.public_dir);
  const htmlOutputPath = outputPath(manifest.output.html);
  const pdfOutputPath = outputPath(manifest.output.pdf);
  const generatedMarkdownPath = outputPath(manifest.output.generated_markdown);
  const verificationPath = outputPath(manifest.output.verification);

  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(path.dirname(generatedMarkdownPath), { recursive: true });
  fs.mkdirSync(path.dirname(verificationPath), { recursive: true });
  copyDir(path.join(projectDir, 'assets'), path.join(publicDir, 'assets'));
  const renderedPdf = fs.readdirSync(outputDir).find((name) => name.endsWith('.pdf'));
  if (!renderedPdf) {
    throw new Error(`Quarto book did not produce a PDF in ${relativeToApp(outputDir)}`);
  }
  fs.writeFileSync(
    htmlOutputPath,
    trimLineEndings(fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8')),
    'utf8',
  );
  fs.copyFileSync(path.join(outputDir, renderedPdf), pdfOutputPath);
  fs.writeFileSync(generatedMarkdownPath, qmd, 'utf8');

  const html = fs.readFileSync(htmlOutputPath, 'utf8');
  scanText('HTML visible text', htmlVisibleText(html), manifest);
  const text = pdfText(pdfOutputPath);
  scanText('PDF text', text, manifest);
  const missingTerms = manifest.required_terms.filter((term) => !text.includes(term));
  if (missingTerms.length > 0) {
    throw new Error(`Generated PDF text is missing required terms: ${missingTerms.join(', ')}`);
  }
  const info = pdfInfo(pdfOutputPath);
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  const pageSizeMatch = info.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m);
  const pageWidth = Number(pageSizeMatch?.[1] ?? 0);
  const pageHeight = Number(pageSizeMatch?.[2] ?? 0);
  if (pages < 6) throw new Error(`Expected publication-style PDF with at least 6 pages, got ${pages}`);
  if (pageHeight <= pageWidth) throw new Error(`Expected portrait PDF, got ${pageWidth}x${pageHeight} pts`);
  const rendered = renderPdfPages(pdfOutputPath);
  const quartoVersion = run('quarto', ['--version']).stdout.trim();

  const verification = {
    status: 'quarto_guide_ready',
    generator: 'quarto_book_qmd_to_html_pdf',
    quarto_version: quartoVersion,
    source_qmd: relativeToApp(sourceQmdPath(manifest)),
    manifest: relativeToApp(manifestPath),
    generated_markdown: relativeToApp(generatedMarkdownPath),
    output_html: relativeToApp(htmlOutputPath),
    output_pdf: relativeToApp(pdfOutputPath),
    quarto_project_dir: relativeToApp(projectDir),
    pdf_layout: 'quarto_portrait_ebook',
    pdf_pages: pages,
    pdf_page_size_pts: {
      width: pageWidth,
      height: pageHeight,
    },
    rendered_pages: rendered.pages.length,
    rendered_dir: relativeToApp(rendered.renderDir),
    html_bytes: html.length,
    screenshot_assets: assetVerification,
    required_terms: manifest.required_terms,
    required_terms_status: 'present',
    unresolved_templates_status: 'absent',
    forbidden_phrases_status: 'absent',
  };
  fs.writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(verification, null, 2));
}

main();
