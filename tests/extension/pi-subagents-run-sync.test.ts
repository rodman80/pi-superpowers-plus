import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

function writeFakePi(binDir: string, scriptBody: string): string {
  const piPath = path.join(binDir, "pi");
  fs.writeFileSync(piPath, scriptBody, { mode: 0o755 });
  return piPath;
}

function setupFakePiPackage(scriptBody: string, originalPath: string | undefined): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spx-run-sync-"));
  const packageRoot = path.join(tempRoot, "fake-pi-package");
  const binDir = path.join(packageRoot, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify({ name: "@mariozechner/pi-coding-agent", bin: { pi: "bin/pi" } }),
  );
  const markerDir = path.join(packageRoot, "subdir");
  fs.mkdirSync(markerDir, { recursive: true });
  fs.writeFileSync(path.join(markerDir, "entry.txt"), "marker\n");

  writeFakePi(binDir, scriptBody);
  process.env.PATH = `${binDir}${path.delimiter}${originalPath ?? ""}`;
  process.argv[1] = path.join(markerDir, "entry.txt");
  return tempRoot;
}

describe("patched pi-subagents runSync", () => {
  const originalPath = process.env.PATH;
  const originalArgv1 = process.argv[1];

  afterEach(() => {
    process.env.PATH = originalPath;
    process.argv[1] = originalArgv1;
  });

  test("ignores turn_end and resolves when agent_end arrives", async () => {
    setupFakePiPackage(
      `#!/usr/bin/env node
const emit = (event) => process.stdout.write(JSON.stringify(event) + "\\n");
emit({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "draft" }] } });
emit({ type: "turn_end" });
setTimeout(() => {
  emit({ type: "agent_end" });
}, 500);
process.on("SIGTERM", () => process.exit(0));
setInterval(() => {}, 1000);
`,
      originalPath,
    );

    const { runSync } = await import("../../extensions/pi-subagents-run-sync.ts");

    const pending = runSync(
      process.cwd(),
      [{ name: "spx-worker", systemPrompt: "", tools: [], extensions: [] }] as any,
      "spx-worker",
      "do work",
      { runId: "r1", index: 0 } as any,
    );

    const early = await Promise.race([
      pending.then(() => "resolved"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 200)),
    ]);
    expect(early).toBe("pending");

    const result = await pending;
    expect(result.exitCode).toBe(0);
    expect(result.finalOutput).toBe("draft");
  });

  test("harvests final context at turn_end and does not hang forever without agent_end", async () => {
    setupFakePiPackage(
      `#!/usr/bin/env node
const emit = (event) => process.stdout.write(JSON.stringify(event) + "\\n");
emit({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "Need parent feedback on option A vs B" }] } });
emit({ type: "turn_end", message: { role: "assistant", content: [{ type: "text", text: "Need parent feedback on option A vs B" }] } });
process.on("SIGTERM", () => process.exit(0));
setInterval(() => {}, 1000);
`,
      originalPath,
    );

    const { runSync } = await import("../../extensions/pi-subagents-run-sync.ts");

    const pending = runSync(
      process.cwd(),
      [{ name: "spx-worker", systemPrompt: "", tools: [], extensions: [] }] as any,
      "spx-worker",
      "do work",
      { runId: "r2", index: 0 } as any,
    );

    const outcome = await Promise.race<{ kind: "resolved"; result: Awaited<typeof pending> } | { kind: "pending" }>([
      pending.then((result) => ({ kind: "resolved" as const, result })),
      new Promise<{ kind: "pending" }>((resolve) => setTimeout(() => resolve({ kind: "pending" }), 1200)),
    ]);

    expect(outcome.kind).toBe("resolved");
    if (outcome.kind === "resolved") {
      expect(outcome.result.exitCode).toBe(0);
      expect(outcome.result.finalOutput).toBe("Need parent feedback on option A vs B");
    }
  });
});
