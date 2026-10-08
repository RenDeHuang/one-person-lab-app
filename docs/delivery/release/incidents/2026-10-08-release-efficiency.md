# Stable 26.10.8 release efficiency review

## Outcome

Stable 26.10.8 and its applicable additional channels reached the public terminal state on 2026-10-08. The first formal dispatch began at 08:53:43 China Standard Time and the final Full owner run completed at 11:42:17, for a wall-clock duration of 2 hours 52 minutes 40 seconds. The last successful continuation consumed 15 minutes 47 seconds after the recovered Full checkpoint was available. This review records the verified causes and the changes made to reduce avoidable recovery time; it does not claim that a future release has already met a shorter duration.

The durable completion record and owner evidence are kept at `/Users/gaofeng/Documents/Codex/2026-10-08/opl-stable-26.10.8/发布完成记录.md`. The successful owner runs were Standard/platform `37717763303`, Docker `37712729418`, Full build `37718189121`, Full recovery `37721725555`, and final Full `37722732356`.

## Critical path observed

| Milestone | China Standard Time |
| --- | ---: |
| First formal dispatch | 08:53:43 |
| Docker public readback | 09:31:58 |
| Standard public readback | 10:28:56 |
| Homebrew Standard | 10:29:56 |
| Linux | 10:34:51 |
| Windows | 10:44:48 |
| Full public readback | 11:41:34 |
| Final Full run success | 11:42:17 |

The initial Standard recovery was blocked by a missing `digestRef` import in the release executor. A later continuation used a 30-minute execution window but validated it as a Standard 90-minute window, so the valid checkpoint was not selected. The first Full VM qualification then spent time in a stale harness path whose fixture did not expose the interface being called. After that path was replaced with an independent package-public CLI probe, the first reload attempt still needed an explicit wait for the launchd job and old PID to disappear. The final probe passed after that lifecycle boundary was made explicit.

The successful Full continuation also restored the same Codex install assets twice: the cache restore took about 46 seconds and the prepared tarball restore took about 83 seconds. These transfers were deterministic overhead on a path where one source was sufficient.

## Changes landed

The release boundary now runs `npm run --silent typecheck:release` before the existing App boundary checks. The new `tsconfig.release.json` covers the release adapter, dispatch, and checkpoint recovery executors, so an undeclared `digestRef`-style error fails before paid build or VM work. The package wrapper remains the exact App boundary command required by the root contract.

The first-run VM workflow restores uploaded prepared tarballs before attempting the reusable runner cache. The cache is restored only when no prepared artifact was supplied or its download step failed. Prepared content is still checked by the existing frozen-cohort SHA-256 preflight, so a successful transport step does not become acceptance evidence.

When both Codex tarballs already match the frozen SHA-256 identities, the preflight script now consumes the frozen metadata directly and records that registry metadata and `npm view` were skipped for `frozen_identity_and_verified_tarballs`. A missing or corrupted tarball keeps the original online metadata, download, digest, and cache path. No HTTP success or fresh registry metadata is fabricated by the offline branch.

The focused workflow tests cover prepared-before-cache ordering, cache fallback conditions, offline reuse with failing fake network tools, and corrupted-tarball recovery. Existing release-boundary and source-gate checks remain the authority for the real workflow path.

## Remaining cost and boundaries

The VM smoke, hosted Full qualification, checkpoint transport, and Full byte materialization still have real costs. The successful continuation measured approximately 186 seconds for clean-VM smoke, 83 seconds for prepared tarballs, 81 seconds for hosted qualification, 59 seconds for publication checkpoint restore, 58 seconds for Full byte materialization, and 48 seconds for checkpoint restore. These steps remain contract-bound and may run in parallel where the workflow already permits it. This change does not replace the signed, notarized, ordinary-account clean-VM, or public readback gates, and it does not introduce a second checkpoint protocol.

Future reviews should compare a complete run against this baseline and keep the exact candidate, source cohort, and owner run identifiers. A passing source gate, cached tarball, or queued dispatch alone is still only evidence for that layer; completion requires the public Stable and additional channel readbacks plus clean-install evidence required by the release contract.
