---
name: fix-bugs
description: 当用户要求自动修复 bug、跑完整验证、review 并推送时使用；按 diagnosing-bugs、测试、subagent review、verify、git-commit-and-push 的顺序执行。
---

# Fix Bugs

用于自动修复 bug 的端到端 loop。目标是从可复现问题开始，修复、验证、真实环境检查，然后自动提交并推送。

## 使用条件

1. 用户明确要求修 bug 或执行自动修复 loop。
   完成标准：请求中出现“修 bug”“自动修”“fix loop”“修完推送”等明确意图。
2. 当前变更目标是 CLI 仓库内的 bug 修复。
   完成标准：不把任务扩展成 Web UI、daemon、server 或非 npm CLI。
3. 用户允许提交并推送。
   完成标准：请求已明确要求 push；否则最后必须停在 commit 前或先询问。

## Loop

1. 使用 `diagnosing-bugs`。
   完成标准：已经建立能复现问题的反馈 loop；如果无法复现，记录尝试过的命令和缺失条件，不进入修复阶段。

2. 写测试。
   完成标准：新增或修改的测试能覆盖用户报告的问题；先看到测试失败，或能说明为什么只能用现有失败命令作为回归信号。

3. 修复 bug。
   完成标准：实现只改必要文件，不混入无关重构，不读取或修改用户真实 HOME 配置。

4. 跑本地验证。
   完成标准：至少运行相关测试；交付前运行完整 gate。

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

5. 创建 Subagent Review。
   完成标准：至少一个 subagent 已完成 review；review 要覆盖压力测试、对抗测试、安全输出、真实环境写操作边界和测试缺口。

如果 review 发现问题，修复后重新运行相关测试，并再次确认 review 关注点已关闭。

6. 使用 `verify` 做真实环境验证。
   完成标准：通过 `.agents/skills/verify/SKILL.md` 的流程验证 linked CLI；只运行只读命令和安全下载，不打印凭据或证书内容。

7. 使用 `git-commit-and-push`。
   完成标准：只提交当前 bug 修复相关文件，commit message 遵守 Conventional Commits，push 成功。

## 安全边界

- 不运行真实环境写操作，除非用户在当前任务中再次明确允许。
- 不提交证书压缩包、真实配置、`.env`、JWT、password、token、secret 或私钥。
- 不使用 `--no-verify` 绕过 hook。
- 不 force push。
- 如果发现工作区里有未知或敏感文件，先停下来按 `git-commit-and-push` 的分类规则处理。
- 如果 `verify` 失败，不进入提交推送阶段。

## 输出要求

收尾时报告：

- bug 复现方式和修复点。
- 运行过的测试和结果。
- subagent review 结论。
- `verify` 的真实环境验证范围。
- commit hash、commit message 和 push 结果。
