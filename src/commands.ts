import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { Command } from "commander";
import { confirm, input, password } from "@inquirer/prompts";
import { addProfile, getProfileName, readConfig, removeProfile, resolveConfigPath, selectProfile, useProfile, writeConfig } from "./config.js";
import { ApiClient, coerceId, dataToJsonObject, resourcePath } from "./client.js";
import { formatHuman, formatJson, formatProfileList } from "./output.js";
import { mergePayloads, parseJsonObject, readJsonObjectFile } from "./json.js";
import type { JsonObject, JsonValue, RuntimeContext } from "./types.js";

type CommandOptions = Record<string, unknown>;
type ProfileAddInput = {
  name: string;
  base_url: string;
  username: string;
  password: string;
};

const resourceNames = ["certificates", "proxy-hosts", "redirection-hosts", "streams"] as const;
type ResourceName = (typeof resourceNames)[number];

const writeActions = new Set(["create", "update", "delete", "enable", "disable", "renew", "upload"]);
const profileNamePattern = /^[A-Za-z0-9._-]+$/;
const requirePackage = createRequire(import.meta.url);
const packageInfo = requirePackage("../package.json") as { version: string };

export function createProgram(context: RuntimeContext): Command {
  const program = new Command();
  program
    .name("nginx-proxy-manager")
    .description("管理 Nginx Proxy Manager API 的命令行工具")
    .version(packageInfo.version)
    .option("--config <path>", "配置文件路径")
    .option("--profile <name>", "要使用的 profile 名称")
    .option("--json", "输出 JSON")
    .option("--yes", "跳过写操作确认")
    .configureOutput({
      writeOut: (text) => write(context.stdout, text),
      writeErr: (text) => write(context.stderr, text)
    });

  addProfileCommands(program, context);
  addAuthCommands(program, context);
  addHealthCommand(program, context);
  for (const resource of resourceNames) {
    addResourceCommands(program, context, resource);
  }

  return program;
}

function addProfileCommands(program: Command, context: RuntimeContext): void {
  const profile = program.command("profile").description("管理本地 profile");

  profile
    .command("add [name]")
    .description("新增或覆盖 profile")
    .option("--base_url <url>", "base_url")
    .option("--username <username>", "username")
    .option("--password <password>", "password")
    .option("--default", "设为默认 profile")
    .action(async (name: string | undefined, options: CommandOptions, command: Command) => {
      const global = getGlobal(command);
      const path = getConfigPath(global, context);
      const profileInput = await resolveProfileAddInput(name, options, context);
      const newProfile = {
        base_url: profileInput.base_url,
        username: profileInput.username,
        password: profileInput.password
      };
      await new ApiClient(newProfile, context.fetch).token();
      const config = await addProfile(
        path,
        profileInput.name,
        newProfile,
        Boolean(options.default)
      );
      writeResult(context, global, {
        ok: true,
        config_path: path,
        default_profile: config.default_profile ?? null,
        profile: profileInput.name
      });
    });

  profile
    .command("list")
    .description("列出 profile")
    .action(async (_options: CommandOptions, command: Command) => {
      const global = getGlobal(command);
      const config = await readConfig(getConfigPath(global, context));
      write(context.stdout, formatProfileList(config, Boolean(global.json)));
    });

  profile
    .command("show [name]")
    .description("显示 profile，password 会脱敏")
    .action(async (name: string | undefined, _options: CommandOptions, command: Command) => {
      const global = getGlobal(command);
      const config = await readConfig(getConfigPath(global, context));
      const profileName = getProfileName(config, name ?? stringOption(global.profile));
      const profile = config.profiles[profileName];
      writeResult(context, global, {
        name: profileName,
        default: config.default_profile === profileName,
        base_url: profile?.base_url ?? "",
        username: profile?.username ?? "",
        credential: "[redacted]"
      });
    });

  profile
    .command("remove <name>")
    .description("删除 profile")
    .action(async (name: string, _options: CommandOptions, command: Command) => {
      const global = getGlobal(command);
      await confirmWrite(command, context);
      const config = await removeProfile(getConfigPath(global, context), name);
      writeResult(context, global, { ok: true, removed: name, default_profile: config.default_profile ?? null });
    });

  profile
    .command("use <name>")
    .description("切换默认 profile")
    .action(async (name: string, _options: CommandOptions, command: Command) => {
      const global = getGlobal(command);
      const config = await useProfile(getConfigPath(global, context), name);
      writeResult(context, global, { ok: true, default_profile: config.default_profile ?? null });
    });
}

