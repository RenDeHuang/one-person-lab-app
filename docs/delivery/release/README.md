# App Release

Owner: `one-person-lab-app`
Purpose: `app_release_docs`
State: `active`
Machine boundary: Human-readable release guide. Machine decisions stay in `contracts/app-release-channel.json`, release workflows, scripts, validators, release artifacts, updater metadata, test outputs, Homebrew tap outputs, and OPL Framework CLI/read-model output consumed by the App.

## Read This First

This guide is the release operator map, not a proof ledger. It states the release lanes, stop conditions, required machine surfaces, and verification commands. Dated run ids, branch closeouts, VM transcripts, package-size investigations, candidate smoke logs, GHCR diagnostics, screenshots, and release-by-release evidence belong in release artifacts, CI logs, candidate manifests, or `docs/history/process/`.
The `v26.6.12` same-tag refresh and timing profile is archived at
`docs/history/process/2026-06-12-stable-release-profile.md`; use it as
provenance only, not as current release authority.
The `v26.6.18` candidate/promote timing profile is archived at
`docs/history/process/2026-06-18-stable-release-profile.md`; use it as
post-release tuning provenance only, not as current release authority.

The App repository owns desktop packaging, release assets, updater metadata, release evidence validation, user-facing release notes, GUI smoke, and App-owned release gates. OPL Framework owns runtime/update kernel behavior and module maintenance. MAS/MAG/RCA/OMA own domain truth, artifact authority, quality/export verdicts, owner receipts, and typed blockers.

## Single Source Of Truth

| Theme | Current owner |
| --- | --- |
| Release channel policy, standard/Full separation, three-object software lifecycle, updater metadata, release evidence requirements | `contracts/app-release-channel.json` |
| Release workflow shape and publish/promote sequencing | `.github/workflows/desktop-release*.yml`, `.github/workflows/homebrew-tap-update.yml`, release scripts |
| Release evidence classification and boundary validation | `scripts/validate-release-boundary.ts`, `scripts/validate-release.ts`, release-boundary tests |
| Full payload and size budgets | `contracts/app-release-channel.json#full_first_install.size_budget`, `contracts/app-release-channel.json#full_first_install.opl_runtime_bundle_consumer`, Full manifest `opl_runtime_bundle_consumer`, `scripts/verify-remote-release-assets.ts`, `npm run release:full:size`, `scripts/analyze-full-package-size.ts`, and `scripts/release-size-reporting.ts` |
| App/root shell boundary | `contracts/app-shell-adapter.json`, `scripts/app-root-boundary.ts`, `scripts/validate-active-shell.ts` |
| Install exposure and Agent Package visibility | `contracts/app-install-exposure-policy.json`, `npm run validate:agent-installation` |
| OPL Base and OPL Packages managed execution | OPL Framework `opl update status/check/plan --json`, canonical `opl packages`, and lifecycle receipts |
| OPL Base artifact gate | `contracts/app-release-channel.json#managed_update_plane.software_lifecycle.objects.opl_base`, Framework artifact channel/readback/checksum/rollback receipts |
| Release history and retired workflow no-resurrection notes | `docs/history/process/` and `docs/history/process/retired-surface-provenance.md` |

## Install And Update Taxonomy

Release docs and user docs expose exactly three software objects. Framework
dependency and projection details remain nested status, never peer updaters.

| Object | User-facing meaning | Lifecycle boundary |
| --- | --- | --- |
| OPL Base | Headless Framework/CLI/runtime prerequisite. | Framework owns mutation. Formula `opl` and `opl-install.sh --headless --skip-packages` are carrier adapters for the same identity. The App may bootstrap a missing Base and show `dependency_status` / `integration_status`, but cannot mutate Base itself. |
| OPL App | GUI and control plane. | App owns its binary. Cask and signed installer/DMG are carrier adapters; standard updater or host route supplies `host_update_route` and `host_executor_required`. |
| OPL Packages | MAS/MAG/RCA/OMA/BookForge/MAS Scholar Skills/OPL Flow capability packages. | Framework `opl packages` owns install/update/repair/uninstall. Codex visibility is `projection_status`; profile semantic merge is `profile_migration_status`. Homebrew and App do not mutate Packages. |

Full first-install assets may seed App, Base, and Package payload bytes for a
clean machine, but they do not change lifecycle ownership and are not a
long-term update channel. Standard updater metadata targets OPL App only.

## Release Lanes

| Lane | Purpose | Required proof |
| --- | --- | --- |
| Standard macOS App | Ordinary desktop App package and standard updater target. It never carries or updates the OPL runtime bundle. | Standard DMG / ZIP assets, `latest-arm64-mac.yml`, ZIP blockmap, remote asset verification, GUI smoke, local authorization policy, release evidence bundle. |
| Full first-install DMG | Clean-machine package that can reach Core ready without CLT, Homebrew, Node, or Git first. It consumes the OPL runtime bundle manifest/lock/readback and does not own dependency truth. | Full DMG, `opl-release-manifest.json` with `opl_runtime_bundle_consumer`, native runtime trust record, VM smoke when requested, manifest-carried local authorization policy, remote size and manifest verification. |
| Offline runtime kit | Manual diagnostic or recovery artifact for the same Full runtime bundle payload. It is not updater-visible and is not a release-ready claim. | Runtime archive, checksums, Full manifest refs, and the same OPL bundle consumer boundary as the Full DMG. |
| Stable promotion | Human release-owner promotion from candidate to stable/latest. | Candidate record with `status=ready_to_promote`, release readiness summary, same-cohort evidence, promote workflow output. |
| Homebrew | Formula `opl` installs the headless OPL base; standard/nightly/Full Casks install the optional App GUI and depend on the Formula. | Framework Formula manifest/readback, published App assets, tap update output, compatibility handshake receipt, single-active-core readback, and Homebrew VM smoke where required. Framework owns base/Formula release truth; App owns App/Cask release truth. |
| WebUI/GHCR | App-owned preheated Docker/WebUI runtime image for browser-first Linux/container deployment. It is not the desktop App GUI shell install path and is not an OPL Packages member. | OCI source label, package access, publish output, image manifest/volume boundary, image smoke/evidence artifacts. |
| Managed maintenance | Framework lifecycle for OPL Base and OPL Packages; App self-update remains App/carrier-owned. | Three-object status, Framework receipts, Base dependency/integration detail, Packages projection/profile-migration detail, and App host-route readback. |

## Canonical Versions

App release versions have two exact forms, owned by
`contracts/app-release-channel.json#github_release_name` and executed through
`npm run release:version:validate`:

- Stable: `^[0-9]{2}\.(?:[1-9]|1[0-2])\.(?:[1-9]|[12][0-9]|3[01])$`
- Nightly: `^[0-9]{2}\.(?:[1-9]|1[0-2])\.(?:[1-9]|[12][0-9]|3[01])-nightly\.[1-9][0-9]*\.[1-9][0-9]*$`

Both forms also require a real calendar date. Stable is `YY.M.D` without
leading zeroes or a same-day suffix. Every Nightly workflow attempt gets a
unique immutable `YY.M.D-nightly.<github_run_id>.<github_run_attempt>` identity;
Nightly is never a Stable refresh or promotion source.

Standard macOS DMGs use electron-builder-supported `ULFO` / LZFSE compression
by default. Current electron-builder 26.8.1 does not accept `ULMO` in
`dmg.format`; treating `ULMO` as a standard default would require a separate
postprocess patch, with focused proof that canonical `latest-arm64-mac.yml`,
the ZIP blockmap, and the DMG format/readability still match the published
assets. `latest-mac.yml` is a deliberate legacy alias only when published; a
DMG blockmap is not part of the required Standard public updater asset set.

GitHub Release public assets stay limited to install, updater, checksum, and
small machine-verification entrypoints. Release-note evidence, Full size
summaries, build timing, and workflow telemetry belong in Actions artifacts or
job summaries, not the public download list.

The Stable WebUI path builds the image once in the Docker smoke lane, verifies
the image locally, publishes that same image to GHCR, and leaves the GHCR lane
as a summary-verifier gate. Do not add a second Stable Docker build just to
separate smoke and publish reporting.
The standalone WebUI GHCR workflow must expose the same work as separate
prepare, build, inspect/readback, smoke, tag, publish, and upload steps. A
single long `Build, verify, and publish Docker WebUI` step is not acceptable
operator evidence because GitHub does not expose live step logs or partial
artifacts until the active step completes.

Desktop users get the AionUI shell through the App package itself. The
`one-person-lab-webui` container exists only for Docker/server deployment and
release smoke evidence; Framework package workflows must not publish it. The
container image is a preheated WebUI runtime image: it carries the WebUI shell,
launcher, bundled AionCore, bootstrap, image manifest, and optional seed
metadata so a user can open the browser quickly. User state, OPL runtime
maintenance receipts, Codex configuration, logs, cache, and managed runtime
state belong under the mounted `/data`; project files belong under `/projects`.
Image replacement updates the WebUI/container entry layer, while OPL Framework
owns managed reconciliation and module/toolchain updates inside `/data`.
The OPL Framework runtime artifact is a release gate under OPL Base:
the candidate must carry Framework artifact channel readback, artifact ref
readback, sha256 checksum evidence, and a rollback ref/receipt. The App consumes
those refs and checksums only. This gate does not authorize the App or Framework
to update the Docker/WebUI image from inside Docker; image replacement remains
the Installation Carrier host route.

