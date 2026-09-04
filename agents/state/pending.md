# System State: Pending Work & Functional Backlog (`state/pending.md`)

This document details the complete pending backlog of Phase 2 Track 1 Fast-Follow implementation tasks for SAMSTACK AI.

---

## Purpose

To provide a clear, prioritized tracking list of all upcoming functional requirements to be implemented during Phase 2.

---

## Scope

Covers all 9 Phase 2 modules defined in `FRD-Phase-2-FINAL.md`. Phase 1 (FR-01–22) is complete — see `completed.md`.

---

## Verified Information

### Pending (Post-Phase-2)

**Phase 2 Track 1 Fast-Follow — 100% shipped (9 of 9 modules).** No remaining modules in this scope.

Next track per FRD-Phase2 §9: **Voice Agent (MOD-27a + 27b)** formally moved to **Phase 3**, sequenced after the 9 Phase 2 modules. The `samstack-ai-phase2-voice-agent-analysis.md` document's technical content remains valid as the Phase 3 reference; only its priority-ordering section (§17) was superseded.

### Pilot Launch Prep (Integration Config — Not Module Work)

These are not in `state/pending.md` as a feature backlog because they're real-vendor configuration, not code. Tracked here for the team:

- [ ] **WhatsApp Business API**: Meta/BSP account, template submission for approval (status defaults to `pending` in our DB until Meta confirms)
- [ ] **Razorpay**: Merchant account, webhook secret in `Razorpay:KeySecret`, webhook URL configured at Razorpay dashboard
- [ ] **Azure Entra External ID**: tenant config, role claim mapping, redirect URIs
- [ ] **S3-compatible blob storage**: for MOD-08 file uploads (currently local disk `lab-uploads/`), TRD-Phase2 §3

### Already Shipped (see `completed.md`)

- MOD-23 Pre-Check Form ✅
- MOD-24 Emergency Queue ✅
- MOD-25 Live Ticket Tracking ✅
- MOD-12 Speciality EMR Templates ✅
- MOD-13 Notification Rules Engine ✅
- MOD-09 Inventory ✅
- MOD-10 Wishlist ✅
- MOD-08 Lab Records ✅
- MOD-11 Finance Ledger ✅
- MOD-14 Platform Admin Portal ✅

---

## Implementation Details

Implementation MUST follow the standard 7-step sequence defined in [`.claude/skills/new-fr/SKILL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/.claude/skills/new-fr/SKILL.md) for every item above.

For MOD-08 file uploads, also consult `TRD-Phase2-V1.md §3` for blob storage choice.

---

## Important Files

- [`FRD-Phase-2-FINAL.md`](file://FRD-Phase-2-FINAL.md) — Detailed Requirements
- [`TRD-Phase2-V1.md`](file://TRD-Phase2-V1.md) — Technical Reference (Hangfire, blob storage)
- [`.claude/skills/new-fr/SKILL.md`](file://.claude/skills/new-fr/SKILL.md) — Implementation Sequence

---

## Dependencies

- .NET 10 SDK ✅
- React 19 / Vite frontend (pending for Phase 2 UI work)
- Blob/file storage for MOD-08 (S3-compatible, TBD)

---

## Risks

- **MOD-08 file upload scope creep**: LIMS integration deferred per FR-08-02, but temptation exists. Stay manual.
- **MOD-11 ledger complexity**: Double-entry accounting is a domain in itself; consider professional review.

---

## Future Improvements

- Hangfire migration for `NotificationRulesWorker` (currently BackgroundService — fine for one job).
- Blob storage choice for MOD-08 (S3 vs local disk).

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Should MOD-11 be deferred past pilot launch?

---

## Last Verified Date

2026-08-30

---

## Verification Source

- [`FRD-Phase-2-FINAL.md`](file://FRD-Phase-2-FINAL.md)
- [`TRD-Phase2-V1.md`](file://TRD-Phase2-V1.md)
