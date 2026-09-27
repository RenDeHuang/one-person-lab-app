#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function usage() {
  console.error("Usage: run-command-with-timeout.mjs --stdout-log FILE --stderr-log FILE --summary-path FILE -- COMMAND [ARGS...]");
  process.exit(2);
}

const argv = process.argv.slice(2);
const readOption = (name) => {
  const index = argv.indexOf(name);
  if (index < 0 || !argv[index + 1]) usage();
  return argv[index + 1];
};
const separator = argv.indexOf("--");
if (separator < 0 || separator === argv.length - 1) usage();
const stdoutPath = readOption("--stdout-log");
const stderrPath = readOption("--stderr-log");
const summaryPath = readOption("--summary-path");
const command = argv[separator + 1];
const args = argv.slice(separator + 2);
const budget = Number(process.env.VM_RUN_TIMEOUT_MS);
if (!Number.isSafeInteger(budget) || budget <= 0) {
  console.error("VM operation budget is invalid");
  process.exit(2);
}

for (const file of [stdoutPath, stderrPath, summaryPath]) fs.mkdirSync(path.dirname(file), { recursive: true });
const stdout = fs.createWriteStream(stdoutPath, { flags: "a" });
const stderr = fs.createWriteStream(stderrPath, { flags: "a" });
const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
let timedOut = false;
let interrupted = null;
let finished = false;
const terminate = () => {
  try {
    if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGKILL");
    else child.kill("SIGKILL");
  } catch {}
};
const onInterrupt = () => { interrupted = 130; terminate(); };
const onTerminate = () => { interrupted = 143; terminate(); };
process.once("SIGINT", onInterrupt);
process.once("SIGTERM", onTerminate);
child.stdout.on("data", (chunk) => { stdout.write(chunk); process.stdout.write(chunk); });
child.stderr.on("data", (chunk) => { stderr.write(chunk); process.stderr.write(chunk); });
const timer = setTimeout(() => { timedOut = true; terminate(); }, budget);
const finish = (code) => {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  process.removeListener("SIGINT", onInterrupt);
  process.removeListener("SIGTERM", onTerminate);
  stdout.end();
  stderr.end();
  if (timedOut) {
    let prior = {};
    try { prior = JSON.parse(fs.readFileSync(summaryPath, "utf8")); } catch {}
    fs.writeFileSync(summaryPath, `${JSON.stringify({ ...prior, surface_id: "opl_tart_gui_first_run_smoke", status: "failed", failure: { stage: "operation_deadline_elapsed", message: "Exact-candidate VM run exceeded the immutable remaining operation budget" } }, null, 2)}\n`);
  }
  process.exitCode = timedOut ? 124 : (interrupted ?? code ?? 1);
};
for (const stream of [stdout, stderr]) stream.once("error", (error) => { console.error(error.message); interrupted = 1; terminate(); });
child.once("error", (error) => { console.error(error.message); finish(1); });
child.once("close", finish);