## Preflight

Every release starts with `release-preflight`, backed by:

```bash
npm run release:preflight
```

The preflight checks version/mode compatibility, remote tag or release state,
workflow shape, release plan shape, shell/framework ref availability, Codex CLI
plus Darwin arm64 package metadata for VM-smoke runs, the Homebrew VM static
trust policy, stage-appropriate Homebrew tap token availability, and the
App-owned release contract. A failing preflight stops the release before
standard, Full, VM, Homebrew, WebUI, or publish jobs run.

The desktop release workflow never updates Homebrew from an unpublished draft.
Both `new_release` and `refresh_existing` create or repair a draft first; the
Homebrew tap update belongs to the promote workflow after remote publication
readback, so preflight must not block App assets, Full assets, or Docker/WebUI
candidate evidence on the tap token.

Promote must read back the just-published Stable release before it starts
Homebrew. The required readback is the remote `gh release view v<version>`
payload plus `refs/tags/v<version>`: non-draft, non-prerelease, latest,
published, and with readable assets. If GitHub publication visibility lags or
the tag/release binding drifts, the promote job retries briefly and fails at
that boundary instead of letting Homebrew fail later with an ambiguous
`release not found`.

All GitHub Release mutations for one Stable App version use
`opl-app-release-mutation-<version>`. Desktop and promote hold that lock, and a
standalone Full run joins it when `publish_to_release=true`. Embedded
artifact-only Full builds use a separate build key because they do not mutate a
release and must not self-block their desktop caller. Immediately before notes
replacement and before every asset upload attempt, `release:publish` reads the
remote release again and requires `isDraft=true`; a published release can never
reach the `--clobber` upload command.

Homebrew tap writes remain direct commits, not pull requests, but same
channel/version writes are serialized across Standard and Full casks. If the
tap main branch still advances between checkout and push, the workflow fetches
`origin/main`, rebases the local cask commit, and retries before classifying the
tap update as failed. A non-fast-forward tap push is a recoverable write
conflict, not release evidence failure.

Docker/WebUI releases are gated by Docker build, GHCR publish, and clean Linux
Docker runtime smoke. These gates stay in the same release cohort and remain
visible in readiness job results, but they are add-on gates for Standard stable
readiness unless `require_addon_gates_for_stable_readiness=true` is dispatched.
`docker_webui_clean_windows_evidence_artifact` is optional diagnostic input;
missing Windows evidence must not block a macOS App stable release or a
Docker/WebUI image release.

The source gate is the next fail-fast boundary after preflight:

```bash
npm run validate:release-boundary
npm run release:source-gate -- --version <version> --app-ref <app-sha> --shell-ref <shell-ref> --framework-ref <framework-ref>
```

`release:source-gate` is the App-owned source/readiness front door for the
candidate cohort. It must check App release-boundary policy, shell format/type,
active shell node/dom tests, shell source ref, and framework ref resolution
before expensive standard build, Full build, VM, Homebrew, or WebUI work starts.
If it fails, stop the train, repair the source gate, and dispatch a new cohort
after the pinned refs are valid. Do not wait for downstream build or VM jobs to
prove a source-gate failure again.

For the Homebrew standard VM gate, the static policy is:

- Install ref: `gaofeng21cn/one-person-lab/one-person-lab`
- Trusted cask refs: `gaofeng21cn/one-person-lab/one-person-lab`,
  `gaofeng21cn/one-person-lab/one-person-lab-full`, and
  `gaofeng21cn/one-person-lab/one-person-lab-nightly`
- Trust scope:
  `explicit_standard_and_conflicting_cask_refs_not_whole_tap`

The preflight and release-boundary gates fail if the install path falls back to
an unqualified cask, omits a sibling `conflicts_with` cask ref, or trusts the
whole tap.

## GitHub Actions Release Path

Stable release flow:

1. Run sync preparation outside the release train: update the OPL-family repos,
   run each repo's cheap owner/source gate, and resolve the candidate refs.
2. Freeze the candidate cohort by recording App SHA, shell ref plus resolved
   shell SHA, framework ref plus resolved framework SHA, release mode, Full
   intent, VM intent, owner refs, and any gate-reuse inputs.
3. Generate dispatch inputs from the cohort plan/lock. Do not hand-fill long
   App/Shell/Framework SHAs as the recommended operator path.
4. Run preflight and `release:source-gate` for that pinned cohort.
5. Run the release workflow for the selected version/channel.
6. Produce standard artifacts, publish standard, then run standard remote
   verification, the standard VM gate, and the one-shot installer smoke as the
   default Standard stable readiness path.
7. Start Full build in parallel after preflight/source gate when requested, but
   keep Full publish, Full remote verification, Full VM, and Full readiness
   admission behind the Standard gate for the same cohort.
8. Continue Docker/WebUI, Homebrew, and operator-evidence work as same-cohort
   add-on gates/assets. Their status is recorded in
   `release-addon-readiness-summary` without delaying the Standard readiness
   record; release owner policy may still require them before promote.
9. Produce `release-candidate-record.json` for the admitted readiness path while
   preserving add-on job results for the same cohort.
10. Promote only when the promote workflow reads a ready candidate record for
   the same cohort.
11. Update Homebrew casks after the draft release is published and the matching
   policy assets exist.
12. Run post-release user-guide/screenshots only after promotion; they are never
   pre-promotion gates.

Nightly follows an executable `release version gate -> release source gate ->
standard build -> immutable prerelease publish -> remote verify` plan. It does
not call Stable preflight and does not imply Stable/latest promotion.

The stable candidate is valid only for one frozen App/Shell/Framework SHA
cohort. Remote movement after the freeze is `post-freeze drift`: it may make the
world newer, but it does not let a completed candidate pretend to be the latest
source at closeout time. If the release owner chooses the newer source, freeze a
new cohort and dispatch a new desktop release; otherwise the single frozen
candidate proceeds to owner receipt and promote without rerunning desktop
release work.
Moving `main`, shell `main`, and framework `main` are allowed only as
preparation-time ref-resolution sources. They are not final Stable release
inputs. The final train input is the pinned cohort lock: App SHA, shell SHA,
framework SHA, version, release mode, Full/VM intent, owner refs, and any
same-cohort reuse inputs.

Every desktop release run also uploads `release-actions-timing-<version>`. Use
that artifact to inspect workflow wall time, failed/canceled run tax, slow jobs,
and slow steps before opening raw job logs.

## Release Efficiency Target Architecture

The target release shape is `build-once/promote-many`: a frozen App/Shell/Framework
cohort produces standard, Full, VM, remote-verification, readiness, and candidate
record artifacts once. Retry work reuses that same cohort and the same produced
artifacts unless the failed gate proves the artifact itself is invalid or a
release owner deliberately freezes a new cohort.

The release cohort manifest is the retry entrypoint. It records the version,
release mode, pinned App/Shell/Framework SHAs, Full intent, VM intent, release
artifact refs, remote verification refs, candidate-record refs, owner refs, and
gate reuse decisions. Operators should restart from the manifest instead of
hand-filling workflow inputs or rerunning the full train after a late gate
failure.

The release-session manifest is the operator-session wrapper around one or more
workflow runs. It records the run set, failed-run tax, current authority
surface, owner receipt state, typed next action, and post-publish follow-up. It
is not release truth: release state still comes from the candidate record,
closeout, remote verification, owner receipt, and published asset/readback
surfaces for the same cohort.

Update it from `release:operator status` instead of hand-editing JSON. Use
`--session-input` to carry the existing session forward and `--session-output`
to write the next manifest, then attach the same-cohort refs that actually
exist:

```bash
npm run release:operator -- status \
  --run-id <github-actions-run-id> \
  --version <version> \
  --expected-head <app-sha> \
  --session-input release-session.json \
  --session-output release-session.json \
  --candidate-ref release-candidate-record.json \
  --closeout-ref release-closeout.json \
  --readback-ref remote-release-verification.json \
  --owner-receipt-ref docs/delivery/release/records/v<version>-release-owner-receipt.json
```

`--current-authority-ref`, `--post-publish-follow-up-ref`, and
`--post-publish-follow-up-state pending|completed|blocked` are explicit
operator inputs. A later status update must not carry an old current-authority
or follow-up ref as if it were fresh evidence unless the operator supplies it
again for that run.

Full build is the only Full lane that may run in parallel with Standard before
Standard admission. Full publish, Full VM, and Full readiness must wait for the
Standard gate so a broken Standard path fails fast before expensive add-on
publication or clean-install proof work expands the run.

Critical-path targets:

