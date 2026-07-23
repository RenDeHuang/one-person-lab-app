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

App `main` has no whitepaper publication workflow or write token. Build and
inspect the App profile locally with `npm run docs:whitepaper`. Public App
whitepaper updates remain blocked until the Framework owner provides a protected
cross-repository publisher that binds the exact App source and target repository
without widening App `main` permissions. Only that publisher's artifact and
post-deployment exact-byte receipt, not this directory or an App push check,
would be publication evidence.
