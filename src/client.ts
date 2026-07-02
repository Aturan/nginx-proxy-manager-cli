import { URL } from "node:url";
import { z } from "zod";
import type { JsonObject, JsonValue, Profile, RequestRecord } from "./types.js";

const tokenResponseSchema = z.union([
  z.object({
    token: z.string().min(1),
    expires: z.string().min(1)
  }),
  z.object({
    requires_2fa: z.literal(true),
    challenge_token: z.string().min(1)
  })
]);

export type TokenCache = {
  token: string;
  expires: string;
};

export class ApiClient {
  constructor(
    private readonly profile: Profile,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly onToken?: ((token: TokenCache) => Promise<void> | void) | undefined
  ) {}

  async token(): Promise<string> {
    if (isTokenFresh(this.profile.token, this.profile.token_expires_at)) {
      return this.profile.token;
    }
    const response = await this.fetchImpl(this.url("/api/tokens"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identity: this.profile.username,
        secret: this.profile.password
      })
    });
    await assertOk(response);
    const data = tokenResponseSchema.parse(await response.json());
    if ("requires_2fa" in data) {
      throw new Error("当前 CLI 不支持 2FA，请使用未启用 2FA 的账号或专用账号");
    }
    this.profile.token = data.token;
    this.profile.token_expires_at = data.expires;
    await this.onToken?.({ token: data.token, expires: data.expires });
    return data.token;
  }

  async request(record: RequestRecord): Promise<JsonValue> {
    const token = await this.token();
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`
    };
    let body: BodyInit | undefined;

    if (record.body instanceof FormData) {
      body = record.body;
    } else if (record.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(record.body);
    }

    const init: RequestInit = {
      method: record.method,
      headers
    };
    if (body !== undefined) {
      init.body = body;
    }
    const response = await this.fetchImpl(this.url(record.path, record.query), init);
    await assertOk(response);
    if (response.status === 204) return { ok: true };

    if (record.responseType === "arrayBuffer") {
      return { data: await response.arrayBuffer() } as unknown as JsonValue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/octet-stream")) {
      return { data: await response.arrayBuffer() } as unknown as JsonValue;
    }
    return (await response.json()) as JsonValue;
  }

  private url(path: string, query?: Record<string, string | number | boolean>): string {
    const base = this.profile.base_url.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${base}${normalizedPath}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }
}

export function isTokenFresh(token: string | undefined, expiresAt: string | undefined): token is string {
  if (!token || !expiresAt) return false;
  const expiresTime = Date.parse(expiresAt);
  if (!Number.isFinite(expiresTime)) return false;
  return expiresTime > Date.now() + 30_000;
}

export async function assertOk(response: Response): Promise<void> {
  if (response.ok) return;
  const body = await response.text().catch(() => "");
  throw new Error(`API 请求失败：${response.status} ${response.statusText}${body ? ` ${body}` : ""}`);
}

export function resourcePath(resource: string, id?: string | number, action?: string): string {
  const base = resource === "certificates" ? "/api/nginx/certificates" : `/api/nginx/${resource}`;
  return [base, id, action].filter((part) => part !== undefined && part !== "").join("/");
}

export function coerceId(id: string): number | string {
  const numeric = Number(id);
  return Number.isSafeInteger(numeric) && String(numeric) === id ? numeric : id;
}

export function dataToJsonObject(value: JsonValue): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  throw new Error("API 返回值不是 JSON object");
}
