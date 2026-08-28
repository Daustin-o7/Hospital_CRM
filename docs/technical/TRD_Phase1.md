# SAMSTACK AI — Technical Requirements Document (TRD)
## Phase 1 — Track 1: CRM + Billing, India Adapter

---

## 1. Document Information

| Field | Value |
|---|---|
| Title | SAMSTACK AI — TRD, Phase 1 |
| Version | 1.0 |
| Date | 26 August 2026 |
| Precedes | Sprint/task breakdown |
| Source of truth for scope | samstack-ai-frd-phase1-FINAL.md — this document formalizes and consolidates the FR-level API/schema notes, doesn't redefine scope |

---

## 2. System Architecture

Modular monolith (.NET 10 / ASP.NET Core), per strategy-v0.5 §4 — reaffirmed, not re-litigated here.

```
                    ┌─────────────────┐
   React 19 PWA ───▶│   API Gateway    │  (YARP)
                    └────────┬─────────┘
                             │
              ┌──────────────┴───────────────┐
              │      Core Monolith (.NET 10)   │
              │  ┌─────────┬─────────┬───────┐ │
              │  │ Identity│ Patients│ Appts │ │
              │  ├─────────┼─────────┼───────┤ │
              │  │  EMR    │ Billing │ Clinic│ │
              │  └─────────┴─────────┴───────┘ │
              └──────┬───────────────┬─────────┘
                     │ event bus     │ sync calls
              ┌──────▼──────┐   ┌────▼────┐
              │ Notification │   │ Postgres │
              │   Handler    │   └─────────┘
              └──────┬───────┘
                     │
           ┌─────────┴─────────┐
           │  WhatsApp (BSP/    │
           │  Meta Cloud API)   │
           └────────────────────┘
```

**Components:**
| Component | Responsibility | Phase 1 status |
|---|---|---|
| API Gateway (YARP) | Single entry point, auth/rate-limit/routing | Required |
| Core Monolith | FR-01–19 (Identity, Clinic, Patients, Appointments, EMR, Billing) | Required |
| Notification Handler | FR-20/21, event-driven, decoupled | Required, minimal (single flow) |
| PostgreSQL | Primary datastore, `tenant_id` dormant | Required |
| Azure Entra External ID | Managed identity | Required (FRD §9) |
| Razorpay | Payment processing | Required |
| WhatsApp (BSP or Meta Cloud API) | Notification channel | Required, pick one before build starts |

**Not stood up in Phase 1:** AI/ML service, Integration Gateway service (both exist as strategy-v0.5 §4 concepts, activate only when Track 3/ABDM work starts).

---

## 3. API Contract

Consolidated from FRD FR-01–22. REST, JSON, versioned under `/api/v1`. Auth via `Authorization: Bearer {JWT}` on every endpoint except `/auth/login` and `/auth/password-reset/*`.

| Endpoint | Method | FR | Roles |
|---|---|---|---|
| `/auth/login` | POST | FR-01 | Public |
| `/auth/password-reset/request` | POST | FR-03 | Public |
| `/auth/password-reset/confirm` | POST | FR-03 | Public |
| `/staff/invite` | POST | FR-04 | Clinic Admin |
| `/clinic/profile` | PUT, GET | FR-05 | Clinic Admin (write), all (read) |
| `/patients` | POST | FR-06 | Receptionist, Doctor, Clinic Admin |
| `/patients/search` | GET | FR-07 | Receptionist, Doctor, Clinic Admin |
| `/patients/{id}` | GET, PATCH | FR-07/08 | Role-filtered response shape |
| `/patients/{id}/history` | GET | FR-16 | Doctor, Clinic Admin |
| `/appointments` | POST, GET | FR-10/11 | Receptionist, Doctor, Clinic Admin |
| `/appointments/{id}/checkin` | POST | FR-12 | Receptionist, Doctor, Clinic Admin |
| `/appointments/{id}` | PATCH | FR-13 | Receptionist, Doctor, Clinic Admin |
| `/appointments/{id}/consultation` | POST | FR-14 | Doctor |
| `/consultations/{id}` | PATCH | FR-14 | Doctor |
| `/consultations/{id}/prescription` | POST | FR-15 | Doctor |
| `/invoices` | POST, GET | FR-17/19 | Receptionist, Doctor, Clinic Admin |
| `/invoices/{id}/payment` | POST | FR-18 | Receptionist, Doctor, Clinic Admin |
| `/webhooks/razorpay` | POST | FR-18 | Razorpay-signed, not user-authenticated |

