import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { readAppProductProfile } from '../app-product-profile/profile-contract.ts';
import {
  readOplFlowCapabilityPolicy,
  resolveOplFlowDefaultSkillDependencyIds,
} from '../opl-flow-capability-policy.ts';
import { appRepoRoot } from './paths.ts';
import { copyTreeFiltered } from './filesystem.ts';
import { readGitHead } from './git.ts';
import { directoryFingerprint, existingFileSha256 } from './hashing.ts';

export const OFFICECLI_ATOMIC_SKILL_IDS = [
  'officecli',
  'officecli-docx',
  'officecli-pptx',
  'officecli-xlsx',
  'officecli-academic-paper',
  'officecli-data-dashboard',
  'officecli-financial-model',
  'officecli-pitch-deck',
];

export function copySkillDirectory(sourceRoot, targetRoot, skillName) {
  if (!fs.existsSync(path.join(sourceRoot, 'SKILL.md'))) {
    throw new Error(`Skill source missing SKILL.md for ${skillName}: ${sourceRoot}`);
  }
  copyTreeFiltered(sourceRoot, targetRoot, `skills/${skillName}`);
}

export function firstExistingSkillSource(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(path.join(candidate, 'SKILL.md'))) || null;
}

export function copyFirstSkillSource(skillName, targetRoot, candidates) {
  const source = firstExistingSkillSource(candidates);
  if (!source) {
    throw new Error(`Required Full companion skill source not found: ${skillName}`);
  }
  copySkillDirectory(source, path.join(targetRoot, skillName), skillName);
  return source;
}

export function skillSourceSnapshot(candidates, runtimePrefix) {
  const source = firstExistingSkillSource(candidates);
  return {
    source_path: source,
    git_commit: source ? readGitHead(source) : null,
    fingerprint: source ? directoryFingerprint(source, runtimePrefix) : null,
  };
}

export function skillFileSourceSnapshot(candidates) {
  const source = firstExistingSkillSource(candidates);
  return {
    source_path: source,
    git_commit: source ? readGitHead(source) : null,
    skill_md_sha256: source ? existingFileSha256(path.join(source, 'SKILL.md')) : null,
  };
}

export function masSkillCandidates(options) {
  return [
    path.join(options.masRoot, 'plugins', 'med-autoscience', 'skills', 'med-autoscience'),
    path.join(os.homedir(), '.codex', 'skills', 'med-autoscience'),
  ];
}

function metaAgentDomainSkillSource(options) {
  const domainSkill = path.join(options.metaAgentRoot, 'agent', 'skills', 'opl-meta-agent-domain-skill.md');
  const agentRoot = path.join(options.metaAgentRoot, 'agent');
  if (!fs.existsSync(domainSkill) || !fs.existsSync(agentRoot)) {
    return null;
  }
  return {
    sourcePath: options.metaAgentRoot,
    domainSkill,
    agentRoot,
  };
}

function generatedBookforgeSkillSource(options) {
  const frameworkEntry = [
    path.join(options.frameworkRoot, 'src', 'modules', 'connect', 'opl-skills.ts'),
    path.join(options.frameworkRoot, 'src', 'opl-skills.ts'),
  ].find((candidate) => fs.existsSync(candidate));
  if (!frameworkEntry) {
    return null;
  }
  return {
    sourcePath: options.bookforgeRoot,
    frameworkEntry,
  };
}

export function metaAgentSkillSnapshot(options) {
  const source = metaAgentDomainSkillSource(options);
  if (source) {
    return {
      source_path: source.sourcePath,
      git_commit: readGitHead(source.sourcePath),
      domain_skill_sha256: existingFileSha256(source.domainSkill),
      agent_payload_fingerprint: directoryFingerprint(source.agentRoot, 'skills/opl-meta-agent'),
    };
  }
  return skillSourceSnapshot([
    path.join(options.metaAgentRoot, 'plugins', 'opl-meta-agent', 'skills', 'opl-meta-agent'),
    path.join(os.homedir(), '.codex', 'skills', 'opl-meta-agent'),
  ], 'skills/opl-meta-agent');
}

