# AGENTS.md

## 开发约定

- 遵守KISS。
- 写操作必须默认确认，自动化场景使用 `--yes`。
- 常规 API 命令优先支持全局 `--json`，方便脚本读取。
- 二进制下载、stream/raw payload 按命令语义处理；通常写入 `--output`，需要机器读取时可输出结果元数据。

## 开发流程

使用TDD开发，开发完创建至少一个 Subagent 做 Review ，Review 要做压力测试和对抗测试。

流程:
1. 写失败测试。
2. 写最小模型。
3. Subagent Review and fix loop。
4. 完成需求功能。
5. Subagent Review and fix loop。

自动修 bug 使用 `.agents/skills/fix-bugs/SKILL.md`：先用 `diagnosing-bugs` 复现和修复，跑测试，做 Subagent Review，再用 `verify` 验证真实环境，最后通过 `git-commit-and-push` 提交并推送。

## 操作边界

- 不要执行真实环境写操作。
- 连接真实环境时优先运行只读命令。
- 不要读取或修改用户真实 HOME 配置，除非用户明确要求。
- 真实环境验证使用 `.agents/skills/verify/SKILL.md`，通过 `npm link` 验证当前 CLI，并优先关注安全边界。

## 安全

- 不打印 JWT、密码或 token。
- 不把真实账号、密码或 token 写入仓库。
- 文档和测试只能使用占位值。

## 发布边界

- 不要执行真实 commit、tag、push 或 publish，除非用户明确要求。
- 发布使用 `.agents/skills/release/SKILL.md`，根据提交上下文自动选择 `pnpm release:patch`、`pnpm release:minor` 或 `pnpm release:major`；本地 release 不执行 `npm publish`。
