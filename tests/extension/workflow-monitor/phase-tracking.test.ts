import { describe, expect, test } from "vitest";
import workflowMonitorExtension from "../../../extensions/workflow-monitor";
import { createFakePi, getSingleHandler } from "./test-helpers";

describe("Phase Tracking Integration Tests", () => {
  test("reading skill file does NOT advance workflow phase", async () => {
    const { api, handlers, appendedEntries } = createFakePi({ withAppendEntry: true });
    workflowMonitorExtension(api as any);

    const inputHandler = getSingleHandler(handlers, "input");
    const toolResultHandler = getSingleHandler(handlers, "tool_result");

    // Start in brainstorm phase
    await inputHandler(
      { text: "/skill:brainstorming" },
      { hasUI: false, sessionManager: { getBranch: () => [] }, ui: { setWidget: () => {}, select: () => {}, setEditorText: () => {}, notify: () => {} } },
    );

    // Simulate reading a different skill file (as Pi does when loading available skills)
    await toolResultHandler(
      {
        toolCallId: "tc1",
        toolName: "read",
        input: { path: "/path/to/skills/subagent-driven-development/SKILL.md" },
        content: [{ type: "text", text: "---\nname: subagent-driven-development\n..." }],
        details: {},
      },
      { hasUI: false, sessionManager: { getBranch: () => [] }, ui: { setWidget: () => {}, select: () => {}, setEditorText: () => {}, notify: () => {} } },
    );

    // Phase should still be brainstorm, NOT execute
    const stateEntries = appendedEntries.filter((e: any) => e.customType === "superpowers_state");
    const lastState = stateEntries[stateEntries.length - 1]?.data.workflow;
    expect(lastState?.currentPhase).toBe("brainstorm");
    expect(lastState?.phases.execute).toBe("pending");
  });
});
