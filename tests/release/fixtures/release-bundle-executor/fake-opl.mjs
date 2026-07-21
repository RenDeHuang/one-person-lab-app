#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const responsePath = requiredEnv('OPL_FAKE_RESPONSE');
const callLogPath = requiredEnv('OPL_FAKE_CALL_LOG');
const response = JSON.parse(fs.readFileSync(responsePath, 'utf8'));

fs.mkdirSync(path.dirname(callLogPath), { recursive: true });
fs.appendFileSync(callLogPath, `${JSON.stringify(process.argv.slice(2))}\n`);
if (response.stderr) process.stderr.write(String(response.stderr));
if (response.raw_stdout !== undefined) {
  process.stdout.write(String(response.raw_stdout));
} else if (response.stdout !== undefined) {
  process.stdout.write(`${JSON.stringify(response.stdout)}\n`);
}
process.exit(Number.isInteger(response.exit_code) ? response.exit_code : 0);
