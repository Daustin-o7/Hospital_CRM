# Memory.md — Session Log

## Decisions Log

| Date | Decision | Rationale | Supersedes |
|---|---|---|---|
| 2026-08-27 | Database: PostgreSQL 16+ (not SQL Server) | Matches FRD/TRD/AGENTS.md, no licensing cost | User's initial "SQL (Microsoft)" comment |
| 2026-08-27 | Project name: `Hospital_CRM` (not `SamStack`) | `Hospital_CRM` = product/project, `Samstack` = company name | — |
| 2026-08-27 | Assembly names: `Hospital_CRM.Api` (no company prefix) | User preference, no bloated namespaces | — |
| 2026-08-27 | Solution format: `.slnx` (XML, new .NET 10 default) | Cleaner than legacy `.sln`, diffable, works with all modern tooling | — |
| 2026-08-27 | Migrations stay in `backend/Hospital_CRM.Infrastructure/Migrations/` | EF Core tooling requirement — generated C# classes tied to DbContext | — |
| 2026-08-27 | `db/` folder = seed scripts + Testcontainers bootstrap only | No DDL drift, no stored procs in Phase 1 | — |
| 2026-08-27 | Restructure: `backend/`, `frontend/`, `db/`, `docs/` | Clean separation, matches TRD architecture | `src/` monolith |
| 2026-08-27 | PostgreSQL installed at D:\PostgreSQL\15 (PostgreSQL 15 running) | Manual install completed, service running | — |
| 2026-08-27 | Notifications: stub service (log only), WhatsApp API later | Channel-abstracted interface for future swap to real WhatsApp | — |
| 2026-08-27 | GST hardcoded at 18% for Phase 1 | Simplest working solution, configurable later | — |
| 2026-08-27 | Idempotency: controller-level check on POST endpoints | ponytail-first, avoids middleware complexity | — |
| 2026-08-27 | Swashbuckle removed, using Microsoft.AspNetCore.OpenApi | Native .NET 10 OpenAPI support, no Swashbuckle issues | — |
| 2026-08-27 | Tailwind v4 with @utility directives | Modern CSS-first approach, no @layer components | — |
| 2026-08-27 | AuthContext + axios interceptors for token management | Centralized auth, auto token refresh, clean components | — |

## Current Blockers

- [ ] WhatsApp: BSP vs Meta Cloud API — stub implemented, needs real API key before go-live
- [ ] Razorpay: webhook signature verification — stub implemented, needs live secret before go-live
- [ ] Azure Entra External ID — needs portal config before FR-01 JWT validation works end-to-end (currently using symmetric key for dev)

## Completed This Session

### Backend (All 22 FRs Implemented)
- [x] FR-01: User Login (JWT RS256, refresh token rotation, inactivity timeout for Doctor/ClinicAdmin)
- [x] FR-02: RBAC middleware (AuthorizeRoles attribute, role-based policy)
- [x] FR-03: Password Reset (request + confirm, token hashed with BCrypt)
- [x] FR-04: Staff Invitation & Onboarding (invite + accept, 72h expiry)
- [x] FR-05: Clinic Profile Configuration (working hours, holidays, PUT/GET)
- [x] FR-06 + FR-09: Patient Registration + Consent (duplicate phone check, consent in same transaction)
- [x] FR-07: Search & View Patient Profile (search by name/phone, role-filtered profile)
- [x] FR-08: Edit Patient Details (per-field audit log, optimistic concurrency)
- [x] FR-10: Book Appointment (DB-level slot constraint, fire-and-forget notification)
- [x] FR-11: View Daily Schedule (filtered by date/doctor)
- [x] FR-12: Check-in Queue Token (sequential per day)
- [x] FR-13: Reschedule / Cancel (history retained, slots freed)
- [x] FR-14: Consultation Notes (versioned, never overwritten)
- [x] FR-15: Prescription Generation (linked to consultation)
- [x] FR-16: Treatment History Timeline (chronological, role-filtered)
- [x] FR-17: Generate Invoice (GST 18%, sequential invoice numbers)
- [x] FR-18: Collect Payment (cash immediate, Razorpay stub)
- [x] FR-19: View Outstanding Dues (role-filtered list)
- [x] FR-20 + FR-21: WhatsApp Notifications (stub, channel-abstracted)
- [x] FR-22: Offline Tolerance (idempotency keys on registration/billing)

### Infrastructure
- [x] 18 domain entities + 8 enums
- [x] HospitalCrmDbContext with full EF configuration
- [x] Api Program.cs: JWT, CORS, OpenAPI, Serilog, RBAC, middleware
- [x] StubNotificationService + ReminderSchedulerService (using IServiceScopeFactory)
- [x] AuditService for patient field changes
- [x] NuGet packages: EF Core, Npgsql, BCrypt, JWT, YARP, Serilog
- [x] EF Migration created and applied (20 tables)

