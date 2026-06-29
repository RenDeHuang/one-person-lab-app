#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

type DockerGuideStep = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  visual_title: string;
  visual_lines: string[];
  callouts: string[];
  notes: string[];
  asset?: string;
};

type DockerGuide = {
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
  security_notice: string;
  download: {
    image: string;
    local_image: string;
    source_repo: string;
    support_reference_url: string;
  };
  cover: {
    description: string;
  };
  prepare_checklist: string[];
  steps: DockerGuideStep[];
  faqs: string[];
  verification_callouts: string[];
  provenance_notes: string[];
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guideDir = path.join(appRoot, 'docs', 'delivery', 'user-guides', 'docker-webui-install');
const assetsDir = path.join(guideDir, 'assets');
const sourcePath = path.join(guideDir, 'source', 'docker-webui-install.guide.json');
const generatedDir = path.join(guideDir, 'generated');
const verificationDir = path.join(guideDir, 'verification');
const publicDir = path.join(appRoot, 'docs', 'public', 'docker-webui-install');
const markdownPath = path.join(generatedDir, 'docker-webui-install.md');
const htmlPath = path.join(publicDir, 'index.html');
const pdfPath = path.join(publicDir, 'docker-webui-install-detailed-guide.pdf');
const verificationPath = path.join(verificationDir, 'docker-webui-install-verification.json');
const tempDir = path.join(appRoot, 'tmp', 'pdfs', 'docker-webui-install');
const tempMarkdownPath = path.join(tempDir, 'docker-webui-install.pandoc.md');
const tempHeaderPath = path.join(tempDir, 'docker-webui-install-header.tex');

const forbiddenPatterns = [
  /sk-[A-Za-z0-9_-]+/,
  /OPENAI_API_KEY/,
  /CODEX_API_KEY/,
  /OPL_CODEX_API_KEY\s*=\s*[^`\s]+/,
];

function run(command: string, args: string[], options: { env?: NodeJS.ProcessEnv } = {}) {
  const result = spawnSync(command, args, {
    cwd: appRoot,
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

function loadGuide() {
  const guide = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as DockerGuide;
  if (guide.schema !== 'opl_docker_webui_user_guide.v1') {
    throw new Error(`Unsupported Docker/WebUI guide schema: ${guide.schema}`);
  }
  if (!guide.title || !guide.download?.image || !Array.isArray(guide.steps) || guide.steps.length < 6) {
    throw new Error('Docker/WebUI guide source is missing required title, image, or steps.');
  }
  const ids = new Set<string>();
  for (const step of guide.steps) {
    if (!step.id || !step.title || !step.body || !step.visual_lines.length) {
      throw new Error(`Docker/WebUI guide step is incomplete: ${JSON.stringify(step)}`);
    }
    if (ids.has(step.id)) throw new Error(`Duplicate Docker/WebUI guide step id: ${step.id}`);
    ids.add(step.id);
  }
  return guide;
}

function relativeToApp(filePath: string) {
  return path.relative(appRoot, filePath);
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

function stablePdfFontSubsetTag(fontName: string) {
  const digest = crypto.createHash('sha256').update(fontName).digest();
  return Array.from(digest.subarray(0, 6), (byte) => String.fromCharCode(65 + (byte % 26))).join('');
}

function normalizePdfFontSubsetPrefixes(filePath: string) {
  const source = fs.readFileSync(filePath, 'latin1');
  const fontPattern = /\/(?:FontName|BaseFont|CMapName)\s*\/([A-Z]{6})\+([A-Za-z0-9_.-]+)/g;
  const replacements = new Map<string, string>();
  for (const match of source.matchAll(fontPattern)) {
    const originalTag = match[1];
    const rawName = match[2];
    const fontName = rawName.replace(/-(?:Identity-H|UTF16)$/, '');
    replacements.set(`${originalTag}+${fontName}`, `${stablePdfFontSubsetTag(fontName)}+${fontName}`);
  }
  if (replacements.size === 0) {
    throw new Error(`Expected PDF font subset prefixes to normalize: ${filePath}`);
  }
  let normalized = source;
  for (const [from, to] of replacements) {
    if (from.length !== to.length) {
      throw new Error(`PDF font subset replacement must preserve byte length: ${from} -> ${to}`);
    }
    normalized = normalized.replaceAll(from, to);
  }
  fs.writeFileSync(filePath, Buffer.from(normalized, 'latin1'));
}

function normalizePdfTrailerId(filePath: string) {
  const source = fs.readFileSync(filePath, 'latin1');
  const idPattern = /\/ID\s*\[\s*<[0-9A-Fa-f]{32}>\s*<[0-9A-Fa-f]{32}>\s*\]/g;
  const withoutId = source.replace(idPattern, '/ID[<OPL_PDF_STABLE_ID_PLACEHOLDER><OPL_PDF_STABLE_ID_PLACEHOLDER>]');
  if (withoutId === source) {
    throw new Error(`Expected PDF trailer ID to normalize: ${filePath}`);
  }
  const stableId = crypto.createHash('sha256').update(withoutId, 'latin1').digest('hex').slice(0, 32);
  const normalized = source.replace(idPattern, `/ID[<${stableId}><${stableId}>]`);
  fs.writeFileSync(filePath, Buffer.from(normalized, 'latin1'));
}

function validateAssets(guide: DockerGuide) {
  const seen = new Set<string>();
  const assets: Array<{
    step: string;
    file: string;
    public_file: string;
    sha256: string;
    width: number;
    height: number;
  }> = [];
  for (const step of guide.steps) {
    if (!step.asset) continue;
    if (step.asset.includes('/') || step.asset.includes('\\')) {
      throw new Error(`Docker/WebUI guide asset must be a plain filename: ${step.asset}`);
    }
    const filePath = path.join(assetsDir, step.asset);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Docker/WebUI guide asset does not exist: ${relativeToApp(filePath)}`);
    }
    const dims = readPngDimensions(filePath);
    if (dims.width < 900 || dims.height < 500) {
      throw new Error(`Docker/WebUI guide asset is too small: ${relativeToApp(filePath)} ${dims.width}x${dims.height}`);
    }
    seen.add(step.asset);
    assets.push({
      step: step.id,
      file: relativeToApp(filePath),
      public_file: `assets/${step.asset}`,
      sha256: hashFile(filePath),
      width: dims.width,
      height: dims.height,
    });
  }
  return { seen, assets };
}

