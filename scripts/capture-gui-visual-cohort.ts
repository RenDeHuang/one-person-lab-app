import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INPUT_SCHEMA = "opl_app_gui_visual_capture_input.v1";
const RECEIPT_SCHEMA = "opl_app_gui_visual_capture_receipt.v1";
const PREFLIGHT_SCHEMA = "opl_app_installed_gui_cohort_preflight_receipt.v1";
const COMPARATOR_INPUT_SCHEMA = "opl_app_gui_visual_comparison_input.v1";
const EXPECTED_SCENE_COUNT = 16;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const INTERACTIVE_AX_ROLES = new Set([
  "button",
  "checkbox",
  "combobox",
  "link",
  "menuitem",
  "radio",
  "searchbox",
  "slider",
  "switch",
  "tab",
  "textbox",
]);

type JsonRecord = Record<string, unknown>;

type CaptureScene = {
  id: string;
  surface_family: string;
  viewport: string;
  theme: string;
  locale: string;
  route: string;
  state: string;
  image: string;
};

type CaptureInput = {
  schema: string;
  classification: string;
  contract_root: string;
  output_directory: string;
  preflight_receipt: string;
  preflight_receipt_sha256: string;
  conversation_id: string;
  reference_directory: string;
  diff_directory: string;
  display: {
    os_version: string;
    architecture: string;
    scale: string;
  };
};

type SceneObservation = {
  route: string;
  ready_state: string;
  text_length: number;
  overlay_count: number;
  theme: string;
  locale: string;
  viewport: { width: number; height: number };
  visible_test_ids: string[];
  focus: { before: string; after: string };
  live_regions: string[];
  unnamed_interactive_roles: string[];
  contrast: Array<{
    selector: string;
    ratio: number | null;
    visible: boolean;
  }>;
};

type SceneExecution = {
  interaction: string;
  result: JsonRecord;
};

type CaptureDriver = {
  beginScene(scene: CaptureScene): Promise<void>;
  applyAppearance(locale: string, theme: string): Promise<void>;
  navigate(route: string): Promise<void>;
  execute(scene: CaptureScene): Promise<SceneExecution>;
  observe(): Promise<SceneObservation>;
  screenshot(): Promise<Buffer>;
  drainErrors(): Promise<{ console: string[]; page: string[] }>;
  restore(): Promise<{ route: string; locale: string; theme: string }>;
  close(): Promise<void>;
};

type CaptureDependencies = {
  createDriver: (input: { endpoint: string; targetUrlIncludes: string }) => Promise<CaptureDriver>;
  now?: () => Date;
};

type CdpResponse = {
  id?: number;
  result?: JsonRecord;
  error?: { message?: string };
  method?: string;
  params?: JsonRecord;
};

function record(value: unknown, label = "value"): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function exactSha256(value: unknown, label: string): string {
  const digest = requiredString(value, label).toLowerCase();
  if (!SHA256_PATTERN.test(digest)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return digest;
}

function exactCommit(value: unknown, label: string): string {
  const commit = requiredString(value, label).toLowerCase();
  if (!COMMIT_PATTERN.test(commit)) {
    throw new Error(`${label} must be a lowercase 40-character Git commit`);
  }
  return commit;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return Number(value);
}

function sha256(bytes: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readJson(filePath: string, label: string): JsonRecord {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `${label} is not readable JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return record(value, label);
}

function resolveContained(root: string, candidate: string, label: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, candidate);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${label} must remain inside ${resolvedRoot}`);
  }
  return resolved;
}