Full request/response shapes are in each FR — not repeated here to avoid drift between two copies of the same contract. **This table is the index; the FRD is the source.**

**Conventions:** camelCase JSON fields · ISO 8601 dates/times · UUIDs for all resource IDs · errors as `{ "error": "snake_case_code", "message": "human string" }` · pagination via `?page=&pageSize=` (default 20, max 100) on all list endpoints.

---

## 4. Database Schema

Consolidated DDL sketch (PostgreSQL). Every FR's "Database Schema Notes" is the authority on exact columns — this section shows the full relational picture.

```sql
-- Identity
users (id, tenant_id, email, password_hash, role, failed_login_count, locked_until, created_at, updated_at)
refresh_tokens (id, user_id, token_hash, issued_at, expires_at, revoked_at)
password_reset_tokens (id, user_id, token_hash, expires_at, used_at)
staff_invites (id, clinic_id, name, email, role, token_hash, expires_at, accepted_at)

-- Clinic
clinics (id, tenant_id, name, created_at)
clinic_hours (clinic_id, day_of_week, open_time, close_time)
clinic_holidays (clinic_id, date)

-- Patients
patients (id, tenant_id, name, phone, dob, approx_age, gender, address, idempotency_key, created_by, created_at)
patient_consent (id, patient_id, purpose, captured_by, guardian_name, guardian_relationship, captured_at, withdrawn_at)
patient_audit_log (id, patient_id, changed_by, field_name, old_value, new_value, changed_at)  -- append-only

-- Appointments
appointments (id, tenant_id, patient_id, doctor_id, date, time_slot, type, status, queue_token, created_at)
  -- UNIQUE (doctor_id, date, time_slot) WHERE status != 'cancelled'
appointment_history (id, appointment_id, previous_date, previous_time, changed_at, changed_by)

-- Clinical
consultations (id, appointment_id, doctor_id, chief_complaint, observations, diagnosis, version, previous_version_id, created_at)  -- append-only, versioned
prescriptions (id, consultation_id, created_at)
prescription_items (id, prescription_id, medicine_text, dosage_text, frequency_text, duration_text)

-- Billing
invoices (id, tenant_id, appointment_id, invoice_number, subtotal, gst_amount, total, status, idempotency_key, created_at)
payments (id, invoice_id, method, amount, razorpay_payment_id, status, idempotency_key, created_at)

-- Notifications
notification_log (id, appointment_id, channel, template, status, sent_at, delivered_at, failed_reason)
```

**Indexes (Phase 1 scale, not over-built):** `patients(phone)`, `patients(name)` (trigram), `appointments(doctor_id, date)`, `invoices(status, created_at)`, `consultations` join path via `appointments(patient_id)`.

**Row-level security:** `tenant_id` columns are present and populated (single value in Phase 1) but RLS policies are **not enabled yet** — strategy-v0.5 §3.1 defers this until Tier 2 tenancy is actually sold. Don't build the policies now; do keep every table's `tenant_id` column NOT NULL so adding RLS later is a policy addition, not a migration.

---

## 5. Deployment Architecture

| Layer | Choice | Rationale |
|---|---|---|
| Compute | Azure Container Apps | Lighter ops than raw Kubernetes for a 2-person team (strategy-v0.5 §6) |
| Database | Managed PostgreSQL (Azure Database for PostgreSQL) | Point-in-time recovery meets FRD's RTO≤4h/RPO≤1h without building backup tooling |
| Identity | Azure Entra External ID | FRD §9 — managed, not self-hosted |
| CI/CD | GitHub Actions | Free for this scale, matches strategy-v0.5 §6 |
| Environments | `dev`, `staging`, `prod` — separate Entra tenants and Razorpay test/live keys per environment | Never test against live payment credentials |