async function resolveProfileAddInput(
  name: string | undefined,
  options: CommandOptions,
  context: RuntimeContext
): Promise<ProfileAddInput> {
  const currentName = stringOption(name);
  const currentBaseUrl = stringOption(options.base_url);
  const currentUsername = stringOption(options.username);
  const currentPassword = stringOption(options.password);

  if (currentName && currentBaseUrl && currentUsername && currentPassword) {
    return validateProfileAddInput({
      name: currentName,
      base_url: currentBaseUrl,
      username: currentUsername,
      password: currentPassword
    });
  }

  const promptInput = context.stdin;
  if (!promptInput?.isTTY) {
    throw new Error("profile add requires name, --base_url, --username, and --password in non-interactive mode");
  }

  const promptContext = { input: promptInput, output: context.stderr };
  const resolved = {
    name: currentName ?? (await input({ message: "name", required: true, validate: validateProfileName }, promptContext)),
    base_url:
      currentBaseUrl ??
      (await input({ message: "base_url", required: true, validate: validateBaseUrl }, promptContext)),
    username: currentUsername ?? (await input({ message: "username", required: true, validate: validateRequired("username") }, promptContext)),
    password:
      currentPassword ??
      (await password(
        {
          message: "password",
          mask: "*",
          validate: validateRequired("password")
        },
        promptContext
      ))
  };
  return validateProfileAddInput(resolved);
}

function validateProfileAddInput(input: ProfileAddInput): ProfileAddInput {
  const checks = [
    validateProfileName(input.name),
    validateBaseUrl(input.base_url),
    validateRequired("username")(input.username),
    validateRequired("password")(input.password)
  ];
  for (const result of checks) {
    if (result !== true) {
      throw new Error(result);
    }
  }
  return input;
}

function validateProfileName(value: string): true | string {
  if (!value.trim()) return "profile name is required";
  if (!profileNamePattern.test(value)) return "profile name may only contain letters, numbers, dots, underscores, and dashes";
  return true;
}

function validateBaseUrl(value: string): true | string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "base_url must use http or https";
    }
    return true;
  } catch {
    return "base_url must be a valid URL";
  }
}

function validateRequired(field: string): (value: string) => true | string {
  return (value: string) => (value.trim().length > 0 ? true : `${field} is required`);
}

function addAuthCommands(program: Command, context: RuntimeContext): void {
  const auth = program.command("auth").description("认证相关命令");
  auth
    .command("token")
    .description("验证凭据并获取 token，但不会打印 JWT")
    .action(async (_options: CommandOptions, command: Command) => {
      const global = getGlobal(command);
      const client = await getClient(command, context);
      await client.token();
      writeResult(context, global, { ok: true, token: "[redacted]" });
    });
}

function addHealthCommand(program: Command, context: RuntimeContext): void {
  program
    .command("health")
    .description("读取 API schema 检查连通性")
    .action(async (_options: CommandOptions, command: Command) => {
      const global = getGlobal(command);
      const client = await getClient(command, context);
      const result = await client.request({ method: "GET", path: "/api/schema" });
      writeResult(context, global, result);
    });

  program
    .command("schema")
    .description("读取 API schema")
    .action(async (_options: CommandOptions, command: Command) => {
      const global = getGlobal(command);
      const client = await getClient(command, context);
      const result = await client.request({ method: "GET", path: "/api/schema" });
      writeResult(context, global, result);
    });
}

