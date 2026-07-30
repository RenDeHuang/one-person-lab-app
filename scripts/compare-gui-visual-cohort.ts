import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMPARATOR_SCHEMA = "opl_app_gui_visual_comparison_receipt.v1";
const INPUT_SCHEMA = "opl_app_gui_visual_comparison_input.v1";
const APPROVAL_RECEIPT_SCHEMA =
  "opl_app_gui_visual_baseline_approval_receipt.v1";
const EXPECTED_SCENE_COUNT = 16;
const SCRIPT_RELATIVE_PATH = "scripts/compare-gui-visual-cohort.ts";
const PIXEL_CHANNEL_DELTA_THRESHOLD = 8;
const CHANGED_PIXEL_RATIO_MAX = 0.015;
const MEAN_ABSOLUTE_CHANNEL_DELTA_MAX = 1.5;
const MAXIMUM_MASKED_AREA_RATIO = 0.08;
const MAXIMUM_DECODED_PNG_BYTES = 512 * 1024 * 1024;
const REQUIRED_BINDING_FIELDS = [
  "reference_baseline_id",
  "reference_approval_receipt_sha256",
  "app_contract_ref",
  "shell_commit",
  "package_or_dev_build_identity",
  "os_version",
  "architecture",
  "display_scale",
  "viewport",
  "theme",
  "locale",
  "route",
  "state",
  "reference_screenshot_sha256",
  "candidate_screenshot_sha256",
];
const ALLOWED_MASK_REASONS = [
  "caret_blink",
  "os_window_chrome_dynamic",
  "live_status_timestamp",
];

type JsonRecord = Record<string, unknown>;

export type RgbaImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

type Mask = {
  x: number;
  y: number;
  width: number;
  height: number;
  reason: string;
};

type SceneContract = {
  id: string;
  viewport: string;
  theme: string;
  locale: string;
  route: string;
  state: string;
  image: string;
  masks: Mask[];
};

type Binding = JsonRecord & {
  scene_id: string;
};

export type ComparisonInput = {
  schema: string;
  reference_directory: string;
  candidate_directory: string;
  diff_directory: string;
  bindings: Binding[];
};

export type Violation = {
  code: string;
  message: string;
  scene_id?: string;
};

type SceneReceipt = {
  scene_id: string;
  status: "passed" | "failed";
  image: string;
  expected_dimensions: { width: number; height: number };
  observed_dimensions: {
    reference: { width: number; height: number } | null;
    candidate: { width: number; height: number } | null;
  };
  reference_screenshot_sha256: string | null;
  candidate_screenshot_sha256: string | null;
  diff_png: string;
  total_pixels: number | null;
  masked_pixels: number | null;
  masked_pixel_ratio: number | null;
  compared_pixels: number | null;
  changed_pixels: number | null;
  changed_pixel_ratio: number | null;
  mean_absolute_channel_delta: number | null;
  human_review_verdict: string | null;
  violations: Violation[];
};

type BaselineApprovalScene = {
  scene_id: string;
  image: string;
  reference_screenshot_sha256: string;
  verdict: string;
};

type BaselineApprovalReceipt = {
  schema: string;
  owner: string;
  baseline_id: string;
  reviewer: string;
  reviewed_at: string;
  review_method: string;
  verdict: string;
  scenes: BaselineApprovalScene[];
};

export type ComparisonReceipt = {
  schema: typeof COMPARATOR_SCHEMA;
  status: "passed" | "failed";
  authority: {
    comparator: typeof SCRIPT_RELATIVE_PATH;
    cohort_schema: string;
    cohort_sha256: string;
    app_contract_sha256: string;
  };
  thresholds: {
    pixel_channel_delta_threshold: number;
    changed_pixel_ratio_max: number;
    mean_absolute_channel_delta_max: number;
    alpha_channel_included: true;
    maximum_masked_area_ratio: number;
  };
  summary: {
    expected_scene_count: typeof EXPECTED_SCENE_COUNT;
    compared_scene_count: number;
    passed_scene_count: number;
    failed_scene_count: number;
  };
  claims: {
    scene_compared: boolean;
    layout_checked: boolean;
    visual_delta_reviewed: boolean;
    scene_bound_visual_parity: boolean;
  };
  forbidden_inferences: string[];
  scenes: SceneReceipt[];
  violations: Violation[];
};

type ComparisonAuthority = {
  cohort: JsonRecord;
  cohortBytes: Buffer;
  appContract: JsonRecord;
  appContractBytes: Buffer;
};

type PixelComparison = {
  diff: RgbaImage;
  totalPixels: number;
  maskedPixels: number;
  comparedPixels: number;
  changedPixels: number;
  changedPixelRatio: number;
  meanAbsoluteChannelDelta: number;
};

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : NaN;
}