export function bookforgeSkillSnapshot(options) {
  const source = generatedBookforgeSkillSource(options);
  if (source) {
    return {
      source_path: source.sourcePath,
      git_commit: readGitHead(source.sourcePath),
      framework_generator_sha256: existingFileSha256(source.frameworkEntry),
    };
  }
  return skillSourceSnapshot([
    path.join(options.bookforgeRoot, 'plugins', 'opl-bookforge', 'skills', 'opl-bookforge'),
    path.join(os.homedir(), '.codex', 'skills', 'opl-bookforge'),
  ], 'skills/opl-bookforge');
}

export function officeCliCoreSkillSnapshot(options) {
  if (fs.existsSync(path.join(options.officeCliRoot, 'SKILL.md'))) {
    return skillFileSourceSnapshot([options.officeCliRoot]);
  }
  return skillSourceSnapshot([path.join(options.officeCliRoot, 'skills', 'officecli')], 'skills/officecli');
}

export function magSkillCandidates(options) {
  return [
    path.join(options.magRoot, 'plugins', 'med-autogrant', 'skills', 'med-autogrant'),
    path.join(os.homedir(), '.codex', 'skills', 'med-autogrant'),
  ];
}

export function rcaSkillCandidates(options) {
  return [
    path.join(options.rcaRoot, 'plugins', 'redcube-ai', 'skills', 'redcube-ai'),
    path.join(os.homedir(), '.codex', 'skills', 'redcube-ai'),
  ];
}

export function officeCliCoreSkillCandidates(options) {
  return [
    options.officeCliRoot,
    path.join(options.officeCliRoot, 'skills', 'officecli'),
    path.join(os.homedir(), '.skills-manager', 'skills', 'officecli'),
    path.join(os.homedir(), '.codex', 'skills', 'officecli'),
  ];
}

export function mineruDocumentExtractorSkillCandidates(options) {
  return [
    options.mineruDocumentExtractorRoot,
    path.join(os.homedir(), '.skills-manager', 'skills', 'mineru-document-extractor'),
    path.join(os.homedir(), '.codex', 'skills', 'mineru-document-extractor'),
  ];
}

export function appCompanionSkillRoot(skillId) {
  return path.join(appRepoRoot, 'assets', 'companion-skills', skillId);
}

export function officeCliSkillCandidates(options, skillId) {
  return [
    path.join(options.officeCliRoot, 'skills', skillId),
    path.join(os.homedir(), '.skills-manager', 'skills', skillId),
    path.join(os.homedir(), '.codex', 'skills', skillId),
  ];
}

export function appCompanionSkillCandidates(skillId) {
  return [
    appCompanionSkillRoot(skillId),
    path.join(os.homedir(), '.skills-manager', 'skills', skillId),
    path.join(os.homedir(), '.codex', 'skills', skillId),
  ];
}

export function copyOplMetaAgentSkill(targetRoot, options) {
  const target = path.join(targetRoot, 'opl-meta-agent');
  const source = metaAgentDomainSkillSource(options);
  if (source) {
    const { domainSkill, agentRoot } = source;
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(domainSkill, path.join(target, 'SKILL.md'));
    for (const entry of ['knowledge', 'prompts', 'quality_gates', 'skills', 'stages']) {
      const source = path.join(agentRoot, entry);
      if (fs.existsSync(source)) {
        copyTreeFiltered(source, path.join(target, entry), `skills/opl-meta-agent/${entry}`);
      }
    }
    return source.sourcePath;
  }
  return copyFirstSkillSource('opl-meta-agent', targetRoot, [
    path.join(options.metaAgentRoot, 'plugins', 'opl-meta-agent', 'skills', 'opl-meta-agent'),
    path.join(os.homedir(), '.codex', 'skills', 'opl-meta-agent'),
  ]);
}

