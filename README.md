# nginx-proxy-manager-cli

用于在命令行管理 Nginx Proxy Manager。

命令入口：

```bash
nginx-proxy-manager
```

## 安装

```bash
pnpm add -g nginx-proxy-manager-cli
```

## 快速开始

```bash
nginx-proxy-manager profile add prod \
  --base_url https://proxy.example.com \
  --username admin@example.com \
  --password "$PASSWORD" \
  --default

nginx-proxy-manager health
nginx-proxy-manager proxy-hosts list
```

写操作默认需要确认。脚本或自动化环境中使用 `--yes`：

```bash
nginx-proxy-manager --yes proxy-hosts create \
  --domain_names app.example.com \
  --forward_scheme http \
  --forward_host app \
  --forward_port 8080
```

复杂请求体使用 `--body-json` 或 `--from-file`：

```bash
nginx-proxy-manager --yes proxy-hosts update 1 \
  --body-json '{"enabled":true}'
```

常规 API 命令优先支持全局 `--json`，方便脚本读取。二进制下载、stream/raw payload 按命令语义处理；使用 `--output` 写文件时，`--json` 可用于输出 `ok`、`output`、`bytes` 等结果元数据。

## 配置

默认配置路径：

```text
$HOME/.nginx-xproxy-manager.json
```

配置路径优先级：

1. `--config PATH`
2. `NGINX_PROXY_MANAGER_CONFIG`
3. 默认配置路径

示例：

```bash
nginx-proxy-manager --config ./npm-config.json proxy-hosts list
```

## Profile

```bash
nginx-proxy-manager profile add
nginx-proxy-manager profile add prod --base_url https://proxy.example.com --username admin --password "$PASSWORD" --default
nginx-proxy-manager profile list
nginx-proxy-manager profile show prod
nginx-proxy-manager profile use prod
nginx-proxy-manager --yes profile remove prod
```

## 命令

认证与健康检查：

```bash
nginx-proxy-manager auth token
nginx-proxy-manager health
nginx-proxy-manager schema
```

Certificates：

```bash
nginx-proxy-manager certificates list
nginx-proxy-manager certificates get 1
nginx-proxy-manager --yes certificates create --body-json '{"provider":"letsencrypt","domain_names":["example.com"]}'
nginx-proxy-manager --yes certificates delete 1
nginx-proxy-manager --yes certificates renew 1
nginx-proxy-manager certificates download 1 --output cert.zip
nginx-proxy-manager certificates download 1 --output ./downloads
nginx-proxy-manager --yes certificates upload --from-file certificate-upload.json
```

Proxy hosts：

```bash
nginx-proxy-manager proxy-hosts list
nginx-proxy-manager proxy-hosts get 1
nginx-proxy-manager --yes proxy-hosts create --domain_names app.example.com --forward_scheme http --forward_host app --forward_port 8080
nginx-proxy-manager --yes proxy-hosts update 1 --body-json '{"enabled":true}'
nginx-proxy-manager --yes proxy-hosts delete 1
nginx-proxy-manager --yes proxy-hosts enable 1
nginx-proxy-manager --yes proxy-hosts disable 1
```

Redirection hosts：

```bash
nginx-proxy-manager redirection-hosts list
nginx-proxy-manager redirection-hosts get 1
nginx-proxy-manager --yes redirection-hosts create --body-json '{"domain_names":["old.example.com"],"forward_domain_name":"new.example.com"}'
nginx-proxy-manager --yes redirection-hosts update 1 --from-file redirection-host.json
nginx-proxy-manager --yes redirection-hosts delete 1
nginx-proxy-manager --yes redirection-hosts enable 1
nginx-proxy-manager --yes redirection-hosts disable 1
```

Streams：

```bash
nginx-proxy-manager streams list
nginx-proxy-manager streams get 1
nginx-proxy-manager --yes streams create --body-json '{"incoming_port":2222,"forwarding_host":"ssh","forwarding_port":22}'
nginx-proxy-manager --yes streams update 1 --from-file stream.json
nginx-proxy-manager --yes streams delete 1
nginx-proxy-manager --yes streams enable 1
nginx-proxy-manager --yes streams disable 1
```
