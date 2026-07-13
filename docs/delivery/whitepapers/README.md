# Whitepaper Delivery Evidence

Owner: `one-person-lab-app`
Purpose: `app_whitepaper_delivery_evidence_boundary`
State: `active_support`
Machine boundary: Human-readable routing for generated whitepaper evidence. The
source and build profile live in `docs/whitepapers/` and
`contracts/whitepaper_profile.json`; exact artifact and publication truth lives
in generated bundles and GitHub Actions receipts.

Whitepaper verification is generated with the HTML/PDF bundle under the ignored
`docs/site/latest/whitepapers/` directory. Rendered page evidence is generated
under the ignored `tmp/pdfs/opl-app-whitepaper/rendered/` directory. Neither is
tracked on `main`, because a committed verification file can drift away from the
bytes it claims to verify.

The `whitepaper.yml` workflow uploads the immutable candidate bundle and visual
evidence as a run artifact. A manual run with `publish=true` publishes those
same bytes and uploads the post-deployment exact-byte publication receipt. The
Actions artifact and receipt, not this directory, are the publication evidence.
