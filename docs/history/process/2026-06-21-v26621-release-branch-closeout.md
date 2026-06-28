# 2026-06-21 v26.6.21 Release Branch Closeout

Owner: `one-person-lab-app`
Purpose: `release_branch_closeout_provenance`
State: `historical_release_provenance`
Machine boundary: Human-readable branch absorption decision record. Current
release truth remains in GitHub Actions runs, release artifacts, owner receipt
records, contracts, scripts, validators, Homebrew tap output, and fresh CI
output.

## Branch Intake

The local branch `codex/v26621-release-closeout-record` carried one historical
documentation commit:

- Commit: `1d533879b1b2df869c4b556098f82dd48b9d4058`
- Subject: `docs(release): record v26.6.21 asset readback gap`
- Files touched: `contracts/app-release-channel.json`,
  `docs/delivery/release/README.md`

The branch recorded a useful distinction: a remote release asset readback can
prove asset currentness and size budget facts, but it cannot close a clean
install release-owner path when VM follow-up gates are still open or failed.

## Early Asset Readback

The branch referenced GitHub Actions run `27892950918` for `v26.6.21` and
captured these asset facts:

- Remote release verification: `passed`
- Verified assets: `14`
- Full DMG asset size: `952924294` bytes
- Standard DMG asset size: `391146571` bytes
- Standard ZIP asset size: `394957934` bytes
- Runtime uncompressed size: `732867151` bytes
- Full DMG size status: `warning`
- Runtime uncompressed budget status: `passed`
- VM closeout status: `post_publish_followup_open`

Those facts were valid for that early cohort, but the run was not a
clean-install closeout or release-owner receipt. Keeping that distinction is
valuable; promoting the old run data into the active release contract after a
later same-version owner receipt would be stale.

## Superseding Owner Receipt

Current `main` carries
`docs/delivery/release/records/v26.6.21-release-owner-receipt.json`, added by
`3c171c5`, for GitHub Actions run `27916440933`. That later same-version
record supersedes the early branch as the active release-owner evidence:

- Desktop release run: `success`
- Preflight: `passed`
- Readiness: `passed`
- Remote verification: `passed`
- Operator evidence bundle validation: `passed`
- Standard clean VM: `passed`
- Full clean VM: `passed`
- Homebrew Standard clean VM: `passed`
- Standard Homebrew tap update: `passed`
- Full Homebrew tap update: `passed`
- Full runtime budget: `passed`
- Full DMG size status: `warning`
- Full DMG size: `970364438` bytes
- Runtime uncompressed size: `742788429` bytes

The owner receipt authorizes the App release-owner resolution ref path for the
release cohort only. It does not claim OPL family production readiness, domain
readiness, domain quality/export readiness, or any domain owner receipt.

## Absorption Decision

The branch commit was not cherry-picked into active contract or release guide
truth because it would reintroduce older run `27892950918` as if it were the
current `v26.6.21` release evidence. The valuable part was preserved here as
historical provenance:

- Keep the rule that release asset verification is not clean-install closeout.
- Keep early run asset numbers as branch-closeout history only.
- Use run `27916440933` owner receipt and release artifacts for current
  `v26.6.21` release-owner evidence.
- Do not use this history file as release-ready, latest/current, runtime-ready,
  domain-ready, or family-production proof.

