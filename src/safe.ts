import type { JsonValue } from "./types.js";

const secretKeys = new Set([
  "authorization",
  "jwt",
  "password",
  "secret",
  "token",
  "access_token",
  "refresh_token"
]);

export function redactSecrets<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item)) as T;
  }
  if (value && typeof value === "object") {
    const redacted: Record<string, JsonValue> = {};
    for (const [key, nested] of Object.entries(value)) {
      redacted[key] = secretKeys.has(key.toLowerCase()) ? "[redacted]" : redactSecrets(nested);
    }
    return redacted as T;
  }
  return value;
}

export function assertSafeText(text: string): void {
  if (/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/.test(text)) {
    throw new Error("输出包含疑似 JWT，已阻止打印");
  }
}
