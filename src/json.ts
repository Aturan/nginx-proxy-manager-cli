import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { JsonObject, JsonValue } from "./types.js";

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema)
  ])
);

const jsonObjectSchema = z.record(jsonValueSchema);

export function parseJsonObject(raw: string, source = "JSON"): JsonObject {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return jsonObjectSchema.parse(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${source} 不是合法 JSON object：${message}`, { cause: error });
  }
}

export async function readJsonObjectFile(path: string): Promise<JsonObject> {
  return parseJsonObject(await readFile(path, "utf8"), path);
}

export function mergePayloads(...payloads: Array<JsonObject | undefined>): JsonObject {
  const merged: JsonObject = {};
  for (const payload of payloads) {
    if (!payload) continue;
    for (const [key, value] of Object.entries(payload)) {
      merged[key] = value;
    }
  }
  return merged;
}
