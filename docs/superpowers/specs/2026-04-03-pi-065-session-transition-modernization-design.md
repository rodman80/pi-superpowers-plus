# Pi 0.65 Session Transition Modernization Design

**Date:** 2026-04-03
**Status:** Draft for review
**Scope:** `workflow-monitor`, `plan-tracker`, shared extension utilities, and related tests

## Goal

Adapt `pi-superpowers-plus` to Pi `0.65.x+` session-extension semantics while improving the user experience around session handoff, workflow continuation, and phase skipping.

The design should preserve the current workflow guidance model, but stop assuming that every user starts in brainstorm and proceeds linearly. A user may arrive in Pi with a plan, design, or approved artifact already prepared elsewhere and should be able to declare that state explicitly.

## Problem Statement

Pi `0.65.0` changed extension session behavior in ways that matter to this package:

- `session_switch` and `session_fork` post-transition extension events were removed
- `session_start` now carries `reason` values such as `startup`, `reload`, `new`, `resume`, and `fork`
- `previousSessionFile` is now available for `new`, `resume`, and `fork`
- command argument completions can now be asynchronous

`pi-superpowers-plus` currently depends on the old event model in multiple places, especially for session-state reconstruction and tests. This creates a compatibility gap with newer Pi versions and keeps session-handling logic spread across extensions.

Separately, the package currently assumes a mostly linear workflow. That assumption is too rigid for real use. Users often do brainstorm or planning elsewhere and then arrive in Pi only for execution, verification, review, or orchestration. The runtime should support that explicitly instead of repeatedly inferring "missing" earlier phases.

## Design Goals

- Align extension behavior with Pi `0.65.x+` session semantics
- Keep older Pi behavior working when compatibility comes naturally
- Improve clarity of `/workflow-next` handoff behavior
- Support a hybrid workflow model where phases can be inferred or explicitly declared
- Reduce duplicated session-transition logic across extensions
- Keep the intervention scoped to extension architecture and user-facing workflow UX

## Non-Goals

- Redesign the overall workflow philosophy or reorder the workflow phases
- Replace all existing inference logic with explicit state only
- Refactor unrelated extension logic solely for style
- Introduce a large compatibility abstraction for every historical Pi version
- Rewrite the subagent architecture beyond what is needed for session handoff UX

## User Scenarios

### 1. Linear workflow inside Pi

The user brainstorms, plans, executes, verifies, reviews, and finishes inside Pi. Session transitions should keep state coherent and prompts should appear once, at the right time.

### 2. External brainstorm, execution in Pi

The user arrives with a design doc or implementation plan already prepared outside the current session. They start directly in execute or verify and explicitly mark earlier phases as already complete.

### 3. Handoff with `/workflow-next`

The user or agent starts a new session for the next phase. The new session should open with the right editor prefill, phase context, artifact reference, and no stale prompts from the previous session.

### 4. Resume or fork

The user resumes or forks an existing session. The package should reconstruct the right session-scoped state, clear ephemeral pending warnings, and preserve only workflow state that is intentionally persistent.

## Proposed Approach

Use a shared session-transition adapter plus a hybrid workflow-state model.

The adapter becomes the single place that translates Pi session events into internal transition semantics used by the package. `workflow-monitor` and `plan-tracker` stop depending on raw event names as business logic inputs and instead consume normalized transition causes.

The workflow state model is expanded so a phase can be:

- inferred from user behavior, artifacts, skill invocations, or tool usage
- declared complete explicitly by the user during a handoff

When inferred state and declared state differ, declared state wins for prompts and gating decisions. Inference remains useful as the default, but it no longer traps users in an assumed linear path.

## Architecture

### A. Shared Session Transition Adapter

Add a small shared module, likely under `extensions/shared/` or `extensions/workflow-monitor/`, that normalizes Pi session events into package-level transition metadata.

Responsibilities:

- accept raw session event information from Pi
- normalize it into an internal transition shape
- classify causes such as:
  - `startup`
  - `reload`
  - `new`
  - `resume`
  - `fork`
  - `tree`
  - `legacy-switch`
  - `legacy-fork`
- expose whether the transition should:
  - reconstruct persisted state
  - clear ephemeral warning buffers
  - reset branch-safety one-shot notices
  - preserve declared workflow completions

Best-effort compatibility rule:

- Pi `0.65.x+` uses `session_start(reason)` as the primary source of truth
- legacy event names may still be accepted internally if the current runtime or tests provide them
- compatibility should be lightweight and local to the adapter

### B. Hybrid Workflow Phase State

Extend workflow state so it can distinguish:

- `inferredCompletePhases`
- `declaredCompletePhases`
- the current active phase, still determined by existing workflow tracking rules unless explicitly guided otherwise

Behavioral rules:

- declared completion overrides unresolved-phase prompts and gating
- inferred completion continues to drive helpful defaults
- skipping a phase is explicit and persistent within the session state
- phase declarations should be reversible through a reset path if the user made a mistake

This model should be persisted alongside the existing workflow state so that `new`, `resume`, and `fork` can reconstruct it consistently.

### C. `/workflow-next` Modernization

Upgrade `/workflow-next` from a "start a fresh session and prefill the editor" helper into a first-class handoff command.

Expected capabilities:

- target phase remains required
- artifact path remains optional
- user can explicitly declare already-complete prior phases
- command can offer an interactive prompt when earlier phases appear unresolved
- command writes the resulting declared phase state into the new session context
- command uses the true session transition semantics after `new`

Preferred UX model:

- explicit command options when the user already knows what they want
- interactive fallback when the command lacks enough context

Example interaction shapes:

- `/workflow-next execute docs/plans/foo.md`
- `/workflow-next execute docs/plans/foo.md --done brainstorm --done plan`
- `/workflow-next verify --done brainstorm --done plan --done execute`

