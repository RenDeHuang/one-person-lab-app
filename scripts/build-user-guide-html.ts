#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  appRoot,
  assetManifestPath,
  assertGuideAssets,
  detailedPdfPath,
  expandList,
  expandTemplate,
  guideSourcePath,
  htmlDir,
  htmlPath,
  htmlVerificationPath,
  loadAssetManifest,
  loadGuide,
  relativeToApp,
  scanTextForSecrets,
  sharePdfPath,
  sharePptxPath,
  screenshotReleaseTag,
  screenshotSourceVerification,
  slidePdfPath,
  slidePptxPath,
  writeJson,
} from './user-guide-data.ts';

const guide = loadGuide();
const assetManifest = loadAssetManifest();

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
      --shadow: 0 14px 38px rgba(16, 24, 40, 0.10);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.65;
      font-size: 16px;
      letter-spacing: 0;
    }
    a { color: var(--accent-strong); text-decoration-thickness: 1px; text-underline-offset: 3px; }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      padding: 0.1rem 0.32rem;
      border-radius: 4px;
      background: #eef2f7;
      color: #182230;
      word-break: break-word;
    }
    .shell {
      display: grid;
      grid-template-columns: minmax(220px, 270px) minmax(0, 1fr);
      min-height: 100vh;
    }
    .nav {
      position: sticky;
      top: 0;
      height: 100vh;
      padding: 28px 22px;
      border-right: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.92);
      overflow-y: auto;
    }
    .brand {
      font-size: 13px;
      font-weight: 700;
      color: var(--accent-strong);
      text-transform: uppercase;
    }
    .nav h2 {
      margin: 10px 0 20px;
      font-size: 22px;
      line-height: 1.2;
    }
    .nav a {
      display: block;
      padding: 7px 0;
      color: #344054;
      font-size: 14px;
      text-decoration: none;
    }
    .nav a:hover { color: var(--accent-strong); }
    .main {
      min-width: 0;
    }
    .hero {
      padding: 54px clamp(24px, 5vw, 72px) 34px;
      background: var(--surface);
      border-bottom: 1px solid var(--line);
    }
    .hero-grid {
      display: grid;
      grid-template-columns: minmax(0, 0.95fr) minmax(360px, 1.05fr);
      gap: 34px;
      align-items: center;
      max-width: 1240px;
      margin: 0 auto;
    }
    .hero-grid > *,
    .step > * {
      min-width: 0;
    }
    .eyebrow {
      margin: 0 0 12px;
      color: var(--accent-strong);
      font-weight: 750;
      font-size: 14px;
    }
    h1 {
      margin: 0;
      font-size: clamp(34px, 5vw, 58px);
      line-height: 1.08;
      letter-spacing: 0;
    }
    .lede {
      margin: 18px 0 0;
      color: var(--muted);
      font-size: 19px;
      max-width: 760px;
    }
    .cta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 26px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 10px 15px;
      border: 1px solid var(--accent);
      border-radius: 6px;
      background: var(--accent);
      color: white;
      font-weight: 700;
      text-decoration: none;
    }
    .button.secondary {
      background: white;
      color: var(--accent-strong);
    }
    .command {
      margin-top: 18px;
      max-width: 100%;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #111827;
      color: #f8fafc;
      overflow-x: auto;
      white-space: nowrap;
      font-size: 14px;
      line-height: 1.45;
    }
    .command code {
      padding: 0;
      background: transparent;
      color: inherit;
    }
    .hero-image,
    .step-image {
      width: 100%;
      height: auto;
      display: block;
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
      background: #eef2f7;
    }
    .content {
      max-width: 1240px;
      margin: 0 auto;
      padding: 34px clamp(24px, 5vw, 72px) 72px;
    }
    .band {
      margin-top: 22px;
      padding: 24px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
    }
    .band h2,
    .step h2 {
      margin: 0 0 14px;
      font-size: 27px;
      line-height: 1.24;
      letter-spacing: 0;
    }
    .checklist,
    .faq-list,
    .notes {
      margin: 0;
      padding-left: 1.25rem;
    }
    .step {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(270px, 0.75fr);
      gap: 24px;
      margin-top: 26px;
      padding: 24px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
    }
    .step p { margin: 0 0 14px; color: var(--muted); }
    .callouts {
      margin: 0 0 18px;
      padding: 16px;
      border-radius: 8px;
      background: var(--accent-soft);
      border: 1px solid #b9ded7;
    }
    .callouts h3,
    .artifact-grid h3 {
      margin: 0 0 10px;
      color: var(--accent-strong);
      font-size: 16px;
      letter-spacing: 0;
    }
    .callouts ul { margin: 0; padding-left: 1.15rem; }
    .artifact-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .artifact {
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfcfe;
    }
    .artifact p { margin: 0; color: var(--muted); }
    .notice {
      background: var(--warn-soft);
      border-color: #f3d08f;
    }
    .meta {
      color: var(--muted);
      font-size: 14px;
    }
    @media (max-width: 980px) {
      .shell { display: block; }
      .nav {
        position: static;
        height: auto;
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }
      .hero-grid,
      .step {
        grid-template-columns: 1fr;
      }
      .artifact-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
}

