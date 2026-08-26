# System State: Pending Work & Functional Backlog (`state/pending.md`)

This document details the complete pending backlog of Phase 1 implementation tasks (FR-01 through FR-22) for SAMSTACK AI.

---

## Purpose

To provide a clear, prioritized tracking list of all upcoming functional requirements to be implemented during Phase 1.

---

## Scope

Covers all 22 functional requirements defined in `samstack-ai-frd-phase1-FINAL.md`.

---

## Verified Information

### Pending Functional Requirements Backlog

- [ ] **FR-01: User Login**: Managed identity auth, JWT RS256, 15m access token, refresh token rotation, 30m inactivity timeout for Doctor/Admin.
- [ ] **FR-02: Role Enforcement**: Server-side RBAC middleware covering all API endpoints.
- [ ] **FR-03: Password Reset**: Email reset flow, 30m token expiry, instant session revocation.
- [ ] **FR-04: Staff Invitation**: Clinic Admin email invitations (72h expiry, single-use).
- [ ] **FR-05: Clinic Profile Setup**: Operating hours, holiday dates configuration.
- [ ] **FR-06: Register Patient**: Name, phone, DOB/age entry (max 3 required fields), phone duplicate check, inline consent capture.
- [ ] **FR-07: Search / View Patient Profile**: Phone index & name trigram search, role-based demographic filtering.
- [ ] **FR-08: Edit Patient Details**: Demographics update with mandatory append-only audit logging.
- [ ] **FR-09: Capture DPDP Consent**: Purpose-specific consent persistence within patient creation transaction.
- [ ] **FR-10: Book Appointment**: Calendar slot booking, unique index race-condition prevention, async WhatsApp event dispatch.
- [ ] **FR-11: View Daily Schedule**: Auto-refreshing daily schedule view (HTTP polling).
- [ ] **FR-12: Generate Queue Token**: Sequential daily token assignment on check-in.
- [ ] **FR-13: Reschedule / Cancel Appointment**: Slot freeing, reschedule history logging.
- [ ] **FR-14: Create Consultation Note**: Chief complaint, diagnosis entry, versioned amendment logging.
- [ ] **FR-15: Write Prescription**: Free-text medicine item entry linked to consultation.
- [ ] **FR-16: Treatment Timeline**: Chronological consultation/prescription history timeline for Doctors/Admins.
- [ ] **FR-17: Generate Invoice**: Gapless sequential invoice numbers, automated GST calculation.
- [ ] **FR-18: Collect Payment**: Cash recording, Razorpay payment link generation, HMAC-verified webhook processing, idempotency checks.
- [ ] **FR-19: View Outstanding Dues**: Unpaid invoice list for Admin (all) and Doctor (own patients).
- [ ] **FR-20: Send Appointment Confirmation**: Event-driven async WhatsApp message delivery handler.
- [ ] **FR-21: Send Appointment Reminder**: Scheduled batch job for pre-visit WhatsApp reminders.
- [ ] **FR-22: Offline-Tolerant Sync**: IndexedDB client queue & server-side idempotency keys for patient registration & billing.

---

## Implementation Details

Implementation MUST follow the standard 7-step sequence defined in [`.claude/skills/new-fr/SKILL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/.claude/skills/new-fr/SKILL.md) for every item above.

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=117-640) — Detailed Requirements
- [`.claude/skills/new-fr/SKILL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/.claude/skills/new-fr/SKILL.md) — Implementation Sequence

---

## Dependencies

- .NET 10 SDK
- React 19 / Vite frontend setup
- PostgreSQL 16+ engine

---

## Risks

- **Scope Expansion**: Attempting to implement Fast-Follow modules (MOD-23/24/25) before completing the core FR-01 through FR-22 backlog.

---

## Future Improvements

- Automated transition of items from `pending.md` to `completed.md` via commit message hooks.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Target sprint completion dates for individual FR blocks.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md)
