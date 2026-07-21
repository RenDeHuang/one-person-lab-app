import fs from 'node:fs';
import path from 'node:path';
import { collectCommitSubjects, gitRefExists } from './command.ts';
import { buildChangeSummaryHint } from './changes.ts';
import type { AgentRuntimeChange, ReleaseNoteOptions } from './types.ts';

const payloadComponentSpecs = [
  {
    label: 'OPL Framework',
    key: 'opl',
    role: 'shared runtime and app state/action contracts',
    user_value_hint: 'Keeps App-managed OPL state reads and actions aligned with the runtime shipped in the installer.',
  },
  {
    label: 'Codex CLI',
    key: 'codex',
    role: 'local AI execution engine for App-managed agent sessions',
    user_value_hint: 'Runs the local Codex sessions used by the built-in OPL agent and skill surfaces.',
  },
  {
    label: 'MAS',
    key: 'mas',
    role: 'research automation and study workflow agent',
    user_value_hint: 'Helps users run research and study workflows with clearer evidence, blockers, and next steps.',
  },
  {
    label: 'MAG',
    key: 'mag',
    role: 'grant-writing and funding workflow agent',
    user_value_hint: 'Helps users turn project context into clearer grant and funding materials.',
  },
  {
    label: 'RCA',
    key: 'rca',
    role: 'visual deliverable, slide, and report graphics agent',
    user_value_hint: 'Helps users prepare visual deliverables, slides, and report graphics with fewer manual checks.',
  },
  {
    label: 'OPL Meta Agent',
    key: 'meta_agent',
    role: 'agent design, testing, and improvement assistant',
    user_value_hint: 'Helps users design, test, and improve OPL-compatible agents from inside the App.',
  },
  {
    label: 'OPL Book Forge',
    key: 'bookforge',
    role: 'long-form book and publication workflow agent',
    user_value_hint: 'Helps users structure, draft, and validate long-form book projects.',
  },
  {
    label: 'MAS Scholar Skills',
    key: 'mas_scholar_skills',
    role: 'workspace-bound medical research capability package',
    user_value_hint: 'Adds the evidence, analysis, writing, table, and figure skills used inside bound MAS workspaces.',
  },
  {
    label: 'OPL Flow',
    key: 'opl_flow',
    role: 'workflow profile and conflict policy package',
    user_value_hint: 'Keeps recommended OPL workflows and package conflict handling aligned across installed agents.',
  },
  {
    label: 'OfficeCLI',
    key: 'officecli',
    role: 'Office document generation and editing tool',
    user_value_hint: 'Supports App-managed Word, Excel, and PowerPoint document work.',
  },
  {
    label: 'MinerU',
    key: 'mineru_open_api',
    role: 'document extraction, OCR, and PDF parsing tool',
    user_value_hint: 'Supports document extraction and PDF/OCR intake for OPL workflows.',
  },
] as const;

function shortSha(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 7) : null;
}

export function normalizeComponentVersion(label: string, value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const firstLine = value.split(/\r?\n/)[0].trim();
  if (label === 'Codex CLI') {
    return firstLine.replace(/^codex-cli\s+/i, '');
  }
  if (label === 'MinerU') {
    return firstLine.replace(/^mineru-open-api version\s+/i, '');
  }
  return firstLine;
}

function componentDisplayValue(label: string, component: any) {
  if (!component || typeof component !== 'object') {
    return null;
  }
  const sha = shortSha(component.git_commit);
  if (sha) {
    return { kind: 'git', value: sha };
  }
  const version = normalizeComponentVersion(label, component.version);
  return version ? { kind: 'version', value: version } : null;
}

export function buildBundledVersionLines(manifest: any) {
  if (!manifest?.components || typeof manifest.components !== 'object') {
    return [];
  }
  const modules = payloadComponentSpecs
    .map(({ label, key }) => {
      const value = componentDisplayValue(label, manifest.components[key]);
      if (!value) {
        return null;
      }
      return value.kind === 'git' ? `${label} @ ${value.value}` : `${label} ${value.value}`;
    })
    .filter(Boolean);
  return modules;
}

function buildFullPayloadDescription(bundledVersions: string[]) {
  const labels = bundledVersions.map((line) => line.replace(/\s+(?:@|[0-9v]).*$/, '').trim());
  const completePayloadLabels = payloadComponentSpecs.map(({ label }) => label);
  if (completePayloadLabels.every((label) => labels.includes(label))) {
    return 'Full first-install package includes the OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OPL Book Forge, MAS Scholar Skills, OPL Flow, OfficeCLI, MinerU, and packaged Codex skills.';
  }
  const payloads = labels.length > 0
    ? labels.join(', ')
    : 'the components recorded in full-package-manifest.json';
  return `Full first-install package contents recorded in this release manifest: ${payloads}, plus packaged Codex skills where present.`;
}

