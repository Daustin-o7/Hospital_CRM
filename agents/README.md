# SAMSTACK AI — AI Context System (`agents/`)

Welcome to the **SAMSTACK AI Context System**. This directory is the authoritative, production-grade **Single Source of Truth** for all AI assistants (ChatGPT, Codex, Claude Code, Antigravity, Cline, Roo Code, Cursor, Windsurf, OpenCode, etc.) working on the SAMSTACK AI (`Hospital_CRM`) codebase.

---

## Purpose

The purpose of this AI Context System is to provide complete architectural, domain, technical, operational, and procedural context for the SAMSTACK AI project. It ensures that any AI tool or human engineer can immediately understand, navigate, extend, and maintain the project without introducing scope creep, architecting unrequested features, or breaking system constraints.

---

## Scope

This directory covers **Phase 1 (Track 1: CRM + Billing, OPD, Shared SaaS Tier, India Region)** as specified in `samstack-ai-frd-phase1-FINAL.md`. It documents all 22 functional requirements (FR-01 through FR-22), module boundaries (MOD-01 through MOD-07 plus cross-cutting offline-sync), role-based permissions, database schemas, integration patterns, coding standards, and execution state.

---

## Verified Information

- **Project Name**: SAMSTACK AI (Doctor/Clinic CRM)
- **Primary Domain**: OPD Clinic Management & Billing (India Region)
- **Target Tech Stack**: .NET 10 (ASP.NET Core backend), React 19 (responsive PWA frontend), PostgreSQL (database), Azure Entra External ID (Identity), Razorpay (Payments), WhatsApp Business API (Notifications).
- **Core Specification**: `samstack-ai-frd-phase1-FINAL.md` (Version 1.1, 25 Aug 2026).
- **Single Source of Truth**: Every statement in this context system is directly traceable to the repository's specifications and reference documents.

---

## Implementation Details

### Directory Structure & Navigation

```
agents/
├── README.md               # Context system orientation & governance rules (This file)
├── AI_RULES.md             # Strict operating rules & constraints for AI assistants
├── plan/                   # Architectural & technical design specifications
│   ├── project.md          # Project vision, objectives, phase boundaries, GTM strategy
│   ├── architecture.md     # System architecture, stack, modular monolith design, layer isolation
│   ├── modules.md          # Module breakdown (MOD-01 to MOD-07, cross-cutting & deferred tracks)
│   ├── workflows.md        # End-to-end business and clinical user workflows
│   ├── database.md         # Database schemas, tables, relationships, indexes, audit logs
│   ├── api.md              # Complete API catalog (FR-01 to FR-22), DTOs, response codes
│   ├── security.md         # Authentication, authorization, token rotation, DPDP, OWASP
│   ├── deployment.md       # PWA deployment, SaaS single-tenant setup, database recovery
│   ├── business-rules.md   # Core business constraints, immutability rules, ponytail discipline
│   ├── permission-matrix.md # Access control matrix (Clinic Admin, Doctor, Receptionist)
│   └── glossary.md         # Domain and technical terminology definitions
├── skills/                 # Engineering practices, guidelines & project standards
│   ├── dotnet.md           # C# / .NET 10 development rules & patterns
│   ├── react.md            # React 19 PWA & frontend development standards
│   ├── sql.md              # PostgreSQL schema, migration & database role rules
│   ├── architecture.md     # Modular monolith & ponytail decision ladder rules
│   ├── clean-code.md       # Clean code practices, defensive programming, logging
│   ├── git.md              # Commit standards, PR reviews, migration safety
│   ├── testing.md          # Verification strategies against FRD acceptance criteria
│   ├── debugging.md        # Log inspection, error tracing, webhook debugging
│   ├── performance.md      # Response time NFRs (≤2s search, ≤3s load), query indexing
│   ├── accessibility.md    # WCAG 2.1 AA standards, high-contrast, front-desk usability
│   ├── uiux.md             # Mobile-first responsive PWA UX, fast onboarding rules
│   ├── ponytail.md         # Ponytail minimal engineering discipline & command reference
│   └── documentation.md    # Context system maintenance & anti-hallucination standards
└── state/                  # Real-time system state & execution history
    ├── context.md          # High-level context & active project phase
    ├── current.md          # Current implementation sprint/kickoff focus
    ├── completed.md        # Completed project milestones & artifacts
    ├── pending.md          # Backlog of FR-01 through FR-22 tasks
    ├── decisions.md        # Resolved architectural decisions & trade-offs
    ├── bugs.md             # Tracked issues & resolved template contradictions
    ├── changelog.md        # Historical revision log of project specifications
    ├── known-limitations.md# Phase 1 scope boundaries & deliberate omissions
    └── technical-debt.md   # Technical debt register & provisional items
```

### Reading Order for AI Assistants

1. Read [`AI_RULES.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/agents/AI_RULES.md) FIRST to establish operating boundaries.
2. Read [`state/current.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/agents/state/current.md) and [`state/context.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/agents/state/context.md) to understand current progress.
3. Consult [`plan/project.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/agents/plan/project.md) and [`plan/architecture.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/agents/plan/architecture.md) for macro design goals.
4. When implementing a specific requirement (FR-XX), read:
   - The corresponding section in [`plan/api.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/agents/plan/api.md)
   - The relevant schema in [`plan/database.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/agents/plan/database.md)
   - The role permissions in [`plan/permission-matrix.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/agents/plan/permission-matrix.md)
   - The engineering skills in `agents/skills/`

### Maintenance Rules for Humans & AI

- **Do Not Modify Without Code Traceability**: Never add documentation for unverified features.
- **Update State Incrementally**: When completing an FR, move it from `state/pending.md` to `state/completed.md` and update `state/current.md`.
- **Maintain Standard Sections**: Every `.md` file in `agents/` MUST retain its 11 standard sections.

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md) — Single Source of Truth specification
- [`AGENTS.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/AGENTS.md) — Core agent brief and ground rules
- [`CLAUDE.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/CLAUDE.md) — Host instructions and ponytail review integration
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md) — Integration patterns reference
- [`TOOLING-SETUP.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/TOOLING-SETUP.md) — Tooling setup & ponytail discipline

---

## Dependencies

- Managed Identity Provider: Azure Entra External ID (OIDC / RS256)
- Payment Gateway: Razorpay (Webhook REST API)
- Messaging Service: WhatsApp Business API (Meta Cloud API / BSP)
- Frameworks: .NET 10 SDK, Node.js / React 19, PostgreSQL 16+

---

## Risks

- **Scope Creep**: Implementing features from Track 2 (Pharmacy), Track 3 (AI), or Track 4 (IPD) before Phase 1 is validated.
- **Constraint Bypass**: Softening security controls (e.g. storing raw tokens, bypassing audit log append-only DB roles).
- **Hallucination**: Generating fictitious API endpoints or database tables not listed in the FRD.

---

## Future Improvements

- Automated linting script to check that all `agents/` markdown files contain all 11 standard sections.
- Dynamic index generation for cross-linking skills and state files.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Automated CI tool to validate markdown link integrity across `/agents`.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`README.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/README.md)
- [`AGENTS.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/AGENTS.md)
- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md)
