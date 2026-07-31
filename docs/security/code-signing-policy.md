# One Person Lab App Code Signing Policy

Free code signing provided by [SignPath.io](https://about.signpath.io/),
certificate by [SignPath Foundation](https://signpath.org/).

SignPath project approval is pending. This policy does not claim that any
existing artifact is signed; signed status is established only by the
per-artifact verification below.

This policy covers Windows artifacts built from the public
[`gaofeng21cn/one-person-lab-app`](https://github.com/gaofeng21cn/one-person-lab-app)
repository. A valid signature identifies SignPath Foundation as the certificate
publisher and binds the signed artifact to a verified GitHub-hosted build of
this project. It does not imply that SignPath Foundation authored the software.

## Project Roles

- Committer and reviewer: [gaofeng21cn](https://github.com/gaofeng21cn)
- Signing approver: [gaofeng21cn](https://github.com/gaofeng21cn)

Changes from contributors who do not have direct commit authority require
review before merge. Every signing request requires an explicit manual approval
from the signing approver. Build success alone never authorizes signing or
publication.

## Source And Build Integrity

- Signing inputs must be produced by a GitHub-hosted runner from the reviewed
  source and build scripts in this repository.
- The unsigned input is uploaded as an immutable GitHub Actions artifact before
  it is submitted to SignPath.
- SignPath verifies the GitHub workflow origin before applying a signature.
- Rerunning an old workflow does not make it a current signing candidate. A new
  candidate must bind fresh source, workflow, artifact, and approval identities.
- No Authenticode private key or exportable certificate is stored in GitHub
  Actions secrets or on a maintainer workstation.

## What We Sign

The project signs only One Person Lab application executables and installers
built from source maintained by this project. Third-party and upstream
open-source binaries may be included in an installer under their own licenses,
but they are not re-signed as if One Person Lab authored them.

Nested project-owned executables are signed before packaging when the artifact
configuration supports it. The final Windows installer is signed and RFC 3161
timestamped after packaging. Authenticode changes executable bytes, so updater
metadata, blockmaps, checksums, manifests, and release receipts must be
generated from and verified against the final signed bytes.

## Verification And Publication

A signed candidate is accepted only when all of the following are true:

1. Windows reports a valid Authenticode signature and timestamp chain.
2. The signer identity matches the approved SignPath Foundation certificate.
3. The signed file digest and size match updater metadata, checksums, manifests,
   and the candidate receipt.
4. The candidate passes the required clean-install and upgrade qualification for
   its release channel.
5. Publication uses a separately authorized, immutable operation. Signing does
   not move Stable, Latest, or any release pointer by itself.

Unsigned, self-signed, expired, revoked, digest-mismatched, or unapproved
artifacts fail closed and must not be represented as production-signed.

## Privacy And User Safety

The [One Person Lab App privacy policy](privacy-policy.md) describes network
transfers, support flows, local data, and official crash-reporting behavior.
Installers must announce system changes and provide an uninstall path. Default
uninstall preserves user projects and separately owned runtime data unless the
user explicitly chooses a documented owner-specific cleanup operation.

## Reporting A Concern

Report project security or signing concerns through
[One Person Lab App issues](https://github.com/gaofeng21cn/one-person-lab-app/issues)
or to `support@signpath.io` when the concern involves a SignPath signature.
Verified policy violations can pause signing and can require certificate or
artifact revocation.

## 中文摘要

Windows 正式签名由 SignPath.io 免费提供签名服务、SignPath Foundation 提供证书。
证书显示的发布者是 SignPath Foundation；每次签名都必须由签名审批人手动批准，且输入必须
来自本仓 GitHub-hosted runner 的可验证构建。项目只签自己的可执行文件和安装器，不把上游
二进制重新签成 One Person Lab 作品。安装器签名后才生成 blockmap、updater metadata、
checksum、manifest 和 receipt；签名本身不授权发布，也不会移动 Stable 或 Latest。
