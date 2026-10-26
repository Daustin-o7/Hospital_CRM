# Section 5: Billing, Payments & Ledger — Master Architecture & Implementation Plan

> **Status:** SHIPPED / COMPLETE  
> **Module Type:** Core Module (Non-Gated, essential for clinic operations)  
> **Design Stance:** Manual-first billing engine. Invoices carry per-line tax based on tenant tax profile; staff-confirmed payments transition invoices to paid; all financial events post to an immutable append-only ledger. Automation (statement matching, payment links, PSP routing) plugs behind the exact same states later.  
> **Verification:** 310 backend automated tests passing (301 baseline incl. `Section5BillingLedgerTests.cs` + 9 audit regressions in `Section5BillingAuditFixesTests.cs`), frontend PWA production build passing (`Billing.tsx`), append-only DB security enforced.
>
> **Re-verified 2026-10-26:** double-confirm/overpay now rejected, legacy `CollectPayment` posts the ledger, finalize postings balance with a discount, credit notes are finalized-only and capped, invoice numbers have a DB unique index, webhook posts and fails loudly, tax downgrade and draft print are blocked, payee changes require password + MFA step-up and email the admins, ledger GST/reported/net figures fixed. Migrations: `20261026135242_Section5BillingTaxAndManualLedger` + `20261026145940_Section5BillingGuards` (both applied).
>
> **Known limits (not built):** no PDF renderer (print returns JSON); no patient deposits/advances; no refund endpoint (`RefundProcessed` unused); no dual-approval threshold for discounts or credit notes; invoice numbering uses the calendar year, not the Indian FY; no daily cap/spike alerts on reported payments; payee daily limit stored but not enforced; no bank statement import. See `docs/SESSION-LOG.md`.

---

## 🏛️ Regulatory & Tax Foundation (India Healthcare Exemption)

1. **Notification 12/2017 Central Tax (Rate):**
   - Health care services provided by a clinical establishment, authorised medical practitioner, or para-medics are **exempt from GST (nil-rated)**.
   - Outpatient consultations, doctor fees, and nursing care are exempt (0% GST / SAC 999312).
   - Exempt-only clinics are not mandated to register for GST unless making taxable outward supplies or interstate goods supplies.
2. **Taxable Goods & Supplies:**
   - Over-the-counter medicine sales, health supplements, medical equipment, and cosmetic/non-therapeutic procedures are taxable goods/services at item-specific GST rates (5%, 12%, 18%).
   - Separate documents: In-house Pharmacy sales (Section 4A) maintain their **own independent sequential series (`PHARM-YYYY-XXXXXX`)** with reverse MRP-inclusive GST and are linked to billing as related documents — **never merged** into clinical service bills.
3. **Bill of Supply vs Tax Invoice:**
   - Clinics supplying exclusively exempt healthcare services issue a **Bill of Supply**.
   - GST-registered clinics making mixed supplies issue a **Tax Invoice** for taxable lines and/or a composite bill of supply.
   - Configured via the clinic's **Tenant Tax Profile**, confirmed by their Chartered Accountant (CA).

---

## 📋 Section 5 Workflow Breakdown

### 5.1 Invoice Build & Line-Item Tax Engine (`POST /api/v1/invoices`)
- **Sources:**
  - Finalized consultation (Section 3) → consultation fee, in-clinic procedures.
  - Lab orders (if `lab` module active) → diagnostic investigation charges.
  - Linked documents: In-house Pharmacy sales (Section 4A) appear as referenced invoices.
- **Line-Item Structure:**
  - `Description`: Service or item name.
  - `Quantity`: Unit count.
  - `UnitPrice`: Base rate before tax.
  - `TaxCategory`: `Exempt` | `Nil` | `Taxable`.
  - `HsnSacCode`: SAC code for services (e.g., `999312` for OPD healthcare) or HSN for supplies.
  - `GstRate`: Configured from Tenant Tax Profile (0% for OPD, 5%/12%/18% for goods).
  - `TaxAmount`: Calculated per line item (`Math.Round(Quantity * UnitPrice * (GstRate / 100), 2)`).
  - `TotalAmount`: `Quantity * UnitPrice + TaxAmount`.
- **Lifecycle States:**
  - `Draft`: Editable by front-desk while patient completes tests/procedures.
  - `Finalized`: Immutable record, generates sequential gapless invoice number.

---

### 5.2 Tenant Tax Profile
- Set at clinic onboarding, configurable by Clinic Admin/Owner:
  - `IsGstRegistered`: boolean.
  - `Gstin`: 15-digit GST identification number.
  - `StateCode`: 2-digit Indian state code (e.g. `27` for Maharashtra, `29` for Karnataka).
  - `DefaultInvoiceType`: `TaxInvoice` | `BillOfSupply`.
  - `DefaultOpdTaxCategory`: `Exempt` (SAC 999312, 0% GST).
  - `DefaultProcedureTaxCategory`: Configurable per procedure template.
  - `HsnSacMaster`: Configurable mapping table for common clinical services.

---

### 5.3 Adjustments: Discounts & Patient Deposits
- **Discounts:**
  - Applied as a dedicated deduction line (`DiscountAmount`), never by altering item rates.
  - Requires a mandatory reason text; the server rejects a discount above the gross and posts `DiscountAllowed` so the ledger balances.
  - Clinic-configurable threshold and admin approval are **not built**.
- **Patient Advances / Deposits:**
  - **Not built** (`PatientDeposit` does not exist).

---

