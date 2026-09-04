# System State: Overall Project Context (`state/context.md`)

This document defines the current macro context, phase status, repository layout, active target scope, and primary reference documents for SAMSTACK AI.

---

## Purpose

To provide a high-level snapshot of the project's macro state, phase milestone, repository readiness, and foundational reference documentation.

---

## Scope

Covers the overall SAMSTACK AI codebase state as of 26 August 2026.

---

## Verified Information

- **Project Name**: SAMSTACK AI (Doctor/Clinic CRM) - `Hospital_CRM`
- **Active Phase**: Phase 2 Track 1 Fast-Follow (6 of 11 modules shipped).
- **Repository Readiness**: Phase 1 (FR-01–22) complete with seed data. Phase 2 partially shipped (MOD-23, 24, 25, 12, 13 + Phase 1 FR-20/21 migration to MOD-13). 5 modules remaining (MOD-08, 09, 10, 11, 14).
- **Target Pilot Milestone**: Land 3–5 paying pilot clinics on Phase 1 within ~10 weeks of build start.

---

## Implementation Details

### Active Context & Artifact Map

```
Hospital_CRM/
├── docs/product/
│   ├── FRD_FINAL.md                 # Phase 1 master FRD (FR-01 to FR-22)
│   ├── FRD-Phase-2-FINAL.md         # Phase 2 FRD (9 modules)
│   ├── WORKFLOW.md                  # ★ Complete Phase 1+2 workflow (every FR, diagrams, endpoint map)
│   └── ...
├── FRD-Phase-2-FINAL.md              # Phase 2 FRD (all 9 modules)
├── TRD-Phase2-V1.md                  # Phase 2 TRD (Hangfire, blob storage)
├── PRD-Phase2-V1.md                  # Phase 2 PRD with journey stories
├── AGENTS.md                         # Agent Ground Rules & Stack Constraints
├── CLAUDE.md                         # Host Notes & Ponytail Review Setup
├── TOOLING-SETUP.md                  # Tooling Setup & Decision Ladder
├── samstack-implementation-reference.md  # Razorpay / WhatsApp / JWT / Sync Reference
├── memory.md                         # Session working memory
├── agents/                           # Single Source of Truth AI Context System
├── backend/                          # .NET 10 implementation (Phase 1 + Phase 2)
└── frontend/                         # React 19 PWA
```

---

## Important Files

- [`docs/product/WORKFLOW.md`](file://docs/product/WORKFLOW.md) — **Complete Phase 1 + Phase 2 workflow** with ASCII diagrams, patient journey, endpoint map
- [`samstack-ai-frd-phase1-FINAL.md`](file://samstack-ai-frd-phase1-FINAL.md) — Phase 1 Master FRD
- [`FRD-Phase-2-FINAL.md`](file://FRD-Phase-2-FINAL.md) — Phase 2 FRD
- [`AGENTS.md`](file://AGENTS.md) — Project Brief & Rules
- [`samstack-implementation-reference.md`](file://samstack-implementation-reference.md) — Implementation Reference

---

## Dependencies

- Managed Azure Entra External ID OIDC setup (not yet — using local JWT RS256 with persistent key)
- PostgreSQL 16+ database host ✅
- Razorpay Merchant Account (not yet — stub)
- Meta / BSP WhatsApp Business API Account (not yet — stub)

---

## Risks

- **Scope Drift**: Adding features not in FRD-Phase-2 § MOD-08/09/10/11/14 sections.
- **Phase 1 Regression**: MOD-13 migration of FR-20/21 to rules-based must not break the existing booking/reminder flow (verified — defaults seeded, Phase 1 path still works).

---

## Future Improvements

- Hangfire migration for `NotificationRulesWorker` when job count > 3.
- Blob storage choice for MOD-08 lab result file uploads.
- MOD-11 Finance Ledger scope review (defer past pilot if needed).

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Date of first pilot clinic deployment kickoff.

---

## Last Verified Date

2026-08-30

---

## Verification Source

- [`README.md`](file://README.md)
- [`FRD-Phase-2-FINAL.md`](file://FRD-Phase-2-FINAL.md)
