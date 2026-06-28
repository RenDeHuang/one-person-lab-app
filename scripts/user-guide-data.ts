import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export type GuideStep = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  asset: string;
  callouts: string[];
  notes: string[];
  speaker_notes: string;
};

export type GuideDocument = {
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
    latest_release_url: string;
    stable_install_command: string;
    recommended_first_install_asset: string;
  };
  cover: {
    image_asset: string;
    description: string;
  };
  prepare_checklist: string[];
  steps: GuideStep[];
  faqs: string[];
  verification_callouts: string[];
  provenance_notes: string[];
};

export type AssetVerification = {
  dimensions: Record<string, { width: number; height: number }>;
  assets: Record<string, Record<string, unknown>>;
};

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const guideDir = path.join(appRoot, 'docs', 'user-guides');
export const assetDir = path.join(guideDir, 'assets');
export const assetManifestPath = path.join(guideDir, 'macos-app-install-assets.json');
export const guideSourcePath = path.join(guideDir, 'macos-app-install.guide.json');
export const markdownPath = path.join(guideDir, 'macos-app-install.md');
export const detailedPdfPath = path.join(guideDir, 'macos-app-install-detailed-guide.pdf');
export const detailedPdfVerificationPath = path.join(guideDir, 'macos-app-install-verification.json');
export const slideMarkdownPath = path.join(guideDir, 'macos-app-install-slides.md');
export const slideThemePath = path.join(guideDir, 'macos-app-install-marp-theme.css');
export const slidePptxPath = path.join(guideDir, 'macos-app-install-slides.pptx');
export const slidePdfPath = path.join(guideDir, 'macos-app-install-slides.pdf');
export const slideVerificationPath = path.join(guideDir, 'macos-app-install-slides-verification.json');
export const htmlDir = path.join(guideDir, 'site');
export const htmlPath = path.join(htmlDir, 'index.html');
export const htmlVerificationPath = path.join(guideDir, 'macos-app-install-html-verification.json');

const forbiddenPatterns = [
  /sk-[A-Za-z0-9_-]+/,
  /OPENAI_API_KEY/,
  /CODEX_API_KEY/,
  /opl-first-run-smoke-guide-key/,
];

export function run(command: string, args: string[], options: { cwd?: string } = {}) {
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

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function loadGuide() {
  const guide = loadJson<GuideDocument>(guideSourcePath);
  assertGuideShape(guide);
  return guide;
}

export function loadAssetManifest() {
  return loadJson<Record<string, any>>(assetManifestPath);
}

export function screenshotReleaseTag(assetManifest = loadAssetManifest()) {
  return process.env.OPL_APP_GUIDE_SCREENSHOT_RELEASE_TAG || assetManifest.release_tag || 'unknown';
}

export function expandTemplate(text: string, guide: GuideDocument, assetManifest = loadAssetManifest()) {
  return text
    .replaceAll('{latest_release_url}', guide.download.latest_release_url)
    .replaceAll('{stable_install_command}', guide.download.stable_install_command)
    .replaceAll('{screenshot_release_tag}', screenshotReleaseTag(assetManifest));
}

export function expandList(items: string[], guide: GuideDocument, assetManifest = loadAssetManifest()) {
  return items.map((item) => expandTemplate(item, guide, assetManifest));
}

function imageInfo(filePath: string) {
  const result = run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath]);
  const width = Number(result.stdout.match(/pixelWidth:\s+(\d+)/)?.[1] ?? 0);
  const height = Number(result.stdout.match(/pixelHeight:\s+(\d+)/)?.[1] ?? 0);
  return { width, height };
}

