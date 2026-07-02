import { describe, expect, it } from "vitest";
import { formatJson } from "../../src/output.js";
import { redactSecrets } from "../../src/safe.js";

describe("safe output", () => {
  it("递归脱敏 secret/password/token", () => {
    expect(
      redactSecrets({
        token: "abc",
        nested: { secret: "s", password: "p" },
        keep: "visible"
      })
    ).toEqual({
      token: "[redacted]",
      nested: { secret: "[redacted]", password: "[redacted]" },
      keep: "visible"
    });
  });

  it("阻止疑似 JWT 输出", () => {
    expect(() => formatJson({ token: "eyJaaa.bbb.ccc" })).not.toThrow();
    expect(() => formatJson({ value: "eyJaaa.bbb.ccc" })).toThrow(/JWT/);
  });
});
