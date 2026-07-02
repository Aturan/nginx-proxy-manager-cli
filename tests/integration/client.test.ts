import { describe, expect, it, vi } from "vitest";
import { ApiClient, resourcePath } from "../../src/client.js";

describe("ApiClient", () => {
  it("用 profile username/password 映射 API identity/secret 请求 token，并在后续请求带 Authorization", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "jwt-value", expires: "2999-01-01T00:00:00.000Z" }), {
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 1 }]), { headers: { "content-type": "application/json" } })
      );
    const client = new ApiClient({ base_url: "https://proxy.example.test", username: "user", password: "password" }, fetchMock);

    const result = await client.request({ method: "GET", path: resourcePath("proxy-hosts") });

    expect(result).toEqual([{ id: 1 }]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://proxy.example.test/api/tokens");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ identity: "user", secret: "password" });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://proxy.example.test/api/nginx/proxy-hosts");
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>).authorization).toBe("Bearer jwt-value");
  });

  it("构造 create/update/delete/enable/disable 请求", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "jwt-value", expires: "2999-01-01T00:00:00.000Z" }), {
          headers: { "content-type": "application/json" }
        })
      )
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } })));
    const client = new ApiClient({ base_url: "https://proxy.example.test/", username: "user", password: "password" }, fetchMock);

    await client.request({ method: "POST", path: resourcePath("proxy-hosts"), body: { domain_names: ["a.test"] } });
    await client.request({ method: "PUT", path: resourcePath("proxy-hosts", 1), body: { enabled: false } });
    await client.request({ method: "DELETE", path: resourcePath("proxy-hosts", 1) });
    await client.request({ method: "PUT", path: resourcePath("proxy-hosts", 1, "enable") });
    await client.request({ method: "PUT", path: resourcePath("proxy-hosts", 1, "disable") });

    expect(fetchMock.mock.calls.slice(1).map(([url, init]) => [url, init?.method])).toEqual([
      ["https://proxy.example.test/api/nginx/proxy-hosts", "POST"],
      ["https://proxy.example.test/api/nginx/proxy-hosts/1", "PUT"],
      ["https://proxy.example.test/api/nginx/proxy-hosts/1", "DELETE"],
      ["https://proxy.example.test/api/nginx/proxy-hosts/1/enable", "PUT"],
      ["https://proxy.example.test/api/nginx/proxy-hosts/1/disable", "PUT"]
    ]);
  });

  it("token 未过期时直接复用", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = new ApiClient(
      {
        base_url: "https://proxy.example.test/",
        username: "user",
        password: "password",
        token: "cached-token",
        token_expires_at: "2999-01-01T00:00:00.000Z"
      },
      fetchMock
    );

    expect(await client.token()).toBe("cached-token");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("token 过期后重新请求并回调缓存", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "fresh-token", expires: "2999-01-01T00:00:00.000Z" }), {
          headers: { "content-type": "application/json" }
        })
      );
    const cached: Array<{ token: string; expires: string }> = [];
    const client = new ApiClient(
      {
        base_url: "https://proxy.example.test/",
        username: "user",
        password: "password",
        token: "expired-token",
        token_expires_at: "2000-01-01T00:00:00.000Z"
      },
      fetchMock,
      (token) => {
        cached.push(token);
      }
    );

    expect(await client.token()).toBe("fresh-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cached).toEqual([{ token: "fresh-token", expires: "2999-01-01T00:00:00.000Z" }]);
  });

  it("遇到 2FA token 响应时明确报错", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ requires_2fa: true, challenge_token: "challenge" }), {
        headers: { "content-type": "application/json" }
      })
    );
    const client = new ApiClient({ base_url: "https://proxy.example.test/", username: "user", password: "password" }, fetchMock);

    await expect(client.token()).rejects.toThrow(/2FA/);
  });
});