function parseInput(value: unknown, baseDirectory: string): CaptureInput {
  const input = record(value, "capture input");
  if (input.schema !== INPUT_SCHEMA) {
    throw new Error(`capture input schema must be ${INPUT_SCHEMA}`);
  }
  const classification = requiredString(input.classification, "classification");
  if (!["diagnostic", "installed_acceptance_candidate"].includes(classification)) {
    throw new Error("classification must be diagnostic or installed_acceptance_candidate");
  }
  const display = record(input.display, "display");
  return {
    schema: INPUT_SCHEMA,
    classification,
    contract_root: path.resolve(
      baseDirectory,
      requiredString(input.contract_root, "contract_root"),
    ),
    output_directory: path.resolve(
      baseDirectory,
      requiredString(input.output_directory, "output_directory"),
    ),
    preflight_receipt: path.resolve(
      baseDirectory,
      requiredString(input.preflight_receipt, "preflight_receipt"),
    ),
    preflight_receipt_sha256: exactSha256(
      input.preflight_receipt_sha256,
      "preflight_receipt_sha256",
    ),
    conversation_id: requiredString(input.conversation_id, "conversation_id"),
    reference_directory: path.resolve(
      baseDirectory,
      requiredString(input.reference_directory, "reference_directory"),
    ),
    diff_directory: path.resolve(
      baseDirectory,
      requiredString(input.diff_directory, "diff_directory"),
    ),
    display: {
      os_version: requiredString(display.os_version, "display.os_version"),
      architecture: requiredString(display.architecture, "display.architecture"),
      scale: requiredString(display.scale, "display.scale"),
    },
  };
}

function readCaptureAuthority(contractRoot: string): {
  cohort: JsonRecord;
  cohortSha256: string;
  appContractSha256: string;
  scenes: CaptureScene[];
  viewports: Map<string, { width: number; height: number }>;
} {
  const cohortPath = path.join(contractRoot, "contracts/app-gui-visual-reference-cohort.json");
  const appContractPath = path.join(contractRoot, "contracts/app-gui-product-contract.json");
  const cohortBytes = fs.readFileSync(cohortPath);
  const appContractBytes = fs.readFileSync(appContractPath);
  const cohort = record(JSON.parse(cohortBytes.toString("utf8")), "visual cohort");
  if (cohort.schema !== "opl_app_gui_visual_reference_cohort.v1") {
    throw new Error("visual cohort contract has an unsupported schema");
  }
  const rawScenes = array(cohort.scene_matrix, "scene_matrix");
  if (rawScenes.length !== EXPECTED_SCENE_COUNT) {
    throw new Error(`scene_matrix must contain exactly ${EXPECTED_SCENE_COUNT} scenes`);
  }
  const ids = new Set<string>();
  const images = new Set<string>();
  const scenes = rawScenes.map((value, index) => {
    const scene = record(value, `scene_matrix[${index}]`);
    const parsed: CaptureScene = {
      id: requiredString(scene.id, `scene_matrix[${index}].id`),
      surface_family: requiredString(scene.surface_family, `scene_matrix[${index}].surface_family`),
      viewport: requiredString(scene.viewport, `scene_matrix[${index}].viewport`),
      theme: requiredString(scene.theme, `scene_matrix[${index}].theme`),
      locale: requiredString(scene.locale, `scene_matrix[${index}].locale`),
      route: requiredString(scene.route, `scene_matrix[${index}].route`),
      state: requiredString(scene.state, `scene_matrix[${index}].state`),
      image: requiredString(scene.image, `scene_matrix[${index}].image`),
    };
    if (ids.has(parsed.id)) throw new Error(`duplicate scene id ${parsed.id}`);
    if (images.has(parsed.image)) throw new Error(`duplicate scene image ${parsed.image}`);
    ids.add(parsed.id);
    images.add(parsed.image);
    return parsed;
  });
  const captureContract = record(cohort.capture_contract, "capture_contract");
  const rawViewports = record(
    captureContract.supported_viewports,
    "capture_contract.supported_viewports",
  );
  const viewports = new Map<string, { width: number; height: number }>();
  for (const [name, value] of Object.entries(rawViewports)) {
    const viewport = record(value, `supported_viewports.${name}`);
    viewports.set(name, {
      width: positiveInteger(viewport.width, `supported_viewports.${name}.width`),
      height: positiveInteger(viewport.height, `supported_viewports.${name}.height`),
    });
  }
  for (const scene of scenes) {
    if (!viewports.has(scene.viewport)) {
      throw new Error(`scene ${scene.id} references unknown viewport ${scene.viewport}`);
    }
  }
  return {
    cohort,
    cohortSha256: sha256(cohortBytes),
    appContractSha256: sha256(appContractBytes),
    scenes,
    viewports,
  };
}

