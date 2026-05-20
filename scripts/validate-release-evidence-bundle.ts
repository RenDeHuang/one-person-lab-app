#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseContractPath = path.join(appRoot, 'contracts', 'app-release-channel.json');

type Options = {
  bundleDir: string;
};

type EvidenceArtifact = {
  id: string;
  path: string;
  kind: 'json' | 'image' | 'log';
  producer: string;
};

function parseArgs(argv: string[]): Options {
  const parsed = {
    bundleDir: process.env.OPL_RELEASE_EVIDENCE_BUNDLE_DIR || '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (token === '--bundle-dir') {
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --bundle-dir');
      }
      parsed.bundleDir = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!parsed.bundleDir.trim()) {
    throw new Error('Pass --bundle-dir <release-evidence-dir> or set OPL_RELEASE_EVIDENCE_BUNDLE_DIR.');
  }
  return {
    bundleDir: path.resolve(parsed.bundleDir),
  };
}

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertFile(filePath: string, label: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`${label} must be a file: ${filePath}`);
  }
}

function assertJsonFile(filePath: string, label: string) {
  assertFile(filePath, label);
  try {
    readJson(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} must be valid JSON: ${message}`);
  }
}

function assertImageFile(filePath: string, label: string) {
  assertFile(filePath, label);
  if (!/\.(png|jpg|jpeg|webp)$/i.test(filePath)) {
    throw new Error(`${label} must be a screenshot image file: ${filePath}`);
  }
}

function assertLogFile(filePath: string, label: string) {
  assertFile(filePath, label);
  if (!fs.readFileSync(filePath, 'utf8').trim()) {
    throw new Error(`${label} must not be empty: ${filePath}`);
  }
}

function validateContractBoundary(bundle: unknown): EvidenceArtifact[] {
  const record = bundle as {
    purpose?: unknown;
    acceptance_path?: unknown;
    refs_only?: unknown;
    required_artifacts?: unknown;
    forbidden_authority?: unknown;
  };
  if (record.purpose !== 'runtime_page_operator_evidence_acceptance') {
    throw new Error(`Unexpected operator evidence bundle purpose: ${String(record.purpose)}`);
  }
  if (record.acceptance_path !== 'Runtime page') {
    throw new Error(`Unexpected operator evidence bundle acceptance path: ${String(record.acceptance_path)}`);
  }
  if (record.refs_only !== true) {
    throw new Error('Operator evidence bundle must be refs-only.');
  }
  if (!Array.isArray(record.required_artifacts) || record.required_artifacts.length === 0) {
    throw new Error('Operator evidence bundle must declare required artifacts.');
  }
  const forbiddenAuthority = Array.isArray(record.forbidden_authority) ? record.forbidden_authority : [];
  for (const forbidden of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    if (!forbiddenAuthority.includes(forbidden)) {
      throw new Error(`Operator evidence bundle must exclude ${forbidden}`);
    }
  }
  return record.required_artifacts as EvidenceArtifact[];
}

function validateBundle(bundleDir: string) {
  const releaseContract = readJson(releaseContractPath);
  const artifacts = validateContractBoundary(releaseContract.operator_evidence_bundle);
  const verified = [];

  for (const artifact of artifacts) {
    if (!artifact.id || !artifact.path || !artifact.kind || !artifact.producer) {
      throw new Error(`Invalid operator evidence artifact contract: ${JSON.stringify(artifact)}`);
    }
    const filePath = path.join(bundleDir, artifact.path);
    if (artifact.kind === 'json') {
      assertJsonFile(filePath, artifact.id);
    } else if (artifact.kind === 'image') {
      assertImageFile(filePath, artifact.id);
    } else if (artifact.kind === 'log') {
      assertLogFile(filePath, artifact.id);
    } else {
      throw new Error(`Unsupported operator evidence artifact kind: ${artifact.kind}`);
    }
    verified.push({
      id: artifact.id,
      path: artifact.path,
      kind: artifact.kind,
      producer: artifact.producer,
    });
  }

  return {
    status: 'passed',
    bundle_dir: bundleDir,
    evidence_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    verified_artifact_count: verified.length,
    verified_artifacts: verified,
  };
}

try {
  const options = parseArgs(process.argv.slice(2));
  console.log(`${JSON.stringify(validateBundle(options.bundleDir), null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
