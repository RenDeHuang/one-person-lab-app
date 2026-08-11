<p align="center">
  <strong>English</strong> | <a href="./README.zh-CN.md">中文</a>
</p>

# One Person Lab Installation Guide

Choose where One Person Lab will run. You do not need to understand the release
pipeline first:

| Need | Install path | Current carrier |
| --- | --- | --- |
| Use One Person Lab on a personal computer | Desktop | macOS arm64 DMG/Homebrew, Linux x64 DEB, or Windows x64 EXE |
| Use the same Desktop in a browser on macOS or Linux | Built-in Desktop WebUI | The same Desktop package started in browser mode |
| Deploy to a server, NAS, or isolated environment | Docker WebUI | Independent GHCR container product line |
| Install only the command line and runtime foundation | Headless | OPL Framework Base without the App |

`Standard` and `Full` are Desktop payload densities, not update channels. Only
macOS arm64 currently publishes both Standard and Full. Linux x64 and Windows
x64 use their own same-tag Desktop assets. Docker WebUI has independent versions
and GHCR pointers; it does not inherit version, qualification, or update state
from Desktop Stable.

On macOS arm64, both Standard and Full install, register, and enable the same
KimiCU Computer Use provider by default. Standard downloads the pinned archive
during managed setup; Full includes that exact archive as an offline seed. With
network available and installation complete, their Computer Use version, path,
MCP tools, permissions, and behavior are identical. Full adds offline density,
not a second provider. macOS still requires the user to grant Accessibility and
Screen Recording; before that, Computer Use reports permission required while
the rest of OPL remains usable.

## Current Stable Desktop Release Set

Each Stable version has one GitHub Release and one `v<version>` tag. The same
tag may contain:

- `One-Person-Lab-<version>-mac-arm64.dmg`: macOS Standard;
- `One-Person-Lab-Full-<version>-mac-arm64.dmg`: macOS Full, appended after Standard when available;
- `One-Person-Lab-<version>-linux-x64.deb`: Linux x64 Desktop;
- `One-Person-Lab-<version>-win-x64.exe`: Windows x64 Desktop;
- `opl-install.sh`, component and Desktop platform manifests, and platform updater metadata.

[Open the current Latest Release](https://github.com/gaofeng21cn/one-person-lab-app/releases/latest)

An asset on the Release proves only that the public carrier contains those exact
bytes. Installation, first launch, WSL2/Framework runtime, and real model access
still require readback from the target machine.

## macOS arm64

For users who already have Homebrew, Standard is the shortest path:

```bash
brew install --cask gaofeng21cn/one-person-lab/one-person-lab
open -a "One Person Lab"
```

Without Homebrew, download the Standard DMG from the current Release. Choose the
same-tag Full DMG only when a new or offline machine needs preloaded Base and
Package seeds. Full creates no separate Release and never enters Standard
updater metadata.

[macOS first-install guide](https://gaofeng21cn.github.io/one-person-lab-app/latest/macos-app-install/macos-app-install.html)

Direct macOS Release installation first reads the GitHub Release API
anonymously. If that request fails, including an HTTP 403 rate-limit response,
the installer may use `gh api` only when the local `gh` command exists and
`gh auth` already has an authenticated `github.com` session. The fallback reads
the same requested `latest` or exact tag; it never changes versions or skips
digest verification. Without the GitHub CLI or valid authentication, the
installer fails closed before any download or target App change.

## Linux x64

Linux uses the `.deb` and `opl-install.sh` from the same Stable tag. After
downloading and verifying the Release installer:

```bash
./opl-install.sh --desktop --standard --no-open
```

To expose that same Desktop from a headless host through its built-in WebUI:

```bash
./opl-install.sh --webui --standard --no-open
```

Here `--webui` starts the WebUI packaged in the Desktop bytes. It is not the
retired standalone Native WebUI tarball and does not switch to Docker. Linux
Full is not currently published; an explicit `--full` request must stop rather
than selecting another version or platform.

## Windows 11 x64

Download `One-Person-Lab-<version>-win-x64.exe` from the same Stable Release and
verify it against the published digest. Windows Desktop does not require Docker
Desktop; Docker is needed only when the user explicitly chooses Container WebUI.

[Windows x64 install and configuration guide](https://gaofeng21cn.github.io/one-person-lab-app/latest/windows-app-install/windows-app-install.html)

Publication of the Windows asset does not prove WSL2 runtime acceptance,
installed behavior, code signing, or completed platform support. The guide
shows the current exact version, SHA-256, and signing status.

## Docker WebUI

Use the independent Docker WebUI for a server, NAS, cloud VM, or container
isolation. Ordinary installation follows
`ghcr.io/gaofeng21cn/one-person-lab-webui:stable`; `:latest` is an explicit
Preview choice and is never selected silently by ordinary install or automatic
updates.

[Docker WebUI install guide](https://gaofeng21cn.github.io/one-person-lab-app/latest/docker-webui-install/docker-webui-install.html)

## Latest Public Installer

macOS and Linux can use `opl-install.sh` from the current Latest Release. Do not
pipe a mutable `main` branch script directly into a shell. The installer resolves
Latest to one exact Release before it selects platform assets:

```bash
BASE="https://github.com/gaofeng21cn/one-person-lab-app/releases/latest/download"

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
```

The public installer resolves platform assets, sizes, and digests from the exact
Release selected by Latest. Missing, duplicate, or mismatched identities must
stop installation instead of selecting another tag, historical file, or
unbound download URL.

## Headless And Update Ownership

`--headless` installs OPL Framework Base/CLI only. Headless automation should
use the [OPL Framework installation instructions](https://github.com/gaofeng21cn/one-person-lab#installation),
not a Desktop or Docker WebUI guide.

| Installed object | Update owner |
| --- | --- |
| Desktop App | The selected Desktop carrier; Full continues on the Standard update path |
| Docker WebUI | The Docker WebUI host installer or administrator, following `:stable` by default |
| OPL Base / Packages | Framework and each configured Package carrier |

For maintainer-facing product boundaries, see
[`distribution-and-install-ssot.md`](../distribution-and-install-ssot.md).