function fileSha256(filePath: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function scanTextForSecrets(text: string) {
  const hits = forbiddenPatterns.filter((pattern) => pattern.test(text)).map(String);
  if (hits.length > 0) {
    throw new Error(`Guide text contains forbidden sensitive marker(s): ${hits.join(', ')}`);
  }
}

export function assertGuideAssets(label: string, guide = loadGuide(), assetManifest = loadAssetManifest()): AssetVerification {
  const assetNames = new Set(guide.steps.map((step) => step.asset));
  assetNames.add(guide.cover.image_asset);
  const missing = [...assetNames].filter((asset) => !fs.existsSync(path.join(assetDir, asset)));
  if (missing.length > 0) {
    throw new Error(`Missing ${label} screenshot assets:\n${missing.join('\n')}`);
  }

  const dimensions: Record<string, { width: number; height: number }> = {};
  const assets: Record<string, Record<string, unknown>> = {};
  const assetHashes = new Map<string, string>();
  for (const asset of assetNames) {
    const filePath = path.join(assetDir, asset);
    const info = imageInfo(filePath);
    const expected = assetManifest.assets?.[asset];
    if (!expected) {
      throw new Error(`Missing ${label} screenshot provenance in ${path.relative(appRoot, assetManifestPath)}: ${asset}`);
    }
    const sha256 = fileSha256(filePath);
    const expectedWidth = expectedAssetNumber(expected, 'width', asset, label);
    const expectedHeight = expectedAssetNumber(expected, 'height', asset, label);
    const expectedSha256 = expectedAssetSha256(expected, asset, label);
    dimensions[asset] = info;
    if (info.width !== expectedWidth || info.height !== expectedHeight) {
      throw new Error(`Expected ${asset} to be ${expectedWidth}x${expectedHeight}, got ${info.width}x${info.height}`);
    }
    if (sha256 !== expectedSha256) {
      throw new Error(`${label} screenshot hash mismatch for ${asset}: expected ${expectedSha256}, got ${sha256}`);
    }
    assetHashes.set(asset, sha256);
    assets[asset] = {
      title: expected.title,
      source_kind: expected.source_kind,
      source: expected.source,
      source_width: expected.source_width,
      source_height: expected.source_height,
      source_sha256: expected.source_sha256,
      width: info.width,
      height: info.height,
      sha256,
    };
  }
  const accessSetupHash = assetHashes.get('03-codex-config-needed.png');
  const firstRunCheckingHash = assetHashes.get('04-first-run-checking.png');
  if (accessSetupHash && firstRunCheckingHash && accessSetupHash === firstRunCheckingHash) {
    throw new Error(
      `${label} guide screenshots must show distinct access setup and first-run checking states; 03-codex-config-needed.png and 04-first-run-checking.png have the same hash.`
    );
  }
  return { dimensions, assets };
}

export function screenshotSourceVerification(assetManifest = loadAssetManifest()) {
  return {
    source: assetManifest.screenshot_source,
    release_run_id: assetManifest.release_run?.id,
    release_run_url: assetManifest.release_run?.url,
    release_run_conclusion: assetManifest.release_run?.conclusion,
  };
}

export function relativeToApp(filePath: string) {
  return path.relative(appRoot, filePath);
}

export function renderPdfPages(options: { tempDir: string; pdfPath: string; pagePrefix: string }) {
  const renderDir = path.join(options.tempDir, 'rendered');
  fs.rmSync(renderDir, { recursive: true, force: true });
  fs.mkdirSync(renderDir, { recursive: true });
  run('pdftoppm', ['-png', '-r', '120', options.pdfPath, path.join(renderDir, options.pagePrefix)]);
  const pages = fs.readdirSync(renderDir).filter((name) => name.endsWith('.png')).sort();
  return { renderDir, pages };
}

export function readPdfInfo(pdfPath: string) {
  return run('pdfinfo', [pdfPath]).stdout;
}

export function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function expectedAssetNumber(expected: Record<string, unknown>, key: string, asset: string, label: string) {
  const value = Number(expected[key]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} screenshot provenance for ${asset} must include positive numeric ${key}`);
  }
  return value;
}

function expectedAssetSha256(expected: Record<string, unknown>, asset: string, label: string) {
  const value = typeof expected.sha256 === 'string' ? expected.sha256.trim() : '';
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} screenshot provenance for ${asset} must include sha256`);
  }
  return value;
}

function assertGuideShape(guide: GuideDocument) {
  if (guide.schema !== 'opl_user_guide.v1') {
    throw new Error(`Unsupported guide schema: ${guide.schema}`);
  }
  if (!guide.title || !guide.download?.latest_release_url || !guide.download?.stable_install_command) {
    throw new Error('Guide source is missing title or download metadata');
  }
  if (!Array.isArray(guide.steps) || guide.steps.length === 0) {
    throw new Error('Guide source must define at least one step');
  }
  const ids = new Set<string>();
  for (const step of guide.steps) {
    if (!step.id || !step.title || !step.body || !step.asset) {
      throw new Error(`Guide step is missing required fields: ${JSON.stringify(step)}`);
    }
    if (ids.has(step.id)) throw new Error(`Duplicate guide step id: ${step.id}`);
    ids.add(step.id);
  }
}
