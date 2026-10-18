# SAMSTACK Hospital CRM — Mobile Application Master Blueprint & Phase 1 Implementation Plan

> **Document Version:** 4.0 (Phase 1 Core Scope — Grounded & Implementation-Ready)  
> **Status:** Authoritative Mobile Specification & Gated Delivery Plan  
> **Scope:** **Phase 1 (FR-01 – FR-22)** — Core OPD, Identity, Appointments, Clinical Consultation, Billing & Offline Sync  
> **Pre-requisite Gate (Step 0):** Option-0 PWA + Web Push validation on 2–3 physical devices in live OPD before native packaging  
> **Core Architecture:** One Unified .NET 10 Backend + Shared PostgreSQL 16 + Typesense 8.5.0 Gateway Search + Capacitor 6 Bridge + React 19 Core  

---

## Table of Contents

1. [Gating Discipline & Step 0 Validation](#1-gating-discipline--step-0-validation)
   - 1.1 [Product Reality & Hardware Environment](#11-product-reality--hardware-environment)
   - 1.2 [Step 0: The Option-0 PWA + Web Push Validation Gate](#12-step-0-the-option-0-pwa--web-push-validation-gate)
   - 1.3 [The Evidence-Gated Native Mobile Decision](#13-the-evidence-gated-native-mobile-decision)
   - 1.4 [Strict Scope Boundaries (What NOT to Build in Mobile v1)](#14-strict-scope-boundaries-what-not-to-build-in-mobile-v1)
   - 1.5 [Truthful Compliance & Security Governance](#15-truthful-compliance--security-governance)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
   - 2.1 [Unified Multi-Client Topology (One Backend, Multiple Clients)](#21-unified-multi-client-topology-one-backend-multiple-clients)
   - 2.2 [Persona Roles & Access Control (Phase 1 RBAC)](#22-persona-roles--access-control-phase-1-rbac)
   - 2.3 [Multi-Tenancy & Cryptographic Security](#23-multi-tenancy--cryptographic-security)
3. [Typesense Mobile Search Engine & Patient Disambiguation Pipeline](#3-typesense-mobile-search-engine--patient-disambiguation-pipeline)
   - 3.1 [Proxy-Through-Gateway Security (Zero Client Keys)](#31-proxy-through-gateway-security-zero-client-keys)
   - 3.2 [Phone-First Query Routing & Fuzzy Name Matching](#32-phone-first-query-routing--fuzzy-name-matching)
   - 3.3 [Composite Patient Disambiguation Mobile UX](#33-composite-patient-disambiguation-mobile-ux)
   - 3.4 [Duplicate Prevention Bottom Sheet (FR-06)](#34-duplicate-prevention-bottom-sheet-fr-06)
   - 3.5 [Non-Blocking Write-Through & Nightly Hangfire Repair Job](#35-non-blocking-write-through--nightly-hangfire-repair-job)
4. [Drug Directory Architecture: Free Cloud Hosting + Local LRU Caching](#4-drug-directory-architecture-free-cloud-hosting--local-lru-caching)
   - 4.1 [The 4.5-Lakh Catalog Constraint on 2GB RAM Devices](#41-the-45-lakh-catalog-constraint-on-2gb-ram-devices)
   - 4.2 [Free Cloud Hosting Options (Typesense Self-Hosted vs. Cloudflare D1)](#42-free-cloud-hosting-options-typesense-self-hosted-vs-cloudflare-d1)
   - 4.3 [Client-Side LRU Frequent/Recent Cache Protocol (<500 KB RAM)](#43-client-side-lru-frequentrecent-cache-protocol-500-kb-ram)
5. [Native Hardware Bridges & OS Integration](#5-native-hardware-bridges--os-integration)
   - 5.1 [Bluetooth ESC/POS Thermal Printing Engine (58mm & 80mm)](#51-bluetooth-escpos-thermal-printing-engine-58mm--80mm)
   - 5.2 [Aadhaar Biometric RD Service (Compliance & Legal Review Gate)](#52-aadhaar-biometric-rd-service-compliance--legal-review-gate)
   - 5.3 [Camera-Based QR & Token Scanner](#53-camera-based-qr--token-scanner)
   - 5.4 [Multi-Staff PIN Quick Switch with FR-01 Lockout Protection](#54-multi-staff-pin-quick-switch-with-fr-01-lockout-protection)
6. [Deterministic Offline-First Replication Engine (FR-22 Spec)](#6-deterministic-offline-first-replication-engine-fr-22-spec)
   - 6.1 [Scope of Offline Operations (Registration & Billing Only)](#61-scope-of-offline-operations-registration--billing-only)
   - 6.2 [Local SQLite Store & Outbox Mutation Pipeline](#62-local-sqlite-store--outbox-mutation-pipeline)
   - 6.3 [Client-Side Idempotency Keys & Server-Wins Conflict Resolution](#63-client-side-idempotency-keys--server-wins-conflict-resolution)
7. [Phase 1 Mobile Implementation Matrix (FR-01 – FR-22)](#7-phase-1-mobile-implementation-matrix-fr-01--fr-22)
8. [Backend API Contracts for Mobile Clients](#8-backend-api-contracts-for-mobile-clients)
9. [Delivery Plan, Target SLAs & Risk Register](#9-delivery-plan-target-slas--risk-register)

---

## 1. Gating Discipline & Step 0 Validation

### 1.1 Product Reality & Hardware Environment
* **Hardware Environment:** Front desks and consultation tables in target OPD clinics operate on **entry-level Android devices and budget 8–10" tablets (2GB–4GB RAM)** paired with **portable 58mm/80mm Bluetooth thermal receipt printers**.
* **Clinical OPD Velocity:** Doctors see **30–60 patients in a 3-hour shift (~3–4 minutes per patient)**. UI inputs must be thumb-accessible, 1-tap chip driven, and zero-latency.
* **Connectivity Reality:** Intermittent cellular and clinic Wi-Fi drops require **offline tolerance for registration and billing (FR-22)** so clinic queues never stall.

---

### 1.2 Step 0: The Option-0 PWA + Web Push Validation Gate
Before scaffolding native Capacitor or React Native container code, the team must execute **Step 0 (Option-0 Validation)**:

```
+-----------------------------------------------------------------------------------+
|                        STEP 0: OPTION-0 PWA VALIDATION GATE                       |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  1. Deploy existing React 19 PWA with Service Worker + Web Push to 2-3 real test  |
|     devices (budget 2GB-4GB RAM Android phone + 10" tablet) in active clinic.    |
|                                                                                   |
|  2. Measure 14-day field performance:                                             |
|     - Does Web Bluetooth print reliably to 58mm/80mm ESC/POS printers?           |
|     - Does Web Push deliver notifications when app tab is backgrounded?           |
|     - Does IndexedDB offline registration handle sudden disconnects cleanly?      |
|                                                                                   |
|  3. Decision Gate:                                                                |
|     - IF PWA meets 100% of operational needs -> SHIP AS PWA (zero app store debt).|
|     - IF Web Bluetooth/Background sync fails -> PROCEED to Capacitor 6 container. |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

### 1.3 The Evidence-Gated Native Mobile Decision
Per project architectural standards, native mobile packaging is **strictly evidence-gated**:
* Native code is justified **only** by hardware peripherals (background Bluetooth thermal printing, hardware biometric unlock) and background sync limitations in mobile browsers.
* **One Backend, Multiple Clients:** Mobile clients consume the exact same .NET 10 Minimal APIs, RS256 JWT auth, role validation, and PostgreSQL database as the web application.

---

### 1.4 Strict Scope Boundaries (What NOT to Build in Mobile v1)
To ensure delivery velocity and eliminate speculative technical debt, the mobile v1 scope is strictly limited to **Phase 1 (FR-01 – FR-22)**:

| Feature / Module | Status in Mobile v1 | Rationale |
|---|---|---|
| **Track 2 Pharmacy (MOD-15–17)** | ❌ **CUT** | Not yet shipped on web; mobile cannot front-run web backend. |
| **Track 3 Voice AI / Ambient Scribe** | ❌ **CUT** | Phase 3 scope; not part of core OPD Phase 1. |
| **Track 4 Inpatient / IPD (MOD-20–26)** | ❌ **CUT** | Out of scope per master FRD §5.2. |
| **International Adapter (UAE/NABIDH)** | ❌ **CUT** | Out of scope for domestic Phase 1 release. |
| **ABDM M2 (HIP) & M3 (HIU)** | ❌ **CUT** | Requires 8–12 week build + government sandbox & production audit. |
| **ABDM M1 (ABHA Verification)** | ⏸️ **Future Roadmap** | Kept on roadmap post-Phase 1 pilot validation. |

---

### 1.5 Truthful Compliance & Security Governance
* **Truthful Compliance Messaging:** Never claim unobtained government certifications. Accurate copy: *"Designed with DPDP-aware explicit consent, immutable audit logging, role-based access control, and AES-256 / TLS 1.3 encryption."*
* **Single Tenant Scoping:** Every database table, Typesense search index, and SQLite local table carries `tenant_id` (dormant in single-tenant Phase 1, ready for multi-tenant migration).

---

## 2. End-to-End System Architecture

### 2.1 Unified Multi-Client Topology (One Backend, Multiple Clients)

```
+---------------------------------------------------------------------------------------------------+
|                            SAMSTACK UNIFIED MOBILE ARCHITECTURE                                   |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|   +-------------------------------------------------------------------------------------------+   |
|   |                              STAFF MOBILE SHELL (PHASE 1)                                 |   |
|   |   - Doctor View: Queue Triage, 1-Tap Prescription, Timeline History, Clinical Notes       |   |
|   |   - Front Desk View: 10-Sec Registration, Typesense Search, Queue, Invoice & BT Receipt  |   |
|   +-------------------------------------------------------------------------------------------+   |
|                                                |                                                  |
|   +-------------------------------------------------------------------------------------------+   |
|   |                               REACT 19 MOBILE CORE LAYER                                  |   |
|   |   - Tailwind CSS v4 Mobile Tokens     - React Hook Form + Zod Validation                  |   |
|   |   - Typesense Gateway Search Client   - FR-22 Offline Outbox & Local SQLite Store         |   |
|   +-------------------------------------------------------------------------------------------+   |
|                                                |                                                  |
|   +-------------------------------------------------------------------------------------------+   |
|   |                         CAPACITOR 6 NATIVE HARDWARE BRIDGE LAYER                          |   |
|   |   +-----------------------+ +-------------------------+ +-----------------------------+   |   |
|   |   | @capacitor/bluetooth  | | @capacitor/barcode-scan | | @capacitor/biometrics       |   |   |
|   |   | ESC/POS 58/80mm Print | | Camera QR Scanner       | | Hardware Quick Switch       |   |   |
|   |   +-----------------------+ +-------------------------+ +-----------------------------+   |   |
|   |   +-----------------------+ +-------------------------+                                   |   |
|   |   | @capacitor/sqlite     | | @capacitor/push-fcm     |                                   |   |
|   |   | Offline Outbox Queue  | | Background Alerts       |                                   |   |
|   |   +-----------------------+ +-------------------------+                                   |   |
|   +-------------------------------------------------------------------------------------------+   |
|                                                |                                                  |
|                                    HTTPS / TLS 1.3 (Bearer JWT)                                   |
|                                                v                                                  |
|   +-------------------------------------------------------------------------------------------+   |
|   |                                 .NET 10 BACKEND GATEWAY                                   |   |
|   |   - Minimal APIs & YARP Gateway       - Typesense 8.5.0 Engine (Port 8108)                |   |
|   |   - PostgreSQL 16 (Audit Tables)      - Hangfire Recurring Reindex Workers                |   |
|   +-------------------------------------------------------------------------------------------+   |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

### 2.2 Persona Roles & Access Control (Phase 1 RBAC)
Per `UserRole` enum in `Hospital_CRM.Domain.Enums`, the active Phase 1 roles are strictly:
1. `ClinicAdmin` — Clinic management, staff accounts, fee structures, financial reports.
2. `Doctor` — Queue triage, clinical notes (FR-14), prescriptions (FR-15), patient history.
3. `Receptionist` — Patient registration (FR-06), appointments (FR-10/11), billing & payments (FR-17/18).
4. `PlatformAdmin` — Infrastructure and multi-clinic support.

*(Note: `Pharmacist` and other future roles are deferred until their respective tracks commence).*

---

### 2.3 Multi-Tenancy & Cryptographic Security
* **JWT RS256 Authentication:** Tokens signed with asymmetric RS256 key; verified server-side.
* **Zero Client Keys:** Typesense API keys, Razorpay secrets, and database credentials **never** exist on the mobile client.
* **Audit Immutability (FR-08):** All patient demographic updates and bill edits produce append-only audit entries.

---

## 3. Typesense Mobile Search Engine & Patient Disambiguation Pipeline

### 3.1 Proxy-Through-Gateway Security (Zero Client Keys)
* Mobile apps query `GET /api/v1/patients/search?q=...` and `POST /api/v1/patients/check-duplicate`.
* The .NET 10 backend extracts the caller's `tenant_id`, enforces server-side role validation, applies `filter_by: tenant_id:={tenantId}`, and forwards to Typesense container (Port 8108).
* **Automatic PostgreSQL Fallback:** If Typesense is offline or restarting, the backend transparently executes `EF.Functions.ILike` queries against PostgreSQL, ensuring 100% search uptime.

---

### 3.2 Phone-First Query Routing & Fuzzy Name Matching
1. **Numeric Queries (Digits detected, len ≥ 3):**
   * Target fields: `phone,name` with `num_typos = 0` (Exact matching on phone digits prevents cross-patient misidentification).
2. **Text Queries (Letters detected):**
   * Target fields: `name,phone` with `num_typos = 2` (Tolerates common Indian name spelling variations).
3. **Sort Order:** `created_at:desc` prioritizes active clinic patients.

---

### 3.3 Composite Patient Disambiguation Mobile UX
To eliminate duplicate file creation when patients share common names, the search bar renders a composite 48px touch card:

```
+-----------------------------------------------------------------+
| 🔍 [ 9826                                                     ] |
+-----------------------------------------------------------------+
| ┌─────────────────────────────────────────────────────────────┐ |
| │ [RS] Ramesh Sharma (45M)                   [•••• 9826]      │ |
| │      DOB: 12-Jun-1981 | City: Bhopal       [Open Chart →]   │ |
| ├─────────────────────────────────────────────────────────────┤ |
| │ [RK] Ramesh Kumar (32M)                    [•••• 9826]      │ |
| │      DOB: 05-Apr-1994 | City: Sehore       [Open Chart →]   │ |
| └─────────────────────────────────────────────────────────────┘ |
+-----------------------------------------------------------------+
```

---

### 3.4 Duplicate Prevention Bottom Sheet (FR-06)
When a receptionist submits a new patient registration:
1. App calls `POST /api/v1/patients/check-duplicate` (checking name similarity + phone/DOB).
2. If duplicate candidates exist, a bottom-sheet modal presents existing matches.
3. Receptionist has two explicit actions:
   * **Use Existing Chart:** Loads the existing patient profile directly.
   * **Proceed as New Patient:** Creates a distinct patient with a unique UHID.

---

### 3.5 Non-Blocking Write-Through & Nightly Hangfire Repair Job
* **Non-Blocking Indexing:** Registration and patch endpoints update PostgreSQL first, then fire non-blocking background index tasks to Typesense.
* **Nightly Hangfire Job (`02:00 AM`):** `typesense-nightly-patient-reindex` scans PostgreSQL and bulk-upserts all patients into Typesense, repairing any missed write-through events.

---

## 4. Drug Directory Architecture: Free Cloud Hosting + Local LRU Caching

### 4.1 The 4.5-Lakh Catalog Constraint on 2GB RAM Devices
Downloading the full national drug dictionary (~450,000 items, ~45MB JSON / ~60MB SQLite) onto budget front-desk phones (2GB–4GB RAM) causes app slowdowns and excessive memory consumption.

---

### 4.2 Free Cloud Hosting Options (Zero-Cost Online Search)

We have two primary zero-cost options for hosting and querying the national drug catalog:

| Option | Infrastructure | Storage & Quota | Speed | Maintenance |
|---|---|---|---|---|
| **Option A (Recommended): Self-Hosted Typesense Container** | Existing `docker-compose` stack (`Hospital_CRM.Api`) | Runs in existing server memory (~100MB RAM for 450k docs) | `<10ms` local network | Zero extra config; keeps data sovereign |
| **Option B: Cloudflare D1 + Worker (Serverless Edge)** | Cloudflare Free Tier | 5GB storage, 5M reads/month, 100k requests/day FREE | `<15ms` global edge | Deploy a 20-line serverless worker at `drugs.samstack.ai` |
| **Option C: Serverless PostgreSQL (Neon / Supabase)** | Neon Free Tier (0.5GB DB) | Free PostgreSQL `pg_trgm` fuzzy search | `<30ms` cloud | Simple SQL schema |

**Recommended Path:** Host the `medicines` collection directly on the self-hosted Typesense instance already in docker-compose. Zero additional subscriptions, zero egress costs.

---

### 4.3 Client-Side LRU Frequent/Recent Cache Protocol (<500 KB RAM)

Instead of caching the full dictionary locally, the mobile app uses a **2-Tier Intelligent Cache**:

```
+-----------------------------------------------------------------------------------+
|                        2-TIER DRUG SEARCH & LRU CACHE PROTOCOL                    |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  Doctor types "Para..."                                                           |
|       │                                                                           |
|       ▼                                                                           |
|  [ Step 1: Local SQLite `frequent_medicines` Table (<500 KB) ]                    |
|       │ Contains: Top 200 clinic medicines + last 50 doctor-prescribed items      |
|       │                                                                           |
|       ├──► Match found? ──► Instant 0ms dropdown display                          |
|       │                                                                           |
|       └──► No match / <3 matches? ──► Debounced 150ms Cloud Search                |
|                                             │                                     |
|                                             ▼                                     |
|  [ Step 2: Query Cloud /api/v1/medicines/search (Typesense / Cloudflare D1) ]     |
|       │ Returns matched drug items from 4.5L database                             |
|       │                                                                           |
|       ▼                                                                           |
|  [ Step 3: Doctor selects medicine ]                                              |
|       │                                                                           |
|       ▼                                                                           |
|  [ Auto-Upsert to Local SQLite ] ───────────────────────────────────────────────┐ |
|    - Increments `frequency_count` for selected drug                             │ |
|    - Updates `last_prescribed_at = NOW()`                                       │ |
|    - Keeps local cache fresh and intelligent for offline OPD use                ▼ |
|                                                                     [Local Cache] |
+-----------------------------------------------------------------------------------+
```

---

## 5. Native Hardware Bridges & OS Integration

### 5.1 Bluetooth ESC/POS Thermal Printing Engine (58mm & 80mm)
Direct raw byte streaming over Bluetooth SPP (Android) / BLE (iOS) for rapid receipt and token printing:
* Generates standard ESC/POS binary buffers (text, alignment, bold, QR code, paper cut).
* Design Target SLA: Thermal receipt prints in **< 1.0s** from button tap.

---

### 5.2 Aadhaar Biometric RD Service (Compliance & Legal Review Gate)
> [!IMPORTANT]
> **Legal & Compliance Gate:** Integration of UIDAI RD Service (Mantra / Morpho fingerprint capture) requires formal **UIDAI AUA/KUA registration and compliance approval**.
> * Scaffolding or shipping Aadhaar biometric authentication code is deferred until legal compliance authorization is formally cleared.
> * Phase 1 patient registration relies on standard mobile phone number verification and photo/ID document record.

---

### 5.3 Camera-Based QR & Token Scanner
* Utilizes device camera with hardware autofocus for reading patient queue tokens and receipt verification barcodes.

---

### 5.4 Multi-Staff PIN Quick Switch with FR-01 Lockout Protection
To allow fast switching between doctors and receptionists sharing a single clinic tablet:
* Primary login uses full Azure Entra External ID OIDC credentials.
* Quick switching uses a local **4-digit staff PIN** with **FR-01 Security Protection**:
  * **Max Attempts:** 5 consecutive failed attempts.
  * **Lockout Penalty:** 15-minute temporary lockout requiring master password login.
  * **Session Timeout:** 15 minutes of inactivity returns app to PIN lock screen.

---

## 6. Deterministic Offline-First Replication Engine (FR-22 Spec)

### 6.1 Scope of Offline Operations (Registration & Billing Only)
Per FR-22, offline tolerance applies **only to Patient Registration and Billing mutations**, not clinical amendments or past record archives:
* **Allowed Offline:** Registering a walk-in patient, creating an OPD bill / cash receipt.
* **Disallowed Offline:** Amending signed clinical notes or modifying historical billing ledger entries.

---

### 6.2 Local SQLite Store & Outbox Mutation Pipeline
```
+-----------------------------------------------------------------------------------+
|                        FR-22 OFFLINE MUTATION & REPLICATION                       |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ Front Desk: Register Patient / Collect Cash ]                                  |
|       │                                                                           |
|       ▼                                                                           |
|  [ Generate Client UUID Idempotency Key: `IDEMP-PAT-{UUID}` ]                     |
|       │                                                                           |
|       ▼                                                                           |
|  [ Write to Local SQLite `patients` + `outbox_mutations` (status = 'pending') ]   |
|       │                                                                           |
|       ▼                                                                           |
|  [ Network Restored ] ──► Background Worker pulls pending outbox mutations        |
|                                 │                                                 |
|                                 ▼                                                 |
|  [ POST /api/v1/sync/push ] ──► Server checks idempotency table                   |
|                                 │ - If new: inserts record                        |
|                                 │ - If duplicate: returns 200 with existing ID    |
|                                 ▼                                                 |
|  [ Server Acknowledged ]  ──► Mark outbox mutation 'synced' in local SQLite       |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

### 6.3 Client-Side Idempotency Keys & Server-Wins Conflict Resolution
* **Idempotency Guarantee:** Every registration and invoice generated offline receives a UUID v4 idempotency key before local persistence.
* **Conflict Resolution Strategy:**
  * **Demographic Data:** Last-write-wins based on UTC timestamp.
  * **Clinical & Billing Data:** Server-wins (server records are immutable; offline conflicts trigger review notifications).

---

## 7. Phase 1 Mobile Implementation Matrix (FR-01 – FR-22)

| Requirement | Module | Mobile Capability |
|---|---|---|
| **FR-01 – FR-04** | Authentication & RBAC | OIDC login, 4-digit PIN switch, FR-01 brute-force lockout. |
| **FR-05** | Clinic Profile | Clinic timings, consultation fee configuration. |
| **FR-06 – FR-08** | Patient Management | Typesense search, duplicate prevention bottom sheet, audit logging. |
| **FR-09** | DPDP Consent | Touchscreen explicit consent capture. |
| **FR-10 – FR-13** | Appointments & Queue | OPD queue management, status updates (Waiting / In-Consultation / Done). |
| **FR-14 – FR-16** | Clinical EMR & Rx | Rapid 1-tap prescription builder, medical history timeline. |
| **FR-17 – FR-19** | Billing & Receipts | Razorpay UPI QR, cash payment recording, Bluetooth thermal receipt printing. |
| **FR-20 – FR-21** | Messaging & Reminders | WhatsApp notification status monitoring. |
| **FR-22** | Offline Tolerance | SQLite local outbox and idempotent synchronization. |

---

## 8. Backend API Contracts for Mobile Clients

| Endpoint | Method | Role Required | Description |
|---|---|---|---|
| `/api/v1/patients/search?q={query}` | `GET` | All Roles | Composite Typesense search with PostgreSQL fallback. |
| `/api/v1/patients/check-duplicate` | `POST` | `ClinicAdmin`, `Doctor`, `Receptionist` | Demographic duplicate candidate check. |
| `/api/v1/patients` | `POST` | `ClinicAdmin`, `Doctor`, `Receptionist` | Patient registration with idempotency key. |
| `/api/v1/appointments` | `GET`, `POST` | All Roles | Queue and appointment scheduling. |
| `/api/v1/consultations` | `POST` | `Doctor` | Save consultation note and prescription. |
| `/api/v1/invoices` | `POST` | `ClinicAdmin`, `Receptionist` | Generate invoice and record payment. |
| `/api/v1/sync/push` | `POST` | `ClinicAdmin`, `Receptionist` | Flush offline mutation outbox to server. |

---

## 9. Delivery Plan, Target SLAs & Risk Register

### 9.1 Design Target SLAs
The mobile application architecture is designed against the following performance targets:

* **Cold Start Time:** Target `< 1.5s` on 2GB RAM budget Android devices.
* **Patient Search Response:** Target `< 100ms` (Typesense) / `< 250ms` (DB Fallback).
* **Thermal Receipt Printing:** Target `< 1.0s` from button tap to physical paper feed.
* **Offline Sync Queue Flush:** Target `< 3.0s` for 20 queued mutations upon reconnect.

---

### 9.2 3-Stage Delivery Schedule

```
+-----------------------------------------------------------------------------------+
|                           PHASE 1 MOBILE DELIVERY SCHEDULE                        |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  STAGE 0: PWA Validation (Weeks 1–2)                                              |
|  - Deploy React 19 PWA to 2–3 physical test devices in live clinic.               |
|  - Validate Web Bluetooth printing & offline IndexedDB sync under real OPD load.  |
|                                                                                   |
|  STAGE 1: Capacitor Packaging & Hardware Bridges (Weeks 3–5)                     |
|  - Capacitor 6 shell setup (Android / iOS).                                       |
|  - Native Bluetooth ESC/POS thermal printing plugin integration.                  |
|  - SQLite offline outbox replication with idempotency testing.                    |
|                                                                                   |
|  STAGE 2: Polish, Field Testing & Pilot Sign-Off (Weeks 6–8)                      |
|  - Quick PIN staff switching with 5-attempt brute-force lockout.                  |
|  - Typesense search disambiguation and duplicate warning sheet.                   |
|  - End-to-end 3-clinic live pilot validation.                                     |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

### 9.3 Production Risk Register & Mitigation Strategy

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Low-End Device Memory Exhaustion (2GB RAM)** | App crash during OPD | Never store full 4.5L drug dictionary locally. Bound SQLite cache to top 200 + 50 recent items (<500 KB). |
| **Bluetooth Thermal Printer Disconnects** | Failed receipts | Auto-reconnect background retry queue; store printable byte stream in SQLite until printed. |
| **Network Drops During Walk-In Spike** | Queue disruption | FR-22 client-side UUID idempotency keys allow uninterrupted offline registration and billing. |
| **Typesense Outage / Maintenance** | Search failure | Transparent backend fallback to PostgreSQL ILIKE queries ensures zero search downtime. |