function addResourceCommands(program: Command, context: RuntimeContext, resource: ResourceName): void {
  const group = program.command(resource).description(`${resource} 资源命令`);

  group
    .command("list")
    .description(`列出 ${resource}`)
    .option("--query-json <json>", "查询参数 JSON object")
    .action(async (options: CommandOptions, command: Command) => {
      const global = getGlobal(command);
      const client = await getClient(command, context);
      const queryJson = stringOption(options.queryJson);
      const query = queryJson ? parseJsonObject(queryJson, "--query-json") : undefined;
      const result = await client.request({
        method: "GET",
        path: resourcePath(resource),
        query: queryToRecord(query)
      });
      writeResult(context, global, result);
    });

  group
    .command("get <id>")
    .description(`读取 ${resource}`)
    .action(async (id: string, _options: CommandOptions, command: Command) => {
      const global = getGlobal(command);
      const client = await getClient(command, context);
      const result = await client.request({ method: "GET", path: resourcePath(resource, coerceId(id)) });
      writeResult(context, global, result);
    });

  group
    .command("create")
    .description(`创建 ${resource}`)
    .option("--body-json <json>", "请求体 JSON object")
    .option("--from-file <path>", "从文件读取请求体 JSON object")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (options: CommandOptions, command: Command) => {
      await writeResource(command, context, resource, "create", undefined, options, "POST");
    });

  group
    .command("update <id>")
    .description(`更新 ${resource}`)
    .option("--body-json <json>", "请求体 JSON object")
    .option("--from-file <path>", "从文件读取请求体 JSON object")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (id: string, options: CommandOptions, command: Command) => {
      await writeResource(command, context, resource, "update", coerceId(id), options, "PUT");
    });

  group
    .command("delete <id>")
    .description(`删除 ${resource}`)
    .action(async (id: string, _options: CommandOptions, command: Command) => {
      await writeResource(command, context, resource, "delete", coerceId(id), undefined, "DELETE");
    });

  for (const action of ["enable", "disable"] as const) {
    group
      .command(`${action} <id>`)
      .description(`${action} ${resource}`)
      .action(async (id: string, _options: CommandOptions, command: Command) => {
        await writeResource(command, context, resource, action, coerceId(id), undefined, "PUT", action);
      });
  }

  if (resource === "certificates") {
    group
      .command("renew <id>")
      .description("续期 certificate")
      .action(async (id: string, _options: CommandOptions, command: Command) => {
        await writeResource(command, context, resource, "renew", coerceId(id), undefined, "POST", "renew");
      });

    group
      .command("download <id>")
      .description("下载 certificate")
      .option("--output <path>", "输出文件或目录路径", ".")
      .action(async (id: string, options: CommandOptions, command: Command) => {
        const global = getGlobal(command);
        const client = await getClient(command, context);
        const output = await resolveCertificateDownloadOutput(client, coerceId(id), String(options.output));
        const result = await client.request({
          method: "GET",
          path: resourcePath(resource, coerceId(id), "download"),
          responseType: "arrayBuffer"
        });
        const object = dataToJsonObject(result);
        const data = object.data;
        if (!(data instanceof ArrayBuffer)) {
          throw new Error("certificate download 未返回二进制内容");
        }
        await writeBinary(output, data);
        if (global.json) {
          writeResult(context, global, {
            ok: true,
            output,
            bytes: data.byteLength
          });
        }
      });

    group
      .command("upload")
      .description("上传 certificate 元数据")
      .option("--body-json <json>", "请求体 JSON object")
      .option("--from-file <path>", "从文件读取请求体 JSON object")
      .allowUnknownOption(true)
      .allowExcessArguments(true)
      .action(async (options: CommandOptions, command: Command) => {
        await writeResource(command, context, resource, "upload", undefined, options, "POST", "upload");
      });
  }
}

async function resolveCertificateDownloadOutput(client: ApiClient, id: number | string, output: string): Promise<string> {
  if (!(await isDirectoryPath(output))) {
    return output;
  }
  const certificate = dataToJsonObject(await client.request({ method: "GET", path: resourcePath("certificates", id) }));
  return join(output, certificateDownloadFilename(certificate, id));
}

async function isDirectoryPath(path: string): Promise<boolean> {
  if (path.endsWith("/") || path.endsWith("\\")) return true;
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function certificateDownloadFilename(certificate: JsonObject, id: number | string): string {
  const domainNames = certificate.domain_names;
  const domains = Array.isArray(domainNames) ? domainNames.filter((domain): domain is string => typeof domain === "string") : [];
  const wildcardDomain = domains.find((domain) => domain.trim().startsWith("*."));
  const firstDomain = domains[0];
  const niceName = typeof certificate.nice_name === "string" ? certificate.nice_name : undefined;
  return `cert_${sanitizeFilename(wildcardDomain ?? firstDomain ?? niceName ?? `certificate-${String(id)}`)}.zip`;
}

function sanitizeFilename(value: string): string {
  const domainName = value.trim().replace(/^\*\./, "");
  const safe = Array.from(domainName, (char) => (isUnsafeFilenameChar(char) || char === "." ? "_" : char))
    .join("")
    .replace(/^\.+|\.+$/g, "");
  return safe || "certificate";
}

function isUnsafeFilenameChar(char: string): boolean {
  return char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char);
}

