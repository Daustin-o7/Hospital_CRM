# SAMSTACK Hospital CRM — Future Implementations Master Architecture & Specifications

> **Document Version:** 1.0 (Advanced Tracks & Future Gated Scope)  
> **Status:** Architectural Reference for Subsequent Platform Expansion Gates  
> **Scope:** Phase 2 Fast-Follow Modules (MOD-08–25) + Track 2 Connected Pharmacy POS (MOD-15–17) + Track 3 Ambient Voice AI (MOD-18/19/27) + Track 4 Inpatient IPD & Nursing (MOD-20–26) + Full ABDM M2/M3 National Health Integration + International Adapter (UAE PDPL & NABIDH/Malaffi) + Advanced Multi-Tenant Infrastructure (Tiers 2 & 3)  
> **Strategic Governance:** Governed by `StrategyV1.md` (Gate 3 to Gate 6 Release Schedule) — Built sequentially only after Phase 1 OPD stability and commercial adoption are validated.

---

## Table of Contents

1. [Gated Release Sequence (Gate 3 – Gate 6)](#1-gated-release-sequence-gate-3--gate-6)
2. [Advanced Multi-Tenancy Architecture (Tiers 2 & 3)](#2-advanced-multi-tenancy-architecture-tiers-2--3)
3. [Phase 2: Fast-Follow Clinical & Operations Modules (MOD-08 – MOD-25)](#3-phase-2-fast-follow-clinical--operations-modules-mod-08--mod-25)
   - 3.1 [MOD-23: Unauthenticated Pre-Check Mobile Intake Form](#31-mod-23-unauthenticated-pre-check-mobile-intake-form)
   - 3.2 [MOD-24: Emergency Priority Triage Queue](#32-mod-24-emergency-priority-triage-queue)
   - 3.3 [MOD-25: Live Patient Queue Ticket Tracker (WhatsApp Linked)](#33-mod-25-live-patient-queue-ticket-tracker-whatsapp-linked)
   - 3.4 [MOD-12: Specialty EMR Templates (Dental FDI & Ayurveda NAMASTE)](#34-mod-12-specialty-emr-templates-dental-fdi--ayurveda-namaste)
   - 3.5 [MOD-08: Diagnostic Lab Records & Paper Report Document Scanner](#35-mod-08-diagnostic-lab-records--paper-report-document-scanner)
   - 3.6 [MOD-09: 3-Tier Clinic Inventory & Barcode Verification](#36-mod-09-3-tier-clinic-inventory--barcode-verification)
   - 3.7 [MOD-10: Doctor Task Tracker & Expansion Wishlist](#37-mod-10-doctor-task-tracker--expansion-wishlist)
   - 3.8 [MOD-11: Financial Expense Ledger & Tax Summary](#38-mod-11-financial-expense-ledger--tax-summary)
   - 3.9 [MOD-13: Notification Rules Engine & Automated Recalls](#39-mod-13-notification-rules-engine--automated-recalls)
   - 3.10 [MOD-14: Platform Admin & Support Tenant Impersonation](#310-mod-14-platform-admin--support-tenant-impersonation)
4. [Track 2: Connected Pharmacy POS & Drug Compliance (MOD-15 – MOD-17)](#4-track-2-connected-pharmacy-pos--drug-compliance-mod-15--mod-17)
   - 4.1 [Typesense `medicines` Collection & Substitute Drug Finder](#41-typesense-medicines-collection--substitute-drug-finder)
   - 4.2 [FEFO Batch Selection & Barcode Dispense](#42-fefo-batch-selection--barcode-dispense)
   - 4.3 [Schedule H / H1 / X Statutory Drug Registers](#43-schedule-h--h1--x-statutory-drug-registers)
5. [Track 3 & Phase 3: Ambient AI Scribe & Telephony Voice Agent (MOD-18/19/27)](#5-track-3--phase-3-ambient-ai-scribe--telephony-voice-agent-mod-181927)
   - 5.1 [Ambient AI Consultation Scribe (Bolna / Sarvam AI / Whisper)](#51-ambient-ai-consultation-scribe-bolna--sarvam-ai--whisper)
   - 5.2 [Outbound Telephony Voice Confirmation Agent (Exotel / Twilio)](#52-outbound-telephony-voice-confirmation-agent-exotel--twilio)
   - 5.3 [Specialty Clinical Voice Form Filler](#53-specialty-clinical-voice-form-filler)
6. [Track 4: Inpatient / IPD & Bedside Nursing (MOD-20 – MOD-26)](#6-track-4-inpatient--ipd--bedside-nursing-mod-20--mod-26)
   - 6.1 [MOD-20: Interactive Ward Layout & Bed Management](#61-mod-20-interactive-ward-layout--bed-management)
   - 6.2 [MOD-21: Inpatient Admission & Discharge Summaries](#62-mod-21-inpatient-admission--discharge-summaries)
   - 6.3 [MOD-22: Bedside Nursing Vitals Charting & Medication Scanner](#63-mod-22-bedside-nursing-vitals-charting--medication-scanner)
   - 6.4 [MOD-26: Nurse Shift Rostering & Clinical Handoffs](#64-mod-26-nurse-shift-rostering--clinical-handoffs)
7. [Full ABDM M2 (HIP) & M3 (HIU) National Health Integration](#7-full-abdm-m2-hip--m3-hiu-national-health-integration)
   - 7.1 [NRCeS FHIR R4 Bundles (Consultation, Rx, Diagnostics, Dispense)](#71-nrces-fhir-r4-bundles-consultation-rx-diagnostics-dispense)
   - 7.2 [Fidelius Curve25519 ECDH Cryptographic Pipeline](#72-fidelius-curve25519-ecdh-cryptographic-pipeline)
   - 7.3 [HIU Consent Management & External Health Record Pull](#73-hiu-consent-management--external-health-record-pull)
   - 7.4 [Digital Health Incentive Scheme (DHIS) Revenue Engine](#74-digital-health-incentive-scheme-dhis-revenue-engine)
8. [International Adapter: UAE PDPL, VAT & NABIDH/Malaffi Exchange](#8-international-adapter-uae-pdpl-vat--nabidhmalaffi-exchange)
   - 8.1 [UAE Federal Law No. 45/2021 (PDPL) Data Residency](#81-uae-federal-law-no-452021-pdpl-data-residency)
   - 8.2 [FTA-Compliant 5% VAT Invoicing Engine](#82-fta-compliant-5-vat-invoicing-engine)
   - 8.3 [NABIDH (DHA) & Malaffi (DoH) FHIR Health Information Exchange](#83-nabidh-dha--malaffi-doh-fhir-health-information-exchange)

---

## 1. Gated Release Sequence (Gate 3 – Gate 6)

Platform expansion beyond Phase 1 (FR-01–22) is governed by **strict commercial and architectural gates** per `StrategyV1.md`:

```
+-----------------------------------------------------------------------------------+
|                        SAMSTACK PLATFORM EXPANSION GATES                          |
+-----------------------------------------------------------------------------------+
|  GATE 1: Phase 1 Pilot Ready   ──► FR-01–22 OPD Core, Identity, Billing, Offline. |
|  GATE 2: Phase 1 Pilot Proven  ──► 3–5 live clinics, >80% digital OPD volume.     |
|  GATE 3: Commercial SaaS       ──► Multi-tenant lifecycle, Phase 2 (MOD-08–25).   |
|  GATE 4: Enterprise Dedicated  ──► Tier 2 Dedicated DB, Track 2 Pharmacy POS.    |
|  GATE 5: Hospital Dedicated    ──► Tier 3 Dedicated Instance, Track 4 IPD.        |
|  GATE 6: Advanced Intelligence ──► Track 3 Voice AI, Full ABDM M2/M3, UAE Adapter.|
+-----------------------------------------------------------------------------------+
```

---

## 2. Advanced Multi-Tenancy Architecture (Tiers 2 & 3)

For larger hospital networks requiring strict regulatory data isolation:

| Commercial Tier | Technical Tier | Architecture Specification |
|---|---|---|
| **Tier 1 (Shared SaaS)** | Multi-Tenant Database | Single PostgreSQL 16 instance with `tenant_id` + Row-Level Security (RLS). |
| **Tier 2 (Enterprise)** | Dedicated Database | Shared compute gateway with physically isolated PostgreSQL database per hospital. |
| **Tier 3 (Dedicated Instance)** | Isolated Full-Stack | Completely isolated application containers, database, and Redis cache per enterprise. |
| **Tier 3 (Customer Cloud)** | Customer VPC / On-Prem | SAMSTACK deployed into hospital's private AWS/Azure VPC or on-premise Kubernetes cluster. |

---

## 3. Phase 2: Fast-Follow Clinical & Operations Modules (MOD-08 – MOD-25)

### 3.1 MOD-23: Unauthenticated Pre-Check Mobile Intake Form
* **Patient Journey:** When an appointment is scheduled, a secure tokenized URL (`https://app.samstack.ai/checkin/{token}`) is delivered to the patient via WhatsApp.
* **Intake Capture:** Patient enters current symptoms, allergies, known chronic conditions, and previous medication on a zero-install mobile web form.
* **EMR Pre-Population:** Submissions automatically populate the doctor's consultation view (`FR-14`) upon the patient's arrival at the clinic.

---

### 3.2 MOD-24: Emergency Priority Triage Queue
* **Visual Triage:** Receptionist or triage nurse flags a patient as **Emergency**.
* **Instant Re-ordering:** Patient jumps to Position #1 in the queue with an animated red pulse badge on doctor and reception monitors.
* **Native Wake-Up Alert:** Delivers high-priority push notification and haptic buzz to doctor's mobile device.

---

### 3.3 MOD-25: Live Patient Queue Ticket Tracker (WhatsApp Linked)
* **Zero-Install Web Tracker:** Patients track their queue position live on their mobile browser (`"2 patients ahead of you · Est. Wait: 12 minutes"`).
* **Auto-Polling:** WebSocket / SSE updates token status in real time, preventing reception waiting room overcrowding.

---

### 3.4 MOD-12: Specialty EMR Templates (Dental FDI & Ayurveda NAMASTE)
1. **Dental EMR Template:**
   * Interactive 32-tooth FDI interactive chart.
   * 1-tap marking of Caries, Extraction, Crown, Root Canal (RCT), and Scaling.
2. **Ayurveda EMR Template:**
   * Standardized classification of *Prakriti* (Vata / Pitta / Kapha), *Nadi Pariksha*, *Agni*, and *Koshta*.
   * Integration with AYUSH National Morbidity Codes (NAMASTE portal taxonomy).

---

### 3.5 MOD-08: Diagnostic Lab Records & Paper Report Document Scanner
* **Document Scanner:** Native camera bridge with auto-perspective correction and contrast optimization for digitizing physical lab printouts.
* **Encrypted Storage:** Stores digitized reports in Azure Blob / S3 with signed time-limited access URLs.
* **Audit-Safe Amendments:** Lab report revisions preserve original uploads as immutable historical versions.

---

### 3.6 MOD-09: 3-Tier Clinic Inventory & Barcode Verification
* **Category Segmentation:** Manages clinic supplies across Dead Stock (equipment), Consumables (cotton, syringes, gloves), and Dispensed Items.
* **Barcode Reorder Scanner:** Camera scanner reads EAN-13 barcodes to verify physical stock counts and triggers automated low-stock reorder alerts.

---

### 3.7 MOD-10: Doctor Task Tracker & Expansion Wishlist
* Internal clinical task manager for clinic expansion milestones, equipment maintenance schedules, and administrative follow-ups with voice-to-text dictation.

---

### 3.8 MOD-11: Financial Expense Ledger & Tax Summary
* Day-to-day clinic expense capture (rent, utilities, staff salaries, clinical supplies) with receipt camera capture.
* Monthly income vs. expense reconciliation and GST/income tax reporting summaries.

---

### 3.9 MOD-13: Notification Rules Engine & Automated Recalls
* Rule-based automation engine for patient recalls (e.g., *"Send diabetic checkup recall 90 days after last HbA1c consultation"*).
* Channels: WhatsApp Business API primary with automated SMS fallback.

---

### 3.10 MOD-14: Platform Admin & Support Tenant Impersonation
* Central multi-clinic governance portal for SAMSTACK support engineers.
* Provides role-gated, time-bounded session impersonation with full cryptographic audit logging for debugging clinic support tickets.

---

## 4. Track 2: Connected Pharmacy POS & Drug Compliance (MOD-15 – MOD-17)

```
+-----------------------------------------------------------------------------------+
|                        TRACK 2 PHARMACY WORKFLOW & FEFO DISPENSING                |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ Doctor Saves Rx (FR-15) ] ──► Instant digital prescription routing to Pharmacy  |
|                                         │                                         |
|                                         ▼                                         |
|  [ Pharmacy POS Tablet ]     ──► Auto-loads Rx items; camera scans drug strip EAN |
|                                         │                                         |
|                                         ▼                                         |
|  [ FEFO Engine ]             ──► Allocates earliest-expiring batch automatically  |
|                                         │                                         |
|                                         ▼                                         |
|  [ Compliance Registers ]    ──► Auto-logs Schedule H/H1 records; prints invoice  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

### 4.1 Typesense `medicines` Collection & Substitute Drug Finder
* **Typesense Schema:** `id`, `tenant_id`, `brand_name`, `generic_name`, `strength`, `dosage_form`, `mrp`, `schedule_class`, `manufacturer`.
* **Substitute Finder:** When a prescribed brand is out of stock, queries `generic_name` + `strength` to list in-stock therapeutic equivalents instantly.

---

### 4.2 FEFO Batch Selection & Barcode Dispense
* **First-Expired, First-Out (FEFO):** POS automatically selects the earliest expiring batch from inventory.
* **Expiry Shield:** Hard block preventing pharmacists from billing drugs within 30 days of expiry unless explicitly overridden.

---

### 4.3 Schedule H / H1 / X Statutory Drug Registers
* Auto-populates Indian statutory pharmacy registers (Prescriber Name, Patient Details, Drug Name, Batch No, Quantity Dispensed) for regulatory compliance audits.

---

## 5. Track 3 & Phase 3: Ambient AI Scribe & Telephony Voice Agent (MOD-18/19/27)

### 5.1 Ambient AI Consultation Scribe (Bolna / Sarvam AI / Whisper)
* **Audio Capture:** Uses mobile microphone to capture ambient doctor-patient conversation in OPD.
* **Indian Language NLP:** Supports mixed-code consultation dialogue (Hindi-English / "Hinglish", Tamil-English, Telugu-English).
* **SOAP Note Generation:** Converts audio stream into structured SOAP clinical notes (Subjective, Objective, Assessment, Plan) with 1-tap doctor approval.

---

### 5.2 Outbound Telephony Voice Confirmation Agent (Exotel / Twilio)
* Autonomous telephony bot dials scheduled patients 24 hours prior to OPD appointments.
* Conversational AI confirms, reschedules, or cancels appointments with real-time queue synchronization.

---

### 5.3 Specialty Clinical Voice Form Filler
* Hands-free voice dictation for surgical notes, dental charting, and ophthalmic refractive values during examinations.

---

## 6. Track 4: Inpatient / IPD & Bedside Nursing (MOD-20 – MOD-26)

### 6.1 MOD-20: Interactive Ward Layout & Bed Management
* Real-time graphical ward map with color-coded bed occupancy (Occupied, Available, Under Cleaning, Maintenance).
* 1-tap bed transfers and daily room tariff calculations.

---

### 6.2 MOD-21: Inpatient Admission & Discharge Summaries
* Paperless IPD admission checklists, insurance TPA pre-authorization logging, and automated discharge summary generation.

---

### 6.3 MOD-22: Bedside Nursing Vitals Charting & Medication Scanner
* Tablet-based nursing rounds: 1-tap capture of BP, Pulse, SpO2, Temperature, Blood Glucose, and Urine Output.
* **Positive Patient Identification (PPID):** Barcode scan of patient wristband + medication strip before administration.

---

### 6.4 MOD-26: Nurse Shift Rostering & Clinical Handoffs
* Shift handoff notes detailing critical alerts, pending lab investigations, and fluid balance summaries.

---

## 7. Full ABDM M2 (HIP) & M3 (HIU) National Health Integration

```
+-----------------------------------------------------------------------------------+
|                        ABDM M2/M3 DATA EXCHANGE & ENCRYPTION                      |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ Consent Request ] ──► NHA Consent Manager routes patient authorization         |
|                                │                                                  |
|                                ▼                                                  |
|  [ Data Provider ]   ──► Generates NRCeS FHIR R4 Bundle (JSON)                    |
|                                │                                                  |
|                                ▼                                                  |
|  [ Fidelius Engine ] ──► Encrypts bundle via Curve25519 ECDH + AES-GCM            |
|                                │                                                  |
|                                ▼                                                  |
|  [ Secure Exchange ] ──► Transmits encrypted payload to requesting HIU facility   |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

### 7.1 NRCeS FHIR R4 Bundles (Consultation, Rx, Diagnostics, Dispense)
* Standardized serialization of clinic clinical data into official National Resource Centre for EHR Standards (NRCeS) FHIR R4 profiles.

---

### 7.2 Fidelius Curve25519 ECDH Cryptographic Pipeline
* End-to-end data encryption using NHA's Fidelius standard:
  * Ephemeral Curve25519 keypair generation.
  * Shared secret derivation via ECDH.
  * HKDF key derivation + AES-256-GCM authenticated payload encryption.

---

### 7.3 HIU Consent Management & External Health Record Pull
* Doctors request electronic access to patient's past records from other hospitals via ABDM Gateway.
* Upon patient OTP approval on their ABHA app, external records are pulled and parsed into the clinical timeline.

---

### 7.4 Digital Health Incentive Scheme (DHIS) Revenue Engine
* Automated ledger tracking government incentive payouts:
  * ₹20 per Scan & Share ABHA registration.
  * ₹20 per linked lab report.
  * ₹20 per shared digital prescription.
* Generates monthly submission claims for NHA direct bank transfers.

---

## 8. International Adapter: UAE PDPL, VAT & NABIDH/Malaffi Exchange

### 8.1 UAE Federal Law No. 45/2021 (PDPL) Data Residency
* Regional cloud deployment on AWS UAE (me-central-1) or Azure UAE Central ensuring zero health data egress outside UAE borders.

---

### 8.2 FTA-Compliant 5% VAT Invoicing Engine
* Federal Tax Authority (FTA) compliant invoicing with mandatory Arabic/English bilingual format, TRN tax registration number, and VAT breakdown.

---

### 8.3 NABIDH (DHA) & Malaffi (DoH) FHIR Health Information Exchange
* Native connectors to Dubai Health Authority (NABIDH) and Abu Dhabi Department of Health (Malaffi) for mandatory real-time electronic health record synchronization.
