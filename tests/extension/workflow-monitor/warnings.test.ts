import { describe, test, expect } from "vitest";
import { getTddViolationWarning, getDebugViolationWarning } from "../../../extensions/workflow-monitor/warnings";

describe("getTddViolationWarning", () => {
  test("returns warning for source-before-test violation", () => {
    const warning = getTddViolationWarning("source-before-test", "src/utils.ts");
    expect(warning).toContain("TDD VIOLATION");
    expect(warning).toContain("src/utils.ts");
    expect(warning).toContain("Delete");
    expect(warning).toContain("failing test");
  });

  test("includes anti-rationalization content", () => {
    const warning = getTddViolationWarning("source-before-test", "src/utils.ts");
    expect(warning).toContain("Too simple to test");
    expect(warning).toContain("I'll test after");
  });

  test("returns source-during-red warning", () => {
    const warning = getTddViolationWarning("source-during-red", "src/utils.ts");
    expect(warning).toContain("RED phase");
    expect(warning).toContain("Run your failing test");
  });

  test("warning is concise (under 15 lines)", () => {
    const warning = getTddViolationWarning("source-before-test", "src/utils.ts");
    const lines = warning.split("\n").filter((l) => l.trim().length > 0);
    expect(lines.length).toBeLessThanOrEqual(15);
  });
});

describe("getDebugViolationWarning", () => {
  test("returns fix-without-investigation warning", () => {
    const warning = getDebugViolationWarning("fix-without-investigation", "src/foo.ts", 0);
    expect(warning).toContain("DEBUG VIOLATION");
    expect(warning).toContain("src/foo.ts");
    expect(warning).toContain("investigating");
  });

  test("returns excessive-fix-attempts warning with count", () => {
    const warning = getDebugViolationWarning("excessive-fix-attempts", "src/foo.ts", 3);
    expect(warning).toContain("fix attempt #3");
    expect(warning).toContain("architecture");
    expect(warning).toContain("human partner");
  });

  test("returns excessive-fix-attempts warning with higher count", () => {
    const warning = getDebugViolationWarning("excessive-fix-attempts", "src/foo.ts", 5);
    expect(warning).toContain("fix attempt #5");
  });
});
