import { describe, expect, it } from "vitest";
import { parseUnknownFieldOptions } from "../../src/commands.js";

describe("CLI 参数解析", () => {
  it("保留 REST API 原始字段名", () => {
    expect(
      parseUnknownFieldOptions([
        "--domain_names",
        "a.example.test",
        "b.example.test",
        "--forward_scheme",
        "http",
        "--forward_host",
        "app",
        "--forward_port",
        "8080"
      ])
    ).toEqual({
      domain_names: ["a.example.test", "b.example.test"],
      forward_scheme: "http",
      forward_host: "app",
      forward_port: "8080"
    });
  });
});
