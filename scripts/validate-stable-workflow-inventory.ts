import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

type JsonRecord = Record<string, unknown>;

export type StableWorkflowInventoryOptions = {
  repoRoot: string;
  entryWorkflow?: string;
};

type InventoryStep = {
  name: string;
  uses: string | null;
  run: string | null;
};

type InventoryJob = {
  invocation_path: string;
  workflow_path: string;
  job_id: string;
  name: string;
  condition: string | null;
  inherited_conditions: string[];
  reusable_target: string | null;
  steps: InventoryStep[];
};

type ReusableCallSite = {
  invocation_path: string;
  workflow_path: string;
  job_id: string;
  condition: string | null;
  target: string;
  local: boolean;
  expanded_total_jobs: number;
  expanded_explicit_steps: number;
};

type Hotspot = {
  key: string;
  count: number;
  locations: string[];
};

export type StableWorkflowInventoryReport = {
  schema: 'opl_stable_workflow_inventory.v1';
  inventory_mode: 'all_declared_conditional_paths';
  entry_workflow: string;
  total_jobs: number;
  explicit_steps: number;
  workflow_instance_count: number;
  reusable_call_count: number;
  conditional_job_count: number;
  workflows: Array<{
    invocation_path: string;
    workflow_path: string;
    execution_jobs: number;
    explicit_steps: number;
  }>;
  reusable_calls: ReusableCallSite[];
  conditional_paths: Array<{
    invocation_path: string;
    workflow_path: string;
    job_id: string;
    condition: string;
    inherited_conditions: string[];
  }>;
  business_stage_coverage: Array<{
    stage_id: string;
    status: 'covered' | 'uncovered';
    evidence: string[];
  }>;
  duplicate_setup_hotspots: Hotspot[];
  duplicate_transport_hotspots: Hotspot[];
  budget_enforcement_enabled: false;
};

