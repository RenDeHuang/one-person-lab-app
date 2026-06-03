# AionUI Builtin Skill Intake

Owner: `one-person-lab-app`
Purpose: `aionui_builtin_skill_intake_review`
State: `history_provenance`
Machine boundary: Human-readable historical intake note. App packaging truth lives in `contracts/app-product-profile.json`, Full package scripts, release manifests, and validation tests. Current App skill packaging policy must be read from App contracts, decisions, release scripts, and validation tests, not this dated candidate snapshot.

## Product Rule

AionUI builtin skills are candidate shell capabilities only. The App package uses one source-neutral whitelist:

- `companion_payloads.default_packaged_codex_skill_ids`: packaged and default visible.
- `companion_payloads.packaged_not_default_visible_codex_skill_ids`: packaged but explicit-only, currently OMA through `opl-meta-agent`.

Skills outside those two lists are not copied into the App package, even if the active shell exposes them as builtin skills. Future GUI shells should follow the same App-level whitelist instead of introducing shell-specific default packaging classes.

## Current App Package Whitelist

Default packaged and default visible:

- `mas`
- `mag`
- `rca`
- `superpowers`
- `cron`
- `officecli`
- `officecli-docx`
- `officecli-pptx`
- `officecli-xlsx`
- `officecli-academic-paper`
- `officecli-data-dashboard`
- `officecli-financial-model`
- `officecli-pitch-deck`
- `pdf`
- `mineru-document-extractor`
- `ui-ux-pro-max`

Packaged but explicit-only:

- `opl-meta-agent`

Excluded by policy:

- `morph-ppt`
- `morph-ppt-3d`

## Current AionUI Builtin Candidate Snapshot

This snapshot came from the current local active shell/App support builtin-skills corpus. It is useful for review, but it is not machine truth for App packaging.

Auto-injected builtin candidates:

- `aionui-skills`
- `cron`
- `officecli`
- `skill-creator`

Opt-in builtin candidates:

- `aionui-webui-setup`
- `mermaid`
- `moltbook`
- `morph-ppt`
- `morph-ppt-3d`
- `officecli-academic-paper`
- `officecli-data-dashboard`
- `officecli-docx`
- `officecli-financial-model`
- `officecli-pitch-deck`
- `officecli-pptx`
- `officecli-word-form`
- `officecli-xlsx`
- `openclaw-setup`
- `pdf`
- `star-office-helper`
- `story-roleplay`
- `weixin-file-send`
- `x-recruiter`
- `xiaohongshu-recruiter`

## Initial Triage

Keep in App package now:

- `cron`: default packaged and visible as an App scheduling capability. It stays out of MAS/MAG/RCA assistant-scoped home skill menus because it is not part of those assistant profiles.
- `officecli`, `officecli-docx`, `officecli-pptx`, `officecli-xlsx`, `officecli-academic-paper`, `officecli-data-dashboard`, `officecli-financial-model`, `officecli-pitch-deck`: default packaged OfficeCLI family so the App package exposes common document, spreadsheet, model, deck, and paper workflows without relying on shell-local builtin discovery.
- `pdf`: default packaged for visual PDF review and generation workflows that complement MinerU extraction and OfficeCLI editing.

Do not include by default:

- `aionui-skills`, `skill-creator`: AionUI internal/developer automation surfaces; keep out of the App package policy.
- `aionui-webui-setup`: setting-page guidance for manually enabling AionUI WebUI and remote access. OPL Docker/WebUI installs should be configured by the Docker/install/runtime policy and smoke gates, not by a prompt skill.
- `morph-ppt`, `morph-ppt-3d`: retired for OPL App packaging; RCA and OfficeCLI/PPTX cover the product route.
- `mermaid`: potentially useful, but currently overlapped by UI-UX and presentation workflows; review only if a product workflow needs direct default exposure.
- `moltbook`, `star-office-helper`, `openclaw-setup`, `story-roleplay`, `weixin-file-send`, `x-recruiter`, `xiaohongshu-recruiter`: unrelated to current OPL App default workflows; leave as shell/local optional candidates.
