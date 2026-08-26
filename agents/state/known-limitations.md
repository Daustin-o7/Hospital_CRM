# System State: Known Limitations & Scope Boundaries (`state/known-limitations.md`)

This document records all deliberate scope limitations, architectural trade-offs, deferred capabilities, and explicit omissions in SAMSTACK AI Phase 1.

---

## Purpose

To provide a transparent record of what Phase 1 deliberately DOES NOT build, preventing premature feature creep and keeping AI assistants focused on True V1 pilot requirements.

---

## Scope

Covers all 22 functional requirements (FR-01 to FR-22), module exclusions, internationalization limits, and tenancy boundaries.

---

## Verified Information

### Deliberate Phase 1 Scope Limitations

1. **No In-Patient Department (IPD)**: OPD out-patient care only. Bed management, ward transfers, nursing charting, and admission/discharge workflows are deferred to Track 4 (MOD-20 through MOD-26).
2. **No Regulated AI Features**: No clinical decision support, diagnostic AI, OCR, or NLU chatbots (deferred to Track 3 MOD-18/19).
3. **No Pharmacy Dispensing & Inventory**: Drug SKU management, Schedule H/H1 registers, and distributor purchase orders are deferred to Track 2 (MOD-15/16/17).
4. **Free-Text Prescriptions Only**: Prescriptions (FR-15) use free-text medicine names, dosages, and durations — no drug autocomplete database in V1.
5. **Single WhatsApp Flow Only**: Notifications (FR-20/21) support a single template pair (booking confirmation + reminder) — no configurable rules engine (deferred to MOD-13).
6. **No Speciality EMR Templates**: Consultation notes (FR-14) use generic free-text fields (Chief Complaint, Observations, Diagnosis) — no specialty templates in V1 (deferred to MOD-12).
7. **Single-Tenant Instance Execution**: Shared SaaS Tier 1 execution only — no dedicated databases or multi-tenant platform administration portals in Phase 1 (deferred to MOD-14).
8. **India Region Only**: Payment (Razorpay) and tax (GST) adapters configured for India only — UAE international adapters deferred.

---

## Implementation Details

```
[ Active Phase 1 Focus: Track 1 OPD CRM + Billing ]
  │
  ├── ❌ Out of Scope: Track 2 Pharmacy (MOD-15/16/17)
  ├── ❌ Out of Scope: Track 3 AI Engine (MOD-18/19)
  ├── ❌ Out of Scope: Track 4 IPD Inpatient (MOD-20/21/22/26)
  └── ❌ Out of Scope: UAE Adapter & Dedicated DB Instances
```

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=44-53) — Out of Scope Section (§5.2)
- [`docs/samstack-ai-module-registry-v1.2.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/docs/samstack-ai-module-registry-v1.2.md) — Master Module Registry

---

## Dependencies

- N/A (Scope record)

---

## Risks

- Attempting to implement Fast-Follow or Track 2 features before validating Phase 1 in production.

---

## Future Improvements

- Progressive unlocking of Track 2 (Pharmacy) and Track 1 Fast-Follows following successful Phase 1 pilot completion.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Projected start date for Track 2 Pharmacy development.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=44-53)