function copyAssets(assetNames: Set<string>) {
  const publicAssetsDir = path.join(publicDir, 'assets');
  fs.rmSync(publicAssetsDir, { recursive: true, force: true });
  fs.mkdirSync(publicAssetsDir, { recursive: true });
  for (const asset of assetNames) {
    fs.copyFileSync(path.join(assetsDir, asset), path.join(publicAssetsDir, asset));
  }
}

function scanTextForSecrets(text: string) {
  const hits = forbiddenPatterns.filter((pattern) => pattern.test(text)).map(String);
  if (hits.length > 0) {
    throw new Error(`Docker/WebUI guide text contains forbidden sensitive marker(s): ${hits.join(', ')}`);
  }
}

function expandTemplate(text: string, guide: DockerGuide) {
  return text
    .replaceAll('{image}', guide.download.image)
    .replaceAll('{local_image}', guide.download.local_image)
    .replaceAll('{source_repo}', guide.download.source_repo)
    .replaceAll('{support_reference_url}', guide.download.support_reference_url);
}

function expandList(items: string[], guide: DockerGuide) {
  return items.map((item) => expandTemplate(item, guide));
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inlineMarkdown(value: string) {
  const codeSegments: string[] = [];
  const withPlaceholders = escapeHtml(value).replace(/`([^`]+)`/g, (_match, code) => {
    const token = `@@CODE_${codeSegments.length}@@`;
    codeSegments.push(`<code>${code}</code>`);
    return token;
  });
  const linked = withPlaceholders.replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return codeSegments.reduce((text, code, index) => text.replace(`@@CODE_${index}@@`, code), linked);
}

function buildMarkdown(guide: DockerGuide) {
  const lines: string[] = [
    `# ${guide.title}`,
    '',
    `Owner: \`${guide.owner}\``,
    `Purpose: \`${guide.purpose}\``,
    `State: \`${guide.state}\``,
    `Machine boundary: ${guide.machine_boundary}`,
    '',
    `适用对象：${guide.audience}`,
    '',
    guide.intro,
    '',
    `镜像：\`${guide.download.image}\``,
    '',
    `参考：${guide.download.support_reference_url}`,
    '',
    `> ${guide.security_notice}`,
    '',
    '## 准备清单',
    '',
  ];
  for (const item of expandList(guide.prepare_checklist, guide)) lines.push(`- ${item}`);
  lines.push('');
  for (const step of guide.steps) {
    lines.push(`## ${step.title}`, '', expandTemplate(step.body, guide), '', `**${step.visual_title}**`, '', '```text');
    for (const line of expandList(step.visual_lines, guide)) lines.push(line);
    lines.push('```', '');
    if (step.asset) lines.push(`![${step.visual_title}](../assets/${step.asset})`, '');
    lines.push('重点：', '');
    for (const callout of expandList(step.callouts, guide)) lines.push(`- ${callout}`);
    lines.push('', '说明：', '');
    for (const note of expandList(step.notes, guide)) lines.push(`- ${note}`);
    lines.push('');
  }
  lines.push('## 常见问题', '');
  for (const faq of expandList(guide.faqs, guide)) lines.push(`- ${faq}`);
  lines.push('', '## 验证方式', '');
  for (const callout of expandList(guide.verification_callouts, guide)) lines.push(`- ${callout}`);
  lines.push('', '## 来源与边界', '');
  for (const note of expandList(guide.provenance_notes, guide)) lines.push(`- ${note}`);
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

