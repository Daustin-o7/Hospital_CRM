# SAMSTACK AI — Auth Design & Phase 1 Information Architecture (v0.1)

**Companion to:** samstack-ai-strategy-v0.5.md · **Scope:** Track 1 (CRM+Billing), Phase 1, India adapter

---

## 1. JWT — Confirmed

Yes, and it fits this architecture specifically well: the modular monolith plus 3 peeled-out services (§4 of the strategy doc) plus eventual Dedicated-Instance tenants (§3.1 Tier 3) all need to verify tokens independently, without a shared session store.

| Decision | Choice | Why |
|---|---|---|
| Token type | JWT access token + refresh token (OAuth2/OIDC), issued by Duende IdentityServer / Azure Entra External ID (already in §6 tech stack) | Standard, and both integrate cleanly with .NET 10 |
| Signing | **RS256** (asymmetric), not HS256 | Every service — including a client's own Dedicated Instance infra, which we may not fully control — can verify with a public key without ever holding the signing secret. Non-negotiable once Tier 3 exists. |
| Access token lifetime | ~15 minutes | Small blast radius if a token leaks |
| Refresh token | 7–30 days, httpOnly+secure cookie, **rotated on every use** | Rotation makes replay of a stolen old refresh token detectable |
| Revocation | Redis-backed deny-list, checked at the API Gateway (YARP), only for high-stakes events (logout-everywhere, password reset, staff offboarding, suspected compromise) | JWTs can't be un-issued before expiry; a short-lived deny-list is the cheap fix |
| Claims | `sub` (user id), `tenant_id`, `role`, `region` (India/UAE — routes to the right §3.3 adapter), optional `permissions[]` | `tenant_id` is what every downstream query filters on — it's the actual enforcement mechanism behind the row-level security in §3.1 |
| MFA | Enforced for Clinic Admin, Developer/Platform Admin, Doctor. Optional for Receptionist/Pharmacist. | DPDP-covered data justifies it for the roles with the most access; front-desk friction stays low |

---

## 2. Login Modes / Roles

| Role | Who | `role` claim | Notes |
|---|---|---|---|
| **Developer / Platform Admin** | SAMSTACK team only | `platform_admin` | Separate portal (`admin.samstack.ai`), never exposed to tenants. Cross-tenant access for support/provisioning. MFA + IP-allowlist. Every action, especially impersonate-for-support, is audit-logged. |
| **Clinic Admin** | The doctor/owner who bought it, or their manager | `clinic_admin` | Tenant settings, branding, staff accounts, our subscription billing |
| **Doctor** | Clinical staff | `doctor` | Patients, EMR, prescriptions, appointments, lab orders |
| **Receptionist** | Front-desk | `receptionist` | Registration, appointment booking, basic billing — no clinical notes access |
| **Pharmacist** | Track 2 only | `pharmacist` | Dispensing, stock, POS — role doesn't exist unless Pharmacy is activated for that tenant |
| **Nurse** | Track 4 (Phase 5) | `nurse` | Doesn't exist until IPD ships |

**Open design call:** the requirement list only asked for WhatsApp-based patient contact (reminders, booking), not a patient login/portal. Adding one is a real second auth surface — recommend holding it out of Phase 1 unless you specifically want it now.

---

## 3. Phase 1 — Data Models & Pages, by Module

Counting only what Phase 1 actually needs (Patients, Appointments, EMR, Billing, WhatsApp, Wishlist, plus Identity/Admin scaffolding). Lab, Inventory, and Pharmacy get this same exercise when their phase starts.

| Module | Data models (EF Core entities) | Pages/screens |
|---|---|---|
| Identity & Access | User, Role, StaffInvite, MfaDevice *(4)* | Login, MFA verify, Forgot/reset password, Staff invite–accept, Account settings *(5)* |
| Tenant/Clinic Admin | Tenant, TenantBranding, WorkingHours, SubscriptionPlan *(4)* | Clinic setup wizard, Staff management, Clinic settings, Subscription/billing *(4)* |
| Patients/Registration | Patient, ConsentRecord, EmergencyContact *(3)* | Patient list/search, New registration, Patient profile (tabbed) *(3)* |
| Appointments | Appointment, DoctorAvailability, QueueToken *(3)* | Calendar/schedule, New appointment, Appointment detail/edit, Queue/waiting-room display *(4)* |
| Treatment/EMR | Encounter, Diagnosis, Prescription, PrescriptionItem, Vitals *(5)* | Consultation screen, Treatment history timeline, Prescription view/print *(3)* |
| Billing & Payments | Invoice, InvoiceLineItem, Payment, GatewayTransaction *(4)* | Invoice creation, Invoice list/search, Payment collection, Outstanding-dues report *(4)* |
| Notification/WhatsApp | NotificationRule, MessageTemplate, NotificationLog *(3)* | Reminder rules config, Message templates, Notification log *(3)* |
| Wishlist | WishlistItem *(1)* | Wishlist list, New/edit item *(2)* |
| **Total** | **27 models** | **28 pages** |

Plus the **Platform Admin portal** (separate small app, not counted above since it's not tenant-facing): tenant list/search, tenant detail (config + activated tracks), impersonate-for-support, feature-flag toggles, system health dashboard — **~5 pages**, reusing the Tenant model rather than adding new ones.

A few of the 28 are dialogs/modals rather than full routed pages (e.g., new/edit forms often overlay the list view) — the count is a build-size signal, not a strict page-by-page nav map.

---

### Next
This is FRD-depth detail for Track 1 alone. Once you're happy with this shape, the natural next step is either (a) the same exercise for Track 2 (Pharmacy) when its phase comes up, or (b) starting the actual PRD/FRD write-up using this as the page inventory.
