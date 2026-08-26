# SAMSTACK AI — Deployment & Infrastructure (`plan/deployment.md`)

This document defines the deployment architecture, hosting setup, PWA distribution, database replication, disaster recovery SLAs, and configuration management for SAMSTACK AI.

---

## Purpose

To document the deployment architecture and operational infrastructure required to host, scale, maintain, and recover SAMSTACK AI Phase 1 deployments.

---

## Scope

Covers PWA web deployment, single-tenant SaaS instance setup (Shared SaaS Tier 1), PostgreSQL database deployment, disaster recovery (RTO/RPO), environment variable configurations, and monitoring baselines.

---

## Verified Information

- **Tenancy Model**: Shared SaaS Tier 1 (Single-tenant runtime configuration, multi-tenant database columns prepared).
- **Frontend Distribution**: Progressive Web App (PWA) served over HTTPS, installable on mobile, tablet, and desktop browsers.
- **Backend Runtime**: .NET 10 ASP.NET Core Linux Container / App Service.
- **Database Service**: PostgreSQL managed database instance with Point-In-Time Recovery (PITR).
- **Disaster Recovery Targets**: Recovery Time Objective (RTO) ≤ 4 hours, Recovery Point Objective (RPO) ≤ 1 hour (§14 NFR).
- **System Uptime Target**: 99.9% availability target (§14 NFR).

---

## Implementation Details

### Environment Configuration Schema

| Environment Variable | Description | Example / Required Format |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | Application runtime mode | `Production` \| `Development` |
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string | `Host=...;Database=samstack_db;Username=...` |
| `EntraID__TenantId` | Azure Entra External ID Tenant | `UUID` |
| `EntraID__ClientId` | Azure Entra Application Client ID | `UUID` |
| `EntraID__PublicKeyUrl` | Azure Entra OIDC JWKS Endpoint | `https://login.microsoftonline.com/...` |
| `Razorpay__KeyId` | Razorpay API Public Key | `rzp_live_...` |
| `Razorpay__KeySecret` | Razorpay API Secret | `SecretString` |
| `Razorpay__WebhookSecret` | Razorpay Webhook HMAC Secret | `SecretString` |
| `WhatsApp__ApiUrl` | Meta / BSP REST Endpoint | `https://graph.facebook.com/v18.0/...` |
| `WhatsApp__AccessToken` | WhatsApp Bearer Token | `SecretToken` |

### Infrastructure Topology

```
[ Client Browsers / PWAs (HTTPS) ]
                │
                ▼
      [ Reverse Proxy / SSL ]
                │
                ▼
   [ ASP.NET Core Container ] (.NET 10)
                │
         ┌──────┴──────┐
         ▼             ▼
[ Managed Postgres ]  [ External Cloud Services ]
  (PITR Backups)       ├─ Azure Entra External ID (Auth)
                       ├─ Razorpay (Payments)
                       └─ WhatsApp Meta Cloud API (Messages)
```

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=664-683) — Non-Functional Requirements (NFR) table
- [`TOOLING-SETUP.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/TOOLING-SETUP.md) — Host tooling instructions

---

## Dependencies

- Managed PostgreSQL 16+ cloud host
- Container host / PaaS (e.g. Azure App Service / Docker)
- TLS 1.2+ certificates

---

## Risks

- **Backup Recovery Time**: Inability to meet RTO ≤ 4h if database point-in-time recovery is not tested routinely.
- **Unencrypted Secrets**: Accidentally committing environment configuration credentials into version control.

---

## Future Improvements

- Docker Compose local development setup automating PostgreSQL and mock notification receivers.
- Automated CI/CD deployment pipeline with rollback capability.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Cloud hosting provider selection (Azure App Service vs AWS ECS vs DigitalOcean) for Phase 1 production pilot deployment.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=664-683)
- [`TOOLING-SETUP.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/TOOLING-SETUP.md)
