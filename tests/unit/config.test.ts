import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addProfile,
  CONFIG_ENV,
  readConfig,
  removeProfile,
  resolveConfigPath,
  selectProfile,
  useProfile
} from "../../src/config.js";

describe("config", () => {
  it("按 --config > 环境变量 > 默认路径解析配置文件", () => {
    expect(
      resolveConfigPath({
        explicitPath: "/tmp/a.json",
        env: { [CONFIG_ENV]: "/tmp/b.json" },
        homeDir: "/home/u"
      })
    ).toBe("/tmp/a.json");
    expect(resolveConfigPath({ env: { [CONFIG_ENV]: "/tmp/b.json" }, homeDir: "/home/u" })).toBe("/tmp/b.json");
    expect(resolveConfigPath({ env: {}, homeDir: "/home/u" })).toBe("/home/u/.nginx-xproxy-manager.json");
  });

  it("写入 profile 并尽量设置为 0600", async () => {
    const dir = await mkdtemp(join(tmpdir(), "npm-cli-config-"));
    const path = join(dir, "config.json");
    await addProfile(
      path,
      "prod",
      {
        base_url: "https://proxy.example.test",
        username: "admin@example.test",
        password: "password"
      },
      true
    );

    const config = await readConfig(path);
    expect(config.default_profile).toBe("prod");
    expect(selectProfile(config).base_url).toBe("https://proxy.example.test");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("支持 profile use/remove", async () => {
    const dir = await mkdtemp(join(tmpdir(), "npm-cli-profile-"));
    const path = join(dir, "config.json");
    await addProfile(path, "a", { base_url: "https://a.test", username: "a", password: "p" }, true);
    await addProfile(path, "b", { base_url: "https://b.test", username: "b", password: "p" }, false);
    await useProfile(path, "b");
    expect((await readConfig(path)).default_profile).toBe("b");
    await removeProfile(path, "b");
    expect((await readConfig(path)).default_profile).toBe("a");
  });
});
