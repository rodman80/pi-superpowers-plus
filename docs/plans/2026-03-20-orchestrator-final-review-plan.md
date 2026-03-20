# Orchestrator Final Review Implementation Plan

> **For agentic workers:** REQUIRED: Use `/skill:subagent-driven-development` (preferred in-session) or `/skill:executing-plans` (parallel session) to implement this plan. Steps use checkbox syntax for tracking.

**Goal:** Add an orchestrator review step after code quality review to catch consistency issues, side effects, and alignment problems before marking each task complete.

**Architecture:** Modify two files: (1) the code-reviewer template to produce a structured Review Summary, and (2) the subagent-driven-development SKILL.md to add the orchestrator review process, updated flow diagram, and red flags.

**Tech Stack:** Markdown documentation, DOT diagrams

---

## Task 1: Add Review Summary format to code-reviewer template

**TDD scenario:** Trivial change — documentation update

**Files:**
- Modify: `skills/requesting-code-review/code-reviewer.md`

- [ ] **Step 1: Add Review Summary section to output format**

In `skills/requesting-code-review/code-reviewer.md`, find the "## Output Format" section and add the Review Summary block at the end, after the Assessment section.

Add this content after the Assessment section:

```markdown
## Review Summary

**REQUIRED:** End every review with this structured summary for orchestrator consumption.

```markdown
## Review Summary

**Files changed:** [`path/to/file1.ts`, `path/to/file2.ts`]

**What was implemented:** [2-3 sentences describing the main implementation]

**Dependencies affected:** [list of imports/exports that changed, or "none"]

**Flags for orchestrator:** [list of flags requiring orchestrator attention, or "none"]
- Examples: "Modified shared utility", "Changed internal API signature", "Touched hot path", "New dependency added"
- A module is considered "shared" if imported by 2+ other files

**Verdict:** ✅ Approved / ❌ Needs fixes
```
```

- [ ] **Step 2: Update Example Output to include Review Summary**

Find the Example Output section and add the Review Summary at the end:

```markdown
## Review Summary

**Files changed:** [`index-conversations`, `search.ts`, `indexer.ts`]

**What was implemented:** Added conversation indexing with date search and progress reporting.

**Dependencies affected:** none

**Flags for orchestrator:** "Modified shared CLI wrapper"

**Verdict:** ✅ Approved
```

- [ ] **Step 3: Commit**

```bash
git add skills/requesting-code-review/code-reviewer.md
git commit -m "feat(code-reviewer): add Review Summary output format for orchestrator"
```

---

## Task 2: Add Orchestrator Review section to SKILL.md

**TDD scenario:** Trivial change — documentation update

**Files:**
- Modify: `skills/subagent-driven-development/SKILL.md`

- [ ] **Step 1: Add Orchestrator Review section**

In `skills/subagent-driven-development/SKILL.md`, find the "## The Process" section. Add a new "### Orchestrator Review" subsection after the diagram and before the "## Prompt Templates" section.

Add this content:

```markdown
### Orchestrator Review

After code quality reviewer approves, the orchestrator performs a final review before marking the task complete.

**What the orchestrator reviews:**
1. Read the Review Summary from code-quality-reviewer
2. If **Flags for orchestrator** is not "none", open those specific files and review them
3. Cross-reference with:
   - Previous tasks' implementation summaries (what patterns were established)
   - Upcoming tasks in the plan (does this implementation help or hinder them)
   - Global project context (naming conventions, architectural decisions)

**What the orchestrator checks:**
- Consistency with previous tasks (naming, patterns, structure)
- Side effects on completed work
- Readiness for upcoming tasks
- Business context alignment

**How the orchestrator acts:**

| Problem type | Action |
|--------------|--------|
| Typos, unused imports, local variable names | Fix directly |
| Rename private functions/methods, adjust error messages | Fix directly |
| Small logic adjustments in isolated functions | Fix directly |
| Add small helper functions | Fix directly |
| Adjust internal (non-public) function signatures | Fix directly |
| Refactor code within a single function | Fix directly |
| Changes to public APIs or shared modules | Re-dispatch implementer |
| Logic changes affecting multiple files | Re-dispatch implementer |
| Architectural concerns | Escalate to user |

**Re-dispatch context:**

When re-dispatching implementer after finding issues, include:
1. The specific flag that triggered the review
2. The orchestrator's analysis of the issue
3. The required fix
4. Relevant file paths

**Loop prevention:**

Orchestrator-initiated re-dispatches are subject to the same "2 attempts" limit as regular failures. After 2 failed fix attempts:
- Minor issue → Log it, mark task complete, note in final report
- Blocking issue → Escalate to user with full context

**Edge case: Missing or malformed Review Summary**

If the code quality reviewer doesn't produce a Review Summary:
1. Re-dispatch reviewer with format reminder
2. If still missing, fall back to `git diff HEAD~1` and proceed with review

Fallback review outcomes follow the same action matrix.
```

- [ ] **Step 2: Commit**

```bash
git add skills/subagent-driven-development/SKILL.md
git commit -m "feat(subagent-driven): add Orchestrator Review section"
```

---

## Task 3: Update DOT diagram with orchestrator review flow

**TDD scenario:** Trivial change — documentation update

