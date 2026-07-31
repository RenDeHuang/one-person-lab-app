# One Person Lab App Privacy Policy

Last updated: 2026-07-31

This policy applies to official One Person Lab App releases published from
[`gaofeng21cn/one-person-lab-app`](https://github.com/gaofeng21cn/one-person-lab-app).
Developer or third-party builds may change the behavior described here and must
publish their own disclosure.

## Local-First Data

One Person Lab App stores projects, prompts, generated files, task state, and
diagnostics on the user's selected machine, workspace, or self-managed service
by default. The One Person Lab maintainers do not receive that content merely
because the App is installed or opened.

## When Data Leaves The Device

The desktop App performs one automatic update check shortly after startup. It
also makes network requests when required by a user-selected service or another
explicit product operation:

- When a user configures and invokes an AI provider, account, connector, remote
  runtime, or collaboration service, the App sends the prompts, files,
  credentials, and operation metadata required by that selected service. The
  service provider's privacy terms and the user's account settings govern that
  processing.
- The startup update check, manual update checks, and downloads contact the
  selected distribution owner, such as GitHub Releases, Homebrew, package
  registries, or container registries. Those services receive normal request
  metadata such as IP address, user agent, and requested artifact.
- A support action can open a prefilled GitHub issue in the user's external
  browser. The user reviews and submits the issue. Official OPL flows do not
  submit it automatically or attach logs, credentials, project content, or
  screenshots automatically.
- Docker/WebUI and other self-hosted routes communicate with the host and
  services selected by the operator. One Person Lab does not operate a required
  hosted data plane for those routes.

## Crash Reports And Feedback

Official GitHub release workflows build the App without a Sentry DSN or Sentry
upload credentials. Therefore official releases do not automatically send
crash reports, a persistent installation identifier, logs, screenshots, or
source maps to Sentry.

The open-source shell retains optional Sentry integration for custom developer
builds. A developer who enables that integration is responsible for a separate
privacy disclosure and user controls. The optional integration can transmit an
anonymous installation identifier, App version, operating system and
architecture, error and stack information, bounded startup/update diagnostics,
and user-submitted feedback. Logs and screenshots are attached only when the
user explicitly selects them in the feedback form.

## Storage, Retention, And Deletion

Local data remains under the user's or operator's control and is retained until
the user deletes it or invokes an owner-provided cleanup action. Uninstalling
the desktop executable does not silently delete projects, task artifacts,
Docker data, or WSL distributions. The applicable install guide explains those
separate retention boundaries.

Data sent to a user-selected third-party service is retained and deleted under
that service's policy and the user's account controls. Public GitHub issues and
release interactions are governed by GitHub's policies.

## No Sale Or Advertising Profile

One Person Lab maintainers do not sell personal data and do not build an
advertising profile from official App usage.

## User Choices

Users can avoid a network service by not configuring or invoking it, can review
support content before submitting it, and can remove local data through the
relevant storage owner. Network-restricted environments can use compatible
local or self-hosted providers where available.

## Changes And Contact

Material privacy changes must be reviewed in this public repository before they
can enter an official release. Questions or reports can be filed through
[One Person Lab App issues](https://github.com/gaofeng21cn/one-person-lab-app/issues).

## 中文摘要

One Person Lab App 默认把项目、提示词、任务状态和产物保存在用户选择的本机、工作区
或自托管服务中。只有用户配置并调用外部 AI 服务、下载/更新来源、连接器或远程运行环境时，
才会向该服务发送完成操作所必需的数据；桌面 App 启动后还会自动执行一次更新检查。
官方 GitHub Release 构建不注入 Sentry DSN，
不会自动向 Sentry 上传崩溃、日志、截图、持久设备标识或 source map。支持入口会在外部
浏览器打开待审核的 GitHub Issue，由用户确认后提交。卸载 App 不会静默删除项目、任务产物、
Docker 数据或 WSL 发行版；这些数据由各自存储 owner 管理。
