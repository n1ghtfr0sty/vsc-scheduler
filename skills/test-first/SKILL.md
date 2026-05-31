---
name: test-first
description: >
  Test-driven development with red-green-refactor loop. Use when user wants
  to build features or fix bugs using TDD, mentions "red-green-refactor",
  wants integration tests, or asks for test-first development.
---

# Test-Driven Development

## Philosophy

**Core principle:** Tests should verify behaviour through public interfaces,
not implementation details. Code can change entirely; tests shouldn't.

**Good tests** are integration-style: they exercise real code paths through
public APIs. They describe _what_ the system does, not _how_ it does it.

**Bad tests** are coupled to implementation. They mock internal collaborators,
test private methods, or verify through external means. The warning sign: your
test breaks when you refactor, but behaviour hasn't changed.

## Anti-Pattern: Horizontal Slices

**DO NOT** write all tests first, then all implementation. This is "horizontal
slicing" — treating RED as "write all tests" and GREEN as "write all code."

This produces **crap tests**:
- Tests written in bulk test _imagined_ behaviour, not _actual_ behaviour
- You end up testing the _shape_ of things rather than user-facing behaviour
- Tests become insensitive to real changes

**Correct approach:** Vertical slices via tracer bullets. One test → one
implementation → repeat.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  ...
```

## Workflow

### 1. Planning

Before writing any code:
- [ ] Confirm with user what interface changes are needed
- [ ] Confirm with user which behaviours to test (prioritise)
- [ ] Identify opportunities for deep modules (small interface, deep impl)
- [ ] List the behaviours to test (not implementation steps)
- [ ] Get user approval on the plan

Ask: "What should the public interface look like? Which behaviours are most
important to test?"

**You can't test everything.** Confirm exactly which behaviours matter most.

### 2. Tracer Bullet

Write ONE test that confirms ONE thing about the system:

```
RED:   Write test for first behaviour → test fails
GREEN: Write minimal code to pass → test passes
```

This is your tracer bullet — proves the path works end-to-end.

### 3. Incremental Loop

For each remaining behaviour:

```
RED:   Write next test → fails
GREEN: Minimal code to pass → passes
```

Rules:
- One test at a time
- Only enough code to pass current test
- Don't anticipate future tests
- Keep tests focused on observable behaviour

### 4. Refactor

After all tests pass, look for refactor candidates:
- [ ] Extract duplication
- [ ] Deepen modules (move complexity behind simple interfaces)
- [ ] Apply SOLID principles where natural
- [ ] Consider what new code reveals about existing code
- [ ] Run tests after each refactor step

**Never refactor while RED.** Get to GREEN first.

## VSC Scheduler Test Patterns

### API Route Tests

```javascript
// Test the endpoint, not the implementation
describe('POST /api/games', () => {
  it('rejects games with overlapping times for the same team', async () => {
    const res = await request(app)
      .post('/api/games')
      .send({ /* valid payload */ });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('conflict');
  });
});
```

### Conflict Detection Tests

```javascript
describe('detectConflicts()', () => {
  it('detects same-team double-booked games', () => {
    const conflicts = detectConflicts(game1, game2);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('team');
  });

  it('applies travel time for different locations', () => {
    // ...
  });
});
```

### Frontend Tests

For vanilla JS (no framework), test the _output_ of DOM manipulation:

```javascript
describe('renderConflictBanner()', () => {
  it('creates a banner element with conflict details', () => {
    const banner = renderConflictBanner(conflict);
    expect(banner.className).toBe('conflict-banner');
    expect(banner.textContent).toContain('Conflict detected');
  });
});
```

## Checklist Per Cycle

```
[ ] Test describes behaviour, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Code is minimal for this test
[ ] No speculative features added
```
