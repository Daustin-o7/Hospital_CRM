# Clinic Onboarding Runbook (B5)

**Goal:** a real clinic goes from signed contract to its first appointment in under
30 minutes, with no step that only the founder knows how to do.

**Owner:** whoever is on support rotation that day. If any step needs a developer,
this runbook has failed — write down which step and why.

**Prerequisites for this runbook to work**

- Platform Admin credentials (`platform-admin@…`) and access to the console at
  `/platform/admin`.
- The subscription webhook secret is configured (`SubscriptionBilling:WebhookSecrets:razorpay`).
  Without it the billing endpoint answers `503 billing_not_configured`; that is
  expected on a fresh environment, not an incident.
- The clinic has decided which modules it bought (core is always included).

---

## 0. Before the clock starts (not counted in the 30 minutes)

| # | Step | Who | Evidence |
|---|------|-----|----------|
| 0.1 | Contract pack (MSA / DPA / SLA) signed, including the impersonation clause (D4) and the hybrid-payments clause (D7) | Sales + legal | Signed PDF in the client folder |
| 0.2 | Billing details agreed: tier, price, billing cycle, setup fee / AMC (manual invoice lines until B4 billing is live) | Sales | Signed order form |
| 0.3 | Clinic nominates its first Clinic Admin (name + email). **No password is ever generated or sent.** | Sales | Written confirmation |

> Do not proceed on a verbal "yes". Step 0.1 is the P0-5 gate.

---

## 1. Provision the tenant (2 minutes)

1. Sign in to the console as Platform Admin.
2. **Platform Admin → Provision tenant.**
3. Fill in: tenant name, clinic name, admin name, admin email, timezone, tier,
   status (Trial unless already paid), subscription end date, and tick the modules
   bought. Core is locked on.
4. Submit. The form sends one `X-Idempotency-Key`; clicking twice cannot create a
   second tenant.
5. Copy the invite link shown in the success panel. It is shown **once** and is
   valid for **72 hours**.

**Verify**

- The tenant appears in the list with the expected tier and module badges.
- `SELECT count(*) FROM "Tenants" WHERE "Name" = '<name>'` returns 1.
- Re-submitting the same request returns the same `tenantId` (idempotent).

---

## 2. Hand over the invite (1 minute)

Send the invite link to the nominated Clinic Admin over the channel agreed in the
contract (WhatsApp or email). Do not forward it to anyone else — it is single-use.

The admin sets their own password (minimum 8 characters) and lands in the clinic
dashboard.

**Verify**

- The admin can sign in and sees only their clinic's (empty) patient list.
- A second attempt to use the same link returns `invalid_or_expired_invite`.

---

## 3. Clinic setup, done by the admin (10–15 minutes)

Walk them through only what they need on day one:

1. **Settings → Clinic profile**: confirm name, address, phone, GSTIN, timezone.
2. **Settings → Staff**: invite the receptionist and at least one doctor. Each
   invite is single-use, 72 hours.
3. **Settings → Payments**: connect the clinic's own Paytm Business / PhonePe
   Business account (merchant id + webhook secret), press **Test configuration**,
   and copy the webhook URL into the PSP dashboard.
   - If the clinic uses a plain UPI QR or Google Pay for Business with no webhook,
     install the Android app on the receptionist's phone and grant SMS and
     notification access. That is the fallback path.
4. **Pharmacy / Inventory** (only if bought): add top 20 medicines and opening stock.

**Verify**

- Staff list shows the invited people as pending, then active after they accept.
- **Test configuration** returns `verified: true` and stores `lastVerifiedAt`.
- A ₹1 live test payment to the clinic's own QR closes a test invoice, or appears
  in **Payments needing review** if the amount does not match.

---

## 4. First booking — the 30-minute bar (5 minutes)

The receptionist, on their own device, not yours:

1. Register a walk-in patient.
2. Book an appointment for today.
3. Take payment (cash or UPI) and print/share the receipt.

**Verify**

- The doctor sees the patient in their queue.
- The bill shows Paid and the payment carries a UTR when UPI was used.
- `Reports → Today` reflects the collection.

**Stop the clock when the receipt is in the patient's hand.** If this took longer
than 30 minutes from step 1, record where the time went.

---

## 5. Close-out (5 minutes)

- [ ] Billing state is correct: `Trial` with an end date, or `Active` if paid.
- [ ] Modules enabled match what was sold.
- [ ] Support contact and escalation path given to the admin in writing.
- [ ] The clinic knows where the audit log lives and that it is append-only.
- [ ] Internal record: tenant id, clinic id, admin email, go-live date, tier.

---

## Rollback

If provisioning went wrong before the clinic used it:

1. Platform Admin → tenant → **Suspend** (blocks access immediately, keeps data).
2. If the tenant must be removed entirely, that is a manual SQL operation with the
   owner connection — the app has no delete-tenant endpoint by design. Remove in
   this order: users → invites → feature flags → clinic → tenant.

Never delete a tenant that has recorded a payment or a clinical note. Suspend it.

---

## Known gaps at the time of writing

- B4 (subscription billing) is wired provider-agnostically but has never run against
  a live Razorpay account. Until it has, billing state is set manually in the console.
- GST-compliant invoices for SAMSTACK's own fees still need accountant sign-off.
- The Android bridge is compiled but has not been exercised on a physical device
  receiving a real bank SMS.
