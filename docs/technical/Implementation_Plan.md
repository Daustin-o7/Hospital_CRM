# Implementation Reference — Integration & Cross-Cutting Patterns

Ties directly to specific FRs in samstack-ai-frd-phase1-FINAL.md. Where a third-party API's exact current shape matters, this says so explicitly rather than asserting precision it doesn't have — confirm those specific points against the live provider docs, everything else here is our own design decision and should be followed exactly.

## FR-01: Auth (JWT/RS256)
- **RS256, not HS256** — every service verifies with a public key, no shared secret to leak. This is a hard requirement from FRD §9, not a preference.
- Access token: 15 min. Refresh token: rotated on every use (theft detection — a replayed old refresh token is the signal).
- **30-minute inactivity timeout applies to Doctor and Clinic Admin roles only**, not Receptionist (FRD §14 NFR table) — implement as a separate check from token expiry, not a shorter token lifetime, since the mechanism differs (last-activity timestamp vs. token TTL).
- Claims: `sub`, `tenant_id` (present even though dormant), `role`, `region`.
- Via Azure Entra External ID (OIDC) — confirm current tenant/app registration steps against Microsoft's live docs, that setup flow changes independently of this project.

## FR-18: Razorpay
- **Webhook signature verification is non-negotiable** (FRD FR-18 security note) — verify the signature header against the raw request body using Razorpay's webhook secret before trusting any payload. Confirm the exact header name and verification helper against Razorpay's current webhook docs at implementation time — this is exactly the kind of third-party API surface detail worth checking live rather than trusting a general description.
- **Idempotency:** generate an idempotency key client-side (or use Razorpay's own order ID) and store it on the `payments` row with a unique constraint. A duplicate webhook delivery for the same event must be a no-op, not a second payment record.
- Never let card/UPI details touch our servers — Razorpay-hosted checkout only (FR-18).
- Cash payments record immediately with no external call — don't route them through the same async path as Razorpay.

## FR-20/FR-21: WhatsApp Notification Channel
- Build against an interface (`INotificationChannel` or equivalent), WhatsApp is the only implementation in Phase 1 — this is what makes SMS/email a config change later, not a rewrite (strategy-v0.5 §5, carried into FRD §13).
- **Async, event-driven, decoupled from the triggering transaction.** `AppointmentConfirmed` fires an event; the handler sends the WhatsApp message. A WhatsApp API failure must never roll back or block the appointment booking itself (FR-20 acceptance criteria) — if this coupling exists anywhere in the implementation, it's a bug against the FRD, not a minor issue.
- Retry: 3 attempts, exponential backoff, then mark `failed` in `notification_log` — visible to staff, doesn't retry forever.
- Whether you're on a BSP (Interakt/AiSensy/Gupshup) or direct Meta Cloud API changes the specific request shape — confirm against whichever's actually contracted before writing the handler; the interface above is what stays stable regardless of that choice.

## FR-22: Offline-Tolerant Sync
- Client-side queuing uses **IndexedDB, not localStorage** — this is a genuine technical call for offline-first PWA sync specifically (structured storage, works properly with a Service Worker, not a browser-storage-in-general rule): localStorage is synchronous, ~5–10MB capped, and doesn't integrate cleanly with Service Worker-based offline strategies the way IndexedDB does.
- Every offline-queued write carries a client-generated `idempotencyKey`. Server treats a repeated key as a no-op success returning the original result, never a second record (FR-22 acceptance criteria).
- Scope the offline queue to *only* what's pending sync (FR-06 registrations, FR-17/18 invoices/payments) — not a general local cache of the patient database. FR-22's own security note exists specifically to prevent scope creep here: less exposure if a front-desk device is lost while something's queued.
- Duplicate-patient detection (FR-06) runs at sync time too, not just at initial write — two offline sessions could register the same phone number before either syncs.

## Audit Trail (cross-cutting, FR-08/FR-09/FR-14)
- Enforce append-only at the **database role level** (`REVOKE UPDATE, DELETE` on audit tables for the application's DB user), not only in application code. This is explicit in the FRD (FR-08 security note) precisely because app-layer-only enforcement is bypassable by a bug or a future migration script.
- Clinical note/prescription amendments (FR-14/15): new versioned row, `previous_version_id` self-referencing FK, original never modified. Same pattern for both tables — don't build two different versioning schemes.