**Files:**
- Modify: `skills/subagent-driven-development/SKILL.md`

- [ ] **Step 1: Update the process diagram**

In `skills/subagent-driven-development/SKILL.md`, find the DOT diagram in "## The Process" section. Replace the "subgraph cluster_per_task" section to include the orchestrator review flow.

Find this section:
```dot
        "Code quality reviewer subagent approves?" [shape=diamond];
        "Implementer subagent fixes quality issues" [shape=box];
        "Mark task complete via plan_tracker tool" [shape=box];

        ...
        "Code quality reviewer subagent approves?" -> "Implementer subagent fixes quality issues" [label="no"];
        "Implementer subagent fixes quality issues" -> "Dispatch code quality reviewer subagent (./code-quality-reviewer-prompt.md)" [label="re-review"];
        "Code quality reviewer subagent approves?" -> "Mark task complete via plan_tracker tool" [label="yes"];
```

Replace with:
```dot
        "Code quality reviewer subagent approves?" [shape=diamond];
        "Implementer subagent fixes quality issues" [shape=box];
        "Orchestrator reads Review Summary" [shape=box];
        "Flags present?" [shape=diamond];
        "Orchestrator reviews flagged files" [shape=box];
        "Issues found?" [shape=diamond];
        "Small fix (see action matrix)?" [shape=diamond];
        "Orchestrator fixes directly" [shape=box];
        "Re-dispatch implementer" [shape=box];
        "Mark task complete via plan_tracker tool" [shape=box];

        ...
        "Code quality reviewer subagent approves?" -> "Implementer subagent fixes quality issues" [label="no"];
        "Implementer subagent fixes quality issues" -> "Dispatch code quality reviewer subagent (./code-quality-reviewer-prompt.md)" [label="re-review"];
        "Code quality reviewer subagent approves?" -> "Orchestrator reads Review Summary" [label="yes"];
        "Orchestrator reads Review Summary" -> "Flags present?";
        "Flags present?" -> "Mark task complete via plan_tracker tool" [label="no"];
        "Flags present?" -> "Orchestrator reviews flagged files" [label="yes"];
        "Orchestrator reviews flagged files" -> "Issues found?";
        "Issues found?" -> "Mark task complete via plan_tracker tool" [label="no"];
        "Issues found?" -> "Small fix (see action matrix)?" [label="yes"];
        "Small fix (see action matrix)?" -> "Orchestrator fixes directly" [label="yes"];
        "Small fix (see action matrix)?" -> "Re-dispatch implementer" [label="no"];
        "Orchestrator fixes directly" -> "Mark task complete via plan_tracker tool";
        "Re-dispatch implementer" -> "Dispatch spec reviewer subagent (./spec-reviewer-prompt.md)";
```

- [ ] **Step 2: Commit**

```bash
git add skills/subagent-driven-development/SKILL.md
git commit -m "feat(subagent-driven): update flow diagram with orchestrator review"
```

---

## Task 4: Update example workflow to show orchestrator review

**TDD scenario:** Trivial change — documentation update

**Files:**
- Modify: `skills/subagent-driven-development/SKILL.md`

- [ ] **Step 1: Add orchestrator review to Task 1 example**

Find the Task 1 section in the example workflow. After the code reviewer approves and before "[Mark Task 1 complete]", add:

```markdown
[Orchestrator review]
  - Reads Review Summary
  - Flag present: opens shared config module
  - Checks: change is additive, no breaking changes
  - Cross-reference: next task needs config read, this prepares well
  - No issues found
```

- [ ] **Step 2: Add orchestrator review to Task 2 example**

Find the Task 2 section. After the code reviewer approves and before "[Mark Task 2 complete]", add:

```markdown
[Orchestrator review]
  - Reads Review Summary
  - No flags
  - Cross-reference: naming consistent with Task 1
  - No issues found
```

- [ ] **Step 3: Commit**

```bash
git add skills/subagent-driven-development/SKILL.md
git commit -m "docs(subagent-driven): add orchestrator review to example workflow"
```

---

## Task 5: Add red flag for skipping orchestrator review

**TDD scenario:** Trivial change — documentation update

**Files:**
- Modify: `skills/subagent-driven-development/SKILL.md`

- [ ] **Step 1: Add red flag entry**

In the "## Red Flags" section, find the "Never:" list. Add a new entry after "Let implementer self-review replace actual review (both are needed)":

```markdown
- **Skip orchestrator review when flags are present** (read the summary, check flagged files)
```

- [ ] **Step 2: Commit**

```bash
git add skills/subagent-driven-development/SKILL.md
git commit -m "docs(subagent-driven): add red flag for skipping orchestrator review"
```

---

## Summary

| Task | Description | Files Modified |
|------|-------------|----------------|
| 1 | Add Review Summary format to code-reviewer | `skills/requesting-code-review/code-reviewer.md` |
| 2 | Add Orchestrator Review section | `skills/subagent-driven-development/SKILL.md` |
| 3 | Update DOT diagram | `skills/subagent-driven-development/SKILL.md` |
| 4 | Update example workflow | `skills/subagent-driven-development/SKILL.md` |
| 5 | Add red flag | `skills/subagent-driven-development/SKILL.md` |

**Total: 5 tasks, 2 files modified**
