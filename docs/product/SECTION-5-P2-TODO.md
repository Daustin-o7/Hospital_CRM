# Section 5 — P2 Gaps

> Target: address the P2 rows from the 2026-10-27 re-verification so the claim list is accurate.
> Status as of 2026-10-27. Verified with `dotnet build` (0 errors), `dotnet test` (332 passed / 0 failed), `npm run build`, `npm run lint`.

---

## 1. Dual-control credit notes & refunds — DONE
- [x] `ThresholdCreditNoteApproval` on `TenantTaxProfile` (default ₹5,000)
- [x] `CreateCreditNote`: at/above the threshold → `CreditNoteStatus.PendingApproval`, no ledger post, no balance change; below → single-approver `Approved` as before
- [x] `POST /credit-notes/{id}/approve` and `/reject` (`ClinicAdmin`, `Owner`); issuer cannot approve or reject their own note; approval re-checks the cumulative cap before posting
- [x] Ledger reversal pair (`CreditNoteIssued`) + `BalanceDue` reduction moved to approval time
- [x] `CreditNote.SecondApprovedByUserId` + `Status`; append-only guard permits exactly that one decision transition and nothing else
- [x] Refund endpoint delivered in the same branch (`POST /invoices/{id}/refund` + `/refunds/{refundId}/approve`, `ThresholdRefundApproval`, mandatory UTR)
- [x] Docs updated (`SECTION-5-TODO.md` §5.8, `WORKFLOW.md` §5.7/§5.8)

## 2. Owner role — DONE
- [x] `Owner` added to `UserRole` (after `ClinicAdmin`) and to `MfaPolicy.RequiresEnrolment`
- [x] `PayeeAccountsController` list/create/update accept `Owner`
- [x] Credit-note create/approve/reject accept `Owner`; refund second approver accepts `Owner`
- Note: `Owner` is an approval role only — it is deliberately **not** in `PermissionRegistry`, so it has no clinical/invoice write permissions of its own.

## 3. Indian Financial Year (Apr–Mar) numbering — ALREADY BUILT, docs corrected
- [x] `IndianFinancialYearUtils.GetFinancialYear` → `"2026-27"`
- [x] `Invoice.FinancialYear` stores the FY; rendered numbers are `INV-{FY}-{D6}` / `CN-{FY}-{D6}`
- [x] Sequence resets on 1 April via the existing unique index `(TenantId, FinancialYear, Series, InvoiceNumber)`
- [x] No backfill: historical rows keep their original calendar-year value, so already-issued numbers never change.

## 4. Invoice draft autosave — SERVER DONE, UI NOT BUILT
- [x] `PATCH /invoices/{id}` (`Receptionist`/`Doctor`/`ClinicAdmin`, `InvoiceWrite`) updates draft line items, discount, walk-in details; re-validates tax/discount rules and recomputes totals
- [ ] Frontend debounced autosave in `Billing.tsx` — still manual "save line items". Documented as a known limit.

## 5. Append-only guard method name — DONE
- [x] `EnforceAppendOnlyAuditLogs` → `PreventAppendOnlyModifications` (both `SaveChanges`/`SaveChangesAsync` call sites)

## 6. Docs corrections — DONE
- [x] Test/migration counts corrected (`SECTION-5-TODO.md`)
- [x] "no Owner role", "no refund endpoint", "no dual approval", "calendar year not FY" claims removed
- [x] `docs/SESSION-LOG.md` entry appended

---

## Migrations added by this work

- `20261027153035_Section5CreditNoteStatusBackfill` — data-only: marks historical credit notes `Approved` (they were all posted to the ledger under the old single-approver flow) and records the original approver as second approver. Only rows that actually have a `CreditNoteIssued` ledger entry are flipped, so a genuinely pending note stays pending.
- The schema columns (`CreditNote.Status`, `CreditNote.SecondApprovedByUserId`, `TenantTaxProfile.ThresholdCreditNoteApproval`) arrived with `20261027032204_Section5PatientDepositsAndAdvances`; `has-pending-model-changes` is clean.

---

## Out of Scope (still documented limits)

- Bank statement / MT940 import
- Reported-payment daily cap / spike alerts
- Payee `DailyLimit` enforcement (needs `Payment.PayeeAccountId` populated)
- `PrintCount` race (use `ROW_NUMBER()` on print log or DB sequence)
- PDF renderer (print returns JSON; CA sign-off required before investment)
- Billing-screen autosave timer
