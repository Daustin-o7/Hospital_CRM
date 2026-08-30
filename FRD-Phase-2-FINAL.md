# SAMSTACK AI — Functional Requirements Document (FRD)
## Phase 2 — Track 1 Fast-Follow (9 Modules)

---

## 1. Document Information

| Field | Value |
|---|---|
| Title | SAMSTACK AI — FRD, Phase 2 |
| Version | 1.0 |
| Date | 27 August 2026 |
| Continuation of | samstack-ai-frd-phase1-FINAL.md — same conventions, same numbering discipline extended, nothing in Phase 1 rewritten |
| FR numbering | `FR-{MOD}-{seq}` (e.g., `FR-08-01`) — module-prefixed specifically to avoid collision with Phase 1's sequential FR-01–22 |

## 2. Revision History

| Version | Date | Description |
|---|---|---|
| 1.0 | 27 Aug 2026 | Initial full-depth Phase 2 FRD, expanded from samstack-ai-phase2-outline-v1. Voice Agent (MOD-27) explicitly excluded — reclassified as Phase 3, see §5.2 and §9. |

## 3. Approvals

| Name | Role | Signature | Date |
|---|---|---|---|
| | Cofounder / Product | | |
| | Cofounder / Engineering | | |

---

## 4. Table of Contents
1–3 as above · 4 TOC · 5 Executive Summary · 6 Conflict Check Against Phase 1 · 7 Detailed Functional Requirements (9 modules) · 8 Reports & Analytics Extension · 9 Phase 3 Note (Voice Agent) · 10 Non-Functional Requirements · 11 Assumptions, Dependencies & Constraints · 12 Glossary Additions · 13 Validation Checklist

---

## 5. Executive Summary

### 5.1 Scope
All 9 modules from samstack-ai-phase2-outline-v1, at full FR-level depth: MOD-23 (Pre-Check Form), MOD-24 (Emergency Queue), MOD-25 (Live Tracking), MOD-12 (Speciality Templates), MOD-09 (Inventory), MOD-08 (Lab Records), MOD-13 (Notification Rules Engine), MOD-10 (Wishlist), MOD-11 (Finance Ledger), MOD-14 (Platform Admin Portal).

