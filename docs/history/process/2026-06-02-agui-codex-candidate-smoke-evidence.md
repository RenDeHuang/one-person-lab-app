# AG-UI/CopilotKit candidate smoke evidence 2026-06-02

Owner: `one-person-lab-app`
Purpose: `candidate_smoke_evidence_provenance`
State: `history_provenance`
Machine boundary: Human-readable dated candidate evidence foldback. Current machine truth stays in `contracts/app-shell-candidates.json`, `contracts/shell-adapters/agui-codex.json`, active-shell validation, candidate smoke outputs, package manifests, source, and tests.

## Foldback reason

`docs/agui-codex-candidate-verification.md` is an active experimental runbook. It should define boundary, commands, minimum acceptance, and promotion rules. The dated 2026-06-02 smoke result is process evidence and belongs here.

## Evidence summary

2026-06-02 current candidate evidence recorded:

- Candidate validation passed for `npm run validate:candidate -- --source-only --require-profile`.
- Renderer build passed; Vite warnings did not fail the build.
- `npm run validate:state-model` passed and recorded App-owned active project line projection evidence without promoting it to domain ready, production ready, clean-VM ready, Full release ready, or active-shell adoption.
- Candidate packaging produced the AG-UI Codex Candidate `.app` bundle and candidate manifest.
- WebUI smoke, source UI smoke, packaged UI smoke, bilingual UI, responsive context layer, secondary runtime refs, Codex app-server reply, and safe App action dry-run evidence passed.
- Final candidate gate passed with `npm run validate:candidate -- --require-app --require-smoke`.

## Current read

This evidence proves the explicit candidate can complete its candidate smoke loop. It does not change the default release shell. AionUI remains the active stable/nightly shell until `contracts/app-shell-adapter.json` is explicitly changed and normal release gates pass.