function normalizePdfInlineCode(markdown: string) {
  return markdown;
}

function buildPdfMarkdown(guide: DockerGuide, markdown: string) {
  const cover = [
    '\\begin{titlepage}',
    '\\thispagestyle{empty}',
    '\\vspace*{24mm}',
    '{\\color{OPLTeal}\\Large One Person Lab App\\par}',
    '\\vspace{18mm}',
    `{\\LARGE\\bfseries ${guide.title}\\par}`,
    '\\vspace{8mm}',
    `{\\Large ${guide.short_title}\\par}`,
    '\\vspace{14mm}',
    `{\\large ${guide.audience}${guide.intro}\\par}`,
    '\\vspace{10mm}',
    `{\\small 镜像：${guide.download.image}\\par}`,
    '\\vfill',
    '{\\small Public Docker/WebUI user guide\\par}',
    '\\end{titlepage}',
    '\\newpage',
    '\\tableofcontents',
    '\\newpage',
    '',
  ].join('\n');
  const body = normalizePdfInlineCode(stripRepositoryMetadata(markdown))
    .replace(/^# .+\n\n/, '')
    .replace(/^## /gm, '# ')
    .replace(/\]\(\.\.\/assets\/([^)]+)\)/g, (_match, asset) => `](${path.join(assetsDir, asset)})`);
  return `${cover}${body}`;
}

function buildHeader() {
  return String.raw`
\usepackage{xcolor}
\usepackage{fancyhdr}
\usepackage{titlesec}
\usepackage{enumitem}
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
\rhead{\small\color{OPLMuted}Docker/WebUI guide}
\cfoot{\small\thepage}
\renewcommand{\headrulewidth}{0.3pt}
\renewcommand{\headrule}{\hbox to\headwidth{\color{OPLLine}\leaders\hrule height \headrulewidth\hfill}}
`;
}