| Path | Target wall time | Owner action when exceeded |
| --- | --- | --- |
| Stable standard-only candidate | 35-45 minutes | Inspect `release-actions-timing-<version>` and the operator status for slow gates before rerunning. |
| Stable with Full package, Docker/WebUI, and VM gates | 43-50 minutes for the release workflow; 55-70 minutes including normal operator interaction and promote | At 75 minutes, run `release:operator status` and classify the active job/step before waiting longer. At 90 minutes, stop passive waiting and identify the blocker owner or same-cohort retry path. |
| Same-cohort gate retry | 3-15 minutes | Use the cohort manifest to rerun only the failed gate or diagnostic path. |
| Promote after owner receipt | 8-12 minutes | Promote from a ready candidate record; inspect at 10 minutes and treat 15 minutes as the hard-stop SLA for the promote workflow. Do not rerun desktop release to carry owner metadata. |

The RCA boundary is mostly process design, not isolated code failure: treat
roughly 70% of release delay as workflow shape, evidence routing, and retry
design, and roughly 30% as implementation bugs. The first repair target is
therefore shortening the critical path and making retry state explicit before
adding more scripts.

Full runtime bundle assembly is outside the App release critical path. OPL
Framework owns preheating/materializing the runtime bundle, lock, env contract,
and readback; the App Full release consumes the bundle manifest and packages
required offline payloads. A cache hit, manifest, or lock is reuse evidence
only, not runtime truth or release readiness.

VM smoke is artifact qualification. It qualifies the exact DMG/cask artifact
for the same cohort and must not be used as a place to rebuild, mutate source,
or generate missing release material. If VM smoke fails after artifact creation,
rerun the VM diagnostic or same-cohort gate from the manifest. The operator
next action must be a same-artifact diagnostic unless the failure proves the
artifact, source gate, or pinned refs are invalid. Dispatch a new cohort only
after that boundary is proven.

Stable release coordination uses `opl_app_stable_release_session.v2`. Every
Standard or Full DMG carries an `opl_app_build_artifact_cohort.v2` manifest
binding the exact App, Shell, Framework, packaged tree, product profile, GUI
contract, smoke harness, Actions run, and DMG bytes. A failed Full clean-VM gate
may be retried with those same bytes and may override only the stale
`full_dmg_clean_vm` readiness result after the qualification receipt matches the
session, cohort, source run, manifest digest, and DMG SHA-256. It never authorizes
a rebuild or changes Docker, remote-asset, or Homebrew evidence.

Late Homebrew, VM, evidence upload, closeout, or owner-receipt failures use the
same rule: retry or diagnose the failed gate against the same published asset,
tap commit, candidate record, or small evidence artifact first. Rerun the full
desktop train only when the diagnostic proves the artifact, source gate, pinned
cohort, or release-owner decision is invalid.

Promotion is a receipt-backed saga: publish the GitHub Release as public but not
latest, atomically publish both Standard and Full casks through the tap owner,
qualify both casks in clean VMs, and only then activate latest. A partial failure
must rerun failed jobs in the original promotion run and reuse an existing
immutable distribution receipt; it must not dispatch a second promotion or tap
mutation. Completion additionally requires the same-version local installation
receipt and nonblank CDP Home, Settings, and Capabilities readback with zero page
or console errors. Phase timings and dispatch counts are recorded. Ninety minutes
is an efficiency advisory that triggers blocker classification and evidence
reuse, not permission to abandon an authorized release.

`desktop-release.yml` is the source/candidate train and never writes the Stable
or Full tap. Its add-on summary records Stable distribution plus both Homebrew
clean-VM gates as deferred. `desktop-release-promote.yml` is their sole App-side
owner after the candidate, exact Full qualification, and owner receipt pass.

## Artifact Attestation And Provenance

Artifact attestation is build-integrity evidence for public release bytes, not
release readiness. Attest these assets when the workflow publishes them:

- Standard install/update bytes and metadata: standard DMG, updater ZIP,
  `latest-arm64-mac.yml`, ZIP blockmap, and checksum assets.
- Full first-install bytes and metadata: Full DMG, `opl-release-manifest.json`,
  Full checksum assets, and offline runtime kit archives when published.
- WebUI/GHCR bytes: the published OCI image digest and image manifest.

The operator verification entry is the GitHub artifact-attestation verifier
against the downloaded asset and this repo, for example:

```bash
gh attestation verify <asset-path> --repo gaofeng21cn/one-person-lab-app
gh attestation verify oci://ghcr.io/gaofeng21cn/one-person-lab-webui@sha256:<digest> --repo gaofeng21cn/one-person-lab-app
```

Use the structured verifier when preparing the closeout input:

```bash
npm run release:attestation:verify -- \
  --version <version> \
  --asset <downloaded-standard-or-full-release-asset> \
  --oci oci://ghcr.io/gaofeng21cn/one-person-lab-webui@sha256:<digest> \
  --output attestation-verification-summary.json
```

SLSA provenance should bind the asset to the workflow identity, repo, run id,
version, and pinned App/Shell/Framework SHAs. It does not replace checksum
verification, remote asset readback, `codesign` / `spctl`, clean install/VM
readiness, candidate-record validation, or release-owner receipt. Attesting a
diagnostic JSON or evidence bundle can help traceability, but it cannot make
that bundle a release truth source.

Release closeout reads `release-attestation-verification-<version>` when it is
present, accepting `attestation-verification.json` or
`attestation-verification-summary.json`. If that artifact is absent, closeout
marks `artifact_attestation_verification.state=missing` and prints the
`gh attestation verify` commands above. If a verification payload is present
but its status is not passed/success/verified, closeout marks it `failed`
instead of treating the file's existence as proof.

## Release Notes Runbook

Public release notes are user communication, not the release audit ledger.
Release scripts generate the evidence packet first: channel, version, compared
release, user-facing change groups, OPL-family refs, Full payload versions,
asset/readback facts, and technical provenance. Public copy must be prepared
before the release train enters the expensive build/VM/publish path. Release
publish and promote jobs consume the prepared body and evidence refs; they do
not call online AI to write public notes on the critical path.

Stable notes target ordinary App users and release operators deciding whether
to install, upgrade, promote, or troubleshoot the current Stable package. Lead
with the stable user scenarios that improved, upgrade value, install/update
actions, compatibility notes, and known follow-up. Mention Full first-install
only when that package is part of the cohort, and frame it as clean-machine
first-launch value rather than packaging internals.

Nightly notes target opt-in testers, maintainers, and operators checking the
latest prerelease. Lead with what is new since the previous Nightly, which user
flows need validation, what risks or rough edges are expected, and what feedback
or smoke path matters. Nightly copy may be more explicit about validation
intent, but it still starts from user-visible scenarios instead of raw commits.

The public body should use this order unless a release owner chooses a more
specific user story:

1. User-facing headline for `One Person Lab v<version>`.
2. Highlights grouped by scenario, upgrade value, or visible workflow.
3. Install, update, or tester action items.
4. Compatibility, known issues, and follow-up only when relevant.
5. Technical details at the end: compared tags, App/Shell/Framework refs,
   workflow run ids, asset verification, evidence artifact names, and compact
   changelog links.

Do not use commit logs, ref lists, workflow names, gate names, evidence tables,
or packaging audit output as the main release-note narrative. Those details
belong in the final Technical details section, the release evidence artifact,
the candidate record, CI summaries, or closeout artifacts. The public download
list must stay focused on install/update/checksum entrypoints; release-note
evidence JSON is operator evidence, not a user download.

AI assistance is the public release-note writer, but only in the pre-release
preparation stage. The release cohort must carry the final prepared AI-written
notes or fail before publish/promote starts. Deterministic template output is
allowed only for explicit dry-runs and diagnostics; it must not be silently
published as the public Stable or Nightly body. Stable and Nightly publishing
must not generate or replace public release notes during publish/promote.
The desktop Stable/Full workflow and scheduled Nightly workflow prepare
LLM-written notes before their publish jobs, then those publish jobs consume the
prepared notes files. The legacy Full first-install workflow prepares the same
LLM-written notes before its GitHub Release upload step.

