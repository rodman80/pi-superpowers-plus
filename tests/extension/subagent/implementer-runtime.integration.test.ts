import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { ImplementerRuntime } from "../../../extensions/subagent/implementer-runtime.js";

describe("ImplementerRuntime integration", () => {
  test.each([
    "high",
    "xhigh",
  ] as const)("creates a real agent session for openai-codex/gpt-5.4 with %s thinking", async (thinkingLevel) => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), `pi-subagent-${thinkingLevel}-`));
    const runtime = new ImplementerRuntime();
    let sessionFile: string | undefined;

    try {
      const session = await (runtime as any).getOrCreateSession(
        {
          workstreamId: `ws-${thinkingLevel}`,
          taskKey: "task-2",
          status: "active",
          cwd,
          sessionId: `session-${thinkingLevel}`,
          createdAt: "2026-04-04T00:00:00.000Z",
          lastUsedAt: "2026-04-04T00:00:00.000Z",
          turnCount: 0,
        },
        {
          name: "implementer",
          systemPrompt: "You are implementer",
          source: "project",
          filePath: "/tmp/implementer.md",
          model: `openai-codex/gpt-5.4:${thinkingLevel}`,
        },
      );

      sessionFile = session.sessionFile;
      expect(session.model?.provider).toBe("openai-codex");
      expect(session.model?.id).toBe("gpt-5.4");
      expect(session.thinkingLevel).toBe(thinkingLevel);
    } finally {
      runtime.disposeAll();
      if (sessionFile) rmSync(path.dirname(sessionFile), { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
