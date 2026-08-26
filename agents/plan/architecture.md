# SAMSTACK AI — Architecture Specification (`plan/architecture.md`)

This document defines the system architecture, component stack, application layers, modular monolith design, and cross-cutting infrastructure patterns for SAMSTACK AI.

---

## Purpose

To document the architectural blueprint of SAMSTACK AI, ensuring all future code additions maintain modular monolith boundaries, clean layer isolation, and strict interface abstractions.

---

## Scope

Covers the technical stack, backend application architecture (.NET 10), frontend application architecture (React 19 PWA), database system (PostgreSQL), identity integration (Azure Entra External ID), notification channels, and offline sync patterns.

---

## Verified Information

- **Architecture Style**: Modular Monolith (.NET 10 ASP.NET Core solution)
- **Frontend Stack**: React 19, mobile-first responsive PWA, IndexedDB for offline queueing
- **Database Engine**: PostgreSQL 16+
- **Identity Provider**: Azure Entra External ID (OIDC, JWT RS256, public-key verification)
- **Payment Gateway**: Razorpay (REST API + HMAC webhook verification)
- **Notification Provider**: WhatsApp Business API (Meta Cloud API / BSP behind `INotificationChannel` abstraction)
- **Tenancy Architecture**: Single-tenant instance runtime for Phase 1 with dormant `tenant_id` database columns on all tenant-scoped tables for zero-migration forward-compatibility.

---

## Implementation Details

### Modular Monolith Layering Architecture

```
[ Frontend: React 19 Responsive PWA ]
              │ HTTPS / REST API (JWT RS256)
              ▼
[ Backend: .NET 10 ASP.NET Core Solution ]
  ├── Presentation / API Layer (Controllers, Middleware, Auth Policies)
  ├── Application Layer (Command/Query Handlers, DTOs, Event Bus)
  ├── Domain Layer (Entities, Value Objects, Domain Events, Business Rules)
  └── Infrastructure Layer (EF Core, PostgreSQL, Entra ID, Razorpay, WhatsApp)
              │ SQL / Npgsql
              ▼
[ Database: PostgreSQL ]
  ├── Active Application User Role (REVOKE UPDATE, DELETE on audit tables)
  └── Multi-Schema / Tenant Column Ready Tables
```

### Component Decoupling & Interfaces
- **Notification Abstraction**: `INotificationChannel` interface decouples appointment booking from WhatsApp delivery. Message failures never roll back appointment bookings.
- **Provider Interfaces**: `IPaymentProvider`, `IComplianceProvider`, `ITaxInvoiceProvider` abstracts region-specific payment/tax logic.
- **Offline Sync Queue**: IndexedDB client queue stores pending registrations/invoices when network drops, syncing automatically on reconnect with client-generated `idempotencyKey` values.

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=69-72) — System Overview section
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md) — Cross-cutting patterns
- [`AGENTS.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/AGENTS.md) — Technical stack specifications

---

## Dependencies

- ASP.NET Core .NET 10 Runtime
- React 19 / Vite frontend builder
- Entity Framework Core / Npgsql driver
- Azure Entra External ID SDK / JWT bearer authentication package
- IndexedDB browser API

---

## Risks

- **Tight Coupling**: Direct dependencies between domain logic and third-party APIs (e.g. embedding Razorpay SDK calls inside core invoice entities).
- **Synchronous Failures**: Blocking core business operations on external HTTP services (e.g. making appointment booking wait for WhatsApp response).
- **Schema Migration Debt**: Omitting `tenant_id` columns from new tables created during Phase 1.

---

## Future Improvements

- Activation of multi-tenancy isolation policies when transitioning to Tier 2/3 tenancy.
- Introduction of Background Worker service (Quartz.NET or HostedService) for scheduled WhatsApp reminders (FR-21).

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Specific ASP.NET Core background worker library chosen for FR-21 scheduled cron execution.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=69-72)
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md)
