import type { AppConfig, JsonValue } from "./types.js";
import { assertSafeText, redactSecrets } from "./safe.js";

export function formatJson(value: JsonValue): string {
  const text = `${JSON.stringify(redactSecrets(value), null, 2)}\n`;
  assertSafeText(text);
  return text;
}

export function formatHuman(value: JsonValue): string {
  const safeValue = redactSecrets(value);
  const text = typeof safeValue === "string" ? `${safeValue}\n` : `${JSON.stringify(safeValue, null, 2)}\n`;
  assertSafeText(text);
  return text;
}

export function formatProfileList(config: AppConfig, json: boolean): string {
  const profiles = Object.entries(config.profiles).map(([name, profile]) => ({
    name,
    default: config.default_profile === name,
    base_url: profile.base_url,
    username: profile.username
  }));
  if (json) return formatJson(profiles);
  if (profiles.length === 0) return "未配置 profile\n";
  return `${profiles
    .map((profile) => `${profile.default ? "*" : " "} ${profile.name}\t${profile.base_url}\t${profile.username}`)
    .join("\n")}\n`;
}
