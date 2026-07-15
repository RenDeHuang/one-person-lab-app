# Screenshots And Visual Guides

Owner: `one-person-lab-app`
Purpose: `app_screenshots`
State: `active`
Machine boundary: Human-readable visual guide index.

This directory is a human-readable index for App visual tutorial material. The
current macOS install guide screenshot source and provenance live under
`docs/delivery/user-guides/macos-app-install/` in the guide source JSON, asset
manifest, generated Marp source, and generated verification JSON. The clean
user-facing guide and shareable PDF/PPTX live under
`docs/site/latest/macos-app-install/`. Do not hand-edit generated guide outputs or
copy their content here as a second source of truth.

Shell-specific source screenshots used by tests may remain under
`shells/aionui/tests/` or the test artifact output directories.

Release evidence screenshots are recorded by the release evidence bundle rather
than treated as guide screenshots or runtime truth. The required bundle
screenshot paths are:

- `screenshots/runtime.png`: minimal Runtime Work Item / Stage / Attempt / Token visual acceptance view.
- `screenshots/full.png`: Full first-install release path.
- `screenshots/action.png`: Settings Maintenance action confirmation/result view; raw diagnostic refs remain under its diagnostics disclosure.

The screenshot set proves the App can display OPL-produced refs-only evidence on
the correct owner surfaces. Runtime visual evidence does not include full
drilldown, safe-action catalogs, provider repair, software update controls, or
operator receipts.
It does not make the App the owner of runtime truth, domain truth, artifact
authority, or quality/readiness verdicts.
