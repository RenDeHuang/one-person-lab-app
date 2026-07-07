#!/usr/bin/env node

import { parseArgs as parseNodeArgs } from 'node:util';
import { asRecord, readJsonFile } from './release-json-helpers.ts';
import { parseStrictBoolean } from './release-readiness-args.ts';

type Options = {
  version: string;
  recordPath: string;
  includeFullPackage: boolean;
  runVmSmoke: boolean;
  requireDockerWebui: boolean;
};

type RequiredJob = {
  id: string;
  reason: string;
};

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    version: process.env.OPL_RELEASE_VERSION || '',
    recordPath: process.env.OPL_RELEASE_ADDON_READINESS_RECORD || '',
    includeFullPackage: parseStrictBoolean(process.env.OPL_INCLUDE_FULL_PACKAGE, true),
    runVmSmoke: parseStrictBoolean(process.env.OPL_RUN_VM_SMOKE, true),
    requireDockerWebui: parseStrictBoolean(process.env.OPL_REQUIRE_DOCKER_WEBUI, true),
  };
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      version: { type: 'string' },
      record: { type: 'string' },
      'include-full-package': { type: 'string' },
      'run-vm-smoke': { type: 'string' },
      'require-docker-webui': { type: 'string' },
    },
  });
  parsed.version = values.version ?? parsed.version;
  parsed.recordPath = values.record ?? parsed.recordPath;
  if (values['include-full-package'] !== undefined) {
    parsed.includeFullPackage = parseStrictBoolean(values['include-full-package']);
  }
  if (values['run-vm-smoke'] !== undefined) {
    parsed.runVmSmoke = parseStrictBoolean(values['run-vm-smoke']);
  }
  if (values['require-docker-webui'] !== undefined) {
    parsed.requireDockerWebui = parseStrictBoolean(values['require-docker-webui']);
  }
  if (!parsed.version.trim()) throw new Error('Pass --version <version> or set OPL_RELEASE_VERSION.');
  if (!parsed.recordPath.trim()) throw new Error('Pass --record <release-addon-readiness-summary.json>.');
  return parsed;
}

function buildRequiredJobs(options: Options): RequiredJob[] {
  const jobs: RequiredJob[] = [];
  if (options.includeFullPackage) {
    jobs.push(
      { id: 'full-first-install', reason: 'Full first-install package was requested.' },
      { id: 'remote-verify-full', reason: 'Full remote assets must be verified before promotion.' },
    );
    if (options.runVmSmoke) {
      jobs.push({
        id: 'full-first-run-vm-smoke',
        reason: 'Full clean VM first-run smoke was requested.',
      });
    }
  }
  if (options.requireDockerWebui) {
    jobs.push(
      { id: 'docker-webui-smoke', reason: 'Docker/WebUI smoke evidence is required for this stable cohort.' },
      { id: 'webui-ghcr-publish', reason: 'GHCR WebUI publish evidence is required for this stable cohort.' },
      {
        id: 'docker-webui-clean-vm-evidence',
        reason: 'Docker/WebUI clean VM evidence is required for this stable cohort.',
      },
      {
        id: 'operator-evidence-bundle-validation',
        reason: 'Operator evidence bundle validation is required for the reviewed same cohort.',
      },
    );
  }
  return jobs;
}

function validate(options: Options) {
  const record = asRecord(readJsonFile(options.recordPath), 'release_addon_readiness_summary');
  const jobResults = asRecord(record.job_results, 'release_addon_readiness_summary.job_results');
  const errors: string[] = [];
  if (record.schema !== 'opl_release_addon_readiness_summary.v1') {
    errors.push(`schema is ${String(record.schema)}`);
  }
  if (record.version !== options.version) {
    errors.push(`version is ${String(record.version)}`);
  }
  for (const job of buildRequiredJobs(options)) {
    if (jobResults[job.id] !== 'success') {
      errors.push(`${job.id} is ${String(jobResults[job.id] ?? 'missing')}: ${job.reason}`);
    }
  }
  return {
    schema: 'opl_release_addon_readiness_validation.v1',
    status: errors.length === 0 ? 'verified' : 'blocked',
    version: options.version,
    record: options.recordPath,
    required_jobs: buildRequiredJobs(options).map((job) => job.id),
    job_results: jobResults,
    errors,
  };
}

try {
  const summary = validate(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.status !== 'verified') process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
