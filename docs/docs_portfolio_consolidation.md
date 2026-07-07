# One Person Lab App Docs Portfolio Governance

Owner: `one-person-lab-app`
Purpose: `docs_lifecycle_governance`
State: `active_support`
Machine boundary: Human-readable governance entry and docs role inventory.
Machine truth stays in `contracts/`, source, release artifacts, updater
metadata, test outputs, workflows, active shell validation, and OPL Framework
CLI/read-model output consumed by the App.

## Current Conclusion

`one-person-lab-app` owns the desktop product repository: packaging, release
assets, updater metadata, first-run product policy, App-level contracts,
screenshots, user guides, App validation wrappers, and App public docs. It
consumes OPL Framework CLI JSON, framework contracts, runtime snapshots,
provider receipts, and domain-owned projections. It does not own runtime truth,
provider implementation, domain truth, domain quality/export verdicts, memory
body, artifact body, artifact authority, or owner receipt authority.

The root `docs/` layer is now an index and governance layer. It keeps current
core docs, the active gap plan, and this portfolio governance file. Specific
product, delivery, testing, public, and history material belongs in the
taxonomy below instead of growing more root-level topic files.

## Directory Responsibilities

| Path group | Owner / purpose / state | Current role | Machine boundary |
| --- | --- | --- | --- |
| `README.md`, `README.zh-CN.md` | Public App README surfaces; `active` | Product overview, install orientation, and user-facing start points | Human-readable product docs; release readiness comes from artifacts, manifests, workflows, and validation outputs |
| `docs/README.md` | App docs entry; `active` | Navigation index for core docs and target taxonomy | Navigation only |
| `docs/docs_portfolio_consolidation.md` | Docs lifecycle governance; `active_support` | Directory owner inventory, lifecycle rules, and foldback routing | Governance only; not runtime/release proof |
| `docs/active/app-ideal-state-gap-plan.md` | Active product plan; `active_plan` | Current product progress, gaps, and next-round Agent baton | Human-readable active plan; contracts/tests/artifacts prove machine claims |
| `docs/status.md` | App status; `active` | Current App repository, shell, release, runtime-page, and validation state | Human-readable status; no runtime/provider/domain authority |
| `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md` | Core current docs; `active` | Product boundary, architecture split, non-ownership rules, and still-active App decisions | Durable human-readable current truth; machine decisions use contracts/source/tests |
| `docs/site/` | Latest public docs site; `active_support` | GitHub Pages root for the one maintained current user docs set. `docs/site/latest/` is generated. | Generated payload only; not production/readiness proof |
| `docs/whitepapers/` | Whitepaper source root; `active` | Canonical Markdown source for maintained OPL-family whitepapers. | Source prose only; generated HTML/PDF belongs under `docs/site/latest/whitepapers/` |
| `docs/product/` | Product docs; `active_support` | App/workbench/product shell design, GUI support, foreground shell-alternative material, and product-facing reference docs | Product acceptance stays in App contracts, page-state matrices, active-shell validation, source, and tests |
| `docs/delivery/` | Delivery docs; `active_support` | Release, artifact/package/export lifecycle, user-guide generation source, screenshot provenance, release evidence, and verification support | Release/delivery truth stays in assets, updater metadata, evidence manifests, CI/logs, workflows, validators, release records, and release-boundary tests |
| `docs/testing/` | Testing docs; `active` | Test command entry, validation orientation, release-evidence classification guidance, and explicit smoke lanes | Tests, scripts, contracts, workflows, validators, and artifacts are authoritative |
| `docs/history/` | History docs; `history_index` | Retired topology, process provenance, candidate replay history, stale-surface no-resurrection notes, and archived dated evidence | Historical only; not active product/runtime/release truth |
| `scripts/README.md` | App wrapper and release script guide; `active_support` | Script/operator command index, including docs generation commands | Scripts/tests/contracts determine behavior |

## Governance Rules

- Root `docs/` should not accumulate new topic files. Add or move material to
  `site/`, `whitepapers/`, `product/`, `delivery/`, `testing/`, or `history/`
  according to the owner and lifecycle role.
- Every long-lived doc must make owner, purpose, state, and machine boundary
  clear near the top.
- `docs/site/latest/` is the generated latest public site. Link users to
  GitHub Pages latest URLs, not to guide source directories or tracked binary
  copies. New generated binaries should ship as release assets or regenerated
  local outputs unless they are the canonical maintained latest output for a
  guide.
- OPL-family whitepapers should follow the same source/build/publish pattern:
  source in `docs/whitepapers/`, verification in `docs/delivery/whitepapers/`,
  generated latest HTML/PDF in `docs/site/latest/whitepapers/`, and no committed
  per-release public copies.
