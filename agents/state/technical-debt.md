# System State: Technical Debt & Open Items Register (`state/technical-debt.md`)

This document tracks technical debt, provisional design items, open verification tasks, and architectural cleanups in SAMSTACK AI.

---

## Purpose

To provide a transparent register of provisional decisions, known technical debt, open verification items, and future refactoring tasks.

---

## Scope

Covers technical debt and unconfirmed items across Phase 1 specifications and implementations.

---

## Verified Information

### Tracked Technical Debt & Open Items Register

1. **Provisional 7-Year Medical Data Retention Rule**:
   - *Item*: Section 14 NFR table lists a 7-year data retention requirement.
   - *Status*: Flagged as **Provisional**. The 7-year figure is a generic corporate default from a specification template. Indian healthcare retention norms and DPDP data minimization principles differ.
   - *Action*: Require explicit legal confirmation before baking 7-year hard-deletion crons into database scripts or EF Core background workers.

2. **Solo Practitioner Dual-Role UX Validation**:
   - *Item*: Solo practitioners hold both Clinic Admin and Doctor roles simultaneously on one login (§9 #6).
   - *Status*: Flagged for **Pilot UX Validation**. While supported by the backend RBAC permission model, the user experience of switching context between admin clinic setup and clinical consultations on one login is untested in live clinic environments.
   - *Action*: Gather direct feedback from solo practitioner pilot clinics during initial rollout.

3. **In-Code Static Role Permission Map**:
   - *Item*: Phase 1 implements a static in-code role permission map rather than a dynamic database-driven permissions table (FR-02).
   - *Status*: Accepted technical debt per ponytail discipline (defer complexity until role count grows in later phases).
   - *Action*: Refactor to DB-driven permissions table when Track 2 (Pharmacist role) or Track 4 (Nurse role) is introduced.

4. **HTTP Polling for Schedule & Queue Updates**:
   - *Item*: Daily schedule auto-refresh (FR-11) uses simple HTTP polling instead of WebSockets / SignalR.
   - *Status*: Accepted technical debt per ponytail discipline. Polling is sufficient for OPD queue scale.
   - *Action*: Evaluate SignalR / WebSockets if live ticket tracking (MOD-25) or high-concurrency clinic demand requires sub-second updates.

---

## Implementation Details

```
[ Technical Debt & Open Items ]
  ├── 1. Legal Verification: Indian Medical Record Retention Period
  ├── 2. Pilot UX Check: Solo Practitioner Dual-Role Flow
  ├── 3. Future Refactor: In-Code RBAC to DB Permissions Table
  └── 4. Future Evaluation: HTTP Polling to WebSockets / SignalR
```

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=100-115) — Contradictions Section (§9)
- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=680-681) — Provisional Retention Note

---

## Dependencies

- Legal counsel confirmation on DPDP Act data minimization vs healthcare retention laws.

---

## Risks

- Hardcoding a 7-year deletion policy in migration scripts before legal confirmation, causing compliance violations.

---

## Future Improvements

- Formal review of `state/technical-debt.md` during sprint retrospectives.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Legal counsel contact for DPDP compliance review.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=100-115)
- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=680-681)
