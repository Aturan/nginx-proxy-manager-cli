---
name: nginx-proxy-manager-cli
description: Use when working on this repository's Nginx Proxy Manager npm CLI, including commands, profiles, tests, release workflow, or credential-safety changes.
---

# Nginx Proxy Manager CLI

Use this skill for changes to the `nginx-proxy-manager-cli` repository.

## Contract

Build and maintain a public npm CLI named `nginx-proxy-manager`. The CLI manages Nginx Proxy Manager API resources and local profiles. Completion means the change preserves the command name, TypeScript + pnpm setup, tests, release workflow, and credential-safety rules.

## Preconditions

1. Work only inside the repository.
   Completion criterion: every edited file is under the project root.
2. Read `AGENTS.md` before changing code or docs.
   Completion criterion: the Chinese language, TDD, test, e2e, security, and release boundaries are known.
3. Do not use real credentials.
   Completion criterion: examples and tests use placeholders or mock services only.

## Configuration

The CLI config path priority is:

1. `--config PATH`
2. `NGINX_PROXY_MANAGER_CONFIG`
3. `$HOME/.nginx-xproxy-manager.json`

Profiles store `base_url`, `username`, `password`, and default profile metadata. The HTTP client maps `username/password` to the API schema's `identity/secret` when requesting `/tokens`. Config writes should use `0600` when the filesystem supports it.

## Read/Write Boundary

Read-only commands are `health`, `schema`, `auth token`, `list`, `get`, schema reads, and `certificates download`.

Write commands are `create`, `update`, `delete`, `enable`, `disable`, `renew`, and `upload`. They require confirmation by default and support `--yes` for automation. Do not run real write commands against an internal service.

## Workflow

1. Write or update the failing test first.
   Completion criterion: the new behavior is covered by unit or integration tests.
2. Implement the smallest matching code change.
   Completion criterion: command behavior and API request shape match the test and existing patterns.
3. Preserve REST field names in CLI flags.
   Completion criterion: flags such as `domain_names`, `forward_scheme`, `forward_host`, and `forward_port` are not renamed to camelCase in user-facing commands.
4. Prefer field flags for shallow request data and `--body-json` or `--from-file` for nested bodies.
   Completion criterion: new examples and command options use `--body-json`, not `--data-json`.
5. Check output safety.
   Completion criterion: JWT, password, token-like fields, and API `secret` fields are redacted or never printed.
6. Run the relevant gates.
   Completion criterion: at minimum run the affected tests; before handoff run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## Common Commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CLI smoke checks:

```bash
node dist/cli.js --help
node dist/cli.js profile --help
node dist/cli.js proxy-hosts --help
```

If a real environment must be checked, use a test-only config and prefer read-only commands.

## Credential Safety

Never commit real usernames, passwords, JWTs, npm tokens, or GitHub tokens. `auth token` must not print the JWT. Tests must not read or modify the user's real HOME config.
