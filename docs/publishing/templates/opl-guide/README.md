# OPL Guide Template

Owner: `one-person-lab-app`
Purpose: `opl_guide_template`
State: `active`
Machine boundary: Human-readable template guide. Template machine truth remains in `template.json`, Quarto template assets, publishing generator scripts, validation scripts, generated guide manifests, and release evidence surfaces.

This template is for beginner screenshot guides, including install manuals and
first-run onboarding documents. It keeps body content in `.qmd`, guide metadata
in JSON manifests, screenshot provenance in `screenshots.manifest.json`, and
HTML/PDF styling in shared Quarto template files.

Files:

- `template.json`: template identity and active Quarto output settings.
- `styles.scss`: HTML/book styling for screenshot-heavy guides.
- `header.tex`: XeLaTeX/KOMA-Script PDF polish for the current stable PDF path.

Typst remains the preferred future PDF engine; XeLaTeX is the stable engine
until the OPL Typst template is verified with Chinese screenshot guides.
