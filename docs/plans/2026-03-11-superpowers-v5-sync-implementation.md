# Superpowers v5 Sync Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Bring the highest-value upstream `superpowers` 5.0.1 workflow improvements into `pi-superpowers-plus` without regressing Pi-specific enforcement.

**Architecture:** Update the workflow skill files and subagent prompt templates in place, preserving Pi-native concepts such as `plan_tracker`, `workflow_reference`, and `docs/plans/`. Extend subagent structured results only where needed to support the new orchestrator protocol, and keep the runtime surface area narrow by validating with focused unit tests plus the full test suite.

**Tech Stack:** TypeScript, Vitest, Markdown workflow skills, Pi extension APIs

---

### Task 1: Sync brainstorming and planning review loops

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Create: `skills/brainstorming/spec-document-reviewer-prompt.md`
- Create: `skills/writing-plans/plan-document-reviewer-prompt.md`
- Modify: `skills/brainstorming/SKILL.md`
- Modify: `skills/writing-plans/SKILL.md`
- Test: `tests/extension/subagent/agents-discovery.test.ts`

**Step 1: Add failing/targeted coverage for new prompt assets**

Add assertions to `tests/extension/subagent/agents-discovery.test.ts` so the bundled skill asset layout is exercised after the new reviewer prompt files are added.

**Step 2: Run targeted test to verify current baseline**

Run: `npx vitest run tests/extension/subagent/agents-discovery.test.ts`
Expected: PASS on current branch before the new files are introduced

**Step 3: Add the new reviewer prompt templates**

Create:
- `skills/brainstorming/spec-document-reviewer-prompt.md`
- `skills/writing-plans/plan-document-reviewer-prompt.md`

Mirror the upstream review goals, but keep Pi paths (`docs/plans/`) and Pi terminology where needed.

**Step 4: Update the workflow skills**

In `skills/brainstorming/SKILL.md`:
- add hard gate/checklist discipline
- add scope assessment and design-for-isolation guidance
- add spec review loop and explicit user review gate
- keep Pi-specific references (`plan_tracker`, `docs/plans/`, worktree guidance)

In `skills/writing-plans/SKILL.md`:
- add `Scope Check`
- add `File Structure`
- add `Plan Review Loop`
- keep Pi-specific execution handoff and `plan_tracker` integration

**Step 5: Re-run targeted test**

Run: `npx vitest run tests/extension/subagent/agents-discovery.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add skills/brainstorming/SKILL.md skills/brainstorming/spec-document-reviewer-prompt.md skills/writing-plans/SKILL.md skills/writing-plans/plan-document-reviewer-prompt.md tests/extension/subagent/agents-discovery.test.ts
git commit -m "feat: sync brainstorming and planning review loops"
```

### Task 2: Sync subagent protocol and review criteria

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Modify: `skills/subagent-driven-development/SKILL.md`
- Modify: `skills/subagent-driven-development/implementer-prompt.md`
- Modify: `skills/subagent-driven-development/code-quality-reviewer-prompt.md`
- Modify: `agents/implementer.md`
- Modify: `agents/worker.md`
- Modify: `agents/code-reviewer.md`
- Modify: `extensions/subagent/index.ts`
- Test: `tests/extension/subagent/structured-result.test.ts`
- Test: `tests/extension/subagent/subagent-smoke.test.ts`

**Step 1: Add failing test coverage for the new status protocol**

Extend `tests/extension/subagent/structured-result.test.ts` to assert that structured summaries can surface an implementer status field from subagent output without regressing `filesChanged` and `testsRan`.

**Step 2: Run targeted tests to watch them fail**

Run: `npx vitest run tests/extension/subagent/structured-result.test.ts tests/extension/subagent/subagent-smoke.test.ts`
Expected: FAIL because the status field is not yet collected/exposed

**Step 3: Implement minimal runtime support**

Update `extensions/subagent/index.ts` so structured summaries detect and surface implementer status values (`DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, `NEEDS_CONTEXT`) when present in final text, while preserving existing summary behavior.

**Step 4: Update prompts and agents**

Sync the upstream protocol into:
- `skills/subagent-driven-development/SKILL.md`
- `skills/subagent-driven-development/implementer-prompt.md`
- `skills/subagent-driven-development/code-quality-reviewer-prompt.md`
- `agents/implementer.md`
- `agents/worker.md`
- `agents/code-reviewer.md`

Carry over:
- status handling rules
- escalation guidance
- architecture / file size review criteria
- code-organization constraints

Keep Pi-specific pieces:
- `plan_tracker`
- `subagent` tool examples
- current branch/worktree expectations

**Step 5: Re-run targeted tests**

Run: `npx vitest run tests/extension/subagent/structured-result.test.ts tests/extension/subagent/subagent-smoke.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add skills/subagent-driven-development/SKILL.md skills/subagent-driven-development/implementer-prompt.md skills/subagent-driven-development/code-quality-reviewer-prompt.md agents/implementer.md agents/worker.md agents/code-reviewer.md extensions/subagent/index.ts tests/extension/subagent/structured-result.test.ts tests/extension/subagent/subagent-smoke.test.ts
git commit -m "feat: sync subagent status and review protocol"
```

### Task 3: Verify related docs and finish the sync

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Test: `npm test`
- Test: `npm run lint`

**Step 1: Update user-facing documentation**

Adjust `README.md` so the documented workflow matches the new skill behavior: spec review loop, plan review loop, architecture-focused planning, and stronger subagent orchestration.

Add an unreleased note to `CHANGELOG.md` summarizing the imported 5.x workflow improvements.

**Step 2: Run focused regression checks**

Run: `npx vitest run tests/extension/subagent/agents-discovery.test.ts tests/extension/subagent/structured-result.test.ts tests/extension/subagent/subagent-smoke.test.ts`
Expected: PASS

**Step 3: Run full verification**

Run: `npm run lint`
Expected: PASS

Run: `npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: describe synced superpowers v5 workflow updates"
```