export function copyOplBookforgeSkill(targetRoot, options) {
  const generated = generatedBookforgeSkillSource(options);
  if (generated) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-bookforge-skill-'));
    try {
      const script = `
        const mod = await import(${JSON.stringify(generated.frameworkEntry)});
        const result = mod.syncFamilySkillPackFromRepoRoot('oplbookforge', ${JSON.stringify(options.bookforgeRoot)}, {
          home: ${JSON.stringify(home)},
          registerPlugin: false,
        });
        process.stdout.write(JSON.stringify(result));
      `;
      const generatedResult = spawnSync(
        process.execPath,
        ['--experimental-strip-types', '--input-type=module', '--eval', script],
        { encoding: 'utf8' },
      );
      if (generatedResult.status !== 0) {
        throw new Error(`Failed to generate OPL Book Forge skill surface: ${generatedResult.stderr || generatedResult.stdout}`);
      }
      const result = JSON.parse(generatedResult.stdout);
      const carrier =
        result?.installer_result?.materialized_codex_plugin_carrier
        ?? result?.installer_result?.generated_codex_plugin;
      const generatedSkillPath = carrier?.skill_entry_path;
      if (!generatedSkillPath || !fs.existsSync(generatedSkillPath)) {
        throw new Error(`OPL Book Forge generated skill surface not found: ${generatedSkillPath ?? 'missing skill_entry_path'}`);
      }
      copySkillDirectory(path.dirname(generatedSkillPath), path.join(targetRoot, 'opl-bookforge'), 'opl-bookforge');
      return generated.sourcePath;
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
  return copyFirstSkillSource('opl-bookforge', targetRoot, [
    path.join(options.bookforgeRoot, 'plugins', 'opl-bookforge', 'skills', 'opl-bookforge'),
    path.join(os.homedir(), '.codex', 'skills', 'opl-bookforge'),
  ]);
}

export function copyOfficeCliCoreSkill(targetRoot, options) {
  const target = path.join(targetRoot, 'officecli');
  if (fs.existsSync(path.join(options.officeCliRoot, 'SKILL.md'))) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(path.join(options.officeCliRoot, 'SKILL.md'), path.join(target, 'SKILL.md'));
    return options.officeCliRoot;
  }
  return copyFirstSkillSource('officecli', targetRoot, [
    path.join(options.officeCliRoot, 'skills', 'officecli'),
  ]);
}

function officeCliUpstreamSkillRoot(options, skillId) {
  if (skillId === 'officecli' && fs.existsSync(path.join(options.officeCliRoot, 'SKILL.md'))) {
    return options.officeCliRoot;
  }
  return path.join(options.officeCliRoot, 'skills', skillId);
}

export function assertOfficeCliAtomicSkillSet(options) {
  const missing = OFFICECLI_ATOMIC_SKILL_IDS.filter((skillId) => (
    !fs.existsSync(path.join(officeCliUpstreamSkillRoot(options, skillId), 'SKILL.md'))
  ));
  if (missing.length > 0) {
    throw new Error(
      `OfficeCLI Full payload must come from one complete upstream release; missing skills: ${missing.join(', ')}`,
    );
  }
}

const OFFICECLI_SKILL_FRONTMATTER_COMPATIBILITY_REWRITES = {
  'officecli-data-dashboard': [
    'a weekly report with ≤ 1 chart and < 10 rows (use xlsx)',
    'a weekly report with at most 1 chart and fewer than 10 rows (use xlsx)',
  ],
};

