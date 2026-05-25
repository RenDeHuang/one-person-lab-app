# One Person Lab App Invariants

Owner: `one-person-lab-app`
Purpose: `app_invariants`
State: `active_truth`
Machine boundary: Human-readable invariants. Machine-readable truth lives in `contracts/`, source, release artifacts, updater metadata, and test results.

- The App repo owns desktop product packaging, release metadata, first-run product policy, App-level contracts, screenshots, user guides, and App validation wrappers.
- The App must not own OPL runtime truth, provider implementation, domain truth, domain quality verdicts, memory body, artifact body, artifact authority, or owner receipt authority.
- `shells/aionui/` remains an external checkout of `gaofeng21cn/opl-aion-shell`; this repo must not merge or vendor AionUI history into the App default branch.
- Standard updater assets and Full first-install assets stay separate. Updater metadata must not select assets whose names include `Full`.
- First-run Core ready can use bundled runtime payloads; repo sync, module reconcile, CLT installation, companion skills, and ecosystem module updates remain background maintenance after Core ready.
- App page-state behavior must consume framework-owned read models and refs-only action routes; it must not infer domain ready, production ready, quality verdict, release ready, or artifact authority from provider completion or UI rendering alone.
- App docs are human-readable navigation and product guidance. Machine decisions must use contracts, source, release artifacts, updater metadata, and test outputs.