export function buildPayloadUpdateLines(currentManifest: any, previousManifest: any) {
  if (!currentManifest?.components || !previousManifest?.components) {
    return [];
  }
  return payloadComponentSpecs
    .map(({ label, key }) => {
      const current = componentDisplayValue(label, currentManifest.components[key]);
      if (!current) {
        return null;
      }
      const previous = componentDisplayValue(label, previousManifest.components[key]);
      if (!previous) {
        return `${label} added at ${current.value}`;
      }
      if (previous.value === current.value) {
        return null;
      }
      return `${label} ${previous.value} -> ${current.value}`;
    })
    .filter(Boolean);
}

function componentRefValue(label: string, component: any) {
  const value = componentDisplayValue(label, component);
  return value?.value ?? null;
}

function componentAuditRef(label: string, component: any) {
  const value = componentDisplayValue(label, component);
  if (!value) {
    return null;
  }
  return value.kind === 'git' ? `${label} @ ${value.value}` : `${label} ${value.value}`;
}

function componentSourcePath(currentComponent: any, previousComponent: any) {
  const sourcePath = currentComponent?.source_path || previousComponent?.source_path;
  return typeof sourcePath === 'string' && sourcePath.trim() ? sourcePath.trim() : null;
}

export function collectComponentChangeSubjects(currentComponent: any, previousComponent: any) {
  const sourcePath = componentSourcePath(currentComponent, previousComponent);
  if (!sourcePath || !fs.existsSync(path.join(sourcePath, '.git'))) {
    return [];
  }
  const currentRef = typeof currentComponent?.git_commit === 'string' ? currentComponent.git_commit : null;
  const previousRef = typeof previousComponent?.git_commit === 'string' ? previousComponent.git_commit : null;
  if (!currentRef || !gitRefExists(currentRef, sourcePath)) {
    return [];
  }
  return collectCommitSubjects(sourcePath, previousRef, currentRef, 12).slice(0, 6);
}

export function buildAgentRuntimeChanges(currentManifest: any, previousManifest: any): AgentRuntimeChange[] {
  if (!currentManifest?.components || typeof currentManifest.components !== 'object') {
    return [];
  }
  const previousComponents = previousManifest?.components && typeof previousManifest.components === 'object'
    ? previousManifest.components
    : {};
  return payloadComponentSpecs
    .map(({ label, key, role, user_value_hint }) => {
      const currentComponent = currentManifest.components[key];
      if (!currentComponent || typeof currentComponent !== 'object') {
        return null;
      }
      const previousComponent = previousComponents[key];
      const currentRef = componentRefValue(label, currentComponent);
      if (!currentRef) {
        return null;
      }
      const previousRef = componentRefValue(label, previousComponent);
      const changeSubjects = collectComponentChangeSubjects(currentComponent, previousComponent);
      return {
        label,
        component: key,
        role,
        previous_ref: previousRef,
        current_ref: currentRef,
        audit_ref: componentAuditRef(label, currentComponent),
        change_subjects: changeSubjects,
        user_value_hint,
        change_summary_hint: buildChangeSummaryHint(label, changeSubjects),
      };
    })
    .filter((change): change is AgentRuntimeChange => Boolean(change));
}

export function buildOplPayloadLines(options: ReleaseNoteOptions, bundledVersions: string[], payloadUpdates: string[]) {
  if (bundledVersions.length > 0) {
    const lines = [
      `- ${buildFullPayloadDescription(bundledVersions)}`,
      `- Packaged component refs: ${bundledVersions.join('; ')}.`,
    ];
    if (payloadUpdates.length > 0) {
      lines.push(`- Component updates since previous Stable: ${payloadUpdates.join('; ')}.`);
    }
    return lines;
  }
  if (options.channel === 'nightly') {
    return [
      '- Standard macOS arm64 Nightly package and updater metadata only; Full first-install assets stay on the Stable channel.',
      '- Nightly standard package includes the built-in MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin and skill sync policy.',
      '- Full runtime payloads for MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, and MinerU remain Stable/Full-release material.',
    ];
  }
  return [
    '- Standard package includes the built-in MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin and skill sync policy.',
    '- Domain runtime payload versions are published only when the release also includes the Full first-install DMG manifest.',
  ];
}
