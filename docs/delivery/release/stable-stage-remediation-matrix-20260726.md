# Stable Stage Remediation Matrix

Date: 2026-07-26

This matrix separates the current release recovery operation from permanent
source and process remediation. The current Stable executor may replace a
failed pre-nonce read-only guard or reconcile an already-invoked mutation under
its own authority. It does not wait for this task ref. This task ref performs no
dispatch, rerun, cancellation, approval, release, tag, Latest, VM, or main
mutation.

Classification values are exact:

- `already_fixed_and_absorbed`: the permanent source behavior is present in App
  main at or before `dbdbe9e4`.
- `superseded`: the historical mechanism is no longer a live authority or path.
- `still_open`: source policy exists, but terminal external or owner evidence is
  still required.
- `newly_observed`: the July 26 operation exposed a previously unguarded source
  or controller failure; remediation is implemented on this task ref for later
  fresh-main replay.

| Stage | Historical or fresh failure | Classification | Permanent remediation and evidence boundary |
| --- | --- | --- | --- |
| Immutable cut | Moving App, Shell, Framework, controller, and visual expectations invalidated expensive evidence and caused broad rebuilds. | `already_fixed_and_absorbed` | `5f1978bd` added main-only source qualification, exact App/Shell/Framework receipt binding, and protected Stable admission. `dbdbe9e4` is the frozen App source used by the current operation. |
| Source qualification | Historical validation did not prove the current App product profile against the exact Shell consumer before workflow dispatch. Run `30193145029` exposed `gui.home.home_agent_shortcuts must be a non-empty array` before build/VM. | `newly_observed` | `scripts/validate-shell-product-profile-consumer.ts` archives the exact clean Shell commit into a temporary directory, projects current App bytes, and runs the real Shell consumer test before dispatch. Shell parser repair remains exclusively Shell-owner work. |
| Build | Duplicate or first-match evidence and moving-cohort builds caused rebuilt work and ambiguous critical artifacts. | `already_fixed_and_absorbed` | `3b22ddcc` requires unique critical evidence, exact real-path receipts, and one build per admitted cohort. Source qualification additionally binds `build_invocation_count=1`. |
| Tart qualification | Historic post-public Homebrew VM failures mixed transport/download faults with product launch claims; later attempts repeated broad trains. | `superseded` | The legacy broad promotion train is not a current authority. `5f1978bd` makes one artifact-bound clean Tart qualification part of source qualification, while Bundle qualification and clean-user evidence remain distinct terminal gates. Transport failure cannot be promoted to product failure. |
| Admission | Shared low-level ref API reads and multiple active-run status queries could fail before mutation or admit conflicting work. July 26 observed Shell TLS handshake timeout and Framework unexpected EOF before dispatch. | `newly_observed` | Cross-repo commit/ref API guards are replaced by Git wire identities with at most three attempts per read. Stable admission uses one owner repository workflow-runs query and filters active statuses locally. Pre-nonce failure consumes no nonce and permits only a replacement read-only guard. |
| Credential, signing, notarization | Historical tests and local signing checks were mistaken for provisioned Developer ID/notary authority. | `still_open` | `5f1978bd` absorbed the protected same-run 6/6 secret-name and read-only signing/notary authentication receipt. Only a real protected Stable run can prove credential availability, Developer ID signing, submission, acceptance, stapling, and Gatekeeper; this task ref grants none of that authority. |
| Publication and Latest | Draft/tag/publication state and unsupported Latest readback were conflated; passed build work was discarded after later failures. | `superseded` | Retired App broker/operator paths remain historical. Framework Bundle plus the protected App executor owns publication and Latest. Public non-draft assets, updater metadata, Homebrew, and Latest still require fresh terminal owner readback. |
| Clean user | June Homebrew clean-VM failures included a partial cask download and a later guest-smoke failure without sufficient command diagnostics. | `already_fixed_and_absorbed` | `3b22ddcc` and subsequent Bundle gates require unique real-path clean-user evidence and runtime refresh receipts. A download/TLS fault remains transport evidence and cannot be reported as a credential or product-byte failure. |
| `outcome_unknown` reconciliation | Historical unknown external results were collapsed into absence, enabling duplicate trains. July 26 exact dispatches succeeded, but a local `jq` array/scope expression exited 5 after mutation. | `newly_observed` | `scripts/release-dispatch-guard.ts` parses owner API JSON structurally. One exact match identifies the run; zero, ambiguous, TLS/EOF, or invalid payload stays `outcome_unknown`. Mutation invocation remains 1, retry remains 0, and only read-only reconciliation is legal. |
| Attempt identity and timeout | Run identity was captured by heuristics, polling could continue indefinitely, and resume refreshed practical time budgets. | `newly_observed` | Owner-run extraction binds workflow path, exact App SHA, event, branch, attempt 1, and a maximum 300-second creation window. GitHub reads have at most three transport attempts. Framework operation deadlines remain the live build/publish timeout authority and cannot be refreshed by this guard. |

## Commit Classification

| App commit | Absorbed scope |
| --- | --- |
| `3b22ddcc` | Real-path evidence, unique critical artifacts, build/clean-user/runtime refresh gates. |
| `5f1978bd` | Immutable source qualification, exact cohort receipt, protected admission, diagnostic-only Apple credential preflight, attempt observability. |
| `dbdbe9e4` | Canonical Shell runtime-refresh evidence alignment and the frozen App base for this task ref. |

The 2026-07-18 legacy release mutation broker/operator design is not restored by
this remediation. Its useful invariants survive in the current Framework Bundle
authority: immutable identity, one mutation, bounded observation, durable
unknown-result reconciliation, and absolute operation deadlines.
