# Engineering Skill: Git Conventions & Code Review Standards (`skills/git.md`)

This document defines version control practices, branch management, commit message formats, pull request standards, and `/ponytail-review` integration for SAMSTACK AI.

---

## Purpose

To establish consistent git workflows, clear commit traceability to FRD requirements, and rigorous automated code review standards across all contributions.

---

## Scope

Applies to all git commits, branch naming conventions, pull requests, migration commit rules, and diff reviews in this repository.

---

## Verified Information

- **Primary Specification Reference**: `samstack-ai-frd-phase1-FINAL.md` (FR-01 through FR-22)
- **Review Tooling Standard**: `/ponytail-review` execution before marking any FR-XX complete (`CLAUDE.md`, `TOOLING-SETUP.md`)
- **Skill Placement Standard**: `.claude/skills/new-fr/SKILL.md` and `.opencode/skills/new-fr/SKILL.md`
- **Migration Commit Rule**: Database migration files once committed are immutable.

---

## Implementation Details

### 1. Commit Message Convention
Commit messages MUST reference the specific FR-XX being implemented or modified:

```
feat(FR-06): implement patient registration endpoint and DPDP consent capture

- Added POST /api/v1/patients endpoint with duplicate phone check
- Integrated DPDP consent persistence in single DB transaction
- Added dormant tenant_id column and patient_audit_log DB migration
```

### 2. Standard Implementation Sequence per FR-XX
When completing any requirement (FR-01 to FR-22), follow the exact 7-step sequence defined in `.claude/skills/new-fr/SKILL.md`:

1. **Database Migration**: Implement exact FR schema, including dormant `tenant_id` and append-only DB audit roles.
2. **API Endpoint**: Implement exact REST URL shape, status codes, and request/response DTOs.
3. **Role Enforcement**: Apply server-side `[Authorize(Roles = "...")]` check matching FRD §8 role matrix.
4. **Edge Cases**: Handle every edge case explicitly listed in the FR spec.
5. **Audit / Notification Hooks**: Wire `patient_audit_log` or `AppointmentConfirmed` WhatsApp event triggers.
6. **UI Component**: Build mobile-first React 19 PWA screen adhering to ponytail minimal build discipline.
7. **Acceptance Criteria Verification**: Test and verify every acceptance criteria checkbox in the FR document.

### 3. Pre-Commit / Pre-PR Ponytail Review
Before marking any FR done, run `/ponytail-review` on the diff to detect unnecessary over-building or unrequested dependency additions.

---

## Important Files

- [`.claude/skills/new-fr/SKILL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/.claude/skills/new-fr/SKILL.md) — Standard FR build sequence
- [`CLAUDE.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/CLAUDE.md#line=6) — Ponytail review instructions
- [`TOOLING-SETUP.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/TOOLING-SETUP.md) — Tooling setup instructions

---

## Dependencies

- Git version control CLI
- Ponytail review plugin (`/ponytail-review`)

---

## Risks

- **Rewriting Committed Migrations**: Modifying existing EF Core migration files instead of generating a new sequential migration.
- **Squashing Context**: Deleting FR-XX references from commit history during rebase operations.

---

## Future Improvements

- Automated GitHub Action executing `/ponytail-review` checks on incoming Pull Requests.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Primary branch naming convention (`main` vs `master` vs `develop`).

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`.claude/skills/new-fr/SKILL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/.claude/skills/new-fr/SKILL.md)
- [`CLAUDE.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/CLAUDE.md)