async function writeResource(
  command: Command,
  context: RuntimeContext,
  resource: ResourceName,
  action: string,
  id: number | string | undefined,
  options: CommandOptions | undefined,
  method: string,
  pathAction?: string
): Promise<void> {
  if (writeActions.has(action)) await confirmWrite(command, context);
  const global = getGlobal(command);
  const client = await getClient(command, context);
  const body = options ? await payloadFromOptions(options, command) : undefined;
  const result = await client.request({
    method,
    path: resourcePath(resource, id, pathAction),
    body
  });
  writeResult(context, global, result);
}

async function payloadFromOptions(options: CommandOptions, command: Command): Promise<JsonObject> {
  const fromFilePath = stringOption(options.fromFile);
  const bodyJsonRaw = stringOption(options.bodyJson);
  const fromFile = fromFilePath ? await readJsonObjectFile(fromFilePath) : undefined;
  const inlineJson = bodyJsonRaw ? parseJsonObject(bodyJsonRaw, "--body-json") : undefined;
  const unknown = parseUnknownFieldOptions(command.args);
  const payload = mergePayloads(fromFile, inlineJson, unknown);
  if (Object.keys(payload).length === 0) {
    throw new Error("写操作需要 --body-json、--from-file 或字段参数");
  }
  return payload;
}

export function parseUnknownFieldOptions(args: string[]): JsonObject {
  const payload: JsonObject = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) continue;
    const key = arg.slice(2);
    const values: string[] = [];
    while (args[index + 1] && !args[index + 1]?.startsWith("--")) {
      values.push(String(args[index + 1]));
      index += 1;
    }
    payload[key] = values.length > 1 ? values : values[0] ?? true;
  }
  return payload;
}

async function getClient(command: Command, context: RuntimeContext): Promise<ApiClient> {
  const global = getGlobal(command);
  const configPath = getConfigPath(global, context);
  const config = await readConfig(configPath);
  const profileName = getProfileName(config, stringOption(global.profile));
  const profile = selectProfile(config, profileName);
  return new ApiClient(profile, context.fetch, async ({ token, expires }) => {
    profile.token = token;
    profile.token_expires_at = expires;
    await writeConfig(configPath, config);
  });
}

async function confirmWrite(command: Command, context: RuntimeContext): Promise<void> {
  const global = getGlobal(command);
  if (global.yes) return;
  if (!context.stdin?.isTTY) {
    throw new Error("写操作需要确认；在非交互环境请显式传入 --yes");
  }
  const accepted = await confirm({ message: "确认执行写操作？", default: false }, { input: context.stdin, output: context.stderr });
  if (!accepted) throw new Error("已取消写操作");
}

function getGlobal(command: Command): CommandOptions {
  let root = command;
  while (root.parent) root = root.parent;
  return root.opts();
}

function getConfigPath(global: CommandOptions, context: RuntimeContext): string {
  return resolveConfigPath({
    explicitPath: stringOption(global.config),
    env: context.env,
    homeDir: context.homeDir
  });
}

function writeResult(context: RuntimeContext, global: CommandOptions, value: JsonValue): void {
  write(context.stdout, global.json ? formatJson(value) : formatHuman(value));
}

function write(stream: NodeJS.WritableStream, text: string): void {
  stream.write(text);
}

function stringOption(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function queryToRecord(query?: JsonObject): Record<string, string | number | boolean> | undefined {
  if (!query) return undefined;
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      output[key] = value;
    }
  }
  return output;
}

async function writeBinary(path: string, data: ArrayBuffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(path, { mode: 0o600 });
    stream.on("error", reject);
    stream.on("finish", resolve);
    stream.end(Buffer.from(data));
  });
}
