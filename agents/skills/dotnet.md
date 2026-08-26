# Engineering Skill: .NET 10 & C# Development Standards (`skills/dotnet.md`)

This document defines the coding standards, solution layout, dependency injection patterns, middleware rules, and API practices for backend development in SAMSTACK AI using .NET 10 and ASP.NET Core.

---

## Purpose

To guide AI assistants and developers on writing clean, idiomatic, performant, and secure C# / ASP.NET Core code compliant with SAMSTACK AI's modular monolith architecture.

---

## Scope

Applies to all C# projects, ASP.NET Core controllers, middleware, application services, domain entities, EF Core configurations, and DTOs in the solution.

---

## Verified Information

- **Framework**: .NET 10 (ASP.NET Core, C# 13)
- **Architecture**: Modular Monolith (.NET Solution with clean layer separation)
- **ORM Engine**: Entity Framework Core / Npgsql PostgreSQL Provider
- **Authentication**: JWT Bearer with RS256 public key verification (Azure Entra External ID OIDC)
- **Error Handling**: Global exception middleware returning structured JSON problem details

---

## Implementation Details

### 1. Solution & Namespace Naming Rules
- Root Namespace: `Samstack.Ai`
- Layer Projects:
  - `Samstack.Ai.Api` — Controllers, Middleware, SignalR/Webhooks, Program.cs
  - `Samstack.Ai.Application` — Commands, Queries, DTOs, Handlers, Interfaces
  - `Samstack.Ai.Domain` — Entities, Value Objects, Enums, Domain Events
  - `Samstack.Ai.Infrastructure` — EF Core DbContext, PostgreSQL Migrations, Azure Entra / Razorpay / WhatsApp Clients

### 2. Controller & Endpoint Conventions
- Always decorate controllers with `[ApiController]` and `[Route("api/v1/[controller]")]`.
- Enforce role-based access using `[Authorize(Roles = "clinic_admin,doctor")]`. Never leave an endpoint unsecured unless explicitly documented as anonymous (e.g. login).
- Always return standard HTTP status codes matching FRD API shapes (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 409 Conflict, 423 Locked).

```csharp
[ApiController]
[Route("api/v1/patients")]
[Authorize]
public class PatientsController : ControllerBase
{
    private readonly IPatientService _patientService;

    public PatientsController(IPatientService patientService)
    {
        _patientService = patientService;
    }

    [HttpPost]
    [Authorize(Roles = "clinic_admin,doctor,receptionist")]
    public async Task<IActionResult> RegisterPatient([FromBody] RegisterPatientDto request, CancellationToken cancellationToken)
    {
        var result = await _patientService.RegisterAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.PatientId }, result);
    }
}
```

### 3. Entity & Database Conventions
- Include `public Guid TenantId { get; set; }` on every tenant-scoped entity.
- Audit entities must be immutable — no setter for historic fields.
- Decimal properties for currency MUST specify column type precision: `[Column(TypeName = "numeric(12,2)")]`.

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md) — Endpoint specifications
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md#line=5-10) — JWT RS256 setup
- [`AGENTS.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/AGENTS.md) — Backend stack guidelines

---

## Dependencies

- Microsoft.AspNetCore.Authentication.JwtBearer (.NET 10)
- Npgsql.EntityFrameworkCore.PostgreSQL
- FluentValidation.AspNetCore

---

## Risks

- **Signing Key Mismatch**: Attempting to use HS256 symmetric keys instead of RS256 asymmetric keys.
- **Leaking Internal Exceptions**: Exposing raw C# stack traces to API clients in production.
- **DbContext Thread Safety**: Injecting EF Core `DbContext` as a Singleton instead of Scoped.

---

## Future Improvements

- Implementation of MediatR for CQRS pattern in `Samstack.Ai.Application` if command/query volume expands.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Selection of specific C# logging library (Serilog vs Microsoft.Extensions.Logging) for file output.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md)
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md)
