export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export interface Profile {
  base_url: string;
  username: string;
  password: string;
  token?: string | undefined;
  token_expires_at?: string | undefined;
}

export interface AppConfig {
  default_profile?: string | undefined;
  profiles: Record<string, Profile>;
}

export interface RuntimeContext {
  env: NodeJS.ProcessEnv;
  homeDir: string;
  fetch: typeof fetch;
  stdin?: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream | NodeJS.WritableStream;
  stderr: NodeJS.WriteStream | NodeJS.WritableStream;
}

export interface RequestRecord {
  method: string;
  path: string;
  query?: Record<string, string | number | boolean> | undefined;
  body?: JsonValue | FormData | undefined;
  responseType?: "json" | "arrayBuffer" | undefined;
}
