# Engineering Skill: System Diagnostics & Troubleshooting (`skills/debugging.md`)

This document defines diagnostic workflows, log inspection standards, error tracing guidelines, webhook troubleshooting, and offline queue debugging strategies for SAMSTACK AI.

---

## Purpose

To provide systematically structured troubleshooting procedures for resolving runtime errors, database lock issues, authentication failures, webhook signature mismatches, and offline sync conflicts without guesswork.

---

## Scope

Applies to all backend ASP.NET Core log analysis, PostgreSQL query execution analysis, Razorpay webhook debugging, WhatsApp API handler tracing, and frontend IndexedDB troubleshooting.

---

## Verified Information

- **Diagnostic Rule 1**: Inspect full, un-truncated error logs and stack traces before forming a diagnostic hypothesis.
- **Diagnostic Rule 2**: Never patch symptoms by swallowing exceptions, returning dummy fallbacks, or wrapping API calls in empty `try/catch` blocks.
- **Diagnostic Rule 3**: Every bug fix MUST be justified by empirical log evidence or traceback data.

---

## Implementation Details

### 1. Razorpay Webhook Troubleshooting (FR-18)
When a Razorpay payment webhook fails to mark an invoice as paid:
1. **Check HMAC Signature**: Verify if `X-Razorpay-Signature` header calculation matches `HMAC-SHA256(raw_request_body, webhook_secret)`. (Common error: parsing JSON body before computing HMAC modifies whitespace/formatting).
2. **Check Idempotency Key**: Query `payments` table by `idempotency_key` (Razorpay payment ID or order ID) to verify if the event was already processed.
3. **Inspect Gateway Log**: Verify if Razorpay returned HTTP 200 to the webhook provider. If non-200 was returned, check backend exception log.

### 2. Offline Sync Queue Troubleshooting (FR-22)
When offline transactions fail to sync on reconnect:
1. Open browser Developer Tools -> Application -> IndexedDB -> `samstack_offline_db` -> `sync_queue`.
2. Verify if item has `idempotencyKey`, `actionType`, and valid payload JSON.
3. Check Service Worker network logs for HTTP 400/409/500 responses during reconnect sync dispatch.
4. If HTTP 409 Conflict occurs, check server-side `patients.phone` duplicate check or `invoices.invoice_number` uniqueness constraint.

### 3. Database Audit Log & Lock Troubleshooting
If a database modification fails with permission errors:
1. Check if the query attempted `UPDATE` or `DELETE` on `patient_audit_log` or `patient_consent`.
2. Confirm that application code only executes `INSERT` and `SELECT` against append-only audit tables.

---

## Important Files

- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md) — Webhook & Offline reference
- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=537-561) — FR-18 Payment Webhooks

---

## Dependencies

- PostgreSQL `EXPLAIN ANALYZE` tool
- Browser Developer Tools (IndexedDB & Service Worker Inspector)
- Postman / cURL for raw HTTP webhook testing

---

## Risks

- **Debugging Blindly**: Modifying code without viewing un-truncated error logs.
- **Parsing Request Body Before Signature Verification**: Modifying raw payload bytes during JSON deserialization, causing HMAC signature verification failures.

---

## Future Improvements

- Centralized structured logging tool for correlate transaction IDs across API gateways and WhatsApp notification handlers.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Centralized logging platform (Seq vs OpenTelemetry vs ELK) for staging environment.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md)
- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md)
