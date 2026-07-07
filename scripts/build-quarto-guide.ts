#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGuideScriptHelpers } from './guide-script-helpers.ts';

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
  publishing?: {
    template?: string;
    preferred_pdf_engine?: string;
    pdf_engine?: string;
    pdf_engine_reason?: string;
  };
  download?: Record<string, string>;
  screenshots_manifest?: string;
  assets?: Array<{
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

type ScreenshotManifest = {
  schema: string;
  guide_id: string;
  status: string;
  source_summary?: unknown;
  release_run?: unknown;
  screenshots: Array<{
    file: string;
    role: string;
    title?: string;
    description: string;
    source_kind?: string;
    source?: string;
    locale?: string;
    browser_size?: string;
    width?: number;
    height?: number;
    sha256?: string;
    expected_ui_text?: string[];
    note?: string;
  }>;
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { run, relativeToApp, readJson } = createGuideScriptHelpers(appRoot);
const guideId = process.argv[2];
const manifestFileName = process.argv[3] ?? `${guideId}.guide.json`;

if (!guideId) {
  throw new Error('Usage: node --experimental-strip-types scripts/build-quarto-guide.ts <guide-id>');
}

const guideDir = path.join(appRoot, 'docs', 'delivery', 'user-guides', guideId);
const manifestPath = path.join(guideDir, 'source', manifestFileName);
const tempDir = path.join(appRoot, 'tmp', 'quarto-guides', guideId);
const projectDir = path.join(tempDir, 'project');
const outputDir = path.join(projectDir, '_book');
const publishingRoot = path.join(appRoot, 'docs', 'publishing');
const templatesRoot = path.join(publishingRoot, 'templates');

const forbiddenSecretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /OPENAI_API_KEY/,
  /CODEX_API_KEY/,
  /OPL_CODEX_API_KEY\s*=\s*[^`\s]+/,
  /opl-first-run-smoke-guide-key/,
];

function generatedLifecycleFrontMatter(manifest: GuideManifest) {
  return [
    `# Owner: \`${manifest.owner}\``,
    `# Purpose: \`generated_${manifest.id}_guide_markdown\``,
    '# State: `generated_payload`',
    `# Machine boundary: Generated Markdown snapshot. Human-readable source is \`${manifest.source_qmd}\`; machine truth remains in \`${relativeToApp(manifestPath)}\`, publishing templates, guide generator scripts, verification JSON, release evidence, screenshots manifest, and App contracts.`,
  ].join('\n');
}

function withGeneratedLifecycleFrontMatter(markdown: string, lifecycle: string) {
  return markdown.startsWith('---\n')
    ? markdown.replace('---\n', `---\n${lifecycle}\n`)
    : `${lifecycle}\n\n${markdown}`;
}

function loadManifest() {
  const manifest = readJson<GuideManifest>(manifestPath);
  if (manifest.schema !== 'opl_quarto_user_guide_manifest.v1') {
    throw new Error(`Unsupported Quarto guide manifest schema for ${guideId}: ${manifest.schema}`);
  }
  if (!manifest.title || !manifest.source_qmd || !manifest.output?.pdf || !manifest.output?.html) {
    throw new Error(`Quarto guide manifest is incomplete: ${relativeToApp(manifestPath)}`);
  }
  if (!manifest.screenshots_manifest && !Array.isArray(manifest.assets)) {
    throw new Error(`Quarto guide manifest must list screenshots_manifest or assets: ${relativeToApp(manifestPath)}`);
  }
  return manifest;
}

function screenshotManifestPath(manifest: GuideManifest) {
  const relativePath = manifest.screenshots_manifest;
  if (!relativePath) return null;
  if (path.isAbsolute(relativePath) || relativePath.includes('..')) {
    throw new Error(`screenshots_manifest must be relative to guide dir: ${relativePath}`);
  }
  return resolveSourcePath(relativePath);
}

function resolveSourcePath(relativePath: string) {
  if (path.isAbsolute(relativePath) || relativePath.includes('..')) {
    throw new Error(`Guide source path must be relative and stay inside the app repo: ${relativePath}`);
  }
  const appRootPath = path.join(appRoot, relativePath);
  if (fs.existsSync(appRootPath)) {
    return appRootPath;
  }
  return path.join(guideDir, relativePath);
}

function screenshotAssetsDir(manifest: GuideManifest) {
  const manifestPath = screenshotManifestPath(manifest);
  if (manifestPath) {
    const canonicalScreenshotsDir = path.join(path.dirname(manifestPath), 'screenshots');
    if (fs.existsSync(canonicalScreenshotsDir)) {
      return canonicalScreenshotsDir;
    }
  }
  return path.join(guideDir, 'assets');
}

function loadScreenshotManifest(manifest: GuideManifest): ScreenshotManifest {
  const filePath = screenshotManifestPath(manifest);
  if (!filePath) {
    return {
      schema: 'opl_guide_screenshots_manifest.v1',
      guide_id: manifest.id,
      status: 'legacy_inline_assets',
      screenshots: manifest.assets ?? [],
    };
  }
  const screenshots = readJson<ScreenshotManifest>(filePath);
  if (screenshots.schema !== 'opl_guide_screenshots_manifest.v1') {
    throw new Error(`Unsupported screenshot manifest schema for ${guideId}: ${screenshots.schema}`);
  }
  if (screenshots.guide_id !== manifest.id) {
    throw new Error(`Screenshot manifest guide_id ${screenshots.guide_id} does not match ${manifest.id}`);
  }
  if (!Array.isArray(screenshots.screenshots) || screenshots.screenshots.length === 0) {
    throw new Error(`Screenshot manifest must list screenshots: ${relativeToApp(filePath)}`);
  }
  for (const screenshot of screenshots.screenshots) {
    if (screenshot.locale !== 'zh-CN') {
      throw new Error(`Guide screenshot ${screenshot.file} must declare locale zh-CN`);
    }
    if (!Array.isArray(screenshot.expected_ui_text) || screenshot.expected_ui_text.length === 0) {
      throw new Error(`Guide screenshot ${screenshot.file} must declare expected_ui_text`);
    }
  }
  return screenshots;
}

function sourceQmdPath(manifest: GuideManifest) {
  if (path.isAbsolute(manifest.source_qmd) || manifest.source_qmd.includes('..')) {
    throw new Error(`source_qmd must be relative to guide dir: ${manifest.source_qmd}`);
  }
  return resolveSourcePath(manifest.source_qmd);
}

function sourceQmdPaths(manifest: GuideManifest) {
  const chapters = manifest.book?.chapters?.length ? manifest.book.chapters : [manifest.source_qmd];
  return chapters.map((chapter, index) => {
    if (path.isAbsolute(chapter) || chapter.includes('..')) {
      throw new Error(`Book chapter must be relative to guide dir: ${chapter}`);
    }
    return {
      source: chapter,
      absolute: resolveSourcePath(chapter),
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
  for (const match of qmd.matchAll(/!\[[^\]]*]\((?:assets|screenshots)\/([^)]+)\)/g)) {
    refs.add(decodeURIComponent(match[1]));
  }
  return refs;
}

function validateAssets(manifest: GuideManifest, qmd: string) {
  const screenshotManifest = loadScreenshotManifest(manifest);
  const sourceAssetsDir = screenshotAssetsDir(manifest);
  const screenshots = screenshotManifest.screenshots;
  const refs = referencedAssets(qmd);
  const declaredNames = new Set(screenshots.map((asset) => asset.file));
  for (const ref of refs) {
    if (!declaredNames.has(ref)) {
      throw new Error(`QMD references undeclared guide asset: ${ref}`);
    }
  }

  return screenshots.map((asset) => {
    if (asset.file.includes('/') || asset.file.includes('\\')) {
      throw new Error(`Guide asset must be a plain filename: ${asset.file}`);
    }
    const filePath = path.join(sourceAssetsDir, asset.file);
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
      public_file: `screenshots/${asset.file}`,
      width: dimensions.width,
      height: dimensions.height,
      sha256,
      referenced: refs.has(asset.file),
      source_kind: asset.source_kind,
      source: asset.source,
      locale: asset.locale,
      browser_size: asset.browser_size,
      expected_ui_text: asset.expected_ui_text ?? [],
      note: asset.note,
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
  const screenshotManifest = loadScreenshotManifest(manifest);
  const sourceAssetsDir = screenshotAssetsDir(manifest);
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(projectDir, 'screenshots'), { recursive: true });
  for (const asset of screenshotManifest.screenshots) {
    fs.copyFileSync(path.join(sourceAssetsDir, asset.file), path.join(projectDir, 'screenshots', asset.file));
  }
  for (const chapter of sourceQmdPaths(manifest)) {
    const raw = fs.readFileSync(chapter.absolute, 'utf8');
    const expanded = expandTemplate(raw, manifest);
    scanText(`QMD source ${chapter.source}`, expanded, manifest);
    fs.writeFileSync(path.join(projectDir, chapter.projectName), expanded, 'utf8');
  }
  const template = loadPublishingTemplate(manifest);
  fs.writeFileSync(path.join(projectDir, '_quarto.yml'), quartoYaml(manifest, template), 'utf8');
  copyPublishingTemplateAssets(template);
}

type PublishingTemplate = {
  id: string;
  path: string;
  htmlTheme: string;
  cssFile: string;
  headerFile: string;
};

function loadPublishingTemplate(manifest: GuideManifest): PublishingTemplate {
  const templateId = manifest.publishing?.template ?? 'opl-guide';
  if (templateId.includes('/') || templateId.includes('\\') || templateId.includes('..')) {
    throw new Error(`Invalid publishing template id: ${templateId}`);
  }
  const templatePath = path.join(templatesRoot, templateId);
  const configPath = path.join(templatePath, 'template.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Publishing template does not exist: ${relativeToApp(configPath)}`);
  }
  const config = readJson<{ id: string; html_theme: string; css_file: string; latex_header: string }>(configPath);
  if (config.id !== templateId) {
    throw new Error(`Publishing template id mismatch in ${relativeToApp(configPath)}`);
  }
  return {
    id: templateId,
    path: templatePath,
    htmlTheme: config.html_theme,
    cssFile: config.css_file,
    headerFile: config.latex_header,
  };
}

function copyPublishingTemplateAssets(template: PublishingTemplate) {
  fs.copyFileSync(path.join(template.path, template.cssFile), path.join(projectDir, 'styles.scss'));
  fs.copyFileSync(path.join(template.path, template.headerFile), path.join(projectDir, 'header.tex'));
}

function activePdfEngine(manifest: GuideManifest) {
  return manifest.publishing?.pdf_engine ?? 'xelatex';
}

function preferredPdfEngine(manifest: GuideManifest) {
  return manifest.publishing?.preferred_pdf_engine ?? activePdfEngine(manifest);
}

function quartoYaml(manifest: GuideManifest, template: PublishingTemplate) {
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
    theme: ${template.htmlTheme}
    css: styles.scss
    embed-resources: true
    title-block-banner: true
  pdf:
    documentclass: scrreprt
    pdf-engine: ${activePdfEngine(manifest)}
    mainfont: "${font}"
    CJKmainfont: "${font}"
    geometry:
      - margin=18mm
    colorlinks: true
    include-in-header: header.tex
    fig-pos: H
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
  const htmlVerificationPath = guideId === 'macos-app-install'
    ? path.join(path.dirname(verificationPath), 'macos-app-install-html-verification.json')
    : null;

  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(path.dirname(generatedMarkdownPath), { recursive: true });
  fs.mkdirSync(path.dirname(verificationPath), { recursive: true });
  const htmlFileName = path.basename(htmlOutputPath);
  if (htmlFileName === 'index.html') {
    throw new Error(`Published guide HTML must use the guide-aligned filename, not index.html: ${relativeToApp(htmlOutputPath)}`);
  }
  copyDir(path.join(projectDir, 'screenshots'), path.join(publicDir, 'screenshots'));
  const renderedPdf = fs.readdirSync(outputDir).find((name) => name.endsWith('.pdf'));
  if (!renderedPdf) {
    throw new Error(`Quarto book did not produce a PDF in ${relativeToApp(outputDir)}`);
  }
  fs.writeFileSync(
    htmlOutputPath,
    trimLineEndings(fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8').replaceAll('index.html', htmlFileName)),
    'utf8',
  );
  fs.copyFileSync(path.join(outputDir, renderedPdf), pdfOutputPath);
  fs.writeFileSync(
    generatedMarkdownPath,
    withGeneratedLifecycleFrontMatter(qmd, generatedLifecycleFrontMatter(manifest)),
    'utf8',
  );

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
    screenshots_manifest: screenshotManifestPath(manifest) ? relativeToApp(screenshotManifestPath(manifest)!) : null,
    generated_markdown: relativeToApp(generatedMarkdownPath),
    output_html: relativeToApp(htmlOutputPath),
    output_pdf: relativeToApp(pdfOutputPath),
    quarto_project_dir: relativeToApp(projectDir),
    publishing_template: manifest.publishing?.template ?? 'opl-guide',
    preferred_pdf_engine: preferredPdfEngine(manifest),
    pdf_engine: activePdfEngine(manifest),
    pdf_engine_reason: manifest.publishing?.pdf_engine_reason ?? null,
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
  if (htmlVerificationPath) {
    fs.writeFileSync(htmlVerificationPath, `${JSON.stringify(verification, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(verification, null, 2));
}

main();
