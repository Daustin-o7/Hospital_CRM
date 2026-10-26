# Section 4: Pharmacy (4A) & External Prescription (4B) — Implementation TODO

> **Status:** COMPLETED ✅ (re-verified against code 2026-10-26; corrections and remaining limits below)  
> **Target:** Common Drug Codes for India (CDCI) integration with open-source checkpoint, append-only stock movement ledger, registered pharmacist & Form 20/21 license gates, Schedule H1 inspection register, MRP-inclusive GST, row-locked dispensing, and server-side verified prescription print/QR verification.

---

## 📋 Master Task Breakdown

### 1. Medicine Catalogue & Checkpoint Architecture
- [x] **1.1 CDCI Flat File Parser & Service**
  - Read from `Medicine/CommonDrugCodesForIndia_FlatFilePackage` (`GenericMaster.txt`, `BrandMaster.txt`, `DrugFormMaster.txt`, `RouteOfAdministrationMaster.txt`).
  - Cached in-memory active generics and brands for ultra-fast autocomplete.
- [x] **1.2 Checkpoint Badge & Data Source Tagging**
  - Tagged each medicine result with `dataSource`:
    - `"HospitalMaster"`: verified hospital formulary (`isUnverified: false`).
    - `"CDCI (Open Source)"`: official open-source CDCI master (`isUnverified: true`, badge: *"Open Source - Needs Pharmacist Review"*).
    - `"TrueMD"`: fallback open database (`isUnverified: true`).
    - `"Custom"`: user-entered non-catalogue medicine (`isUnverified: true`).
- [x] **1.3 Search Miss Logging (`MedicineSearchMissLogs`)**
  - Logs every search query with 0 results (`TenantId`, `Query`, `SearchedByUserId`, `SearchedAt`) so clinics know which local brands to curate.

---

### 2. Section 4A: In-House Pharmacy (Regulated Business)
- [x] **2.1 Append-Only Stock Movement Ledger (`DrugStockMovement`)**
  - Records every receipt, dispense, return, adjustment, and write-off as an immutable ledger event.
  - Enforced `CHECK ("QuantityRemaining" >= 0)` constraint on `DrugBatches`.
  - Row locking (`FOR UPDATE` / serializable transaction) on batch deduction to prevent selling the last strip twice.
- [x] **2.2 Stock-In Side (Purchase Entry / Goods Receipt)**
  - `POST /api/v1/pharmacy/stock-in`: Supplier, supplier Form 20/21 licence number, invoice number, invoice date, batch number, expiry date, mfg date, MRP, purchase rate, pack size, received quantity, base-unit count.
- [x] **2.3 Licence & Registered Pharmacist Gate**
  - Gated on clinic's pharmacy retail licence number (`PharmacyLicenceNumber20`, `PharmacyLicenceNumber21`) on `Clinic`; fail-closed — no clinic row or no licence = `403 pharmacy_licence_missing`.
  - Dispense endpoint requires registered pharmacist (`TenantMembership.Role == Pharmacist` or `ClinicAdmin`).
  - Every dispense stamps `DispensedBy` (pharmacist ID & name).
- [x] **2.4 NDPS Digital Dispensing Prohibition**
  - Hard software block on dispensing Schedule NDPS drugs digitally (`400 Bad Request: ndps_digital_dispensing_prohibited`).
- [x] **2.5 Substitution with User Decision**
  - Suggests same generic + strength + form when prescribed brand is out of stock.
  - Final decision is upon user (pharmacist/doctor). Records prescribed vs dispensed product and `SubstitutionReason`.
- [x] **2.6 Schedule H1 Inspection Register**
  - Automatic immutable byproduct of each dispense of Schedule H1 drugs.
  - Logs: Prescriber Name & Reg No, Patient Name & Address, Drug Name, Batch Number, Quantity, DispensedAt, DispensedBy.
  - Kept for 3 years, export endpoint `GET /api/v1/pharmacy/compliance/register?startDate=...&endDate=...&exportCsv=true` (CSV format for drug inspectors).
- [x] **2.7 Sequential Pharmacy Invoicing & MRP-Inclusive GST**
  - Separate series: `PHARM-YYYY-XXXXXX` per financial year (sequential, gapless).
  - Reverse GST calculation from MRP: `Base Price = MRP / (1 + GST%)`, `GST Amount = MRP - Base Price`.
  - Per-item HSN codes (`3004...`) and GST rates (5%, 12%, 18%).