function renderList(items: string[], guide: DockerGuide, className: string) {
  return `<ul class="${className}">${expandList(items, guide).map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`;
}

function trimLineEndings(text: string) {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

function renderVisual(step: DockerGuideStep, guide: DockerGuide) {
  return `
    <figure class="visual">
      <figcaption>${escapeHtml(step.visual_title)}</figcaption>
      <pre>${escapeHtml(expandList(step.visual_lines, guide).join('\n'))}</pre>
      ${step.asset ? `<img src="assets/${escapeHtml(step.asset)}" alt="${escapeHtml(step.visual_title)}" loading="lazy" />` : ''}
    </figure>
  `;
}

function css() {
  return `
    :root {
      color-scheme: light;
      --bg: #f6f8fb;
      --surface: #ffffff;
      --ink: #101828;
      --muted: #5d6675;
      --line: #d8e0ea;
      --accent: #0f766e;
      --accent-strong: #0b5f59;
      --accent-soft: #e7f5f2;
      --warn-soft: #fff7e6;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); line-height: 1.65; letter-spacing: 0; }
    a { color: var(--accent-strong); text-underline-offset: 3px; }
    code { padding: 0.1rem 0.32rem; border-radius: 4px; background: #eef2f7; overflow-wrap: anywhere; }
    .shell { display: grid; grid-template-columns: minmax(220px, 270px) minmax(0, 1fr); min-height: 100vh; }
    .nav { position: sticky; top: 0; height: 100vh; padding: 28px 22px; border-right: 1px solid var(--line); background: rgba(255,255,255,0.94); overflow-y: auto; }
    .brand { color: var(--accent-strong); font-weight: 750; font-size: 13px; text-transform: uppercase; }
    .nav h2 { margin: 10px 0 20px; font-size: 22px; line-height: 1.2; }
    .nav a { display: block; padding: 7px 0; color: #344054; font-size: 14px; text-decoration: none; }
    .hero { padding: 54px clamp(24px, 5vw, 72px) 34px; background: var(--surface); border-bottom: 1px solid var(--line); }
    .hero-inner, .content { max-width: 1160px; margin: 0 auto; }
    .eyebrow { margin: 0 0 12px; color: var(--accent-strong); font-weight: 750; }
    h1 { margin: 0; font-size: clamp(34px, 5vw, 56px); line-height: 1.08; letter-spacing: 0; }
    .lede { margin: 18px 0 0; color: var(--muted); font-size: 19px; max-width: 820px; }
    .cta-row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
    .button { min-height: 42px; padding: 10px 15px; border: 1px solid var(--accent); border-radius: 6px; background: var(--accent); color: white; font-weight: 700; text-decoration: none; }
    .button.secondary { background: white; color: var(--accent-strong); }
    .command { margin-top: 18px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 8px; background: #111827; color: #f8fafc; overflow-x: auto; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .content { padding: 34px clamp(24px, 5vw, 72px) 72px; }
    .band, .step { margin-top: 22px; padding: 24px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
    .notice { background: var(--warn-soft); border-color: #f3d08f; }
    .step { display: grid; grid-template-columns: minmax(0, 1fr) minmax(290px, 0.8fr); gap: 22px; }
    .step h2, .band h2 { margin: 0 0 14px; font-size: 27px; line-height: 1.24; letter-spacing: 0; }
    .step p { margin: 0 0 14px; color: var(--muted); }
    .visual { margin: 0 0 18px; padding: 16px; border-radius: 8px; border: 1px solid #c7d3df; background: #f8fafc; }
    .visual figcaption { margin-bottom: 10px; color: var(--accent-strong); font-weight: 750; }
    .visual pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.45; }
    .visual img { display: block; width: 100%; height: auto; margin-top: 14px; border-radius: 6px; border: 1px solid #d8e0ea; background: white; }
    .callouts { margin: 0 0 18px; padding: 16px; border-radius: 8px; background: var(--accent-soft); border: 1px solid #b9ded7; }
    .callouts h3 { margin: 0 0 10px; color: var(--accent-strong); font-size: 16px; }
    .checklist, .faq-list, .notes { margin: 0; padding-left: 1.25rem; }
    .meta { color: var(--muted); font-size: 14px; }
    @media (max-width: 920px) {
      .shell { display: block; }
      .nav { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--line); }
      .step { grid-template-columns: 1fr; }
    }
  `;
}

function renderSteps(guide: DockerGuide) {
  return guide.steps.map((step) => `
    <article class="step" id="${escapeHtml(step.id)}">
      <div>
        <h2>${escapeHtml(step.title)}</h2>
        <p>${inlineMarkdown(expandTemplate(step.body, guide))}</p>
        ${renderVisual(step, guide)}
        ${renderList(step.notes, guide, 'notes')}
      </div>
      <aside class="callouts">
        <h3>本页重点</h3>
        ${renderList(step.callouts, guide, '')}
      </aside>
    </article>
  `).join('\n');
}

function buildHtml(guide: DockerGuide) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(guide.title)}</title>
  <style>${css()}</style>
