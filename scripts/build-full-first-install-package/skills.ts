import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readAppProductProfile } from '../app-product-profile.ts';
import { appRepoRoot } from './paths.ts';
import { copyTreeFiltered } from './filesystem.ts';
import { readGitHead } from './git.ts';
import { directoryFingerprint, fileSha256 } from './hashing.ts';

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
    skill_md_sha256: source ? fileSha256(path.join(source, 'SKILL.md')) : null,
  };
}

export function masSkillCandidates(options) {
  return [
    path.join(options.masRoot, 'plugins', 'mas', 'skills', 'mas'),
    path.join(os.homedir(), '.codex', 'skills', 'mas'),
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

export function metaAgentSkillSnapshot(options) {
  const source = metaAgentDomainSkillSource(options);
  if (source) {
    return {
      source_path: source.sourcePath,
      git_commit: readGitHead(source.sourcePath),
      domain_skill_sha256: fileSha256(source.domainSkill),
      agent_payload_fingerprint: directoryFingerprint(source.agentRoot, 'skills/opl-meta-agent'),
    };
  }
  return skillSourceSnapshot([
    path.join(options.metaAgentRoot, 'plugins', 'opl-meta-agent', 'skills', 'opl-meta-agent'),
    path.join(os.homedir(), '.codex', 'skills', 'opl-meta-agent'),
  ], 'skills/opl-meta-agent');
}

export function officeCliCoreSkillSnapshot(options) {
  if (fs.existsSync(path.join(options.officeCliRoot, 'SKILL.md'))) {
    return skillFileSourceSnapshot([options.officeCliRoot]);
  }
  return skillSourceSnapshot(officeCliCoreSkillCandidates(options).slice(1), 'skills/officecli');
}

export function magSkillCandidates(options) {
  return [
    path.join(options.magRoot, 'plugins', 'mag', 'skills', 'mag'),
    path.join(os.homedir(), '.codex', 'skills', 'mag'),
  ];
}

export function rcaSkillCandidates(options) {
  return [
    path.join(options.rcaRoot, 'plugins', 'rca', 'skills', 'rca'),
    path.join(os.homedir(), '.codex', 'skills', 'rca'),
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

export function copySuperpowersBundle(targetRoot, options) {
  const sourceRoot = options.superpowersRoot;
  const skillsRoot = path.join(sourceRoot, 'skills');
  if (
    !fs.existsSync(path.join(sourceRoot, '.codex-plugin', 'plugin.json')) ||
    !fs.existsSync(path.join(skillsRoot, 'using-superpowers', 'SKILL.md')) ||
    !fs.existsSync(path.join(skillsRoot, 'verification-before-completion', 'SKILL.md'))
  ) {
    throw new Error(`Required Full companion skill source not found: superpowers bundle at ${sourceRoot}`);
  }
  copyTreeFiltered(sourceRoot, path.join(targetRoot, 'superpowers'), 'skills/superpowers');
  return sourceRoot;
}

export function copyOfficeCliCoreSkill(targetRoot, options) {
  const target = path.join(targetRoot, 'officecli');
  if (fs.existsSync(path.join(options.officeCliRoot, 'SKILL.md'))) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(path.join(options.officeCliRoot, 'SKILL.md'), path.join(target, 'SKILL.md'));
    return options.officeCliRoot;
  }
  return copyFirstSkillSource('officecli', targetRoot, officeCliCoreSkillCandidates(options).slice(1));
}

export function copyUiUxProMaxSkill(targetRoot, options) {
  const target = path.join(targetRoot, 'ui-ux-pro-max');
  const packagedSkill = path.join(options.uiUxProMaxRoot, '.claude', 'skills', 'ui-ux-pro-max', 'SKILL.md');
  const packagedPayload = path.join(options.uiUxProMaxRoot, 'src', 'ui-ux-pro-max');
  if (fs.existsSync(packagedSkill) && fs.existsSync(packagedPayload)) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(packagedSkill, path.join(target, 'SKILL.md'));
    for (const entry of ['data', 'scripts', 'templates']) {
      const source = path.join(packagedPayload, entry);
      if (fs.existsSync(source)) {
        copyTreeFiltered(source, path.join(target, entry), `skills/ui-ux-pro-max/${entry}`);
      }
    }
    return options.uiUxProMaxRoot;
  }
  return copyFirstSkillSource('ui-ux-pro-max', targetRoot, [
    path.join(os.homedir(), '.skills-manager', 'skills', 'ui-ux-pro-max'),
    path.join(os.homedir(), '.codex', 'skills', 'ui-ux-pro-max'),
  ]);
}

export const packagedSkillCopyHandlers = {
  mas: (targetRoot, options) => copyFirstSkillSource('mas', targetRoot, masSkillCandidates(options)),
  mag: (targetRoot, options) => copyFirstSkillSource('mag', targetRoot, magSkillCandidates(options)),
  rca: (targetRoot, options) => copyFirstSkillSource('rca', targetRoot, rcaSkillCandidates(options)),
  superpowers: (targetRoot, options) => copySuperpowersBundle(targetRoot, options),
  cron: (targetRoot) => copyFirstSkillSource('cron', targetRoot, appCompanionSkillCandidates('cron')),
  'opl-meta-agent': (targetRoot, options) => copyOplMetaAgentSkill(targetRoot, options),
  officecli: (targetRoot, options) => copyOfficeCliCoreSkill(targetRoot, options),
  'officecli-docx': (targetRoot, options) => copyFirstSkillSource('officecli-docx', targetRoot, officeCliSkillCandidates(options, 'officecli-docx')),
  'officecli-pptx': (targetRoot, options) => copyFirstSkillSource('officecli-pptx', targetRoot, officeCliSkillCandidates(options, 'officecli-pptx')),
  'officecli-xlsx': (targetRoot, options) => copyFirstSkillSource('officecli-xlsx', targetRoot, officeCliSkillCandidates(options, 'officecli-xlsx')),
  'officecli-academic-paper': (targetRoot, options) => copyFirstSkillSource('officecli-academic-paper', targetRoot, officeCliSkillCandidates(options, 'officecli-academic-paper')),
  'officecli-data-dashboard': (targetRoot, options) => copyFirstSkillSource('officecli-data-dashboard', targetRoot, officeCliSkillCandidates(options, 'officecli-data-dashboard')),
  'officecli-financial-model': (targetRoot, options) => copyFirstSkillSource('officecli-financial-model', targetRoot, officeCliSkillCandidates(options, 'officecli-financial-model')),
  'officecli-pitch-deck': (targetRoot, options) => copyFirstSkillSource('officecli-pitch-deck', targetRoot, officeCliSkillCandidates(options, 'officecli-pitch-deck')),
  pdf: (targetRoot) => copyFirstSkillSource('pdf', targetRoot, appCompanionSkillCandidates('pdf')),
  'ui-ux-pro-max': (targetRoot, options) => copyUiUxProMaxSkill(targetRoot, options),
  'mineru-document-extractor': (targetRoot, options) => copyFirstSkillSource(
    'mineru-document-extractor',
    targetRoot,
    mineruDocumentExtractorSkillCandidates(options),
  ),
};

export function copyPackagedSkills(targetRoot, options) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  fs.mkdirSync(targetRoot, { recursive: true });
  const productProfile = readAppProductProfile();
  const packagedSkillIds = [
    ...productProfile.companion_payloads.default_packaged_codex_skill_ids,
    ...productProfile.companion_payloads.packaged_not_default_visible_codex_skill_ids,
  ];
  for (const skillId of packagedSkillIds) {
    const copySkill = packagedSkillCopyHandlers[skillId];
    if (!copySkill) {
      throw new Error(`No Full package copy handler declared for App packaged skill: ${skillId}`);
    }
    copySkill(targetRoot, options);
  }
}
