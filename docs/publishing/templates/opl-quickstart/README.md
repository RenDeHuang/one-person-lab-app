# OPL Quickstart Template

Owner: `one-person-lab-app`
Purpose: `opl_quickstart_template`
State: `active`
Machine boundary: Human-readable template guide. Template machine truth remains in `template.json`, Quarto template assets, publishing generator scripts, validation scripts, generated guide manifests, and release evidence surfaces.

This template is for short setup guides where a full book-style manual is too
heavy. It still uses QMD source, a guide manifest, screenshot manifest when
images are present, and the shared publishing validation path.

Files:

- `template.json`: template identity and active Quarto output settings.
- `styles.scss`: compact HTML styling for quick setup docs.
- `header.tex`: compact XeLaTeX PDF polish for the current stable PDF path.

Quickstarts should stay short, but they should not bypass the QMD/manifest/
screenshot validation model used by full guides.
