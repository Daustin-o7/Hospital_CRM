# Engineering Skill: Clean Code & Defensive Programming (`skills/clean-code.md`)

This document defines clean coding standards, defensive programming practices, input validation rules, exception handling, and logging standards for SAMSTACK AI.

---

## Purpose

To ensure all code written across backend and frontend services is readable, robust, maintainable, self-documenting, and free from common defensive coding flaws.

---

## Scope

Applies to all source code files, classes, methods, functions, API handlers, DTOs, and middleware across the solution.

---

## Verified Information

- **Primary Code Principle**: Code readability, strict input validation, defensive null checks, and clear separation of concerns.
- **Validation Standard**: Server-side validation using FluentValidation / Data Annotations on all incoming API request DTOs.
- **Exception Strategy**: Global exception handling middleware capturing unhandled exceptions and returning standard JSON ProblemDetails (RFC 7807) without exposing stack traces.
- **Logging Rule**: Passwords, refresh tokens, auth headers, and raw PII (e.g. plaintext phone numbers) MUST NEVER be logged in application logs.

---

## Implementation Details

### 1. Defensive Null & Parameter Validation
Always validate method parameters at entry points. Prefer modern C# pattern matching and argument null checks:

```csharp
public async Task<PatientDto> GetByIdAsync(Guid patientId, CancellationToken cancellationToken)
{
    ArgumentNullException.ThrowIfNull(patientId);

    var patient = await _dbContext.Patients
        .AsNoTracking()
        .FirstOrDefaultAsync(p => p.Id == patientId, cancellationToken);

    if (patient is null)
    {
        throw new NotFoundException($"Patient with ID '{patientId}' was not found.");
    }

    return patient.ToDto();
}
```

### 2. Validation Pattern
Request DTOs MUST be validated before business execution. Never rely solely on client-side form validation:

```csharp
public class RegisterPatientDtoValidator : AbstractValidator<RegisterPatientDto>
{
    public RegisterPatientDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Patient name is required.")
            .MaximumLength(255);

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Phone number is required.")
            .Matches(@"^\+?[1-9]\d{1,14}$").WithMessage("Invalid phone number format.");

        RuleFor(x => x.Consent)
            .NotNull().WithMessage("Consent object is required.")
            .Must(c => c.Accepted).WithMessage("DPDP consent must be accepted to register.");
    }
}
```

### 3. Structured Error Responses (RFC 7807)
```json
{
  "type": "https://samstack.ai/errors/invalid_credentials",
  "title": "Authentication Failed",
  "status": 401,
  "detail": "Invalid email or password provided.",
  "instance": "/api/v1/auth/login"
}
```

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md) — API status codes and error responses
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md) — Security and error guidelines

---

## Dependencies

- FluentValidation library (.NET)
- ASP.NET Core ProblemDetails Middleware

---

## Risks

- **Swallowing Exceptions**: Using empty `catch` blocks or returning dummy fallbacks that mask underlying database or network failures.
- **Logging Sensitive Data**: Writing raw passwords or auth headers to application stdout or file logs.

---

## Future Improvements

- Static code analysis rules enforcing guard clause usage across all application services.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Selection of specific static code quality rule set (SonarQube vs Roslyn Analyzers).

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md)
