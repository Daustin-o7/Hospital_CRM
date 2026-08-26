# Engineering Skill: Software Architecture & Ponytail Discipline (`skills/architecture.md`)

This document defines the architectural rules, ponytail decision ladder discipline, modular monolith boundaries, and interface abstraction patterns for SAMSTACK AI.

---

## Purpose

To enforce architectural consistency, prevent over-engineering, maintain modular boundaries, and ensure third-party integrations remain decoupled from core domain logic.

---

## Scope

Applies to all architectural design decisions, system components, module boundaries, external integrations, and codebase additions in SAMSTACK AI.

---

## Verified Information

- **Architecture Style**: Modular Monolith (.NET 10 Solution)
- **Primary Design Principle**: Ponytail Decision Ladder (Minimal code build philosophy)
- **Tenancy Architecture**: Single-tenant instance runtime with dormant `tenant_id` database columns
- **Integration Abstraction**: Provider interface patterns (`INotificationChannel`, `IPaymentProvider`, `IComplianceProvider`, `ITaxInvoiceProvider`)

---

## Implementation Details

### 1. The Ponytail Decision Ladder
Before writing any new code or introducing an external library, developers and AI tools MUST run through this 6-step decision ladder:

```
Step 1: Does this feature need to exist? (Check FRD Phase 1 scope)
   │
   ▼
Step 2: Is there code in this codebase that already does this? (Re-use existing code)
   │
   ▼
Step 3: Can the native platform or standard library handle it? (Use .NET / JS stdlib)
   │
   ▼
Step 4: Is there an already-installed dependency that can do it? (Do not add new packages)
   │
   ▼
Step 5: Can it be done in one simple line of custom code? (Keep implementation minimal)
   │
   ▼
Step 6: Only if steps 1-5 are exhausted, write a new component or function.
```

### 2. Interface Abstraction for Third-Party Providers
Core business workflows MUST NEVER depend directly on third-party SDKs or specific vendor REST payloads. Always code against domain interfaces:

- **Notifications**: `INotificationChannel` decouples booking logic from WhatsApp Meta Cloud API or BSP providers.
- **Payments**: `IPaymentProvider` isolates invoice logic from Razorpay REST API shapes.
- **Tax / Invoicing**: `ITaxInvoiceProvider` abstracts Indian GST calculation logic, allowing future regional expansion without modifying core billing entities.

```csharp
// Domain abstraction for notification channel
public interface INotificationChannel
{
    Task<NotificationResult> SendAppointmentConfirmationAsync(AppointmentConfirmationNotification notification, CancellationToken cancellationToken);
    Task<NotificationResult> SendAppointmentReminderAsync(AppointmentReminderNotification notification, CancellationToken cancellationToken);
}
```

---

## Important Files

- [`AGENTS.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/AGENTS.md#line=16-17) — Ponytail discipline ground rule
- [`TOOLING-SETUP.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/TOOLING-SETUP.md) — Tooling and ponytail review setup
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md#line=18-20) — Channel abstraction pattern

---

## Dependencies

- .NET 10 Dependency Injection Framework
- Standard Library types (`System.Threading.Tasks`, `System.Guid`)

---

## Risks

- **Bypassing Abstractions**: Instantiating Razorpay or WhatsApp HTTP clients directly inside EF Core command handlers.
- **Dependency Inflation**: Adding heavy third-party NuGet or npm packages for trivial utility functions handled natively.

---

## Future Improvements

- Automated check via `/ponytail-review` command flagging bloated diffs before PR merge.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Selection of specific static analysis tool for enforcing ponytail package rules in CI.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`AGENTS.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/AGENTS.md)
- [`TOOLING-SETUP.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/TOOLING-SETUP.md)
