import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type BuildArtifactCohortV2 = {
  schema: 'opl_app_build_artifact_cohort.v2';
  release: {
    stable_session_id: string | null;
    release_cohort_ref: string | null;
  };
  cohort: {
    app_sha: string;
    shell_sha: string;
    framework_sha: string | null;
  };
  build: {
    version: string;
    kind: 'standard' | 'full';
  };
  artifact: {
    name: string;
    sha256: string;
    size_bytes: number;
  };
  actions: {
    run_id: string;
    run_attempt: string;
    artifact_name: string;
  };
  digests: {
    packaged_tree_sha256: string;
    app_product_profile_sha256: string;
    gui_product_contract_sha256: string;
    smoke_harness_sha256: string;
  };
};

const shaPattern = /^[0-9a-f]{40}$/i;
const digestPattern = /^[0-9a-f]{64}$/i;

export function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function collectTreeEntries(root: string, relative = ''): string[] {
  const directory = path.join(root, relative);
  return fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const childRelative = path.posix.join(relative.split(path.sep).join('/'), entry.name);
      const childPath = path.join(root, childRelative);
      const stat = fs.lstatSync(childPath);
      const mode = (stat.mode & 0o777).toString(8);
      if (entry.isDirectory()) return [`D\t${childRelative}\t${mode}`, ...collectTreeEntries(root, childRelative)];
      if (entry.isSymbolicLink()) return [`L\t${childRelative}\t${mode}\t${fs.readlinkSync(childPath)}`];
      return [`F\t${childRelative}\t${mode}\t${stat.size}\t${sha256File(childPath)}`];
    });
}

export function sha256Tree(root: string): string {
  if (!fs.statSync(root).isDirectory()) throw new Error(`Packaged tree is not a directory: ${root}`);
  return crypto.createHash('sha256').update(`${collectTreeEntries(root).join('\n')}\n`).digest('hex');
}

export function buildArtifactCohortV2(input: {
  appSha: string;
  shellSha: string;
  frameworkSha?: string;
  version: string;
  kind: 'standard' | 'full';
  artifactPath: string;
  artifactName: string;
  packagedTreePath: string;
  appProductProfilePath: string;
  guiProductContractPath: string;
  smokeHarnessPath: string;
  actionsRunId: string;
  actionsRunAttempt: string;
  actionsArtifactName: string;
  stableSessionId?: string;
  releaseCohortRef?: string;
}): BuildArtifactCohortV2 {
  return {
    schema: 'opl_app_build_artifact_cohort.v2',
    release: {
      stable_session_id: input.stableSessionId || null,
      release_cohort_ref: input.releaseCohortRef || null,
    },
    cohort: {
      app_sha: input.appSha,
      shell_sha: input.shellSha,
      framework_sha: input.frameworkSha || null,
    },
    build: { version: input.version, kind: input.kind },
    artifact: {
      name: input.artifactName,
      sha256: sha256File(input.artifactPath),
      size_bytes: fs.statSync(input.artifactPath).size,
    },
    actions: {
      run_id: input.actionsRunId,
      run_attempt: input.actionsRunAttempt,
      artifact_name: input.actionsArtifactName,
    },
    digests: {
      packaged_tree_sha256: sha256Tree(input.packagedTreePath),
      app_product_profile_sha256: sha256File(input.appProductProfilePath),
      gui_product_contract_sha256: sha256File(input.guiProductContractPath),
      smoke_harness_sha256: sha256File(input.smokeHarnessPath),
    },
  };
}

export function validateArtifactCohortV2(
  manifest: BuildArtifactCohortV2,
  expected: {
    appSha: string;
    shellSha: string;
    frameworkSha?: string;
    version?: string;
    artifactPath?: string;
    actionsRunId?: string;
    stableSessionId?: string;
    releaseCohortRef?: string;
  },
): string[] {
  const errors: string[] = [];
  if (manifest.schema !== 'opl_app_build_artifact_cohort.v2') return [`unsupported schema ${String(manifest.schema)}`];
  if (!manifest.release || !manifest.cohort || !manifest.build || !manifest.artifact || !manifest.actions || !manifest.digests) {
    return ['manifest is missing required v2 identity sections'];
  }
  if (manifest.release.stable_session_id !== null && !/^sha256:[0-9a-f]{64}$/.test(manifest.release.stable_session_id)) {
    errors.push('stable_session_id must be a lowercase sha256 ref');
  }
  if (manifest.release.release_cohort_ref !== null && !/^sha256:[0-9a-f]{64}$/.test(manifest.release.release_cohort_ref)) {
    errors.push('release_cohort_ref must be a lowercase sha256 ref');
  }
  if (expected.stableSessionId && manifest.release.stable_session_id !== expected.stableSessionId) {
    errors.push(`stable_session_id expected ${expected.stableSessionId} but artifact contains ${String(manifest.release.stable_session_id)}`);
  }
  if (expected.releaseCohortRef && manifest.release.release_cohort_ref !== expected.releaseCohortRef) {
    errors.push(`release_cohort_ref expected ${expected.releaseCohortRef} but artifact contains ${String(manifest.release.release_cohort_ref)}`);
  }
  for (const [label, value] of [
    ['manifest app_sha', manifest.cohort?.app_sha],
    ['manifest shell_sha', manifest.cohort?.shell_sha],
    ['expected app_sha', expected.appSha],
    ['expected shell_sha', expected.shellSha],
  ] as const) {
    if (!shaPattern.test(value || '')) errors.push(`${label} must be a 40-character Git SHA`);
  }
  if (manifest.cohort?.app_sha !== expected.appSha) errors.push(`app_sha expected ${expected.appSha} but artifact contains ${manifest.cohort?.app_sha}`);
  if (manifest.cohort?.shell_sha !== expected.shellSha) errors.push(`shell_sha expected ${expected.shellSha} but artifact contains ${manifest.cohort?.shell_sha}`);
  if (expected.frameworkSha && manifest.cohort?.framework_sha !== expected.frameworkSha) errors.push(`framework_sha expected ${expected.frameworkSha} but artifact contains ${String(manifest.cohort?.framework_sha)}`);
  if (expected.version && manifest.build?.version !== expected.version) errors.push(`version expected ${expected.version} but artifact contains ${manifest.build?.version}`);
  if (expected.actionsRunId && manifest.actions?.run_id !== expected.actionsRunId) errors.push(`actions run expected ${expected.actionsRunId} but artifact contains ${manifest.actions?.run_id}`);
  if (!manifest.artifact?.name || !digestPattern.test(manifest.artifact?.sha256 || '') || !Number.isSafeInteger(manifest.artifact?.size_bytes) || manifest.artifact.size_bytes <= 0) errors.push('artifact identity must include name, SHA-256, and positive size');
  for (const [label, value] of Object.entries(manifest.digests || {})) {
    if (!digestPattern.test(value)) errors.push(`${label} must be a SHA-256 digest`);
  }
  if (Object.keys(manifest.digests || {}).length !== 4) errors.push('manifest must include all four source and packaged-tree digests');
  if (expected.artifactPath) {
    const actualSize = fs.statSync(expected.artifactPath).size;
    const actualSha = sha256File(expected.artifactPath);
    if (manifest.artifact.size_bytes !== actualSize) errors.push(`artifact size expected ${manifest.artifact.size_bytes} but downloaded ${actualSize}`);
    if (manifest.artifact.sha256 !== actualSha) errors.push(`artifact SHA-256 expected ${manifest.artifact.sha256} but downloaded ${actualSha}`);
  }
  return errors;
}
