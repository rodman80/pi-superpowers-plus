import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { __internal } from "../../extensions/pi-subagents-agent-sync";

let tempDir: string;
let previousAgentDir: string | undefined;

function agentPath(name: string): string {
  return path.join(tempDir, "agents", name);
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagents-agent-sync-"));
  previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = tempDir;
});

afterEach(() => {
  if (previousAgentDir === undefined) {
    delete process.env.PI_CODING_AGENT_DIR;
  } else {
    process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("pi-subagents managed agent sync", () => {
  test("copies managed spx agents into the user agent directory", () => {
    __internal.syncManagedAgents();

    const implementer = fs.readFileSync(agentPath("spx-implementer.md"), "utf-8");
    const worker = fs.readFileSync(agentPath("spx-worker.md"), "utf-8");

    expect(implementer).toContain("managedBy: pi-superpowers-plus");
    expect(implementer).toContain("You are an implementation subagent.");
    expect(implementer).toContain("Use the statuses `DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, or `NEEDS_CONTEXT`");
    expect(worker).toContain("name: spx-worker");
  });

  test("overwrites managed spx agent files but preserves unmanaged files", () => {
    fs.mkdirSync(path.join(tempDir, "agents"), { recursive: true });
    fs.writeFileSync(
      agentPath("spx-implementer.md"),
      "---\nmanagedBy: pi-superpowers-plus\nname: spx-implementer\n---\nold",
      "utf-8",
    );
    fs.writeFileSync(agentPath("spx-worker.md"), "---\nname: spx-worker\n---\ncustom", "utf-8");

    __internal.syncManagedAgents();

    expect(fs.readFileSync(agentPath("spx-implementer.md"), "utf-8")).toContain("implementation subagent");
    expect(fs.readFileSync(agentPath("spx-worker.md"), "utf-8")).toContain("custom");
  });

  test("shouldOverwrite only replaces managed files", () => {
    fs.mkdirSync(path.join(tempDir, "agents"), { recursive: true });
    const managedFile = agentPath("spx-code-reviewer.md");
    const unmanagedFile = agentPath("spx-doc-reviewer.md");

    fs.writeFileSync(managedFile, "---\nmanagedBy: pi-superpowers-plus\n---\nmanaged", "utf-8");
    fs.writeFileSync(unmanagedFile, "---\nname: spx-doc-reviewer\n---\nunmanaged", "utf-8");

    expect(__internal.shouldOverwrite(managedFile)).toBe(true);
    expect(__internal.shouldOverwrite(unmanagedFile)).toBe(false);
    expect(__internal.shouldOverwrite(agentPath("spx-test-runner.md"))).toBe(true);
  });
});
