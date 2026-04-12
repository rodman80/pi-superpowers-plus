import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { __internal as syncInternal } from "../../extensions/pi-subagents-agent-sync";
import { discoverAgents } from "pi-subagents/agents.ts";

let tempHome: string;
let previousAgentDir: string | undefined;

beforeEach(() => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagents-home-"));
  previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  delete process.env.PI_CODING_AGENT_DIR;
  vi.stubEnv("HOME", tempHome);
});

afterEach(() => {
  vi.unstubAllEnvs();

  if (previousAgentDir === undefined) {
    delete process.env.PI_CODING_AGENT_DIR;
  } else {
    process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  }

  fs.rmSync(tempHome, { recursive: true, force: true });
});

describe("pi-subagents upstream discovery", () => {
  test("discovers synced spx agents from the user agent directory", () => {
    syncInternal.syncManagedAgents();

    const legacyAgentPath = path.join(tempHome, ".pi", "agent", "agents", "spx-implementer.md");
    expect(fs.existsSync(legacyAgentPath)).toBe(true);
    expect(fs.existsSync(path.join(tempHome, ".agents", "spx-implementer.md"))).toBe(false);

    const result = discoverAgents(process.cwd(), "both");
    const implementer = result.agents.find((agent) => agent.name === "spx-implementer");
    const worker = result.agents.find((agent) => agent.name === "spx-worker");

    expect(implementer?.source).toBe("user");
    expect(implementer?.filePath).toBe(legacyAgentPath);
    expect(implementer?.description).toBe("Implement tasks via TDD and commit small changes");
    expect(worker?.source).toBe("user");
  });

  test("preserves legacy unmanaged spx customizations when the modern user dir exists", () => {
    const legacyAgentPath = path.join(tempHome, ".pi", "agent", "agents", "spx-implementer.md");
    const modernAgentsDir = path.join(tempHome, ".agents");

    fs.mkdirSync(path.dirname(legacyAgentPath), { recursive: true });
    fs.mkdirSync(modernAgentsDir, { recursive: true });
    fs.writeFileSync(
      legacyAgentPath,
      [
        "---",
        "name: spx-implementer",
        "description: Legacy custom implementer",
        "tools: read",
        "model: openai-codex/gpt-5.4:high",
        "---",
        "Custom legacy body",
      ].join("\n"),
      "utf-8",
    );

    syncInternal.syncManagedAgents();

    const result = discoverAgents(process.cwd(), "both");
    const implementer = result.agents.find((agent) => agent.name === "spx-implementer");

    expect(fs.existsSync(path.join(modernAgentsDir, "spx-implementer.md"))).toBe(false);
    expect(implementer?.filePath).toBe(legacyAgentPath);
    expect(implementer?.description).toBe("Legacy custom implementer");
  });
});