function assetPath(asset: string) {
  return `../assets/${encodeURIComponent(asset)}`;
}

function renderList(items: string[], className: string) {
  return `<ul class="${className}">${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`;
}

function renderSteps() {
  return guide.steps.map((step) => {
    const callouts = expandList(step.callouts, guide, assetManifest);
    const notes = expandList(step.notes, guide, assetManifest);
    return `
      <article class="step" id="${escapeHtml(step.id)}">
        <div>
          <h2>${escapeHtml(step.title)}</h2>
          <p>${inlineMarkdown(expandTemplate(step.body, guide, assetManifest))}</p>
          <img class="step-image" src="${assetPath(step.asset)}" alt="${escapeHtml(step.title)}" loading="lazy" />
        </div>
        <aside>
          <div class="callouts">
            <h3>本页重点</h3>
            ${renderList(callouts, '')}
          </div>
          ${renderList(notes, 'notes')}
        </aside>
      </article>
    `;
  }).join('\n');
}

function buildHtml() {
  const checklist = expandList(guide.prepare_checklist, guide, assetManifest);
  const faqs = expandList(guide.faqs, guide, assetManifest);
  const provenance = expandList(guide.provenance_notes, guide, assetManifest);
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(guide.title)}</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230f766e'/%3E%3Cpath d='M8 17.5 13.5 23 24 9' fill='none' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" />
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
      <a href="#artifacts">下载附件</a>
      <a href="#provenance">验证来源</a>
    </nav>
    <main class="main">
      <section class="hero" id="start">
        <div class="hero-grid">
          <div>
            <p class="eyebrow">macOS 首次安装与首启</p>
            <h1>${escapeHtml(guide.title)}</h1>
            <p class="lede">${escapeHtml(guide.audience)}${escapeHtml(guide.intro)}</p>
            <div class="cta-row">
              <a class="button" href="${escapeHtml(guide.download.latest_release_url)}">下载最新版本</a>
              <a class="button secondary" href="../macos-app-install-share.pdf">分享 PDF</a>
              <a class="button secondary" href="../macos-app-install-share.pptx">分享 PPTX</a>
              <a class="button secondary" href="../macos-app-install-detailed-guide.pdf">查看详细 PDF</a>
            </div>
            <div class="command" aria-label="稳定版一行安装命令"><code>${escapeHtml(guide.download.stable_install_command)}</code></div>
          </div>
          <img class="hero-image" src="${assetPath(guide.cover.image_asset)}" alt="One Person Lab 科研入口截图" />
        </div>
      </section>
      <div class="content">
        <section class="band notice">
          <strong>访问权限</strong>
          <p>${inlineMarkdown(guide.security_notice)}</p>
        </section>
        <section class="band" id="prepare">
          <h2>准备清单</h2>
          ${renderList(checklist, 'checklist')}
        </section>
        ${renderSteps()}
        <section class="band" id="faq">
          <h2>常见问题</h2>
          ${renderList(faqs, 'faq-list')}
        </section>
        <section class="band" id="artifacts">
          <h2>下载附件</h2>
          <div class="artifact-grid">
            <div class="artifact">
              <h3><a href="../macos-app-install-share.pdf">分享 PDF</a></h3>
              <p>HTML 以外的默认转发附件，16:9 图文教程，适合发给需要在电脑上照着安装的新用户。</p>
            </div>
            <div class="artifact">
              <h3><a href="../macos-app-install-share.pptx">分享 PPTX</a></h3>
              <p>同一 guide source 派生的可编辑分享版本，便于转发、演示和后续维护。</p>
            </div>
            <div class="artifact">
              <h3><a href="../macos-app-install-slides.pdf">图文 PDF</a></h3>
              <p>与分享 PDF 同源同版的兼容文件名，供既有 release note 和 onboarding 链接继续使用。</p>
            </div>
            <div class="artifact">
              <h3><a href="../macos-app-install-detailed-guide.pdf">详细 PDF</a></h3>
              <p>从同一 guide source 派生的长文说明。</p>
            </div>
            <div class="artifact">
              <h3><a href="../macos-app-install-slides.pptx">可编辑 PPTX</a></h3>
              <p>用于内部维护和演示编辑，不作为默认用户入口。</p>
            </div>
          </div>
        </section>
        <section class="band" id="provenance">
          <h2>截图与验证来源</h2>
          ${renderList(provenance, 'notes')}
          <p class="meta">Guide source: ${escapeHtml(relativeToApp(guideSourcePath))} · Screenshot manifest: ${escapeHtml(relativeToApp(assetManifestPath))}</p>
        </section>
      </div>
    </main>
  </div>
