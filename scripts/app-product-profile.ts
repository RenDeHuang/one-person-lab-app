import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export type AppProductProfile = {
  schema_version: number;
  owner: string;
  purpose: string;
  state: string;
  machine_boundary: string;
  app_repo: string;
  product: {
    id: string;
    display_name: string;
    primary_surface: string;
    supported_release_platforms: string[];
  };
  contract_refs: Record<string, string>;
  default_session_profile: {
    executor: string;
    model: string;
    reasoning_effort: string;
    applies_after: string;
    authority: string;
  };
  codex: {
    default_model: string;
    default_model_description: string;
    default_reasoning_effort: string;
    default_visible_skills: string[];
    skill_priority: string[];
    session_context_lines: string[];
  };
  first_run: {
    readiness_layers: string[];
    deferred_blockers: string[];
    command_line_tools: {
      auto_request_installer: boolean;
      blocks_full_first_launch: boolean;
      messages: string[];
    };
  };
  settings: {
    visible_tabs: string[];
    environment_items: string[];
    developer_mode: {
      label_key: string;
      description_key: string;
      hide_machine_status: boolean;
      state_keys: Record<string, string>;
    };
  };
  companion_payloads: {
    tools: string[];
    domain_modules: string[];
    recommended_codex_skills: string[];
  };
  boundary: {
    app_owns: string[];
    app_consumes: string[];
    app_does_not_own: string[];
  };
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appProductProfilePath = path.join(appRoot, 'contracts', 'app-product-profile.json');

function assertStringArray(value: unknown, label: string, options: { allowBlank?: boolean } = {}): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((entry) => (
    typeof entry === 'string' && (options.allowBlank || entry.trim())
  ))) {
    throw new Error(`Invalid App product profile ${label}: expected a non-empty string array`);
  }
}

function assertProfileShape(profile: AppProductProfile): void {
  if (profile.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected App product profile owner: ${profile.owner}`);
  }
  if (profile.purpose !== 'app_owned_product_profile') {
    throw new Error(`Unexpected App product profile purpose: ${profile.purpose}`);
  }
  if (profile.app_repo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`Unexpected App product profile repo: ${profile.app_repo}`);
  }
  if (profile.default_session_profile.executor !== 'codex_cli') {
    throw new Error(`Unexpected App product profile executor: ${profile.default_session_profile.executor}`);
  }
  if (profile.default_session_profile.model !== profile.codex.default_model) {
    throw new Error('App product profile Codex default model is inconsistent');
  }
  if (profile.default_session_profile.reasoning_effort !== profile.codex.default_reasoning_effort) {
    throw new Error('App product profile Codex reasoning effort is inconsistent');
  }
  assertStringArray(profile.codex.default_visible_skills, 'codex.default_visible_skills');
  assertStringArray(profile.codex.skill_priority, 'codex.skill_priority');
  assertStringArray(profile.codex.session_context_lines, 'codex.session_context_lines', { allowBlank: true });
  assertStringArray(profile.first_run.readiness_layers, 'first_run.readiness_layers');
  assertStringArray(profile.first_run.deferred_blockers, 'first_run.deferred_blockers');
  assertStringArray(profile.first_run.command_line_tools.messages, 'first_run.command_line_tools.messages');
  assertStringArray(profile.settings.visible_tabs, 'settings.visible_tabs');
  assertStringArray(profile.settings.environment_items, 'settings.environment_items');
  assertStringArray(profile.companion_payloads.tools, 'companion_payloads.tools');
  assertStringArray(profile.companion_payloads.domain_modules, 'companion_payloads.domain_modules');
  assertStringArray(profile.companion_payloads.recommended_codex_skills, 'companion_payloads.recommended_codex_skills');
  assertStringArray(profile.boundary.app_does_not_own, 'boundary.app_does_not_own');
}

export function readAppProductProfile(profilePath = appProductProfilePath): AppProductProfile {
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8')) as AppProductProfile;
  assertProfileShape(profile);
  return profile;
}

export function formatCodexProfileLabel(profile = readAppProductProfile()): string {
  return `${profile.codex.default_model} / ${profile.codex.default_reasoning_effort}`;
}

export function formatCodexProfilePhrase(profile = readAppProductProfile()): string {
  return `${profile.codex.default_model} with ${profile.codex.default_reasoning_effort} reasoning`;
}

export function formatRecommendedCompanionSkills(profile = readAppProductProfile()): string {
  return profile.companion_payloads.recommended_codex_skills.join(', ');
}

export function syncAppProductProfileToShell(
  shellRoot: string,
  options: { optional?: boolean } = {},
): { synced: boolean; targetPath: string } {
  const targetPath = path.join(shellRoot, 'src', 'common', 'config', 'oplProductProfile.generated.json');
  if (!fs.existsSync(path.join(shellRoot, 'package.json'))) {
    if (options.optional) return { synced: false, targetPath };
    throw new Error(`Missing active shell checkout: ${shellRoot}`);
  }

  const profile = readAppProductProfile();
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  const localOxfmt = path.join(shellRoot, 'node_modules', '.bin', 'oxfmt');
  if (fs.existsSync(localOxfmt)) {
    spawnSync(localOxfmt, [targetPath], { cwd: shellRoot, stdio: 'ignore' });
  }
  return { synced: true, targetPath };
}