</head>
<body>
  <div class="shell">
    <nav class="nav" aria-label="指南导航">
      <div class="brand">One Person Lab App</div>
      <h2>${escapeHtml(guide.short_title)}</h2>
      <a href="#start">开始</a>
      <a href="#prepare">准备清单</a>
      ${guide.steps.map((step) => `<a href="#${escapeHtml(step.id)}">${escapeHtml(step.title)}</a>`).join('\n      ')}
      <a href="#faq">常见问题</a>
      <a href="#provenance">验证来源</a>
    </nav>
    <main>
      <section class="hero" id="start">
        <div class="hero-inner">
          <p class="eyebrow">Linux / Windows / Server Docker WebUI</p>
          <h1>${escapeHtml(guide.title)}</h1>
          <p class="lede">${escapeHtml(guide.audience)}${escapeHtml(guide.intro)}</p>
          <div class="cta-row">
            <a class="button" href="${escapeHtml(guide.download.support_reference_url)}">查看部署参考</a>
            <a class="button secondary" href="docker-webui-install-detailed-guide.pdf">查看详细 PDF</a>
          </div>
          <div class="command">${escapeHtml(`docker run --rm -p 3000:3000 -v "$HOME/OnePersonLab/data:/data" -v "$HOME/OnePersonLab/projects:/projects" -e AIONUI_ALLOW_REMOTE=true -e AIONUI_DATA_DIR=/data -e OPL_PROJECTS_DIR=/projects ${guide.download.image}`)}</div>
        </div>
      </section>
      <div class="content">
        <section class="band notice">
          <strong>安全提醒</strong>
          <p>${inlineMarkdown(guide.security_notice)}</p>
        </section>
        <section class="band" id="prepare">
          <h2>准备清单</h2>
          ${renderList(guide.prepare_checklist, guide, 'checklist')}
        </section>
        ${renderSteps(guide)}
        <section class="band" id="faq">
          <h2>常见问题</h2>
          ${renderList(guide.faqs, guide, 'faq-list')}
        </section>
        <section class="band" id="provenance">
          <h2>验证来源</h2>
          ${renderList(guide.verification_callouts, guide, 'notes')}
          ${renderList(guide.provenance_notes, guide, 'notes')}
          <p class="meta">Guide source: ${escapeHtml(relativeToApp(sourcePath))}</p>
        </section>
      </div>
    </main>
  </div>
