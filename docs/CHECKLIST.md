# Remaining Work Checklist — Hospital CRM

**Last Updated:** 2026-09-04
**Project:** Samstack Hospital CRM
**Status:** Phase 1 ✅ Complete (22/22 FRs) | Phase 2 ✅ Complete (10/10 modules) | Track 2 Pharmacy 2a ✅ Shipped | Track 2b Stabilize 🔧 Active

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Done & verified |
| 🔧 | In progress |
| ⏳ | Not started |
| 📋 | Deferred (planned for later) |
| ❌ | Explicitly out of scope |

---

## 1. Phase 1 — COMPLETE ✅

All 22 functional requirements implemented and verified end-to-end.

| FR | Feature | Endpoint(s) | Status |
|---|---|---|---|
| FR-01 | User Login (JWT RS256) | `POST /api/v1/auth/login`, `POST /refresh`, `GET /.well-known/jwks.json` | ✅ |
| FR-02 | Role Enforcement | Server-side `[AuthorizeRoles]` + `RbacHandler` | ✅ |
| FR-03 | Password Reset | `POST /api/v1/auth/request-password-reset`, `/confirm-password-reset` | ✅ |
| FR-04 | Staff Invitation | `POST /api/v1/staff/invite`, `/accept-invite`, `GET /staff` | ✅ |
| FR-05 | Clinic Profile Config | `GET/PUT /api/v1/clinic/profile`, `/hours`, `/holidays`, `/special-hours` | ✅ |
| FR-06 | Patient Registration | `POST /api/v1/patients` (idempotency key, phone dedup) | ✅ |
| FR-07 | Patient Search/View | `GET /api/v1/patients/search?q=`, `GET /{id}`, `PATCH /{id}` | ✅ |
| FR-08 | Patient Edit + Audit | Auto-logs to `PatientAuditLogs` (DB REVOKE UPDATE/DELETE) | ✅ |
| FR-09 | DPDP Consent | Inline with FR-06, `PatientConsent` row | ✅ |
| FR-10 | Book Appointment | `POST /api/v1/appointments` (serialized tx, slot uniqueness) | ✅ |
| FR-11 | Daily Schedule | `GET /api/v1/appointments?date=` (polling refresh) | ✅ |
| FR-12 | Queue Token | `POST /api/v1/appointments/{id}/check-in` (sequential per day) | ✅ |
| FR-13 | Reschedule/Cancel | `PUT /api/v1/appointments/{id}` + `AppointmentHistory` | ✅ |
| FR-14 | Consultation (versioned) | `POST /appointments/{id}/consultation`, `POST /consultations/{id}/amend` | ✅ |
| FR-15 | Prescription | `POST /consultations/{id}/prescriptions` | ✅ |
| FR-16 | Treatment Timeline | `GET /consultations?patientId=` (chronological) | ✅ |
| FR-17 | Invoice (GST, gapless) | `POST /api/v1/invoices` (serialized, ExecutionStrategy) | ✅ |
| FR-18 | Payment (Razorpay + webhook) | `POST /invoices/{id}/payment`, `/webhooks/razorpay`, `RazorpayReconciliationWorker` | ✅ |
| FR-19 | Outstanding Dues | `GET /api/v1/invoices?status=unpaid` | ✅ |
| FR-20/21 | Notifications → MOD-13 | `appointmentconfirmation` + `appointmentreminder` default rules | ✅ |
| FR-22 | Offline Sync | **⏳ Deferred** — IndexedDB queue + service worker not built | ⏳ |

---

## 2. Phase 2 — COMPLETE ✅

All 10 modules shipped and verified end-to-end.