const businessStages = Array.from({ length: 12 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `stage_${number}`,
    markers: [`stable stage ${number}`, `business stage ${number}`],
  };
});

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function repoRelative(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function resolveWorkflowPath(repoRoot: string, workflowRoot: string, requestedPath: string): string {
  if (!requestedPath || path.isAbsolute(requestedPath)) {
    throw new Error(`Workflow path must be repository-relative: ${requestedPath || '<empty>'}`);
  }
  const resolved = path.resolve(repoRoot, requestedPath);
  if (resolved !== workflowRoot && !resolved.startsWith(`${workflowRoot}${path.sep}`)) {
    throw new Error(`Workflow path escapes .github/workflows: ${requestedPath}`);
  }
  let component = repoRoot;
  for (const part of path.relative(repoRoot, resolved).split(path.sep).filter(Boolean)) {
    component = path.join(component, part);
    if (fs.lstatSync(component, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error(`Workflow path must not contain symbolic links: ${requestedPath}`);
    }
  }
  const stat = fs.lstatSync(resolved, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Workflow must be a regular file: ${requestedPath}`);
  }
  return resolved;
}

function localReusableTarget(uses: string): string {
  if (!uses.startsWith('./')) {
    throw new Error(`Cannot inventory unknown reusable workflow target: ${uses}`);
  }
  if (!uses.startsWith('./.github/workflows/')) {
    throw new Error(`Unsupported repository-local reusable workflow target: ${uses}`);
  }
  return uses.slice(2);
}

function inventoryStep(value: unknown, label: string): InventoryStep {
  const step = record(value, label);
  return {
    name: optionalString(step.name) ?? label,
    uses: optionalString(step.uses),
    run: optionalString(step.run),
  };
}

function hotspotKey(step: InventoryStep, category: 'setup' | 'transport'): string | null {
  const action = step.uses?.split('@')[0] ?? '';
  const normalizedName = normalizeSearchText(step.name);
  const normalizedRun = normalizeSearchText(step.run ?? '');
  if (category === 'setup') {
    if (
      action === 'actions/checkout'
      || action.startsWith('actions/setup-')
      || action.includes('setup-bun')
      || action.includes('setup-python')
    ) {
      return action;
    }
    if (/^(setup|checkout|install dependencies|install .* tooling)/.test(normalizedName)) {
      return `step:${normalizedName}`;
    }
    return null;
  }
  if (action === 'actions/upload-artifact' || action === 'actions/download-artifact') {
    return action;
  }
  if (/(upload|download|restore).*artifact|checkpoint transport/.test(normalizedName)) {
    return `step:${normalizedName}`;
  }
  if (/(gh release upload|gh run download)/.test(normalizedRun)) {
    return `run:${normalizedRun.match(/gh (?:release upload|run download)/)?.[0] ?? 'artifact transport'}`;
  }
  return null;
}

function collectHotspots(jobs: InventoryJob[], category: 'setup' | 'transport'): Hotspot[] {
  const locationsByKey = new Map<string, string[]>();
  for (const job of jobs) {
    for (const [index, step] of job.steps.entries()) {
      const key = hotspotKey(step, category);
      if (!key) continue;
      const location = `${job.invocation_path}:${job.job_id}:step${index + 1}`;
      locationsByKey.set(key, [...(locationsByKey.get(key) ?? []), location]);
    }
  }
  return [...locationsByKey.entries()]
    .filter(([, locations]) => locations.length > 1)
    .map(([key, locations]) => ({ key, count: locations.length, locations }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function stageCoverage(jobs: InventoryJob[]): StableWorkflowInventoryReport['business_stage_coverage'] {
  const searchable = jobs.map((job) => ({
    location: `${job.invocation_path}:${job.job_id}`,
    text: normalizeSearchText([
      job.workflow_path,
      job.job_id,
      job.name,
      job.reusable_target ?? '',
      ...job.steps.flatMap((step) => [step.name, step.uses ?? '']),
    ].join(' ')),
  }));
  return businessStages.map((stage) => {
    const evidence = searchable
      .filter(({ text }) => [
        normalizeSearchText(stage.id),
        ...stage.markers.map(normalizeSearchText),
      ].some((marker) => text.includes(marker)))
      .map(({ location }) => location)
      .filter((location, index, values) => values.indexOf(location) === index)
      .sort();
    return {
      stage_id: stage.id,
      status: evidence.length > 0 ? 'covered' as const : 'uncovered' as const,
      evidence,
    };
  });
}

export function buildStableWorkflowInventory(
  options: StableWorkflowInventoryOptions,
): StableWorkflowInventoryReport {
  const repoRoot = path.resolve(options.repoRoot);
  const workflowRoot = path.join(repoRoot, '.github', 'workflows');
  const entryWorkflow = options.entryWorkflow ?? '.github/workflows/release-stable.yml';

  const jobs: InventoryJob[] = [];
  const reusableCalls: ReusableCallSite[] = [];
  const workflowInstances: StableWorkflowInventoryReport['workflows'] = [];

  function expand(
    requestedPath: string,
    invocationPath: string,
    inheritedConditions: string[],
    stack: string[],
  ): void {
    const workflowPath = resolveWorkflowPath(repoRoot, workflowRoot, requestedPath);
    const relativePath = repoRelative(repoRoot, workflowPath);
    if (stack.includes(relativePath)) {
      throw new Error(`Reusable workflow cycle detected: ${[...stack, relativePath].join(' -> ')}`);
    }
    const parsed = record(parseYaml(fs.readFileSync(workflowPath, 'utf8')), relativePath);
    const workflowJobs = record(parsed.jobs, `${relativePath}.jobs`);
    let instanceExecutionJobs = 0;
    let instanceExplicitSteps = 0;

    for (const [jobId, rawJob] of Object.entries(workflowJobs)) {
      const job = record(rawJob, `${relativePath}.jobs.${jobId}`);
      const condition = optionalString(job.if);
      const uses = optionalString(job.uses);
      const target = uses ? localReusableTarget(uses) : null;
      const jobRecord: InventoryJob = {
        invocation_path: invocationPath,
        workflow_path: relativePath,
        job_id: jobId,
        name: optionalString(job.name) ?? jobId,
        condition,
        inherited_conditions: inheritedConditions,
        reusable_target: target ?? uses,
        steps: Array.isArray(job.steps)
          ? job.steps.map((step, index) => inventoryStep(step, `${relativePath}.${jobId}.steps[${index}]`))
          : [],
      };
      jobs.push(jobRecord);

      if (!uses) {
        instanceExecutionJobs += 1;
        instanceExplicitSteps += jobRecord.steps.length;
        continue;
      }

      const executionJobsBefore = jobs.filter((entry) => !entry.reusable_target).length;
      const explicitStepsBefore = jobs.reduce((sum, entry) => sum + entry.steps.length, 0);
      expand(
        target,
        `${invocationPath}/${jobId}`,
        [...inheritedConditions, ...(condition ? [condition] : [])],
        [...stack, relativePath],
      );
      reusableCalls.push({
        invocation_path: invocationPath,
        workflow_path: relativePath,
        job_id: jobId,
        condition,
        target,
        local: true,
        expanded_total_jobs:
          jobs.filter((entry) => !entry.reusable_target).length - executionJobsBefore,
        expanded_explicit_steps:
          jobs.reduce((sum, entry) => sum + entry.steps.length, 0) - explicitStepsBefore,
      });
    }

    workflowInstances.push({
      invocation_path: invocationPath,
      workflow_path: relativePath,
      execution_jobs: instanceExecutionJobs,
      explicit_steps: instanceExplicitSteps,
    });
  }

  expand(entryWorkflow, repoRelative(repoRoot, path.resolve(repoRoot, entryWorkflow)), [], []);

  const executionJobs = jobs.filter((job) => !job.reusable_target);
  const conditionalExecutionJobs = executionJobs.filter(
    (job) => job.condition !== null || job.inherited_conditions.length > 0,
  );
  return {
    schema: 'opl_stable_workflow_inventory.v1',
    inventory_mode: 'all_declared_conditional_paths',
    entry_workflow: entryWorkflow,
    total_jobs: executionJobs.length,
    explicit_steps: executionJobs.reduce((sum, job) => sum + job.steps.length, 0),
    workflow_instance_count: workflowInstances.length,
    reusable_call_count: reusableCalls.length,
    conditional_job_count: conditionalExecutionJobs.length,
    workflows: workflowInstances.sort((left, right) =>
      left.invocation_path.localeCompare(right.invocation_path)),
    reusable_calls: reusableCalls.sort((left, right) =>
      `${left.invocation_path}:${left.job_id}`.localeCompare(`${right.invocation_path}:${right.job_id}`)),
    conditional_paths: conditionalExecutionJobs
      .map((job) => ({
        invocation_path: job.invocation_path,
        workflow_path: job.workflow_path,
        job_id: job.job_id,
        condition: job.condition ?? job.inherited_conditions.at(-1)!,
        inherited_conditions: job.inherited_conditions,
      })),
    business_stage_coverage: stageCoverage(jobs),
    duplicate_setup_hotspots: collectHotspots(executionJobs, 'setup'),
    duplicate_transport_hotspots: collectHotspots(executionJobs, 'transport'),
    budget_enforcement_enabled: false,
  };
}

function parseArgs(argv: string[]): {
  repoRoot: string;
  entryWorkflow: string;
  output: string | null;
} {
  let repoRoot = process.cwd();
  let entryWorkflow = '.github/workflows/release-stable.yml';
  let output: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (!['--repo-root', '--entry', '--output'].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    if (!value) throw new Error(`${argument} requires a value`);
    if (argument === '--repo-root') repoRoot = value;
    if (argument === '--entry') entryWorkflow = value;
    if (argument === '--output') output = value;
    index += 1;
  }
  return { repoRoot, entryWorkflow, output };
}

function runCli(): void {
  const options = parseArgs(process.argv.slice(2));
  const report = buildStableWorkflowInventory(options);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) {
    const outputPath = path.resolve(options.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized);
  } else {
    process.stdout.write(serialized);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
