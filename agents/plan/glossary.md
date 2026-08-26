# SAMSTACK AI — Glossary of Terms (`plan/glossary.md`)

This document defines domain, regulatory, architectural, and technical terminology used across the SAMSTACK AI project.

---

## Purpose

To provide a single reference for all terms, acronyms, regulatory names, and domain definitions used in system documentation and code.

---

## Scope

Covers Indian healthcare domain terms, regulatory standards, software architecture patterns, security protocols, and repository-specific terminology.

---

## Verified Information

### Domain & Regulatory Terms

| Term | Full Name / Expansion | Definition |
|---|---|---|
| **ABDM** | Ayushman Bharat Digital Mission | India's national digital health ecosystem and interoperability framework. |
| **ABHA** | Ayushman Bharat Health Account | Unique 14-digit digital health ID issued to Indian citizens under ABDM. |
| **DPDP** | Digital Personal Data Protection Act, 2023 | India's primary data privacy law mandating explicit consent, purpose limitation, and data auditability. |
| **EMR** | Electronic Medical Record | Digital record of patient clinical encounters, consultations, and prescriptions. |
| **GST** | Goods and Services Tax | India's indirect tax structure applied to clinic billing line items and invoices. |
| **IPD** | In-Patient Department | Hospital department managing admitted patients occupying beds (Out of scope for Phase 1). |
| **OPD** | Out-Patient Department | Clinic/hospital care provided to walk-in or scheduled patients not requiring overnight stay. |
| **PHI** | Protected Health Information | Any individually identifiable health, medical, or diagnostic data. |

### Technical & Architectural Terms

| Term | Full Name / Expansion | Definition |
|---|---|---|
| **BSP** | Business Solution Provider | Third-party partner (e.g. Interakt, AiSensy, Gupshup) providing WhatsApp API infrastructure. |
| **Idempotency Key** | Client-Generated Unique Identifier | UUID generated client-side for write requests to prevent duplicate creation on network retries. |
| **JWT** | JSON Web Token | Compact URL-safe token used for transmitting claims securely between client and server. |
| **NFR** | Non-Functional Requirement | System quality attribute (performance, availability, security, scalability, usability). |
| **PITR** | Point-In-Time Recovery | Database backup capability permitting restoration to any precise microsecond timestamp. |
| **Ponytail Discipline** | Minimal Code Build Philosophy | Design discipline prioritizing standard library / native features over external packages. |
| **PWA** | Progressive Web App | Web application utilizing Service Workers and Web App Manifests for app-like behavior. |
| **RBAC** | Role-Based Access Control | Access enforcement restricting system operations based on assigned user roles. |
| **RS256** | RSA Signature with SHA-256 | Asymmetric cryptographic algorithm using a private key to sign JWTs and public key to verify. |

---

## Implementation Details

Term definitions in this glossary dictate variable naming, domain model class naming, database schema column naming, and UI text across the SAMSTACK AI repository.

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=700-717) — Document Glossary
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md) — Technical terms reference

---

## Dependencies

- N/A (Documentation artifact)

---

## Risks

- **Terminology Ambiguity**: Mixing up OPD and IPD workflows, or treating ABDM as a Phase 1 requirement rather than Fast-Follow.

---

## Future Improvements

- Expansion of pharmacy domain terms (Schedule H, Schedule H1, FEFO) during Track 2 kickoff.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Additional regional dialect terms for front-desk queue displays.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=700-717)
