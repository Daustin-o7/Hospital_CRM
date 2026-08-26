# Engineering Skill: Software Verification & Testing (`skills/testing.md`)

This document defines testing standards, acceptance criteria validation, offline sync simulation, and security test matrices for SAMSTACK AI.

---

## Purpose

To ensure all code changes are empirically verified against the exact acceptance criteria of `samstack-ai-frd-phase1-FINAL.md` before being declared complete.

---

## Scope

Covers backend unit tests, API integration tests, offline sync testing (FR-22), role-based security testing (FR-02), and acceptance criteria verification.

---

## Verified Information

- **Verification Standard**: Every checkbox in an FR's "Acceptance Criteria" section represents a mandatory test case.
- **Rule on Declaration of Success**: Never declare a task resolved or feature completed until concrete, empirical verification commands pass cleanly.
- **Security Test Requirement**: Every RBAC boundary MUST be verified by asserting a 403 Forbidden HTTP response when accessed by an unauthorized role.

---

## Implementation Details

### 1. Test Matrix per FR-XX

#### Security & RBAC Verification (FR-02)
- Test 1: Doctor attempts to call `PUT /api/v1/clinic/profile` -> Assert `403 Forbidden`.
- Test 2: Receptionist attempts to call `GET /api/v1/patients/{id}/history` -> Assert `403 Forbidden`.
- Test 3: Receptionist attempts to call `GET /api/v1/invoices?status=unpaid` (aggregate list) -> Assert `403 Forbidden`.

#### Offline Sync & Idempotency Verification (FR-22)
- Test 1: Client submits patient registration with `X-Idempotency-Key: <UUID>` -> Assert `201 Created`.
- Test 2: Client re-submits exact same payload with same `X-Idempotency-Key` -> Assert `200 OK` or `201 Created` returning identical `patientId` without creating a second database row.

#### Concurrent Slot Booking Verification (FR-10)
- Test 1: Two parallel requests attempt to book the exact same `(doctor_id, date, time_slot)` simultaneously.
- Test 2: First request succeeds (`201 Created`). Second request fails with `409 Conflict` (`slot_unavailable`).

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md) — Acceptance Criteria per FR
- [`.claude/skills/new-fr/SKILL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/.claude/skills/new-fr/SKILL.md#line=20) — Acceptance criteria testing step

---

## Dependencies

- xUnit / NUnit testing framework (.NET)
- Microsoft.AspNetCore.Mvc.Testing (WebApplicationFactory for integration tests)
- Playwright / Vitest for React frontend PWA testing

---

## Risks

- **Deleting Failing Tests**: Removing failing assertions to make test suites pass instead of fixing root causes.
- **Testing Mock Logic Only**: Relying solely on mocked DbContext tests that bypass PostgreSQL unique constraints.

---

## Future Improvements

- Automated End-to-End Playwright test suite verifying offline Service Worker sync in browser environments.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Primary unit testing framework choice (xUnit vs NUnit) for backend C# solution.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md)
- [`.claude/skills/new-fr/SKILL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/.claude/skills/new-fr/SKILL.md)