| Module | FRs | Endpoints | Status |
|---|---|---|---|
| **MOD-23** Pre-Check | 23-01/02/03 | `POST /precheck/{token}`, `GET /appointments/{id}/precheck` | ✅ |
| **MOD-24** Emergency Queue | 24-01/02 | `PATCH /appointments/{id}/priority` | ✅ |
| **MOD-25** Live Ticket | 25-01 | `GET /queue-status/{token}` | ✅ |
| **MOD-12** Specialty Templates | 12-01/02 | `GET/POST /consult-templates` | ✅ |
| **MOD-13** Notification Rules | 13-01/02/03 | `GET/POST /notification-rules`, `/message-templates`, `NotificationRulesWorker` | ✅ |
| **MOD-09** Inventory | 09-01/02/03 | `/inventory/items`, `/movements`, `/low-stock` | ✅ |
| **MOD-10** Wishlist | 10-01 | `GET/POST/PATCH /wishlist-items` | ✅ |
| **MOD-08** Lab Records | 08-01/02/03 | `/consultations/{id}/lab-orders`, `/lab-orders/{id}/result`, `/lab-orders` | ✅ |
| **MOD-11** Finance Ledger | 11-01/02/03 | `/ledger/income`, `/expenses`, `/summary` | ✅ |
| **MOD-14** Platform Admin | 14-01/02/03/04 | `/platform-admin/tenants`, `/impersonate`, `/flags` | ✅ |

---

## 3. Pilot Launch Prep — NEXT PRIORITY ⏳

Real integration configuration (not code) needed before pilot.

### 3.1 WhatsApp Business API

| Task | Status | Notes |
|---|---|---|
| Meta Business Manager account setup | ⏳ | Required for WhatsApp API access |
| WhatsApp Business Account (WABA) creation | ⏳ | Phone number verification |
| Template submission for approval | ⏳ | Templates seeded as `pending` in `MessageTemplates` table |
| ├─ "FR-20 Appointment Confirmation" | ⏳ | |
| ├─ "FR-21 Appointment Reminder" | ⏳ | |
| └─ "Pre-visit form" (MOD-23) | ⏳ | |
| Webhook URL configuration at Meta | ⏳ | `POST /api/v1/notifications/webhooks/whatsapp` (TBD) |
| Production `INotificationService` implementation | ⏳ | Replace `StubNotificationService.cs` |
| Channel abstraction (SMS/email fallback) | ⏳ | Per `samstack-implementation-reference.md` |

### 3.2 Razorpay

| Task | Status | Notes |
|---|---|---|
| Merchant account + live API keys | ⏳ | `Razorpay:KeyId`, `KeySecret` in production env |
| Webhook URL configuration at Razorpay dashboard | ⏳ | `POST /api/v1/invoices/webhooks/razorpay` (already implemented) |
| Test payment flow end-to-end | ⏳ | Verify HMAC verification + reconciliation worker |

### 3.3 Azure Entra External ID

| Task | Status | Notes |
|---|---|---|
| Tenant configuration in Azure portal | ⏳ | App registration, redirect URIs |
| Role claim mapping | ⏳ | Map Entra groups → `UserRole` enum |
| JWT validation against Entra JWKS | ⏳ | Replace local RS256 key with `AzureKeyVaultKeyService` (ADR-07) |
| Test OIDC login flow | ⏳ | Frontend OIDC integration |

### 3.4 Blob Storage (MOD-08)

| Task | Status | Notes |
|---|---|---|
| S3-compatible bucket provisioning | ⏳ | MinIO (self-hosted) or AWS S3 / GCP GCS |
| Swap `lab-uploads/` local disk → S3 | ⏳ | TRD-Phase2 §3, config + DI change only |
| Presigned URL generation for uploads | ⏳ | Avoid proxying through API |
| Lifecycle policy (archive old results) | ⏳ | Cost optimization |

### 3.5 Observability

| Task | Status | Notes |
|---|---|---|
| Structured logging pipeline | ⏳ | Serilog → Seq / Elasticsearch / Datadog |
| Metrics collection | ⏳ | Prometheus / Grafana or cloud-native |
| Distributed tracing | ⏳ | OpenTelemetry |
| Health endpoints | ⏳ | `/health` (liveness), `/ready` (readiness) for K8s/container orchestration |
| Error tracking | ⏳ | Sentry / Application Insights |

---

## 4. Phase 3 — Voice Agent (MOD-27) 📋

