# One Person Lab App Project

Owner: `one-person-lab-app`
Purpose: `app_project_boundary`
State: `active_truth`
Machine boundary: Human-readable project boundary. Machine-readable truth lives in `contracts/`, source, release artifacts, updater metadata, and test results.

One Person Lab App is the desktop product repository for One Person Lab. It owns packaging, release assets, updater metadata, user guides, screenshots, first-run checks, App product contracts, and GUI page-state validation.

The App consumes OPL Framework CLI JSON, machine-readable contracts, provider receipts, and domain-owned projections. It does not own OPL runtime truth, provider implementation, MAS/MAG/RCA domain truth, domain quality verdicts, memory body, artifact body, or artifact authority.

The active GUI shell is `aionui`, checked out from `gaofeng21cn/opl-aion-shell` under `shells/aionui/`. Shell implementation history stays in the shell repository; this repository keeps App product, release, contract, testing, screenshot, and user documentation in the App mainline.

Default current status is [status.md](status.md). Documentation entry is [README.md](README.md).
