# VSC Scheduler — Custom Agent Skills

Inspired by [Matt Pocock's skills repository](https://github.com/mattpocock/skills), these 5 skills are adapted for the VSC Scheduler codebase and workflow.

| Skill | Purpose |
|-------|---------|
| `debug-loop` | Disciplined 6-phase debugging: reproduce → minimise → hypothesise → instrument → fix → regression-test |
| `test-first` | Red-green-refactor TDD loop for Node.js/Express + vanilla JS |
| `issue-triage` | GitHub issue triage state machine for the VSC Scheduler board |
| `concise` | Ultra-compressed communication mode (~75% token savings) |
| `to-spec` | Convert conversation context into technical specs and publish to GitHub issues |

## Usage

These skills are stored in the `skills/` directory. When you need to invoke one, reference it by name:

- `/debug-loop` — Start the debugging process
- `/test-first` — Begin test-driven development
- `/issue-triage` — Triage GitHub issues
- `/concise` — Switch to compressed responses
- `/to-spec` — Create a technical specification

## Design Principles

- **Tailored to this project**: All skills reference VSC Scheduler conventions, file structure, and tech stack
- **Small & composable**: Each skill is one focused responsibility
- **No external dependencies**: Works with any coding agent and any model
- **Progressive disclosure**: Read the SKILL.md when the skill is needed — nothing loads by default
