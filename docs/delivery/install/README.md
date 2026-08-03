<p align="center">
  <strong>English</strong> | <a href="./README.zh-CN.md">中文</a>
</p>

# One Person Lab Installation Guide

Choose the product surface and payload density first. You do not need to
understand the release channels before getting started.

| I want | Choose |
| --- | --- |
| A standalone window, system menu, and desktop integration | Desktop |
| The workbench in a browser | WebUI |
| A server, NAS, or isolated deployment | WebUI, usually with the Container carrier |
| A smaller initial download that converges online | Standard |
| Offline Base and Package seeds included | Full |
| Only the command line and runtime foundation | Headless |

Desktop/WebUI and Standard/Full are independent choices. Together they form
four supported product cells: Desktop Standard, Desktop Full, WebUI Standard,
and WebUI Full. Native and Container are internal WebUI carriers, not separate
products. The matrix does not prove that a specific platform build is publicly
available or installed; confirm that from the selected Release and installation
readback.

## Unified Release Installer

Start from a GitHub Release that contains `opl-install.sh`. macOS and Linux use
the same version-frozen entry point. Do not pipe a mutable script from `main`
directly into a shell.

```bash
VERSION=<release-version>
BASE="https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${VERSION}"

curl -fLO "${BASE}/opl-install.sh"
curl -fLO "${BASE}/opl-app-component-manifest.json"

EXPECTED="$(
  jq -r '.artifacts[] | select(.name == "opl-install.sh") | .digest | sub("^sha256:"; "")' \
    opl-app-component-manifest.json
)"
if command -v shasum >/dev/null 2>&1; then
  ACTUAL="$(shasum -a 256 opl-install.sh | awk '{print $1}')"
else
  ACTUAL="$(sha256sum opl-install.sh | awk '{print $1}')"
fi
test -n "$EXPECTED" && test "$ACTUAL" = "$EXPECTED"

chmod 0755 opl-install.sh
./opl-install.sh
```

Product routing:

```text
personal             -> Desktop or WebUI + Standard (default) or Full (explicit)
server / isolated    -> WebUI + Standard (default) or Full (explicit)
payload density      -> available only when the exact platform manifest exposes it
WebUI carrier        -> Native or Container, selected from the exact platform manifest
--headless           -> OPL Base only
```

The current public entry points select the product surface with:

```bash
./opl-install.sh --desktop
./opl-install.sh --webui
./opl-install.sh --headless
```

`--desktop` and `--webui` select the surface. The current macOS Stable carrier
selects density through `--stable-macos-install --standard|--full`. Other
platforms may select a cell only when that exact Release manifest exposes it;
otherwise the installer must fail closed. Native/Container compatibility flags
are advanced WebUI deployment controls and do not create additional product
surfaces. The installer resolves platform assets and digests from the exact
Release manifest, never from a mutable `latest` reference or a historical
version copied from documentation.

Direct macOS Release installation first reads the GitHub Release API
anonymously. If that request fails, including an HTTP 403 rate-limit response,
the installer may use `gh api` only when the local `gh` command exists and
`gh auth` already has an authenticated `github.com` session. The fallback reads
the same requested `latest` or exact tag; it never changes versions or skips
digest verification. Without the GitHub CLI or valid authentication, the
installer fails closed before any download or target App change.

## Supported Product Matrix

| Product surface | Standard | Full |
| --- | --- | --- |
| Desktop | The shared Desktop experience; converges to the Official Profile online | The same Desktop experience with additional offline seeds |
| WebUI | The shared WebUI experience; converges to the Official Profile online | The same WebUI experience with additional offline seeds |

These four cells are the supported product contract, not a catalog of currently
published assets. Before installation, confirm that the target Release's
component manifest and owner readback expose the exact platform carrier,
qualification, and digest for the selected cell. A missing cell must be reported
as unavailable; success from another surface, density, or historical carrier is
not evidence that the requested installation completed.

## WebUI Carriers

Native runs WebUI directly on the host. Container runs WebUI in OCI isolation.
Both expose the same WebUI product behavior and Official Profile, while using
different directories, service managers, mounts, and update adapters. Carrier
selection does not change Standard/Full and does not turn WebUI into two
products.

## Homebrew

Current Homebrew entry points:

```bash
# macOS Desktop
brew install --cask gaofeng21cn/one-person-lab/one-person-lab

# OPL Base/CLI on macOS or Linux
brew install gaofeng21cn/one-person-lab/opl
```

Homebrew also runs on Linux, but a Cask carries a macOS App bundle, so the
current Desktop Cask cannot be installed on Linux. A future
`one-person-lab-webui` Formula could consume the same frozen Native payload from
the GitHub Release; it is an approved direction, not a currently implemented
installation path.

## Update Ownership

| Installation | Update owner |
| --- | --- |
| Desktop Standard / Full | The selected Desktop carrier; Full does not enter Standard updater metadata |
| WebUI Standard / Full | The selected WebUI carrier; Native/Container report only their own installed state |
| OPL Base / Packages | Framework managed update |

Standard and Full describe payload density on both Desktop and WebUI; they are
not separate update channels. Native and Container are WebUI carriers, not
separate products.

For product and maintenance boundaries, see the
[`distribution-and-install-ssot.md`](../distribution-and-install-ssot.md).