function applyOfficeCliSkillFrontmatterCompatibility(skillId, targetRoot) {
  const rewrite = OFFICECLI_SKILL_FRONTMATTER_COMPATIBILITY_REWRITES[skillId];
  if (!rewrite) return;
  const skillPath = path.join(targetRoot, skillId, 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf8');
  if (content.includes(rewrite[0])) {
    fs.writeFileSync(skillPath, content.replace(rewrite[0], rewrite[1]), 'utf8');
  }
}

export function copyOfficeCliUpstreamSkill(skillId, targetRoot, options) {
  const source = officeCliUpstreamSkillRoot(options, skillId);
  copySkillDirectory(source, path.join(targetRoot, skillId), skillId);
  applyOfficeCliSkillFrontmatterCompatibility(skillId, targetRoot);
  return source;
}

export function copyUiUxProMaxSkill(targetRoot, options) {
  const target = path.join(targetRoot, 'ui-ux-pro-max');
  const packagedSkillRoot = path.join(options.uiUxProMaxRoot, '.claude', 'skills', 'ui-ux-pro-max');
  if (fs.existsSync(path.join(packagedSkillRoot, 'SKILL.md'))) {
    copySkillDirectory(packagedSkillRoot, target, 'ui-ux-pro-max');
    return options.uiUxProMaxRoot;
  }
  return copyFirstSkillSource('ui-ux-pro-max', targetRoot, [
    path.join(os.homedir(), '.skills-manager', 'skills', 'ui-ux-pro-max'),
    path.join(os.homedir(), '.codex', 'skills', 'ui-ux-pro-max'),
  ]);
}

export const packagedSkillCopyHandlers = {
  'med-autoscience': (targetRoot, options) => copyFirstSkillSource('med-autoscience', targetRoot, masSkillCandidates(options)),
  'med-autogrant': (targetRoot, options) => copyFirstSkillSource('med-autogrant', targetRoot, magSkillCandidates(options)),
  'redcube-ai': (targetRoot, options) => copyFirstSkillSource('redcube-ai', targetRoot, rcaSkillCandidates(options)),
  'opl-bookforge': (targetRoot, options) => copyOplBookforgeSkill(targetRoot, options),
  'opl-meta-agent': (targetRoot, options) => copyOplMetaAgentSkill(targetRoot, options),
  officecli: (targetRoot, options) => copyOfficeCliCoreSkill(targetRoot, options),
  'officecli-docx': (targetRoot, options) => copyOfficeCliUpstreamSkill('officecli-docx', targetRoot, options),
  'officecli-pptx': (targetRoot, options) => copyOfficeCliUpstreamSkill('officecli-pptx', targetRoot, options),
  'officecli-xlsx': (targetRoot, options) => copyOfficeCliUpstreamSkill('officecli-xlsx', targetRoot, options),
  'officecli-academic-paper': (targetRoot, options) => copyOfficeCliUpstreamSkill('officecli-academic-paper', targetRoot, options),
  'officecli-data-dashboard': (targetRoot, options) => copyOfficeCliUpstreamSkill('officecli-data-dashboard', targetRoot, options),
  'officecli-financial-model': (targetRoot, options) => copyOfficeCliUpstreamSkill('officecli-financial-model', targetRoot, options),
  'officecli-pitch-deck': (targetRoot, options) => copyOfficeCliUpstreamSkill('officecli-pitch-deck', targetRoot, options),
  'ui-ux-pro-max': (targetRoot, options) => copyUiUxProMaxSkill(targetRoot, options),
  'mineru-document-extractor': (targetRoot, options) => copyFirstSkillSource(
    'mineru-document-extractor',
    targetRoot,
    mineruDocumentExtractorSkillCandidates(options),
  ),
};

export function readOplFlowDefaultSkillDependencyIds(oplFlowRoot) {
  const policyPath = path.join(oplFlowRoot, 'contracts', 'workflow-policy.json');
  return resolveOplFlowDefaultSkillDependencyIds(readOplFlowCapabilityPolicy(policyPath));
}

function copyOptionalFlowSkill(skillId, targetRoot, options) {
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-optional-full-skill-'));
  try {
    const specialized = packagedSkillCopyHandlers[skillId];
    if (specialized) {
      specialized(stagingRoot, options);
    } else {
      const source = firstExistingSkillSource([
        path.join(os.homedir(), '.skills-manager', 'skills', skillId),
        path.join(os.homedir(), '.codex', 'skills', skillId),
      ]);
      if (!source) return false;
      copySkillDirectory(source, path.join(stagingRoot, skillId), skillId);
    }
    copySkillDirectory(
      path.join(stagingRoot, skillId),
      path.join(targetRoot, skillId),
      skillId,
    );
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
}

export function copyPackagedSkills(targetRoot, options) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  fs.mkdirSync(targetRoot, { recursive: true });
  const productProfile = readAppProductProfile();
  const requiredPackagedSkillIds = [
    ...productProfile.companion_payloads.default_packaged_codex_skill_ids,
    ...productProfile.companion_payloads.additional_package_skill_ids,
  ];
  const optionalFlowSkillIds = readOplFlowDefaultSkillDependencyIds(options.oplFlowRoot);
  const requiredPackagedSkillSet = new Set(requiredPackagedSkillIds);
  for (const skillId of requiredPackagedSkillIds) {
    const copySkill = packagedSkillCopyHandlers[skillId];
    if (!copySkill) {
      throw new Error(`No Full package copy handler declared for App packaged skill: ${skillId}`);
    }
    copySkill(targetRoot, options);
  }
  for (const skillId of optionalFlowSkillIds) {
    if (requiredPackagedSkillSet.has(skillId)) continue;
    copyOptionalFlowSkill(skillId, targetRoot, options);
  }
}
