---
name: nginx-proxy-manager
description: Use when the user wants to operate the nginx-proxy-manager CLI to manage Nginx Proxy Manager, including profiles, read-only resource checks, certificate downloads, or write operations; focus on credential, token, certificate, and real-environment safety risks.
---

# Nginx Proxy Manager

Use the `nginx-proxy-manager` CLI to manage Nginx Proxy Manager. This skill is for operating the CLI, not for changing its source code. Its main job is to choose the right config, separate read-only commands from write operations, and avoid leaking credentials or certificate material.

## Preconditions

1. The user wants to run `nginx-proxy-manager`.
   Completion criterion: the task is profile setup, connectivity checks, resource reads, certificate downloads, or resource management.
2. The command may touch a real environment.
   Completion criterion: you know whether the command is read-only; write operations require explicit user approval.
3. The task may involve credentials, tokens, certificates, or config files.
   Completion criterion: sensitive content is not printed, and sensitive files are not written into the current repository.

## Config Source

Config path priority:

1. `--config PATH`
2. `NGINX_PROXY_MANAGER_CONFIG`
3. `$HOME/.nginx-xproxy-manager.json`

Prefer a test-specific config for real environments:

```bash
nginx-proxy-manager --config /path/to/config.json profile list
```

Do not read or modify the user's real HOME config unless the user allows it. A profile stores `base_url`, `username`, `password`, cached token, and token expiry. Treat the config file as sensitive.

## Read-Only First

When connecting to a real environment, start with read-only commands:

```bash
nginx-proxy-manager --json health
nginx-proxy-manager --json certificates list
nginx-proxy-manager --json proxy-hosts list
nginx-proxy-manager --json redirection-hosts list
nginx-proxy-manager --json streams list
```

Read-only commands include:

- `health`
- `schema`
- `auth token`
- `list`
- `get`
- `certificates download`

Completion criterion: the read-only command succeeds, and the output does not contain a JWT, password, token, secret, or certificate content.

## Write Boundary

Write operations include:

- `create`
- `update`
- `delete`
- `enable`
- `disable`
- `renew`
- `upload`

Write operations require confirmation by default. Use `--yes` only for automation. Before running a write operation against a real environment, confirm the target resource, action, and impact with the user.

Example:

```bash
nginx-proxy-manager --yes proxy-hosts update 1 --body-json '{"enabled":true}'
```

Completion criterion: the user approved the write, the command target and request body were checked, and the output contains no sensitive fields.

## Profiles

Add a profile:

```bash
nginx-proxy-manager profile add prod \
  --base_url https://proxy.example.com \
  --username admin@example.com \
  --password "$PASSWORD" \
  --default
```

If `profile add` is missing required values, the CLI prompts interactively. Do not write real passwords into repository files, logs, or final replies.

Common commands:

```bash
nginx-proxy-manager profile list
nginx-proxy-manager profile show prod
nginx-proxy-manager profile use prod
nginx-proxy-manager profile remove prod
```

`profile show` should display redacted credentials only. If output contains a plaintext password or token, stop and report the safety risk.

## Complex Request Bodies

Use REST API field names directly for shallow data:

```bash
nginx-proxy-manager --yes proxy-hosts create \
  --domain_names app.example.com \
  --forward_scheme http \
  --forward_host app \
  --forward_port 8080
```

Use `--body-json` or `--from-file` for nested objects:

```bash
nginx-proxy-manager --yes proxy-hosts update 1 --body-json '{"enabled":true}'
nginx-proxy-manager --yes redirection-hosts update 1 --from-file redirection-host.json
```

Completion criterion: the request body contains no real secret. If reading from a file, confirm the file is not an `.env` file, real config, or private key.

## Certificate Downloads

Certificate download is read-only, but the output file is sensitive. Prefer a temporary directory outside the repository:

```bash
tmp_dir="$(mktemp -d)"
nginx-proxy-manager --json certificates download 15 --output "$tmp_dir"
```

When `--output` is a directory, the CLI generates a zip filename from the certificate domain:

```text
*.example.com -> cert_example_com.zip
```

You may inspect the filename, size, permissions, and file type:

```bash
ls -l "$tmp_dir"
file "$tmp_dir"/*.zip
```

Do not run commands that print certificate content, such as `cat` or `unzip -p`. Do not place certificate zip files in the repository or commit them.

## Output And Redaction

Prefer `--json` for regular API commands so scripts can parse the output. Binary downloads, streams, and raw payloads follow command-specific behavior. When a file is written to `--output`, `--json` should only print result metadata.

Never paste these into a reply:

- JWT
- password
- token
- secret
- private key
- certificate zip content
- real config file content

If command output appears to contain sensitive data, stop quoting it. Report only the field category and the risk.

## Failure Handling

- Authentication failed: do not guess credentials; ask the user to check the test-specific config.
- 2FA required: the CLI does not support 2FA; suggest a dedicated account without 2FA.
- Write confirmation missing: do not add `--yes` automatically unless the user explicitly asked for automated writes.
- Download file landed in the repository: tell the user not to commit it and suggest moving it outside the repo.
- API error: report the command, HTTP status, and redacted error summary.

## Final Report

Report only:

- Config source, using the path when needed but not the file content.
- Command category: read-only, write operation, or certificate download.
- Success or failure result.
- Download path, size, and file type; do not include certificate content.
- Any safety risk the user must handle.