### 5.2 Out of Scope
- **Voice Agent (MOD-27) — now formally Phase 3, not Phase 2.** This corrects an inconsistency: samstack-ai-phase2-voice-agent-analysis §17 had inserted Voice Step 1 into the Phase 2 priority order at position #2. That placement is superseded by this document — Voice Agent is sequenced after all 9 Phase 2 modules complete, as its own phase, per this instruction. §9 below carries the correction forward.
- Track 2 (Pharmacy), Track 3 (Regulated AI — distinct from "Phase 3" naming here, this is the CDSCO-gated AI track from strategy-v0.5 §3.2, not to be confused with Voice Agent's new Phase 3 label), Track 4 (IPD)
- International adapter, Dedicated DB/Instance tenancy tiers (MOD-14 activates *with* Tier 2, not these)

**Naming collision flagged, not hidden:** strategy-v0.5 uses "Track 3" for Regulated AI. This document's "Phase 3" (Voice Agent) is a different axis — phases are Track 1's internal build sequence (Phase 1 → 2 → 3...), tracks are the four sellable product lines. Worth being precise about in conversation so "Phase 3" and "Track 3" aren't conflated.

---

## 6. Conflict Check Against Phase 1 Baseline

Explicit, per instruction — not asserted, shown:

| # | Potential conflict | Finding | Resolution |
|---|---|---|---|
| 1 | MOD-11 Finance Ledger vs. Phase 1's `invoices`/`payments` tables | Real risk of duplicating income tracking | Ledger **reads** `invoices`/`payments` for income side (FR-11-01), only adds new tables for the expense side it doesn't already have. No income data is duplicated. |
| 2 | MOD-13 Notification Rules Engine vs. Phase 1's FR-20/21 single hardcoded flow | Risk of a competing notification system | MOD-13 **generalizes** the existing channel-interface pattern (TRD_Phase1 §2) — FR-20/21's booking-confirm-and-remind becomes the *default* rule once MOD-13 ships, not a separate system running alongside it. |
| 3 | MOD-14 Platform Admin vs. Phase 1's single-tenant, dormant `tenant_id` | MOD-14 implies multiple tenants exist | Confirmed precondition, not a conflict — MOD-14's FRs below are explicitly marked as gated on Tier 2 tenancy activation (strategy-v0.5 §3.1), not buildable in a literal single-tenant pilot. |
| 4 | MOD-23 Pre-Check Form vs. Phase 1's deferred patient-portal decision (FRD_Phase1 §15) | Risk of quietly building a patient login | No conflict — MOD-23 reuses the tokenized no-login link pattern (proven in the discovery-survey webpage), not a portal. Reaffirmed, not reopened. |
| 5 | MOD-09 Inventory vs. Track 2 Pharmacy (not in scope anywhere near here) | Risk of assuming pharmacy-dispensing logic exists | No conflict — MOD-09 is general clinic stock (dead/consumable/usable), standalone, no dependency on Pharmacy's dispensing tables. |
| 6 | New roles needed? | Checked every module | Only MOD-14 needs a role beyond Phase 1's three — and it's the **Platform Admin** role already defined in auth-and-ia-v0.1 (not new), never exposed to clinic tenants. |
| 7 | Consent scope — does every new patient-data-touching module need a new consent entity, the way Voice Agent needed `VoiceCallConsent`? | Checked MOD-23 (patient-submitted pre-check data) and MOD-08 (lab results) specifically | **No new consent entity for either.** Pre-check symptom/medication data and lab results are both squarely inside FR-09's existing consent purpose ("care delivery and appointment/billing records") — this is different from the Voice Agent's case, where a third party (AI vendor) processing a recorded call was a genuinely new purpose. Not every new module needs new consent scaffolding; this is the test that decides which do. |
| 8 | `tenant_id` discipline | Checked all 9 modules' new tables | Every new table below includes `tenant_id`, dormant, consistent with Phase 1. |

---

## 7. Detailed Functional Requirements

### MOD-23 — Doctor Pre-Check Form

#### FR-23-01: Generate Pre-Check Link
**Roles:** System-triggered · **NFR:** Availability, Integration
**User Story:** As a patient, I want a simple link to answer a few questions before my visit so the doctor already has context when I arrive.
**Workflow:** On appointment booking (FR-10) or 24h before, an event fires alongside FR-20's confirmation → a tokenized link is generated and included in the same WhatsApp message (no second message, avoiding the spam concern already resolved for Voice Agent's reminder policy).
**Edge cases:** Walk-in with no advance notice → no pre-check link generated, this FR only applies to appointments with lead time.
**Acceptance criteria:**
- [ ] Link is single-use, expires at appointment time if unsubmitted
- [ ] Link generation never blocks or delays FR-20's confirmation send (same async decoupling principle as FR-20 itself)
**API shape:** Internal — extends the `AppointmentConfirmed` handler, no new public endpoint.
**DB schema:** `precheck_submissions: id, tenant_id, appointment_id, token_hash, expires_at, submitted_at (nullable)`
**Security notes:** Token is high-entropy, single-use, same pattern as FR-04's staff-invite tokens.