The release workflows use `OPL_RELEASE_NOTES_PROVIDER=openai_compatible` with
the OPL gflabtoken compatibility route:
`OPL_RELEASE_NOTES_CODEX_BASE_URL=https://gflabtoken.cn/v1`,
`OPL_RELEASE_NOTES_CODEX_API_KEY`, and
`OPL_RELEASE_NOTES_MODEL=gpt-5.4-mini`. The writer also supports a separate
operator-configured OpenAI-compatible endpoint for non-release probes or local
drafting.
There is no GitHub Models fallback and no automatic template fallback for
prepared release notes. GitHub announced that
[GitHub Models is being fully retired on July 30, 2026](https://github.blog/changelog/2026-07-01-github-models-is-being-fully-retired-on-july-30-2026/),
so do not route release notes through free GitHub Models. When AI drafting is
run before dispatch, the evidence sent to the model is compacted before the
request and each online model request has a bounded timeout
(`OPL_RELEASE_NOTES_AI_TIMEOUT_SECONDS`, default 75 seconds).

Pre-release drafting probes the online provider before accepting AI-assisted
copy and fails closed when the endpoint or secret is missing or unusable.
Configure one of these secret-safe GitHub Actions routes:

```bash
# Preferred explicit route.
OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL=http://localhost:3001/v1
OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY=freellmapi-...
OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_MODEL=auto

# Release workflow route.
OPL_RELEASE_NOTES_CODEX_BASE_URL=https://gflabtoken.cn/v1
OPL_RELEASE_NOTES_CODEX_API_KEY=<repo secret>
OPL_RELEASE_NOTES_MODEL=gpt-5.4-mini
```

The release-note writer reads the explicit `OPENAI_COMPATIBLE` route first and
then the existing `CODEX` route. Workflows pass both names through separately so
the compatibility behavior lives in the writer, not in a one-off workflow
expression.

Keep API keys in GitHub Actions secrets only. Do not put them in workflow vars,
release evidence, artifacts, logs, or repository files. The probe prints only
provider status, model, and endpoint host/path; it redacts provider output that
echoes the bearer token.

Before a release, verify the exact online path from a shell that has the same
environment:

```bash
npm run release:notes:probe-ai
```

`freellmapi` is acceptable for the explicit route when it is a self-hosted,
single-user gateway with provider keys managed by the operator. Treat it as an
operator-provided inference route, not as an App-owned production dependency:
its own README describes the project as personal experimentation, and upstream
free tiers can change or disappear without notice.

## No-Watch Operator Runbook

Do not watch a release page as the control loop. Use the operator readout as
the first status surface:

```bash
npm run release:operator -- status --run-id <github-actions-run-id> --expected-head <app-sha> --summary
```

Interpret the result as follows:

- `stale_candidate`: stop waiting. The run head is not the expected App SHA;
  keep it only as old-cohort diagnostics and dispatch a new pinned cohort.
- `failed_gate_draining`: stop waiting for unrelated downstream work; inspect
  the primary blocker and repair that gate.
- `waiting_for_run_completion` with `Budget: within_budget`: wait or check the
  current job normally.
- `waiting_for_run_completion` with `Budget: attention`: the active job/step or
  run update age crossed the release-operator budget, or the run crossed its
  release SLA. The summary line `Release SLA: attention` means elapsed time
  crossed the planned operator threshold even if the current step itself is
  still young. Inspect the current step, runner availability, and workflow
  shape before continuing to wait.
- `ready_for_closeout_review`: inspect closeout, readiness, candidate record,
  and remote verification artifacts before any release-owner decision.

For the full Stable path, 75 minutes is the attention point and 90 minutes is
the hard-stop SLA for passive waiting. For the promote path, inspect at
10 minutes and treat 15 minutes as the hard stop. A VM failure after artifact
creation should route to `npm run release:operator -- diagnose-vm ...` or the
critical-diagnostics `retry_entry`, not to a new `desktop-release` dispatch.

The 2026-06-29/30 stable attempt exposed two design traps that this runbook
guards against: a WebUI GHCR run can sit inside one opaque Docker step with no
downloadable live logs, and GitHub `updatedAt` may stop moving while the run is
still active. Operator elapsed time therefore uses the current read time for
active runs, not `updatedAt`, and the WebUI GHCR workflow is split into named
steps so the Actions job itself identifies the slow boundary.

## Clean VM Diagnostics

The clean first-run VM gate uploads App-wrapper diagnostics alongside the shell
smoke artifacts. The wrapper records host `node`, `npm`, `curl`, npm registry,
`@openai/codex` package metadata, Codex install asset preflight/cache details,
the resolved job/run/smoke timeout settings, the smoke command preview, and
wrapper stdout/stderr logs in `app-wrapper-diagnostics.json` plus companion
`app-wrapper-*.log` files.

Before launching the clean VM, the workflow performs a host-side Codex npm
package preflight. It reads `@openai/codex@latest` metadata, records the npm
registry response status, package version, tarball URL host, tarball sha256,
tarball size, and elapsed time in `codex-package-preflight.json`, stores the
raw registry response as `codex-package-registry-response.json`, downloads the
tarball to `codex-package-tarballs/openai-codex.tgz`, and materializes
`codex-npm-cache`. GitHub Actions cache restores and saves those install assets
to reduce registry dependency, but the clean VM install smoke still runs and
must prove first-run behavior. This is an install asset preseed/cache surface;
it is not App readiness truth, release-owner receipt, runtime truth, or a
replacement for `tart-smoke-summary.json` and shell Codex install diagnostics.

The reusable VM workflow has two explicit `diagnostic_scope` values. Stable
release workflows use `release_gate`, which keeps the Codex install asset
preseed, Settings sweep, assistant route smoke, Codex functional check, and
Codex AI self-check on the deterministic gate path. The workflow also records
wrapper preflight diagnostics, the exact Tart smoke command, stdout and stderr
logs, and `tart-smoke-summary.json`. Those wrapper artifacts support debugging,
but the release gate still passes or fails on the deterministic VM readiness,
Settings, route, and Codex checks. The diagnostics workflow defaults to
`bootstrap_only`: it still resolves the supplied or same-run DMG, installs the
App, verifies the packaged main bootstrap marker, launches the App, and uploads
wrapper diagnostics, but skips Codex cache restore/prefetch/save and secondary
route checks so it does not occupy the release lane longer than necessary.
`bootstrap_only` artifacts are diagnostic-only and cannot be used as
release-ready, owner receipt, or runtime truth evidence.

Release VM gates must write the small critical failure summary
`vm-gate-failure-summary.json` and `vm-gate-failure-summary.md` before uploading
large screenshots, videos, or wrapper bundles. If the large VM artifact is
missing or its upload finalization fails, closeout should classify the evidence
gap as `diagnostic_artifact_missing` and recommend
`rerun_diagnostic_same_artifact`. That rerun must use the same release tag,
direct DMG URL, or `release_artifact_name` plus `release_artifact_run_id`; it is
diagnostic evidence only unless a release workflow explicitly consumes it as a
same-cohort gate.

Scheduled `OPL GUI First-Run VM` runs are maintenance diagnostics, not stable
release evidence. They default to `package_profile=standard` and
`diagnostic_scope=bootstrap_only`; before occupying the self-hosted VM runner
they check whether `OPL Desktop Release` is in progress or queued. If a release
is active, queued, or cannot be checked, the scheduled run exits from the
GitHub-hosted preflight with a skip summary instead of competing with the
release's standard, Full, or Homebrew VM gates.

`run_timeout_ms` and `smoke_timeout_ms` default to 60 minutes, are workflow
inputs, and are passed to `opl-first-run-tart-smoke.mjs` as `--timeout-ms` and
`--smoke-timeout-ms`. The GitHub Actions clean-VM job hard-stops at 75 minutes
so diagnostics and small artifact upload still have room after the guest smoke
budget expires.
`codex_install_phase_timeout_ms` and `codex_readiness_phase_timeout_ms` are
workflow inputs that default to `smoke_timeout_ms` and are passed through as
`--codex-install-phase-timeout-ms` and
`--codex-readiness-phase-timeout-ms`. The Codex install preseed paths are passed
as `--codex-package-tarball` and `--codex-npm-cache-dir`. Enforcement lives in
the active `opl-aion-shell` smoke scripts; the App wrapper owns validating,
forwarding, and recording the configured values. The App first-run matrix
requires Codex install command preview, stdout, stderr, exit code, phase
timings, shell summary timeout fields, and install asset preseed diagnostics
from `tart-smoke-summary.json` or a shell companion diagnostics artifact.
The VM wrapper performs a shallow sparse checkout of the active shell `scripts/`
directory because it executes only the host Tart smoke helper and its
same-directory guest smoke helper. If the active shell smoke depends on other
shell files, widen the checkout and update release-boundary validation in the
same commit.
Stable release VM gates consume same-run DMG-only artifacts
(`macos-build-arm64-dmg` and
`opl-full-first-install-dmg-<version>-mac-arm64`) while publish jobs keep using
the complete build/package artifacts. Do not route Full or Standard publish
through the DMG-only handoff artifact.
For post-release or branch-lane evidence runs that must not publish assets,
pass `release_artifact_name` together with `release_artifact_run_id` so the VM
workflow downloads the DMG-only artifact from that source Actions run through
`actions/download-artifact@v8` with `run-id`. This is an evidence-only handoff;
stable release workflows still use same-run artifacts and published release
gates still use remote verification.
The complete standard macOS build artifact must retain the updater ZIP and ZIP
blockmap; release builds fail closed or rebuild the prepackaged macOS updater
targets when those files are missing.

## Standard Updater

Standard updater metadata is restricted to macOS arm64 standard assets. Full assets must never be written into `latest-arm64-mac.yml` or any deliberate legacy alias, and assets whose names include `Full` are not updater targets.

The standard updater follows Electron's background-download plus visible restart/install model. Download completion is not installation success. The release contract tracks `update_downloaded`, `update_apply_started`, `update_apply_completed`, and `running_version_switched` separately. After restart, the running App version must be greater than or equal to the downloaded target version; otherwise the shell records `auto-update-diagnostics.json#install-not-applied` and exposes a recovery action to install the downloaded update again or reveal the cached package.

The current macOS install path is App-managed local authorization: the ZIP must contain the expected `One Person Lab.app` bundle, the installer replaces the local App bundle, clears quarantine, records `codesign` / `spctl` diagnostics, and relaunches the App. The active-shell gate requires both the local authorized installer path and the post-restart `quit-and-install` / `install-not-applied` diagnostics so a release cannot regress to a download-only success claim.

The standard updater updates OPL App only. It does not mutate OPL Base, OPL
Packages, developer checkouts, WebUI images, Homebrew Formula/global tools,
user artifacts, or domain readiness.

After `running_version_switched`, the App separately requests the Framework-owned
`opl packages update opl-flow --json` transaction once for that downloaded target.
That package transaction refreshes legacy bundled OPL Flow policy and owns conflict
retirement, profile merge, backup, receipt, and rollback; it is not implemented by
the App updater.

## Managed Update Plane

The managed update plane is App consumption of the Framework runner, not an App implementation of the update kernel. The App reads:

```bash
opl update status --json
opl update check --json
opl update plan --json
```

OPL Base bootstrap and OPL Packages execution use owner routes rather than a
public component selector:

```bash
opl-install.sh --headless --skip-packages
opl packages install ... --json
opl packages update ... --json
opl packages repair --package-id <package_id> --json
opl packages uninstall --package-id <package_id> --json
```

The active shell must expose these commands through the OPL runtime bridge, not
through direct file reads or shell-local update logic. The required bridge
surfaces are `opl-runtime.get-managed-update-status`,
`opl-runtime.get-managed-update-check`, `opl-runtime.get-managed-update-plan`,
`opl-runtime.run-managed-update-apply`,
`opl-runtime.run-managed-update-repair`, and
`opl-runtime.run-managed-update-rollback`.

Background maintenance runs after App Core is ready, during daily background
maintenance, and when the user manually checks updates. It must respect the
Framework idempotency lock, use bounded retry/backoff, and project `last_run_at`,
`next_run_at`, `last_failure`, lock status, execution status, recent actions,
skip reasons, and reload guidance into the Updates & Maintenance surface.

`managed_update.components` contains exactly `opl_base`, `opl_app`, and
`opl_packages`. OPL Base may nest only dependency/integration status; OPL App
keeps host update route/executor-required state; OPL Packages may nest only
projection/profile-migration status. Runtime substrate, companion tools, Codex
surface, and workflow profile are internal transaction details, never peer
cards or updater choices. The ordinary App has no component picker and no
public `--component` action. Framework receipts still preserve the detailed
identity, verification, rollback, post-apply sync, and reload guidance needed
for diagnostics and recovery.

Git repo and local checkout package sources are Developer Profile sources only.
They can be detected and shown with clean/dirty/behind/ahead status, but they
are not ordinary `latest` installs and must not be silently updated or
converted by background maintenance.

The App may display component receipt refs, lock/runner status, repair status,
rollback status, post-apply sync status, and reload guidance. It must not read
managed artifact bodies, write runtime/domain truth, create owner receipts,
mutate dirty/developer checkouts, bypass the Framework update kernel, silently
mutate Homebrew/system tools, or claim MAS/MAG/RCA quality/export verdicts.

## Homebrew Distribution Boundary

Homebrew exposes two independent products with aligned semantics: Formula `opl`
installs the headless OPL base, while `one-person-lab`,
`one-person-lab-nightly`, and `one-person-lab-full` Casks install the optional
GUI. Installing a Cask consumes Formula `opl`; installing only Formula `opl`
remains a supported terminal/Codex setup.

Stable standard cask installs use the fully qualified cask ref:

```bash
brew install --cask gaofeng21cn/one-person-lab/one-person-lab
```

This is the user and CI install path under current Homebrew tap trust behavior.
The release VM gate also trusts the standard cask's `conflicts_with` sibling
cask refs, `one-person-lab-full` and `one-person-lab-nightly`, because Homebrew
may load those casks while resolving conflicts. It does not grant broad
`brew trust` approval for the entire tap.

Homebrew does not own App activation, user workspace state, package readiness,
Agent Package distribution, skill/plugin semantics, or domain readiness. Framework
owns Formula/base release truth and App owns Cask/App release truth. After
Homebrew install or upgrade, activation and user-state setup still come from
OPL/App surfaces such as:

```bash
opl system initialize --json
opl install
opl system startup-maintenance
opl packages reconcile
opl connect sync-skills
```

Stable desktop releases update the stable cask only after the promote workflow publishes the complete draft and reads it back as immutable Stable. Published releases are never refreshed in place. Same-owner App release tap writes use direct commits; do not restore tap pull-request mode as a compatibility path.
`release-readiness-admission` reads `release-preflight.outputs.homebrew_tap_update_required`. When preflight says the tap update is required, the stable tap update, the Homebrew standard VM gate, and the Full tap update for Full releases must pass before readiness aggregation. When preflight says the tap update is not required, those Homebrew jobs may be `skipped`; readiness must not fail at the summary stage only because the tap was already current.

## Stable macOS Local Authorization

Stable macOS standard updater releases use App-managed local authorization. Paid Apple Developer ID signing, notarization, and `TeamIdentifier` are optional diagnostics for this lane, not release requirements.

Required local authorization evidence:

- `standard-local-authorization-policy.json` for standard assets.
- `opl-release-manifest.json#evidence.local_authorization_policy` for Full
  assets. Existing releases that still publish `full-local-authorization-policy.json`
  remain accepted during the transition.
- Remote ZIP extraction on a macOS runner.
- Embedded bundle version check.
- `codesign` / `spctl` diagnostics.
- Quarantine clearing evidence for installer/update launch paths.

Gatekeeper rejection is acceptable only when the Stable local authorization policy explicitly records that unsigned/ad-hoc bundles are allowed for the cohort.

## Local Installed App Refresh

When an operator asks to update the local installed macOS App for testing, the default action is to build the current App bundle and replace `/Applications/One Person Lab.app` directly. Do not stop at producing a DMG unless the operator explicitly asks for an installer artifact.

Required local refresh evidence:

- Build the current macOS bundle from the active shell path.
- Quit the running `cn.onepersonlab.opl` App before replacement.
- Replace `/Applications/One Person Lab.app` with the freshly built `.app` bundle.
- Clear quarantine attributes for the replaced bundle when present.
- Verify the installed bundle version, code signature, and installed `app.asar` hash against the build output.
- Launch the installed App and inspect recent App logs for startup/runtime bridge errors.

DMG and ZIP artifacts remain useful release artifacts and checksum inputs, but for local operator testing they are not the activation step. The installed bundle under `/Applications` is the tested surface.

## Full First-Install

Full first-install packaging policy is App-owned, but runtime dependency truth is OPL-owned. The App Full package consumes the OPL runtime bundle manifest, lock, env contract, and readback refs through `opl-release-manifest.json#manifest.opl_runtime_bundle_consumer`; it must not create a second dependency-truth contract. The upstream source surface is OPL Framework `contracts/opl-framework/runtime-environment-substrate-contract.json` and `opl runtime env contract|build|materialize --dry-run|run-context --json` readbacks.

The launch gate is `ready_to_launch` before `/guid`, and Core means workspace root, Codex CLI, and usable Codex model access. A Full first-install package must reach Core ready from bundled runtime on a clean Mac even when Apple Command Line Tools, Homebrew, Node, and Git are absent.

After Core ready, domain modules, Temporal-backed family runtime provider, recommended skills, native helpers, repo sync, module reconcile, CLT installation, companion skills installation, and ecosystem module updates are Full readiness or background maintenance. They cannot block first launch.

Full VM smoke evidence must come from the clean guest after installing the same
Full DMG under review. The accepted evidence is the installed
`/Applications/One Person Lab.app` bundle resources, the guest runtime pointer
and wrapper readback, and live guest `opl system initialize --json` /
`ready_to_launch` output for that installed package. A host `/Applications`
bundle, a developer checkout, a pre-existing runtime pointer, a prebaked Tart
image, Full manifest refs, cache hits, or remote asset presence can provide
provenance or diagnostics only; none of them can replace clean-install installed
App resource/runtime activation evidence.

Full public release assets are the Full DMG install carrier and
`opl-release-manifest.json`. The manifest consolidates the previous separate
Full package manifest, runtime cache events, runtime currentness probe, native
trust, local authorization policy, and package optimization evidence. Existing
releases that still expose those files separately remain accepted by remote
verification during the transition. Full assets are GitHub Release first-install
downloads and explicit stable `one-person-lab-full` cask inputs. They are not
standard updater targets.

The physical App assembly still records legacy layer buckets for cache and size accounting, but those buckets map to the OPL runtime bundle taxonomy:

| Full assembly bucket | OPL runtime bundle layer ids |
| --- | --- |
| `toolchain` | `base-toolchain`, `python-wheelhouse`, `optional-heavy-tools` |
| `opl-runtime` | `opl-framework-runtime` |
| `domain-runtime` | `domain-pack` |
| `skills` | `companion-skills` |

Runtime cache hits prove only reusable assembly inputs for those buckets. A cache hit, manifest file, lock file, successful Full build, or offline kit upload cannot by itself claim App release readiness, runtime dependency truth, OPL family production readiness, domain readiness, or owner acceptance. The consumer boundary is refs-only and must keep required clean-machine offline payloads in the Full package; it cannot use size review or cache reuse to delete required payloads, materialize an OPL runtime root, or claim runtime/App/family readiness.

## Full Size Policy

Release review records compressed DMG size, uncompressed runtime size, top
component/layer contributors, optimization candidates, App-bundle trim evidence,
and package-boundary audit evidence. The remote verifier measures compressed
Full DMG bytes from the GitHub asset size and the uncompressed runtime bytes
from `opl-release-manifest.json#manifest`
`size_breakdown.total_runtime_uncompressed_bytes`.

Current policy values live in
`contracts/app-release-channel.json#full_first_install.size_budget`; policy
semantics, package-profile boundaries, measured records, runtime boundary, and
optimization priority live in
`contracts/app-release-channel.json#full_first_install.size_policy`. The Full
manifest copies the threshold-sized `size_budget` object and the
`opl_runtime_bundle_consumer` boundary. Treat the contract and manifest as the
source for warning/review/runtime thresholds and OPL bundle consumer refs; this
guide records the operator path and measurement boundary.

The current target is still a Full DMG under the `750000000`-byte review
threshold, but the review threshold is not a permission to remove required
offline payloads. A Full package that exceeds it must enter size review and
optimization planning; the uncompressed runtime budget remains the
release-blocking size gate. Do not trade away clean-machine first-install
completeness, bundled Core readiness, or native trust evidence to make the DMG
smaller.

The Full package writes `package_optimization` into
`opl-release-manifest.json#manifest.package_optimization` and carries the trim
report and boundary audit under `#evidence.app_bundle_trim_report` and
`#evidence.package_boundary_audit`. Legacy `full-package-manifest.json`,
`full-app-bundle-trim-report.json`, and `full-package-boundary-audit.json`
release assets are accepted only as transition alternatives. This evidence can
prove explicit non-runtime pruning, payload boundary preservation, and
size-review release decoupling; it cannot replace the same-cohort Full clean VM
smoke, native trust evidence, remote asset readback, or release-owner receipt.
Full DMG warning/review-threshold status alone must not block stable clean
evidence unless a hard size limit, uncompressed runtime limit, offline payload
boundary, native trust, or Full clean VM gate fails.

Full runtime pruning is governed by
`contracts/full-runtime-prune-policy.json`. This is the single machine-readable
source for runtime tree filters, production dependency package filters, Node
toolchain package filters, expected pruned-path assertions, and validation
examples. The build scripts, cache key, Full manifest `runtime_prune_policy`,
runtime assertions, and `npm run release:full:prune-audit -- --markdown` derive
from that contract. Operators should run the prune audit before changing rules;
with `--runtime-root <path>` it reports excluded paths, largest excluded entries,
runtime assertions, and optional baseline diff.

The v26.6.21 measured record in the release contract records:

- Full DMG: `1121919153` bytes.
- Standard DMG: `440471386` bytes.
- Top App bundle contributors: `opl-full-runtime` `745M`,
  `bundled-aioncore` `678M`, `app.asar` `367M`, and Electron Framework `249M`.
- zlib level 9 estimate: `844079932` bytes, still above the `750000000`-byte
  review threshold.

Optimization starts with explicit non-runtime pruning in the staged App bundle
and Full runtime tree: source maps, tests, local caches, tmp/temp directories,
logs, coverage, and package docs/fixtures/examples are removable only when the
report preserves `Contents/Resources/opl-full-runtime`,
`Contents/Resources/bundled-aioncore`, `Contents/Resources/app.asar`, and
Electron framework resources. Duplicate or split runtime-layer review across
`opl-full-runtime` and `bundled-aioncore` remains audit-only until same-cohort
Full clean VM evidence proves offline Core readiness and native trust are
unchanged. Compression tuning is secondary; by the current measurement it cannot
restore the target by itself.

Local review:

```bash
npm run release:full:size -- --markdown
```

Remote diagnosis should prefer the small `opl-full-diagnostics-<version>`
artifact. It includes `full-package-size-summary.json` and
`full-package-size-summary.md`; consume `full_package.size_analysis` in
`release-readiness-summary.json` for final gate review without downloading the
Full DMG. Full workflow telemetry is bottleneck tuning input, not release truth.
`full_runtime_cache` telemetry is the same kind of tuning input: it can explain
package build time and reuse, but it cannot make a release-ready or
runtime-ready claim without the same-cohort release gates and owner-resolution
surface.

Timing review must keep two clocks separate. Do not compare agent orchestration
wall time to GitHub Actions workflow wall time. GitHub Actions workflow wall
time is the release execution KPI; agent orchestration wall time includes
waiting on runs, artifact downloads, local readback, documentation, validation,
commit/push/cleanup, and tool/model round trips.

Track release profiling from the same cohort artifacts instead of reconstructing
it from chat or terminal scrollback:

- `workflow_wall_time_seconds` from GitHub Actions run timestamps: the workflow
  execution KPI.
- `agent_orchestration_wall_time_seconds` from `--agent-wall-time` or
  agent start/finish timestamps: the operator-loop KPI.
- Phase elapsed from job/step timing, `release-monitor.json#state`, and
  `recommended_next_action`: the one-screen blocker and next-action readout.
- DORA-style lead time: first accepted release-cohort SHA freeze to stable/latest
  publication or owner-recorded stop.
- DORA-style MTTR: first same-cohort failed gate or typed blocker to a passing
  same-cohort gate, diagnostic classification, owner resolution, or explicit
  abort.
- DORA-style change failure: same-cohort runs that fail a required gate, become
  stale, need owner-blocker resolution, or publish with post-publish follow-up.

Passing tests, green source gates, or a successful Docker/WebUI publish are
inputs to those metrics. They are not release-ready, stable/latest, runtime
truth, or owner-acceptance claims unless the same-cohort release artifacts and
release-owner refs support that exact claim.

This release flow intentionally folds external CI/CD practice into local owner
surfaces instead of importing a separate release system. DORA-style metrics are
derived only from same-cohort release artifacts; SRE-style monitoring is applied
as a simple no-watch operator readout that names the symptom, primary blocker,
and next action; GitHub Actions job/step timing and timeout boundaries are used
as phase budgets and diagnostics, while release truth remains the candidate
record, owner receipt, and same-cohort evidence.

Every desktop release run now produces the closeout by default in the final
`release-readiness-summary` job. That job writes and uploads
`release-closeout-<version>` with `release-closeout.json` and
`release-closeout.md` after `release-candidate-record.json` is written. The same
artifact also carries `release-monitor.json` and `release-notification.json`.
Use `release:operator status` and `release-monitor.json#state` (`running`,
`failed_gate_draining`, `failed`, `ready_to_promote`, or `published`, with
`published_with_post_publish_followup` when publication is complete but a later
proof gate failed) plus `recommended_next_action` as the no-watch operator
surface instead of leaving a terminal in `gh run watch`. Once a primary blocker
is known, stop watching: source-gate failures should return
`repair_source_gate`; stale cohorts should return `dispatch_new_cohort`; VM or
artifact diagnostic gaps should return a same-artifact diagnostic action. The
closeout reads the same local small
artifacts already used by readiness, runs with `--no-download`, refuses
standard/Full package artifacts, and points the
operator at promotion only after the candidate record passes
`scripts/validate-release-candidate-record.ts --promote-ready`. A candidate
`status=ready_to_promote` without a same-cohort `release_owner_verdict_ref` or
`release_owner_receipt_ref` remains owner-needed: closeout reports the
release-owner typed blocker / owner-resolution action instead of
`promote_from_candidate_record`. Candidate blockers, failed readiness gates, or
raw log inspection are used only after structured evidence is missing or failed.
If a promote workflow publishes the release and then fails a Homebrew VM,
screenshot, docs, or other post-publish proof gate, closeout must classify that
as `resolve_post_publish_followup_gate`; do not conflate the published
GitHub Release/tap state with clean-install proof completion.

Homebrew VM follow-up gates must keep using the same frozen App/Shell/Framework
cohort as the candidate record. The promote workflow reads
`release-candidate-record.json#inputs.framework_ref`, exposes it as a job
output, and passes it to `opl-first-run-vm.yml`. The VM workflow checks out that
Framework SHA, archives it, and passes both `--framework-source-archive` and
`--framework-install-script` to the Tart harness so the guest receives
`OPL_INSTALL_SCRIPT_URL=file://...`. Promotion retries rerun failed jobs in the
same promotion run and reuse the immutable distribution receipt. If workflow
source bytes must change, freeze a new cohort instead of silently combining the
old artifact with updated workflow assumptions. A Homebrew VM failure
that shows packaged `opl-install.sh` falling back to raw GitHub is a workflow
source-boundary defect, not proof that the cask or release assets are invalid.

The standard clean VM smoke is the fail-fast gate for stable release trains. In
standard-only runs, `desktop-release.yml` runs
`standard-first-run-vm-smoke-after-standard-only` immediately after standard
asset publish and before remote verification, Homebrew updates, operator
evidence, or readiness aggregation. When `include_full_package=true` and
`run_vm_smoke=true`, it runs `standard-first-run-vm-smoke-after-full` before
Full package build, Full publish/remote verification, Homebrew updates,
operator evidence, or readiness aggregation. If the standard VM fails, stop at
that diagnostic artifact; the artifact should already include the early
bootstrap/native-modal summaries needed to classify launch blockers. Do not keep
queueing Full, Homebrew, operator evidence, or readiness jobs for the same
cohort.

The local command is the rerun/debug path for the same logic, not a separate
release step:

```bash
npm run release:closeout -- --version <version> --run-id <github-actions-run-id> --artifact-profile diagnostics --agent-wall-time <duration>
```

When run locally, the command writes ignored outputs under
`artifacts/release-closeout/v<version>-<run_id>/`, downloads only final summary
and diagnostic artifacts unless `--no-download` is passed, and can record the
Agent orchestration wall time with `--agent-wall-time <duration>`.

No-watch operator runbook:

1. Read the current run once:

   ```bash
   npm run release:operator -- status --run-id <github-actions-run-id> --expected-head <app-sha> --output release-operator-state.json --markdown release-operator-state.md
   ```

2. Read the closeout monitor when the artifact exists:

   ```bash
   gh run download <github-actions-run-id> --repo gaofeng21cn/one-person-lab-app --name release-closeout-<version> --dir artifacts/release-closeout/v<version>-<github-actions-run-id>
   jq '{state, run: .run, next: .recommended_next_action, failed_gate_count, failed_job_count}' artifacts/release-closeout/v<version>-<github-actions-run-id>/release-monitor.json
   ```

3. Decide from one screen:
   `release-operator-state.json#status` or `release-monitor.json#state` gives
   the current phase (`running`, `failed_gate_draining`, `failed`,
   `stale_candidate`, `ready_to_promote`, `published`, or
   `published_with_post_publish_followup`); `run.workflow_wall_time_seconds` and
   job/step timings give elapsed time; `primary_blocker` or failed gate counts
   name the blocker; `recommended_next_action.action` and
   `recommended_next_action.command` name the next action.

4. Stop watching once the primary blocker or stale cohort is known. Use
   `gh run view --log-failed` only for the named blocker after structured
   state is missing or insufficient; do not keep an unbounded `gh run watch`
   open while downstream jobs drain. If the release process itself needs a fix
   mid-run, explicitly stop or mark the old run superseded before dispatching a
   new pinned cohort after the fix. GitHub Actions same-mode/same-version
   concurrency queues by default; it must not cancel expensive release work
   implicitly. Record the old run as `cancelled` or `superseded`, not as a
   source-gate failure.

Pinned cohort runbook:

1. Sync preparation:

   - Fetch and fast-forward each OPL-family repo that will contribute source,
     then run its cheap owner/source gate.
   - Resolve moving refs to immutable values: App SHA, shell ref plus shell
     SHA, and framework ref plus framework SHA.
   - Stop here for shell type/format/DOM failures, unresolved refs, dirty source
     checkouts, or release-boundary/source-gate failures. These are root causes
     to repair before dispatch, not reasons to start a full release train.

2. Write the cohort lock:

```bash
npm run release:cohort-lock -- --app-ref <app-sha> --shell-ref <shell-ref> --framework-ref <framework-ref> --output release-cohort-lock.json --markdown release-cohort-lock.md
npm run release:cohort-plan -- --version <version> --release-mode new_release --include-full-package true --run-vm-smoke true --output release-cohort-plan.json --markdown release-cohort-plan.md
```

The cohort lock records the immutable App/Shell/Framework SHA tuple. The cohort
plan embeds that lock with the release intent, cheap source gates, and typed
next action. For stable candidates, treat those refs as the frozen candidate
cohort: App SHA, shell SHA, and framework SHA must match all release-ready
evidence and the candidate record. Neither file is release evidence and neither
can publish, promote, or claim readiness.
Use the cohort plan/lock as the source for workflow dispatch inputs. Manual
long-SHA entry is a diagnostic fallback only, not the recommended release path.

3. Dispatch and observe through the controller:

```bash
npm run release:operator -- plan --version <version> --release-mode new_release --include-full-package true --run-vm-smoke true --output release-operator-state.json --markdown release-operator-state.md
npm run release:operator -- status --run-id <github-actions-run-id> --expected-head <app-sha> --output release-operator-state.json --markdown release-operator-state.md
npm run release:operator -- diagnose-vm --version <version> --release-artifact-name <artifact> --release-artifact-run-id <run-id> --package-profile full --diagnostic-scope bootstrap_only --output release-operator-state.json --markdown release-operator-state.md
```

`release:operator` is a controller surface over existing scripts, workflows, and
artifacts. It may emit typed next actions such as
`rerun_diagnostic_same_artifact`, `repair_source_gate`,
`dispatch_new_cohort`, or `promote_candidate`; it must not become release truth,
write runtime/domain truth, or turn a diagnostic rerun into a release-ready
claim. The operator status path is primary-blocker first: after a critical gate
failure it should report `failed_gate_draining` while downstream already-queued
jobs settle, then `failed`, instead of asking the release owner to keep waiting
on `gh run watch`.

4. Handle post-freeze drift, stale, or draining runs:

   - `failed_gate_draining` means the release decision has already stopped on a
     primary blocker while queued jobs finish or artifact upload settles. Wait
     only for cleanup/artifact finalization; do not infer readiness from later
     unrelated job success.
   - `post-freeze drift` means App, shell, or Framework moved remotely after
     the cohort lock. The candidate is still valid only for the frozen cohort;
     it is not closeout-time latest. Choose either owner receipt plus promote
     for that frozen cohort, or freeze a new cohort and rerun desktop release.
   - `stale_candidate` means the run head or pinned source refs do not match
     the cohort lock or the run was superseded by a newer same-version cohort.
     Keep its artifacts as old-cohort diagnostics only. Do not promote it,
     patch it into a newer cohort, or use it as current release evidence.
   - `cancelled` and `superseded` are typed operator outcomes for
     stop-and-redispatch. They preserve old-run diagnostics and failed-run tax,
     but they do not prove a source gate failed.
   - Source-gate blockers are repaired at the source gate. A stale App head,
     unresolved shell/framework ref, wrong shell type/format, dirty source
     checkout, or missing release-boundary policy should lead to
     `repair_source_gate` or `dispatch_new_cohort`, not another broad release
     dispatch.

When a newer same-version cohort supersedes a run, treat the old run as stale.
Its artifacts and logs can remain diagnostic background for the old cohort, but
they cannot be promoted, patched into the new cohort, or reinterpreted as
current release evidence. Re-freeze App/Shell/Framework refs, run the cohort
plan again, and dispatch a new cohort.

Desktop stable, WebUI GHCR, and diagnostics are separate lanes. Desktop stable
owns the App package, updater metadata, Full first-install path, Homebrew gates,
same-cohort candidate record, and stable/latest promotion. WebUI GHCR owns only
the preheated container image publish and image smoke evidence; it does not
replace desktop install evidence or promote a desktop stable candidate.
Diagnostics lanes are read-only or temporary-artifact harness runs for blocker
classification; they can recommend repair or rerun actions but cannot publish,
promote, update Homebrew, or convert old evidence into the current stable
cohort.

For example, Desktop Release run `28391573356` is desktop-stable evidence:
preflight and source gate passed, then the standard clean VM smoke failed and
the workflow fail-fast gate skipped Full, WebUI, Homebrew, evidence, and
readiness jobs. WebUI GHCR run `28391599033` is WebUI/container evidence:
its failure is a Docker/WebUI runtime image publish failure after its own source
gate passed. Do not label that WebUI GHCR failure as an App source-gate failure
or as a desktop stable install blocker unless a same-cohort desktop gate
actually fails.

Use `desktop-release-diagnostics.yml` for harness-only diagnosis before
starting another full release train. It can run the first-run VM harness against
a published `release_tag`, a direct `release_dmg_url`, or a
`release_artifact_name` from an existing `release_artifact_run_id` via
`actions/download-artifact@v8` with `run-id`. That
workflow is read-only: it may upload `release-diagnostics-*` and
`opl-first-run-vm-<profile>-<run_id>` diagnostic artifacts. If explicitly
requested, it may build a temporary standard DMG diagnostic artifact for the VM
harness only. It must not rebuild Full packages, publish releases, update
Homebrew, write owner receipts, or claim release-ready.

## Gate Reuse And VM Base Acceleration

Successful release gates can be considered for reuse only through a small,
auditable decision artifact:

```bash
npm run release:gate-reuse-plan -- --version <version> --release-mode refresh_existing --include-full-package true --run-vm-smoke true --app-commit <sha> --shell-ref <ref> --framework-ref <ref> --current-preflight release-preflight-summary.json --current-remote-verification remote-release-verification.json --previous-candidate-record previous-release-candidate-record.json --previous-readiness previous-release-readiness-summary.json --previous-remote-verification previous-remote-release-verification.json --output release-gate-reuse-plan.json --markdown release-gate-reuse-plan.md
```

The command writes `opl_release_gate_reuse_plan.v1`. A gate becomes
`reuse_allowed` only when the cohort matches on version, release mode,
`include_full_package`, VM-smoke intent, App commit, shell/framework refs,
resolved ref sha, previous promote-ready candidate status, previous passed gate
status, and the remote release asset `{name,size,sha256}` set. It also writes a
stable `reuse_digest` for the exact reuse cohort and evidence inputs.

This artifact does not publish a release, claim release-ready, write runtime
truth, or skip a workflow gate by itself. It is the reviewable input a future
workflow can explicitly consume. Until a workflow has that explicit consumption
step and a real release validates it, unchanged gates may be reported as
reusable but still run.

The same boundary applies to Tart base acceleration. `contracts/app-release-channel.json`
allows pre-baking only host setup layers such as GUI session readiness,
Homebrew prerequisites for the Homebrew profile, Node runtime prerequisites,
and Codex install asset cache seeds. A prebaked image must carry a receipt with
source VM, image digest, profile, prebaked layers, truth boundary, and
validation command. It must not contain `One Person Lab.app`, release DMGs,
Homebrew casks, user workspace state, runtime truth, domain artifact truth, or
owner receipts. The clean App install, first launch, Settings smoke, assistant
route smoke, and release readiness still come from the VM smoke artifact.

This follows the same operational shape used by mature cleanup/cache systems:
Docker prune scopes removal to unused objects, pnpm store prune scopes removal
to unreferenced packages, Hugging Face cache management exposes scan/delete
flows, and Electron separates app data, cache/session, and logs paths instead
of treating all local files as one removable bucket.

No-watch readback:

```bash
gh run view <github-actions-run-id> --repo gaofeng21cn/one-person-lab-app --json status,conclusion,url,updatedAt
gh run download <github-actions-run-id> --repo gaofeng21cn/one-person-lab-app --name release-closeout-<version> --dir artifacts/release-closeout/v<version>-<github-actions-run-id>
jq '.state,.recommended_next_action' artifacts/release-closeout/v<version>-<github-actions-run-id>/release-monitor.json
```

`release-notification.json` is a repo-native notification payload for automation
consumers. It is not a fake push notification service; it mirrors the monitor
state, run URL, artifact name, and recommended next action in a small JSON file.

## Purpose-Based Release Validation

Stable is the complete user-install proof lane. Before a stable App Release is treated as smooth, each required artifact must be classified as `present`, `missing`, `typed_blocker`, or `not_applicable`. Only an all-present verified bundle can set `packaged_app_evidence=true`.

Same-cohort release/user-path refs can support release-owner review. They do not promote stable/latest by themselves, prove domain readiness, prove OPL family production readiness, close MAS/MAG/RCA/OMA owner receipts, or replace App release-owner decision.

The release readiness summary must carry `release_owner_verdict` for the same
cohort. Passing evidence produces `status=release_owner_verdict_pending` and a
`release_owner_typed_blocker_ref` plus `install_evidence_ref` that the App
release owner can consume; missing or blocked evidence produces
`status=release_owner_typed_blocker_required`. Stable promotion requires the
candidate record to carry a same-cohort `release_owner_verdict_ref` or
`release_owner_receipt_ref`; pending, typed-blocker, install-evidence, and
human-gate refs are explicit non-ready states.

For `new_release` and `refresh_existing` runs, the workflow dispatch inputs
`release_owner_verdict_ref` and `release_owner_receipt_ref` are the front-door
owner-resolution path. When the App release owner has already recorded a
same-cohort decision or receipt, pass that ref on the initial run so the final
candidate record can be written as `ready_to_promote` without a separate
refresh. The ref must target the same `v<version>` cohort under
`one-person-lab-app/release-owner/`; cross-cohort refs and missing owner
resolution refs keep the candidate `blocked` with an actionable reason.
`draft_candidate` runs still produce diagnostic-only candidate records even when
they carry owner refs.

The App release workflow only consumes these explicit refs and records them in
the candidate readout. It does not create, infer, or backfill App release owner
receipts, and the readout continues to keep `release_ready_claim=false`,
`stable_latest_promotion_claim=false`, and `family_production_ready_claim=false`
until the promote workflow consumes a valid `ready_to_promote` candidate record.

After an App release-owner receipt is recorded, use
`npm run release:owner-candidate-record:verify` with the ignored small
release-closeout artifacts to rebuild and validate the post-owner candidate
record. When Full or Docker/WebUI evidence is in scope, this verification must
also read `release-addon-readiness-summary-<version>` and require the same-cohort
Full, Docker/WebUI, GHCR, clean-VM, and operator-evidence add-on jobs that the
owner receipt reviewed. This verifies the owner-resolution ref path and reviewed
add-on evidence only; it does not publish the release, mutate updater metadata,
or claim App release ready / OPL family production ready.

When a desktop release run has already produced complete same-cohort evidence
and is blocked only by the release-owner resolution ref, pass
`release_owner_verdict_ref` or `release_owner_receipt_ref` to
`desktop-release-promote.yml`. The promote workflow downloads the original
run's small preflight/readiness/remote-verification artifacts, rebuilds the
candidate record with `npm run release:candidate-record:resolve-owner`, then
runs the normal promote-ready validator before publishing. This avoids a full
desktop release rerun solely for owner-resolution metadata; it does not skip
failed gates, invent owner receipts, or bypass candidate-record validation.
This is the default fast path after owner receipt for a frozen cohort.

`new_release` owns the normal path: draft candidate, same-cohort evidence,
owner receipt, then promote. `draft_candidate` is diagnostic and does not imply
stable/latest. `refresh_existing` repairs only an unpublished draft; after the
complete cohort passes its gates, publish it through the promote workflow.
Published Stable and Nightly releases are immutable and always require a new
version.

AI exploratory release checks are non-blocking. They can provide exploratory triage, summaries, risk hints, or follow-up suggestions, but they are not a release gate and must not block standard, Full, Homebrew, WebUI, updater, or promotion lanes.

## GUI Shell Alternatives

Shell alternative work stays outside the default release adapter until the App release owner deliberately changes `contracts/app-shell-adapter.json`. AionUI is the active GUI mainline, `opl-native-workbench` is the foreground alternative candidate, Hermes Desktop / `hermes-codex` is the prior foreground alternative reference, and AGUI / `agui-codex` is archived technical proof replayed only when AGUI is explicitly requested; neither Hermes nor AGUI is a routine default validation or polish lane. Use `contracts/app-shell-candidates.json`, `contracts/shell-adapters/<candidate>.json`, replay runbooks, shell artifacts, manifests, and validation scripts for technical proof.

Default release packaging continues to use the active adapter. Foreground alternative validation covers `opl-native-workbench` by default:

```bash
npm run validate:shell-candidates
```

Explicit AGUI replay requires both an explicit registry selection and an explicit adapter override:

```bash
npm run validate:shell-candidates -- --candidate agui-codex
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
```

Shell alternative or replay smoke does not imply active-shell adoption, domain readiness, clean-VM readiness, Full-release readiness, or production readiness.

## Local Commands

Release-doc validation:

```bash
npm run validate:release-boundary
npm run test:release-boundary
git diff --check
```

Release asset preparation and validation:

```bash
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
```

Active shell and App-root boundary:

```bash
npm run ensure:shell
node --experimental-strip-types scripts/validate-active-shell.ts --quick
npm run validate:app-root-boundary
npm run validate:gui-shell
```

Install exposure and managed modules:

```bash
npm run validate:agent-installation
```

Full size review:

```bash
npm run release:full:size -- --markdown
```

## Retired Workflow Guard

Do not restore retired release paths as compatibility surfaces:

- Legacy Build and Release as stable channel owner.
- Optional pre-validation `release-evidence-<version>` seed download.
- Homebrew tap pull-request mode for same-owner App release writes.
- Full assets in standard updater metadata.
- Shell package output replacing the App root wrapper.
- Docs-prose release tests that make wording the machine truth.

Retired-surface provenance lives in `docs/history/process/retired-surface-provenance.md`; machine guards live in release validators, workflow tests, and `contracts/app-release-channel.json`.