**Environments:**
- `dev`: local Docker Compose (Postgres + API + frontend), Razorpay test mode, WhatsApp sandbox/test number
- `staging`: mirrors prod topology, used for pilot-clinic UAT before go-live
- `prod`: pilot clinics live here

**Secrets management:** Azure Key Vault for connection strings, Razorpay keys, WhatsApp API tokens, JWT signing keys — never in source control or environment files committed to the repo.

---

## 6. Third-Party Integration — Technical Detail

Extends samstack-implementation-reference.md with deployment-specific detail:

- **Razorpay:** separate API key pairs per environment. Webhook endpoint (`/webhooks/razorpay`) registered per environment with its own webhook secret. Confirm current webhook signature verification method against Razorpay's live docs before implementation — noted in the reference doc as a point to verify live, repeated here since it's genuinely the highest-risk integration point (money).
- **WhatsApp:** decide BSP vs. direct Meta Cloud API **before sprint 1** — this is a business/cost decision (sharpened-plan-v2 §7 cost table), not a technical one, but it blocks FR-20/21 implementation until decided.
- **Entra External ID:** one app registration per environment, redirect URIs configured per environment's frontend URL.

---

## 7. Security Architecture

| Concern | Implementation |
|---|---|
| Transport | TLS 1.2+ everywhere, no plaintext HTTP even in dev (matches prod as closely as possible) |
| Encryption at rest | AES-256, handled by Azure Database for PostgreSQL's default encryption — no custom crypto |
| JWT signing | RS256, private key in Key Vault, never in application config |
| Audit immutability | `REVOKE UPDATE, DELETE` on `patient_audit_log`, `consultations` (new versions only), applied at the Postgres role level, not just EF Core model config |
| Rate limiting | API Gateway level, 5 login attempts/10min/IP+account (FR-01) |
| Input validation | Server-side on every endpoint regardless of client-side validation — OWASP A03 |
| Dependency scanning | GitHub Dependabot (free) enabled on the repo before first merge |

---

## 8. Testing Strategy

| Layer | Approach | Coverage target |
|---|---|---|
| Unit | xUnit (.NET), Vitest (React) | Business logic, especially FR-10's slot-conflict logic and FR-18's idempotency handling |
| Integration | Test against a real Postgres instance (Testcontainers), not mocks, for anything touching the schema | Every FR's acceptance criteria list is the test-case source |
| E2E | Playwright, a handful of critical paths only (FR-10 booking, FR-17/18 invoice-to-payment) — not exhaustive at this scale | Happy path + the specific edge cases each FR calls out |
| Security | Manual OWASP Top 10 pass before pilot go-live, automated dependency scanning ongoing | Pre-launch gate |

**Definition of done for any FR:** every acceptance-criteria checkbox has a corresponding automated test, `/ponytail-review` clean, and the FR's specific edge cases are covered, not just the happy path.

---

## 9. Observability

Minimal, not gold-plated, for pilot scale:
- **Logging:** structured JSON logs (Serilog for .NET), shipped to Azure Monitor
- **Error tracking:** exceptions captured with request context, PII (patient names/phone) excluded from log payloads by default
- **Metrics to track from day 1:** appointment booking success rate, WhatsApp delivery success rate (FR-20/21's whole value proposition — if this silently degrades, the product's core promise breaks quietly), payment success rate, API p95 latency
- **Alerting:** none automated in Phase 1 beyond Azure's default resource-health alerts — two founders check dashboards manually at pilot scale, formal on-call is a later-phase investment

---

## 10. Environment & Configuration

- `.env`-style config for local dev, Key Vault references for staging/prod — never commit real secrets, even to a private repo
- Feature flags: not needed in Phase 1 (single scope, no gradual rollout at 3–5 pilot clinics) — don't build flag infrastructure the product doesn't need yet (ponytail discipline)
