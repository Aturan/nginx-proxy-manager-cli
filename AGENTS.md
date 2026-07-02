# AGENTS.md

## 开发约定

- 遵守KISS。
- 写操作必须默认确认，自动化场景使用 `--yes`。
- 所有可运行命令都要有 `--json` 参数保证机器可读。

## 开发流程

使用TDD开发，开发完创建至少一个 Subagent 做 Review ，Review 要做压力测试和对抗测试。

流程:
1. 写失败测试。
2. 写最小模型。
3. Subagent Review and fix loop。
4. 完成需求功能。
5. Subagent Review and fix loop。

## 操作边界

- 不要执行真实环境写操作。
- 连接真实环境时优先运行只读命令。
- 不要读取或修改用户真实 HOME 配置，除非用户明确要求。

## 安全

- 不打印 JWT、密码或 token。
- 不把真实账号、密码或 token 写入仓库。
- 文档和测试只能使用占位值。

## 发布边界

- 不要执行真实 commit、tag、push 或 publish，除非用户明确要求。
