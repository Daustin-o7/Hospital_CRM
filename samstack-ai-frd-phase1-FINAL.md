# SAMSTACK AI — Functional Requirements Document (FRD)

## Phase 1 — Track 1: CRM + Billing, India Adapter, Shared SaaS Tier

---

## 1. Document Information

| Field | Value |
|---|---|
| Title | SAMSTACK AI — Functional Requirements Document, Phase 1 |
| Product | SAMSTACK AI (Doctor/Clinic CRM) |
| Version | 1.1 |
| Author | SAMSTACK AI Founding Team |
| Date | 25 August 2026 |
| Status | **Final — ready for implementation** |
| Precedes | TRD (API contracts, DB DDL, deployment architecture) |
| Supersedes | None — this is FRD #1 |

## 2. Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 1.0 | 25 Aug 2026 | SAMSTACK AI Founding Team | Initial FRD. Scope: Phase 1 / Track 1 True V1 (MOD-01 to MOD-07 + MOD-22 offline sync) per module-registry-v1.2. Informed by discovery survey n=16. |
| 1.1 | 25 Aug 2026 (evening) | SAMSTACK AI Founding Team | **Final for implementation.** Re-validated against survey-analysis-v2 (n=24, up from 16). No functional requirement changed — see §18 Validation Checklist for what was rechecked and why nothing moved. Evidence base updated throughout. |

## 3. Approvals

| Name | Role | Signature | Date |
|---|---|---|---|
| | Cofounder / Product | | |
| | Cofounder / Engineering | | |

## 4. Table of Contents
1. Document Information · 2. Revision History · 3. Approvals · 4. Table of Contents · 5. Executive Summary · 6. Business Vision & Objectives · 7. System Overview · 8. User Roles & Access Responsibilities · 9. Template Adaptations & Resolved Contradictions · 10. Detailed Functional Requirements (FR-01–FR-22) · 11. Reports & Analytics · 12. Administration Module · 13. Integration Requirements · 14. Non-Functional Requirements · 15. Assumptions, Dependencies & Constraints · 16. Glossary · 17. Expected Business Outcomes

---

## 5. Executive Summary

