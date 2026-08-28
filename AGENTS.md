# Hospital_CRM — Agent Instructions (Samstack)

## Project
Hospital_CRM is a doctor/clinic CRM by Samstack. This checkout implements **Phase 1 only** — `FRD_FINAL.md` is the single source of truth for every requirement (FR-01 through FR-22). Build what's in it; don't build what isn't. If a task seems to need something outside FR-01–22, stop and flag it rather than improvising scope.

## Stack (locked, don't substitute without checking first)
- Backend: .NET 10 (ASP.NET Core, C# 14) — Minimal APIs, EF Core 10
- Frontend: React 19 (responsive PWA, mobile-first — front desks use phones/tablets)
- Database: PostgreSQL 16+
- Identity: Azure Entra External ID (managed OIDC — deliberately not self-hosted Duende)
- Payments: Razorpay
- Messaging: WhatsApp Business API (via BSP or Meta Cloud API)

## Ground Rules
1. **FRD is authoritative.** Every FR-XX has acceptance criteria — implement to those exactly, not more, not less.
2. **Ladder before code** (ponytail discipline — see `TOOLING-SETUP.md`): does this need to exist → already in codebase → stdlib → native platform feature → installed dependency → one line → only then write new code. Never skip validation, error handling, security, or accessibility.
3. **`tenant_id` is present but dormant.** Every table that will eventually be tenant-scoped gets the column now (per FR DB schema notes), even though Phase 1 runs single-tenant. Don't build multi-tenant logic — just don't create migration debt.
4. **Audit logs are append-only.** Enforce at DB role level (`REVOKE UPDATE, DELETE`), not only in app code — see FR-08.
5. **Offline-tolerance (FR-22) applies only to registration and billing**, not the whole app. Client-side idempotency keys, not a general offline cache of patient data.
6. **Amendments, never overwrites, on clinical data.** FR-14/FR-15 — a saved consultation note or prescription is never silently edited. New version, original preserved, both visible.
7. **Git:** Never `git push` or auto-commit without explicit approval. Always create feature branch first. Let user perform Git ops unless asked.

## Reference Material
- `FRD_FINAL.md` — master spec (FR-01–22)
- `samstack-implementation-reference.md` — Razorpay webhook verification, WhatsApp channel abstraction, JWT/RS256 setup, offline-sync pattern. Read before FR-18, FR-20/21, FR-01, FR-22.
- `.opencode/skills/new-fr/SKILL.md` — repeatable build sequence for every FR-XX (migration → endpoint → role check → audit hook → UI → test)
- `TOOLING-SETUP.md` — ponytail install; `/ponytail-review` before marking any FR done
- **`.agents/skills/frontend-design/SKILL.md`** — ⚡ MUST READ before editing any `.tsx`, `.css`, or UI file. Synthesises taste-skill + Vercel guidelines + design-craft rules. Covers colour tokens, typography scale, interaction quality, anti-patterns checklist, and page-specific patterns for Hospital CRM.

## What NOT to Build Yet
Pharmacy, Lab, Inventory, Wishlist, ITR ledger, any AI feature, IPD, UAE adapter, Dedicated DB/Instance tenancy — all explicitly out of scope (FRD §5.2).

---

## Developer Commands (once solution initialized)

### Backend (.NET 10)
```bash
# Restore & build
dotnet restore
dotnet build

# Run API (assumes HTTPS dev cert trusted)
dotnet run --project backend/Hospital_CRM.Api

# EF Core migrations
dotnet ef migrations add <Name> --project backend/Hospital_CRM.Infrastructure --startup-project backend/Hospital_CRM.Api
dotnet ef database update --project backend/Hospital_CRM.Infrastructure --startup-project backend/Hospital_CRM.Api

# Test
dotnet test

# Lint/format (if configured)
dotnet format
```

### Frontend (React 19 + Vite)
```bash
# Install deps
cd frontend && npm install

# Dev server (PWA)
npm run dev

# Build
npm run build

# Preview production build
npm run preview

# Test (Playwright)
npm run test:e2e

# Lint
npm run lint
```

### Database
- Local PostgreSQL required. Connection string in `backend/Hospital_CRM.Api/appsettings.json`
- Migrations live in `backend/Hospital_CRM.Infrastructure/Migrations/`

---

## Architecture Conventions

### Backend
- **Minimal APIs** — no controllers unless project pattern demands
- **EF Core** — `DbContext` in `Infrastructure`, compiled queries for hot paths
- **Auth** — JWT RS256 validation against Azure Entra External ID JWKS; roles as claims
- **RBAC** — server-side only; never trust client-supplied role
- **Error handling** — typed result objects / structured HTTP error payloads (RFC 7807), no silent failures
- **Cancellation tokens** — pass through all async I/O

### Frontend
- **React 19** + Vite, PWA via `vite-plugin-pwa`
- **State** — local state by default; `useActionState` / `Zustand` only where genuinely global
- **Styling** — Tailwind CSS v4 (utility-first), responsive mobile-first
- **Forms** — React Hook Form + Zod validation
- **Auth** — OIDC via `oidc-client-ts` or MSAL; tokens in memory (not localStorage)

### Database
- UUID PKs (`gen_random_uuid()`)
- `tenant_id` UUID on all tenant-scoped tables (dormant in Phase 1)
- Audit tables: append-only via DB role (`REVOKE UPDATE, DELETE ON audit.* FROM app_user;`)
- Indexes: B-Tree for lookups, GIN for JSONB/text search

---

## FR Implementation Sequence (per `new-fr` skill)
1. **DB migration** — exact schema from FR's "Database Schema Notes" + dormant `tenant_id`
2. **API endpoint** — match FR's "API Shape" exactly (request/response, status codes)
3. **Role enforcement** — server-side check per FR's Roles line; cross-check FRD §8
4. **Edge cases** — implement each listed; check FRD §18 & §9 if underspecified
5. **Audit/notification hooks** — wire for FR-08/09/14/15 (audit) or FR-20/21 (notifications)
6. **UI** — mobile-first PWA per FR workflow; let ponytail ladder run on simple forms/lists
7. **Test against acceptance criteria** — each checkbox = test case

**Before marking done:** Run `/ponytail-review` on the diff. Read flags before dismissing.

---

## Common Gotchas
- **Azure Entra External ID** — configure redirect URIs, token validation parameters, and role claims mapping in portal *before* coding FR-01
- **Razorpay webhooks** — verify signature (`X-Razorpay-Signature` header) using `samstack-implementation-reference.md` pattern
- **WhatsApp** — build against channel interface from day 1 (SMS/email fallback later = config change)
- **Offline sync** — idempotency keys on registration/billing mutations; conflict resolution = server wins on clinical data, last-write-wins on demographic
- **Ponytail** — default mode `full`. `/ponytail-review` flags over-building; don't dismiss without reading why
- **No `samstack-implementation-reference.md` exists yet** — create it when first needed (FR-01, FR-18, FR-20/21, FR-22) per the pattern in the skill

---

## Key Files to Know
- `docs/product/FRD_FINAL.md` — requirements source of truth
- `AGENTS.md` — this file
- `.opencode/skills/new-fr/SKILL.md` — build sequence
- `.opencode/skills/coding-standards/SKILL.md` — coding philosophy
- **`.agents/skills/frontend-design/SKILL.md`** — frontend design system (read for any UI edit)
- `.agents/skills/ponytail/SKILL.md` — lean code discipline
- `.agents/skills/coding-standards/SKILL.md` — unified coding standards
- `agents/state/current.md` — active workstream
- `docs/technical/TOOLING-SETUP.md` — ponytail commands

---

## Ports (confirm locally)
- Backend API: `https://localhost:7001` (dev cert)
- Frontend Vite: `http://localhost:5173`
- PostgreSQL: `localhost:5432`