# SAMSTACK AI — Agent Instructions

## Project
SAMSTACK AI is a doctor/clinic CRM. This checkout implements **Phase 1 only** — `samstack-ai-frd-phase1-FINAL.md` is the single source of truth for every requirement (FR-01 through FR-22). Build what's in it; don't build what isn't. If a task seems to need something outside FR-01–22, stop and flag it rather than improvising scope.

## Stack (locked, don't substitute without checking first)
- Backend: .NET 10 (ASP.NET Core, C#)
- Frontend: React 19 (responsive PWA, mobile-first — front desks use phones/tablets)
- Database: PostgreSQL
- Identity: Azure Entra External ID (managed — deliberately not self-hosted Duende; see FRD §9 for why, it's a documented reliability trade-off, not an oversight)
- Payments: Razorpay
- Messaging: WhatsApp Business API (BSP or Meta Cloud API)

## Ground rules
1. **The FRD is authoritative.** Every FR-XX has acceptance criteria in the doc — implement to those exactly, not more, not less.
2. **Ladder before code** (ponytail discipline — see TOOLING-SETUP.md): does this need to exist → already in this codebase → stdlib → native platform feature → installed dependency → one line → only then write something new. Never skip validation, error handling, security, or accessibility to get there — those are never optional, regardless of how far down the ladder you land.
3. **`tenant_id` is present but dormant.** Every table that will eventually be tenant-scoped gets the column now (per each FR's DB schema notes), even though Phase 1 runs single-tenant. Don't build multi-tenant *logic* — just don't create a migration debt for later.
4. **Audit logs are append-only.** Enforce at the database role level (`REVOKE UPDATE, DELETE`), not only in application code — see FR-08.
5. **Offline-tolerance (FR-22) applies specifically to registration and billing**, not the whole app. Client-side idempotency keys, not a general offline cache of patient data — see FR-22's security note on why.
6. **Amendments, never overwrites, on clinical data.** FR-14/FR-15 — a saved consultation note or prescription is never silently edited. New version, original preserved, both visible.
7. **Git Operations Control:** Never execute `git push` or commit changes automatically without explicit user approval. Always create a feature branch first before pushing to `main`. Allow the user to perform Git operations unless specifically requested to do so.

## Reference material
- `samstack-implementation-reference.md` — Razorpay webhook verification, WhatsApp channel abstraction, JWT/RS256 setup, offline-sync pattern. Read before touching FR-18, FR-20/21, FR-01, or FR-22.
- `new-fr-skill.md` — the repeatable pattern for implementing any FR-XX consistently. Use it, don't reinvent the sequence per requirement.
- `TOOLING-SETUP.md` — ponytail install for whichever host you're running.

## What NOT to build yet
Pharmacy, Lab, Inventory, Wishlist, ITR ledger, any AI feature, IPD, the UAE adapter, Dedicated DB/Instance tenancy — all explicitly out of scope for this phase (FRD §5.2). If a task description implies any of these, that's a signal to stop and check, not to quietly scope-creep.
