# Engineering Skill: Context System & Documentation Maintenance (`skills/documentation.md`)

This document defines standards for maintaining the SAMSTACK AI Context System inside `/agents`, ensuring zero hallucination, strict traceability, file standard compliance, and documentation cross-linking.

---

## Purpose

To ensure that all future documentation updates, architectural record modifications, and state tracking files created inside `agents/` adhere strictly to standard rules, empirical verification, and zero hallucination.

---

## Scope

Applies to all markdown documents located in `agents/`, `agents/plan/`, `agents/skills/`, and `agents/state/`.

---

## Verified Information

- **Primary Governance Rule**: Every markdown file inside `agents/` MUST contain all 11 standard sections.
- **Strict No-Hallucination Policy**: Information must be directly traceable to codebase files or specifications (`samstack-ai-frd-phase1-FINAL.md`, `AGENTS.md`, `samstack-implementation-reference.md`, `docs/`).
- **Unverified Field Handling**: If information cannot be verified, write: `> UNKNOWN — Requires human confirmation.`

---

## Implementation Details

### 1. Mandatory 11 Standard Sections
Every single `.md` file created or modified in `agents/` MUST include these exact heading lines:

1. `## Purpose`
2. `## Scope`
3. `## Verified Information`
4. `## Implementation Details`
5. `## Important Files`
6. `## Dependencies`
7. `## Risks`
8. `## Future Improvements`
9. `## Unknown Information`
10. `## Last Verified Date`
11. `## Verification Source`

### 2. Relative & Absolute File Link Format
- Use markdown links with `file://` scheme referencing exact workspace paths.
- Example: `[`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md)`
- Include line anchors when referencing specific sections: `#line=123-145`.

### 3. State Tracking Rules
- When an FR-XX requirement is completed, update:
  - `agents/state/current.md` (Update current sprint focus)
  - `agents/state/pending.md` (Remove completed FR)
  - `agents/state/completed.md` (Add completed FR with verification notes)
  - `agents/state/changelog.md` (Log specification/implementation change)

---

## Important Files

- [`agents/README.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/agents/README.md) — System index
- [`agents/AI_RULES.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/agents/AI_RULES.md) — Operating rules

---

## Dependencies

- Standard Markdown / GitHub Flavored Markdown (GFM)

---

## Risks

- **Documentation Drift**: Updating code implementation without updating corresponding `agents/plan/` and `agents/state/` files.
- **Section Omission**: Creating a markdown file in `agents/` that omits one or more of the 11 standard sections.
- **Hallucinating Unverified Requirements**: Fabricating API parameters or DB schemas not present in source documents.

---

## Future Improvements

- Automated Markdown Linter verifying that all `.md` files in `agents/` contain all 11 standard section headers.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: CI linter tool for validating markdown link integrity across `/agents`.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`agents/README.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/agents/README.md)
- [`agents/AI_RULES.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/agents/AI_RULES.md)
