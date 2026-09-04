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

#### ADR-07: Persistent RS256 Key Storage (Hybrid)
- **Decision**: Per-environment key management — `PemFileKeyService` (local dev, auto-generates PEM on first run) + `AzureKeyVaultKeyService` (production, `CryptographyClient.SignAsync()`, private key never leaves vault). Selected by `Jwt:KeySource` config.
- **Rationale**: Private key never leaves HSM-bound vault in production. Local dev doesn't need Azure dependency. Same JWT validation code path (RS256/JWKS) either way.
- **Status**: Finalized 2026-08-29.

#### ADR-08: `IPostConfigureOptions<JwtBearerOptions>` over `BuildServiceProvider` Anti-Pattern
- **Decision**: Use `IPostConfigureOptions<JwtBearerOptions>` to inject `IRsaKeyService` into JWT bearer configuration.
- **Rationale**: `BuildServiceProvider()` inside `AddJwtBearer` is a known .NET DI anti-pattern — creates a second container that doesn't see scoped services. `IPostConfigureOptions` is the canonical fix.
- **Status**: Finalized 2026-08-29.

#### ADR-09: BackgroundService over Hangfire for MOD-13 NotificationRulesWorker
- **Decision**: Single-job scheduled evaluation uses `BackgroundService` with `PeriodicTimer` (5-min interval) rather than introducing Hangfire dependency.
- **Rationale**: One job doesn't justify a full Hangfire instance (PostgreSQL schema + dashboard). `BackgroundService` is stdlib, zero new deps. Hangfire migration remains an option if job count grows.
- **Status**: Finalized 2026-08-30. Revisit at job count > 3.

#### ADR-10: MOD-23 Pre-Check Token in Same Transaction as Appointment Booking
- **Decision**: `PrecheckService.GenerateForAppointmentAsync` returns entity without saving; `AppointmentsController.Book` adds both `Appointment` + `PrecheckSubmission` to DbContext and calls `SaveChangesAsync` once within the transaction. Two SaveChanges calls (appointment first, then precheck) inside one transaction.
- **Rationale**: First version tried `PrecheckService` saving internally — broke because precheck lookup happened before appointment was committed. Atomicity required for both-or-neither behavior. Captured `precheckPlaintext` by value in closure for post-commit notification.
- **Status**: Finalized 2026-08-30.

#### ADR-11: `PrecheckReviewController` Extracted to Own File with Direct Route
- **Decision**: Move `PrecheckReviewController` (was nested in `PrecheckController.cs`) to its own file. Both controllers now use direct lowercase routes (`api/v1/precheck`, `api/v1/appointments`) instead of `[Route("api/v1/[controller]")]`.
- **Rationale**: The `[controller]` token preserves the controller class name case in the route template, which made lowercase URLs return 404. Combined with the two class-level `[Route]` attributes on the old `PrecheckController.cs` (which also registered `api/v1/appointments` and conflicted with `AppointmentsController`), the routing system became inconsistent. Direct lowercase routes are explicit and match every other controller in the codebase.
- **Status**: Finalized 2026-08-30.

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

2026-08-30

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file://samstack-ai-frd-phase1-FINAL.md#line=100-115) — Resolved Contradictions (§9)
- [`FRD-Phase-2-FINAL.md`](file://FRD-Phase-2-FINAL.md) — Phase 2 FRD
- [`samstack-implementation-reference.md`](file://samstack-implementation-reference.md) — Cross-Cutting Patterns