### 5.1 Scope of This Document
This FRD covers **Phase 1 only**: Track 1 (CRM + Billing), True V1 scope as defined in samstack-ai-v2-sharpened-plan §4, India adapter, **Shared SaaS tenancy tier only** (strategy-v0.5 §3.1 Tier 1). It specifies MOD-01 through MOD-07 (module-registry-v1.2) plus the offline-sync cross-cutting capability. Evidence base: **24 discovery-survey responses** (samstack-ai-survey-analysis-v2, up from 16 at first draft) — 67% solo practitioners (down from 81%, softening as more data arrives — see analysis §3), 83% already using WhatsApp for patient contact, 62% pharmacy-attached, 83% ABDM-aware. New in this revision: two independent respondents named "unwanted appointments" as a pain point (reinforces MOD-23's Fast-Follow priority, no Phase 1 change), and one respondent's stated objection — "price, fear of training" — is now reflected as an explicit onboarding principle in §6.

### 5.2 Out of Scope
Explicitly **not** covered here — each gets its own FRD when its phase starts, per the "FRD will be in phases" instruction:
- **Track 2** (Pharmacy + Billing) — MOD-15/16/17
- **Track 3** (Regulated AI) — MOD-18/19
- **Track 4** (IPD) — MOD-20/21/22(nursing)/26
- **Track 1 Fast-Follow** — MOD-08 through MOD-14, MOD-23/24/25
- International (UAE) adapter — `IPaymentProvider`/`IComplianceProvider` non-India implementations
- Dedicated Database and Dedicated Instance tenancy tiers (strategy-v0.5 §3.1 Tiers 2–3)
- Any AI/ML feature (Bucket A or B)

---

## 6. Business Vision & Objectives

**Vision:** Replace the paper register and disconnected tools that run 81% of surveyed practices with one connected, honestly-priced system — proven first with a small paying pilot in India before any other market or module is built.

**Strategic Objectives:**
- Land 3–5 paying pilot clinics on Phase 1 within ~10 weeks of build start (sharpened-plan-v2 §4)
- Validate the core hypothesis (§9 sharpened-plan-v2, updated with call-script items 4–6) before committing engineering time to Track 2 or beyond
- Ship an architecture (modular monolith, §4 strategy-v0.5) that absorbs Fast-Follow and later tracks without a rewrite

**Design principle added this revision:** survey-analysis-v2 §5 surfaced "price, fear of training" as a stated reason a practice didn't buy software it considered — not sticker price alone, the *perceived effort* of onboarding staff. FR-04 (Staff Invitation) and the overall UX should keep this visible: onboarding needs to be fast in the pitch, not just fast in reality. No FR content changed as a result — this is a standing design constraint on how every Phase 1 screen gets built, not a new feature.

---

## 7. System Overview

**Platform Description:** A modular-monolith web application (.NET 10 / ASP.NET Core backend, React 19 frontend, PostgreSQL) deployed as a single-tenant-configured instance for Phase 1 (multi-tenancy code paths exist in the schema but are dormant — see §9). Accessed as a responsive PWA from any device, per the original "any device" requirement.

**Core Functional Capabilities (Phase 1):**
| Module | Capability |
|---|---|
| MOD-01 | Authenticate users, enforce role-based access |
| MOD-02 | Configure the single clinic's identity (name, hours) |
| MOD-03 | Register and manage patient records |
| MOD-04 | Book appointments and manage the daily queue |
| MOD-05 | Record consultations and prescriptions |
| MOD-06 | Invoice and collect payment |
| MOD-07 | Send one WhatsApp flow: booking confirmation + reminder |

---

## 8. User Roles & Access Responsibilities

Per auth-and-ia-v0.1, narrowed to the 3 roles True V1 actually needs:

| Role | Description | Key Permissions |
|---|---|---|
| **Clinic Admin** | Practice owner or manager (solo practitioners hold this role themselves — see §9) | Full access to all modules; manages MOD-02 clinic settings; the only role that can view MOD-06 outstanding-dues reports across all patients |
| **Doctor** | Clinical staff | Full access to MOD-03/04/05; read-only on MOD-06 for their own patients; cannot edit clinic settings (MOD-02) or other staff accounts |
| **Receptionist** | Front-desk staff | Full access to MOD-03 (registration) and MOD-04 (booking/queue); can generate MOD-06 invoices but not view aggregate financial reports; **no access to MOD-05 clinical notes** |

**Access is enforced at both UI and API levels** — a Receptionist's client never even requests clinical-note endpoints, and the API independently rejects the call regardless of what the client sends (defense in depth, not UI-only gating).

---

## 9. Template Adaptations & Resolved Contradictions

Per the instruction to check for and resolve contradicting requirements, here is what didn't fit as given, and how it was resolved:

| # | Conflict | Resolution |
|---|---|---|
| 1 | **Zero-cost architecture mandate** vs. the sharpened plan's managed-identity-provider decision (samstack-ai-v2-sharpened-plan §5), which specifically replaced self-hosted Duende IdentityServer with a managed provider to fix the Identity single-point-of-failure flagged in the validation report | **Resolved:** "zero-cost" is applied to *infrastructure and framework choices* (DB, cache, backend/frontend frameworks — all already free/open-source: .NET, React, PostgreSQL, Redis), not to the specific, evidenced fix for a documented reliability risk. Managed identity stays. See FR-01 security notes. |
| 2 | **Zero-cost mandate** vs. WhatsApp (Meta per-message pricing) and Razorpay (per-transaction fee) — both structurally required for the product to function, neither has a free path at any real volume | **Resolved:** excluded from the zero-cost principle as third-party transactional services core to the product, not infrastructure. Real costs already documented in sharpened-plan-v2 §7/§10 (Cost & Dependencies). |
| 3 | Template's **30-minute session-inactivity timeout** vs. the earlier 7–30-day rotated refresh token design (auth-and-ia-v0.1 §1) | **Resolved:** both apply, at different layers. Refresh-token rotation (detects theft) stays as designed. A separate 30-minute **inactivity** timeout now forces re-authentication for Doctor and Clinic Admin roles specifically, given PHI sensitivity — see FR-01. |
| 4 | Template's **Data Retention: minimum 7 years** vs. DPDP's data-minimization principle and India's actual medical-record retention norms, which are shorter and record-type-specific | **Not resolved here — flagged.** "7 years" is a generic corporate-records default in the source template, not a verified Indian healthcare figure. Needs actual legal confirmation before it's locked in; NFR section below marks it provisional. |
| 5 | Template structure includes **Innovation Lifecycle & Workflow, Event Management, Evaluation Framework, Target Management** as core sections | **Dropped.** These are sections from an innovation-management/idea-submission platform template, not a clinic CRM — forcing content into them would mean inventing features nobody asked for. Kept every other section from the template (Document Info through Expected Business Outcomes) since those are genuinely product-agnostic and useful. |
| 6 | Survey finding: **81% of respondents are solo practitioners**, not the 2–15-doctor segment the sharpened plan's wedge was built around | **Not a contradiction in this FRD's functional requirements** — the 3-role model already supports a solo doctor holding both Clinic Admin and Doctor roles simultaneously (one login, both permission sets). It's a GTM/pricing question (survey-analysis-v1 §7), not a functional gap. |

**On the "ponytail" skill:** applied as a design discipline throughout §10 below (prefer the platform's native input types, defer libraries until a native/stdlib option is confirmed insufficient) rather than as an installed tool, since this interface can't install external Claude Code plugins directly.

---

## 10. Detailed Functional Requirements

Every FR maps to at least one NFR (§14) for traceability, per the template's requirement.

---

### FR-01: User Login
**Module:** MOD-01 · **Roles:** All · **NFR mapping:** Security (Access Control, Session Management)

**User Story:** As a Clinic Admin, Doctor, or Receptionist, I want to log in with my credentials so that I can access only the functions my role permits.

**Workflow:**
1. User submits email/username + password
2. System validates credentials against the managed identity provider (Azure Entra External ID)
3. On success, issues a JWT access token (15 min lifetime, RS256-signed) + refresh token (rotated on use)
4. Client stores tokens; subsequent API calls include the access token in the `Authorization` header

**Inputs/Outputs:** Input: email, password. Output: access token, refresh token, user profile (id, name, role).

**Edge Cases:**
- Wrong password 5x in 10 minutes → account locked 15 minutes, user notified
- Access token expired mid-session → client silently refreshes via refresh token; if refresh token also expired/revoked, redirect to login
- **30-minute inactivity** (no API calls) for Doctor/Clinic Admin roles → session forcibly ends, re-login required, regardless of refresh token validity (resolves contradiction #3, §9)

**Acceptance Criteria:**
- [ ] Valid credentials return a token pair within 2 seconds
- [ ] Invalid credentials return a generic error (never reveal whether the email exists — enumeration protection)
- [ ] Locked account cannot authenticate even with correct password until lockout expires
- [ ] Doctor/Clinic Admin sessions expire after 30 min inactivity; Receptionist sessions do not (front-desk continuity prioritized, lower PHI-depth role)

**API Shape:**
```
POST /api/v1/auth/login
Request: { "email": "string", "password": "string" }
Response 200: {
  "accessToken": "jwt...", "refreshToken": "opaque...",
  "expiresIn": 900,
  "user": { "id": "uuid", "name": "string", "role": "clinic_admin|doctor|receptionist" }
}
Response 401: { "error": "invalid_credentials" }
Response 423: { "error": "account_locked", "retryAfterSeconds": 900 }
```

**Database Schema Notes:**
```
users: id (uuid, pk), tenant_id (uuid, fk, dormant in V1), email (unique), password_hash,
       role (enum), failed_login_count (int), locked_until (timestamptz, nullable),
       created_at, updated_at
refresh_tokens: id (uuid, pk), user_id (fk), token_hash, issued_at, expires_at, revoked_at (nullable)
```

**Security Notes:** RS256 (asymmetric — every future service verifies via public key without holding the signing secret, per strategy-v0.5 §3.3 forward-compatibility). Passwords never logged. Rate-limited at the API Gateway (5 attempts/10 min/IP+account combo) — OWASP A07 (Identification & Authentication Failures) mitigation.

---

### FR-02: Role-Based Access Enforcement
**Module:** MOD-01 · **Roles:** All (system-enforced) · **NFR mapping:** Security (Access Control)

**Description:** Every API endpoint checks the caller's role claim against a permission table before executing. No endpoint trusts client-side role display alone.

**Workflow:**
1. Request arrives with JWT
2. API Gateway (or middleware) extracts `role` claim
3. Middleware checks the endpoint's required-role list
4. Reject with 403 if role insufficient; proceed if allowed

**Edge Cases:**
- Receptionist attempts to call a clinical-note endpoint directly (bypassing UI) → 403, logged as an access-control event
- Role changed mid-session (e.g., Clinic Admin demotes a Doctor) → old token's role claim is stale until next refresh; refresh-token rotation forces re-issue within the token's 15-min max lifetime, capping exposure

**Acceptance Criteria:**
- [ ] Every FR-03 through FR-22 endpoint is covered by an explicit role table (see each FR's Roles line)
- [ ] Denied requests return 403 with no information about what the correct role would have been (avoid leaking permission structure)
- [ ] All denials are audit-logged with user id, endpoint, timestamp

**API Shape:** No dedicated endpoint — this is middleware applied to every other FR's API surface.

**Database Schema Notes:** Uses `users.role`; permission table can be a static in-code map for Phase 1 (3 roles, small surface) rather than a DB-driven permissions table — deferred complexity until roles grow (MOD-15 Pharmacist, MOD-20 Nurse in later phases), consistent with the ponytail discipline (§9) of not building configurability the product doesn't need yet.

**Security Notes:** OWASP A01 (Broken Access Control) is the primary risk this FR exists to mitigate — enforced server-side only, never trusting a client-supplied role.

---

### FR-03: Password Reset
**Module:** MOD-01 · **Roles:** All · **NFR mapping:** Security

**User Story:** As any user, I want to reset a forgotten password so I can regain access without calling support.

**Workflow:** Request reset → email with time-limited token (30 min expiry) → user sets new password → all existing refresh tokens for that user revoked.

**Edge Cases:** Reset requested for non-existent email → same generic "check your email" response either way (no enumeration). Reset link reused after password already changed → rejected, token single-use.

**Acceptance Criteria:**
- [ ] Reset token expires in 30 minutes or on first use, whichever first
- [ ] Successful reset revokes all prior sessions for that user (forces re-login everywhere)

**API Shape:**
```
POST /api/v1/auth/password-reset/request  { "email": "string" }  → 200 always (no enumeration)
POST /api/v1/auth/password-reset/confirm  { "token": "string", "newPassword": "string" }  → 200 | 400 invalid_or_expired
```

**Database Schema Notes:** `password_reset_tokens: id, user_id, token_hash, expires_at, used_at (nullable)`

**Security Notes:** Token delivered via the managed identity provider's own email flow where possible, reducing SAMSTACK's own attack surface for credential delivery.

---

### FR-04: Staff Invitation & Onboarding
**Module:** MOD-01 · **Roles:** Clinic Admin · **NFR mapping:** Security (Access Control)

**User Story:** As a Clinic Admin, I want to invite a Doctor or Receptionist by email so they can create their own login without me setting a password for them.

**Workflow:** Clinic Admin enters name + email + role → system sends invite link (72-hour expiry) → invitee sets their own password → account activated.

**Edge Cases:** Invite sent to an email already registered → error, no duplicate account. Invite expires unused → Clinic Admin can resend, old link invalidated.

**Acceptance Criteria:**
- [ ] Only Clinic Admin can invite; invited role cannot be "Clinic Admin" in Phase 1 (single-admin model — adding co-admins is a Fast-Follow concern, not V1)
- [ ] Invite links are single-use and expire in 72 hours

**API Shape:**
```
POST /api/v1/staff/invite  { "name": "string", "email": "string", "role": "doctor|receptionist" }
Response 201: { "inviteId": "uuid", "expiresAt": "iso8601" }
```

**Database Schema Notes:** `staff_invites: id, clinic_id, name, email, role, token_hash, expires_at, accepted_at (nullable)`

**Security Notes:** Invite tokens are single-use, high-entropy, hashed at rest (never store the raw token).

---

### FR-05: Clinic Profile Configuration
**Module:** MOD-02 · **Roles:** Clinic Admin · **NFR mapping:** Usability, Scalability

**User Story:** As a Clinic Admin, I want to set my clinic's name and working hours so the system reflects my actual practice.

**Workflow:** Clinic Admin edits clinic name, working hours (per weekday), holiday dates → saved → reflected in FR-10 (booking) available-slot calculation.

**Edge Cases:** Working hours edited mid-day with existing bookings outside the new hours → existing bookings are NOT auto-cancelled, flagged for manual review (never silently cancel a patient's appointment).

**Acceptance Criteria:**
- [ ] Changes take effect for new bookings immediately; existing bookings unaffected
- [ ] At least one working day must remain defined (can't save an all-closed configuration by mistake)

**API Shape:**
```
PUT /api/v1/clinic/profile
{ "name": "string", "workingHours": [{"day":"mon","open":"09:00","close":"18:00"}, ...], "holidays": ["2026-10-02"] }
```

**Database Schema Notes:** `clinics: id, tenant_id (dormant), name, created_at` · `clinic_hours: clinic_id, day_of_week, open_time, close_time` · `clinic_holidays: clinic_id, date`

**Security Notes:** Clinic Admin-only write; all other roles read-only (needed by FR-10/11 for slot calculation).

---

### FR-06: Register New Patient
**Module:** MOD-03 · **Roles:** Receptionist, Doctor, Clinic Admin · **NFR mapping:** Performance, Audit & Compliance

**User Story:** As a Receptionist, I want to register a new patient quickly so a walk-in isn't kept waiting.

**Workflow:** Enter name, phone, DOB or age, gender, address (optional) → check for likely duplicate (same phone number) → confirm or link to existing → save → DPDP consent captured (FR-09) as part of the same flow, not a separate step the patient can skip.

**Edge Cases:** Same phone number already registered → prompt "possible existing patient," Receptionist chooses new record or opens existing. Missing DOB (patient doesn't know exact birthdate, common in some demographics) → accept approximate age instead, flagged as approximate.

**Acceptance Criteria:**
- [ ] Registration completes in under 3 required fields (name, phone, one of DOB/age) — everything else optional at registration time, addable later (matches "as little friction as possible" from the discovery-survey-informed UX priority)
- [ ] Duplicate-phone check runs before save, not after
- [ ] Consent (FR-09) is captured in the same transaction — a patient record cannot exist without a consent record

**API Shape:**
```
POST /api/v1/patients
{ "name": "string", "phone": "string", "dob": "date|null", "approxAge": "int|null",
  "gender": "string", "address": "string|null", "consent": { "accepted": true, "purpose": "care_delivery" } }
Response 201: { "patientId": "uuid", "possibleDuplicateOf": "uuid|null" }
```

**Database Schema Notes:** `patients: id, tenant_id (dormant), name, phone, dob (nullable), approx_age (nullable), gender, address (nullable), created_by (fk users), created_at`

**Security Notes:** Phone number is the natural dedup key but is also PII — indexed, not logged in plaintext in application logs.

---

### FR-07: Search & View Patient Profile
**Module:** MOD-03 · **Roles:** Receptionist (list/search only), Doctor, Clinic Admin (full profile) · **NFR mapping:** Performance (Search Response ≤2s), Security

**User Story:** As a Doctor, I want to pull up a patient's full history quickly during a consultation.

**Workflow:** Search by name or phone → results list → select → full profile view (demographics + FR-16 treatment history + FR-04 appointments, tabbed).

**Edge Cases:** Search with fewer than 3 characters → require at least 3 before querying (avoid returning near-the-whole-table results). No results → clear "no match, register new?" prompt linking to FR-06.

**Acceptance Criteria:**
- [ ] Search returns results within 2 seconds (NFR baseline)
- [ ] Receptionist sees demographics + appointment history only, not clinical notes (role boundary from §8)

**API Shape:**
```
GET /api/v1/patients/search?q={string}  → [{ "id", "name", "phone", "age" }, ...]
GET /api/v1/patients/{id}  → full profile, shape varies by caller's role (server-side filtering, not client-side hiding)
```

**Database Schema Notes:** Index on `patients(phone)` and a trigram/text index on `patients(name)` for fast partial-name search at V1 scale.

**Security Notes:** Response shape is role-filtered server-side — the API itself omits clinical fields for a Receptionist caller rather than sending everything and trusting the client to hide it.

---

### FR-08: Edit Patient Details
**Module:** MOD-03 · **Roles:** Receptionist, Doctor, Clinic Admin · **NFR mapping:** Audit & Compliance

**Workflow:** Open profile → edit demographic fields → save → change logged.

**Edge Cases:** Concurrent edit by two staff members → last-write-wins with a warning shown if the record changed since the editor loaded it (optimistic concurrency, not a hard lock — front-desk speed matters more than rare edit collisions at this scale).

**Acceptance Criteria:**
- [ ] Every field edit is captured in the audit trail (who, what changed, when) — DPDP requirement, not optional
- [ ] Phone number changes trigger the same duplicate-check as FR-06

**API Shape:** `PATCH /api/v1/patients/{id}  { "field": "value", ... }`

**Database Schema Notes:** `patient_audit_log: id, patient_id, changed_by (fk users), field_name, old_value, new_value, changed_at`

**Security Notes:** Audit log is append-only (no update/delete permission at the DB role level) — immutability enforced at the database, not just the application layer.

---

### FR-09: Record Patient Consent (DPDP)
**Module:** MOD-03 · **Roles:** Receptionist, Doctor, Clinic Admin (capture); Clinic Admin (view/export all) · **NFR mapping:** Audit & Compliance, Security

**Description:** DPDP Act 2023 requires purpose-specific, recorded consent — not a buried checkbox. This FR makes consent a first-class record, not a UI afterthought (strategy-v0.5 §2).

**Workflow:** Captured inline during FR-06 registration → purpose stated explicitly ("care delivery and appointment/billing records") → patient (or guardian, for minors) confirms → timestamped record created → re-confirmable/withdrawable later via patient request handled by Clinic Admin.

**Edge Cases:** Minor patient → consent captured from guardian, guardian's relationship recorded. Patient later requests data deletion → handled as a manual Clinic Admin action in Phase 1 (a full self-service deletion flow is Fast-Follow, not V1 — flagging rather than silently deferring).

**Acceptance Criteria:**
- [ ] No patient record can be created without an associated consent record (enforced at the FR-06 transaction level)
- [ ] Consent record captures: purpose, timestamp, who captured it, guardian info if applicable

**API Shape:** Embedded in FR-06's request body (see above) — not a separate endpoint, to avoid a two-step flow the patient/staff could skip.

**Database Schema Notes:** `patient_consent: id, patient_id, purpose, captured_by (fk users), guardian_name (nullable), guardian_relationship (nullable), captured_at, withdrawn_at (nullable)`

**Security Notes:** This table is the audit anchor for DPDP compliance — treated as immutable (withdrawal is a new row/flag, never a delete of the original consent record).

---

### FR-10: Book Appointment
**Module:** MOD-04 · **Roles:** Receptionist, Doctor, Clinic Admin · **NFR mapping:** Performance, Availability

**User Story:** As a Receptionist, I want to book an appointment against available slots so double-booking doesn't happen.

**Workflow:** Select patient (or register new via FR-06 inline) → select date → system shows available slots per FR-05 working hours minus existing bookings → confirm → booking created → triggers FR-20 WhatsApp confirmation.

**Edge Cases:** Two staff book the same slot simultaneously → DB-level unique constraint on (doctor, date, time-slot) rejects the second with a clear "just booked" message, not a silent overwrite. Walk-in with no prior appointment → still flows through this FR with "now" as the requested time, entering the queue (FR-12) directly.

**Acceptance Criteria:**
- [ ] Slot conflicts are impossible at the database level, not just checked in application code (race-condition safe)
- [ ] Booking triggers FR-20 asynchronously — a WhatsApp/notification failure must never fail the booking itself (event-driven decoupling per strategy-v0.5 §5)

**API Shape:**
```
POST /api/v1/appointments
{ "patientId": "uuid", "date": "2026-09-01", "time": "10:30", "type": "scheduled|walkin" }
Response 201: { "appointmentId": "uuid", "queueToken": "int|null" }
Response 409: { "error": "slot_unavailable" }
```

**Database Schema Notes:** `appointments: id, tenant_id (dormant), patient_id, doctor_id, date, time_slot, type, status (enum: booked/checked_in/completed/cancelled/no_show), created_at` — unique constraint on `(doctor_id, date, time_slot)` where status != cancelled.

**Security Notes:** N/A beyond standard RBAC (FR-02) and audit (all state changes logged per FR-08's pattern).

---

### FR-11: View Daily Schedule
**Module:** MOD-04 · **Roles:** All · **NFR mapping:** Performance (Page Load ≤3s)

**Workflow:** Default view on login — today's appointments in time order, current queue position highlighted.

**Acceptance Criteria:**
- [ ] Loads within 3 seconds (NFR baseline) for a full day's schedule at V1 scale (tens of appointments, not hundreds)
- [ ] Auto-refreshes queue state without a manual page reload (polling is sufficient at this scale — no websocket infrastructure needed for V1, per the ponytail discipline of not building for scale the product doesn't have yet)

**API Shape:** `GET /api/v1/appointments?date=2026-09-01` → ordered list with current status

**Database Schema Notes:** Uses the `appointments` table from FR-10; indexed on `(doctor_id, date)`.

**Security Notes:** Receptionist/Doctor see only their clinic's schedule (single-tenant in V1, but the query is already tenant-scoped in code for forward-compatibility).

---

### FR-12: Generate Queue Token
**Module:** MOD-04 · **Roles:** Receptionist, Doctor, Clinic Admin · **NFR mapping:** Performance

**User Story:** As a Receptionist, I want each checked-in patient to get a simple numeric token so the waiting room has a clear order.

**Workflow:** Patient checks in (scheduled or walk-in) → next sequential token number for the day assigned → status moves to `checked_in`.

**Edge Cases:** Day rollover at midnight → token sequence resets to 1 for the new day. Patient checks in then leaves without being seen → Receptionist can mark `no_show` manually, freeing the visual queue without deleting the record.

**Acceptance Criteria:**
- [ ] Token numbers are sequential per day, starting at 1, no gaps from cancelled-before-checkin appointments (only checked-in patients consume a token number)

**API Shape:** `POST /api/v1/appointments/{id}/checkin` → `{ "queueToken": 7 }`

**Database Schema Notes:** `queue_token` column added to `appointments`, assigned only at check-in time, not at booking time.

**Security Notes:** N/A beyond standard RBAC.

---

### FR-13: Reschedule / Cancel Appointment
**Module:** MOD-04 · **Roles:** Receptionist, Doctor, Clinic Admin · **NFR mapping:** Availability

**Workflow:** Select appointment → reschedule (re-runs FR-10's slot-availability check) or cancel (reason optional, not required — don't force friction on a busy front desk) → triggers a WhatsApp update if within MOD-07's single-flow scope allows (V1: cancellation notice is out of scope for the single WhatsApp flow — see FR-20 note).

**Acceptance Criteria:**
- [ ] Cancelled slots immediately become available for rebooking
- [ ] Reschedule history is retained (old date/time), not overwritten — needed for FR-16 and any future no-show analysis

**API Shape:** `PATCH /api/v1/appointments/{id}  { "action": "reschedule", "newDate": ..., "newTime": ... }` or `{ "action": "cancel", "reason": "string|null" }`

**Database Schema Notes:** `appointment_history: id, appointment_id, previous_date, previous_time, changed_at, changed_by`

**Security Notes:** N/A beyond standard RBAC.

---

### FR-14: Create Consultation Note
**Module:** MOD-05 · **Roles:** Doctor · **NFR mapping:** Audit & Compliance, Security

**User Story:** As a Doctor, I want to record chief complaint, observations, and diagnosis for each visit.

**Workflow:** Open a checked-in patient's appointment → free-text consultation note (no speciality templates in V1 — Fast-Follow per MOD-12) → save → becomes part of FR-16's timeline.

**Edge Cases:** Doctor needs to amend a note after saving (resolves the UX gap flagged in the idea-validation report §7) → amendments create a new versioned entry, the original is never overwritten or deleted, both are visible with clear "amended on [date]" labeling.

**Acceptance Criteria:**
- [ ] A saved note is never silently overwritten — every edit is a new version, original preserved (patient-safety and audit requirement)
- [ ] Only the authoring Doctor or another Doctor at the same clinic can amend; Receptionist has zero access (§8)

**API Shape:**
```
POST /api/v1/appointments/{id}/consultation
{ "chiefComplaint": "string", "observations": "string", "diagnosis": "string" }
PATCH /api/v1/consultations/{id}  { "amendment": "string", "reason": "string" }  → creates new version
```

**Database Schema Notes:** `consultations: id, appointment_id, doctor_id, chief_complaint, observations, diagnosis, version, previous_version_id (nullable, self-fk), created_at`

**Security Notes:** Doctor-only write and read. This table holds the most sensitive clinical data in Phase 1 — encrypted at rest (NFR baseline), full audit trail on every version.

---

### FR-15: Write Prescription
**Module:** MOD-05 · **Roles:** Doctor · **NFR mapping:** Audit & Compliance

**Workflow:** From the consultation screen, add medicine name, dosage, frequency, duration (free text in V1 — no drug database/autocomplete yet, that's a Bucket-A-AI Fast-Follow item, MOD-18) → save → viewable/printable.

**Edge Cases:** Prescription needs correction after signing → same versioning pattern as FR-14, never silently edited.

**Acceptance Criteria:**
- [ ] Prescription is linked to a specific consultation (FR-14), never freestanding
- [ ] Printable/shareable view renders clinic name (FR-05) and doctor name automatically

**API Shape:** `POST /api/v1/consultations/{id}/prescription  { "items": [{ "medicine": "string", "dosage": "string", "frequency": "string", "duration": "string" }] }`

**Database Schema Notes:** `prescriptions: id, consultation_id, created_at` · `prescription_items: id, prescription_id, medicine_text, dosage_text, frequency_text, duration_text`

**Security Notes:** Same clinical-data protections as FR-14.

---

### FR-16: View Treatment History Timeline
**Module:** MOD-05 · **Roles:** Doctor (full), Clinic Admin (full), Receptionist (none — §8) · **NFR mapping:** Performance

**Workflow:** Within a patient's profile (FR-07), a chronological timeline of all past consultations + prescriptions.

**Acceptance Criteria:**
- [ ] Loads within 3 seconds even for a patient with years of history (NFR baseline, tested against MOD-05's projected data volume)
- [ ] Amended notes (FR-14) display with clear version history, not just the latest version

**API Shape:** `GET /api/v1/patients/{id}/history` → ordered list of consultations with nested prescriptions

**Database Schema Notes:** Read query joining `consultations`, `prescriptions`, `prescription_items` — indexed on `consultations(patient_id via appointments, created_at)`.

**Security Notes:** Server-side role filtering, same principle as FR-07.

---

### FR-17: Generate Invoice
**Module:** MOD-06 · **Roles:** Receptionist, Doctor, Clinic Admin · **NFR mapping:** Audit & Compliance, Security

**User Story:** As a Receptionist, I want to generate a GST-compliant invoice for a consultation so billing is fast and correct.

**Workflow:** From a completed appointment → line items (consultation fee, any add-ons) → GST calculated per applicable slab → invoice generated → status `unpaid` until FR-18.

**Edge Cases:** Connectivity drops mid-generation (front desk offline scenario) → invoice is created locally and syncs on reconnect (see the offline-sync cross-cutting FR below) rather than failing the transaction.

**Acceptance Criteria:**
- [ ] Every invoice has a sequential, gapless invoice number per clinic (GST requirement)
- [ ] GST amount is calculated, not manually entered, to prevent staff calculation errors

**API Shape:**
```
POST /api/v1/invoices
{ "appointmentId": "uuid", "lineItems": [{ "description": "string", "amount": "number" }] }
Response 201: { "invoiceId": "uuid", "invoiceNumber": "string", "gstAmount": "number", "total": "number" }
```

**Database Schema Notes:** `invoices: id, tenant_id (dormant), appointment_id, invoice_number (unique, sequential per clinic), subtotal, gst_amount, total, status (unpaid/paid/partial), created_at`

**Security Notes:** Invoice numbers are gapless and immutable once issued (regulatory requirement) — cancellation creates a linked credit note, never a deletion.

---

### FR-18: Collect Payment (Razorpay)
**Module:** MOD-06 · **Roles:** Receptionist, Doctor, Clinic Admin · **NFR mapping:** Security, Availability

**Workflow:** From an unpaid invoice → select payment method (cash, or Razorpay for UPI/card) → for Razorpay, system calls Razorpay's API to create a payment link/order, confirms via webhook → invoice marked paid.

**Edge Cases:** Razorpay webhook delayed or lost → invoice stays `unpaid` until a reconciliation check catches it (poll Razorpay's status endpoint if a webhook hasn't arrived within a set window) — never silently marks paid without confirmation. Duplicate webhook delivery → idempotency key prevents double-processing the same payment.

**Acceptance Criteria:**
- [ ] Cash payments record immediately, no external dependency
- [ ] Razorpay payments only mark `paid` on confirmed webhook or reconciled poll, never optimistically
- [ ] Webhook processing is idempotent (same event processed twice has no additional effect)

**API Shape:**
```
POST /api/v1/invoices/{id}/payment  { "method": "cash|razorpay", "amount": "number" }
Response 200 (cash): { "status": "paid" }
Response 200 (razorpay): { "paymentLinkUrl": "string" }
POST /api/v1/webhooks/razorpay  (Razorpay-signed payload → internal reconciliation)
```

**Database Schema Notes:** `payments: id, invoice_id, method, amount, razorpay_payment_id (nullable), status, idempotency_key (unique), created_at`

**Security Notes:** Razorpay webhook signature verified against Razorpay's published secret before trusting any payload (OWASP A08 — Software and Data Integrity Failures mitigation). No card/UPI details ever touch SAMSTACK's own servers — Razorpay-hosted checkout only.

---

### FR-19: View Outstanding Dues
**Module:** MOD-06 · **Roles:** Clinic Admin (all patients), Doctor (own patients only) · **NFR mapping:** Performance

**Workflow:** List of unpaid/partially-paid invoices, filterable by patient or date range.

**Acceptance Criteria:**
- [ ] Receptionist does NOT see aggregate dues across all patients (§8 — financial-report role boundary), only per-invoice status while processing a specific payment

**API Shape:** `GET /api/v1/invoices?status=unpaid&doctorId={optional}`

**Database Schema Notes:** Query against `invoices`, indexed on `(status, created_at)`.

**Security Notes:** Server-side role filtering, consistent with FR-07/FR-16.

---

### FR-20: Send Appointment Confirmation
**Module:** MOD-07 · **Roles:** System-triggered (no direct user action) · **NFR mapping:** Availability, Integration

**Description:** On successful FR-10 booking, an async event triggers a WhatsApp message via the Notification interface (channel-abstracted per strategy-v0.5 §5 — WhatsApp today, SMS/email swappable later without touching this FR's logic).

**Workflow:** `AppointmentConfirmed` event → Notification handler → WhatsApp Business API (via BSP or direct Meta Cloud API) → delivery status tracked.

**Edge Cases:** WhatsApp API down/rate-limited → booking (FR-10) already succeeded and is unaffected; message queued for retry (exponential backoff, 3 attempts) then marked failed if still undelivered — staff can see delivery status but the appointment itself was never at risk.

**Acceptance Criteria:**
- [ ] A WhatsApp send failure never rolls back or blocks the appointment booking (decoupling verified — this is the direct fix for the cascading-failure risk flagged in strategy-v0.5 §5)
- [ ] Delivery status (sent/delivered/failed) visible on the appointment record

**API Shape:** Internal event, not a public API — `AppointmentConfirmed { appointmentId, patientPhone, clinicName, dateTime }` consumed by the Notification handler.

**Database Schema Notes:** `notification_log: id, appointment_id, channel, template, status, sent_at, delivered_at (nullable), failed_reason (nullable)`

**Security Notes:** Patient phone numbers passed to a third party (BSP/Meta) — covered under the DPDP consent captured in FR-09 (purpose includes "appointment communication").

---

### FR-21: Send Appointment Reminder
**Module:** MOD-07 · **Roles:** System-triggered · **NFR mapping:** Availability, Integration

**Description:** The second half of MOD-07's single flow — a scheduled reminder sent ahead of the appointment (fixed interval in V1, e.g., the day before; a configurable rules engine is Fast-Follow MOD-13, not V1).

**Workflow:** Scheduled job checks tomorrow's confirmed appointments → sends reminder via the same channel-abstracted Notification path as FR-20.

**Edge Cases:** Appointment cancelled after reminder already sent → no retraction message in V1 (acceptable — the reminder mentioning a since-cancelled visit is a minor UX rough edge, not a functional failure, and not worth building retraction logic for in True V1).

**Acceptance Criteria:**
- [ ] Reminder fires once per appointment, not duplicated on retry (idempotent scheduling)
- [ ] Uses the same delivery-status tracking as FR-20

**API Shape:** Internal scheduled job, same event/handler pattern as FR-20.

**Database Schema Notes:** Reuses `notification_log`.

**Security Notes:** Same as FR-20.

---

### FR-22: Offline-Tolerant Registration & Billing Sync
**Module:** Cross-cutting (Offline-First Sync, strategy-v0.5 §2 finding, elevated from a Pharmacy-only concern to a core V1 NFR) · **Roles:** Receptionist primarily · **NFR mapping:** Availability, Reliability

**Description:** FR-06 (registration) and FR-17/18 (billing) must survive a dropped front-desk connection — a real, evidenced constraint (samstack-ai-v2-sharpened-plan §2, competitor research showing offline-tolerance is table stakes in this market, not a nice-to-have).

**Workflow:** Client-side queues writes locally (in-memory/IndexedDB, not localStorage — see technical note below) when a network call fails → retries on reconnect → server deduplicates via idempotency keys generated client-side at write time.

**Edge Cases:** Same patient registered twice from two different offline sessions before either synced → server-side duplicate-phone detection (FR-06) runs at sync time, flags for manual merge rather than silently creating two records.

**Acceptance Criteria:**
- [ ] A registration or invoice created while offline is never lost — it syncs automatically on reconnect
- [ ] No duplicate financial records are created even if a sync is retried multiple times (idempotency key enforced server-side)

**API Shape:** Every write endpoint in FR-06/FR-17/FR-18 accepts an optional client-generated `idempotencyKey`; server rejects a second write with the same key as a no-op success (not an error), returning the original result.

**Database Schema Notes:** `idempotency_key` column (unique) added to `patients` (registration) and `invoices`/`payments` tables.

**Security Notes:** Client-side offline storage holds only what's needed to complete the pending sync (not a general local cache of patient data) — minimizes exposure if a front-desk device is lost or stolen while offline data is queued.

---

## 11. Reports & Analytics Module

Phase 1 keeps this deliberately minimal — consistent with the True V1 discipline (§9):
- Daily appointment count and completion rate (derived from `appointments.status`)
- Outstanding dues total (FR-19, aggregate view for Clinic Admin)
- No dashboards, trend charts, or exports in V1 — Fast-Follow (MOD-11 Finance Ledger, MOD-14 Admin Portal) territory.

## 12. Administration Module

Phase 1 administration is entirely within MOD-01 (FR-04 staff invites) and MOD-02 (FR-05 clinic settings) — there is no separate Platform Admin portal in this phase (MOD-14 is Fast-Follow, needed only once there's more than one tenant to administer).

## 13. Integration Requirements

| Integration | Type | Notes |
|---|---|---|
| Razorpay | REST API + webhook | FR-18. Real per-transaction cost — excluded from the zero-cost principle (§9, resolution #2) |
| WhatsApp (Meta Cloud API or BSP) | REST API | FR-20/21. Real per-message cost — same exclusion |
| Azure Entra External ID | OpenID Connect | FR-01. Managed identity — see §9 resolution #1 for why this isn't self-hosted despite the zero-cost mandate |

No other external integrations in Phase 1 — ABDM/ABHA (raised as a priority by survey-analysis-v1 §3) is explicitly Fast-Follow, not Phase 1, despite the strong survey signal, to keep this FRD's scope honest to the True V1 boundary already agreed.

## 14. Non-Functional Requirements

Adapted from the template's baseline — kept where applicable, adjusted where V1's actual scale or Indian-healthcare context differs, flagged where unverified.

| Category | Attribute | Requirement | Priority | Note |
|---|---|---|---|---|
| Performance | Page Load | ≤3s under normal load | MUST | Unchanged from template |
| Performance | Search Response | ≤2s | MUST | FR-07 |
| Performance | Concurrent Users | Architecture supports 500+ | SHOULD | **V1 pilot reality is dozens of concurrent users across 3–5 clinics** — 500 is a scale target the modular monolith is designed toward (strategy-v0.5 §4), not a V1 load-test requirement |
| Availability | System Uptime | 99.9% SLA target | MUST | Honest note: achieving this needs real on-call/monitoring maturity a 2-person pre-revenue team doesn't have yet — documented as the target to design toward, not a guarantee for week 1 |
| Availability | Disaster Recovery | RTO ≤4h, RPO ≤1h | MUST | Met via managed Postgres point-in-time recovery |
| Security | Access Control | RBAC at UI + API | MUST | FR-02 |
| Security | Encryption | TLS 1.2+ transit, AES-256 rest | MUST | Unchanged |
| Security | Session Management | 30-min inactivity timeout (Doctor/Clinic Admin), refresh rotation all roles | MUST | Resolved per §9 #3 |
| Scalability | User Growth | 10x horizontal scaling without redesign | MUST | Modular monolith design intent (strategy-v0.5 §4) |
| Scalability | Data Volume | 100,000+ records, 5+ years | SHOULD | Unchanged |
| Audit & Compliance | Audit Trail | Immutable log for all create/update/delete/access | MUST | Broadened from the template's "approval" (not applicable here) to "access," matching DPDP's actual emphasis |
| Audit & Compliance | Data Retention | **Provisional — needs legal verification** | MUST | Template's "7 years" is a generic default, not a confirmed Indian medical-record figure — do not build a hard 7-year retention policy into the schema until confirmed |
| Usability | Accessibility | WCAG 2.1 AA | SHOULD | Unchanged |
| Usability | Browser Support | Chrome/Edge/Firefox/Safari latest 2 | MUST | Plus: PWA-installable, mobile-first given front-desk device reality |

## 15. Assumptions, Dependencies & Constraints

**Constraints:**
- **Modified zero-cost constraint** (hard, per §9): infrastructure/framework layer must be free/open-source; third-party transactional services (payments, WhatsApp) and the specific managed-identity decision are explicitly excluded, with reasoning documented above.
- Team: 2 founders, no hires (sharpened-plan-v2 §4) — drives every "V1 vs Fast-Follow" decision in this document.
- Single tenant, single region (India) for the entire Phase 1 scope.

**Dependencies:**
- Razorpay merchant account active before FR-18 can be tested end-to-end
- WhatsApp Business API access (Meta Cloud API or BSP account) approved before FR-20/21 can be tested
- Managed identity provider (Entra External ID) tenant configured before FR-01

**Assumptions:**
- Pilot clinics are OPD-only (no IPD) — consistent with the module registry's Track 4 sequencing
- Solo practitioners will use the Clinic Admin + Doctor role combination on one login (§9 #6) rather than needing a merged/simplified role — **flagged for confirmation in the pilot**, since it's untested UX, not just an untested business assumption

## 16. Glossary

| Term | Definition |
|---|---|
| ABDM/ABHA | Ayushman Bharat Digital Mission / Ayushman Bharat Health Account — India's national digital health ID and interoperability framework |
| DPDP | Digital Personal Data Protection Act, 2023 (India) |
| EMR | Electronic Medical Record |
| FR | Functional Requirement |
| GST | Goods and Services Tax (India) |
| JWT | JSON Web Token |
| NFR | Non-Functional Requirement |
| OPD | Out-Patient Department (as distinct from IPD, in-patient) |
| PHI | Protected Health Information |
| RBAC | Role-Based Access Control |
| RPO/RTO | Recovery Point/Time Objective |
| Track | A sellable module group per strategy-v0.5 §3.2 (Track 1 = CRM+Billing, etc.) |

## 17. Expected Business Outcomes

- 3–5 pilot clinics running Phase 1 in production within ~10 weeks of build start
- Direct evidence (not survey proxy) on the open questions in samstack-ai-v2-sharpened-plan §9, including the new MOD-23/24/25 pain-checks
- A codebase where Track 2 (Pharmacy), the international adapter, and Fast-Follow modules are additive, not a rewrite — the actual test of whether the modular-monolith bet (strategy-v0.5 §4) paid off

## 18. Validation Checklist (This Revision)

Explicit record of what was rechecked before marking this final, not just an assertion that it happened:

| Check | Result |
|---|---|
| Every FR-01–FR-22 maps to ≥1 NFR | Confirmed — no orphaned requirements |
| §5.2 Out of Scope lists every module-registry-v1.2 module not covered here (MOD-08–14, 15–19, 20–26) | Confirmed, unchanged |
| Survey-analysis-v2 (n=24) findings checked against Phase 1 scope | "Unwanted appointments" → reinforces MOD-23 priority, no Phase 1 FR change needed (MOD-23 is Fast-Follow, not this document's scope). "Fear of training" → added as design principle (§6), not a new FR. Practice-size mix shift → confirmed GTM/pricing question per survey-analysis-v2 §9, not functional |
| FR-06 (registration friction) vs. FR-09 (consent capture) | No conflict — consent is captured in the same transaction as registration, doesn't add a required field beyond confirmation |
| FR-01 session policy (30-min inactivity) vs. NFR table | Consistent, same figures in both places |
| Role boundaries (§8) vs. every FR's Roles line | Consistent — Receptionist has no clinical-note or aggregate-financial access anywhere in FR-01–22 |
| §9 contradiction resolutions (zero-cost, session timeout, retention) | Still hold, no new conflicts introduced by this revision |

**Not yet resolved, carried forward as open:** §14's data-retention figure remains provisional pending legal verification — implementation should not hard-code a 7-year retention rule into the schema this evening.
