# Engineering Skill: Ponytail Minimal Engineering Discipline (`skills/ponytail.md`)

This document defines the `ponytail` engineering discipline, decision ladder rules, command references, and cross-tool skill integrations based on [github.com/dietrichgebert/ponytail](https://github.com/dietrichgebert/ponytail).

---

## Purpose

To prevent scope creep, over-engineering, unnecessary package installations, over-abstraction, and premature optimization across all AI assistants (Antigravity, OpenCode, Claude Code, etc.) working on SAMSTACK AI.

---

## Scope

Applies to all code contributions, architecture designs, component structures, package additions, and pull requests across the entire SAMSTACK AI codebase.

---

## Verified Information

- **Reference Repository**: `https://github.com/dietrichgebert/ponytail`
- **Core Principle**: Stop at the first rung of the decision ladder before writing code or introducing new dependencies.
- **Lazy, Not Negligent Line**: Validation, error handling, security, and accessibility are mandatory safety requirements and must never be skipped under the guise of minimal code.
- **Default Mode**: `full` (configurable via `PONYTAIL_DEFAULT_MODE` environment variable).

---

## Implementation Details

### The 6-Rung Ponytail Decision Ladder

```
[ Rung 1: Does this need to exist? ]
   │ Check samstack-ai-frd-phase1-FINAL.md (FR-01 to FR-22). If not in scope, STOP.
   ▼
[ Rung 2: Is it already in this codebase? ]
   │ Check existing utilities, services, and components. Reuse them.
   ▼
[ Rung 3: Can native platform / stdlib handle it? ]
   │ Use native C# / ASP.NET Core stdlib methods or native Web APIs.
   ▼
[ Rung 4: Can an already-installed dependency handle it? ]
   │ Check package.json or .csproj. Do not add new packages.
   ▼
[ Rung 5: Can it be done in one simple line? ]
   │ Avoid multi-layered wrapper classes for single functions.
   ▼
[ Rung 6: Only then, write minimal custom code. ]
   │ Write clean, maintainable, defensive code meeting acceptance criteria.
```

### Slash Commands & Tools Reference

- `/ponytail [lite|full|ultra|off]`: Set intensity level or inspect active mode.
- `/ponytail-review`: Run diff review against current changes to flag over-engineered code and generate a deletion list.
- `/ponytail-audit`: Audit the entire codebase for bloat and unnecessary dependencies.
- `/ponytail-help`: View command reference and rules.

### Cross-Tool Skill Configuration

| Tool / Host | Config Location | Execution Mode |
|---|---|---|
| **Antigravity / AGY** | `.agents/skills/ponytail/SKILL.md` | Auto-loaded via `.agents` customization root |
| **OpenCode** | `opencode.json` (`{ "plugin": ["@dietrichgebert/ponytail"] }`) & `.opencode/skills/ponytail/SKILL.md` | Auto-loaded plugin + skill |
| **Claude Code** | `.claude/skills/ponytail/SKILL.md` & `/plugin install ponytail@ponytail` | Auto-loaded plugin + skill |

---

## Important Files

- [`.agents/skills/ponytail/SKILL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/.agents/skills/ponytail/SKILL.md) — Antigravity skill
- [`.claude/skills/ponytail/SKILL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/.claude/skills/ponytail/SKILL.md) — Claude Code skill
- [`.opencode/skills/ponytail/SKILL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/.opencode/skills/ponytail/SKILL.md) — OpenCode skill
- [`opencode.json`](file:///e:/Company/Hospital%20Management/Hospital_CRM/opencode.json) — OpenCode plugin config
- [`TOOLING-SETUP.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/TOOLING-SETUP.md) — Tooling setup instructions

---

## Dependencies

- Node.js runtime (for running ponytail hooks in Claude Code and OpenCode)
- `@dietrichgebert/ponytail` package

---

## Risks

- **Skipping Mandatory Safeguards**: Omitting input validation or role authorization to achieve "minimal code" (violates the "lazy, not negligent" principle).
- **Tool Desynchronization**: Editing ponytail rules in one tool's directory without updating the matching SKILL.md files in other tool folders.

---

## Future Improvements

- Automated git pre-commit hook executing `/ponytail-review` on staged diffs before commit.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Selection of default ponytail intensity mode (`lite` vs `full` vs `ultra`) for production CI pipeline.

---

## Last Verified Date

2026-08-27

---

## Verification Source

- [`https://github.com/dietrichgebert/ponytail`](https://github.com/dietrichgebert/ponytail)
- [`TOOLING-SETUP.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/TOOLING-SETUP.md)
