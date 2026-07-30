#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export type Sha256SumEntry = {
  name: string;
  size_bytes: number;
  sha256: string;
};

function sha256File(filePath: string): string {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

export function writeSha256Sums(
  outputPath: string,
  inputPaths: string[],
): { output: string; entries: Sha256SumEntry[] } {
  if (inputPaths.length === 0) {
    throw new Error("At least one checksum input file is required.");
  }

  const output = path.resolve(outputPath);
  const seenNames = new Set<string>();
  const entries = inputPaths.map((inputPath) => {
    const resolved = path.resolve(inputPath);
    if (resolved === output) {
      throw new Error("Checksum output must not also be an input file.");
    }
    const stat = fs.lstatSync(resolved);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Checksum input must be a regular file: ${inputPath}`);
    }
    const name = path.basename(resolved);
    if (/[\r\n]/.test(name)) {
      throw new Error(`Checksum input basename contains a newline: ${name}`);
    }
    if (seenNames.has(name)) {
      throw new Error(`Checksum input basenames must be unique: ${name}`);
    }
    seenNames.add(name);
    return {
      name,
      size_bytes: stat.size,
      sha256: sha256File(resolved),
    };
  });

  const contents = `${entries.map((entry) => `${entry.sha256}  ${entry.name}`).join("\n")}\n`;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, contents, "utf8");

  if (fs.readFileSync(output, "utf8") !== contents) {
    throw new Error("SHA256SUMS.txt readback does not match written bytes.");
  }
  for (const [index, inputPath] of inputPaths.entries()) {
    if (sha256File(path.resolve(inputPath)) !== entries[index].sha256) {
      throw new Error(`Checksum input changed during readback: ${inputPath}`);
    }
  }

  return { output, entries };
}

function main() {
  const { values, positionals } = parseArgs({
    options: {
      output: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });
  if (!values.output) throw new Error("Missing --output");
  const result = writeSha256Sums(values.output, positionals);
  process.stdout.write(
    `${JSON.stringify({ status: "written_and_verified", ...result })}\n`,
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (invokedPath === import.meta.url) main();