</body>
</html>
`;
  scanTextForSecrets(html);
  return html;
}

function main() {
  const { dimensions, assets } = assertGuideAssets('HTML guide', guide, assetManifest);
  fs.mkdirSync(htmlDir, { recursive: true });
  const html = buildHtml();
  fs.writeFileSync(htmlPath, html, 'utf8');
  const stats = fs.statSync(htmlPath);
  if (stats.size < 10_000) {
    throw new Error(`Expected substantial HTML guide output, got ${stats.size} bytes`);
  }
  const imageReferences = [...html.matchAll(/<img\b/g)].length;
  if (imageReferences < guide.steps.length + 1) {
    throw new Error(`Expected at least ${guide.steps.length + 1} image references, got ${imageReferences}`);
  }
  const verification = {
    status: 'macos_app_install_html_ready',
    output_html: relativeToApp(htmlPath),
    guide_source: relativeToApp(guideSourcePath),
    screenshot_release_tag: screenshotReleaseTag(assetManifest),
    screenshot_asset_manifest: relativeToApp(assetManifestPath),
    download_url: guide.download.latest_release_url,
    stable_install_command_present: html.includes(guide.download.stable_install_command),
    generated_artifacts: {
      share_pdf: relativeToApp(sharePdfPath),
      share_pptx: relativeToApp(sharePptxPath),
      slides_pdf: relativeToApp(slidePdfPath),
      slides_pptx: relativeToApp(slidePptxPath),
      detailed_pdf: relativeToApp(detailedPdfPath),
    },
    html_bytes: stats.size,
    guide_steps: guide.steps.length,
    image_references: imageReferences,
    screenshot_source: screenshotSourceVerification(assetManifest),
    screenshot_assets: assets,
    screenshot_dimensions: dimensions,
  };
  writeJson(htmlVerificationPath, verification);
  console.log(JSON.stringify(verification, null, 2));
}

main();
