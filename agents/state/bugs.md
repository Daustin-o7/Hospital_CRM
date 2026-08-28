# System State: Issue Register & Contradictions Log (`state/bugs.md`)

This document records tracked defects, edge case bug risks, and resolved specification contradictions for SAMSTACK AI.

---

## Verified Status (2026-08-28)

- **Total Tracked Bugs:** 57
- **Resolved:** 57 (100% Fixed)
- **Critical (3/3):** 🟢 Fixed
- **High (15/15):** 🟢 Fixed
- **Medium (32/32):** 🟢 Fixed
- **Low (7/7):** 🟢 Fixed

---

## Highlights of Final Technical Implementations

1. **RS256 & JWKS (BUG-030)**:
   - Added `IRsaKeyService` / `RsaKeyService.cs` generating 2048-bit RSA keys.
   - JWT tokens signed with `SecurityAlgorithms.RsaSha256`.
   - Exposed `GET /api/v1/auth/.well-known/jwks.json` endpoint per FRD spec.

2. **Razorpay Webhook HMAC Signature (BUG-032)**:
   - Implemented `HMACSHA256` signature verification in `InvoicesController.cs` comparing `X-Razorpay-Signature` with request body using constant-time comparison `CryptographicOperations.FixedTimeEquals`.

3. **Concurrency & Race Conditions (BUG-015–018, BUG-021–026)**:
   - Wrapped Invoice numbering, Queue token assignment, and slot bookings inside `IsolationLevel.Serializable` database transactions with EF Core `ExecutionStrategy`.

4. **Model & Database Constraints (BUG-036, BUG-039)**:
   - EF Core model configured with `HasIndex(x => x.Phone).IsUnique()` and `HasIndex(x => new { x.DoctorId, x.Date, x.TimeSlot }).IsUnique().HasFilter("\"Status\" <> 3")`.

5. **Inactivity Middleware (BUG-039b, BUG-040)**:
   - Configured `InactivityMiddleware` after `app.UseAuthentication()`, running before `_next(context)` to reject inactive sessions immediately. Added `IMemoryCache` (2-min TTL) to optimize DB traffic.

6. **Clinic Association & Attribute Validation (BUG-038, BUG-038b)**:
   - Added `[Required]` to `Patient.Gender` and `IsClinicAssociationValid()` helper on `User.cs` enforcing non-null `ClinicId` for staff roles.

---

**Last Verified Date:** 2026-08-28  
**Verification Source:** Automated xUnit test suite & MSBuild compiler  
**Status:** **57/57 Bugs Resolved (100% Fixed)**
