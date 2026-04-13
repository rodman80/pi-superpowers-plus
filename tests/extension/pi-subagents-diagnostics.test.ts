import { describe, expect, test, vi } from "vitest";

import { createSubagentExecuteWrapper, wrapRegisteredToolForDiagnostics } from "../../extensions/pi-subagents-index.ts";

describe("pi-subagents diagnostics wrapper", () => {
  test("wraps subagent tool executions with start, progress, and finish logs", async () => {
    const log = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    };

    let now = 1_000;
    const wrapped = createSubagentExecuteWrapper(
      vi.fn(async (_id, _params, _signal, onUpdate) => {
        onUpdate?.({
          content: [{ type: "text", text: "(running...)" }],
          details: {
            mode: "single",
            progress: [
              {
                agent: "spx-doc-reviewer",
                status: "running",
                toolCount: 3,
                durationMs: 2_500,
                currentTool: "read",
                recentOutput: ["reviewing README"],
              },
            ],
          },
        });

        now = 3_500;
        return {
          content: [{ type: "text", text: "done" }],
          details: {
            mode: "single",
            progress: [
              {
                agent: "spx-doc-reviewer",
                status: "completed",
                toolCount: 3,
                durationMs: 2_500,
                currentTool: undefined,
                recentOutput: ["reviewing README"],
              },
            ],
            results: [{ exitCode: 0 }],
          },
        };
      }),
      {
        log,
        now: () => now,
        setInterval: vi.fn(() => ({}) as any) as any,
        clearInterval: vi.fn() as any,
        heartbeatMs: 15_000,
      },
    );

    const result = await wrapped(
      "id-1",
      { agent: "spx-doc-reviewer", task: "Review README.md" },
      undefined as never,
      undefined,
      undefined as never,
    );

    expect(result.content[0].text).toBe("done");
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining("subagent start mode=single agent=spx-doc-reviewer"));
    expect(log.debug).toHaveBeenCalledWith(
      expect.stringContaining("toolCount=3 currentTool=read recentOutput=reviewing README"),
    );
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining(
        "subagent finish mode=single agent=spx-doc-reviewer task=Review README.md durationMs=2500 exitCodes=0",
      ),
    );
  });

  test("heartbeat logs latest known progress while execution is still running", async () => {
    const log = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    };

    let now = 5_000;
    let heartbeat: (() => void) | undefined;
    let resolveRun: ((value: any) => void) | undefined;

    const wrapped = createSubagentExecuteWrapper(
      vi.fn(async (_id, _params, _signal, onUpdate) => {
        onUpdate?.({
          content: [{ type: "text", text: "(running...)" }],
          details: {
            mode: "single",
            progress: [
              {
                agent: "spx-doc-reviewer",
                status: "running",
                toolCount: 7,
                durationMs: 9_000,
                currentTool: "bash",
                recentOutput: ["still working"],
              },
            ],
          },
        });

        return await new Promise((resolve) => {
          resolveRun = resolve;
        });
      }),
      {
        log,
        now: () => now,
        setInterval: vi.fn((fn: () => void) => {
          heartbeat = fn;
          return {} as any;
        }) as any,
        clearInterval: vi.fn() as any,
        heartbeatMs: 15_000,
      },
    );

    const pending = wrapped(
      "id-2",
      { agent: "spx-doc-reviewer", task: "Review README.md" },
      undefined as never,
      undefined,
      undefined as never,
    );

    now = 20_000;
    heartbeat?.();

    expect(log.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        "subagent heartbeat mode=single agent=spx-doc-reviewer task=Review README.md elapsedMs=15000",
      ),
    );
    expect(log.debug).toHaveBeenCalledWith(expect.stringContaining("toolCount=7 currentTool=bash"));

    resolveRun?.({
      content: [{ type: "text", text: "done" }],
      details: { mode: "single", results: [{ exitCode: 0 }] },
    });

    await pending;
  });

  test("leaves non-subagent tools untouched", () => {
    const tool = {
      name: "bash",
      execute: vi.fn(),
    };

    const wrapped = wrapRegisteredToolForDiagnostics(tool, {
      log: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
      now: () => 0,
      setInterval: vi.fn(() => ({}) as any) as any,
      clearInterval: vi.fn() as any,
      heartbeatMs: 15_000,
    });

    expect(wrapped).toBe(tool);
  });
});
