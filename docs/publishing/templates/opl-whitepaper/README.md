# OPL Whitepaper Template

State: `active`

This template is for formal OPL whitepapers and institution-facing reports.
It uses Quarto source files and a shared OPL style contract instead of a
bespoke JSON/PDF renderer.

Files:

- `template.json`: template identity and active Quarto output settings.
- `styles.scss`: HTML/book theme polish for long-form reports.
- `header.tex`: XeLaTeX/KOMA-Script PDF polish for the current stable PDF path.

Whitepaper projects should keep body content in `.qmd`, citation metadata in
the guide or report manifest, and figures/tables in manifest-tracked assets.
Typst remains the preferred future PDF engine; XeLaTeX is the stable engine
until the OPL Typst template is verified with Chinese long-form content.
