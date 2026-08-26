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
- **Active Phase**: Phase 1 — Track 1 (CRM + Billing), OPD Clinics, Shared SaaS Tier, India Region.
- **Repository Readiness**: Complete implementation package ready for Phase 1 build kickoff. Specifications, architecture reference, tooling guidelines, FRD v1.1, and discovery survey evidence (n=24) are fully finalized.
- **Target Pilot Milestone**: Land 3–5 paying pilot clinics on Phase 1 within ~10 weeks of build start.

---

## Implementation Details

### Active Context & Artifact Map

```
Hospital_CRM/
├── samstack-ai-frd-phase1-FINAL.md       # Master Functional Specification (FR-01 to FR-22)
├── AGENTS.md                             # Agent Ground Rules & Stack Constraints
├── CLAUDE.md                             # Host Notes & Ponytail Review Setup
├── TOOLING-SETUP.md                      # Tooling Setup & Decision Ladder
├── samstack-implementation-reference.md  # Razorpay / WhatsApp / JWT / Sync Reference
├── docs/                                 # Strategy, Sharpened Plan, Survey Analysis (n=24)
└── agents/                               # Single Source of Truth AI Context System
```

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md) — Master FRD
- [`AGENTS.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/AGENTS.md) — Project Brief & Rules
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md) — Implementation Reference

---

## Dependencies

- Managed Azure Entra External ID OIDC setup
- PostgreSQL 16+ database host
- Razorpay Merchant Account
- Meta / BSP WhatsApp Business API Account

---

## Risks

- **Scope Drift**: Committing engineering effort to Track 2 (Pharmacy), Track 3 (AI), or Track 4 (IPD) before Phase 1 pilot completion.

---

## Future Improvements

- Post-pilot expansion to Track 1 Fast-Follows (MOD-23 Pre-Check, MOD-24 Emergency Queue, MOD-25 Live Ticket).

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Date of first pilot clinic deployment kickoff.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`README.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/README.md)
- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md)
