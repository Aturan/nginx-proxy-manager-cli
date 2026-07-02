import { constants } from "node:fs";
import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { AppConfig, Profile } from "./types.js";

export const CONFIG_ENV = "NGINX_PROXY_MANAGER_CONFIG";
export const DEFAULT_CONFIG_BASENAME = ".nginx-xproxy-manager.json";

const profileSchema = z.object({
  base_url: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
  token: z.string().min(1).optional(),
  token_expires_at: z.string().min(1).optional()
});

const configSchema = z.object({
  default_profile: z.string().min(1).optional(),
  profiles: z.record(profileSchema).default({})
});

export type ConfigPathInput = {
  explicitPath?: string | undefined;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
};

export function resolveConfigPath(input: ConfigPathInput = {}): string {
  const env = input.env ?? process.env;
  const homeDir = input.homeDir ?? process.env.HOME ?? "";
  const chosen = input.explicitPath ?? env[CONFIG_ENV] ?? `${homeDir}/${DEFAULT_CONFIG_BASENAME}`;
  return expandHome(chosen, homeDir);
}

export function expandHome(path: string, homeDir: string): string {
  if (path === "~") return homeDir;
  if (path.startsWith("~/")) return resolve(homeDir, path.slice(2));
  return resolve(path);
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readConfig(path: string): Promise<AppConfig> {
  if (!(await pathExists(path))) {
    return { profiles: {} };
  }

  const raw = await readFile(path, "utf8");
  const parsed: unknown = JSON.parse(raw);
  return configSchema.parse(parsed);
}

export async function writeConfig(path: string, config: AppConfig): Promise<void> {
  const normalized = configSchema.parse(config);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
  try {
    await chmod(path, 0o600);
  } catch {
    // 某些文件系统不支持 chmod，写入模式已经尽量限制为 0600。
  }
}

export async function addProfile(
  path: string,
  name: string,
  profile: Profile,
  makeDefault: boolean
): Promise<AppConfig> {
  const config = await readConfig(path);
  config.profiles[name] = profileSchema.parse(profile);
  if (makeDefault || !config.default_profile) {
    config.default_profile = name;
  }
  await writeConfig(path, config);
  return config;
}

export async function removeProfile(path: string, name: string): Promise<AppConfig> {
  const config = await readConfig(path);
  if (!config.profiles[name]) {
    throw new Error(`profile 不存在：${name}`);
  }
  delete config.profiles[name];
  if (config.default_profile === name) {
    const nextDefault = Object.keys(config.profiles)[0];
    if (nextDefault) {
      config.default_profile = nextDefault;
    } else {
      delete config.default_profile;
    }
  }
  await writeConfig(path, config);
  return config;
}

export async function useProfile(path: string, name: string): Promise<AppConfig> {
  const config = await readConfig(path);
  if (!config.profiles[name]) {
    throw new Error(`profile 不存在：${name}`);
  }
  config.default_profile = name;
  await writeConfig(path, config);
  return config;
}

export function selectProfile(config: AppConfig, name?: string): Profile {
  const profileName = name ?? config.default_profile;
  if (!profileName) {
    throw new Error("未配置默认 profile，请先运行 profile add 或使用 --profile");
  }
  const profile = config.profiles[profileName];
  if (!profile) {
    throw new Error(`profile 不存在：${profileName}`);
  }
  return profile;
}

export function getProfileName(config: AppConfig, name?: string): string {
  const profileName = name ?? config.default_profile;
  if (!profileName || !config.profiles[profileName]) {
    throw new Error("未找到可用 profile");
  }
  return profileName;
}