### 5.4 Invoice Finalization & Gapless Sequencing
- Sequential, gapless numbering rendered as `INV-{YYYY}-{Sequence}` (e.g. `INV-2026-000124`), `MAX+1` per tenant/series/year in a serializable transaction with a unique DB index. The column set is `TenantId`/`FinancialYear`/`Series`/`InvoiceNumber`; the label is the calendar year, not the Indian FY.
- Server-side printable payload:
  - `GET /api/v1/invoices/{id}/print`: finalized invoices only; returns a JSON layout for the UI (no PDF renderer).
  - Reprints logged to `InvoicePrintLogs` and watermarked with `"DUPLICATE COPY"`.
- Inviolable rule: Mistakes are corrected via **Credit Notes** and re-invoicing, **never by modifying finalized invoices**.

---

### 5.5 Manual-First Payment Capture
- Direct clinic bank flow only: money moves strictly **Patient → Clinic Bank Account**. (No middleman settlement, no wallet pooling, zero aggregator risk).
- **Supported Payment Methods:**
  - `Cash`: Handed to front desk.
  - `Card`: Terminal POS swipe, staff records card slip transaction reference.
  - `UpiQr`: Dynamic UPI QR generated on screen using NPCI UPI Deep Link standards:
    `upi://pay?pa={VPA}&pn={ClinicName}&am={Amount}&tr={InvoiceRef}&cu=INR&tn=Invoice+{InvoiceNum}`
    - Displays primary payee account with a prominent **"Use Backup Account"** toggle.
  - `BankTransfer`: NEFT / RTGS / IMPS.
- **Partial & Split Payments:**
  - Multiple payment attempts per invoice allowed (e.g., ₹500 Cash + ₹700 UPI for a ₹1,200 bill).
  - Each payment record tracks its own method, timestamp, and transaction reference.

---

### 5.6 Staff Confirmation & Settlement Verification
- **Payment Verification States:**
  - `Reported`: Patient claims they paid (e.g., showed screen on mobile). Hint only, never marks invoice paid.
  - `Confirmed`: Staff checks bank mobile app or soundbox confirmation, verifies credit, enters UTR (mandatory above clinic-set threshold, e.g. ₹2,000) → moves payment to `Completed`.
  - Invoice moves to `Paid` (or `PartiallyPaid` if balance remains).
- **Fraud & Anti-Leakage Controls:**
  - A second confirm of the same payment, an amount above the balance, and an unknown tender are rejected; retries are idempotent.
  - Daily cap on unconfirmed reported payments and spike alerts are **not built** (no clinic threshold setting).

---

### 5.7 Payee Account Controls
- Payee bank accounts and UPI VPAs configured in `PayeeAccounts`:
  - `AccountHolderName`, `Vpa`, `BankName`, `AccountNumberMasked`, `IfscCode`.
  - `PriorityOrder`: Primary vs. Backup accounts, unique among the clinic's active accounts.
  - `DailyCollectionLimit`: Protects against frozen merchant accounts or UPI throttling.
- Accounts are clinic-scoped: a dynamic QR only offers the invoice clinic's own account, and a multi-clinic tenant cannot cross-route money.
- **Security Guardrails:**
  - Modification restricted to `ClinicAdmin` (there is no `Owner` role).
  - Password re-entry plus the enrolled MFA code (authenticator/email) on every add/update.
  - 24-hour cooling-off before a new or re-activated bank/VPA can receive dynamic QR traffic.
  - Email alert dispatched to every clinic admin on add/update.
  - `DailyLimit`/`DailyCollected` are stored but **not enforced**; payments do not record the receiving payee account yet.

---

### 5.8 Refunds & Credit Notes
- **Credit Notes (`POST /api/v1/invoices/{id}/credit-notes`):**
  - Only against a finalized/paid/partially paid invoice; draft/cancelled refused.
  - Carries its own sequential series (`CN-YYYY-XXXXXX`), MAX+1 numbering.
  - Requires a reason; cumulative notes are capped at the invoice total.
  - Dual approval above a threshold is **not built** (issuer must be `ClinicAdmin`).
- **Refunds:**
  - **Not built.** No endpoint, no `RefundProcessed` posting; manual refund UTR capture is deferred.

---

### 5.9 Append-Only Financial Ledger & Daily Reconciliation
- Immutable financial ledger table (`FinanceLedgerEntries`), protected by DB role permissions (`REVOKE UPDATE, DELETE FROM app_user`).
- Automated ledger postings for:
  - `InvoiceFinalized`: Debit Accounts Receivable, Credit Revenue (per category) and GST; discount posted as a `DiscountAllowed` debit.
  - `PaymentConfirmed`: Debit Cash / Bank Account, Credit Accounts Receivable (manual confirm, legacy collect and Razorpay webhook).
  - `CreditNoteIssued`: Debit Sales Returns, Credit Accounts Receivable.
  - `RefundProcessed`: **reserved, unused** — refunds are not built.
- **Daily Reconciliation:**
  - End-of-day summary comparing:
    $\text{Reported Cash/UPI} \iff \text{Staff Confirmed} \iff \text{Bank Credits}$.
  - Daily collection reports by method, outstanding dues by patient, and aging analysis.

---

### 5.10 Deferred Capabilities (Reserved Architecture)
- **v1.5:** Bank statement CSV/MT940 import → automatic rule-based matching on UTR + amount + timestamp.
- **v2.0:** WhatsApp payment link via opt-in with expiration and Razorpay/Meta webhook.
- **v3.0:** Live PSP gateway adapters and automated account routing based on bank success rates.

