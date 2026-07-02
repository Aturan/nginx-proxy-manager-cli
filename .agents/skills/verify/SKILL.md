---
name: verify
description: 当需要用真实 Nginx Proxy Manager 环境验证本仓库 CLI 时使用，尤其是通过 npm link 验证命令入口、只读命令、证书下载和安全输出。
---

# Nginx Proxy Manager Real Verify

用于真实环境验证 `nginx-proxy-manager` CLI。这个 skill 的重点是安全：验证当前工作区构建出的 linked CLI，不执行真实写操作，不打印凭据，不把证书或配置写进仓库。

## 使用条件

1. 用户明确要求真实环境验证。
   完成标准：请求中出现“真实环境”“link 验证”“下载证书”“验证当前 CLI”等明确意图。
2. 只能验证 CLI，不改变项目目标。
   完成标准：验证对象是 `nginx-proxy-manager` 命令，不启动 Web UI、daemon 或 server。
3. 凭据来源必须已存在或由用户明确提供。
   完成标准：不向仓库写入真实用户名、密码、JWT、token、证书内容或 `.env`。

## 硬性边界

- 必须先运行 `pnpm build`，再运行 `npm link`，验证全局命令指向 linked 版本。
- 默认只运行只读命令：`health`、`schema`、`auth token`、`list`、`get`、`certificates download`。
- 不运行真实写操作：`create`、`update`、`delete`、`enable`、`disable`、`renew`、`upload`。
- 不传 `--yes`，除非用户明确要求真实写操作；即使用户要求，也要先单独确认风险。
- 不打印 JWT、password、token、secret、证书私钥或证书压缩包内容。
- 不读取或修改用户真实 HOME 配置，除非用户明确允许；优先使用 `--config` 指向测试专用配置。
- 下载文件只写入仓库外的临时目录，例如 `mktemp -d` 或 `/tmp`。

## 验证流程

1. 检查工作区状态。
   完成标准：知道当前有哪些未提交文件，确认不会把下载产物混入 git。

```bash
git status --short
```

2. 构建并链接 CLI。
   完成标准：`nginx-proxy-manager --version` 能输出当前包版本，`which nginx-proxy-manager` 指向本机 link 后的命令路径。

```bash
pnpm build
npm link
which nginx-proxy-manager
nginx-proxy-manager --version
```

3. 确认配置来源。
   完成标准：如果使用测试专用配置，所有命令都带 `--config PATH`；如果使用默认配置，用户已明确允许。

4. 运行只读 smoke check。
   完成标准：命令成功，输出中没有 JWT、password、token、secret。

```bash
nginx-proxy-manager --json health
nginx-proxy-manager --json certificates list
nginx-proxy-manager --json proxy-hosts list
```

5. 验证证书下载。
   完成标准：下载目录在仓库外，stdout 只包含元数据，文件权限尽量受限，文件类型是 zip。

```bash
tmp_dir="$(mktemp -d)"
nginx-proxy-manager --json certificates download CERTIFICATE_ID --output "$tmp_dir"
ls -l "$tmp_dir"
file "$tmp_dir"/*.zip
```

不要执行 `cat`、`unzip -p` 或其他会打印证书内容的命令。只允许查看文件名、大小、权限和文件类型。

6. 收尾报告。
   完成标准：报告执行过的命令、是否通过、下载文件路径、残留敏感文件位置；不要粘贴任何凭据或证书内容。

## 失败处理

- 如果命令需要凭据，不要猜测或搜索真实凭据；向用户说明需要测试专用配置。
- 如果输出疑似包含敏感字段，停止继续打印，改为说明发现了敏感输出风险。
- 如果下载文件落到仓库内，停止后续操作并提醒不要提交该文件。
- 如果真实环境返回异常，只报告 HTTP 状态、命令名和脱敏后的错误摘要。

## 安全检查清单

- [ ] 使用的是 `npm link` 后的 `nginx-proxy-manager` 命令。
- [ ] 没有运行真实写操作。
- [ ] 没有打印 JWT、password、token、secret。
- [ ] 没有打印证书或私钥内容。
- [ ] 下载产物位于仓库外。
- [ ] 最终 `git status --short` 中没有新增证书、配置或凭据文件。
