# SAMSTACK AI — Project Overview (`plan/project.md`)

This document outlines the master vision, objectives, scope boundaries, target market, and strategic goals for the SAMSTACK AI project.

---

## Purpose

To provide a clear, unambiguous overview of the product vision, target market, strategic goals, pilot timeline, and scope boundaries for Phase 1 of SAMSTACK AI.

---

## Scope

Covers **Phase 1: Track 1 (CRM + Billing)** for OPD clinics in India operating under the Shared SaaS Tenancy Tier. Explicitly defines included modules (MOD-01 to MOD-07, FR-01 to FR-22) and deferred tracks (Pharmacy, Regulated AI, IPD, UAE Adapter).

---

## Verified Information

- **Product Name**: SAMSTACK AI (Doctor/Clinic CRM)
- **Target Audience**: Out-Patient Department (OPD) clinics, solo practitioners, and small clinic teams in India.
- **Core Problem Addressed**: Replacing paper registers and disconnected tools (used by 81% of surveyed practices) with a unified, connected, honestly-priced digital CRM.
- **Strategic Pilot Goal**: Land 3–5 paying pilot clinics on Phase 1 within ~10 weeks of build start (sharpened-plan-v2 §4).
- **Evidence Base**: Discovery survey n=24 responses (samstack-ai-survey-analysis-v2) — 67% solo practitioners, 83% using WhatsApp, 62% pharmacy-attached, 83% ABDM-aware.
- **Key UX Design Principle**: Address "fear of training" and onboarding friction by ensuring registration and front-desk flows require ≤3 inputs.

---

## Implementation Details

### Phase 1 Included Scope (True V1)
- **MOD-01**: Identity & Access (Auth, JWT RS256, 3 Roles: Clinic Admin, Doctor, Receptionist)
- **MOD-02**: Minimal Clinic Setup (Single-tenant identity, operating hours, holiday calendar)
- **MOD-03**: Patient Registration & Management (DPDP consent, duplicate-phone check, demographics search)
- **MOD-04**: Appointments & Daily Queue (Calendar booking, numeric queue tokens, reschedule/cancel)
- **MOD-05**: Basic Treatment / EMR (Consultation notes, free-text prescriptions, versioned history)
- **MOD-06**: Billing & Payments (GST invoices, cash & Razorpay payment links/webhooks, outstanding dues)
- **MOD-07**: Single WhatsApp Flow (Booking confirmation + reminder notification via event-driven handler)
- **Cross-Cutting**: Offline-tolerant registration/billing sync (IndexedDB queue + server idempotency keys)

### Explicitly Out of Scope for Phase 1
- **Track 2**: Pharmacy Dispensing & Inventory (MOD-15/16/17)
- **Track 3**: Regulated AI (MOD-18 Bucket A administrative AI, MOD-19 Bucket B diagnostic decision support)
- **Track 4**: In-Patient Department (IPD) Bed/Ward/Nursing/Shift management (MOD-20/21/22/26)
- **Track 1 Fast-Follow**: Lab records (MOD-08), Inventory (MOD-09), Wishlist (MOD-10), Finance ledger (MOD-11), Speciality EMR templates (MOD-12), Notification rules engine (MOD-13), Platform admin portal (MOD-14), Pre-check forms (MOD-23), Emergency queue (MOD-24), Live ticket tracking (MOD-25).
- **Adapters**: UAE international payment/compliance adapters.
- **Tenancy Tiers**: Dedicated Database (Tier 2) and Dedicated Instance (Tier 3).

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md) — Main Functional Requirements Document
- [`docs/samstack-ai-strategy-v0.5.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/docs/samstack-ai-strategy-v0.5.md) — Strategic vision and architecture roadmap
- [`docs/samstack-ai-v2-sharpened-plan.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/docs/samstack-ai-v2-sharpened-plan.md) — True V1 scope definition and pilot scorecard
- [`docs/samstack-ai-survey-analysis-v2.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/docs/samstack-ai-survey-analysis-v2.md) — Discovery survey analysis (n=24)

---

## Dependencies

- Managed identity infrastructure (Azure Entra External ID)
- Razorpay payment processing gateway
- Meta Business WhatsApp API access
- Host infrastructure (PostgreSQL, ASP.NET Core server environment)

---

## Risks

- **Perceived Onboarding Friction**: Clinic staff abandoning system if registration requires too many fields (Mitigated: FR-06 capped at 3 required inputs).
- **Scope Creep Pressure**: Attempting to implement Pharmacy or ABDM integrations before pilot validation.
- **Connectivity Disruption**: Front-desk network drops interrupting registration or billing (Mitigated: FR-22 IndexedDB offline queue).

---

## Future Improvements

- Post-pilot rollout of Track 1 Fast-Follow modules (MOD-23 Pre-Check, MOD-24 Emergency Queue, MOD-25 Live Ticket).
- ABDM / ABHA milestone integration following Phase 1 pilot completion.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Final pricing model for commercial pilot clinics (monthly subscription vs per-transaction platform fee).

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=39-66)
- [`docs/samstack-ai-v2-sharpened-plan.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/docs/samstack-ai-v2-sharpened-plan.md)
