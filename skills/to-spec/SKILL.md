---
name: to-spec
description: >
  Turn current conversation context into a detailed technical specification
  and publish it to the project issue tracker. Use when user wants to create
  a spec from the current context, plan a feature, or document a design.
---

# To Spec

Take the current conversation context and codebase understanding and produce a
technical specification. Do NOT interview the user — just synthesise what
you already know.

The issue tracker: `n1ghtfr0sty/vsc-scheduler` (GitHub).
Apply the `ready-for-agent` triage label after publishing — no additional
triage needed.

## Process

### 1. Explore

Understand the current state of the codebase. Use the project's domain
glossary vocabulary throughout the spec, and respect ADRs and conventions
in AGENTS.md.

### 2. Sketch the seams

Sketch out the seams at which you're going to test the feature. Existing
seams should be preferred to new ones. Use the highest seam possible.

Check with the user that these seams match their expectations.

### 3. Write the spec using the template below

<spec-template>

## Problem Statement

The problem the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

Numbered list of user stories:

1. As an `<actor>`, I want a `<feature>`, so that `<benefit>`

Cover all aspects of the feature exhaustively.

## Implementation Decisions

List of implementation decisions. Include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. Exception: if a
prototype produced a snippet that encodes a decision more precisely than
prose can (state machine, reducer, schema shape), inline it and note
that it came from a prototype.

## Testing Decisions

- A description of what makes a good test (only test external behaviour)
- Which modules will be tested
- Prior art for the tests (similar types of tests in the codebase)

## Out of Scope

Things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

</spec-template>

### 4. Publish to Issue Tracker

Publish the spec as a new GitHub issue. Add the `enhancement` and
`ready-for-agent` labels. Do not close or modify any parent issue.
