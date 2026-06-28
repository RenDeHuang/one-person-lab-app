# Screenshots And Visual Guides

Owner: `one-person-lab-app`
Purpose: `app_screenshots`
State: `active`
Machine boundary: Human-readable visual guide index.

This directory is a human-readable index for App visual tutorial material. The
current macOS install guide screenshot source and provenance live under
`docs/user-guides/` in the guide source JSON, asset manifest, generated Marp
source, and generated verification JSON. The clean user-facing guide and
shareable PDF/PPTX live under `docs/public/macos-app-install/`. Do not hand-edit
generated guide outputs or copy their content here as a second source of truth.

Shell-specific source screenshots used by tests may remain under
`shells/aionui/tests/` or the test artifact output directories.

Release evidence screenshots are recorded by the release evidence bundle rather
than treated as `docs/screenshots` content or runtime truth. The required bundle
screenshot paths are:

- `screenshots/runtime.png`: Runtime page operator evidence acceptance view.
- `screenshots/full.png`: Full first-install release path.
- `screenshots/action.png`: Runtime safe action dry-run/execute result view.

The screenshot set proves the App can display OPL-produced refs-only evidence.
It does not make the App the owner of runtime truth, domain truth, artifact
authority, or quality/readiness verdicts.