### Frontend (All Pages Complete + Wired to Real API)
- [x] React 19 + Vite + Tailwind v4 + PWA (builds successfully)
- [x] Login page (glassmorphic, centered, animated) — uses AuthContext
- [x] Dashboard shell (collapsible sidebar, top bar, role-based navigation)
- [x] Dashboard page (stats cards, quick actions, recent activity) — fetches real data
- [x] Patients page (search, register modal, view modal, consent form) — full CRUD via API
- [x] Appointments page (date picker, booking modal, check-in, view modal) — full CRUD via API
- [x] Consultations page (patient list, consultation form, prescription form, history tab) — full CRUD via API
- [x] Billing page (invoice list, create invoice modal with line items, cash/razorpay payment, payment history) — full CRUD via API
- [x] Staff page (invite modal, staff list) — full CRUD via API
- [x] Settings page (clinic name, working hours per day, holidays) — full CRUD via API

### Auth & API Layer
- [x] AuthContext with login/logout/hasRole, token in localStorage
- [x] Axios instance with request/response interceptors (auto auth header, token refresh on 401)
- [x] All pages updated to use `api` service instead of direct axios calls

### Database
- [x] PostgreSQL 15 running at D:\PostgreSQL (service: postgresql-x64-15)
- [x] Initial migration applied: 20 tables created
- [x] Connection: Host=localhost;Port=5432;Database=hospital_crm;Username=postgres;Password=postgres

## Next Steps

- [ ] Razorpay integration (replace stub with real API)
- [ ] WhatsApp integration (replace stub with real BSP/Meta API)
- [ ] Azure Entra External ID portal configuration (switch from symmetric to RS256 JWKS validation)
- [ ] Seed data scripts in `db/`
- [ ] Playwright E2E tests
- [ ] CI/CD pipeline

## API Endpoints Summary

| Method | Path | FR | Roles |
|---|---|---|---|
| POST | /api/v1/auth/login | FR-01 | All |
| POST | /api/v1/auth/refresh | FR-01 | All |
| POST | /api/v1/auth/password-reset/request | FR-03 | All |
| POST | /api/v1/auth/password-reset/confirm | FR-03 | All |
| POST | /api/v1/staff/invite | FR-04 | ClinicAdmin |
| POST | /api/v1/staff/accept-invite | FR-04 | Public |
| PUT | /api/v1/clinic/profile | FR-05 | ClinicAdmin |
| GET | /api/v1/clinic/profile | FR-05 | All |
| POST | /api/v1/patients | FR-06 | Receptionist,Doctor,ClinicAdmin |
| GET | /api/v1/patients/search?q= | FR-07 | All |
| GET | /api/v1/patients/{id} | FR-07 | All |
| PATCH | /api/v1/patients/{id} | FR-08 | Receptionist,Doctor,ClinicAdmin |
| POST | /api/v1/appointments | FR-10 | Receptionist,Doctor,ClinicAdmin |
| GET | /api/v1/appointments?date= | FR-11 | All |
| POST | /api/v1/appointments/{id}/checkin | FR-12 | Receptionist,Doctor,ClinicAdmin |
| PATCH | /api/v1/appointments/{id} | FR-13 | Receptionist,Doctor,ClinicAdmin |
| POST | /api/v1/appointments/{id}/consultation | FR-14 | Doctor |
| PATCH | /api/v1/consultations/{id} | FR-14 | Doctor |
| POST | /api/v1/consultations/{id}/prescription | FR-15 | Doctor |
| GET | /api/v1/patients/{id}/history | FR-16 | Doctor,ClinicAdmin |
| POST | /api/v1/invoices | FR-17 | Receptionist,Doctor,ClinicAdmin |
| POST | /api/v1/invoices/{id}/payment | FR-18 | Receptionist,Doctor,ClinicAdmin |
| POST | /api/v1/webhooks/razorpay | FR-18 | Public (webhook) |
| GET | /api/v1/invoices?status= | FR-19 | ClinicAdmin,Doctor |

## Useful Commands

```bash
# Backend
dotnet build
dotnet run --project backend/Hospital_CRM.Api
dotnet ef migrations add <Name> --project backend/Hospital_CRM.Infrastructure --startup-project backend/Hospital_CRM.Api
dotnet ef database update --project backend/Hospital_CRM.Infrastructure --startup-project backend/Hospital_CRM.Api

# Frontend
cd frontend && npm install && npm run dev
cd frontend && npm run build

# Database
$env:PATH += ";D:\PostgreSQL\bin"
$env:PGPASSWORD = "postgres"
psql -U postgres -d hospital_crm
```