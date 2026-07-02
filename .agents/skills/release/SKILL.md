---
name: release
description: 当用户要求发布版本时使用；根据当前提交上下文自动选择 pnpm release:patch、pnpm release:minor 或 pnpm release:major，并让 GitHub tag workflow 发布 npm。
---

# Release

用于本仓库发布版本。发布动作在本地执行 release-it：更新版本号、更新 `CHANGELOG.md`、创建 release commit、打 tag、push branch 和 tag。npm 发布由 GitHub tag workflow 完成，不在本地执行 `npm publish`。

## 使用条件

1. 用户明确要求 release 或发布。
   完成标准：请求中出现“release”“发布”“发版”等明确意图。
2. 工作区必须干净。
   完成标准：`git status --short` 没有未提交内容；否则先停止，让用户决定是否提交或丢弃。
3. 当前分支可以发布。
   完成标准：知道当前分支、upstream、最新 tag 和 tag 之后的提交。

## 上下文读取

先读取发布上下文：

```bash
git status --short --branch
git describe --tags --abbrev=0
git log --oneline --decorate "$(git describe --tags --abbrev=0)..HEAD"
git log --format=%B "$(git describe --tags --abbrev=0)..HEAD"
```

完成标准：知道最新 tag 之后有哪些提交，以及是否存在 breaking change、feature、bug fix 或只有维护类提交。

## 自动选择规则

按以下优先级选择一个脚本：

1. `pnpm release:major`
   条件：提交信息包含 `BREAKING CHANGE:`，或 Conventional Commit type/scope 后带 `!`。
2. `pnpm release:minor`
   条件：没有 major 条件，但存在 `feat` 提交。
3. `pnpm release:patch`
   条件：没有 major/minor 条件，但存在 `fix`、`perf` 或其他需要发布的变更。
4. 不发布
   条件：最新 tag 之后没有提交，或只有 release commit，或上下文无法判断是否应发布。

如果只能判断为维护类提交，例如 `docs`、`test`、`build`、`ci`、`chore`、`refactor`，默认选择 `pnpm release:patch`，除非这些提交只是 release/changelog 自动生成内容。

## 发布流程

1. 确认 release 脚本。
   完成标准：已经按上下文选择出 `release:patch`、`release:minor` 或 `release:major`，并能说明原因。

2. 运行选择出的脚本。
   完成标准：release-it 完成版本更新、changelog 更新、release commit、tag 和 push。

```bash
pnpm release:patch
pnpm release:minor
pnpm release:major
```

只运行其中一个。不要运行 `pnpm release`，因为它只是提示选择具体脚本。

3. 检查发布结果。
   完成标准：本地 HEAD 是 release commit，最新 tag 指向期望版本，working tree 干净。

```bash
git status --short --branch
git describe --tags --abbrev=0
git log -1 --oneline
```

4. 提醒 GitHub 发布 npm。
   完成标准：说明 tag workflow 会安装依赖、lint、typecheck、test、build，然后通过 Trusted Publisher 发布 npm。

## 安全边界

- 不执行 `npm publish`。
- 不读取或打印 `NPM_TOKEN`、GitHub token、npm token。
- 不使用 `--no-verify`。
- 不 force push。
- 不在工作区有未知变更时发布。
- release commit message 可以是 `chore(release): v版本号`，不需要进入 changelog。
- 如果 release-it 的测试或 build 失败，停止并报告失败命令，不继续 tag 或 push。

## 输出要求

收尾时报告：

- 选择的 release 脚本和选择原因。
- 新版本号和 tag。
- release commit。
- 是否已 push branch 和 tag。
- GitHub npm 发布 workflow 是否仍需观察。
