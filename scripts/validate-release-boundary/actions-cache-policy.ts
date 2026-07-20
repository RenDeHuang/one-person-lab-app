import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const cacheActionNames = new Set([
  'actions/cache',
  'actions/cache/restore',
  'actions/cache/save',
]);

const volatileIdentityPatterns = [
  /\bgithub\.run_id\b/i,
  /\bgithub\.run_attempt\b/i,
  /\bgithub\.run_number\b/i,
  /\bGITHUB_RUN_ID\b/,
  /\bGITHUB_RUN_ATTEMPT\b/,
  /\bGITHUB_RUN_NUMBER\b/,
  /\bDate\.now\s*\(/,
  /\bMath\.random\s*\(/,
  /\brandomUUID\s*\(/,
];

const explicitSaveGuardPattern = /cache[-_]?hit|save[-_]?required|force[_-]?rebuild/i;
const dynamicCacheKeyAssignmentPattern =
  /(?:cacheKey|cache_key|workflowCacheKey|workflow_cache_key)\s*[:=]\s*[^;]{0,1024}/g;

function actionName(uses: string): string {
  const separator = uses.lastIndexOf('@');
  return separator >= 0 ? uses.slice(0, separator) : uses;
}

function containsVolatileIdentity(value: string): boolean {
  return volatileIdentityPatterns.some((pattern) => pattern.test(value));
}

function workflowPaths(appRoot: string): string[] {
  const directory = path.join(appRoot, '.github', 'workflows');
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort()
    .map((name) => `.github/workflows/${name}`);
}

export function collectActionsCachePolicyViolations(appRoot: string): string[] {
  const violations: string[] = [];

  for (const workflowPath of workflowPaths(appRoot)) {
    const absolutePath = path.join(appRoot, workflowPath);
    const text = fs.readFileSync(absolutePath, 'utf8');
    let workflow: Record<string, any>;
    try {
      workflow = parseYaml(text) as Record<string, any>;
    } catch (error) {
      violations.push(
        `${workflowPath}: invalid YAML: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    for (const [jobId, jobValue] of Object.entries(workflow.jobs ?? {})) {
      const job = jobValue as Record<string, any>;
      const steps = Array.isArray(job.steps) ? job.steps as Array<Record<string, any>> : [];
      for (const [stepIndex, step] of steps.entries()) {
        if (typeof step.uses !== 'string') continue;
        const cacheAction = actionName(step.uses);
        if (!cacheActionNames.has(cacheAction)) continue;

        const key = step.with?.key;
        const location = `${workflowPath} job=${jobId} step=${stepIndex + 1}`;
        if (typeof key !== 'string' || !key.trim()) {
          violations.push(`${location}: ${cacheAction} must declare a non-empty cache key`);
        } else if (containsVolatileIdentity(key)) {
          violations.push(`${location}: reusable cache key contains volatile run identity`);
        }

        if (cacheAction === 'actions/cache/save') {
          const condition = typeof step.if === 'string' ? step.if : '';
          if (!explicitSaveGuardPattern.test(condition)) {
            violations.push(
              `${location}: explicit cache save must be guarded by a cache miss, save-required output, or forced rebuild`,
            );
          }
        }
      }
    }

    for (const assignment of text.matchAll(dynamicCacheKeyAssignmentPattern)) {
      if (containsVolatileIdentity(assignment[0])) {
        violations.push(
          `${workflowPath}: dynamically generated reusable cache key contains volatile run identity`,
        );
      }
    }
  }

  return [...new Set(violations)];
}

export function validateActionsCachePolicy(appRoot: string): number {
  const violations = collectActionsCachePolicyViolations(appRoot);
  for (const violation of violations) {
    console.error(`FAIL actions_cache_policy: ${violation}`);
  }
  return violations.length;
}
