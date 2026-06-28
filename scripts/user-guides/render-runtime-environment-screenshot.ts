import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

type Fixture = {
  schema: string;
  viewport: { width: number; height: number };
  version: { app: string; gui: string; channel: string };
  runtime_cards: Array<{ title: string; status: string; tone: 'green' | 'orange'; detail: string }>;
  modules: Array<{ module_id: string; label: string; status: string; detail: string }>;
  maintenance_components: Array<{ id: string; label: string; status: string; description: string }>;
  managed_updates: Array<{ id: string; label: string; status: string }>;
  workspace: { root: string; logs: string; modules_root: string };
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixturePath = path.join(appRoot, 'docs', 'user-guides', 'fixtures', 'runtime-environment-currentness.fixture.json');
const assetPath = path.join(appRoot, 'docs', 'user-guides', 'assets', '06-research-data-folder.png');
const manifestPath = path.join(appRoot, 'docs', 'user-guides', 'macos-app-install-assets.json');
const shellRoot = fs.realpathSync(path.join(appRoot, 'shells', 'aionui'));
const requireFromApp = createRequire(import.meta.url);
const { chromium } = requireFromApp(path.join(shellRoot, 'node_modules', 'playwright')) as typeof import('playwright');

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function sha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function findBrowserExecutable(): string | undefined {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ];
  return candidates.find((candidate): candidate is string => Boolean(candidate && fs.existsSync(candidate)));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function assertFixture(fixture: Fixture): void {
  if (fixture.schema !== 'opl_guide_runtime_environment_fixture.v1') {
    throw new Error(`Unsupported runtime environment fixture schema: ${fixture.schema}`);
  }
  if (fixture.viewport.width !== 1536 || fixture.viewport.height !== 912) {
    throw new Error(`Guide screenshot viewport must stay 1536x912, got ${fixture.viewport.width}x${fixture.viewport.height}`);
  }
  if (fixture.modules.length !== 5) {
    throw new Error(`Guide runtime fixture must contain 5 default modules, got ${fixture.modules.length}`);
  }
  const renderedStateText = JSON.stringify({
    runtime_cards: fixture.runtime_cards,
    modules: fixture.modules,
    maintenance_components: fixture.maintenance_components,
    managed_updates: fixture.managed_updates,
  });
  if (/未知|unknown/i.test(renderedStateText)) {
    throw new Error('Guide runtime fixture must not render unknown module or maintenance status.');
  }
}

function badgeClass(tone: string): string {
  return tone === 'green' ? 'badge badge-green' : 'badge badge-orange';
}

function renderHtml(fixture: Fixture): string {
  const modules = fixture.modules
    .map(
      (module) => `
        <div class="module-row">
          <div class="min">
            <div class="strong">${escapeHtml(module.label)}</div>
            <div class="muted">${escapeHtml(module.detail)}</div>
          </div>
          <span class="badge badge-green">${escapeHtml(module.status)}</span>
        </div>`
    )
    .join('');
  const maintenance = fixture.maintenance_components
    .map(
      (component) => `
        <div class="action-card">
          <div class="action-head">
            <div class="strong">${escapeHtml(component.label)}</div>
            <span class="badge badge-green">${escapeHtml(component.status)}</span>
          </div>
          <div class="muted">${escapeHtml(component.description)}</div>
        </div>`
    )
    .join('');
  const cards = fixture.runtime_cards
    .map(
      (card) => `
        <div class="small-card">
          <div class="strong">${escapeHtml(card.title)}</div>
          <span class="${badgeClass(card.tone)}">${escapeHtml(card.status)}</span>
          <div class="muted">${escapeHtml(card.detail)}</div>
        </div>`
    )
    .join('');
  const managedUpdates = fixture.managed_updates
    .map(
      (item) => `
        <div class="update-card">
          <div class="strong">${escapeHtml(item.label)}</div>
          <span class="badge badge-green">${escapeHtml(item.status)}</span>
        </div>`
    )
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>One Person Lab App - 本机运行环境</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; width: ${fixture.viewport.width}px; height: ${fixture.viewport.height}px; overflow: hidden; background: #f7f8fa; color: #1d2129; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Segoe UI", sans-serif; font-size: 14px; }
    .app { display: grid; grid-template-columns: 260px 1fr; width: 100%; height: 100%; }
    .sidebar { background: #f2f3f5; border-right: 1px solid #e5e6eb; padding: 18px 8px 8px; display: flex; flex-direction: column; }
    .brand { display: flex; align-items: center; gap: 12px; padding: 32px 12px 28px; font-weight: 650; font-size: 16px; color: #111827; }
    .brand-icon { width: 30px; height: 30px; border-radius: 50%; border: 1px solid #c9cdd4; background: radial-gradient(circle at 50% 45%, #ffffff 0 38%, #3b82f6 39% 47%, #ffffff 48%); }
    .group { margin: 8px 0 4px; padding: 0 12px; color: #86909c; font-size: 14px; }
    .nav { height: 34px; border-radius: 8px; padding: 0 12px; display: flex; align-items: center; gap: 10px; color: #1d2129; margin-bottom: 4px; }
    .nav.active { background: #e5e6eb; font-weight: 650; }
    .spacer { flex: 1; border-bottom: 1px solid #e5e6eb; }
    .back { height: 34px; width: 202px; margin-top: 8px; border-radius: 7px; background: #e5e6eb; display: flex; align-items: center; gap: 8px; padding: 0 12px; }
    main { overflow: hidden; padding: 56px 40px 36px 124px; }
    .content { width: 1024px; display: flex; flex-direction: column; gap: 16px; }
    h1 { margin: 0 0 10px; font-size: 24px; line-height: 1.25; letter-spacing: 0; }
    .desc { color: #4e5969; margin-bottom: 2px; }
    .card { background: #fff; border: 1px solid #e5e6eb; border-radius: 8px; padding: 16px; }
    .toolbar { height: 74px; display: flex; align-items: center; gap: 8px; }
    button { border: 0; height: 32px; padding: 0 14px; border-radius: 2px; background: #f2f3f5; color: #4e5969; font: inherit; }
    button.primary { background: #4e5969; color: #fff; }
    .version { display: flex; justify-content: space-between; align-items: center; min-height: 74px; }
    .section-title { font-weight: 650; margin-bottom: 4px; }
    .muted { color: #4e5969; font-size: 12px; line-height: 1.55; }
    .strong { font-weight: 650; color: #111827; line-height: 1.45; }
    .min { min-width: 0; }
    .badge { display: inline-flex; align-items: center; width: max-content; min-height: 24px; padding: 2px 10px; border-radius: 2px; font-size: 12px; font-weight: 600; }
    .badge-green { background: #e8ffea; color: #15803d; }
    .badge-orange { background: #fff7e8; color: #f77234; }
    .maintenance-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
    .tagline { display: flex; gap: 8px; margin-top: 8px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .panel { border: 1px solid #c9cdd4; border-radius: 8px; background: #f7f8fa; padding: 12px; min-height: 342px; }
    .module-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-top: 1px solid #e5e6eb; }
    .module-row:first-of-type { border-top: 0; }
    .action-card { border: 1px solid #c9cdd4; border-radius: 8px; background: #f2f3f5; padding: 12px; margin-top: 10px; min-height: 84px; }
    .action-head { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
    .small-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .small-card { background: #fff; border: 1px solid #e5e6eb; border-radius: 8px; padding: 18px 16px; display: flex; flex-direction: column; gap: 8px; min-height: 114px; }
    .workspace { min-height: 74px; }
    .updates-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .update-card { border: 1px solid #e5e6eb; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; gap: 8px; align-items: center; min-height: 56px; background: #f7f8fa; }
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="brand"><div class="brand-icon"></div><span>One Person Lab App</span></div>
      <div class="group">通用</div>
      <div class="nav">◴ 通用</div>
      <div class="nav">◎ 访问</div>
      <div class="nav">⚡ 智能体与能力</div>
      <div class="group">本机运行</div>
      <div class="nav active">▣ 本机运行环境</div>
      <div class="nav">▧ 存储</div>
      <div class="nav">◰ 外观</div>
      <div class="group">高级</div>
      <div class="nav">▦ 高级</div>
      <div class="group">其他</div>
      <div class="nav">ⓘ 关于与更新</div>
      <div class="spacer"></div>
      <div class="back">◉ 返回聊天</div>
    </aside>
    <main>
      <div class="content">
        <div>
          <h1>本机运行环境</h1>
          <div class="desc">检查 Codex CLI、Temporal、工作目录、日志目录、更新和 OPL 智能体模块就绪状态。</div>
        </div>
        <div class="card toolbar">
          <button class="primary">◎ 运行诊断</button>
          <button>⟳ 刷新</button>
          <button>▱ 修复 OPL</button>
        </div>
        <div class="card version">
          <div>
            <div class="section-title">版本号</div>
            <div class="muted">应用 ${escapeHtml(fixture.version.app)} · 界面 ${escapeHtml(fixture.version.gui)} · ${escapeHtml(fixture.version.channel)}</div>
          </div>
          <button>◎ 检查更新</button>
        </div>
        <section class="card">
          <div class="maintenance-head">
            <div>
              <div class="section-title">智能体模块维护</div>
              <div class="muted">维护 OPL 智能体模块、打包技能和可见能力。App 更新仍在「关于与更新」中处理；这里仅通过 OPL 托管更新内核执行。</div>
              <div class="tagline"><span class="badge badge-green">5 / 5 个模块就绪</span></div>
            </div>
            <button>⟳ 检查模块更新</button>
          </div>
          <div class="two-col">
            <div class="panel">
              <div class="strong">已安装智能体模块</div>
              ${modules}
            </div>
            <div class="panel">
              <div class="strong">模块维护动作</div>
              <div class="muted">通过 OPL 检查、应用、修复或回滚托管智能体和能力暴露变更，不绕过内核。</div>
              ${maintenance}
            </div>
          </div>
        </section>
        <section class="card">
          <div class="maintenance-head">
            <div>
              <div class="section-title">更新与维护</div>
              <div class="muted">统一展示桌面 App、运行时工具链、托管智能体包通道和可见能力暴露的 OPL 更新状态。</div>
              <div class="tagline"><span class="badge badge-green">stable</span><span class="badge badge-green">not_acquired_for_projection</span></div>
            </div>
            <div><button>⟳ 刷新状态</button> <button>检查</button> <button>计划</button></div>
          </div>
          <div class="updates-grid">${managedUpdates}</div>
        </section>
        <div class="small-grid">${cards}</div>
        <section class="card workspace">
          <div class="section-title">工作目录</div>
          <div class="muted">${escapeHtml(fixture.workspace.root)}</div>
        </section>
      </div>
    </main>
  </div>
</body>
</html>`;
}

async function main(): Promise<void> {
  const fixture = readJson<Fixture>(fixturePath);
  assertFixture(fixture);

  const browserExecutable = findBrowserExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable, channel: undefined } : {}),
  });
  const page = await browser.newPage({ viewport: fixture.viewport, deviceScaleFactor: 1 });
  await page.setContent(renderHtml(fixture), { waitUntil: 'load' });
  await page.screenshot({ path: assetPath, fullPage: false });
  await browser.close();

  const manifest = readJson<Record<string, any>>(manifestPath);
  const asset = manifest.assets?.['06-research-data-folder.png'];
  if (!asset) throw new Error('Missing 06-research-data-folder.png entry in guide asset manifest.');
  const imageSha = sha256(assetPath);
  const fixtureSha = sha256(fixturePath);
  Object.assign(asset, {
    source_kind: 'rendered_opl_app_state_fixture',
    source: 'docs/user-guides/fixtures/runtime-environment-currentness.fixture.json',
    source_width: fixture.viewport.width,
    source_height: fixture.viewport.height,
    source_sha256: fixtureSha,
    width: fixture.viewport.width,
    height: fixture.viewport.height,
    sha256: imageSha,
    vm_artifact_status: 'replaced_by_rendered_fixture',
    vm_artifact_source: 'docs/user-guides/fixtures/runtime-environment-currentness.fixture.json',
    note:
      'Re-rendered after the Full runtime currentness repair because the original v26.6.27 VM guide artifact captured stale packaged-runtime state and displayed unknown module statuses.',
  });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        output: path.relative(appRoot, assetPath),
        fixture: path.relative(appRoot, fixturePath),
        width: fixture.viewport.width,
        height: fixture.viewport.height,
        sha256: imageSha,
        source_sha256: fixtureSha,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