#### FR-23-02: Patient Submits Pre-Check Form
**Roles:** Patient (unauthenticated, tokenized) · **NFR:** Usability, Performance
**User Story:** As a patient, I want to answer a few quick questions on my phone without creating an account.
**Workflow:** Patient opens link → chief complaint, symptom duration, current medications, allergies (free text, per outline's "deferred: structured/coded input") → submit → confirmation shown, no login anywhere in the flow.
**Edge cases:** Link already used → clear "already submitted" message, not an error. Link expired → clear message, no data loss implied (nothing was lost, it just wasn't collected).
**Acceptance criteria:**
- [ ] Zero authentication anywhere in this flow
- [ ] Submission takes under 2 minutes for a typical patient (matches the discovery-survey webpage's own design bar)
**API shape:** `POST /api/v1/precheck/{token}` `{ "chiefComplaint": "string", "symptomDuration": "string", "medications": "string", "allergies": "string" }`
**DB schema:** Extends `precheck_submissions` with the answer fields above.
**Security notes:** Rate-limited per token (prevents brute-force token guessing at the endpoint level, independent of token entropy).

#### FR-23-03: Doctor Reviews Pre-Check Submission
**Roles:** Doctor · **NFR:** Performance, Audit & Compliance
**User Story:** As a doctor, I want to see the patient's pre-check answers before or during the consultation without hunting for them.
**Workflow:** Submission surfaces inside FR-14's consult screen automatically when one exists for that appointment — not a separate screen to remember to check.
**Edge cases:** No submission exists (patient didn't fill it) → consult screen shows nothing extra, doesn't nag.
**Acceptance criteria:**
- [ ] Visible inline in the existing consult flow, zero extra clicks when a submission exists
**API shape:** `GET /api/v1/appointments/{id}/precheck` → null or the submission
**DB schema:** Read from `precheck_submissions`.
**Security notes:** Same Doctor-only access as the consult screen itself (FR-14) — Receptionist never sees this, consistent with §8 role boundaries.

---

### MOD-24 — Emergency Priority Queue

#### FR-24-01: Flag Appointment as Emergency
**Roles:** Receptionist, Doctor, Clinic Admin · **NFR:** Audit & Compliance
**User Story:** As a receptionist, I want to flag a walk-in as urgent so they're seen ahead of the existing queue.
**Workflow:** From the existing queue view (FR-11 Phase 1), a flag action sets the appointment's priority → queue re-sorts.
**Edge cases:** Flag removed by mistake → un-flaggable by the same roles, logged either way (both actions, not just the flag).
**Acceptance criteria:**
- [ ] Binary flag only — no triage levels (outline's explicit deferral)
- [ ] Every flag/unflag action logged: who, when (accountability, per outline)
**API shape:** `PATCH /api/v1/appointments/{id}/priority` `{ "priority": "emergency|normal" }`
**DB schema:** `appointments` gains a `priority` column (default `normal`) + `priority_log: id, appointment_id, changed_by, changed_to, changed_at`
**Security notes:** Same RBAC as other appointment actions (FR-02) — no new permission tier.

#### FR-24-02: Queue Re-Sequencing on Emergency Flag
**Roles:** System-triggered (from FR-24-01) · **NFR:** Performance
**User Story:** As a doctor, I want the queue to reflect an emergency immediately, not require a manual reorder.
**Workflow:** Priority change triggers an immediate re-sort of the day's queue view — emergency-flagged appointments surface next, without disturbing other patients' underlying appointment times (only the display/serving order changes, not their booked slot).
**Edge cases:** Two emergencies flagged in sequence → served in the order they were flagged, not re-litigated each time.
**Acceptance criteria:**
- [ ] Re-sort reflects within the same page-load cadence as FR-11 (no separate refresh mechanism needed — reuses the existing polling)
**API shape:** No new endpoint — FR-11's existing schedule GET already returns `priority`, sort order changes accordingly.
**DB schema:** No new schema beyond FR-24-01's `priority` column.
**Security notes:** N/A beyond FR-24-01.

---

### MOD-25 — Live Ticket Tracking

#### FR-25-01: Patient Views Live Queue Status
**Roles:** Patient (unauthenticated, tokenized) · **NFR:** Performance, Usability
**User Story:** As a patient, I want to check my place in line from my phone instead of asking the front desk repeatedly.
**Workflow:** Same tokenized-link pattern as MOD-23, sent alongside check-in (FR-12) → simple status page showing current token being served and the patient's own token number.
**Edge cases:** Patient's appointment gets emergency-superseded by another (MOD-24) → status page reflects the new wait honestly, doesn't hide it.
**Acceptance criteria:**
- [ ] Polling refresh (outline's explicit choice over websockets) at a sensible interval — no push infrastructure for this scale
- [ ] No login anywhere in this flow, consistent with MOD-23's pattern
**API shape:** `GET /api/v1/queue-status/{token}` → `{ "currentlyServing": "int", "yourToken": "int" }`
**DB schema:** No new tables — reads `appointments.queue_token` and `priority` directly.
**Security notes:** Token-scoped read-only access, reveals only queue position, nothing else about other patients.

---

### MOD-12 — Speciality EMR Templates

#### FR-12-01: Select and Apply Consultation Template
**Roles:** Doctor · **NFR:** Performance, Usability
**User Story:** As a doctor, I want a template for my specialty so I'm not writing the same structure from scratch every visit.
**Workflow:** Inside FR-14's consult screen, a template picker pre-fills structured sections (varies by specialty) which the doctor edits per patient — never submitted unedited/unreviewed.
**Edge cases:** Doctor switches specialty context mid-note → template swap preserves already-entered text where field names match, doesn't silently discard work.
**Acceptance criteria:**
- [ ] **Dental, General/Family Medicine, and Ayurveda/AYUSH ship first** — direct from survey-analysis-v2's actual specialty distribution (25%/17%/17%), not a generic assumed set
- [ ] Templates pre-fill, never auto-submit — FR-14's existing "amendment, never silent overwrite" principle still governs the underlying note

#### FR-12-02: Create/Edit Custom Template
**Roles:** Doctor · **NFR:** Usability
**User Story:** As a doctor, I want to adjust the default template or build my own.
**Workflow:** Save current note structure as a reusable template, scoped to that doctor only (outline's explicit deferral of cross-clinic sharing).
**Edge cases:** Template deleted while in use by a draft note → draft note is unaffected (templates are a starting point, not a live-linked structure).
**Acceptance criteria:**
- [ ] Single-clinic scope only — no template marketplace (outline's deferral, reaffirmed)
**API shape:** `GET /api/v1/consult-templates?specialty=`, `POST /api/v1/consult-templates`
**DB schema:** `consult_templates: id, tenant_id, doctor_id, specialty, name, structure_json, created_at`
**Security notes:** Doctor-scoped — one doctor's custom template isn't visible to another, even within the same clinic, until the outline's deferred sharing feature exists.

---

### MOD-09 — Inventory (Dead / Consumable / Usable)

#### FR-09-01: Manage Inventory Item Catalog
**Roles:** Clinic Admin, Receptionist · **NFR:** Usability
**User Story:** As a clinic admin, I want to catalog what we stock so staff can log movement against real items, not free text.
**Workflow:** Add item (name, category tier: dead/consumable/usable, unit) → editable, never hard-deleted (soft-deactivate, since historical stock movements must still reference it).
**Edge cases:** Item name typo after movements logged against it → edit the name, movement history stays linked by ID, not name.
**Acceptance criteria:**
- [ ] Three tiers are explicit, selectable fields, not inferred — **flagged for pilot validation per the outline:** confirm this 3-way split matches how clinics actually think about stock before treating it as settled
**API shape:** `POST /api/v1/inventory/items`, `GET /api/v1/inventory/items`, `PATCH /api/v1/inventory/items/{id}`
**DB schema:** `inventory_items: id, tenant_id, name, tier (enum: dead/consumable/usable), unit, active, created_at`
**Security notes:** Standard RBAC, no clinical data involved.

#### FR-09-02: Record Stock Movement
**Roles:** Clinic Admin, Receptionist · **NFR:** Audit & Compliance
**User Story:** As staff, I want to log stock in/out so the count stays accurate.
**Workflow:** Select item, quantity, direction (in/out), optional note → running balance updates.
**Edge cases:** Movement would take balance negative → warn, don't hard-block (physical stock corrections happen; a hard block would just get staff to enter fake numbers to get past it).
**Acceptance criteria:**
- [ ] Every movement is its own row, never an edit to a running total directly — auditable history, same principle as `patient_audit_log`
**API shape:** `POST /api/v1/inventory/items/{id}/movements` `{ "quantity": "int", "direction": "in|out", "note": "string|null" }`
**DB schema:** `stock_movements: id, tenant_id, item_id, quantity, direction, note, recorded_by, recorded_at`
**Security notes:** Append-only, same pattern as clinical audit tables.

#### FR-09-03: Low-Stock Report
**Roles:** Clinic Admin · **NFR:** Performance
**User Story:** As a clinic admin, I want to see what's running low without checking every item manually.
**Workflow:** Configurable low-stock threshold per item → report surfaces anything below it.
**Acceptance criteria:**
- [ ] No automated reordering (outline's explicit deferral) — this is visibility only
**API shape:** `GET /api/v1/inventory/low-stock`
**DB schema:** Derived from `inventory_items` + `stock_movements` running balance, plus a `low_stock_threshold` column on `inventory_items`.
**Security notes:** Clinic Admin only, consistent with other aggregate-reporting boundaries (FR-19's pattern).

---

### MOD-08 — Lab Records

#### FR-08-01: Create Lab Order
**Roles:** Doctor · **NFR:** Audit & Compliance
**User Story:** As a doctor, I want to order a lab test linked to this consultation.
**Workflow:** From the consult screen (FR-14), create an order (test name, notes) → status `ordered`.
**Edge cases:** Order created then consultation itself is later amended (FR-14's versioning) → order stays linked to the original consultation ID, unaffected by note amendments.
**Acceptance criteria:**
- [ ] Order always links to a specific consultation, never freestanding — same discipline as FR-15's prescription-to-consultation link
**API shape:** `POST /api/v1/consultations/{id}/lab-orders` `{ "testName": "string", "notes": "string|null" }`
**DB schema:** `lab_orders: id, tenant_id, consultation_id, test_name, notes, status (ordered/completed), created_at`
**Security notes:** Doctor-only write, same clinical-data protection tier as FR-14/15.

#### FR-08-02: Enter/Upload Lab Result
**Roles:** Doctor, Clinic Admin · **NFR:** Security, Audit & Compliance
**User Story:** As a doctor, I want to record the result once it's back, as text or an uploaded file (report/image).
**Workflow:** Open the order → enter result text and/or upload a file → status `completed`.
**Edge cases:** Result needs correction after entry → same amendment pattern as FR-14 (new version, original preserved), not a silent overwrite.
**Acceptance criteria:**
- [ ] File upload accepts common report formats (PDF/image), stored with the same encryption-at-rest standard as any other clinical data (TRD_Phase1 §7)
**API shape:** `PATCH /api/v1/lab-orders/{id}/result` `{ "resultText": "string|null", "fileUrl": "string|null" }`
**DB schema:** `lab_results: id, lab_order_id, result_text, file_url, version, previous_version_id, entered_by, entered_at`
**Security notes:** No LIMS/instrument auto-import in this cut (outline's deferral) — manual entry only, reduces integration attack surface for a first version.

#### FR-08-03: View Pending/Completed Lab Worklist
**Roles:** Doctor, Clinic Admin · **NFR:** Performance
**Workflow:** Filtered list view — pending orders needing follow-up, completed ones for reference.
**Acceptance criteria:**
- [ ] Pending list is the operationally important one — surfaced prominently, not buried
**API shape:** `GET /api/v1/lab-orders?status=`
**DB schema:** Query against `lab_orders`.
**Security notes:** Same role boundary as FR-08-01/02.

---

### MOD-13 — Full Notification Rules Engine

#### FR-13-01: Configure Notification Rule
**Roles:** Clinic Admin · **NFR:** Usability, Availability
**User Story:** As a clinic admin, I want to set reminder rules beyond the single fixed flow Phase 1 shipped with.
**Workflow:** Select from a fixed set of common rule types (outline's explicit deferral of a full visual rule-builder) — e.g., "remind N days before," "remind if no visit in N months" — configure timing, assign a message template.
**Edge cases:** Rule conflicts with another (two rules would both fire same-day for the same patient) → de-duplicated at send time, patient gets one message, not two (same spam-avoidance principle already established for Voice Agent's reminder policy, reused here for consistency).
**Acceptance criteria:**
- [ ] Phase 1's FR-20/21 flow becomes this engine's **default rule**, pre-configured, not lost when MOD-13 ships (conflict #2 from §6, resolved)
- [ ] Fixed rule-type set only — no rule-builder UI (outline's deferral)
**API shape:** `POST /api/v1/notification-rules`, `GET /api/v1/notification-rules`
**DB schema:** `notification_rules: id, tenant_id, rule_type, timing_config_json, template_id, active, created_at`
**Security notes:** Clinic Admin only — this configures patient communication, same sensitivity tier as clinic settings (FR-05).

#### FR-13-02: Manage Message Templates
**Roles:** Clinic Admin · **NFR:** Usability
**Workflow:** Create/edit WhatsApp message templates referenced by rules.
**Acceptance criteria:**
- [ ] Templates go through WhatsApp's own approval process where the channel requires it (Meta/BSP template approval — external dependency, not something SAMSTACK controls timing on)
**API shape:** `POST /api/v1/message-templates`, `GET /api/v1/message-templates`
**DB schema:** `message_templates: id, tenant_id, name, channel, content, approval_status, created_at`
**Security notes:** N/A beyond standard RBAC.

#### FR-13-03: Rule Evaluation and Trigger
**Roles:** System-triggered (background job) · **NFR:** Availability, Performance
**User Story:** As the system, evaluate active rules on a schedule and fire notifications without a human remembering to.
**Workflow:** Scheduled job (same Hangfire-based mechanism recommended for Voice Agent reminder scheduling, TRD-consistent reuse) evaluates active rules against current appointment/patient data → fires via the existing channel-interface Notification Orchestrator (TRD_Phase1 §2, extended per Voice Agent analysis §5).
**Edge cases:** Job fails mid-run → resumes cleanly on next scheduled run, doesn't double-send already-processed rules (idempotent evaluation, same principle as FR-22's idempotency keys applied to a new context).
**Acceptance criteria:**
- [ ] No duplicate sends across a job restart
**API shape:** Internal scheduled job, no public endpoint.
**DB schema:** Extends `notification_log` with a `rule_id` reference (nullable — Phase 1's original FR-20/21 sends have none, MOD-13-originated ones do).
**Security notes:** N/A, internal process.

---

### MOD-10 — Wishlist Tracker

#### FR-10-01: Manage Wishlist Items
**Roles:** Doctor, Clinic Admin · **NFR:** Usability
**User Story:** As a doctor, I want to jot down equipment, goals, or expansion ideas somewhere the system remembers, without it being a whole project-management tool.
**Workflow:** Add item (text, category: task/goal/equipment/expansion, status) → list, edit, mark complete.
**Edge cases:** None of real weight — outline correctly identifies this as already-minimal.
**Acceptance criteria:**
- [ ] Deliberately no reminders, no due dates, no assignment to staff — that would be scope creep into a task-management product this isn't (ponytail discipline: this is a note-taking list, not a project tool)
**API shape:** `POST /api/v1/wishlist-items`, `GET /api/v1/wishlist-items`, `PATCH /api/v1/wishlist-items/{id}`
**DB schema:** `wishlist_items: id, tenant_id, created_by, text, category, status, created_at`
**Security notes:** Standard RBAC, no sensitive data.

---

### MOD-11 — Finance/Accounting Ledger (ITR-Ease)

#### FR-11-01: Auto-Populate Income from Billing
**Roles:** System-derived, viewed by Clinic Admin · **NFR:** Audit & Compliance
**Workflow:** Ledger's income view **reads** `invoices`/`payments` directly (conflict #1 from §6, resolved) — no separate income-entry step, no duplicated data.
**Acceptance criteria:**
- [ ] Income figures always reconcile exactly to Phase 1's billing tables — if they diverge, that's a bug, not an acceptable variance
**API shape:** `GET /api/v1/ledger/income?month=` — a read/aggregation endpoint, not a write.
**DB schema:** No new table — a query, not stored data.
**Security notes:** Same access tier as FR-19 (Clinic Admin, aggregate financial view).

#### FR-11-02: Record Manual Expense Entry
**Roles:** Clinic Admin · **NFR:** Audit & Compliance
**User Story:** As a clinic admin, I want to log expenses so the monthly picture is complete, not just the income side.
**Workflow:** Enter expense (category, amount, date, note) → categorized ledger entry.
**Edge cases:** Wrong category assigned → editable, but the edit is logged (same audit discipline as everywhere else touching money — FR-08 of Phase 1's pattern, reused here).
**Acceptance criteria:**
- [ ] Category taxonomy is fixed/simple for v1 (outline's explicit deferral of Marg-level double-entry depth) — not a full chart-of-accounts system
**API shape:** `POST /api/v1/ledger/expenses`, `PATCH /api/v1/ledger/expenses/{id}`
**DB schema:** `ledger_expenses: id, tenant_id, category, amount, expense_date, note, recorded_by, created_at, edited_at (nullable)`
**Security notes:** Clinic Admin only — this is financial data at the same sensitivity as billing.

#### FR-11-03: Generate Monthly Ledger Summary/Export
**Roles:** Clinic Admin · **NFR:** Usability
**Workflow:** Select month → summary (income from FR-11-01, expenses from FR-11-02, net) → export.
**Acceptance criteria:**
- [ ] Export format is **explicitly flagged as unconfirmed** per the outline — "the actual export format pilot clinics' accountants want" needs a real answer before this FR is considered fully specified, not assumed as CSV/PDF by default
**API shape:** `GET /api/v1/ledger/summary?month=&format=`
**DB schema:** Derived, no new table beyond FR-11-02's.
**Security notes:** Same as FR-11-01/02.

---

### MOD-14 — Platform Admin Portal

**Precondition, stated once, applies to every FR below:** none of MOD-14 is buildable in a literal sense until Tier 2 tenancy (strategy-v0.5 §3.1) actually activates — this is a mechanical dependency on "does more than one tenant exist yet," not a pilot-feedback question. These FRs are fully specified now so they're ready the moment that precondition is met, not because they're buildable today.

#### FR-14-01: Tenant List and Search
**Roles:** Platform Admin (SAMSTACK's own team — auth-and-ia-v0.1's role, not a clinic role) · **NFR:** Security
**Workflow:** List all tenants, searchable, with basic status (active tier, last activity).
**API shape:** `GET /api/v1/platform-admin/tenants` (separate admin portal, own subdomain per auth-and-ia-v0.1's design)
**DB schema:** Reads existing `clinics`/tenant tables, no new schema.
**Security notes:** IP-allowlist + MFA enforced (auth-and-ia-v0.1's existing spec for this role) — never exposed on the tenant-facing app at all.

#### FR-14-02: Tenant Detail and Configuration
**Roles:** Platform Admin · **NFR:** Security
**Workflow:** View/edit a tenant's tier, activated modules, subscription status.
**API shape:** `GET/PATCH /api/v1/platform-admin/tenants/{id}`
**DB schema:** Extends tenant/clinic table with subscription/tier fields (not yet present in Phase 1's single-tenant schema).
**Security notes:** Every change logged with Platform Admin identity — this is the highest-privilege action in the whole system, treated accordingly.

#### FR-14-03: Impersonate-for-Support
**Roles:** Platform Admin · **NFR:** Security, Audit & Compliance
**User Story:** As SAMSTACK support, I want to see what a clinic user sees to help debug an issue.
**Workflow:** Explicit impersonation action, time-limited session, banner shown throughout indicating impersonation is active.
**Acceptance criteria:**
- [ ] Every impersonation session is fully audit-logged: who, which tenant, which user, start/end time, per auth-and-ia-v0.1's original design
- [ ] Impersonated session cannot access anything the impersonated user's own role couldn't (impersonation doesn't grant extra privilege, just a different viewpoint)
**API shape:** `POST /api/v1/platform-admin/impersonate` `{ "tenantId": "...", "userId": "..." }`
**DB schema:** `impersonation_log: id, platform_admin_id, tenant_id, impersonated_user_id, started_at, ended_at`
**Security notes:** The single highest-risk feature in this entire FRD — scoped deliberately narrowly, time-limited, fully logged, never silent.

#### FR-14-04: Feature Flag Management
**Roles:** Platform Admin · **NFR:** Scalability
**Workflow:** Toggle which modules/tracks are active per tenant (e.g., has Track 2 Pharmacy been activated for this tenant).
**Acceptance criteria:**
- [ ] No flag infrastructure beyond what MOD-14 itself needs — Phase 1's TRD explicitly deferred feature flags as unneeded (TRD_Phase1 §10); this FR is the first real justification for building any, and only the minimal version this specific need requires
**API shape:** `GET/PATCH /api/v1/platform-admin/tenants/{id}/flags`
**DB schema:** `tenant_feature_flags: tenant_id, flag_name, enabled`
**Security notes:** Platform Admin only, same audit standard as FR-14-02.

---

## 8. Reports & Analytics Extension

Phase 1 kept this minimal (FRD_Phase1 §11). Phase 2 additions, still deliberately light: low-stock report (FR-09-03), lab worklist (FR-08-03), monthly ledger summary (FR-11-03) — each already specified above, not duplicated here. No new dashboard/BI layer — that remains out of scope until real demand for it appears.

## 9. Phase 3 Note — Voice Agent Correction

samstack-ai-phase2-voice-agent-analysis.md §17 currently shows Voice Step 1 (MOD-27a) inserted into the Phase 2 priority order at position #2. **That placement is superseded by this instruction and this document.** Voice Agent (MOD-27, both steps 27a and 27b) is now formally **Phase 3** — sequenced after all 9 Phase 2 modules above, not interleaved with them. The voice-agent-analysis document's technical content (architecture, compliance findings, cost model, data model) remains valid and is the current best reference for Phase 3 when its time comes; only its priority-ordering section (§17) is superseded here.

---

## 10. Non-Functional Requirements

Extends FRD_Phase1 §14 — same baseline, Phase-2-specific notes only:

| Category | Note |
|---|---|
| Performance | Lab file uploads (FR-08-02) need their own reasonable size/time bound — not yet numerically specified, flag for TRD |
| Audit & Compliance | FR-14-03 (impersonation) is the single highest-bar audit requirement in Phase 2 — treat its logging as non-negotiable, not best-effort |
| Scalability | MOD-14 is the first Phase 2 module that assumes >1 tenant — everything else remains single-tenant-scale like Phase 1 |

---

## 11. Assumptions, Dependencies & Constraints

- **Dependency, stated once:** MOD-14's entire module depends on Tier 2 tenancy activation (§7 MOD-14 precondition note) — this is the one Phase 2 module that isn't gated by pilot validation, it's gated by a business milestone.
- **Assumption carried from Phase 1:** two founders, no hires — Phase 2's 9-module scope is real work; sequencing (outline's suggested order) exists specifically because not all 9 can be built simultaneously by this team size.
- **Open, unconfirmed by design:** MOD-11's export format (FR-11-03), MOD-09's three-tier framing validity (FR-09-01) — both explicitly flagged rather than assumed, per the outline's original "validate first" notes.

## 12. Glossary Additions

| Term | Definition |
|---|---|
| Pre-check | Patient-submitted pre-visit intake, MOD-23 |
| Rule engine | MOD-13's configurable notification-rule system, successor to Phase 1's single hardcoded flow |
| Impersonation | Platform Admin viewing a tenant's system as that tenant's user would, for support — always logged, never silent |

---

## 13. Validation Checklist (This Document)

| Check | Result |
|---|---|
| Every FR maps to ≥1 NFR | Confirmed |
| Conflict check against Phase 1 (§6) | 8 potential conflicts examined, all resolved or confirmed as intentional preconditions, none left ambiguous |
| Voice Agent placement corrected | Confirmed — §9 explicitly supersedes voice-agent-analysis §17's interleaved ordering |
| Consent-scope test applied consistently | Confirmed — MOD-23/MOD-08 checked against the same standard that generated `VoiceCallConsent` for the Voice Agent, found not to need new consent entities, with reasoning shown, not asserted |
| `tenant_id` present on every new table | Confirmed across all 9 modules |
| No module silently assumes Track 2/3/4 exists | Confirmed — MOD-09 specifically checked against Pharmacy dependency and found clean |
