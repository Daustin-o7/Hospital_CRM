# SAMSTACK Hospital CRM — ABDM Full Integration Plan, Strategic Synthesis & Compliance Architecture (M1 + M2 + M3)

> **Document Status:** Authoritative Master Reference Plan (Strategic & Technical Architecture)  
> **Product:** Hospital CRM by Samstack (Doctor / Clinic CRM)  
> **Stack:** .NET 10 (ASP.NET Core, C# 14) + React 19 + PostgreSQL 16 + Hangfire + Capacitor 6 Hybrid  
> **Author:** Samstack Engineering & Product Strategy  
> **Last Updated:** September 2026  
> **Associated Specs:** `FRD_FINAL.md`, `WORKFLOW.md`, `samstack-ai-strategy-v0.5.md`, `samstack-ai-v2-sharpened-plan.md`, `Mobile-Application-Plan.md`, `CHECKLIST.md`

---

## Table of Contents

1. [Strategic Context, Business Model & Market Positioning](#1-strategic-context-business-model--market-positioning)
   - 1.1 [The Digital Health Incentive Scheme (DHIS) Business Engine](#11-the-digital-health-incentive-scheme-dhis-business-engine)
   - 1.2 [Competitive Moat & Incumbent Reality Check](#12-competitive-moat--incumbent-reality-check)
   - 1.3 [Discovery Survey Validation & Target Segment](#13-discovery-survey-validation--target-segment)
   - 1.4 [International Regulatory Roadmap: ABDM (India) ↔ NABIDH (UAE)](#14-international-regulatory-roadmap-abdm-india--nabidh-uae)
2. [ABDM Ecosystem Overview & Architecture](#2-abdm-ecosystem-overview--architecture)
   - 2.1 [Core Participants & Roles](#21-core-participants--roles)
   - 2.2 [System Boundary & Cross-Module Topology](#22-system-boundary--cross-module-topology)
3. [Cross-Module Integration Matrix](#3-cross-module-integration-matrix)
   - 3.1 [MOD-03 Patient Registration (FR-06)](#31-mod-03-patient-registration-fr-06)
   - 3.2 [MOD-23 Pre-Check Intake & MOD-25 Live Ticket Queue](#32-mod-23-pre-check-intake--mod-25-live-ticket-queue)
   - 3.3 [MOD-05 EMR & MOD-12 Specialty Templates (Dental, Ayurveda, General)](#33-mod-05-emr--mod-12-specialty-templates-dental-ayurveda-general)
   - 3.4 [MOD-08 Lab Records](#34-mod-08-lab-records)
   - 3.5 [Track 2 Pharmacy POS & Compliance (MOD-15/16)](#35-track-2-pharmacy-pos--compliance-mod-1516)
4. [Mobile & Native Hardware Bridges (Capacitor Integration)](#4-mobile--native-hardware-bridges-capacitor-integration)
   - 4.1 [UIDAI RD Service Android Intent Bridge (Mantra/Morpho Biometrics)](#41-uidai-rd-service-android-intent-bridge-mantramorpho-biometrics)
   - 4.2 [CameraX / ML Kit ABDM Scan & Share Scanner](#42-camerax--ml-kit-abdm-scan--share-scanner)
   - 4.3 [Bluetooth ESC/POS Physical ABHA & Token Printing](#43-bluetooth-escpos-physical-abha--token-printing)
   - 4.4 [Offline-First Sync Resilience (FR-22)](#44-offline-first-sync-resilience-fr-22)
5. [Milestone 1 — ABHA Identity (M1)](#5-milestone-1--abha-identity-m1)
   - 5.1 [Enrollment & Verification Flows](#51-enrollment--verification-flows)
   - 5.2 [NHA V3 API Contract](#52-nha-v3-api-contract)
   - 5.3 [RSA PII Encryption Engine](#53-rsa-pii-encryption-engine)
6. [Milestone 2 — Health Information Provider / HIP (M2)](#6-milestone-2--health-information-provider--hip-m2)
   - 6.1 [Care Context Life Cycle](#61-care-context-life-cycle)
   - 6.2 [Async Callback Execution Model](#62-async-callback-execution-model)
   - 6.3 [Gateway Webhook Specification](#63-gateway-webhook-specification)
7. [Milestone 3 — Health Information User / HIU (M3)](#7-milestone-3--health-information-user--hiu-m3)
   - 7.1 [Consent Request & Approval Workflow](#71-consent-request--approval-workflow)
   - 7.2 [Encrypted Data Pull & Ingestion](#72-encrypted-data-pull--ingestion)
8. [Fidelius Cryptographic Engine](#8-fidelius-cryptographic-engine)
   - 8.1 [ECDH Key Exchange (Curve25519)](#81-ecdh-key-exchange-curve25519)
   - 8.2 [HKDF Derivation & AES-GCM-256](#82-hkdf-derivation--aes-gcm-256)
9. [FHIR R4 Bundle Architecture (NRCeS Profiles)](#9-fhir-r4-bundle-architecture-nrces-profiles)
   - 9.1 [OP Consultation Record](#91-op-consultation-record)
   - 9.2 [Prescription Record](#92-prescription-record)
   - 9.3 [Diagnostic Report & Lab Record](#93-diagnostic-report--lab-record)
   - 9.4 [Specialty & AYUSH Codification (SNOMED, ICD-10, NAMASTE)](#94-specialty--ayush-codification-snomed-icd-10-namaste)
10. [HFR & HPR Registry Integration](#10-hfr--hpr-registry-integration)
11. [Government Compliance, Legal Framework & Security Certification](#11-government-compliance-legal-framework--security-certification)
    - 11.1 [DPDP Act 2023 Alignment & Purpose Consent](#111-dpdp-act-2023-alignment--purpose-consent)
    - 11.2 [CERT-In 6-Hour Incident Reporting](#112-cert-in-6-hour-incident-reporting)
    - 11.3 [CERT-In WASA Security Audit & NHA Sandbox Certification](#113-cert-in-wasa-security-audit--nha-sandbox-certification)
12. [Multi-Tenancy & Key Isolation Hierarchy](#12-multi-tenancy--key-isolation-hierarchy)
13. [Complete Database Schema (PostgreSQL 16)](#13-complete-database-schema-postgresql-16)
14. [Full API Endpoint Inventory](#14-full-api-endpoint-inventory)
15. [Phased Rollout Roadmap & Testing Strategy](#15-phased-rollout-roadmap--testing-strategy)
16. [Risk Register](#16-risk-register)

---

## 1. Strategic Context, Business Model & Market Positioning

### 1.1 The Digital Health Incentive Scheme (DHIS) Business Engine
ABDM compliance is often treated by competing software vendors as a pure regulatory compliance cost. For **SAMSTACK**, it is architected as a **core self-funding sales wedge**.

Under the National Health Authority’s (NHA) **Digital Health Incentive Scheme (DHIS)**:
* Clinics and hospitals receive direct financial payouts for creating and linking digital health records:
  * **₹20 per OPD Registration** via Scan & Share / ABHA verification (above baseline threshold).
  * **₹20 per Lab Report linked** as a FHIR Care Context.
  * **₹20 per Prescription / Teleconsultation linked** via HIP data sharing.
* **Maximum Incentive Cap:** Up to **₹4,00,000 per facility per year** for small-to-mid clinics, and up to **₹50,00,000** for hospitals.

```
+-----------------------------------------------------------------------------------+
|                     SAMSTACK ZERO-COST / NET-POSITIVE PITCH                       |
+-----------------------------------------------------------------------------------+
|  Clinic Subscription (SAMSTACK Flat Rate) : ₹36,000 – ₹60,000 / year              |
|  Average Clinic Volume                    : 30 OPD patients / day (~9,000 / yr)   |
|  Government DHIS Payout @ ₹20 / txn       : ₹1,80,000 / year                      |
|  -------------------------------------------------------------------------------  |
|  NET FINANCIAL BENEFIT TO DOCTOR          : + ₹1,20,000 to + ₹1,44,000 / year     |
+-----------------------------------------------------------------------------------+
```
*By automating Scan & Share and M2 Care Context linking on every encounter, SAMSTACK transforms clinic software from an expense into a guaranteed revenue generator.*

---

### 1.2 Competitive Moat & Incumbent Reality Check
A rigorous competitive audit across the Indian healthcare IT landscape reveals critical differentiators:

| Competitor | Business Model | Strengths | Operational Vulnerability / SAMSTACK Moat |
|---|---|---|---|
| **Cliniqwise** | Flat subscription | Early ABDM M1/M2/M3 marketing, WhatsApp billing | Narrow feature depth; lacks integrated 3-tier inventory, multi-specialty clinical templates, and dedicated multi-doctor hierarchy. |
| **Healthray** | Enterprise HMS | 1,000+ hospitals, 5M+ records, native ABDM | Opaque enterprise pricing ("Request a Quote"), complex heavy UX, zero published self-serve flat tiers, no mobile Bluetooth printing. |
| **Practo Ray** | Marketplace + SaaS | High brand recognition | High marketplace commissions, doctor lock-in, unexported clinical data on exit, lacks deep ABDM incentives. |
| **HealthPlix MD**| Free / Low-cost EMR | Strong mobile prescription pad | **Hard single-doctor limit**; fails 2–15 doctor practices; lacks connected pharmacy and accounting ledger. |
| **Marg ERP** | Desktop Retail ERP | 50%+ of India pharmacy billing, 4.5L drug DB | Legacy download-and-install architecture; zero clinical EMR or ABDM patient health exchange. |

**SAMSTACK’s Defensible Wedge:**  
A unified modular platform tailored specifically for the **2–15 doctor growing practice segment** combining:
1. Native ABDM M1/M2/M3 with automated DHIS incentive tracking.
2. Connected Pharmacy Track 2 (Schedule H/H1 registers + FEFO batch tracking + POS counter).
3. Mobile hardware bridges (Bluetooth thermal printing, Aadhaar biometric RD Service, ML Kit QR).
4. Predictable flat-rate subscription without per-doctor or marketplace taxes.

---

### 1.3 Discovery Survey Validation & Target Segment
Real market validation across clinic discovery interviews (n=24 cohort, `samstack-ai-survey-analysis-v2.md`) confirms:
* **83% Combined ABDM Awareness:** 54% of practitioners are already registered with ABDM/ABHA; 29% are aware but unregistered.
* **Practice Size Distribution:** 67% Solo, 17% 2–5 Doctors, 8% 6–15 Doctors, 8% Hospital.
* **High Pharmacy Attachment:** 62% of surveyed clinics operate an attached dispensary/pharmacy.
* **High Dental & AYUSH Cluster:** Dental (25%), General Medicine (17%), Ayurveda/AYUSH (17%).
* **Top Administrative Pain Points:** Unwanted/mismanaged appointments, patient follow-up drop-offs, and "fear of complex staff onboarding."

---

### 1.4 International Regulatory Roadmap: ABDM (India) ↔ NABIDH (UAE)
To support SAMSTACK's international dual-region strategy (`samstack-ai-strategy-v0.5.md` §3.3), the ABDM architecture is built behind abstract regional interfaces:

```
                      +-----------------------------+
                      |   IHealthExchangeAdapter    |
                      +-----------------------------+
                                     |
                 +-------------------+-------------------+
                 |                                       |
                 v                                       v
   +---------------------------+           +---------------------------+
   |  AbdmHealthExchange (IN)  |           |  NabidhHealthExchange(UAE)|
   +---------------------------+           +---------------------------+
   | - ABHA 14-digit ID        |           | - Emirates ID / Malaffi ID|
   | - HFR & HPR Registries    |           | - NABIDH / DHA Registry   |
   | - NRCeS FHIR R4 Profiles  |           | - NABIDH FHIR R4 Profiles |
   | - Fidelius ECDH Crypto    |           | - TLS 1.3 + AES-GCM-256   |
   | - Azure Central India DB  |           | - Azure UAE North DB (Res)|
   +---------------------------+           +---------------------------+
```
*Both adapters produce standardized FHIR R4 clinical bundles, allowing the core EMR (`MOD-05`), Lab (`MOD-08`), and Pharmacy (`Track 2`) to operate unchanged regardless of geographic deployment.*

---

## 2. ABDM Ecosystem Overview & Architecture

### 2.1 Core Participants & Roles

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             ABDM ECOSYSTEM TOPOLOGY                              │
│                                                                                  │
│    ┌──────────────┐         ┌────────────────────────┐         ┌──────────────┐  │
│    │   Patient    │         │      ABDM Gateway      │         │    Other     │  │
│    │  (ABHA App)  │         │   + Consent Manager    │         │  Hospitals   │  │
│    │  (Aadhaar/PHR│         │       (HIE-CM)         │         │  & Labs(HIP) │  │
│    └──────┬───────┘         └───────────┬────────────┘         └──────┬───────┘  │
│           │                             │                             │          │
│           │   Consent Approval          │   Async Callback Webhooks   │          │
│           │   & PIN Verification        │   (202 Ack + Push Delivery) │          │
│           ▼                             ▼                             ▼          │
│    ┌────────────────────────────────────────────────────────────────────────┐    │
│    │                       HOSPITAL CRM (SAMSTACK)                          │    │
│    │                                                                        │    │
│    │   +------------------+  +------------------+  +--------------------+   │    │
│    │   |   M1: Identity   |  |     M2: HIP      |  |      M3: HIU       |   │    │
│    │   | - Aadhaar OTP    |  | - Care Contexts  |  | - Consent Request  |   │    │
│    │   | - Mobile OTP     |  | - NRCeS FHIR R4  |  | - Encrypted Pull   |   │    │
│    │   | - Scan & Share QR|  | - Gateway Push   |  | - Timeline Ingest  |   │    │
│    │   +------------------+  +------------------+  +--------------------+   │    │
│    │            │                     │                      │              │    │
│    │            ▼                     ▼                      ▼              │    │
│    │   +----------------------------------------------------------------+   │    │
│    │   |             FIDELIUS CRYPTOGRAPHIC ENGINE (ECDH)               |   │    │
│    │   | - Curve25519 Key Exchange   - HKDF Derivation  - AES-GCM-256   |   │    │
│    │   +----------------------------------------------------------------+   │    │
│    │                                                                        │    │
│    │   +----------------------------------------------------------------+   │    │
│    │   |              CORE DATABASE & BACKGROUND WORKERS                │   │    │
│    │   | - PostgreSQL 16 (JSONB) - Hangfire Outbox Workers (Async 202)  │   │    │
│    │   +----------------------------------------------------------------+   │    │
│    └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│    Registries:                                                                   │
│    ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       │
│    │  HFR (Facility) │       │  HPR (Doctor)   │       │ ABHA (Patient)  │       │
│    └─────────────────┘       └─────────────────┘       └─────────────────┘       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Cross-Module Integration Matrix

ABDM integration is not a siloed micro-service; it threads directly across every shipped module in SAMSTACK:

```
+-----------------------------------------------------------------------------------+
|                        MODULE-WIDE ABDM INTERACTION MATRIX                        |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ MOD-03: Patient Registration ] ───► M1: ABHA Linking (Aadhaar / QR / Mobile)   |
|                                                                                   |
|  [ MOD-24/25: Queue & Ticket ]    ───► M1: Scan & Share counter token generation  |
|                                                                                   |
|  [ MOD-23: Pre-Check Form ]       ───► M3: Pull external ABDM records into intake |
|                                                                                   |
|  [ MOD-05/12: Consult & Specialty]───► M2: Generate FHIR OP Consultation Bundle   |
|                                                                                   |
|  [ MOD-08: Lab Records ]          ───► M2: Generate FHIR DiagnosticReport Bundle  |
|                                                                                   |
|  [ Track 2: Pharmacy POS ]        ───► M2: Generate FHIR MedicationDispense Bundle|
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

### 3.1 MOD-03 Patient Registration (FR-06)
* Receptionist clicks **"Scan & Share"** or **"Create ABHA"**.
* Aadhaar OTP or Mobile OTP verification fetches verified demographic payload from NHA (`Name`, `Gender`, `DOB`, `Address`, `Photo`, `AbhaAddress`).
* The system auto-populates `Patient` entity, sets `AbhaNumber`, `AbhaAddress`, and logs DPDP-compliant identity consent.

### 3.2 MOD-23 Pre-Check Intake & MOD-25 Live Ticket Queue
* **Scan & Share Counter QR Check-In:** Patient scans the physical clinic desk QR on their Ayushman / ABHA app. Gateway fires `POST /api/v1/abdm/callbacks/scan-share`. SAMSTACK automatically creates the patient record (if new), issues a Queue Token (`MOD-04/25`), and notifies the doctor.
* **Pre-Check History Enrichment (M3):** If patient consents during MOD-23 intake, SAMSTACK pulls their past 12-month ABDM health history (hospital discharges, previous prescriptions) and presents a 1-page condensed medical summary to the doctor before the patient enters the OPD room.

### 3.3 MOD-05 EMR & MOD-12 Specialty Templates (Dental, Ayurveda, General)
* Saving or amending an OPD Consultation (`FR-14/15`) atomically creates a `CareContext` record (`OP-XXXX`).
* Specialty EMR JSONB structures map to NRCeS FHIR profiles:
  * **General Medicine:** Standard SNOMED CT clinical terms & ICD-10 diagnosis codes.
  * **Dental Templates:** FDI Two-Digit tooth numbering mapped to SNOMED Dental Body Structures (`245842004`).
  * **Ayurveda / AYUSH Templates:** Morbidity codes mapped to the Ministry of AYUSH **NAMASTE Portal** & National AYUSH Morbidity and Standardized Terminologies.

### 3.4 MOD-08 Lab Records
* Saving an authorized Lab Result (`MOD-08`) generates a `CareContext` of type `LabReport` (`LAB-XXXX`).
* Produces FHIR `DiagnosticReport` with embedded LOINC observation codes and signed PDF attachments (stored via S3/Blob storage).

### 3.5 Track 2 Pharmacy POS & Compliance (MOD-15/16)
* Completing a drug dispensation generates a `MedicationDispense` FHIR bundle linked to the patient's ABHA ID.
* Automated Schedule H/H1 register logging satisfies Drugs & Cosmetics Act inspections simultaneously.

---

## 4. Mobile & Native Hardware Bridges (Capacitor Integration)

Connecting directly to the **[`Mobile-Application-Plan.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/docs/technical/Mobile-Application-Plan.md)** specification, SAMSTACK provides native Android and tablet hardware bridges for ABDM workflows:

### 4.1 UIDAI RD Service Android Intent Bridge (Mantra/Morpho Biometrics)
In rural or Tier 3 clinics, patients frequently lack mobile OTP access due to network issues or outdated mobile numbers linked to Aadhaar. The SAMSTACK Android App invokes native UIDAI Registered Device (RD) Service APKs via Android Intents (`in.gov.uidai.rdservice.fp.CAPTURE`):

```java
// RdServicePlugin.java — Native Capacitor Android Plugin
@CapacitorPlugin(name = "AadhaarRdService")
public class RdServicePlugin extends Plugin {
    @PluginMethod
    public void captureBiometric(PluginCall call) {
        saveCall(call);
        Intent intent = new Intent("in.gov.uidai.rdservice.fp.CAPTURE");
        intent.putExtra("PID_OPTIONS", "<PidOptions ver=\"1.0\"><Opts fCount=\"1\" fType=\"2\" iCount=\"0\" pCount=\"0\" format=\"0\" pidVer=\"2.0\" timeout=\"10000\" env=\"P\"/></PidOptions>");
        startActivityForResult(call, intent, "rdServiceResult");
    }

    @ActivityCallback
    private void rdServiceResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            String pidData = result.getData().getStringExtra("PID_DATA");
            JSObject ret = new JSObject();
            ret.put("pidDataXml", pidData);
            call.resolve(ret);
        } else {
            call.reject("Biometric capture cancelled or failed");
        }
    }
}
```

### 4.2 CameraX / ML Kit ABDM Scan & Share Scanner
* Front-desk tablets utilize `@capacitor-mlkit/barcode-scanning` to scan patient ABHA QR codes in `< 200ms` even under low-light reception conditions.

### 4.3 Bluetooth ESC/POS Physical ABHA & Token Printing
* Outputs standard 2-inch (58mm) and 3-inch (80mm) thermal paper tokens containing:
  1. Queue Token Number & Estimated Wait Time (`MOD-25`).
  2. Patient 14-digit ABHA Number & PHR Address (`user@abdm`).
  3. Scannable QR code for patient to track live queue position on their own phone.

### 4.4 Offline-First Sync Resilience (FR-22)
* If internet drops during patient registration, the ABHA verification payload is cached in local SQLite storage (`@capacitor/sqlite`) and queued in the Outbox for atomic background synchronization upon reconnect.

---

## 5. Milestone 1 — ABHA Identity (M1)

### 5.1 Enrollment & Verification Flows

```
+-----------------------------------------------------------------------------------+
|                        M1: ABHA CREATION & VERIFICATION                           |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ Flow A: Aadhaar OTP ]                                                          |
|  1. Receptionist inputs 12-digit Aadhaar                                          |
|  2. Backend RSA-encrypts Aadhaar -> POST /v3/profile/login/request/otp            |
|  3. Patient receives OTP -> Receptionist verifies via POST /v3/profile/login/verify|
|  4. NHA returns demographic profile -> Auto-populates Patient Registration Form    |
|                                                                                   |
|  [ Flow B: Mobile OTP ]                                                           |
|  1. Receptionist inputs Mobile -> POST /v3/enrollment/request/otp                 |
|  2. Verify OTP -> Assigns PHR Address -> Creates ABHA ID                         |
|                                                                                   |
|  [ Flow C: Scan & Share (Desk QR) ]                                               |
|  1. Patient scans Clinic Desk QR in ABHA App                                      |
|  2. NHA Gateway pushes profile to POST /api/v1/abdm/callbacks/scan-share          |
|  3. SAMSTACK auto-creates Patient + assigns MOD-04 Queue Token in 2 seconds       |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

### 5.2 NHA V3 API Contract
* `POST /v3/auth/token` — Client credentials token acquisition (valid 20 minutes).
* `GET /v3/auth/cert` — Fetches NHA RSA Public Key (cached for 24 hours, invalidated on 401).
* `POST /v3/profile/login/request/otp` — Initiates Aadhaar OTP.
* `POST /v3/profile/login/verify` — Validates OTP and returns demographic JSON.
* `POST /v3/enrollment/enrol/abha-address` — Creates custom user PHR handle (`john.doe@abdm`).

### 5.3 RSA PII Encryption Engine
All Aadhaar numbers, mobile numbers, and OTP strings must be encrypted using NHA's public key before transmission:
* **Cipher Transformation:** `RSA/ECB/OAEPWithSHA-1AndMGF1Padding`
* **Implementation:** Built directly in C# using .NET 10 `System.Security.Cryptography.RSA`.

---

## 6. Milestone 2 — Health Information Provider / HIP (M2)

### 6.1 Care Context Life Cycle
A **Care Context** represents a clinical boundary (visit, prescription, lab test) that can be shared across India's health network:

```
Patient: Rajesh Kumar (ABHA: 91-1234-5678-9012)
  │
  ├── Care Context: "OP-2401" (OPD Consultation, 15-Jan-2026)
  │     Contains: OPConsultationRecord (FHIR Bundle)
  │               PrescriptionRecord (FHIR MedicationRequest)
  │
  ├── Care Context: "LAB-0891" (Biochemistry Panel, 16-Jan-2026)
  │     Contains: DiagnosticReportRecord (FHIR DiagnosticReport + Observations)
  │
  └── Care Context: "PHARM-1042" (Dispensed Medicines, 16-Jan-2026)
        Contains: MedicationDispenseRecord (Track 2 Pharmacy)
```

### 6.2 Async Callback Execution Model
NHA Gateway webhooks are **strictly asynchronous**. Any gateway request expects an HTTP `202 Accepted` response within **5.0 seconds**. The actual heavy processing (database queries, FHIR serialization, Fidelius encryption) runs in background Hangfire workers:

```
┌──────────┐     ┌──────────────┐     ┌────────────────────┐
│ ABDM     │     │  Hospital    │     │  Hangfire Queue     │
│ Gateway  │     │  CRM API     │     │  (Background)       │
└────┬─────┘     └──────┬───────┘     └─────────┬──────────┘
     │                  │                        │
     │  1. POST         │                        │
     │  /patient/care-  │                        │
     │  context/discover│                        │
     │─────────────────►│                        │
     │                  │  2. Return 202          │
     │                  │  Accepted (<5s)        │
     │◄─────────────────│                        │
     │                  │                        │
     │                  │  3. Enqueue             │
     │                  │  discovery job          │
     │                  │───────────────────────►│
     │                  │                        │
     │                  │  4. Match patient       │
     │                  │     in Postgres          │
     │                  │◄───────────────────────│
     │                  │                        │
     │  5. POST         │                        │
     │  /care-contexts/ │                        │
     │  on-discover     │                        │
     │◄─────────────────│                        │
```

---

## 7. Milestone 3 — Health Information User / HIU (M3)

### 7.1 Consent Request & Approval Workflow
To view a patient's historical records from other hospitals:
1. Doctor initiates consent request specifying:
   * **Purpose:** Care Management (`CAREMGT`) or Emergency (`EMERGENCY`).
   * **Date Range:** e.g., past 24 months.
   * **HI Types:** `OPConsultation`, `Prescription`, `DiagnosticReport`, `DischargeSummary`.
   * **Expiry Date:** After which access automatically ceases.
2. Patient receives instant notification on their ABHA mobile app and approves with PIN.
3. Gateway delivers signed consent artifact to SAMSTACK webhook `POST /v3/hiu/consent/on-notify`.

### 7.2 Encrypted Data Pull & Ingestion
* SAMSTACK generates ephemeral ECDH Keypair, requests data from gateway (`POST /v3/health-information/hip/request`).
* The external hospital encrypts FHIR bundles using Fidelius; SAMSTACK decrypts them using its private key and indexes them into the patient's Clinical Timeline (`FR-16`).

---

## 8. Fidelius Cryptographic Engine

Data exchange across ABDM is end-to-end encrypted so the NHA Gateway and intermediate routers cannot view plaintext medical records:

```
+-----------------------------------------------------------------------------------+
|                        FIDELIUS ENCRYPTION PIPELINE                               |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  1. Generate Ephemeral Keypair (Sender)  : Curve25519 (ECDH)                      |
|  2. Compute Shared Secret                : ECDH(SenderPriv, ReceiverPub)          |
|  3. Generate Salt & Nonce                : 32-byte Cryptographic Random Salt      |
|  4. HKDF Key Derivation                  : HKDF-SHA256(SharedSecret, Salt, "abdm")|
|  5. Payload Encryption                   : AES-GCM-256 (with 128-bit Auth Tag)    |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

### C# Fidelius Cryptographic Implementation
```csharp
public class FideliusCryptoService
{
    public (byte[] EncryptedData, string SenderPublicKey, string Nonce) Encrypt(
        string fhirJson, 
        string receiverPublicKeyBase64, 
        string receiverNonce)
    {
        // 1. Generate Ephemeral Curve25519 Keypair
        using var senderEcdh = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
        var senderPubBytes = senderEcdh.PublicKey.ExportSubjectPublicKeyInfo();
        
        // 2. Import Receiver Public Key
        using var receiverEcdh = ECDiffieHellman.Create();
        receiverEcdh.ImportSubjectPublicKeyInfo(Convert.FromBase64String(receiverPublicKeyBase64), out _);
        
        // 3. Derive Shared Secret
        byte[] sharedSecret = senderEcdh.DeriveKeyMaterial(receiverEcdh.PublicKey);
        
        // 4. HKDF-SHA256 Key Derivation
        byte[] salt = RandomNumberGenerator.GetBytes(32);
        byte[] derivedKey = HKDF.DeriveKey(HashAlgorithmName.SHA256, sharedSecret, 32, salt, Encoding.UTF8.GetBytes("abdm-encryption"));
        
        // 5. AES-GCM-256 Encrypt
        byte[] nonce = RandomNumberGenerator.GetBytes(12);
        byte[] plainBytes = Encoding.UTF8.GetBytes(fhirJson);
        byte[] cipherBytes = new byte[plainBytes.Length];
        byte[] tag = new byte[16];
        
        using var aesGcm = new AesGcm(derivedKey, 16);
        aesGcm.Encrypt(nonce, plainBytes, cipherBytes, tag);
        
        // Combine Cipher + Tag
        byte[] payload = new byte[cipherBytes.Length + tag.Length];
        Buffer.BlockCopy(cipherBytes, 0, payload, 0, cipherBytes.Length);
        Buffer.BlockCopy(tag, 0, payload, cipherBytes.Length, tag.Length);
        
        return (payload, Convert.ToBase64String(senderPubBytes), Convert.ToBase64String(nonce));
    }
}
```

---

## 9. FHIR R4 Bundle Architecture (NRCeS Profiles)

All clinical records shared via M2 adhere to the **National Resource Centre for EHR Standards (NRCeS)** FHIR R4 India Profiles:

```
+-----------------------------------------------------------------------------------+
|                        NRCeS FHIR R4 BUNDLE STRUCTURE                             |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  Bundle (Type: "document", Profile: "https://nrces.in/ndhm/fhir/r4/StructureDef") |
|    ├── Composition (Profile: OPConsultationRecord / PrescriptionRecord)           |
|    │     ├── Author: Practitioner (Doctor HPR ID)                                 |
|    │     ├── Subject: Patient (ABHA ID)                                           |
|    │     └── Custodian: Organization (Clinic HFR ID)                              |
|    ├── Condition (Diagnosis — coded in SNOMED CT / ICD-10)                        |
|    ├── MedicationRequest (Drugs, Dosages, Durations — mapped to Track 2)          |
|    ├── Observation (Vitals: BP, Pulse, Weight, SpO2, Blood Sugar)                 |
|    ├── DiagnosticReport (Lab orders & findings — mapped to MOD-08)                |
|    └── Binary (Signed Consultation PDF representation)                            |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

### 9.4 Specialty & AYUSH Codification (SNOMED, ICD-10, NAMASTE)
* **General Medicine:** ICD-10 for Primary Diagnosis + SNOMED CT for Chief Complaints.
* **Dental (`MOD-12`):** SNOMED CT body structure codes for individual teeth (`Tooth 11` = `245842004`).
* **Ayurveda (`MOD-12`):** Standardized against **NAMASTE** (National AYUSH Morbidity and Standardized Terminologies Electronic portal) codes:
  * E.g., *Amavata* (Rheumatoid Arthritis) → NAMASTE Code `AGA-001`.
  * E.g., *Prameha* (Diabetes Mellitus) → NAMASTE Code `AGM-014`.

---

## 10. HFR & HPR Registry Integration

* **Health Facility Registry (HFR):** Each clinic tenant is registered on the NHA HFR portal, obtaining an `HFR-ID` (e.g., `IN2710001842`).
* **Healthcare Professionals Registry (HPR):** Every consulting doctor links their national medical registration (NMC/State Dental/AYUSH Council) to obtain an `HPR-ID` (e.g., `dr.sharma@hpr.abdm`).
* When signing prescriptions or FHIR bundles, the system embeds the doctor's verified HPR ID for legal non-repudiation.

---

## 11. Government Compliance, Legal Framework & Security Certification

```
+-----------------------------------------------------------------------------------+
|                           COMPLIANCE REGULATORY FLOOR                             |
+-----------------------------------------------------------------------------------+
|  1. DPDP Act 2023        : Consent as 1st-class record; 72-hr Data Fiduciary breach|
|                            reporting; automated data erasure after consent expiry.|
|  2. CERT-In Mandate      : 6-hour cybersecurity incident reporting to CERT-In.    |
|  3. CDSCO SaMD (2025/26) : ABDM remains administrative/operational; Track 3 AI   |
|                            diagnostic assistance kept strictly gated.             |
|  4. NHA Sandbox & WASA   : Mandatory CERT-In Web Application Security Audit (WASA)|
|                            with 0 Critical / 0 High vulnerabilities.              |
+-----------------------------------------------------------------------------------+
```

---

## 12. Multi-Tenancy & Key Isolation Hierarchy

In alignment with `samstack-ai-strategy-v0.5.md` §3.1 (Shared SaaS vs. Dedicated DB vs. Dedicated Instance):
* **Tenant Isolation:** Every `CareContext`, `AbdmConsentArtifact`, and `AbdmAuditLog` row enforces `tenant_id` scoping.
* **Key Vault Separation:** Each clinic tenant maintains its own distinct Curve25519 Fidelius keypair in **Azure Key Vault** (or hardware HSM in Dedicated Instance tiers).
* **Multi-HFR Routing:** When an async discovery webhook hits `/v3/hip/patient/care-context/discover`, the gateway header `X-HIP-ID` resolves the specific clinic tenant dynamically.

---

## 13. Complete Database Schema (PostgreSQL 16)

```sql
-- 1. Extend Patient Entity with ABHA
ALTER TABLE patients ADD COLUMN IF NOT EXISTS abha_number VARCHAR(17);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS abha_address VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS abha_linked_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS ix_patients_tenant_abha ON patients(tenant_id, abha_number) WHERE abha_number IS NOT NULL;

-- 2. Care Contexts Table (M2)
CREATE TABLE IF NOT EXISTS abdm_care_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    care_context_reference VARCHAR(100) NOT NULL,
    care_context_display VARCHAR(200) NOT NULL,
    context_type VARCHAR(50) NOT NULL, -- OpdVisit, LabReport, Prescription, PharmacyDispense
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    is_linked BOOLEAN NOT NULL DEFAULT FALSE,
    linked_at TIMESTAMPTZ,
    linked_abha_number VARCHAR(17),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_abdm_care_contexts_tenant_ref ON abdm_care_contexts(tenant_id, care_context_reference);
CREATE INDEX IF NOT EXISTS ix_abdm_care_contexts_patient ON abdm_care_contexts(patient_id);

-- 3. Consent Artifacts Table (M2/M3)
CREATE TABLE IF NOT EXISTS abdm_consent_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    consent_id VARCHAR(100) NOT NULL,
    patient_abha_number VARCHAR(17) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    hi_types TEXT NOT NULL,
    date_range_from TIMESTAMPTZ NOT NULL,
    date_range_to TIMESTAMPTZ NOT NULL,
    data_erase_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL, -- GRANTED, REVOKED, EXPIRED
    raw_artifact_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_abdm_consents_tenant_consent_id ON abdm_consent_artifacts(tenant_id, consent_id);

-- 4. ABDM Audit Trail (Append-Only)
CREATE TABLE IF NOT EXISTS abdm_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    action_type VARCHAR(100) NOT NULL, -- Discovery, LinkInit, LinkConfirm, DataFetch, ConsentNotify
    gateway_request_id VARCHAR(100) NOT NULL,
    abha_number VARCHAR(17),
    ip_address VARCHAR(50),
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
REVOKE UPDATE, DELETE ON abdm_audit_logs FROM app_user;
```

---

## 14. Full API Endpoint Inventory

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/v1/abdm/m1/otp/init` | `Doctor`, `Receptionist` | Initiates Aadhaar / Mobile OTP for ABHA creation |
| `POST` | `/api/v1/abdm/m1/otp/verify` | `Doctor`, `Receptionist` | Verifies OTP and returns verified profile payload |
| `POST` | `/api/v1/abdm/m1/scan-share` | Public / Gateway | Webhook receiving desk QR check-in from ABHA app |
| `POST` | `/v3/hip/patient/care-context/discover` | ABDM Gateway | Async webhook: matches patient and returns care contexts |
| `POST` | `/v3/hip/patient/care-context/link/init` | ABDM Gateway | Async webhook: initiates OTP linking for care context |
| `POST` | `/v3/hip/patient/care-context/link/confirm` | ABDM Gateway | Async webhook: confirms OTP and finalizes linking |
| `POST` | `/v3/hip/data/fetch` | ABDM Gateway | Async webhook: generates Fidelius encrypted FHIR bundle |
| `POST` | `/api/v1/abdm/m3/consent/request` | `Doctor` | Requests access to patient's external medical history |
| `POST` | `/v3/hiu/consent/on-notify` | ABDM Gateway | Webhook notifying CRM that patient granted consent |
| `GET`  | `/api/v1/abdm/m3/records/{abhaNumber}` | `Doctor` | Decrypts and renders external FHIR medical records |

---

## 15. Phased Rollout Roadmap & Testing Strategy

```
+-----------------------------------------------------------------------------------+
|                        ABDM PHASED EXECUTION ROADMAP                              |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  PHASE 1: M1 Identity & Scan & Share (Weeks 1-4)                                  |
|  - Aadhaar/Mobile OTP + Desk Scan & Share QR integration                          |
|  - Bluetooth ESC/POS token print with ABHA QR                                     |
|  - Local SQLite Outbox caching for offline tolerance (FR-22)                      |
|                                                                                   |
|  PHASE 2: M2 HIP & FHIR R4 Bundle Generation (Weeks 5-10)                         |
|  - Hangfire async 202 callback queue (< 5s response guarantee)                    |
|  - Fidelius ECDH Cryptographic Engine (Curve25519 + AES-GCM)                      |
|  - NRCeS FHIR profiles for Consultations, Prescriptions, Labs & Track 2 Pharmacy |
|                                                                                   |
|  PHASE 3: M3 HIU & Pre-Check Integration (Weeks 11-14)                            |
|  - Consent manager integration + Doctor timeline ingestion                        |
|  - MOD-23 pre-check intake pre-population                                         |
|                                                                                   |
|  PHASE 4: CERT-In WASA Audit & NHA Production Onboarding (Weeks 15-20)            |
|  - Third-party CERT-In security penetration testing                               |
|  - NHA Sandbox exit test cases execution (50+ scenarios)                          |
|  - Production gateway whitelisting and DHIS incentive portal activation          |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

## 16. Risk Register

| Risk ID | Description | Severity | Mitigation Strategy |
|---|---|---|---|
| **ABDM-R1** | Gateway callback timeout (> 5.0s) causing certification failure. | **Critical** | Immediate `202 Accepted` HTTP acknowledgment; offload all database queries & crypto to Hangfire background queue. |
| **ABDM-R2** | NHA Public Key rotation causes RSA decryption failures. | **High** | Automatic retry on HTTP 401 with forced `/v3/auth/cert` cache invalidation and reload. |
| **ABDM-R3** | Patients in rural areas lack Aadhaar-linked mobile phone. | **High** | Support UIDAI Biometric RD Service (Mantra/Morpho) fingerprint verification on Android tablets. |
| **ABDM-R4** | Fidelius Curve25519 key corruption or compromise. | **Critical** | Store all private keys in Azure Key Vault with automated 90-day rotation and strict tenant isolation. |
| **ABDM-R5** | CERT-In WASA audit identifies dependency vulnerabilities. | **Medium** | Continuous CI vulnerability scanning using Snyk/Trivy; pin all NuGet and npm dependencies to patched LTS versions. |

---
*End of Specification — Authoritative Reference Plan for SAMSTACK ABDM Implementation.*
