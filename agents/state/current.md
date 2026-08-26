# System State: Current Sprint & Implementation Focus (`state/current.md`)

This document defines the current active implementation milestone, sprint focus, and immediate tasks for SAMSTACK AI.

---

## Purpose

To track the exact current work focus, active requirements under development, and immediate action items.

---

## Scope

Covers current kickoff state and initial Phase 1 build tasks (FR-01 through FR-22).

---

## Verified Information

- **Current Milestone**: Phase 1 Implementation Kickoff & Foundation Setup.
- **Active Focus**: Establishing the single source of truth AI Context System (`agents/`), followed by solution initialization (.NET 10 backend + React 19 PWA frontend) and FR-01 Authentication / DB Migrations.
- **Immediate Task Sequence**:
  1. Complete creation of production-grade `agents/` context system.
  2. Initialize `.NET 10` backend solution and EF Core PostgreSQL DbContext with dormant `tenant_id` handling.
  3. Implement FR-01 Authentication & JWT RS256 token verification.

---

## Implementation Details

```
[ Active Workstream ]
  ├── Task 1: Complete /agents AI Context System (Current)
  ├── Task 2: Initialize .NET 10 Solution & DbContext
  ├── Task 3: Implement FR-01 Login & JWT RS256
  └── Task 4: Implement FR-06 Registration & FR-09 Consent Capture
```

---

## Important Files

- [`agents/README.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/agents/README.md) — AI Context System entry point
- [`.claude/skills/new-fr/SKILL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/.claude/skills/new-fr/SKILL.md) — Implementation sequence

---

## Dependencies

- .NET 10 SDK & Node.js environment
- PostgreSQL local database instance

---

## Risks

- **Bypassing Build Sequence**: Jumping straight to UI components before creating underlying EF Core migrations and DB role security policies.

---

## Future Improvements

- Automated status badge updating in `agents/state/current.md` via git hooks.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Specific local port assignments for backend API (`https://localhost:7001`) and Vite frontend (`http://localhost:5173`).

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`README.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/README.md)
- [`.claude/skills/new-fr/SKILL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/.claude/skills/new-fr/SKILL.md)
