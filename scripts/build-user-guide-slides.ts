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

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guideId = 'macos-app-install';
const guideDir = path.join(appRoot, 'docs', 'guides', guideId);
const deliveryDir = path.join(appRoot, 'docs', 'delivery', 'user-guides', guideId);
const publicGuideDir = path.join(appRoot, 'docs', 'public', guideId);
const sourceQmdPath = path.join(guideDir, 'slides.qmd');
const screenshotManifestPath = path.join(guideDir, 'screenshots.manifest.json');
const screenshotDir = path.join(guideDir, 'screenshots');
const manifestPath = path.join(deliveryDir, 'source', 'macos-app-install.quarto.json');
const tempDir = path.join(appRoot, 'tmp', 'quarto-guides', `${guideId}-slides`);
const projectDir = path.join(tempDir, 'project');
const renderDir = path.join(tempDir, 'rendered');
const outputPptxPath = path.join(publicGuideDir, 'macos-app-install-slides.pptx');
const outputPdfPath = path.join(publicGuideDir, 'macos-app-install-slides.pdf');
const generatedQmdPath = path.join(deliveryDir, 'generated', 'macos-app-install-slides.qmd');
const verificationPath = path.join(deliveryDir, 'verification', 'macos-app-install-slides-verification.json');

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

function copyDir(src: string, dst: string) {
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const from = path.join(src, entry);
    const to = path.join(dst, entry);
    const stat = fs.statSync(from);
    if (stat.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function writeProject(qmd: string) {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.mkdirSync(projectDir, { recursive: true });
  copyDir(screenshotDir, path.join(projectDir, 'screenshots'));
  fs.writeFileSync(path.join(projectDir, 'slides.qmd'), qmd, 'utf8');
  fs.writeFileSync(path.join(projectDir, '_quarto.yml'), `project:
  type: default

lang: zh-CN

format:
  pptx:
    slide-level: 2
`, 'utf8');
}

function renderPptx() {
  run('quarto', ['render', 'slides.qmd', '--to', 'pptx'], { cwd: projectDir });
  const rendered = path.join(projectDir, 'slides.pptx');
  if (!fs.existsSync(rendered)) {
    throw new Error(`Quarto did not produce ${relativeToApp(rendered)}`);
  }
  fs.mkdirSync(path.dirname(outputPptxPath), { recursive: true });
  fs.copyFileSync(rendered, outputPptxPath);
}

function renderPdf() {
  const font = process.env.OPL_APP_GUIDE_PDF_FONT || 'Noto Sans CJK SC';
  run('quarto', [
    'render',
    'slides.qmd',
    '--to',
    'beamer',
    '-M',
    'pdf-engine=xelatex',
    '-M',
    `mainfont=${font}`,
    '-M',
    `CJKmainfont=${font}`,
  ], { cwd: projectDir });
  const rendered = path.join(projectDir, 'slides.pdf');
  if (!fs.existsSync(rendered)) {
    throw new Error(`Quarto did not produce ${relativeToApp(rendered)}`);
  }
  fs.copyFileSync(rendered, outputPdfPath);
}

function validatePptx() {
  const output = run('officecli', ['view', outputPptxPath, 'issues']).stdout.trim();
  const issueCount = Number(output.match(/Found\s+(\d+)\s+issue\(s\)/i)?.[1] ?? 0);
  if (issueCount > 0) {
    throw new Error(`Quarto-generated PPTX has layout issues:\n${output}`);
  }
  return output;
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
  const screenshots = readJson<ScreenshotManifest>(screenshotManifestPath);
  const source = fs.readFileSync(sourceQmdPath, 'utf8');
  const qmd = expandTemplate(source, manifest);
  scanText('Slides QMD source', qmd);
  const screenshotAssets = validateScreenshots(qmd, screenshots);
  const contentSlides = (qmd.match(/^##\s+/gm) ?? []).length;
  const expectedSlides = contentSlides + 1;
  if (contentSlides < 8) {
    throw new Error(`Expected at least 8 Quarto content slides, got ${contentSlides}`);
  }

  writeProject(qmd);
  renderPptx();
  renderPdf();
  const pptxIssues = validatePptx();

  fs.mkdirSync(path.dirname(generatedQmdPath), { recursive: true });
  fs.mkdirSync(path.dirname(verificationPath), { recursive: true });
  fs.writeFileSync(generatedQmdPath, qmd, 'utf8');

  const info = pdfInfo(outputPdfPath);
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  const pageSizeMatch = info.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m);
  const pageWidth = Number(pageSizeMatch?.[1] ?? 0);
  const pageHeight = Number(pageSizeMatch?.[2] ?? 0);
  if (pages !== expectedSlides) throw new Error(`Expected ${expectedSlides} slide PDF pages, got ${pages}`);
  if (pageWidth <= pageHeight) throw new Error(`Expected landscape slide PDF, got ${pageWidth}x${pageHeight} pts`);
  const renderedPages = renderPdfPages(outputPdfPath);
  const quartoVersion = run('quarto', ['--version']).stdout.trim();

  const verification = {
    status: 'macos_app_install_slides_ready',
    generator: 'quarto_presentation_qmd_to_pptx_and_beamer_pdf',
    quarto_version: quartoVersion,
    source_qmd: relativeToApp(sourceQmdPath),
    generated_qmd: relativeToApp(generatedQmdPath),
    manifest: relativeToApp(manifestPath),
    screenshots_manifest: relativeToApp(screenshotManifestPath),
    output_pptx: relativeToApp(outputPptxPath),
    output_pdf: relativeToApp(outputPdfPath),
    slide_layout: 'quarto_presentation_landscape',
    slides: expectedSlides,
    content_slides: contentSlides,
    title_slides: 1,
    pdf_pages: pages,
    pdf_page_size_pts: {
      width: pageWidth,
      height: pageHeight,
    },
    screenshot_source: screenshots.release_run ?? null,
    screenshot_assets: screenshotAssets,
    pptx_layout_issues: pptxIssues,
    rendered_pages: renderedPages.length,
    rendered_dir: relativeToApp(renderDir),
    unresolved_templates_status: 'absent',
    forbidden_secret_markers_status: 'absent',
  };
  fs.writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(verification, null, 2));
}

main();
