---
name: debug-loop
description: >
  Disciplined diagnosis loop for hard bugs and performance issues in the VSC
  Scheduler. Reproduce → Minimise → Hypothesise → Instrument → Fix →
  Regression-test. Use when user says "debug this", "this is broken",
  "something is wrong", reports a bug, or describes a regression.
---

# Debug Loop

A disciplined, 6-phase approach for diagnosing and fixing bugs in the VSC
Scheduler (Node.js/Express/SQLite/vanilla JS stack).

## When to Use

- User reports a bug, error, or unexpected behaviour
- Something is broken in the scheduler, auth, API, or UI
- Performance issues (slow queries, N+1 requests, timeout)
- Conflicts not being detected correctly
- Permission checks failing unexpectedly

---

## Phase 1 — Build a Feedback Loop

**This is the skill.** Everything else is mechanical. If you have a fast,
agent-runnable pass/fail signal for the bug, you will find the cause. If you
don't have one, no amount of staring at code will save you.

### Ways to construct a loop (try in order)

1. **Failing Jest test** at the seam that reaches the bug
2. **curl / HTTP script** against the running dev server
3. **CLI invocation** with a fixture input, diffing output against a known-good
4. **Headless browser** (Playwright/Puppeteer) driving the UI
5. **Replay a captured trace** — save a real request/payload to disk, replay it
6. **Throwaway harness** — minimal subset (one service, mocked deps)
7. **Property/fuzz loop** — 1000 random inputs, look for failure mode
8. **Bisection harness** — automate "boot at state X, check, repeat"
9. **Differential loop** — old-version vs new-version, diff outputs

For the VSC Scheduler:
- Most useful: `curl` against `localhost:3000` + Jest tests
- Conflict detection bugs: test with real game data via `curl`
- UI bugs: test via direct DOM inspection in the browser

### Iterate on the loop

- Can you make it faster? (Cache setup, skip unrelated init, narrow scope)
- Can you make the signal sharper? (Assert on the specific symptom)
- Can you make it more deterministic? (Pin time, seed RNG, isolate filesystem)

**Do not proceed to Phase 2 without a loop you believe in.**

---

## Phase 2 — Reproduce

Run the loop. Watch the bug appear.

Confirm:
- [ ] The loop produces the exact failure the user described
- [ ] The failure is reproducible across multiple runs
- [ ] You have captured the exact symptom (error message, wrong output, timing)

---

## Phase 3 — Hypothesise

Generate **3–5 ranked hypotheses** before testing any of them.

Each must be **falsifiable**:
> "If <X> is the cause, then <changing Y> will make the bug disappear."

If you cannot state the prediction, the hypothesis is a vibe — discard or sharpen it.

**Show the ranked list to the user before testing.** They may have domain
knowledge that re-ranks instantly.

---

## Phase 4 — Instrument

Each probe must map to a specific prediction from Phase 3. Change **one
variable at a time**.

Tool preference:
1. **Debugger / REPL inspection** — one breakpoint beats ten logs
2. **Targeted logs** at boundaries that distinguish hypotheses
3. Never "log everything and grep"

**Tag every debug log** with a unique prefix, e.g. `[DEBUG-<code>]`.
Cleanup becomes a single grep. Untagged logs survive; tagged logs die.

Perf branch: For performance, establish a baseline first, then bisect.

---

## Phase 5 — Fix + Regression Test

Write the regression test **before** the fix — but only if there's a correct
seam.

A correct seam is one where the test exercises the **real bug pattern** as it
occurs at the call site.

**If no correct seam exists, that itself is the finding.** Note it. The codebase
architecture is preventing the bug from being locked down.

If a correct seam exists:
1. Turn the minimised repro into a failing test
2. Watch it fail
3. Apply the fix
4. Watch it pass
5. Re-run the Phase 1 loop against the original scenario

---

## Phase 6 — Cleanup + Post-Mortem

Required before declaring done:
- [ ] Original repro no longer reproduces
- [ ] Regression test passes
- [ ] All `[DEBUG-<code>]` instrumentation removed (`grep` the prefix)
- [ ] Throwaway prototypes deleted
- [ ] The correct hypothesis stated in commit message

**Then ask: what would have prevented this?** If the answer involves
architectural change, flag it for the next refactor cycle.
