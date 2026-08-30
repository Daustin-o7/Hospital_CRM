# SAMSTACK AI — Technical Requirements Document (TRD)
## Phase 2 — Track 1 Fast-Follow

---

## 1. Document Information

| Field | Value |
|---|---|
| Title | SAMSTACK AI — TRD, Phase 2 |
| Version | 1.0 |
| Date | 27 August 2026 |
| Extends | samstack-ai-trd-phase1-v1.md — architecture unchanged where not noted below |
| Source of truth for scope | samstack-ai-frd-phase2-FINAL.md |

---

## 2. What's Genuinely New vs. Phase 1 (Not Just More Tables)

Two real infrastructure additions, flagged explicitly rather than silently introduced:

| Addition | Why Phase 1 didn't need it | Triggered by |
|---|---|---|
| **Background job scheduler (Hangfire, .NET)** | Phase 1 had no scheduled/recurring logic beyond FR-21's simple day-before reminder, handled inline | MOD-13's rule evaluation (FR-13-03) needs genuine recurring evaluation against arbitrary configured timing — this is the real trigger, arriving in Phase 2, not Phase 3 as samstack-ai-phase2-voice-agent-analysis had assumed when it recommended Hangfire for Voice Agent use |
| **Blob/file storage** | Nothing in Phase 1 involved file uploads — all data was structured/text | MOD-08's lab result file upload (FR-08-02) is the first feature requiring it |

Everything else in Phase 2 runs on the existing modular monolith, Postgres, and API Gateway — no new services stood up, consistent with strategy-v0.5 §4's discipline.

---

## 3. Consolidated API Contract (Index)

| Endpoint | Method | FR |
|---|---|---|
| `/precheck/{token}` | POST | FR-23-02 |
| `/appointments/{id}/precheck` | GET | FR-23-03 |
| `/appointments/{id}/priority` | PATCH | FR-24-01 |
| `/queue-status/{token}` | GET | FR-25-01 |
| `/consult-templates` | GET, POST | FR-12-01/02 |
| `/inventory/items` | GET, POST, PATCH | FR-09-01 |
| `/inventory/items/{id}/movements` | POST | FR-09-02 |
| `/inventory/low-stock` | GET | FR-09-03 |
| `/consultations/{id}/lab-orders` | POST | FR-08-01 |
| `/lab-orders/{id}/result` | PATCH | FR-08-02 |
| `/lab-orders` | GET | FR-08-03 |
| `/notification-rules` | GET, POST | FR-13-01 |
| `/message-templates` | GET, POST | FR-13-02 |
| `/wishlist-items` | GET, POST, PATCH | FR-10-01 |
| `/ledger/income` | GET | FR-11-01 |
| `/ledger/expenses` | POST, PATCH | FR-11-02 |
| `/ledger/summary` | GET | FR-11-03 |
| `/platform-admin/tenants` | GET | FR-14-01 |
| `/platform-admin/tenants/{id}` | GET, PATCH | FR-14-02 |
| `/platform-admin/impersonate` | POST | FR-14-03 |
| `/platform-admin/tenants/{id}/flags` | GET, PATCH | FR-14-04 |

Same convention as Phase 1: this table indexes, the FRD is the authority on exact shapes.

---

## 4. Consolidated Database Schema (New Tables Only)

```sql
-- MOD-23
precheck_submissions (id, tenant_id, appointment_id, token_hash, expires_at, submitted_at,
                       chief_complaint, symptom_duration, medications, allergies)

-- MOD-24
-- appointments gains: priority (enum: emergency/normal)
priority_log (id, appointment_id, changed_by, changed_to, changed_at)

-- MOD-12
consult_templates (id, tenant_id, doctor_id, specialty, name, structure_json, created_at)

-- MOD-09
inventory_items (id, tenant_id, name, tier, unit, active, low_stock_threshold, created_at)
stock_movements (id, tenant_id, item_id, quantity, direction, note, recorded_by, recorded_at)

-- MOD-08
lab_orders (id, tenant_id, consultation_id, test_name, notes, status, created_at)
lab_results (id, lab_order_id, result_text, file_url, version, previous_version_id, entered_by, entered_at)

-- MOD-13
notification_rules (id, tenant_id, rule_type, timing_config_json, template_id, active, created_at)
message_templates (id, tenant_id, name, channel, content, approval_status, created_at)
-- notification_log gains: rule_id (nullable FK)

-- MOD-10
wishlist_items (id, tenant_id, created_by, text, category, status, created_at)

-- MOD-11
ledger_expenses (id, tenant_id, category, amount, expense_date, note, recorded_by, created_at, edited_at)

-- MOD-14
-- clinics/tenant table gains: subscription_tier, subscription_status
tenant_feature_flags (tenant_id, flag_name, enabled)
impersonation_log (id, platform_admin_id, tenant_id, impersonated_user_id, started_at, ended_at)
```

`tenant_id` present on every table per §6 of the FRD's conflict check. All append-only/audit tables (`priority_log`, `stock_movements`, `impersonation_log`) follow Phase 1's `REVOKE UPDATE, DELETE` pattern at the DB role level (TRD_Phase1 §7) — not re-specified per table here, same standing rule.

---

## 5. Deployment Architecture Updates

| Component | Addition | Note |
|---|---|---|
| Hangfire | New — runs inside the existing .NET monolith process for pilot scale, no separate worker infrastructure yet | Reuses existing Azure Container Apps compute, doesn't add a new hosting target |
| Blob storage | New — Azure Blob Storage, same encryption-at-rest standard as Postgres (AES-256) | For FR-08-02 lab file uploads only, not a general file store |
| WhatsApp template approval | Process dependency, not infrastructure | FR-13-02's templates go through Meta/BSP approval — external timeline, plan around it, don't assume instant availability |

---

## 6. Security Architecture Updates

- **FR-14-03 (impersonation) is the highest-privilege action in the system.** MFA-gated, time-limited session, banner visible throughout, every action during an impersonated session tagged with both the Platform Admin's identity and the impersonated user's — never just one or the other in the log.
- **File upload security (FR-08-02):** virus/malware scan before storage (even for a small pilot, an uploaded "lab report" is an untrusted file), content-type validation, size limit enforced server-side not just client-side.
- **Tokenized links (MOD-23, MOD-25) reuse the same token-entropy and rate-limiting standard already established for the discovery-survey webpage and FR-04's staff invites** — no new pattern invented, same one applied a third time.

---

## 7. Testing Strategy Extension

Extends TRD_Phase1 §8:
- **Concurrency test, new case:** an emergency-flag (FR-24-01) firing while a receptionist is mid-reschedule on the same appointment — confirm the priority change and the reschedule don't corrupt each other.
- **File upload testing (FR-08-02):** malformed files, oversized files, correct files — all three paths, not just the happy path.
- **Impersonation testing (FR-14-03):** explicit test that an impersonated session cannot exceed the impersonated user's own permissions — this is a security-critical boundary, not a normal feature test.
- **Rule-engine idempotency (FR-13-03):** simulate a job restart mid-evaluation, confirm no duplicate sends.

## 8. Observability Extension

Add to TRD_Phase1 §9's tracked metrics: rule-engine evaluation success/failure rate (FR-13-03), lab file upload success rate (FR-08-02), impersonation session count and duration (FR-14-03 — this one's worth watching closely given its privilege level, not just logging it and moving on).
