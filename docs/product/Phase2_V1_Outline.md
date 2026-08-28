# SAMSTACK AI — Phase 2 Outline (Lightweight)

**Status:** Deliberately not full FRD/TRD/PRD depth — see samstack-ai-prd-phase1-v1 §9, "not a release criterion: Phase 2 being planned." This gets expanded to full depth per module once Phase 1's release criteria are met and real pilot usage — not survey proxy — informs which of these 9 actually matters first.

**Why one document, not nine:** each module gets just enough to resume from quickly — purpose, rough scope, what's explicitly deferred even within this module, key entities/screens at a name-only level, dependencies, and the specific question pilot data should answer before this gets built for real.

---

## Suggested Build Order (Provisional — Re-sequence on Real Pilot Data)

1. **MOD-23** Pre-Check Form — highest validated demand ("unwanted appointments" named independently twice, survey-analysis-v2 §4), reuses the already-proven tokenized-link pattern
2. **MOD-24 + MOD-25** Emergency Queue + Live Tracking — one capability, ship paired
3. **MOD-12** Speciality Templates — now informed by real specialty distribution (see below), not a guess
4. **MOD-09** Inventory — 62% of respondents are pharmacy-attached even before Track 2 starts; inventory has standalone value
5. **MOD-08** Lab Records
6. **MOD-13** Full Notification Rules Engine
7. **MOD-10** Wishlist Tracker — cheapest, but lowest evidenced urgency
8. **MOD-11** Finance Ledger — higher risk (accounting correctness has real consequences), needs a real accountant's input before scoping, not just doctor interviews
9. **MOD-14** Platform Admin Portal — gated on multi-tenancy actually launching, not really a priority question at all

---

## MOD-23 — Doctor Pre-Check Form
**Purpose:** Tokenized, no-login pre-visit intake (chief complaint, symptoms, medications, allergies), feeds MOD-05's consult note.
**Deferred even here:** structured/coded symptom input (free text is enough for a v1 of this module).
**Entities:** PreCheckSubmission. **Screens:** patient-facing tokenized form, doctor-facing review-before-consult view.
**Depends on:** MOD-05. **Reuses:** the tokenized-link pattern already built for the discovery survey.
**Already validated** — no open question blocking this one.

## MOD-24 — Emergency Priority Queue
**Purpose:** Receptionist/Doctor flags a patient urgent, re-sequences MOD-04's queue.
**Deferred even here:** multi-level triage (binary emergency flag only).
**Entities:** extends `appointments` with a priority field. **Screens:** flag action on the existing queue view, no new screen.
**Depends on:** MOD-04.
**Validate first:** actual frequency in a general OPD (not ER) setting — ask pilot clinics directly, don't assume from the original requirement list alone.

## MOD-25 — Live Ticket Tracking
**Purpose:** Patient/family sees live queue position via the same tokenized-link pattern as MOD-23.
**Deferred even here:** push notifications on position change (polling refresh is enough).
**Entities:** none new, reads `appointments.queue_token`. **Screens:** patient-facing tokenized status page.
**Depends on:** MOD-04, pairs with MOD-24.

## MOD-12 — Speciality EMR Templates
**Purpose:** Templated consult notes per specialty, doctor-customizable.
**Deferred even here:** a template marketplace/sharing between clinics (single-clinic templates only).
**Entities:** ConsultTemplate. **Screens:** template picker inside FR-14's consult flow, template editor.
**Depends on:** MOD-05.
**Now informed by real data, not a guess:** build **Dental, General/Family Medicine, and Ayurveda/AYUSH first** — survey-analysis-v2's actual specialty distribution (25%, 17%, 17% respectively), not an assumed generic set.

## MOD-09 — Inventory (Dead / Consumable / Usable)
**Purpose:** Three-tier stock tracking per the original requirement.
**Deferred even here:** automated reordering, distributor integration (that's MOD-17, later still).
**Entities:** InventoryItem, StockMovement. **Screens:** item catalog, stock adjustment, low-stock report.
**Depends on:** MOD-02.
**Validate first:** whether pilot clinics actually distinguish these three tiers in how they think about stock day-to-day, or whether that's a framing from the original brief that doesn't match real usage — worth a direct question, not an assumption.

## MOD-08 — Lab Records
**Purpose:** Order and result tracking, linked to a consultation.
**Deferred even here:** instrument/LIMS auto-import, external-lab ABDM/FHIR exchange (both real strategy-v0.5 §7 ideas, not this module's first cut).
**Entities:** LabOrder, LabResult. **Screens:** order form, result upload/view, pending worklist.
**Depends on:** MOD-05, MOD-03.
**Validate first:** how often Phase 1 pilots actually need structured lab tracking vs. just noting results in the free-text consult note.

## MOD-13 — Full Notification Rules Engine
**Purpose:** Configurable reminder rules beyond Phase 1's single booking-confirm-and-remind flow.
**Deferred even here:** a full visual rule-builder UI (a fixed set of common rule types is enough for a first cut).
**Entities:** NotificationRule (extends Phase 1's `notification_log`/template concept). **Screens:** rules config, template management.
**Depends on:** MOD-07.
**Validate first:** what rules pilot clinics actually ask for — don't design the rule taxonomy ahead of real requests.

## MOD-10 — Wishlist Tracker
**Purpose:** Internal tracker for doctor-flagged tasks/goals/equipment/expansion ideas.
**Deferred even here:** nothing — this is already the minimal version.
**Entities:** WishlistItem. **Screens:** list, new/edit.
**Depends on:** MOD-01 only.
**Validate first:** whether doctors actually use this or it goes untouched — genuinely the easiest module here to quietly drop if pilot interest is zero.

## MOD-11 — Finance/Accounting Ledger (ITR-Ease)
**Purpose:** Categorized income/expense ledger with monthly closing, for the clinic's accountant.
**Deferred even here:** direct government e-filing integration (confirmed out of scope from the original clarification), Marg-level double-entry depth.
**Entities:** LedgerEntry, ExpenseCategory. **Screens:** ledger view, monthly summary, export.
**Depends on:** MOD-06.
**Validate first:** the actual export format pilot clinics' *accountants* want — this needs a question to the accountant, not just the doctor, since they're the real downstream user of this module's output.

## MOD-14 — Platform Admin Portal
**Purpose:** SAMSTACK's own tenant management — not tenant-facing.
**Deferred even here:** nothing to defer, it's already minimal in concept.
**Entities:** reuses Tenant/Clinic. **Screens:** tenant list, tenant detail, audited impersonate-for-support.
**Depends on:** multi-tenancy actually being activated (Tier 2+, strategy-v0.5 §3.1) — this one is gated by a mechanical fact (is there more than one tenant yet), not by pilot feedback at all.

---

## What Triggers Moving Any of These to Full Depth
Per samstack-ai-prd-phase1-v1 §9: Phase 1's release criteria being met, plus — module-specifically — whichever "validate first" question above has a real answer. Not calendar time, not this document's existence.
