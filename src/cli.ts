#!/usr/bin/env node
import { createProgram } from "./commands.js";

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = createProgram({
    env: process.env,
    homeDir: process.env.HOME ?? "",
    fetch,
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr
  });
  await program.parseAsync(argv);
}

runCli().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
