# SAMSTACK AI — Security Architecture & Compliance (`plan/security.md`)

This document defines the security architecture, authentication policies, authorization enforcement, token lifecycles, cryptographic standards, compliance controls (DPDP Act 2023), and OWASP risk mitigations for SAMSTACK AI.

---

## Purpose

To document all security mechanisms, authentication flows, authorization rules, compliance controls, and threat mitigations, ensuring the protection of Protected Health Information (PHI) and financial transaction data.

---

## Scope

Covers user identity (Azure Entra External ID), JWT RS256 token verification, session management, role-based access control (RBAC), DPDP consent auditing, database append-only roles, Razorpay webhook verification, and OWASP Top 10 defenses.

---

## Verified Information

### 1. Identity & Token Lifecycle (FR-01)
- **Identity Provider**: Azure Entra External ID (OIDC managed authentication).
- **Asymmetric Signing**: RS256 (public key verification across all services, no shared secrets to leak).
- **Access Token TTL**: 15 minutes.
- **Refresh Token Policy**: Rotated on every single use. Replay of an old refresh token signals theft, triggering instant revocation of all refresh tokens for that user account.
- **Session Inactivity Timeout**: Mandatory 30-minute inactivity timeout for **Doctor** and **Clinic Admin** roles (forced re-authentication). Receptionist session does not expire on inactivity to preserve front-desk operational continuity.
- **Rate Limiting**: 5 failed login attempts in 10 minutes locks account for 15 minutes (`Response 423 Account Locked`).

### 2. Role-Based Access Control (RBAC) (FR-02, §8)
- **Role Enforcement**: Server-side middleware checks the caller's JWT `role` claim against an endpoint permission matrix. UI hiding is secondary defense only.
- **Receptionist Boundaries**: Zero access to clinical notes (`consultations`, `prescriptions`, `patient_history`) and zero access to aggregate financial reports (`outstanding dues across all patients`).
- **Doctor Boundaries**: Full clinical access, read-only on billing for their own patients, zero access to clinic setup or staff management.
- **Clinic Admin Boundaries**: Full system access, staff invitations, clinic configuration, aggregate financial reports.

### 3. Compliance & Data Protection (DPDP Act 2023) (FR-08, FR-09)
- **Explicit Consent**: Purpose-specific consent captured during registration in the same transaction. Patient records cannot exist without a consent record (`patient_consent` table).
- **Immutable Audit Trail**: Append-only audit logs for all patient record creation, edits, and access.
- **Database Role Security**: Append-only enforcement at the database role level (`REVOKE UPDATE, DELETE ON patient_audit_log, patient_consent FROM samstack_app_user;`).
- **Clinical Data Immutability**: Clinical notes (FR-14) and prescriptions (FR-15) are never silently updated or overwritten. Amendments create a new versioned entry with `previous_version_id` set.

### 4. Integration Security & Webhook Signatures (FR-18)
- **Razorpay Webhook Verification**: Signature header verified against raw HTTP request payload using Razorpay webhook secret before processing.
- **PCI-DSS Compliance**: SAMSTACK servers never process or store raw credit card or UPI credentials. Razorpay-hosted checkout only.

---

## Implementation Details

```
[ Incoming Request ]
         │
         ▼
[ Gateway: Rate Limiter (5 tries / 10m) ]
         │
         ▼
[ Auth Middleware: RS256 Public Key Verification ]
         │
         ├──► Valid Token? ──► Extract (sub, tenant_id, role)
         │                          │
         │                          ▼
         │                 [ RBAC Middleware ]
         │                          │
         │                          ├──► Allowed Role? ──► Controller Action
         │                          └──► Denied Role?  ──► 403 Forbidden (Logged)
         │
         └──► Invalid/Expired Token? ──► 401 Unauthorized
```

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=123-198) — Auth & RBAC functional specs
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md#line=5-10) — JWT RS256 & Audit Role specs

---

## Dependencies

- Azure Entra External ID OIDC endpoint
- System.IdentityModel.Tokens.Jwt RS256 validator
- PostgreSQL DB Role Permission Model

---

## Risks

- **Stale Claims**: Role modifications taking up to 15 minutes until next refresh token rotation.
- **Public Key Caching Failure**: Failure to cache Azure Entra OIDC public keys causing authentication timeouts.
- **Bypassing Server RBAC**: Relying on client UI route guards instead of backend API authorization.

---

## Future Improvements

- Automated vulnerability scanning of dependencies in CI pipeline.
- IP-based access logging for sensitive clinical export actions.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Specific Azure Entra External ID tenant domain and client application ID for staging environment.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=123-198)
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md#line=5-10)