function parsePreflight(input: CaptureInput): {
  receipt: JsonRecord;
  cohort: JsonRecord;
  runtime: JsonRecord;
  profile: JsonRecord;
  installedBound: boolean;
} {
  const bytes = fs.readFileSync(input.preflight_receipt);
  if (sha256(bytes) !== input.preflight_receipt_sha256) {
    throw new Error("preflight receipt SHA-256 does not match the receipt bytes");
  }
  const receipt = record(JSON.parse(bytes.toString("utf8")), "preflight receipt");
  if (receipt.schema !== PREFLIGHT_SCHEMA || receipt.status !== "passed") {
    throw new Error("preflight receipt must be a passed installed GUI cohort preflight");
  }
  const cohort = record(receipt.cohort, "preflight cohort");
  for (const field of ["app_sha", "shell_sha", "framework_sha"] as const) {
    exactCommit(cohort[field], `preflight cohort.${field}`);
  }
  const runtime = record(receipt.runtime, "preflight runtime");
  const profile = record(receipt.profile, "preflight profile");
  if (profile.kind !== "isolated" || profile.user_profile_protected !== true) {
    throw new Error("capture requires an isolated profile with user_profile_protected=true");
  }
  const claims = record(receipt.claims, "preflight claims");
  const installedBound =
    claims.same_cohort_installed === true &&
    claims.pid_executable_bound === true &&
    claims.cdp_pid_bound === true;
  if (input.classification === "installed_acceptance_candidate" && !installedBound) {
    throw new Error(
      "installed_acceptance_candidate requires same-cohort installed, PID, and CDP bindings",
    );
  }
  return { receipt, cohort, runtime, profile, installedBound };
}

function routeForScene(scene: CaptureScene, conversationId: string): string {
  return scene.route.replace(":id", encodeURIComponent(conversationId));
}

function screenshotDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24 || !bytes.subarray(1, 4).equals(Buffer.from("PNG"))) {
    throw new Error("captured screenshot is not a PNG");
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function sceneFailure(
  scene: CaptureScene,
  route: string,
  dimensions: { width: number; height: number },
  observation: SceneObservation,
  execution: SceneExecution,
  errors: { console: string[]; page: string[] },
): string | null {
  if (observation.ready_state !== "complete") return "document_not_complete";
  if (observation.text_length <= 0) return "blank_document";
  if (observation.overlay_count !== 0) return "error_overlay_visible";
  if (
    observation.viewport.width !== dimensions.width ||
    observation.viewport.height !== dimensions.height
  ) {
    return "viewport_mismatch";
  }
  if (!observation.route.startsWith(route)) return "route_identity_mismatch";
  if (observation.theme !== scene.theme) return "theme_mismatch";
  if (observation.locale !== scene.locale) return "locale_mismatch";
  if (execution.result.ok !== true) return "interaction_failed";
  if (observation.unnamed_interactive_roles.length > 0) {
    return "unnamed_interactive_control";
  }
  if (errors.console.length > 0) return "console_error";
  if (errors.page.length > 0) return "page_error";
  return null;
}

function bindingFor(
  scene: CaptureScene,
  authority: ReturnType<typeof readCaptureAuthority>,
  preflight: ReturnType<typeof parsePreflight>,
  input: CaptureInput,
  candidateDigest: string,
): JsonRecord {
  const reference = record(authority.cohort.reference, "reference");
  const candidate = record(authority.cohort.candidate, "candidate");
  const identity = record(preflight.receipt.identity, "preflight identity");
  return {
    scene_id: scene.id,
    reference_baseline_id: reference.baseline_id ?? "",
    reference_approval_receipt_sha256: reference.approval_receipt_sha256 ?? "",
    app_contract_ref: candidate.app_contract_ref ?? "",
    shell_commit: preflight.cohort.shell_sha,
    package_or_dev_build_identity: identity.package_or_build_identity ?? "unbound",
    os_version: input.display.os_version,
    architecture: input.display.architecture,
    display_scale: input.display.scale,
    viewport: scene.viewport,
    theme: scene.theme,
    locale: scene.locale,
    route: scene.route,
    state: scene.state,
    reference_screenshot_sha256: "",
    candidate_screenshot_sha256: candidateDigest,
    verdict: "pending_human_review",
  };
}

export async function captureGuiVisualCohort(
  rawInput: unknown,
  baseDirectory: string,
  dependencies: CaptureDependencies,
): Promise<JsonRecord> {
  const input = parseInput(rawInput, baseDirectory);
  const authority = readCaptureAuthority(input.contract_root);
  const preflight = parsePreflight(input);
  if (
    input.output_directory === input.reference_directory ||
    input.output_directory === input.diff_directory
  ) {
    throw new Error("capture output, reference, and diff directories must be distinct");
  }
  fs.mkdirSync(input.output_directory, { recursive: true });
  const candidateDirectory = resolveContained(
    input.output_directory,
    "candidates",
    "candidate directory",
  );
  fs.mkdirSync(candidateDirectory, { recursive: true });
  const endpoint = requiredString(preflight.runtime.cdp_endpoint, "runtime.cdp_endpoint");
  const targetUrlIncludes = requiredString(
    preflight.runtime.target_url_includes,
    "runtime.target_url_includes",
  );
  const driver = await dependencies.createDriver({ endpoint, targetUrlIncludes });
  const scenes: JsonRecord[] = [];
  const bindings: JsonRecord[] = [];
  let firstFailed: JsonRecord | null = null;
  let restored: JsonRecord | null = null;
  try {
    for (const scene of authority.scenes) {
      const dimensions = authority.viewports.get(scene.viewport)!;
      const route = routeForScene(scene, input.conversation_id);
      let result: JsonRecord;
      try {
        await driver.beginScene(scene);
        await driver.applyAppearance(scene.locale, scene.theme);
        await driver.navigate(route);
        const execution = await driver.execute(scene);
        const observation = await driver.observe();
        const screenshot = await driver.screenshot();
        const errors = await driver.drainErrors();
        const actualDimensions = screenshotDimensions(screenshot);
        const screenshotPath = resolveContained(
          candidateDirectory,
          scene.image,
          `scene ${scene.id} screenshot`,
        );
        fs.writeFileSync(screenshotPath, screenshot);
        const screenshotSha256 = sha256(screenshot);
        const failure =
          actualDimensions.width === dimensions.width &&
          actualDimensions.height === dimensions.height
            ? sceneFailure(scene, route, dimensions, observation, execution, errors)
            : "screenshot_dimension_mismatch";
        result = {
          scene_id: scene.id,
          status: failure ? "failed" : "passed",
          expected: { ...scene, dimensions },
          observed: observation,
          interaction: execution,
          errors,
          screenshot: {
            path: screenshotPath,
            sha256: screenshotSha256,
            bytes: screenshot.length,
            dimensions: actualDimensions,
          },
          first_failed: failure,
        };
        bindings.push(bindingFor(scene, authority, preflight, input, screenshotSha256));
        if (failure && !firstFailed) {
          firstFailed = { scene_id: scene.id, reason: failure };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result = {
          scene_id: scene.id,
          status: "failed",
          first_failed: "capture_exception",
          error: message,
        };
        if (!firstFailed) {
          firstFailed = {
            scene_id: scene.id,
            reason: "capture_exception",
            detail: message,
          };
        }
      }
      scenes.push(result);
    }
    restored = await driver.restore();
  } finally {
    await driver.close();
  }
  if (
    restored?.route !== "/guid" ||
    typeof restored.locale !== "string" ||
    typeof restored.theme !== "string"
  ) {
    if (!firstFailed) firstFailed = { reason: "profile_restore_readback_failed" };
  }
  const passedSceneCount = scenes.filter((scene) => scene.status === "passed").length;
  const candidateAssetsComplete =
    scenes.length === EXPECTED_SCENE_COUNT &&
    passedSceneCount === EXPECTED_SCENE_COUNT &&
    bindings.length === EXPECTED_SCENE_COUNT;
  const reference = record(authority.cohort.reference, "reference");
  const referenceAssetsComplete =
    reference.state === "approved" &&
    typeof reference.approval_receipt_file === "string" &&
    SHA256_PATTERN.test(String(reference.approval_receipt_sha256 ?? ""));
  const comparatorInput = {
    schema: COMPARATOR_INPUT_SCHEMA,
    reference_directory: input.reference_directory,
    candidate_directory: candidateDirectory,
    diff_directory: input.diff_directory,
    bindings,
  };
  const receipt: JsonRecord = {
    schema: RECEIPT_SCHEMA,
    status: firstFailed ? "failed" : "passed",
    captured_at: (dependencies.now ?? (() => new Date()))().toISOString(),
    classification: input.classification,
    authority: {
      visual_cohort_sha256: authority.cohortSha256,
      app_contract_sha256: authority.appContractSha256,
      scene_count: EXPECTED_SCENE_COUNT,
    },
    cohort: preflight.cohort,
    runtime: preflight.runtime,
    profile: preflight.profile,
    summary: {
      expected_scene_count: EXPECTED_SCENE_COUNT,
      captured_scene_count: bindings.length,
      passed_scene_count: passedSceneCount,
      failed_scene_count: EXPECTED_SCENE_COUNT - passedSceneCount,
    },
    scenes,
    comparator_input: comparatorInput,
    claims: {
      candidate_assets_complete: candidateAssetsComplete,
      reference_assets_complete: referenceAssetsComplete,
      installed_identity_bound:
        input.classification === "installed_acceptance_candidate" && preflight.installedBound,
      visual_parity_complete: false,
      installed_pixel_acceptance: false,
      release_ready: false,
    },
    first_failed:
      firstFailed ??
      (!referenceAssetsComplete
        ? { reason: "reference_assets_incomplete" }
        : { reason: "comparator_and_human_review_required" }),
    restored,
  };
  fs.writeFileSync(
    path.join(input.output_directory, "capture-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(input.output_directory, "comparator-input.json"),
    `${JSON.stringify(comparatorInput, null, 2)}\n`,
  );
  return receipt;
}

class CdpClient {
  private socket: {
    send(value: string): void;
    close(): void;
    addEventListener(name: string, listener: (event: { data?: unknown }) => void): void;
  };
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: JsonRecord) => void; reject: (error: Error) => void }
  >();
  private listeners = new Set<(message: CdpResponse) => void>();

  private constructor(socket: CdpClient["socket"]) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpResponse;
      if (typeof message.id === "number") {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message ?? "CDP command failed"));
        } else {
          pending.resolve(record(message.result ?? {}, "CDP result"));
        }
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  static async connect(url: string): Promise<CdpClient> {
    const WebSocketConstructor = (
      globalThis as typeof globalThis & {
        WebSocket: new (url: string) => CdpClient["socket"];
      }
    ).WebSocket;
    const socket = new WebSocketConstructor(url);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve());
      socket.addEventListener("error", () => reject(new Error(`cannot connect to ${url}`)));
    });
    return new CdpClient(socket);
  }

  onEvent(listener: (message: CdpResponse) => void): void {
    this.listeners.add(listener);
  }

  async send(method: string, params: JsonRecord = {}): Promise<JsonRecord> {
    const id = this.nextId++;
    const promise = new Promise<JsonRecord>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close(): void {
    this.socket.close();
  }
}