The exact argument syntax can be finalized during planning, but the command must support both:

- direct declarative usage
- interactive completion of missing context

### D. Command Ergonomics

Use the newer async command completion support to improve `/workflow-next`.

Possible completion targets:

- valid workflow phases
- known artifact paths such as matching files under `docs/plans/`
- optional completion tokens such as `--done`
- possibly phase names after `--done`

The UX objective is not shell-like completeness. It is guided discovery so users can successfully hand off to the right phase without memorizing syntax.

### E. Extension Modernization Boundaries

This intervention may selectively adopt newer Pi helpers where they materially improve clarity or typing.

Allowed:

- `defineTool()` where it simplifies tool definitions or improves inference
- updated event semantics
- async command completions

Not required:

- broad conversion of every tool definition to a new helper if the current code is already clear
- unrelated refactoring of extension structure

## Data Model Changes

The persisted workflow/session state should grow to include declared phase completions in a way that is backward compatible.

Example conceptual shape:

```ts
interface WorkflowState {
  currentPhase: Phase | null;
  inferredCompletePhases: Phase[];
  declaredCompletePhases: Phase[];
  promptedBoundaries: TransitionBoundary[];
  lastArtifactPath?: string | null;
}
```

Migration rule:

- old saved state without declared completions loads as `declaredCompletePhases = []`

This is an additive change and should not invalidate existing stored state.

## Behavioral Rules

### Session Start Semantics

For Pi `0.65.x+`:

- `startup`: initialize widgets and persistent state without treating it as a workflow handoff
- `reload`: rebuild extension-local state/UI bindings without treating it as phase progression
- `new`: reconstruct persistent workflow state for the new session context, clear ephemeral tool-result buffers, and honor any declared phase completions created by the handoff
- `resume`: same category as `new`, but with resume-specific provenance when useful in UI text
- `fork`: same category as `new`, but preserve the fork mental model for user-facing messages when appropriate

### Declared Phase Completion

When a user declares earlier phases complete:

- prompts for those earlier phases must not fire
- completion gates should treat them as resolved
- workflow tracking may still infer later state, but it must not contradict the explicit declaration in UX decisions

### Transition Prompting

Prompting should become more context-aware:

- if the user explicitly declared prior phases complete, do not prompt to "go back"
- if context is ambiguous, offer an interactive clarification once
- avoid duplicate prompts after `new`, `resume`, or `fork`

## File and Module Impact

Likely touch points:

- `extensions/workflow-monitor.ts`
- `extensions/plan-tracker.ts`
- `extensions/workflow-monitor/workflow-tracker.ts`
- `extensions/workflow-monitor/skip-confirmation.ts`
- `extensions/workflow-monitor/workflow-handler.ts`
- a new shared session-transition module
- command-related tests for `/workflow-next`
- lifecycle and state-persistence tests

Potential new files:

- `extensions/shared/session-transition.ts`
- `tests/extension/shared/session-transition.test.ts`

## Testing Strategy

### Unit Tests

- transition normalization for:
  - `startup`
  - `reload`
  - `new`
  - `resume`
  - `fork`
  - legacy compatibility cases when provided
- workflow-state merge rules between inferred and declared phases
- command argument parsing for `/workflow-next`

### Extension Integration Tests

- `workflow-monitor` state reconstruction after `session_start(reason)`
- `plan-tracker` widget reconstruction after `session_start(reason)`
- `/workflow-next` with artifact only
- `/workflow-next` with explicit prior-phase declarations
- `/workflow-next` with interactive fallback
- no duplicate prompts after `new`, `resume`, or `fork`
- state persistence compatibility with previously stored workflow state

### Regression Tests

- existing branch-safety reset behavior still works
- completion gating still respects execute/verify/review flow
- legacy fake event usage in tests is either migrated or intentionally adapter-backed

## Rollout Plan

1. Introduce the shared session-transition adapter and cover it with tests
2. Migrate `workflow-monitor` to the adapter and Pi `0.65.x+` semantics
3. Migrate `plan-tracker` to the adapter
4. Introduce declared phase completion support in workflow state
5. Modernize `/workflow-next` with explicit plus interactive handoff flows
6. Update and expand tests
7. Optionally adopt selected SDK helpers such as async command completions and `defineTool()` where they improve maintainability

## Risks and Mitigations

### Risk: confusing inferred vs declared state

Mitigation:

- keep the model explicit in code and tests
- use "declared wins" as the single conflict rule

### Risk: regressions in existing session-state reconstruction

Mitigation:

- adapter-based normalization with focused tests
- preserve additive state migration

### Risk: `/workflow-next` becomes too complex

Mitigation:

- keep the primary command path simple
- use interactive fallback only when command input is incomplete or ambiguous

### Risk: over-investing in backward compatibility

Mitigation:

- target Pi `0.65.x+` first
- only preserve older behavior where it falls out naturally from the adapter or existing tests

## Planning Decisions To Finalize

The implementation plan must make these concrete, but the accepted design already constrains the allowed choices:

- `/workflow-next` argument syntax must support repeated explicit phase declarations and an interactive fallback
- declared phase state must be stored as an additive extension of the current workflow persistence model
- shared transition helpers should live either in `extensions/shared/` or, if that adds unnecessary indirection, in a focused workflow-monitor submodule used by both extensions
- `defineTool()` should only be adopted in files touched by this intervention and only where it improves maintainability or inference

## Recommendation

Proceed with a modernization centered on session transitions and workflow handoff UX.

This gives the package a clean adaptation path for Pi `0.65.x+`, reduces future breakage from SDK churn, and materially improves the real-world workflow where users enter Pi at different points in the lifecycle instead of always starting from brainstorm.
