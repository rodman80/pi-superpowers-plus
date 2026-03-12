import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, test } from "vitest";
import { discoverAgents } from "../../extensions/subagent/agents";

describe("workflow skill content", () => {
  test("ships a dedicated read-only document reviewer agent and uses it in review prompts", () => {
    const discovery = discoverAgents(process.cwd(), "project");
    const docReviewer = discovery.agents.find((agent) => agent.name === "doc-reviewer");

    expect(docReviewer).toBeDefined();
    expect(docReviewer?.tools).toEqual(["read", "bash", "find", "grep", "ls"]);

    const specPrompt = fs.readFileSync(
      path.join(process.cwd(), "skills", "brainstorming", "spec-document-reviewer-prompt.md"),
      "utf-8",
    );
    const planPrompt = fs.readFileSync(
      path.join(process.cwd(), "skills", "writing-plans", "plan-document-reviewer-prompt.md"),
      "utf-8",
    );

    expect(specPrompt).toContain('agent: "doc-reviewer"');
    expect(planPrompt).toContain('agent: "doc-reviewer"');
  });

  test("brainstorming requires recommitting spec changes after review feedback", () => {
    const brainstorming = fs.readFileSync(path.join(process.cwd(), "skills", "brainstorming", "SKILL.md"), "utf-8");

    expect(brainstorming).toMatch(/commit the updated spec/i);
  });
});
