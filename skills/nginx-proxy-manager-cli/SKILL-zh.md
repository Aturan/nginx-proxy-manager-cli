---
name: nginx-proxy-manager-cli
description: 当处理本仓库的 Nginx Proxy Manager npm CLI 时使用，包括命令、profile、测试、release 流程或凭据安全变更。
---

# Nginx Proxy Manager CLI

处理 `nginx-proxy-manager-cli` 仓库时使用此技能。

## 契约

构建并维护公开 npm CLI `nginx-proxy-manager`。CLI 管理 Nginx Proxy Manager API 资源和本地 profiles。完成标准是变更保留命令名、TypeScript + pnpm 设置、测试、release 流程和凭据安全规则。

## 前置条件

1. 只在仓库内工作。
   完成标准：所有编辑文件都位于项目根目录下。
2. 修改代码或文档前阅读 `AGENTS.md`。
   完成标准：已确认中文、TDD、测试、e2e、安全和 release 边界。
3. 不使用真实凭据。
   完成标准：示例和测试只使用占位值或 mock 服务。

## 配置

CLI 配置路径优先级：

1. `--config PATH`
2. `NGINX_PROXY_MANAGER_CONFIG`
3. `$HOME/.nginx-xproxy-manager.json`

profile 保存 `base_url`、`username`、`password` 和默认 profile 元数据。请求 `/tokens` 时，HTTP client 会把 `username/password` 映射为 API schema 要求的 `identity/secret`。文件系统支持时，配置写入应使用 `0600`。

## 只读/写操作边界

只读命令是 `health`、`schema`、`auth token`、`list`、`get`、schema 读取和 `certificates download`。

写操作命令是 `create`、`update`、`delete`、`enable`、`disable`、`renew` 和 `upload`。写操作默认需要确认，并支持 `--yes` 用于自动化。不要对真实内网服务运行写命令。

## 工作流

1. 先写或更新失败测试。
   完成标准：新增行为已由 unit 或 integration 测试覆盖。
2. 实现最小匹配代码变更。
   完成标准：命令行为和 API 请求形状匹配测试与现有模式。
3. 保留 REST 字段名作为 CLI flag。
   完成标准：`domain_names`、`forward_scheme`、`forward_host`、`forward_port` 等用户可见 flag 未改成 camelCase。
4. 浅层请求数据优先使用字段 flag，嵌套请求体使用 `--body-json` 或 `--from-file`。
   完成标准：新示例和命令选项使用 `--body-json`，不使用 `--data-json`。
5. 检查输出安全。
   完成标准：JWT、密码、token-like 字段和 API `secret` 字段被脱敏或不会被打印。
6. 运行相关 gate。
   完成标准：至少运行受影响测试；交付前运行 `pnpm lint`、`pnpm typecheck`、`pnpm test` 和 `pnpm build`。

## 常用命令

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CLI smoke check：

```bash
node dist/cli.js --help
node dist/cli.js profile --help
node dist/cli.js proxy-hosts --help
```

需要检查真实环境时，必须使用测试专用 config，并优先运行只读命令。

## 凭据安全

不要提交真实用户名、密码、JWT、npm token 或 GitHub token。`auth token` 不能打印 JWT。测试不能读取或修改用户真实 HOME 配置。
