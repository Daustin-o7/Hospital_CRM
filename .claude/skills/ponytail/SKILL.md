---
name: ponytail
description: Enforces lean, minimal engineering discipline based on github.com/DietrichGebert/ponytail. Stops over-engineering, unnecessary package installations, over-abstraction, and premature optimization. Run before writing code or making pull requests.
---

# ponytail — Minimal Engineering Discipline

Reference repository: [github.com/DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)

## Overview
`ponytail` is a design and code review discipline designed to prevent scope creep, dependency inflation, over-abstraction, and over-building. Before writing any code, the agent MUST stop at the first rung of the decision ladder that holds.

## The Ponytail Decision Ladder

1. **Rung 1: Does this need to exist?**
   - Check `samstack-ai-frd-phase1-FINAL.md` and `AGENTS.md`. If it's not in Phase 1 scope (FR-01 through FR-22), DO NOT build it.
2. **Rung 2: Is it already in this codebase?**
   - Check existing services, utilities, and components before writing new helper functions.
3. **Rung 3: Can the native platform or standard library handle it?**
   - Prefer native C# / ASP.NET Core stdlib methods or native Web APIs over third-party packages.
4. **Rung 4: Is there an already-installed dependency that can handle it?**
   - Reuse existing packages in `package.json` or `.csproj` instead of adding new dependencies.
5. **Rung 5: Can it be done in one simple line?**
   - Keep implementations minimal and direct. Avoid multi-layered wrapper classes for single functions.
6. **Rung 6: Only then, write the minimal custom code required.**
   - Write clean, maintainable, defensive code meeting acceptance criteria.

## Lazy, Not Negligent Principle
Never skip input validation, error handling, security checks, role-based access control, or accessibility to simplify code. Those are mandatory safety standards, not optional bloat.

## Command Reference

| Command | What it does |
|---|---|
| `/ponytail [lite\|full\|ultra\|off]` | Set intensity level or inspect current mode (Default: `full`) |
| `/ponytail-review` | Review the current diff for over-building/over-engineering, generating a delete/refactor list |
| `/ponytail-audit` | Audit the entire repository for bloat, unnecessary packages, and unnecessary abstractions |
| `/ponytail-help` | Display ponytail command reference and decision rules |

## Integration Standards
- **Claude Code**: `/plugin marketplace add DietrichGebert/ponytail` then `/plugin install ponytail@ponytail`
- **OpenCode**: Include `{ "plugin": ["@dietrichgebert/ponytail"] }` in `opencode.json`
- **Antigravity**: Loaded automatically via `.agents/skills/ponytail/SKILL.md`