- [x] **2.8 Loose Units & Expiry/Recall Guards**
  - Support loose tablets (base unit) with pack size conversion.
  - Block expired batches (`ExpiryDate < today`), warn on near-expiry (< 60 days).
  - Batch recall flag (`IsRecalled`) on `DrugBatch` with recall endpoint `POST /api/v1/pharmacy/batches/{id}/recall`.
- [x] **2.9 Least Privilege & Finalized Rx Gate**
  - Pharmacist view only reveals prescription items, recorded allergies, and demographics — no consultation SOAP note.
  - Dispense allowed only from `ConsultationStatus.Finalized`.
  - Dispensed lines flagged `IsDispensed = true` and `DispensedQuantity` incremented (locked against double-dispensing or silent amendment).

---

### 3. Section 4B: External Prescription (Core Workflow)
- [x] **3.1 Server-Side Print Payload (no PDF renderer)**
  - `GET /api/v1/prescriptions/{id}/print`: server-built printable payload (JSON, not a PDF/HTML template — the SPA renders it).
  - Includes doctor name, qualifications, State Medical Council / NMC registration number, clinic address, patient details, and structured medicines.
  - Embeds tamper-evident SHA-256 digital signature hash and QR verification code.
  - Reprints logged to `PrescriptionPrintLogs` and clearly stamped with `"DUPLICATE COPY"` watermark.
- [x] **3.2 Chemist Verification with Superseded Detection**
  - `GET /api/v1/consultations/verify-rx/{code}`: an **older** printed version returns `status: "superseded"`, `supersededOn`, `latestVersion: 2`; the newest version (even in status `Amended`) stays `valid`. Unknown `?version=` → 404.
  - Dedicated public page: `frontend/src/pages/VerifyRx.tsx` (accessible via `/rx-verify/:code`).
- [x] **3.3 WhatsApp Opt-in Secure Link**
  - `POST /api/v1/prescriptions/{id}/share-link`: HMAC-SHA256 signed link (`exp` + `sig`, 7 days) gated on active patient consent; returns `503 share_link_not_configured` when `Prescription:ShareSecret` is unset, and verification rejects expired/forged links.

---

### 4. Verification & Testing
- [x] **4.1 Unit & Integration Test Suite**
  - `Section4PharmacyHardeningTests.cs` — 9 facts: CDCI checkpoint & miss logging, stock-movement ledger, licence gate, NDPS block, generic substitution rejection, MRP-inclusive GST, reprint watermark, superseded verification.
  - `Section4PharmacyAuditFixesTests.cs` — 11 facts: per-version verify semantics, unknown version 404, expired/forged share links, unset share secret 503, CDCI `DrugId` dropped on save, dispense matches by generic+strength+form, stored-NDPS block, exact substitutes, recall zeroes stock, catalogue GST wins.
- [x] **4.2 Frontend Compilation & End-to-End Build**
  - `dotnet test` (292/292 passed, 0 failed)
  - `npm run build` (0 TypeScript errors), `npm run lint` (0 errors, pre-existing warnings only)
  - Migration `20261025222055_Section4PharmacyHardening` applied (unique dispense idempotency key, `DrugBatches.InvoiceDate` / `SupplierLicenceNumber`, append-only FKs → `Restrict`).

---

### 5. Known limits (documented, not built)
- No PDF or HTML print template; `/print` returns the printable JSON payload and the SPA renders it. No QR **image** either — the code is text.
- No pharmacy UI for stock-in, recall, adjust, stock movements, curate-from-source, miss logs, or Rx dispense. The amber "Open Source - Needs Pharmacist Review" badge exists only in the doctor's e-Rx editor.
- Rx dispense writes a `DispenseRecord` with `totalAmount` but raises no invoice/payment, so counter dispensing is unbilled (POS checkout is the billed path).
- CDCI search is an in-memory linear scan over ~94k brands; first call blocks on a ~13 MB read; one hardcoded local-path probe remains.
- The Form 20/21 gate and POS invoice numbering are tenant-wide, not per-clinic (Phase 1 is single-clinic).
