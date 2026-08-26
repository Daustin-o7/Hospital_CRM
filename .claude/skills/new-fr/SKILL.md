---
name: new-fr
description: Use when implementing any FR-XX from samstack-ai-frd-phase1-FINAL.md. Ensures every requirement gets the same consistent build sequence — migration, endpoint, role check, audit hook, UI — rather than each one being designed from scratch.
---

# Implementing an FR from the FRD

**Place this file at `.claude/skills/new-fr/SKILL.md` for Claude Code, or `.opencode/skills/new-fr/SKILL.md` for OpenCode** — same content, both tools read the same SKILL.md convention (frontmatter + instructions), no adaptation needed between them.

## Before starting
Read the specific FR-XX section in full: description, user story, workflow, edge cases, acceptance criteria, API shape, DB schema notes, security notes, NFR mapping. All of it, not just the API shape — the edge cases are frequently where the real work is.

## Sequence
1. **Database migration** — implement exactly the schema in the FR's "Database Schema Notes." Include `tenant_id` even though dormant (AGENTS.md ground rule #3). If the FR touches patient/clinical data, confirm the audit table exists and is append-only at the DB role level (see samstack-implementation-reference.md) before writing anything else.
2. **API endpoint** — match the FR's "API Shape" exactly: same request/response fields, same status codes for the same conditions. Don't add fields "while you're in there" — that's scope the FRD didn't ask for.
3. **Role enforcement** — apply the role check from the FR's Roles line and cross-check against §8 of the FRD. Server-side only; never trust a client-supplied role (FR-02).
4. **Edge cases from the FR** — implement each one listed, not just the happy path. If an edge case implies a design decision the FR doesn't fully specify, check the FRD's §18 Validation Checklist and §9 Contradictions sections first — it may already be resolved there.
5. **Audit/notification hooks** — if the FR is one of FR-08/09/14/15 (audit-relevant) or triggers FR-20/21 (notification-relevant), wire that now, not as an afterthought.
6. **UI** — build to the FR's workflow steps. Mobile-first (React 19 PWA). If the FR is one Ponytail would flag as over-buildable (a form with no real complexity, a list view), let the ladder run — see TOOLING-SETUP.md.
7. **Test against acceptance criteria** — each checkbox in the FR's "Acceptance Criteria" list is a test case, not a suggestion. If a criterion can't be verified by a test, that's worth flagging, not skipping.

## Before marking done
Run `/ponytail-review` on the diff. If it flags something, read why before dismissing it — the FRD's acceptance criteria set the floor, not a reason to ignore an over-build flag on everything above that floor.

## If the FR conflicts with another FR or an NFR
Don't resolve it silently. Check FRD §9 (Template Adaptations & Resolved Contradictions) and §18 (Validation Checklist) first — many likely conflicts were already found and resolved there. If it's genuinely new, flag it the same way those sections did: name the conflict, propose a resolution, don't just pick one silently.
