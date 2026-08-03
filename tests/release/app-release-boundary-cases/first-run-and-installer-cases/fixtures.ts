import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  runNode,
  writeExecutable,
  writeFile,
} from "../helpers.ts";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { validateFirstRunMatrix } from "../../../../scripts/validate-active-shell/first-run-matrix-validator.ts";
import { validateReleaseChannelContract } from "../../../../scripts/validate-active-shell/release-contract-validator.ts";
import { syncAppProductProfileToShell } from "../../../../scripts/app-product-profile.ts";
import { releaseBoundaryChecks } from "../../../../scripts/validate-release-boundary/release-checks.ts";

const readJson = (relativePath: string) =>
  JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), "utf8"));
const requireReleaseBoundaryCheck = (id: string) => {
  const check = releaseBoundaryChecks.find((entry) => entry.id === id);
  assert.ok(check, id);
  return check;
};

export {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  runNode,
  writeExecutable,
  writeFile,
  spawnSync,
  createHash,
  validateFirstRunMatrix,
  validateReleaseChannelContract,
  syncAppProductProfileToShell,
  releaseBoundaryChecks,
  readJson,
  requireReleaseBoundaryCheck,
};
