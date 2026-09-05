# SAMSTACK AI — Master Module Registry (v1.2)

**Consolidates:** strategy-v0.5 (§3.2 tracks, §7 requirement map), sharpened-plan-v2 (§4 True V1 cuts), auth-and-ia-v0.1 (role/page model). **Reconciles one drift:** auth-and-ia-v0.1 counted Wishlist inside V1's 27 models; the sharpened plan later cut it from True V1 to hit the ~10-week build target. This registry follows the sharpened plan — Wishlist moves to Fast-Follow below.

**On sequencing vs. this list:** survey results can reorder priority within a track (e.g., if pharmacy-attached responses come back low, Track 2 slides later) — module *boundaries* are architecture decisions and won't move much regardless of what the data shows. Treat the grouping as stable, the ordering as provisional until the survey's analyzed.

---

## Cross-Cutting Capabilities
Not modules with their own pages — threaded through everything below.

| Capability | What it means | Shows up in |
|---|---|---|
| Offline-First Sync | Front-desk registration/billing survives a dropped connection, syncs on reconnect | MOD-03, MOD-04, MOD-06 |
| Consent & Audit Trail (DPDP) | Every access to patient data logged; consent is a first-class record, not a checkbox | Every module touching patient data |
| Multi-Tenancy & Region Adapters | `tenant_id` isolation + `IPaymentProvider`/`IComplianceProvider`/`ITaxInvoiceProvider` interfaces | Dormant for single-tenant V1; activates at Tier 2/3 or the international adapter |
| Notification Channel Abstraction | WhatsApp today, SMS/email swappable later without a rewrite | MOD-07 |
| Tokenized No-Login Web Link | Single-purpose page tied to one appointment/session, no patient account needed | MOD-23, MOD-25 — same pattern already proven working in the discovery-survey webpage |

---

## Track 1 — CRM + Billing

**V1 Essential (building now):**

| Code | Module | Purpose |
|---|---|---|
| MOD-01 | Identity & Access | Auth, 3 roles (Clinic Admin, Doctor, Receptionist), JWT/RS256, managed identity provider |
| MOD-02 | Clinic Setup (Minimal) | Single-tenant config for V1; branding fields present but dormant until multi-tenant ships |
| MOD-03 | Patients / Registration | List, register, profile |
| MOD-04 | Appointments & Queue | Calendar booking + simple numeric token |
| MOD-05 | Treatment / EMR (Basic) | Consult note + prescription — no speciality templates yet |
| MOD-06 | Billing & Payments | Invoice, one payment gateway (Razorpay), GST-basic |
| MOD-07 | WhatsApp Notifications (Single Flow) | Booking confirmation + reminder only — one template pair, not a rules engine |

**Fast-Follow (Track 1, deferred from V1):**

| Code | Module | Purpose |
|---|---|---|
| MOD-08 | Lab Records | Orders, results, pending/completed worklist |
| MOD-09 | Inventory | Dead / consumable / usable stock, three explicit states |
| MOD-10 | Wishlist Tracker | Doctor-flagged tasks/goals/equipment/expansion ideas — *cut from V1 to hit the 10-week build target; cheap to re-add once the core is stable* |
| MOD-11 | Finance/Accounting Ledger | Categorised income/expense, monthly closing — the "ITR-ease" feature |
| MOD-12 | Speciality EMR Templates | Templated consult notes per specialty (Healthray-inspired bar to clear) |
| MOD-13 | Full Notification Rules Engine | Beyond MOD-07's single flow — configurable reminder rules |
| MOD-14 | Platform Admin Portal | SAMSTACK's own tenant management, impersonate-for-support, feature flags |
| MOD-23 | Doctor Pre-Check Form | Short intake (chief complaint, symptom duration, medications, allergies) sent to the patient before the visit, feeding straight into MOD-05's consult note. Delivered as a tokenized no-login link — sidesteps the still-deferred patient-portal decision entirely |
| MOD-24 | Emergency Priority Queue | Receptionist/Doctor flags a patient urgent, re-sequencing MOD-04's queue. Binary flag for now, not full triage levels; every flag logged (who/when) for accountability. Depends on MOD-04 |
| MOD-25 | Live Ticket Tracking | Patient/family sees real-time queue position via the same tokenized-link pattern as MOD-23. Simple polling refresh is enough at this scale — no websockets needed. Depends on MOD-04, pairs naturally with MOD-24 since an emergency reorder should show up here immediately |

**Suggested order within Fast-Follow** (codes stay stable, this is priority only, and shifts once pilot feedback lands): MOD-23 first — highest value-to-effort, reuses proven code. MOD-24 + MOD-25 together next — genuinely one capability split across backend logic and patient-facing view. Then MOD-08/09/11/10/12/13/14 in roughly that order, re-sequenced once the survey's analyzed.

**Honest gap, now closed:** the discovery survey in the field doesn't probe queue-management pain or pre-visit-form appetite — added instead to the opt-in follow-up call script (sharpened-plan-v2 §9, items 4–6) rather than touching the live form, since editing it now would split respondents into two incompatible cohorts.

## Track 2 — Pharmacy + Billing *(opt-in per tenant)*

| Code | Module | Purpose |
|---|---|---|
| MOD-15 | Pharmacy Dispensing & POS | Extends MOD-06's Billing — drug SKUs, batch/expiry line items — not a second billing system |
| MOD-16 | Pharmacy Stock & Compliance | Schedule H/H1/NDPS registers, FEFO expiry, hard block on dispense without a linked prescription |
| MOD-17 | Distributor Ordering | ERP-to-ERP purchase orders (Marg-inspired) — later still, not near-term |

## Track 3 — Regulated AI

| Code | Module | Purpose |
|---|---|---|
| MOD-18 | Bucket A AI | OCR, no-show prediction, WhatsApp chatbot NLU — administrative, ships without licensing, human-confirms anything touching a prescription |
| MOD-19 | Bucket B AI | Diagnostic/decision-support — built behind a feature flag, dormant until CDSCO licenses it |

## Track 4 — IPD / Inpatient *(later, hospital-tier opt-in)*

| Code | Module | Purpose |
|---|---|---|
| MOD-20 | Bed/Ward Management | Real-time bed state, ward transfers |
| MOD-21 | Admission & Discharge | Admission workflow, discharge summaries |
| MOD-22 | Nursing Charting | Ward-level clinical documentation |
| MOD-26 | Nurse Staffing & Shift Management | Shift rostering (Morning/Evening/Night), attendance/leave, ward/workload assignment (ties to MOD-20), shift-handoff notes for continuity of care. Depends on MOD-01, MOD-20 |

**Assumption flagged:** MOD-26 is placed here because the Nurse role is currently scoped as IPD-only (auth-and-ia-v0.1) — shift coverage matters most where wards need round-the-clock staffing. Many OPD clinics also run a treatment-room nurse for vitals/injections, which is a smaller, earlier need (just "who's on duty today," not full shift-rostering) and would mean pulling a lightweight version of the Nurse role into Track 1. Flag if that's the actual need and I'll split it into a Track 1 version plus this fuller Track 4 one.

---

## Unique Features — Status
Features 1–3 (Pre-Check Form, Emergency Priority Queue, Live Ticket Tracking) are placed as MOD-23/24/25 above. If more are coming, same approach: tell me which track each leans toward, or describe it and I'll place it.

## Next
This table is the direct skeleton for the FRD once the survey data narrows priority — each V1 Essential row becomes a section with the field-level detail auth-and-ia-v0.1 already started for Track 1.
