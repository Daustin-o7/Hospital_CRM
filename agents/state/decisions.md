# System State: Architectural Decision Log (ADR) (`state/decisions.md`)

This document records all architectural decision records (ADRs), trade-off analyses, and technology selections made for SAMSTACK AI.

---

## Purpose

To maintain an immutable decision log detailing why key architectural choices, framework selections, security trade-offs, and database designs were made.

---

## Scope

Covers all core system decisions across authentication, multi-tenancy, database security, payment processing, offline sync, and messaging.

---

## Verified Information

### Key Architectural Decision Records (ADRs)

#### ADR-01: Managed Identity Provider (Azure Entra External ID) over Self-Hosted Duende
- **Decision**: Use Azure Entra External ID (OIDC) instead of self-hosted Duende IdentityServer.
- **Rationale**: Replaces single point of failure and maintenance overhead of self-hosted auth, directly addressing reliability risks flagged in validation report (§9 Resolution #1).
- **Status**: Finalized.

#### ADR-02: RS256 Asymmetric JWT Tokens over HS256 Symmetric Secrets
- **Decision**: Enforce RS256 asymmetric signing for all JWT access tokens.
- **Rationale**: Future microservices and decoupled API gateways verify tokens using the public key without needing access to a shared private signing secret (FRD §9, Strategy v0.5 §3.3).
- **Status**: Finalized.

#### ADR-03: Dormant `tenant_id` Columns in Single-Tenant Phase 1
- **Decision**: Include `tenant_id uuid NOT NULL` on every tenant-scoped DB table during Phase 1 single-tenant execution.
- **Rationale**: Prevents future database schema migration debt when transitioning to multi-tenant Tier 2/3 tenancy (AGENTS.md Ground Rule #3).
- **Status**: Finalized.

#### ADR-04: Database Role-Level Append-Only Audit Enforcement
- **Decision**: Enforce audit log immutability by revoking UPDATE and DELETE permissions at the database role level (`samstack_app_user`).
- **Rationale**: Application-layer immutability checks can be bypassed by application bugs or migration scripts. Database-level role security guarantees tamper-proof audit trails (FR-08, FR-09).
- **Status**: Finalized.

#### ADR-05: Client-Side IndexedDB for Offline Sync Queue
- **Decision**: Use browser IndexedDB (not `localStorage`) for queuing offline patient registrations and billing requests (FR-22).
- **Rationale**: `localStorage` is synchronous, capped at ~5–10MB, and lacks Service Worker integration. IndexedDB provides structured, asynchronous storage suitable for offline PWA sync (Implementation Reference §4).
- **Status**: Finalized.

#### ADR-06: Decoupled Async WhatsApp Notification Handler
- **Decision**: Fire `AppointmentConfirmed` domain events asynchronously, isolating appointment booking from WhatsApp REST calls.
- **Rationale**: WhatsApp API rate limits or outages must never cause appointment booking transactions to roll back (FR-20, Strategy v0.5 §5).
- **Status**: Finalized.

---

## Implementation Details

```
[ Domain Transaction (Booking/Billing) ]
                   │
                   ├──► Writes DB State (PostgreSQL)
                   │
                   └──► Emits Async Domain Event
                              │
                              ▼
                     [ Event Handler ]
                              │
                              ▼
                    [ Third-Party Provider ]
                     (Razorpay / WhatsApp)
```

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=100-115) — Resolved Contradictions (§9)
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md) — Cross-Cutting Patterns

---

## Dependencies

- Azure Entra External ID OIDC
- PostgreSQL Role Permission Engine
- Browser IndexedDB API

---

## Risks

- Re-introducing HS256 symmetric keys or self-hosted identity servers without formal ADR review.

---

## Future Improvements

- Formal ADR template integration for future Phase 2 architectural decisions.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Date of initial ADR-01 review board meeting.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=100-115)
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md)
