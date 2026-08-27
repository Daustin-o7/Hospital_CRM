# SAMSTACK AI — AI Operating Rules (`AI_RULES.md`)

This document defines the strict, non-negotiable operating rules and architectural constraints for any AI assistant operating within the SAMSTACK AI (`Hospital_CRM`) repository.

---

## Purpose

To enforce non-negotiable boundaries, safety rules, security standards, and architectural discipline across all automated and AI-assisted development tasks, preventing scope creep, security degradation, or architectural drift.

---

## Scope

Applies to all AI assistants (ChatGPT, Codex, Claude Code, Antigravity, Cline, Roo Code, Cursor, Windsurf, OpenCode, etc.) and human developers modifying any file in this repository.

---

## Verified Information

- **Ground Rule 1**: The FRD (`samstack-ai-frd-phase1-FINAL.md`) is authoritative for Phase 1 (FR-01 through FR-22). Build what is in it; do not build what isn't.
- **Ground Rule 2**: Apply the "Ponytail" decision ladder before writing code: *Does this need to exist? -> Already in codebase? -> Native platform / stdlib? -> Installed dependency? -> One line? -> Only then write something new.*
- **Ground Rule 3**: `tenant_id` must be present on every tenant-scoped DB table, but multi-tenancy logic remains dormant during single-tenant Phase 1.
- **Ground Rule 4**: Audit logs are append-only, enforced at the database role level (`REVOKE UPDATE, DELETE`).
- **Ground Rule 5**: Offline tolerance (FR-22) applies strictly to patient registration (FR-06) and billing/invoicing (FR-17/18) using client-side IndexedDB and idempotency keys — not a general patient database cache.
- **Ground Rule 6**: Clinical notes (FR-14) and prescriptions (FR-15) are NEVER silently edited or overwritten. Amendments create a new versioned row linked to the original.

---

## Implementation Details

### Strict Operating Rules

1. **NEVER Hallucinate Information**: Do not invent APIs, database columns, parameters, or business rules not verified from repository files. If information is missing, explicitly state `> UNKNOWN — Requires human confirmation.`
2. **NEVER Rename Existing Files**: File renaming breaks existing link structures and cross-cutting references across context files.
3. **NEVER Modify Auth/Authorization Specs**: Do not alter JWT RS256 signing, 15-minute token TTL, refresh token rotation, 30-minute inactivity timeouts, or server-side RBAC rules.
4. **NEVER Alter Database Schemas Arbitrarily**: All database changes must strictly align with the FRD schema notes and include dormant `tenant_id` columns.
5. **NEVER Remove Validation or Logging**: Do not bypass input validation, rate limiting, audit logging, or error handling to simplify code.
6. **NEVER Upgrade Dependencies Automatically**: Do not bump major package versions (.NET, React, PostgreSQL drivers) unless explicitly instructed by a human engineer.
7. **NEVER Edit Generated Files or Completed Migrations**: Database migration scripts once committed are immutable. Create new migrations for adjustments.
8. **NEVER Break Backward Compatibility**: Keep API request/response contracts backward-compatible.
9. **ALWAYS Read `/agents` First**: Read context files in `agents/` before starting work on any task.
10. **ALWAYS Ask Before Destructive Changes**: Deleting code files, dropping tables, or altering primary keys requires explicit human confirmation.
11. **NEVER Push to Git Without Approval**: Never execute `git push` or run automated Git commits without explicit user approval.
12. **ALWAYS Create a Feature Branch First**: Always create a feature branch before committing or pushing changes to `main`.
13. **USER Controls Git Operations**: Let the user execute Git operations; only perform Git operations when explicitly asked by the user.

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md) — Authoritative functional specification
- [`AGENTS.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/AGENTS.md) — Ground rules & scope boundaries
- [`CLAUDE.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/CLAUDE.md) — Ponytail review requirements
- [`TOOLING-SETUP.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/TOOLING-SETUP.md) — Ponytail decision ladder

---

## Dependencies

- Host Environment: Windows / PowerShell / bash
- Tools: Antigravity IDE, Claude Code, OpenCode, ponytail CLI plugin

---

## Risks

- **Unauthorized Scope Expansion**: Adding Track 2 (Pharmacy), Track 3 (AI), Track 4 (IPD), or ABDM integrations into Phase 1 builds.
- **Bypassing Database-Level Security**: Attempting to implement audit append-only logic in application code without DB role permissions.
- **Client-Side Security Blindspots**: Relying on UI hiding instead of server-side API authorization.

---

## Future Improvements

- Automated git pre-commit hook enforcing `AI_RULES.md` checks on diffs.
- Automated static analyzer checking for missing `tenant_id` columns in new migrations.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Specific CI tool for automated rule enforcement in GitHub actions pipeline.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`AGENTS.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/AGENTS.md)
- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=1-200)