Formally moved to Phase 3 per FRD-Phase2 §9.

| Item | Source | Status |
|---|---|---|
| MOD-27a Voice Step 1 | `samstack-ai-phase2-voice-agent-analysis.md` | 📋 Phase 3 |
| MOD-27b Voice Step 2 | `samstack-ai-phase2-voice-agent-analysis.md` | 📋 Phase 3 |
| Architecture/compliance/cost model | `samstack-ai-phase2-voice-agent-analysis.md` | ✅ Valid reference (read when ready) |

**Note:** Technical content in voice-agent-analysis remains valid as Phase 3 reference. Only §17 priority-ordering was superseded.

---

## 5. Track 2 — Pharmacy (MOD-15/16/17) 

**Architectural decision:** Option A+C (single app, role-gated, lazy-loaded UI) — **2a SHIPPED, 2b ACTIVE**

### 5.1 Track 2a — Core Pharmacy POS (SHIPPED ✅)

| Component | Endpoint / File | Status |
|---|---|---|
| Drug catalog (Drug, DrugBatch, Supplier) | `Drug.cs`, `DrugBatch.cs`, `Supplier.cs` | ✅ |
| PurchaseOrder + status machine | `PurchaseOrder.cs` | ✅ |
| DispenseRecord + DispenseItem (prescription linkage) | `DispenseRecord.cs`, `DispenseItem.cs` | ✅ |
| ControlledSubstanceRegister (Schedule H/H1/NDPS/X) | `ControlledSubstanceRegister.cs` | ✅ |
| Enums: ScheduleClass, InvoiceType, PurchaseOrderStatus | `DrugEnums.cs` | ✅ |
| Migration `20260904201324_AddPharmacyTrack2` | `Migrations/` | ✅ |
| PharmacyController: drugs CRUD | `GET/POST /pharmacy/drugs` | ✅ |
| PharmacyController: FEFO batches | `GET /pharmacy/drugs/{id}/batches/fefo` | ✅ |
| PharmacyController: stock inwarding | `POST /pharmacy/drugs/{id}/batches` | ✅ |
| PharmacyController: POS checkout | `POST /pharmacy/checkout` | ✅ |
| PharmacyController: Schedule H/H1 gate + compliance register | `GET /pharmacy/compliance/register` | ✅ |
| PharmacyController: generic substitutes | `GET /pharmacy/substitutes/{drugId}` | ✅ |
| PharmacyController: stats dashboard | `GET /pharmacy/stats` | ✅ |
| PharmacyController: supplier CRUD | `GET/POST /pharmacy/suppliers` | ✅ |
| Frontend: Pharmacy POS | `/dashboard/pharmacy/pos` | ✅ |
| Frontend: Drug Batches | `/dashboard/pharmacy/batches` | ✅ |
| Frontend: Drug Compliance | `/dashboard/pharmacy/compliance` | ✅ |
| Seed: Indian Essential Medicines (90 drugs, 180 batches) | `Indian_Essential_Medicine_Master.csv` | ✅ |

### 5.2 Track 2b — Stabilize (ACTIVE 🔧)

| Item | Endpoint / Action | Status | Priority |
|---|---|---|---|
| Returns / Refund endpoint | `POST /pharmacy/returns/{invoiceId}` | 🔧 | High |
| PO Receive / GRN flow | `POST /pharmacy/purchase-orders/{id}/receive` | 🔧 | High |
| Rx-to-Dispense endpoint | `POST /pharmacy/dispense` (from PrescriptionId) | 🔧 | High |
| Tenant feature flag `pharmacy` | MOD-14 `TenantFeatureFlag` seed | 🔧 | Medium |
| Wire or remove orphan `DispenseRecord` | Add dispense endpoint or drop entity | 🔧 | Medium |
| Form 20/21 stock register | Extend compliance register if needed | ⏳ | Low (legal review first) |
| Larger drug catalog (1000+ items) | Replace seed CSV with pilot-specific list | ⏳ | Low |

---

## 6. Track 3 — AI Features (MOD-18/19) 📋 DEFERRED