function sha256(bytes: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function parseApprovalReceipt(value: unknown): BaselineApprovalReceipt {
  const receipt = record(value);
  const scenes = Array.isArray(receipt.scenes)
    ? receipt.scenes.map((entry) => {
        const scene = record(entry);
        return {
          scene_id: stringValue(scene.scene_id),
          image: stringValue(scene.image),
          reference_screenshot_sha256: stringValue(
            scene.reference_screenshot_sha256,
          ),
          verdict: stringValue(scene.verdict),
        };
      })
    : [];
  return {
    schema: stringValue(receipt.schema),
    owner: stringValue(receipt.owner),
    baseline_id: stringValue(receipt.baseline_id),
    reviewer: stringValue(receipt.reviewer),
    reviewed_at: stringValue(receipt.reviewed_at),
    review_method: stringValue(receipt.review_method),
    verdict: stringValue(receipt.verdict),
    scenes,
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  Buffer.from(data).copy(chunk, 8);
  chunk.writeUInt32BE(
    crc32(Buffer.concat([typeBytes, Buffer.from(data)])),
    8 + data.length,
  );
  return chunk;
}

export function encodeRgbaPng(image: RgbaImage): Buffer {
  if (
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width <= 0 ||
    image.height <= 0 ||
    image.data.length !== image.width * image.height * 4
  ) {
    throw new Error("invalid RGBA image dimensions or byte length");
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const scanlines = Buffer.alloc(image.height * (1 + image.width * 4));
  for (let y = 0; y < image.height; y += 1) {
    const targetOffset = y * (1 + image.width * 4);
    scanlines[targetOffset] = 0;
    Buffer.from(
      image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4),
    ).copy(scanlines, targetOffset + 1);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function paethPredictor(a: number, b: number, c: number): number {
  const estimate = a + b - c;
  const distanceA = Math.abs(estimate - a);
  const distanceB = Math.abs(estimate - b);
  const distanceC = Math.abs(estimate - c);
  if (distanceA <= distanceB && distanceA <= distanceC) return a;
  return distanceB <= distanceC ? b : c;
}

export function decodePng(bytes: Buffer): RgbaImage {
  if (
    bytes.length < PNG_SIGNATURE.length ||
    !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    throw new Error("invalid PNG signature");
  }

  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let compression = -1;
  let filterMethod = -1;
  let interlace = -1;
  let palette: Buffer | null = null;
  let transparency: Buffer | null = null;
  const idat: Buffer[] = [];
  let sawHeader = false;
  let sawEnd = false;

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error("truncated PNG chunk");
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("truncated PNG chunk data");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(bytes.subarray(offset + 4, offset + 8 + length));
    if (actualCrc !== expectedCrc) throw new Error(`invalid PNG ${type} CRC`);

    if (type === "IHDR") {
      if (sawHeader || length !== 13) throw new Error("invalid PNG IHDR");
      sawHeader = true;
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
      compression = data[10]!;
      filterMethod = data[11]!;
      interlace = data[12]!;
    } else if (type === "PLTE") {
      palette = Buffer.from(data);
    } else if (type === "tRNS") {
      transparency = Buffer.from(data);
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      sawEnd = true;
      offset = end;
      break;
    }
    offset = end;
  }

  if (!sawHeader || !sawEnd || width <= 0 || height <= 0 || idat.length === 0) {
    throw new Error("incomplete PNG");
  }
  if (
    bitDepth !== 8 ||
    compression !== 0 ||
    filterMethod !== 0 ||
    interlace !== 0
  ) {
    throw new Error(
      "unsupported PNG encoding; expected 8-bit non-interlaced image",
    );
  }
  const channels = new Map([
    [0, 1],
    [2, 3],
    [3, 1],
    [4, 2],
    [6, 4],
  ]).get(colorType);
  if (!channels) throw new Error(`unsupported PNG color type ${colorType}`);
  if (colorType === 3 && (!palette || palette.length % 3 !== 0)) {
    throw new Error("indexed PNG is missing a valid palette");
  }
  if (
    transparency &&
    ((colorType === 0 && transparency.length !== 2) ||
      (colorType === 2 && transparency.length !== 6) ||
      (colorType === 3 &&
        palette !== null &&
        transparency.length > palette.length / 3) ||
      colorType === 4 ||
      colorType === 6)
  ) {
    throw new Error(`invalid PNG tRNS chunk for color type ${colorType}`);
  }

  const rowBytes = width * channels;
  const expectedInflatedLength = height * (rowBytes + 1);
  if (
    !Number.isSafeInteger(expectedInflatedLength) ||
    expectedInflatedLength <= 0 ||
    expectedInflatedLength > MAXIMUM_DECODED_PNG_BYTES
  ) {
    throw new Error("PNG decoded byte length exceeds the comparator limit");
  }
  const inflated = inflateSync(Buffer.concat(idat), {
    maxOutputLength: expectedInflatedLength,
  });
  if (inflated.length !== expectedInflatedLength) {
    throw new Error("PNG scanline byte length does not match dimensions");
  }
  const raw = new Uint8Array(height * rowBytes);
  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * (rowBytes + 1);
    const filter = inflated[sourceOffset]!;
    if (filter > 4) throw new Error(`unsupported PNG filter ${filter}`);
    for (let x = 0; x < rowBytes; x += 1) {
      const encoded = inflated[sourceOffset + 1 + x]!;
      const target = y * rowBytes + x;
      const left = x >= channels ? raw[target - channels]! : 0;
      const above = y > 0 ? raw[target - rowBytes]! : 0;
      const upperLeft =
        y > 0 && x >= channels ? raw[target - rowBytes - channels]! : 0;
      let value = encoded;
      if (filter === 1) value += left;
      if (filter === 2) value += above;
      if (filter === 3) value += Math.floor((left + above) / 2);
      if (filter === 4) value += paethPredictor(left, above, upperLeft);
      raw[target] = value & 0xff;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const source = pixel * channels;
    const target = pixel * 4;
    if (colorType === 0) {
      const gray = raw[source]!;
      const alpha =
        transparency && transparency.readUInt16BE(0) === gray ? 0 : 255;
      rgba.set([gray, gray, gray, alpha], target);
    } else if (colorType === 2) {
      const red = raw[source]!;
      const green = raw[source + 1]!;
      const blue = raw[source + 2]!;
      const alpha =
        transparency &&
        transparency.readUInt16BE(0) === red &&
        transparency.readUInt16BE(2) === green &&
        transparency.readUInt16BE(4) === blue
          ? 0
          : 255;
      rgba.set(
        [red, green, blue, alpha],
        target,
      );
    } else if (colorType === 3) {
      const index = raw[source]!;
      const paletteOffset = index * 3;
      if (!palette || paletteOffset + 2 >= palette.length) {
        throw new Error("indexed PNG references a missing palette entry");
      }
      rgba.set(
        [
          palette[paletteOffset]!,
          palette[paletteOffset + 1]!,
          palette[paletteOffset + 2]!,
          transparency?.[index] ?? 255,
        ],
        target,
      );
    } else if (colorType === 4) {
      const gray = raw[source]!;
      rgba.set([gray, gray, gray, raw[source + 1]!], target);
    } else {
      rgba.set(
        [
          raw[source]!,
          raw[source + 1]!,
          raw[source + 2]!,
          raw[source + 3]!,
        ],
        target,
      );
    }
  }
  return { width, height, data: rgba };
}

function maskContains(mask: Mask, x: number, y: number): boolean {
  return (
    x >= mask.x &&
    x < mask.x + mask.width &&
    y >= mask.y &&
    y < mask.y + mask.height
  );
}

export function comparePixels(
  reference: RgbaImage,
  candidate: RgbaImage,
  masks: Mask[],
  channelThreshold: number,
): PixelComparison {
  if (
    reference.width !== candidate.width ||
    reference.height !== candidate.height
  ) {
    throw new Error("pixel comparison requires equal dimensions");
  }
  const totalPixels = reference.width * reference.height;
  const diff = new Uint8Array(totalPixels * 4);
  let maskedPixels = 0;
  let comparedPixels = 0;
  let changedPixels = 0;
  let absoluteChannelDelta = 0;

  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    const x = pixel % reference.width;
    const y = Math.floor(pixel / reference.width);
    const target = pixel * 4;
    const masked = masks.some((mask) => maskContains(mask, x, y));
    if (masked) {
      maskedPixels += 1;
      diff.set([0, 96, 255, 160], target);
      continue;
    }
    comparedPixels += 1;
    let maximumDelta = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const delta = Math.abs(
        reference.data[target + channel]! -
          candidate.data[target + channel]!,
      );
      absoluteChannelDelta += delta;
      maximumDelta = Math.max(maximumDelta, delta);
    }
    if (maximumDelta > channelThreshold) changedPixels += 1;
    if (maximumDelta === 0) {
      diff.set([0, 0, 0, 0], target);
    } else {
      diff.set([255, 0, 0, Math.max(48, maximumDelta)], target);
    }
  }

  return {
    diff: { width: reference.width, height: reference.height, data: diff },
    totalPixels,
    maskedPixels,
    comparedPixels,
    changedPixels,
    changedPixelRatio:
      comparedPixels === 0 ? 1 : changedPixels / comparedPixels,
    meanAbsoluteChannelDelta:
      comparedPixels === 0
        ? Number.POSITIVE_INFINITY
        : absoluteChannelDelta / (comparedPixels * 4),
  };
}

function failureDiff(width = 1, height = 1): RgbaImage {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const data = new Uint8Array(safeWidth * safeHeight * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data.set([255, 0, 255, 255], offset);
  }
  return { width: safeWidth, height: safeHeight, data };
}

function parseInput(value: unknown): ComparisonInput {
  const input = record(value);
  const bindings = Array.isArray(input.bindings)
    ? input.bindings.map((binding) => record(binding) as Binding)
    : [];
  return {
    schema: stringValue(input.schema),
    reference_directory: stringValue(input.reference_directory),
    candidate_directory: stringValue(input.candidate_directory),
    diff_directory: stringValue(input.diff_directory),
    bindings,
  };
}

function parseScene(value: unknown): SceneContract {
  const scene = record(value);
  const masks = Array.isArray(scene.masks)
    ? scene.masks.map((value) => {
        const mask = record(value);
        return {
          x: finiteNumber(mask.x),
          y: finiteNumber(mask.y),
          width: finiteNumber(mask.width),
          height: finiteNumber(mask.height),
          reason: stringValue(mask.reason),
        };
      })
    : [];
  return {
    id: stringValue(scene.id),
    viewport: stringValue(scene.viewport),
    theme: stringValue(scene.theme),
    locale: stringValue(scene.locale),
    route: stringValue(scene.route),
    state: stringValue(scene.state),
    image: stringValue(scene.image),
    masks,
  };
}

function pushViolation(
  target: Violation[],
  code: string,
  message: string,
  sceneId?: string,
): void {
  target.push({
    code,
    message,
    ...(sceneId ? { scene_id: sceneId } : {}),
  });
}

function validateAuthority(
  authority: ComparisonAuthority,
  violations: Violation[],
): {
  scenes: SceneContract[];
  viewports: JsonRecord;
  requiredBindingFields: string[];
  forbiddenInferences: string[];
  threshold: number;
  ratioMax: number;
  madMax: number;
  maximumMaskRatio: number;
  acceptedMaskReasons: string[];
  acceptedVerdict: string;
  expectedReferenceBaselineId: string;
  expectedReferenceApprovalReceiptFile: string;
  expectedReferenceApprovalReceiptSha256: string;
  expectedAppContractRef: string;
} {
  const cohort = authority.cohort;
  const appContract = authority.appContract;
  const maintenancePolicy = record(appContract.gui_maintenance_policy);
  const protocol = record(maintenancePolicy.visual_comparison_protocol);
  const capture = record(cohort.capture_contract);
  const comparison = record(cohort.comparison_contract);
  const maskPolicy = record(comparison.mask_policy);
  const humanReview = record(comparison.human_review);
  const reference = record(cohort.reference);
  const candidate = record(cohort.candidate);
  const scenes = Array.isArray(cohort.scene_matrix)
    ? cohort.scene_matrix.map(parseScene)
    : [];
  const requiredBindingFields = Array.isArray(protocol.required_binding_fields)
    ? protocol.required_binding_fields.map(stringValue)
    : [];
  const forbiddenInferences = Array.isArray(protocol.forbidden_inferences)
    ? protocol.forbidden_inferences.map(stringValue)
    : [];
  const acceptedMaskReasons = Array.isArray(maskPolicy.allowed_reasons)
    ? maskPolicy.allowed_reasons.map(stringValue)
    : [];
  const humanFields = Array.isArray(humanReview.binding_fields)
    ? humanReview.binding_fields.map(stringValue)
    : [];

  if (
    cohort.schema !== "opl_app_gui_visual_reference_cohort.v1" ||
    protocol.schema !== "opl_app_gui_visual_comparison.v1" ||
    protocol.active_reference_cohort_ref !==
      "contracts/app-gui-visual-reference-cohort.json" ||
    protocol.shell_comparator_ref !== SCRIPT_RELATIVE_PATH
  ) {
    pushViolation(
      violations,
      "invalid_authority_binding",
      "App GUI protocol must bind the canonical cohort and comparator",
    );
  }
  const referenceBaselineId = stringValue(reference.baseline_id);
  const referenceApprovalReceiptFile = stringValue(
    reference.approval_receipt_file,
  );
  const referenceApprovalReceiptSha256 = stringValue(
    reference.approval_receipt_sha256,
  );
  if (
    reference.owner !== "one-person-lab-app" ||
    reference.state !== "approved" ||
    !referenceBaselineId ||
    referenceApprovalReceiptFile !== "baseline-approval-receipt.json" ||
    !SHA256_PATTERN.test(referenceApprovalReceiptSha256) ||
    reference.approval_receipt_schema !== APPROVAL_RECEIPT_SCHEMA ||
    reference.reference_role !== "app_owned_pixel_regression_baseline" ||
    reference.external_product_artifact_required !== false ||
    reference.stable_release_dependency !== false
  ) {
    pushViolation(
      violations,
      "reference_baseline_not_approved",
      "App-owned visual baseline must be approved and bound to an exact approval receipt before comparison",
    );
  }
  if (
    JSON.stringify(requiredBindingFields) !==
      JSON.stringify(REQUIRED_BINDING_FIELDS) ||
    JSON.stringify(acceptedMaskReasons) !==
      JSON.stringify(ALLOWED_MASK_REASONS)
  ) {
    pushViolation(
      violations,
      "invalid_required_bindings",
      "canonical binding fields and allowed mask reasons must match the comparator contract",
    );
  }
  if (
    scenes.length !== EXPECTED_SCENE_COUNT ||
    new Set(scenes.map((scene) => scene.id)).size !== EXPECTED_SCENE_COUNT ||
    scenes.some(
      (scene) =>
        !scene.id ||
        !scene.image ||
        scene.image !== `${scene.id}.png` ||
        !scene.viewport ||
        !scene.theme ||
        !scene.locale ||
        !scene.route ||
        !scene.state,
    )
  ) {
    pushViolation(
      violations,
      "invalid_scene_matrix",
      `canonical cohort must define exactly ${EXPECTED_SCENE_COUNT} unique and completely bound scenes`,
    );
  }
  if (
    comparison.alpha_channel_included !== true ||
    comparison.dimension_mismatch !== "fail" ||
    comparison.missing_scene !== "fail" ||
    comparison.diff_png_required !== true ||
    maskPolicy.default !== "none" ||
    maskPolicy.declaration_required !== true ||
    maskPolicy.undeclared_dynamic_region !== "fail" ||
    humanReview.required !== true ||
    JSON.stringify(humanFields) !==
      JSON.stringify([
        "scene_id",
        "reference_screenshot_sha256",
        "candidate_screenshot_sha256",
        "verdict",
      ]) ||
    stringValue(humanReview.accepted_verdict) !== "accepted"
  ) {
    pushViolation(
      violations,
      "invalid_comparison_policy",
      "canonical cohort comparison, mask, and human review policy is incomplete",
    );
  }
  const threshold = finiteNumber(comparison.pixel_channel_delta_threshold);
  const ratioMax = finiteNumber(comparison.changed_pixel_ratio_max);
  const madMax = finiteNumber(comparison.mean_absolute_channel_delta_max);
  const maximumMaskRatio = finiteNumber(maskPolicy.maximum_masked_area_ratio);
  if (
    threshold !== PIXEL_CHANNEL_DELTA_THRESHOLD ||
    ratioMax !== CHANGED_PIXEL_RATIO_MAX ||
    madMax !== MEAN_ABSOLUTE_CHANNEL_DELTA_MAX ||
    maximumMaskRatio !== MAXIMUM_MASKED_AREA_RATIO
  ) {
    pushViolation(
      violations,
      "invalid_thresholds",
      "canonical pixel and mask thresholds must match the bound comparator policy",
    );
  }

  return {
    scenes,
    viewports: record(capture.supported_viewports),
    requiredBindingFields,
    forbiddenInferences,
    threshold: PIXEL_CHANNEL_DELTA_THRESHOLD,
    ratioMax: CHANGED_PIXEL_RATIO_MAX,
    madMax: MEAN_ABSOLUTE_CHANNEL_DELTA_MAX,
    maximumMaskRatio: MAXIMUM_MASKED_AREA_RATIO,
    acceptedMaskReasons,
    acceptedVerdict: stringValue(humanReview.accepted_verdict),
    expectedReferenceBaselineId: referenceBaselineId,
    expectedReferenceApprovalReceiptFile: referenceApprovalReceiptFile,
    expectedReferenceApprovalReceiptSha256:
      referenceApprovalReceiptSha256,
    expectedAppContractRef: stringValue(candidate.app_contract_ref),
  };
}

function validateBaselineApprovalReceipt(
  referenceDirectory: string,
  policy: {
    scenes: SceneContract[];
    expectedReferenceBaselineId: string;
    expectedReferenceApprovalReceiptFile: string;
    expectedReferenceApprovalReceiptSha256: string;
  },
  violations: Violation[],
): Map<string, BaselineApprovalScene> {
  const approvedScenes = new Map<string, BaselineApprovalScene>();
  const receiptPath = path.join(
    referenceDirectory,
    policy.expectedReferenceApprovalReceiptFile ||
      "baseline-approval-receipt.json",
  );
  if (!fs.existsSync(receiptPath) || !fs.statSync(receiptPath).isFile()) {
    pushViolation(
      violations,
      "reference_approval_receipt_missing",
      "App-owned baseline approval receipt is missing from the reference directory",
    );
    return approvedScenes;
  }

  try {
    const bytes = fs.readFileSync(receiptPath);
    if (sha256(bytes) !== policy.expectedReferenceApprovalReceiptSha256) {
      pushViolation(
        violations,
        "reference_approval_receipt_sha256_mismatch",
        "App-owned baseline approval receipt bytes do not match the canonical SHA-256",
      );
      return approvedScenes;
    }
    const receipt = parseApprovalReceipt(
      JSON.parse(bytes.toString("utf8")),
    );
    if (
      receipt.schema !== APPROVAL_RECEIPT_SCHEMA ||
      receipt.owner !== "one-person-lab-app" ||
      receipt.baseline_id !== policy.expectedReferenceBaselineId ||
      !receipt.reviewer ||
      !receipt.reviewed_at ||
      receipt.review_method !== "human_visual_review" ||
      receipt.verdict !== "accepted"
    ) {
      pushViolation(
        violations,
        "reference_approval_receipt_invalid",
        "App-owned baseline approval receipt identity and human acceptance are incomplete",
      );
      return approvedScenes;
    }
    if (
      receipt.scenes.length !== EXPECTED_SCENE_COUNT ||
      new Set(receipt.scenes.map((scene) => scene.scene_id)).size !==
        EXPECTED_SCENE_COUNT
    ) {
      pushViolation(
        violations,
        "reference_approval_scene_set_invalid",
        `App-owned baseline approval receipt must contain exactly ${EXPECTED_SCENE_COUNT} unique scenes`,
      );
      return approvedScenes;
    }
    for (const scene of receipt.scenes) {
      const contractScene = policy.scenes.find(
        (entry) => entry.id === scene.scene_id,
      );
      if (
        !contractScene ||
        scene.image !== contractScene.image ||
        !SHA256_PATTERN.test(scene.reference_screenshot_sha256) ||
        scene.verdict !== "accepted"
      ) {
        pushViolation(
          violations,
          "reference_approval_scene_invalid",
          "Every approved scene must bind its canonical image, SHA-256, and accepted human verdict",
          scene.scene_id || undefined,
        );
        continue;
      }
      approvedScenes.set(scene.scene_id, scene);
    }
  } catch (error) {
    pushViolation(
      violations,
      "reference_approval_receipt_invalid",
      `App-owned baseline approval receipt cannot be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return approvedScenes;
}

function expectedDimensions(
  viewports: JsonRecord,
  viewport: string,
): { width: number; height: number } {
  const dimensions = record(viewports[viewport]);
  return {
    width: finiteNumber(dimensions.width),
    height: finiteNumber(dimensions.height),
  };
}

function validateMasks(
  scene: SceneContract,
  dimensions: { width: number; height: number },
  allowedReasons: string[],
  violations: Violation[],
): Mask[] {
  const valid: Mask[] = [];
  for (const mask of scene.masks) {
    if (
      !Number.isInteger(mask.x) ||
      !Number.isInteger(mask.y) ||
      !Number.isInteger(mask.width) ||
      !Number.isInteger(mask.height) ||
      mask.x < 0 ||
      mask.y < 0 ||
      mask.width <= 0 ||
      mask.height <= 0 ||
      mask.x + mask.width > dimensions.width ||
      mask.y + mask.height > dimensions.height
    ) {
      pushViolation(
        violations,
        "invalid_mask_bounds",
        "declared mask must use positive integer bounds inside the scene",
        scene.id,
      );
      continue;
    }
    if (!allowedReasons.includes(mask.reason)) {
      pushViolation(
        violations,
        "invalid_mask_reason",
        `declared mask reason ${JSON.stringify(mask.reason)} is not allowed`,
        scene.id,
      );
      continue;
    }
    valid.push(mask);
  }
  return valid;
}

function validateBinding(
  binding: Binding | undefined,
  scene: SceneContract,
  requiredFields: string[],
  expected: {
    referenceBaselineId: string;
    referenceApprovalReceiptSha256: string;
    appContractRef: string;
    referenceDigest: string | null;
    candidateDigest: string | null;
    acceptedVerdict: string;
  },
  violations: Violation[],
): void {
  if (!binding) {
    pushViolation(
      violations,
      "missing_binding",
      "scene comparison binding is missing",
      scene.id,
    );
    return;
  }
  for (const field of [...requiredFields, "verdict"]) {
    if (!stringValue(binding[field])) {
      pushViolation(
        violations,
        "incomplete_binding",
        `binding field ${field} is missing`,
        scene.id,
      );
    }
  }
  const exactFields: Record<string, string> = {
    scene_id: scene.id,
    reference_baseline_id: expected.referenceBaselineId,
    reference_approval_receipt_sha256:
      expected.referenceApprovalReceiptSha256,
    app_contract_ref: expected.appContractRef,
    viewport: scene.viewport,
    theme: scene.theme,
    locale: scene.locale,
    route: scene.route,
    state: scene.state,
    verdict: expected.acceptedVerdict,
  };
  for (const [field, expectedValue] of Object.entries(exactFields)) {
    if (stringValue(binding[field]) !== expectedValue) {
      pushViolation(
        violations,
        field === "verdict"
          ? "human_review_not_accepted"
          : "binding_mismatch",
        `${field} must equal ${JSON.stringify(expectedValue)}`,
        scene.id,
      );
    }
  }
  for (const field of [
    "shell_commit",
    "package_or_dev_build_identity",
    "os_version",
    "architecture",
    "display_scale",
  ]) {
    if (!stringValue(binding[field])) {
      pushViolation(
        violations,
        "incomplete_capture_identity",
        `${field} must bind the captured candidate`,
        scene.id,
      );
    }
  }
  for (const [field, actualDigest] of [
    ["reference_screenshot_sha256", expected.referenceDigest],
    ["candidate_screenshot_sha256", expected.candidateDigest],
  ] as const) {
    const declaredDigest = stringValue(binding[field]);
    if (!SHA256_PATTERN.test(declaredDigest)) {
      pushViolation(
        violations,
        "invalid_sha256_binding",
        `${field} must be a lowercase 64-character SHA-256 digest`,
        scene.id,
      );
    } else if (actualDigest !== null && declaredDigest !== actualDigest) {
      pushViolation(
        violations,
        "screenshot_sha256_mismatch",
        `${field} does not match the compared PNG bytes`,
        scene.id,
      );
    }
  }
}

function listPngNames(directory: string): string[] {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    return [];
  }
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
    .map((entry) => entry.name)
    .sort();
}

function safeReadPng(
  filePath: string,
  kind: "reference" | "candidate",
  sceneId: string,
  violations: Violation[],
): { bytes: Buffer; image: RgbaImage; digest: string } | null {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    pushViolation(
      violations,
      "missing_scene_png",
      `${kind} PNG is missing`,
      sceneId,
    );
    return null;
  }
  try {
    const bytes = fs.readFileSync(filePath);
    return { bytes, image: decodePng(bytes), digest: sha256(bytes) };
  } catch (error) {
    pushViolation(
      violations,
      "invalid_scene_png",
      `${kind} PNG could not be decoded: ${error instanceof Error ? error.message : String(error)}`,
      sceneId,
    );
    return null;
  }
}

function writeDiff(
  directory: string,
  sceneId: string,
  image: RgbaImage,
): string {
  fs.mkdirSync(directory, { recursive: true });
  const name = `${sceneId}.diff.png`;
  fs.writeFileSync(path.join(directory, name), encodeRgbaPng(image));
  return name;
}

export function compareGuiVisualCohort(
  rawInput: unknown,
  baseDirectory: string,
  authority: ComparisonAuthority,
): ComparisonReceipt {
  const input = parseInput(rawInput);
  const violations: Violation[] = [];
  const policy = validateAuthority(authority, violations);
  if (input.schema !== INPUT_SCHEMA) {
    pushViolation(
      violations,
      "invalid_input_schema",
      `input schema must be ${INPUT_SCHEMA}`,
    );
  }
  for (const field of [
    "reference_directory",
    "candidate_directory",
    "diff_directory",
  ] as const) {
    if (!input[field]) {
      pushViolation(
        violations,
        "missing_input_path",
        `${field} must be a non-empty path`,
      );
    }
  }

  const referenceDirectory = path.resolve(
    baseDirectory,
    input.reference_directory || ".",
  );
  const candidateDirectory = path.resolve(
    baseDirectory,
    input.candidate_directory || ".",
  );
  const diffDirectory = path.resolve(
    baseDirectory,
    input.diff_directory || ".",
  );
  const approvedReferenceScenes = validateBaselineApprovalReceipt(
    referenceDirectory,
    policy,
    violations,
  );
  if (
    referenceDirectory === candidateDirectory ||
    referenceDirectory === diffDirectory ||
    candidateDirectory === diffDirectory
  ) {
    pushViolation(
      violations,
      "input_directory_collision",
      "reference, candidate, and diff directories must be distinct",
    );
  }

  const bindingsById = new Map<string, Binding>();
  for (const binding of input.bindings) {
    const id = stringValue(binding.scene_id);
    if (!id || bindingsById.has(id)) {
      pushViolation(
        violations,
        id ? "duplicate_binding" : "invalid_binding_scene_id",
        id
          ? `binding for ${id} appears more than once`
          : "binding scene_id is missing",
        id || undefined,
      );
    } else {
      bindingsById.set(id, binding);
    }
  }
  const expectedSceneIds = new Set(policy.scenes.map((scene) => scene.id));
  for (const id of bindingsById.keys()) {
    if (!expectedSceneIds.has(id)) {
      pushViolation(
        violations,
        "unexpected_binding",
        `binding references unknown scene ${id}`,
        id,
      );
    }
  }
  if (input.bindings.length !== EXPECTED_SCENE_COUNT) {
    pushViolation(
      violations,
      "binding_count_mismatch",
      `input must contain exactly ${EXPECTED_SCENE_COUNT} scene bindings`,
    );
  }

  for (const [kind, directory] of [
    ["reference", referenceDirectory],
    ["candidate", candidateDirectory],
  ] as const) {
    const actual = listPngNames(directory);
    const expected = policy.scenes.map((scene) => scene.image).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      pushViolation(
        violations,
        "scene_file_set_mismatch",
        `${kind} directory must contain exactly the canonical ${EXPECTED_SCENE_COUNT} PNG names`,
      );
    }
  }

  const sceneReceipts: SceneReceipt[] = [];
  for (const scene of policy.scenes) {
    const sceneViolations: Violation[] = [];
    const dimensions = expectedDimensions(policy.viewports, scene.viewport);
    if (
      !Number.isInteger(dimensions.width) ||
      !Number.isInteger(dimensions.height) ||
      dimensions.width <= 0 ||
      dimensions.height <= 0
    ) {
      pushViolation(
        sceneViolations,
        "invalid_viewport_dimensions",
        `viewport ${scene.viewport} does not define positive integer dimensions`,
        scene.id,
      );
    }
    const reference = safeReadPng(
      path.join(referenceDirectory, scene.image),
      "reference",
      scene.id,
      sceneViolations,
    );
    const approvedReference = approvedReferenceScenes.get(scene.id);
    if (
      !reference ||
      !approvedReference ||
      approvedReference.reference_screenshot_sha256 !== reference.digest
    ) {
      pushViolation(
        sceneViolations,
        "reference_png_not_approved",
        "Reference PNG bytes must match the human-approved scene receipt",
        scene.id,
      );
    }
    const candidate = safeReadPng(
      path.join(candidateDirectory, scene.image),
      "candidate",
      scene.id,
      sceneViolations,
    );
    validateBinding(
      bindingsById.get(scene.id),
      scene,
      policy.requiredBindingFields,
      {
        referenceBaselineId: policy.expectedReferenceBaselineId,
        referenceApprovalReceiptSha256:
          policy.expectedReferenceApprovalReceiptSha256,
        appContractRef: policy.expectedAppContractRef,
        referenceDigest: reference?.digest ?? null,
        candidateDigest: candidate?.digest ?? null,
        acceptedVerdict: policy.acceptedVerdict,
      },
      sceneViolations,
    );
    const masks = validateMasks(
      scene,
      dimensions,
      policy.acceptedMaskReasons,
      sceneViolations,
    );

    let metrics: PixelComparison | null = null;
    let diff = failureDiff();
    if (reference && candidate) {
      const observedMatch =
        reference.image.width === candidate.image.width &&
        reference.image.height === candidate.image.height;
      const expectedMatch =
        reference.image.width === dimensions.width &&
        reference.image.height === dimensions.height &&
        candidate.image.width === dimensions.width &&
        candidate.image.height === dimensions.height;
      if (!observedMatch || !expectedMatch) {
        pushViolation(
          sceneViolations,
          "dimension_mismatch",
          `both PNGs must match the canonical ${dimensions.width}x${dimensions.height} viewport`,
          scene.id,
        );
        diff = failureDiff(dimensions.width, dimensions.height);
      } else {
        metrics = comparePixels(
          reference.image,
          candidate.image,
          masks,
          policy.threshold,
        );
        diff = metrics.diff;
        const maskedRatio = metrics.maskedPixels / metrics.totalPixels;
        if (maskedRatio > policy.maximumMaskRatio) {
          pushViolation(
            sceneViolations,
            "masked_area_ratio_exceeded",
            `masked pixel ratio ${maskedRatio} exceeds ${policy.maximumMaskRatio}`,
            scene.id,
          );
        }
        if (metrics.comparedPixels === 0) {
          pushViolation(
            sceneViolations,
            "no_unmasked_pixels",
            "at least one unmasked pixel is required",
            scene.id,
          );
        }
        if (metrics.changedPixelRatio > policy.ratioMax) {
          pushViolation(
            sceneViolations,
            "changed_pixel_ratio_exceeded",
            `changed pixel ratio ${metrics.changedPixelRatio} exceeds ${policy.ratioMax}`,
            scene.id,
          );
        }
        if (metrics.meanAbsoluteChannelDelta > policy.madMax) {
          pushViolation(
            sceneViolations,
            "mean_absolute_channel_delta_exceeded",
            `mean absolute channel delta ${metrics.meanAbsoluteChannelDelta} exceeds ${policy.madMax}`,
            scene.id,
          );
        }
      }
    }

    const diffName = writeDiff(diffDirectory, scene.id, diff);
    violations.push(...sceneViolations);
    sceneReceipts.push({
      scene_id: scene.id,
      status: sceneViolations.length === 0 ? "passed" : "failed",
      image: scene.image,
      expected_dimensions: dimensions,
      observed_dimensions: {
        reference: reference
          ? {
              width: reference.image.width,
              height: reference.image.height,
            }
          : null,
        candidate: candidate
          ? {
              width: candidate.image.width,
              height: candidate.image.height,
            }
          : null,
      },
      reference_screenshot_sha256: reference?.digest ?? null,
      candidate_screenshot_sha256: candidate?.digest ?? null,
      diff_png: diffName,
      total_pixels: metrics?.totalPixels ?? null,
      masked_pixels: metrics?.maskedPixels ?? null,
      masked_pixel_ratio: metrics
        ? metrics.maskedPixels / metrics.totalPixels
        : null,
      compared_pixels: metrics?.comparedPixels ?? null,
      changed_pixels: metrics?.changedPixels ?? null,
      changed_pixel_ratio: metrics?.changedPixelRatio ?? null,
      mean_absolute_channel_delta:
        metrics && Number.isFinite(metrics.meanAbsoluteChannelDelta)
          ? metrics.meanAbsoluteChannelDelta
          : null,
      human_review_verdict:
        stringValue(bindingsById.get(scene.id)?.verdict) || null,
      violations: sceneViolations,
    });
  }

  const passedSceneCount = sceneReceipts.filter(
    (scene) => scene.status === "passed",
  ).length;
  const allScenesCompared =
    sceneReceipts.length === EXPECTED_SCENE_COUNT &&
    sceneReceipts.every((scene) => scene.compared_pixels !== null);
  const layoutChecked =
    sceneReceipts.length === EXPECTED_SCENE_COUNT &&
    sceneReceipts.every(
      (scene) =>
        scene.observed_dimensions.reference?.width ===
          scene.expected_dimensions.width &&
        scene.observed_dimensions.reference?.height ===
          scene.expected_dimensions.height &&
        scene.observed_dimensions.candidate?.width ===
          scene.expected_dimensions.width &&
        scene.observed_dimensions.candidate?.height ===
          scene.expected_dimensions.height,
    );
  const visualDeltaReviewed =
    sceneReceipts.length === EXPECTED_SCENE_COUNT &&
    sceneReceipts.every(
      (scene) => scene.human_review_verdict === policy.acceptedVerdict,
    );
  const status = violations.length === 0 ? "passed" : "failed";

  return {
    schema: COMPARATOR_SCHEMA,
    status,
    authority: {
      comparator: SCRIPT_RELATIVE_PATH,
      cohort_schema: stringValue(authority.cohort.schema),
      cohort_sha256: sha256(authority.cohortBytes),
      app_contract_sha256: sha256(authority.appContractBytes),
    },
    thresholds: {
      pixel_channel_delta_threshold: policy.threshold,
      changed_pixel_ratio_max: policy.ratioMax,
      mean_absolute_channel_delta_max: policy.madMax,
      alpha_channel_included: true,
      maximum_masked_area_ratio: policy.maximumMaskRatio,
    },
    summary: {
      expected_scene_count: EXPECTED_SCENE_COUNT,
      compared_scene_count: sceneReceipts.filter(
        (scene) => scene.compared_pixels !== null,
      ).length,
      passed_scene_count: passedSceneCount,
      failed_scene_count: sceneReceipts.length - passedSceneCount,
    },
    claims: {
      scene_compared: allScenesCompared,
      layout_checked: layoutChecked,
      visual_delta_reviewed: visualDeltaReviewed,
      scene_bound_visual_parity:
        status === "passed" &&
        allScenesCompared &&
        layoutChecked &&
        visualDeltaReviewed,
    },
    forbidden_inferences: policy.forbiddenInferences,
    scenes: sceneReceipts,
    violations,
  };
}

function parseCliArgs(args: string[]): {
  inputPath: string;
  outputPath: string | null;
} {
  let inputPath = "";
  let outputPath: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;
    if (value === "--input") inputPath = args[++index] ?? "";
    else if (value === "--output") outputPath = args[++index] ?? "";
    else throw new Error(`unknown argument ${value}`);
  }
  if (!inputPath) throw new Error("--input is required");
  if (outputPath === "") throw new Error("--output requires a path");
  return { inputPath: path.resolve(inputPath), outputPath };
}

function readJsonFile(filePath: string): { value: unknown; bytes: Buffer } {
  const bytes = fs.readFileSync(filePath);
  return { value: JSON.parse(bytes.toString("utf8")), bytes };
}

function cliFailure(message: string): JsonRecord {
  return {
    schema: COMPARATOR_SCHEMA,
    status: "failed",
    violations: [{ code: "comparator_execution_failed", message }],
  };
}

export function runCli(args: string[]): number {
  let outputPath: string | null = null;
  try {
    const options = parseCliArgs(args);
    outputPath = options.outputPath
      ? path.resolve(options.outputPath)
      : null;
    const inputFile = readJsonFile(options.inputPath);
    const appRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const appContractFile = readJsonFile(
      path.join(appRoot, "contracts/app-gui-product-contract.json"),
    );
    const appContract = record(appContractFile.value);
    const protocol = record(
      record(appContract.gui_maintenance_policy).visual_comparison_protocol,
    );
    const cohortRelativePath = stringValue(
      protocol.active_reference_cohort_ref,
    );
    if (!cohortRelativePath || path.isAbsolute(cohortRelativePath)) {
      throw new Error("canonical cohort reference is invalid");
    }
    const cohortFile = readJsonFile(path.join(appRoot, cohortRelativePath));
    const receipt = compareGuiVisualCohort(
      inputFile.value,
      path.dirname(options.inputPath),
      {
        cohort: record(cohortFile.value),
        cohortBytes: cohortFile.bytes,
        appContract,
        appContractBytes: appContractFile.bytes,
      },
    );
    const rendered = `${JSON.stringify(receipt, null, 2)}\n`;
    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, rendered, "utf8");
    }
    process.stdout.write(rendered);
    return receipt.status === "passed" ? 0 : 1;
  } catch (error) {
    const failure = cliFailure(
      error instanceof Error ? error.message : String(error),
    );
    const rendered = `${JSON.stringify(failure, null, 2)}\n`;
    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, rendered, "utf8");
    }
    process.stdout.write(rendered);
    return 1;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = runCli(process.argv.slice(2));
}