</body>
</html>
`;
}

function renderPdfPages() {
  const renderDir = path.join(tempDir, 'rendered');
  fs.rmSync(renderDir, { recursive: true, force: true });
  fs.mkdirSync(renderDir, { recursive: true });
  run('pdftoppm', ['-png', '-r', '120', pdfPath, path.join(renderDir, 'page')]);
  const pages = fs.readdirSync(renderDir).filter((name) => name.endsWith('.png')).sort();
  return { renderDir, pages };
}

function readPdfInfo() {
  return run('pdfinfo', [pdfPath]).stdout;
}

function extractPdfText() {
  return run('pdftotext', [pdfPath, '-']).stdout;
}

function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  const guide = loadGuide();
  const assetValidation = validateAssets(guide);
  const markdown = buildMarkdown(guide);
  const html = buildHtml(guide);
  scanTextForSecrets(JSON.stringify(guide));
  scanTextForSecrets(markdown);
  scanTextForSecrets(html);

  fs.mkdirSync(generatedDir, { recursive: true });
  fs.mkdirSync(verificationDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });
  copyAssets(assetValidation.seen);
  fs.writeFileSync(markdownPath, markdown, 'utf8');
  fs.writeFileSync(htmlPath, trimLineEndings(html), 'utf8');
  fs.writeFileSync(tempHeaderPath, buildHeader(), 'utf8');
  fs.writeFileSync(tempMarkdownPath, buildPdfMarkdown(guide, markdown), 'utf8');

  const font = process.env.OPL_APP_GUIDE_PDF_FONT || 'Noto Sans CJK SC';
  run('pandoc', [
    tempMarkdownPath,
    '--standalone',
    '--pdf-engine=xelatex',
    '--pdf-engine-opt=-output-driver=xdvipdfmx -z 0 -C 0x0060',
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
    '-o', pdfPath,
  ], {
    env: { ...process.env, SOURCE_DATE_EPOCH: '1782730800' },
  });
  normalizePdfFontSubsetPrefixes(pdfPath);
  normalizePdfTrailerId(pdfPath);

  const render = renderPdfPages();
  const info = readPdfInfo();
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  const pageSizeMatch = info.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m);
  const pageWidth = Number(pageSizeMatch?.[1] ?? 0);
  const pageHeight = Number(pageSizeMatch?.[2] ?? 0);
  if (pages < 6) throw new Error(`Expected Docker/WebUI guide PDF to have at least 6 pages, got ${pages}`);
  if (pageHeight <= pageWidth) throw new Error(`Expected portrait PDF, got ${pageWidth}x${pageHeight} pts`);
  if (html.length < 12_000) throw new Error(`Expected substantial HTML guide output, got ${html.length} bytes`);
  const text = extractPdfText();
  const requiredTerms = [
    guide.title,
    'macOS',
    'DMG',
    'Homebrew',
    'Linux',
    'Windows',
    'Docker/WebUI',
    'AIONUI_ALLOW_REMOTE',
    'ghcr.io/gaofeng21cn/one-person-lab-webui',
    '验证方式',
  ];
  const missingTerms = requiredTerms.filter((term) => !text.includes(term));
  if (missingTerms.length > 0) {
    throw new Error(`Generated Docker/WebUI PDF text is missing required terms: ${missingTerms.join(', ')}`);
  }

  const verification = {
    status: 'docker_webui_install_guide_ready',
    generator: 'single_json_to_html_markdown_pandoc_xelatex',
    source: relativeToApp(sourcePath),
    generated_markdown: relativeToApp(markdownPath),
    output_html: relativeToApp(htmlPath),
    output_pdf: relativeToApp(pdfPath),
    pandoc_markdown: relativeToApp(tempMarkdownPath),
    pandoc_header: relativeToApp(tempHeaderPath),
    pdf_layout: 'portrait_ebook',
    pdf_pages: pages,
    pdf_page_size_pts: {
      width: pageWidth,
      height: pageHeight,
    },
    rendered_pages: render.pages.length,
    rendered_dir: relativeToApp(render.renderDir),
    html_bytes: html.length,
    guide_steps: guide.steps.length,
    screenshot_assets: assetValidation.assets,
    image: guide.download.image,
    support_reference_url: guide.download.support_reference_url,
    required_terms: requiredTerms,
    required_terms_status: 'present',
  };
  writeJson(verificationPath, verification);
  console.log(JSON.stringify(verification, null, 2));
}

main();