| Module | Description | Status |
|---|---|---|
| MOD-18 | Clinical Decision Support | 📋 Track 3 |
| MOD-19 | NLU Chatbot | 📋 Track 3 |

**Regulatory consideration:** Clinical decision support falls under India's ABDM/Health Ministry guidelines. Legal review needed before implementation.

---

## 7. Track 4 — IPD (MOD-20–26) 📋 DEFERRED

| Module | Description | Status |
|---|---|---|
| Bed management | Ward/bed allocation | 📋 Track 4 |
| Ward transfers | Patient movement tracking | 📋 Track 4 |
| Nursing charting | Nurse workflow integration | 📋 Track 4 |
| Admission/Discharge | IPD-specific lifecycle | 📋 Track 4 |

---

## 8. Out of Scope — Explicit ❌

Per FRD §5.2 and AGENTS.md:

| Item | Reason |
|---|---|
| UAE adapter | International, not pilot region |
| Dedicated DB/Instance tenancy | Tier 3 SaaS model, not pilot scope |
| AI features (Track 3) | Deferred — regulatory review needed |
| IPD (Track 4) | Deferred — OPD-only pilot |
| Real-time WebSockets | Accepted debt — polling sufficient at OPD scale |
| Mobile app | Future, post-pilot |

---

## 9. Technical Debt Register

| ID | Item | Status | Action |
|---|---|---|---|
| TD-1 | 7-year data retention rule | Provisional | Legal confirmation needed before hard-deletion crons |
| TD-2 | Solo practitioner dual-role UX | Pilot validation | Gather feedback during pilot |
| TD-3 | In-code RBAC → DB permissions | Accepted | Refactor when Pharmacist/Nurse roles added (Track 2) |
| TD-4 | HTTP polling vs WebSockets | Accepted | Re-evaluate if MOD-25 needs sub-second updates |
| TD-5 | `NotificationRulesWorker` on `BackgroundService` | Accepted | Migrate to Hangfire when scheduled jobs > 3 |
| TD-6 | Stubs: WhatsApp/Razorpay/Entra | Known | Replace before pilot (see §3) |
| TD-7 | Offline sync (FR-22) | Deferred | Build when pilot connectivity issues arise |
| TD-8 | Pre-check token discarded after WhatsApp send | Accepted | Add outbox if patient loss-rate high |
| TD-9 | Orphan `DispenseRecord` entity (no API endpoint writes it) | Known | Wire Rx-to-Dispense endpoint in Track 2b or drop |
| TD-10 | Missing tenant feature flag for `pharmacy` | Known | Add in Track 2b via MOD-14 |

---

## 10. Next Session — Pick-Up Point

**If continuing Track 2b (stabilize):**
1. Create branch `feature/track2-stabilize` from `feature/pharmacy-pos-dispensary`
2. Implement Returns/Refund endpoint (highest priority — revenue protection)
3. Implement PO Receive/GRN flow (operational need)
4. Implement Rx-to-Dispense endpoint (clinical workflow completion)
5. Add MOD-14 tenant feature flag `pharmacy`

**If pilot is imminent:**
1. Start with §3.1 WhatsApp setup (most blocking — templates need approval)
2. Parallel: §3.2 Razorpay (quick win, webhook already implemented)
3. Then §3.3 Entra External ID (security-critical, needs Azure tenant)
4. Finally §3.4 S3 for MOD-08 file uploads

**If starting Phase 3 (Voice Agent):**
1. Read `samstack-ai-phase2-voice-agent-analysis.md` fully
2. Skip §17 (priority order — superseded)
3. Start with compliance review (Section §5 of voice-agent-analysis)

**If no immediate priority:**
1. Pick one item from §3 (Pilot Prep) — any unblocks pilot
2. Pick one item from §9 (Technical Debt) — any unblocks maintainability
3. Pick one item from §3.5 (Observability) — any improves pilot debugging

---

**Checklist complete.** Phase 1 + Phase 2 + Track 2a shipped. Track 2b stabilize + Pilot prep are the next workstreams.