---
name: nginx-proxy-manager
description: 当用户要使用 nginx-proxy-manager CLI 管理 Nginx Proxy Manager，包括配置 profile、读取资源、下载证书或执行写操作时使用；重点处理凭据、token、证书和真实环境写操作风险。
---

# Nginx Proxy Manager

使用 `nginx-proxy-manager` CLI 管理 Nginx Proxy Manager。这个 skill 面向 CLI 使用，不面向源码开发；重点是安全地选择配置、区分只读命令和写操作，并避免泄漏凭据或证书内容。

## 前置条件

1. 用户要运行 `nginx-proxy-manager`。
   完成标准：任务是配置 profile、检查连接、读取资源、下载证书或管理资源。
2. 命令可能连接真实环境。
   完成标准：已判断命令是否只读；写操作必须获得用户明确同意。
3. 任务可能涉及凭据、token、证书或配置文件。
   完成标准：不打印敏感内容，不把敏感文件写入当前仓库。

## 配置来源

配置路径优先级：

1. `--config PATH`
2. `NGINX_PROXY_MANAGER_CONFIG`
3. `$HOME/.nginx-xproxy-manager.json`

真实环境优先使用测试专用配置：

```bash
nginx-proxy-manager --config /path/to/config.json profile list
```

不要在未获允许时读取或修改用户真实 HOME 配置。profile 会保存 `base_url`、`username`、`password`、缓存 token 和 token 过期时间。配置文件属于敏感文件。

## 只读优先

连接真实环境时先运行只读命令：

```bash
nginx-proxy-manager --json health
nginx-proxy-manager --json certificates list
nginx-proxy-manager --json proxy-hosts list
nginx-proxy-manager --json redirection-hosts list
nginx-proxy-manager --json streams list
```

只读命令包括：

- `health`
- `schema`
- `auth token`
- `list`
- `get`
- `certificates download`

完成标准：只读命令成功，输出中没有 JWT、password、token、secret 或证书内容。

## 写操作边界

写操作包括：

- `create`
- `update`
- `delete`
- `enable`
- `disable`
- `renew`
- `upload`

写操作默认需要确认。只有自动化场景才使用 `--yes`。对真实环境执行写操作前，必须和用户确认目标资源、操作类型和影响范围。

示例：

```bash
nginx-proxy-manager --yes proxy-hosts update 1 --body-json '{"enabled":true}'
```

完成标准：用户已授权写操作，命令目标和请求体已核对，输出不包含敏感字段。

## Profiles

新增 profile：

```bash
nginx-proxy-manager profile add prod \
  --base_url https://proxy.example.com \
  --username admin@example.com \
  --password "$PASSWORD" \
  --default
```

如果 `profile add` 缺少必填值，CLI 会交互式提问。不要把真实密码写入仓库文件、日志或最终回复。

常用命令：

```bash
nginx-proxy-manager profile list
nginx-proxy-manager profile show prod
nginx-proxy-manager profile use prod
nginx-proxy-manager profile remove prod
```

`profile show` 应只展示脱敏后的凭据。如果输出包含明文密码或 token，停止操作并报告安全风险。

## 复杂请求体

浅层数据直接使用 REST API 字段名：

```bash
nginx-proxy-manager --yes proxy-hosts create \
  --domain_names app.example.com \
  --forward_scheme http \
  --forward_host app \
  --forward_port 8080
```

嵌套对象使用 `--body-json` 或 `--from-file`：

```bash
nginx-proxy-manager --yes proxy-hosts update 1 --body-json '{"enabled":true}'
nginx-proxy-manager --yes redirection-hosts update 1 --from-file redirection-host.json
```

完成标准：请求体不包含真实 secret。从文件读取时，确认文件不是 `.env`、真实配置或私钥文件。

## 证书下载

证书下载是只读命令，但下载产物敏感。优先写到仓库外临时目录：

```bash
tmp_dir="$(mktemp -d)"
nginx-proxy-manager --json certificates download 15 --output "$tmp_dir"
```

当 `--output` 是目录时，CLI 会按证书域名生成 zip 文件名：

```text
*.example.com -> cert_example_com.zip
```

可以检查文件名、大小、权限和文件类型：

```bash
ls -l "$tmp_dir"
file "$tmp_dir"/*.zip
```

不要运行会打印证书内容的命令，例如 `cat` 或 `unzip -p`。不要把证书 zip 放进仓库或提交。

## 输出和脱敏

常规 API 命令优先使用 `--json`，方便脚本读取。二进制下载、stream 和 raw payload 按命令语义处理。如果文件写到 `--output`，`--json` 只应输出结果元数据。

永远不要在回复里粘贴：

- JWT
- password
- token
- secret
- 私钥
- 证书压缩包内容
- 真实配置文件内容

如果命令输出疑似包含敏感内容，停止引用原文。只报告字段类别和风险。

## 失败处理

- 认证失败：不要猜测凭据；让用户检查测试专用配置。
- 需要 2FA：CLI 不支持 2FA；建议使用未启用 2FA 的专用账号。
- 写操作缺少确认：不要自动补 `--yes`，除非用户明确要求自动化写操作。
- 下载文件落到仓库内：提醒用户不要提交，并建议移动到仓库外。
- API 返回错误：报告命令、HTTP 状态和脱敏后的错误摘要。

## 完成报告

只报告：

- 配置来源；必要时写路径，不写文件内容。
- 命令类别：只读、写操作或证书下载。
- 成功或失败结果。
- 下载路径、大小和文件类型；不包含证书内容。
- 需要用户处理的安全风险。
