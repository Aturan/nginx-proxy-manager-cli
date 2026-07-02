import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProgram } from "../../src/commands.js";
import { writeConfig } from "../../src/config.js";
import { MemoryWritable } from "../helpers/io.js";

describe("CLI integration", () => {
  it("--config 对 profile 命令生效", async () => {
    const dir = await mkdtemp(join(tmpdir(), "npm-cli-"));
    const configPath = join(dir, "config.json");
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    const fetchMock = ((url: string | URL | Request) => {
      if (String(url).endsWith("/api/tokens")) {
        return Promise.resolve(
          new Response(JSON.stringify({ token: "cached-token", expires: "2999-01-01T00:00:00.000Z" }), {
            headers: { "content-type": "application/json" }
          })
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }));
    }) as typeof fetch;
    const program = createProgram({
      env: {},
      homeDir: dir,
      fetch: fetchMock,
      stdout,
      stderr
    });

    await program.parseAsync([
      "node",
      "cli",
      "--config",
      configPath,
      "profile",
      "add",
      "prod",
      "--base_url",
      "https://proxy.example.test",
      "--username",
      "admin",
      "--password",
      "password",
      "--default",
      "--json"
    ]);

    const file = JSON.parse(await readFile(configPath, "utf8"));
    expect(file.default_profile).toBe("prod");
    expect(file.profiles.prod).toMatchObject({
      username: "admin",
      password: "password",
      token: "cached-token",
      token_expires_at: "2999-01-01T00:00:00.000Z"
    });
    expect(stdout.text()).not.toContain("password");
    expect(stdout.text()).not.toContain("cached-token");
  });

  it("profile add 缺参数且非交互时给出明确错误", async () => {
    const dir = await mkdtemp(join(tmpdir(), "npm-cli-profile-missing-"));
    const program = createProgram({
      env: {},
      homeDir: dir,
      fetch,
      stdout: new MemoryWritable(),
      stderr: new MemoryWritable()
    });

    await expect(program.parseAsync(["node", "cli", "profile", "add"])).rejects.toThrow(/non-interactive mode/);
  });

  it("profile add 会校验参数内容", async () => {
    const dir = await mkdtemp(join(tmpdir(), "npm-cli-profile-invalid-"));
    const program = createProgram({
      env: {},
      homeDir: dir,
      fetch,
      stdout: new MemoryWritable(),
      stderr: new MemoryWritable()
    });

    await expect(
      program.parseAsync([
        "node",
        "cli",
        "profile",
        "add",
        "bad/name",
        "--base_url",
        "ftp://proxy.example.test",
        "--username",
        "admin",
        "--password",
        "password"
      ])
    ).rejects.toThrow(/profile name/);
  });

  it("写资源命令用 --yes 跳过确认并保留字段名", async () => {
    const dir = await mkdtemp(join(tmpdir(), "npm-cli-write-"));
    const configPath = join(dir, "config.json");
    await writeConfig(configPath, {
      default_profile: "prod",
      profiles: {
        prod: { base_url: "https://proxy.example.test", username: "admin", password: "password" }
      }
    });
    const calls: Array<[string | URL | Request, RequestInit | undefined]> = [];
    const fetchMock = ((url: string | URL | Request, init?: RequestInit) => {
      calls.push([url, init]);
      if (String(url).endsWith("/api/tokens")) {
        return Promise.resolve(
          new Response(JSON.stringify({ token: "jwt-value", expires: "2999-01-01T00:00:00.000Z" }), {
            headers: { "content-type": "application/json" }
          })
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ id: 1 }), { headers: { "content-type": "application/json" } }));
    }) as typeof fetch;
    const program = createProgram({
      env: {},
      homeDir: dir,
      fetch: fetchMock,
      stdout: new MemoryWritable(),
      stderr: new MemoryWritable()
    });

    await program.parseAsync([
      "node",
      "cli",
      "--config",
      configPath,
      "--yes",
      "proxy-hosts",
      "create",
      "--domain_names",
      "a.test",
      "b.test",
      "--forward_scheme",
      "http",
      "--forward_host",
      "app",
      "--forward_port",
      "8080"
    ]);

    expect(String(calls[1]?.[0])).toBe("https://proxy.example.test/api/nginx/proxy-hosts");
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({
      domain_names: ["a.test", "b.test"],
      forward_scheme: "http",
      forward_host: "app",
      forward_port: "8080"
    });
  });

  it("配置里 token 未过期时复用，不请求 /tokens", async () => {
    const dir = await mkdtemp(join(tmpdir(), "npm-cli-cached-token-"));
    const configPath = join(dir, "config.json");
    await writeConfig(configPath, {
      default_profile: "prod",
      profiles: {
        prod: {
          base_url: "https://proxy.example.test",
          username: "admin",
          password: "password",
          token: "cached-token",
          token_expires_at: "2999-01-01T00:00:00.000Z"
        }
      }
    });
    const calls: Array<[string | URL | Request, RequestInit | undefined]> = [];
    const fetchMock = ((url: string | URL | Request, init?: RequestInit) => {
      calls.push([url, init]);
      return Promise.resolve(new Response(JSON.stringify([{ id: 1 }]), { headers: { "content-type": "application/json" } }));
    }) as typeof fetch;

    await createProgram({
      env: {},
      homeDir: dir,
      fetch: fetchMock,
      stdout: new MemoryWritable(),
      stderr: new MemoryWritable()
    }).parseAsync(["node", "cli", "--config", configPath, "proxy-hosts", "list"]);

    expect(calls.map(([url]) => String(url))).toEqual(["https://proxy.example.test/api/nginx/proxy-hosts"]);
    expect((calls[0]?.[1]?.headers as Record<string, string>).authorization).toBe("Bearer cached-token");
  });

  it("配置里 token 过期时重新请求并回写", async () => {
    const dir = await mkdtemp(join(tmpdir(), "npm-cli-expired-token-"));
    const configPath = join(dir, "config.json");
    await writeConfig(configPath, {
      default_profile: "prod",
      profiles: {
        prod: {
          base_url: "https://proxy.example.test",
          username: "admin",
          password: "password",
          token: "expired-token",
          token_expires_at: "2000-01-01T00:00:00.000Z"
        }
      }
    });
    const calls: Array<[string | URL | Request, RequestInit | undefined]> = [];
    const fetchMock = ((url: string | URL | Request, init?: RequestInit) => {
      calls.push([url, init]);
      if (String(url).endsWith("/api/tokens")) {
        return Promise.resolve(
          new Response(JSON.stringify({ token: "fresh-token", expires: "2999-01-01T00:00:00.000Z" }), {
            headers: { "content-type": "application/json" }
          })
        );
      }
      return Promise.resolve(new Response(JSON.stringify([{ id: 1 }]), { headers: { "content-type": "application/json" } }));
    }) as typeof fetch;

    await createProgram({
      env: {},
      homeDir: dir,
      fetch: fetchMock,
      stdout: new MemoryWritable(),
      stderr: new MemoryWritable()
    }).parseAsync(["node", "cli", "--config", configPath, "proxy-hosts", "list"]);

    expect(calls.map(([url]) => String(url))).toEqual([
      "https://proxy.example.test/api/tokens",
      "https://proxy.example.test/api/nginx/proxy-hosts"
    ]);
    const file = JSON.parse(await readFile(configPath, "utf8"));
    expect(file.profiles.prod).toMatchObject({
      token: "fresh-token",
      token_expires_at: "2999-01-01T00:00:00.000Z"
    });
  });

  it("写资源命令支持 --body-json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "npm-cli-body-json-"));
    const configPath = join(dir, "config.json");
    await writeConfig(configPath, {
      default_profile: "prod",
      profiles: {
        prod: { base_url: "https://proxy.example.test", username: "admin", password: "password" }
      }
    });
    const calls: Array<[string | URL | Request, RequestInit | undefined]> = [];
    const fetchMock = ((url: string | URL | Request, init?: RequestInit) => {
      calls.push([url, init]);
      if (String(url).endsWith("/api/tokens")) {
        return Promise.resolve(
          new Response(JSON.stringify({ token: "jwt-value", expires: "2999-01-01T00:00:00.000Z" }), {
            headers: { "content-type": "application/json" }
          })
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ id: 1 }), { headers: { "content-type": "application/json" } }));
    }) as typeof fetch;

    await createProgram({
      env: {},
      homeDir: dir,
      fetch: fetchMock,
      stdout: new MemoryWritable(),
      stderr: new MemoryWritable()
    }).parseAsync([
      "node",
      "cli",
      "--config",
      configPath,
      "--yes",
      "proxy-hosts",
      "update",
      "1",
      "--body-json",
      "{\"enabled\":true}"
    ]);

    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({ enabled: true });
  });

  it("profile list/show 会脱敏并支持 JSON 输出", async () => {
    const dir = await mkdtemp(join(tmpdir(), "npm-cli-profile-json-"));
    const configPath = join(dir, "config.json");
    await writeConfig(configPath, {
      default_profile: "prod",
      profiles: {
        prod: { base_url: "https://proxy.example.test", username: "admin", password: "password" }
      }
    });

    const listOut = new MemoryWritable();
    await createProgram({ env: {}, homeDir: dir, fetch, stdout: listOut, stderr: new MemoryWritable() }).parseAsync([
      "node",
      "cli",
      "--config",
      configPath,
      "--json",
      "profile",
      "list"
    ]);

    const showOut = new MemoryWritable();
    await createProgram({ env: {}, homeDir: dir, fetch, stdout: showOut, stderr: new MemoryWritable() }).parseAsync([
      "node",
      "cli",
      "--config",
      configPath,
      "--json",
      "profile",
      "show",
      "prod"
    ]);

    expect(JSON.parse(listOut.text())[0].name).toBe("prod");
    expect(showOut.text()).toContain("[redacted]");
    expect(showOut.text()).toContain("\"username\"");
    expect(showOut.text()).not.toContain("\"password\"");
  });
});
