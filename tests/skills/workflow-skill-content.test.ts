import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, test } from "vitest";
import { loadAgentFrontmatter } from "../helpers/agent-frontmatter";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf-8");
}

describe("workflow skill content", () => {
  test("ships namespaced review and utility agents wired into prompts", () => {
    const docReviewer = loadAgentFrontmatter("agents/spx-doc-reviewer.md");
    const investigator = loadAgentFrontmatter("agents/spx-codebase-investigator.md");
    const testRunner = loadAgentFrontmatter("agents/spx-test-runner.md");
    const internetResearcher = loadAgentFrontmatter("agents/spx-internet-researcher.md");
    const testEffectivenessAnalyst = loadAgentFrontmatter("agents/spx-test-effectiveness-analyst.md");

    expect(docReviewer.name).toBe("spx-doc-reviewer");
    expect(docReviewer.tools).toBe("read, bash, find, grep, ls");

    expect(investigator.name).toBe("spx-codebase-investigator");
    expect(investigator.tools).toBe("read, bash, find, grep, ls, lsp");
    expect(investigator.model).toBe("openai-codex/gpt-5.4:low");

    expect(testRunner.name).toBe("spx-test-runner");
    expect(testRunner.tools).toBe("bash");
    expect(testRunner.model).toBe("openai-codex/gpt-5.4:low");

    expect(internetResearcher.name).toBe("spx-internet-researcher");
    expect(internetResearcher.tools).toBe("web_search, read");
    expect(internetResearcher.model).toBe("openai-codex/gpt-5.4:low");

    expect(testEffectivenessAnalyst.name).toBe("spx-test-effectiveness-analyst");
    expect(testEffectivenessAnalyst.tools).toBe("read, find, grep, ls, lsp");
    expect(testEffectivenessAnalyst.model).toBe("openai-codex/gpt-5.4:high");

    expect(read("skills/brainstorming/spec-document-reviewer-prompt.md")).toContain('agent: "spx-doc-reviewer"');
    expect(read("skills/writing-plans/plan-document-reviewer-prompt.md")).toContain('agent: "spx-doc-reviewer"');
  });

  test("package metadata points at upstream pi-subagents instead of the local runtime", () => {
    const pkg = JSON.parse(read("package.json")) as {
      pi?: { extensions?: string[] };
      dependencies?: Record<string, string>;
    };

    expect(pkg.pi?.extensions).toContain("node_modules/pi-subagents/index.ts");
    expect(pkg.pi?.extensions).toContain("node_modules/pi-subagents/notify.ts");
    expect(pkg.pi?.extensions).toContain("extensions/pi-subagents-agent-sync.ts");
    expect(pkg.pi?.extensions).not.toContain("extensions/subagent/index.ts");
    expect(pkg.dependencies?.["pi-subagents"]).toBeDefined();
  });

  test("brainstorming requires recommitting spec changes after review feedback", () => {
    expect(read("skills/brainstorming/SKILL.md")).toMatch(/commit the updated spec/i);
  });
});
