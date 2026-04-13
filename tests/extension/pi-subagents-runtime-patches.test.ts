import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  patchBuildPiArgsModule,
  patchExecutionModule,
  wrapChildForLogicalCompletion,
} from "../../extensions/pi-subagents-runtime-patches";

class FakeChildProcess extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  killed = false;
  exitCode: number | null = null;
  killSignals: string[] = [];

  kill(signal?: string) {
    this.killed = true;
    if (signal) this.killSignals.push(signal);
    return true;
  }
}

function emitJsonLines(child: FakeChildProcess, events: unknown[]) {
  child.stdout.write(`${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
}

describe("pi-subagents runtime patches", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("patchBuildPiArgsModule injects --no-extensions and --no-skills for explicit subagent skills", () => {
    const moduleUnderTest = {
      buildPiArgs: vi.fn((_input: any) => ({
        args: ["--mode", "json", "-p", "Task: hi"],
        env: {},
      })),
    };

    patchBuildPiArgsModule(moduleUnderTest);
    const result = moduleUnderTest.buildPiArgs({ skills: [] });

    expect(result.args).toEqual(["--mode", "json", "-p", "--no-extensions", "--no-skills", "Task: hi"]);
  });

  test("wrapChildForLogicalCompletion does not emit close on turn_end alone", async () => {
    const child = new FakeChildProcess();
    const wrapped = wrapChildForLogicalCompletion(child);
    const onClose = vi.fn();

    wrapped.on("close", onClose);
    emitJsonLines(child, [
      { type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "done" }] } },
      { type: "turn_end" },
    ]);

    await vi.advanceTimersByTimeAsync(300);

    expect(onClose).not.toHaveBeenCalled();
    expect(child.killSignals).toEqual([]);
  });

  test("agent_end closes after prior turn_end and later events", async () => {
    const child = new FakeChildProcess();
    const wrapped = wrapChildForLogicalCompletion(child);
    const onClose = vi.fn();

    wrapped.on("close", onClose);
    emitJsonLines(child, [
      { type: "turn_end" },
      { type: "turn_start" },
      { type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "follow-up" }] } },
    ]);

    await vi.advanceTimersByTimeAsync(300);
    expect(onClose).not.toHaveBeenCalled();

    emitJsonLines(child, [{ type: "agent_end" }]);
    expect(onClose).toHaveBeenCalledWith(0);
    expect(child.killSignals).toContain("SIGTERM");
  });

  test("patchExecutionModule replaces runSync once", async () => {
    const original = vi.fn(async () => ({ exitCode: 0 }));
    const replacement = vi.fn(async () => ({ exitCode: 9 }));
    const moduleUnderTest = { runSync: original };

    patchExecutionModule(moduleUnderTest, replacement);
    patchExecutionModule(
      moduleUnderTest,
      vi.fn(async () => ({ exitCode: 4 })),
    );

    const result = await moduleUnderTest.runSync();
    expect(result).toEqual({ exitCode: 9 });
    expect(replacement).toHaveBeenCalledTimes(1);
  });
});