- `docs/product/` owns App/workbench/product shell design and GUI support.
  Product claims must fold back to App contracts, page-state matrices,
  active-shell validation, source, and tests.
- `docs/delivery/` owns release, artifact/package/export lifecycle, user-guide
  generation source, screenshot provenance, release records, and verification
  support. Release claims must fold back to artifacts, updater metadata,
  evidence manifests, workflows, validators, release-boundary tests, CI logs,
  or release records.
- `docs/testing/` owns command orientation and evidence classification only. It
  must not duplicate full release policy or become a proof ledger.
- `docs/history/` owns retired routes and process provenance. Historical records
  are not current truth until their durable conclusion is folded back into core
  docs, contracts, source, tests, workflows, artifacts, manifests, or validators.
- App docs must not promote UI rendering, updater metadata, release artifact
  existence, provider completion, zero-open worklists, or OPL projection into
  MAS/MAG/RCA/OMA readiness, quality verdict, artifact authority, domain ready,
  App release ready, or family production ready.
- Machine consumers must use contracts, source, release artifacts, updater
  metadata, test outputs, workflows, validators, or OPL CLI/read-model output.
  Markdown paths and headings are human navigation only.

## Coverage Ledger Foldback

Dated coverage entries, closeout ledgers, candidate smoke notes, local
release/source evidence, and stale-surface retirement notes are compressed under
[App process history](./history/process/README.md), with durable
no-resurrection rules in
[App retired surface provenance](./history/process/retired-surface-provenance.md).

The current process index is topic-level only: it records SSOT owners,
compressed provenance groups, coverage summary, remaining unreviewed scope, and
next write scope. It must not grow back into per-tranche release/candidate
evidence logs, VM smoke transcripts, screenshot logs, branch/worktree closeout,
or proof-by-proof tranches.

Future coverage belongs in the narrowest owner:

| Future evidence | Owner |
| --- | --- |
| Durable App product rule | Core docs, active gap plan, App contracts, source, tests, workflows, or `docs/product/` |
| Durable App release or delivery rule | `docs/delivery/`, App contracts, source, tests, workflows, release validation docs, release records, artifacts, manifests, or CI logs |
| Install exposure / Codex-visible domain skill rule | `contracts/app-install-exposure-policy.json`, product profile, status/decisions/active plan and `validate:agent-installation`; README/release/user docs may only point to that owner |
| Release proof, remote checks, VM smoke, packaged route receipts | Release artifacts, evidence manifests, CI logs, release records, workflows, validators, or release history/provenance |
| Foreground alternative technical smoke, adoption gate, or replacement decision | `contracts/app-shell-candidates.json`, `contracts/shell-adapters/hermes-codex.json`, `scripts/validate-shell-candidates/*`, Hermes candidate manifests, shell artifacts, focused tests, candidate history/provenance, and `docs/product/shell-alternatives/`; archived AGUI replay evidence stays under `docs/history/shell-candidates/` only when AGUI is explicitly requested |
| GUI definition / interaction target | `docs/product/gui/`, App GUI/page-state/first-run contracts, and active-shell validation |
| User guide generation and screenshot provenance | `docs/delivery/user-guides/`, `docs/delivery/release-evidence/`, and latest generated outputs in `docs/site/latest/`; new generated binaries should not be added as extra tracked copies without a manifest and regeneration command |
| Docs lifecycle tranche closeout | `docs/history/process/README.md` as a compressed theme row, not a dated proof ledger |
| Testing-doc release evidence guidance | `docs/testing/README.md` for command entry and evidence classification only; release cohort policy stays in delivery/release docs, `contracts/app-release-channel.json`, workflows, validators, and release-boundary tests |
| Docker/WebUI beginner install path | `contracts/app-install-exposure-policy.json` owns machine policy; `docs/delivery/install/docker-webui-guide.md` owns operator install routing; `docs/delivery/install/docker-webui-smoke-gates.md` owns verification/readiness-boundary support; GitHub Pages latest owns the user-facing entry; `docs/site/latest/docker-webui-install/` owns latest generated outputs; `docs/delivery/user-guides/docker-webui-install/generated/` is generated payload only |

This App coverage does not close the parent OPL series docs-governance goal,
because the seven-repo goal remains open until every repo ledger has no
unreviewed docs or unresolved stale/retire candidates.

Current residual App candidates are not open owner-route gaps: the release guide
has test-bound operator wording, Docker/WebUI smoke gates have validator-bound
wording, and Settings/GUI history compression must start from the owning
contract, artifact, validator, or process-history surface before prose changes.
Do not convert these residual candidates into active gap rows unless a fresh
owner surface changes.
