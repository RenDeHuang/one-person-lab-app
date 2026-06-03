# App docs lifecycle cleanup archive

Owner: `one-person-lab-app`
Purpose: `docs_lifecycle_cleanup_archive`
State: `history_provenance`
Machine boundary: Human-readable process archive. Machine truth stays in
`contracts/`, source, release artifacts, updater metadata, test outputs, active
shell validation, candidate manifests, and OPL Framework CLI/read-model output
consumed by the App.

This archive records dated evidence and local/current-source notes removed from
active App docs during the 2026-06-03 docs lifecycle cleanup. Current lifecycle
truth returns to `docs/docs_portfolio_consolidation.md`, `docs/README.md`,
`docs/status.md`, `docs/active/app-ideal-state-gap-plan.md`, App contracts,
source, tests, release evidence artifacts, and validation scripts.

## Archived Evidence Classes

| Class | Prior active location | Current reading |
| --- | --- | --- |
| Installed App smoke from 2026-05-15 | `docs/testing/README.md` | Historical local smoke provenance only. Current installed-App release proof must use the release evidence bundle, VM smoke summaries, GUI smoke output, and release validation artifacts for the same cohort. |
| Docker/WebUI smoke from 2026-05-15 | `docs/testing/README.md` | Historical smoke provenance only. Current Docker/WebUI release readiness is controlled by App workflows, HTTP smoke artifacts, GHCR publish output, and release-readiness summary artifacts. |
| `agui-codex` current-source candidate evidence from 2026-06-02 | `docs/agui-codex-candidate-verification.md`, `docs/app-gui-feature-inventory.md`, `docs/status.md` | Candidate technical provenance only. It does not make `agui-codex` the active shell, release shell, domain-ready surface, production-ready surface, or clean-VM/Full-release proof. Refresh candidate currentness through explicit adapter selection, shell-side validation, App-root candidate validation, source/WebUI/package smoke, and candidate manifests. |
| Current-source packaged GUI route evidence from 2026-05-29 to 2026-06-02 | `docs/status.md`, `docs/active/app-ideal-state-gap-plan.md` | Cohort-bound App evidence only. A passed bundle can close the current cohort's packaged GUI evidence lane, but it is not stable/latest promotion, updater publication, MAS/MAG/RCA readiness, or OPL family production readiness. Future cohorts must provide real artifacts or typed classifications. |
| Release/user-path App/operator refs from 2026-05-28 | `docs/status.md`, `docs/active/app-ideal-state-gap-plan.md` | Refs-only user-path projection. It can support App release-owner review for the same cohort but does not transfer runtime truth, domain truth, owner receipt authority, artifact authority, or production readiness to the App repo. |
| Active shell migration and release-channel notes from 2026-05-15 and 2026-05-17 | `docs/status.md` | Historical repository/process provenance. Current shell truth is `contracts/app-shell-adapter.json`; current release-channel truth is `contracts/app-release-channel.json` plus release workflows and validation output. |

## Durable Foldback

- Active App shell truth is read from `contracts/app-shell-adapter.json`; active
  prose should not retain old upstream refs when the contract changes.
- Candidate docs keep boundary, command, and acceptance criteria. Dated
  candidate pass/fail evidence belongs in candidate manifests, shell artifacts,
  release evidence bundles, CI logs, or this process history layer.
- Testing docs keep stable commands and evidence requirements. Dated local
  smoke transcripts and absolute `/tmp` or maintainer-machine artifact paths
  belong in release artifacts or history, not active testing guidance.
- App status keeps current owner boundaries and current source-of-truth pointers.
  Long release/candidate evidence tails fold into history or release artifacts.