function evaluationValue(result: JsonRecord): unknown {
  const remote = record(result.result, "Runtime.evaluate result");
  if (remote.subtype === "error") {
    throw new Error(requiredString(remote.description, "Runtime.evaluate error"));
  }
  return remote.value;
}

async function evaluate<T>(client: CdpClient, expression: string): Promise<T> {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return evaluationValue(result) as T;
}

async function waitFor(
  predicate: () => Promise<boolean>,
  label: string,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${label}`);
}

function browserExpression(source: string, argument?: unknown): string {
  return argument === undefined ? `(${source})()` : `(${source})(${JSON.stringify(argument)})`;
}

class CdpCaptureDriver implements CaptureDriver {
  private consoleErrors: string[] = [];
  private pageErrors: string[] = [];
  private original: { route: string; locale: string; theme: string } | null = null;
  private readonly client: CdpClient;

  constructor(client: CdpClient) {
    this.client = client;
    client.onEvent((message) => {
      if (message.method === "Runtime.exceptionThrown") {
        this.pageErrors.push(JSON.stringify(message.params ?? {}));
      }
      if (message.method === "Log.entryAdded") {
        const entry = record(message.params?.entry ?? {}, "log entry");
        if (entry.level === "error") this.consoleErrors.push(String(entry.text ?? ""));
      }
      if (message.method === "Runtime.consoleAPICalled") {
        const params = record(message.params ?? {}, "console event");
        if (params.type === "error") this.consoleErrors.push(JSON.stringify(params.args ?? []));
      }
    });
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.client.send("Page.enable"),
      this.client.send("Runtime.enable"),
      this.client.send("Log.enable"),
      this.client.send("Accessibility.enable"),
    ]);
    this.original = await evaluate(
      this.client,
      browserExpression(`async () => {
        const backendPort = window.__backendPort;
        const settings = backendPort
          ? await fetch("http://127.0.0.1:" + backendPort + "/api/settings/client").then((response) => response.json())
          : {};
        return {
          route: location.hash.replace(/^#/, "") || "/guid",
          locale: String(settings.language || document.documentElement.lang || ""),
          theme: String(settings["theme.appearanceMode"] || document.documentElement.dataset.theme || ""),
        };
      }`),
    );
  }

  async beginScene(scene: CaptureScene): Promise<void> {
    this.consoleErrors = [];
    this.pageErrors = [];
    const dimensions =
      scene.viewport === "desktop" ? { width: 1440, height: 900 } : { width: 400, height: 800 };
    await this.client.send("Emulation.setDeviceMetricsOverride", {
      width: dimensions.width,
      height: dimensions.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  async applyAppearance(locale: string, theme: string): Promise<void> {
    const result = await evaluate<{ ok: boolean; status: number }>(
      this.client,
      browserExpression(
        `async (input) => {
          const backendPort = window.__backendPort;
          if (!backendPort) return { ok: false, status: 0 };
          const response = await fetch("http://127.0.0.1:" + backendPort + "/api/settings/client", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              language: input.locale,
              "theme.appearanceMode": input.theme,
            }),
          });
          return { ok: response.ok, status: response.status };
        }`,
        { locale, theme },
      ),
    );
    if (!result.ok) throw new Error(`appearance update failed with HTTP ${result.status}`);
    await this.client.send("Page.reload", { ignoreCache: true });
    await waitFor(
      async () =>
        evaluate(
          this.client,
          browserExpression(
            `(expected) => document.readyState === "complete"
              && document.documentElement.getAttribute("data-theme") === expected.theme
              && (document.documentElement.lang || "").toLowerCase().startsWith(expected.locale.split("-")[0].toLowerCase())`,
            { locale, theme },
          ),
        ),
      `locale=${locale} theme=${theme}`,
    );
  }

  async navigate(route: string): Promise<void> {
    await evaluate(
      this.client,
      browserExpression(`(route) => { location.hash = "#" + route; }`, route),
    );
    await waitFor(
      async () =>
        evaluate(
          this.client,
          browserExpression(
            `(route) => document.readyState === "complete" && location.hash.startsWith("#" + route)`,
            route,
          ),
        ),
      `route ${route}`,
    );
    await evaluate(
      this.client,
      browserExpression(
        `() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
      ),
    );
  }

  async execute(scene: CaptureScene): Promise<SceneExecution> {
    const interaction = scene.state;
    const prepared = await evaluate<JsonRecord>(
      this.client,
      browserExpression(
        `async (input) => {
          const visible = (selector) => [...document.querySelectorAll(selector)]
            .find((element) => element.getClientRects().length > 0);
          const click = (selector) => {
            const element = visible(selector);
            if (!element) return false;
            element.click();
            return true;
          };
          const focus = (selector) => {
            const element = visible(selector);
            if (!element) return false;
            element.focus();
            return document.activeElement === element;
          };
          let ok = true;
          let keyboard = [];
          let hover = null;
          if (input.state === "model_menu_open") {
            ok = click('[data-testid="guid-model-selector"], [data-testid="conversation-model-selector"]');
          } else if (input.state === "capability_palette_open") {
            ok = click('[data-testid="agent-mode-selector-codex"]');
          } else if (input.state === "command_menu_open") {
            const composer = visible('[data-testid="conversation-composer"] textarea, [data-testid="guid-input"]');
            if (!composer) ok = false;
            else {
              composer.focus();
              composer.value = "/";
              composer.dispatchEvent(new Event("input", { bubbles: true }));
              keyboard = ["Home", "End", "Escape"];
            }
          } else if (input.state === "selected_row") {
            ok = click(".opl-codex-rail-row");
          } else if (input.state === "row_hover_actions_visible") {
            const row = visible(".opl-codex-rail-row");
            if (!row) ok = false;
            else {
              const bounds = row.getBoundingClientRect();
              hover = {
                x: bounds.left + bounds.width / 2,
                y: bounds.top + bounds.height / 2,
              };
              row.focus();
              keyboard = ["Tab"];
            }
          } else if (input.surface_family === "settings") {
            ok = focus('[data-testid="settings-search-input"]');
            keyboard = ["Tab"];
          } else if (input.surface_family === "home") {
            ok = focus('[data-testid="guid-input"]');
            keyboard = ["Tab"];
          }
          return { ok, keyboard, hover };
        }`,
        scene,
      ),
    );
    const keyboard = Array.isArray(prepared.keyboard)
      ? prepared.keyboard.map((key) => requiredString(key, "keyboard key"))
      : [];
    const hover =
      prepared.hover && typeof prepared.hover === "object"
        ? record(prepared.hover, "hover coordinates")
        : null;
    if (hover) {
      await this.client.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: Number(hover.x),
        y: Number(hover.y),
      });
    }
    for (const key of keyboard) {
      await this.client.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key,
        code: key,
      });
      await this.client.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key,
        code: key,
      });
    }
    await evaluate(
      this.client,
      browserExpression(
        `() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
      ),
    );
    const result = await evaluate<JsonRecord>(
      this.client,
      browserExpression(`() => ({
        ok: true,
        active: document.activeElement?.getAttribute("data-testid")
          || document.activeElement?.getAttribute("aria-label")
          || document.activeElement?.tagName
          || "",
      })`),
    );
    result.ok = prepared.ok === true;
    result.keyboard = keyboard;
    result.hover = hover;
    return { interaction, result };
  }

  async observe(): Promise<SceneObservation> {
    const dom = await evaluate<Omit<SceneObservation, "unnamed_interactive_roles">>(
      this.client,
      browserExpression(`() => {
        const parse = (value) => {
          const match = String(value).match(/rgba?\\(\\s*([\\d.]+)[, ]+\\s*([\\d.]+)[, ]+\\s*([\\d.]+)/i);
          return match ? [+match[1], +match[2], +match[3]] : null;
        };
        const luminance = (color) => color.map((value) => {
          const normalized = value / 255;
          return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        const contrastRatio = (first, second) => {
          const left = luminance(first);
          const right = luminance(second);
          return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
        };
        const contrast = [
          '[data-testid="guid-send-btn"]',
          '[data-testid="guid-input"]',
          ".opl-codex-rail-row",
          '[data-testid="settings-search-input"]',
        ].map((selector) => {
          const element = [...document.querySelectorAll(selector)].find((candidate) => candidate.getClientRects().length > 0);
          if (!element) return { selector, ratio: null, visible: false };
          const style = getComputedStyle(element);
          const parentStyle = element.parentElement ? getComputedStyle(element.parentElement) : null;
          const foreground = parse(style.color);
          const background = parse(style.backgroundColor) || parse(parentStyle?.backgroundColor);
          return {
            selector,
            ratio: foreground && background ? Number(contrastRatio(foreground, background).toFixed(3)) : null,
            visible: true,
          };
        });
        const active = document.activeElement;
        return {
          route: location.hash.replace(/^#/, ""),
          ready_state: document.readyState,
          text_length: (document.body?.innerText || "").trim().length,
          overlay_count: [...document.querySelectorAll(".vite-error-overlay,#webpack-dev-server-client-overlay,[data-nextjs-dialog]")]
            .filter((element) => element.getClientRects().length > 0).length,
          theme: document.documentElement.getAttribute("data-theme") || "",
          locale: document.documentElement.lang || Intl.DateTimeFormat().resolvedOptions().locale,
          viewport: { width: innerWidth, height: innerHeight },
          visible_test_ids: [...document.querySelectorAll("[data-testid]")]
            .filter((element) => element.getClientRects().length > 0)
            .map((element) => element.getAttribute("data-testid"))
            .filter(Boolean),
          focus: {
            before: "",
            after: active?.getAttribute("data-testid") || active?.getAttribute("aria-label") || active?.tagName || "",
          },
          live_regions: [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')]
            .filter((element) => element.getClientRects().length > 0)
            .map((element) => (element.textContent || "").trim())
            .filter(Boolean),
          contrast,
        };
      }`),
    );
    const tree = await this.client.send("Accessibility.getFullAXTree");
    const unnamedInteractiveRoles = array(tree.nodes ?? [], "AX tree nodes")
      .map((value) => record(value, "AX node"))
      .filter((node) => !node.ignored)
      .filter((node) => {
        const role = record(node.role ?? {}, "AX role").value;
        return typeof role === "string" && INTERACTIVE_AX_ROLES.has(role.toLowerCase());
      })
      .filter((node) => {
        const name = record(node.name ?? {}, "AX name").value;
        return typeof name !== "string" || !name.trim();
      })
      .map((node) => String(record(node.role ?? {}, "AX role").value));
    return { ...dom, unnamed_interactive_roles: unnamedInteractiveRoles };
  }

  async screenshot(): Promise<Buffer> {
    const result = await this.client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    return Buffer.from(requiredString(result.data, "screenshot data"), "base64");
  }

  async drainErrors(): Promise<{ console: string[]; page: string[] }> {
    return {
      console: [...this.consoleErrors],
      page: [...this.pageErrors],
    };
  }

  async restore(): Promise<{ route: string; locale: string; theme: string }> {
    if (!this.original) throw new Error("original isolated profile state was not captured");
    await this.applyAppearance(this.original.locale, this.original.theme);
    await this.navigate("/guid");
    return evaluate(
      this.client,
      browserExpression(`() => ({
        route: location.hash.replace(/^#/, ""),
        locale: document.documentElement.lang || Intl.DateTimeFormat().resolvedOptions().locale,
        theme: document.documentElement.getAttribute("data-theme") || "",
      })`),
    );
  }

  async close(): Promise<void> {
    this.client.close();
  }
}

export async function createCdpCaptureDriver(input: {
  endpoint: string;
  targetUrlIncludes: string;
}): Promise<CaptureDriver> {
  const endpoint = new URL(input.endpoint);
  if (!["127.0.0.1", "localhost", "::1"].includes(endpoint.hostname)) {
    throw new Error("CDP endpoint must be loopback-only");
  }
  const targetsResponse = await fetch(new URL("/json/list", endpoint));
  if (!targetsResponse.ok) {
    throw new Error(`CDP target discovery failed with HTTP ${targetsResponse.status}`);
  }
  const targets = array(await targetsResponse.json(), "CDP targets")
    .map((value) => record(value, "CDP target"))
    .filter((target) => target.type === "page")
    .filter((target) => String(target.url ?? "").includes(input.targetUrlIncludes));
  if (targets.length !== 1) {
    throw new Error(`expected exactly one matching CDP page target, found ${targets.length}`);
  }
  const client = await CdpClient.connect(
    requiredString(targets[0]!.webSocketDebuggerUrl, "webSocketDebuggerUrl"),
  );
  const driver = new CdpCaptureDriver(client);
  await driver.initialize();
  return driver;
}

function parseCli(argv: string[]): { input: string; output: string | null } {
  let input = "";
  let output: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${token}`);
    if (token === "--input") input = value;
    else if (token === "--output") output = value;
    else throw new Error(`unknown argument ${token}`);
    index += 1;
  }
  if (!input) throw new Error("--input is required");
  return { input, output };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const inputPath = path.resolve(options.input);
  const receipt = await captureGuiVisualCohort(
    readJson(inputPath, "capture input"),
    path.dirname(inputPath),
    { createDriver: createCdpCaptureDriver },
  );
  const payload = `${JSON.stringify(receipt, null, 2)}\n`;
  if (options.output) fs.writeFileSync(path.resolve(options.output), payload);
  process.stdout.write(payload);
  if (receipt.status !== "passed") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stdout.write(
      `${JSON.stringify(
        {
          schema: RECEIPT_SCHEMA,
          status: "failed",
          first_failed: {
            reason: "capture_execution_failed",
            detail: error instanceof Error ? error.message : String(error),
          },
          claims: {
            candidate_assets_complete: false,
            reference_assets_complete: false,
            installed_identity_bound: false,
            visual_parity_complete: false,
            installed_pixel_acceptance: false,
            release_ready: false,
          },
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = 1;
  });
}
