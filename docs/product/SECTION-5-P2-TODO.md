# Section 5 — P2 Gaps (Documented Limits, Not Built)

> Target: address the P2 rows from the 2026-10-27 re-verification so the claim list is accurate.
> Priority: **P2** — not money bugs, but docs/code must match. One item per row below.

---

## 1. Dual-control credit notes & refunds
- [ ] Add `SecondApprovedByUserId` (already exists on `Payment` from other agent's branch)
- [ ] Add `ThresholdCreditNoteApproval` on `TenantTaxProfile` (configurable by ClinicAdmin)
- [ ] `CreateCreditNote`:
  - If `amount >= threshold` → require a second `ClinicAdmin` approval step (separate endpoint or status=PendingApproval)
  - Otherwise single approver (current behaviour)
- [ ] Refund endpoint (currently missing):
  - `POST /invoices/{id}/refunds` — ClinicAdmin initiates, second ClinicAdmin approves above threshold
  - Posts `FinanceEntryType.RefundProcessed` reversal pair to ledger
  - Captures bank UTR reference
- [ ] Update claim in `SECTION-5-TODO.md`, `WORKFLOW.md`, `SESSION-LOG.md`

---

## 2. Owner role
- [ ] Add `Owner` to `UserRole` enum (between `ClinicAdmin` and `PlatformAdmin`)
- [ ] Update `[AuthorizeRoles]` attributes where "Owner" is mentioned:
  - `PayeeAccountsController` (add/update)
  - Any future dual-approval threshold checks
- [ ] Update claim in docs

---

## 3. Indian Financial Year (Apr–Mar) numbering
- [ ] Helper `GetIndianFinancialYear(DateTime)` → `"2026-27"` format
- [ ] `Invoice.FinancialYear` stores FY string (e.g., `"2026-27"`) not calendar year
- [ ] `GenerateInvoice`/`Finalize` use FY for sequence scope and rendered number: `INV-2026-27-000001`
- [ ] Unique index already on `(TenantId, FinancialYear, Series, InvoiceNumber)` — works unchanged
- [ ] Migration to backfill existing rows if any

---

## 4. Invoice draft autosave
- [ ] `PATCH /invoices/{id}` (Receptionist/Doctor/ClinicAdmin, `InvoiceWrite`) — update line items, discounts, notes while `Status == Draft`
- [ ] Idempotency key on create; autosave uses same key to update the draft
- [ ] Frontend: debounced save in `Billing.tsx` invoice builder (1.5s after last change)
- [ ] Docs claim correction

---

## 5. Append-only guard method name
- [ ] Rename `EnforceAppendOnlyAuditLogs` → `PreventAppendOnlyModifications` in `HospitalCrmDbContext.cs`
- [ ] Update XML comment and any call sites (two: `SaveChangesAsync` override + `SaveChangesAsync` with `AcceptAllChangesOnSuccess`)

---

## 6. Docs corrections (test count, migration count)
- [ ] `SECTION-5-TODO.md`: "310 tests, two migrations"
- [ ] `WORKFLOW.md`: same
- [ ] `SESSION-LOG.md` verification block: already correct after 2026-10-27 entry
- [ ] Remove "301 tests / one migration" references

---

## Execution Order (dependency-aware)

1. **Rename guard method** (trivial, no deps)
2. **Owner role enum** (no deps)
3. **Indian FY helper + migration** (touches `Invoice`, `InvoicesController`)
4. **Invoice autosave PATCH** (uses FY helper)
5. **Dual-control threshold + refund endpoint** (uses Owner role, FY not required)
6. **Docs sweep** (last)

---

## Out of Scope (still P2, left as documented)

- Patient deposits/advances (`PatientDeposit` table)
- Bank statement / MT940 import
- Reported-payment daily cap / spike alerts
- Payee `DailyLimit` enforcement (needs `Payment.PayeeAccountId` populated)
- Statement import
- `PrintCount` race (use `ROW_NUMBER()` on print log or DB sequence)
- PDF renderer (print returns JSON; CA sign-off required before investment)