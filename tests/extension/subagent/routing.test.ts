import { describe, expect, test, vi } from "vitest";

const { runSubprocessAgentMock, implementerRunMock } = vi.hoisted(() => ({
  runSubprocessAgentMock: vi.fn(),
  implementerRunMock: vi.fn(),
}));

vi.mock("../../../extensions/subagent/subprocess-runtime.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../extensions/subagent/subprocess-runtime.js")>();
  return {
    ...actual,
    runSubprocessAgent: runSubprocessAgentMock,
  };
});

vi.mock("../../../extensions/subagent/implementer-runtime.js", () => ({
  ImplementerRuntime: class {
    run = implementerRunMock;
    dispose = vi.fn();
    disposeAll = vi.fn();
  },
}));

import subagentExtension from "../../../extensions/subagent";

describe("subagent routing", () => {
  test("routes implementer with taskKey to persistent runtime", async () => {
    let tool: any;
    subagentExtension({
      registerTool: (value: unknown) => {
        tool = value;
      },
      on: vi.fn(),
      registerCommand: vi.fn(),
      appendEntry: vi.fn(),
    } as any);

    implementerRunMock.mockResolvedValue({
      agent: "implementer",
      agentSource: "project",
      task: "Implement feature",
      exitCode: 0,
      messages: [],
      stderr: "",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
      sessionFile: "/tmp/implementer-session.jsonl",
    });

    await tool.execute(
      "id",
      { agent: "implementer", task: "Implement feature", taskKey: "task-2" },
      undefined,
      undefined,
      {
        cwd: process.cwd(),
        hasUI: false,
      },
    );

    expect(implementerRunMock).toHaveBeenCalledTimes(1);
    expect(runSubprocessAgentMock).not.toHaveBeenCalled();
  });

  test("keeps reviewers on fresh subprocess path", async () => {
    let tool: any;
    subagentExtension({
      registerTool: (value: unknown) => {
        tool = value;
      },
      on: vi.fn(),
      registerCommand: vi.fn(),
      appendEntry: vi.fn(),
    } as any);

    runSubprocessAgentMock.mockResolvedValue({
      agent: "critical-reviewer",
      agentSource: "project",
      task: "Review diff",
      exitCode: 0,
      messages: [],
      stderr: "",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
    });

    await tool.execute("id", { agent: "critical-reviewer", task: "Review diff" }, undefined, undefined, {
      cwd: process.cwd(),
      hasUI: false,
    });

    expect(runSubprocessAgentMock).toHaveBeenCalledTimes(1);
  });
});
